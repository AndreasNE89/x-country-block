export const EXTPAY_ID = "xcountryhide";
export const PRO_PRICE_LABEL = "$5.99";
export const ONLY_SHOW_TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

export function trialStartedAtFromUnknown(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function onlyShowAllowed(
  paid: boolean,
  trialStartedAt: number | null,
  now = Date.now(),
): boolean {
  if (paid) return true;
  if (trialStartedAt === null) return false;
  return now - trialStartedAt < ONLY_SHOW_TRIAL_MS;
}

export function licenseFieldsFromExtPayUser(user: {
  paid: boolean;
  trialStartedAt: Date | null;
}): { onlyShowPaid: boolean; trialStartedAt: number | null } {
  return {
    onlyShowPaid: user.paid,
    trialStartedAt: user.trialStartedAt ? user.trialStartedAt.getTime() : null,
  };
}
