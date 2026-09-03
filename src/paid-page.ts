import { STRIPE_PAID_MESSAGE } from "./shared/license.ts";
import { isStripeSuccessUrl } from "./shared/stripe.ts";

if (isStripeSuccessUrl(location.href)) {
  void chrome.runtime.sendMessage({ type: STRIPE_PAID_MESSAGE });
}
