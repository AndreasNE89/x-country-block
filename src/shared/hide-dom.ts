const TWEET_ID_RE = /\/status\/(\d+)/;
const USER_ID_RE = /\/i\/user\/(\d+)(?:[/?#]|$)/;
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export function tweetIdFromHref(href: string): string | null {
  const match = href.match(TWEET_ID_RE);
  return match?.[1] ?? null;
}

export function tweetIdFromArticle(article: Element): string | null {
  const links = article.querySelectorAll("a[href]");
  for (const link of links) {
    const id = tweetIdFromHref(link.getAttribute("href") ?? "");
    if (id) return id;
  }
  return null;
}

export function userIdFromHref(href: string): string | null {
  const match = href.match(USER_ID_RE);
  return match?.[1] ?? null;
}

export function userIdFromElement(element: Element): string | null {
  const links = element.querySelectorAll("a[href]");
  for (const link of links) {
    const id = userIdFromHref(link.getAttribute("href") ?? "");
    if (id) return id;
  }
  return null;
}

export const MARK_LABEL_CLASS = "xcb-mark-label";
export const MARK_ATTR = "data-xcb-mark";
export const HIDE_ATTR = "data-xcb-hide";
/** Set with HIDE_ATTR when a card is collapsed to a slim "set aside" row instead of removed. */
export const SLIM_ATTR = "data-xcb-slim";
/** What the paint was decided for (tweet id or account), so a reused node is re-checked. */
export const KEY_ATTR = "data-xcb-id";
/** On the "Always show @handle" button: the handle to add to allowedHandles. */
export const ALLOW_ATTR = "data-xcb-allow";
/** One outline colour that passes 3:1 on X's light, Dim and Lights out themes. */
export const HIGHLIGHT_COLOR = "#B86E00";
const DARK_ATTR = "data-xcb-dark";
const MARK_STYLE_ID = "xcb-mark-style";
const SIGNAL_MAX = 80;
const BRAND = "Tamis";

const RESERVED_PATHS = new Set([
  "about",
  "account",
  "bookmarks",
  "communities",
  "compose",
  "connect",
  "display",
  "download",
  "explore",
  "flow",
  "followers",
  "following",
  "hashtag",
  "help",
  "home",
  "i",
  "intent",
  "jobs",
  "lists",
  "login",
  "logout",
  "messages",
  "notifications",
  "people",
  "premium",
  "privacy",
  "search",
  "settings",
  "share",
  "signup",
  "status",
  "topics",
  "tos",
]);

function isHandle(name: string | undefined): name is string {
  return !!name && HANDLE_RE.test(name) && !RESERVED_PATHS.has(name.toLowerCase());
}

export function screenNameFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/([A-Za-z0-9_]+)(?:\/|$)/);
  if (!match) return null;
  const name = match[1];
  if (!name || RESERVED_PATHS.has(name.toLowerCase())) return null;
  return name;
}

