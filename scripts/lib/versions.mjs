import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Files that must all carry the package.json version. */
export const VERSION_FILES = [
  "package.json",
  "package-lock.json",
  "manifest.json",
  "manifest.firefox.json",
  "README.md",
  "BUILD.md",
  "CHANGELOG.md",
];

const ZIP_VERSION = /x-country-block-(\d+\.\d+\.\d+)-/g;
const CHANGELOG_HEADING = /^## \[?(\d+\.\d+\.\d+)\]?/m;

/**
 * Every version a file declares. JSON files use their version fields; README
 * and BUILD use the release zip names they document; CHANGELOG uses its
 * newest entry. `undefined` means the file declares none.
 */
export function versionsIn(file, text) {
  if (file === "package-lock.json") {
    const lock = JSON.parse(text);
    return [lock.version, lock.packages?.[""]?.version];
  }
  if (file.endsWith(".json")) return [JSON.parse(text).version];
  if (file === "CHANGELOG.md") return [CHANGELOG_HEADING.exec(text)?.[1]];
  const found = [...text.matchAll(ZIP_VERSION)].map((match) => match[1]);
  return found.length > 0 ? found : [undefined];
}

/** One readable line per disagreement; empty when everything matches. */
export function versionProblems(expected, declared) {
  const problems = [];
  for (const [file, versions] of Object.entries(declared)) {
    for (const version of versions) {
      if (version === undefined) problems.push(`${file}: no version found`);
      else if (version !== expected) problems.push(`${file}: ${version} (expected ${expected})`);
    }
  }
  return problems;
}

export async function checkVersions(root) {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const declared = {};
  const problems = [];
  for (const file of VERSION_FILES) {
    let text;
    try {
      text = await readFile(join(root, file), "utf8");
    } catch {
      problems.push(`${file}: missing`);
      continue;
    }
    declared[file] = versionsIn(file, text);
  }
  return { version: pkg.version, problems: [...problems, ...versionProblems(pkg.version, declared)] };
}

/** Throws when the files disagree; returns the version otherwise. */
export async function assertVersions(root) {
  const { version, problems } = await checkVersions(root);
  if (problems.length > 0) {
    throw new Error(`Version check failed (package.json is ${version}):\n  ${problems.join("\n  ")}`);
  }
  return version;
}
