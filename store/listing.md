# Tamis store listings (0.2.0)

Copy for the Chrome Web Store, Firefox Add-ons (AMO) and Microsoft Edge
Add-ons. Tamis was previously called X Country Block; the store item IDs,
the AMO slug `x-country-block` and the privacy-policy URL stay the same.

Lines marked **(0.2.0)** describe the Pause switch and the always-show list,
which are new in 0.2.0. Before pasting, check that both are in the build you
upload: if one is, drop the marker; if it is not, delete the line.

Voice: plain and factual. Filter, focus, highlight, pause, show only. Never
"block", "ban", "foreign", "clean" or "sanitize". Demo examples stay
neutral (Japanese + Portuguese, Norway + Norwegian, Europe); never a single
targeted country.

---

## Shared text

### Name (from the manifest)

```
Tamis: Country & Language Filter for X
```

38 characters (CWS limit 75, AMO limit 50).

### Summary (from the manifest; CWS and Edge short description)

```
Filter your X feed by country, region, or post language via X’s “Account based in” label. Hide, highlight, or show only your picks.
```

131 characters (limit 132).

### Long description (CWS detailed description, Edge description, AMO description)

```
Tamis filters your X feed by place and language, so you see more of the posts you want.

Tick countries, regions or languages in the popup. Matching posts on x.com and twitter.com are hidden, or highlighted if you would rather look first. Changes apply straight away, with no reload.

FREE
• Hide posts in languages you don't read, or from places you pick.
• Highlight instead of hide: matches get an outline, and hovering one shows why it matched.
• 249 countries and territories, 10 regions (Europe, South Asia, the Americas and more) and 183 languages, with search.
• The toolbar badge shows how many posts on the page are currently filtered.
• Works on the home timeline, search, profiles and notifications. In Hide mode, reposts and quotes of a match are hidden too.
• Pause filtering with one switch. Your picks are kept. (0.2.0)
• Always show the accounts you choose, whatever they match. (0.2.0)

PRO: FOCUS MODE ($5.99 once, 7-day free trial)
• Only show: keep what comes from the places and languages you tick, and set the rest aside. Useful for local news, match day, or reading only in your own languages.
• One-time payment through Stripe. No subscription and no Tamis account.
• Hide and Highlight stay free.

HOW IT DECIDES
Tamis only uses information already loaded on the page: the post's language tag, the account's language, the "Account based in" or "Connected via" line from X's About this account, the profile location, and a post's place tag. Ticking a region covers every country in it. In Hide mode a post with no location signal stays visible; in Focus mode it is set aside.
Location labels can be wrong, for example for people who use a VPN or travel. Tamis passes them on as they are.

PRIVATE BY DESIGN
• Runs entirely in your browser. No extra requests to X, no servers of our own, no analytics.
• Your picks, your Focus mode status and a cache of account locations you have already been shown stay on this device. Uninstalling removes them.
• No flags or labels are added next to anyone's name.

Tamis was previously called X Country Block. Not affiliated with or endorsed by X Corp.
```

### Privacy policy URL (all three stores)

```
https://andreasne89.github.io/x-country-block/privacy.html
```

Served by GitHub Pages from `docs/privacy.html`. Keep this path: it is also
the Stripe success page that unlocks Focus mode.

### Support

- Email: norway4metal@gmail.com
- Website / homepage: https://github.com/AndreasNE89/x-country-block

---

## Chrome Web Store

Dashboard: item `gbealimmmdpllngehcjmgaifdmodijhm`.

### Package

`release/x-country-block-0.2.0-chrome.zip`, built by `npm run build:prod`.
`manifest.json` is at the zip root.

### Store listing tab

| Field | Value |
|-------|-------|
| Title | From the manifest (see Shared text) |
| Summary | From the manifest (see Shared text) |
| Description | Long description (see Shared text) |
| Category | Social Networking |
| Language | English |
| Store icon | `store/cws-icon-128.png` (96 px artwork, 16 px transparent padding) |
| Screenshots | 1280x800, see `store/screenshots/README.md`. Screenshot 5 is `store/screenshot-5-privacy-1280x800.png`. Remove the old screenshot. |
| Small promo tile | `store/promo-440x280.png` |
| Marquee promo tile | `store/marquee-1400x560.png` |
| Official URL | None |
| Homepage URL | https://github.com/AndreasNE89/x-country-block |

### Privacy practices tab

Replace every existing field with the text below.

**Single purpose**

```
Filter posts on x.com and twitter.com by the countries, regions and languages the user picks: hide them, highlight them, or show only them.
```

**Permission justification: storage**

```
Saves the user's picks (countries, regions, languages), the filter mode, the highlight and pause settings, the accounts the user chooses to always show, and Focus mode purchase and trial status. Also keeps a local cache of public profile data (handle, profile location, "Account based in" or "Connected via", language) for accounts whose posts were already shown, so matching keeps working while scrolling. Everything stays in chrome.storage.local on the device and is never sent anywhere.
```

