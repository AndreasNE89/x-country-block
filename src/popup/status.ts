import { filteringActive } from "../shared/settings.ts";
import type { Settings } from "../shared/types.ts";
import { pickTotal, selectedPicks, summarizeNames } from "./picks.ts";

/** What the popup knows about the active browser tab. */
export type PageState =
  | { kind: "checking" }
  | { kind: "no-access" }
  | { kind: "not-x" }
  | { kind: "no-answer"; tabId: number }
  | { kind: "reloading"; tabId: number }
  | { kind: "ready"; tabId: number; count: number };

/** The status sentence: a lead, then the picked names (shown in bold). */
export type StatusSummary = { lead: string; names: string };

export type PageNote = { text: string; action: "reload" | "allow" | null };

export function statusSummary(settings: Settings): StatusSummary {
  if (!settings.enabled) return { lead: "Paused. Your picks are saved.", names: "" };
  if (settings.filterMode === "only" && !settings.onlyShowUnlocked) {
    return {
      lead: settings.trialExpired
        ? "Your free trial has ended. Nothing is filtered right now."
        : "Focus mode is locked. Nothing is filtered right now.",
      names: "",
    };
  }
  const names = summarizeNames(selectedPicks(settings).map((pick) => pick.label));
  if (!names) return { lead: "Nothing ticked yet. Pick a language, country or region.", names: "" };
  if (settings.filterMode === "only") {
    return { lead: settings.markOnly ? "Highlighting posts outside" : "Showing only", names };
  }
  return { lead: settings.markOnly ? "Highlighting matches for" : "Hiding", names };
}

export function statusText(summary: StatusSummary): string {
  return summary.names ? `${summary.lead} ${summary.names}` : summary.lead;
}

/** "14 on this tab" / "38 set aside"; null when there is no honest number to show. */
export function countText(settings: Settings, page: PageState): string | null {
  if (page.kind !== "ready") return null;
  if (!filteringActive(settings) || pickTotal(settings) === 0) return null;
  if (settings.filterMode === "only" && !settings.markOnly) return `${page.count} set aside`;
  return `${page.count} on this tab`;
}

export function pageNote(page: PageState): PageNote | null {
  switch (page.kind) {
    case "no-access":
      return { text: "Tamis needs access to x.com.", action: "allow" };
    case "not-x":
      return { text: "Open x.com to see it work.", action: null };
    case "no-answer":
      return { text: "Reload this tab to start filtering.", action: "reload" };
    case "reloading":
      return { text: "Reloading this tab…", action: null };
    case "checking":
    case "ready":
      return null;
    default: {
      const _never: never = page;
      return _never;
    }
  }
}

export function highlightHelp(settings: Settings): string {
  return settings.filterMode === "only" && settings.onlyShowUnlocked
    ? "Outline posts outside your picks instead of setting them aside."
    : "Outline matches so you can check before hiding.";
}
