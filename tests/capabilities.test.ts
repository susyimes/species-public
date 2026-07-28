import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  capabilityUseIntentionFromDecoded,
  defaultAgentCapabilityCards,
  executeAgentCapability,
  type AgentCapabilityUseRequest,
} from "../src/capabilities/capabilities";
import { DEFAULT_WEB_SEARCH_TIMEOUT_MS } from "../src/capabilities/webSearch";

const execFileAsync = promisify(execFile);

test("default capability cards cover read, write, YOLO space, browser, web search, shell, memsu, and git", () => {
  const cards = defaultAgentCapabilityCards();
  const ids = cards.map((card) => card.capabilityId);

  assert.deepEqual(ids, [
    "local.filesystem.read",
    "local.filesystem.write",
    "local.yolo_space",
    "local.browser.read",
    "web.search.read",
    "local.browser.control",
    "local.shell.exec",
    "local.memsu.read",
    "local.memsu.write",
    "local.git.read",
    "local.git.write",
  ]);
  assert.equal(cards.every((card) => card.visibility === "private_agent"), true);
  assert.equal(cards.find((card) => card.capabilityId === "local.filesystem.read")?.operations[0]?.approval, "none");
  assert.equal(cards.find((card) => card.capabilityId === "web.search.read")?.operations[0]?.approval, "none");
  assert.equal(cards.find((card) => card.capabilityId === "web.search.read")?.scope, "network");
  assert.equal(cards.find((card) => card.capabilityId === "local.yolo_space")?.operations[1]?.approval, "none");
  assert.equal(cards.find((card) => card.capabilityId === "local.yolo_space")?.operations[2]?.operation, "write_file");
  assert.equal(cards.find((card) => card.capabilityId === "local.shell.exec")?.operations[0]?.approval, "required");
});

test("capability use parser repairs common provider aliases", () => {
  const memsu = capabilityUseIntentionFromDecoded(
    {
      kind: "use_capability",
      capability: "memsu",
      action: "search",
      text: "今天都做了什么",
    },
    ["evt_trigger"],
  );
  const shell = capabilityUseIntentionFromDecoded(
    {
      kind: "use_capability",
      tool: "shell",
      command: "echo hello",
    },
    ["evt_trigger"],
  );
  const webSearch = capabilityUseIntentionFromDecoded(
    {
      kind: "use_capability",
      tool: "web",
      action: "search",
      q: "Species autonomous agents",
    },
    ["evt_trigger"],
  );
  const yolo = capabilityUseIntentionFromDecoded(
    {
      kind: "use_capability",
      tool: "yolo space",
      action: "run",
      root: "species-workshop",
      command: "git status --short --branch",
    },
    ["evt_trigger"],
  );
  const yoloWrite = capabilityUseIntentionFromDecoded(
    {
      kind: "use_capability",
      tool: "yolo space",
      action: "write",
      input: {
        root: "species-workshop",
        path: "game/main.py",
        content: "import pyxel\n\nprint('精确写入')\n",
      },
    },
    ["evt_trigger"],
  );

  assert.deepEqual(memsu, {
    kind: "use_capability",
    capabilityId: "local.memsu.read",
    operation: "search_memory",
    input: { path: undefined, root: undefined, query: "今天都做了什么", glob: undefined },
    reason: "Need private local.memsu.read:search_memory context before replying.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(shell, {
    kind: "use_capability",
    capabilityId: "local.shell.exec",
    operation: "exec",
    input: { path: undefined, root: undefined, query: "echo hello", glob: undefined },
    reason: "Need private local.shell.exec:exec context before replying.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(webSearch, {
    kind: "use_capability",
    capabilityId: "web.search.read",
    operation: "search",
    input: { path: undefined, root: undefined, query: "Species autonomous agents", glob: undefined },
    reason: "Need private web.search.read:search context before replying.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(yolo, {
    kind: "use_capability",
    capabilityId: "local.yolo_space",
    operation: "exec",
    input: { path: undefined, root: "species-workshop", query: "git status --short --branch", glob: undefined },
    reason: "Need private local.yolo_space:exec context before replying.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(yoloWrite, {
    kind: "use_capability",
    capabilityId: "local.yolo_space",
    operation: "write_file",
    input: {
      path: "game/main.py",
      root: "species-workshop",
      query: undefined,
      glob: undefined,
      content: "import pyxel\n\nprint('精确写入')\n",
    },
    reason: "Need private local.yolo_space:write_file context before replying.",
    contextRefs: ["evt_trigger"],
  });
  assert.equal(
    capabilityUseIntentionFromDecoded(
      {
        kind: "use_capability",
        capabilityId: "local.memsu.read",
        operation: "search_memory",
        input: {},
        reason: "user asked to see today's memsu activity",
      },
      ["evt_trigger"],
    ),
    undefined,
  );
});

