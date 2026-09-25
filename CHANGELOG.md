# Changelog

All notable changes to Tamis (formerly X Country Block). Versions match
`package.json` and both manifests; `npm run check-version` enforces this.

## 0.2.0 - unreleased

### Rebrand: X Country Block is now Tamis

- New name in both manifests: "Tamis: Country & Language Filter for X",
  short name "Tamis", toolbar title "Tamis". The summary no longer says
  "block"; the extension filters, highlights or shows only what you pick.
- New icon: a round sieve drawn as five feed rows on a teal tile, with the
  marigold row you keep. Hand-pixelled 16 and 32 px toolbar icons; the
  128 px icon has the 16 px transparent padding the Chrome Web Store asks
  for.
- New brand masters in `brand/` and store art in `store/`, all regenerated
  by `node scripts/render-brand.mjs`. The five store screenshots share one
  layout and come from `node scripts/store-screenshots.mjs`: 1, 3, 4 and 5
  from the production popup, 2 from a capture of x.com
  (`store/screenshots/README.md`).
- Privacy policy rewritten for Tamis, with a full disclosure of the local
  settings, the local cache of public profile data and Stripe payments.
  Same URL.
- Store copy for the Chrome Web Store, Firefox Add-ons and a new Microsoft
  Edge listing in `store/listing.md`.
- Unchanged on purpose: storage keys, the Firefox add-on ID, the AMO slug,
  the privacy-policy and Stripe success URL, and internal identifiers.

### Build and release

- Builds start from an empty output folder and fail if it holds a file the
  manifest and popup do not reference, so no leftover bundle can ship.
- Deterministic zips: sorted entries and one fixed, valid timestamp. The
  Firefox zip rebuilds byte-for-byte from the source archive with the same
  Node.js release (22.23.2); other releases give the same files, but the
  compressed bytes can differ.
- The Chrome package is now `x-country-block-0.2.0-chrome.zip`.
- The source archive holds only what is needed to rebuild and test.
- Version check across package files, manifests, README, BUILD, this
  changelog and the store listing's package names, run before tests and
  builds.
- The Chrome manifest declares `minimum_chrome_version` 120 and no longer
  carries stray Firefox-only settings.
- GitHub Actions CI: tests, type check, `npm audit`, both packages and the
  source-archive rebuild check. Test dependencies upgraded past known
  advisories.

### Fixes and features

New in the popup:

- Redesigned popup in light and dark: Filtering switch (pause without losing
  your picks), one-line status with the count on the current tab, Hide /
  Only show control, "Highlight instead of hide", a tray of your picks with
  Clear all, tab counts, and a privacy footer.
- "Always show these accounts": accounts you add are never hidden or
  highlighted. Highlighted posts offer a one-tap "Always show @handle".
- Search ignores accents and knows common other names ("usa", "uk",
  "turkiye", "ivory coast", "latam", "farsi", "bokmal").
- The language list shows the 69 languages X tags posts with; Norwegian is
  one row (X tags all Norwegian as `no`; older nb/nn picks move to it).
- Tells you when a tab needs a reload, when you are not on x.com, and when
  Firefox has not granted access to x.com, with a button for each.
- Focus mode (Pro): tapping Only show while locked opens an explanation card
  instead of jumping to checkout; a "Trial · N days left" chip; buying stays
  possible during the trial; an "Already bought? Restore Focus mode" link;
  a trial start in the future no longer unlocks.
- When the trial ends, filtering pauses and the popup says so. Before, the
  saved Only-show list silently turned into a hide list.
- The Stripe success page now confirms the unlock instead of closing.
  Leftover ExtensionPay data from 0.1.0 is removed on update.

Matching:

- Profile locations are read far more accurately: ordinary words are never
  country codes ("In the clouds" is no longer India, "LA" is Los Angeles),
  "City, ST" reads as a US town unless the code belongs to the city's own
  country ("Jaipur, IN" is India), phrases are not re-read ("Rio de Janeiro"),
  US state names beat same-named countries after a place ("Atlanta,
  Georgia"), and "South America" is no longer the United States.
- Accents fold instead of being deleted; flag emoji and native-language
  country names are recognised; cities for every country above about one
  million people.
- New regions: North America, Latin America & Caribbean, Caribbean, Central
  America, South America, Middle East, North Africa, Sub-Saharan Africa,
  European Union, Antarctica. Every country sits in at least one region.
- X's language codes are normalised (in, iw, ckb, zh-CN, hi-Latn, pt-BR,
  nb/nn), so Indonesian, Hebrew, Kurdish and Chinese can be filtered.
  Photo, link and emoji posts are not set aside when only languages are
  ticked in Only show.
- Reasons are plain words ("Tamis · Post language: Portuguese",
  "Account based in: Japan (as shown by X)").
- About 500 times faster per post.

On the page:

- Matching posts below the screen are hidden before you reach them, so the
  feed no longer jumps while you read; the last reply or search result is
  filtered too.
- Your own posts and the post you opened directly are never hidden.
- The "About this account" reader only reads X's real About sheet, so reply
  text can no longer set someone's country.
- Reposts are judged by the original author; like and repost notifications
  by the account that acted; quotes referenced by id are read.
- Account lists (Who to follow, followers) are filtered.
- The toolbar badge counts distinct posts on the page and uses marigold.
- Much lighter on storage and CPU: the profile cache is saved at most every
  few seconds, merged across tabs, keeps only accounts with a location (at
  most 5,000), expires after 30 days, and caches no new accounts in private
  windows or while no filter is active. No full re-scan on every scroll.
- The stored profile cache is trimmed to those limits every time X opens in
  a normal (non-private) window, even while filtering is paused or nothing
  is ticked. The larger 0.1.x cache (up to 10,000 accounts, with or without
  a location) is cleared the first time 0.2.0 runs.
- Page messages are checked for origin and shape, and an extension update
  no longer leaves old tabs half-working.

## 0.1.2 - 2026-09-24

- Focus mode checkout moved from ExtensionPay to a Stripe Payment Link.

## 0.1.1 - 2026-09-03

- Focus mode ("Only show") checkout through ExtensionPay (Stripe).
- Reads the 2026 location fields in X's data, so country filters and Only
  show work on the current feed.

## 0.1.0 - 2026-08-31

- First release as X Country Block: filter posts on x.com and twitter.com by
  country, region and language, from data X already loaded. Chrome and
  Firefox builds.
