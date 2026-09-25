// Reads glyph outlines from a TrueType (glyf) font, so the wordmark and
// descriptor can ship as paths that look the same without Inter installed.

export function parseTtf(buf) {
  const tables = {};
  const count = buf.readUInt16BE(4);
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    tables[buf.toString("latin1", at, at + 4)] = { offset: buf.readUInt32BE(at + 8), length: buf.readUInt32BE(at + 12) };
  }
  for (const tag of ["head", "maxp", "hhea", "hmtx", "cmap", "loca", "glyf"]) {
    if (!tables[tag]) throw new Error(`Font has no ${tag} table (only TrueType outlines are supported)`);
  }
  const head = tables.head.offset;
  const unitsPerEm = buf.readUInt16BE(head + 18);
  const longLoca = buf.readInt16BE(head + 50) === 1;
  const numGlyphs = buf.readUInt16BE(tables.maxp.offset + 4);
  const numHMetrics = buf.readUInt16BE(tables.hhea.offset + 34);

  const locaAt = (index) =>
    longLoca ? buf.readUInt32BE(tables.loca.offset + index * 4) : buf.readUInt16BE(tables.loca.offset + index * 2) * 2;

  function advance(glyph) {
    const index = Math.min(glyph, numHMetrics - 1);
    return buf.readUInt16BE(tables.hmtx.offset + index * 4);
  }

  const cmap = readCmap(buf, tables.cmap.offset);
  function glyphIndex(codePoint) {
    const glyph = cmap(codePoint);
    if (!glyph) throw new Error(`Font has no glyph for U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`);
    return glyph;
  }

  /** Contours as arrays of { x, y, on } in font units (y up). */
  function contours(glyph, depth = 0) {
    if (glyph >= numGlyphs || depth > 8) return [];
    const start = locaAt(glyph);
    const end = locaAt(glyph + 1);
    if (end === start) return [];
    const at = tables.glyf.offset + start;
    const numContours = buf.readInt16BE(at);
    return numContours >= 0 ? simpleGlyph(buf, at, numContours) : compositeGlyph(buf, at, (g) => contours(g, depth + 1));
  }

  return { unitsPerEm, numGlyphs, advance, glyphIndex, contours };
}

function readCmap(buf, cmapAt) {
  const count = buf.readUInt16BE(cmapAt + 2);
  let best = null;
  for (let i = 0; i < count; i += 1) {
    const platform = buf.readUInt16BE(cmapAt + 4 + i * 8);
    const encoding = buf.readUInt16BE(cmapAt + 6 + i * 8);
    const at = cmapAt + buf.readUInt32BE(cmapAt + 8 + i * 8);
    const format = buf.readUInt16BE(at);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12 && (!best || best.format !== 12)) best = { format, at };
    else if (format === 4 && !best) best = { format, at };
  }
  if (!best) throw new Error("Font has no Unicode cmap");
  const { format, at } = best;
  if (format === 12) {
    const groups = buf.readUInt32BE(at + 12);
    return (cp) => {
      for (let i = 0; i < groups; i += 1) {
        const g = at + 16 + i * 12;
        const first = buf.readUInt32BE(g);
        const last = buf.readUInt32BE(g + 4);
        if (cp >= first && cp <= last) return buf.readUInt32BE(g + 8) + (cp - first);
      }
      return 0;
    };
  }
  const segX2 = buf.readUInt16BE(at + 6);
  const ends = at + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const offsets = deltas + segX2;
  return (cp) => {
    for (let i = 0; i < segX2 / 2; i += 1) {
      const endCode = buf.readUInt16BE(ends + i * 2);
      if (cp > endCode) continue;
      const startCode = buf.readUInt16BE(starts + i * 2);
      if (cp < startCode) return 0;
      const delta = buf.readInt16BE(deltas + i * 2);
      const rangeOffset = buf.readUInt16BE(offsets + i * 2);
      if (rangeOffset === 0) return (cp + delta) & 0xffff;
      const glyph = buf.readUInt16BE(offsets + i * 2 + rangeOffset + (cp - startCode) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

function simpleGlyph(buf, at, numContours) {
  const endPts = [];
  for (let i = 0; i < numContours; i += 1) endPts.push(buf.readUInt16BE(at + 10 + i * 2));
  const numPoints = endPts[numContours - 1] + 1;
  const instructionLength = buf.readUInt16BE(at + 10 + numContours * 2);
  let p = at + 12 + numContours * 2 + instructionLength;
  const flags = [];
  while (flags.length < numPoints) {
    const flag = buf[p++];
    flags.push(flag);
    if (flag & 8) {
      const repeat = buf[p++];
      for (let r = 0; r < repeat; r += 1) flags.push(flag);
    }
  }
  const read = (shortBit, sameBit) => {
    const values = [];
    let value = 0;
    for (const flag of flags) {
      if (flag & shortBit) {
        const delta = buf[p++];
        value += flag & sameBit ? delta : -delta;
      } else if (!(flag & sameBit)) {
        value += buf.readInt16BE(p);
        p += 2;
      }
      values.push(value);
    }
    return values;
  };
  const xs = read(2, 16);
  const ys = read(4, 32);
  const out = [];
  let first = 0;
  for (const last of endPts) {
    const contour = [];
    for (let i = first; i <= last; i += 1) contour.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) === 1 });
    out.push(contour);
    first = last + 1;
  }
  return out;
}

