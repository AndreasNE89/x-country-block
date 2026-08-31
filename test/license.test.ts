import { describe, expect, it } from "vitest";
import {
  licenseFieldsFromExtPayUser,
  onlyShowAllowed,
  trialStartedAtFromUnknown,
} from "../src/shared/license.ts";

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

describe("licenseFieldsFromExtPayUser", () => {
  it("should store trial start as a timestamp", () => {
    const started = new Date("2026-08-01T00:00:00.000Z");
    expect(licenseFieldsFromExtPayUser({ paid: false, trialStartedAt: started })).toEqual({
      onlyShowPaid: false,
      trialStartedAt: started.getTime(),
    });
    expect(trialStartedAtFromUnknown("nope")).toBeNull();
  });
});
