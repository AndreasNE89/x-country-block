// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkVersions, versionProblems, versionsIn } from "../lib/versions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

describe("repository", () => {
  it("declares one version everywhere", async () => {
    const { problems } = await checkVersions(root);
    expect(problems).toEqual([]);
  });
});