function compositeGlyph(buf, at, load) {
  const out = [];
  let p = at + 10;
  let more = true;
  while (more) {
    const flags = buf.readUInt16BE(p);
    const glyph = buf.readUInt16BE(p + 2);
    p += 4;
    let dx;
    let dy;
    if (flags & 1) {
      dx = buf.readInt16BE(p);
      dy = buf.readInt16BE(p + 2);
      p += 4;
    } else {
      dx = buf.readInt8(p);
      dy = buf.readInt8(p + 1);
      p += 2;
    }
    if (!(flags & 2)) throw new Error("Composite glyphs with point matching are not supported");
    let [a, b, c, d] = [1, 0, 0, 1];
    const f2dot14 = (at2) => buf.readInt16BE(at2) / 16384;
    if (flags & 8) {
      a = d = f2dot14(p);
      p += 2;
    } else if (flags & 0x40) {
      a = f2dot14(p);
      d = f2dot14(p + 2);
      p += 4;
    } else if (flags & 0x80) {
      a = f2dot14(p);
      b = f2dot14(p + 2);
      c = f2dot14(p + 4);
      d = f2dot14(p + 6);
      p += 8;
    }
    for (const contour of load(glyph)) {
      out.push(contour.map(({ x, y, on }) => ({ x: a * x + c * y + dx, y: b * x + d * y + dy, on })));
    }
    more = (flags & 0x20) !== 0;
  }
  return out;
}

/** SVG path data for contours placed at (x, y) px with `scale` px per unit. */
export function contoursToPath(contours, { x, y, scale }) {
  const fmt = (n) => String(Math.round(n * 100) / 100);
  const px = (pt) => `${fmt(x + pt.x * scale)} ${fmt(y - pt.y * scale)}`;
  const parts = [];
  for (const contour of contours) {
    if (contour.length === 0) continue;
    // Start on an on-curve point; between two off-curve points the on-curve
    // point is implied at their midpoint.
    let startIndex = contour.findIndex((pt) => pt.on);
    let points = contour;
    if (startIndex === -1) {
      const mid = { x: (contour[0].x + contour[1].x) / 2, y: (contour[0].y + contour[1].y) / 2, on: true };
      points = [mid, ...contour.slice(1), contour[0]];
      startIndex = 0;
    }
    const ordered = [...points.slice(startIndex), ...points.slice(0, startIndex)];
    parts.push(`M${px(ordered[0])}`);
    let pendingControl = null;
    for (let i = 1; i <= ordered.length; i += 1) {
      const pt = ordered[i % ordered.length];
      if (pt.on) {
        parts.push(pendingControl ? `Q${px(pendingControl)} ${px(pt)}` : `L${px(pt)}`);
        pendingControl = null;
      } else if (pendingControl) {
        const mid = { x: (pendingControl.x + pt.x) / 2, y: (pendingControl.y + pt.y) / 2 };
        parts.push(`Q${px(pendingControl)} ${px(mid)}`);
        pendingControl = pt;
      } else {
        pendingControl = pt;
      }
    }
    parts.push("Z");
  }
  return parts.join("");
}

/** Bounding box of contours in font units. */
export function contourBounds(contours) {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const contour of contours) {
    for (const { x, y } of contour) {
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }
  return { xMin, yMin, xMax, yMax };
}
