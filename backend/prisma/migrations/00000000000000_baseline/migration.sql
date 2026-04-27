-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operador',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acessos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "cargo" TEXT,
    "responsavel_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acessos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "csrf_token" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depositos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depositos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcionarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "setor_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "deposito_id" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "minimo" INTEGER NOT NULL DEFAULT 0,
    "valor_atual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "obs" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entradas" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qtd" INTEGER NOT NULL,
    "valor_unit" DECIMAL(14,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "responsavel_user_id" TEXT NOT NULL,
    "obs" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saidas" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qtd" INTEGER NOT NULL,
    "valor_unit" DECIMAL(14,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "setor_snapshot_id" TEXT,
    "setor_snapshot_nome" TEXT NOT NULL,
    "responsavel_user_id" TEXT NOT NULL,
    "obs" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qtd_anterior" INTEGER NOT NULL,
    "qtd_nova" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "responsavel_user_id" TEXT NOT NULL,
    "obs" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "acessos_data_idx" ON "acessos"("data");

-- CreateIndex
CREATE INDEX "acessos_tipo_idx" ON "acessos"("tipo");

-- CreateIndex
CREATE INDEX "acessos_responsavel_user_id_idx" ON "acessos"("responsavel_user_id");

-- CreateIndex
CREATE INDEX "acessos_criado_em_idx" ON "acessos"("criado_em");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "setores_nome_key" ON "setores"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "depositos_nome_key" ON "depositos"("nome");

-- CreateIndex
CREATE INDEX "funcionarios_setor_id_idx" ON "funcionarios"("setor_id");

-- CreateIndex
CREATE INDEX "funcionarios_ativo_idx" ON "funcionarios"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "items_codigo_key" ON "items"("codigo");

-- CreateIndex
CREATE INDEX "items_ativo_categoria_id_deposito_id_idx" ON "items"("ativo", "categoria_id", "deposito_id");

-- CreateIndex
CREATE INDEX "items_quantidade_minimo_idx" ON "items"("quantidade", "minimo");

-- CreateIndex
CREATE INDEX "items_criado_em_idx" ON "items"("criado_em");

-- CreateIndex
CREATE INDEX "entradas_item_id_idx" ON "entradas"("item_id");

-- CreateIndex
CREATE INDEX "entradas_data_idx" ON "entradas"("data");

-- CreateIndex
CREATE INDEX "entradas_responsavel_user_id_idx" ON "entradas"("responsavel_user_id");

-- CreateIndex
CREATE INDEX "entradas_criado_em_idx" ON "entradas"("criado_em");

-- CreateIndex
CREATE INDEX "saidas_item_id_idx" ON "saidas"("item_id");

-- CreateIndex
CREATE INDEX "saidas_funcionario_id_idx" ON "saidas"("funcionario_id");

-- CreateIndex
CREATE INDEX "saidas_data_idx" ON "saidas"("data");

-- CreateIndex
CREATE INDEX "saidas_setor_snapshot_id_idx" ON "saidas"("setor_snapshot_id");

-- CreateIndex
CREATE INDEX "saidas_responsavel_user_id_idx" ON "saidas"("responsavel_user_id");

-- CreateIndex
CREATE INDEX "saidas_criado_em_idx" ON "saidas"("criado_em");

-- CreateIndex
CREATE INDEX "ajustes_item_id_idx" ON "ajustes"("item_id");

-- CreateIndex
CREATE INDEX "ajustes_responsavel_user_id_idx" ON "ajustes"("responsavel_user_id");

-- CreateIndex
CREATE INDEX "ajustes_criado_em_idx" ON "ajustes"("criado_em");

-- AddForeignKey
ALTER TABLE "acessos" ADD CONSTRAINT "acessos_responsavel_user_id_fkey" FOREIGN KEY ("responsavel_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_responsavel_user_id_fkey" FOREIGN KEY ("responsavel_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_setor_snapshot_id_fkey" FOREIGN KEY ("setor_snapshot_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_responsavel_user_id_fkey" FOREIGN KEY ("responsavel_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_responsavel_user_id_fkey" FOREIGN KEY ("responsavel_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
