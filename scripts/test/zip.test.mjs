// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as zlib from "node:zlib";
import { createZip, crc32, listFiles } from "../lib/zip.mjs";

/** Minimal reader: walks the central directory, as unzip and AMO do. */
function readZip(buf) {
  const eocd = buf.length - 22;
  expect(buf.readUInt32LE(eocd)).toBe(0x06054b50);
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    expect(buf.readUInt32LE(at)).toBe(0x02014b50);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    expect(buf.readUInt32LE(localAt)).toBe(0x04034b50);
    const localNameLen = buf.readUInt16LE(localAt + 26);
    const localExtraLen = buf.readUInt16LE(localAt + 28);
    const size = buf.readUInt32LE(at + 20);
    const start = localAt + 30 + localNameLen + localExtraLen;
    const data = zlib.inflateRawSync(buf.subarray(start, start + size));
    entries.push({
      name,
      data,
      crc: buf.readUInt32LE(at + 16),
      localTime: buf.readUInt16LE(localAt + 10),
      localDate: buf.readUInt16LE(localAt + 12),
      centralTime: buf.readUInt16LE(at + 12),
      centralDate: buf.readUInt16LE(at + 14),
    });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const files = [
  { name: "popup.js", data: Buffer.from("console.log(1);\n") },
  { name: "icons/icon16.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  { name: "manifest.json", data: Buffer.from('{"version":"0.2.0"}\n') },
  { name: "empty.txt", data: Buffer.alloc(0) },
];

describe("createZip", () => {
  it("round-trips every file with a correct CRC", () => {
    const entries = readZip(createZip(files));
    for (const file of files) {
      const entry = entries.find((e) => e.name === file.name);
      expect(entry.data.equals(file.data)).toBe(true);
      expect(entry.crc).toBe(crc32(file.data));
    }
  });

  it("orders entries by path whatever order they arrive in", () => {
    const names = readZip(createZip(files)).map((e) => e.name);
    expect(names).toEqual(["empty.txt", "icons/icon16.png", "manifest.json", "popup.js"]);
  });

  it("gives identical bytes for identical input", () => {
    expect(createZip(files).equals(createZip([...files].reverse()))).toBe(true);
  });

  it("stamps a valid fixed DOS date (1980-01-01 00:00), not the invalid 1980-00-00", () => {
    for (const entry of readZip(createZip(files))) {
      expect(entry.localDate).toBe(0x0021);
      expect(entry.centralDate).toBe(0x0021);
      expect(entry.localTime).toBe(0);
      expect(entry.centralTime).toBe(0);
    }
  });

  it("rejects duplicate paths", () => {
    expect(() => createZip([files[0], files[0]])).toThrow(/duplicate/i);
  });
});

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });
});

describe("listFiles", () => {
  it("returns sorted posix paths relative to the folder", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tamis-zip-"));
    try {
      await mkdir(join(dir, "icons"));
      await writeFile(join(dir, "popup.js"), "");
      await writeFile(join(dir, "icons", "b.png"), "");
      await writeFile(join(dir, "icons", "a.png"), "");
      await writeFile(join(dir, "Background.js"), "");
      expect(await listFiles(dir)).toEqual(["Background.js", "icons/a.png", "icons/b.png", "popup.js"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
