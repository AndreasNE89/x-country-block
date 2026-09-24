import { foldSearch, matchRank, type SearchRow } from "./search.ts";

export type OptionRow = SearchRow;

/**
 * Rows to show for a search. Order: match strength, then ticked rows, then A-Z.
 * Call it only when the tab or the query changes, never after a toggle, so a
 * row never moves under the pointer.
 */
export function visibleOptionRows(
  rows: readonly OptionRow[],
  selected: readonly string[],
  query: string,
): OptionRow[] {
  const q = foldSearch(query);
  const picked = new Set(selected);
  const ranked: { row: OptionRow; rank: number }[] = [];
  for (const row of rows) {
    const rank = matchRank(row, q);
    if (rank !== null) ranked.push({ row, rank });
  }
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(picked.has(b.row.id)) - Number(picked.has(a.row.id)) ||
      a.row.label.localeCompare(b.row.label),
  );
  return ranked.map((item) => item.row);
}
