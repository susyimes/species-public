import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type {
  AgentId,
  CapabilityUseInput,
  CapabilityUseIntention,
  ContextFragment,
  EventId,
  RefId,
  RoomId,
  SideEffectKind,
  TopicId,
} from "../types";
import {
  authorizeLocalReadPath,
  executeLocalFilesystemRead,
  localFilesystemReadBoundary,
  type CapabilityExecutionInput,
  type CapabilityExecutionResult,
} from "./filesystemRead";
import { executeWebSearchRead, type WebSearchExecutorOptions } from "./webSearch";
import {
  executeYoloSpaceCapability,
  type YoloSpaceExecutorOptions,
} from "./yoloSpace";

const execFileAsync = promisify(execFile);

export type CapabilityApprovalPolicy = "none" | "required";
export type CapabilityVisibility = "private_agent";

export type RuntimeCapabilityOperationCard = {
  operation: string;
  approval: CapabilityApprovalPolicy;
  sideEffectKind?: SideEffectKind;
  summary: string;
};

export type RuntimeCapabilityCard = {
  capabilityId: string;
  label: string;
  scope: "all_device" | "local_runtime" | "agent_workspace" | "memsu_home" | "git_worktree" | "network" | "yolo_space";
  visibility: CapabilityVisibility;
  operations: RuntimeCapabilityOperationCard[];
  boundaryNote: string;
};

export type AgentCapabilityUseRequest = {
  roomId: RoomId;
  agentId: AgentId;
  topicId: TopicId;
  invocationId: string;
  capabilityId: string;
  operation: string;
  input: CapabilityUseInput;
  reason: string;
  contextRefs: RefId[];
};

export type AgentCapabilityOutcome =
  | {
      kind: "private_result";
      result: CapabilityExecutionResult;
      fragment: ContextFragment;
    }
  | {
      kind: "side_effect_request";
      result: CapabilityExecutionResult;
      sideEffect: {
        kind: SideEffectKind;
        target: string;
        expectedImpact: string;
        proposedCommand?: string;
      };
    };

export type AgentCapabilityExecutor = (request: AgentCapabilityUseRequest) => Promise<AgentCapabilityOutcome>;

export type CapabilityExecutorOptions = {
  cwd?: string;
  allowedReadRoots?: readonly string[];
  allowAllDeviceRead?: boolean;
  enableMemsuRead?: boolean;
  memsuHome?: string;
  maxBytes?: number;
  maxSearchResults?: number;
  offloadThresholdBytes?: number;
  artifactRoot?: string;
} & WebSearchExecutorOptions & YoloSpaceExecutorOptions;

const DEFAULT_MAX_BYTES = 64 * 1024;
const DEFAULT_BROWSER_MAX_BYTES = 48 * 1024;
const DEFAULT_OFFLOAD_THRESHOLD_BYTES = 16 * 1024;
const MAX_ARTIFACT_PREVIEW_CHARS = 1_600;
const KNOWN_GIT_WORKTREES = [
  {
    env: "SPECIES_MEMSU_A2A_REPO",
    patterns: [/memsu-a2a-agent/i, /hermes[\\/ -]?memsu/i, /memsu\s+agent\s+repo/i],
    label: "memsu-a2a-agent repo",
  },
  {
    env: "SPECIES_MEMSUOS_REPO",
    patterns: [/memsuos/i],
    label: "memsuOS repo",
  },
  {
    env: "SPECIES_MEMSU_REPO",
    patterns: [/memsu\s+repo/i, /memsu\s+project/i, /memsu\s+项目/i, /memsu\s+仓库/i],
    label: "memSu repo",
  },
  {
    env: "SPECIES_TENDRIL_REPO",
    patterns: [/tendrilflow/i, /\btendril\b/i],
    label: "TendrilFlow repo",
  },
] as const;

