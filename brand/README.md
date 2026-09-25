# Tamis brand masters

The mark is a round sieve (French *tamis*) drawn as five feed rows. The
marigold middle row is the one you keep. There are no flags, pins, slashes
or X marks anywhere in the artwork.

| File | Use | Source |
|------|-----|--------|
| `icon-16.svg` | Toolbar icon at 16 and 32 px (3 rows, whole pixels) | Drawn by hand. Edit this file. |
| `icon.svg` | App icon master, 128 artboard, 112 px tile | Generated |
| `mark.svg` | 24 px inline mark (popup header, privacy page) | Generated |
| `wordmark.svg` | "Tamis" in Inter SemiBold, outlined; the i's dot is a marigold bar | Generated |
| `lockup.svg`, `lockup-dark.svg` | Mark, wordmark and descriptor for light and dark surfaces | Generated |

Generated files, `icons/*.png` and `store/*.png` all come from
`node scripts/render-brand.mjs`. Change the code in `scripts/brand/`, not
the output. The script needs Chrome (set `CHROME_PATH` if it is not in a
usual place) and network access to Google Fonts for Inter. Pass
`--check sheet.png` to also get the 16/32 px icon on light and dark
toolbars, with and without a badge.

Sizes: 16 and 32 come from `icon-16.svg`. 48, 64, 96 and 512 use the master
proportions, fitted to whole pixels per size. `icons/icon128.png` and
`store/cws-icon-128.png` are 96 px artwork with 16 px of transparent padding,
as the Chrome Web Store asks. The Edge logo fills its 300 px frame.

## Palette

| Token | Hex | Use |
|-------|-----|-----|
| Brand teal | `#33959A` | Top of the tile, focus ring (light) |
| Primary teal | `#1C676D` | Bottom of the tile, buttons, checkboxes |
| Deep teal | `#155257` | Hover, end of the promo gradient |
| Marigold | `#FFB638` | Kept row, PRO pill, badge |
| Marigold (dark UI) | `#FFC45C` | Accent fills on dark surfaces |
| Highlight on x.com | `#B86E00` | Outline on matched posts, all X themes |
| Ink | `#14201F` | Text, wordmark |
| Muted | `#56686A` | Secondary text |
| Surface | `#F3F6F6` | Cards, screenshot canvas |

Type: Inter 600 for the wordmark and headlines, Inter 500 for sub-lines,
system UI fonts inside the extension.

Voice: plain and factual. Filter, focus, highlight, pause, show only. Never
"block", "ban", "foreign", "clean" or "sanitize".
