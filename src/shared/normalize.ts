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

/** Remove the dots from dotted initials ("U.S.A." -> "USA"), keeping case. */
export function collapseDottedInitials(input: string): string {
  return input.replace(DOTTED_INITIALS, (match) => match.replace(/\./g, ""));
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
