import { describe, expect, it } from "vitest";
import { foldText } from "../src/shared/normalize.ts";
import {
  countriesFromLocation,
  countryFromBasedIn,
  shouldHideCard,
  shouldHideTweet,
} from "../src/shared/match.ts";
import type { CountryIndex, Settings, TweetRecord, UserRecord } from "../src/shared/types.ts";

function testIndex(): CountryIndex {
  return {
    names: new Map([
      ["united states", "US"],
      ["usa", "US"],
      ["america", "US"],
      ["united kingdom", "GB"],
      ["uk", "GB"],
      ["britain", "GB"],
      ["india", "IN"],
      ["bharat", "IN"],
      ["nigeria", "NG"],
      ["japan", "JP"],
    ]),
    iso3: new Map([
      ["usa", "US"],
      ["gbr", "GB"],
      ["ind", "IN"],
      ["nga", "NG"],
      ["jpn", "JP"],
    ]),
    cities: new Map([
      ["new york", "US"],
      ["london", "GB"],
      ["mumbai", "IN"],
      ["lagos", "NG"],
      ["tokyo", "JP"],
    ]),
  };
}

const index = testIndex();

function settings(countries: string[] = [], languages: string[] = []): Settings {
  return { hiddenCountryCodes: countries, hiddenLanguageCodes: languages };
}

function tweet(partial: Partial<TweetRecord> = {}): TweetRecord {
  return {
    tweetId: "1",
    lang: null,
    authorId: "u1",
    quoted: null,
    retweeted: null,
    ...partial,
  };
}

function user(partial: Partial<UserRecord> = {}): UserRecord {
  return { userId: "u1", location: null, basedIn: null, lang: null, ...partial };
}

describe("foldText", () => {
  it("lowercases and strips punctuation", () => {
    expect(foldText("  Lagos, Nigeria! ")).toBe("lagos nigeria");
  });
});

describe("countriesFromLocation", () => {
  it("returns empty for blank text", () => {
    expect(countriesFromLocation(" ", index)).toEqual([]);
  });

  it("matches country names for several countries", () => {
    expect(countriesFromLocation("United States", index)).toEqual(["US"]);
    expect(countriesFromLocation("United Kingdom", index)).toEqual(["GB"]);
    expect(countriesFromLocation("Nigeria", index)).toEqual(["NG"]);
    expect(countriesFromLocation("Japan", index)).toEqual(["JP"]);
    expect(countriesFromLocation("India", index)).toEqual(["IN"]);
  });

  it("matches aliases", () => {
    expect(countriesFromLocation("USA", index)).toEqual(["US"]);
    expect(countriesFromLocation("UK", index)).toEqual(["GB"]);
    expect(countriesFromLocation("Bharat", index)).toEqual(["IN"]);
  });

  it("matches ISO2 and ISO3 as whole words", () => {
    expect(countriesFromLocation("from US", index)).toEqual(["US"]);
    expect(countriesFromLocation("IND", index)).toEqual(["IN"]);
    expect(countriesFromLocation("NGA", index)).toEqual(["NG"]);
  });

  it("does not match ISO2 inside another word", () => {
    expect(countriesFromLocation("INDUSTRY", index)).toEqual([]);
  });

  it("matches major cities", () => {
    expect(countriesFromLocation("New York", index)).toEqual(["US"]);
    expect(countriesFromLocation("London", index)).toEqual(["GB"]);
    expect(countriesFromLocation("Mumbai", index)).toEqual(["IN"]);
    expect(countriesFromLocation("Lagos", index)).toEqual(["NG"]);
  });

  it("can return more than one country from mixed text", () => {
    expect(new Set(countriesFromLocation("Lagos / London", index))).toEqual(
      new Set(["NG", "GB"]),
    );
  });
});

describe("countryFromBasedIn", () => {
  it("maps a based-in label to one country", () => {
    expect(countryFromBasedIn("India", index)).toBe("IN");
    expect(countryFromBasedIn("United States", index)).toBe("US");
  });

  it("returns null when unknown", () => {
    expect(countryFromBasedIn("Earth", index)).toBeNull();
  });
});

describe("shouldHideTweet", () => {
  it("hides nothing when lists are empty", () => {
    expect(
      shouldHideTweet(tweet({ lang: "hi" }), user({ location: "Mumbai" }), settings(), index),
    ).toBe(false);
  });

  it("hides on tweet language", () => {
    expect(
      shouldHideTweet(tweet({ lang: "hi" }), user(), settings([], ["hi"]), index),
    ).toBe(true);
  });

  it("hides on account language", () => {
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ lang: "ta" }), settings([], ["ta"]), index),
    ).toBe(true);
  });

  it("hides on based-in country", () => {
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "Nigeria" }), settings(["NG"]), index),
    ).toBe(true);
  });

  it("hides on profile location city", () => {
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Tokyo" }), settings(["JP"]), index),
    ).toBe(true);
  });

  it("does not hide English tweet when only a language is checked", () => {
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Mumbai" }), settings([], ["hi"]), index),
    ).toBe(false);
  });

  it("hides English tweet when the country is checked", () => {
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Mumbai" }), settings(["IN"]), index),
    ).toBe(true);
  });

  it("does not invent a country when author is missing", () => {
    expect(shouldHideTweet(tweet({ lang: "en" }), undefined, settings(["US"]), index)).toBe(false);
  });
});

describe("shouldHideCard", () => {
  const users = new Map<string, UserRecord>([
    ["outer", user({ userId: "outer", location: "London" })],
    ["inner", user({ userId: "inner", location: "Lagos" })],
    ["orig", user({ userId: "orig", location: "Tokyo" })],
  ]);

  it("hides when quoted inner matches", () => {
    const card = tweet({
      authorId: "outer",
      lang: "en",
      quoted: tweet({ tweetId: "2", authorId: "inner", lang: "en" }),
    });
    expect(shouldHideCard(card, users, settings(["NG"]), index)).toBe(true);
  });

  it("hides retweet using original author", () => {
    const card = tweet({
      authorId: "outer",
      lang: "en",
      retweeted: tweet({ tweetId: "3", authorId: "orig", lang: "ja" }),
    });
    expect(shouldHideCard(card, users, settings(["JP"]), index)).toBe(true);
  });

  it("keeps parent when only a reply would match (caller passes the reply card)", () => {
    const parent = tweet({ authorId: "outer", lang: "en" });
    expect(shouldHideCard(parent, users, settings(["NG"]), index)).toBe(false);
  });
});
