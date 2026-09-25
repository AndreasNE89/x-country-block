import { BADGE_MSG } from "../shared/badge.ts";
import { mergeStoredRows, type StoredUser, UserCache } from "../shared/cache.ts";
import { defaultCountryIndex } from "../shared/countries.ts";
import {
  aboutRouteHandle,
  aboutSheetSignals,
  type AboutSignals,
  type CardPaint,
  clearAllPaint,
  findNotificationRows,
  findProfileIdentity,
  findTweetArticles,
  findUserCells,
  focalTweetId,
  handleFromProfileHeader,
  HIDE_ATTR,
  isPainted,
  layoutBox,
  MARK_LABEL_CLASS,
  NO_PAINT,
  paintCard,
  screenNameFromPath,
  SLIM_ATTR,
  syncThemeFlag,
  viewerHandle,
} from "../shared/hide-dom.ts";
import { isPingMessage, type PingResponse } from "../shared/messages.ts";
import { SETTINGS_KEYS } from "../shared/settings.ts";
import type { CountryIndex, Settings, UserRecord } from "../shared/types.ts";
import { addAllowedHandle, allowButtonHandle } from "./allow-handle.ts";
import {
  type CardKind,
  cardKey,
  notificationVerdict,
  type PageContext,
  paintFor,
  profileVerdict,
  type Sources,
  tweetVerdict,
  userCellVerdict,
  type Verdict,
} from "./decide.ts";
import { readHookMessage } from "./hook-message.ts";
import { PageCounter } from "./page-counter.ts";
import { parseStoredUsers } from "./records.ts";
import { captureAnchor, holdAnchor, scrollerFor, startsAboveViewBottom } from "./scroll-anchor.ts";
import { matchingActive, SettingsState } from "./settings-state.ts";
import { TweetStore } from "./tweet-store.ts";
import { UserPersister } from "./user-store.ts";

export const USER_LIMIT = 10_000;
export const TWEET_LIMIT = 10_000;
/** How often an open tab re-checks time-based settings (the Focus mode trial ending). */
export const SETTINGS_TICK_MS = 60_000;

type StorageArea = typeof chrome.storage.local;
type Runtime = Pick<typeof chrome.runtime, "sendMessage" | "getManifest" | "onMessage"> & { id?: string };

export type ContentDeps = {
  win: Window;
  doc: Document;
  area: StorageArea | null;
  runtime: Runtime | null;
  /** chrome.extension.inIncognitoContext: nothing is written to disk in private windows. */
  incognito: boolean;
  now?: () => number;
  raf?: (cb: () => void) => unknown;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  setRepeat?: (fn: () => void, ms: number) => unknown;
  clearRepeat?: (handle: unknown) => void;
};

type CardItem = { el: HTMLElement; kind: CardKind };
type Painted = { key: string | null; gen: number; paint: CardPaint };
type Change = { el: HTMLElement; paint: CardPaint; key: string | null };

/** Routes where account rows are pickers or settings, not lists to filter. */
const NO_USER_CELL_ROUTES = /^\/(?:messages|i\/chat|settings|compose|i\/flow)(?:\/|$)/;

function heightClass(el: HTMLElement): string {
  if (el.hasAttribute(SLIM_ATTR)) return "slim";
  if (el.hasAttribute(HIDE_ATTR)) return "hidden";
  for (const child of el.children) if (child.classList.contains(MARK_LABEL_CLASS)) return "labelled";
  return "shown";
}

function paintHeightClass(paint: CardPaint): string {
  switch (paint.kind) {
    case "none":
      return "shown";
    case "hide":
      return "hidden";
    case "slim":
      return "slim";
    case "mark":
      return paint.label ? "labelled" : "shown";
    default: {
      const _never: never = paint;
      return _never;
    }
  }
}

/**
 * The content script: keeps what the hook reports, decides every post, notification and account
 * row on the page, and paints the result. Every entry point fails open: an error leaves X as is.
 */
export class ContentController {
  private readonly users = new UserCache(USER_LIMIT);
  private readonly tweets = new TweetStore(TWEET_LIMIT);
  private readonly counter = new PageCounter();
  private readonly painted = new WeakMap<HTMLElement, Painted>();
  private readonly persister: UserPersister;
  private readonly state: SettingsState;
  private readonly index: CountryIndex = defaultCountryIndex();
  private readonly observer: MutationObserver;
  private readonly now: () => number;
  private readonly raf: (cb: () => void) => unknown;
  private gen = 0;
  private scheduled = false;
  private stopped = false;
  private about: AboutSignals | null = null;
  private aboutJson = "null";
  private contextKey = "";
  private tick: unknown = null;

