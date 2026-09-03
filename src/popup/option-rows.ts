export type OptionRow = { id: string; label: string };

export function visibleOptionRows(
  rows: OptionRow[],
  selected: readonly string[],
  query: string,
): OptionRow[] {
  const q = query.trim().toLowerCase();
  const picked = new Set(selected);
  const filtered = q
    ? rows.filter(
        (row) => row.label.toLowerCase().includes(q) || row.id.toLowerCase().includes(q),
      )
    : rows;
  return [...filtered].sort((a, b) => {
    const aOn = picked.has(a.id);
    const bOn = picked.has(b.id);
    if (aOn !== bOn) return aOn ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}
