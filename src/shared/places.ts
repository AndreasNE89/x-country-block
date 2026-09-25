/** USPS state codes. Several collide with ISO countries (MA Morocco, CA Canada, IN India). */
export const US_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

export const CA_PROVINCE_CODES = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
]);

export const AU_STATE_CODES = new Set(["ACT", "NSW", "QLD", "SA", "TAS", "VIC", "WA"]);

/**
 * First-level subdivisions (and a few well-known areas) by country, "|"-separated.
 * Names that are also countries (Georgia, Punjab in two countries) are in
 * AMBIGUOUS_PLACES instead.
 */
const SUBDIVISIONS_BY_COUNTRY: Record<string, string> = {
  US:
    "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Hawaii|" +
    "Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|" +
    "Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|" +
    "New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|" +
    "Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|" +
    "West Virginia|Wisconsin|Wyoming|District of Columbia|New England|Midwest|Pacific Northwest|" +
    "PNW|SoCal|NorCal|Bay Area|SF Bay Area|Silicon Valley|Upstate New York|Long Island|DMV|DFW|" +
    "Dallas-Fort Worth|Twin Cities|Tri-State Area|North Georgia|South Georgia|North Jersey|" +
    "South Jersey|Central Jersey|Rio Grande Valley|RGV",
  CA:
    "Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|" +
    "Newfoundland|Newfoundland and Labrador|Prince Edward Island|PEI|Yukon|Nunavut|" +
    "Northwest Territories",
  AU:
    "New South Wales|Queensland|Western Australia|South Australia|Tasmania|Northern Territory|" +
    "Australian Capital Territory",
  GB:
    "Scotland|Wales|Northern Ireland|North Ireland|Cornwall|Yorkshire|West Yorkshire|South Yorkshire|" +
    "North Yorkshire|Lancashire|Essex|Cumbria|Merseyside|West Midlands|Greater Manchester|" +
    "Greater London|East Anglia|Northumberland|Hertfordshire|Hampshire|Berkshire|Oxfordshire|" +
    "Dorset|Wiltshire|Sussex|East Sussex|West Sussex|Cheshire|Derbyshire|Nottinghamshire|" +
    "Leicestershire|Lincolnshire|Staffordshire|Shropshire|Gloucestershire|Warwickshire|" +
    "Worcestershire|Buckinghamshire|Cambridgeshire|Northamptonshire|County Durham|Tyne and Wear|" +
    "Isle of Wight|Fife|Ayrshire|Lanarkshire|Aberdeenshire|County Antrim|County Down|Derry|" +
    "Londonderry|Anglesey|Gwynedd|Pembrokeshire",
  IN:
    "Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|" +
    "Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|" +
    "Mizoram|Nagaland|Odisha|Orissa|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|" +
    "Uttar Pradesh|Uttarakhand|West Bengal|Jammu and Kashmir|Ladakh|Andaman and Nicobar|" +
    "Delhi NCR",
  PK:
    "Sindh|Khyber Pakhtunkhwa|KPK|Balochistan|Baluchistan|Gilgit-Baltistan|Azad Kashmir|AJK|" +
    "Islamabad Capital Territory",
  BR:
    "Minas Gerais|Bahia|Pernambuco|Ceará|Goiás|Santa Catarina|Rio Grande do Sul|" +
    "Rio Grande do Norte|Paraíba|Maranhão|Piauí|Alagoas|Sergipe|Espírito Santo|Mato Grosso|" +
    "Mato Grosso do Sul|Tocantins|Rondônia|Roraima|Amapá",
  MX:
    "Jalisco|Nuevo León|Baja California|Baja California Sur|Sonora|Sinaloa|Coahuila|Chiapas|" +
    "Yucatán|Quintana Roo|Tamaulipas|Michoacán|Guanajuato|Morelos|Nayarit|Zacatecas|Tabasco|" +
    "Tlaxcala|Campeche|Colima|Estado de México|Edomex",
  DE:
    "Bayern|Bavaria|Baden-Württemberg|Nordrhein-Westfalen|North Rhine-Westphalia|NRW|Hessen|" +
    "Hesse|Niedersachsen|Lower Saxony|Sachsen|Saxony|Thüringen|Thuringia|Brandenburg|" +
    "Mecklenburg-Vorpommern|Schleswig-Holstein|Rheinland-Pfalz|Rhineland-Palatinate|Saarland|" +
    "Sachsen-Anhalt|Saxony-Anhalt",
  NG:
    "Lagos State|FCT|Rivers State|Delta State|Oyo|Ogun|Ondo|Osun|Ekiti|Edo State|Anambra|" +
    "Enugu State|Imo State|Abia|Akwa Ibom|Cross River|Bayelsa|Ebonyi|Kogi|Kwara|Benue|" +
    "Plateau State|Nasarawa|Niger State|Kaduna State|Kano State|Katsina|Jigawa|Bauchi|Gombe|" +
    "Borno|Yobe|Adamawa|Taraba|Sokoto State|Kebbi|Zamfara|Niger Delta|South South",
  ID:
    "Bali|Jawa Barat|Jawa Timur|Jawa Tengah|West Java|East Java|Central Java|Sumatra|Sumatera|" +
    "North Sumatra|Sumatera Utara|Sulawesi|Kalimantan|Aceh|Riau|Banten|Lombok|Nusa Tenggara|Maluku",
  PH:
    "Luzon|Mindanao|Visayas|Metro Manila|Cavite|Bulacan|Pampanga|Batangas|Pangasinan|Negros|" +
    "Palawan|Bohol|Leyte",
  MY:
    "Selangor|Sabah|Sarawak|Johor|Kedah|Kelantan|Terengganu|Pahang|Perak|Negeri Sembilan|Perlis|" +
    "Labuan",
  ES:
    "Catalonia|Catalunya|Cataluña|Andalusia|Andalucía|Galicia|Basque Country|Euskadi|País Vasco|" +
    "Canary Islands|Islas Canarias|Canarias|Balearic Islands|Illes Balears|Mallorca|Majorca|" +
    "Tenerife|Gran Canaria|Asturias|Cantabria|Aragón|Extremadura|Castilla y León|" +
    "Castilla-La Mancha|Comunidad Valenciana|Navarra",
  IT:
    "Sicily|Sicilia|Sardinia|Sardegna|Lombardy|Lombardia|Tuscany|Toscana|Veneto|Lazio|Campania|" +
    "Puglia|Apulia|Piedmont|Piemonte|Calabria|Emilia-Romagna|Liguria|Umbria|Abruzzo|" +
    "Friuli|Trentino|South Tyrol|Alto Adige|Basilicata|Molise",
  FR:
    "Île-de-France|Provence|Brittany|Bretagne|Normandy|Normandie|Alsace|Corsica|Corse|" +
    "Occitanie|Auvergne|Burgundy|Bourgogne|Aquitaine|Nouvelle-Aquitaine|Hauts-de-France|" +
    "Grand Est|Pays de la Loire|Côte d'Azur|French Riviera|Haute-Savoie",
  CN:
    "Guangdong|Sichuan|Hubei|Hunan|Henan|Shandong|Jiangsu|Zhejiang|Fujian|Yunnan|Guangxi|" +
    "Xinjiang|Inner Mongolia|Hainan|Anhui|Jiangxi|Shanxi|Shaanxi|Hebei|Liaoning|Jilin|" +
    "Heilongjiang|Gansu|Guizhou",
  JP: "Hokkaido|Okinawa|Kyushu|Honshu|Shikoku|Kanto|Kansai",
  KR: "Gyeonggi",
  RU: "Siberia|Tatarstan|Chechnya|Dagestan|Bashkortostan|Yakutia|Kamchatka",
  ZA:
    "Gauteng|KwaZulu-Natal|KZN|Western Cape|Eastern Cape|Northern Cape|Limpopo|Mpumalanga|" +
    "Free State",
  GH: "Ashanti|Greater Accra",
  EG: "Sinai",
};