export const DEFAULT_AGENT_CAPABILITY_CARDS: RuntimeCapabilityCard[] = [
  {
    capabilityId: "local.filesystem.read",
    label: "Read approved local files",
    scope: "agent_workspace",
    visibility: "private_agent",
    operations: [
      { operation: "read_file", approval: "none", summary: "Read a bounded text file sample." },
      { operation: "list_dir", approval: "none", summary: "List directory entries without file mutation." },
      { operation: "search_files", approval: "none", summary: "Search names and bounded text samples." },
    ],
    boundaryNote:
      "Read-only access defaults to the runtime workspace and configured roots; result is private_agent context and may enter an external provider prompt.",
  },
  {
    capabilityId: "local.filesystem.write",
    label: "Write local files",
    scope: "agent_workspace",
    visibility: "private_agent",
    operations: [
      { operation: "write_file", approval: "required", sideEffectKind: "filesystem.write", summary: "Request file write approval." },
      { operation: "delete_file", approval: "required", sideEffectKind: "filesystem.delete", summary: "Request file delete approval." },
    ],
    boundaryNote: "Filesystem writes/deletes are side effects and always become approval-gated requests.",
  },
  {
    capabilityId: "local.yolo_space",
    label: "Run in a pre-authorized YOLO space",
    scope: "yolo_space",
    visibility: "private_agent",
    operations: [
      { operation: "list_spaces", approval: "none", summary: "List YOLO spaces available to this agent." },
      { operation: "exec", approval: "none", summary: "Run a command without per-action approval in a configured YOLO space." },
      {
        operation: "write_file",
        approval: "none",
        summary: "Write and byte-verify exact UTF-8 content inside a configured YOLO space.",
      },
    ],
    boundaryNote:
      "Only explicitly enabled and registered roots are eligible. Commands and verified file writes are path-guarded and audited, but this trusted YOLO grant is not an OS sandbox.",
  },
  {
    capabilityId: "local.browser.read",
    label: "Read a local browser URL",
    scope: "local_runtime",
    visibility: "private_agent",
    operations: [
      { operation: "fetch_url", approval: "none", summary: "Read a bounded response from localhost/loopback HTTP(S)." },
    ],
    boundaryNote:
      "No-approval browser reads are limited to localhost/loopback URLs; broader browser/network work must use an approval-gated capability.",
  },
  {
    capabilityId: "web.search.read",
    label: "Search the web",
    scope: "network",
    visibility: "private_agent",
    operations: [{ operation: "search", approval: "none", summary: "Run a bounded read-only web search through the runtime broker." }],
    boundaryNote:
      "Read-only network search is brokered by the runtime; agents receive bounded untrusted URLs/snippets as private_agent context and never get raw shell, browser, or provider credentials.",
  },
  {
    capabilityId: "local.browser.control",
    label: "Control browser",
    scope: "local_runtime",
    visibility: "private_agent",
    operations: [
      { operation: "open_url", approval: "required", sideEffectKind: "network.request", summary: "Request browser navigation." },
      { operation: "click", approval: "required", sideEffectKind: "external_api.call", summary: "Request browser click/control." },
      { operation: "type", approval: "required", sideEffectKind: "external_api.call", summary: "Request browser typing/control." },
    ],
    boundaryNote: "Browser control can change external page or local session state and requires approval.",
  },
  {
    capabilityId: "local.shell.exec",
    label: "Run shell command",
    scope: "local_runtime",
    visibility: "private_agent",
    operations: [{ operation: "exec", approval: "required", sideEffectKind: "shell.exec", summary: "Request shell execution." }],
    boundaryNote: "Shell execution is a side effect and always requires approval.",
  },
  {
    capabilityId: "local.memsu.read",
    label: "Read memSu home",
    scope: "memsu_home",
    visibility: "private_agent",
    operations: [
      { operation: "list_home", approval: "none", summary: "List the configured memSu home." },
      { operation: "read_note", approval: "none", summary: "Read a bounded note under memSu home." },
      { operation: "search_memory", approval: "none", summary: "Search bounded text under memSu home." },
    ],
    boundaryNote:
      "Read-only memSu access is disabled by default and requires explicit runtime opt-in; result is private_agent context and may enter an external provider prompt.",
  },
  {
    capabilityId: "local.memsu.write",
    label: "Write memSu state",
    scope: "memsu_home",
    visibility: "private_agent",
    operations: [
      { operation: "record_delta", approval: "required", sideEffectKind: "external_api.call", summary: "Request memSu delta recording." },
      { operation: "import_context", approval: "required", sideEffectKind: "external_api.call", summary: "Request memSu context import." },
      { operation: "advance_agenda", approval: "required", sideEffectKind: "external_api.call", summary: "Request memSu agenda advance." },
    ],
    boundaryNote: "memSu mutations are side effects and require approval.",
  },
  {
    capabilityId: "local.git.read",
    label: "Read git worktree",
    scope: "git_worktree",
    visibility: "private_agent",
    operations: [
      { operation: "status", approval: "none", summary: "Run git status --short --branch." },
      { operation: "diff", approval: "none", summary: "Run a bounded git diff." },
      { operation: "log", approval: "none", summary: "Run a bounded git log." },
      { operation: "show", approval: "none", summary: "Run a bounded git show." },
    ],
    boundaryNote:
      "Read-only git operations are limited to the runtime workspace or explicitly configured repositories and do not mutate the worktree.",
  },
  {
    capabilityId: "local.git.write",
    label: "Mutate git worktree or remote",
    scope: "git_worktree",
    visibility: "private_agent",
    operations: [
      { operation: "commit", approval: "required", sideEffectKind: "git.commit", summary: "Request git commit approval." },
      { operation: "push", approval: "required", sideEffectKind: "git.push", summary: "Request git push approval." },
    ],
    boundaryNote: "Git commit/push mutate repository state or remote state and require approval.",
  },
];

const CAPABILITY_CARDS_BY_ID = new Map(DEFAULT_AGENT_CAPABILITY_CARDS.map((card) => [card.capabilityId, card]));

export function defaultAgentCapabilityCards(): RuntimeCapabilityCard[] {
  return DEFAULT_AGENT_CAPABILITY_CARDS.map((card) => ({
    ...card,
    operations: card.operations.map((operation) => ({ ...operation })),
  }));
}

export function isKnownCapabilityOperation(capabilityId: string, operation: string): boolean {
  return Boolean(findCapabilityOperation(capabilityId, operation));
}

export function capabilitySideEffectKind(capabilityId: string, operation: string): SideEffectKind | undefined {
  return findCapabilityOperation(capabilityId, operation)?.sideEffectKind;
}

