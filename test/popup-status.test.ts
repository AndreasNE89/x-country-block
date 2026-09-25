import { describe, expect, it } from "vitest";
import {
  countText,
  highlightHelp,
  pageNote,
  statusSummary,
  statusText,
  type PageState,
} from "../src/popup/status.ts";
import { ONLY_SHOW_TRIAL_MS } from "../src/shared/license.ts";
import { parseSettings } from "../src/shared/settings.ts";

const NOW = 1_700_000_000_000;
const ready = (count: number): PageState => ({ kind: "ready", tabId: 1, count });

function text(raw: Record<string, unknown>): string {
  return statusText(statusSummary(parseSettings(raw, NOW)));
}

describe("statusSummary", () => {
  it("should describe hide mode with the picked names", () => {
    expect(text({ hiddenLanguageCodes: ["ja", "pt"] })).toBe("Hiding Japanese, Portuguese");
    expect(statusSummary(parseSettings({ hiddenLanguageCodes: ["ja"] }))).toEqual({
      lead: "Hiding",
      names: "Japanese",
    });
  });

  it("should describe highlight mode", () => {
    expect(text({ hiddenLanguageCodes: ["ja"], markOnly: true })).toBe("Highlighting matches for Japanese");
  });

  it("should describe unlocked Only show", () => {
    const raw = { hiddenCountryCodes: ["NO"], hiddenLanguageCodes: ["no"], filterMode: "only", onlyShowPaid: true };
    expect(text(raw)).toBe("Showing only Norway, Norwegian");
    expect(text({ ...raw, markOnly: true })).toBe("Highlighting posts outside Norway, Norwegian");
  });

  it("should cap the names at three", () => {
    expect(text({ hiddenLanguageCodes: ["ja", "pt", "es", "de", "fr"] })).toBe(
      "Hiding Japanese, Portuguese, Spanish +2 more",
    );
  });

  it("should nudge when nothing is ticked", () => {
    expect(text({})).toBe("Nothing ticked yet. Pick a language, country or region.");
  });

  it("should say paused before anything else", () => {
    expect(text({ enabled: false, hiddenLanguageCodes: ["ja"] })).toBe("Paused. Your picks are saved.");
  });

  it("should say nothing is filtered when Only show is locked", () => {
    const expired = { filterMode: "only", hiddenCountryCodes: ["NO"], trialStartedAt: NOW - ONLY_SHOW_TRIAL_MS - 1 };
    expect(text(expired)).toBe("Your free trial has ended. Nothing is filtered right now.");
    expect(text({ filterMode: "only", hiddenCountryCodes: ["NO"] })).toBe(
      "Focus mode is locked. Nothing is filtered right now.",
    );
  });
});

describe("countText", () => {
  it("should show the count on the active tab", () => {
    const hide = parseSettings({ hiddenLanguageCodes: ["ja"] });
    expect(countText(hide, ready(14))).toBe("14 on this tab");
    const only = parseSettings({ hiddenCountryCodes: ["NO"], filterMode: "only", onlyShowPaid: true });
    expect(countText(only, ready(38))).toBe("38 set aside");
    const mark = parseSettings({ hiddenLanguageCodes: ["ja"], markOnly: true });
    expect(countText(mark, ready(6))).toBe("6 on this tab");
  });

  it("should hide the count when it would mislead", () => {
    const hide = parseSettings({ hiddenLanguageCodes: ["ja"] });
    expect(countText(hide, { kind: "not-x" })).toBeNull();
    expect(countText(parseSettings({}), ready(0))).toBeNull();
    expect(countText(parseSettings({ enabled: false, hiddenLanguageCodes: ["ja"] }), ready(0))).toBeNull();
  });
});

describe("pageNote", () => {
  it("should explain what to do on each kind of tab", () => {
    expect(pageNote({ kind: "not-x" })).toEqual({ text: "Open x.com to see it work.", action: null });
    expect(pageNote({ kind: "no-answer", tabId: 3 })).toEqual({
      text: "Reload this tab to use the latest version of Tamis.",
      action: "reload",
    });
    expect(pageNote({ kind: "no-access" })).toEqual({ text: "Tamis needs access to x.com.", action: "allow" });
    expect(pageNote(ready(3))).toBeNull();
    expect(pageNote({ kind: "checking" })).toBeNull();
  });
});

describe("highlightHelp", () => {
  it("should follow the mode", () => {
    expect(highlightHelp(parseSettings({}))).toBe("Outline matches so you can check before hiding.");
    expect(highlightHelp(parseSettings({ filterMode: "only", onlyShowPaid: true }))).toBe(
      "Outline the rest instead of setting it aside.",
    );
  });
});
