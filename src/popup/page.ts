import { isPingResponse, PING_MSG } from "../shared/messages.ts";
import { PAID_PAGE_MATCH } from "../shared/stripe.ts";
import type { PageState } from "./status.ts";

/** The manifest's host permissions; permissions.request may only ask for these. */
export const X_ORIGINS = ["https://x.com/*", "https://twitter.com/*"];

// Must match the content_scripts "matches" hosts in both manifests.
const X_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"]);

const PING_TIMEOUT_MS = 800;

export type TabApi = {
  hasAccess: () => Promise<boolean>;
  activeTab: () => Promise<{ id?: number; url?: string } | null>;
  ping: (tabId: number) => Promise<unknown>;
};

export function isXUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && X_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Checks host access, then the active tab, then pings its content script.
 * The tab URL is only visible with host access, so access is checked first.
 */
export async function probePage(api: TabApi, timeoutMs = PING_TIMEOUT_MS): Promise<PageState> {
  let access = true;
  try {
    access = await api.hasAccess();
  } catch {
    access = true;
  }
  if (!access) return { kind: "no-access" };
  let tab: { id?: number; url?: string } | null = null;
  try {
    tab = await api.activeTab();
  } catch {
    tab = null;
  }
  if (!tab || tab.id === undefined || !isXUrl(tab.url)) return { kind: "not-x" };
  const reply = await withTimeout(
    (async () => api.ping(tab.id as number))(),
    timeoutMs,
  );
  return isPingResponse(reply)
    ? { kind: "ready", tabId: tab.id, count: reply.count }
    : { kind: "no-answer", tabId: tab.id };
}

/**
 * False only when the browser says Tamis may not run on its thank-you page, where a
 * payment unlocks Focus mode (a per-site toggle turned off). Unknown counts as allowed.
 * Chrome and Firefox both answer for the exact content-script pattern.
 */
export async function paidPageAllowed(api: typeof chrome): Promise<boolean> {
  const permissions = api.permissions;
  if (typeof permissions?.contains !== "function") return true;
  try {
    return (await permissions.contains({ origins: [PAID_PAGE_MATCH] })) !== false;
  } catch {
    return true;
  }
}

/** TabApi backed by the extension APIs, feature-checked for Firefox and older Chrome. */
export function extensionTabApi(api: typeof chrome): TabApi {
  return {
    // Either X host is enough: contains() is all-or-nothing, and a user who turned off the
    // twitter.com toggle (which only redirects to x.com) still has a working Tamis on x.com.
    hasAccess: async () => {
      const permissions = api.permissions;
      if (typeof permissions?.contains !== "function") return true;
      for (const origin of X_ORIGINS) {
        if (await permissions.contains({ origins: [origin] })) return true;
      }
      return false;
    },
    activeTab: async () => {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      return tab ?? null;
    },
    ping: (tabId) => api.tabs.sendMessage(tabId, { type: PING_MSG }),
  };
}