export async function executeAgentCapability(
  request: AgentCapabilityUseRequest,
  options: CapabilityExecutorOptions = {},
): Promise<AgentCapabilityOutcome> {
  const operation = findCapabilityOperation(request.capabilityId, request.operation);
  if (!operation) {
    const result = failedCapabilityResult(request, `unknown capability operation ${request.capabilityId}:${request.operation}`, options);
    return { kind: "private_result", result, fragment: capabilityResultFragment(request, result) };
  }

  if (operation.approval === "required") {
    const result = approvalRequiredCapabilityResult(request, operation, options);
    return {
      kind: "side_effect_request",
      result,
      sideEffect: {
        kind: operation.sideEffectKind ?? "external_api.call",
        target: capabilityTarget(request),
        expectedImpact: sideEffectExpectedImpact(request, operation),
        proposedCommand: capabilityProposedCommand(request),
      },
    };
  }

  const result = await maybeOffloadCapabilityResult(request, await executeApprovalFreeCapability(request, options), options);
  return { kind: "private_result", result, fragment: capabilityResultFragment(request, result) };
}

export function failedAgentCapabilityOutcome(
  request: AgentCapabilityUseRequest,
  error: string,
  options: CapabilityExecutorOptions = {},
): AgentCapabilityOutcome {
  const result = failedCapabilityResult(request, error, options);
  return { kind: "private_result", result, fragment: capabilityResultFragment(request, result) };
}

export function capabilityUseInputFromObject(value: unknown): CapabilityUseInput {
  const object = isRecord(value) ? value : {};
  const content =
    capabilityContentString(object.content) ??
    capabilityContentString(object.body) ??
    capabilityContentString(object.fileContent) ??
    capabilityContentString(object.file_content);
  return {
    path:
      boundedString(object.path) ??
      boundedString(object.url) ??
      boundedString(object.target) ??
      boundedString(object.file) ??
      boundedString(object.filePath) ??
      boundedString(object.file_path),
    root:
      boundedString(object.root) ??
      boundedString(object.cwd) ??
      boundedString(object.worktree) ??
      boundedString(object.home),
    query:
      capabilityQueryString(object.query) ??
      capabilityQueryString(object.q) ??
      capabilityQueryString(object.searchQuery) ??
      capabilityQueryString(object.search_query) ??
      capabilityQueryString(object.command) ??
      capabilityQueryString(object.ref) ??
      capabilityQueryString(object.pattern) ??
      capabilityQueryString(object.text) ??
      capabilityQueryString(object.keyword) ??
      capabilityQueryString(object.keywords) ??
      capabilityQueryString(object.terms),
    glob: boundedString(object.glob),
    ...(content !== undefined ? { content } : {}),
  };
}

export function capabilityUseIntentionFromDecoded(
  decoded: Record<string, unknown>,
  contextRefs: RefId[],
): CapabilityUseIntention | undefined {
  const requestedCapabilityId =
    boundedString(decoded.capabilityId) ??
    boundedString(decoded.capability_id) ??
    boundedString(decoded.capability) ??
    boundedString(decoded.tool) ??
    boundedString(decoded.toolName) ??
    boundedString(decoded.tool_name) ??
    boundedString(decoded.name);
  const requestedOperation =
    boundedString(decoded.operation) ??
    boundedString(decoded.op) ??
    boundedString(decoded.action) ??
    boundedString(decoded.intent);
  const input = mergedCapabilityUseInput(capabilityUseInputFromObject(decoded.input), capabilityUseInputFromDecodedFields(decoded));
  const capabilityId = normalizeCapabilityId(requestedCapabilityId, requestedOperation, input);
  const operation = capabilityId ? normalizeCapabilityOperation(capabilityId, requestedOperation, input) : undefined;
  if (!capabilityId || !operation || !isKnownCapabilityOperation(capabilityId, operation) || !hasMinimumCapabilityInput(capabilityId, operation, input)) {
    return undefined;
  }
  const reason = boundedString(decoded.reason, 700) ?? synthesizedCapabilityReason(capabilityId, operation);
  return {
    kind: "use_capability",
    capabilityId,
    operation,
    input,
    reason,
    contextRefs,
  };
}

export function capabilityUseInputFromDecodedFields(decoded: Record<string, unknown>): CapabilityUseInput {
  const content =
    capabilityContentString(decoded.content) ??
    capabilityContentString(decoded.body) ??
    capabilityContentString(decoded.fileContent) ??
    capabilityContentString(decoded.file_content);
  return {
    path:
      boundedString(decoded.path) ??
      boundedString(decoded.url) ??
      boundedString(decoded.target) ??
      boundedString(decoded.file) ??
      boundedString(decoded.filePath) ??
      boundedString(decoded.file_path),
    root:
      boundedString(decoded.root) ??
      boundedString(decoded.cwd) ??
      boundedString(decoded.worktree) ??
      boundedString(decoded.home),
    query:
      capabilityQueryString(decoded.query) ??
      capabilityQueryString(decoded.q) ??
      capabilityQueryString(decoded.searchQuery) ??
      capabilityQueryString(decoded.search_query) ??
      capabilityQueryString(decoded.command) ??
      capabilityQueryString(decoded.ref) ??
      capabilityQueryString(decoded.pattern) ??
      capabilityQueryString(decoded.text) ??
      capabilityQueryString(decoded.keyword) ??
      capabilityQueryString(decoded.keywords) ??
      capabilityQueryString(decoded.terms),
    glob: boundedString(decoded.glob),
    ...(content !== undefined ? { content } : {}),
  };
}

function mergedCapabilityUseInput(primary: CapabilityUseInput, fallback: CapabilityUseInput): CapabilityUseInput {
  const content = primary.content ?? fallback.content;
  return {
    path: primary.path ?? fallback.path,
    root: primary.root ?? fallback.root,
    query: primary.query ?? fallback.query,
    glob: primary.glob ?? fallback.glob,
    ...(content !== undefined ? { content } : {}),
  };
}

