# Build instructions (Mozilla AMO reviewers)

Tamis (formerly X Country Block) is written in TypeScript and bundled with
esbuild. This document explains how to rebuild the Firefox add-on submitted
to AMO from the source archive `x-country-block-0.2.0-source.zip`.

## Requirements

| Program | Version |
|---------|---------|
| Operating system | Windows 10+, macOS 12+ or Linux |
| Node.js | 22.x LTS (release built with 22.23.2) |
| npm | 10.x or newer (ships with Node.js 22) |

```bash
node --version   # v22.x
npm --version
```

## Rebuild the Firefox add-on

1. Extract the source archive into an empty folder.

2. Install the exact dependency versions from `package-lock.json`:

   ```bash
   npm ci
   ```

3. Optional: run the checks.

   ```bash
   npm test            # version check + unit tests
   npx tsc --noEmit    # type check
   ```

4. Build:

   ```bash
   npm run build:firefox:prod
   ```

   This runs `node scripts/build.mjs --firefox --prod` and writes:

   - `dist-firefox/`, the unpacked add-on
   - `release/x-country-block-0.2.0-firefox.zip`, the file uploaded to AMO

5. Compare with the submitted file. With the same Node.js version the zip is
   byte-for-byte identical:

   ```bash
   sha256sum release/x-country-block-0.2.0-firefox.zip
   ```

   The compressed bytes come from the zlib bundled with Node.js, so another
   Node.js version can give a zip with different bytes but identical files.
   In that case compare the contents instead:

   ```bash
   mkdir submitted && cd submitted && unzip ../x-country-block-0.2.0-firefox.zip && cd ..
   diff -r submitted dist-firefox
   ```

The package contains exactly these 14 files: `manifest.json`,
`background.js`, `content.js`, `hook.js`, `paid-page.js`, `popup.js`,
`popup.html`, `popup.css` and `icons/icon16.png`, `icon32.png`,
`icon48.png`, `icon64.png`, `icon96.png`, `icon128.png`.

## Why the build is reproducible

`scripts/build.mjs`:

- checks that `package.json`, `package-lock.json`, both manifests, README,
  BUILD and CHANGELOG all name the same version;
- deletes `dist-firefox/` first, so no file from an older build can ship;
- bundles the five entry points in `src/` with esbuild (version pinned in
  `package-lock.json`); `--prod` minifies and turns off the development-only
  Test unlock button;
- copies `manifest.firefox.json` to `manifest.json`, plus the popup HTML and
  CSS with LF line endings, and the six icons;
- fails if the folder holds a file that neither the manifest nor the popup
  references, or misses one they do;
- writes the zip with entries sorted by path and one fixed timestamp
  (1980-01-01 00:00), so the bytes depend only on the file contents.

For an unminified build to read, run `npm run build:firefox`. It writes
`dist-firefox/` only, with no zip.

## Source layout

| Path | Purpose |
|------|---------|
| `src/hook/inject.ts` | Runs in the page (MAIN world) on x.com; reads the GraphQL responses X already receives |
| `src/content/main.ts` | Content script: matches posts, hides or highlights them, reports the badge count |
| `src/background/main.ts` | Background script: toolbar badge, Focus mode unlock after Stripe checkout |
| `src/popup/` | Popup UI |
| `src/shared/` | Matching, settings, GraphQL parsing, country, region and language data |
| `src/paid-page.ts` | Runs on the Stripe success page (the privacy page with `?paid=1`) |
| `manifest.firefox.json` | Firefox manifest (add-on id, data consent) |
| `scripts/build.mjs`, `scripts/lib/` | Build, package check and zip writer |
| `scripts/source-zip.mjs` | Creates this source archive |
| `test/`, `scripts/test/` | Unit tests (vitest) |

The source archive holds only what is needed to rebuild and test the
add-on. Store artwork, brand sources and the GitHub Pages site stay in the
public repository.

## Public repository

Same source: [https://github.com/AndreasNE89/x-country-block](https://github.com/AndreasNE89/x-country-block)
