import { describe, expect, it } from "vitest";
import {
  aboutSignalsFromText,
  aboutSignalsFromDocument,
  applyCardAction,
  applyCardMark,
  cardZone,
  layoutBox,
  measureCardZones,
  findNotificationRows,
  findProfileIdentity,
  findTweetArticles,
  handleFromProfileHeader,
  profileHeaderTexts,
  HIDE_ATTR,
  MARK_ATTR,
  MARK_LABEL_CLASS,
  screenNameFromPath,
  setArticleHidden,
  tweetIdFromArticle,
  tweetIdFromHref,
  userIdFromElement,
  userIdFromHref,
  visiblePlaceFromCard,
  visibleProfileLocation,
  visibleTranslatedFrom,
} from "../src/shared/hide-dom.ts";

describe("tweetIdFromHref", () => {
  it("reads status ids", () => {
    expect(tweetIdFromHref("https://x.com/alice/status/111")).toBe("111");
    expect(tweetIdFromHref("/bob/status/222?s=20")).toBe("222");
    expect(tweetIdFromHref("/explore")).toBeNull();
  });
});

describe("userIdFromHref", () => {
  it("should extract numeric ids from user links", () => {
    expect(userIdFromHref("https://x.com/i/user/333")).toBe("333");
    expect(userIdFromHref("/i/user/444?mx=2")).toBe("444");
    expect(userIdFromHref("/i/user/not-a-number")).toBeNull();
  });
});

describe("articles", () => {
  it("finds, hides, and restores a card", () => {
    document.body.innerHTML = `
      <article>
        <a href="/alice/status/111">link</a>
        <span>hello</span>
      </article>
      <div>not a tweet</div>
    `;
    const articles = findTweetArticles(document);
    expect(articles).toHaveLength(1);
    expect(tweetIdFromArticle(articles[0]!)).toBe("111");
    setArticleHidden(articles[0]!, true);
    expect(articles[0]!.getAttribute(HIDE_ATTR)).toBe("hidden");
    setArticleHidden(articles[0]!, false);
    expect(articles[0]!.getAttribute(HIDE_ATTR)).toBeNull();
  });

  it("should outline a match when markOnly is on", () => {
    document.body.innerHTML = `
      <article>
        <a href="/alice/status/111">link</a>
      </article>
    `;
    const article = findTweetArticles(document)[0]!;
    applyCardMark(article, "location · South Asia", true);
    expect(article.getAttribute(MARK_ATTR)).toBe("location · South Asia");
    expect(article.getAttribute(HIDE_ATTR)).toBeNull();
    expect(article.querySelector(`.${MARK_LABEL_CLASS}`)).toBeNull();
    applyCardMark(article, "location · South Asia", false);
    expect(article.getAttribute(HIDE_ATTR)).toBe("location · South Asia");
    expect(article.getAttribute(MARK_ATTR)).toBeNull();
    expect(article.style.display).toBe("none");
    applyCardMark(article, null, true);
    expect(article.getAttribute(MARK_ATTR)).toBeNull();
    expect(article.getAttribute(HIDE_ATTR)).toBeNull();
  });
});