  constructor(private readonly deps: ContentDeps) {
    this.now = deps.now ?? (() => Date.now());
    const win = deps.win;
    this.raf =
      deps.raf ??
      (typeof win.requestAnimationFrame === "function"
        ? (cb) => win.requestAnimationFrame(() => cb())
        : (cb) => win.setTimeout(cb, 16));
    this.state = new SettingsState(this.now());
    this.persister = new UserPersister({
      area: deps.area,
      now: this.now,
      setTimer: deps.setTimer ?? ((fn, ms) => win.setTimeout(fn, ms)),
      clearTimer: deps.clearTimer ?? ((handle) => win.clearTimeout(handle as number)),
    });
    this.observer = new MutationObserver((records) => this.onMutations(records));
  }

  get settings(): Settings {
    return this.state.current;
  }

  /** Posts hidden or marked on this page, as the badge and the popup show it. */
  get count(): number {
    return this.active() ? this.counter.count : 0;
  }

  get userCache(): UserCache {
    return this.users;
  }

  async start(): Promise<void> {
    const { win, doc } = this.deps;
    win.addEventListener("message", this.onWindowMessage);
    win.addEventListener("pagehide", this.onPageHide);
    doc.addEventListener("visibilitychange", this.onVisibility);
    doc.addEventListener("click", this.onClick, true);
    // href too: a node X reuses for another post may change only its links.
    this.observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });
    try {
      this.deps.runtime?.onMessage.addListener(this.onRuntimeMessage);
    } catch {
      // no runtime messaging (tests, extension context gone)
    }
    const setRepeat = this.deps.setRepeat ?? ((fn, ms) => win.setInterval(fn, ms));
    this.tick = setRepeat(() => this.refreshSettings(), SETTINGS_TICK_MS);
    await this.load();
  }

  /** Tear down and restore the page (the extension was reloaded or updated under this tab). */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const { win, doc } = this.deps;
    this.observer.disconnect();
    win.removeEventListener("message", this.onWindowMessage);
    win.removeEventListener("pagehide", this.onPageHide);
    doc.removeEventListener("visibilitychange", this.onVisibility);
    doc.removeEventListener("click", this.onClick, true);
    if (this.tick !== null) (this.deps.clearRepeat ?? ((h) => win.clearInterval(h as number)))(this.tick);
    this.persister.setAllowed(false);
    try {
      clearAllPaint(doc);
    } catch {
      // nothing else to do
    }
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  /** Run a pass now instead of on the next frame (tests, and the first pass after load). */
  flushPass(): void {
    this.scheduled = false;
    this.pass();
  }

  private async load(): Promise<void> {
    const area = this.deps.area;
    if (area) {
      try {
        const raw = await area.get([...SETTINGS_KEYS, "userCache"]);
        const now = this.now();
        this.state.load(raw, now);
        const rows = mergeStoredRows(parseStoredUsers(raw.userCache, now), [], now);
        this.users.load(rows);
        this.persister.setStored(rows);
        area.onChanged.addListener(this.onStorageChanged);
        this.pruneStored(area, raw.userCache, rows);
      } catch {
        // fail open: defaults filter nothing
      }
    }
    this.settingsChanged();
  }

  /**
   * Write the stored accounts back without what the cache does not keep: expired rows, rows
   * without a location signal, rows from builds before 0.2.0 and anything past PERSIST_LIMIT.
   * This runs whether or not a filter is on, since it only deletes, and only when something was
   * dropped, so tabs that start together do not overwrite fresher writes for nothing. Nothing is
   * written from a private window.
   */
  private pruneStored(area: StorageArea, raw: unknown, kept: StoredUser[]): void {
    if (this.deps.incognito || raw === undefined) return;
    if (Array.isArray(raw) && raw.length === kept.length) return;
    try {
      const done = kept.length > 0 ? area.set({ userCache: kept }) : area.remove("userCache");
      void done.catch(() => {
        // extension context gone: the next tab prunes
      });
    } catch {
      // extension context invalidated
    }
  }

  private orphaned(): boolean {
    try {
      return !this.deps.runtime?.id;
    } catch {
      return true;
    }
  }

  private active(): boolean {
    return !this.stopped && matchingActive(this.state.current);
  }

  private settingsChanged(): void {
    this.gen += 1;
    this.counter.reset();
    this.persister.setAllowed(!this.deps.incognito && this.active());
    this.schedule();
  }

  private refreshSettings(): void {
    if (this.stopped) return;
    if (this.orphaned()) {
      this.stop();
      return;
    }
    if (this.state.refresh(this.now())) this.settingsChanged();
  }

  private schedule(): void {
    if (this.scheduled || this.stopped) return;
    this.scheduled = true;
    this.raf(() => {
      if (!this.scheduled) return;
      this.scheduled = false;
      this.pass();
    });
  }

  private readonly onStorageChanged = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>): void => {
    if (this.stopped) return;
    if (changes.userCache) this.persister.setStored(changes.userCache.newValue);
    if (this.state.applyChanges(changes, this.now())) this.settingsChanged();
  };

  private readonly onWindowMessage = (event: MessageEvent): void => {
    if (this.stopped) return;
    if (this.orphaned()) {
      this.stop();
      return;
    }
    const data = readHookMessage(event, this.deps.win);
    if (!data) return;
    const now = this.now();
    for (const user of data.users) this.persister.note(this.users.put(user, now));
    for (const tweet of data.tweets) this.tweets.put(tweet);
    this.gen += 1;
    if (this.active()) this.schedule();
  };

  private onMutations(records: MutationRecord[]): void {
    if (!this.active()) return;
    for (const record of records) {
      // A card whose content changed (late render, node reuse) is decided again.
      const target = record.target as Element;
      const card = typeof target.closest === "function"
        ? target.closest('article, [data-testid="notification"], [data-testid="UserCell"], [data-testid="cellInnerDiv"]')
        : null;
      if (card) this.painted.delete(card as HTMLElement);
    }
    this.schedule();
  }

  private readonly onClick = (event: Event): void => {
    const handle = allowButtonHandle(event);
    const area = this.deps.area;
    if (!handle || !area) return;
    addAllowedHandle(area, handle).catch(() => {
      // extension context gone: nothing to update
    });
  };

  private readonly onVisibility = (): void => {
    if (this.deps.doc.visibilityState === "hidden") this.persister.flush();
    else this.refreshSettings();
  };

  private readonly onPageHide = (): void => {
    this.persister.flush();
  };

  private readonly onRuntimeMessage = (
    message: unknown,
    _sender: unknown,
    sendResponse: (response?: unknown) => void,
  ): void => {
    if (!isPingMessage(message) || this.stopped) return;
    let version = "";
    try {
      version = this.deps.runtime?.getManifest().version ?? "";
    } catch {
      // context gone
    }
    const response: PingResponse = { ok: true, count: this.count, version };
    sendResponse(response);
  };

  private sources(): Sources {
    return {
      tweet: (id) => this.tweets.get(id),
      userById: (id) => this.users.peek(id),
      userByHandle: (handle) => this.users.byScreenName(handle),
    };
  }

  private pass(): void {
    if (this.stopped) return;
    if (this.orphaned()) {
      this.stop();
      return;
    }
    const { doc, win } = this.deps;
    try {
      if (!this.active()) {
        clearAllPaint(doc);
        this.counter.reset();
        this.sendBadge();
        return;
      }
      const pathname = win.location.pathname;
      if (this.counter.enterPage(pathname)) this.gen += 1;
      this.refreshAbout(pathname);
      const ctx: PageContext = {
        viewer: viewerHandle(doc)?.toLowerCase() ?? null,
        focalId: focalTweetId(pathname),
        about: this.about,
      };
      // The signed-in handle can render after the timeline; the focal post changes with the route.
      const contextKey = `${ctx.viewer}|${ctx.focalId}`;
      if (contextKey !== this.contextKey) {
        this.contextKey = contextKey;
        this.gen += 1;
      }
      this.paintCards(this.collect(pathname), ctx);
      this.paintHeader(pathname, ctx);
      this.sendBadge();
    } catch {
      // fail open: never break x.com
    } finally {
      // Drop the mutations this pass made itself.
      this.observer.takeRecords();
    }
  }

  private collect(pathname: string): CardItem[] {
    const { doc } = this.deps;
    const items: CardItem[] = findTweetArticles(doc).map((el) => ({ el, kind: "tweet" as const }));
    if (pathname.startsWith("/notifications")) {
      for (const el of findNotificationRows(doc)) items.push({ el, kind: "notification" });
    }
    if (!NO_USER_CELL_ROUTES.test(pathname)) {
      for (const el of findUserCells(doc)) items.push({ el, kind: "user" });
    }
    return items;
  }

  private verdict(item: CardItem, ctx: PageContext): Verdict {
    const args = [ctx, this.sources(), this.state.current, this.index] as const;
    switch (item.kind) {
      case "tweet":
        return tweetVerdict(item.el, ...args);
      case "notification":
        return notificationVerdict(item.el, ...args);
      case "user":
        return userCellVerdict(item.el, ...args);
      default: {
        const _never: never = item.kind;
        return _never;
      }
    }
  }

  private paintCards(items: CardItem[], ctx: PageContext): void {
    const { win, doc } = this.deps;
    const changes: Change[] = [];
    for (const item of items) {
      try {
        const key = cardKey(item.el, item.kind);
        const prev = this.painted.get(item.el);
        let paint: CardPaint;
        if (prev && prev.gen === this.gen && prev.key === key && isPainted(item.el, prev.paint, key)) {
          paint = prev.paint;
        } else {
          paint = key ? paintFor(this.verdict(item, ctx), item.kind, this.state.current) : NO_PAINT;
          this.painted.set(item.el, { key, gen: this.gen, paint });
          if (!isPainted(item.el, paint, key)) changes.push({ el: item.el, paint, key });
        }
        if (key && item.kind !== "user") this.counter.track(key, paint.kind !== "none");
      } catch {
        // fail open for this card
      }
    }
    if (changes.length === 0) return;

    // Cards below the visible area change without anything moving on screen; only when a card
    // above or in the reading area changes height is the post being read held in place.
    const shifting = changes.filter(
      (c) => heightClass(c.el) !== paintHeightClass(c.paint) && startsAboveViewBottom(layoutBox(c.el), null, win),
    );
    const resized = shifting.map((c) => layoutBox(c.el));
    let anchor = null;
    if (shifting.length > 0) {
      const scroller = scrollerFor(shifting[0]!.el, win);
      const changing = new Set(changes.map((c) => layoutBox(c.el)));
      anchor = captureAnchor(items.map((i) => layoutBox(i.el)), changing, scroller, win);
    }
    for (const change of changes) {
      try {
        paintCard(change.el, change.paint, change.key);
      } catch {
        // fail open for this card
      }
    }
    if (changes.some((c) => c.paint.kind === "slim")) syncThemeFlag(doc);
    if (anchor) holdAnchor(anchor, win, this.raf, 4, resized);
  }

  private paintHeader(pathname: string, ctx: PageContext): void {
    const { doc } = this.deps;
    const header = findProfileIdentity(doc);
    if (!header) return;
    const pageName = screenNameFromPath(pathname) ?? handleFromProfileHeader(doc);
    const key = pageName ? `p:${pageName.toLowerCase()}` : null;
    const prev = this.painted.get(header);
    if (prev && prev.gen === this.gen && prev.key === key && isPainted(header, prev.paint, key)) return;
    let paint: CardPaint = NO_PAINT;
    if (this.state.current.markOnly) {
      const verdict = profileVerdict(pageName, ctx, this.sources(), this.state.current, this.index);
      if (verdict.reason) paint = { kind: "mark", reason: verdict.reason, handle: null, label: false };
    }
    this.painted.set(header, { key, gen: this.gen, paint });
    paintCard(header, paint, key);
  }

  /** Read the open About sheet; remember what it adds to a known account (hook data wins). */
  private refreshAbout(pathname: string): void {
    const about = aboutRouteHandle(pathname) ? aboutSheetSignals(this.deps.doc, pathname) : null;
    const json = JSON.stringify(about);
    if (json === this.aboutJson) return;
    this.about = about;
    this.aboutJson = json;
    this.gen += 1;
    if (!about) return;
    const known = this.users.byScreenName(about.handle);
    if (!known) return;
    const filled: UserRecord = {
      ...known,
      basedIn: known.basedIn ?? about.basedIn,
      connectedVia: known.connectedVia ?? about.connectedVia,
      locationAccurate: known.locationAccurate ?? (known.basedIn ? null : about.locationAccurate),
    };
    this.persister.note(this.users.put(filled, this.now()));
  }

  private sendBadge(): void {
    const count = this.counter.takeUpdate();
    if (count === null) return;
    try {
      const sent = this.deps.runtime?.sendMessage({ type: BADGE_MSG, count });
      if (sent && typeof (sent as Promise<unknown>).catch === "function") {
        (sent as Promise<unknown>).catch(() => {
          // no background listening
        });
      }
    } catch {
      // extension context gone
    }
  }
}
