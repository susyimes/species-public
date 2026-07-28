import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { AgentId } from "../types";
import type {
  CapabilityExecutionBoundary,
  CapabilityExecutionInput,
  CapabilityExecutionResult,
} from "./filesystemRead";

const execFileAsync = promisify(execFile);

export const DEFAULT_YOLO_SPACES_FILE = path.join(".species", "yolo-spaces.json");

export type YoloSpaceConfig = {
  id: string;
  label: string;
  root: string;
  repository?: string;
  enabled: boolean;
  allowedAgents: string[];
  commandTimeoutMs?: number;
  maxInputBytes?: number;
  maxOutputBytes?: number;
};

export type YoloSpaceRegistry = {
  version: 1;
  configPath: string;
  spaces: YoloSpaceConfig[];
  errors: string[];
};

export type YoloSpaceSummary = YoloSpaceConfig & {
  ready: boolean;
  status: "ready" | "disabled" | "missing";
  boundaryNote: string;
};

export type YoloSpaceExecutorOptions = {
  cwd?: string;
  maxBytes?: number;
  yoloEnabled?: boolean;
  yoloSpacesFile?: string;
  yoloSpaces?: readonly YoloSpaceConfig[];
  yoloCommandTimeoutMs?: number;
};

const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_INPUT_BYTES = 256 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

export function resolveYoloSpacesFile(options: Pick<YoloSpaceExecutorOptions, "cwd" | "yoloSpacesFile"> = {}): string {
  const configured = options.yoloSpacesFile ?? process.env.SPECIES_YOLO_SPACES_FILE ?? DEFAULT_YOLO_SPACES_FILE;
  return path.resolve(options.cwd ?? process.cwd(), configured);
}

