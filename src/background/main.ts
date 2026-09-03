import { formatBadgeText, isBadgeMessage } from "../shared/badge.ts";
import { isStripePaidMessage } from "../shared/license.ts";

async function markPaid(tabId?: number): Promise<void> {
  await chrome.storage.local.set({
    onlyShowPaid: true,
    onlyShowUnlocked: true,
  });
  if (tabId !== undefined) void chrome.tabs.remove(tabId);
}

void chrome.action.setBadgeBackgroundColor({ color: "#c23b22" });
chrome.runtime.onMessage.addListener((message, sender) => {
  if (isStripePaidMessage(message)) {
    void markPaid(sender.tab?.id);
    return;
  }
  if (!isBadgeMessage(message)) return;
  const text = formatBadgeText(message.count);
  const tabId = sender.tab?.id;
  const details = tabId === undefined ? { text } : { text, tabId };
  void chrome.action.setBadgeText(details);
  if (tabId !== undefined) void chrome.action.setBadgeBackgroundColor({ color: "#c23b22", tabId });
});
