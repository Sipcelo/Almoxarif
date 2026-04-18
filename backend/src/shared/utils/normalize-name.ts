/**
 * Normaliza nome de entidade de settings: trim + lowercase.
 * Garante que "Almoxarifado", "almoxarifado", " Almoxarifado " virem a mesma chave.
 */
export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase();
}
