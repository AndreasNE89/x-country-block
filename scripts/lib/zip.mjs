import { deflateRawSync } from "node:zlib";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

// Every entry gets the same timestamp, 1980-01-01 00:00 (the earliest valid
// DOS date), so the zip bytes depend only on paths and contents.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const VERSION = 20; // 2.0: deflate, no zip64
const DEFLATE = 8;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A zip of `entries` ({ name, data }) with forward-slash paths, sorted by
 * path, deflated, and stamped with one fixed date: identical input gives
 * identical bytes on every OS.
 */
export function createZip(entries) {
  const sorted = [...entries].sort((a, b) => byPath(a.name, b.name));
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].name === sorted[i - 1].name) throw new Error(`Duplicate zip path: ${sorted[i].name}`);
  }
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of sorted) {
    const nameBuf = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(DEFLATE, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4); // made by: MS-DOS attributes, spec 2.0
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(DEFLATE, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // extra, comment, disk, internal and external attributes stay 0
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBuf, compressed);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(sorted.length, 8);
  eocd.writeUInt16LE(sorted.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, eocd]);
}

/** Files under `dir`, as sorted forward-slash paths relative to it. */
export async function listFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split("\\").join("/"))
    .sort(byPath);
}
