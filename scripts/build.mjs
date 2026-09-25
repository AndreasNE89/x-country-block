import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { PACKAGED_ICONS, compareFiles, manifestFiles, pageRefs } from "./lib/package-files.mjs";
import { assertVersions } from "./lib/versions.mjs";
import { createZip, listFiles } from "./lib/zip.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prod = process.argv.includes("--prod");
const firefox = process.argv.includes("--firefox");
const target = firefox ? "firefox" : "chrome";
const dist = join(root, firefox ? "dist-firefox" : "dist");
const manifestName = firefox ? "manifest.firefox.json" : "manifest.json";

const version = await assertVersions(root);

// Start from an empty folder so nothing from an older build can ship.
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "icons"), { recursive: true });

await esbuild.build({
  entryPoints: {
    hook: join(root, "src/hook/inject.ts"),
    content: join(root, "src/content/main.ts"),
    popup: join(root, "src/popup/popup.ts"),
    background: join(root, "src/background/main.ts"),
    "paid-page": join(root, "src/paid-page.ts"),
  },
  outdir: dist,
  bundle: true,
  minify: prod,
  format: "iife",
  platform: "browser",
  target: ["chrome120", "firefox128"],
  define: { __XCB_PROD__: prod ? "true" : "false" },
  logLevel: "info",
});

// Text files get LF endings so a Windows checkout (autocrlf) and a Linux
// checkout produce the same package bytes.
const copyText = async (from, to) =>
  writeFile(join(dist, to), (await readFile(join(root, from), "utf8")).replace(/\r\n/g, "\n"));

await copyText(manifestName, "manifest.json");
await copyText("src/popup/popup.html", "popup.html");
await copyText("src/popup/popup.css", "popup.css");
for (const file of PACKAGED_ICONS) {
  await copyFile(join(root, "icons", file), join(dist, "icons", file));
}

const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
const expected = [
  ...manifestFiles(manifest),
  ...pageRefs(await readFile(join(dist, "popup.html"), "utf8")),
];
const files = await listFiles(dist);
const { extra, missing } = compareFiles(files, expected);
if (extra.length > 0 || missing.length > 0) {
  throw new Error(
    `Package check failed in ${dist}\n` +
      (extra.length > 0 ? `  not referenced by the manifest or popup: ${extra.join(", ")}\n` : "") +
      (missing.length > 0 ? `  referenced but not built: ${missing.join(", ")}\n` : ""),
  );
}

const label = firefox ? "Firefox" : "Chrome";
console.log(`${label} ${prod ? "production" : "development"} build ${version}: ${dist}`);
if (!prod) console.log("Development build: shows the Test unlock button. Never upload it.");

if (prod) {
  // The dev-only Test unlock must never reach a store package.
  for (const name of ["popup.html", "popup.js"]) {
    const text = await readFile(join(dist, name), "utf8");
    if (text.includes("pro-test") || text.includes("Test unlock")) {
      throw new Error(`Production ${name} still contains the dev-only Test unlock.`);
    }
  }
  const releaseDir = join(root, "release");
  await mkdir(releaseDir, { recursive: true });
  const zipPath = join(releaseDir, `x-country-block-${version}-${target}.zip`);
  const entries = await Promise.all(files.map(async (name) => ({ name, data: await readFile(join(dist, name)) })));
  await writeFile(zipPath, createZip(entries));
  const store = firefox ? "AMO upload" : "Chrome Web Store / Edge upload";
  console.log(`${label} zip (${store}): ${zipPath}`);
}
