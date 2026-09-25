import { describe, expect, it } from "vitest";
import {
  cardKey,
  notificationVerdict,
  type PageContext,
  paintFor,
  profileVerdict,
  type Sources,
  tweetVerdict,
  userCellVerdict,
  withAbout,
} from "../src/content/decide.ts";
import { TweetStore } from "../src/content/tweet-store.ts";
import { UserCache } from "../src/shared/cache.ts";
import { defaultCountryIndex } from "../src/shared/countries.ts";
import { parseSettings } from "../src/shared/settings.ts";
import type { TweetRecord, UserRecord } from "../src/shared/types.ts";

const NOW = 1_800_000_000_000;
const index = defaultCountryIndex();

function user(partial: Partial<UserRecord> & Pick<UserRecord, "userId">): UserRecord {
  return { screenName: null, location: null, basedIn: null, connectedVia: null, lang: null, ...partial };
}

function tweet(partial: Partial<TweetRecord> & Pick<TweetRecord, "tweetId">): TweetRecord {
  return { lang: null, authorId: null, place: null, quoted: null, retweeted: null, ...partial };
}

function world(users: UserRecord[], tweets: TweetRecord[] = []): Sources {
  const cache = new UserCache(100);
  for (const row of users) cache.put(row, NOW);
  const store = new TweetStore(100);
  for (const row of tweets) store.put(row);
  return {
    tweet: (id) => store.get(id),
    userById: (id) => cache.peek(id),
    userByHandle: (handle) => cache.byScreenName(handle),
  };
}

const CTX: PageContext = { viewer: "me", focalId: null, about: null };
const hideIN = parseSettings({ hiddenCountryCodes: ["IN"] }, NOW);
const hideNG = parseSettings({ hiddenCountryCodes: ["NG"] }, NOW);
const onlyNO = parseSettings({ hiddenCountryCodes: ["NO"], filterMode: "only", onlyShowPaid: true }, NOW);

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

const carol = user({ userId: "10", screenName: "carol", location: "Mumbai, India" });
const olav = user({ userId: "11", screenName: "olav", location: "Oslo, Norway" });
const dave = user({ userId: "12", screenName: "dave", location: "London, UK" });
const me = user({ userId: "13", screenName: "me", location: "somewhere" });

