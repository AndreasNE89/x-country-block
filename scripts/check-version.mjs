// Fails when package.json, the lockfile, both manifests, README, BUILD or
// CHANGELOG disagree on the release version.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkVersions } from "./lib/versions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version, problems } = await checkVersions(root);

if (problems.length > 0) {
  console.error(`Version check failed (package.json is ${version}):`);
  for (const line of problems) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`Version check: ${version} everywhere`);
