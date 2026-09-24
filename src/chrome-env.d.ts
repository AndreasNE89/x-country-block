// Minimal typings for the extension APIs this project uses (Chrome MV3 + Firefox MV3).
// Optional members may be missing on older browsers or in Firefox; feature-check before calling.

type StorageChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>;

type ChromeStorageLocal = {
  get: (keys: string[] | readonly string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  onChanged: {
    addListener: (cb: (changes: StorageChanges) => void) => void;
  };
};

type ChromeTab = { id?: number; url?: string; active?: boolean; incognito?: boolean; windowId?: number };

type ChromeAction = {
  setBadgeText: (details: { text: string; tabId?: number }) => Promise<void> | void;
  getBadgeText: (details: { tabId?: number }) => Promise<string>;
  setBadgeBackgroundColor: (details: { color: string; tabId?: number }) => Promise<void> | void;
  setBadgeTextColor?: (details: { color: string; tabId?: number }) => Promise<void> | void;
  setTitle?: (details: { title: string; tabId?: number }) => Promise<void> | void;
};

type ChromeMessageSender = { tab?: ChromeTab; url?: string; id?: string; frameId?: number };

type ChromeRuntime = {
  id?: string;
  sendMessage: (message: unknown) => Promise<unknown> | void;
  getURL: (path: string) => string;
  getManifest: () => { version: string; name: string };
  setUninstallURL?: (url: string) => Promise<void> | void;
  onMessage: {
    addListener: (
      cb: (message: unknown, sender: ChromeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void,
    ) => void;
  };
  onInstalled: {
    addListener: (cb: (details: { reason: "install" | "update" | "chrome_update" | "shared_module_update" | "browser_update"; previousVersion?: string }) => void) => void;
  };
};

type ChromeTabs = {
  create: (createProperties: { url: string; active?: boolean }) => Promise<ChromeTab>;
  remove: (tabId: number) => Promise<void>;
  query: (queryInfo: { active?: boolean; currentWindow?: boolean; url?: string | string[] }) => Promise<ChromeTab[]>;
  reload: (tabId?: number) => Promise<void>;
  sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
};

type ChromePermissions = {
  contains: (permissions: { origins?: string[]; permissions?: string[] }) => Promise<boolean>;
  request: (permissions: { origins?: string[]; permissions?: string[] }) => Promise<boolean>;
};

type ChromeApi = {
  storage: {
    local: ChromeStorageLocal;
  };
  action: ChromeAction;
  runtime: ChromeRuntime;
  tabs: ChromeTabs;
  permissions: ChromePermissions;
  extension?: { inIncognitoContext?: boolean };
};

declare const chrome: ChromeApi;

declare const __XCB_PROD__: boolean;

declare global {
  var chrome: ChromeApi;
  var __XCB_PROD__: boolean;
}

export {};
