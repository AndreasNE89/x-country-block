/** A route key for the count: the photo/video viewer is the same page as the post behind it. */
export function pageKey(pathname: string): string {
  return pathname.replace(/\/(?:photo|video)\/\d+\/?$/, "").replace(/\/$/, "") || "/";
}

/**
 * Routes X opens as a layer over the page that stays mounted: the composer, the display and
 * shortcut dialogs, an account's About sheet, the media viewer and a profile's photos. (Settings
 * pages replace the column, so they are pages of their own.)
 */
const OVERLAY_ROUTE =
  /^\/(?:compose(?:\/[^/]+)+|i\/(?:display|keyboard_shortcuts)|[A-Za-z0-9_]+\/(?:about|photo|header_photo)|[A-Za-z0-9_]+\/status\/\d+\/(?:photo|video)\/\d+)\/?$/;

export function isOverlayRoute(pathname: string): boolean {
  return OVERLAY_ROUTE.test(pathname);
}

/**
 * Distinct posts hidden or marked on the current page. X unmounts cells far from the viewport,
 * so counting DOM nodes would rise and fall while scrolling; this counts each post once until
 * the route changes or the settings change.
 */
export class PageCounter {
  private readonly keys = new Set<string>();
  private page: string | null = null;
  private sent = -1;

  /**
   * Start a new count when the SPA route changes. Returns true when it did. An overlay route
   * keeps the page behind it, so closing the overlay returns to the same count; opened directly
   * (no page yet), it is a page of its own.
   */
  enterPage(pathname: string): boolean {
    if (this.page !== null && isOverlayRoute(pathname)) return false;
    const key = pageKey(pathname);
    if (key === this.page) return false;
    this.page = key;
    this.keys.clear();
    return true;
  }

  reset(): void {
    this.keys.clear();
  }

  track(key: string, filtered: boolean): void {
    if (filtered) this.keys.add(key);
    else this.keys.delete(key);
  }

  get count(): number {
    return this.keys.size;
  }

  /** The count to send to the toolbar badge, or null when it has not changed since last sent. */
  takeUpdate(): number | null {
    if (this.keys.size === this.sent) return null;
    this.sent = this.keys.size;
    return this.sent;
  }
}
