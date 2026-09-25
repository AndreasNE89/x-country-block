# Store screenshots

Five 1280x800 PNGs with no alpha, full bleed and square corners. The same
five go to the Chrome Web Store, Firefox Add-ons and Edge Add-ons, in this
order. `node scripts/store-screenshots.mjs` makes all five, in one layout;
screenshot 2 also needs your capture of x.com.

| # | File | Right-hand side |
|---|------|-----------------|
| 1 | `store/screenshots/screenshot-1-languages-1280x800.png` | Popup, generated |
| 2 | `store/screenshots/screenshot-2-highlight-1280x800.png` | Your capture, `store/screenshots/highlight-capture.png` |
| 3 | `store/screenshots/screenshot-3-focus-1280x800.png` | Popup, generated |
| 4 | `store/screenshots/screenshot-4-regions-1280x800.png` | Popup, generated |
| 5 | `store/screenshots/screenshot-5-privacy-1280x800.png` | Popup, generated |

`node scripts/render-brand.mjs` makes the icons and promo art, not these
screenshots. Remove the old 0.1.x screenshot from every store and never
publish `release/store-screenshot-1280x800.png`. Examples stay neutral: two
languages, one small country with its language, or a whole region. Never
demo hiding a single country.

## The layout

Every shot has the Tamis mark and wordmark at the top left, the headline
(Inter 600) with its sub-line and short points on the left, and fine print
at the bottom left. On the right, shots 1, 3, 4 and 5 show the popup under
its toolbar button with the marigold badge, with a band in the mark's
kept-row colour running behind it; shot 2 shows your capture. The fine print
reads "Works on x.com and twitter.com. Not affiliated with or endorsed by X
Corp.", or on shot 2 "Accounts blurred for privacy. Not affiliated with or
endorsed by X Corp."

## Screenshots 1, 3, 4 and 5: generated

The script builds the production popup (`node scripts/build.mjs --prod`),
loads `dist/popup.html` in headless Chrome with a stand-in for the extension
APIs, and captures it at 2x. Nothing on these four comes from x.com: no
feed, no accounts, no X logo, so nothing needs blurring. The count on the
status line and the badge is the number the stand-in tab reports; everything
else is the popup exactly as it ships.

| # | Headline | Popup state | Band behind |
|---|----------|-------------|-------------|
| 1 | Your feed, in the languages you read. | Light. Hide matches, Languages tab, Japanese and Portuguese ticked. "Hiding Japanese, Portuguese · 14 on this tab", badge 14. | Ticked rows |
| 3 | Focus mode: only the places you pick. | Light. Only show with the PRO pill and "Trial · 7 days left". Countries tab, Norway ticked; the tray also holds Norwegian. "Showing only Norway, Norwegian · 38 set aside". | Ticked rows |
| 4 | One tick covers a whole region. | Dark. Only show (bought), Regions tab, Europe ticked. "Showing only Europe · 23 set aside". | Ticked rows |
| 5 | Private by design. | Light. Hide matches with "Highlight instead of hide" on, Languages tab, Japanese and Portuguese ticked. "Highlighting matches for Japanese, Portuguese · 14 on this tab". The Filtering switch shows its keyboard focus ring. | The footer, "Runs in your browser · no extra requests to X" |

Screenshot 5's points are "Runs in your browser", "No extra requests to X",
"No Tamis account, no analytics", "No flags on anyone's name" and "Pause
anytime". They must stay true of the build. Never write "No labels added to
people": Highlight mode shows a note inside matched posts.

Run the script again after any change to the popup, and look at the PNGs
before you commit them. The script needs Chrome (set `CHROME_PATH` if it is
not in a usual place) and network access to Google Fonts for Inter. Before
it captures, it checks the popup's status text, count and trial chip, that
neither the Focus mode offer nor the development-only Test unlock is
showing, and on shot 5 that the Filtering switch shows its focus ring. If a
popup change makes that check fail, update `SHOTS` in the script and look at
the result again. Two runs with the same Chrome give the same bytes, but
another Chrome version or machine can move a few pixels of text, so commit
new PNGs when what they show has changed.

## Screenshot 2: capture it on x.com

"Highlight first. Hide when you're sure." This one has to show Highlight
mode on a real feed, so it is a capture from your own browser. Sub-line: "See
exactly what matched, and why. Free." Points: "An outline and a note on
each match", "“Always show @handle” in one tap" and "Only you see the
notes".

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
   favicon and X's left navigation: both show the X logo. The script shows
   the capture at most at 1x, fitted into a 600x720 area, so a crop of about
   1200x1440 px fills it; a wider crop is shown smaller. Crop as tightly as
   the posts and the popup allow.
8. In Photopea or GIMP, blur (Gaussian, about 12 px at 2x) every avatar,
   display name, @handle and photo that shows people, including the
   @handle inside each "Always show @handle" button. Also blur the post
   text of private individuals; posts from organisations may stay legible.
   Never edit post text, and never paste the popup onto a made-up feed.
9. Save the blurred crop as `store/screenshots/highlight-capture.png`,
   still at 2x.
10. Run `node scripts/store-screenshots.mjs`. It prints the scale your
    capture is shown at and writes
    `store/screenshots/screenshot-2-highlight-1280x800.png`. Look at it
    next to screenshots 1, 3, 4 and 5.

## Marquee

`store/marquee-1400x560.png` currently shows abstract feed rows on the
right. The brand spec's fuller version places a real popup capture there
(Languages tab, English and Norwegian ticked, Only show), lined up so the
mark's marigold row meets the popup's ticked-row rule. It is optional for
every store.
