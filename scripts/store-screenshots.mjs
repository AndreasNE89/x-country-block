// Renders the five store screenshots in one layout.
//
//   node scripts/store-screenshots.mjs
//
// Builds dist/ with --prod. Screenshots 1, 3, 4 and 5 load dist/popup.html
// (popup.js and popup.css inlined) under a stubbed extension API seeded
// with each shot's settings, capture it at 2x in headless Chrome, and place
// it on the 1280x800 brand canvas. Each first checks the popup's own status
// text, so a popup change that alters what a shot shows fails here instead
// of producing a wrong image. Screenshot 2 places your blurred capture of
// x.com (store/screenshots/highlight-capture.png) on the same canvas, and is
// skipped until that file exists. Output: opaque PNGs in store/screenshots/.
//
// Like render-brand.mjs it needs Chrome (CHROME_PATH, or a usual install
// path) and network access to Google Fonts for Inter. See
// store/screenshots/README.md.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { INTER_FONTS, INTER_LINK, parseWordmark, tileMarkup, wordmarkAt } from "./brand/artwork.mjs";
import { withChrome } from "./brand/chrome.mjs";
import { decodePng, encodePng } from "./lib/png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (...parts) => join(root, ...parts);
const show = (path) => relative(root, path).split("\\").join("/");

const WIDTH = 1280;
const HEIGHT = 800;
const POPUP = { width: 340, height: 520 };
const CAPTURE_SCALE = 2;
// Popup CSS px to canvas px.
const SHOW_SCALE = 1.3;
const MINUTE = 60_000;
const FINE_PRINT = "Works on x.com and twitter.com. Not affiliated with or endorsed by X Corp.";
// Where screenshot 2's capture sits: right of the copy column, clear of the fine print.
const CAPTURE_BOX = { left: 640, top: 40, right: WIDTH - 40, bottom: HEIGHT - 40 };
// What the band runs behind: the ticked rows, or the privacy line at the foot of the popup.
const BAND_TARGETS = { ticked: "#list li.is-on", footer: "body > footer" };

/**
 * Popup shots: `storage` seeds chrome.storage.local (a function gives a
 * value relative to now), `count` is what the active x.com tab reports,
 * `expect` is the popup text that proves the state is right before anything
 * is captured, `band` picks what the band runs behind, and `focus` is the
 * id of a control that must show its keyboard focus ring. Screenshot 2 has
 * a `capture` file instead. A "\n" in `sub` is a line break.
 */
const SHOTS = [
  {
    n: 1,
    slug: "languages",
    scheme: "light",
    headline: "Your feed, in the languages you read.",
    sub: "Hide posts in languages you don't read. Free.",
    points: ["The 69 languages X detects, with search", "The badge counts what is filtered", "Pause anytime, keep your picks"],
    storage: { hiddenLanguageCodes: ["ja", "pt"], filterMode: "hide" },
    tab: "languages",
    count: 14,
    expect: { status: "Hiding Japanese, Portuguese", count: "14 on this tab" },
  },
  {
    n: 2,
    slug: "highlight",
    scheme: "light",
    headline: "Highlight first. Hide when you're sure.",
    sub: "See exactly what matched, and why. Free.",
    points: ["An outline and a note on each match", "“Always show @handle” in one tap", "Only you see the notes"],
    capture: "store/screenshots/highlight-capture.png",
    fine: "Accounts blurred for privacy. Not affiliated with or endorsed by X Corp.",
  },
  {
    n: 3,
    slug: "focus",
    scheme: "light",
    headline: "Focus mode: only the places you pick.",
    sub: "Great for local news and match day.\n$5.99 once · 7-day free trial.",
    points: ["Mix countries, regions and languages", "Everything else folds to one line", "No subscription, no Tamis account"],
    storage: {
      hiddenCountryCodes: ["NO"],
      hiddenLanguageCodes: ["no"],
      filterMode: "only",
      trialStartedAt: () => Date.now() - MINUTE,
    },
    tab: "countries",
    count: 38,
    expect: { status: "Showing only Norway, Norwegian", count: "38 set aside", trial: "Trial · 7 days left" },
  },
  {
    n: 4,
    slug: "regions",
    scheme: "dark",
    headline: "One tick covers a whole region.",
    sub: "Uses the “Account based in” label X shows.\nIt can be wrong for VPN users and travellers.",
    points: ["20 regions, from Europe to Oceania", "Light and dark, like your browser", "Mix with countries and languages"],
    storage: { hiddenRegionIds: ["EUROPE"], filterMode: "only", onlyShowPaid: true },
    tab: "regions",
    count: 23,
    expect: { status: "Showing only Europe", count: "23 set aside" },
  },
  {
    n: 5,
    slug: "privacy",
    scheme: "light",
    headline: "Private by design.",
    sub: "Tamis only uses what X already loaded in your tab.",
    points: [
      "Runs in your browser",
      "No extra requests to X",
      "No Tamis account, no analytics",
      "No flags on anyone's name",
      "Pause anytime",
    ],
    storage: { hiddenLanguageCodes: ["ja", "pt"], filterMode: "hide", markOnly: true },
    tab: "languages",
    count: 14,
    expect: { status: "Highlighting matches for Japanese, Portuguese", count: "14 on this tab" },
    band: "footer",
    focus: "enabled",
  },
];

