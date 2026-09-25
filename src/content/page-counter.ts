/** A route key for the count: the photo/video viewer is the same page as the post behind it. */
export function pageKey(pathname: string): string {
  return pathname.replace(/\/(?:photo|video)\/\d+\/?$/, "").replace(/\/$/, "") || "/";
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

  /** Start a new count when the SPA route changes. Returns true when it did. */
  enterPage(pathname: string): boolean {
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
