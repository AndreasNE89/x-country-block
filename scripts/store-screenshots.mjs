// Renders store screenshots 1, 3 and 4 from the real production popup.
//
//   node scripts/store-screenshots.mjs
//
// Builds dist/ with --prod, loads dist/popup.html (popup.js and popup.css
// inlined) under a stubbed extension API seeded with each shot's settings,
// screenshots it at 2x in headless Chrome, and composes it on the 1280x800
// brand canvas as an opaque PNG in store/screenshots/. Each shot first
// checks the popup's own status text, so a popup change that alters what a
// shot shows fails here instead of producing a wrong image.
//
// Like render-brand.mjs it needs Chrome (CHROME_PATH, or a usual install
// path) and network access to Google Fonts for Inter. Screenshot 2 is a
// hand-made capture of x.com and screenshot 5 comes from render-brand.mjs;
// see store/screenshots/README.md.
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { INTER_FONTS, INTER_LINK, parseWordmark, tileMarkup, wordmarkAt } from "./brand/artwork.mjs";
import { withChrome } from "./brand/chrome.mjs";
import { decodePng, encodePng } from "./lib/png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (...parts) => join(root, ...parts);

const WIDTH = 1280;
const HEIGHT = 800;
const POPUP = { width: 340, height: 520 };
const CAPTURE_SCALE = 2;
// Popup CSS px to canvas px.
const SHOW_SCALE = 1.3;
const MINUTE = 60_000;

