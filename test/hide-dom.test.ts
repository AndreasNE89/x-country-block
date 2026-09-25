import { describe, expect, it } from "vitest";
import {
  aboutRouteHandle,
  aboutSheetSignals,
  ALLOW_ATTR,
  brandReason,
  clearAllPaint,
  ensureMarkStyles,
  findNotificationRows,
  findProfileIdentity,
  findTweetArticles,
  findUserCells,
  focalTweetId,
  handleFromProfileHeader,
  HIDE_ATTR,
  HIGHLIGHT_COLOR,
  isPainted,
  KEY_ATTR,
  layoutBox,
  MARK_ATTR,
  MARK_CSS,
  MARK_LABEL_CLASS,
  notificationActors,
  paintCard,
  profileHandleFromHref,
  profileHeaderTexts,
  screenNameFromPath,
  SLIM_ATTR,
  syncThemeFlag,
  tweetIdFromArticle,
  tweetIdFromHref,
  userCellHandle,
  userIdFromElement,
  userIdFromHref,
  viewerHandle,
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

describe("paintCard", () => {
  function card(): HTMLElement {
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv" id="cell">
        <article><a href="/alice/status/111">link</a><span>hello</span></article>
      </div>`;
    return findTweetArticles(document)[0]!;
  }

  it("hides, restores and remembers what it decided for", () => {
    const article = card();
    expect(tweetIdFromArticle(article)).toBe("111");
    expect(paintCard(article, { kind: "hide", reason: "location · India" }, "t:111")).toBe(true);
    expect(article.getAttribute(HIDE_ATTR)).toBe("location · India");
    expect(article.getAttribute(KEY_ATTR)).toBe("t:111");
    expect(article.style.display).toBe("none");
    expect(article.getAttribute("title")).toBe("Tamis · location · India");
    expect(document.getElementById("cell")?.style.display).not.toBe("none");
    expect(paintCard(article, { kind: "hide", reason: "location · India" }, "t:111")).toBe(false);
    expect(isPainted(article, { kind: "hide", reason: "location · India" }, "t:222")).toBe(false);
    paintCard(article, { kind: "none" }, "t:111");
    expect(article.getAttribute(HIDE_ATTR)).toBeNull();
    expect(article.getAttribute(KEY_ATTR)).toBeNull();
    expect(article.getAttribute("title")).toBeNull();
    expect(article.style.display).toBe("");
  });

  it("outlines a match in Highlight mode with a label and an Always show button (F32)", () => {
    const article = card();
    paintCard(article, { kind: "mark", reason: "Post language: Hindi", handle: "Carol", label: true }, "t:111");
    expect(article.getAttribute(MARK_ATTR)).toBe("Post language: Hindi");
    expect(article.getAttribute(HIDE_ATTR)).toBeNull();
    const label = article.querySelector(`.${MARK_LABEL_CLASS}`);
    expect(label?.textContent).toContain("Tamis · Post language: Hindi");
    expect(label?.querySelector(`[${ALLOW_ATTR}]`)?.getAttribute(ALLOW_ATTR)).toBe("Carol");
    expect(label?.querySelector("button")?.textContent).toBe("Always show @Carol");
    const css = document.getElementById("xcb-mark-style")?.textContent ?? "";
    expect(css).toContain(`outline:2px solid ${HIGHLIGHT_COLOR}`);
    expect(css).not.toContain("#c23b22");
    expect(HIGHLIGHT_COLOR).toBe("#B86E00");
    // X's post <article> lays its children out in a row: the label must wrap onto its own full
    // line under the post, not become a column beside it (checked in Chrome on X's classes).
    expect(css).toContain(`[${MARK_ATTR}]:has(>.${MARK_LABEL_CLASS}){flex-wrap:wrap!important}`);
    expect(css).toMatch(new RegExp(`\\.${MARK_LABEL_CLASS}\\{[^}]*flex:none;[^}]*width:calc\\(100% - 24px\\)`));
    // Repainting the same state touches nothing; switching to hide removes the label.
    expect(paintCard(article, { kind: "mark", reason: "Post language: Hindi", handle: "Carol", label: true }, "t:111")).toBe(false);
    paintCard(article, { kind: "hide", reason: "Post language: Hindi" }, "t:111");
    expect(article.querySelector(`.${MARK_LABEL_CLASS}`)).toBeNull();
    expect(article.getAttribute(MARK_ATTR)).toBeNull();
  });

  it("does not double the brand prefix", () => {
    expect(brandReason("Tamis · Not in your Focus picks")).toBe("Tamis · Not in your Focus picks");
    expect(brandReason("outside · Norway")).toBe("Tamis · outside · Norway");
  });

  it("collapses a set-aside post to a slim row instead of removing it (C07)", () => {
    const article = card();
    paintCard(article, { kind: "slim", reason: "outside · Norway" }, "t:111");
    expect(article.getAttribute(HIDE_ATTR)).toBe("outside · Norway");
    expect(article.hasAttribute(SLIM_ATTR)).toBe(true);
    expect(article.style.display).toBe("");
    const css = document.getElementById("xcb-mark-style")?.textContent ?? "";
    expect(css).toContain(`[${HIDE_ATTR}]:not([${SLIM_ATTR}]){display:none!important}`);
    expect(css).toContain(`[${SLIM_ATTR}]::before{content:attr(title)`);
    paintCard(article, { kind: "hide", reason: "outside · Norway" }, "t:111");
    expect(article.hasAttribute(SLIM_ATTR)).toBe(false);
    expect(article.style.display).toBe("none");
  });

  it("clears every paint on the page", () => {
    const article = card();
    paintCard(article, { kind: "mark", reason: "x", handle: null, label: true }, "t:111");
    expect(clearAllPaint(document)).toBe(1);
    expect(isPainted(article, { kind: "none" }, null)).toBe(true);
    expect(document.querySelector(`.${MARK_LABEL_CLASS}`)).toBeNull();
  });

  it("replaces the stylesheet an earlier build left in the tab (R39)", () => {
    // 0.1.2's sheet, left behind when Firefox updates the add-on under an open tab.
    for (const old of document.querySelectorAll("#xcb-mark-style")) old.remove();
    const old = document.createElement("style");
    old.id = "xcb-mark-style";
    old.textContent = `[${HIDE_ATTR}]{display:none!important}[${MARK_ATTR}]{outline:2px solid #c23b22!important}`;
    document.head.append(old);
    paintCard(card(), { kind: "slim", reason: "Not in your Focus picks" }, "t:111");
    const sheets = document.querySelectorAll("#xcb-mark-style");
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.textContent).toBe(MARK_CSS);
    // With create false only a stale sheet is updated; none is added.
    sheets[0]!.remove();
    ensureMarkStyles(document, false);
    expect(document.getElementById("xcb-mark-style")).toBeNull();
    ensureMarkStyles(document);
    expect(document.getElementById("xcb-mark-style")?.textContent).toBe(MARK_CSS);
  });

  it("drops the separator of a hidden post's timeline cell, not of a slim row (R14)", () => {
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv"><div id="hidden-wrap"><div><article id="hidden"><a href="/a/status/1">x</a></article></div></div></div>
      <div data-testid="cellInnerDiv"><div id="slim-wrap"><div><article id="slim"><a href="/a/status/2">x</a></article></div></div></div>
      <div data-testid="cellInnerDiv"><div id="shown-wrap"><div><article><a href="/a/status/3">x</a></article></div></div></div>`;
    paintCard(document.getElementById("hidden")!, { kind: "hide", reason: "r" }, "t:1");
    paintCard(document.getElementById("slim")!, { kind: "slim", reason: "r" }, "t:2");
    const rule = MARK_CSS.split("}").find((r) => r.includes("border-bottom-width:0"))!;
    const selector = rule.slice(0, rule.indexOf("{"));
    expect([...document.querySelectorAll(selector)].map((el) => el.id)).toEqual(["hidden-wrap"]);
  });

  it("flags X's dark themes for the slim row text", () => {
    document.body.style.backgroundColor = "rgb(21, 32, 43)";
    syncThemeFlag(document);
    expect(document.documentElement.hasAttribute("data-xcb-dark")).toBe(true);
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    syncThemeFlag(document);
    expect(document.documentElement.hasAttribute("data-xcb-dark")).toBe(false);
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

  it("treats X's notification articles as notifications, not posts (F16)", () => {
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv">
        <article data-testid="notification" id="like">
          <a href="/carol"><img alt=""></a>
          <a href="/carol"><span>carol</span></a><span> liked your post</span>
          <a href="/me/status/5">your post</a>
          <div data-testid="tweetText"><a href="/dave">@dave</a> hello</div>
        </article>
      </div>
      <div data-testid="cellInnerDiv">
        <article data-testid="tweet"><a href="/erin/status/6">reply</a></article>
      </div>
    `;
    expect(findNotificationRows(document).map((row) => row.id)).toEqual(["like"]);
    expect(findTweetArticles(document).map((a) => tweetIdFromArticle(a))).toEqual(["6"]);
    const row = document.getElementById("like")!;
    expect(notificationActors(row, "me")).toEqual([{ userId: null, handle: "carol" }]);
  });

  it("leaves the signed-in account out of a notification's actors", () => {
    document.body.innerHTML = `
      <div data-testid="notification" id="row">
        <a href="/Me">me</a><a href="/i/user/42">x</a><a href="/carol">carol</a>
      </div>`;
    expect(notificationActors(document.getElementById("row")!, "me")).toEqual([
      { userId: "42", handle: null },
      { userId: null, handle: "carol" },
    ]);
  });

  it("should hide only the article, not the timeline cell", () => {
    document.body.innerHTML = `
      <div data-testid="cellInnerDiv" id="cell">
        <article><a href="/alice/status/111">link</a></article>
      </div>
    `;
    const article = findTweetArticles(document)[0]!;
    expect(layoutBox(article).id).toBe("cell");
    paintCard(article, { kind: "hide", reason: "outside · India" }, "t:111");
    expect(article.getAttribute(HIDE_ATTR)).toBe("outside · India");
    expect(document.getElementById("cell")?.style.display).not.toBe("none");
  });
});