function splitList(list: string): string[] {
  return list
    .split("|")
    .map((name) => name.trim())
    .filter(Boolean);
}

function invert(table: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [iso2, list] of Object.entries(table)) {
    for (const name of splitList(list)) {
      const key = name.toLowerCase();
      if (!(key in out)) out[key] = iso2;
    }
  }
  return out;
}

/** Subdivision name (lowercase, may contain accents) -> ISO2. */
export const SUBDIVISION_NAMES: Record<string, string> = invert(SUBDIVISIONS_BY_COUNTRY);

/**
 * Capital and largest cities for every country above ~1M people, plus common
 * nicknames and native spellings. Each name is listed once, under the country that
 * most people mean; same-named cities elsewhere are in CITY_ALT_COUNTRIES.
 * Left out on purpose: names that are ordinary words (Nice, Split, Reading, Mobile,
 * Buffalo, Salem, Hue, Male) and names shared by two big cities (Santa Cruz).
 */
const CITIES_BY_COUNTRY: Record<string, string> = {
  // Africa
  DZ: "Algiers|Alger|Oran|Constantine|Annaba|Blida|Sétif|Batna|الجزائر العاصمة",
  AO: "Luanda|Huambo|Lobito|Benguela",
  BJ: "Porto-Novo|Cotonou|Parakou|Abomey-Calavi",
  BW: "Gaborone|Francistown",
  BF: "Ouagadougou|Bobo-Dioulasso",
  BI: "Gitega|Bujumbura",
  CM: "Yaoundé|Douala|Garoua|Bamenda|Bafoussam",
  DJ: "Djibouti City",
  CF: "Bangui",
  TD: "N'Djamena|Ndjamena|Moundou",
  KM: "Moroni",
  CD: "Kinshasa|Lubumbashi|Mbuji-Mayi|Kisangani|Goma|Bukavu|Kananga",
  CG: "Brazzaville|Pointe-Noire",
  CI: "Abidjan|Yamoussoukro|Bouaké|Daloa|Korhogo",
  EG:
    "Cairo|Alexandria|Giza|Shubra El Kheima|Port Said|Suez|Luxor|Aswan|Mansoura|Tanta|" +
    "Sharm El Sheikh|Hurghada|Ismailia|Zagazig|القاهرة|الإسكندرية",
  GQ: "Malabo|Bata",
  ER: "Asmara",
  SZ: "Mbabane|Manzini",
  ET: "Addis Ababa|Addis|Dire Dawa|Mekelle|Gondar|Bahir Dar|Hawassa|Adama",
  GA: "Libreville|Port-Gentil",
  GM: "Banjul|Serekunda",
  GH: "Accra|Kumasi|Tamale|Takoradi|Sekondi-Takoradi|Cape Coast",
  GN: "Conakry|Nzérékoré|Kankan",
  GW: "Bissau",
  KE: "Nairobi|Mombasa|Kisumu|Nakuru|Eldoret|Thika|Malindi",
  LS: "Maseru",
  LR: "Monrovia",
  LY: "Tripoli|Benghazi|Misrata|Tobruk",
  MG: "Antananarivo|Toamasina",
  MW: "Lilongwe|Blantyre|Mzuzu",
  ML: "Bamako|Sikasso|Timbuktu",
  MR: "Nouakchott|Nouadhibou",
  MU: "Port Louis",
  MA: "Rabat|Casablanca|Marrakech|Marrakesh|Fez|Fes|Tangier|Tanger|Agadir|Meknes|Oujda|Kenitra|Tetouan",
  MZ: "Maputo|Matola|Beira|Nampula",
  NA: "Windhoek|Walvis Bay",
  NE: "Niamey|Zinder|Maradi",
  NG:
    "Lagos|Abuja|Kano|Ibadan|Port Harcourt|PH City|Benin City|Kaduna|Enugu|Onitsha|Aba|Jos|" +
    "Ilorin|Owerri|Abeokuta|Warri|Calabar|Uyo|Akure|Maiduguri|Sokoto|Zaria|Asaba|Ikeja|Lekki|" +
    "Surulere|Victoria Island|Ajah|Ikorodu|Yola|Makurdi|Lokoja|Osogbo|Ado-Ekiti|Bauchi City",
  RW: "Kigali|Musanze",
  SN: "Dakar|Touba|Thiès|Ziguinchor|Kaolack",
  SL: "Freetown|Kenema|Makeni",
  SO: "Mogadishu|Hargeisa|Bosaso|Kismayo|Garowe",
  ZA:
    "Johannesburg|Joburg|Jozi|JHB|Cape Town|Durban|Pretoria|Tshwane|Port Elizabeth|Gqeberha|" +
    "Bloemfontein|Soweto|Polokwane|Nelspruit|Mbombela|Pietermaritzburg|Stellenbosch|Sandton|Kimberley",
  SS: "Juba|Malakal",
  SD: "Khartoum|Omdurman|Port Sudan|Kassala|Nyala",
  TZ: "Dodoma|Dar es Salaam|Mwanza|Arusha|Zanzibar|Mbeya|Tanga",
  TG: "Lomé",
  TN: "Tunis|Sfax|Sousse|Kairouan|Bizerte|Djerba",
  UG: "Kampala|Gulu|Entebbe|Jinja|Mbarara",
  ZM: "Lusaka|Kitwe|Ndola|Livingstone",
  ZW: "Harare|Bulawayo|Mutare|Gweru|Victoria Falls",
  EH: "Laayoune|El Aaiún",
  // Asia
  AF: "Kabul|Kandahar|Herat|Mazar-i-Sharif|Jalalabad|کابل",
  AM: "Yerevan|Gyumri|Vanadzor",
  AZ: "Baku|Sumgait|Sumqayit",
  BH: "Manama|Muharraq",
  BD: "Dhaka|Dacca|Chittagong|Chattogram|Khulna|Rajshahi|Sylhet|Comilla|Rangpur|Barisal|ঢাকা",
  BT: "Thimphu",
  BN: "Bandar Seri Begawan",
  KH: "Phnom Penh|Siem Reap|Battambang|Sihanoukville",
  CN:
    "Beijing|Peking|Shanghai|Guangzhou|Shenzhen|Chengdu|Chongqing|Tianjin|Wuhan|Hangzhou|" +
    "Nanjing|Xi'an|Xian|Suzhou|Shenyang|Harbin|Qingdao|Dalian|Xiamen|Kunming|Changsha|Zhengzhou|" +
    "Jinan|Hefei|Fuzhou|Nanning|Urumqi|Lhasa|Dongguan|Foshan|Ningbo|Wuxi|北京|上海|广州|廣州|" +
    "深圳|成都|重庆|重慶|天津|武汉|杭州|南京",
  CY: "Nicosia|Limassol|Larnaca|Paphos|Famagusta",
  GE: "Tbilisi|Batumi|Kutaisi|Rustavi",
  HK: "Kowloon|Tsim Sha Tsui|Causeway Bay",
  IN:
    "Mumbai|Bombay|Delhi|New Delhi|Bengaluru|Bangalore|Hyderabad|Ahmedabad|Chennai|Madras|" +
    "Kolkata|Calcutta|Pune|Poona|Surat|Jaipur|Lucknow|Kanpur|Nagpur|Indore|Thane|Bhopal|" +
    "Visakhapatnam|Vizag|Patna|Vadodara|Baroda|Ghaziabad|Ludhiana|Agra|Nashik|Faridabad|Meerut|" +
    "Rajkot|Varanasi|Banaras|Srinagar|Aurangabad|Dhanbad|Amritsar|Navi Mumbai|Allahabad|" +
    "Prayagraj|Ranchi|Howrah|Coimbatore|Jabalpur|Gwalior|Vijayawada|Jodhpur|Madurai|Raipur|" +
    "Guwahati|Chandigarh|Mysore|Mysuru|Gurgaon|Gurugram|Noida|Greater Noida|Kochi|Cochin|" +
    "Thiruvananthapuram|Trivandrum|Bhubaneswar|Dehradun|Udaipur|Mangalore|Mangaluru|Shimla|" +
    "Jammu|Puducherry|Pondicherry|Kozhikode|Calicut|Tiruchirappalli|Trichy|Hubli|Belgaum|" +
    "Belagavi|Warangal|Guntur|Nellore|Jamshedpur|Siliguri|Bareilly|Aligarh|Moradabad|Gorakhpur|" +
    "Ajmer|Bikaner|Jalandhar|Kolhapur|Solapur|Tirupati|Vellore|Thrissur|Imphal|Shillong|" +
    "Aizawl|Kohima|Agartala|Itanagar|Gangtok|Panaji|Port Blair|Ayodhya|Mathura|Rishikesh|" +
    "Haridwar|Nainital|Darjeeling|Secunderabad|Hyderabad Deccan|Bilaspur|Bhilai|" +
    "मुंबई|दिल्ली|नई दिल्ली|कोलकाता|" +
    "बेंगलुरु|चेन्नई|लखनऊ|जयपुर|पटना|भोपाल|इंदौर|वाराणसी",
  ID:
    "Jakarta|Surabaya|Bandung|Medan|Semarang|Makassar|Palembang|Tangerang|Depok|Bekasi|Bogor|" +
    "Yogyakarta|Jogja|Jogjakarta|Malang|Denpasar|Batam|Pekanbaru|Balikpapan|Padang|Manado|" +
    "Surakarta|Pontianak|Banjarmasin|Samarinda|Jayapura|Kupang|Mataram|Ambon|Jaksel|Jabodetabek",
  IR:
    "Tehran|Teheran|Mashhad|Isfahan|Esfahan|Karaj|Shiraz|Tabriz|Qom|Ahvaz|Kermanshah|Rasht|" +
    "Kerman|Yazd|تهران|مشهد|اصفهان|شیراز|تبریز",
  IQ: "Baghdad|Basra|Mosul|Erbil|Arbil|Sulaymaniyah|Najaf|Karbala|Kirkuk|Duhok|بغداد|البصرة",
  IL:
    "Jerusalem|Tel Aviv|Tel Aviv-Yafo|Haifa|Rishon LeZion|Petah Tikva|Ashdod|Netanya|" +
    "Beersheba|Be'er Sheva|Eilat|Herzliya|Ramat Gan|תל אביב|ירושלים|חיפה",
  JP:
    "Tokyo|Osaka|Yokohama|Nagoya|Sapporo|Fukuoka|Kyoto|Kawasaki|Saitama|Hiroshima|Sendai|" +
    "Chiba|Kitakyushu|Naha|Nara|Niigata|Hamamatsu|Kumamoto|Okayama|Shizuoka|Kagoshima|" +
    "Kanazawa|Nagasaki|Shinjuku|Shibuya|Akihabara|東京|大阪|横浜|名古屋|札幌|福岡|神戸|京都|" +
    "広島|仙台|渋谷|新宿",
  JO: "Amman|Zarqa|Irbid|Aqaba|عمّان",
  KZ: "Astana|Nur-Sultan|Almaty|Alma-Ata|Shymkent|Karaganda|Aktobe|Алматы|Астана",
  KW: "Kuwait City",
  KG: "Bishkek|Osh|Бишкек",
  LA: "Vientiane|Luang Prabang|Pakse",
  LB: "Beirut|Sidon|Byblos|Jounieh|Zahle|بيروت",
  MY:
    "Kuala Lumpur|Penang|George Town|Johor Bahru|Ipoh|Shah Alam|Petaling Jaya|Kota Kinabalu|" +
    "Kuching|Malacca|Melaka|Putrajaya|Cyberjaya|Seremban|Klang|Subang Jaya|Kuantan|Alor Setar",
  MN: "Ulaanbaatar|Ulan Bator|Erdenet|Улаанбаатар",
  MM: "Yangon|Rangoon|Mandalay|Naypyidaw|Nay Pyi Taw|Mawlamyine",
  NP: "Kathmandu|Pokhara|Lalitpur|Biratnagar|Birgunj|काठमाडौं",
  KP: "Pyongyang|Hamhung|Chongjin|평양",
  OM: "Muscat|Salalah|Sohar|Nizwa",
  PK:
    "Karachi|Lahore|Islamabad|Rawalpindi|Pindi|Faisalabad|Multan|Peshawar|Quetta|Gujranwala|" +
    "Sialkot|Sargodha|Bahawalpur|Sukkur|Larkana|Abbottabad|Mardan|Gujrat|Sahiwal|" +
    "Muzaffarabad|Gilgit|Skardu|Gwadar|Sheikhupura|Jhelum|Dera Ghazi Khan|Mingora|کراچی|لاہور|" +
    "اسلام آباد|پشاور",
  PS: "Ramallah|Gaza|Gaza City|Hebron|Nablus|Bethlehem|Jenin|Khan Yunis|Rafah|Jericho|غزة|رام الله",
  PH:
    "Manila|Quezon City|Davao|Davao City|Cebu|Cebu City|Makati|Taguig|Pasig|Caloocan|Zamboanga|" +
    "Cagayan de Oro|Antipolo|Baguio|Iloilo|Iloilo City|Bacolod|General Santos|Pasay|Parañaque|" +
    "Las Piñas|Mandaluyong|Marikina|Muntinlupa|Tacloban|Angeles City|BGC",
  QA: "Doha|Al Rayyan|Lusail|Al Wakrah|الدوحة",
  SA:
    "Riyadh|Jeddah|Jiddah|Jidda|Mecca|Makkah|Medina|Madinah|Dammam|Khobar|Al Khobar|Dhahran|" +
    "Taif|Tabuk|Buraidah|Abha|Khamis Mushait|Jubail|Yanbu|Najran|Jazan|Qatif|Hofuf|Al Ahsa|" +
    "NEOM|الرياض|جدة|مكة|مكة المكرمة|المدينة المنورة|الدمام",
  KR:
    "Seoul|Busan|Pusan|Incheon|Daegu|Daejeon|Gwangju|Suwon|Ulsan|Changwon|Seongnam|Goyang|" +
    "Yongin|Jeju|Gangnam|Pohang|Jeonju|Cheongju|서울|부산|인천|대구|대전|광주|제주",
  LK:
    "Colombo|Kandy|Galle|Jaffna|Negombo|Dehiwala|Moratuwa|Batticaloa|Trincomalee|Anuradhapura|" +
    "Sri Jayawardenepura Kotte",
  SY: "Damascus|Aleppo|Homs|Latakia|Hama|Deir ez-Zor|Raqqa|Idlib|Tartus|Daraa|Qamishli|دمشق|حلب",
  TW: "Taipei|Kaohsiung|Taichung|Tainan|Taoyuan|Hsinchu|New Taipei|Keelung|Hualien|台北|臺北|高雄|台中|臺中",
  TJ: "Dushanbe|Khujand",
  TH:
    "Bangkok|Chiang Mai|Phuket|Pattaya|Nonthaburi|Khon Kaen|Hat Yai|Udon Thani|" +
    "Nakhon Ratchasima|Korat|Chiang Rai|Krabi|Koh Samui|Hua Hin|Ayutthaya|กรุงเทพ|กรุงเทพฯ|" +
    "กรุงเทพมหานคร|เชียงใหม่|ภูเก็ต",
  TL: "Dili",
  TR:
    "Istanbul|Ankara|Izmir|Bursa|Antalya|Adana|Konya|Gaziantep|Kayseri|Mersin|Eskişehir|" +
    "Diyarbakır|Samsun|Trabzon|Bodrum|Kocaeli|Izmit|Sakarya|Denizli|Malatya|Erzurum|Şanlıurfa|" +
    "Urfa|Manisa|Balıkesir|Hatay|Antakya|Kahramanmaraş|Muğla|Fethiye|Alanya|Edirne|Çanakkale|" +
    "Sivas|Tekirdağ|Aydın|Kadıköy|Beşiktaş|Üsküdar|Constantinople",
  TM: "Ashgabat|Turkmenabat",
  AE:
    "Dubai|Abu Dhabi|Sharjah|Al Ain|Ajman|Ras Al Khaimah|Fujairah|Umm Al Quwain|DXB|دبي|أبوظبي|ابوظبي",
  UZ: "Tashkent|Samarkand|Namangan|Andijan|Bukhara|Fergana|Nukus|Toshkent",
  VN:
    "Hanoi|Ha Noi|Ho Chi Minh|Ho Chi Minh City|HCMC|Saigon|Sai Gon|Da Nang|Haiphong|Hai Phong|" +
    "Can Tho|Nha Trang|Vung Tau|Bien Hoa|Da Lat|Dalat|Hoi An|Quy Nhon|Ha Long|Halong",
  YE: "Sanaa|Sana'a|Aden|Taiz|Hodeidah|Mukalla|Marib|صنعاء|عدن",
  // Europe
  AL: "Tirana|Tiranë|Durrës|Vlorë|Shkodër|Elbasan",
  AD: "Andorra la Vella",
  AT: "Vienna|Wien|Graz|Linz|Salzburg|Innsbruck|Klagenfurt",
  BY: "Minsk|Gomel|Homel|Mogilev|Vitebsk|Grodno|Минск",
  BE:
    "Brussels|Bruxelles|Brussel|Antwerp|Antwerpen|Anvers|Ghent|Charleroi|Liège|" +
    "Bruges|Brugge|Leuven|Louvain|Namur|Mechelen|Hasselt",
  BA: "Sarajevo|Banja Luka|Tuzla|Mostar|Zenica",
  BG: "Sofia|Plovdiv|Varna|Burgas|София",
  HR: "Zagreb|Rijeka|Osijek|Zadar|Dubrovnik|Varaždin|Šibenik|Karlovac|Slavonski Brod",
  CZ: "Prague|Praha|Brno|Ostrava|Plzeň|Pilsen|Olomouc|Liberec",
  DK: "Copenhagen|København|Aarhus|Århus|Odense|Aalborg|Esbjerg",
  EE: "Tallinn|Tartu|Narva|Pärnu",
  FI: "Helsinki|Espoo|Tampere|Vantaa|Oulu|Turku|Jyväskylä|Lahti|Kuopio|Rovaniemi",
  FR:
    "Paris|Marseille|Marseilles|Lyon|Lyons|Toulouse|Nantes|Strasbourg|Montpellier|Bordeaux|" +
    "Lille|Rennes|Reims|Le Havre|Saint-Étienne|Toulon|Grenoble|Dijon|Nîmes|Villeurbanne|" +
    "Clermont-Ferrand|Le Mans|Aix-en-Provence|Amiens|Limoges|Annecy|Perpignan|Metz|" +
    "Besançon|Orléans|Rouen|Mulhouse|Caen|Avignon|Cannes|Biarritz|Versailles",
  DE:
    "Berlin|Hamburg|Munich|München|Cologne|Köln|Frankfurt|Frankfurt am Main|Stuttgart|" +
    "Düsseldorf|Leipzig|Dortmund|Essen|Bremen|Dresden|Hanover|Hannover|Nuremberg|Nürnberg|" +
    "Duisburg|Bochum|Wuppertal|Bielefeld|Bonn|Münster|Karlsruhe|Mannheim|Augsburg|Wiesbaden|" +
    "Gelsenkirchen|Mönchengladbach|Braunschweig|Kiel|Aachen|Chemnitz|Magdeburg|Freiburg|" +
    "Krefeld|Mainz|Lübeck|Erfurt|Rostock|Kassel|Heidelberg|Potsdam|Regensburg|Würzburg|" +
    "Ingolstadt|Ulm|Wolfsburg|Göttingen|Darmstadt|Saarbrücken|Oldenburg|Osnabrück|Jena|Trier|" +
    "Konstanz|Bamberg",
  GR:
    "Athens|Athína|Αθήνα|Thessaloniki|Θεσσαλονίκη|Salonica|Patras|Heraklion|Larissa|Volos|" +
    "Ioannina|Chania|Piraeus|Mykonos|Santorini|Corfu|Crete",
  HU: "Budapest|Debrecen|Szeged|Miskolc|Pécs|Győr",
  IS: "Reykjavik|Reykjavík",
  IE: "Dublin|Limerick|Galway|Waterford|Kilkenny|Drogheda|Dundalk|Sligo|Athlone|Baile Átha Cliath",
  IT:
    "Rome|Roma|Milan|Milano|Naples|Napoli|Turin|Torino|Palermo|Genoa|Genova|Bologna|Florence|" +
    "Firenze|Bari|Catania|Venice|Venezia|Verona|Messina|Padua|Padova|Trieste|Brescia|Parma|" +
    "Taranto|Prato|Modena|Reggio Calabria|Reggio Emilia|Perugia|Livorno|Cagliari|Pisa|Bergamo|" +
    "Siena|Lecce|Salerno|Rimini|Trento|Bolzano|Vicenza|Monza|Sorrento|Amalfi|Capri|" +
    "Pescara|Ancona|Udine|Lucca|Positano",
  XK: "Pristina|Prishtina|Prishtinë|Prizren|Peja|Mitrovica",
  LV: "Riga|Daugavpils|Liepāja",
  LT: "Vilnius|Kaunas|Klaipėda|Šiauliai",
  LI: "Vaduz",
  LU: "Luxembourg City",
  MT: "Valletta|Sliema|Birkirkara|Mdina",
  MD: "Chișinău|Chisinau|Kishinev|Bălți|Tiraspol",
  ME: "Podgorica|Budva|Kotor",
  NL:
    "Amsterdam|Rotterdam|The Hague|Den Haag|Utrecht|Eindhoven|Groningen|Tilburg|Almere|Breda|" +
    "Nijmegen|Haarlem|Arnhem|Leiden|Maastricht|Delft|Zwolle|Enschede|Amersfoort|Apeldoorn|" +
    "Den Bosch|'s-Hertogenbosch|Dordrecht|Leeuwarden",
  MK: "Skopje|Bitola|Kumanovo|Ohrid|Tetovo",
  NO:
    "Oslo|Bergen|Trondheim|Stavanger|Drammen|Fredrikstad|Kristiansand|Tromsø|Bodø|Ålesund|" +
    "Sandnes|Tønsberg",
  PL:
    "Warsaw|Warszawa|Kraków|Krakow|Cracow|Łódź|Wrocław|Poznań|Gdańsk|Szczecin|Bydgoszcz|" +
    "Lublin|Białystok|Katowice|Gdynia|Częstochowa|Radom|Toruń|Sopot|Rzeszów|Olsztyn|Kielce|" +
    "Zakopane|Opole|Gliwice",
  PT:
    "Lisbon|Lisboa|Porto|Oporto|Braga|Coimbra|Funchal|Faro|Aveiro|Setúbal|Évora|Guimarães|" +
    "Sintra|Cascais|Albufeira|Madeira|Azores|Açores",
  RO:
    "Bucharest|București|Bucuresti|Cluj-Napoca|Cluj|Timișoara|Iași|Constanța|Craiova|Brașov|" +
    "Galați|Ploiești|Oradea|Sibiu|Arad|Pitești",
  RU:
    "Moscow|Moskva|Москва|Saint Petersburg|Санкт-Петербург|Петербург|Leningrad|Novosibirsk|" +
    "Yekaterinburg|Ekaterinburg|Kazan|Nizhny Novgorod|Chelyabinsk|Samara|Omsk|Rostov-on-Don|" +
    "Rostov|Ufa|Krasnoyarsk|Voronezh|Volgograd|Krasnodar|Saratov|Tyumen|Tolyatti|Izhevsk|" +
    "Barnaul|Irkutsk|Khabarovsk|Vladivostok|Yaroslavl|Makhachkala|Tomsk|Orenburg|Kemerovo|" +
    "Novokuznetsk|Ryazan|Astrakhan|Penza|Kaliningrad|Sochi|Murmansk|Grozny|Yakutsk|" +
    "Arkhangelsk|Kursk|Tver|Vologda|Kaluga|Smolensk|Bryansk|Surgut|Norilsk|Magnitogorsk|" +
    "Новосибирск|Екатеринбург|Казань",
  RS: "Belgrade|Beograd|Београд|Novi Sad|Niš|Kragujevac|Subotica",
  SK: "Bratislava|Košice|Prešov|Žilina|Nitra|Banská Bystrica",
  SI: "Ljubljana|Maribor|Celje",
  ES:
    "Madrid|Barcelona|Valencia|Seville|Sevilla|Zaragoza|Saragossa|Málaga|Murcia|Palma|" +
    "Palma de Mallorca|Las Palmas|Las Palmas de Gran Canaria|Bilbao|Alicante|Valladolid|Vigo|" +
    "Gijón|Granada|A Coruña|La Coruña|Vitoria-Gasteiz|Elche|Oviedo|Santander|Pamplona|" +
    "San Sebastián|Donostia|Cádiz|Marbella|Ibiza|Benidorm|Tarragona|Girona|Almería|Huelva|" +
    "Jerez|Santiago de Compostela|Santa Cruz de Tenerife|Castellón|Badajoz|Burgos|Logroño|" +
    "Albacete|Getafe|Alcalá de Henares|Móstoles",
  SE:
    "Stockholm|Gothenburg|Göteborg|Malmö|Uppsala|Västerås|Örebro|Linköping|Helsingborg|" +
    "Jönköping|Norrköping|Lund|Umeå|Gävle|Kiruna",
  CH:
    "Zurich|Zürich|Geneva|Genève|Genf|Basel|Bâle|Bern|Berne|Lausanne|Lucerne|Luzern|Lugano|" +
    "Saint Gallen|Sankt Gallen|Winterthur|Davos|Interlaken|Zermatt|Montreux",
  UA:
    "Kyiv|Kiev|Київ|Киев|Kharkiv|Kharkov|Харків|Odesa|Odessa|Одеса|Dnipro|Dnipropetrovsk|" +
    "Donetsk|Zaporizhzhia|Lviv|Lvov|Львів|Kryvyi Rih|Mykolaiv|Mariupol|Luhansk|Vinnytsia|" +
    "Kherson|Poltava|Chernihiv|Cherkasy|Sumy|Zhytomyr|Ivano-Frankivsk|Ternopil|Uzhhorod|" +
    "Chernivtsi|Lutsk|Rivne|Bucha",
  GB:
    "London|LDN|Manchester|Birmingham|Glasgow|Liverpool|Leeds|Edinburgh|Bristol|Sheffield|" +
    "Newcastle|Newcastle upon Tyne|Nottingham|Leicester|Cardiff|Belfast|Southampton|Brighton|" +
    "Portsmouth|Plymouth|Coventry|Bradford|Stoke-on-Trent|Wolverhampton|Swansea|Aberdeen|" +
    "Dundee|Oxford|Cambridge|Norwich|Exeter|Sunderland|Milton Keynes|Luton|Bournemouth|" +
    "Middlesbrough|Huddersfield|Blackpool|Bolton|Stockport|Salford|Croydon|Inverness|Stirling|" +
    "Canterbury|Ipswich|Northampton|Watford|Slough|Wembley|Hackney|Brixton|Islington|" +
    "Shoreditch|Surrey|Kingston upon Hull|Kingston upon Thames|Tottenham|Peckham|" +
    "Stockton-on-Tees",
  // Americas
  US:
    "New York City|NYC|Los Angeles|Cali|Chicago|Houston|Phoenix|Philadelphia|Philly|" +
    "San Antonio|San Diego|Dallas|Austin|Jacksonville|San Jose|San Francisco|San Fran|" +
    "Fort Worth|Columbus|Charlotte|" +
    "Indianapolis|Seattle|Denver|Washington DC|Washington D C|Nashville|Oklahoma City|El Paso|" +
    "Boston|Portland|Las Vegas|Vegas|Detroit|Memphis|Louisville|Baltimore|Milwaukee|" +
    "Albuquerque|Tucson|Fresno|Sacramento|Kansas City|Atlanta|ATL|Omaha|Colorado Springs|" +
    "Raleigh|Miami|Virginia Beach|Oakland|Minneapolis|Tulsa|Tampa|New Orleans|NOLA|Wichita|" +
    "Cleveland|Bakersfield|Anaheim|Honolulu|Corpus Christi|Lexington|Saint Paul|Cincinnati|" +
    "Pittsburgh|Greensboro|Anchorage|Orlando|Irvine|Newark|Durham|Chula Vista|Toledo|" +
    "Fort Wayne|Laredo|Jersey City|Lubbock|Scottsdale|Reno|Glendale|North Las Vegas|" +
    "Winston-Salem|Fremont|Hialeah|Richmond|Boise|Spokane|Baton Rouge|Tacoma|San Bernardino|" +
    "Des Moines|Santa Clarita|Fayetteville|Oxnard|Rochester|Grand Rapids|Huntsville|" +
    "Salt Lake City|Salt Lake|SLC|Knoxville|Chattanooga|Savannah|Charleston|Syracuse|Pasadena|" +
    "Berkeley|Palo Alto|Mountain View|Cupertino|Menlo Park|Sunnyvale|Santa Monica|Venice Beach|" +
    "Hollywood|" +
    "Beverly Hills|Malibu|Long Beach|Brooklyn|Manhattan|Queens|Bronx|The Bronx|Staten Island|" +
    "Harlem|Hoboken|Miami Beach|Fort Lauderdale|West Palm Beach|Palm Beach|Key West|" +
    "Tallahassee|Gainesville|Pensacola|Sarasota|Saint Louis|STL|Ann Arbor|Green Bay|" +
    "Sioux Falls|Fargo|Little Rock|Tuscaloosa|Shreveport|Asheville|" +
    "Chapel Hill|Wilmington|Columbia|Greenville|Myrtle Beach|Annapolis|Hartford|New Haven|" +
    "Stamford|Albany|Ithaca|Harrisburg|Allentown|Scranton|Erie|Akron|Dayton|Youngstown|Lansing|" +
    "Kalamazoo|South Bend|Evansville|Bloomington|Champaign|Peoria|Springfield|Topeka|" +
    "Waco|McAllen|Brownsville|Galveston|Frisco|Tempe|Flagstaff|Sedona|Juneau|Fairbanks|Hilo|" +
    "Maui|Boulder|Fort Collins|Provo|Ogden|Missoula|Bozeman|Rapid City|Duluth|Cedar Rapids|" +
    "Iowa City|Biloxi|Gulfport|Macon|Clearwater|Fort Myers|Boca Raton|Kissimmee|Daytona Beach|" +
    "Arlington|Mesa|Stockton|Plano|Modesto|Yonkers|Moreno Valley|Amarillo|Huntington Beach|" +
    "Overland Park|Grand Prairie|McKinney|Cape Coral|Newport News|Elk Grove|Rancho Cucamonga|" +
    "Garden Grove|Pembroke Pines|Palmdale|Clarksville|Rockford|Naperville|Joliet|Bridgeport|" +
    "Killeen|Mesquite|Pomona|Fullerton|Visalia|Olathe|Round Rock|Thousand Oaks|Murfreesboro|" +
    "Costa Mesa|College Station|Temecula|Jefferson City|Carson City|Chesapeake|Abilene|" +
    "Carlsbad|Port Saint Lucie|" +
    "Hampton Roads|Jersey Shore|Sin City|Motor City|Windy City|Big Apple|Chi-town|H-Town|" +
    "Dallas-Fort Worth",
  CA:
    "Toronto|Montreal|Vancouver|Calgary|Edmonton|Ottawa|Winnipeg|Quebec City|Hamilton|Kitchener|" +
    "Halifax|Victoria BC|Mississauga|Brampton|Laval|Gatineau|Saskatoon|Regina|Windsor|Markham|" +
    "Kelowna|Burnaby|Oakville|Sudbury|Guelph|Moncton|Fredericton|Saint John|" +
    "Charlottetown|Whitehorse|Yellowknife|Iqaluit|Thunder Bay|Nanaimo|Kamloops|Lethbridge|" +
    "Red Deer|Sherbrooke|Trois-Rivières|Longueuil|Scarborough|Etobicoke|North York|" +
    "Niagara Falls|The 6ix",
  MX:
    "Mexico City|Ciudad de México|CDMX|Guadalajara|Monterrey|Puebla|Tijuana|León|Juárez|" +
    "Ciudad Juárez|Zapopan|Mérida|Cancún|Querétaro|San Luis Potosí|Aguascalientes|Hermosillo|" +
    "Chihuahua|Saltillo|Morelia|Culiacán|Acapulco|Toluca|Veracruz|Oaxaca|Mazatlán|" +
    "Tuxtla Gutiérrez|Torreón|Ensenada|Mexicali|Puerto Vallarta|Playa del Carmen|Tulum|" +
    "Cuernavaca|Tampico|Reynosa|Matamoros|Nuevo Laredo|Villahermosa|Xalapa|Tlaquepaque|" +
    "Tlalnepantla|Ecatepec|Nezahualcóyotl|Naucalpan|GDL|MTY",
  GT: "Guatemala City|Ciudad de Guatemala|Quetzaltenango|Xela|Antigua Guatemala|Mixco|Villa Nueva",
  HN: "Tegucigalpa|San Pedro Sula|La Ceiba|Choloma",
  SV: "San Salvador|Soyapango",
  NI: "Managua|Masaya|Matagalpa",
  CR: "Alajuela|Cartago|Heredia",
  PA: "Panama City|Ciudad de Panamá|San Miguelito",
  CU: "Havana|La Habana|Santiago de Cuba|Camagüey|Holguín",
  DO:
    "Santo Domingo|Santiago de los Caballeros|Punta Cana|La Romana|San Pedro de Macorís|" +
    "Puerto Plata",
  HT: "Port-au-Prince|Cap-Haïtien|Pétion-Ville|Gonaïves",
  JM: "Kingston|Montego Bay|Spanish Town|Portmore|Ocho Rios|Negril",
  PR:
    "San Juan|Bayamón|Ponce|Caguas|Mayagüez|Guaynabo|Arecibo|Aguadilla|Humacao|Fajardo|" +
    "Cayey|Trujillo Alto|Vega Baja|Toa Baja|Cabo Rojo|Yauco|Guayama|Manatí",
  TT: "Port of Spain|Chaguanas|Arima",
  BS: "Nassau",
  BB: "Bridgetown",
  CO:
    "Bogotá|Medellín|Barranquilla|Cartagena|Cúcuta|Bucaramanga|Pereira|Santa Marta|Ibagué|" +
    "Manizales|Villavicencio|Pasto|Montería|Neiva|Popayán|Valledupar|Sincelejo|Tunja|Riohacha",
  VE:
    "Caracas|Maracaibo|Barquisimeto|Maracay|Ciudad Guayana|Maturín|Puerto La Cruz|" +
    "San Cristóbal|Cumaná|Ciudad Bolívar|Barinas|Puerto Ordaz",
  EC: "Quito|Guayaquil|Cuenca|Ambato|Manta|Machala|Portoviejo|Esmeraldas|Galápagos",
  PE:
    "Lima|Arequipa|Trujillo|Chiclayo|Piura|Iquitos|Cusco|Cuzco|Huancayo|Chimbote|Tacna|" +
    "Pucallpa|Juliaca|Cajamarca|Puno|Ayacucho|Callao|Machu Picchu",
  BO: "La Paz|Sucre|Santa Cruz de la Sierra|Cochabamba|El Alto|Oruro|Potosí|Tarija",
  CL:
    "Santiago|Valparaíso|Viña del Mar|Concepción|Antofagasta|Temuco|Rancagua|Talca|Arica|" +
    "Iquique|La Serena|Puerto Montt|Punta Arenas|Valdivia|Coquimbo|Osorno",
  AR:
    "Buenos Aires|CABA|Córdoba|Rosario|Mendoza|La Plata|San Miguel de Tucumán|Tucumán|" +
    "Mar del Plata|Santa Fe|Neuquén|Bahía Blanca|Bariloche|" +
    "San Carlos de Bariloche|Ushuaia|Quilmes|Comodoro Rivadavia|Santiago del Estero|Río Cuarto",
  UY: "Montevideo|Punta del Este|Paysandú",
  PY: "Asunción|Ciudad del Este|Encarnación",
  BR:
    "São Paulo|Sampa|Rio de Janeiro|Rio|Brasília|Salvador|Fortaleza|Belo Horizonte|Manaus|" +
    "Curitiba|Recife|Goiânia|Belém|Porto Alegre|Guarulhos|Campinas|São Luís|São Gonçalo|" +
    "Maceió|Duque de Caxias|Teresina|Campo Grande|Nova Iguaçu|São Bernardo do Campo|" +
    "João Pessoa|Santo André|Osasco|Jaboatão|Ribeirão Preto|Uberlândia|Sorocaba|Contagem|" +
    "Aracaju|Feira de Santana|Cuiabá|Joinville|Juiz de Fora|Londrina|Florianópolis|Floripa|" +
    "Niterói|Porto Velho|Macapá|Boa Vista|Rio Branco|Vila Velha|Caxias do Sul|Pelotas|Maringá|" +
    "Foz do Iguaçu|Balneário Camboriú|Petrópolis|Blumenau|Campina Grande|Olinda|Búzios|Paraty|" +
    "Plano Piloto|Vitória|Palmas|Montes Claros|Uberaba|Governador Valadares|Ipatinga|Betim|" +
    "Divinópolis|Sete Lagoas|Santa Maria|Passo Fundo|Novo Hamburgo|Ponta Grossa|Cascavel|" +
    "Guarapuava|Chapecó|Itajaí|Criciúma|Ilhéus|Itabuna|Vitória da Conquista|Camaçari|" +
    "Caruaru|Petrolina|Arapiraca|Mossoró|Juazeiro do Norte|Imperatriz|Santarém|Marabá|" +
    "Rondonópolis|Dourados|Anápolis|Cariacica|São José dos Campos|Jundiaí|Piracicaba|Bauru|" +
    "São José do Rio Preto|Campos dos Goytacazes|Volta Redonda",
  GY: "Georgetown",
  SR: "Paramaribo",
  BZ: "Belize City|Belmopan",
  // Oceania
  AU:
    "Sydney|Melbourne|Brisbane|Perth|Adelaide|Gold Coast|Canberra|Wollongong|Hobart|Geelong|" +
    "Townsville|Cairns|Darwin|Toowoomba|Ballarat|Bendigo|Launceston|Sunshine Coast|" +
    "Alice Springs|Parramatta|Bondi|Fremantle|Byron Bay|Rockhampton|Bunbury|Mandurah|Straya",
  NZ:
    "Auckland|Wellington|Christchurch|Tauranga|Dunedin|Palmerston North|Napier|Rotorua|" +
    "Queenstown|Whangarei|Invercargill|New Plymouth",
  PG: "Port Moresby|Lae",
  FJ: "Suva|Nadi",
  NC: "Nouméa",
  PF: "Papeete|Tahiti",
  WS: "Apia",
  TO: "Nuku'alofa",
  VU: "Port Vila",
  SB: "Honiara",
  GU: "Hagåtña|Hagatna",
  JE: "Saint Helier",
  GG: "Saint Peter Port",
};

