import { describe, expect, it } from "vitest";
import { isGraphqlUrl, requestUrl } from "../src/shared/graphql-url.ts";

describe("isGraphqlUrl", () => {
  it("should accept X GraphQL paths and reject other JSON", () => {
    expect(isGraphqlUrl("https://x.com/i/api/graphql/abc/UserTweets")).toBe(true);
    expect(isGraphqlUrl("https://api.x.com/graphql/HomeTimeline")).toBe(true);
    expect(isGraphqlUrl("https://x.com/i/api/1.1/jot/client_event.json")).toBe(false);
    expect(isGraphqlUrl("https://x.com/i/api/2/notifications.json")).toBe(false);
  });
});

describe("requestUrl", () => {
  it("should read a string or URL", () => {
    expect(requestUrl("https://x.com/i/api/graphql/x")).toContain("/graphql");
    expect(requestUrl(new URL("https://x.com/i/api/graphql/x"))).toContain("/graphql");
  });
});
