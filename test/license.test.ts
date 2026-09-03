import { describe, expect, it } from "vitest";
import {
  isStripePaidMessage,
  onlyShowAllowed,
  STRIPE_PAID_MESSAGE,
  trialStartedAtFromUnknown,
} from "../src/shared/license.ts";
import { isStripeSuccessUrl, STRIPE_SUCCESS_PATH } from "../src/shared/stripe.ts";

describe("onlyShowAllowed", () => {
  it("should unlock when paid", () => {
    expect(onlyShowAllowed(true, null)).toBe(true);
  });

  it("should unlock during a 7-day trial", () => {
    const now = 1_700_000_000_000;
    expect(onlyShowAllowed(false, now - 2 * 24 * 60 * 60 * 1000, now)).toBe(true);
  });

  it("should lock after the trial ends", () => {
    const now = 1_700_000_000_000;
    expect(onlyShowAllowed(false, now - 8 * 24 * 60 * 60 * 1000, now)).toBe(false);
  });

  it("should lock when unpaid and no trial", () => {
    expect(onlyShowAllowed(false, null)).toBe(false);
  });
});

describe("trialStartedAtFromUnknown", () => {
  it("should reject non-numbers", () => {
    expect(trialStartedAtFromUnknown("nope")).toBeNull();
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
    expect(isStripeSuccessUrl(STRIPE_SUCCESS_PATH)).toBe(false);
    expect(isStripeSuccessUrl("https://example.com/?paid=1")).toBe(false);
  });
});