/** City (lowercase, may contain accents or non-Latin letters) -> ISO2. */
export const CITY_TO_COUNTRY: Record<string, string> = invert(CITIES_BY_COUNTRY);

/**
 * Other countries with a well-known city of the same name. Used only when the text
 * names that country or one of its states next to the city ("Paris, Texas",
 * "London, ON", "Perth, Scotland").
 */
export const CITY_ALT_COUNTRIES: Record<string, string[]> = {
  london: ["CA", "US"],
  paris: ["US"],
  birmingham: ["US"],
  manchester: ["US"],
  cambridge: ["US"],
  bristol: ["US"],
  newcastle: ["AU"],
  perth: ["GB"],
  sydney: ["CA"],
  melbourne: ["US"],
  moscow: ["US"],
  "saint petersburg": ["US"],
  athens: ["US"],
  rome: ["US"],
  naples: ["US"],
  florence: ["US"],
  berlin: ["US"],
  dublin: ["US"],
  alexandria: ["US"],
  cairo: ["US"],
  hyderabad: ["PK"],
  tripoli: ["LB"],
  "san jose": ["CR"],
  "san juan": ["AR", "PH"],
  santiago: ["DO", "ES", "CU"],
  valencia: ["VE"],
  barcelona: ["VE"],
  cordoba: ["ES", "MX"],
  guadalajara: ["ES"],
  merida: ["VE", "ES"],
  leon: ["ES", "NI"],
  "la paz": ["MX"],
  granada: ["NI"],
  cartagena: ["ES"],
  cuenca: ["ES"],
  trujillo: ["HN", "ES"],
  kingston: ["CA"],
  hamilton: ["NZ", "BM", "GB"],
  halifax: ["GB"],
  windsor: ["GB"],
  richmond: ["CA", "GB"],
  vancouver: ["US"],
  surrey: ["CA"],
  lagos: ["PT"],
  georgetown: ["MY", "US"],
  cali: ["CO"],
  "panama city": ["US"],
  odessa: ["US"],
  "santa fe": ["US"],
  lima: ["US"],
  toledo: ["ES"],
  syracuse: ["IT"],
  albany: ["AU"],
  columbia: ["CO"],
  salvador: ["SV"],
  rochester: ["GB"],
  durham: ["GB"],
  "saint john": ["VI"],
  "niagara falls": ["US"],
  scarborough: ["GB"],
  bethlehem: ["US"],
  vitória: ["ES"],
  "santa maria": ["US"],
  santarém: ["PT"],
};

