// The Tamis mark: a round sieve drawn as five feed rows on a teal tile; the
// marigold middle row is the one you keep. Geometry is fitted to whole
// pixels for each export size so row edges stay crisp.

export const COLORS = {
  tileTop: "#33959A",
  tileBottom: "#1C676D",
  deep: "#155257",
  marigold: "#FFB638",
  marigoldDark: "#FFC45C",
  ink: "#14201F",
  muted: "#56686A",
  surface: "#F3F6F6",
  plate: "#0B3336",
};

/**
 * Tile and disc geometry for a square icon of `size` px whose tile is inset
 * by `margin` px. Row height and gap keep the master's 10:5 rhythm and a
 * disc of 70/112 of the tile, rounded to whole pixels.
 */
export function iconGeometry(size, margin) {
  const tile = size - 2 * margin;
  const target = (tile * 70) / 112;
  const rowH = Math.max(1, Math.round(target / 7));
  const gap = Math.max(1, Math.round(target / 14));
  const disc = 5 * rowH + 4 * gap;
  const top = Math.floor((size - disc) / 2);
  return { size, margin, tile, rowH, gap, disc, top, radius: (tile * 26) / 112 };
}

/** An SVG string of the tile icon. `plate` adds the soft drop plate. */
export function iconSvg(
  geometry,
  { id = "tamis", plate = true, highlight = true, rowColor = "#FFFFFF", comment = "" } = {},
) {
  const { size, margin, tile, rowH, gap, disc, top, radius } = geometry;
  const unit = tile / 112;
  const rows = [0, 1, 2, 3, 4]
    .map((i) => {
      const fill = i === 2 ? COLORS.marigold : rowColor;
      return `<rect x="0" y="${top + i * (rowH + gap)}" width="${size}" height="${rowH}" fill="${fill}"/>`;
    })
    .join("\n    ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
${comment ? `  <!-- ${comment} -->\n` : ""}  <defs>
    <linearGradient id="${id}-tile" x1="0" y1="${margin}" x2="0" y2="${margin + tile}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${COLORS.tileTop}"/>
      <stop offset="1" stop-color="${COLORS.tileBottom}"/>
    </linearGradient>
    <clipPath id="${id}-disc"><circle cx="${size / 2}" cy="${top + disc / 2}" r="${disc / 2}"/></clipPath>
  </defs>
${plate ? `  <rect x="${margin}" y="${fmt(margin + 2 * unit)}" width="${tile}" height="${tile}" rx="${fmt(radius)}" fill="${COLORS.plate}" fill-opacity=".16"/>\n` : ""}  <rect x="${margin}" y="${margin}" width="${tile}" height="${tile}" rx="${fmt(radius)}" fill="url(#${id}-tile)"/>
${highlight ? `  <rect x="${fmt(margin + 0.75 * unit)}" y="${fmt(margin + 0.75 * unit)}" width="${fmt(tile - 1.5 * unit)}" height="${fmt(tile - 1.5 * unit)}" rx="${fmt(radius - 0.75 * unit)}" fill="none" stroke="#FFFFFF" stroke-opacity=".14" stroke-width="${fmt(1.5 * unit)}"/>\n` : ""}  <g clip-path="url(#${id}-disc)">
    ${rows}
  </g>
</svg>
`;
}

function fmt(n) {
  return String(Math.round(n * 1000) / 1000);
}
