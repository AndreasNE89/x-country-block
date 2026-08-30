// src/popup/popup.ts
import { COUNTRY_NAMES } from "../shared/countries.ts";
import { LANGUAGES } from "../shared/languages.ts";
import { parseSettings } from "../shared/settings.ts";
import type { Settings } from "../shared/types.ts";

type Tab = "countries" | "languages";

let tab: Tab = "countries";
let settings: Settings = parseSettings(undefined);

const list = document.getElementById("list") as HTMLUListElement;
const search = document.getElementById("search") as HTMLInputElement;
const tabCountries = document.getElementById("tab-countries") as HTMLButtonElement;
const tabLanguages = document.getElementById("tab-languages") as HTMLButtonElement;

function countryRows(): { id: string; label: string }[] {
  return Object.entries(COUNTRY_NAMES)
    .map(([id, name]) => ({ id, label: `${name} (${id})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function languageRows(): { id: string; label: string }[] {
  return LANGUAGES.map((row) => ({ id: row.code, label: `${row.name} (${row.code})` }));
}

function render(): void {
  const query = search.value.trim().toLowerCase();
  const rows = tab === "countries" ? countryRows() : languageRows();
  const selected =
    tab === "countries" ? settings.hiddenCountryCodes : settings.hiddenLanguageCodes;
  list.replaceChildren();
  for (const row of rows) {
    if (query && !row.label.toLowerCase().includes(query) && !row.id.toLowerCase().includes(query)) {
      continue;
    }
    const li = document.createElement("li");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = selected.includes(row.id);
    box.addEventListener("change", () => void toggle(row.id, box.checked));
    const label = document.createElement("label");
    label.textContent = row.label;
    li.append(box, label);
    list.append(li);
  }
}

async function toggle(id: string, on: boolean): Promise<void> {
  if (tab === "countries") {
    const set = new Set(settings.hiddenCountryCodes);
    if (on) set.add(id);
    else set.delete(id);
    settings = { ...settings, hiddenCountryCodes: [...set] };
  } else {
    const set = new Set(settings.hiddenLanguageCodes);
    if (on) set.add(id);
    else set.delete(id);
    settings = { ...settings, hiddenLanguageCodes: [...set] };
  }
  await chrome.storage.local.set({
    hiddenCountryCodes: settings.hiddenCountryCodes,
    hiddenLanguageCodes: settings.hiddenLanguageCodes,
  });
}

tabCountries.addEventListener("click", () => {
  tab = "countries";
  tabCountries.setAttribute("aria-selected", "true");
  tabLanguages.setAttribute("aria-selected", "false");
  render();
});
tabLanguages.addEventListener("click", () => {
  tab = "languages";
  tabCountries.setAttribute("aria-selected", "false");
  tabLanguages.setAttribute("aria-selected", "true");
  render();
});
search.addEventListener("input", render);

void chrome.storage.local.get(["hiddenCountryCodes", "hiddenLanguageCodes"]).then((raw) => {
  settings = parseSettings(raw);
  render();
});
