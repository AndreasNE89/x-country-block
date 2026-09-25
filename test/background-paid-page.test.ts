import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPaidPage, PAID_FAILED_TEXT, PAID_UNLOCKED_TEXT } from "../src/paid-page.ts";
import { STRIPE_PAID_MESSAGE } from "../src/shared/license.ts";
import { PAID_PAGE_MATCH } from "../src/shared/stripe.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("PAID_PAGE_MATCH", () => {
  it("should be the paid-page content-script match in both manifests", () => {
    for (const file of ["manifest.json", "manifest.firefox.json"]) {
      const manifest = JSON.parse(readFileSync(join(ROOT, file), "utf8")) as {
        content_scripts: { matches: string[]; js: string[] }[];
      };
      const paid = manifest.content_scripts.find((entry) => entry.js.includes("paid-page.js"));
      expect(paid?.matches, file).toEqual([PAID_PAGE_MATCH]);
    }
  });
});

describe("confirmPaidPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "<h1>Privacy</h1><p>Text</p>";
  });

  it("should show the confirmation in the page's own #paid-note", async () => {
    document.body.innerHTML = '<h1>Privacy</h1><p id="paid-note" hidden>Pro unlocked.</p>';
    const send = vi.fn(async () => ({ ok: true }));
    await confirmPaidPage(document, send);
    expect(send).toHaveBeenCalledWith({ type: STRIPE_PAID_MESSAGE });
    const note = document.getElementById("paid-note") as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe(PAID_UNLOCKED_TEXT);
    expect(note.getAttribute("role")).toBe("status");
    expect(PAID_UNLOCKED_TEXT).toBe("Tamis Focus mode is unlocked. You can close this tab.");
  });

  it("should leave the page's own #paid-note to the page's light or dark styles", async () => {
    document.body.innerHTML = '<h1>Privacy</h1><p id="paid-note" hidden>Pro unlocked.</p>';
    await confirmPaidPage(document, async () => ({ ok: true }));
    expect(document.getElementById("paid-note")?.getAttribute("style")).toBeNull();
  });

  it("should add its own notice when the page has no #paid-note", async () => {
    await confirmPaidPage(document, async () => ({ ok: true }));
    const note = document.getElementById("paid-note") as HTMLElement;
    expect(note).not.toBeNull();
    expect(note.textContent).toBe(PAID_UNLOCKED_TEXT);
    expect(document.body.firstElementChild).toBe(note);
    // A page without the element has no styles for it either, so the note brings its own.
    expect(note.getAttribute("style")).toContain("border-left");
  });

  it("should point to the restore link when the extension does not confirm", async () => {
    await confirmPaidPage(document, async () => {
      throw new Error("Receiving end does not exist");
    });
    expect(document.getElementById("paid-note")?.textContent).toBe(PAID_FAILED_TEXT);
    await confirmPaidPage(document, async () => undefined);
    expect(document.getElementById("paid-note")?.textContent).toBe(PAID_FAILED_TEXT);
  });
});
