# x-country-hide — Design

**Date:** 2026-08-30  
**Status:** Draft for user review  
**Product:** Chrome + Firefox Manifest V3 extension for x.com / twitter.com

## Problem

X does not offer a country filter. The user wants to hide posts that look like they come from countries they choose (profile location, “account based in”, language). This is a local hide list, not a report/block campaign and not a quality/spam classifier.

**Any ISO country and any listed language can be hidden.** India is only the author’s first use case (they will check `IN` plus Indic languages). The product must not special-case India in architecture, settings, or UI.

## Goals

- Hide every matching tweet on x.com and twitter.com (home, search, profiles, replies, notifications).
- User picks countries and languages in a popup checklist.
- Empty lists = hide nothing.
- No extra requests to X. Read GraphQL JSON X already sent to the page.
- Fail open: parse errors must not blank the timeline.

## Non-goals (v1)

- Spam/quality scoring (“shitpost” detection).
- Cross-device sync.
- Hidden-count badge or “Hidden (country)” placeholders.
- Blocking, muting, or reporting users.
- Hiding by follower count, engagement, or media type.
- Live x.com CI.

## Architecture

Three parts:

1. **Popup** — Countries tab + Languages tab. Search + checkboxes. Writes `chrome.storage.local` immediately.
2. **Page hook (MAIN world)** — Wraps `fetch` and `XMLHttpRequest` on x.com / twitter.com. Parses GraphQL JSON. Extracts tweet id, tweet `lang`, author id, `user.location`, “account based in” (or equivalent field X sends). Forwards records via `postMessage`.
3. **Content script (isolated world)** — Owns the hide lists and a user cache. Matches tweets. Hides cards. Observes new nodes. Reloads rules when storage changes.

Firefox and Chrome share one MV3 codebase. Use `browser.*` / `chrome.*` compatible APIs (`chrome.storage`, `chrome.runtime`). MAIN-world script cannot call `chrome.storage`; isolated script can.

```
X page  →  hook (MAIN)  →  postMessage  →  content (isolated)
                                                      ↓
popup  →  chrome.storage.local  ─────────────────────┘
                                                      ↓
                                              hide / unhide cards
```

## Settings

Stored in `chrome.storage.local`:

```ts
{
  hiddenCountryCodes: string[]; // ISO 3166-1 alpha-2, e.g. ["IN"]
  hiddenLanguageCodes: string[]; // ISO 639-1, e.g. ["hi", "ta"]
}
```

Defaults: both arrays empty. No first-run preset. No country is pre-checked.

## Popup

- Two tabs: **Countries**, **Languages**.
- Search filters the visible list.
- Country rows: English name + ISO2. Language rows: English name + code.
- Toggle updates storage immediately.
- No sync, no account, no cloud.

## Match rules

Hide if **any** of these is true:

1. Tweet `lang` is in `hiddenLanguageCodes`.
2. Author account language (when X sends it) is in `hiddenLanguageCodes`.
3. “Account based in” maps to a code in `hiddenCountryCodes`.
4. Profile `location` text, after lowercase/trim/punctuation fold, matches a selected country via:
   - English country name or aliases for **every** country (`United States` / `USA` / `America`, `United Kingdom` / `UK` / `Britain`, `India` / `Bharat`, …)
   - ISO2 / ISO3 as a whole word (`US`, `USA`, `GB`, `GBR`, `IN`, `IND`, …)
   - Curated major-city list for **every** country (`New York` → `US`, `London` → `GB`, `Mumbai` → `IN`). Large metros only, not every town.

Languages tab is the full ISO 639-1 list used on X (not an Indic-only subset). User checks any mix.

No signal → tweet stays. Self-reported location can be fake; those tweets are missed or wrongly hidden by that text. An English tweet from an account located in a hidden country still hides if that country is checked, even if `en` is unchecked.

Language is not country. Checking `hi` hides Hindi tweets from any country. Checking `IN` hides India-located accounts even when the tweet is in English.

## Hide behavior

- No placeholder. Card leaves the layout.
- Use CSS `display: none` (do not delete the node) so unchecking a country/language restores cards without a refresh.
- Timeline / profile / search / replies: hide the whole card if that tweet matches.
- Retweet: match the original author and tweet language.
- Quote: hide the whole card if the outer **or** inner tweet matches.
- Thread: hide matching replies only; parent stays if it does not match.
- User’s own tweets: same rules.
- Ads: hide when the same fields are present; otherwise leave.
- Notifications: hide the row when a cached user/tweet matches; unknown → leave.

Brief flash is acceptable (card paints, then hides). Prefer hiding from queued ids when JSON arrives before paint.

## Cache

In-memory map: `userId → { location, basedIn, lang }`. Persist a capped copy in `chrome.storage.local` (about 10k authors, LRU) so profile hops stay useful. Session memory can be larger. Evict oldest when over cap.

## Failure modes

- GraphQL shape change: hook extracts nothing → fail open, tweets stay visible.
- Partial payloads: match on whatever fields exist; do not invent country.
- Storage missing/corrupt: treat as empty hide lists.
- Never hide the entire timeline because parsing failed.

## Testing

Automated (no live X login):

- Matcher unit tests: location strings → country for several countries (not only `IN`); aliases; metros; lang codes; ISO words; no-match stays visible.
- Parser tests on checked-in anonymized GraphQL fixtures (tweet + user objects).

Manual smoke (load unpacked, Chrome once and Firefox once):

- Check one country, home cards vanish; uncheck, cards return.
- Check a second country; same behavior (proves any-country, not India-only).
- Check one language; matching-language cards vanish.
- Repeat on a profile, search, reply thread, and a quote tweet.

No CI against live x.com.

## Risks

- X changes GraphQL or DOM: extension needs a parser patch.
- MAIN-world hook may trip X’s integrity checks; if so, fall back to observing responses another way without extra API calls.
- City list will miss smaller towns; that is accepted for v1.

## File sketch (implementation, not started)

- `manifest.json` — MV3, `x.com` / `twitter.com`, popup, content + MAIN world hook
- `src/popup/` — checklist UI
- `src/content/` — storage, observer, hide/unhide
- `src/hook/` — fetch/XHR wrap, GraphQL walk
- `src/shared/match.ts` — country/language matching
- `src/shared/countries.ts` — ISO list, aliases, major cities
- `src/shared/languages.ts` — ISO 639-1 labels
- `test/` — matcher + parser fixtures
