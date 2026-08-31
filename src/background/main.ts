import ExtPay from "extpay";
import { formatBadgeText, isBadgeMessage } from "../shared/badge.ts";
import { EXTPAY_ID, licenseFieldsFromExtPayUser, onlyShowAllowed } from "../shared/license.ts";

const extpay = ExtPay(EXTPAY_ID);
extpay.startBackground();

async function syncLicense(): Promise<void> {
  const client = ExtPay(EXTPAY_ID);
  try {
    const user = await client.getUser();
    const fields = licenseFieldsFromExtPayUser(user);
    await chrome.storage.local.set({
      onlyShowPaid: fields.onlyShowPaid,
      trialStartedAt: fields.trialStartedAt,
      onlyShowUnlocked: onlyShowAllowed(fields.onlyShowPaid, fields.trialStartedAt),
    });
  } catch {
    // keep last stored license
  }
}

extpay.onPaid.addListener(() => {
  void syncLicense();
});
extpay.onTrialStarted.addListener(() => {
  void syncLicense();
});

void syncLicense();

void chrome.action.setBadgeBackgroundColor({ color: "#c23b22" });
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!isBadgeMessage(message)) return;
  const text = formatBadgeText(message.count);
  const tabId = sender.tab?.id;
  const details = tabId === undefined ? { text } : { text, tabId };
  void chrome.action.setBadgeText(details);
  if (tabId !== undefined) void chrome.action.setBadgeBackgroundColor({ color: "#c23b22", tabId });
});