export function loadYoloSpaceRegistry(
  options: Pick<YoloSpaceExecutorOptions, "cwd" | "yoloSpacesFile" | "yoloSpaces"> = {},
): YoloSpaceRegistry {
  const configPath = resolveYoloSpacesFile(options);
  if (options.yoloSpaces) {
    const normalized = normalizeSpaces(options.yoloSpaces, path.dirname(configPath));
    return { version: 1, configPath, spaces: normalized.spaces, errors: normalized.errors };
  }
  if (!existsSync(configPath)) {
    return { version: 1, configPath, spaces: [], errors: [] };
  }

  try {
    const decoded = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
    if (!isRecord(decoded) || !Array.isArray(decoded.spaces)) {
      return { version: 1, configPath, spaces: [], errors: ["registry must contain a spaces array"] };
    }
    const normalized = normalizeSpaces(decoded.spaces, path.dirname(configPath));
    return { version: 1, configPath, spaces: normalized.spaces, errors: normalized.errors };
  } catch (error) {
    return {
      version: 1,
      configPath,
      spaces: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function yoloSpaceSummaries(
  options: Pick<YoloSpaceExecutorOptions, "cwd" | "yoloEnabled" | "yoloSpacesFile" | "yoloSpaces"> = {},
): YoloSpaceSummary[] {
  const runtimeEnabled = yoloRuntimeEnabled(options);
  return loadYoloSpaceRegistry(options).spaces.map((space) => {
    const ready = runtimeEnabled && space.enabled && isDirectory(space.root);
    return {
      ...space,
      ready,
      status: !runtimeEnabled || !space.enabled ? "disabled" : ready ? "ready" : "missing",
      boundaryNote:
        "Pre-authorized YOLO execution requires explicit runtime opt-in. Commands run without per-action approval, and the cwd/path guard is not an OS sandbox.",
    };
  });
}

export async function executeYoloSpaceCapability(
  request: CapabilityExecutionInput,
  options: YoloSpaceExecutorOptions = {},
): Promise<CapabilityExecutionResult> {
  const registry = loadYoloSpaceRegistry(options);
  const boundary = yoloSpaceBoundary(options);
  if (request.capabilityId !== "local.yolo_space") {
    return failedResult(request, boundary, `unsupported capability: ${request.capabilityId}`);
  }
  if (!yoloRuntimeEnabled(options)) {
    return failedResult(request, boundary, "YOLO spaces are disabled; set SPECIES_ENABLE_YOLO=1 or enable them explicitly");
  }

  if (request.operation === "list_spaces") {
    const spaces = accessibleSpaces(registry.spaces, request.agentId).map((space) => ({
      ...space,
      ready: space.enabled && isDirectory(space.root),
    }));
    return completedResult(request, boundary, {
      kind: "yolo_space_list",
      configPath: registry.configPath,
      spaces,
      errors: registry.errors,
      summary: `Listed ${spaces.length} YOLO space(s) available to ${request.agentId}.`,
    });
  }

  if (request.operation !== "exec" && request.operation !== "write_file") {
    return failedResult(request, boundary, `unsupported YOLO space operation: ${request.operation}`);
  }

  const available = accessibleSpaces(registry.spaces, request.agentId).filter((space) => space.enabled);
  let space: YoloSpaceConfig;
  try {
    space = selectSpace(available, request.input.root);
  } catch (error) {
    return failedResult(request, boundary, error instanceof Error ? error.message : String(error));
  }
  if (!isDirectory(space.root)) {
    return failedResult(request, boundary, `YOLO space root is missing or not a directory: ${space.root}`);
  }

  const maxInputBytes = positiveInteger(space.maxInputBytes, DEFAULT_MAX_INPUT_BYTES);
  if (request.operation === "write_file") {
    return writeYoloSpaceFile(request, space, boundary, maxInputBytes);
  }

  const command = (request.input.query ?? (request.input.path && !request.input.query ? request.input.path : undefined))?.trim();
  if (!command) {
    return failedResult(request, boundary, "YOLO space exec requires input.query command");
  }
  const inputBytes = Buffer.byteLength(command, "utf8");
  if (inputBytes > maxInputBytes) {
    return failedResult(
      request,
      boundary,
      `YOLO command is ${inputBytes} bytes, exceeding the configured ${maxInputBytes}-byte input limit; use local.yolo_space:write_file for source content`,
    );
  }

  let commandCwd: string;
  try {
    commandCwd = resolveCommandCwd(space.root, request.input.query ? request.input.path : undefined);
    assertCommandUsesSpaceBoundary(command, space.root);
  } catch (error) {
    return failedResult(request, boundary, error instanceof Error ? error.message : String(error));
  }

  const maxOutputBytes = positiveInteger(space.maxOutputBytes ?? options.maxBytes, DEFAULT_MAX_OUTPUT_BYTES);
  const timeout = positiveInteger(space.commandTimeoutMs ?? options.yoloCommandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS);
  let shell: PreparedShellCommand | undefined;
  try {
    shell = await shellCommand(command);
    const { stdout, stderr } = await execFileAsync(shell.file, shell.args, {
      cwd: commandCwd,
      windowsHide: true,
      windowsVerbatimArguments: shell.windowsVerbatimArguments,
      timeout,
      maxBuffer: Math.max(maxOutputBytes * 2, DEFAULT_MAX_OUTPUT_BYTES),
      env: {
        ...process.env,
        SPECIES_YOLO_SPACE_ID: space.id,
        SPECIES_YOLO_SPACE_ROOT: space.root,
      },
    });
    const output = boundedCombinedOutput(stdout, stderr, maxOutputBytes);
    return completedResult(request, { ...boundary, maxBytes: maxOutputBytes }, {
      kind: "yolo_space_exec",
      spaceId: space.id,
      label: space.label,
      root: space.root,
      repository: space.repository,
      cwd: commandCwd,
      command,
      inputBytes,
      transport: shell.transport,
      stdout: output.stdout,
      stderr: output.stderr,
      truncated: output.truncated,
      timeoutMs: timeout,
      summary: `YOLO command completed in ${space.id}: ${boundedText(command, 180)}.`,
    });
  } catch (error) {
    const detail = processExecutionError(error, maxOutputBytes);
    return failedResult(request, { ...boundary, maxBytes: maxOutputBytes }, detail.message, {
      kind: "yolo_space_exec",
      spaceId: space.id,
      root: space.root,
      cwd: commandCwd,
      command,
      inputBytes,
      transport: shell?.transport,
      stdout: detail.stdout,
      stderr: detail.stderr,
      truncated: detail.truncated,
      timeoutMs: timeout,
    });
  } finally {
    await shell?.cleanup().catch(() => undefined);
  }
}

function yoloRuntimeEnabled(options: Pick<YoloSpaceExecutorOptions, "yoloEnabled" | "yoloSpaces">): boolean {
  return options.yoloEnabled ?? options.yoloSpaces !== undefined;
}

async function writeYoloSpaceFile(
  request: CapabilityExecutionInput,
  space: YoloSpaceConfig,
  boundary: CapabilityExecutionBoundary,
  maxInputBytes: number,
): Promise<CapabilityExecutionResult> {
  const requestedPath = request.input.path?.trim();
  const content = request.input.content ?? request.input.query;
  if (!requestedPath) {
    return failedResult(request, boundary, "YOLO space write_file requires input.path relative to the configured root");
  }
  if (content === undefined) {
    return failedResult(request, boundary, "YOLO space write_file requires exact input.content or legacy input.query");
  }

  const contentBuffer = Buffer.from(content, "utf8");
  if (contentBuffer.length > maxInputBytes) {
    return failedResult(
      request,
      boundary,
      `YOLO file content is ${contentBuffer.length} bytes, exceeding the configured ${maxInputBytes}-byte input limit`,
    );
  }

  try {
    const target = resolveWriteTarget(space.root, requestedPath);
    const existed = existsSync(target);
    await mkdir(path.dirname(target), { recursive: true });
    assertRealDirectoryInsideSpace(space.root, path.dirname(target));
    await writeFile(target, contentBuffer);
    const persisted = await readFile(target);
    if (!persisted.equals(contentBuffer)) {
      throw new Error(`YOLO file verification failed after writing ${target}`);
    }
    const digest = createHash("sha256").update(persisted).digest("hex");
    return completedResult(request, boundary, {
      kind: "yolo_space_write_file",
      spaceId: space.id,
      label: space.label,
      root: space.root,
      repository: space.repository,
      path: target,
      relativePath: path.relative(realpathSync(space.root), target),
      created: !existed,
      bytesWritten: persisted.length,
      sha256: digest,
      verified: true,
      summary: `Wrote and verified ${persisted.length} bytes at ${path.relative(realpathSync(space.root), target)} in ${space.id}.`,
    });
  } catch (error) {
    return failedResult(request, boundary, error instanceof Error ? error.message : String(error), {
      kind: "yolo_space_write_file",
      spaceId: space.id,
      root: space.root,
      requestedPath,
    });
  }
}

function yoloSpaceBoundary(options: YoloSpaceExecutorOptions): CapabilityExecutionBoundary {
  return {
    readOnly: false,
    scope: "yolo_space",
    approval: "none",
    visibility: "private_agent",
    maxBytes: positiveInteger(options.maxBytes, DEFAULT_MAX_OUTPUT_BYTES),
    maxSearchResults: 0,
    binaryHandling: "not_applicable",
    auditEvents: ["capability.invoked", "capability.result"],
    providerPromptWarning:
      "YOLO command output is private agent context and may enter an external provider prompt; the command itself is ledger-audited.",
  };
}

function normalizeSpaces(values: readonly unknown[], configDirectory: string): { spaces: YoloSpaceConfig[]; errors: string[] } {
  const spaces: YoloSpaceConfig[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      errors.push(`spaces[${index}] must be an object`);
      continue;
    }
    const id = stringValue(value.id);
    const root = stringValue(value.root);
    if (!id || !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
      errors.push(`spaces[${index}].id is invalid`);
      continue;
    }
    if (!root) {
      errors.push(`spaces[${index}].root is required`);
      continue;
    }
    if (ids.has(id.toLowerCase())) {
      errors.push(`duplicate YOLO space id: ${id}`);
      continue;
    }
    ids.add(id.toLowerCase());
    spaces.push({
      id,
      label: stringValue(value.label) ?? id,
      root: path.resolve(configDirectory, root),
      repository: stringValue(value.repository),
      enabled: value.enabled !== false,
      allowedAgents: stringArray(value.allowedAgents ?? value.allowed_agents, ["*"]),
      commandTimeoutMs: positiveIntegerOrUndefined(value.commandTimeoutMs ?? value.command_timeout_ms),
      maxInputBytes: positiveIntegerOrUndefined(value.maxInputBytes ?? value.max_input_bytes),
      maxOutputBytes: positiveIntegerOrUndefined(value.maxOutputBytes ?? value.max_output_bytes),
    });
  }
  return { spaces, errors };
}

function accessibleSpaces(spaces: readonly YoloSpaceConfig[], agentId: AgentId): YoloSpaceConfig[] {
  return spaces.filter((space) => space.allowedAgents.includes("*") || space.allowedAgents.includes(agentId));
}

function selectSpace(spaces: readonly YoloSpaceConfig[], selector: string | undefined): YoloSpaceConfig {
  const rawRequested = selector?.trim();
  const requested = rawRequested ? normalizeSpaceSelector(rawRequested) : undefined;
  if (requested) {
    const requestedPath = path.resolve(requested);
    const match = spaces.find(
      (space) =>
        space.id.toLowerCase() === requested.toLowerCase() ||
        normalizedPath(space.root) === normalizedPath(requestedPath),
    );
    if (!match) {
      throw new Error(`YOLO space is not configured or not allowed: ${rawRequested}`);
    }
    return match;
  }
  if (spaces.length === 1) {
    return spaces[0]!;
  }
  if (spaces.length === 0) {
    throw new Error("no enabled YOLO spaces are configured for this agent");
  }
  throw new Error("multiple YOLO spaces are available; input.root must select a space id or configured root");
}

function normalizeSpaceSelector(selector: string): string {
  return selector.replace(/^(?:local\.)?yolo(?:[._-]?space)?:/i, "").trim();
}

function resolveCommandCwd(root: string, requestedSubdirectory: string | undefined): string {
  const realRoot = realpathSync(root);
  const candidate = requestedSubdirectory?.trim() ? path.resolve(realRoot, requestedSubdirectory) : realRoot;
  if (!isPathInside(realRoot, candidate)) {
    throw new Error(`YOLO command cwd escapes configured root: ${candidate}`);
  }
  if (!isDirectory(candidate)) {
    throw new Error(`YOLO command cwd is missing or not a directory: ${candidate}`);
  }
  const realCandidate = realpathSync(candidate);
  if (!isPathInside(realRoot, realCandidate)) {
    throw new Error(`YOLO command cwd resolves outside configured root: ${realCandidate}`);
  }
  return realCandidate;
}

function assertCommandUsesSpaceBoundary(command: string, root: string): void {
  if (command.includes("\0")) {
    throw new Error("YOLO command may not contain NUL bytes");
  }
  if (/(^|[\s;&|()])(?:cd|chdir|pushd|popd)\b/i.test(command)) {
    throw new Error("YOLO command may not change directories; use input.path for a subdirectory inside the space");
  }
  if (/(^|[\s\\/])\.\.([\\/]|$)/.test(command)) {
    throw new Error("YOLO command may not contain parent-directory traversal");
  }
  for (const candidate of absolutePathCandidates(command)) {
    if (!isPathInside(root, path.resolve(candidate))) {
      throw new Error(`YOLO command mentions a path outside the configured root: ${candidate}`);
    }
  }
}

function resolveWriteTarget(root: string, requestedPath: string): string {
  if (/(^|[\\/])\.\.([\\/]|$)/.test(requestedPath)) {
    throw new Error("YOLO write path may not contain parent-directory traversal");
  }
  const realRoot = realpathSync(root);
  const candidate = path.resolve(realRoot, requestedPath);
  if (candidate === realRoot || !isPathInside(realRoot, candidate)) {
    throw new Error(`YOLO write path resolves outside configured root: ${candidate}`);
  }

  let existingAncestor = path.dirname(candidate);
  while (!existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) {
      break;
    }
    existingAncestor = parent;
  }
  if (!isDirectory(existingAncestor)) {
    throw new Error(`YOLO write parent is not a directory: ${existingAncestor}`);
  }
  assertRealDirectoryInsideSpace(realRoot, existingAncestor);

  if (existsSync(candidate)) {
    const realCandidate = realpathSync(candidate);
    if (!isPathInside(realRoot, realCandidate)) {
      throw new Error(`YOLO write target resolves outside configured root: ${realCandidate}`);
    }
    if (statSync(realCandidate).isDirectory()) {
      throw new Error(`YOLO write target is a directory: ${candidate}`);
    }
  }
  return candidate;
}

function assertRealDirectoryInsideSpace(root: string, directory: string): void {
  const realRoot = realpathSync(root);
  const realDirectory = realpathSync(directory);
  if (!isPathInside(realRoot, realDirectory)) {
    throw new Error(`YOLO write parent resolves outside configured root: ${realDirectory}`);
  }
}

function absolutePathCandidates(command: string): string[] {
  const candidates = new Set<string>();
  for (const match of command.matchAll(/(?:^|[\s="'`(<>])([A-Za-z]:[\\/][^"'`\s;&|<>]+)/g)) {
    if (match[1]) {
      candidates.add(match[1]);
    }
  }
  for (const match of command.matchAll(/\\\\[^"'`\s;&|<>]+/g)) {
    candidates.add(match[0]);
  }
  if (process.platform !== "win32") {
    for (const match of command.matchAll(/(?:^|[\s=])\/(?:[^"'`\s;&|<>])+/g)) {
      candidates.add(match[0].trim().replace(/^=/, ""));
    }
  }
  return [...candidates];
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

type PreparedShellCommand = {
  file: string;
  args: string[];
  transport: "direct_cmd" | "direct_sh" | "temporary_cmd_script" | "temporary_sh_script";
  windowsVerbatimArguments: boolean;
  cleanup: () => Promise<void>;
};

async function shellCommand(command: string): Promise<PreparedShellCommand> {
  const windows = process.platform === "win32";
  if (!/[\r\n]/.test(command)) {
    return windows
      ? {
          file: process.env.ComSpec || "cmd.exe",
          args: ["/d", "/s", "/c", command],
          transport: "direct_cmd",
          windowsVerbatimArguments: false,
          cleanup: async () => undefined,
        }
      : {
          file: "/bin/sh",
          args: ["-lc", command],
          transport: "direct_sh",
          windowsVerbatimArguments: false,
          cleanup: async () => undefined,
        };
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "species-yolo-"));
  const scriptPath = path.join(temporaryDirectory, windows ? "command.cmd" : "command.sh");
  try {
    const script = windows
      ? `@echo off\r\n${command.replace(/\r?\n/g, "\r\n")}\r\n`
      : `${command}${command.endsWith("\n") ? "" : "\n"}`;
    await writeFile(scriptPath, script, "utf8");
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }

  return windows
    ? {
        file: process.env.ComSpec || "cmd.exe",
        args: ["/d", "/s", "/c", `call "${scriptPath}"`],
        transport: "temporary_cmd_script",
        windowsVerbatimArguments: true,
        cleanup: () => rm(temporaryDirectory, { recursive: true, force: true }),
      }
    : {
        file: "/bin/sh",
        args: [scriptPath],
        transport: "temporary_sh_script",
        windowsVerbatimArguments: false,
        cleanup: () => rm(temporaryDirectory, { recursive: true, force: true }),
      };
}

function completedResult(
  request: CapabilityExecutionInput,
  boundary: CapabilityExecutionBoundary,
  output: Record<string, unknown> & { summary: string },
): CapabilityExecutionResult {
  return {
    invocationId: request.invocationId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    status: "completed",
    visibility: "private_agent",
    summary: output.summary,
    output,
    boundary,
  };
}

function failedResult(
  request: CapabilityExecutionInput,
  boundary: CapabilityExecutionBoundary,
  error: string,
  output: Record<string, unknown> = { kind: "error" },
): CapabilityExecutionResult {
  return {
    invocationId: request.invocationId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    status: "failed",
    visibility: "private_agent",
    summary: `Capability ${request.capabilityId}:${request.operation} failed: ${error}`,
    output: { ...output, error },
    error,
    boundary,
  };
}

function boundedCombinedOutput(stdout: string, stderr: string, maxBytes: number): {
  stdout: string;
  stderr: string;
  truncated: boolean;
} {
  const stdoutBuffer = Buffer.from(stdout, "utf8");
  const stderrBuffer = Buffer.from(stderr, "utf8");
  const combinedBytes = stdoutBuffer.length + stderrBuffer.length;
  const stdoutLimit = Math.min(stdoutBuffer.length, maxBytes);
  const stderrLimit = Math.max(0, maxBytes - stdoutLimit);
  return {
    stdout: stdoutBuffer.subarray(0, stdoutLimit).toString("utf8"),
    stderr: stderrBuffer.subarray(0, stderrLimit).toString("utf8"),
    truncated: combinedBytes > maxBytes,
  };
}

function processExecutionError(error: unknown, maxBytes: number): {
  message: string;
  stdout: string;
  stderr: string;
  truncated: boolean;
} {
  const record = isRecord(error) ? error : {};
  const output = boundedCombinedOutput(String(record.stdout ?? ""), String(record.stderr ?? ""), maxBytes);
  return {
    message: error instanceof Error ? error.message : String(error),
    ...output,
  };
}

function isDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function normalizedPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function boundedText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function positiveIntegerOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const values = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim()),
    ),
  ];
  return values.length > 0 ? values : [...fallback];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
