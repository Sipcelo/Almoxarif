const PREPOSITIONS = new Set([
  "de", "do", "da", "dos", "das", "e", "ou", "em", "no", "na", "nos", "nas",
  "por", "para", "com", "sem", "ao", "aos",
]);

const ACRONYM_RE = /^[A-Z0-9]{2,5}$/;

function capitalizeWord(word: string, isFirst: boolean): string {
  if (ACRONYM_RE.test(word)) return word;
  const lower = word.toLowerCase();
  if (!isFirst && PREPOSITIONS.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function normalizeName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  let wordIndex = 0;
  return collapsed.replace(/[^\s/]+/g, (token) => {
    const result = capitalizeWord(token, wordIndex === 0);
    wordIndex++;
    return result;
  });
}