function pathOf(href: string): string {
  try {
    return href.includes("://") ? new URL(href).pathname : href.split(/[?#]/)[0] ?? href;
  } catch {
    return href.split(/[?#]/)[0] ?? href;
  }
}

export function screenNameFromHref(href: string): string | null {
  return screenNameFromPath(pathOf(href));
}

/** The handle of a link that points at a profile itself (/<handle>), not at a post or a tab. */
export function profileHandleFromHref(href: string): string | null {
  const name = pathOf(href).match(/^\/([A-Za-z0-9_]+)\/?$/)?.[1];
  return isHandle(name) ? name : null;
}

export function screenNameFromElement(element: Element): string | null {
  const links = element.querySelectorAll("a[href]");
  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    const fromStatus = screenNameFromStatusHref(href);
    if (fromStatus) return fromStatus;
  }
  for (const link of links) {
    const name = screenNameFromHref(link.getAttribute("href") ?? "");
    if (name) return name;
  }
  return null;
}

export function screenNameFromStatusHref(href: string): string | null {
  const match = pathOf(href).match(/^\/([A-Za-z0-9_]+)\/status\/\d+/);
  if (!match?.[1] || RESERVED_PATHS.has(match[1].toLowerCase())) return null;
  return match[1];
}

/** The post a /status/ page was opened for (the focal post), if this is one. */
export function focalTweetId(pathname: string): string | null {
  const match = pathname.match(/^\/(?:[A-Za-z0-9_]+|i\/web)\/status\/(\d+)/);
  return match?.[1] ?? null;
}

/** The signed-in account, from the side navigation. Null when X does not show it (logged out). */
export function viewerHandle(root: ParentNode): string | null {
  const link = root.querySelector('[data-testid="AppTabBar_Profile_Link"]');
  const fromLink = profileHandleFromHref(link?.getAttribute("href") ?? "");
  if (fromLink) return fromLink;
  const switcher = root.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
  const match = switcher?.textContent?.match(/@([A-Za-z0-9_]{1,15})\b/);
  return match?.[1] ?? null;
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || null;
}

export function handleFromProfileHeader(root: ParentNode): string | null {
  const name = root.querySelector('[data-testid="UserName"]');
  const text = name?.textContent?.replace(/\s+/g, " ") ?? "";
  const match = text.match(/@([A-Za-z0-9_]+)/);
  return match?.[1] ?? null;
}

export function profileHeaderTexts(root: ParentNode): string[] {
  const name = root.querySelector('[data-testid="UserName"]');
  if (!name) return [];
  const column = name.closest('[data-testid="primaryColumn"]') ?? name.parentElement;
  if (!column) return [];
  const texts: string[] = [];
  const seen = new Set<string>();
  for (const child of column.children) {
    if (child instanceof HTMLElement && (child.matches("article") || child.querySelector("article"))) {
      break;
    }
    const nodes = [child, ...child.querySelectorAll("span, a")];
    for (const el of nodes) {
      if (el.querySelector("span, a")) continue;
      const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (text.length < 2 || text.length > 80) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      texts.push(text);
    }
  }
  return texts;
}

export function visibleProfileLocation(root: ParentNode): string | null {
  const byTestId = cleanText(root.querySelector('[data-testid="UserLocation"]')?.textContent);
  if (byTestId) return byTestId;
  const items = root.querySelector('[data-testid="UserProfileHeader_Items"]');
  if (!items) return null;
  for (const child of items.children) {
    const text = cleanText(child.textContent);
    if (!text) continue;
    if (/^joined /i.test(text)) continue;
    if (/^born /i.test(text)) continue;
    if (/^(following|followers)$/i.test(text)) continue;
    return text;
  }
  return null;
}

export function findProfileIdentity(root: ParentNode): HTMLElement | null {
  const name = root.querySelector('[data-testid="UserName"]');
  if (!(name instanceof HTMLElement)) return null;
  const loc =
    root.querySelector('[data-testid="UserLocation"]') ??
    root.querySelector('[data-testid="UserProfileHeader_Items"]');
  if (!(loc instanceof HTMLElement)) return name;
  let node: HTMLElement | null = name;
  for (let i = 0; i < 16 && node; i += 1) {
    const testId = node.getAttribute("data-testid") ?? "";
    if (testId === "primaryColumn" || testId === "sidebarColumn") break;
    if (node.contains(loc)) return node;
    node = node.parentElement;
  }
  return name;
}

export type AboutSignals = {
  /** Lowercase handle the About sheet belongs to. */
  handle: string;
  basedIn: string | null;
  connectedVia: string | null;
  locationAccurate: boolean | null;
};

/** The handle of an /<handle>/about route (X's "About this account" sheet), else null. */
export function aboutRouteHandle(pathname: string): string | null {
  const name = pathname.match(/^\/([A-Za-z0-9_]+)\/about\/?$/)?.[1];
  return isHandle(name) ? name.toLowerCase() : null;
}

const ABOUT_LABELS = new Set([
  "account based in",
  "connected via",
  "date joined",
  "verified",
  "username changes",
]);

function leafText(el: Element): string | null {
  if (el.children.length === 0) return cleanText(el.textContent);
  for (const node of el.querySelectorAll("*")) {
    if (node.children.length > 0) continue;
    const text = cleanText(node.textContent);
    if (text) return text;
  }
  return null;
}

function leaves(root: Element): Element[] {
  return [...root.querySelectorAll("*")].filter((el) => el.children.length === 0);
}

/** The text shown next to a label: the first leaf after it, looking up at most a few levels. */
function valueAfter(label: Element, sheet: Element): string | null {
  let node: Element | null = label;
  for (let depth = 0; depth < 4 && node && node !== sheet; depth += 1) {
    for (let sib = node.nextElementSibling; sib; sib = sib.nextElementSibling) {
      const text = leafText(sib);
      if (!text) continue;
      return ABOUT_LABELS.has(text.toLowerCase()) ? null : text;
    }
    node = node.parentElement;
  }
  return null;
}

function clipSignal(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > SIGNAL_MAX ? trimmed.slice(0, SIGNAL_MAX) : trimmed;
}

function showsHandle(sheet: Element, handle: string): boolean {
  for (const link of sheet.querySelectorAll("a[href]")) {
    if (profileHandleFromHref(link.getAttribute("href") ?? "")?.toLowerCase() === handle) return true;
  }
  return leaves(sheet).some((el) => cleanText(el.textContent)?.toLowerCase() === `@${handle}`);
}

/**
 * Read "Account based in" / "Connected via" from X's own "About this account" sheet only: the
 * route must be /<handle>/about, the sheet must show that handle, and a sheet holding posts or a
 * text box (reply panels, the composer) is never read. Label and value are read from separate
 * elements, since React renders them with no whitespace between.
 */
export function aboutSheetSignals(root: ParentNode, pathname: string): AboutSignals | null {
  const handle = aboutRouteHandle(pathname);
  if (!handle) return null;
  const sheets = root.querySelectorAll(
    '[role="dialog"], [data-testid="sheetDialog"], [data-testid="primaryColumn"]',
  );
  for (const sheet of sheets) {
    if (sheet.querySelector('article, [role="textbox"], [data-testid="tweetText"], [contenteditable="true"]')) {
      continue;
    }
    if (!showsHandle(sheet, handle)) continue;
    let basedIn: string | null = null;
    let connectedVia: string | null = null;
    for (const leaf of leaves(sheet)) {
      const text = cleanText(leaf.textContent)?.toLowerCase();
      if (text === "account based in") basedIn ??= clipSignal(valueAfter(leaf, sheet));
      if (text === "connected via") connectedVia ??= clipSignal(valueAfter(leaf, sheet));
    }
    if (!basedIn && !connectedVia) continue;
    const doubt = /may not be accurate|may be inaccurate/i.test(sheet.textContent ?? "");
    return { handle, basedIn, connectedVia, locationAccurate: doubt ? false : null };
  }
  return null;
}

export function visibleTranslatedFrom(root: Element): string | null {
  const nodes = root.querySelectorAll("span, button");
  for (const node of nodes) {
    const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const match = text.match(/^translated from (.+?)(?:\s+show original)?$/i);
    if (match?.[1]) return match[1].trim();
  }
  const blob = root.textContent?.replace(/\s+/g, " ") ?? "";
  const match = blob.match(/translated from ([a-z][a-z -]{1,40}?)(?:\s+show original|\b)/i);
  return match?.[1]?.trim() ?? null;
}

export function visiblePlaceFromCard(root: Element): string | null {
  const nodes = root.querySelectorAll(
    '[data-testid="tweet-geo"], [data-testid="TweetGeo"], a[href*="/place/"], a[href*="/places/"]',
  );
  for (const node of nodes) {
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  for (const link of root.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href") ?? "";
    if (!href.includes("maps.google") && !href.includes("/geo/")) continue;
    const text = link.textContent?.replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return null;
}

/** "Tamis · <reason>", without doubling the prefix when the reason already carries it. */
export function brandReason(reason: string): string {
  return reason.startsWith(BRAND) ? reason : `${BRAND} · ${reason}`;
}

const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

export const MARK_CSS = [
  `[${HIDE_ATTR}]:not([${SLIM_ATTR}]){display:none!important}`,
  // A hidden post leaves its timeline cell, whose 1px separator would stack into a grey band
  // on a page where every post is hidden.
  `[data-testid="cellInnerDiv"]:has(article[${HIDE_ATTR}]:not([${SLIM_ATTR}]))>div{border-bottom-width:0!important}`,
  `[${MARK_ATTR}]{outline:2px solid ${HIGHLIGHT_COLOR}!important;outline-offset:-2px!important}`,
  // Only-show: a slim row per set-aside post keeps X's loader below the fold, so X does not
  // fetch page after page into an empty-looking timeline, and says why the post is missing.
  `[${SLIM_ATTR}]{display:block!important;min-height:0!important;height:auto!important;padding:0!important;pointer-events:none!important;cursor:default!important}`,
  `[${SLIM_ATTR}]>*{display:none!important}`,
  `[${SLIM_ATTR}]::before{content:attr(title);display:block;padding:4px 16px;font:400 12px/16px ${FONT};color:#536471;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
  `html[${DARK_ATTR}] [${SLIM_ATTR}]::before{color:#8B98A5}`,
  // X's post <article> is a flex row around one content column. Wrapping it and giving the
  // label a full-width box puts the label on its own line under the post; in a column or block
  // parent the same width simply fills the row.
  `[${MARK_ATTR}]:has(>.${MARK_LABEL_CLASS}){flex-wrap:wrap!important}`,
  `.${MARK_LABEL_CLASS}{flex:none;box-sizing:border-box;width:calc(100% - 24px);display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:0 12px 10px;padding:4px 8px;border-radius:6px;background:#FFB638;color:#14201F;font:500 12px/16px ${FONT}}`,
  `.${MARK_LABEL_CLASS} button{all:unset;cursor:pointer;font-weight:600;text-decoration:underline;color:#14201F}`,
  `.${MARK_LABEL_CLASS} button:focus-visible{outline:2px solid #14201F;outline-offset:2px}`,
].join("");

/**
 * Add the stylesheet for hidden, slim and marked cards. A sheet with the same id left by an
 * earlier build (Firefox keeps it when it updates the add-on under an open tab, then runs this
 * build there) is brought up to date, so its old rules cannot hide slim rows or unstyle labels.
 * With `create` false, only such a sheet is updated.
 */
export function ensureMarkStyles(doc: Document, create = true): void {
  const current = doc.getElementById(MARK_STYLE_ID);
  if (current) {
    if (current.textContent !== MARK_CSS) current.textContent = MARK_CSS;
    return;
  }
  if (!create) return;
  const style = doc.createElement("style");
  style.id = MARK_STYLE_ID;
  style.textContent = MARK_CSS;
  doc.documentElement.appendChild(style);
}

function isDarkColor(value: string): boolean | null {
  const match = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!match) return null;
  if (match[4] !== undefined && Number(match[4]) === 0) return null;
  const [r, g, b] = [match[1], match[2], match[3]].map(Number) as [number, number, number];
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/** Record whether X is in a dark theme (Dim, Lights out) so slim rows keep readable text. */
export function syncThemeFlag(doc: Document): void {
  const view = doc.defaultView;
  if (!view || !doc.body) return;
  const dark = isDarkColor(view.getComputedStyle(doc.body).backgroundColor);
  if (dark === null) return;
  if (dark) doc.documentElement.setAttribute(DARK_ATTR, "");
  else doc.documentElement.removeAttribute(DARK_ATTR);
}

export function layoutBox(el: HTMLElement): HTMLElement {
  const cell = el.closest('[data-testid="cellInnerDiv"]');
  return cell instanceof HTMLElement ? cell : el;
}

export type CardPaint =
  | { kind: "none" }
  | { kind: "hide"; reason: string }
  | { kind: "slim"; reason: string }
  | { kind: "mark"; reason: string; handle: string | null; label: boolean };

export const NO_PAINT: CardPaint = { kind: "none" };

function ownLabel(el: HTMLElement): HTMLElement | null {
  for (const child of el.children) {
    if (child instanceof HTMLElement && child.classList.contains(MARK_LABEL_CLASS)) return child;
  }
  return null;
}

function labelMatches(label: HTMLElement | null, text: string, handle: string | null): boolean {
  if (!label) return false;
  const button = label.querySelector(`[${ALLOW_ATTR}]`);
  return (
    label.firstElementChild?.textContent === text &&
    (button?.getAttribute(ALLOW_ATTR) ?? null) === handle
  );
}

function renderLabel(el: HTMLElement, text: string, handle: string | null): void {
  const current = ownLabel(el);
  if (labelMatches(current, text, handle)) return;
  current?.remove();
  const doc = el.ownerDocument;
  const label = doc.createElement("div");
  label.className = MARK_LABEL_CLASS;
  label.setAttribute("role", "note");
  const span = doc.createElement("span");
  span.textContent = text;
  label.append(span);
  if (handle) {
    const button = doc.createElement("button");
    button.type = "button";
    button.setAttribute(ALLOW_ATTR, handle);
    button.textContent = `Always show @${handle}`;
    label.append(button);
  }
  el.append(label);
}

function paintedReason(el: HTMLElement): string | null {
  return el.getAttribute(MARK_ATTR) ?? el.getAttribute(HIDE_ATTR);
}

/** Whether the element already shows `paint` for `key`, so a pass can skip it. */
export function isPainted(el: HTMLElement, paint: CardPaint, key: string | null): boolean {
  switch (paint.kind) {
    case "none":
      return !el.hasAttribute(HIDE_ATTR) && !el.hasAttribute(MARK_ATTR) && !ownLabel(el);
    case "hide":
      return (
        el.getAttribute(HIDE_ATTR) === paint.reason &&
        !el.hasAttribute(SLIM_ATTR) &&
        el.style.getPropertyValue("display") === "none" &&
        el.getAttribute(KEY_ATTR) === key
      );
    case "slim":
      return (
        el.getAttribute(HIDE_ATTR) === paint.reason &&
        el.hasAttribute(SLIM_ATTR) &&
        el.getAttribute(KEY_ATTR) === key
      );
    case "mark": {
      if (el.getAttribute(MARK_ATTR) !== paint.reason || el.hasAttribute(HIDE_ATTR)) return false;
      if (el.getAttribute(KEY_ATTR) !== key) return false;
      const label = ownLabel(el);
      return paint.label ? labelMatches(label, brandReason(paint.reason), paint.handle) : !label;
    }
    default: {
      const _never: never = paint;
      return _never;
    }
  }
}

function clearPaint(el: HTMLElement): void {
  const reason = paintedReason(el);
  if (el.hasAttribute(HIDE_ATTR) && !el.hasAttribute(SLIM_ATTR)) el.style.removeProperty("display");
  el.removeAttribute(MARK_ATTR);
  el.removeAttribute(HIDE_ATTR);
  el.removeAttribute(SLIM_ATTR);
  el.removeAttribute(KEY_ATTR);
  ownLabel(el)?.remove();
  if (reason) {
    const title = el.getAttribute("title");
    if (title === reason || title === brandReason(reason)) el.removeAttribute("title");
  }
  // Builds before 0.2.0 could hide the timeline cell itself.
  const box = layoutBox(el);
  if (box !== el && box.hasAttribute(HIDE_ATTR)) {
    box.style.removeProperty("display");
    box.removeAttribute(HIDE_ATTR);
  }
}

/**
 * Show `paint` on a card: "hide" removes it, "slim" collapses it to a one-line "set aside" row,
 * "mark" outlines it (with an optional in-card label), "none" restores it. Returns false when the
 * card already showed it.
 */
export function paintCard(el: HTMLElement, paint: CardPaint, key: string | null): boolean {
  if (isPainted(el, paint, key)) return false;
  clearPaint(el);
  if (paint.kind === "none") return true;
  ensureMarkStyles(el.ownerDocument);
  const title = brandReason(paint.reason);
  if (key) el.setAttribute(KEY_ATTR, key);
  el.setAttribute("title", title);
  switch (paint.kind) {
    case "hide":
      el.style.setProperty("display", "none", "important");
      el.setAttribute(HIDE_ATTR, paint.reason);
      return true;
    case "slim":
      el.setAttribute(SLIM_ATTR, "");
      el.setAttribute(HIDE_ATTR, paint.reason);
      return true;
    case "mark":
      el.setAttribute(MARK_ATTR, paint.reason);
      if (paint.label) renderLabel(el, title, paint.handle);
      return true;
    default: {
      const _never: never = paint;
      return _never;
    }
  }
}

/** Restore every card this extension painted under `root` (pause, or extension unloaded). */
export function clearAllPaint(root: ParentNode): number {
  let cleared = 0;
  for (const el of root.querySelectorAll(`[${HIDE_ATTR}], [${MARK_ATTR}], [${KEY_ATTR}]`)) {
    if (el instanceof HTMLElement) {
      clearPaint(el);
      cleared += 1;
    }
  }
  for (const label of root.querySelectorAll(`.${MARK_LABEL_CLASS}`)) label.remove();
  return cleared;
}

export function findTweetArticles(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const article of root.querySelectorAll("article")) {
    if (article.getAttribute("data-testid") === "notification") continue;
    if (tweetIdFromArticle(article)) found.push(article as HTMLElement);
  }
  return found;
}

/**
 * Notification items: X's [data-testid="notification"] entries (likes, reposts, follows), plus
 * plain timeline cells that carry a post or account link without being a post themselves.
 */
export function findNotificationRows(root: ParentNode): HTMLElement[] {
  const rows: HTMLElement[] = [];
  for (const node of root.querySelectorAll('[data-testid="notification"]')) {
    if (node instanceof HTMLElement) rows.push(node);
  }
  for (const node of root.querySelectorAll('[data-testid="cellInnerDiv"]')) {
    if (node.querySelector('article, [data-testid="notification"], [data-testid="UserCell"]')) continue;
    if (tweetIdFromArticle(node) || userIdFromElement(node)) rows.push(node as HTMLElement);
  }
  return rows;
}

export type Actor = { userId: string | null; handle: string | null };

/**
 * The accounts a notification is about (who liked, reposted, followed), from their avatar and
 * name links. Leaves out the signed-in account and links inside quoted post text.
 */
export function notificationActors(row: Element, viewer: string | null): Actor[] {
  const actors: Actor[] = [];
  const seen = new Set<string>();
  const self = viewer?.toLowerCase() ?? null;
  for (const link of row.querySelectorAll("a[href]")) {
    if (link.closest('[data-testid="tweetText"]')) continue;
    const href = link.getAttribute("href") ?? "";
    const userId = userIdFromHref(href);
    const handle = userId ? null : profileHandleFromHref(href);
    const key = userId ? `id:${userId}` : handle ? `@${handle.toLowerCase()}` : null;
    if (!key || seen.has(key)) continue;
    if (handle && handle.toLowerCase() === self) continue;
    seen.add(key);
    actors.push({ userId, handle });
  }
  return actors;
}

/** Account rows: "Who to follow", people search, follower and like/repost lists. */
export function findUserCells(root: ParentNode): HTMLElement[] {
  const cells: HTMLElement[] = [];
  for (const node of root.querySelectorAll('[data-testid="UserCell"]')) {
    if (node instanceof HTMLElement) cells.push(node);
  }
  return cells;
}

export function userCellHandle(cell: Element): string | null {
  for (const link of cell.querySelectorAll("a[href]")) {
    const handle = profileHandleFromHref(link.getAttribute("href") ?? "");
    if (handle) return handle;
  }
  return null;
}
