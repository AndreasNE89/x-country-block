export const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/5kQ28q1YCgfp2xjeR63VC00";
export const STRIPE_SUCCESS_PATH = "https://andreasne89.github.io/x-country-block/privacy.html";

// Real Checkout Session ids look like cs_live_... or cs_test_...
const SESSION_ID = /^cs_[A-Za-z0-9_]+$/;

export function isStripeSuccessUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (`${parsed.origin}${parsed.pathname}` !== STRIPE_SUCCESS_PATH) return false;
    if (parsed.searchParams.get("paid") === "1") return true;
    return SESSION_ID.test(parsed.searchParams.get("session_id") ?? "");
  } catch {
    return false;
  }
}
