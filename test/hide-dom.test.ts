import { describe, expect, it } from "vitest";
import {
  findTweetArticles,
  setArticleHidden,
  tweetIdFromArticle,
  tweetIdFromHref,
} from "../src/shared/hide-dom.ts";

describe("tweetIdFromHref", () => {
  it("reads status ids", () => {
    expect(tweetIdFromHref("https://x.com/alice/status/111")).toBe("111");
    expect(tweetIdFromHref("/bob/status/222?s=20")).toBe("222");
    expect(tweetIdFromHref("/explore")).toBeNull();
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
