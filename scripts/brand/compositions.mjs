// Store and social compositions. Each returns a full HTML page of exactly
// width x height CSS px; text other than the outlined wordmark uses Inter
// from Google Fonts (INTER_LINK), which render-brand.mjs waits for.
import { INTER_LINK, discMarkup, tileMarkup, wordmarkAt } from "./artwork.mjs";
import { COLORS } from "./icon.mjs";

const FIELD = { from: "#2F9096", to: COLORS.deep };
const r2 = (n) => Math.round(n * 100) / 100;

function page(width, height, body) {
  return `<!doctype html><html><head><meta charset="utf-8">${INTER_LINK}<style>
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
svg{display:block}
text{font-family:Inter,sans-serif;font-kerning:normal}
</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg></body></html>`;
}

function field(id, width, height) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${FIELD.from}"/><stop offset="1" stop-color="${FIELD.to}"/></linearGradient>
  <rect width="${width}" height="${height}" fill="url(#${id})"/>`;
}

/**
 * The promo motif: the five-row disc on the teal field, its marigold row
 * running out of the disc to underline the white wordmark. `gap` sets the
 * scale (rows are 2 gaps tall, the disc 14 gaps wide). Measure first with
 * heroSize to centre it.
 */
export function heroSize(wm, gap) {
  const disc = 14 * gap;
  const cap = 4.9 * gap;
  return { disc, cap, width: disc + 3 * gap + (wm.width * cap) / wm.capHeight };
}

export function heroMarkup(wm, { id, x, cy, gap, lineEnd }) {
  const { disc, cap } = heroSize(wm, gap);
  const rowH = 2 * gap;
  const cx = x + disc / 2;
  const top = cy - disc / 2;
  const rows = discMarkup({ id, cx, cy, rowH, gap });
  const baseline = rows.keptRow.top - 1.1 * gap;
  const word = wordmarkAt(wm, { x: x + disc + 3 * gap, y: baseline, cap, color: "#FFFFFF" });
  const underline = `<rect x="${r2(cx)}" y="${r2(rows.keptRow.top)}" width="${r2((lineEnd ?? word.box.right) - cx)}" height="${r2(rowH)}" rx="${r2(gap)}" fill="${COLORS.marigold}"/>`;
  return {
    markup: `${rows.markup}${underline}${word.markup}`,
    textLeft: word.box.left,
    textRight: word.box.right,
    top,
    bottom: top + disc,
    rowTop: (i) => top + i * 3 * gap,
    rowH,
  };
}

const faintRows = (rows) =>
  rows
    .map(({ x, y, width, height }) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(width)}" height="${r2(height)}" rx="${r2(height / 2)}"/>`)
    .join("");

/** CWS small promo tile, 440x280: text-free apart from the wordmark. */
export function promoTile(wm) {
  const width = 440;
  const height = 280;
  const gap = 10.5;
  const size = heroSize(wm, gap);
  const hero = heroMarkup(wm, { id: "promo", x: Math.round((width - size.width) / 2), cy: height / 2, gap });
  // The rows the sieve lets through, trailing off to the right of the disc.
  const rows = faintRows([
    { x: hero.textLeft, y: hero.rowTop(3), width: hero.textRight - hero.textLeft - 20, height: hero.rowH },
    { x: hero.textLeft, y: hero.rowTop(4), width: (hero.textRight - hero.textLeft) * 0.55, height: hero.rowH },
  ]);
  return {
    width,
    height,
    html: page(width, height, `${field("bg", width, height)}<g fill="#FFFFFF" fill-opacity=".07">${rows}</g>${hero.markup}`),
  };
}