// Brand palette (brand/README.md); dark uses the popup's dark tokens.
const THEMES = {
  light: {
    canvas: "#F3F6F6",
    ink: "#14201F",
    muted: "#56686A",
    accent: "#FFB638",
    bandColor: "#FFB638",
    band: 0.34,
    button: "#FFFFFF",
    frame: "rgba(20,32,31,.10)",
    shadow: "0 2px 4px rgba(11,51,54,.10),0 18px 48px rgba(11,51,54,.16)",
    tile: {},
    word: "#14201F",
    dot: "#FFB638",
  },
  dark: {
    canvas: "#0D1113",
    ink: "#E8EFEF",
    muted: "#9DB2B3",
    accent: "#FFC45C",
    // Marigold fades to brown on near-black, so the dark band is teal.
    bandColor: "#5CC3C8",
    band: 0.16,
    button: "#1E2428",
    frame: "#2E3739",
    shadow: "0 2px 4px rgba(0,0,0,.4),0 18px 48px rgba(0,0,0,.5)",
    // The lighter tile the dark lockup uses (brand/lockup-dark.svg).
    tile: { top: "#3AA3A8", bottom: "#21747A" },
    word: "#E8EFEF",
    dot: "#FFC45C",
  },
};

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pngSrc = (png) => `data:image/png;base64,${png.toString("base64")}`;

/** A stand-in for the extension APIs the popup uses, seeded with one shot's state. */
function stubScript({ storage, count, version }) {
  return `<script>
(() => {
  const data = ${JSON.stringify(storage)};
  const listeners = [];
  window.__shotErrors = [];
  window.addEventListener("error", (event) => window.__shotErrors.push(String(event.message)));
  window.addEventListener("unhandledrejection", (event) => window.__shotErrors.push(String(event.reason)));
  const local = {
    get: async (keys) => {
      const out = {};
      const wanted = keys == null ? Object.keys(data) : [].concat(keys);
      for (const key of wanted) if (key in data) out[key] = structuredClone(data[key]);
      return out;
    },
    set: async (items) => {
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: value };
        data[key] = structuredClone(value);
      }
      for (const listener of listeners) listener(changes, "local");
    },
    remove: async (keys) => {
      for (const key of [].concat(keys)) delete data[key];
    },
    onChanged: { addListener: (listener) => listeners.push(listener), removeListener() {} },
  };
  const tab = { id: 1, url: "https://x.com/search?q=football&f=live", active: true };
  const events = { addListener() {}, removeListener() {} };
  window.chrome = {
    storage: { local, sync: { get: async () => ({}), remove: async () => {} }, onChanged: events },
    action: { getBadgeText: async () => ${JSON.stringify(String(count))}, setBadgeText: async () => {} },
    runtime: {
      id: "store-screenshots",
      getManifest: () => ({ version: ${JSON.stringify(version)}, name: "Tamis" }),
      getURL: (path) => path,
      sendMessage: async () => ({ ok: true }),
      onMessage: events,
    },
    tabs: {
      query: async () => [tab],
      sendMessage: async () => ({ ok: true, count: ${Number(count)}, version: ${JSON.stringify(version)} }),
      reload: async () => {},
      create: async () => ({}),
    },
    permissions: { contains: async () => true, request: async () => true },
  };
})();
</script>`;
}

