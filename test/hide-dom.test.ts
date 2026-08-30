import { describe, expect, it } from "vitest";
import {
  findNotificationRows,
  findTweetArticles,
  setArticleHidden,
  tweetIdFromArticle,
  tweetIdFromHref,
  userIdFromElement,
  userIdFromHref,
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
    expect(articles[0]!.style.display).toBe("none");
    setArticleHidden(articles[0]!, false);
    expect(articles[0]!.style.display).toBe("");
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
});