describe("account rows (C09)", () => {
  it("finds UserCell rows and reads their handle from the profile link", () => {
    document.body.innerHTML = `
      <div data-testid="UserCell" id="cell">
        <a href="/i/flow/x">x</a>
        <a href="/Carol_1"><img alt=""></a>
        <span>Bio mentioning <a href="/dave">@dave</a></span>
      </div>`;
    const [cell] = findUserCells(document);
    expect(cell?.id).toBe("cell");
    expect(userCellHandle(cell!)).toBe("Carol_1");
  });
});

describe("page context", () => {
  it("reads the signed-in handle from the navigation (F17)", () => {
    document.body.innerHTML = `<nav><a data-testid="AppTabBar_Profile_Link" href="/Me_Myself">Profile</a></nav>`;
    expect(viewerHandle(document)).toBe("Me_Myself");
    document.body.innerHTML = `<div data-testid="SideNav_AccountSwitcher_Button"><span>Me</span><span>@me_too</span></div>`;
    expect(viewerHandle(document)).toBe("me_too");
    document.body.innerHTML = "";
    expect(viewerHandle(document)).toBeNull();
  });

  it("reads the focal post id of a /status/ page", () => {
    expect(focalTweetId("/rahul/status/100")).toBe("100");
    expect(focalTweetId("/rahul/status/100/photo/1")).toBe("100");
    expect(focalTweetId("/i/web/status/7")).toBe("7");
    expect(focalTweetId("/home")).toBeNull();
  });

  it("reads profile links only when they point at a profile", () => {
    expect(profileHandleFromHref("/carol")).toBe("carol");
    expect(profileHandleFromHref("https://x.com/carol/")).toBe("carol");
    expect(profileHandleFromHref("/carol/status/1")).toBeNull();
    expect(profileHandleFromHref("/home")).toBeNull();
    expect(profileHandleFromHref("/i/user/1")).toBeNull();
  });
});

