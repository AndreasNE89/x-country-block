import { COUNTRY_NAMES } from "../shared/countries.ts";
import { languageName } from "../shared/languages.ts";
import { effectiveFilterMode } from "../shared/match.ts";
import { regionName } from "../shared/regions.ts";
import { parseSettings } from "../shared/settings.ts";
import { STRIPE_PAYMENT_LINK } from "../shared/stripe.ts";
import type { Settings } from "../shared/types.ts";
import { catalogRows } from "./catalog.ts";
import { type OptionRow, visibleOptionRows } from "./option-rows.ts";

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
const proTest = document.getElementById("pro-test") as HTMLButtonElement;
const tabCountries = document.getElementById("tab-countries") as HTMLButtonElement;
const tabRegions = document.getElementById("tab-regions") as HTMLButtonElement;
const tabLanguages = document.getElementById("tab-languages") as HTMLButtonElement;

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

function rowsForTab(): readonly OptionRow[] {
  return catalogRows(tab);
}

function render(): void {
  paintPro();
  const active =
    settings.hiddenCountryCodes.length +
    settings.hiddenRegionIds.length +
    settings.hiddenLanguageCodes.length;
  if (active === 0) {
    const onlyShow = effectiveFilterMode(settings) === "only";
    status.textContent = onlyShow
      ? "Only show is on. Nothing ticked, so showing all."
      : "Nothing ticked. Tick a country, region, or language.";
    status.dataset.ok = onlyShow ? "true" : "false";
  } else {
    const bits = [
      ...settings.hiddenCountryCodes.map((code) => COUNTRY_NAMES[code] ?? code),
      ...settings.hiddenRegionIds.map((id) => regionName(id)),
      ...settings.hiddenLanguageCodes.map((code) => languageName(code)),
    ];
    const verb = effectiveFilterMode(settings) === "only" ? "Only showing" : "Hiding";
    status.textContent = `${verb}: ${bits.join(", ")}`;
    status.dataset.ok = "true";
  }
  const selected = selectedIds();
  list.replaceChildren();
  for (const row of visibleOptionRows(rowsForTab(), selected, search.value)) {
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
  render();
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
function paintPro(): void {
  const unlocked = settings.onlyShowUnlocked;
  onlyFromBox.checked = unlocked && settings.filterMode === "only";
  proActions.hidden = unlocked;
}

function openCheckout(): void {
  void chrome.tabs.create({ url: STRIPE_PAYMENT_LINK });
}

onlyFromBox.addEventListener("change", () => {
  if (!settings.onlyShowUnlocked) {
    onlyFromBox.checked = false;
    openCheckout();
    return;
  }
  settings = { ...settings, filterMode: onlyFromBox.checked ? "only" : "hide" };
  void persist();
  render();
});
proPay.addEventListener("click", openCheckout);
proTrial.addEventListener("click", () => {
  if (settings.trialStartedAt !== null) return;
  void chrome.storage.local.set({ trialStartedAt: Date.now() });
});
if (!__XCB_PROD__) {
  proTest.hidden = false;
  proTest.addEventListener("click", () => {
    void chrome.storage.local.set({ onlyShowPaid: true, onlyShowUnlocked: true });
  });
}

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
