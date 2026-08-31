type ChromeStorageLocal = {
  get: (keys: string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  onChanged: {
    addListener: (cb: (changes: Record<string, { newValue?: unknown }>) => void) => void;
  };
};

type ChromeAction = {
  setBadgeText: (details: { text: string; tabId?: number }) => void;
  setBadgeBackgroundColor: (details: { color: string; tabId?: number }) => void;
};

type ChromeRuntime = {
  sendMessage: (message: unknown) => void;
  onMessage: {
    addListener: (
      cb: (message: unknown, sender: { tab?: { id?: number } }) => void,
    ) => void;
  };
};

declare const chrome: {
  storage: {
    local: ChromeStorageLocal;
  };
  action: ChromeAction;
  runtime: ChromeRuntime;
};

declare const __XCB_PROD__: boolean;

declare global {
  var chrome: {
    storage: {
      local: ChromeStorageLocal;
    };
    action: ChromeAction;
    runtime: ChromeRuntime;
  };
  var __XCB_PROD__: boolean;
}

export {};
