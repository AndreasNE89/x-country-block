import { describe, expect, it } from "vitest";
import { defaultCountryIndex } from "../src/shared/countries.ts";
import { LANGUAGES, languageCodeFromName, languageName } from "../src/shared/languages.ts";
import { foldText } from "../src/shared/normalize.ts";
import {
  actionReason,
  countriesFromLocation,
  countryFromBasedIn,
  shouldHideCard,
  shouldHideTweet,
  tweetDecision,
  tweetMatchReason,
} from "../src/shared/match.ts";
import { regionsFromLocation } from "../src/shared/regions.ts";
import type { CountryIndex, FilterMode, Settings, TweetRecord, UserRecord } from "../src/shared/types.ts";

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

function settings(
  countries: string[] = [],
  languages: string[] = [],
  regions: string[] = [],
  filterMode: FilterMode = "hide",
): Settings {
  return {
    hiddenCountryCodes: countries,
    hiddenLanguageCodes: languages,
    hiddenRegionIds: regions,
    markOnly: true,
    filterMode,
    onlyShowPaid: filterMode === "only",
    trialStartedAt: null,
    onlyShowUnlocked: filterMode === "only",
  };
}

function tweet(partial: Partial<TweetRecord> = {}): TweetRecord {
  return {
    tweetId: "1",
    lang: null,
    authorId: "u1",
    place: null,
    quoted: null,
    retweeted: null,
    ...partial,
  };
}

