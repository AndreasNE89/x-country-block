# Store screenshots

Five 1280x800 PNGs with no alpha, full bleed and square corners. The same
five go to the Chrome Web Store, Firefox Add-ons and Edge Add-ons.

`node scripts/render-brand.mjs` composes all of them on the brand canvas
(`#F3F6F6`): a 40 px mark, the headline (Inter 600, 44 px) and a sub-line
(20 px, muted) in the left 38%, the capture in the right 62%, and the fine
print "Accounts blurred for privacy · Not affiliated with X Corp." at the
bottom right. You only make the captures.

| # | Output | Needs |
|---|--------|-------|
| 1 | `store/screenshot-1-languages-1280x800.png` | `capture-1.png` |
| 2 | `store/screenshot-2-highlight-1280x800.png` | `capture-2.png` |
| 3 | `store/screenshot-3-focus-1280x800.png` | `capture-3.png` |
| 4 | `store/screenshot-4-regions-1280x800.png` | `capture-4.png` |
| 5 | `store/screenshot-5-privacy-1280x800.png` | Nothing; already rendered |

Upload them in this order. Remove the old 0.1.x screenshot from every store
and never publish `release/store-screenshot-1280x800.png`.

## Before you start

Capture the 0.2.0 build only after the popup redesign, the reworded
on-page tooltips ("Tamis · Post language: Portuguese") and the marigold
toolbar badge are in it. Screenshots must show the UI people will get.

## Setup (all four captures)

1. Build: `npm run build:prod`.
2. Start a new Chrome profile at 2x:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir=%TEMP%\tamis-shots --force-device-scale-factor=2 --window-size=1280,860 --lang=en-US
   ```

3. Load `dist/` unpacked (`chrome://extensions`, Developer mode, Load
   unpacked) and pin the Tamis icon. Sign in to X with your own account
   and set X's display language to English.
4. For a mix of languages, open `x.com/search?q=<a global football or
   Olympics topic>&f=live` and scroll until the badge shows two digits.
5. Capture with Windows Snipping Tool. Crop to the toolbar, the centre feed
   column and the popup. Leave out the tab-strip favicon and X's left
   navigation: both show the X logo.
6. In Photopea or GIMP, blur (Gaussian, about 12 px at 2x) every avatar,
   display name, @handle and photo that shows people. Also blur the post
   text of private individuals; posts from organisations may stay legible.
   Never edit post text, and never paste the popup onto a made-up feed.
7. Save the blurred crop as `store/screenshots/capture-N.png`. Keep it at
   2x: the composer scales it down to fit the right panel (about 760x700)
   and keeps its aspect ratio.
8. Run `node scripts/render-brand.mjs` and check the output PNG.

## Shot list

Examples stay neutral: two languages, one small country with its language,
or a whole region. Never demo hiding a single country.

### 1. "Your feed, in the languages you read."

Sub-line: "Hide posts in languages you don't read. Free."

- X in its light theme, on the search results page (Latest).
- Popup: Languages tab, Hide selected, Japanese (ja) and Portuguese (pt)
  ticked.
- The status card reads "Hiding Japanese, Portuguese · N on this tab" and
  the marigold toolbar badge shows the same N.

### 2. "Highlight first. Hide when you're sure."

Sub-line: "See exactly what matched, and why. Free."

- Same page and picks as 1. Popup: Hide selected and "Highlight instead of
  hide" switched on.
- Two or three posts carry the 2 px `#B86E00` outline. Hover one so the
  browser's own tooltip "Tamis · Post language: Portuguese" is on screen.
  Use Snipping Tool with a 3-second delay for the tooltip. Open the popup
  afterwards and capture it separately, or reopen it before the delayed
  snip fires.
- The product only draws the outline and the tooltip. Add no labels,
  placeholders or badges on posts.

### 3. "Focus mode: only the places you pick."

Sub-line: "Great for local news and match day. $5.99 once · 7-day free trial."

- Popup: "Only show" selected with the marigold PRO pill and the
  "Trial · 7 days left" chip. Countries tab with Norway (NO) ticked; the
  selected tray also shows "Norwegian ×" from the Languages tab.
- The status card reads "Showing only Norway, Norwegian · N set aside".
- Feed: a real Latest search on a Norwegian local-news or Eliteserien
  topic.
- Start the trial with the real "Try free for 7 days" button. (The
  development build's Test unlock, from `npm run build`, gives the paid look
  without the chip; never upload that build.)
- Tick "Norwegian (no)", not "Norwegian Bokmål (nb)". First check in
  Highlight mode which code X actually tags Norwegian posts with; otherwise
  Only show sets them all aside.
- Blur every account: local individuals are easy to identify. Do not name
  X Premium or compare prices.

### 4. "One tick covers a whole region."

Sub-line: "Uses the Account based in label X shows. It can be wrong for VPN
users and travellers."

- X in its Lights out theme: Settings, Accessibility, display and
  languages, Display, Background: Lights out.
- Popup in its dark palette: right-click inside the popup, Inspect,
  Rendering panel, "Emulate CSS prefers-color-scheme: dark". Or switch
  Windows to dark mode.
- Popup: Regions tab, "eur" typed in the search field, Europe ticked, Only
  show selected (a football-tournament framing). No single country is
  shown.
- Feed: a European football topic in Latest.

### 5. "Private by design."

Rendered from `scripts/brand/compositions.mjs` (`privacyScreenshot`), with
no feed content: "Runs in your browser", "No extra requests to X",
"No Tamis account, no analytics", "No labels added to people". Once the
Filtering switch has shipped, you can add "Pause anytime" to
`PRIVACY_LINES` and re-render.

## Marquee

`store/marquee-1400x560.png` currently shows abstract feed rows on the
right. The brand spec's fuller version places a real popup capture there
(Languages tab, English and Norwegian ticked, Only show), lined up so the
mark's marigold row meets the popup's ticked-row rule. It is optional for
every store.
