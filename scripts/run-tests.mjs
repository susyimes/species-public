import { readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const testRoot = path.resolve("dist", "tests");
const testFiles = collectTests(testRoot);

if (testFiles.length === 0) {
  console.error(`No compiled test files found under ${testRoot}`);
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--test", ...testFiles], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const candidate = path.join(directory, entry.name);
      return entry.isDirectory() ? collectTests(candidate) : entry.isFile() && entry.name.endsWith(".test.js") ? [candidate] : [];
    })
    .sort();
}
