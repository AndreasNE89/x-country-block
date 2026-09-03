export const PRO_PRICE_LABEL = "$5.99";
export const ONLY_SHOW_TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
export const STRIPE_PAID_MESSAGE = "xcb-stripe-paid" as const;

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
  return now - trialStartedAt < ONLY_SHOW_TRIAL_MS;
}

export function isStripePaidMessage(value: unknown): value is StripePaidMessage {
  return Boolean(
    value && typeof value === "object" && (value as { type?: unknown }).type === STRIPE_PAID_MESSAGE,
  );
}