export type AmbiguousPlace = {
  /** Countries the name can mean. */
  countries: string[];
  /** Reading when nothing else in the text decides (null: no decision). */
  alone: string | null;
  /** Reading right after an unrecognised place name, as in "Macon, Georgia". */
  afterPlace: string | null;
};

/**
 * Names that are a country and also a US state or another country's region (or,
 * for Natal, a city and an old region name elsewhere).
 * "Georgia" alone stays undecided (the US state and the country are both common on X);
 * "City, Georgia" with an unknown city is the US state, since the tables list the
 * Georgian cities people write (Tbilisi, Batumi, Kutaisi). X's own "Account based in"
 * label is a country name, so the matcher reads it as the country (GE).
 */
export const AMBIGUOUS_PLACES: Record<string, AmbiguousPlace> = {
  georgia: { countries: ["GE", "US"], alone: null, afterPlace: "US" },
  jersey: { countries: ["JE", "US"], alone: "JE", afterPlace: "JE" },
  victoria: { countries: ["AU", "CA", "SC"], alone: "AU", afterPlace: "AU" },
  congo: { countries: ["CD", "CG"], alone: "CD", afterPlace: "CD" },
  korea: { countries: ["KR", "KP"], alone: "KR", afterPlace: "KR" },
  macedonia: { countries: ["MK", "GR"], alone: "MK", afterPlace: "MK" },
  punjab: { countries: ["PK", "IN"], alone: null, afterPlace: null },
  kashmir: { countries: ["IN", "PK"], alone: null, afterPlace: null },
  bengal: { countries: ["IN", "BD"], alone: null, afterPlace: null },
  antigua: { countries: ["AG", "GT"], alone: "AG", afterPlace: "AG" },
  "virgin islands": { countries: ["VI", "VG"], alone: "VI", afterPlace: "VI" },
  "saint martin": { countries: ["MF", "SX"], alone: "MF", afterPlace: "MF" },
  // The Brazilian city, and the old name of KwaZulu-Natal ("Durban, Natal").
  natal: { countries: ["BR", "ZA"], alone: "BR", afterPlace: "BR" },
};

