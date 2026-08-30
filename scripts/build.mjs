import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

await mkdir(dist, { recursive: true });

await esbuild.build({
  entryPoints: {
    hook: join(root, "src/hook/inject.ts"),
    content: join(root, "src/content/main.ts"),
    popup: join(root, "src/popup/popup.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome120", "firefox128"],
  logLevel: "info",
});

await copyFile(join(root, "manifest.json"), join(dist, "manifest.json"));
await copyFile(join(root, "src/popup/popup.html"), join(dist, "popup.html"));
await copyFile(join(root, "src/popup/popup.css"), join(dist, "popup.css"));
