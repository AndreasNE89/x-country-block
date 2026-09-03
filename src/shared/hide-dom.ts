const TWEET_ID_RE = /\/status\/(\d+)/;
const USER_ID_RE = /\/i\/user\/(\d+)(?:[/?#]|$)/;

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
const MARK_STYLE_ID = "xcb-mark-style";
const SIGNAL_MAX = 80;

export function setArticleHidden(article: HTMLElement, hidden: boolean): void {
  applyCardMark(article, hidden ? "hidden" : null, false);
}

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

export function screenNameFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/([A-Za-z0-9_]+)(?:\/|$)/);
  if (!match) return null;
  const name = match[1];
  if (!name || RESERVED_PATHS.has(name.toLowerCase())) return null;
  return name;
}

export function screenNameFromHref(href: string): string | null {
  try {
    const path = href.includes("://") ? new URL(href).pathname : href.split("?")[0] ?? href;
    return screenNameFromPath(path);
  } catch {
    return screenNameFromPath(href.split("?")[0] ?? href);
  }
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
  try {
    const path = href.includes("://") ? new URL(href).pathname : href.split("?")[0] ?? href;
    const match = path.match(/^\/([A-Za-z0-9_]+)\/status\/\d+/);
    if (!match?.[1] || RESERVED_PATHS.has(match[1].toLowerCase())) return null;
    return match[1];
  } catch {
    return null;
  }
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

export function aboutSignalsFromText(text: string): {
  basedIn: string | null;
  connectedVia: string | null;
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return {
    basedIn:
      valueAfterLabel(lines, "account based in") ??
      firstMatch(text, /account based in\s+(.+?)(?:\s+\d+\s+username|\s+last on|\s+connected via|$)/i),
    connectedVia:
      valueAfterLabel(lines, "connected via") ?? firstMatch(text, /connected via\s+(.+)$/i),
  };
}

function valueAfterLabel(lines: string[], label: string): string | null {
  const index = lines.findIndex((line) => line.toLowerCase() === label);
  if (index < 0) return null;
  const next = lines[index + 1];
  if (!next) return null;
  const folded = next.toLowerCase();
  if (folded === "account based in" || folded === "connected via" || folded === "date joined") {
    return null;
  }
  return next;
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const match = text.replace(/\s+/g, " ").match(pattern);
  const value = match?.[1]?.trim();
  return value || null;
}

function clipSignal(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > SIGNAL_MAX ? trimmed.slice(0, SIGNAL_MAX) : trimmed;
}

export function aboutSignalsFromDocument(root: ParentNode): {
  basedIn: string | null;
  connectedVia: string | null;
} {
  const sheet =
    root.querySelector('[role="dialog"]') ?? root.querySelector('[data-testid="sheetDialog"]');
  if (!sheet) return { basedIn: null, connectedVia: null };
  const text = sheet.textContent ?? "";
  if (!/account based in|connected via/i.test(text)) {
    return { basedIn: null, connectedVia: null };
  }
  const signals = aboutSignalsFromText(text);
  return {
    basedIn: clipSignal(signals.basedIn),
    connectedVia: clipSignal(signals.connectedVia),
  };
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

function ensureMarkStyles(doc: Document): void {
  if (doc.getElementById(MARK_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = MARK_STYLE_ID;
  style.textContent = [
    `[${HIDE_ATTR}]{display:none!important}`,
    `[${MARK_ATTR}]{outline:2px solid #c23b22!important;outline-offset:-2px!important}`,
  ].join("");
  doc.documentElement.appendChild(style);
}

function clearInsertedLabel(article: HTMLElement): void {
  article.querySelector(`.${MARK_LABEL_CLASS}`)?.remove();
}

export function layoutBox(el: HTMLElement): HTMLElement {
  const cell = el.closest('[data-testid="cellInnerDiv"]');
  return cell instanceof HTMLElement ? cell : el;
}

export function snapshotAboveFold(els: HTMLElement[]): { box: HTMLElement; height: number }[] {
  const snaps: { box: HTMLElement; height: number }[] = [];
  const seen = new Set<HTMLElement>();
  for (const el of els) {
    const box = layoutBox(el);
    if (seen.has(box)) continue;
    seen.add(box);
    const rect = box.getBoundingClientRect();
    if (rect.bottom <= 0 && rect.height > 0) snaps.push({ box, height: rect.height });
  }
  return snaps;
}

export function restoreScrollAfterHide(snaps: { box: HTMLElement; height: number }[]): void {
  let delta = 0;
  for (const snap of snaps) {
    const next = snap.box.isConnected ? snap.box.getBoundingClientRect().height : 0;
    delta += next - snap.height;
  }
  if (delta !== 0) window.scrollBy(0, delta);
}

function clearHideOn(el: HTMLElement): void {
  el.style.removeProperty("display");
  el.removeAttribute(HIDE_ATTR);
}

function clearCardPaint(article: HTMLElement): void {
  const reason = article.getAttribute(MARK_ATTR) ?? article.getAttribute(HIDE_ATTR);
  article.style.removeProperty("outline");
  article.style.removeProperty("outline-offset");
  article.style.removeProperty("box-shadow");
  article.style.removeProperty("background-color");
  article.style.removeProperty("visibility");
  article.style.removeProperty("pointer-events");
  article.style.removeProperty("display");
  article.removeAttribute(MARK_ATTR);
  article.removeAttribute(HIDE_ATTR);
  const box = layoutBox(article);
  if (box !== article) clearHideOn(box);
  if (reason && article.getAttribute("title") === reason) article.removeAttribute("title");
}

function paintMark(article: HTMLElement, reason: string): void {
  ensureMarkStyles(article.ownerDocument);
  article.style.removeProperty("display");
  article.removeAttribute(HIDE_ATTR);
  const box = layoutBox(article);
  if (box !== article) clearHideOn(box);
  article.setAttribute(MARK_ATTR, reason);
  article.setAttribute("title", reason);
}

function paintHide(article: HTMLElement, reason: string): void {
  ensureMarkStyles(article.ownerDocument);
  article.removeAttribute(MARK_ATTR);
  article.style.removeProperty("outline");
  article.style.removeProperty("outline-offset");
  article.style.removeProperty("box-shadow");
  article.style.removeProperty("background-color");
  article.style.setProperty("display", "none", "important");
  article.setAttribute(HIDE_ATTR, reason);
  article.setAttribute("title", reason);
}

export type CardZone = "above" | "visible" | "below";

export function cardZone(el: HTMLElement, viewportHeight?: number): CardZone {
  const box = layoutBox(el);
  const rect = box.getBoundingClientRect();
  const height =
    viewportHeight ??
    (typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 800);
  const guard = Math.max(180, height * 0.25);
  if (rect.bottom <= 0) return "above";
  if (rect.top >= height - guard) return "below";
  return "visible";
}

export function measureCardZones(els: HTMLElement[], keepLast = 1): CardZone[] {
  const zones = els.map((el) => cardZone(el));
  if (els.length <= keepLast) return zones;
  for (let i = els.length - keepLast; i < els.length; i += 1) {
    zones[i] = "below";
  }
  return zones;
}

export function applyCardAction(
  article: HTMLElement,
  reason: string | null,
  markOnly: boolean,
  zone?: CardZone,
  hideBelow = false,
): void {
  if (markOnly) {
    applyCardMark(article, reason, true);
    return;
  }
  if (!reason) {
    applyCardMark(article, null, true);
    return;
  }
  if (article.getAttribute(HIDE_ATTR)) {
    if (article.getAttribute(HIDE_ATTR) !== reason) applyCardMark(article, reason, false);
    return;
  }
  const resolved = zone ?? cardZone(article);
  switch (resolved) {
    case "above":
    case "visible":
      applyCardMark(article, reason, false);
      return;
    case "below":
      applyCardMark(article, hideBelow ? reason : null, !hideBelow);
      return;
    default: {
      const _never: never = resolved;
      return _never;
    }
  }
}

export function applyCardMark(
  article: HTMLElement,
  reason: string | null,
  markOnly: boolean,
): void {
  clearInsertedLabel(article);
  if (!reason) {
    if (!article.hasAttribute(MARK_ATTR) && !article.hasAttribute(HIDE_ATTR)) return;
    clearCardPaint(article);
    return;
  }
  if (markOnly) {
    if (article.getAttribute(MARK_ATTR) === reason && !article.hasAttribute(HIDE_ATTR)) return;
    paintMark(article, reason);
    return;
  }
  if (article.getAttribute(HIDE_ATTR) === reason) return;
  paintHide(article, reason);
}

export function findTweetArticles(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  const articles = root.querySelectorAll("article");
  for (const article of articles) {
    if (tweetIdFromArticle(article)) found.push(article as HTMLElement);
  }
  return found;
}

export function findNotificationRows(root: ParentNode): HTMLElement[] {
  const rows: HTMLElement[] = [];
  for (const node of root.querySelectorAll('[data-testid="cellInnerDiv"]')) {
    if (node.querySelector("article")) continue;
    if (tweetIdFromArticle(node) || userIdFromElement(node)) {
      rows.push(node as HTMLElement);
    }
  }
  return rows;
}
