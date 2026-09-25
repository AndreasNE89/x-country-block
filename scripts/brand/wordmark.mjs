// Outlines the "Tamis" wordmark (Inter 600, marigold bar for the i dot) and
// the lockup descriptor (Inter 500) to SVG paths. Chrome lays the text out
// so kerning matches what a browser would do; the TTF gives the outlines.
import { contourBounds, contoursToPath, parseTtf } from "./ttf.mjs";

export const WORDMARK_TEXT = "Tamis";
export const DESCRIPTOR_TEXT = "Country & language filter for X";
// Tracking from the brand concept: about -2.3% on the wordmark.
const WORDMARK_TRACKING = -0.02;
const DESCRIPTOR_TRACKING = 0.01;

/** Downloads a static TrueType instance of Inter from Google Fonts. */
export async function fetchInter(weight) {
  // Without a browser user agent the CSS API links .ttf files, which carry
  // plain glyf outlines.
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`)).text();
  const url = /url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
  if (!url) throw new Error(`No TrueType Inter ${weight} in Google Fonts response`);
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

/**
 * Pen positions (font units) of each character of `text`, as Chrome lays it
 * out with kerning and the given tracking (em).
 */
async function measure(page, ttf, weight, text, tracking) {
  const font = parseTtf(ttf);
  const family = `Measure${weight}`;
  const html = `<!doctype html><style>
@font-face{font-family:${family};font-weight:${weight};src:url(data:font/ttf;base64,${ttf.toString("base64")})}
body{margin:0}span{white-space:pre;font:${weight} ${font.unitsPerEm}px/1 ${family};letter-spacing:${tracking}em}
</style><span id="run"></span>`;
  await page.load(html, { width: 400, height: 200, fonts: [`${weight} 20px ${family}`] });
  const xs = await page.evaluate(`(() => {
    const span = document.getElementById("run");
    span.textContent = ${JSON.stringify(text)};
    const node = span.firstChild;
    const left = span.getBoundingClientRect().left;
    return [...node.data].map((_, i) => {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      return range.getBoundingClientRect().left - left;
    });
  })()`);
  return { font, xs };
}

function outlineRun(font, text, xs) {
  const glyphs = [...text].map((ch, i) => ({ ch, x: xs[i], contours: font.contours(font.glyphIndex(ch.codePointAt(0))) }));
  const placed = glyphs.flatMap(({ x, contours }) =>
    contours.map((contour) => contour.map((pt) => ({ ...pt, x: pt.x + x }))),
  );
  return { glyphs, contours: placed };
}

/**
 * The wordmark in font units (baseline y = 0, y up): glyph contours with a
 * dotless i, plus the marigold bar that replaces the dot. The bar keeps the
 * kept row's proportions: a rounded bar about twice the stem wide, its top
 * on the cap height.
 */
export async function wordmarkUnits(page, ttf600) {
  const text = WORDMARK_TEXT.replace("i", "ı");
  const { font, xs } = await measure(page, ttf600, 600, text, WORDMARK_TRACKING);
  const { glyphs, contours } = outlineRun(font, text, xs);
  const dotless = glyphs.find((g) => g.ch === "ı");
  const stem = contourBounds(dotless.contours);
  const capHeight = contourBounds(font.contours(font.glyphIndex("T".codePointAt(0)))).yMax;
  const stemWidth = stem.xMax - stem.xMin;
  const barHeight = Math.round(stemWidth * 0.74);
  const barWidth = Math.round(stemWidth * 2);
  const bar = {
    x: dotless.x + (stem.xMin + stem.xMax) / 2 - barWidth / 2,
    y: capHeight - barHeight,
    width: barWidth,
    height: barHeight,
  };
  return { unitsPerEm: font.unitsPerEm, contours, bar, capHeight };
}

export async function descriptorUnits(page, ttf500) {
  const { font, xs } = await measure(page, ttf500, 500, DESCRIPTOR_TEXT, DESCRIPTOR_TRACKING);
  const { contours } = outlineRun(font, DESCRIPTOR_TEXT, xs);
  return { unitsPerEm: font.unitsPerEm, contours };
}

/**
 * Places units-space artwork at `size` px per em with its ink starting at
 * x and its baseline at y. Returns path data and the ink box in px.
 */
export function placeText({ unitsPerEm, contours }, { x, y, size }) {
  const scale = size / unitsPerEm;
  const ink = contourBounds(contours);
  const originX = x - ink.xMin * scale;
  return {
    d: contoursToPath(contours, { x: originX, y, scale }),
    originX,
    scale,
    box: { left: x, right: originX + ink.xMax * scale, top: y - ink.yMax * scale, bottom: y - ink.yMin * scale },
  };
}

export function placeBar(bar, { originX, y, scale }) {
  const r = (n) => Math.round(n * 100) / 100;
  return {
    x: r(originX + bar.x * scale),
    y: r(y - (bar.y + bar.height) * scale),
    width: r(bar.width * scale),
    height: r(bar.height * scale),
    rx: r((bar.height * scale) / 2),
  };
}

/**
 * brand/wordmark.svg: the outlined wordmark at 100 px per em, its ink
 * starting at x = 0 and its cap height at y = 0. artwork.mjs parseWordmark
 * reads it back.
 */
export function wordmarkSvg(units, { color = "#14201F", dot = "#FFB638" } = {}) {
  const r = (n) => Math.round(n * 100) / 100;
  const size = 100;
  const cap = (units.capHeight * size) / units.unitsPerEm;
  const text = placeText(units, { x: 0, y: cap, size });
  const bar = placeBar(units.bar, { originX: text.originX, y: cap, scale: text.scale });
  const width = Math.ceil(Math.max(text.box.right, bar.x + bar.width));
  const height = Math.ceil(text.box.bottom);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-cap-height="${r(cap)}">
  <!-- Tamis wordmark: Inter SemiBold outlined to paths, tracking -2%. The dot of the i is a marigold bar that echoes the kept row. Generated by scripts/render-brand.mjs. -->
  <path fill="${color}" d="${text.d}"/>
  <rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${bar.rx}" fill="${dot}"/>
</svg>
`;
}

/** The descriptor as path data at `size` px, ink from x = 0, baseline y = 0. */
export function descriptorPath(units, size) {
  const text = placeText(units, { x: 0, y: 0, size });
  return { size, width: text.box.right, d: text.d };
}
