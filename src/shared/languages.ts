import { foldText } from "./normalize.ts";

export const LANGUAGES: { code: string; name: string }[] = [
  { code: "ab", name: "Abkhazian" },
  { code: "aa", name: "Afar" },
  { code: "af", name: "Afrikaans" },
  { code: "ak", name: "Akan" },
  { code: "sq", name: "Albanian" },
  { code: "am", name: "Amharic" },
  { code: "ar", name: "Arabic" },
  { code: "an", name: "Aragonese" },
  { code: "hy", name: "Armenian" },
  { code: "as", name: "Assamese" },
  { code: "av", name: "Avaric" },
  { code: "ae", name: "Avestan" },
  { code: "ay", name: "Aymara" },
  { code: "az", name: "Azerbaijani" },
  { code: "bm", name: "Bambara" },
  { code: "ba", name: "Bashkir" },
  { code: "eu", name: "Basque" },
  { code: "be", name: "Belarusian" },
  { code: "bn", name: "Bengali" },
  { code: "bi", name: "Bislama" },
  { code: "bs", name: "Bosnian" },
  { code: "br", name: "Breton" },
  { code: "bg", name: "Bulgarian" },
  { code: "my", name: "Burmese" },
  { code: "ca", name: "Catalan" },
  { code: "ch", name: "Chamorro" },
  { code: "ce", name: "Chechen" },
  { code: "chr", name: "Cherokee" },
  { code: "zh", name: "Chinese" },
  { code: "cu", name: "Church Slavic" },
  { code: "cv", name: "Chuvash" },
  { code: "kw", name: "Cornish" },
  { code: "co", name: "Corsican" },
  { code: "cr", name: "Cree" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "dv", name: "Divehi" },
  { code: "nl", name: "Dutch" },
  { code: "dz", name: "Dzongkha" },
  { code: "en", name: "English" },
  { code: "eo", name: "Esperanto" },
  { code: "et", name: "Estonian" },
  { code: "ee", name: "Ewe" },
  { code: "fo", name: "Faroese" },
  { code: "fj", name: "Fijian" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "ff", name: "Fulah" },
  { code: "gl", name: "Galician" },
  { code: "lg", name: "Ganda" },
  { code: "ka", name: "Georgian" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "gn", name: "Guarani" },
  { code: "gu", name: "Gujarati" },
  { code: "ht", name: "Haitian" },
  { code: "ha", name: "Hausa" },
  { code: "he", name: "Hebrew" },
  { code: "hz", name: "Herero" },
  { code: "hi", name: "Hindi" },
  { code: "ho", name: "Hiri Motu" },
  { code: "hu", name: "Hungarian" },
  { code: "is", name: "Icelandic" },
  { code: "io", name: "Ido" },
  { code: "ig", name: "Igbo" },
  { code: "id", name: "Indonesian" },
  { code: "ia", name: "Interlingua" },
  { code: "ie", name: "Interlingue" },
  { code: "iu", name: "Inuktitut" },
  { code: "ik", name: "Inupiaq" },
  { code: "ga", name: "Irish" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "jv", name: "Javanese" },
  { code: "kl", name: "Kalaallisut" },
  { code: "kn", name: "Kannada" },
  { code: "kr", name: "Kanuri" },
  { code: "ks", name: "Kashmiri" },
  { code: "kk", name: "Kazakh" },
  { code: "km", name: "Khmer" },
  { code: "ki", name: "Kikuyu" },
  { code: "rw", name: "Kinyarwanda" },
  { code: "kv", name: "Komi" },
  { code: "kg", name: "Kongo" },
  { code: "ko", name: "Korean" },
  { code: "kj", name: "Kuanyama" },
  { code: "ku", name: "Kurdish" },
  { code: "ky", name: "Kyrgyz" },
  { code: "lo", name: "Lao" },
  { code: "la", name: "Latin" },
  { code: "lv", name: "Latvian" },
  { code: "li", name: "Limburgish" },
  { code: "ln", name: "Lingala" },
  { code: "lt", name: "Lithuanian" },
  { code: "lu", name: "Luba-Katanga" },
  { code: "lb", name: "Luxembourgish" },
  { code: "mk", name: "Macedonian" },
  { code: "mg", name: "Malagasy" },
  { code: "ms", name: "Malay" },
  { code: "ml", name: "Malayalam" },
  { code: "mt", name: "Maltese" },
  { code: "gv", name: "Manx" },
  { code: "mi", name: "Maori" },
  { code: "mr", name: "Marathi" },
  { code: "mh", name: "Marshallese" },
  { code: "mn", name: "Mongolian" },
  { code: "na", name: "Nauru" },
  { code: "nv", name: "Navajo" },
  { code: "ng", name: "Ndonga" },
  { code: "ne", name: "Nepali" },
  { code: "nd", name: "North Ndebele" },
  { code: "se", name: "Northern Sami" },
  { code: "no", name: "Norwegian" },
  { code: "nb", name: "Norwegian Bokmål" },
  { code: "nn", name: "Norwegian Nynorsk" },
  { code: "ny", name: "Nyanja" },
  { code: "oc", name: "Occitan" },
  { code: "or", name: "Odia" },
  { code: "oj", name: "Ojibwa" },
  { code: "om", name: "Oromo" },
  { code: "os", name: "Ossetic" },
  { code: "pi", name: "Pali" },
  { code: "ps", name: "Pashto" },
  { code: "fa", name: "Persian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "pa", name: "Punjabi" },
  { code: "qu", name: "Quechua" },
  { code: "ro", name: "Romanian" },
  { code: "rm", name: "Romansh" },
  { code: "rn", name: "Rundi" },
  { code: "ru", name: "Russian" },
  { code: "sm", name: "Samoan" },
  { code: "sg", name: "Sango" },
  { code: "sa", name: "Sanskrit" },
  { code: "sc", name: "Sardinian" },
  { code: "gd", name: "Scottish Gaelic" },
  { code: "sr", name: "Serbian" },
  { code: "sn", name: "Shona" },
  { code: "ii", name: "Sichuan Yi" },
  { code: "sd", name: "Sindhi" },
  { code: "si", name: "Sinhala" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "so", name: "Somali" },
  { code: "nr", name: "South Ndebele" },
  { code: "st", name: "Southern Sotho" },
  { code: "es", name: "Spanish" },
  { code: "su", name: "Sundanese" },
  { code: "sw", name: "Swahili" },
  { code: "ss", name: "Swati" },
  { code: "sv", name: "Swedish" },
  { code: "tl", name: "Tagalog" },
  { code: "ty", name: "Tahitian" },
  { code: "tg", name: "Tajik" },
  { code: "ta", name: "Tamil" },
  { code: "tt", name: "Tatar" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "bo", name: "Tibetan" },
  { code: "ti", name: "Tigrinya" },
  { code: "to", name: "Tongan" },
  { code: "ts", name: "Tsonga" },
  { code: "tn", name: "Tswana" },
  { code: "tr", name: "Turkish" },
  { code: "tk", name: "Turkmen" },
  { code: "tw", name: "Twi" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "ug", name: "Uyghur" },
  { code: "uz", name: "Uzbek" },
  { code: "ve", name: "Venda" },
  { code: "vi", name: "Vietnamese" },
  { code: "vo", name: "Volapük" },
  { code: "wa", name: "Walloon" },
  { code: "cy", name: "Welsh" },
  { code: "fy", name: "Western Frisian" },
  { code: "wo", name: "Wolof" },
  { code: "xh", name: "Xhosa" },
  { code: "yi", name: "Yiddish" },
  { code: "yo", name: "Yoruba" },
  { code: "za", name: "Zhuang" },
  { code: "zu", name: "Zulu" },
];

/**
 * Codes X puts on a post (or account) that mean "no language": media or links only
 * (zxx), mentions (qam), hashtags (qht), cashtags (qct), emoji (qme, art), too short
 * (qst) or undetermined (und). "xx" covers the old LOLcat UI locale "xx-lc".
 */
const NO_LANGUAGE = new Set([
  "und",
  "zxx",
  "qme",
  "qam",
  "qct",
  "qht",
  "qst",
  "art",
  "mis",
  "mul",
  "xx",
]);

/** Legacy or alternative codes -> the code LANGUAGES lists. */
const CODE_ALIASES: Record<string, string> = {
  in: "id",
  iw: "he",
  ji: "yi",
  jw: "jv",
  ckb: "ku",
  kmr: "ku",
  nb: "no",
  nn: "no",
  fil: "tl",
  msa: "ms",
  mo: "ro",
};

/**
 * Canonical language code for comparing X's tags with the user's picks:
 * lowercase, region/script subtags dropped (zh-CN -> zh, pt-BR -> pt, hi-Latn -> hi),
 * legacy codes mapped (in -> id, iw -> he, ckb -> ku, nb/nn -> no, fil -> tl).
 * Returns null when the code says there is no language to judge.
 */
export function normalizeLang(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  const base = code.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (!base || NO_LANGUAGE.has(base)) return null;
  return CODE_ALIASES[base] ?? base;
}

/** True when X explicitly tagged the text as having no language (photo, link, emoji...). */
export function isNoLanguageCode(code: string | null | undefined): boolean {
  if (typeof code !== "string") return false;
  const base = code.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return NO_LANGUAGE.has(base);
}

/** Languages X detects on posts (after normalizeLang). All are in LANGUAGES. */
export const X_LANGUAGE_CODES: ReadonlySet<string> = new Set([
  "am", "ar", "bg", "bn", "bo", "ca", "chr", "cs", "cy", "da", "de", "dv", "el", "en",
  "es", "et", "eu", "fa", "fi", "fr", "gu", "he", "hi", "hr", "ht", "hu", "hy", "id", "is",
  "it", "ja", "ka", "km", "kn", "ko", "ku", "lo", "lt", "lv", "ml", "mr", "ms", "my",
  "ne", "nl", "no", "or", "pa", "pl", "ps", "pt", "ro", "ru", "sd", "si", "sk", "sl",
  "sr", "sv", "ta", "te", "th", "tl", "tr", "ug", "uk", "ur", "vi", "zh",
]);

/**
 * Other names for a language -> its code: alternative English names, the labels X
 * shows in "Translated from ...", and native names (for search).
 */
export const LANGUAGE_ALIASES: Record<string, string> = {
  filipino: "tl",
  pilipino: "tl",
  farsi: "fa",
  "haitian creole": "ht",
  "central kurdish": "ku",
  sorani: "ku",
  "sorani kurdish": "ku",
  "kurdish (sorani)": "ku",
  kurmanji: "ku",
  "myanmar (burmese)": "my",
  sinhalese: "si",
  oriya: "or",
  panjabi: "pa",
  pushto: "ps",
  uighur: "ug",
  dhivehi: "dv",
  maldivian: "dv",
  slovene: "sl",
  mandarin: "zh",
  cantonese: "zh",
  "simplified chinese": "zh",
  "traditional chinese": "zh",
  "chinese (simplified)": "zh",
  "chinese (traditional)": "zh",
  bokmal: "no",
  "norwegian bokmal": "no",
  nynorsk: "no",
  "norwegian nynorsk": "no",
  moldovan: "ro",
  flemish: "nl",
  castilian: "es",
  gaelic: "gd",
  kirghiz: "ky",
  cambodian: "km",
  laotian: "lo",
  "bahasa indonesia": "id",
  "bahasa melayu": "ms",
  "bahasa malaysia": "ms",
  "brazilian portuguese": "pt",
  deutsch: "de",
  español: "es",
  espanol: "es",
  français: "fr",
  italiano: "it",
  português: "pt",
  nederlands: "nl",
  polski: "pl",
  türkçe: "tr",
  svenska: "sv",
  norsk: "no",
  dansk: "da",
  suomi: "fi",
  magyar: "hu",
  čeština: "cs",
  română: "ro",
  "tiếng việt": "vi",
  русский: "ru",
  українська: "uk",
  ελληνικά: "el",
  עברית: "he",
  العربية: "ar",
  فارسی: "fa",
  اردو: "ur",
  हिन्दी: "hi",
  हिंदी: "hi",
  বাংলা: "bn",
  தமிழ்: "ta",
  తెలుగు: "te",
  मराठी: "mr",
  ไทย: "th",
  日本語: "ja",
  中文: "zh",
  한국어: "ko",
};

const nameByCode = new Map(LANGUAGES.map((row) => [row.code, row.name]));

/** English name for a code; understands X's variants ("iw", "zh-CN", "in"). */
export function languageName(code: string): string {
  const direct = nameByCode.get(code);
  if (direct) return direct;
  const canonical = normalizeLang(code);
  return (canonical && nameByCode.get(canonical)) || code;
}

const LANGUAGE_NAME_TO_CODE = new Map<string, string>();
for (const row of LANGUAGES) {
  LANGUAGE_NAME_TO_CODE.set(foldText(row.name), row.code);
  LANGUAGE_NAME_TO_CODE.set(row.code, row.code);
}
for (const [alias, code] of Object.entries(LANGUAGE_ALIASES)) {
  LANGUAGE_NAME_TO_CODE.set(foldText(alias), code);
}

/** "Hindi" -> "hi", "Filipino" -> "tl", "Norwegian Bokmål" -> "no". Null when unknown. */
export function languageCodeFromName(name: string): string | null {
  const folded = foldText(name);
  if (!folded) return null;
  const code = LANGUAGE_NAME_TO_CODE.get(folded);
  return code ? normalizeLang(code) : null;
}
