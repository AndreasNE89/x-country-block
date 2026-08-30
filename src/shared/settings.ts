import type { Settings } from "./types.ts";

export function emptySettings(): Settings {
  return { hiddenCountryCodes: [], hiddenLanguageCodes: [] };
}

export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return emptySettings();
  const obj = raw as Record<string, unknown>;
  return {
    hiddenCountryCodes: normalizeCodes(obj.hiddenCountryCodes, "upper"),
    hiddenLanguageCodes: normalizeCodes(obj.hiddenLanguageCodes, "lower"),
  };
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
