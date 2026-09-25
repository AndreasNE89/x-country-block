import { parseSettings, SETTINGS_KEYS, type SettingsKey } from "../shared/settings.ts";
import { STRIPE_PAYMENT_LINK } from "../shared/stripe.ts";
import type { FilterMode, Settings } from "../shared/types.ts";
import { addHandle, removeHandle } from "./accounts.ts";
import { catalogRows, PICK_KINDS, type PickKind } from "./catalog.ts";
import { visibleOptionRows } from "./option-rows.ts";
import { extensionTabApi, probePage, X_ORIGINS } from "./page.ts";
import {
  type Pick,
  PICK_FIELD,
  type PickField,
  picksOf,
  selectedPicks,
  tabLabel,
  tabName,
  toggleCode,
} from "./picks.ts";
import {
  FOCUS_BODY,
  priceLine,
  proView,
  TRIAL_ENDED_TEXT,
  trialButtonLabel,
  unlockLabel,
} from "./pro.ts";
import { countText, highlightHelp, type PageState, pageNote, statusSummary, statusText } from "./status.ts";

export type PopupOptions = {
  api: typeof chrome;
  doc: Document;
  now?: () => number;
  /** Production build: leaves out the dev-only "Test unlock" (so does __XCB_PROD__). */
  prod?: boolean;
  /** How often to re-check the active tab while the popup is open; 0 turns it off. */
  pollMs?: number;
};

export type PopupHandle = {
  /** Resolves once the stored settings are shown and the active tab was checked. */
  ready: Promise<void>;
  dispose: () => void;
};

type Raw = Record<string, unknown>;
type ListField = PickField | "allowedHandles";

const DEFAULT_POLL_MS = 2000;
// After "Reload", keep saying so until the new page answers or this runs out.
const RELOAD_GRACE_MS = 10_000;
const PICK_FIELDS: readonly PickField[] = ["hiddenCountryCodes", "hiddenLanguageCodes", "hiddenRegionIds"];