test("capability parser preserves commands longer than the old 1000-character limit", () => {
  const command = `node -e "process.stdout.write('${"x".repeat(2_000)}')"`;
  const intention = capabilityUseIntentionFromDecoded(
    {
      kind: "use_capability",
      capabilityId: "local.yolo_space",
      operation: "exec",
      input: { root: "workshop", query: command },
    },
    ["evt_trigger"],
  );

  assert.equal(intention?.kind, "use_capability");
  assert.equal(intention?.input.query, command);
  assert.equal(intention?.input.query?.endsWith("..."), false);
});

test("YOLO space rejects oversized commands explicitly instead of executing truncated text", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-input-limit-"));
  try {
    const command = `echo ${"x".repeat(2_000)}`;
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "exec",
        input: { root: "workshop", query: command },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["agent_test"],
            maxInputBytes: 1_024,
          },
        ],
      },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "failed");
    assert.match(outcome.result.error ?? "", /exceeding the configured 1024-byte input limit/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("filesystem read capability really reads a bounded local file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-fs-"));
  try {
    const filePath = path.join(dir, "note.txt");
    await writeFile(filePath, "capability read says hello", "utf8");

    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.filesystem.read",
        operation: "read_file",
        input: { path: filePath },
      }),
      { allowedReadRoots: [dir] },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.match(String(outcome.result.output.content), /capability read says hello/);
    assert.equal(outcome.fragment.visibility, "private_agent");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("filesystem read capability rejects paths outside configured roots", async () => {
  const allowedDir = await mkdtemp(path.join(os.tmpdir(), "species-cap-fs-allowed-"));
  const outsideDir = await mkdtemp(path.join(os.tmpdir(), "species-cap-fs-outside-"));
  try {
    const outsideFile = path.join(outsideDir, "private.txt");
    await writeFile(outsideFile, "must not cross the configured boundary", "utf8");
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.filesystem.read",
        operation: "read_file",
        input: { path: outsideFile },
      }),
      { cwd: allowedDir },
    );
    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "failed");
    assert.match(outcome.result.error ?? "", /outside configured roots/);
  } finally {
    await rm(allowedDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  }
});

test("browser read capability really fetches a localhost URL", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("browser capability local page");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.browser.read",
        operation: "fetch_url",
        input: { path: `http://127.0.0.1:${port}/room` },
      }),
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.match(JSON.stringify(outcome.result.output), /browser capability local page/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("memsu read capability is disabled until explicitly enabled", async () => {
  const outcome = await executeAgentCapability(
    request({
      capabilityId: "local.memsu.read",
      operation: "list_home",
      input: {},
    }),
  );
  assert.equal(outcome.kind, "private_result");
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.error ?? "", /memSu reads are disabled/);
});

