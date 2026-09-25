import { ContentController } from "./controller.ts";

function extensionApi(): typeof chrome | null {
  try {
    return globalThis.chrome ?? null;
  } catch {
    return null;
  }
}

const api = extensionApi();
let incognito = false;
try {
  incognito = api?.extension?.inIncognitoContext === true;
} catch {
  // treat as a normal window
}

const controller = new ContentController({
  win: window,
  doc: document,
  area: api?.storage?.local ?? null,
  runtime: api?.runtime ?? null,
  incognito,
});
controller.start().catch(() => {
  // fail open: never break x.com
});
