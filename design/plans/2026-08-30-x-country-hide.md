# X Country Hide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Chrome + Firefox MV3 extension that hides x.com / twitter.com posts matching user-selected countries and languages.

**Architecture:** Popup writes `chrome.storage.local`. A MAIN-world hook wraps `fetch` / `XMLHttpRequest`, walks GraphQL JSON X already sent, and `postMessage`s tweet/user records. An isolated content script caches authors, matches with a shared any-country index, and hides cards with `display: none`.

**Tech Stack:** TypeScript, Vitest, happy-dom, esbuild, Manifest V3 (`chrome.storage`, content scripts, `world: MAIN`).

## Global Constraints

- Any ISO 3166-1 alpha-2 country and any ISO 639-1 language can be hidden. India is not special-cased in UI, settings, or match code.
- Defaults: `hiddenCountryCodes: []`, `hiddenLanguageCodes: []`. Empty = hide nothing. No first-run preset.
- Signals only: tweet lang, account lang, “account based in”, profile location (name / alias / ISO2 / ISO3 word / major city). No extra X requests.
- Hide with CSS `display: none`. Do not delete nodes. No placeholders. No badge. No sync. No spam scoring.
- Quote: hide card if outer or inner matches. Retweet: match original. Thread: hide matching replies only. Own tweets: same rules. Ads/notifications: hide when fields exist; else leave.
- Fail open: parse errors must not blank the timeline.
- Storage keys: `hiddenCountryCodes`, `hiddenLanguageCodes`, `userCache`.
- Hook messages: `{ source: "x-country-hide", type: "graphql", tweets, users }`.
- Hosts: `https://x.com/*`, `https://twitter.com/*`.
- No live x.com CI.

## File map

| Path | Responsibility |
| --- | --- |
| `package.json` | scripts: `test`, `build` |
| `tsconfig.json` | ES2022, bundler, strict |
| `vitest.config.ts` | happy-dom, `test/**/*.test.ts` |
| `.gitignore` | `node_modules`, `dist` |
| `src/shared/types.ts` | `Settings`, `UserRecord`, `TweetRecord`, `CountryIndex`, `HookMessage` |
| `src/shared/normalize.ts` | `foldText` |
| `src/shared/countries.ts` | ISO names, aliases, ISO3, cities, `buildCountryIndex`, `defaultCountryIndex` |
| `src/shared/languages.ts` | ISO 639-1 code → English label |
| `src/shared/match.ts` | `countriesFromLocation`, `countryFromBasedIn`, `shouldHideTweet`, `shouldHideCard` |
| `src/shared/settings.ts` | `emptySettings`, `parseSettings` |
| `src/shared/parse-graphql.ts` | `parseGraphQL` |
| `src/shared/cache.ts` | `UserCache` LRU |
| `src/shared/hide-dom.ts` | tweet id from article, hide/unhide |
| `src/hook/inject.ts` | MAIN-world fetch/XHR wrap |
| `src/content/main.ts` | storage, messages, observer |
| `src/popup/popup.html` | tabs + lists |
| `src/popup/popup.css` | popup layout |
| `src/popup/popup.ts` | checklist + storage |
| `manifest.json` | MV3 |
| `scripts/build.mjs` | esbuild + copy static |
| `README.md` | load-unpacked |
| `test/match.test.ts` | matcher |
| `test/parse-graphql.test.ts` | parser |
| `test/settings.test.ts` | settings |
| `test/cache.test.ts` | LRU |
| `test/hide-dom.test.ts` | DOM hide |
| `test/fixtures/timeline-tweet.json` | anonymized GraphQL |

---

### Task 1: Repo scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `test/scaffold.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` runs Vitest

- [ ] **Step 1: Write the failing test**

