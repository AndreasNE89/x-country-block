# X Country Block

Browser extension for Chrome and Firefox. Block posts on x.com / twitter.com from countries, regions, and languages you choose.

## Develop

```bash
npm install
npm test
npm run build
```

## Load unpacked

Chrome / Edge: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist-firefox/manifest.json`. Requires Firefox 140+ (AMO data-consent + background scripts fallback).

Build Firefox only:

```bash
npm run build:firefox
```

AMO upload zip (minified):

```bash
npm run build:firefox:prod
```

Output: `release/x-country-block-0.1.0-firefox.zip`

## AMO source code submission

Mozilla reviewers: see **[BUILD.md](BUILD.md)** for step-by-step instructions to reproduce the submitted add-on.

Pack source for upload:

```bash
npm run source:zip
```

Output: `release/x-country-block-0.1.0-source.zip` (TypeScript source, build scripts, no `node_modules/` or built JS).

Open x.com, open the popup. Check a country, a region (South Asia, West Asia, Asia, …), or a language. Matching cards disappear. Tick **Only show posts from ticked items** to invert: keep those, hide the rest. Uncheck: they come back without refresh.

## How it decides

Uses data X already sent: tweet language, account language, “account based in”, profile location (country name, alias, ISO code, major city, or region words like “South Asia”). A region tick also covers every country in that region. No extra API calls. No signal = tweet stays.