export function startPopup(options: PopupOptions): PopupHandle {
  const { api, doc } = options;
  const now = options.now ?? Date.now;
  const prod = options.prod ?? true;
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const tabApi = extensionTabApi(api);
  const events = new AbortController();

  const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const node = doc.getElementById(id);
    if (!node) throw new Error(`popup.html is missing #${id}`);
    return node as T;
  };
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) => target.addEventListener(type, listener as EventListener, { signal: events.signal });

  const ui = {
    enabled: $<HTMLButtonElement>("enabled"),
    status: $("status"),
    statusCount: $("status-count"),
    pageNote: $("page-note"),
    pageNoteText: $("page-note-text"),
    pageAction: $<HTMLButtonElement>("page-action"),
    modeGroup: $("mode"),
    modeHide: $<HTMLButtonElement>("mode-hide"),
    modeOnly: $<HTMLButtonElement>("mode-only"),
    trialRow: $("trial-row"),
    trialChip: $("trial-chip"),
    trialBuy: $<HTMLButtonElement>("trial-buy"),
    proCard: $("pro-card"),
    proTitle: $("pro-title"),
    proClose: $<HTMLButtonElement>("pro-close"),
    proEnded: $("pro-ended"),
    proBody: $("pro-body"),
    proPrice: $("pro-price"),
    proPay: $<HTMLButtonElement>("pro-pay"),
    proTrial: $<HTMLButtonElement>("pro-trial"),
    proActions: $("pro-actions"),
    proHide: $<HTMLButtonElement>("pro-hide"),
    proRestore: $<HTMLButtonElement>("pro-restore"),
    restoreConfirm: $("restore-confirm"),
    restoreYes: $<HTMLButtonElement>("restore-yes"),
    restoreNo: $<HTMLButtonElement>("restore-no"),
    markOnly: $<HTMLButtonElement>("mark-only"),
    markHelp: $("mark-help"),
    tray: $("tray"),
    chips: $<HTMLUListElement>("chips"),
    trayNote: $("tray-note"),
    clearAll: $<HTMLButtonElement>("clear-all"),
    undoClear: $<HTMLButtonElement>("undo-clear"),
    tabs: $("tabs"),
    panel: $("panel"),
    searchLabel: $("search-label"),
    search: $<HTMLInputElement>("search"),
    list: $<HTMLUListElement>("list"),
    empty: $("empty"),
    accountsCount: $("accounts-count"),
    handles: $<HTMLUListElement>("handles"),
    handleForm: $<HTMLFormElement>("handle-form"),
    handleInput: $<HTMLInputElement>("handle-input"),
    handleError: $("handle-error"),
    announce: $("announce"),
  };
  const tabButton = (kind: PickKind) => $<HTMLButtonElement>(`tab-${kind}`);

  // Stored values as last read or written; settings is always derived from it.
  let raw: Raw = {};
  let settings: Settings = parseSettings(raw, now());
  let loaded = false;
  let disposed = false;
  let tab: PickKind = "languages";
  let rendered = new Map<string, { li: HTMLLIElement; box: HTMLInputElement }>();
  let chipsKey: string | null = null;
  let handlesKey: string | null = null;
  let cardOpen = false;
  let restoreOpen = false;
  let page: PageState = { kind: "checking" };
  let reloadUntil = 0;
  let undo: Record<PickField, string[]> | null = null;
  let changedEarly = false;

  // --- storage -------------------------------------------------------------

  // Storage work runs one task at a time, so a read-modify-write never interleaves with another.
  let queue: Promise<void> = Promise.resolve();
  // Keys with a queued or running write. A re-read leaves them alone, so a tick never flickers back.
  const inflight = new Map<string, number>();
  let resyncQueued = false;

  function enqueue(keys: readonly string[], task: () => Promise<unknown>): Promise<void> {
    for (const key of keys) inflight.set(key, (inflight.get(key) ?? 0) + 1);
    const next = queue
      .then(task)
      .catch(() => undefined)
      .then(() => {
        for (const key of keys) {
          const left = (inflight.get(key) ?? 1) - 1;
          if (left > 0) inflight.set(key, left);
          else inflight.delete(key);
        }
      });
    queue = next;
    return next;
  }

  function derive(): void {
    settings = parseSettings(raw, now());
  }

  function apply(items: Raw): void {
    const next = { ...raw };
    for (const [key, value] of Object.entries(items)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    raw = next;
    derive();
  }

  async function readFresh(keys: readonly SettingsKey[]): Promise<Raw> {
    const stored = await api.storage.local.get([...keys]);
    const out: Raw = {};
    for (const key of keys) out[key] = stored[key];
    return out;
  }

  /**
   * Re-reads every setting after a storage change. Reading, rather than trusting newValue,
   * keeps echoes of our own queued writes from arriving out of order.
   */
  function requestResync(): void {
    if (resyncQueued) return;
    resyncQueued = true;
    void enqueue([], async () => {
      resyncQueued = false;
      const fresh = await readFresh(SETTINGS_KEYS);
      apply(Object.fromEntries(Object.entries(fresh).filter(([key]) => !inflight.has(key))));
      paint();
    });
  }

  /** Writes exactly these keys, and shows the result straight away. */
  function write(items: Raw): Promise<void> {
    apply(items);
    paint();
    return enqueue(Object.keys(items), () => api.storage.local.set(items));
  }

  /** Read-modify-write of one list, so a change made in another popup is kept. */
  function updateList(field: ListField, change: (list: readonly string[]) => string[]): Promise<void> {
    apply({ [field]: change(settings[field]) });
    paint();
    return enqueue([field], async () => {
      const fresh = parseSettings(await readFresh([field]), now());
      const next = change(fresh[field]);
      apply({ [field]: next });
      paint();
      await api.storage.local.set({ [field]: next });
    });
  }

  // --- painting ------------------------------------------------------------

  function paint(): void {
    if (disposed || !loaded) return;
    ui.enabled.setAttribute("aria-checked", String(settings.enabled));
    doc.body.classList.toggle("is-paused", !settings.enabled);
    paintStatus();
    paintMode();
    paintPro();
    paintTray();
    paintTabs();
    paintRows();
    paintAccounts();
  }

  function paintStatus(): void {
    const summary = statusSummary(settings);
    // Only touch the live region when the sentence changes, so it is not re-announced.
    if (ui.status.textContent !== statusText(summary)) {
      const nodes: Node[] = [doc.createTextNode(summary.names ? `${summary.lead} ` : summary.lead)];
      if (summary.names) {
        const names = doc.createElement("strong");
        names.textContent = summary.names;
        nodes.push(names);
      }
      ui.status.replaceChildren(...nodes);
    }
    const count = countText(settings, page);
    ui.statusCount.hidden = count === null;
    ui.statusCount.textContent = count ?? "";
    const note = pageNote(page);
    ui.pageNote.hidden = note === null;
    ui.pageNoteText.textContent = note?.text ?? "";
    ui.pageAction.hidden = !note?.action;
    ui.pageAction.dataset.action = note?.action ?? "";
    ui.pageAction.textContent = note?.action === "allow" ? "Allow" : note?.action === "reload" ? "Reload" : "";
  }

  function setRadio(button: HTMLButtonElement, checked: boolean): void {
    button.setAttribute("aria-checked", String(checked));
    button.tabIndex = checked ? 0 : -1;
  }

  function paintMode(): void {
    const only = settings.filterMode === "only";
    setRadio(ui.modeHide, !only);
    setRadio(ui.modeOnly, only);
    ui.markOnly.setAttribute("aria-checked", String(settings.markOnly));
    ui.markHelp.textContent = highlightHelp(settings);
  }

  function paintPro(): void {
    const view = proView(settings, cardOpen, now());
    if (!view.card) {
      cardOpen = false;
      restoreOpen = false;
    }
    ui.trialRow.hidden = view.trialChip === null;
    ui.trialChip.textContent = view.trialChip ?? "";
    ui.proCard.hidden = view.card === null;
    doc.body.classList.toggle("card-open", view.card !== null);
    ui.proEnded.hidden = !view.card?.ended;
    // After a used-up trial the notice says enough; keep the card short.
    ui.proBody.hidden = Boolean(view.card?.ended);
    ui.proTrial.hidden = !view.card?.showTrial;
    ui.proHide.hidden = !view.card?.showSwitchToHide;
    // While "Only show" is stuck on a locked mode the card is the way out, so it stays.
    ui.proClose.hidden = Boolean(view.card?.showSwitchToHide);
    ui.restoreConfirm.hidden = !restoreOpen;
    ui.proRestore.setAttribute("aria-expanded", String(restoreOpen));
  }

  /** A removable chip; `fallback` gets focus when the last chip in its list goes. */
  function chip(label: string, onRemove: () => void, fallback: HTMLElement): HTMLLIElement {
    const li = doc.createElement("li");
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.dataset.label = label;
    button.setAttribute("aria-label", `Remove ${label}`);
    const name = doc.createElement("span");
    name.className = "chip-name";
    name.textContent = label;
    const cross = doc.createElement("span");
    cross.className = "chip-x";
    cross.setAttribute("aria-hidden", "true");
    cross.textContent = "×";
    button.append(name, cross);
    on(button, "click", () => {
      if (!loaded) return;
      const list = li.parentElement;
      const index = list ? [...list.children].indexOf(li) : -1;
      const hadFocus = doc.activeElement === button;
      onRemove();
      // The chip is gone now; keep keyboard users in the same spot.
      if (hadFocus && list) {
        const rest = list.querySelectorAll<HTMLButtonElement>("button");
        (rest[Math.min(index, rest.length - 1)] ?? fallback).focus();
      }
    });
    li.append(button);
    return li;
  }

  function paintTray(): void {
    const picks = selectedPicks(settings);
    ui.tray.hidden = picks.length === 0 && !undo;
    ui.trayNote.hidden = !undo || picks.length > 0;
    ui.clearAll.hidden = picks.length === 0;
    ui.undoClear.hidden = !undo;
    const key = picks.map((pick) => `${pick.kind}:${pick.id}`).join("|");
    if (key === chipsKey) return;
    chipsKey = key;
    ui.chips.replaceChildren(...picks.map((pick) => chip(pick.label, () => removePick(pick), ui.search)));
  }

  function paintTabs(): void {
    for (const kind of PICK_KINDS) {
      const button = tabButton(kind);
      const selected = kind === tab;
      button.textContent = tabLabel(kind, picksOf(settings, kind).length);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    ui.panel.setAttribute("aria-labelledby", `tab-${tab}`);
    ui.list.setAttribute("aria-labelledby", `tab-${tab}`);
    const hint = `Search ${tabName(tab).toLowerCase()}`;
    ui.search.placeholder = hint;
    ui.searchLabel.textContent = hint;
  }

  /** Rebuilds and re-sorts the list. Only for load, tab and search changes: never after a toggle. */
  function renderList(): void {
    const kind = tab;
    const rows = visibleOptionRows(catalogRows(kind), picksOf(settings, kind), ui.search.value);
    rendered = new Map();
    const items = rows.map((row) => {
      const li = doc.createElement("li");
      const label = doc.createElement("label");
      label.className = "row";
      const box = doc.createElement("input");
      box.type = "checkbox";
      box.id = `pick-${kind}-${row.id}`;
      box.value = row.id;
      const name = doc.createElement("span");
      name.className = "name";
      name.textContent = row.label;
      label.append(box, name);
      if (row.code) {
        const code = doc.createElement("span");
        code.className = "code";
        code.textContent = row.code;
        label.append(code);
      }
      li.append(label);
      on(box, "change", () => togglePick(kind, row.id, box.checked));
      rendered.set(row.id, { li, box });
      return li;
    });
    ui.list.replaceChildren(...items);
    ui.list.scrollTop = 0;
    const query = ui.search.value.trim();
    ui.empty.hidden = items.length > 0;
    ui.empty.textContent = items.length > 0 ? "" : `No ${tabName(kind).toLowerCase()} match “${query}”.`;
    paintRows();
  }

  /** Updates ticks in place, so focus and row order stay put. */
  function paintRows(): void {
    const picked = new Set(picksOf(settings, tab));
    for (const [id, { li, box }] of rendered) {
      const ticked = picked.has(id);
      box.checked = ticked;
      li.classList.toggle("is-on", ticked);
    }
  }

  function paintAccounts(): void {
    const handles = settings.allowedHandles;
    ui.accountsCount.textContent = handles.length > 0 ? `· ${handles.length}` : "";
    const key = handles.join("|");
    if (key === handlesKey) return;
    handlesKey = key;
    ui.handles.hidden = handles.length === 0;
    ui.handles.replaceChildren(
      ...handles.map((handle) =>
        chip(
          `@${handle}`,
          () => {
            void updateList("allowedHandles", (list) => removeHandle(list, handle));
            say(`@${handle} removed.`);
          },
          ui.handleInput,
        ),
      ),
    );
  }

  function say(text: string): void {
    ui.announce.textContent = text;
  }

  // --- actions -------------------------------------------------------------

  function togglePick(kind: PickKind, id: string, ticked: boolean): void {
    if (!loaded) return;
    undo = null;
    void updateList(PICK_FIELD[kind], (list) => toggleCode(list, id, ticked));
  }

  function removePick(pick: Pick): void {
    undo = null;
    void updateList(PICK_FIELD[pick.kind], (list) => toggleCode(list, pick.id, false));
  }

  function openCheckout(): void {
    void Promise.resolve(api.tabs.create({ url: STRIPE_PAYMENT_LINK })).catch(() => undefined);
  }

  function openCard(): void {
    cardOpen = true;
    restoreOpen = false;
    paint();
    ui.proCard.scrollIntoView?.({ block: "nearest" });
    ui.proTitle.focus();
  }

  function chooseMode(mode: FilterMode): void {
    if (!loaded) return;
    if (mode === "only" && !settings.onlyShowUnlocked) {
      openCard();
      return;
    }
    cardOpen = false;
    restoreOpen = false;
    if (settings.filterMode === mode) paint();
    else void write({ filterMode: mode });
  }

  function selectTab(kind: PickKind, focus: boolean): void {
    if (!loaded) return;
    if (kind !== tab) {
      tab = kind;
      paintTabs();
      renderList();
    }
    if (focus) tabButton(kind).focus();
  }

  async function refreshPage(): Promise<void> {
    const next = await probePage(tabApi);
    if (disposed) return;
    if (page.kind === "reloading" && next.kind !== "ready" && now() < reloadUntil) return;
    page = next;
    derive();
    paint();
  }

  // --- wiring --------------------------------------------------------------

  ui.proBody.textContent = FOCUS_BODY;
  ui.proPrice.textContent = priceLine();
  ui.proPay.textContent = unlockLabel();
  ui.trialBuy.textContent = unlockLabel();
  ui.proTrial.textContent = trialButtonLabel();
  ui.proEnded.textContent = TRIAL_ENDED_TEXT;

  on(ui.enabled, "click", () => {
    if (loaded) void write({ enabled: !settings.enabled });
  });
  on(ui.markOnly, "click", () => {
    if (loaded) void write({ markOnly: !settings.markOnly });
  });

  on(ui.modeHide, "click", () => chooseMode("hide"));
  on(ui.modeOnly, "click", () => chooseMode("only"));
  on(ui.modeGroup, "keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const target = doc.activeElement === ui.modeOnly ? ui.modeHide : ui.modeOnly;
    target.focus();
    chooseMode(target === ui.modeOnly ? "only" : "hide");
  });

  on(ui.proPay, "click", openCheckout);
  on(ui.trialBuy, "click", openCheckout);
  on(ui.proClose, "click", () => {
    cardOpen = false;
    restoreOpen = false;
    paint();
    ui.modeOnly.focus();
  });
  on(ui.proTrial, "click", () => {
    if (!loaded) return;
    void enqueue(["trialStartedAt", "filterMode"], async () => {
      const fresh = await readFresh(["trialStartedAt"]);
      // A trial started in another popup or window is never restarted.
      if (parseSettings(fresh, now()).trialStartedAt !== null) {
        apply(fresh);
        paint();
        return;
      }
      const items = { trialStartedAt: now(), filterMode: "only" };
      cardOpen = false;
      apply(items);
      paint();
      say("Focus mode trial started.");
      await api.storage.local.set(items);
    });
  });
  on(ui.proHide, "click", () => {
    if (!loaded) return;
    cardOpen = false;
    void write({ filterMode: "hide" });
    ui.modeHide.focus();
  });
  on(ui.proRestore, "click", () => {
    restoreOpen = !restoreOpen;
    paint();
    if (restoreOpen) ui.restoreYes.focus();
  });
  on(ui.restoreNo, "click", () => {
    restoreOpen = false;
    paint();
    ui.proRestore.focus();
  });
  // Honor-system restore by owner decision: there is no licence server to check against.
  on(ui.restoreYes, "click", () => {
    if (!loaded) return;
    cardOpen = false;
    restoreOpen = false;
    void write({ onlyShowPaid: true, filterMode: "only" });
    say("Focus mode restored.");
    ui.modeOnly.focus();
  });
  // Dev builds only. The compile-time constant lets esbuild drop this whole block from
  // production, so neither the button nor its handler ships to the stores.
  if (!__XCB_PROD__ && !prod) {
    const proTest = doc.createElement("button");
    proTest.type = "button";
    proTest.id = "pro-test";
    proTest.className = "btn btn-ghost";
    proTest.textContent = "Test unlock";
    ui.proActions.append(proTest);
    on(proTest, "click", () => {
      if (!loaded) return;
      cardOpen = false;
      void write({ onlyShowPaid: true, filterMode: "only" });
    });
  }

  on(ui.clearAll, "click", () => {
    if (!loaded) return;
    undo = {
      hiddenCountryCodes: [...settings.hiddenCountryCodes],
      hiddenLanguageCodes: [...settings.hiddenLanguageCodes],
      hiddenRegionIds: [...settings.hiddenRegionIds],
    };
    void write(Object.fromEntries(PICK_FIELDS.map((field) => [field, []])));
    ui.undoClear.focus();
  });
  on(ui.undoClear, "click", () => {
    if (!loaded || !undo) return;
    const items = undo;
    undo = null;
    void write({ ...items });
    (ui.clearAll.hidden ? ui.search : ui.clearAll).focus();
  });

  for (const kind of PICK_KINDS) on(tabButton(kind), "click", () => selectTab(kind, false));
  on(ui.tabs, "keydown", (event) => {
    const index = PICK_KINDS.indexOf(tab);
    const last = PICK_KINDS.length - 1;
    const next: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    selectTab(PICK_KINDS[next[event.key]], true);
  });
  on(ui.search, "input", () => {
    if (loaded) renderList();
  });

  on(ui.handleForm, "submit", (event) => {
    event.preventDefault();
    if (!loaded) return;
    const result = addHandle(settings.allowedHandles, ui.handleInput.value);
    ui.handleError.hidden = result.ok;
    ui.handleError.textContent = result.ok ? "" : result.error;
    ui.handleInput.setAttribute("aria-invalid", String(!result.ok));
    if (!result.ok) return;
    ui.handleInput.value = "";
    void updateList("allowedHandles", (list) => (list.includes(result.handle) ? [...list] : [...list, result.handle]));
    say(`@${result.handle} added. Their posts are always shown.`);
  });

  on(ui.pageAction, "click", () => {
    const action = ui.pageAction.dataset.action;
    if (action === "allow") {
      const permissions = api.permissions;
      if (typeof permissions?.request !== "function") return;
      // Called straight from the click: browsers only show the prompt for a user gesture.
      void Promise.resolve(permissions.request({ origins: [...X_ORIGINS] })).then(
        (granted) => {
          if (granted) void refreshPage();
        },
        () => undefined,
      );
      return;
    }
    if (action === "reload" && page.kind === "no-answer") {
      const { tabId } = page;
      page = { kind: "reloading", tabId };
      reloadUntil = now() + RELOAD_GRACE_MS;
      paint();
      void Promise.resolve(api.tabs.reload(tabId)).catch(() => undefined);
    }
  });

  api.storage.local.onChanged.addListener((changes) => {
    if (disposed || !SETTINGS_KEYS.some((key) => key in changes)) return;
    if (loaded) requestResync();
    else changedEarly = true;
  });

  const load = Promise.resolve(api.storage.local.get([...SETTINGS_KEYS])).then(
    (stored) => {
      if (disposed) return;
      const initial: Raw = {};
      for (const key of SETTINGS_KEYS) if (stored[key] !== undefined) initial[key] = stored[key];
      raw = initial;
      derive();
      loaded = true;
      for (const control of doc.querySelectorAll<HTMLButtonElement | HTMLInputElement>("[data-needs-load]")) {
        control.disabled = false;
      }
      doc.body.removeAttribute("aria-busy");
      paintTabs();
      renderList();
      paint();
      // A change can land between our read and its answer; read once more to be sure.
      if (changedEarly) requestResync();
    },
    () => {
      if (disposed) return;
      ui.status.textContent = "Could not read your picks. Close and reopen Tamis.";
      doc.body.removeAttribute("aria-busy");
    },
  );

  const probed = refreshPage().catch(() => undefined);

  const timer =
    pollMs > 0
      ? setInterval(() => {
          if (page.kind === "ready" || page.kind === "no-answer" || page.kind === "reloading") {
            void refreshPage().catch(() => undefined);
          }
        }, pollMs)
      : undefined;

  return {
    ready: Promise.all([load, probed]).then(() => undefined),
    dispose: () => {
      disposed = true;
      events.abort();
      if (timer !== undefined) clearInterval(timer);
    },
  };
}