/**
 * Upper-case abbreviations of cities. They only count when written in capitals
 * ("SF", not "sf"), under the same position rules as country codes.
 */
export const UPPERCASE_PLACE_CODES: Record<string, string> = {
  SF: "US",
  CHI: "US",
  HTX: "US",
  ATX: "US",
  SATX: "US",
  LAX: "US",
  KL: "MY",
  BKK: "TH",
  CPT: "ZA",
  BCN: "ES",
  YYZ: "CA",
  YVR: "CA",
  YYC: "CA",
  YUL: "CA",
  YEG: "CA",
  BLR: "IN",
  HYD: "IN",
  KHI: "PK",
};

/**
 * State abbreviations of other countries that people write after a city there
 * ("Chennai, TN", "Belém, PA", "Tijuana, BC"). They only confirm a city of that
 * country; alone or after an unknown place they keep their usual reading. Odisha's
 * old code OR is left out: "Madras, OR" is a town in Oregon.
 */
const STATE_CODES_BY_COUNTRY: Record<string, string> = {
  IN:
    "AP|AR|AS|BR|CG|CT|DL|GA|GJ|HP|HR|JH|JK|KA|KL|MH|ML|MN|MP|MZ|NL|OD|PB|RJ|SK|TG|TN|TR|TS|" +
    "UP|UT|WB",
  BR: "AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO",
  MX: "AGS|BC|BCS|CHIH|COAH|GTO|JAL|NL|OAX|PUE|QRO|QROO|SIN|SLP|SON|VER|YUC",
};

