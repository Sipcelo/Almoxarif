const PREPOSITIONS = new Set([
  "de", "do", "da", "dos", "das", "e", "ou", "em", "no", "na", "nos", "nas",
  "por", "para", "com", "sem", "ao", "aos",
]);

export function normalizeName(raw: string): string {
  const words = raw.trim().replace(/\s+/g, " ").split(" ");
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && PREPOSITIONS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
