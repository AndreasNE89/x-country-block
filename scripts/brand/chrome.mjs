// Drives a headless Chrome over the DevTools protocol (Node 22's built-in
// WebSocket) to screenshot HTML at exact pixel sizes, after web fonts load.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findChrome() {
  const found = CANDIDATES.find((path) => path && existsSync(path));
  if (!found) throw new Error("Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.");
  return found;
}

/** Starts Chrome, runs `fn(page)`, and always shuts Chrome down. */
export async function withChrome(fn) {
  const profile = await mkdtemp(join(tmpdir(), "tamis-chrome-"));
  const child = spawn(
    findChrome(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--allow-file-access-from-files",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let log = "";
      const timer = setTimeout(() => reject(new Error(`Chrome did not start:\n${log}`)), 30_000);
      child.stderr.on("data", (chunk) => {
        log += chunk;
        const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      child.once("exit", (code) => reject(new Error(`Chrome exited (${code}):\n${log}`)));
    });
    const cdp = await connect(wsUrl);
    try {
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      const page = createPage(cdp, sessionId);
      await page.send("Page.enable");
      await page.send("Runtime.enable");
      return await fn(page);
    } finally {
      await cdp.send("Browser.close").catch(() => {});
      cdp.close();
    }
  } finally {
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data ?? ""}`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const listener of listeners) listener(msg);
    }
  });
  return {
    send(method, params = {}, sessionId) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params, sessionId }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => ws.close(),
  };
}

function createPage(cdp, sessionId) {
  const send = (method, params) => cdp.send(method, params, sessionId);
  const waitFor = (method) =>
    new Promise((resolve) => {
      const off = cdp.on((msg) => {
        if (msg.sessionId === sessionId && msg.method === method) {
          off();
          resolve(msg.params);
        }
      });
    });

  async function evaluate(expression) {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }

  /** Loads a full HTML document and waits until every web font is ready. */
  async function load(html, { width, height, scale = 1, fonts = [] }) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
    await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    const dir = await mkdtemp(join(tmpdir(), "tamis-page-"));
    const file = join(dir, "page.html");
    await writeFile(file, html);
    const loaded = waitFor("Page.loadEventFired");
    await send("Page.navigate", { url: pathToFileURL(file).href });
    await loaded;
    await evaluate("document.fonts.ready.then(() => true)");
    for (const font of fonts) {
      const ok = await evaluate(`document.fonts.load(${JSON.stringify(font)}).then(() => document.fonts.check(${JSON.stringify(font)}))`);
      if (!ok) throw new Error(`Web font did not load: ${font} (offline?)`);
    }
    await rm(dir, { recursive: true, force: true });
  }

  /** PNG bytes of the top-left width x height CSS px, at the page scale. */
  async function screenshot({ width, height }) {
    const { data } = await send("Page.captureScreenshot", {
      format: "png",
      clip: { x: 0, y: 0, width, height, scale: 1 },
      captureBeyondViewport: false,
    });
    return Buffer.from(data, "base64");
  }

  return { send, evaluate, load, screenshot };
}
