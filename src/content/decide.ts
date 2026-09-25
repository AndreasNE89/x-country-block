// What to do with one card on the page, from hook records, cached accounts and what the card shows.
import {
  type AboutSignals,
  type CardPaint,
  NO_PAINT,
  notificationActors,
  screenNameFromElement,
  tweetIdFromArticle,
  userCellHandle,
  userIdFromElement,
  visiblePlaceFromCard,
  visibleTranslatedFrom,
} from "../shared/hide-dom.ts";
import { languageCodeFromName } from "../shared/languages.ts";
import {
  actionReason,
  cardDecision,
  effectiveFilterMode,
  type MatchDecision,
  tweetDecision,
} from "../shared/match.ts";
import type { CountryIndex, Settings, TweetRecord, UserRecord } from "../shared/types.ts";

export const INACCURATE_NOTE = " (may be inaccurate)";
/** The note match.ts puts after an "Account based in" reason; the doubt joins it, not a second one. */
const SHOWN_BY_X = " (as shown by X)";
const SHOWN_BY_X_DOUBTED = " (as shown by X, may be inaccurate)";

/** Add the doubt note to a reason: inside its "(as shown by X)" when it has one (the last one). */
export function withDoubtNote(reason: string): string {
  const at = reason.lastIndexOf(SHOWN_BY_X);
  if (at < 0) return reason + INACCURATE_NOTE;
  return reason.slice(0, at) + SHOWN_BY_X_DOUBTED + reason.slice(at + SHOWN_BY_X.length);
}

export type CardKind = "tweet" | "notification" | "user";

export type Sources = {
  tweet: (id: string) => TweetRecord | undefined;
  userById: (id: string) => UserRecord | undefined;
  userByHandle: (handle: string) => UserRecord | undefined;
};

export type PageContext = {
  /** Signed-in account, lowercase. */
  viewer: string | null;
  /** Post a /status/ page was opened for. */
  focalId: string | null;
  /** Signals read from X's open "About this account" sheet. */
  about: AboutSignals | null;
};

export type Verdict = {
  reason: string | null;
  /** Account the card is judged by, as shown on X (for "Always show @handle"). */
  handle: string | null;
  focal: boolean;
};

const SHOW: Verdict = { reason: null, handle: null, focal: false };

export function emptyTweet(partial: Partial<TweetRecord> = {}): TweetRecord {
  return { tweetId: "", lang: null, authorId: null, place: null, quoted: null, retweeted: null, ...partial };
}

