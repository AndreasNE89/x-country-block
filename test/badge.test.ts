import { describe, expect, it } from "vitest";
import { formatBadgeText, isBadgeMessage } from "../src/shared/badge.ts";

describe("formatBadgeText", () => {
  it("should leave the badge empty when nothing is hidden", () => {
    expect(formatBadgeText(0)).toBe("");
  });

  it("should show the hidden count and cap at 99+", () => {
    expect(formatBadgeText(7)).toBe("7");
    expect(formatBadgeText(100)).toBe("99+");
  });

  it("should accept badge messages", () => {
    expect(isBadgeMessage({ type: "xcb-badge", count: 3 })).toBe(true);
    expect(isBadgeMessage({ type: "graphql" })).toBe(false);
  });
});
