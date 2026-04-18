export type Diff<T> = {
  [K in keyof T]?: { before: T[K]; after: T[K] };
};

export function buildDiff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: readonly (keyof T)[],
  provided: Partial<T>
): Diff<T> {
  const changed: Diff<T> = {};
  for (const k of keys) {
    if (provided[k] !== undefined && before[k] !== after[k]) {
      changed[k] = { before: before[k], after: after[k] };
    }
  }
  return changed;
}