test("web search capability calls a configured HTTP broker and returns private results", async () => {
  let received: Record<string, unknown> | undefined;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          summary: "broker summary for Species search",
          results: [
            {
              title: "Species search broker result",
              url: "https://example.test/species-search",
              snippet: "The broker returned a bounded result for the agent.",
              source: "test-broker",
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "web.search.read",
        operation: "search",
        input: { query: "Species autonomous agent room search" },
      }),
      { searchEndpoint: `http://127.0.0.1:${port}/search`, maxSearchResults: 3 },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.equal(outcome.result.boundary.scope, "network");
    assert.equal(outcome.result.boundary.approval, "none");
    assert.equal(received?.query, "Species autonomous agent room search");
    assert.equal(received?.maxResults, 3);
    assert.match(JSON.stringify(outcome.result.output), /Species search broker result/);
    assert.match(outcome.fragment.body, /untrustedContentWarning/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("web search capability can use a configured CLI wrapper", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-web-cli-"));
  try {
    const scriptPath = path.join(dir, "search-wrapper.cjs");
    await writeFile(
      scriptPath,
      [
        "const query = process.argv[2];",
        "const maxResults = Number(process.argv[3]);",
        "console.log(JSON.stringify({",
        "  summary: `cli summary for ${query}`,",
        "  results: [{ title: `CLI result for ${query}`, url: 'https://example.test/cli-search', snippet: `max=${maxResults}`, source: 'cli-wrapper' }],",
        "}));",
      ].join("\n"),
      "utf8",
    );

    const outcome = await executeAgentCapability(
      request({
        capabilityId: "web.search.read",
        operation: "search",
        input: { query: "codex cli broker" },
      }),
      {
        searchCommand: process.execPath,
        searchCommandArgs: [scriptPath, "{query}", "{maxResults}"],
        maxSearchResults: 2,
      },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.match(JSON.stringify(outcome.result.output), /CLI result for codex cli broker/);
    assert.match(JSON.stringify(outcome.result.output), /max=2/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("built-in Codex web search is isolated, shell-disabled, and approval-free", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-codex-search-"));
  try {
    const scriptPath = path.join(dir, "fake-codex.cjs");
    const capturePath = path.join(dir, "invocation.json");
    await writeFile(
      scriptPath,
      [
        "const fs = require('node:fs');",
        "const capturePath = process.argv[2];",
        "const args = process.argv.slice(3);",
        "fs.writeFileSync(capturePath, JSON.stringify({ args, cwd: process.cwd() }));",
        "process.stdin.resume();",
        "process.stdin.on('end', () => console.log(JSON.stringify({",
        "  summary: 'Codex native search fixture after stdin EOF',",
        "  results: [{ title: 'Primary paper result', url: 'https://arxiv.org/abs/2607.05458', snippet: 'A direct paper result.', source: 'arXiv' }],",
        "})));",
      ].join("\n"),
      "utf8",
    );

    const outcome = await executeAgentCapability(
      request({
        capabilityId: "web.search.read",
        operation: "search",
        input: { query: "arXiv 2607.05458" },
      }),
      {
        codexCommand: process.execPath,
        codexCommandArgs: [scriptPath, capturePath],
        maxSearchResults: 4,
        searchTimeoutMs: 1_000,
      },
    );
    const capture = JSON.parse(await readFile(capturePath, "utf8")) as { args: string[]; cwd: string };
    const output = outcome.result.output as Record<string, unknown>;

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.equal(outcome.result.boundary.readOnly, true);
    assert.equal(outcome.result.boundary.approval, "none");
    assert.equal(output.backend, "codex_cli_web_search");
    assert.equal(capture.args.includes("--search"), true);
    assert.deepEqual(capture.args.slice(capture.args.indexOf("--disable"), capture.args.indexOf("--disable") + 2), [
      "--disable",
      "shell_tool",
    ]);
    assert.deepEqual(
      capture.args.slice(capture.args.indexOf("--ask-for-approval"), capture.args.indexOf("--ask-for-approval") + 2),
      ["--ask-for-approval", "never"],
    );
    assert.deepEqual(capture.args.slice(capture.args.indexOf("--sandbox"), capture.args.indexOf("--sandbox") + 2), [
      "--sandbox",
      "read-only",
    ]);
    assert.equal(capture.args.includes("--ignore-user-config"), true);
    assert.equal(capture.args.some((arg) => arg.includes("dangerously-bypass")), false);
    assert.match(capture.args.at(-1) ?? "", /arXiv 2607\.05458/);
    assert.match(capture.args.at(-1) ?? "", /untrusted data/);
    assert.equal(path.basename(capture.cwd), "species-codex-web-search");
    assert.match(JSON.stringify(output), /Primary paper result/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("web search allows 120 seconds by default", () => {
  assert.equal(DEFAULT_WEB_SEARCH_TIMEOUT_MS, 120_000);
});

test("memsu read capability really searches a configured memsu home", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-memsu-"));
  try {
    await mkdir(path.join(dir, "notes"), { recursive: true });
    await writeFile(path.join(dir, "notes", "today.md"), "north star: keep the room agent-owned", "utf8");

    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.memsu.read",
        operation: "search_memory",
        input: { root: dir, query: "north star" },
      }),
      { enableMemsuRead: true, memsuHome: dir },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.match(JSON.stringify(outcome.result.output), /north star/);
    assert.match(outcome.result.summary, /memSu search_memory/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("memsu read capability cannot expand beyond its configured home", async () => {
  const configuredHome = await mkdtemp(path.join(os.tmpdir(), "species-cap-memsu-home-"));
  const outsideDir = await mkdtemp(path.join(os.tmpdir(), "species-cap-memsu-outside-"));
  try {
    await writeFile(path.join(outsideDir, "private.md"), "outside configured memSu home", "utf8");
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.memsu.read",
        operation: "read_note",
        input: { root: outsideDir, path: path.join(outsideDir, "private.md") },
      }),
      { enableMemsuRead: true, memsuHome: configuredHome },
    );
    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "failed");
    assert.match(outcome.result.error ?? "", /outside configured roots/);
  } finally {
    await rm(configuredHome, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  }
});

test("git read capability really reads a worktree status", async (t) => {
  if (!(await hasGit())) {
    t.skip("git executable is not available");
    return;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-git-"));
  try {
    await execFileAsync("git", ["init"], { cwd: dir, windowsHide: true });
    await writeFile(path.join(dir, "tracked-soon.txt"), "git status should see me", "utf8");

    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.git.read",
        operation: "status",
        input: { root: dir },
      }),
      { allowedReadRoots: [dir] },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.match(JSON.stringify(outcome.result.output), /\?\? tracked-soon\.txt/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("git read capability infers memSu repo root from request context", async (t) => {
  if (!(await hasGit())) {
    t.skip("git executable is not available");
    return;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-git-memsu-root-"));
  const previous = process.env.SPECIES_MEMSU_REPO;
  try {
    await execFileAsync("git", ["init"], { cwd: dir, windowsHide: true });
    await writeFile(path.join(dir, "memsu-note.txt"), "git log should run in the memSu repo", "utf8");
    await execFileAsync("git", ["add", "memsu-note.txt"], { cwd: dir, windowsHide: true });
    await execFileAsync(
      "git",
      ["-c", "user.name=Species Test", "-c", "user.email=species@example.test", "commit", "-m", "memsu repo test commit"],
      { cwd: dir, windowsHide: true },
    );
    await writeFile(path.join(dir, "untracked-memsu-note.txt"), "git status should run in the memSu repo", "utf8");
    process.env.SPECIES_MEMSU_REPO = dir;

    const statusOutcome = await executeAgentCapability(
      request({
        capabilityId: "local.git.read",
        operation: "status",
        input: {},
        reason: "Need to check today's memSu repo git status before replying.",
      }),
    );

    assert.equal(statusOutcome.kind, "private_result");
    assert.equal(statusOutcome.result.status, "completed");
    const output = statusOutcome.result.output as { cwd?: string; rootResolution?: { source?: string; label?: string } };
    assert.equal(output.cwd, path.resolve(dir));
    assert.equal(output.rootResolution?.source, "SPECIES_MEMSU_REPO");
    assert.equal(output.rootResolution?.label, "memSu repo");
    assert.match(JSON.stringify(statusOutcome.result.output), /untracked-memsu-note\.txt/);

    const logOutcome = await executeAgentCapability(
      request({
        capabilityId: "local.git.read",
        operation: "log",
        input: { query: "git log --since=1970-01-01 --until=2099-01-01 --oneline" },
        reason: "Need to check today's memSu repo git log before replying.",
      }),
    );
    assert.equal(logOutcome.kind, "private_result");
    assert.equal(logOutcome.result.status, "completed");
    const logOutput = logOutcome.result.output as { cwd?: string; args?: string[]; output?: string };
    assert.equal(logOutput.cwd, path.resolve(dir));
    assert.deepEqual(logOutput.args, ["log", "--oneline", "-n", "20", "--since=1970-01-01", "--until=2099-01-01"]);
    assert.match(logOutput.output ?? "", /memsu repo test commit/);
  } finally {
    if (previous === undefined) {
      delete process.env.SPECIES_MEMSU_REPO;
    } else {
      process.env.SPECIES_MEMSU_REPO = previous;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("YOLO space executes a pre-authorized command inside its configured root", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-"));
  try {
    const command = process.platform === "win32" ? "echo yolo-ready>from-yolo.txt" : "printf yolo-ready > from-yolo.txt";
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "exec",
        input: { root: "workshop", query: command },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["agent_test"],
          },
        ],
      },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.equal(outcome.result.boundary.scope, "yolo_space");
    assert.equal(outcome.result.boundary.approval, "none");
    assert.equal(outcome.result.boundary.readOnly, false);
    assert.match(await readFile(path.join(dir, "from-yolo.txt"), "utf8"), /yolo-ready/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("YOLO space preserves direct cmd FOR variable semantics on Windows", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows cmd semantics regression");
    return;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-cmd-for-"));
  try {
    const command = "for %i in (1 2) do @echo %i";
    const direct = await windowsCmdResult(command, dir);
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "exec",
        input: { root: "workshop", query: command },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["agent_test"],
          },
        ],
      },
    );

    assert.equal(direct.exitStatus, 0);
    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status === "completed" ? 0 : null, direct.exitStatus);
    assert.equal(outcome.result.output.stdout, direct.stdout);
    assert.equal(outcome.result.output.transport, "direct_cmd");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("YOLO space preserves direct cmd percent argument tokens on Windows", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows cmd semantics regression");
    return;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-cmd-percent-"));
  try {
    const command = "echo [%0][%1][%*]";
    const direct = await windowsCmdResult(command, dir);
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "exec",
        input: { root: "workshop", query: command },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["agent_test"],
          },
        ],
      },
    );

    assert.equal(direct.exitStatus, 0);
    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.equal(outcome.result.output.stdout, direct.stdout);
    assert.equal(outcome.result.output.transport, "direct_cmd");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("YOLO space removes temporary Windows scripts after success, failure, and timeout", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows temporary cmd cleanup regression");
    return;
  }

  const scenarios = [
    { name: "success", finalCommand: "echo completed", timeoutMs: 2_000, expectedStatus: "completed" },
    { name: "failure", finalCommand: "exit /b 7", timeoutMs: 2_000, expectedStatus: "failed" },
    {
      name: "timeout",
      finalCommand: `node -e "process.chdir(require('node:os').tmpdir()); setTimeout(() => {}, 2000)"`,
      timeoutMs: 100,
      expectedStatus: "failed",
    },
  ] as const;

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), `species-cap-yolo-cleanup-${scenario.name}-`));
      const markerPath = path.join(dir, "temporary-script-path.txt");
      try {
        const command = [`echo %~f0>temporary-script-path.txt`, scenario.finalCommand].join("\r\n");
        const outcome = await executeAgentCapability(
          request({
            capabilityId: "local.yolo_space",
            operation: "exec",
            input: { root: "workshop", query: command },
          }),
          {
            yoloSpaces: [
              {
                id: "workshop",
                label: "Test Workshop",
                root: dir,
                enabled: true,
                allowedAgents: ["agent_test"],
                commandTimeoutMs: scenario.timeoutMs,
              },
            ],
          },
        );

        assert.equal(outcome.kind, "private_result");
        assert.equal(outcome.result.status, scenario.expectedStatus);
        assert.equal(outcome.result.output.transport, "temporary_cmd_script");
        const temporaryScriptPath = (await readFile(markerPath, "utf8")).trim();
        assert.match(temporaryScriptPath, /[\\/]command\.cmd$/i);
        await assert.rejects(access(temporaryScriptPath));
        await assert.rejects(access(path.dirname(temporaryScriptPath)));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
});

test("YOLO space preserves nested quotes and multiline shell commands", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-script-"));
  try {
    const command = [
      `node -e "require('node:fs').writeFileSync('quoted-write.txt','quoted-ok')"`,
      `node -e "require('node:fs').writeFileSync('multiline-write.txt','multiline-ok')"`,
    ].join(process.platform === "win32" ? "\r\n" : "\n");
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "exec",
        input: { root: "yolo_space:workshop", query: command },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["agent_test"],
          },
        ],
      },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.equal(await readFile(path.join(dir, "quoted-write.txt"), "utf8"), "quoted-ok");
    assert.equal(await readFile(path.join(dir, "multiline-write.txt"), "utf8"), "multiline-ok");
    assert.match(String(outcome.result.output.transport), /^temporary_(?:cmd|sh)_script$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("YOLO space write_file writes exact multiline UTF-8 content and verifies persisted bytes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-write-"));
  try {
    const content = "import pyxel\n\nTITLE = '像素温室'\nprint(TITLE)\n";
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "write_file",
        input: {
          root: "workshop",
          path: "src/game.py",
          content,
        },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["agent_test"],
          },
        ],
      },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.equal(await readFile(path.join(dir, "src", "game.py"), "utf8"), content);
    assert.equal(outcome.result.output.verified, true);
    assert.equal(outcome.result.output.bytesWritten, Buffer.byteLength(content, "utf8"));
    assert.match(String(outcome.result.output.sha256), /^[a-f0-9]{64}$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("YOLO space allows repository-local Git mutations with an HTTPS remote", async (t) => {
  if (!(await hasGit())) {
    t.skip("git executable is not available");
    return;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-git-"));
  try {
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "exec",
        input: {
          root: "workshop",
          query: "git init && git remote add origin https://example.test/species-workshop.git && git remote get-url origin",
        },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["agent_test"],
          },
        ],
      },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "completed");
    assert.match(String(outcome.result.output.stdout), /https:\/\/example\.test\/species-workshop\.git/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("YOLO space rejects parent traversal before executing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-boundary-"));
  const outsidePath = path.join(path.dirname(dir), `${path.basename(dir)}-outside.txt`);
  try {
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "exec",
        input: { root: "workshop", query: `echo blocked > ../${path.basename(outsidePath)}` },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["*"],
          },
        ],
      },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "failed");
    assert.match(outcome.result.error ?? "", /parent-directory traversal/);
  } finally {
    await rm(outsidePath, { force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

test("YOLO space write_file rejects targets outside its configured root", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-cap-yolo-write-boundary-"));
  const outsidePath = path.join(path.dirname(dir), `${path.basename(dir)}-outside.txt`);
  try {
    const outcome = await executeAgentCapability(
      request({
        capabilityId: "local.yolo_space",
        operation: "write_file",
        input: { root: "workshop", path: `../${path.basename(outsidePath)}`, content: "blocked" },
      }),
      {
        yoloSpaces: [
          {
            id: "workshop",
            label: "Test Workshop",
            root: dir,
            enabled: true,
            allowedAgents: ["*"],
          },
        ],
      },
    );

    assert.equal(outcome.kind, "private_result");
    assert.equal(outcome.result.status, "failed");
    assert.match(outcome.result.error ?? "", /parent-directory traversal/);
    await assert.rejects(readFile(outsidePath, "utf8"));
  } finally {
    await rm(outsidePath, { force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

test("side-effect capabilities become approval-required outcomes instead of executing", async () => {
  const cases: [string, string, AgentCapabilityUseRequest["input"], string][] = [
    ["local.filesystem.write", "write_file", { path: "agents/test/workspace/note.md" }, "filesystem.write"],
    ["local.filesystem.write", "delete_file", { path: "agents/test/workspace/note.md" }, "filesystem.delete"],
    ["local.browser.control", "open_url", { path: "https://example.test" }, "network.request"],
    ["local.shell.exec", "exec", { query: "echo should-not-run" }, "shell.exec"],
    ["local.memsu.write", "record_delta", { query: "remember this" }, "external_api.call"],
    ["local.git.write", "commit", { root: ".", query: "capability commit" }, "git.commit"],
    ["local.git.write", "push", { root: ".", query: "origin main" }, "git.push"],
  ];

  for (const [capabilityId, operation, input, kind] of cases) {
    const outcome = await executeAgentCapability(request({ capabilityId, operation, input }));
    assert.equal(outcome.kind, "side_effect_request", `${capabilityId}:${operation}`);
    if (outcome.kind === "side_effect_request") {
      assert.equal(outcome.result.status, "approval_required");
      assert.equal(outcome.sideEffect.kind, kind);
    }
  }
});

function request(input: {
  capabilityId: string;
  operation: string;
  input: AgentCapabilityUseRequest["input"];
  reason?: string;
}): AgentCapabilityUseRequest {
  return {
    roomId: "room_species",
    agentId: "agent_test",
    topicId: "topic_test",
    invocationId: `cap_${input.capabilityId}_${input.operation}`.replace(/[^A-Za-z0-9_:-]/g, "_"),
    capabilityId: input.capabilityId,
    operation: input.operation,
    input: input.input,
    reason: input.reason ?? "test needs this capability",
    contextRefs: ["evt_trigger"],
  };
}

async function windowsCmdResult(
  command: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitStatus: number | null }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], {
      cwd,
      windowsHide: true,
    });
    return { stdout, stderr, exitStatus: 0 };
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      exitStatus: typeof result.code === "number" ? result.code : null,
    };
  }
}

async function hasGit(): Promise<boolean> {
  try {
    await execFileAsync("git", ["--version"], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}