function normalizeCapabilityId(
  rawCapabilityId: string | undefined,
  rawOperation: string | undefined,
  input: CapabilityUseInput,
): string | undefined {
  if (!rawCapabilityId) {
    return undefined;
  }
  if (CAPABILITY_CARDS_BY_ID.has(rawCapabilityId)) {
    return rawCapabilityId;
  }
  const capability = normalizedCapabilityToken(rawCapabilityId);
  if (CAPABILITY_CARDS_BY_ID.has(capability)) {
    return capability;
  }
  const operation = normalizedOperationToken(rawOperation);

  if (["memsu", "memsu.read", "local.memsu", "local.memsu.search", "local.memsu.memory"].includes(capability)) {
    return isMemsuWriteOperation(operation) ? "local.memsu.write" : "local.memsu.read";
  }
  if (["memsu.write", "local.memsu.write"].includes(capability)) {
    return "local.memsu.write";
  }
  if (["filesystem", "filesystem.read", "file", "files", "file.read", "local.filesystem"].includes(capability)) {
    return isFilesystemWriteOperation(operation) ? "local.filesystem.write" : "local.filesystem.read";
  }
  if (["filesystem.write", "file.write", "files.write", "local.filesystem.write"].includes(capability)) {
    return "local.filesystem.write";
  }
  if (["web.search", "web.search.read", "search", "internet", "internet.search", "network.search"].includes(capability)) {
    return "web.search.read";
  }
  if (["browser", "browser.read", "local.browser", "web", "web.read"].includes(capability)) {
    if (isWebSearchOperation(operation) || (!operation && input.query && !input.path && !input.root)) {
      return "web.search.read";
    }
    return isBrowserControlOperation(operation) ? "local.browser.control" : "local.browser.read";
  }
  if (["browser.control", "web.control", "local.browser.control"].includes(capability)) {
    return "local.browser.control";
  }
  if (["shell", "shell.exec", "terminal", "terminal.exec", "local.shell"].includes(capability)) {
    return "local.shell.exec";
  }
  if (["yolo", "yolo.space", "yolospace", "local.yolo", "local.yolo.space"].includes(capability)) {
    return "local.yolo_space";
  }
  if (["git", "git.read", "local.git"].includes(capability)) {
    return isGitWriteOperation(operation) ? "local.git.write" : "local.git.read";
  }
  if (["git.write", "local.git.write"].includes(capability)) {
    return "local.git.write";
  }

  return undefined;
}

function normalizeCapabilityOperation(
  capabilityId: string,
  rawOperation: string | undefined,
  input: CapabilityUseInput,
): string | undefined {
  const operation = normalizedOperationToken(rawOperation);
  if (operation && isKnownCapabilityOperation(capabilityId, operation)) {
    return operation;
  }

  if (capabilityId === "local.filesystem.read") {
    if (["read", "readfile", "open", "cat", "view"].includes(operation)) return "read_file";
    if (["list", "ls", "dir", "directory", "listdir"].includes(operation)) return "list_dir";
    if (["search", "find", "grep", "lookup"].includes(operation)) return "search_files";
    if (!operation) {
      if (input.query) return "search_files";
      if (input.path) return "read_file";
      if (input.root) return "list_dir";
    }
  }

  if (capabilityId === "local.filesystem.write") {
    if (["write", "writefile", "save", "create", "update"].includes(operation)) return "write_file";
    if (["delete", "remove", "rm", "unlink"].includes(operation)) return "delete_file";
  }

  if (capabilityId === "local.browser.read") {
    if (["fetch", "fetchurl", "read", "open", "get", "url", "navigate"].includes(operation) || (!operation && (input.path || input.root))) {
      return "fetch_url";
    }
  }

  if (capabilityId === "web.search.read") {
    if (isWebSearchOperation(operation) || (!operation && input.query)) {
      return "search";
    }
  }

  if (capabilityId === "local.browser.control") {
    if (["open", "openurl", "navigate", "goto"].includes(operation)) return "open_url";
    if (operation === "click") return "click";
    if (["type", "input", "fill"].includes(operation)) return "type";
  }

  if (capabilityId === "local.shell.exec") {
    if (["exec", "run", "shell", "command", "cmd", "powershell"].includes(operation) || (!operation && (input.query || input.path))) {
      return "exec";
    }
  }

  if (capabilityId === "local.yolo_space") {
    if (["list", "spaces", "listspaces", "list_spaces"].includes(operation) || (!operation && !input.query && !input.path)) {
      return "list_spaces";
    }
    if (
      ["write", "writefile", "write_file", "save", "create", "update"].includes(operation) ||
      (!operation && Boolean(input.path) && input.content !== undefined)
    ) {
      return "write_file";
    }
    if (["exec", "run", "shell", "command", "cmd", "powershell"].includes(operation) || (!operation && (input.query || input.path))) {
      return "exec";
    }
  }

  if (capabilityId === "local.memsu.read") {
    if (["list", "home", "listhome", "listdir"].includes(operation)) return "list_home";
    if (["readnote", "note", "file"].includes(operation)) return "read_note";
    if (operation === "read") return input.path ? "read_note" : "search_memory";
    if (["search", "find", "query", "lookup", "memory", "recent", "recentactivity", "today"].includes(operation)) {
      return "search_memory";
    }
    if (!operation) {
      if (input.path) return "read_note";
      if (input.query) return "search_memory";
      return "list_home";
    }
  }

  if (capabilityId === "local.memsu.write") {
    if (["record", "recorddelta", "delta", "remember", "write"].includes(operation)) return "record_delta";
    if (["import", "importcontext"].includes(operation)) return "import_context";
    if (["advance", "agenda", "advanceagenda"].includes(operation)) return "advance_agenda";
  }

  if (capabilityId === "local.git.read") {
    if (["status", "state"].includes(operation) || !operation) return "status";
    if (["diff", "changes"].includes(operation)) return "diff";
    if (["log", "history"].includes(operation)) return "log";
    if (["show", "inspect"].includes(operation)) return "show";
  }

  if (capabilityId === "local.git.write") {
    if (operation === "commit") return "commit";
    if (operation === "push") return "push";
  }

  return undefined;
}

