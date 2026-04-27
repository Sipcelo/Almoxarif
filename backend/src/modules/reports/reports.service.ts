import { prisma } from "../../infra/prisma";

function computeCorte(periodo: number): Date {
  return new Date(Date.now() - periodo * 24 * 60 * 60 * 1000);
}

function fmtDecimal(n: number): string {
  return n.toFixed(2);
}

export async function getMetricas(periodo: number) {
  const corte = computeCorte(periodo);

  const [items, entradasAgg, saidasRows] = await Promise.all([
    prisma.item.findMany({
      where: { ativo: true },
      select: { id: true, codigo: true, descricao: true, quantidade: true, minimo: true, valorAtual: true },
    }),
    prisma.entrada.aggregate({
      where: { data: { gte: corte } },
      _count: { _all: true },
      _sum: { qtd: true },
    }),
    prisma.saida.findMany({
      where: { data: { gte: corte } },
      select: { qtd: true, valorUnit: true },
    }),
  ]);

  const totalValorRaw = items.reduce((s, i) => s + i.quantidade * Number(i.valorAtual), 0);
  const itensCriticos = items
    .filter((i) => i.quantidade < i.minimo)
    .map(({ id, codigo, descricao, quantidade, minimo }) => ({ id, codigo, descricao, quantidade, minimo }));

  const saidasTotalValorRaw = saidasRows.reduce((s, x) => s + x.qtd * Number(x.valorUnit), 0);

  return {
    periodo,
    corte: corte.toISOString(),
    estoque: {
      totalItens: items.length,
      totalQtd: items.reduce((s, i) => s + i.quantidade, 0),
      totalValor: fmtDecimal(totalValorRaw),
    },
    entradas: {
      count: entradasAgg._count._all,
      totalQtd: entradasAgg._sum.qtd ?? 0,
    },
    saidas: {
      count: saidasRows.length,
      totalQtd: saidasRows.reduce((s, x) => s + x.qtd, 0),
      totalValor: fmtDecimal(saidasTotalValorRaw),
    },
    itensCriticos,
  };
}

