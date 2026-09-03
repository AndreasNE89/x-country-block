export const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/5kQ28q1YCgfp2xjeR63VC00";
export const STRIPE_SUCCESS_PATH = "https://andreasne89.github.io/x-country-block/privacy.html";

export function isStripeSuccessUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (`${parsed.origin}${parsed.pathname}` !== STRIPE_SUCCESS_PATH) return false;
    return parsed.searchParams.get("paid") === "1" || parsed.searchParams.has("session_id");
  } catch {
    return false;
  }
}
