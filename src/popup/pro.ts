import { ONLY_SHOW_TRIAL_DAYS, PRO_PRICE_LABEL, trialDaysLeft } from "../shared/license.ts";
import type { Settings } from "../shared/types.ts";

export type ProState = "paid" | "trial" | "ended" | "locked";

export type ProCard = {
  /** The free trial was used up (or its start date is not believable). */
  ended: boolean;
  showTrial: boolean;
  /** Only show is still selected but locked, so offer the way back to Hide. */
  showSwitchToHide: boolean;
};

export type ProView = {
  state: ProState;
  card: ProCard | null;
  trialChip: string | null;
};

export const FOCUS_BODY =
  "See only posts from the places and languages you tick — great for local news, match day, " +
  "or reading in your own languages.";
export const TRIAL_ENDED_TEXT = "Your free trial has ended. Your picks are saved.";

export function proState(settings: Settings): ProState {
  if (settings.onlyShowPaid) return "paid";
  if (settings.onlyShowUnlocked) return "trial";
  if (settings.trialExpired) return "ended";
  return "locked";
}

export function proView(settings: Settings, cardOpen: boolean, now = Date.now()): ProView {
  const state = proState(settings);
  const locked = state === "ended" || state === "locked";
  const stuckInOnly = locked && settings.filterMode === "only";
  return {
    state,
    card:
      locked && (cardOpen || stuckInOnly)
        ? { ended: state === "ended", showTrial: state === "locked", showSwitchToHide: stuckInOnly }
        : null,
    trialChip: state === "trial" ? trialChipText(trialDaysLeft(settings.trialStartedAt, now)) : null,
  };
}

export function trialChipText(days: number): string {
  return `Trial · ${days} ${days === 1 ? "day" : "days"} left`;
}

export function unlockLabel(): string {
  return `Unlock ${PRO_PRICE_LABEL}`;
}

export function priceLine(): string {
  return `${PRO_PRICE_LABEL} once · no subscription`;
}

export function trialButtonLabel(): string {
  return `Try free for ${ONLY_SHOW_TRIAL_DAYS} days`;
}
