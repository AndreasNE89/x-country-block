import { describe, expect, it } from "vitest";
import {
  believableTrialStart,
  isStripePaidMessage,
  LEGACY_EXTPAY_KEYS,
  ONLY_SHOW_TRIAL_DAYS,
  ONLY_SHOW_TRIAL_MS,
  onlyShowAllowed,
  shouldClearLegacyPayData,
  STRIPE_PAID_MESSAGE,
  TRIAL_CLOCK_SKEW_MS,
  trialDaysLeft,
  trialStartedAtFromUnknown,
} from "../src/shared/license.ts";
import { isStripeSuccessUrl, STRIPE_SUCCESS_PATH } from "../src/shared/stripe.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe("onlyShowAllowed", () => {
  it("should unlock when paid", () => {
    expect(onlyShowAllowed(true, null)).toBe(true);
  });

  it("should unlock during a 7-day trial", () => {
    expect(onlyShowAllowed(false, NOW - 2 * DAY, NOW)).toBe(true);
  });

  it("should lock after the trial ends", () => {
    expect(onlyShowAllowed(false, NOW - 8 * DAY, NOW)).toBe(false);
  });

  it("should lock when unpaid and no trial", () => {
    expect(onlyShowAllowed(false, null)).toBe(false);
  });

  it("should not unlock a trial that starts in the future", () => {
    // A future start made now - start negative, which used to unlock forever.
    expect(onlyShowAllowed(false, NOW + 400 * DAY, NOW)).toBe(false);
    expect(onlyShowAllowed(false, NOW + TRIAL_CLOCK_SKEW_MS + 1, NOW)).toBe(false);
  });

  it("should tolerate a small clock difference", () => {
    expect(onlyShowAllowed(false, NOW + TRIAL_CLOCK_SKEW_MS, NOW)).toBe(true);
  });
});

describe("trialDaysLeft", () => {
  it("should count whole days left, rounded up", () => {
    expect(trialDaysLeft(NOW, NOW)).toBe(ONLY_SHOW_TRIAL_DAYS);
    expect(trialDaysLeft(NOW - 2 * DAY, NOW)).toBe(5);
    expect(trialDaysLeft(NOW - 2 * DAY - 1, NOW)).toBe(5);
    expect(trialDaysLeft(NOW - ONLY_SHOW_TRIAL_MS + 1000, NOW)).toBe(1);
  });

  it("should be 0 without a running trial", () => {
    expect(trialDaysLeft(null, NOW)).toBe(0);
    expect(trialDaysLeft(NOW - ONLY_SHOW_TRIAL_MS, NOW)).toBe(0);
    expect(trialDaysLeft(NOW + 30 * DAY, NOW)).toBe(0);
  });

  it("should never show more days than the trial has", () => {
    expect(trialDaysLeft(NOW + TRIAL_CLOCK_SKEW_MS, NOW)).toBe(ONLY_SHOW_TRIAL_DAYS);
    expect(ONLY_SHOW_TRIAL_DAYS).toBe(7);
  });
});

describe("believableTrialStart", () => {
  it("should keep a start in the past or within clock skew", () => {
    expect(believableTrialStart(null, NOW)).toBeNull();
    expect(believableTrialStart(NOW - 30 * DAY, NOW)).toBe(NOW - 30 * DAY);
    expect(believableTrialStart(NOW + TRIAL_CLOCK_SKEW_MS, NOW)).toBe(NOW + TRIAL_CLOCK_SKEW_MS);
  });

  it("should count a start too far in the future as no trial, so it can start again", () => {
    // The clock was ahead when the trial began and was corrected since: not a used-up trial.
    expect(believableTrialStart(NOW + TRIAL_CLOCK_SKEW_MS + 1, NOW)).toBeNull();
    expect(believableTrialStart(NOW + 400 * DAY, NOW)).toBeNull();
  });

  it("should never turn a future start into a running trial", () => {
    const start = NOW + 400 * DAY;
    expect(onlyShowAllowed(false, believableTrialStart(start, NOW), NOW)).toBe(false);
    expect(trialDaysLeft(believableTrialStart(start, NOW), NOW)).toBe(0);
  });
});

describe("trialStartedAtFromUnknown", () => {
  it("should reject non-numbers", () => {
    expect(trialStartedAtFromUnknown("nope")).toBeNull();
    expect(trialStartedAtFromUnknown(Number.NaN)).toBeNull();
    expect(trialStartedAtFromUnknown(NOW)).toBe(NOW);
  });
});

describe("isStripePaidMessage", () => {
  it("should accept the paid message type", () => {
    expect(isStripePaidMessage({ type: STRIPE_PAID_MESSAGE })).toBe(true);
    expect(isStripePaidMessage({ type: "nope" })).toBe(false);
  });
});

describe("isStripeSuccessUrl", () => {
  it("should accept the paid redirect", () => {
    expect(isStripeSuccessUrl(`${STRIPE_SUCCESS_PATH}?paid=1`)).toBe(true);
    expect(isStripeSuccessUrl(`${STRIPE_SUCCESS_PATH}?session_id=cs_test`)).toBe(true);
    expect(isStripeSuccessUrl(`${STRIPE_SUCCESS_PATH}?session_id=cs_live_a1B2c3`)).toBe(true);
    expect(isStripeSuccessUrl(STRIPE_SUCCESS_PATH)).toBe(false);
    expect(isStripeSuccessUrl("https://example.com/?paid=1")).toBe(false);
  });

  it("should reject an empty or placeholder session id", () => {
    expect(isStripeSuccessUrl(`${STRIPE_SUCCESS_PATH}?session_id=`)).toBe(false);
    expect(isStripeSuccessUrl(`${STRIPE_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`)).toBe(false);
    expect(isStripeSuccessUrl(`${STRIPE_SUCCESS_PATH}?paid=0`)).toBe(false);
  });
});

describe("shouldClearLegacyPayData", () => {
  it("should clear after an update from 0.1.x", () => {
    expect(shouldClearLegacyPayData({ reason: "update", previousVersion: "0.1.0" })).toBe(true);
    expect(shouldClearLegacyPayData({ reason: "update", previousVersion: "0.1.2" })).toBe(true);
    expect(shouldClearLegacyPayData({ reason: "update", previousVersion: "0.0.9" })).toBe(true);
  });

  it("should clear on install, because storage.sync can carry keys from another device", () => {
    expect(shouldClearLegacyPayData({ reason: "install" })).toBe(true);
  });

  it("should leave newer installs and browser updates alone", () => {
    expect(shouldClearLegacyPayData({ reason: "update", previousVersion: "0.2.0" })).toBe(false);
    expect(shouldClearLegacyPayData({ reason: "update", previousVersion: "1.0" })).toBe(false);
    expect(shouldClearLegacyPayData({ reason: "browser_update" })).toBe(false);
    expect(shouldClearLegacyPayData({ reason: "chrome_update" })).toBe(false);
  });

  it("should clear when the previous version is unknown", () => {
    expect(shouldClearLegacyPayData({ reason: "update" })).toBe(true);
    expect(shouldClearLegacyPayData({ reason: "update", previousVersion: "garbage" })).toBe(true);
  });

  it("should name the ExtensionPay keys 0.1.0 and 0.1.1 wrote", () => {
    expect([...LEGACY_EXTPAY_KEYS]).toEqual([
      "extensionpay_api_key",
      "extensionpay_installed_at",
      "extensionpay_user",
    ]);
  });
});