function user(partial: Partial<UserRecord> = {}): UserRecord {
  return {
    userId: "u1",
    screenName: null,
    location: null,
    basedIn: null,
    connectedVia: null,
    lang: null,
    ...partial,
  };
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

  it("should not treat Mar-a-Lago as Morocco ISO3", () => {
    const real = defaultCountryIndex();
    expect(countriesFromLocation("Mar-a-Lago", real)).toEqual([]);
    expect(countriesFromLocation("MAR", real)).toEqual(["MA"]);
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

  it("should mark a profile that is based in India with Jabalpur location", () => {
    expect(
      tweetMatchReason(
        tweet({ lang: "en" }),
        user({
          basedIn: "India",
          connectedVia: "India Android App",
          location: "Jabalpur, India",
        }),
        settings(["IN"]),
        index,
      ),
    ).toBe("based in · India");
  });

  it("should mark connected-via text when based-in is missing", () => {
    expect(
      tweetMatchReason(
        tweet({ lang: "en" }),
        user({ connectedVia: "India Android App" }),
        settings(["IN"]),
        index,
      ),
    ).toBe("connected via · India");
  });

  it("should mark tweet place India", () => {
    expect(
      tweetMatchReason(tweet({ lang: "en", place: "Jabalpur, India" }), user(), settings(["IN"]), index),
    ).toBe("place · India");
  });

  it("should ignore vanity profile location and use About this account", () => {
    const real = defaultCountryIndex();
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ location: "Mar-a-Lago" }),
        settings(["US"]),
        real,
      ),
    ).toBe(false);
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ location: "Mar-a-Lago", basedIn: "United States" }),
        settings(["US"]),
        real,
      ),
    ).toBe(true);
    expect(
      tweetMatchReason(
        tweet({ lang: "en" }),
        user({ location: "Mar-a-Lago", basedIn: "United States" }),
        settings(["US"]),
        real,
      ),
    ).toBe("based in · United States");
  });

  it("does not hide English tweet when only a language is checked", () => {
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Mumbai" }), settings([], ["hi"]), index),
    ).toBe(false);
  });

  it("hides English tweet when the country is checked", () => {
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "India" }), settings(["IN"]), index),
    ).toBe(true);
  });

  it("does not invent a country when author is missing", () => {
    expect(shouldHideTweet(tweet({ lang: "en" }), undefined, settings(["US"]), index)).toBe(false);
  });

  it("should keep allow-list hits and hide the rest in only-show mode", () => {
    const onlyIndia = settings(["IN"], [], [], "only");
    expect(shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "India" }), onlyIndia, index)).toBe(
      false,
    );
    expect(shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "Japan" }), onlyIndia, index)).toBe(
      true,
    );
    expect(shouldHideTweet(tweet({ lang: "en" }), undefined, onlyIndia, index)).toBe(true);
    expect(
      actionReason(tweetDecision(tweet({ lang: "en" }), undefined, onlyIndia, index), onlyIndia),
    ).toBe("outside · India");
    expect(
      actionReason(
        tweetDecision(tweet({ lang: "en" }), user({ basedIn: "India" }), onlyIndia, index),
        onlyIndia,
      ),
    ).toBeNull();
  });

  it("should treat only-show as hide when Pro is locked", () => {
    const locked = {
      ...settings(["IN"], [], [], "only"),
      onlyShowPaid: false,
      onlyShowUnlocked: false,
    };
    expect(shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "Japan" }), locked, index)).toBe(
      false,
    );
    expect(shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "India" }), locked, index)).toBe(
      true,
    );
    expect(actionReason(tweetDecision(tweet({ lang: "en" }), undefined, locked, index), locked)).toBeNull();
  });

  it("should invert hide for only-show, including Boston MA vs Africa", () => {
    const real = defaultCountryIndex();
    const hideAfrica = settings([], [], ["AFRICA"]);
    const onlyAfrica = settings([], [], ["AFRICA"], "only");
    const boston = user({ basedIn: "United States" });
    const lagos = user({ basedIn: "Nigeria" });
    const toronto = user({ basedIn: "Canada" });
    const hideCanada = settings(["CA"]);
    const onlyCanada = settings(["CA"], [], [], "only");
    expect(shouldHideTweet(tweet({ lang: "en" }), boston, hideAfrica, real)).toBe(false);
    expect(shouldHideTweet(tweet({ lang: "en" }), boston, onlyAfrica, real)).toBe(true);
    expect(shouldHideTweet(tweet({ lang: "en" }), toronto, hideCanada, real)).toBe(true);
    expect(shouldHideTweet(tweet({ lang: "en" }), toronto, onlyCanada, real)).toBe(false);
    expect(shouldHideTweet(tweet({ lang: "en" }), toronto, hideAfrica, real)).toBe(false);
    expect(shouldHideTweet(tweet({ lang: "en" }), toronto, onlyAfrica, real)).toBe(true);
    expect(shouldHideTweet(tweet({ lang: "en" }), lagos, hideAfrica, index)).toBe(true);
    expect(shouldHideTweet(tweet({ lang: "en" }), lagos, onlyAfrica, index)).toBe(false);
    expect(tweetMatchReason(tweet({ lang: "en" }), boston, hideAfrica, real)).toBeNull();
  });

  it("should keep Africa posts and hide the rest in only-show mode", () => {
    const onlyAfrica = settings([], [], ["AFRICA"], "only");
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "Nigeria" }), onlyAfrica, index),
    ).toBe(false);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "Japan" }), onlyAfrica, index),
    ).toBe(true);
    expect(shouldHideTweet(tweet({ lang: "en" }), undefined, onlyAfrica, index)).toBe(true);
  });

  it("should hide unknown posts when only-show Americas is ticked", () => {
    const onlyAmericas = settings([], [], ["AMERICAS"], "only");
    const real = defaultCountryIndex();
    expect(shouldHideTweet(tweet({ lang: "en" }), undefined, onlyAmericas, real)).toBe(true);
    expect(shouldHideTweet(tweet({ lang: "en" }), user(), onlyAmericas, real)).toBe(true);
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ location: "Mar-a-Lago" }),
        onlyAmericas,
        real,
      ),
    ).toBe(true);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "United States" }), onlyAmericas, real),
    ).toBe(false);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "Japan" }), onlyAmericas, real),
    ).toBe(true);
  });

  it("should filter only-show Americas from profile location when based-in is missing", () => {
    const onlyAmericas = settings([], [], ["AMERICAS"], "only");
    const real = defaultCountryIndex();
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Boston, MA" }), onlyAmericas, real),
    ).toBe(false);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Toronto" }), onlyAmericas, real),
    ).toBe(false);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Mumbai" }), onlyAmericas, real),
    ).toBe(true);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Tokyo" }), onlyAmericas, real),
    ).toBe(true);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ location: "Mumbai" }), settings(["IN"]), index),
    ).toBe(true);
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ basedIn: "United States", location: "Mumbai" }),
        settings(["IN"]),
        real,
      ),
    ).toBe(false);
  });

  it("should show all in only-show mode when nothing is ticked", () => {
    const onlyEmpty = settings([], [], [], "only");
    expect(shouldHideTweet(tweet({ lang: "hi" }), user({ basedIn: "India" }), onlyEmpty, index)).toBe(
      false,
    );
    expect(shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "Japan" }), onlyEmpty, index)).toBe(
      false,
    );
    expect(shouldHideTweet(tweet({ lang: "en" }), undefined, onlyEmpty, index)).toBe(false);
    expect(actionReason(tweetDecision(tweet({ lang: "en" }), undefined, onlyEmpty, index), onlyEmpty)).toBeNull();
  });
});

