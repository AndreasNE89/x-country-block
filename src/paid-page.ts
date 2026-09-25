// Runs on the Stripe success page (docs/privacy.html on GitHub Pages).
import { STRIPE_PAID_MESSAGE } from "./shared/license.ts";
import { isStripeSuccessUrl } from "./shared/stripe.ts";

export const PAID_UNLOCKED_TEXT = "Tamis Focus mode is unlocked. You can close this tab.";
export const PAID_FAILED_TEXT =
  "Tamis could not confirm the unlock in this browser. Open the Tamis popup and choose " +
  "“Already bought? Restore Focus mode”.";

// Only for a page that has no #paid-note of its own (and so no styles for it). The same
// tint, ink and accent as docs/privacy.html, in its light or dark variant.
const NOTE_BASE = "margin:16px 0;padding:12px 16px;border-radius:8px;font-weight:600;";
const NOTE_LIGHT = "background:#E6F2F2;color:#14201F;border-left:3px solid #FFB638";
const NOTE_DARK = "background:#1B3033;color:#E8EFEF;border-left:3px solid #FFC45C";

function prefersDark(doc: Document): boolean {
  try {
    return doc.defaultView?.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  } catch {
    return false;
  }
}

function showNote(doc: Document, text: string): void {
  let note = doc.getElementById("paid-note");
  if (!note) {
    note = doc.createElement("p");
    note.id = "paid-note";
    note.setAttribute("style", NOTE_BASE + (prefersDark(doc) ? NOTE_DARK : NOTE_LIGHT));
    (doc.body ?? doc.documentElement).prepend(note);
  }
  // The page's own note keeps the page's styles, including its dark theme.
  note.textContent = text;
  note.hidden = false;
  note.setAttribute("role", "status");
}

export async function confirmPaidPage(
  doc: Document,
  send: (message: unknown) => Promise<unknown> | void,
): Promise<void> {
  let reply: unknown;
  try {
    reply = await send({ type: STRIPE_PAID_MESSAGE });
  } catch {
    reply = undefined;
  }
  const ok = Boolean(reply && typeof reply === "object" && (reply as { ok?: unknown }).ok === true);
  showNote(doc, ok ? PAID_UNLOCKED_TEXT : PAID_FAILED_TEXT);
}

if (isStripeSuccessUrl(location.href)) {
  void confirmPaidPage(document, (message) => chrome.runtime.sendMessage(message));
}