```ts
// test/scaffold.test.ts
import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL — `vitest` not found / `package.json` missing.

- [ ] **Step 3: Write scaffold files**

```json
{
  "name": "x-country-hide",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "node scripts/build.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.25.9",
    "happy-dom": "^18.0.1",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM"],
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
```

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 4: Install and run tests**

Run: `npm install` then `npm test`

Expected: PASS (`scaffold` 1 test).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore test/scaffold.test.ts
git commit -m "chore: add TypeScript and Vitest scaffold"
```

---

### Task 2: Types, normalize, match

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/normalize.ts`
- Create: `src/shared/match.ts`
- Create: `test/match.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `Settings`, `UserRecord`, `TweetRecord`, `CountryIndex`, `HookMessage`, `ParsedGraphQL`
  - `foldText(input: string): string`
  - `countriesFromLocation(text: string, index: CountryIndex): string[]`
  - `countryFromBasedIn(text: string, index: CountryIndex): string | null`
  - `shouldHideTweet(tweet: TweetRecord, author: UserRecord | undefined, settings: Settings, index: CountryIndex): boolean`
  - `shouldHideCard(tweet: TweetRecord, users: Map<string, UserRecord>, settings: Settings, index: CountryIndex): boolean`
  - `emptyTweet(partial?: Partial<TweetRecord>): TweetRecord`
  - `emptyUser(partial?: Partial<UserRecord>): UserRecord`

- [ ] **Step 1: Write the failing tests**

```ts
// test/match.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/match.test.ts`

Expected: FAIL — `Cannot find module '../src/shared/normalize.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/types.ts
export type Settings = {
  hiddenCountryCodes: string[];
  hiddenLanguageCodes: string[];
};

export type UserRecord = {
  userId: string;
  location: string | null;
  basedIn: string | null;
  lang: string | null;
};

export type TweetRecord = {
  tweetId: string;
  lang: string | null;
  authorId: string | null;
  quoted: TweetRecord | null;
  retweeted: TweetRecord | null;
};

export type CountryIndex = {
  names: Map<string, string>;
  iso3: Map<string, string>;
  cities: Map<string, string>;
};

export type ParsedGraphQL = {
  tweets: TweetRecord[];
  users: UserRecord[];
};

export type HookMessage = {
  source: "x-country-hide";
  type: "graphql";
  tweets: TweetRecord[];
  users: UserRecord[];
};
```

```ts
// src/shared/normalize.ts
export function foldText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
```

```ts
// src/shared/match.ts
import { foldText } from "./normalize.ts";
import type { CountryIndex, Settings, TweetRecord, UserRecord } from "./types.ts";

const ISO2 = /^[a-z]{2}$/;

export function countriesFromLocation(text: string, index: CountryIndex): string[] {
  const folded = foldText(text);
  if (!folded) return [];
  const hits = new Set<string>();
  const tokens = folded.split(" ");

  for (const [phrase, iso2] of index.names) {
    if (hasPhrase(folded, phrase)) hits.add(iso2);
  }
  for (const [phrase, iso2] of index.cities) {
    if (hasPhrase(folded, phrase)) hits.add(iso2);
  }
  for (const token of tokens) {
    if (ISO2.test(token)) {
      for (const iso2 of index.names.values()) {
        if (iso2.toLowerCase() === token) hits.add(iso2);
      }
    }
    const from3 = index.iso3.get(token);
    if (from3) hits.add(from3);
  }
  return [...hits];
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return (` ${haystack} `).includes(` ${phrase} `);
}

export function countryFromBasedIn(text: string, index: CountryIndex): string | null {
  const found = countriesFromLocation(text, index);
  return found[0] ?? null;
}

function hideFromAuthor(
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): boolean {
  if (!author) return false;
  if (author.lang && settings.hiddenLanguageCodes.includes(author.lang)) return true;
  if (author.basedIn) {
    const code = countryFromBasedIn(author.basedIn, index);
    if (code && settings.hiddenCountryCodes.includes(code)) return true;
  }
  if (author.location) {
    for (const code of countriesFromLocation(author.location, index)) {
      if (settings.hiddenCountryCodes.includes(code)) return true;
    }
  }
  return false;
}

export function shouldHideTweet(
  tweet: TweetRecord,
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): boolean {
  if (settings.hiddenCountryCodes.length === 0 && settings.hiddenLanguageCodes.length === 0) {
    return false;
  }
  if (tweet.lang && settings.hiddenLanguageCodes.includes(tweet.lang)) return true;
  return hideFromAuthor(author, settings, index);
}

export function shouldHideCard(
  tweet: TweetRecord,
  users: Map<string, UserRecord>,
  settings: Settings,
  index: CountryIndex,
): boolean {
  const author = tweet.authorId ? users.get(tweet.authorId) : undefined;
  if (shouldHideTweet(tweet, author, settings, index)) return true;
  if (tweet.quoted && shouldHideCard(tweet.quoted, users, settings, index)) return true;
  if (tweet.retweeted && shouldHideCard(tweet.retweeted, users, settings, index)) return true;
  return false;
}
```

ISO2 lookup must use the actual keys of `COUNTRY_NAMES` later. In this task, iterate `index.names.values()` as above so `us` token maps to `US`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/match.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/normalize.ts src/shared/match.ts test/match.test.ts
git commit -m "feat: match tweets by country location and language"
```

---

### Task 3: Country and language catalogs

**Files:**
- Create: `src/shared/countries.ts`
- Create: `src/shared/languages.ts`
- Modify: `test/match.test.ts` (add default-index cases)

**Interfaces:**
- Consumes: `CountryIndex` from `src/shared/types.ts`
- Produces:
  - `COUNTRY_NAMES: Record<string, string>` (ISO2 → English name, complete official set)
  - `COUNTRY_ALIASES: Record<string, string>` (folded alias → ISO2)
  - `COUNTRY_ISO3: Record<string, string>` (folded iso3 → ISO2)
  - `MAJOR_CITIES: Record<string, string>` (folded city → ISO2)
  - `buildCountryIndex(): CountryIndex`
  - `defaultCountryIndex(): CountryIndex`
  - `LANGUAGES: { code: string; name: string }[]` (ISO 639-1, sorted by name)
  - `languageName(code: string): string`

Do **not** hardcode a single country in `buildCountryIndex`. India aliases are rows next to USA/UK/Nigeria/Japan.

- [ ] **Step 1: Write the failing tests**

Append to `test/match.test.ts`:

```ts
import { defaultCountryIndex } from "../src/shared/countries.ts";
import { LANGUAGES, languageName } from "../src/shared/languages.ts";

describe("defaultCountryIndex", () => {
  const real = defaultCountryIndex();

  it("maps several countries by name, city, and ISO3", () => {
    expect(countriesFromLocation("Brazil", real)).toEqual(["BR"]);
    expect(countriesFromLocation("São Paulo", real)).toEqual(["BR"]);
    expect(countriesFromLocation("DEU", real)).toEqual(["DE"]);
    expect(countriesFromLocation("Canada", real)).toEqual(["CA"]);
    expect(countriesFromLocation("Toronto", real)).toEqual(["CA"]);
    expect(countriesFromLocation("India", real)).toEqual(["IN"]);
    expect(countriesFromLocation("Mumbai", real)).toEqual(["IN"]);
  });

  it("lists every ISO2 in COUNTRY_NAMES as a hide target", async () => {
    const { COUNTRY_NAMES } = await import("../src/shared/countries.ts");
    expect(Object.keys(COUNTRY_NAMES).length).toBeGreaterThan(190);
    expect(COUNTRY_NAMES.IN).toBe("India");
    expect(COUNTRY_NAMES.US).toBe("United States");
    expect(COUNTRY_NAMES.NG).toBe("Nigeria");
  });
});

describe("LANGUAGES", () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/match.test.ts`

Expected: FAIL — `countries.ts` missing.

- [ ] **Step 3: Write catalogs**

`src/shared/countries.ts` must contain:

1. `COUNTRY_NAMES`: every assigned ISO 3166-1 alpha-2 used as a country/territory, English short name. Include at least AD through ZW (standard list: US, GB, IN, NG, JP, BR, CA, DE, FR, ES, IT, MX, AU, CN, KR, PK, BD, ID, PH, VN, TH, EG, ZA, KE, GH, AR, CL, CO, PE, RU, TR, SA, AE, IL, IR, IQ, UA, PL, NL, SE, NO, DK, FI, IE, PT, GR, CZ, RO, HU, AT, CH, BE, NZ, SG, MY, LK, NP, MM, KH, LA, AF, … and remaining official codes). Names like `US: "United States"`, `GB: "United Kingdom"`, `IN: "India"`.
2. `COUNTRY_ISO3`: complete alpha-3 → alpha-2 (`usa→US`, `gbr→GB`, `ind→IN`, `nga→NG`, `jpn→JP`, `deu→DE`, `bra→BR`, …).
3. `COUNTRY_ALIASES`: common English aliases, not one region only. Required rows:
   - `usa`, `america`, `united states of america` → `US`
   - `uk`, `britain`, `great britain`, `england` → `GB`
   - `holland` → `NL`
   - `uae`, `u a e` → `AE`
   - `south korea`, `republic of korea` → `KR`
   - `north korea` → `KP`
   - `russia` → `RU`
   - `viet nam` → `VN`
   - `ivory coast` → `CI`
   - `czech republic`, `czechia` → `CZ`
   - `bharat`, `hindustan` → `IN`
   - `türkiye`, `turkiye` → `TR`
4. `MAJOR_CITIES`: large metros across regions (not India-only). Required mappings:
   - Americas: `new york`, `los angeles`, `chicago`, `toronto`, `mexico city`, `sao paulo`, `rio de janeiro`, `buenos aires`, `bogota`, `lima`
   - Europe: `london`, `paris`, `berlin`, `madrid`, `rome`, `amsterdam`, `stockholm`, `warsaw`, `kyiv`, `moscow`
   - Africa: `lagos`, `nairobi`, `cairo`, `johannesburg`, `accra`, `casablanca`
   - Asia: `mumbai`, `delhi`, `bengaluru`, `tokyo`, `osaka`, `seoul`, `beijing`, `shanghai`, `jakarta`, `manila`, `bangkok`, `karachi`, `dhaka`, `dubai`, `tehran`
   - Oceania: `sydney`, `melbourne`, `auckland`

```ts
// src/shared/countries.ts
import type { CountryIndex } from "./types.ts";
import { foldText } from "./normalize.ts";

export const COUNTRY_NAMES: Record<string, string> = {
  /* full ISO 3166-1 list — implement every official code, not a subset */
};

export const COUNTRY_ISO3: Record<string, string> = {
  /* full alpha-3 → alpha-2, keys already lowercase */
};

export const COUNTRY_ALIASES: Record<string, string> = {
  /* folded alias → ISO2 */
};

export const MAJOR_CITIES: Record<string, string> = {
  /* folded city → ISO2 */
};

export function buildCountryIndex(): CountryIndex {
  const names = new Map<string, string>();
  for (const [iso2, name] of Object.entries(COUNTRY_NAMES)) {
    names.set(foldText(name), iso2);
  }
  for (const [alias, iso2] of Object.entries(COUNTRY_ALIASES)) {
    names.set(foldText(alias), iso2);
  }
  const iso3 = new Map<string, string>();
  for (const [code, iso2] of Object.entries(COUNTRY_ISO3)) {
    iso3.set(foldText(code), iso2);
  }
  const cities = new Map<string, string>();
  for (const [city, iso2] of Object.entries(MAJOR_CITIES)) {
    cities.set(foldText(city), iso2);
  }
  return { names, iso3, cities };
}

let cached: CountryIndex | undefined;

export function defaultCountryIndex(): CountryIndex {
  cached ??= buildCountryIndex();
  return cached;
}
```

Fill the three records completely in this step. Do not leave comments instead of entries.

`src/shared/languages.ts`: array of `{ code, name }` for ISO 639-1 codes X uses and the rest of the standard 2-letter set (`aa`–`zu` where assigned). Sort by `name`. Include `en` English, `es` Spanish, `zh` Chinese, `ar` Arabic, `hi` Hindi, `ta` Tamil, `te` Telugu, `bn` Bengali, `ml` Malayalam, `mr` Marathi, `gu` Gujarati, `pa` Punjabi, `ur` Urdu, `kn` Kannada, `or` Odia, `fr` French, `de` German, `ja` Japanese, `ko` Korean, `pt` Portuguese, `ru` Russian, `tr` Turkish, `id` Indonesian, `vi` Vietnamese, `th` Thai, `pl` Polish, `nl` Dutch, `it` Italian, `sv` Swedish, `uk` Ukrainian, `fa` Persian, `he` Hebrew.

```ts
export const LANGUAGES: { code: string; name: string }[] = [/* full list, sorted by name */];

export function languageName(code: string): string {
  return LANGUAGES.find((row) => row.code === code)?.name ?? code;
}
```

Fix ISO2 whole-word matching in `countriesFromLocation` so it uses `COUNTRY_NAMES` keys: if `index` has a name whose value equals `token.toUpperCase()`, add it. After this task, `defaultCountryIndex()` must make `from US` → `US` because `US` is a `COUNTRY_NAMES` key. Update `match.ts` to accept ISO2 when `token.toUpperCase()` is a value in `index.names`:

```ts
const iso2 = token.toUpperCase();
for (const code of index.names.values()) {
  if (code === iso2) hits.add(code);
}
```

That already works if values are `US` and token is `us`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/match.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/countries.ts src/shared/languages.ts src/shared/match.ts test/match.test.ts
git commit -m "feat: add any-country and language catalogs"
```

---

### Task 4: GraphQL parser

**Files:**
- Create: `src/shared/parse-graphql.ts`
- Create: `test/parse-graphql.test.ts`
- Create: `test/fixtures/timeline-tweet.json`

**Interfaces:**
- Consumes: `TweetRecord`, `UserRecord`, `ParsedGraphQL`
- Produces: `parseGraphQL(payload: unknown): ParsedGraphQL`

Fail open: invalid JSON-shaped input returns `{ tweets: [], users: [] }`. Never throw to the caller.

- [ ] **Step 1: Write fixture and failing tests**

```json
{
  "data": {
    "threaded_conversation_with_injections_v2": {
      "instructions": [
        {
          "entries": [
            {
              "content": {
                "itemContent": {
                  "tweet_results": {
                    "result": {
                      "__typename": "Tweet",
                      "rest_id": "111",
                      "legacy": {
                        "created_at": "Mon Jan 01 00:00:00 +0000 2024",
                        "full_text": "hello",
                        "lang": "en"
                      },
                      "core": {
                        "user_results": {
                          "result": {
                            "__typename": "User",
                            "rest_id": "u-outer",
                            "legacy": {
                              "location": "London, UK",
                              "lang": "en",
                              "screen_name": "alice"
                            }
                          }
                        }
                      },
                      "quoted_status_result": {
                        "result": {
                          "__typename": "Tweet",
                          "rest_id": "222",
                          "legacy": {
                            "created_at": "Mon Jan 01 00:00:00 +0000 2024",
                            "full_text": "quoted",
                            "lang": "en"
                          },
                          "core": {
                            "user_results": {
                              "result": {
                                "__typename": "User",
                                "rest_id": "u-inner",
                                "legacy": {
                                  "location": "Lagos",
                                  "lang": "en",
                                  "screen_name": "bob"
                                },
                                "location": { "country": "Nigeria" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
}
```

```ts
// test/parse-graphql.test.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGraphQL } from "../src/shared/parse-graphql.ts";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/timeline-tweet.json"), "utf8"),
);

describe("parseGraphQL", () => {
  it("returns empty on junk", () => {
    expect(parseGraphQL(null)).toEqual({ tweets: [], users: [] });
    expect(parseGraphQL("nope")).toEqual({ tweets: [], users: [] });
    expect(parseGraphQL({ foo: 1 })).toEqual({ tweets: [], users: [] });
  });

  it("extracts tweets, quote, users, location, and based-in", () => {
    const parsed = parseGraphQL(fixture);
    const ids = parsed.tweets.map((t) => t.tweetId).sort();
    expect(ids).toEqual(["111", "222"]);
    const outer = parsed.tweets.find((t) => t.tweetId === "111");
    expect(outer?.lang).toBe("en");
    expect(outer?.authorId).toBe("u-outer");
    expect(outer?.quoted?.tweetId).toBe("222");
    const london = parsed.users.find((u) => u.userId === "u-outer");
    expect(london?.location).toBe("London, UK");
    const lagos = parsed.users.find((u) => u.userId === "u-inner");
    expect(lagos?.location).toBe("Lagos");
    expect(lagos?.basedIn).toBe("Nigeria");
  });

  it("unwraps TweetWithVisibilityResults", () => {
    const parsed = parseGraphQL({
      result: {
        __typename: "TweetWithVisibilityResults",
        tweet: {
          __typename: "Tweet",
          rest_id: "333",
          legacy: { lang: "fr", full_text: "bonjour", created_at: "x" },
          core: {
            user_results: {
              result: {
                __typename: "User",
                rest_id: "u-fr",
                legacy: { location: "Paris", lang: "fr" },
              },
            },
          },
        },
      },
    });
    expect(parsed.tweets[0]?.tweetId).toBe("333");
    expect(parsed.tweets[0]?.lang).toBe("fr");
    expect(parsed.users[0]?.userId).toBe("u-fr");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/parse-graphql.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Write parser**

```ts
// src/shared/parse-graphql.ts
import type { ParsedGraphQL, TweetRecord, UserRecord } from "./types.ts";

export function parseGraphQL(payload: unknown): ParsedGraphQL {
  const tweets = new Map<string, TweetRecord>();
  const users = new Map<string, UserRecord>();
  try {
    walk(payload, tweets, users);
  } catch {
    return { tweets: [], users: [] };
  }
  return { tweets: [...tweets.values()], users: [...users.values()] };
}

function walk(
  node: unknown,
  tweets: Map<string, TweetRecord>,
  users: Map<string, UserRecord>,
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, tweets, users);
    return;
  }
  const obj = node as Record<string, unknown>;
  const unwrapped = unwrapTweet(obj);
  if (unwrapped) extractTweet(unwrapped, tweets, users);
  if (isUser(obj)) extractUser(obj, users);
  for (const value of Object.values(obj)) walk(value, tweets, users);
}

