import {
  BADGE_BACKGROUND_COLOR,
  BADGE_TEXT_COLOR,
  formatBadgeText,
  isBadgeMessage,
} from "../shared/badge.ts";
import {
  isStripePaidMessage,
  LEGACY_EXTPAY_KEYS,
  shouldClearLegacyPayData,
} from "../shared/license.ts";
import { isStripeSuccessUrl } from "../shared/stripe.ts";

type SyncArea = { remove: (keys: string[]) => Promise<void> };

/** Run an extension API call that may be missing, return void, or reject (e.g. a closed tab). */
function quietly(call: () => Promise<unknown> | unknown): void {
  try {
    void Promise.resolve(call()).catch(() => undefined);
  } catch {
    // API missing or threw synchronously
  }
}

function paintBadgeColors(tabId?: number): void {
  const scope = tabId === undefined ? {} : { tabId };
  quietly(() => chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR, ...scope }));
  const setTextColor = chrome.action.setBadgeTextColor;
  if (typeof setTextColor === "function") {
    quietly(() => setTextColor.call(chrome.action, { color: BADGE_TEXT_COLOR, ...scope }));
  }
}

async function markPaid(): Promise<void> {
  await chrome.storage.local.set({ onlyShowPaid: true });
}

// 0.1.x also stored a derived onlyShowUnlocked flag; parseSettings ignores it, so drop it.
const LEGACY_LOCAL_KEYS = ["onlyShowUnlocked"];

async function clearLegacyPayData(): Promise<void> {
  const keys = [...LEGACY_EXTPAY_KEYS];
  try {
    await chrome.storage.local.remove([...keys, ...LEGACY_LOCAL_KEYS]);
  } catch {
    // nothing to remove
  }
  try {
    const sync = (chrome.storage as typeof chrome.storage & { sync?: SyncArea }).sync;
    await sync?.remove(keys);
  } catch {
    // storage.sync is off or unavailable
  }
}

paintBadgeColors();

chrome.runtime.onInstalled.addListener((details) => {
  if (shouldClearLegacyPayData(details)) void clearLegacyPayData();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isStripePaidMessage(message)) {
    const from = sender.url ?? sender.tab?.url;
    if (!from || !isStripeSuccessUrl(from)) return;
    // Keep the tab open: the page shows the confirmation once this answers.
    markPaid().then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  if (!isBadgeMessage(message)) return;
  const text = formatBadgeText(message.count);
  const tabId = sender.tab?.id;
  quietly(() => chrome.action.setBadgeText(tabId === undefined ? { text } : { text, tabId }));
  if (tabId !== undefined) paintBadgeColors(tabId);
});
