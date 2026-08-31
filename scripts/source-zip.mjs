import { deflateRawSync } from "node:zlib";
import { mkdir, readFile, readdir, stat, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

const includeDirs = ["src", "scripts", "test", "icons", "docs"];
const includeFiles = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
  "manifest.json",
  "manifest.firefox.json",
  "README.md",
  "BUILD.md",
];

const releaseDir = join(root, "release");
await mkdir(releaseDir, { recursive: true });
const zipName = `x-country-block-${pkg.version}-source.zip`;
const zipPath = join(releaseDir, zipName);

const files = [];
for (const dir of includeDirs) {
  await collect(join(root, dir), root, files);
}
for (const name of includeFiles) {
  await addFile(join(root, name), root, files);
}

await writeRootZip(files, zipPath);
console.log(`Source zip (${files.length} files): ${zipPath}`);

async function collect(dir, rootDir, out) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) await collect(full, rootDir, out);
    else out.push({ full, rel: full.slice(rootDir.length + 1).split("\\").join("/") });
  }
}

async function addFile(full, rootDir, out) {
  try {
    await stat(full);
    out.push({ full, rel: full.slice(rootDir.length + 1).split("\\").join("/") });
  } catch {
    console.warn(`Skip missing: ${full}`);
  }
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function writeRootZip(entries, zipPath) {
  try {
    await unlink(zipPath);
  } catch {
    // no previous zip
  }
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { full, rel } of entries) {
    const data = await readFile(full);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const nameBuf = Buffer.from(rel, "utf8");
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
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centrals.reduce((n, b) => n + b.length, 0), 12);
  eocd.writeUInt32LE(offset, 16);
  await writeFile(zipPath, Buffer.concat([...locals, ...centrals, eocd]));
}
