import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCountryIndex, defaultCountryIndex } from "../src/shared/countries.ts";
import { countriesFromLocation } from "../src/shared/match.ts";
import { countriesForSubdivisionCode } from "../src/shared/places.ts";

const real = defaultCountryIndex();

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), name), "utf8")) as T;
}

const cases = fixture<[string, string[]][]>("fixtures/locations.json");
/** Every name in the 0.1.2 country, alias, subdivision and city tables -> its country. */
const oldTables = fixture<Record<string, string>>("fixtures/locations-0.1.2.json");

function parse(text: string): string[] {
  return [...countriesFromLocation(text, real)].sort();
}

function titleCase(text: string): string {
  return text.replace(
    /(^|[\s.-])(\p{Ll})/gu,
    (_match, before: string, letter: string) => before + letter.toUpperCase(),
  );
}

describe("real-world profile locations", () => {
  it("has a large corpus with no duplicates", () => {
    expect(cases.length).toBeGreaterThanOrEqual(250);
    expect(new Set(cases.map(([text]) => text)).size).toBe(cases.length);
  });

  it.each(cases)("%s", (text, expected) => {
    expect(parse(text)).toEqual([...expected].sort());
  });
});

describe("places 0.1.2 knew (R27)", () => {
  // Deliberate changes since 0.1.2.
  const changed: Record<string, string[]> = {
    // The country and the US state are both common on X; context decides.
    georgia: [],
    // The English county; "Surrey, BC" is still Canada.
    surrey: ["GB"],
    // An everyday word and name; "Dar es Salaam" still reads as Tanzania.
    dar: [],
    // Brackets separate parts of a location; X's own label still reads as the name.
    "cocos (keeling) islands": [],
  };

  it("still reads every name from the 0.1.2 tables as the same country", () => {
    expect(Object.keys(oldTables).length).toBeGreaterThan(500);
    for (const [name, code] of Object.entries(oldTables)) {
      const want = changed[name] ?? [code];
      expect(parse(titleCase(name)), titleCase(name)).toEqual(want);
      // "chad" is only the country with a capital C.
      if (name !== "chad") expect(parse(name), name).toEqual(want);
    }
  });

  it("reads the 50 largest US cities by name alone", () => {
    for (const city of [
      "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
      "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
      "Fort Worth", "Columbus", "Indianapolis", "Charlotte", "San Francisco", "Seattle",
      "Denver", "Washington", "Nashville", "Oklahoma City", "El Paso", "Boston", "Portland",
      "Las Vegas", "Detroit", "Memphis", "Louisville", "Baltimore", "Milwaukee",
      "Albuquerque", "Tucson", "Fresno", "Sacramento", "Kansas City", "Mesa", "Atlanta",
      "Omaha", "Colorado Springs", "Raleigh", "Long Beach", "Virginia Beach", "Miami",
      "Oakland", "Minneapolis", "Tulsa", "Bakersfield", "Wichita", "Arlington",
    ]) {
      expect(parse(city), city).toEqual(["US"]);
      // "mesa" is Spanish for table: Mesa needs its capital M.
      if (city !== "Mesa") expect(parse(city.toLowerCase()), city).toEqual(["US"]);
    }
  });

  it("does not read Portuguese and Spanish words as US cities", () => {
    for (const text of [
      "plano astral",
      "Plano Astral",
      "no plano astral",
      "outro plano",
      "em outro plano",
      "plano espiritual",
      "en la mesa",
      "la mesa",
      "mesa redonda",
      "sin mesa",
      "sol amarillo",
      "el submarino amarillo",
    ]) {
      expect(parse(text), text).toEqual([]);
    }
    for (const text of [
      "Plano, TX",
      "plano, tx",
      "Plano TX",
      "PLANO TX",
      "Plano, Texas",
      "Mesa",
      "MESA",
      "Mesa, AZ",
      "mesa, az",
      "Costa Mesa",
      "La Mesa",
      "Amarillo",
      "Amarillo, TX",
      "amarillo, tx",
    ]) {
      expect(parse(text), text).toEqual(["US"]);
    }
    expect(parse("Plano Piloto, Brasília")).toEqual(["BR"]);
  });

  it("reads San Francisco however it is written", () => {
    for (const text of [
      "San Francisco",
      "san francisco",
      "SAN FRANCISCO",
      "San Francisco 🌉",
      "san francisco, ca",
      "San Fran",
      "SF",
      "SF Bay Area",
      "San Francisco Bay Area",
    ]) {
      expect(parse(text), text).toEqual(["US"]);
    }
  });
});

