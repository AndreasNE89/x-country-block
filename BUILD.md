# Build instructions (Mozilla AMO reviewers)

This document explains how to reproduce the **exact** Firefox add-on file submitted to AMO from the human-readable source in this archive.

## Requirements

| Program | Version |
|---------|---------|
| **Operating system** | Windows 10+, macOS 12+, or Linux (any OS that runs Node.js 20+) |
| **Node.js** | 20.x or newer ([https://nodejs.org](https://nodejs.org)) |
| **npm** | 10.x or newer (included with Node.js 20+) |

Verify:

```bash
node --version   # v20.x or higher
npm --version    # 10.x or higher
```

## Step-by-step: reproduce submitted Firefox build

These steps produce `release/x-country-block-0.1.1-firefox.zip`, which should match the uploaded add-on byte-for-byte (same version `0.1.1` in `package.json`).

1. **Extract** this source archive to a directory.

2. **Install dependencies** (downloads `esbuild`, `typescript`, `vitest`, etc. into `node_modules/`):

   ```bash
   npm install
   ```

3. **Run tests** (optional sanity check):

   ```bash
   npm test
   ```

4. **Build the Firefox add-on** (bundles TypeScript from `src/` into `dist-firefox/`, minifies for production):

   ```bash
   npm run build:firefox:prod
   ```

5. **Output files:**
   - Built extension (unzipped): `dist-firefox/`
   - AMO upload zip: `release/x-country-block-0.1.1-firefox.zip`

6. **Verify:** unzip `release/x-country-block-0.1.1-firefox.zip`. Root must contain `manifest.json`, `background.js`, `content.js`, `hook.js`, `popup.js`, `popup.html`, `popup.css`, `paid-page.js`, and `icons/`.

## Build script

All build steps are executed by:

```bash
node scripts/build.mjs --firefox --prod
```

(`npm run build:firefox:prod` runs the same command.)

The script:

- Bundles entry points in `src/` with **esbuild** (no separate webpack/rollup config)
- Copies `manifest.firefox.json` → `dist-firefox/manifest.json`
- Copies popup HTML/CSS and icons
- Writes `release/x-country-block-<version>-firefox.zip`

## Unminified build (readable JS)

For easier inspection without changing source:

```bash
npm run build:firefox
```

Output: `dist-firefox/` with non-minified JavaScript.

## Source layout

| Path | Purpose |
|------|---------|
| `src/hook/inject.ts` | MAIN-world fetch/XHR hook on x.com |
| `src/content/main.ts` | Content script: filter, hide, badge |
| `src/background/main.ts` | Service worker / background: Stripe unlock, badge |
| `src/popup/` | Popup UI |
| `src/shared/` | Match logic, settings, GraphQL parse, etc. |
| `src/paid-page.ts` | Marks Pro paid after Stripe redirect |
| `manifest.firefox.json` | Firefox manifest (gecko id, data consent) |
| `scripts/build.mjs` | Build script |

## Public repository

Same source: [https://github.com/AndreasNE89/x-country-block](https://github.com/AndreasNE89/x-country-block)