// Puts each part of the popup on its own transparent layer, so Chrome draws
// its text with greyscale antialiasing, as on the canvas, instead of
// coloured subpixel fringes that depend on the machine. Nothing moves.
const GREYSCALE_TEXT = "body>*{will-change:transform}";

/** dist/popup.html with its stylesheet and script inlined, after the stub. */
function inlinePopup(html, { css, js, stub }) {
  const link = '<link rel="stylesheet" href="popup.css" />';
  const script = '<script src="popup.js"></script>';
  if (!html.includes(link) || !html.includes(script)) {
    throw new Error("dist/popup.html no longer links popup.css and popup.js the expected way");
  }
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  return html
    .replace(link, () => `<style>${css}\n${GREYSCALE_TEXT}</style>`)
    .replace(script, () => `${stub}\n<script>${safeJs}</script>`);
}

/** Resolves storage values given as functions. */
function seed(storage) {
  return Object.fromEntries(Object.entries(storage).map(([key, value]) => [key, typeof value === "function" ? value() : value]));
}

/** Tile mark and wordmark from brand/, side by side. */
function brandMark(wm, theme) {
  const tile = 52;
  const cap = 25;
  const word = wordmarkAt(wm, { x: tile + 16, y: tile / 2 + cap / 2, cap, color: theme.word, dot: theme.dot });
  const width = Math.ceil(word.box.right);
  return `<svg width="${width}" height="${tile}" viewBox="0 0 ${width} ${tile}" aria-hidden="true">${tileMarkup({ id: "brand", x: 0, y: 0, size: tile, ...theme.tile })}${word.markup}</svg>`;
}

/**
 * The right half of a popup shot: the popup under its toolbar button, and
 * a band in the mark's kept-row colour running behind it at the height of
 * `band` (popup CSS px).
 */
function popupSide(shot, theme, capture, { icon, band }) {
  const popup = {
    width: Math.round(POPUP.width * SHOW_SCALE),
    height: Math.round(POPUP.height * SHOW_SCALE),
  };
  popup.x = WIDTH - 104 - popup.width;
  popup.y = HEIGHT - 34 - popup.height;
  const button = { size: 48, x: popup.x + popup.width - 12 - 48, y: popup.y - 12 - 48 };
  const strip = {
    x: popup.x - 64,
    y: popup.y + Math.round(band.top * SHOW_SCALE),
    height: Math.round((band.bottom - band.top) * SHOW_SCALE),
  };
  return {
    css: `.band{position:absolute;left:${strip.x}px;top:${strip.y}px;right:0;height:${strip.height}px;border-radius:${strip.height / 2}px 0 0 ${strip.height / 2}px;background:${theme.bandColor};opacity:${theme.band}}
.popup{position:absolute;left:${popup.x}px;top:${popup.y}px;width:${popup.width}px;height:${popup.height}px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px ${theme.frame},${theme.shadow}}
.popup img{display:block;width:100%;height:100%}
.button{position:absolute;left:${button.x}px;top:${button.y}px;width:${button.size}px;height:${button.size}px;border-radius:12px;background:${theme.button};box-shadow:0 0 0 1px ${theme.frame},0 2px 6px rgba(11,51,54,.12)}
.button img{position:absolute;left:8px;top:8px;width:28px;height:28px}
.badge{position:absolute;right:4px;bottom:5px;min-width:17px;height:15px;padding:0 3px;box-sizing:border-box;border-radius:4px;background:#FFB638;color:#14201F;font:600 10px/15px Inter,sans-serif;text-align:center;box-shadow:0 0 0 1.5px ${theme.button}}`,
    under: `<div class="band"></div>`,
    over: `<div class="button"><img alt="" src="${pngSrc(icon)}"><span class="badge">${shot.count}</span></div>
<div class="popup"><img alt="" src="${pngSrc(capture)}"></div>`,
  };
}