const FOREIGN_STATE_CODES = new Map<string, string[]>();
for (const [iso2, list] of Object.entries(STATE_CODES_BY_COUNTRY)) {
  for (const code of splitList(list)) {
    FOREIGN_STATE_CODES.set(code, [...(FOREIGN_STATE_CODES.get(code) ?? []), iso2]);
  }
}

/** Countries outside the US, Canada and Australia that use this state code ("TN" -> IN). */
export function countriesForForeignStateCode(code: string): string[] {
  return FOREIGN_STATE_CODES.get(code) ?? [];
}

/**
 * Italian province codes written after their own city ("Palermo (PA)", "Milano,
 * MI"). They are also US state codes, and many US towns share a name with an Italian
 * city ("Venice, CA", "Milan, MI"), so they count only after that very spelling.
 */
export const CITY_OWN_CODES: Record<string, string> = {
  cagliari: "CA",
  catania: "CT",
  messina: "ME",
  milano: "MI",
  modena: "MO",
  palermo: "PA",
  trento: "TN",
};

/** Every country that uses this subdivision code ("WA" -> US and AU). */
export function countriesForSubdivisionCode(code: string): string[] {
  const out: string[] = [];
  if (US_STATE_CODES.has(code)) out.push("US");
  if (CA_PROVINCE_CODES.has(code)) out.push("CA");
  if (AU_STATE_CODES.has(code)) out.push("AU");
  return out;
}
