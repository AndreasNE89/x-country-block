// Packs what an AMO reviewer needs to rebuild the Firefox zip, and nothing
// else: no planning docs, store art, brand sources or GitHub Pages files.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGED_ICONS } from "./lib/package-files.mjs";
import { assertVersions } from "./lib/versions.mjs";
import { createZip, listFiles } from "./lib/zip.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = await assertVersions(root);

const includeDirs = ["src", "test", "scripts/lib", "scripts/test"];
const includeFiles = [
  "scripts/build.mjs",
  "scripts/check-version.mjs",
  "scripts/source-zip.mjs",
  ...PACKAGED_ICONS.map((file) => `icons/${file}`),
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
  "manifest.json",
  "manifest.firefox.json",
  "README.md",
  "BUILD.md",
  "CHANGELOG.md",
];

const paths = [...includeFiles];
for (const dir of includeDirs) {
  for (const file of await listFiles(join(root, dir))) paths.push(`${dir}/${file}`);
}
const entries = await Promise.all(paths.map(async (name) => ({ name, data: await readFile(join(root, name)) })));

const releaseDir = join(root, "release");
await mkdir(releaseDir, { recursive: true });
const zipPath = join(releaseDir, `x-country-block-${version}-source.zip`);
await writeFile(zipPath, createZip(entries));
console.log(`Source zip (${entries.length} files): ${zipPath}`);