/** The right half of screenshot 2: your capture, at most 1x, fitted into CAPTURE_BOX. */
function captureSide(theme, capture) {
  const { width, height } = decodePng(capture);
  const box = { width: CAPTURE_BOX.right - CAPTURE_BOX.left, height: CAPTURE_BOX.bottom - CAPTURE_BOX.top };
  const scale = Math.min(box.width / width, box.height / height, 1 / CAPTURE_SCALE);
  const shown = { width: Math.round(width * scale), height: Math.round(height * scale) };
  const x = CAPTURE_BOX.left + Math.round((box.width - shown.width) / 2);
  const y = CAPTURE_BOX.top + Math.round((box.height - shown.height) / 2);
  return {
    scale,
    css: `.capture{position:absolute;left:${x}px;top:${y}px;width:${shown.width}px;height:${shown.height}px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px ${theme.frame},${theme.shadow}}
.capture img{display:block;width:100%;height:100%}`,
    under: "",
    over: `<div class="capture"><img alt="" src="${pngSrc(capture)}"></div>`,
  };
}

/**
 * One 1280x800 store screenshot: the Tamis mark and wordmark at the top
 * left, the headline, sub-line and points centred on the left, the fine
 * print at the bottom left, and `side` on the right. Text sits on its own
 * transparent layer (will-change) so Chrome draws it with greyscale
 * antialiasing instead of coloured subpixel fringes.
 */
function composition(shot, side, { wm }) {
  const theme = THEMES[shot.scheme];
  const sub = shot.sub.split("\n").map(escapeHtml).join("<br>");
  const points = shot.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">${INTER_LINK}<style>
html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:${theme.canvas}}
body{position:relative;font-family:Inter,sans-serif;color:${theme.ink};-webkit-font-smoothing:antialiased}
.brand,.copy,.fine,.badge{will-change:transform}
.brand{position:absolute;left:88px;top:64px}
.brand svg{display:block}
.copy{position:absolute;left:88px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center;padding-top:24px}
h1{margin:0 0 20px;font-weight:600;font-size:48px;line-height:1.1;letter-spacing:-0.015em;text-wrap:balance}
.sub{margin:0;font-weight:500;font-size:21px;line-height:1.45;color:${theme.muted}}
ul{list-style:none;margin:44px 0 0;padding:0}
li{position:relative;padding-left:48px;margin:0 0 20px;font-weight:500;font-size:21px;line-height:1.3}
li:last-child{margin-bottom:0}
li::before{content:"";position:absolute;left:0;top:9px;width:28px;height:10px;border-radius:5px;background:${theme.accent}}
${side.css}
.fine{position:absolute;left:88px;bottom:32px;font-weight:500;font-size:14px;color:${theme.muted}}
</style></head><body>
${side.under}
<div class="brand">${brandMark(wm, theme)}</div>
<div class="copy">
  <h1>${escapeHtml(shot.headline)}</h1>
  <p class="sub">${sub}</p>
  <ul>${points}</ul>
