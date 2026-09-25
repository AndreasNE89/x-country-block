export const PRO_PRICE_LABEL = "$5.99";
export const ONLY_SHOW_TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
export const STRIPE_PAID_MESSAGE = "xcb-stripe-paid" as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export const ONLY_SHOW_TRIAL_DAYS = Math.round(ONLY_SHOW_TRIAL_MS / DAY_MS);

/**
 * How far in the future a stored trial start may lie and still count.
 * Covers small clock corrections; anything later is treated as tampered or broken.
 */
export const TRIAL_CLOCK_SKEW_MS = 10 * 60 * 1000;

/** Storage keys written by ExtensionPay in 0.1.0 and 0.1.1 (storage.sync, falling back to local). */
export const LEGACY_EXTPAY_KEYS = [
  "extensionpay_api_key",
  "extensionpay_installed_at",
  "extensionpay_user",
] as const;

export type StripePaidMessage = { type: typeof STRIPE_PAID_MESSAGE };

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
  if (trialStartedAt - now > TRIAL_CLOCK_SKEW_MS) return false;
  return now - trialStartedAt < ONLY_SHOW_TRIAL_MS;
}

/** Whole days left in a running trial, rounded up; 0 when no trial is running. */
export function trialDaysLeft(trialStartedAt: number | null, now = Date.now()): number {
  if (trialStartedAt === null || !onlyShowAllowed(false, trialStartedAt, now)) return 0;
  const left = trialStartedAt + ONLY_SHOW_TRIAL_MS - now;
  return Math.min(ONLY_SHOW_TRIAL_DAYS, Math.max(1, Math.ceil(left / DAY_MS)));
}

export function isStripePaidMessage(value: unknown): value is StripePaidMessage {
  return Boolean(
    value && typeof value === "object" && (value as { type?: unknown }).type === STRIPE_PAID_MESSAGE,
  );
}

export type InstallDetails = { reason: string; previousVersion?: string };

/**
 * Whether to remove leftover ExtensionPay data. On install too: storage.sync can
 * bring the keys over from another device that ran 0.1.x.
 */
export function shouldClearLegacyPayData(details: InstallDetails): boolean {
  if (details.reason === "install") return true;
  if (details.reason !== "update") return false;
  const [major, minor] = (details.previousVersion ?? "").split(".").map(Number);
  if (!Number.isInteger(major) || !Number.isInteger(minor)) return true;
  return major === 0 && minor <= 1;
}