/** CWS marquee and Edge large promo tile, 1400x560. */
export function marquee(wm) {
  const width = 1400;
  const height = 560;
  const gap = 18;
  const x = 132;
  // A feed column on the right: faint rows above and below, and the kept
  // row running on from the underline straight through it.
  const feedX = 1000;
  const feedRight = 1300;
  const hero = heroMarkup(wm, { id: "marquee", x, cy: height / 2, gap, lineEnd: feedRight });
  const keptTop = hero.rowTop(2);
  const feed = [0, 1, 3, 4]
    .map((i) => ({ x: feedX, y: hero.rowTop(i), width: [260, 300, 300, 210][[0, 1, 3, 4].indexOf(i)], height: hero.rowH }))
    .concat([
      { x: feedX, y: hero.rowTop(-1), width: 230, height: hero.rowH },
      { x: feedX, y: hero.rowTop(5), width: 280, height: hero.rowH },
    ]);
  const textX = r2(hero.textLeft + 2);
  const text = `<text x="${textX}" y="${r2(keptTop + hero.rowH + 62)}" fill="#FFFFFF" style="font-weight:600;font-size:40px;letter-spacing:-0.01em">Keep the posts you want.</text>
  <text x="${textX}" y="${r2(keptTop + hero.rowH + 104)}" fill="#FFFFFF" fill-opacity=".82" style="font-weight:500;font-size:24px">Country, region &amp; language filter for X</text>`;
  return {
    width,
    height,
    html: page(width, height, `${field("bg", width, height)}<g fill="#FFFFFF" fill-opacity=".07">${faintRows(feed)}</g>${hero.markup}${text}`),
  };
}

/** GitHub social preview, 1280x640: the promo motif plus the descriptor. */
export function socialPreview(wm) {
  const width = 1280;
  const height = 640;
  const gap = 19;
  const size = heroSize(wm, gap);
  const hero = heroMarkup(wm, { id: "social", x: Math.round((width - size.width) / 2), cy: height / 2 - 8, gap });
  const text = `<text x="${r2(hero.textLeft + 2)}" y="${r2(hero.rowTop(2) + hero.rowH + 50)}" fill="#FFFFFF" fill-opacity=".86" style="font-weight:500;font-size:27px">Country &amp; language filter for X</text>`;
  return { width, height, html: page(width, height, `${field("bg", width, height)}${hero.markup}${text}`) };
}

export const PRIVACY_LINES = [
  "Runs in your browser",
  "No extra requests to X",
  "No Tamis account, no analytics",
  "No labels added to people",
];

/** Store screenshot 5, 1280x800: privacy points beside the mark, no feed content. */
export function privacyScreenshot(wm) {
  const width = 1280;
  const height = 800;
  const left = 96;
  const lines = PRIVACY_LINES.map((line, i) => {
    const y = 370 + i * 66;
    return `<rect x="${left}" y="${y - 16}" width="30" height="12" rx="6" fill="${COLORS.marigold}"/>
    <text x="${left + 50}" y="${y}" fill="${COLORS.ink}" style="font-weight:500;font-size:28px">${line}</text>`;
  }).join("");
  const tile = 300;
  const tileX = 800;
  const tileY = 194;
  const wordWidth = (wm.width * 58) / wm.capHeight;
  const wordX = tileX + tile / 2 - wordWidth / 2;
  const body = `<rect width="${width}" height="${height}" fill="${COLORS.surface}"/>
  ${tileMarkup({ id: "shot-mark", x: left, y: 112, size: 40 })}
  <text x="${left}" y="234" fill="${COLORS.ink}" style="font-weight:600;font-size:48px;letter-spacing:-0.01em">Private by design.</text>
  <text x="${left}" y="280" fill="${COLORS.muted}" style="font-weight:500;font-size:22px">Tamis only uses what X already loaded in your tab.</text>
  ${lines}
  <rect x="${tileX}" y="${tileY + 6}" width="${tile}" height="${tile}" rx="${r2((tile * 26) / 112)}" fill="${COLORS.plate}" fill-opacity=".14"/>
  ${tileMarkup({ id: "shot-big", x: tileX, y: tileY, size: tile })}
  ${wordmarkAt(wm, { x: wordX, y: tileY + tile + 104, cap: 58, color: COLORS.ink }).markup}
  <rect x="0" y="712" width="${width}" height="1" fill="#DCE4E4"/>
  <text x="${left}" y="760" fill="${COLORS.muted}" style="font-weight:500;font-size:18px">Works on x.com and twitter.com. Not affiliated with or endorsed by X Corp.</text>`;
  return { width, height, html: page(width, height, body) };
}