/**
 * `storage` seeds chrome.storage.local (a function gives a value relative
 * to now), `count` is what the active x.com tab reports, and `expect` is the
 * popup text that proves the state is right before anything is captured.
 * A "\n" in `sub` is a line break.
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

/** dist/popup.html with its stylesheet and script inlined, after the stub. */
function inlinePopup(html, { css, js, stub }) {
  const link = '<link rel="stylesheet" href="popup.css" />';
  const script = '<script src="popup.js"></script>';
  if (!html.includes(link) || !html.includes(script)) {
    throw new Error("dist/popup.html no longer links popup.css and popup.js the expected way");
  }
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  return html
    .replace(link, () => `<style>${css}</style>`)
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
 * One 1280x800 store screenshot: copy on the left; on the right the popup
 * under its toolbar button, and a marigold band (the mark's kept row)
 * running behind it at the height of the ticked rows.
 */
function composition(shot, capture, { wm, icon, ticked }) {
  const theme = THEMES[shot.scheme];
  const popup = {
    width: Math.round(POPUP.width * SHOW_SCALE),
    height: Math.round(POPUP.height * SHOW_SCALE),
  };
  popup.x = WIDTH - 104 - popup.width;
  popup.y = HEIGHT - 34 - popup.height;
  const button = { size: 48, x: popup.x + popup.width - 12 - 48, y: popup.y - 12 - 48 };
  const band = {
    x: popup.x - 64,
    y: popup.y + Math.round(ticked.top * SHOW_SCALE),
    height: Math.round((ticked.bottom - ticked.top) * SHOW_SCALE),
  };
  const sub = shot.sub.split("\n").map(escapeHtml).join("<br>");
  const points = shot.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">${INTER_LINK}<style>
html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:${theme.canvas}}
body{position:relative;font-family:Inter,sans-serif;color:${theme.ink};-webkit-font-smoothing:antialiased}
.brand{position:absolute;left:88px;top:64px}
.brand svg{display:block}
.copy{position:absolute;left:88px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center;padding-top:24px}
h1{margin:0 0 20px;font-weight:600;font-size:48px;line-height:1.1;letter-spacing:-0.015em;text-wrap:balance}
.sub{margin:0;font-weight:500;font-size:21px;line-height:1.45;color:${theme.muted}}
ul{list-style:none;margin:44px 0 0;padding:0}
li{position:relative;padding-left:48px;margin:0 0 20px;font-weight:500;font-size:21px;line-height:1.3}
li:last-child{margin-bottom:0}
li::before{content:"";position:absolute;left:0;top:9px;width:28px;height:10px;border-radius:5px;background:${theme.accent}}
.band{position:absolute;left:${band.x}px;top:${band.y}px;right:0;height:${band.height}px;border-radius:${band.height / 2}px 0 0 ${band.height / 2}px;background:${theme.bandColor};opacity:${theme.band}}
.popup{position:absolute;left:${popup.x}px;top:${popup.y}px;width:${popup.width}px;height:${popup.height}px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px ${theme.frame},${theme.shadow}}
.popup img{display:block;width:100%;height:100%}
.button{position:absolute;left:${button.x}px;top:${button.y}px;width:${button.size}px;height:${button.size}px;border-radius:12px;background:${theme.button};box-shadow:0 0 0 1px ${theme.frame},0 2px 6px rgba(11,51,54,.12)}
.button img{position:absolute;left:8px;top:8px;width:28px;height:28px}
.badge{position:absolute;right:4px;bottom:5px;min-width:17px;height:15px;padding:0 3px;box-sizing:border-box;border-radius:4px;background:#FFB638;color:#14201F;font:600 10px/15px Inter,sans-serif;text-align:center;box-shadow:0 0 0 1.5px ${theme.button}}
.fine{position:absolute;left:88px;bottom:32px;font-weight:500;font-size:14px;color:${theme.muted}}
</style></head><body>
<div class="band"></div>
<div class="brand">${brandMark(wm, theme)}</div>
<div class="copy">
  <h1>${escapeHtml(shot.headline)}</h1>
  <p class="sub">${sub}</p>
  <ul>${points}</ul>
</div>
<div class="button"><img alt="" src="data:image/png;base64,${icon.toString("base64")}"><span class="badge">${shot.count}</span></div>
<div class="popup"><img alt="" src="data:image/png;base64,${capture.toString("base64")}"></div>
<div class="fine">Works on x.com and twitter.com. Not affiliated with or endorsed by X Corp.</div>
</body></html>`;
}

/**
 * Waits for the popup to show the shot's state, opens the shot's tab and
 * returns where the ticked rows sit (popup CSS px).
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

  const ticked = JSON.parse(
    await page.evaluate(`(async () => {
      document.getElementById("tab-${shot.tab}").click();
      document.activeElement?.blur?.();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const rows = [...document.querySelectorAll("#list li.is-on")].map((li) => li.getBoundingClientRect());
      return JSON.stringify({
        selected: document.getElementById("tab-${shot.tab}").getAttribute("aria-selected"),
        top: Math.min(...rows.map((rect) => rect.top)),
        bottom: Math.max(...rows.map((rect) => rect.bottom)),
      });
    })()`),
  );
  if (ticked.selected !== "true") throw new Error(`Screenshot ${shot.n}: the ${shot.tab} tab did not open`);
  if (!Number.isFinite(ticked.top)) throw new Error(`Screenshot ${shot.n}: no ticked row in the ${shot.tab} list`);
  return ticked;
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
    console.log(`Screenshot ${shot.n}: ${shot.headline}`);
    const stub = stubScript({ storage: seed(shot.storage), count: shot.count, version });
    await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: shot.scheme }] });
    await page.load(inlinePopup(html, { css, js, stub }), { ...POPUP, scale: CAPTURE_SCALE });
    const ticked = await settle(page, shot);
    const capture = await page.screenshot(POPUP);

    await page.send("Emulation.setEmulatedMedia", { features: [] });
    await page.load(composition(shot, capture, { wm, icon, ticked }), { width: WIDTH, height: HEIGHT, fonts: INTER_FONTS });
    const png = encodePng(decodePng(await page.screenshot({ width: WIDTH, height: HEIGHT })), { alpha: false });
    const out = at("store/screenshots", `screenshot-${shot.n}-${shot.slug}-1280x800.png`);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, png);
    console.log(`  ${relative(root, out).split("\\").join("/")}`);
  }
});