describe("tweetVerdict", () => {
  it("judges a post by its author", () => {
    const sources = world([carol], [tweet({ tweetId: "1", authorId: "10", lang: "en" })]);
    const card = mount(`<article><a href="/carol/status/1">x</a></article>`);
    expect(tweetVerdict(card, CTX, sources, hideIN, index).reason).toContain("India");
  });

  it("never filters the signed-in account's own posts (F17)", () => {
    const sources = world([me], [tweet({ tweetId: "1", authorId: "13" })]);
    const card = mount(`<article><a href="/me/status/1">x</a></article>`);
    expect(tweetVerdict(card, CTX, sources, onlyNO, index).reason).toBeNull();
  });

  it("never filters an account in allowedHandles (F10)", () => {
    const settings = parseSettings({ hiddenCountryCodes: ["IN"], allowedHandles: ["Carol"] }, NOW);
    const sources = world([carol], [tweet({ tweetId: "1", authorId: "10" })]);
    const card = mount(`<article><a href="/carol/status/1">x</a></article>`);
    expect(tweetVerdict(card, CTX, sources, settings, index)).toMatchObject({ reason: null, handle: "carol" });
  });

  it("flags the post a /status/ page was opened for", () => {
    const sources = world([carol], [tweet({ tweetId: "1", authorId: "10" })]);
    const card = mount(`<article><a href="/carol/status/1">x</a></article>`);
    const verdict = tweetVerdict(card, { ...CTX, focalId: "1" }, sources, hideIN, index);
    expect(verdict.focal).toBe(true);
    expect(paintFor(verdict, "tweet", hideIN)).toMatchObject({ kind: "mark", label: true, handle: "carol" });
  });

  it("judges a repost by the post it shows (C03)", () => {
    const sources = world(
      [olav, carol],
      [
        tweet({ tweetId: "900", authorId: "11", retweetedId: "500" }),
        tweet({ tweetId: "500", authorId: "10" }),
      ],
    );
    const card = mount(`
      <article>
        <div data-testid="socialContext"><a href="/olav">Olav reposted</a></div>
        <a href="/carol/status/500">post</a>
      </article>`);
    expect(tweetVerdict(card, CTX, sources, hideIN, index).reason).toContain("India");
    // A card that resolves to the repost wrapper is judged by the original too.
    const wrapper = mount(`<article><a href="/olav/status/900">post</a></article>`);
    expect(tweetVerdict(wrapper, CTX, sources, hideIN, index).reason).toContain("India");
  });

  it("reads a quote X sent by id only (F14)", () => {
    const lagos = user({ userId: "20", screenName: "lagos", location: "Lagos, Nigeria" });
    const sources = world(
      [dave, lagos],
      [tweet({ tweetId: "111", authorId: "12", quotedId: "222" }), tweet({ tweetId: "222", authorId: "20" })],
    );
    const card = mount(`<article><a href="/dave/status/111">x</a><a href="/lagos/status/222">q</a></article>`);
    expect(tweetVerdict(card, CTX, sources, hideNG, index).reason).toContain("Nigeria");
  });

  it("does not hold an always-shown quoted account against the card", () => {
    const lagos = user({ userId: "20", screenName: "lagos", location: "Lagos, Nigeria" });
    const settings = parseSettings({ hiddenCountryCodes: ["NG"], allowedHandles: ["lagos"] }, NOW);
    const sources = world(
      [dave, lagos],
      [tweet({ tweetId: "111", authorId: "12", quotedId: "222" }), tweet({ tweetId: "222", authorId: "20" })],
    );
    const card = mount(`<article><a href="/dave/status/111">x</a></article>`);
    expect(tweetVerdict(card, CTX, sources, settings, index).reason).toBeNull();
  });

  it("falls back to the author seen on the card when the hook has no record", () => {
    const sources = world([carol]);
    const card = mount(`<article><a href="/carol/status/1">x</a></article>`);
    expect(tweetVerdict(card, CTX, sources, hideIN, index).reason).toContain("India");
  });

  it("says when X flags the based-in country as possibly inaccurate (F47)", () => {
    const vpn = user({
      userId: "30",
      screenName: "vpn",
      location: "Toronto, Canada",
      basedIn: "Nigeria",
      locationAccurate: false,
    });
    const sources = world([vpn], [tweet({ tweetId: "1", authorId: "30" })]);
    const card = mount(`<article><a href="/vpn/status/1">x</a></article>`);
    expect(tweetVerdict(card, CTX, sources, hideNG, index).reason).toMatch(/Nigeria.* \(may be inaccurate\)$/);
    const sure = world([{ ...vpn, locationAccurate: true }], [tweet({ tweetId: "1", authorId: "30" })]);
    expect(tweetVerdict(card, CTX, sure, hideNG, index).reason).not.toContain("inaccurate");
  });
});

describe("About sheet signals", () => {
  const about = { handle: "alice", basedIn: "Nigeria", connectedVia: "Nigeria App Store", locationAccurate: null };

  it("fill in only what the hook did not send (C01)", () => {
    const hooked = user({ userId: "1", screenName: "Alice", basedIn: "Ghana" });
    expect(withAbout(hooked, "Alice", about)).toMatchObject({ basedIn: "Ghana", connectedVia: "Nigeria App Store" });
    expect(withAbout(user({ userId: "1", screenName: "alice" }), "alice", about)?.basedIn).toBe("Nigeria");
  });

  it("apply only to the sheet's own account", () => {
    const bob = user({ userId: "2", screenName: "bob" });
    expect(withAbout(bob, "bob", about)).toBe(bob);
  });
});

