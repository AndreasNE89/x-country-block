// Which files belong in a built extension package, so the build can refuse
// to zip leftovers (0.1.2 shipped a stale extpay-page.js) or broken refs.

/** Icons copied into the package (icons/icon512.png stays out). */
export const PACKAGED_ICONS = ["icon16.png", "icon32.png", "icon48.png", "icon64.png", "icon96.png", "icon128.png"];

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const clean = (path) => path.replace(/^\.\//, "");

/** manifest.json plus every file it points at, sorted. */
export function manifestFiles(manifest) {
  const files = new Set(["manifest.json"]);
  const add = (path) => {
    if (typeof path === "string") files.add(clean(path));
  };
  const background = manifest.background ?? {};
  add(background.service_worker);
  add(background.page);
  for (const script of background.scripts ?? []) add(script);
  for (const entry of manifest.content_scripts ?? []) {
    for (const path of [...(entry.js ?? []), ...(entry.css ?? [])]) add(path);
  }
  add(manifest.action?.default_popup);
  add(manifest.options_ui?.page);
  for (const path of Object.values(manifest.icons ?? {})) add(path);
  for (const path of Object.values(manifest.action?.default_icon ?? {})) add(path);
  return [...files].sort(byPath);
}

/** Local files an extension page loads through src or href. */
export function pageRefs(html) {
  const refs = new Set();
  for (const [, path] of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)) {
    if (/^[a-z][a-z0-9+.-]*:|^#|^\/\//i.test(path)) continue;
    refs.add(clean(path.split(/[?#]/)[0]));
  }
  return [...refs].sort(byPath);
}

/** Files present but not expected, and expected but not present. */
export function compareFiles(actual, expected) {
  const have = new Set(actual);
  const want = new Set(expected);
  return {
    extra: [...have].filter((path) => !want.has(path)).sort(byPath),
    missing: [...want].filter((path) => !have.has(path)).sort(byPath),
  };
}
