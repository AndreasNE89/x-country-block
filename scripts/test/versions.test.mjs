// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkVersions, versionProblems, versionsIn } from "../lib/versions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A minimal checkout whose version files all name `version`. */
async function fixture(version, extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), "tamis-versions-"));
  const json = (value) => JSON.stringify(value);
  const zip = (kind) => `\`release/x-country-block-${version}-${kind}.zip\``;
  const files = {
    "package.json": json({ version }),
    "package-lock.json": json({ version, packages: { "": { version } } }),
    "manifest.json": json({ version }),
    "manifest.firefox.json": json({ version }),
    "README.md": zip("chrome"),
    "BUILD.md": zip("firefox"),
    "CHANGELOG.md": `# Changelog\n\n## ${version} - unreleased\n`,
    ...extra,
  };
  for (const [file, text] of Object.entries(files)) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), text);
  }
  fixtures.push(dir);
  return dir;
}

const fixtures = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("versionsIn", () => {
  it("reads both version fields of package-lock.json", () => {
    const lock = JSON.stringify({ version: "1.2.3", packages: { "": { version: "1.2.4" } } });
    expect(versionsIn("package-lock.json", lock)).toEqual(["1.2.3", "1.2.4"]);
  });

  it("reads the version of a manifest", () => {
    expect(versionsIn("manifest.json", '{"version":"0.2.0"}')).toEqual(["0.2.0"]);
  });

  it("reads every release zip name in a markdown file", () => {
    const md = "`release/x-country-block-0.2.0-firefox.zip` and `x-country-block-0.1.9-source.zip`";
    expect(versionsIn("BUILD.md", md)).toEqual(["0.2.0", "0.1.9"]);
  });

  it("reads the newest CHANGELOG heading only", () => {
    const md = "# Changelog\n\n## 0.3.0 - 2026-10-01\n\n## 0.2.0 - 2026-09-24\n";
    expect(versionsIn("CHANGELOG.md", md)).toEqual(["0.3.0"]);
  });

  it("reports a markdown file with no version as missing", () => {
    expect(versionsIn("README.md", "no zip names here")).toEqual([undefined]);
  });
});

describe("versionProblems", () => {
  it("is empty when every file agrees", () => {
    expect(versionProblems("0.2.0", { "manifest.json": ["0.2.0"], "BUILD.md": ["0.2.0", "0.2.0"] })).toEqual([]);
  });

  it("names each file that disagrees (package.json bumped, manifest not)", () => {
    expect(versionProblems("0.1.3", { "manifest.json": ["0.1.2"], "README.md": [undefined] })).toEqual([
      "manifest.json: 0.1.2 (expected 0.1.3)",
      "README.md: no version found",
    ]);
  });
});

describe("checkVersions", () => {
  it("flags package names in the store listing left behind by a version bump", async () => {
    const dir = await fixture("0.2.1", {
      "store/listing.md": "Upload `release/x-country-block-0.2.0-chrome.zip`.",
    });
    const { problems } = await checkVersions(dir);
    expect(problems).toEqual(["store/listing.md: 0.2.0 (expected 0.2.1)"]);
  });

  it("accepts a store listing that names the current packages", async () => {
    const dir = await fixture("0.2.1", {
      "store/listing.md": "Upload `release/x-country-block-0.2.1-chrome.zip`.",
    });
    expect((await checkVersions(dir)).problems).toEqual([]);
  });

  it("skips the store listing when it is absent, as in the source archive", async () => {
    const dir = await fixture("0.2.1");
    expect((await checkVersions(dir)).problems).toEqual([]);
  });

  it("still reports a missing required file", async () => {
    const dir = await fixture("0.2.1");
    await rm(join(dir, "BUILD.md"));
    expect((await checkVersions(dir)).problems).toEqual(["BUILD.md: missing"]);
  });
});

describe("repository", () => {
  it("declares one version everywhere", async () => {
    const { problems } = await checkVersions(root);
    expect(problems).toEqual([]);
  });
});