describe("notification rows", () => {
  it("should find tweet and user-only notification rows", () => {
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv" id="tweet-row">
        <a href="/alice/status/111">tweet</a>
      </div>
      <div data-testid="cellInnerDiv" id="user-row">
        <a href="/i/user/333">user</a>
      </div>
      <div data-testid="cellInnerDiv" id="unknown-row">
        <a href="/explore">unknown</a>
      </div>
      <div data-testid="cellInnerDiv" id="timeline-row">
        <article><a href="/alice/status/222">wrapped</a></article>
      </div>
    `;

    expect(findNotificationRows(document).map((row) => row.id)).toEqual([
      "tweet-row",
      "user-row",
    ]);
  });

  it("should extract a cached user id from a notification row", () => {
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv">
        <a href="/i/user/333?mx=2">user</a>
      </div>
    `;

    const [row] = findNotificationRows(document);
    expect(row).toBeDefined();
    expect(userIdFromElement(row!)).toBe("333");
  });

  it("should hide only the article, not the timeline cell", () => {
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv" id="cell">
        <article><a href="/alice/status/111">link</a></article>
      </div>
    `;
    const article = findTweetArticles(document)[0]!;
    expect(layoutBox(article).id).toBe("cell");
    applyCardMark(article, "outside · India", false);
    expect(article.getAttribute(HIDE_ATTR)).toBe("outside · India");
    expect(document.getElementById("cell")?.style.display).not.toBe("none");
  });
});

describe("cardZone", () => {
  it("should hide in-view cards and only spare the fetch-more edge", () => {
    document.body.innerHTML = `<article id="card"><a href="/alice/status/111">link</a></article>`;
    const article = findTweetArticles(document)[0]!;
    article.getBoundingClientRect = () =>
      ({ top: -400, bottom: -40, height: 360, width: 100, left: 0, right: 100, x: 0, y: -400, toJSON() {} });
    expect(cardZone(article, 800)).toBe("above");
    applyCardAction(article, "outside · India", false, "above");
    expect(article.getAttribute(HIDE_ATTR)).toBe("outside · India");

    applyCardMark(article, null, true);
    article.getBoundingClientRect = () =>
      ({ top: 200, bottom: 400, height: 200, width: 100, left: 0, right: 100, x: 0, y: 200, toJSON() {} });
    applyCardAction(article, "outside · India", false, "visible");
    expect(article.getAttribute(HIDE_ATTR)).toBe("outside · India");

    applyCardMark(article, null, true);
    applyCardAction(article, "outside · India", false, "below");
    expect(article.getAttribute(HIDE_ATTR)).toBeNull();
    expect(article.getAttribute(MARK_ATTR)).toBeNull();

    applyCardAction(article, "outside · India", true, "visible");
    expect(article.getAttribute(MARK_ATTR)).toBe("outside · India");
    expect(article.getAttribute(HIDE_ATTR)).toBeNull();

    applyCardAction(article, "outside · India", false, "visible");
    applyCardAction(article, "outside · India", false, "below");
    expect(article.getAttribute(HIDE_ATTR)).toBe("outside · India");
  });

  it("should hide below-fold cards when only-show asks to hide below", () => {
    document.body.innerHTML = `<article id="card"><a href="/alice/status/111">link</a></article>`;
    const article = findTweetArticles(document)[0]!;
    applyCardAction(article, "outside · Africa", false, "below", true);
    expect(article.getAttribute(HIDE_ATTR)).toBe("outside · Africa");
  });

  it("should treat the last timeline cards as below the fold", () => {
    document.body.innerHTML = `
      <article id="a"><a href="/a/status/1">a</a></article>
      <article id="b"><a href="/b/status/2">b</a></article>
      <article id="c"><a href="/c/status/3">c</a></article>
      <article id="d"><a href="/d/status/4">d</a></article>
    `;
    const list = findTweetArticles(document);
    for (const el of list) {
      el.getBoundingClientRect = () =>
        ({ top: 100, bottom: 200, height: 100, width: 100, left: 0, right: 100, x: 0, y: 100, toJSON() {} });
    }
    expect(measureCardZones(list, 2)).toEqual(["visible", "visible", "below", "below"]);
    expect(measureCardZones(list.slice(0, 2), 3)).toEqual(["visible", "visible"]);
  });
});

describe("profile and about signals", () => {
  it("should read a profile handle and skip reserved paths", () => {
    expect(screenNameFromPath("/santoshkvkd")).toBe("santoshkvkd");
    expect(screenNameFromPath("/santoshkvkd/status/123")).toBe("santoshkvkd");
    expect(screenNameFromPath("/home")).toBeNull();
  });

  it("should ignore page text when no About sheet is open", () => {
    document.body.innerHTML = `<div>${"Account based in India ".repeat(200)}</div>`;
    expect(aboutSignalsFromDocument(document)).toEqual({
      basedIn: null,
      connectedVia: null,
    });
  });

  it("should parse About this account labels from the sheet text", () => {
    const text = `Date joined
June 2023
Account based in
India
1 username change
Last on June 2023
Connected via
India Android App`;
    expect(aboutSignalsFromText(text)).toEqual({
      basedIn: "India",
      connectedVia: "India Android App",
    });
  });

  it("should mark the profile identity block from header location text", () => {
    document.body.innerHTML = `
      <div data-testid="primaryColumn">
        <div id="header-card">
          <div data-testid="UserName"><span>Virendraa</span></div>
          <div data-testid="UserProfileHeader_Items">
            <span>Delhi, India</span>
            <span>Joined June 2016</span>
          </div>
        </div>
      </div>
    `;
    expect(visibleProfileLocation(document)).toBe("Delhi, India");
    const header = findProfileIdentity(document);
    expect(header?.id).toBe("header-card");
    applyCardMark(header!, "location · India", true);
    expect(header!.getAttribute(MARK_ATTR)).toBe("location · India");
    expect(header!.getAttribute(HIDE_ATTR)).toBeNull();
    expect(handleFromProfileHeader(document)).toBeNull();
    document.body.innerHTML = `
      <div data-testid="primaryColumn">
        <div data-testid="UserName"><span>Virendraa Sachdeva</span><span>@Virend_Sachdeva</span></div>
        <span>Delhi, India</span>
        <article><a href="/Virend_Sachdeva/status/1">x</a><span>ignore me</span></article>
      </div>
    `;
    expect(handleFromProfileHeader(document)).toBe("Virend_Sachdeva");
    expect(profileHeaderTexts(document)).toContain("Delhi, India");
    expect(profileHeaderTexts(document)).not.toContain("ignore me");
  });

  it("should read Translated from Hindi on a tweet card", () => {
    document.body.innerHTML = `
      <article>
        <a href="/Virend_Sachdeva/status/111">link</a>
        <span>Translated from Hindi Show original</span>
      </article>
    `;
    const article = findTweetArticles(document)[0]!;
    expect(visibleTranslatedFrom(article)).toBe("Hindi");
  });

  it("should read UserLocation and tweet geo from the card", () => {
    document.body.innerHTML = `
      <div>
        <span data-testid="UserLocation">Jabalpur, India</span>
        <article>
          <a href="/santoshkvkd/status/111">link</a>
          <a href="/santoshkvkd/status/111/places/1" data-testid="tweet-geo">India</a>
        </article>
      </div>
    `;
    expect(visibleProfileLocation(document)).toBe("Jabalpur, India");
    const article = findTweetArticles(document)[0]!;
    expect(visiblePlaceFromCard(article)).toBe("India");
  });
});
