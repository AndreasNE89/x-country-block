import { onlyShowAllowed, trialStartedAtFromUnknown } from "./license.ts";
import { REGION_IDS } from "./regions.ts";
import type { FilterMode, Settings } from "./types.ts";

export function emptySettings(): Settings {
  return {
    hiddenCountryCodes: [],
    hiddenLanguageCodes: [],
    hiddenRegionIds: [],
    markOnly: false,
    filterMode: "hide",
    onlyShowPaid: false,
    trialStartedAt: null,
    onlyShowUnlocked: false,
  };
}

export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return emptySettings();
  const obj = raw as Record<string, unknown>;
  const onlyShowPaid = obj.onlyShowPaid === true;
  const trialStartedAt = trialStartedAtFromUnknown(obj.trialStartedAt);
  return {
    hiddenCountryCodes: normalizeCodes(obj.hiddenCountryCodes, "upper"),
    hiddenLanguageCodes: normalizeCodes(obj.hiddenLanguageCodes, "lower"),
    hiddenRegionIds: normalizeRegionIds(obj.hiddenRegionIds),
    markOnly: obj.markOnly === true,
    filterMode: parseFilterMode(obj.filterMode),
    onlyShowPaid,
    trialStartedAt,
    onlyShowUnlocked: onlyShowAllowed(onlyShowPaid, trialStartedAt),
  };
}

function parseFilterMode(value: unknown): FilterMode {
  return value === "only" ? "only" : "hide";
}

function normalizeCodes(value: unknown, caseStyle: "upper" | "lower"): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(caseStyle === "upper" ? trimmed.toUpperCase() : trimmed.toLowerCase());
  }
  return out;
}

function normalizeRegionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim().toUpperCase().replace(/-/g, "_");
    if (REGION_IDS.has(id)) out.push(id);
  }
  return out;
}
