// Just enough PNG to inspect Chrome's screenshots and re-encode them:
// 8-bit RGB or RGBA, not interlaced.
import { deflateSync, inflateSync } from "node:zlib";
import { crc32 } from "./zip.mjs";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** { width, height, data } with data as RGBA bytes. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG");
  let at = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (at < buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colorType = body[9];
      if (body[8] !== 8 || body[12] !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`Unsupported PNG (depth ${body[8]}, color type ${colorType}, interlace ${body[12]})`);
      }
    } else if (type === "IDAT") {
      idat.push(body);
    }
    at += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      pixels[y * stride + x] = value & 0xff;
    }
  }
  if (channels === 4) return { width, height, data: pixels };
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    pixels.copy(data, i * 4, i * 3, i * 3 + 3);
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** Encodes RGBA pixels; `alpha: false` writes an RGB PNG (stores reject alpha on some assets). */
export function encodePng({ width, height, data }, { alpha = true } = {}) {
  const channels = alpha ? 4 : 3;
  const stride = width * channels;
  const rows = Buffer.alloc(stride * height);
  for (let i = 0; i < width * height; i += 1) {
    for (let c = 0; c < channels; c += 1) rows[i * channels + c] = data[i * 4 + c];
  }
  const out = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    let best = null;
    for (let filter = 0; filter < 5; filter += 1) {
      const line = filterLine(rows, y, stride, channels, filter);
      const cost = line.reduce((sum, v) => sum + (v < 128 ? v : 256 - v), 0);
      if (!best || cost < best.cost) best = { filter, line, cost };
    }
    out[y * (stride + 1)] = best.filter;
    best.line.copy(out, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(out, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Smallest box holding every pixel with alpha > 0, or null if all clear. */
export function opaqueBounds({ width, height, data }) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function filterLine(rows, y, stride, channels, filter) {
  const line = Buffer.alloc(stride);
  for (let x = 0; x < stride; x += 1) {
    const cur = rows[y * stride + x];
    const a = x >= channels ? rows[y * stride + x - channels] : 0;
    const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
    const c = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels] : 0;
    const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
    line[x] = (cur - predictor) & 0xff;
  }
  return line;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}