describe("About sheet (C01)", () => {
  // React renders label and value as separate elements with no whitespace between them.
  const sheet = (handle: string, extra = "") => `
    <div role="dialog"><div data-testid="sheetDialog">
      <div><span>Alice</span><span>@${handle}</span></div>
      <div><div><span>Date joined</span></div><div><span>June 2023</span></div></div>
      <div><svg><path></path></svg><div><span>Account based in</span></div><div><span>India</span></div></div>
      <div><div><span>Connected via</span></div><div><span>India Android App</span></div></div>
      ${extra}
    </div></div>`;

  it("reads X's own About sheet on /<handle>/about", () => {
    document.body.innerHTML = sheet("alice");
    expect(aboutSheetSignals(document, "/alice/about")).toEqual({
      handle: "alice",
      basedIn: "India",
      connectedVia: "India Android App",
      locationAccurate: null,
    });
  });

  it("notes X's own accuracy warning", () => {
    document.body.innerHTML = sheet("alice", "<span>Country or region may not be accurate</span>");
    expect(aboutSheetSignals(document, "/alice/about")?.locationAccurate).toBe(false);
  });

  it("ignores the sheet on any other route", () => {
    document.body.innerHTML = sheet("alice");
    expect(aboutSheetSignals(document, "/alice/status/111/photo/1")).toBeNull();
    expect(aboutSheetSignals(document, "/compose/post")).toBeNull();
    expect(aboutRouteHandle("/home/about")).toBeNull();
  });

  it("ignores a sheet for another account", () => {
    document.body.innerHTML = sheet("bob");
    expect(aboutSheetSignals(document, "/alice/about")).toBeNull();
  });

  it("never reads posts or drafts, even ones quoting the label", () => {
    document.body.innerHTML = `
      <div role="dialog">
        <span>@alice</span>
        <article><div data-testid="tweetText"><span>Account based in</span><span>Nigeria lol</span></div></article>
      </div>`;
    expect(aboutSheetSignals(document, "/alice/about")).toBeNull();
    document.body.innerHTML = `
      <div role="dialog">
        <span>@alice</span>
        <div role="textbox" contenteditable="true"><span>Account based in</span><span>Nigeria?</span></div>
      </div>`;
    expect(aboutSheetSignals(document, "/alice/about")).toBeNull();
  });

  it("does not take the next label as a value", () => {
    document.body.innerHTML = `
      <div role="dialog"><span>@alice</span>
        <div><span>Account based in</span></div><div><span>Connected via</span></div>
        <div><span>Web App</span></div>
      </div>`;
    expect(aboutSheetSignals(document, "/alice/about")).toEqual({
      handle: "alice",
      basedIn: null,
      connectedVia: "Web App",
      locationAccurate: null,
    });
  });
});

describe("profile header", () => {
  it("should read a profile handle and skip reserved paths", () => {
    expect(screenNameFromPath("/santoshkvkd")).toBe("santoshkvkd");
    expect(screenNameFromPath("/santoshkvkd/status/123")).toBe("santoshkvkd");
    expect(screenNameFromPath("/home")).toBeNull();
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
    paintCard(header!, { kind: "mark", reason: "location · India", handle: null, label: false }, "p:v");
    expect(header!.getAttribute(MARK_ATTR)).toBe("location · India");
    expect(header!.getAttribute(HIDE_ATTR)).toBeNull();
    expect(header!.querySelector(`.${MARK_LABEL_CLASS}`)).toBeNull();
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
