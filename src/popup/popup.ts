import ExtPay from "extpay";
import { COUNTRY_NAMES } from "../shared/countries.ts";
import { LANGUAGES } from "../shared/languages.ts";
import { EXTPAY_ID } from "../shared/license.ts";
import { effectiveFilterMode } from "../shared/match.ts";
import { REGIONS } from "../shared/regions.ts";
import { parseSettings } from "../shared/settings.ts";
import type { Settings } from "../shared/types.ts";

type Tab = "countries" | "regions" | "languages";

let tab: Tab = "countries";
let settings: Settings = parseSettings(undefined);

const status = document.getElementById("status") as HTMLParagraphElement;
const list = document.getElementById("list") as HTMLUListElement;
const search = document.getElementById("search") as HTMLInputElement;
const markOnlyBox = document.getElementById("mark-only") as HTMLInputElement;
const onlyFromBox = document.getElementById("only-from") as HTMLInputElement;
const proActions = document.getElementById("pro-actions") as HTMLDivElement;
const proPay = document.getElementById("pro-pay") as HTMLButtonElement;
const proTrial = document.getElementById("pro-trial") as HTMLButtonElement;
const proLogin = document.getElementById("pro-login") as HTMLButtonElement;
const proManage = document.getElementById("pro-manage") as HTMLButtonElement;
const tabCountries = document.getElementById("tab-countries") as HTMLButtonElement;
const tabRegions = document.getElementById("tab-regions") as HTMLButtonElement;
const tabLanguages = document.getElementById("tab-languages") as HTMLButtonElement;

