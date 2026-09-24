import { describe, expect, it } from "vitest";
import {
  FOCUS_BODY,
  priceLine,
  proState,
  proView,
  trialButtonLabel,
  trialChipText,
  unlockLabel,
} from "../src/popup/pro.ts";
import { ONLY_SHOW_TRIAL_MS } from "../src/shared/license.ts";
import { parseSettings } from "../src/shared/settings.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function view(raw: Record<string, unknown>, cardOpen = false) {
  return proView(parseSettings(raw, NOW), cardOpen, NOW);
}

describe("proState", () => {
  it("should tell paid, trial, ended and locked apart", () => {
    expect(proState(parseSettings({ onlyShowPaid: true }, NOW))).toBe("paid");
    expect(proState(parseSettings({ trialStartedAt: NOW - DAY }, NOW))).toBe("trial");
    expect(proState(parseSettings({ trialStartedAt: NOW - ONLY_SHOW_TRIAL_MS }, NOW))).toBe("ended");
    expect(proState(parseSettings({}, NOW))).toBe("locked");
  });
});

describe("proView", () => {
  it("should keep the card closed until a locked user taps Only show", () => {
    expect(view({}).card).toBeNull();
    expect(view({}, true).card).toEqual({ ended: false, showTrial: true, showSwitchToHide: false });
  });

  it("should never offer a second trial", () => {
    const ended = view({ trialStartedAt: NOW - 8 * DAY }, true);
    expect(ended.card).toEqual({ ended: true, showTrial: false, showSwitchToHide: false });
  });

  it("should keep the ended notice open while Only show is still selected", () => {
    const stuck = view({ trialStartedAt: NOW - 8 * DAY, filterMode: "only" });
    expect(stuck.card).toEqual({ ended: true, showTrial: false, showSwitchToHide: true });
  });

  it("should show the days left during the trial and no card", () => {
    const trial = view({ trialStartedAt: NOW - 2 * DAY }, true);
    expect(trial.state).toBe("trial");
    expect(trial.card).toBeNull();
    expect(trial.trialChip).toBe("Trial · 5 days left");
  });

  it("should show nothing extra when paid", () => {
    const paid = view({ onlyShowPaid: true, trialStartedAt: NOW - 30 * DAY }, true);
    expect(paid.card).toBeNull();
    expect(paid.trialChip).toBeNull();
  });

  it("should treat a trial started in the future as ended", () => {
    expect(view({ trialStartedAt: NOW + 30 * DAY }, true).card?.ended).toBe(true);
  });
});

describe("Pro copy", () => {
  it("should take price and trial length from license constants", () => {
    expect(unlockLabel()).toBe("Unlock $5.99");
    expect(priceLine()).toBe("$5.99 once · no subscription");
    expect(trialButtonLabel()).toBe("Try free for 7 days");
    expect(trialChipText(1)).toBe("Trial · 1 day left");
    expect(FOCUS_BODY).toContain("local news, match day");
  });
});