function hasMinimumCapabilityInput(capabilityId: string, operation: string, input: CapabilityUseInput): boolean {
  if (capabilityId === "local.filesystem.read") {
    if (operation === "read_file") return Boolean(input.path);
    if (operation === "search_files") return Boolean(input.query || input.glob);
  }
  if (capabilityId === "local.browser.read" && operation === "fetch_url") {
    return Boolean(input.path || input.root);
  }

  if (capabilityId === "web.search.read" && operation === "search") {
    return Boolean(input.query);
  }
  if (capabilityId === "local.shell.exec" && operation === "exec") {
    return Boolean(input.query || input.path);
  }
  if (capabilityId === "local.yolo_space" && operation === "exec") {
    return Boolean(input.query || input.path);
  }
  if (capabilityId === "local.yolo_space" && operation === "write_file") {
    return Boolean(input.path) && (input.content !== undefined || input.query !== undefined);
  }
  if (capabilityId === "local.memsu.read") {
    if (operation === "read_note") return Boolean(input.path);
    if (operation === "search_memory") return Boolean(input.query || input.glob);
  }
  return true;
}

function synthesizedCapabilityReason(capabilityId: string, operation: string): string {
  return `Need private ${capabilityId}:${operation} context before replying.`;
}

function normalizedCapabilityToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s:/-]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^capability\./, "")
    .replace(/\.$/, "");
}

function normalizedOperationToken(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s:/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^operation_/, "")
    .replace(/_$/g, "");
}

function compactOperationToken(value: string | undefined): string {
  return normalizedOperationToken(value).replace(/_/g, "");
}

function isFilesystemWriteOperation(operation: string): boolean {
  const compact = compactOperationToken(operation);
  return ["write", "writefile", "save", "create", "update", "delete", "remove", "rm", "unlink", "deletefile"].includes(compact);
}

function isBrowserControlOperation(operation: string): boolean {
  const compact = compactOperationToken(operation);
  return ["openurl", "click", "type", "input", "fill", "control"].includes(compact);
}

function isWebSearchOperation(operation: string): boolean {
  const compact = compactOperationToken(operation);
  return ["search", "websearch", "internetsearch", "lookup", "query", "research", "find"].includes(compact);
}

function isMemsuWriteOperation(operation: string): boolean {
  const compact = compactOperationToken(operation);
  return ["record", "recorddelta", "delta", "remember", "write", "import", "importcontext", "advance", "agenda", "advanceagenda"].includes(
    compact,
  );
}

function isGitWriteOperation(operation: string): boolean {
  return ["commit", "push"].includes(normalizedOperationToken(operation));
}

async function executeApprovalFreeCapability(
  request: AgentCapabilityUseRequest,
  options: CapabilityExecutorOptions,
): Promise<CapabilityExecutionResult> {
  if (request.capabilityId === "local.filesystem.read") {
    return executeLocalFilesystemRead(toFilesystemRequest(request), options);
  }
  if (request.capabilityId === "local.browser.read" && request.operation === "fetch_url") {
    return readLocalBrowserUrl(request, options);
  }
  if (request.capabilityId === "web.search.read" && request.operation === "search") {
    return executeWebSearchRead(toFilesystemRequest(request), options);
  }
  if (request.capabilityId === "local.memsu.read") {
    return readMemsuHome(request, options);
  }
  if (request.capabilityId === "local.git.read") {
    return readGitWorktree(request, options);
  }
  if (request.capabilityId === "local.yolo_space") {
    return executeYoloSpaceCapability(toFilesystemRequest(request), options);
  }
  return failedCapabilityResult(request, `capability has no approval-free executor: ${request.capabilityId}`, options);
}

function toFilesystemRequest(request: AgentCapabilityUseRequest): CapabilityExecutionInput {
  return {
    roomId: request.roomId,
    agentId: request.agentId,
    topicId: request.topicId,
    invocationId: request.invocationId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    input: request.input,
    reason: request.reason,
    contextRefs: request.contextRefs,
  };
}