describe("shouldHideCard", () => {
  const users = new Map<string, UserRecord>([
    ["outer", user({ userId: "outer", basedIn: "United Kingdom" })],
    ["inner", user({ userId: "inner", basedIn: "Nigeria" })],
    ["orig", user({ userId: "orig", basedIn: "Japan" })],
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

  it("should show all cards in only-show mode when nothing is ticked", () => {
    const onlyEmpty = settings([], [], [], "only");
    const card = tweet({
      authorId: "inner",
      lang: "hi",
      quoted: tweet({ tweetId: "2", authorId: "orig", lang: "ja" }),
    });
    expect(shouldHideCard(card, users, onlyEmpty, index)).toBe(false);
  });

  it("should hide a non-Africa parent in only-show even when it quoted Africa", () => {
    const onlyAfrica = settings([], [], ["AFRICA"], "only");
    const card = tweet({
      authorId: "outer",
      lang: "en",
      quoted: tweet({ tweetId: "2", authorId: "inner", lang: "en" }),
    });
    expect(shouldHideCard(card, users, onlyAfrica, index)).toBe(true);
  });

  it("should keep an Africa retweet in only-show", () => {
    const onlyAfrica = settings([], [], ["AFRICA"], "only");
    const card = tweet({
      authorId: "outer",
      lang: "en",
      retweeted: tweet({ tweetId: "3", authorId: "inner", lang: "en" }),
    });
    expect(shouldHideCard(card, users, onlyAfrica, index)).toBe(false);
  });
});

describe("defaultCountryIndex", () => {
  const real = defaultCountryIndex();

  it("maps several countries by name, city, and ISO3", () => {
    expect(countriesFromLocation("Brazil", real)).toEqual(["BR"]);
    expect(countriesFromLocation("São Paulo", real)).toEqual(["BR"]);
    expect(countriesFromLocation("DEU", real)).toEqual(["DE"]);
    expect(countriesFromLocation("Canada", real)).toEqual(["CA"]);
    expect(countriesFromLocation("Toronto", real)).toEqual(["CA"]);
    expect(countriesFromLocation("Toronto, ON", real)).toEqual(["CA"]);
    expect(countriesFromLocation("Toronto, Ontario", real)).toEqual(["CA"]);
    expect(countriesFromLocation("Toronto, Canada", real)).toEqual(["CA"]);
    expect(countriesFromLocation("New Mexico", real)).toEqual(["US"]);
    expect(countriesFromLocation("New Mexico", real)).not.toContain("MX");
    expect(countriesFromLocation("London, ON", real)).toEqual(["CA"]);
    expect(countriesFromLocation("India", real)).toEqual(["IN"]);
    expect(countriesFromLocation("Mumbai", real)).toEqual(["IN"]);
    expect(countriesFromLocation("Jabalpur, India", real)).toEqual(["IN"]);
    expect(countriesFromLocation("Jabalpur", real)).toEqual(["IN"]);
    expect(countriesFromLocation("Boston, MA", real)).toEqual(["US"]);
    expect(countriesFromLocation("Boston, MA", real)).not.toContain("MA");
    expect(countriesFromLocation("Casablanca, MA", real)).toEqual(["MA"]);
    expect(countriesFromLocation("from US", real)).toEqual(["US"]);
    expect(countriesFromLocation("MA", real)).toEqual(["MA"]);
  });

  it("lists every ISO2 in COUNTRY_NAMES as a hide target", async () => {
    const { COUNTRY_NAMES } = await import("../src/shared/countries.ts");
    expect(Object.keys(COUNTRY_NAMES).length).toBeGreaterThan(190);
    expect(COUNTRY_NAMES.IN).toBe("India");
    expect(COUNTRY_NAMES.US).toBe("United States");
    expect(COUNTRY_NAMES.NG).toBe("Nigeria");
  });
});

describe("regionsFromLocation", () => {
  it("maps South Asia text and not bare Asia to the subregion", () => {
    expect(regionsFromLocation("South Asia")).toEqual(
      expect.arrayContaining(["SOUTH_ASIA", "ASIA"]),
    );
    expect(regionsFromLocation("Asia")).toEqual(["ASIA"]);
    expect(regionsFromLocation("Asia")).not.toContain("SOUTH_ASIA");
  });

  it("maps West Asia and Middle East", () => {
    expect(regionsFromLocation("West Asia")).toEqual(
      expect.arrayContaining(["WEST_ASIA", "ASIA"]),
    );
    expect(regionsFromLocation("Middle East")).toEqual(
      expect.arrayContaining(["WEST_ASIA", "ASIA"]),
    );
  });

  it("does not treat Southeast Asia as East Asia", () => {
    const hits = regionsFromLocation("South East Asia");
    expect(hits).toContain("SOUTHEAST_ASIA");
    expect(hits).toContain("ASIA");
    expect(hits).not.toContain("EAST_ASIA");
  });
});

describe("shouldHideTweet regions", () => {
  it("hides South Asia based-in when the region is checked, not when only India is", () => {
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ basedIn: "South Asia" }),
        settings([], [], ["SOUTH_ASIA"]),
        index,
      ),
    ).toBe(true);
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ basedIn: "South Asia" }),
        settings(["IN"]),
        index,
      ),
    ).toBe(false);
  });

  it("does not hide bare Asia when only South Asia is checked", () => {
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ basedIn: "Asia" }),
        settings([], [], ["SOUTH_ASIA"]),
        index,
      ),
    ).toBe(false);
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ basedIn: "Asia" }),
        settings([], [], ["ASIA"]),
        index,
      ),
    ).toBe(true);
  });

  it("should name the matching region on South Asia based-in text", () => {
    expect(
      tweetMatchReason(
        tweet({ lang: "en" }),
        user({ basedIn: "South Asia" }),
        settings([], [], ["SOUTH_ASIA"]),
        index,
      ),
    ).toBe("based in · South Asia");
  });

  it("should hide when a country and a continent are both ticked", () => {
    const both = settings(["IN"], [], ["ASIA"]);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "India" }), both, index),
    ).toBe(true);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "Japan" }), both, index),
    ).toBe(true);
    expect(
      shouldHideTweet(tweet({ lang: "en" }), user({ basedIn: "United Kingdom" }), both, index),
    ).toBe(false);
    expect(
      tweetMatchReason(tweet({ lang: "en" }), user({ basedIn: "India" }), both, index),
    ).toBe("based in · India");
    expect(
      tweetMatchReason(tweet({ lang: "en" }), user({ basedIn: "Japan" }), both, index),
    ).toBe("based in · Japan · Asia");
  });

  it("hides India when South Asia is checked and Japan when Asia is checked", () => {
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ basedIn: "India" }),
        settings([], [], ["SOUTH_ASIA"]),
        index,
      ),
    ).toBe(true);
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ basedIn: "Japan" }),
        settings([], [], ["SOUTH_ASIA"]),
        index,
      ),
    ).toBe(false);
    expect(
      shouldHideTweet(
        tweet({ lang: "en" }),
        user({ basedIn: "Japan" }),
        settings([], [], ["ASIA"]),
        index,
      ),
    ).toBe(true);
  });
});

describe("LANGUAGES", () => {
  it("should map a visible language name to its code", () => {
    expect(languageCodeFromName("Hindi")).toBe("hi");
    expect(languageCodeFromName("English")).toBe("en");
  });

  it("includes common codes and is not Indic-only", () => {
    const codes = LANGUAGES.map((row) => row.code);
    expect(codes).toContain("en");
    expect(codes).toContain("es");
    expect(codes).toContain("zh");
    expect(codes).toContain("hi");
    expect(codes).toContain("ar");
    expect(codes.length).toBeGreaterThan(100);
    expect(languageName("hi")).toBe("Hindi");
  });
});