describe("countriesFromLocation", () => {
  it("ignores ordinary words that look like codes (F04)", () => {
    for (const text of [
      "In the clouds",
      "in my head",
      "Living in the moment",
      "follow me",
      "it is what it is",
      "no DMs",
      "To the moon",
      "Living at home",
      "IN GOD WE TRUST",
      "Follow ME",
      "EST. 1999",
      "www.site.de",
      "https://example.in",
    ]) {
      expect(parse(text), text).toEqual([]);
    }
    expect(parse("BORN AND RAISED IN TEXAS")).toEqual(["US"]);
    expect(parse("In NYC")).toEqual(["US"]);
  });

  it("counts a two-letter code only in capitals and where a place goes", () => {
    expect(parse("from US")).toEqual(["US"]);
    expect(parse("from us")).toEqual([]);
    expect(parse("Houston TX")).toEqual(["US"]);
    expect(parse("Houston tx")).toEqual(["US"]);
    expect(parse("Lagos, NG")).toEqual(["NG"]);
    expect(parse("Lagos, ng")).toEqual(["NG"]);
    expect(parse("Somewhere, ng")).toEqual([]);
  });

  it("never reads St or St. as São Tomé", () => {
    expect(parse("St. Petersburg, Russia")).toEqual(["RU"]);
    expect(parse("St Kitts & Nevis")).toEqual(["KN"]);
    expect(parse("St. Louis")).toEqual(["US"]);
  });

  it("reads a colliding code by the city before it (F05)", () => {
    expect(parse("Jaipur, IN")).toEqual(["IN"]);
    expect(parse("Indianapolis, IN")).toEqual(["US"]);
    expect(parse("Munich, DE")).toEqual(["DE"]);
    expect(parse("Wilmington, DE")).toEqual(["US"]);
    expect(parse("Haifa, IL")).toEqual(["IL"]);
    expect(parse("Tirana, AL")).toEqual(["AL"]);
    expect(parse("Perth, WA")).toEqual(["AU"]);
    expect(parse("Seattle, WA")).toEqual(["US"]);
    expect(parse("Utrecht, NL")).toEqual(["NL"]);
    expect(parse("Dammam, SA")).toEqual(["SA"]);
    expect(parse("Adelaide, SA")).toEqual(["AU"]);
    expect(parse("Durban, SA")).toEqual(["ZA"]);
    expect(parse("Mumbai, MH")).toEqual(["IN"]);
    expect(parse("Chennai, TN")).toEqual(["IN"]);
  });

  it("reads a city before a US state code as the US town of that name", () => {
    expect(parse("Venice, CA")).toEqual(["US"]);
    expect(parse("Oxford, MS")).toEqual(["US"]);
    expect(parse("Warsaw, IN")).toEqual(["US"]);
    expect(parse("Delhi, LA")).toEqual(["US"]);
    expect(parse("Milan, MI")).toEqual(["US"]);
    expect(parse("Vienna, VA, USA")).toEqual(["US"]);
    expect(parse("Oxford, Georgia")).toEqual(["US"]);
  });

  it("reads a state code in lower or title case after a place (R26)", () => {
    for (const [text, want] of [
      ["cambridge, ma", ["US"]],
      ["Cambridge, Ma", ["US"]],
      ["Alexandria, Va", ["US"]],
      ["Naples, Fl", ["US"]],
      ["Athens, Ga.", ["US"]],
      ["Birmingham, Al", ["US"]],
      ["london, on", ["CA"]],
      ["victoria, bc", ["CA"]],
      ["Surrey, Bc", ["CA"]],
      ["richmond, bc", ["CA"]],
      ["newcastle, nsw", ["AU"]],
      ["perth, wa", ["AU"]],
      ["vancouver, wa", ["US"]],
      ["Kingston, Ny", ["US"]],
      ["lebanon, pa", ["US"]],
      ["holland, mi", ["US"]],
      ["katy, tx", ["US"]],
      ["Orem, Ut", ["US"]],
      ["la, ca", ["US"]],
      ["salem, or", ["US"]],
      ["Springfield, Mass.", ["US"]],
      ["Pasadena, Calif.", ["US"]],
      ["athens ga", ["US"]],
      ["cambridge ma", ["US"]],
      // The city's own country still wins, and lower-case ISO codes stay words.
      ["jaipur, in", ["IN"]],
      ["munich, de", ["DE"]],
      ["Utrecht, nl", ["NL"]],
      ["Lagos, ng", ["NG"]],
      ["Somewhere, ng", []],
      ["in my head", []],
      ["me, myself and i", []],
      ["coffee, tea, me", []],
      ["yes, or no", []],
      ["Sunday, mass", []],
      ["houston, we have a problem", ["US"]],
      // Lower-case "st", "mt" and "ft" before a name, as 0.1.2 read "st louis".
      ["st louis", ["US"]],
      ["ft lauderdale", ["US"]],
      ["mt pleasant, sc", ["US"]],
      ["main st", []],
      ["Class ACT", []],
      ["Canberra ACT", ["AU"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("reads an all-caps state code after a place (R26)", () => {
    expect(parse("ATHENS GA")).toEqual(["US"]);
    expect(parse("CAMBRIDGE MA")).toEqual(["US"]);
    expect(parse("KATY TX")).toEqual(["US"]);
    expect(parse("SAN MARCOS TX")).toEqual(["US"]);
    for (const text of ["IN GOD WE TRUST", "LOVE YOU MA", "VR AR", "FOLLOW ME", "NO DMS"]) {
      expect(parse(text), text).toEqual([]);
    }
    expect(parse("LIVING IN LA")).toEqual(["US"]);
  });

  it("reads every fixture 'City, ST' row the same in lower and title case (R26)", () => {
    const rows = cases.filter(([text]) => /^[^,]+, [A-Z]{2,3}$/.test(text));
    const variants = rows.flatMap(([text, expected]) => {
      const code = text.slice(text.lastIndexOf(" ") + 1);
      if (countriesForSubdivisionCode(code).length === 0) return [];
      const title = `${text.slice(0, -code.length)}${code[0]}${code.slice(1).toLowerCase()}`;
      return [
        [text.toLowerCase(), expected],
        [title, expected],
      ] as [string, string[]][];
    });
    expect(variants.length).toBeGreaterThan(100);
    for (const [text, expected] of variants) {
      expect(parse(text), text).toEqual([...expected].sort());
    }
  });

  it("reads a country or state name before a state code as a US town", () => {
    expect(parse("Lebanon, PA")).toEqual(["US"]);
    expect(parse("Mexico, MO")).toEqual(["US"]);
    expect(parse("Poland, OH")).toEqual(["US"]);
    expect(parse("India, MH")).toEqual(["IN"]);
    expect(parse("Canada, BC")).toEqual(["CA"]);
  });

  it("still reads a state code of the city's own country by the city", () => {
    expect(parse("Chennai, TN")).toEqual(["IN"]);
    expect(parse("Panaji, GA")).toEqual(["IN"]);
    expect(parse("Belém, PA")).toEqual(["BR"]);
    expect(parse("Tijuana, B.C.")).toEqual(["MX"]);
    expect(parse("La Paz, BCS")).toEqual(["MX"]);
    expect(parse("Palermo (PA)")).toEqual(["IT"]);
    expect(parse("Milano, MI")).toEqual(["IT"]);
    // Alone or after an unknown place, such a code keeps its usual reading.
    expect(parse("Somewhere, BC")).toEqual(["CA"]);
    expect(parse("KA")).toEqual([]);
  });

  it("reads a state code after a dash or slash by the place before it (R29)", () => {
    for (const [text, want] of [
      ["Porto Alegre - RS", ["BR"]],
      ["Porto Alegre/RS", ["BR"]],
      ["Salvador - BA", ["BR"]],
      ["Salvador/BA", ["BR"]],
      ["Aracaju - SE", ["BR"]],
      ["Belo Horizonte - MG", ["BR"]],
      ["Curitiba - PR", ["BR"]],
      ["Porto Velho - RO", ["BR"]],
      ["Brasil - RS", ["BR"]],
      ["Vitória - ES", ["BR"]],
      ["Kochi - KL", ["IN"]],
      ["Bhopal - MP", ["IN"]],
      ["Tijuana - BC", ["MX"]],
      ["La Paz - BCS", ["MX"]],
      ["RS 🇧🇷", ["BR"]],
      // After a town missing from the tables, as "Town, MG": Minas Gerais is far
      // more common than Madagascar, so MG decides nothing.
      ["Lavras/MG", []],
      ["Pouso Alegre - MG", []],
      ["Pouso Alegre, MG", []],
      ["Lavras - MG, Brasil", ["BR"]],
      ["Antananarivo - MG", ["MG"]],
      ["Antananarivo, MG", ["MG"]],
      ["MG", ["MG"]],
      // Not that place's state: the code keeps its own reading.
      ["London / LA", ["GB", "US"]],
      ["London / KL", ["GB", "MY"]],
      ["Toronto / BC", ["CA"]],
      ["Paris / PA", ["FR"]],
      ["RS", ["RS"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("reads a province or state code after a dash or slash by the place before it", () => {
    for (const [text, want] of [
      ["Regina - SK", ["CA"]],
      ["Regina / SK", ["CA"]],
      ["Saskatoon - SK", ["CA"]],
      ["St. John's - NL", ["CA"]],
      ["St John's / NL", ["CA"]],
      ["Newfoundland - NL", ["CA"]],
      ["Toronto | NL", ["CA"]],
      ["Canada - NL", ["CA"]],
      ["London - ON", ["CA"]],
      ["Victoria - BC", ["CA"]],
      ["Sydney / NS", ["CA"]],
      ["Perth / WA", ["AU"]],
      ["Georgia / GA", ["US"]],
      // Not a province of that place: the code keeps its own reading.
      ["Amsterdam - NL", ["NL"]],
      ["Bratislava / SK", ["SK"]],
      ["Lima - PE", ["PE"]],
      ["NL", ["NL"]],
      ["SK", ["SK"]],
      // US codes that stand for cities too: a second place, not the namesake.
      ["London / LA", ["GB", "US"]],
      ["London / NY", ["GB", "US"]],
      ["Paris / PA", ["FR"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("knows mid-size Brazilian cities before a state code (R29)", () => {
    for (const text of [
      "Vitória, ES",
      "Palmas, TO",
      "Montes Claros, MG",
      "Uberaba, MG",
      "Santa Maria, RS",
      "Ilhéus, BA",
      "Vitória da Conquista, BA",
      "Caruaru, PE",
      "Petrolina, PE",
      "Cascavel, PR",
      "Chapecó, SC",
    ]) {
      expect(parse(text), text).toEqual(["BR"]);
    }
    // Minas Gerais is far more common on X than Madagascar after a town.
    expect(parse("Somewhere, MG")).toEqual([]);
    expect(parse("Antananarivo, MG")).toEqual(["MG"]);
    expect(parse("Uppsala, SE")).toEqual(["SE"]);
    expect(parse("Kragujevac, RS")).toEqual(["RS"]);
    expect(parse("Cluj, RO")).toEqual(["RO"]);
    expect(parse("Las Palmas")).toEqual(["ES"]);
    expect(parse("Vitoria-Gasteiz")).toEqual(["ES"]);
    expect(parse("Vitoria, España")).toEqual(["ES"]);
    expect(parse("Santa Maria, CA")).toEqual(["US"]);
  });

  it("drops a city abbreviation that disagrees with the place before it", () => {
    expect(parse("Kochi, KL")).toEqual(["IN"]);
    expect(parse("Petaling Jaya, KL")).toEqual(["MY"]);
    expect(parse("KL")).toEqual(["MY"]);
  });

  it("counts acronym and slang codes only right after a known city", () => {
    for (const text of [
      "Tired AF",
      "NA",
      "EU/NA",
      "AI/ML",
      "Coffee, code, AI",
      "Engineer, QA",
      "Founder, VC",
      "ETH",
      "BTC | ETH",
      "GEO",
      "KEN",
    ]) {
      expect(parse(text), text).toEqual([]);
    }
    expect(parse("Texas AF")).toEqual(["US"]);
    expect(parse("Kabul AF")).toEqual(["AF"]);
    expect(parse("Windhoek, NA")).toEqual(["NA"]);
    expect(parse("Doha, QA")).toEqual(["QA"]);
  });

  it("reads job acronyms after a word as jobs, not places (R32)", () => {
    for (const text of ["Tech PR", "Crypto PR", "Head of BD", "Senior SE", "HR Manager"]) {
      expect(parse(text), text).toEqual([]);
    }
    expect(parse("Fashion PR, NYC")).toEqual(["US"]);
    // After a known city, as a whole part or alone they are still places.
    for (const [text, want] of [
      ["San Juan PR", ["PR"]],
      ["Caguas PR", ["PR"]],
      ["Arecibo PR", ["PR"]],
      ["Rincon, PR", ["PR"]],
      ["NYC | PR", ["PR", "US"]],
      ["PR", ["PR"]],
      ["Zagreb HR", ["HR"]],
      ["Split, HR", ["HR"]],
      ["HR", ["HR"]],
      ["Dhaka BD", ["BD"]],
      ["BD", ["BD"]],
      ["Stockholm SE", ["SE"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("reads N./S./E./W. before a place as North, South, East, West", () => {
    expect(parse("N. Korea")).toEqual(["KP"]);
    expect(parse("S Korea")).toEqual(["KR"]);
    expect(parse("N. Ireland")).toEqual(["GB"]);
    expect(parse("S. Africa")).toEqual(["ZA"]);
    expect(parse("Plan B")).toEqual([]);
    // Region names are not the US ("C. America" once read as "America").
    expect(parse("C. America")).toEqual([]);
    expect(parse("S. America")).toEqual([]);
  });

  it("uses the documented default for an unknown city before a colliding code", () => {
    // US "City, ST" is the common form; a few codes lean to the country or stay open.
    expect(parse("Carmel, IN")).toEqual(["US"]);
    expect(parse("Somewhere, CA")).toEqual(["US"]);
    expect(parse("Somewhere, NL")).toEqual(["NL"]);
    expect(parse("Somewhere, DE")).toEqual([]);
    expect(parse("Somewhere, SA")).toEqual([]);
    expect(parse("Springfield, IL, USA")).toEqual(["US"]);
  });

  it("leaves a bare colliding code undecided, except LA, NL and SK", () => {
    expect(parse("MA")).toEqual([]);
    expect(parse("IN")).toEqual([]);
    expect(parse("CA")).toEqual([]);
    expect(parse("PE")).toEqual([]);
    expect(parse("LA")).toEqual(["US"]);
    expect(parse("TX")).toEqual(["US"]);
    expect(parse("FR")).toEqual(["FR"]);
    expect(parse("IT")).toEqual([]);
    // Small provinces lose to the country, as after a place (R30).
    expect(parse("NL")).toEqual(["NL"]);
    expect(parse("NL.")).toEqual(["NL"]);
    expect(parse("SK")).toEqual(["SK"]);
    expect(parse("NL, Europe")).toEqual(["NL"]);
    expect(parse("NL / EU")).toEqual(["NL"]);
  });

  it("lets a flag pick between the readings of a bare code (R30)", () => {
    expect(parse("NL 🇨🇦")).toEqual(["CA"]);
    expect(parse("PE 🇧🇷")).toEqual(["BR"]);
    expect(parse("LA 🇱🇦")).toEqual(["LA"]);
    expect(parse("MA 🇲🇦")).toEqual(["MA"]);
    expect(parse("CA 🇨🇦")).toEqual(["CA"]);
  });

  it("lets a country or state after a separator decide which city is meant (R28)", () => {
    for (const [text, want] of [
      ["Cali - Colombia", ["CO"]],
      ["Cali | Colombia", ["CO"]],
      ["Cali/Colombia", ["CO"]],
      ["Cali — Colombia", ["CO"]],
      ["Cali. Colombia", ["CO"]],
      ["Cali; Colombia", ["CO"]],
      ["Cali • Colombia", ["CO"]],
      ["Valencia - Venezuela", ["VE"]],
      ["Barcelona - Venezuela", ["VE"]],
      ["Mérida - Venezuela", ["VE"]],
      ["San José - Costa Rica", ["CR"]],
      ["León - Nicaragua", ["NI"]],
      ["Granada - Nicaragua", ["NI"]],
      ["Tripoli - Lebanon", ["LB"]],
      ["Hyderabad | Sindh", ["PK"]],
      ["Santiago - República Dominicana", ["DO"]],
      ["Córdoba - España", ["ES"]],
      ["Paris - Texas", ["US"]],
      ["London - Ontario", ["CA"]],
      // Two unrelated places stay two places.
      ["London | Lagos", ["GB", "NG"]],
      ["London / LA", ["GB", "US"]],
      ["Paris / LA", ["FR", "US"]],
      ["London / Toronto", ["CA", "GB"]],
      ["Karachi, Pakistan | Dallas, TX", ["PK", "US"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("lets a flag pick between a place's own readings, never add one (R28)", () => {
    for (const [text, want] of [
      ["Cali 🇨🇴", ["CO"]],
      ["Valencia 🇻🇪", ["VE"]],
      ["Hyderabad 🇵🇰", ["PK"]],
      ["Santiago 🇩🇴", ["DO"]],
      ["London 🇨🇦", ["CA"]],
      ["Victoria 🇨🇦", ["CA"]],
      ["Kingston 🇨🇦", ["CA"]],
      ["Georgia 🇺🇸", ["US"]],
      ["Georgia 🇬🇪", ["GE"]],
      // A flag that is not one of the place's readings changes nothing.
      ["NYC 🇺🇦", ["US"]],
      ["London 🇳🇬", ["GB"]],
      ["London 🇬🇧🇨🇦", ["GB"]],
      // The words beat the flag.
      ["Paris, Texas 🇫🇷", ["US"]],
      ["Cali, Colombia 🇺🇸", ["CO"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("does not let a bare USA or a US flag move a world city to its US namesake", () => {
    for (const [text, want] of [
      ["Paris | USA", ["FR", "US"]],
      ["Berlin / USA", ["DE", "US"]],
      ["London | USA", ["GB", "US"]],
      ["Moscow | USA", ["RU", "US"]],
      ["Lima | USA", ["PE", "US"]],
      ["Birmingham | USA", ["GB", "US"]],
      ["Paris - United States", ["FR", "US"]],
      ["London 🇺🇸", ["GB"]],
      ["Berlin 🇺🇸🇮🇱", ["DE"]],
      ["Moscow 🇺🇸", ["RU"]],
      ["Cairo 🇺🇸", ["EG"]],
      ["Athens 🇺🇸", ["GR"]],
      // A US state still settles the city; so do the words in one part.
      ["Paris - Texas", ["US"]],
      ["Moscow | Idaho", ["US"]],
      ["Berlin, NH", ["US"]],
      ["Paris, Texas, USA", ["US"]],
      // A flag still picks between readings that are equally common.
      ["Georgia 🇺🇸", ["US"]],
      ["Jersey 🇺🇸", ["US"]],
      ["Cali 🇺🇸", ["US"]],
      ["Cali 🇨🇴", ["CO"]],
      ["London 🇨🇦", ["CA"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("keeps every place in a multi-location text (F19)", () => {
    expect(parse("Lagos, Nigeria. Follow me")).toEqual(["NG"]);
    expect(parse("India | DM me")).toEqual(["IN"]);
    expect(parse("London / LA")).toEqual(["GB", "US"]);
    expect(parse("Berlin & LA")).toEqual(["DE", "US"]);
    expect(parse("Karachi, Pakistan | Dallas, TX")).toEqual(["PK", "US"]);
    expect(parse("London, UK / Toronto, ON")).toEqual(["CA", "GB"]);
    expect(countriesFromLocation("Lagos, Nigeria, London, UK", real)).toEqual(["NG", "GB"]);
  });

  it("does not re-read words inside a matched phrase (F21)", () => {
    expect(parse("Rio de Janeiro")).toEqual(["BR"]);
    expect(parse("Dar es Salaam")).toEqual(["TZ"]);
    expect(parse("Frankfurt am Main")).toEqual(["DE"]);
    expect(parse("Port of Spain")).toEqual(["TT"]);
    expect(parse("La Paz, Bolivia")).toEqual(["BO"]);
    expect(parse("Santiago de Chile")).toEqual(["CL"]);
  });

  it("lets a state or country after a city decide which city is meant (F21)", () => {
    expect(parse("Paris, Texas")).toEqual(["US"]);
    expect(parse("Moscow, Idaho")).toEqual(["US"]);
    expect(parse("London, Ontario")).toEqual(["CA"]);
    expect(parse("Perth, Scotland")).toEqual(["GB"]);
    expect(parse("Sydney, Nova Scotia")).toEqual(["CA"]);
    expect(parse("Hyderabad, Sindh, Pakistan")).toEqual(["PK"]);
    expect(parse("Birmingham, Alabama")).toEqual(["US"]);
  });

  it("does not read slogans, suburbs and valleys as the city abroad (R31)", () => {
    for (const [text, want] of [
      ["Free State of Florida", ["US"]],
      ["Free State of New Hampshire", ["US"]],
      ["Free State of Texas 🇺🇸", ["US"]],
      ["Bloemfontein, Free State", ["ZA"]],
      ["Free State", ["ZA"]],
      ["Kingston upon Thames", ["GB"]],
      ["Kingston", ["JM"]],
      ["Venice Beach", ["US"]],
      ["Venice Beach, Los Angeles", ["US"]],
      ["Venice", ["IT"]],
      ["Rio Grande Valley", ["US"]],
      ["RGV", ["US"]],
      ["Rio", ["BR"]],
      ["Durban, Natal", ["ZA"]],
      ["Natal", ["BR"]],
      ["Santiago, RD", ["DO"]],
      ["Santo Domingo, RD", ["DO"]],
      ["Santiago, DR", ["DO"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("knows a few more regions people write after their city", () => {
    for (const [text, want] of [
      ["Cali, Valle del Cauca", ["CO"]],
      ["Antioquia", ["CO"]],
      ["神奈川県", ["JP"]],
      ["北海道", ["JP"]],
      ["Tri-State", ["US"]],
      ["Jamaica Plain, Boston", ["US"]],
      ["Jamaica", ["JM"]],
    ] as [string, string[]][]) {
      expect(parse(text), text).toEqual(want);
    }
  });

  it("reads Georgia by context", () => {
    expect(parse("Atlanta, Georgia")).toEqual(["US"]);
    expect(parse("Tbilisi, Georgia")).toEqual(["GE"]);
    expect(parse("Macon, Georgia")).toEqual(["US"]);
    expect(parse("Georgia")).toEqual([]);
    expect(parse("South Georgia")).toEqual(["US"]);
    expect(parse("South Georgia and the South Sandwich Islands")).toEqual(["GS"]);
    // X's "Account based in: Georgia" is the country: see match-decisions.test.ts.
  });

  it("tells similar names apart", () => {
    expect(parse("Indiana")).toEqual(["US"]);
    expect(parse("New Mexico")).toEqual(["US"]);
    expect(parse("New Jersey")).toEqual(["US"]);
    expect(parse("Dominica")).toEqual(["DM"]);
    expect(parse("Dominican Republic")).toEqual(["DO"]);
    expect(parse("Niger")).toEqual(["NE"]);
    expect(parse("Nigeria")).toEqual(["NG"]);
    expect(parse("Port Harcourt, Niger Delta")).toEqual(["NG"]);
    expect(parse("Jersey")).toEqual(["JE"]);
    expect(parse("South Jersey")).toEqual(["US"]);
    expect(parse("Sudan")).toEqual(["SD"]);
    expect(parse("South Sudan")).toEqual(["SS"]);
  });

  it("reads America region names as regions, never the US (F22)", () => {
    for (const text of ["South America", "Latin America", "Central America", "North America"]) {
      expect(parse(text), text).toEqual([]);
    }
    expect(parse("Lima, Peru, South America")).toEqual(["PE"]);
    expect(parse("America")).toEqual(["US"]);
  });

  it("folds accents instead of splitting words (F20)", () => {
    expect(parse("Montréal")).toEqual(["CA"]);
    expect(parse("Ciudad de México")).toEqual(["MX"]);
    expect(parse("Việt Nam")).toEqual(["VN"]);
    expect(parse("Curaçao")).toEqual(["CW"]);
    expect(parse("Cote d'Ivoire")).toEqual(["CI"]);
  });

  it("reads flags, native names and exonyms (F25)", () => {
    expect(parse("🇮🇳")).toEqual(["IN"]);
    expect(parse("भारत")).toEqual(["IN"]);
    expect(parse("日本東京")).toEqual(["JP"]);
    expect(parse("Deutschland")).toEqual(["DE"]);
    expect(parse("Estados Unidos")).toEqual(["US"]);
  });

  it("uses flags only when the words name no place", () => {
    expect(parse("NYC 🇺🇦")).toEqual(["US"]);
    expect(parse("Proud 🇺🇸 patriot")).toEqual(["US"]);
  });

  it("does not read heritage words as a place (F58)", () => {
    expect(parse("Asian American, NYC")).toEqual(["US"]);
    expect(parse("Indian-American")).toEqual([]);
    expect(parse("Nigerian in London")).toEqual(["GB"]);
  });

  it("works with a small hand-built index", () => {
    const tiny = {
      names: new Map([
        ["nigeria", "NG"],
        ["japan", "JP"],
      ]),
      iso3: new Map([["nga", "NG"]]),
      cities: new Map([["lagos", "NG"]]),
    };
    expect(countriesFromLocation("Lagos / Japan", tiny)).toEqual(["NG", "JP"]);
    expect(countriesFromLocation("NGA", tiny)).toEqual(["NG"]);
    expect(countriesFromLocation("from NG", tiny)).toEqual(["NG"]);
  });

  it("parses 20k locations quickly (F27)", () => {
    const index = buildCountryIndex();
    const started = performance.now();
    for (let i = 0; i < 20_000; i += 1) {
      countriesFromLocation(`${cases[i % cases.length]![0]} ${i}`, index);
    }
    expect(performance.now() - started).toBeLessThan(1500);
  });
});