**Permission justification: host permissions**

```
x.com and twitter.com: the extension's only job is to filter posts on these sites. Its scripts read the posts and profile data that X has already loaded into the page, compare them with the user's picks, and hide or outline matching posts. It makes no requests of its own to X or anywhere else.

andreasne89.github.io/x-country-block/privacy.html: a small script runs only on this one page, which is the developer's privacy policy and also the page Stripe returns buyers to after a Focus mode purchase. When the page is opened with the purchase confirmation, the script tells the extension to unlock Focus mode on this device. It reads nothing else and runs on no other page.
```

**Are you using remote code?**

No, I am not using remote code.

```
All JavaScript ships inside the package. The extension loads no remote scripts, uses no eval, and makes no network requests. Focus mode checkout is a Stripe Payment Link opened in a normal browser tab.
```

**Data usage**

Tick only **Website content**, and describe it as:

```
The extension reads the content of x.com and twitter.com pages (posts, their language and place tags, and the public profile fields X shows for their authors) to decide which posts to hide or highlight. This processing happens only on the user's device. A cache of public profile fields is kept in local extension storage to speed up matching; it is never transmitted, sold or shared.
```

Leave every other data category unticked. Payment happens on Stripe's own
page, not in the extension; the privacy policy covers what Stripe collects.

Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**: see Shared text.

---

## Firefox Add-ons (AMO)

Listing: https://addons.mozilla.org/firefox/addon/x-country-block/ (the
slug stays).

### Files

- Add-on: `release/x-country-block-0.2.0-firefox.zip`, built by
  `npm run build:firefox:prod`.
- Source code: `release/x-country-block-0.2.0-source.zip`, built by
  `npm run source:zip`. Rebuild steps are in `BUILD.md`.

### Listing fields

| Field | Value |
|-------|-------|
| Name | From the manifest (38 of 50 characters) |
| Summary | See below (232 of 250 characters) |
| Description | Long description (see Shared text) |
| Categories | Social & Communication |
| This add-on requires payment | Yes (Focus mode, $5.99 one-time; Hide and Highlight are free) |
| Icon | From the package (`icons/icon64.png` / `icon128.png`) |
| Screenshots | The same five 1280x800 images as the Chrome Web Store |
| Support email | norway4metal@gmail.com |
| Homepage | https://github.com/AndreasNE89/x-country-block |
| Privacy policy | Link to the URL in Shared text |

**Summary**

```
Filter posts on X by country, region, or post language, using X's "Account based in" label and language tags. Hide or highlight matches for free. Focus mode (show only your picks) is a $5.99 one-time upgrade with a 7-day free trial.
```

**Data collection**: the manifest declares
`data_collection_permissions.required: ["none"]`. Nothing leaves the
device.

**Notes to reviewer**

```
Tamis (formerly X Country Block) filters posts on x.com by country, region and language, using only data X has already loaded; it makes no network requests.

Build: see BUILD.md in the source archive (npm ci, then npm run build:firefox:prod). The zip rebuilds byte-for-byte with Node.js 22.

Focus mode is a one-time Stripe payment. After checkout Stripe redirects to https://andreasne89.github.io/x-country-block/privacy.html?paid=1, where the paid-page.js content script tells the background script to unlock Focus mode locally. To test Focus mode without paying, start the free 7-day trial from the popup.
```

---

## Microsoft Edge Add-ons

New listing. Upload the Chrome package: `release/x-country-block-0.2.0-chrome.zip`.

| Field | Value |
|-------|-------|
| Name, short description | From the manifest |
| Description | Long description (see Shared text), 250 to 10,000 characters |
| Category | Social |
| Extension logo | `store/edge-logo-300.png` |
| Small promo tile | `store/promo-440x280.png` |
| Large promo tile | `store/marquee-1400x560.png` |
| Screenshots | The same five 1280x800 images |
| Privacy policy URL | See Shared text |
| Website | https://github.com/AndreasNE89/x-country-block |
| Support contact | norway4metal@gmail.com |

**Search terms** (7 terms, 16 words, each at most 30 characters)

```
country filter
language filter
account based in
region filter
hide posts
x feed filter
twitter filter
```

---

## Brand assets

| File | Size | Use |
|------|------|-----|
| `store/cws-icon-128.png` | 128x128 | CWS store icon |
| `store/edge-logo-300.png` | 300x300 | Edge logo |
| `store/promo-440x280.png` | 440x280 | CWS small promo tile, Edge small tile |
| `store/marquee-1400x560.png` | 1400x560 | CWS marquee, Edge large tile |
| `store/github-social-1280x640.png` | 1280x640 | GitHub repository social preview |
| `store/lockup.png`, `store/lockup-dark.png` | 1280 wide | README, press |
| `store/screenshot-5-privacy-1280x800.png` | 1280x800 | Screenshot 5 in all stores |

All are generated by `node scripts/render-brand.mjs` from `brand/`.
