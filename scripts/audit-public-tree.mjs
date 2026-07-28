import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const syntheticSecret = "sk-fixture-not-a-real-key-1234567890";
const listed = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
);
const files = listed.split("\0").filter(Boolean).sort();
const errors = [];

const forbiddenPaths = [
  /^\.env$/i,
  /^\.species(?:\/|$)/i,
  /^dist(?:\/|$)/i,
  /^node_modules(?:\/|$)/i,
  /^\.symphony-handoff\.md$/i,
  /^docs\/current-status-and-next-steps\.md$/i,
  /(?:^|\/)(?:coverage|logs?)(?:\/|$)/i,
];

const forbiddenContent = [
  { label: "personal home path", regex: /(?:[a-z]:[\\/]+Users[\\/]+[^\\/\s]+|\/Users\/[^/\s]+)/i },
  { label: "private workspace path", regex: /\b[a-z]:[\\/]+(?:species|memsu(?:os)?|projection-agent)(?:[\\/]|$)/i },
  {
    label: "internal handoff marker",
    regex: new RegExp(`(?:${["\\.symphony", "handoff"].join("-")}|SVM-\\d+)`, "i"),
  },
  { label: "AWS access-key shape", regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { label: "GitHub token shape", regex: /\bgh[opusr]_[A-Za-z0-9_]{30,}\b/ },
  { label: "OpenAI-style secret shape", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
];

for (const file of files) {
  const normalized = file.replaceAll("\\", "/");
  const absolute = resolve(root, file);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    continue;
  }

  for (const pattern of forbiddenPaths) {
    if (pattern.test(normalized)) {
      errors.push(`${normalized}: forbidden public path`);
    }
  }

  if (statSync(absolute).size > 5_000_000) {
    continue;
  }

  const buffer = readFileSync(absolute);
  if (buffer.includes(0)) {
    continue;
  }
  const text = buffer.toString("utf8").replaceAll(syntheticSecret, "");
  for (const check of forbiddenContent) {
    if (normalized === "scripts/audit-public-tree.mjs" && check.label === "internal handoff marker") {
      continue;
    }
    if (check.regex.test(text)) {
      errors.push(`${normalized}: ${check.label}`);
    }
  }
}

for (const markdown of ["README.md", "CONTRIBUTING.md", "SECURITY.md", "THIRD_PARTY_NOTICES.md"]) {
  if (!existsSync(resolve(root, markdown))) {
    errors.push(`${markdown}: required public document is missing`);
    continue;
  }

  const text = readFileSync(resolve(root, markdown), "utf8");
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].trim();
    if (/^(?:https?:|mailto:|#)/i.test(target)) {
      continue;
    }
    const withoutAnchor = target.split("#", 1)[0];
    const localPath = resolve(root, dirname(markdown), decodeURIComponent(withoutAnchor));
    if (!existsSync(localPath)) {
      errors.push(`${markdown}: broken local link ${target}`);
    }
  }
}

if (!existsSync(resolve(root, "LICENSE"))) {
  errors.push("LICENSE: required public document is missing");
}

if (errors.length > 0) {
  console.error("Public-tree audit failed:");
  for (const error of [...new Set(errors)]) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Public-tree audit passed (${files.length} candidate files).`);
}
