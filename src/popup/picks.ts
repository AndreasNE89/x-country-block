import type { Settings } from "../shared/types.ts";
import { type PickKind, pickLabel } from "./catalog.ts";

export type PickField = "hiddenLanguageCodes" | "hiddenCountryCodes" | "hiddenRegionIds";

export const PICK_FIELD: Record<PickKind, PickField> = {
  languages: "hiddenLanguageCodes",
  countries: "hiddenCountryCodes",
  regions: "hiddenRegionIds",
};

export type Pick = { kind: PickKind; id: string; label: string };

// Places before languages, so a status reads "Showing only Norway, Norwegian".
const SUMMARY_ORDER: readonly PickKind[] = ["countries", "regions", "languages"];

const TAB_NAMES: Record<PickKind, string> = {
  languages: "Languages",
  countries: "Countries",
  regions: "Regions",
};

export function picksOf(settings: Settings, kind: PickKind): readonly string[] {
  return settings[PICK_FIELD[kind]];
}

export function selectedPicks(settings: Settings): Pick[] {
  return SUMMARY_ORDER.flatMap((kind) =>
    picksOf(settings, kind).map((id) => ({ kind, id, label: pickLabel(kind, id) })),
  );
}

export function pickTotal(settings: Settings): number {
  return SUMMARY_ORDER.reduce((sum, kind) => sum + picksOf(settings, kind).length, 0);
}

export function summarizeNames(names: readonly string[], max = 3): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

export function toggleCode(list: readonly string[], id: string, on: boolean): string[] {
  if (on) return list.includes(id) ? [...list] : [...list, id];
  return list.filter((item) => item !== id);
}

export function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

export function tabName(kind: PickKind): string {
  return TAB_NAMES[kind];
}

export function tabLabel(kind: PickKind, count: number): string {
  return count > 0 ? `${TAB_NAMES[kind]} · ${count}` : TAB_NAMES[kind];
}
