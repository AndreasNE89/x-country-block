import { normalizeLang } from "./languages.ts";
import { onlyShowAllowed, trialStartedAtFromUnknown } from "./license.ts";
import { REGION_IDS } from "./regions.ts";
import type { FilterMode, Settings } from "./types.ts";

/** Every chrome.storage.local key that parseSettings reads. */
export const SETTINGS_KEYS = [
  "enabled",
  "hiddenCountryCodes",
  "hiddenLanguageCodes",
  "hiddenRegionIds",
  "allowedHandles",
  "markOnly",
  "filterMode",
  "onlyShowPaid",
  "trialStartedAt",
] as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[number];

const HANDLE = /^[a-z0-9_]{1,15}$/;

export function emptySettings(): Settings {
  return {
    enabled: true,
    hiddenCountryCodes: [],
    hiddenLanguageCodes: [],
    hiddenRegionIds: [],
    allowedHandles: [],
    markOnly: false,
    filterMode: "hide",
    onlyShowPaid: false,
    trialStartedAt: null,
    onlyShowUnlocked: false,
    trialExpired: false,
  };
}

export function parseSettings(raw: unknown, now = Date.now()): Settings {
  if (!raw || typeof raw !== "object") return emptySettings();
  const obj = raw as Record<string, unknown>;
  const onlyShowPaid = obj.onlyShowPaid === true;
  const trialStartedAt = trialStartedAtFromUnknown(obj.trialStartedAt);
  const onlyShowUnlocked = onlyShowAllowed(onlyShowPaid, trialStartedAt, now);
  return {
    enabled: obj.enabled !== false,
    hiddenCountryCodes: normalizeCodes(obj.hiddenCountryCodes, "upper"),
    hiddenLanguageCodes: normalizeLanguageCodes(obj.hiddenLanguageCodes),
    hiddenRegionIds: normalizeRegionIds(obj.hiddenRegionIds),
    allowedHandles: normalizeHandles(obj.allowedHandles),
    markOnly: obj.markOnly === true,
    filterMode: parseFilterMode(obj.filterMode),
    onlyShowPaid,
    trialStartedAt,
    onlyShowUnlocked,
    trialExpired: !onlyShowUnlocked && trialStartedAt !== null,
  };
}

/**
 * Whether the content script should hide or mark anything at all.
 * Off when paused, or when "Only show" is selected but locked (trial over):
 * a saved allow-list must never silently turn into a hide-list.
 */
export function filteringActive(settings: Settings): boolean {
  if (!settings.enabled) return false;
  if (settings.filterMode === "only" && !settings.onlyShowUnlocked) return false;
  return true;
}

/** Normalize one handle as typed by a user or read from the DOM. */
export function normalizeHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const handle = value.trim().replace(/^@/, "").toLowerCase();
  return HANDLE.test(handle) ? handle : null;
}

function parseFilterMode(value: unknown): FilterMode {
  return value === "only" ? "only" : "hide";
}

function normalizeCodes(value: unknown, caseStyle: "upper" | "lower"): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.add(caseStyle === "upper" ? trimmed.toUpperCase() : trimmed.toLowerCase());
  }
  return [...out];
}

/** Canonical codes, so a stored "nb" or "nn" pick becomes "no" (the code X uses). */
function normalizeLanguageCodes(value: unknown): string[] {
  const out = new Set<string>();
  for (const code of normalizeCodes(value, "lower")) {
    const canonical = normalizeLang(code);
    if (canonical) out.add(canonical);
  }
  return [...out];
}

function normalizeRegionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim().toUpperCase().replace(/-/g, "_");
    if (REGION_IDS.has(id)) out.add(id);
  }
  return [...out];
}

function normalizeHandles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    const handle = normalizeHandle(item);
    if (handle) out.add(handle);
  }
  return [...out];
}