function countryRows(): { id: string; label: string }[] {
  return Object.entries(COUNTRY_NAMES)
    .map(([id, name]) => ({ id, label: `${name} (${id})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function regionRows(): { id: string; label: string }[] {
  return REGIONS.map((row) => ({ id: row.id, label: row.name })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

function languageRows(): { id: string; label: string }[] {
  return LANGUAGES.map((row) => ({ id: row.code, label: `${row.name} (${row.code})` }));
}

function selectedIds(): string[] {
  switch (tab) {
    case "countries":
      return settings.hiddenCountryCodes;
    case "regions":
      return settings.hiddenRegionIds;
    case "languages":
      return settings.hiddenLanguageCodes;
    default: {
      const _never: never = tab;
      return _never;
    }
  }
}

function rowsForTab(): { id: string; label: string }[] {
  switch (tab) {
    case "countries":
      return countryRows();
    case "regions":
      return regionRows();
    case "languages":
      return languageRows();
    default: {
      const _never: never = tab;
      return _never;
    }
  }
}

function render(): void {
  paintPro();
  const active =
    settings.hiddenCountryCodes.length +
    settings.hiddenRegionIds.length +
    settings.hiddenLanguageCodes.length;
  if (active === 0) {
    status.textContent = "Nothing ticked. Tick India (or a region / language) or nothing is marked.";
    status.dataset.ok = "false";
  } else {
    const bits = [
      ...settings.hiddenCountryCodes.map((code) => COUNTRY_NAMES[code] ?? code),
      ...settings.hiddenRegionIds,
      ...settings.hiddenLanguageCodes,
    ];
    const verb = effectiveFilterMode(settings) === "only" ? "Only showing" : "Hiding";
    status.textContent = `${verb}: ${bits.join(", ")}`;
    status.dataset.ok = "true";
  }
  const query = search.value.trim().toLowerCase();
  const selected = selectedIds();
  list.replaceChildren();
  for (const row of rowsForTab()) {
    if (query && !row.label.toLowerCase().includes(query) && !row.id.toLowerCase().includes(query)) {
      continue;
    }
    const li = document.createElement("li");
    const box = document.createElement("input");
    box.id = `option-${tab}-${row.id}`;
    box.type = "checkbox";
    box.checked = selected.includes(row.id);
    box.addEventListener("change", () => void toggle(row.id, box.checked));
    const label = document.createElement("label");
    label.htmlFor = box.id;
    label.textContent = row.label;
    li.append(box, label);
    list.append(li);
  }
}

async function persist(): Promise<void> {
  await chrome.storage.local.set({
    hiddenCountryCodes: settings.hiddenCountryCodes,
    hiddenLanguageCodes: settings.hiddenLanguageCodes,
    hiddenRegionIds: settings.hiddenRegionIds,
    markOnly: settings.markOnly,
    filterMode: settings.filterMode,
  });
}

async function toggle(id: string, on: boolean): Promise<void> {
  switch (tab) {
    case "countries": {
      const set = new Set(settings.hiddenCountryCodes);
      if (on) set.add(id);
      else set.delete(id);
      settings = { ...settings, hiddenCountryCodes: [...set] };
      break;
    }
    case "regions": {
      const set = new Set(settings.hiddenRegionIds);
      if (on) set.add(id);
      else set.delete(id);
      settings = { ...settings, hiddenRegionIds: [...set] };
      break;
    }
    case "languages": {
      const set = new Set(settings.hiddenLanguageCodes);
      if (on) set.add(id);
      else set.delete(id);
      settings = { ...settings, hiddenLanguageCodes: [...set] };
      break;
    }
    default: {
      const _never: never = tab;
      return _never;
    }
  }
  await persist();
}

function setTab(next: Tab): void {
  tab = next;
  tabCountries.setAttribute("aria-selected", next === "countries" ? "true" : "false");
  tabRegions.setAttribute("aria-selected", next === "regions" ? "true" : "false");
  tabLanguages.setAttribute("aria-selected", next === "languages" ? "true" : "false");
  render();
}

tabCountries.addEventListener("click", () => setTab("countries"));
tabRegions.addEventListener("click", () => setTab("regions"));
tabLanguages.addEventListener("click", () => setTab("languages"));
search.addEventListener("input", render);
markOnlyBox.addEventListener("change", () => {
  settings = { ...settings, markOnly: markOnlyBox.checked };
  void persist();
});
function extpayClient() {
  return ExtPay(EXTPAY_ID);
}

function paintPro(): void {
  const unlocked = settings.onlyShowUnlocked;
  onlyFromBox.checked = unlocked && settings.filterMode === "only";
  proActions.hidden = unlocked;
  proManage.hidden = !unlocked;
}

onlyFromBox.addEventListener("change", () => {
  if (!settings.onlyShowUnlocked) {
    onlyFromBox.checked = false;
    void extpayClient().openPaymentPage().catch(() => undefined);
    return;
  }
  settings = { ...settings, filterMode: onlyFromBox.checked ? "only" : "hide" };
  void persist();
  render();
});
proPay.addEventListener("click", () => {
  void extpayClient().openPaymentPage().catch(() => undefined);
});
proTrial.addEventListener("click", () => {
  void extpayClient().openTrialPage("7-day").catch(() => undefined);
});
proLogin.addEventListener("click", () => {
  void extpayClient().openLoginPage().catch(() => undefined);
});
proManage.addEventListener("click", () => {
  void extpayClient().openPaymentPage().catch(() => undefined);
});

void chrome.storage.local
  .get([
    "hiddenCountryCodes",
    "hiddenLanguageCodes",
    "hiddenRegionIds",
    "markOnly",
    "filterMode",
    "onlyShowPaid",
    "trialStartedAt",
  ])
  .then((raw) => {
    settings = parseSettings(raw);
    markOnlyBox.checked = settings.markOnly;
    paintPro();
    render();
  });

chrome.storage.local.onChanged.addListener((changes) => {
  if (!changes.onlyShowPaid && !changes.trialStartedAt && !changes.onlyShowUnlocked) return;
  void chrome.storage.local
    .get([
      "hiddenCountryCodes",
      "hiddenLanguageCodes",
      "hiddenRegionIds",
      "markOnly",
      "filterMode",
      "onlyShowPaid",
      "trialStartedAt",
    ])
    .then((raw) => {
      settings = parseSettings(raw);
      markOnlyBox.checked = settings.markOnly;
      paintPro();
      render();
    });
});
