import { describe, expect, it } from "vitest";
import { PageCounter, pageKey } from "../src/content/page-counter.ts";

describe("PageCounter (F55)", () => {
  it("counts each post once, also after X unmounts its cell", () => {
    const counter = new PageCounter();
    counter.enterPage("/home");
    counter.track("t:1", true);
    counter.track("t:2", true);
    counter.track("t:1", true);
    expect(counter.count).toBe(2);
    // The cells are gone from the DOM; nothing un-tracks them, so the count holds.
    expect(counter.count).toBe(2);
  });

  it("forgets a post that is shown again", () => {
    const counter = new PageCounter();
    counter.track("t:1", true);
    counter.track("t:1", false);
    expect(counter.count).toBe(0);
  });

  it("starts over on a new route but not in the photo viewer", () => {
    const counter = new PageCounter();
    counter.enterPage("/alice/status/1");
    counter.track("t:1", true);
    expect(counter.enterPage("/alice/status/1/photo/2")).toBe(false);
    expect(counter.count).toBe(1);
    expect(counter.enterPage("/home")).toBe(true);
    expect(counter.count).toBe(0);
  });

  it("reports the count only when it changed", () => {
    const counter = new PageCounter();
    expect(counter.takeUpdate()).toBe(0);
    expect(counter.takeUpdate()).toBeNull();
    counter.track("t:1", true);
    expect(counter.takeUpdate()).toBe(1);
    expect(counter.takeUpdate()).toBeNull();
  });

  it("keys pages without the media viewer suffix", () => {
    expect(pageKey("/a/status/1/video/1")).toBe("/a/status/1");
    expect(pageKey("/home/")).toBe("/home");
    expect(pageKey("/")).toBe("/");
  });
});