async function readLocalBrowserUrl(
  request: AgentCapabilityUseRequest,
  options: CapabilityExecutorOptions,
): Promise<CapabilityExecutionResult> {
  const rawUrl = request.input.path ?? request.input.root;
  if (!rawUrl) {
    return failedCapabilityResult(request, "fetch_url requires input.path URL", options);
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return failedCapabilityResult(request, `invalid URL: ${rawUrl}`, options);
  }
  if (!isLocalHttpUrl(url)) {
    return failedCapabilityResult(request, "local.browser.read without approval is limited to localhost/loopback HTTP(S) URLs", options);
  }

  try {
    const fetched = await fetchBoundedUrl(url, positiveInteger(options.maxBytes, DEFAULT_BROWSER_MAX_BYTES));
    return {
      invocationId: request.invocationId,
      capabilityId: request.capabilityId,
      operation: request.operation,
      status: "completed",
      visibility: "private_agent",
      summary: `Read ${fetched.bytesRead} bytes from ${url.toString()}.`,
      output: {
        kind: "browser_read",
        url: url.toString(),
        statusCode: fetched.statusCode,
        contentType: fetched.contentType,
        bytesRead: fetched.bytesRead,
        truncated: fetched.truncated,
        content: fetched.content,
      },
      boundary: localFilesystemReadBoundary(options),
    };
  } catch (error) {
    return failedCapabilityResult(request, error instanceof Error ? error.message : String(error), options);
  }
}

async function readMemsuHome(
  request: AgentCapabilityUseRequest,
  options: CapabilityExecutorOptions,
): Promise<CapabilityExecutionResult> {
  if (!options.enableMemsuRead) {
    return failedCapabilityResult(
      request,
      "memSu reads are disabled; set SPECIES_ENABLE_MEMSU_READ=1 and configure SPECIES_MEMSU_HOME or MEMSU_HOME",
      options,
    );
  }
  const base = options.cwd ?? process.cwd();
  const configuredHome = path.resolve(base, options.memsuHome ?? defaultMemsuHome());
  const home = request.input.root ? path.resolve(base, request.input.root) : configuredHome;
  const input =
    request.operation === "list_home"
      ? { path: home }
      : request.operation === "read_note"
        ? { root: home, path: request.input.path }
        : { root: home, query: request.input.query, glob: request.input.glob };
  const operation =
    request.operation === "list_home" ? "list_dir" : request.operation === "read_note" ? "read_file" : "search_files";
  const result = await executeLocalFilesystemRead(
    {
      ...toFilesystemRequest(request),
      capabilityId: "local.filesystem.read",
      operation,
      input,
    },
    {
      ...options,
      allowedReadRoots: [configuredHome],
      allowAllDeviceRead: false,
    },
  );
  return {
    ...result,
    capabilityId: request.capabilityId,
    operation: request.operation,
    summary: `memSu ${request.operation}: ${result.summary}`,
    output: {
      kind: "memsu_read",
      memsuHome: home,
      delegatedOperation: operation,
      result: result.output,
    },
  };
}

async function readGitWorktree(
  request: AgentCapabilityUseRequest,
  options: CapabilityExecutorOptions,
): Promise<CapabilityExecutionResult> {
  const rootResolution = resolveGitWorktreeRoot(request, options);
  const explicitlyConfigured = rootResolution.source.startsWith("SPECIES_");
  let cwd: string;
  try {
    cwd = await authorizeLocalReadPath(rootResolution.cwd, {
      ...options,
      allowedReadRoots: explicitlyConfigured
        ? [...(options.allowedReadRoots ?? [options.cwd ?? process.cwd()]), rootResolution.cwd]
        : options.allowedReadRoots,
    });
  } catch (error) {
    return failedCapabilityResult(request, error instanceof Error ? error.message : String(error), options);
  }
  const args = gitReadArgs(request);
  if (!args) {
    return failedCapabilityResult(request, `unsupported git read operation: ${request.operation}`, options);
  }
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      windowsHide: true,
      maxBuffer: Math.max(positiveInteger(options.maxBytes, DEFAULT_MAX_BYTES) * 2, DEFAULT_MAX_BYTES),
    });
    const combined = [stdout, stderr].filter((part) => part.trim().length > 0).join("\n");
    const maxBytes = positiveInteger(options.maxBytes, DEFAULT_MAX_BYTES);
    const output = Buffer.from(combined, "utf8").subarray(0, maxBytes).toString("utf8");
    return {
      invocationId: request.invocationId,
      capabilityId: request.capabilityId,
      operation: request.operation,
      status: "completed",
      visibility: "private_agent",
      summary: `Ran git ${args.join(" ")} in ${cwd}.`,
      output: {
        kind: "git_read",
        cwd,
        rootResolution,
        args,
        output,
        truncated: Buffer.byteLength(combined, "utf8") > maxBytes,
      },
      boundary: localFilesystemReadBoundary(options),
    };
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);
    return failedCapabilityResult(request, message, options);
  }
}

function resolveGitWorktreeRoot(
  request: AgentCapabilityUseRequest,
  options: CapabilityExecutorOptions,
): { cwd: string; source: string; matchedText?: string; label?: string } {
  const base = options.cwd ?? process.cwd();
  if (request.input.root) {
    return { cwd: path.resolve(base, request.input.root), source: "input.root" };
  }

  const combinedText = [request.reason, request.input.query, request.input.path, request.input.glob]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
  const explicitPath = firstExistingAbsolutePath(combinedText);
  if (explicitPath) {
    return { cwd: explicitPath, source: "mentioned.absolute_path", matchedText: explicitPath };
  }

  for (const worktree of KNOWN_GIT_WORKTREES) {
    if (!worktree.patterns.some((pattern) => pattern.test(combinedText))) {
      continue;
    }
    const cwd = configuredWorktreePath(worktree.env);
    if (!cwd) {
      continue;
    }
    return { cwd, source: worktree.env, label: worktree.label };
  }

  return { cwd: base, source: "runtime.cwd" };
}

