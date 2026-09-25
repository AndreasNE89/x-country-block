# Store screenshots

Five 1280x800 PNGs with no alpha, full bleed and square corners. The same
five go to the Chrome Web Store, Firefox Add-ons and Edge Add-ons, in this
order:

| # | File | Made by |
|---|------|---------|
| 1 | `store/screenshots/screenshot-1-languages-1280x800.png` | `node scripts/store-screenshots.mjs` |
| 2 | `store/screenshot-2-highlight-1280x800.png` | You, on x.com: `capture-2.png`, then `node scripts/render-brand.mjs` |
| 3 | `store/screenshots/screenshot-3-focus-1280x800.png` | `node scripts/store-screenshots.mjs` |
| 4 | `store/screenshots/screenshot-4-regions-1280x800.png` | `node scripts/store-screenshots.mjs` |
| 5 | `store/screenshot-5-privacy-1280x800.png` | `node scripts/render-brand.mjs` |

Remove the old 0.1.x screenshot from every store and never publish
`release/store-screenshot-1280x800.png`. Examples stay neutral: two
languages, one small country with its language, or a whole region. Never
demo hiding a single country.

## Screenshots 1, 3 and 4: generated

`node scripts/store-screenshots.mjs` builds the production popup
(`node scripts/build.mjs --prod`), loads `dist/popup.html` in headless
Chrome with a stand-in for the extension APIs, captures it at 2x and places
it on the brand canvas: the Tamis mark and wordmark, the headline (Inter
600) and sub-line, three short points, the popup under its toolbar button
with the marigold badge, and a band in the mark's kept-row colour behind
the ticked rows. The fine print reads "Works on x.com and twitter.com. Not
affiliated with or endorsed by X Corp."

Nothing on these three comes from x.com: no feed, no accounts, no X logo, so
nothing needs blurring. The count on the status line and the badge is the
number the stand-in tab reports; everything else is the popup exactly as
it ships.

| # | Headline | Popup state |
|---|----------|-------------|
| 1 | Your feed, in the languages you read. | Light. Hide matches, Languages tab, Japanese and Portuguese ticked. "Hiding Japanese, Portuguese · 14 on this tab", badge 14. |
| 3 | Focus mode: only the places you pick. | Light. Only show with the PRO pill and "Trial · 7 days left". Countries tab, Norway ticked; the tray also holds Norwegian. "Showing only Norway, Norwegian · 38 set aside". |
| 4 | One tick covers a whole region. | Dark. Only show (bought), Regions tab, Europe ticked. "Showing only Europe · 23 set aside". |

Run the script again after any change to the popup, and look at the three
PNGs before you commit them. The script needs Chrome (set `CHROME_PATH` if
it is not in a usual place) and network access to Google Fonts for Inter.
Before it captures, it checks the popup's status text, count and trial chip,
and that neither the Focus mode offer nor the development-only Test unlock
is showing. If a popup change makes that check fail, update `SHOTS` in the
script and look at the result again.

## Screenshot 2: capture it on x.com

"Highlight first. Hide when you're sure." This one has to show Highlight
mode on a real feed, so it is a capture from your own browser. Sub-line: "See
exactly what matched, and why. Free."

### What the build draws on a matched post

Keep all of it in the shot, and add nothing:

- a 2 px `#B86E00` outline around the post;
- inside the card, on its own line under the post, a marigold (`#FFB638`)
  note: "Tamis · Post language: Portuguese" (or Japanese), then an
  underlined "Always show @handle" button;
- on hover, the browser's own tooltip with the same text. It is optional:
  the note already says why.

Accounts in "Who to follow" lists and on profile headers get the outline
only, with no note.

### Steps

1. Build: `npm run build:prod`.
2. Start a new Chrome profile at 2x:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir=%TEMP%\tamis-shots --force-device-scale-factor=2 --window-size=1280,860 --lang=en-US
   ```

3. Load `dist/` unpacked (`chrome://extensions`, Developer mode, Load
   unpacked) and pin the Tamis icon. Sign in to X with your own account,
   set X's display language to English and its theme to the default light
   background.
4. In the popup: Languages tab, tick Japanese and Portuguese, choose
   "Hide matches" and switch on "Highlight instead of hide".
5. Open `x.com/search?q=<a global football or Olympics topic>&f=live` and
   scroll until two or three highlighted posts, with their notes, are on
   screen together.
6. Click the Tamis icon. The status reads "Highlighting matches for
   Japanese, Portuguese · N on this tab" and the marigold badge shows the
   same N.
7. Capture with Snipping Tool (Win+Shift+S, rectangle). Crop to the
   toolbar, the centre feed column and the popup. Leave out the tab-strip
   favicon and X's left navigation: both show the X logo.
8. In Photopea or GIMP, blur (Gaussian, about 12 px at 2x) every avatar,
   display name, @handle and photo that shows people, including the
   @handle inside each "Always show @handle" button. Also blur the post
   text of private individuals; posts from organisations may stay legible.
   Never edit post text, and never paste the popup onto a made-up feed.
9. Save the blurred crop as `store/screenshots/capture-2.png`, still at 2x.
10. Run `node scripts/render-brand.mjs`. It writes
    `store/screenshot-2-highlight-1280x800.png`: the headline and sub-line
    on the left, your capture on the right (scaled to fit about 760x700),
    and the fine print "Accounts blurred for privacy · Not affiliated with
    X Corp." Look at the result.

Make no `capture-1.png`, `capture-3.png` or `capture-4.png`:
`render-brand.mjs` would compose those too, into `store/`, next to the
generated screenshots 1, 3 and 4.

## Screenshot 5: privacy

"Private by design." It is rendered by `node scripts/render-brand.mjs` from
`privacyScreenshot` and `PRIVACY_LINES` in `scripts/brand/compositions.mjs`,
with no feed content. Before uploading, check that its lines are true of
the build: "Runs in your browser", "No extra requests to X", "No Tamis
account, no analytics", "No flags on anyone's name" and "Pause anytime".
It must not say "No labels added to people": Highlight mode shows the note
above inside matched posts.

## Marquee

`store/marquee-1400x560.png` currently shows abstract feed rows on the
right. The brand spec's fuller version places a real popup capture there
(Languages tab, English and Norwegian ticked, Only show), lined up so the
mark's marigold row meets the popup's ticked-row rule. It is optional for
every store.
