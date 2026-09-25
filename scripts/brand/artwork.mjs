// Brand masters as SVG strings: the tile mark, the 24 px inline mark and the
// lockup, plus the Inter web-font link that render-brand.mjs waits for when
// a page sets text in Inter.
import { COLORS } from "./icon.mjs";

export const INTER_LINK =
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&display=block">';
export const INTER_FONTS = ["600 20px Inter", "500 20px Inter"];

const r2 = (n) => Math.round(n * 100) / 100;

/** Reads the outlined wordmark master back into its parts. */
export function parseWordmark(svg) {
  const view = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const cap = /data-cap-height="([\d.]+)"/.exec(svg);
  const path = /<path[^>]* d="([^"]+)"/.exec(svg);
  const bar = /<rect[^>]* x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  if (!view || !cap || !path || !bar) throw new Error("brand/wordmark.svg is not in the expected shape");
  return {
    width: Number(view[1]),
    height: Number(view[2]),
    capHeight: Number(cap[1]),
    d: path[1],
    bar: { x: Number(bar[1]), y: Number(bar[2]), width: Number(bar[3]), height: Number(bar[4]) },
  };
}

/**
 * The wordmark scaled so its cap height is `cap` px, with its ink starting
 * at x and its baseline at y. Returns SVG markup and the box it covers.
 */
export function wordmarkAt(wm, { x, y, cap, color, dot = COLORS.marigold }) {
  const scale = cap / wm.capHeight;
  const top = y - cap;
  const box = { left: x, top, right: x + wm.width * scale, bottom: top + wm.height * scale };
  const markup = `<g transform="translate(${r2(x)} ${r2(top)}) scale(${r2(scale * 10000) / 10000})">
    <path fill="${color}" d="${wm.d}"/>
    <rect x="${wm.bar.x}" y="${wm.bar.y}" width="${wm.bar.width}" height="${wm.bar.height}" rx="${wm.bar.height / 2}" fill="${dot}"/>
  </g>`;
  return { markup, box };
}

/** The five-row disc without a tile, for teal fields. */
export function discMarkup({ id, cx, cy, rowH, gap, rowColor = "#FFFFFF", keepColor = COLORS.marigold }) {
  const disc = 5 * rowH + 4 * gap;
  const top = cy - disc / 2;
  const rows = [0, 1, 2, 3, 4]
    .map(
      (i) =>
        `<rect x="${r2(cx - disc / 2 - 1)}" y="${r2(top + i * (rowH + gap))}" width="${disc + 2}" height="${rowH}" fill="${i === 2 ? keepColor : rowColor}"/>`,
    )
    .join("");
  return {
    markup: `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${disc / 2}"/></clipPath><g clip-path="url(#${id})">${rows}</g>`,
    keptRow: { top: top + 2 * (rowH + gap), height: rowH, right: cx + disc / 2 },
  };
}

/** The tile mark drawn at master proportions, at any position and size. */
export function tileMarkup({ id, x, y, size, top = COLORS.tileTop, bottom = COLORS.tileBottom }) {
  const u = size / 112;
  const disc = 70 * u;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const rows = [0, 1, 2, 3, 4]
    .map(
      (i) =>
        `<rect x="${r2(x)}" y="${r2(cy - disc / 2 + i * 15 * u)}" width="${r2(size)}" height="${r2(10 * u)}" fill="${i === 2 ? COLORS.marigold : "#FFFFFF"}"/>`,
    )
    .join("");
  return `<linearGradient id="${id}-g" x1="0" y1="${r2(y)}" x2="0" y2="${r2(y + size)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
  <clipPath id="${id}-c"><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(disc / 2)}"/></clipPath>
  <rect x="${r2(x)}" y="${r2(y)}" width="${r2(size)}" height="${r2(size)}" rx="${r2(26 * u)}" fill="url(#${id}-g)"/>
  <g clip-path="url(#${id}-c)">${rows}</g>`;
}

/** 24 px mark for inline use (popup header, privacy page): 2 px rows, 1 px gaps. */
export function markSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <!-- Tamis mark for small inline use, drawn on a 24 px grid: 2 px rows, 1 px gaps. -->
  <defs>
    <linearGradient id="tamis-mark-tile" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${COLORS.tileTop}"/>
      <stop offset="1" stop-color="${COLORS.tileBottom}"/>
    </linearGradient>
    <clipPath id="tamis-mark-disc"><circle cx="12" cy="12" r="7"/></clipPath>
  </defs>
  <rect width="24" height="24" rx="5.5" fill="url(#tamis-mark-tile)"/>
  <g clip-path="url(#tamis-mark-disc)">
    <rect x="5" y="5" width="14" height="2" fill="#FFFFFF"/>
    <rect x="5" y="8" width="14" height="2" fill="#FFFFFF"/>
    <rect x="5" y="11" width="14" height="2" fill="${COLORS.marigold}"/>
    <rect x="5" y="14" width="14" height="2" fill="#FFFFFF"/>
    <rect x="5" y="17" width="14" height="2" fill="#FFFFFF"/>
  </g>
</svg>
`;
}

/** Horizontal lockup: tile mark, wordmark, descriptor. Cropped to 24 px padding. */
export function lockupSvg(wm, descriptor, { dark }) {
  const pad = 24;
  const tile = 104;
  const textX = pad + tile + 28;
  const baseline = pad + 60;
  const word = wordmarkAt(wm, {
    x: textX,
    y: baseline,
    cap: 48,
    color: dark ? "#E8EFEF" : COLORS.ink,
    dot: dark ? COLORS.marigoldDark : COLORS.marigold,
  });
  const descScale = 19 / descriptor.size;
  const descX = textX + 2;
  const descY = baseline + 32;
  const width = Math.ceil(Math.max(word.box.right, descX + descriptor.width * descScale) + pad);
  const height = pad * 2 + tile;
  const tileColors = dark ? { top: "#3AA3A8", bottom: "#21747A" } : {};
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Tamis lockup for ${dark ? "dark surfaces (#15191C and darker)" : "light surfaces"}. Text is outlined Inter; no fonts needed. -->
  ${tileMarkup({ id: dark ? "lkd" : "lk", x: pad, y: pad, size: tile, ...tileColors })}
  ${word.markup}
  <path fill="${dark ? "#9DB2B3" : COLORS.muted}" transform="translate(${descX} ${descY}) scale(${r2(descScale * 10000) / 10000})" d="${descriptor.d}"/>
</svg>
`;
}
