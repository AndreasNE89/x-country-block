import { describe, expect, it } from "vitest";
import { defaultCountryIndex } from "../src/shared/countries.ts";
import {
  actionReason,
  allowListLabel,
  cardDecision,
  cardMatchReason,
  shouldHideCard,
  shouldHideTweet,
  tweetDecision,
  tweetMatchReason,
} from "../src/shared/match.ts";
import type { FilterMode, Settings, TweetRecord, UserRecord } from "../src/shared/types.ts";

const index = defaultCountryIndex();

function settings(
  picks: { countries?: string[]; languages?: string[]; regions?: string[] } = {},
  filterMode: FilterMode = "hide",
): Settings {
  return {
    enabled: true,
    hiddenCountryCodes: picks.countries ?? [],
    hiddenLanguageCodes: picks.languages ?? [],
    hiddenRegionIds: picks.regions ?? [],
    allowedHandles: [],
    markOnly: false,
    filterMode,
    onlyShowPaid: filterMode === "only",
    trialStartedAt: null,
    onlyShowUnlocked: filterMode === "only",
    trialExpired: false,
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

function reason(post: Partial<TweetRecord>, author: Partial<UserRecord> | undefined, s: Settings) {
  return actionReason(tweetDecision(tweet(post), author ? user(author) : undefined, s, index), s);
}

describe("languages (F24)", () => {
  it("matches X's legacy and region-tagged codes against the listed codes", () => {
    const picks = settings({ languages: ["id", "he", "ku", "zh", "hi", "pt", "en"] });
    for (const lang of ["in", "iw", "ckb", "zh-CN", "zh-TW", "hi-Latn", "pt-BR", "EN"]) {
      expect(shouldHideTweet(tweet({ lang }), undefined, picks, index), lang).toBe(true);
    }
  });

  it("matches old or differently cased picks too", () => {
    expect(shouldHideTweet(tweet({ lang: "no" }), undefined, settings({ languages: ["nb"] }), index)).toBe(true);
    expect(shouldHideTweet(tweet({ lang: "id" }), undefined, settings({ languages: ["in"] }), index)).toBe(true);
    expect(shouldHideTweet(tweet({ lang: "tl" }), undefined, settings({ languages: ["fil"] }), index)).toBe(true);
  });

  it("names the language in the reason", () => {
    expect(reason({ lang: "in" }, undefined, settings({ languages: ["id"] }))).toBe("Post language: Indonesian");
    expect(reason({ lang: "pt" }, undefined, settings({ languages: ["pt"] }))).toBe("Post language: Portuguese");
    expect(reason({ lang: "en" }, { lang: "hi" }, settings({ languages: ["hi"] }))).toBe(
      "Account language: Hindi",
    );
  });

  it("never hides a post for having no language", () => {
    for (const lang of ["zxx", "qme", "qam", "qht", "qct", "qst", "art", "und"]) {
      expect(shouldHideTweet(tweet({ lang }), undefined, settings({ languages: ["en"] }), index), lang).toBe(false);
    }
  });
});

describe("Focus mode (only show) (F29, C02)", () => {
  const onlyIndia = settings({ countries: ["IN"] }, "only");
  const onlyEnglish = settings({ languages: ["en"] }, "only");
  const onlyBoth = settings({ countries: ["NO"], languages: ["no"] }, "only");

  it("keeps proven matches", () => {
    expect(reason({ lang: "en" }, { basedIn: "India" }, onlyIndia)).toBeNull();
    expect(reason({ lang: "en" }, undefined, onlyEnglish)).toBeNull();
    expect(reason({ lang: "en" }, { location: "Oslo" }, onlyBoth)).toBeNull();
    expect(reason({ lang: "nb" }, { location: "Tokyo" }, onlyBoth)).toBeNull();
  });

  it("sets aside posts that are known not to match", () => {
    expect(reason({ lang: "en" }, { basedIn: "Japan" }, onlyIndia)).toBe("Not in your Focus picks");
    expect(reason({ lang: "ja" }, undefined, onlyEnglish)).toBe("Not in your Focus picks");
    expect(reason({ lang: "en" }, { location: "Tokyo" }, onlyBoth)).toBe("Not in your Focus picks");
  });

  it("sets aside unknown posts and says what is unknown", () => {
    expect(reason({ lang: "en" }, undefined, onlyIndia)).toBe("Not in your Focus picks (location unknown)");
    expect(reason({ lang: "en" }, { location: "Earth" }, onlyIndia)).toBe(
      "Not in your Focus picks (location unknown)",
    );
    expect(reason({ lang: null }, undefined, onlyEnglish)).toBe("Not in your Focus picks (language unknown)");
    expect(reason({ lang: null }, undefined, onlyBoth)).toBe(
      "Not in your Focus picks (location and language unknown)",
    );
  });

  it("keeps photo, link and emoji posts when only languages are ticked", () => {
    for (const lang of ["zxx", "qme", "qam", "qht", "art", "und"]) {
      expect(reason({ lang }, undefined, onlyEnglish), lang).toBeNull();
      expect(reason({ lang }, { location: "New York" }, onlyEnglish), lang).toBeNull();
    }
  });

  it("still uses what else is known about a post without language", () => {
    expect(reason({ lang: "zxx" }, { lang: "ja" }, onlyEnglish)).toBe("Not in your Focus picks");
    expect(reason({ lang: "zxx" }, { lang: "en" }, onlyEnglish)).toBeNull();
    expect(reason({ lang: "zxx" }, { location: "Tokyo" }, onlyBoth)).toBe("Not in your Focus picks");
    expect(reason({ lang: "zxx" }, undefined, onlyBoth)).toBe(
      "Not in your Focus picks (location and language unknown)",
    );
  });

  it("keeps flag-only and native-script locations in the picks (F25)", () => {
    expect(reason({ lang: "en" }, { location: "🇮🇳" }, onlyIndia)).toBeNull();
    expect(reason({ lang: "en" }, { location: "भारत" }, onlyIndia)).toBeNull();
  });

  it("keeps a region-only account whose app store names a picked country (F23)", () => {
    expect(
      reason({ lang: "en" }, { basedIn: "South Asia", connectedVia: "India Android App" }, onlyIndia),
    ).toBeNull();
  });
});

describe("author geography (F23)", () => {
  const hideIndia = settings({ countries: ["IN"] });

  it("refines a region-only 'based in' with a country inside that region", () => {
    expect(
      reason({ lang: "en" }, { basedIn: "South Asia", connectedVia: "India Android App" }, hideIndia),
    ).toBe("Connected via: India");
    expect(reason({ lang: "en" }, { basedIn: "South Asia", location: "Mumbai, India" }, hideIndia)).toBe(
      "Profile location: India",
    );
  });

  it("ignores later fields that point outside the region", () => {
    expect(
      reason({ lang: "en" }, { basedIn: "South Asia", location: "Tokyo" }, settings({ countries: ["JP"] })),
    ).toBeNull();
    expect(reason({ lang: "en" }, { basedIn: "Europe", location: "NYC" }, settings({ countries: ["US"] }))).toBeNull();
    expect(
      reason({ lang: "en" }, { basedIn: "South Asia", location: "Tokyo" }, settings({ regions: ["SOUTH_ASIA"] })),
    ).toBe("Account based in: South Asia (as shown by X)");
  });

  it("lets a country in 'based in' decide over the other fields", () => {
    expect(reason({ lang: "en" }, { basedIn: "United States", location: "Mumbai" }, hideIndia)).toBeNull();
    expect(reason({ lang: "en" }, { basedIn: "Georgia" }, settings({ countries: ["GE"] }))).toBe(
      "Account based in: Georgia (as shown by X)",
    );
  });
});

describe("region names in text (F22, F58)", () => {
  it("does not read America region names as the US", () => {
    const hideUs = settings({ countries: ["US"] });
    expect(reason({ lang: "en" }, { location: "South America" }, hideUs)).toBeNull();
    expect(reason({ lang: "en" }, { basedIn: "North America" }, hideUs)).toBeNull();
    expect(reason({ lang: "en" }, { basedIn: "Latin America & Caribbean" }, hideUs)).toBeNull();
    expect(reason({ lang: "en" }, { basedIn: "North America" }, settings({ regions: ["NORTH_AMERICA"] }))).toBe(
      "Account based in: North America (as shown by X)",
    );
  });

  it("does not hide heritage words as a region", () => {
    expect(reason({ lang: "en" }, { location: "Asian American, NYC" }, settings({ regions: ["ASIA"] }))).toBeNull();
    expect(reason({ lang: "en" }, { location: "Proud African | Houston" }, settings({ regions: ["AFRICA"] }))).toBeNull();
  });

  it("prefers a named place over a region word in the same text", () => {
    expect(
      reason({ lang: "en" }, { location: "Europe-based, Tokyo" }, settings({ regions: ["EUROPE"] })),
    ).toBeNull();
  });
});

describe("profile locations end to end (F04, F05, F19)", () => {
  it("does not hide ordinary words as a country", () => {
    expect(reason({ lang: "en" }, { location: "In the clouds" }, settings({ countries: ["IN"] }))).toBeNull();
    expect(reason({ lang: "en" }, { location: "LA" }, settings({ regions: ["ASIA"] }))).toBeNull();
    expect(reason({ lang: "en" }, { location: "follow me" }, settings({ countries: ["US"] }))).toBeNull();
  });

  it("reads 'City, IN' by the city", () => {
    expect(reason({ lang: "en" }, { location: "Jaipur, IN" }, settings({ countries: ["IN"] }))).toBe(
      "Profile location: India",
    );
    expect(reason({ lang: "en" }, { location: "Jaipur, IN" }, settings({ countries: ["US"] }))).toBeNull();
  });

  it("keeps an explicit country followed by filler", () => {
    expect(reason({ lang: "en" }, { location: "Lagos, Nigeria. Follow me" }, settings({ countries: ["NG"] }))).toBe(
      "Profile location: Nigeria",
    );
    expect(
      reason({ lang: "en" }, { location: "Karachi, Pakistan | Dallas, TX" }, settings({ countries: ["PK"] })),
    ).toBe("Profile location: Pakistan");
  });
});

describe("reason wording (F59)", () => {
  it("describes the field and the place in plain words", () => {
    expect(reason({ lang: "en" }, { basedIn: "Japan" }, settings({ countries: ["JP"] }))).toBe(
      "Account based in: Japan (as shown by X)",
    );
    expect(reason({ lang: "en" }, { location: "Mumbai" }, settings({ regions: ["SOUTH_ASIA"] }))).toBe(
      "Profile location: India, South Asia",
    );
    expect(reason({ lang: "en", place: "Paris, France" }, undefined, settings({ countries: ["FR"] }))).toBe(
      "Place: France",
    );
    expect(reason({ lang: "en" }, { connectedVia: "Japan App Store" }, settings({ countries: ["JP"] }))).toBe(
      "Connected via: Japan",
    );
  });

  it("never carries a brand prefix or raw codes", () => {
    const text = reason({ lang: "hi" }, undefined, settings({ languages: ["hi"] }));
    expect(text).toBe("Post language: Hindi");
    expect(text).not.toMatch(/Tamis|·/);
  });

  it("explains reposts and quotes", () => {
    const users = new Map<string, UserRecord>([
      ["outer", user({ userId: "outer", basedIn: "United Kingdom" })],
      ["inner", user({ userId: "inner", basedIn: "Nigeria" })],
    ]);
    const quote = tweet({ authorId: "outer", lang: "en", quoted: tweet({ tweetId: "2", authorId: "inner" }) });
    const repost = tweet({ authorId: "outer", lang: "en", retweeted: tweet({ tweetId: "3", authorId: "inner" }) });
    const hideNigeria = settings({ countries: ["NG"] });
    expect(cardMatchReason(quote, users, hideNigeria, index)).toBe(
      "Quotes a match: Account based in: Nigeria (as shown by X)",
    );
    expect(cardMatchReason(repost, users, hideNigeria, index)).toBe(
      "Repost of a match: Account based in: Nigeria (as shown by X)",
    );
    expect(shouldHideCard(repost, users, settings({ countries: ["NG"] }, "only"), index)).toBe(false);
    expect(cardDecision(tweet({ authorId: "outer", lang: "zxx" }), users, hideNigeria, index).hit).toBeNull();
  });
});

describe("allowListLabel", () => {
  it("shortens long lists and names languages", () => {
    expect(allowListLabel(settings({ countries: ["JP", "NO", "IN"], regions: ["AFRICA"], languages: ["hi"] }))).toBe(
      "Japan, Norway +3",
    );
    expect(allowListLabel(settings({ countries: ["IN"], languages: ["hi"] }))).toBe("India, Hindi");
    expect(allowListLabel(settings({ languages: ["iw"] }))).toBe("Hebrew");
    expect(allowListLabel(settings())).toBe("your Focus picks");
    expect(allowListLabel(settings({ countries: ["JP", "NO", "IN"] }), 3)).toBe("Japan, Norway, India");
  });
});

describe("tweetMatchReason", () => {
  it("returns the hit in both modes", () => {
    expect(tweetMatchReason(tweet({ lang: "ja" }), undefined, settings({ languages: ["ja"] }, "only"), index)).toBe(
      "Post language: Japanese",
    );
  });
});
