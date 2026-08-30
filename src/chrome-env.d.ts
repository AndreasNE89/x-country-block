type ChromeStorageLocal = {
  get: (keys: string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  onChanged: {
    addListener: (cb: (changes: Record<string, { newValue?: unknown }>) => void) => void;
  };
};

declare const chrome: {
  storage: {
    local: ChromeStorageLocal;
  };
};

declare global {
  var chrome: {
    storage: {
      local: ChromeStorageLocal;
    };
  };
}

export {};
