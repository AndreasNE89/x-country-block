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

  it("should reject anything that is not a handle", () => {
    expect(handleFromInput("")).toBeNull();
    expect(handleFromInput("two words")).toBeNull();
    expect(handleFromInput("way_too_long_handle_x")).toBeNull();
    expect(handleFromInput("https://example.com/nasa")).toBeNull();
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
});

describe("removeHandle", () => {
  it("should remove the handle", () => {
    expect(removeHandle(["a", "b"], "a")).toEqual(["b"]);
    expect(removeHandle(["a"], "c")).toEqual(["a"]);
  });
});
