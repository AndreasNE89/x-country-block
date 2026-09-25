import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPaidPage, PAID_FAILED_TEXT, PAID_UNLOCKED_TEXT } from "../src/paid-page.ts";
import { STRIPE_PAID_MESSAGE } from "../src/shared/license.ts";

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
    expect(PAID_UNLOCKED_TEXT).toBe("Tamis Focus mode is unlocked. You can close this tab.");
  });

  it("should add its own notice when the page has no #paid-note", async () => {
    await confirmPaidPage(document, async () => ({ ok: true }));
    const note = document.getElementById("paid-note") as HTMLElement;
    expect(note).not.toBeNull();
    expect(note.textContent).toBe(PAID_UNLOCKED_TEXT);
    expect(document.body.firstElementChild).toBe(note);
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