</div>
${side.over}
<div class="fine">${escapeHtml(shot.fine ?? FINE_PRINT)}</div>
</body></html>`;
}

/**
 * Waits for the popup to show the shot's state, opens the shot's tab,
 * focuses `shot.focus` if set, and returns where the band's target sits
 * (popup CSS px).
 */
async function settle(page, shot) {
  const read = () =>
    page.evaluate(`(() => {
      const text = (id) => document.getElementById(id)?.textContent.trim() ?? null;
      const shown = (id) => { const node = document.getElementById(id); return node && !node.hidden ? text(id) : null; };
      const test = document.getElementById("pro-test");
      return JSON.stringify({
        busy: document.body.hasAttribute("aria-busy"),
        status: text("status"),
        count: shown("status-count"),
        trial: shown("trial-row") === null ? null : text("trial-chip"),
        card: !document.getElementById("pro-card").hidden,
        test: Boolean(test) && !test.hidden,
        errors: window.__shotErrors,
      });
    })()`);
  const want = { trial: null, ...shot.expect };
  let state = null;
  for (let tries = 0; tries < 50; tries += 1) {
    state = JSON.parse(await read());
    if (state.errors.length > 0) throw new Error(`Screenshot ${shot.n}: popup error: ${state.errors.join("; ")}`);
    if (!state.busy && state.status === want.status && state.count === want.count && state.trial === want.trial) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const problems = [];
  if (state.status !== want.status) problems.push(`status "${state.status}", expected "${want.status}"`);
  if (state.count !== want.count) problems.push(`count "${state.count}", expected "${want.count}"`);
  if (state.trial !== want.trial) problems.push(`trial chip "${state.trial}", expected "${want.trial}"`);
  if (state.card) problems.push("the Focus mode offer card is open");
  if (state.test) problems.push("the development-only Test unlock button is visible");
  if (problems.length > 0) throw new Error(`Screenshot ${shot.n} shows the wrong state: ${problems.join("; ")}`);

  const focus = shot.focus ? JSON.stringify(shot.focus) : "null";
  const band = JSON.parse(
    await page.evaluate(`(async () => {
      document.getElementById("tab-${shot.tab}").click();
      document.activeElement?.blur?.();
      const focus = ${focus} && document.getElementById(${focus});
      focus?.focus();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const rects = [...document.querySelectorAll(${JSON.stringify(BAND_TARGETS[shot.band ?? "ticked"])})].map((node) => node.getBoundingClientRect());
      return JSON.stringify({
        selected: document.getElementById("tab-${shot.tab}").getAttribute("aria-selected"),
        ring: focus ? focus.matches(":focus-visible") && getComputedStyle(focus).outlineStyle !== "none" : null,
        top: Math.min(...rects.map((rect) => rect.top)),
        bottom: Math.max(...rects.map((rect) => rect.bottom)),
      });
    })()`),
  );
  if (band.selected !== "true") throw new Error(`Screenshot ${shot.n}: the ${shot.tab} tab did not open`);
  if (shot.focus && band.ring !== true) throw new Error(`Screenshot ${shot.n}: #${shot.focus} shows no focus ring`);
  if (!Number.isFinite(band.top)) throw new Error(`Screenshot ${shot.n}: nothing to put the band behind (${shot.band ?? "ticked"})`);
  return band;
}

console.log("Production build");
const build = spawnSync(process.execPath, [at("scripts/build.mjs"), "--prod"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const version = JSON.parse(await readFile(at("package.json"), "utf8")).version;
const [html, css, js] = await Promise.all(["popup.html", "popup.css", "popup.js"].map((file) => readFile(at("dist", file), "utf8")));
const wm = parseWordmark(await readFile(at("brand/wordmark.svg"), "utf8"));
const icon = await readFile(at("dist/icons/icon48.png"));

await withChrome(async (page) => {
  for (const shot of SHOTS) {
    let side;
    if (shot.capture) {
      const file = at(shot.capture);
      if (!existsSync(file)) {
        console.log(`Screenshot ${shot.n} skipped: save your capture as ${shot.capture} first`);
        continue;
      }
      side = captureSide(THEMES[shot.scheme], await readFile(file));
      console.log(`Screenshot ${shot.n}: ${shot.headline} (${show(file)} at ${Math.round(side.scale * CAPTURE_SCALE * 100)}%)`);
    } else {
      console.log(`Screenshot ${shot.n}: ${shot.headline}`);
      const stub = stubScript({ storage: seed(shot.storage), count: shot.count, version });
      await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: shot.scheme }] });
      await page.load(inlinePopup(html, { css, js, stub }), { ...POPUP, scale: CAPTURE_SCALE });
      const band = await settle(page, shot);
      const capture = await page.screenshot(POPUP);
      await page.send("Emulation.setEmulatedMedia", { features: [] });
      side = popupSide(shot, THEMES[shot.scheme], capture, { icon, band });
    }

    await page.load(composition(shot, side, { wm }), { width: WIDTH, height: HEIGHT, fonts: INTER_FONTS });
    const png = encodePng(decodePng(await page.screenshot({ width: WIDTH, height: HEIGHT })), { alpha: false });
    const out = at("store/screenshots", `screenshot-${shot.n}-${shot.slug}-1280x800.png`);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, png);
    console.log(`  ${show(out)}`);
  }
});
