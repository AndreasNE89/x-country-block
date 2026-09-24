const ASCII = /^[\x00-\x7f]*$/;

// Accents and vowel points that decomposition splits off Latin, Greek, Cyrillic,
// Hebrew and Arabic letters, plus the Arabic tatweel. Indic and Thai vowel signs
// are marks too, but they carry meaning, so they stay.
const COMBINING =
  /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-֑︯-ׇֽֿׁׂׅׄؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭـ]/g;

// Letters with no Unicode decomposition.
const SPECIAL: Record<string, string> = {
  ß: "ss",
  ø: "o",
  ł: "l",
  æ: "ae",
  œ: "oe",
  đ: "d",
  ı: "i",
  þ: "th",
  ð: "d",
  ħ: "h",
  ŀ: "l",
};
const SPECIAL_LETTER = /[ßøłæœđıþðħŀ]/g;

// "U.S.A." / "D.C." -> "USA" / "DC". Runs before punctuation becomes spaces,
// otherwise the letters would split into separate one-letter words.
const DOTTED_INITIALS = /(?<![\p{L}\p{N}])\p{L}(?:\.\p{L})+\.?(?![\p{L}\p{N}])/gu;
const NON_WORD = /[^\p{L}\p{N}\p{M}]+/gu;

/**
 * Remove the dots from dotted initials ("U.S.A." -> "USA"). Keeps the case unless
 * `upper` is set ("u.s." -> "US"): dotted letters are an abbreviation either way.
 */
export function collapseDottedInitials(input: string, upper = false): string {
  return input.replace(DOTTED_INITIALS, (match) => {
    const letters = match.replace(/\./g, "");
    return upper ? letters.toUpperCase() : letters;
  });
}

// A flag emoji is a pair of regional indicator symbols, one per letter of the ISO code.
const FLAG_PAIR = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
// England, Scotland and Wales use a black flag followed by tag letters ("gbeng").
const TAG_FLAG = /\u{1F3F4}([\u{E0061}-\u{E007A}]+)\u{E007F}/gu;
const INDICATOR_A = 0x1f1e6;
const TAG_A = 0xe0061;

/** ISO2 codes of the flag emoji in a text, in order: "🇮🇳 🏴󠁧󠁢󠁳󠁣󠁴󠁿" -> ["IN", "GB"]. */
export function flagCountryCodes(input: string): string[] {
  const codes = new Set<string>();
  for (const [pair] of input.matchAll(FLAG_PAIR)) {
    const letters = [...pair].map((ch) => String.fromCharCode(ch.codePointAt(0)! - INDICATOR_A + 65));
    codes.add(letters.join(""));
  }
  for (const match of input.matchAll(TAG_FLAG)) {
    const tag = [...match[1]!].map((ch) => String.fromCharCode(ch.codePointAt(0)! - TAG_A + 97)).join("");
    codes.add(tag.slice(0, 2).toUpperCase());
  }
  return [...codes];
}

/** The text without its flag emoji. */
export function stripFlags(input: string): string {
  return input.replace(FLAG_PAIR, " ").replace(TAG_FLAG, " ");
}

/**
 * Lowercase, accent-free form for matching and search: "São Paulo" -> "sao paulo",
 * "Trinidad & Tobago" -> "trinidad and tobago", "U.K." -> "uk". Non-Latin scripts
 * stay as letters ("भारत", "日本"), so native names can match.
 */
export function foldText(input: string): string {
  let text = input;
  const ascii = ASCII.test(text);
  if (!ascii) text = text.normalize("NFKD").replace(COMBINING, "").normalize("NFC");
  text = text.toLowerCase();
  if (!ascii) text = text.replace(SPECIAL_LETTER, (letter) => SPECIAL[letter] ?? letter);
  return collapseDottedInitials(text).replace(/&/g, " and ").replace(NON_WORD, " ").trim();
}
