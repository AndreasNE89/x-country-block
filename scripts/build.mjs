import { deflateRawSync } from "node:zlib";
import { mkdir, copyFile, readFile, readdir, stat, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { assertVersions } from "./lib/versions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prod = process.argv.includes("--prod");
const firefox = process.argv.includes("--firefox");
const dist = join(root, firefox ? "dist-firefox" : "dist");
const manifestName = firefox ? "manifest.firefox.json" : "manifest.json";
const pkg = { version: await assertVersions(root) };

await mkdir(dist, { recursive: true });

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

await copyFile(join(root, manifestName), join(dist, "manifest.json"));
await copyFile(join(root, "src/popup/popup.html"), join(dist, "popup.html"));
await copyFile(join(root, "src/popup/popup.css"), join(dist, "popup.css"));
const iconsDir = join(dist, "icons");
await mkdir(iconsDir, { recursive: true });
for (const file of ["icon16.png", "icon32.png", "icon48.png", "icon64.png", "icon96.png", "icon128.png"]) {
  await copyFile(join(root, "icons", file), join(iconsDir, file));
}

if (!firefox) {
  for (const file of ["hook.js", "content.js", "popup.js", "popup.html", "popup.css", "background.js", "paid-page.js"]) {
    await copyFile(join(dist, file), join(root, file));
  }
}

if (prod) {
  const releaseDir = join(root, "release");
  await mkdir(releaseDir, { recursive: true });
  const suffix = firefox ? "firefox" : "review";
  const zipName = `x-country-block-${pkg.version}-${suffix}.zip`;
  const zipPath = join(releaseDir, zipName);
  await writeRootZip(dist, zipPath);
  console.log(`Review zip: ${zipPath}`);
}

console.log(firefox ? `Firefox build: ${dist}` : `Chrome build: ${dist}`);

async function listFiles(dir, base = dir, out = []) {
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) await listFiles(full, base, out);
    else out.push(full);
  }
  return out;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function writeRootZip(dir, zipPath) {
  try {
    await unlink(zipPath);
  } catch {
    // no previous zip
  }
  const files = await listFiles(dir);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const full of files) {
    const name = full.slice(dir.length + 1).split("\\").join("/");
    const data = await readFile(full);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, compressed);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centrals.reduce((n, b) => n + b.length, 0), 12);
  eocd.writeUInt32LE(offset, 16);
  await writeFile(zipPath, Buffer.concat([...locals, ...centrals, eocd]));
}