/** The identity a card is cached and counted under; a reused node with a new key is re-checked. */
export function cardKey(el: Element, kind: CardKind): string | null {
  switch (kind) {
    case "tweet": {
      const id = tweetIdFromArticle(el);
      return id ? `t:${id}` : null;
    }
    case "notification": {
      const actors = notificationActors(el, null).map((a) => a.userId ?? a.handle?.toLowerCase());
      const id = tweetIdFromArticle(el);
      return id || actors.length ? `n:${id ?? ""}:${actors.join(",")}` : null;
    }
    case "user": {
      const handle = userCellHandle(el);
      return handle ? `u:${handle.toLowerCase()}` : null;
    }
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function isExempt(handle: string | null, ctx: PageContext, settings: Settings): boolean {
  if (!handle) return false;
  const folded = handle.toLowerCase();
  return folded === ctx.viewer || settings.allowedHandles.includes(folded);
}

function authorFor(sources: Sources, userId: string | null, handle: string | null): UserRecord | undefined {
  return (userId ? sources.userById(userId) : undefined) ?? (handle ? sources.userByHandle(handle) : undefined);
}

/**
 * Fill what the hook did not supply from the open About sheet of the same account. Hook
 * (GraphQL) data always wins; the sheet never replaces a value.
 */
export function withAbout(
  author: UserRecord | undefined,
  handle: string | null,
  about: AboutSignals | null,
): UserRecord | undefined {
  const name = (author?.screenName ?? handle)?.toLowerCase();
  if (!about || !name || name !== about.handle) return author;
  const filled: UserRecord = {
    userId: author?.userId ?? "",
    screenName: author?.screenName ?? handle,
    location: author?.location ?? null,
    basedIn: author?.basedIn ?? about.basedIn,
    connectedVia: author?.connectedVia ?? about.connectedVia,
    lang: author?.lang ?? null,
    locationAccurate: author?.locationAccurate ?? (author?.basedIn ? null : about.locationAccurate),
  };
  return filled;
}

function doubted(user: UserRecord | undefined): boolean {
  return !!user?.basedIn && user.locationAccurate === false;
}

function withoutDoubtedBasedIn(user: UserRecord | undefined): UserRecord | undefined {
  return user && doubted(user) ? { ...user, basedIn: null } : user;
}

/** cardDecision reads authors through Map#get; this serves them from the cache without copying it. */
class UsersView extends Map<string, UserRecord> {
  constructor(
    private readonly sources: Sources,
    private readonly overlay: UserRecord | undefined,
    private readonly strip: boolean,
  ) {
    super();
  }

  override get(id: string): UserRecord | undefined {
    const user = this.overlay?.userId === id ? this.overlay : this.sources.userById(id);
    return this.strip ? withoutDoubtedBasedIn(user) : user;
  }

  override has(id: string): boolean {
    return this.get(id) !== undefined;
  }
}

/**
 * The action reason, with "may be inaccurate" when it rests on an "Account based in" value X
 * itself flags as possibly wrong (VPN, travel): deciding without that value gives another result.
 */
function reasonWithDoubt(
  decide: (strip: boolean) => MatchDecision,
  anyDoubted: boolean,
  settings: Settings,
): string | null {
  const decision = decide(false);
  const reason = actionReason(decision, settings);
  if (!reason || !anyDoubted) return reason;
  const without = decide(true);
  return without.hit !== decision.hit || without.decided !== decision.decided ? withDoubtNote(reason) : reason;
}

export function tweetVerdict(
  card: Element,
  ctx: PageContext,
  sources: Sources,
  settings: Settings,
  index: CountryIndex,
): Verdict {
  const id = tweetIdFromArticle(card);
  let record = id ? sources.tweet(id) : undefined;
  // A repost is judged by the post it shows. X links the original, so the record is usually the
  // original already; an id that resolves to the repost wrapper is swapped for the original.
  if (record?.retweetedId) record = sources.tweet(record.retweetedId) ?? record.retweeted ?? record;
  const domHandle = screenNameFromElement(card);
  const userId = record?.authorId ?? userIdFromElement(card);
  const cached = authorFor(sources, userId, domHandle);
  const author = withAbout(cached, cached?.screenName ?? domHandle, ctx.about);
  const handle = author?.screenName || domHandle;
  const focal = !!id && id === ctx.focalId;
  if (isExempt(handle, ctx, settings)) return { reason: null, handle, focal };

  const place = record?.place ?? visiblePlaceFromCard(card);
  const lang = record?.lang ?? languageCodeFromName(visibleTranslatedFrom(card) ?? "") ?? null;
  const quotedSource = record ? (record.quotedId ? sources.tweet(record.quotedId) : undefined) ?? record.quoted : null;
  const quotedAuthor = quotedSource?.authorId ? sources.userById(quotedSource.authorId) : undefined;
  // Quotes count one level deep, as X draws them; an always-shown quoted account is not held against the card.
  const quoted =
    quotedSource && !isExempt(quotedAuthor?.screenName ?? null, ctx, settings)
      ? { ...quotedSource, quoted: null, retweeted: null }
      : null;

  const decide = (strip: boolean): MatchDecision => {
    const judged = strip ? withoutDoubtedBasedIn(author) : author;
    if (!record) {
      const tweet = emptyTweet({ tweetId: id ?? "", authorId: userId ?? author?.userId ?? null, place, lang });
      return tweetDecision(tweet, judged, settings, index);
    }
    const full: TweetRecord = {
      ...record,
      place,
      lang,
      authorId: record.authorId ?? (author?.userId || null),
      quoted,
      retweeted: null,
    };
    return cardDecision(full, new UsersView(sources, author?.userId ? author : undefined, strip), settings, index);
  };
  const reason = reasonWithDoubt(decide, doubted(author) || (!!quoted && doubted(quotedAuthor)), settings);
  return { reason, handle, focal };
}

function accountReason(author: UserRecord | undefined, settings: Settings, index: CountryIndex): MatchDecision {
  return tweetDecision(emptyTweet(), author, settings, index);
}

/**
 * Like, repost and follow notifications are judged by the accounts that acted, never by the
 * signed-in user's own post they point at. A grouped row stays when any of its actors would.
 */
export function notificationVerdict(
  row: Element,
  ctx: PageContext,
  sources: Sources,
  settings: Settings,
  index: CountryIndex,
): Verdict {
  const actors = notificationActors(row, ctx.viewer);
  if (actors.length === 0) {
    return tweetIdFromArticle(row) ? { ...tweetVerdict(row, ctx, sources, settings, index), focal: false } : SHOW;
  }
  let first: Verdict | null = null;
  for (const actor of actors) {
    const cached = authorFor(sources, actor.userId, actor.handle);
    const author = withAbout(cached, cached?.screenName ?? actor.handle, ctx.about);
    const handle = author?.screenName || actor.handle;
    if (isExempt(handle, ctx, settings)) return { reason: null, handle, focal: false };
    const reason = reasonWithDoubt(
      (strip) => accountReason(strip ? withoutDoubtedBasedIn(author) : author, settings, index),
      doubted(author),
      settings,
    );
    if (!reason) return { reason: null, handle, focal: false };
    first ??= { reason, handle, focal: false };
  }
  return first ?? SHOW;
}

/**
 * Account rows ("Who to follow", follower and people lists) rarely carry a location, so only a
 * decided result filters one: a proven match in Hide, a proven miss in Only show.
 */
export function userCellVerdict(
  cell: Element,
  ctx: PageContext,
  sources: Sources,
  settings: Settings,
  index: CountryIndex,
): Verdict {
  const domHandle = userCellHandle(cell);
  if (!domHandle) return SHOW;
  const cached = sources.userByHandle(domHandle);
  const author = withAbout(cached, domHandle, ctx.about);
  const handle = author?.screenName || domHandle;
  if (isExempt(handle, ctx, settings)) return { reason: null, handle, focal: false };
  const decision = accountReason(author, settings, index);
  if (!decision.hit && !decision.decided) return { reason: null, handle, focal: false };
  const reason = reasonWithDoubt(
    (strip) => (strip ? accountReason(withoutDoubtedBasedIn(author), settings, index) : decision),
    doubted(author),
    settings,
  );
  return { reason, handle, focal: false };
}

/** The profile header of the page's account (outlined in Highlight mode only). */
export function profileVerdict(
  pageName: string | null,
  ctx: PageContext,
  sources: Sources,
  settings: Settings,
  index: CountryIndex,
): Verdict {
  if (!pageName) return SHOW;
  const cached = sources.userByHandle(pageName);
  const author = withAbout(cached ?? { ...emptyUser(), screenName: pageName }, pageName, ctx.about);
  const handle = author?.screenName || pageName;
  if (isExempt(handle, ctx, settings)) return { reason: null, handle, focal: false };
  const reason = reasonWithDoubt(
    (strip) => accountReason(strip ? withoutDoubtedBasedIn(author) : author, settings, index),
    doubted(author),
    settings,
  );
  return { reason, handle, focal: false };
}

function emptyUser(): UserRecord {
  return { userId: "", screenName: null, location: null, basedIn: null, connectedVia: null, lang: null };
}

/**
 * How to show a verdict. Highlight mode, and the post a /status/ page was opened for, get an
 * outline and a label instead of disappearing. In Only show, set-aside posts collapse to a slim
 * row rather than vanish, so a sparse match rate cannot leave an endlessly loading timeline.
 */
export function paintFor(verdict: Verdict, kind: CardKind, settings: Settings): CardPaint {
  if (!verdict.reason) return NO_PAINT;
  const label = kind !== "user";
  if (settings.markOnly || verdict.focal) {
    return { kind: "mark", reason: verdict.reason, handle: label ? verdict.handle : null, label };
  }
  if (kind !== "user" && effectiveFilterMode(settings) === "only") return { kind: "slim", reason: verdict.reason };
  return { kind: "hide", reason: verdict.reason };
}