describe("notificationVerdict (F16)", () => {
  const likeRow = (actors: string) =>
    `<article data-testid="notification">${actors}<span> liked your post</span><a href="/me/status/5">post</a></article>`;

  it("judges a like by the account that liked, not by the viewer's post", () => {
    const sources = world([carol, me], [tweet({ tweetId: "5", authorId: "13" })]);
    const row = mount(likeRow(`<a href="/carol">carol</a>`));
    expect(notificationVerdict(row, CTX, sources, hideIN, index)).toMatchObject({ handle: "carol" });
    expect(notificationVerdict(row, CTX, sources, hideIN, index).reason).toContain("India");
  });

  it("keeps an allowed actor's like in Only show", () => {
    const sources = world([olav, me], [tweet({ tweetId: "5", authorId: "13" })]);
    const row = mount(likeRow(`<a href="/olav">olav</a>`));
    expect(notificationVerdict(row, CTX, sources, onlyNO, index).reason).toBeNull();
  });

  it("keeps a grouped row when any actor would be shown", () => {
    const sources = world([carol, dave]);
    const row = mount(likeRow(`<a href="/carol">carol</a><a href="/dave">dave</a>`));
    expect(notificationVerdict(row, CTX, sources, hideIN, index).reason).toBeNull();
    const both = world([carol, user({ userId: "14", screenName: "raj", location: "Delhi, India" })]);
    const row2 = mount(likeRow(`<a href="/carol">carol</a><a href="/raj">raj</a>`));
    expect(notificationVerdict(row2, CTX, both, hideIN, index).reason).toContain("India");
  });

  it("reads legacy rows that link /i/user/<id>", () => {
    const sources = world([carol]);
    const row = mount(`<div data-testid="cellInnerDiv"><a href="/i/user/10">x</a> followed you</div>`);
    expect(notificationVerdict(row, CTX, sources, hideIN, index).reason).toContain("India");
  });

  it("keys a row by the post and its actors", () => {
    const row = mount(likeRow(`<a href="/carol">carol</a><a href="/i/user/7">x</a>`));
    expect(cardKey(row, "notification")).toBe("n:5:carol,7");
  });
});

describe("userCellVerdict (C09)", () => {
  const cell = (handle: string) => mount(`<div data-testid="UserCell"><a href="/${handle}">${handle}</a></div>`);

  it("filters an account row only on a decided result", () => {
    const sources = world([carol, user({ userId: "40", screenName: "blank" })]);
    expect(userCellVerdict(cell("carol"), CTX, sources, hideIN, index).reason).toContain("India");
    expect(userCellVerdict(cell("blank"), CTX, sources, onlyNO, index).reason).toBeNull();
    expect(userCellVerdict(cell("nobody"), CTX, sources, onlyNO, index).reason).toBeNull();
    expect(userCellVerdict(cell("carol"), CTX, sources, onlyNO, index).reason).not.toBeNull();
  });

  it("hides account rows outright, without a label", () => {
    const sources = world([carol]);
    const verdict = userCellVerdict(cell("carol"), CTX, sources, hideIN, index);
    expect(paintFor(verdict, "user", onlyNO)).toMatchObject({ kind: "hide" });
    const highlight = parseSettings({ hiddenCountryCodes: ["IN"], markOnly: true }, NOW);
    expect(paintFor(verdict, "user", highlight)).toMatchObject({ kind: "mark", label: false, handle: null });
  });
});

describe("profileVerdict", () => {
  it("uses the About sheet for the profile being viewed", () => {
    const sources = world([user({ userId: "1", screenName: "alice" })]);
    const ctx = { ...CTX, about: { handle: "alice", basedIn: "Nigeria", connectedVia: null, locationAccurate: null } };
    expect(profileVerdict("alice", ctx, sources, hideNG, index).reason).toContain("Nigeria");
    expect(profileVerdict("me", ctx, sources, hideNG, index).reason).toBeNull();
  });
});

describe("paintFor", () => {
  const verdict = { reason: "outside · Norway", handle: "x", focal: false };

  it("collapses set-aside posts in Only show and hides them in Hide", () => {
    expect(paintFor(verdict, "tweet", onlyNO)).toEqual({ kind: "slim", reason: "outside · Norway" });
    expect(paintFor(verdict, "tweet", hideIN)).toEqual({ kind: "hide", reason: "outside · Norway" });
    expect(paintFor({ ...verdict, reason: null }, "tweet", hideIN)).toEqual({ kind: "none" });
  });
});