function unwrapTweet(obj: Record<string, unknown>): Record<string, unknown> | null {
  if (obj.__typename === "TweetWithVisibilityResults" && isRecord(obj.tweet)) {
    return obj.tweet;
  }
  if (isTweet(obj)) return obj;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isTweet(obj: Record<string, unknown>): boolean {
  if (obj.__typename === "Tweet") return true;
  const legacy = isRecord(obj.legacy) ? obj.legacy : null;
  return typeof obj.rest_id === "string" && !!legacy && typeof legacy.lang === "string";
}

function isUser(obj: Record<string, unknown>): boolean {
  if (obj.__typename === "User") return true;
  const legacy = isRecord(obj.legacy) ? obj.legacy : null;
  return typeof obj.rest_id === "string" && !!legacy && typeof legacy.screen_name === "string";
}

function extractTweet(
  obj: Record<string, unknown>,
  tweets: Map<string, TweetRecord>,
  users: Map<string, UserRecord>,
): void {
  const tweetId = String(obj.rest_id ?? "");
  if (!tweetId || tweets.has(tweetId)) return;
  const legacy = isRecord(obj.legacy) ? obj.legacy : {};
  const author = authorFromTweet(obj);
  if (author) extractUser(author, users);
  const quoted = quotedFrom(obj);
  const retweeted = retweetedFrom(legacy);
  tweets.set(tweetId, {
    tweetId,
    lang: typeof legacy.lang === "string" ? legacy.lang : null,
    authorId: author && typeof author.rest_id === "string" ? author.rest_id : null,
    quoted: null,
    retweeted: null,
  });
  if (quoted) {
    extractTweet(quoted, tweets, users);
    const row = tweets.get(tweetId);
    if (row && typeof quoted.rest_id === "string") {
      row.quoted = tweets.get(String(quoted.rest_id)) ?? null;
    }
  }
  if (retweeted) {
    extractTweet(retweeted, tweets, users);
    const row = tweets.get(tweetId);
    if (row && typeof retweeted.rest_id === "string") {
      row.retweeted = tweets.get(String(retweeted.rest_id)) ?? null;
    }
  }
}

function authorFromTweet(obj: Record<string, unknown>): Record<string, unknown> | null {
  const core = isRecord(obj.core) ? obj.core : null;
  const userResults = core && isRecord(core.user_results) ? core.user_results : null;
  const result = userResults && isRecord(userResults.result) ? userResults.result : null;
  return result;
}

function quotedFrom(obj: Record<string, unknown>): Record<string, unknown> | null {
  const quoted = isRecord(obj.quoted_status_result) ? obj.quoted_status_result : null;
  const result = quoted && isRecord(quoted.result) ? quoted.result : null;
  if (!result) return null;
  return unwrapTweet(result) ?? (isTweet(result) ? result : null);
}

function retweetedFrom(legacy: Record<string, unknown>): Record<string, unknown> | null {
  const rt = isRecord(legacy.retweeted_status_result) ? legacy.retweeted_status_result : null;
  const result = rt && isRecord(rt.result) ? rt.result : null;
  if (!result) return null;
  return unwrapTweet(result) ?? (isTweet(result) ? result : null);
}

function extractUser(obj: Record<string, unknown>, users: Map<string, UserRecord>): void {
  const userId = String(obj.rest_id ?? "");
  if (!userId) return;
  const legacy = isRecord(obj.legacy) ? obj.legacy : {};
  const location = typeof legacy.location === "string" ? legacy.location : null;
  const lang = typeof legacy.lang === "string" ? legacy.lang : null;
  const basedIn = basedInFrom(obj, legacy);
  const prev = users.get(userId);
  users.set(userId, {
    userId,
    location: location ?? prev?.location ?? null,
    basedIn: basedIn ?? prev?.basedIn ?? null,
    lang: lang ?? prev?.lang ?? null,
  });
}

function basedInFrom(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  const loc = isRecord(obj.location) ? obj.location : null;
  if (loc && typeof loc.country === "string") return loc.country;
  if (typeof obj.account_based_in === "string") return obj.account_based_in;
  if (typeof obj.country === "string") return obj.country;
  if (typeof legacy.country === "string") return legacy.country;
  return null;
}
```

If `isUser` is too strict for the inner fixture user (has `screen_name`), keep `screen_name` in the fixture as written. If a user has only `location` and `rest_id`, still extract when `__typename === "User"`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/parse-graphql.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/parse-graphql.ts test/parse-graphql.test.ts test/fixtures/timeline-tweet.json
git commit -m "feat: parse tweet and user records from X GraphQL JSON"
```

---

### Task 5: Settings parse and user cache

**Files:**
- Create: `src/shared/settings.ts`
- Create: `src/shared/cache.ts`
- Create: `test/settings.test.ts`
- Create: `test/cache.test.ts`

**Interfaces:**
- Consumes: `Settings`, `UserRecord`
- Produces:
  - `emptySettings(): Settings`
  - `parseSettings(raw: unknown): Settings`
  - `class UserCache` with `constructor(limit: number)`, `get(id: string): UserRecord | undefined`, `put(user: UserRecord): void`, `dump(): UserRecord[]`, `load(users: UserRecord[]): void`
  - Persist shape: `{ userCache: UserRecord[] }` — LRU, default limit `10000`

- [ ] **Step 1: Write the failing tests**

```ts
// test/settings.test.ts
import { describe, expect, it } from "vitest";
import { emptySettings, parseSettings } from "../src/shared/settings.ts";

describe("parseSettings", () => {
  it("returns empty defaults for junk", () => {
    expect(parseSettings(undefined)).toEqual(emptySettings());
    expect(parseSettings(null)).toEqual({ hiddenCountryCodes: [], hiddenLanguageCodes: [] });
    expect(parseSettings({ hiddenCountryCodes: "IN" })).toEqual(emptySettings());
  });

  it("keeps valid ISO-looking codes", () => {
    expect(
      parseSettings({
        hiddenCountryCodes: ["IN", "us", 1, ""],
        hiddenLanguageCodes: ["hi", "EN"],
      }),
    ).toEqual({
      hiddenCountryCodes: ["IN", "US"],
      hiddenLanguageCodes: ["hi", "en"],
    });
  });
});
```

```ts
// test/cache.test.ts
import { describe, expect, it } from "vitest";
import { UserCache } from "../src/shared/cache.ts";

describe("UserCache", () => {
  it("evicts oldest when over limit", () => {
    const cache = new UserCache(2);
    cache.put({ userId: "a", location: "A", basedIn: null, lang: null });
    cache.put({ userId: "b", location: "B", basedIn: null, lang: null });
    cache.put({ userId: "c", location: "C", basedIn: null, lang: null });
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")?.location).toBe("C");
  });

  it("merges fields on put and refreshes LRU", () => {
    const cache = new UserCache(2);
    cache.put({ userId: "a", location: "A", basedIn: null, lang: null });
    cache.put({ userId: "b", location: "B", basedIn: null, lang: null });
    cache.put({ userId: "a", location: null, basedIn: "India", lang: "hi" });
    cache.put({ userId: "c", location: "C", basedIn: null, lang: null });
    expect(cache.get("a")?.basedIn).toBe("India");
    expect(cache.get("a")?.location).toBe("A");
    expect(cache.get("b")).toBeUndefined();
  });

  it("round-trips dump/load", () => {
    const cache = new UserCache(10);
    cache.put({ userId: "a", location: "A", basedIn: null, lang: null });
    const next = new UserCache(10);
    next.load(cache.dump());
    expect(next.get("a")?.location).toBe("A");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/settings.test.ts test/cache.test.ts`

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

```ts
// src/shared/settings.ts
import type { Settings } from "./types.ts";

export function emptySettings(): Settings {
  return { hiddenCountryCodes: [], hiddenLanguageCodes: [] };
}

export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return emptySettings();
  const obj = raw as Record<string, unknown>;
  return {
    hiddenCountryCodes: normalizeCodes(obj.hiddenCountryCodes, "upper"),
    hiddenLanguageCodes: normalizeCodes(obj.hiddenLanguageCodes, "lower"),
  };
}

function normalizeCodes(value: unknown, caseStyle: "upper" | "lower"): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(caseStyle === "upper" ? trimmed.toUpperCase() : trimmed.toLowerCase());
  }
  return out;
}
```

```ts
// src/shared/cache.ts
import type { UserRecord } from "./types.ts";

export class UserCache {
  private readonly order: string[] = [];
  private readonly map = new Map<string, UserRecord>();

  constructor(private readonly limit: number) {}

  get(id: string): UserRecord | undefined {
    return this.map.get(id);
  }

  put(user: UserRecord): void {
    const prev = this.map.get(user.userId);
    const merged: UserRecord = {
      userId: user.userId,
      location: user.location ?? prev?.location ?? null,
      basedIn: user.basedIn ?? prev?.basedIn ?? null,
      lang: user.lang ?? prev?.lang ?? null,
    };
    this.map.set(user.userId, merged);
    const at = this.order.indexOf(user.userId);
    if (at >= 0) this.order.splice(at, 1);
    this.order.push(user.userId);
    while (this.order.length > this.limit) {
      const evict = this.order.shift();
      if (evict) this.map.delete(evict);
    }
  }

  dump(): UserRecord[] {
    return this.order.map((id) => this.map.get(id)).filter((row): row is UserRecord => !!row);
  }

  load(users: UserRecord[]): void {
    for (const user of users) this.put(user);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/settings.test.ts test/cache.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/settings.ts src/shared/cache.ts test/settings.test.ts test/cache.test.ts
git commit -m "feat: parse hide settings and LRU author cache"
```

---

### Task 6: DOM hide helpers

**Files:**
- Create: `src/shared/hide-dom.ts`
- Create: `test/hide-dom.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TWEET_ID_RE` used internally
  - `tweetIdFromHref(href: string): string | null`
  - `tweetIdFromArticle(article: Element): string | null`
  - `setArticleHidden(article: HTMLElement, hidden: boolean): void` — `display: none` when hidden, `display: ""` when not
  - `findTweetArticles(root: ParentNode): HTMLElement[]` — `article` nodes that contain a `/status/{id}` link
  - `findNotificationRows(root: ParentNode): HTMLElement[]` — `[data-testid="cellInnerDiv"]` that contain a `/status/{id}` or `/i/user/` link; `notificationTweetId(row)` / `notificationUserHandle` helpers as needed

- [ ] **Step 1: Write the failing test**

```ts
// test/hide-dom.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/hide-dom.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/shared/hide-dom.ts
const STATUS_RE = /\/status\/(\d+)/;

export function tweetIdFromHref(href: string): string | null {
  const match = href.match(STATUS_RE);
  return match?.[1] ?? null;
}

export function tweetIdFromArticle(article: Element): string | null {
  const links = article.querySelectorAll("a[href]");
  for (const link of links) {
    const id = tweetIdFromHref(link.getAttribute("href") ?? "");
    if (id) return id;
  }
  return null;
}

export function setArticleHidden(article: HTMLElement, hidden: boolean): void {
  article.style.display = hidden ? "none" : "";
}

export function findTweetArticles(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  const articles = root.querySelectorAll("article");
  for (const article of articles) {
    if (tweetIdFromArticle(article)) found.push(article as HTMLElement);
  }
  return found;
}

export function findNotificationRows(root: ParentNode): HTMLElement[] {
  const rows: HTMLElement[] = [];
  for (const node of root.querySelectorAll('[data-testid="cellInnerDiv"]')) {
    if (tweetIdFromArticle(node) || node.querySelector('a[href*="/status/"]')) {
      rows.push(node as HTMLElement);
    }
  }
  return rows;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/hide-dom.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/hide-dom.ts test/hide-dom.test.ts
git commit -m "feat: hide and restore tweet articles without deleting them"
```

---

### Task 7: MAIN-world hook

**Files:**
- Create: `src/hook/inject.ts`

**Interfaces:**
- Consumes: `parseGraphQL`, `HookMessage`
- Produces: page-context script that wraps `window.fetch` and `XMLHttpRequest.prototype.open` / `send`, parses JSON bodies, posts `HookMessage`

No extra X requests. Swallow parse errors.

- [ ] **Step 1: Write inject.ts**

There is no reliable node test for patched `window.fetch` in this repo yet. Keep this file thin: hook + `postMessage` only. Parser is already tested.

```ts
// src/hook/inject.ts
import { parseGraphQL } from "../shared/parse-graphql.ts";
import type { HookMessage } from "../shared/types.ts";

const SOURCE = "x-country-hide";

function publish(payload: unknown): void {
  try {
    const parsed = parseGraphQL(payload);
    if (parsed.tweets.length === 0 && parsed.users.length === 0) return;
    const message: HookMessage = { source: SOURCE, type: "graphql", ...parsed };
    window.postMessage(message, "*");
  } catch {
    // fail open
  }
}

async function parseResponse(response: Response): Promise<void> {
  try {
    const clone = response.clone();
    const contentType = clone.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return;
    publish(await clone.json());
  } catch {
    // fail open
  }
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
  const response = await originalFetch(...args);
  void parseResponse(response);
  return response;
};

const xhrOpen = XMLHttpRequest.prototype.open;
const xhrSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (
  this: XMLHttpRequest,
  method: string,
  url: string | URL,
  ...rest: unknown[]
): void {
  (this as XMLHttpRequest & { __xchUrl?: string }).__xchUrl = String(url);
  return xhrOpen.call(this, method, url, ...(rest as []));
};

XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
  this.addEventListener("load", () => {
    try {
      const type = this.getResponseHeader("content-type") ?? "";
      if (!type.includes("json")) return;
      const text = this.responseText;
      if (!text) return;
      publish(JSON.parse(text));
    } catch {
      // fail open
    }
  });
  return xhrSend.call(this, body);
};
```

- [ ] **Step 2: Typecheck the hook**

Run: `npx tsc --noEmit`

Expected: PASS (or only unused-rest noise you then fix). If `xhrOpen.call` types fail, wrap with `// @ts-expect-error XHR open arity` only on that line after trying a correct tuple cast.

- [ ] **Step 3: Commit**

```bash
git add src/hook/inject.ts
git commit -m "feat: hook page fetch and XHR for GraphQL payloads"
```

---

### Task 8: Content script

**Files:**
- Create: `src/content/main.ts`

**Interfaces:**
- Consumes: `parseSettings`, `UserCache`, `defaultCountryIndex`, `shouldHideCard`, hide-dom helpers, `HookMessage`
- Produces: isolated content script

Behavior:

1. Load settings + `userCache` from `chrome.storage.local`.
2. `UserCache(10000)`, `load` persisted users.
3. Listen `window` messages: if `data.source === "x-country-hide"` and `data.type === "graphql"`, `put` users, remember tweets, persist cache (debounce 1s).
4. `MutationObserver` on `document.documentElement`: for each `findTweetArticles` / `findNotificationRows`, hide if `shouldHideCard` for known tweet id, or if author in cache matches and tweet id is in the hidden set.
5. Maintain `Map<string, TweetRecord>` of seen tweets. Hidden ids = those for which `shouldHideCard` is true.
6. `chrome.storage.onChanged`: re-parse settings, re-scan DOM (unhide then hide).
7. If `chrome` is missing, do nothing (fail open).

```ts
// src/content/main.ts
import { UserCache } from "../shared/cache.ts";
import { defaultCountryIndex } from "../shared/countries.ts";
import {
  findNotificationRows,
  findTweetArticles,
  setArticleHidden,
  tweetIdFromArticle,
} from "../shared/hide-dom.ts";
import { shouldHideCard } from "../shared/match.ts";
import { parseSettings } from "../shared/settings.ts";
import type { HookMessage, Settings, TweetRecord, UserRecord } from "../shared/types.ts";

const index = defaultCountryIndex();
const tweets = new Map<string, TweetRecord>();
const users = new UserCache(10_000);
let settings: Settings = parseSettings(undefined);
let persistTimer: number | undefined;

function storage(): typeof chrome.storage.local | null {
  try {
    return globalThis.chrome?.storage?.local ?? null;
  } catch {
    return null;
  }
}

async function load(): Promise<void> {
  const area = storage();
  if (!area) return;
  const raw = await area.get(["hiddenCountryCodes", "hiddenLanguageCodes", "userCache"]);
  settings = parseSettings(raw);
  if (Array.isArray(raw.userCache)) users.load(raw.userCache as UserRecord[]);
}

function schedulePersist(): void {
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    const area = storage();
    if (!area) return;
    void area.set({ userCache: users.dump() });
  }, 1000);
}

function usersMap(): Map<string, UserRecord> {
  const map = new Map<string, UserRecord>();
  for (const row of users.dump()) map.set(row.userId, row);
  return map;
}

function apply(): void {
  const map = usersMap();
  for (const article of findTweetArticles(document)) {
    const id = tweetIdFromArticle(article);
    if (!id) continue;
    const tweet = tweets.get(id);
    const hide = tweet ? shouldHideCard(tweet, map, settings, index) : false;
    setArticleHidden(article, hide);
  }
  for (const row of findNotificationRows(document)) {
    const id = tweetIdFromArticle(row);
    if (!id) continue;
    const tweet = tweets.get(id);
    setArticleHidden(row, tweet ? shouldHideCard(tweet, map, settings, index) : false);
  }
}

function onMessage(event: MessageEvent): void {
  const data = event.data as HookMessage | undefined;
  if (!data || data.source !== "x-country-hide" || data.type !== "graphql") return;
  for (const user of data.users) users.put(user);
  for (const tweet of data.tweets) tweets.set(tweet.tweetId, tweet);
  schedulePersist();
  apply();
}

void load().then(() => {
  window.addEventListener("message", onMessage);
  const observer = new MutationObserver(() => apply());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const area = storage();
  area?.onChanged.addListener((changes) => {
    if (changes.hiddenCountryCodes || changes.hiddenLanguageCodes) {
      void load().then(apply);
    }
  });
  apply();
});
```

- [ ] **Step 1: Add file, then typecheck**

Run: `npx tsc --noEmit`

Expected: PASS. If `chrome` is unknown, add `src/chrome.d.ts`:

```ts
declare const chrome: {
  storage: {
    local: {
      get: (keys: string[]) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      onChanged: {
        addListener: (cb: (changes: Record<string, { newValue?: unknown }>) => void) => void;
      };
    };
  };
};
```

Include `src/chrome.d.ts` in `tsconfig.json` `include` (already `src/**/*.ts` if you name it `.ts`; use `chrome-env.d.ts`).

- [ ] **Step 2: Commit**

```bash
git add src/content/main.ts src/chrome-env.d.ts
git commit -m "feat: hide matching cards from hooked GraphQL data"
```

---

### Task 9: Popup

**Files:**
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.css`
- Create: `src/popup/popup.ts`

**Interfaces:**
- Consumes: `COUNTRY_NAMES`, `LANGUAGES`, `parseSettings`, `emptySettings`
- Produces: searchable two-tab checklist; every country from `COUNTRY_NAMES`; every language from `LANGUAGES`; writes storage on toggle

- [ ] **Step 1: Write popup files**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>X Country Hide</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <header>
      <button type="button" id="tab-countries" aria-selected="true">Countries</button>
      <button type="button" id="tab-languages" aria-selected="false">Languages</button>
    </header>
    <input id="search" type="search" placeholder="Search" autocomplete="off" />
    <ul id="list"></ul>
    <script src="popup.js"></script>
  </body>
</html>
```

```css
html, body {
  margin: 0;
  width: 320px;
  height: 480px;
  font: 13px/1.4 system-ui, sans-serif;
  color: #111;
  background: #fff;
}
header {
  display: flex;
  border-bottom: 1px solid #ddd;
}
header button {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 8px;
}
header button[aria-selected="true"] {
  font-weight: 700;
  box-shadow: inset 0 -2px 0 #111;
}
#search {
  width: 100%;
  box-sizing: border-box;
  border: 0;
  border-bottom: 1px solid #ddd;
  padding: 8px;
}
#list {
  list-style: none;
  margin: 0;
  padding: 0;
  height: calc(480px - 78px);
  overflow: auto;
}
#list li {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
}
#list label {
  flex: 1;
}
```

```ts
// src/popup/popup.ts
import { COUNTRY_NAMES } from "../shared/countries.ts";
import { LANGUAGES } from "../shared/languages.ts";
import { parseSettings } from "../shared/settings.ts";
import type { Settings } from "../shared/types.ts";

type Tab = "countries" | "languages";

let tab: Tab = "countries";
let settings: Settings = parseSettings(undefined);

const list = document.getElementById("list") as HTMLUListElement;
const search = document.getElementById("search") as HTMLInputElement;
const tabCountries = document.getElementById("tab-countries") as HTMLButtonElement;
const tabLanguages = document.getElementById("tab-languages") as HTMLButtonElement;

function countryRows(): { id: string; label: string }[] {
  return Object.entries(COUNTRY_NAMES)
    .map(([id, name]) => ({ id, label: `${name} (${id})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function languageRows(): { id: string; label: string }[] {
  return LANGUAGES.map((row) => ({ id: row.code, label: `${row.name} (${row.code})` }));
}

function render(): void {
  const query = search.value.trim().toLowerCase();
  const rows = tab === "countries" ? countryRows() : languageRows();
  const selected =
    tab === "countries" ? settings.hiddenCountryCodes : settings.hiddenLanguageCodes;
  list.replaceChildren();
  for (const row of rows) {
    if (query && !row.label.toLowerCase().includes(query) && !row.id.toLowerCase().includes(query)) {
      continue;
    }
    const li = document.createElement("li");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = selected.includes(row.id);
    box.addEventListener("change", () => void toggle(row.id, box.checked));
    const label = document.createElement("label");
    label.textContent = row.label;
    li.append(box, label);
    list.append(li);
  }
}

async function toggle(id: string, on: boolean): Promise<void> {
  if (tab === "countries") {
    const set = new Set(settings.hiddenCountryCodes);
    if (on) set.add(id);
    else set.delete(id);
    settings = { ...settings, hiddenCountryCodes: [...set] };
  } else {
    const set = new Set(settings.hiddenLanguageCodes);
    if (on) set.add(id);
    else set.delete(id);
    settings = { ...settings, hiddenLanguageCodes: [...set] };
  }
  await chrome.storage.local.set({
    hiddenCountryCodes: settings.hiddenCountryCodes,
    hiddenLanguageCodes: settings.hiddenLanguageCodes,
  });
}

tabCountries.addEventListener("click", () => {
  tab = "countries";
  tabCountries.setAttribute("aria-selected", "true");
  tabLanguages.setAttribute("aria-selected", "false");
  render();
});
tabLanguages.addEventListener("click", () => {
  tab = "languages";
  tabCountries.setAttribute("aria-selected", "false");
  tabLanguages.setAttribute("aria-selected", "true");
  render();
});
search.addEventListener("input", render);

void chrome.storage.local.get(["hiddenCountryCodes", "hiddenLanguageCodes"]).then((raw) => {
  settings = parseSettings(raw);
  render();
});
```

No country is pre-checked. `IN` appears only because it is in `COUNTRY_NAMES`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.html src/popup/popup.css src/popup/popup.ts
git commit -m "feat: add country and language hide popup"
```

---

### Task 10: Manifest, build, README

**Files:**
- Create: `manifest.json`
- Create: `scripts/build.mjs`
- Create: `README.md`

**Interfaces:**
- Consumes: all `src/**` entrypoints
- Produces: `dist/` loadable unpacked in Chrome and Firefox

- [ ] **Step 1: Write manifest and build**

```json
{
  "manifest_version": 3,
  "name": "X Country Hide",
  "version": "0.1.0",
  "description": "Hide posts on X from countries and languages you choose.",
  "permissions": ["storage"],
  "host_permissions": ["https://x.com/*", "https://twitter.com/*"],
  "action": {
    "default_title": "X Country Hide",
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["https://x.com/*", "https://twitter.com/*"],
      "js": ["hook.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["https://x.com/*", "https://twitter.com/*"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  "browser_specific_settings": {
    "gecko": {
      "id": "x-country-hide@local",
      "strict_min_version": "128.0"
    }
  }
}
```

```js
// scripts/build.mjs
import { mkdir, copyFile, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

await mkdir(dist, { recursive: true });

await esbuild.build({
  entryPoints: {
    hook: join(root, "src/hook/inject.ts"),
    content: join(root, "src/content/main.ts"),
    popup: join(root, "src/popup/popup.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome120", "firefox128"],
  logLevel: "info",
});

await copyFile(join(root, "manifest.json"), join(dist, "manifest.json"));
await copyFile(join(root, "src/popup/popup.html"), join(dist, "popup.html"));
await copyFile(join(root, "src/popup/popup.css"), join(dist, "popup.css"));
```

```md
# X Country Hide

Browser extension for Chrome and Firefox. Hide posts on x.com / twitter.com from countries and languages you choose. India is not special — check any country.

## Develop

```bash
npm install
npm test
npm run build
```

## Load unpacked

Chrome / Edge: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist/manifest.json`.

Open x.com, open the popup, check a country. Matching cards disappear. Uncheck: they come back without refresh.

## How it decides

Uses data X already sent: tweet language, account language, “account based in”, profile location (country name, alias, ISO code, major city). No extra API calls. No signal = tweet stays.
```

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: `dist/hook.js`, `dist/content.js`, `dist/popup.js`, `dist/manifest.json`, `dist/popup.html`, `dist/popup.css`.

- [ ] **Step 3: Run full tests**

Run: `npm test`

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add manifest.json scripts/build.mjs README.md
git commit -m "feat: add MV3 manifest and esbuild bundle"
```

Do not commit `dist/` (it is gitignored).

---

## Manual smoke (after Task 10)

Load `dist/` in Chrome and Firefox. On x.com:

1. Check one country → matching home cards vanish; uncheck → return.
2. Check a second country → same (any-country).
3. Check one language → matching-language cards vanish.
4. Repeat on a profile, search, reply thread, quote.

No live CI.

---

## Self-review

**Spec coverage**

| Spec | Task |
| --- | --- |
| Any-country popup + languages | 3, 9 |
| Empty defaults | 5, 9 |
| Hook GraphQL, no extra requests | 4, 7 |
| Match lang / based-in / location | 2, 3 |
| `display: none`, restore | 6, 8 |
| Quote / RT / thread / own tweets | 2, 8 |
| Notifications when known | 6, 8 |
| Fail open | 4, 7, 8 |
| 10k LRU cache | 5, 8 |
| Chrome + Firefox MV3 | 10 |
| Matcher + fixture tests | 2, 3, 4 |
| India not special-cased | 3, 9 |

**Placeholders:** Task 3 requires full ISO tables in the implementation files; the plan lists required aliases/cities and the complete-list rule instead of pasting 250 rows here so the file stays reviewable. The implementer must write the full `COUNTRY_NAMES` / `COUNTRY_ISO3` / `LANGUAGES` objects, not a stub.

**Types:** `Settings`, `UserRecord`, `TweetRecord`, `CountryIndex`, `HookMessage`, `parseGraphQL`, `UserCache`, `shouldHideCard` are named the same in every task.
