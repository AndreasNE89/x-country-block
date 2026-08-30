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

Uses data X already sent: tweet language, account language, "account based in", profile location (country name, alias, ISO code, major city). No extra API calls. No signal = tweet stays.
