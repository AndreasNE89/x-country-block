import { describe, expect, it } from "vitest";
import { addHandle, handleFromInput, removeHandle } from "../src/popup/accounts.ts";

describe("handleFromInput", () => {
  it("should accept @handles, bare handles and profile links", () => {
    expect(handleFromInput("@Jack")).toBe("jack");
    expect(handleFromInput(" some_user ")).toBe("some_user");
    expect(handleFromInput("https://x.com/NASA")).toBe("nasa");
    expect(handleFromInput("x.com/nasa/status/123")).toBe("nasa");
    expect(handleFromInput("https://twitter.com/nasa?lang=en")).toBe("nasa");
  });

  it("should accept http links to X", () => {
    expect(handleFromInput("http://x.com/jack")).toBe("jack");
    expect(handleFromInput("http://twitter.com/jack")).toBe("jack");
    expect(handleFromInput("HTTP://X.COM/jack")).toBe("jack");
  });

  it("should reject anything that is not a handle", () => {
    expect(handleFromInput("")).toBeNull();
    expect(handleFromInput("two words")).toBeNull();
    expect(handleFromInput("way_too_long_handle_x")).toBeNull();
    expect(handleFromInput("https://example.com/nasa")).toBeNull();
    expect(handleFromInput("http://example.com/nasa")).toBeNull();
  });

  it("should reject X links that are not a profile or a post", () => {
    for (const link of [
      "x.com/home",
      "https://x.com/i/lists/1",
      "https://x.com/i/web/status/1",
      "https://x.com/i/status/123",
      "https://x.com/search?q=a",
      "https://x.com/explore",
      "https://twitter.com/settings/account",
      "https://x.com/notifications",
      "https://x.com/messages",
      "https://x.com/hashtag/cats",
      "https://x.com/compose/post",
      "https://x.com/i/communities/123",
      "https://x.com/verified-choose",
      "https://x.com/",
    ]) {
      expect(handleFromInput(link), link).toBeNull();
    }
  });

  it("should still take a typed name as a handle, even one X also uses as a path", () => {
    // Only links are checked against X's routes: a typed name is the user's explicit choice.
    expect(handleFromInput("@premium")).toBe("premium");
    expect(handleFromInput("home")).toBe("home");
  });
});

describe("addHandle", () => {
  it("should add a normalized handle", () => {
    expect(addHandle(["nasa"], "@Jack")).toEqual({ ok: true, handle: "jack", handles: ["nasa", "jack"] });
  });

  it("should explain why a handle was not added", () => {
    expect(addHandle([], "not a handle")).toEqual({
      ok: false,
      error: "Type an X handle, like @name.",
    });
    expect(addHandle(["jack"], "@JACK")).toEqual({ ok: false, error: "@jack is already on the list." });
  });

  it("should say when a pasted X link is not a profile", () => {
    expect(addHandle([], "https://x.com/home")).toEqual({
      ok: false,
      error: "That link is not a profile or a post. Paste one of those, or type @name.",
    });
  });
});

describe("removeHandle", () => {
  it("should remove the handle", () => {
    expect(removeHandle(["a", "b"], "a")).toEqual(["b"]);
    expect(removeHandle(["a"], "c")).toEqual(["a"]);
  });
});