export async function getMovimentacoes(periodo: number) {
  const corte = computeCorte(periodo);

  const [rawEntradas, rawSaidas, rawAjustes] = await Promise.all([
    prisma.entrada.findMany({
      where: { data: { gte: corte } },
      select: {
        id: true,
        itemId: true,
        qtd: true,
        valorUnit: true,
        data: true,
        responsavelUserId: true,
        obs: true,
        item: { select: { codigo: true, descricao: true } },
        responsavelUser: { select: { nome: true } },
      },
      orderBy: { data: "desc" },
    }),
    prisma.saida.findMany({
      where: { data: { gte: corte } },
      select: {
        id: true,
        itemId: true,
        qtd: true,
        valorUnit: true,
        data: true,
        funcionarioId: true,
        setorSnapshotNome: true,
        responsavelUserId: true,
        obs: true,
        item: { select: { codigo: true, descricao: true } },
        funcionario: { select: { nome: true } },
        responsavelUser: { select: { nome: true } },
      },
      orderBy: { data: "desc" },
    }),
    prisma.ajuste.findMany({
      where: { criadoEm: { gte: corte } },
      select: {
        id: true,
        itemId: true,
        qtdAnterior: true,
        qtdNova: true,
        motivo: true,
        responsavelUserId: true,
        obs: true,
        criadoEm: true,
        item: { select: { codigo: true, descricao: true } },
        responsavelUser: { select: { nome: true } },
      },
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  const entradas = rawEntradas.map((e) => ({
    id: e.id,
    itemId: e.itemId,
    itemCodigo: e.item.codigo,
    itemDescricao: e.item.descricao,
    qtd: e.qtd,
    valorUnit: String(e.valorUnit),
    valorTotal: fmtDecimal(e.qtd * Number(e.valorUnit)),
    data: e.data.toISOString(),
    responsavelUserId: e.responsavelUserId,
    responsavelNome: e.responsavelUser.nome,
    obs: e.obs,
  }));

  const saidas = rawSaidas.map((s) => ({
    id: s.id,
    itemId: s.itemId,
    itemCodigo: s.item.codigo,
    itemDescricao: s.item.descricao,
    qtd: s.qtd,
    valorUnit: String(s.valorUnit),
    valorTotal: fmtDecimal(s.qtd * Number(s.valorUnit)),
    data: s.data.toISOString(),
    funcionarioId: s.funcionarioId,
    funcionarioNome: s.funcionario.nome,
    setorSnapshotNome: s.setorSnapshotNome,
    responsavelUserId: s.responsavelUserId,
    responsavelNome: s.responsavelUser.nome,
    obs: s.obs,
  }));

  const ajustes = rawAjustes.map((a) => ({
    id: a.id,
    itemId: a.itemId,
    itemCodigo: a.item.codigo,
    itemDescricao: a.item.descricao,
    qtdAnterior: a.qtdAnterior,
    qtdNova: a.qtdNova,
    motivo: a.motivo,
    responsavelUserId: a.responsavelUserId,
    responsavelNome: a.responsavelUser.nome,
    obs: a.obs,
    criadoEm: a.criadoEm.toISOString(),
  }));

  return { periodo, entradas, saidas, ajustes };
}

export async function getPorSetor(periodo: number) {
  const corte = computeCorte(periodo);

  const saidas = await prisma.saida.findMany({
    where: { data: { gte: corte } },
    select: {
      id: true,
      itemId: true,
      qtd: true,
      valorUnit: true,
      funcionarioId: true,
      setorSnapshotNome: true,
      item: { select: { codigo: true, descricao: true } },
      funcionario: { select: { nome: true } },
    },
  });

  type SetorGroup = {
    count: number;
    totalQtd: number;
    totalValorRaw: number;
    itenMap: Map<string, { itemCodigo: string; itemDescricao: string; qtd: number; valorRaw: number }>;
    funcMap: Map<string, { funcionarioId: string; funcionarioNome: string; qtd: number; valorRaw: number }>;
  };

  const setorMap = new Map<string, SetorGroup>();

  for (const s of saidas) {
    const setor = s.setorSnapshotNome;
    if (!setorMap.has(setor)) {
      setorMap.set(setor, { count: 0, totalQtd: 0, totalValorRaw: 0, itenMap: new Map(), funcMap: new Map() });
    }
    const g = setorMap.get(setor)!;
    const valor = s.qtd * Number(s.valorUnit);
    g.count++;
    g.totalQtd += s.qtd;
    g.totalValorRaw += valor;

    const itemKey = s.itemId;
    if (!g.itenMap.has(itemKey)) {
      g.itenMap.set(itemKey, { itemCodigo: s.item.codigo, itemDescricao: s.item.descricao, qtd: 0, valorRaw: 0 });
    }
    const im = g.itenMap.get(itemKey)!;
    im.qtd += s.qtd;
    im.valorRaw += valor;

    const funcKey = s.funcionarioId;
    if (!g.funcMap.has(funcKey)) {
      g.funcMap.set(funcKey, { funcionarioId: s.funcionarioId, funcionarioNome: s.funcionario.nome, qtd: 0, valorRaw: 0 });
    }
    const fm = g.funcMap.get(funcKey)!;
    fm.qtd += s.qtd;
    fm.valorRaw += valor;
  }

  const setores = Array.from(setorMap.entries())
    .sort((a, b) => b[1].totalValorRaw - a[1].totalValorRaw)
    .map(([setor, g]) => ({
      setor,
      count: g.count,
      totalQtd: g.totalQtd,
      totalValor: fmtDecimal(g.totalValorRaw),
      itens: Array.from(g.itenMap.values())
        .sort((a, b) => b.valorRaw - a.valorRaw)
        .map(({ itemCodigo, itemDescricao, qtd, valorRaw }) => ({
          itemCodigo,
          itemDescricao,
          qtd,
          valor: fmtDecimal(valorRaw),
        })),
      funcionarios: Array.from(g.funcMap.values())
        .sort((a, b) => b.valorRaw - a.valorRaw)
        .map(({ funcionarioId, funcionarioNome, qtd, valorRaw }) => ({
          funcionarioId,
          funcionarioNome,
          qtd,
          valor: fmtDecimal(valorRaw),
        })),
    }));

  return { periodo, setores };
}

export async function getEstoque() {
  const items = await prisma.item.findMany({
    where: { ativo: true },
    select: {
      id: true,
      codigo: true,
      descricao: true,
      quantidade: true,
      minimo: true,
      valorAtual: true,
      obs: true,
      criadoEm: true,
      categoria: { select: { nome: true } },
      deposito: { select: { nome: true } },
    },
    orderBy: { codigo: "asc" },
  });

  let totalQtd = 0;
  let totalValorRaw = 0;

  const mappedItems = items.map((i) => {
    const valorRaw = i.quantidade * Number(i.valorAtual);
    totalQtd += i.quantidade;
    totalValorRaw += valorRaw;

    let status: "ok" | "baixo" | "zero";
    if (i.quantidade === 0) status = "zero";
    else if (i.quantidade < i.minimo) status = "baixo";
    else status = "ok";

    return {
      id: i.id,
      codigo: i.codigo,
      descricao: i.descricao,
      categoria: i.categoria.nome,
      deposito: i.deposito.nome,
      quantidade: i.quantidade,
      minimo: i.minimo,
      valorAtual: String(i.valorAtual),
      valorTotal: fmtDecimal(valorRaw),
      status,
      obs: i.obs,
      criadoEm: i.criadoEm.toISOString(),
    };
  });

  return {
    geradoEm: new Date().toISOString(),
    totalItens: items.length,
    totalQtd,
    totalValor: fmtDecimal(totalValorRaw),
    itens: mappedItems,
  };
}