function configuredWorktreePath(envName: string): string | undefined {
  const configured = process.env[envName]?.trim();
  return configured && configured.length > 0 ? path.resolve(configured) : undefined;
}

function firstExistingAbsolutePath(text: string): string | undefined {
  for (const candidate of absolutePathCandidates(text)) {
    const resolved = path.resolve(candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }
  return undefined;
}

function absolutePathCandidates(text: string): string[] {
  const candidates = new Set<string>();
  for (const match of text.matchAll(/[A-Za-z]:[\\/][^"'`\r\n，。；;]+/g)) {
    candidates.add(cleanMentionedPath(match[0]));
  }
  for (const match of text.matchAll(/(?:^|[\s"'`(])\/[A-Za-z0-9._~\-\/]+/g)) {
    candidates.add(cleanMentionedPath(match[0].trim().replace(/^["'`(]+/, "")));
  }
  return [...candidates].filter((candidate) => candidate.length > 0);
}

function cleanMentionedPath(value: string): string {
  const trimmed = value.trim();
  let end = trimmed.length;
  while (end > 0 && ")]}>,，。；;:".includes(trimmed[end - 1] ?? "")) {
    end -= 1;
  }
  return trimmed.slice(0, end).replaceAll("\\", path.sep).replaceAll("/", path.sep);
}

function gitReadArgs(request: AgentCapabilityUseRequest): string[] | undefined {
  const maybePath = request.input.path ? ["--", request.input.path] : [];
  if (request.operation === "status") {
    return ["status", "--short", "--branch"];
  }
  if (request.operation === "diff") {
    return ["diff", "--no-ext-diff", ...maybePath];
  }
  if (request.operation === "log") {
    return ["log", "--oneline", "-n", "20", ...gitLogQueryArgs(request.input.query), ...maybePath];
  }
  if (request.operation === "show") {
    return ["show", "--stat", "--oneline", "--decorate", request.input.query ?? "HEAD"];
  }
  return undefined;
}

function gitLogQueryArgs(query: string | undefined): string[] {
  const tokens = gitReadQueryTokens(query).filter((token) => !["git", "log", "--oneline"].includes(token));
  const allowed = tokens.filter(isSafeGitLogQueryArg);
  return allowed.length > 0 ? allowed : ["HEAD"];
}

function gitReadQueryTokens(query: string | undefined): string[] {
  if (!query?.trim()) {
    return [];
  }
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function isSafeGitLogQueryArg(token: string): boolean {
  if (/^--(?:since|after|until|before|author|committer|grep|max-count)=.+/.test(token)) {
    return true;
  }
  if (/^-n$/.test(token) || /^[1-9][0-9]{0,2}$/.test(token)) {
    return true;
  }
  if (isSafeGitRevision(token)) {
    return true;
  }
  return false;
}

function isSafeGitRevision(token: string): boolean {
  if (token.startsWith("--")) {
    return false;
  }
  const revisions = token.split("..");
  return revisions.length <= 2 && revisions.every((revision) => revision.length > 0 && [...revision].every(isGitRevisionCharacter));
}

function isGitRevisionCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    "._/@{}~^:+-".includes(character)
  );
}

function findCapabilityOperation(
  capabilityId: string,
  operation: string,
): RuntimeCapabilityOperationCard | undefined {
  return CAPABILITY_CARDS_BY_ID.get(capabilityId)?.operations.find((item) => item.operation === operation);
}

function capabilityResultFragment(request: AgentCapabilityUseRequest, result: CapabilityExecutionResult): ContextFragment {
  const body = JSON.stringify({
    invocationId: request.invocationId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    reason: request.reason,
    status: result.status,
    summary: result.summary,
    output: result.output,
    boundary: result.boundary,
    warning: result.boundary.providerPromptWarning,
  });
  return {
    id: `fragment_${request.invocationId}_result`,
    type: "capability_result",
    visibility: "private_agent",
    role: "runtime",
    source: { kind: "runtime" },
    refs: uniqueRefs([request.invocationId, ...request.contextRefs]),
    tokenEstimate: tokenEstimate(body),
    hardCap: Math.max(1_000, positiveInteger(result.boundary.maxBytes, DEFAULT_MAX_BYTES)),
    cacheKey: `capability_result:${request.invocationId}:${result.status}`,
    priority: 96,
    body,
  };
}

async function maybeOffloadCapabilityResult(
  request: AgentCapabilityUseRequest,
  result: CapabilityExecutionResult,
  options: CapabilityExecutorOptions,
): Promise<CapabilityExecutionResult> {
  if (result.status !== "completed" || result.output.kind === "capability_output_artifact") {
    return result;
  }
  const serializedOutput = JSON.stringify(result.output);
  const outputBytes = Buffer.byteLength(serializedOutput, "utf8");
  const threshold = positiveInteger(options.offloadThresholdBytes, DEFAULT_OFFLOAD_THRESHOLD_BYTES);
  if (outputBytes <= threshold) {
    return result;
  }

  const digest = createHash("sha256").update(serializedOutput).digest("hex").slice(0, 12);
  const artifactId = `capability_artifact_${request.invocationId}_${digest}`;
  const artifactRoot = path.resolve(
    options.artifactRoot ?? path.join(options.cwd ?? process.cwd(), ".species", "capability-artifacts", request.agentId),
  );
  const artifactPath = path.join(artifactRoot, `${artifactId}.json`);
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(
    artifactPath,
    JSON.stringify(
      {
        artifactId,
        roomId: request.roomId,
        agentId: request.agentId,
        topicId: request.topicId,
        invocationId: request.invocationId,
        capabilityId: request.capabilityId,
        operation: request.operation,
        reason: request.reason,
        summary: result.summary,
        visibility: "private_agent",
        output: result.output,
        boundaryNote:
          "Private capability artifact contains the full result. It is not public room memory and must be shared only through an explicit artifact ref or proposal.",
      },
      null,
      2,
    ),
    "utf8",
  );

  const originalOutputKind = boundedString(result.output.kind, 120) ?? "unknown";
  return {
    ...result,
    summary: `${result.summary} Full output was offloaded to private capability artifact ${artifactId}.`,
    output: {
      kind: "capability_output_artifact",
      artifactId,
      artifactPath,
      originalOutputKind,
      contentBytes: outputBytes,
      preview: previewSerializedOutput(serializedOutput),
      loadAffordance:
        "The same agent may request local.filesystem.read on artifactPath to inspect the full private result; public sharing still requires an explicit workspace artifact ref or memory proposal.",
      boundaryNote:
        "Full output stayed out of the provider-facing result fragment. The room sees only the private artifact ref, summary, preview, and boundary.",
    },
  };
}

function previewSerializedOutput(serializedOutput: string): string {
  return serializedOutput.length <= MAX_ARTIFACT_PREVIEW_CHARS
    ? serializedOutput
    : `${serializedOutput.slice(0, MAX_ARTIFACT_PREVIEW_CHARS - 15)}... [truncated]`;
}

function approvalRequiredCapabilityResult(
  request: AgentCapabilityUseRequest,
  operation: RuntimeCapabilityOperationCard,
  options: CapabilityExecutorOptions,
): CapabilityExecutionResult {
  return {
    invocationId: request.invocationId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    status: "approval_required",
    visibility: "private_agent",
    summary: `${request.capabilityId}:${request.operation} requires side-effect approval.`,
    output: {
      kind: "approval_required",
      sideEffectKind: operation.sideEffectKind ?? "external_api.call",
      target: capabilityTarget(request),
      proposedCommand: capabilityProposedCommand(request),
    },
    boundary: localFilesystemReadBoundary(options),
  };
}

function failedCapabilityResult(
  request: AgentCapabilityUseRequest,
  error: string,
  options: CapabilityExecutorOptions,
): CapabilityExecutionResult {
  return {
    invocationId: request.invocationId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    status: "failed",
    visibility: "private_agent",
    summary: `${request.capabilityId}:${request.operation} failed: ${error}`,
    output: { kind: "error", error },
    error,
    boundary: localFilesystemReadBoundary(options),
  };
}

function capabilityTarget(request: AgentCapabilityUseRequest): string {
  return (
    request.input.path ??
    request.input.root ??
    request.input.query ??
    request.input.glob ??
    `${request.capabilityId}:${request.operation}`
  );
}

function capabilityProposedCommand(request: AgentCapabilityUseRequest): string | undefined {
  if (request.capabilityId === "local.shell.exec") {
    return request.input.query ?? request.input.path;
  }
  if (request.capabilityId.startsWith("local.git.")) {
    return `git ${request.operation}${request.input.query ? ` ${request.input.query}` : ""}`;
  }
  if (request.capabilityId.startsWith("local.memsu.")) {
    return `memsu ${request.operation}`;
  }
  if (request.capabilityId.startsWith("local.browser.")) {
    return `browser ${request.operation} ${capabilityTarget(request)}`;
  }
  return undefined;
}

function sideEffectExpectedImpact(
  request: AgentCapabilityUseRequest,
  operation: RuntimeCapabilityOperationCard,
): string {
  return `${operation.summary} Requested by ${request.agentId} because: ${request.reason}`;
}

function defaultMemsuHome(): string {
  return process.env.SPECIES_MEMSU_HOME?.trim() || process.env.MEMSU_HOME?.trim() || path.join(os.homedir(), ".memsu");
}

function isLocalHttpUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function fetchBoundedUrl(
  url: URL,
  maxBytes: number,
): Promise<{ statusCode?: number; contentType?: string; bytesRead: number; truncated: boolean; content: string }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(url, { timeout: 5_000 }, (response) => {
      const chunks: Buffer[] = [];
      let bytesRead = 0;
      let truncated = false;
      response.on("data", (chunk: Buffer) => {
        if (bytesRead >= maxBytes) {
          truncated = true;
          return;
        }
        const remaining = maxBytes - bytesRead;
        const piece = chunk.subarray(0, remaining);
        chunks.push(piece);
        bytesRead += piece.length;
        if (piece.length < chunk.length) {
          truncated = true;
        }
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode,
          contentType: headerString(response.headers["content-type"]),
          bytesRead,
          truncated,
          content: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error(`timed out reading ${url.toString()}`));
    });
    request.on("error", reject);
  });
}

function headerString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(", ") : value;
}

function boundedString(value: unknown, maxLength = 1_000): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 3)}...`;
}

function capabilityQueryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function capabilityContentString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function tokenEstimate(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function uniqueRefs(refs: readonly unknown[]): RefId[] {
  return [
    ...new Set(
      refs
        .filter((ref): ref is string => typeof ref === "string")
        .map((ref) => ref.trim())
        .filter((ref) => ref.length > 0),
    ),
  ];
}
