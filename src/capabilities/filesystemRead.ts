import type { Dirent, Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { AgentId, CapabilityUseInput, RefId, RoomId, TopicId } from "../types";

export type LocalFilesystemReadOperation = "read_file" | "list_dir" | "search_files";

export type CapabilityExecutionBoundary = {
  readOnly: boolean;
  scope: "all_device" | "local_runtime" | "agent_workspace" | "memsu_home" | "git_worktree" | "network" | "yolo_space";
  approval: "none" | "required";
  visibility: "private_agent";
  maxBytes: number;
  maxSearchResults: number;
  binaryHandling: "detect_and_summarize" | "not_applicable";
  auditEvents: ["capability.invoked", "capability.result"];
  providerPromptWarning: string;
};

export type LocalFilesystemReadBoundary = CapabilityExecutionBoundary & {
  readOnly: true;
  scope: "all_device" | "agent_workspace";
  approval: "none";
  binaryHandling: "detect_and_summarize";
};

export type CapabilityExecutionInput = {
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

export type CapabilityExecutionResult = {
  invocationId: string;
  capabilityId: string;
  operation: string;
  status: "completed" | "failed" | "approval_required";
  visibility: "private_agent";
  summary: string;
  output: Record<string, unknown>;
  error?: string;
  boundary: CapabilityExecutionBoundary;
};

export type LocalFilesystemReadOptions = {
  cwd?: string;
  allowedReadRoots?: readonly string[];
  allowAllDeviceRead?: boolean;
  maxBytes?: number;
  maxSearchResults?: number;
  maxDirectoryEntries?: number;
  maxFilesScanned?: number;
  maxDepth?: number;
};

const DEFAULT_MAX_BYTES = 64 * 1024;
const DEFAULT_MAX_SEARCH_RESULTS = 25;
const DEFAULT_MAX_DIRECTORY_ENTRIES = 200;
const DEFAULT_MAX_FILES_SCANNED = 2_000;
const DEFAULT_MAX_DEPTH = 8;

export function localFilesystemReadBoundary(
  options: Pick<LocalFilesystemReadOptions, "maxBytes" | "maxSearchResults" | "allowAllDeviceRead"> = {},
): LocalFilesystemReadBoundary {
  return {
    readOnly: true,
    scope: options.allowAllDeviceRead ? "all_device" : "agent_workspace",
    approval: "none",
    visibility: "private_agent",
    maxBytes: positiveInteger(options.maxBytes, DEFAULT_MAX_BYTES),
    maxSearchResults: positiveInteger(options.maxSearchResults, DEFAULT_MAX_SEARCH_RESULTS),
    binaryHandling: "detect_and_summarize",
    auditEvents: ["capability.invoked", "capability.result"],
    providerPromptWarning: options.allowAllDeviceRead
      ? "Unrestricted host reads are enabled. If the provider is external, private local file content may be sent in the provider prompt."
      : "Reads are limited to configured roots. If the provider is external, private local file content may still be sent in the provider prompt.",
  };
}

export async function executeLocalFilesystemRead(
  request: CapabilityExecutionInput,
  options: LocalFilesystemReadOptions = {},
): Promise<CapabilityExecutionResult> {
  const boundary = localFilesystemReadBoundary(options);
  const operation = localFilesystemReadOperation(request.operation);
  if (!operation || request.capabilityId !== "local.filesystem.read") {
    return failedResult(request, boundary, `unsupported capability operation: ${request.capabilityId}:${request.operation}`);
  }

  try {
    if (operation === "read_file") {
      return completedResult(request, boundary, await readFileCapability(request.input, options, boundary.maxBytes));
    }
    if (operation === "list_dir") {
      return completedResult(request, boundary, await listDirCapability(request.input, options));
    }
    return completedResult(request, boundary, await searchFilesCapability(request.input, options, boundary));
  } catch (error) {
    return failedResult(request, boundary, error instanceof Error ? error.message : String(error));
  }
}

function completedResult(
  request: CapabilityExecutionInput,
  boundary: LocalFilesystemReadBoundary,
  output: Record<string, unknown> & { summary?: unknown },
): CapabilityExecutionResult {
  const summary = typeof output.summary === "string" ? output.summary : `${request.operation} completed`;
  return {
    invocationId: request.invocationId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    status: "completed",
    visibility: "private_agent",
    summary,
    output,
    boundary,
  };
}

function failedResult(
  request: CapabilityExecutionInput,
  boundary: LocalFilesystemReadBoundary,
  error: string,
): CapabilityExecutionResult {
  return {
    invocationId: request.invocationId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    status: "failed",
    visibility: "private_agent",
    summary: `Capability ${request.capabilityId}:${request.operation} failed: ${error}`,
    output: {
      kind: "error",
      error,
    },
    error,
    boundary,
  };
}

function localFilesystemReadOperation(value: string): LocalFilesystemReadOperation | undefined {
  return value === "read_file" || value === "list_dir" || value === "search_files" ? value : undefined;
}

async function readFileCapability(
  input: CapabilityUseInput,
  options: LocalFilesystemReadOptions,
  maxBytes: number,
): Promise<Record<string, unknown> & { summary: string }> {
  if (!input.path?.trim()) {
    throw new Error("read_file requires input.path");
  }
  const targetPath = await authorizeLocalReadPath(resolveTargetPath(input, options.cwd), options);
  const stat = await fs.stat(targetPath);
  if (!stat.isFile()) {
    throw new Error(`read_file target is not a file: ${targetPath}`);
  }

  const bytesToRead = Math.min(maxBytes, stat.size);
  const handle = await fs.open(targetPath, "r");
  try {
    const buffer = Buffer.alloc(bytesToRead);
    const read = bytesToRead === 0 ? { bytesRead: 0 } : await handle.read(buffer, 0, bytesToRead, 0);
    const sample = buffer.subarray(0, read.bytesRead);
    const binary = isLikelyBinary(sample);
    if (binary) {
      return {
        kind: "read_file",
        path: targetPath,
        sizeBytes: stat.size,
        bytesRead: read.bytesRead,
        truncated: stat.size > read.bytesRead,
        binary: true,
        content: "",
        summary: `Read ${read.bytesRead} byte sample from binary file ${targetPath}; content omitted.`,
      };
    }

    const content = sample.toString("utf8");
    return {
      kind: "read_file",
      path: targetPath,
      sizeBytes: stat.size,
      bytesRead: read.bytesRead,
      truncated: stat.size > read.bytesRead,
      binary: false,
      content,
      summary: `Read ${read.bytesRead}${stat.size > read.bytesRead ? ` of ${stat.size}` : ""} bytes from ${targetPath}.`,
    };
  } finally {
    await handle.close();
  }
}

async function listDirCapability(
  input: CapabilityUseInput,
  options: LocalFilesystemReadOptions,
): Promise<Record<string, unknown> & { summary: string }> {
  const targetPath = await authorizeLocalReadPath(resolveDirectoryPath(input, options.cwd), options);
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const maxEntries = positiveInteger(options.maxDirectoryEntries, DEFAULT_MAX_DIRECTORY_ENTRIES);
  const listed = entries.slice(0, maxEntries).map((entry) => ({
    name: entry.name,
    path: path.join(targetPath, entry.name),
    type: direntType(entry),
  }));
  return {
    kind: "list_dir",
    path: targetPath,
    entryCount: entries.length,
    truncated: entries.length > listed.length,
    entries: listed,
    summary: `Listed ${listed.length}${entries.length > listed.length ? ` of ${entries.length}` : ""} entries in ${targetPath}.`,
  };
}

async function searchFilesCapability(
  input: CapabilityUseInput,
  options: LocalFilesystemReadOptions,
  boundary: LocalFilesystemReadBoundary,
): Promise<Record<string, unknown> & { summary: string }> {
  const rootPath = await authorizeLocalReadPath(resolveSearchRoot(input, options.cwd), options);
  const stat = await fs.stat(rootPath);
  if (!stat.isDirectory()) {
    throw new Error(`search_files root is not a directory: ${rootPath}`);
  }
  if (!input.query?.trim() && !input.glob?.trim()) {
    throw new Error("search_files requires input.query or input.glob");
  }

  const maxResults = boundary.maxSearchResults;
  const maxFilesScanned = positiveInteger(options.maxFilesScanned, DEFAULT_MAX_FILES_SCANNED);
  const maxDepth = positiveInteger(options.maxDepth, DEFAULT_MAX_DEPTH);
  const matcher = createGlobMatcher(input.glob);
  const query = input.query?.trim().toLowerCase();
  const results: Record<string, unknown>[] = [];
  let scanned = 0;
  let skippedErrors = 0;

  async function visit(currentPath: string, depth: number): Promise<void> {
    if (results.length >= maxResults || scanned >= maxFilesScanned || depth > maxDepth) {
      return;
    }
    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      skippedErrors += 1;
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults || scanned >= maxFilesScanned) {
        return;
      }
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = normalizePath(path.relative(rootPath, absolutePath));
      const nameMatched = matcher(entry.name, relativePath) && (!query || relativePath.toLowerCase().includes(query));
      if (nameMatched) {
        results.push({
          path: absolutePath,
          relativePath,
          type: direntType(entry),
          match: "name",
        });
      }
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) {
          await visit(absolutePath, depth + 1);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      scanned += 1;
      if (!query || !matcher(entry.name, relativePath)) {
        continue;
      }
      const contentMatch = await searchFileContent(absolutePath, query, boundary.maxBytes);
      if (contentMatch) {
        results.push({
          path: absolutePath,
          relativePath,
          type: "file",
          match: "content",
          ...contentMatch,
        });
      }
    }
  }

  await visit(rootPath, 0);
  return {
    kind: "search_files",
    root: rootPath,
    query: input.query,
    glob: input.glob,
    resultCount: results.length,
    scannedFileCount: scanned,
    skippedErrorCount: skippedErrors,
    truncated: results.length >= maxResults || scanned >= maxFilesScanned,
    results,
    summary: `Found ${results.length} result(s) under ${rootPath}; scanned ${scanned} file(s).`,
  };
}

async function searchFileContent(
  filePath: string,
  query: string,
  maxBytes: number,
): Promise<{ line?: number; preview: string; truncated: boolean } | undefined> {
  let stat: Stats;
  try {
    stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  const handle = await fs.open(filePath, "r");
  try {
    const bytesToRead = Math.min(maxBytes, stat.size);
    const buffer = Buffer.alloc(bytesToRead);
    const read = bytesToRead === 0 ? { bytesRead: 0 } : await handle.read(buffer, 0, bytesToRead, 0);
    const sample = buffer.subarray(0, read.bytesRead);
    if (isLikelyBinary(sample)) {
      return undefined;
    }
    const lines = sample.toString("utf8").split(/\r?\n/);
    const lineIndex = lines.findIndex((line) => line.toLowerCase().includes(query));
    if (lineIndex < 0) {
      return undefined;
    }
    return {
      line: lineIndex + 1,
      preview: lines[lineIndex]?.trim().slice(0, 500) ?? "",
      truncated: stat.size > read.bytesRead,
    };
  } finally {
    await handle.close();
  }
}

function resolveTargetPath(input: CapabilityUseInput, cwd = process.cwd()): string {
  const root = input.root?.trim();
  const requestedPath = input.path?.trim();
  if (!requestedPath) {
    throw new Error("path is required");
  }
  if (path.isAbsolute(requestedPath)) {
    return path.resolve(requestedPath);
  }
  return path.resolve(root ? path.resolve(cwd, root) : cwd, requestedPath);
}

function resolveDirectoryPath(input: CapabilityUseInput, cwd = process.cwd()): string {
  if (input.path?.trim()) {
    return resolveTargetPath(input, cwd);
  }
  if (input.root?.trim()) {
    return path.resolve(cwd, input.root.trim());
  }
  return path.resolve(cwd);
}

function resolveSearchRoot(input: CapabilityUseInput, cwd = process.cwd()): string {
  const root = input.root?.trim() || input.path?.trim();
  if (!root) {
    throw new Error("search_files requires input.root or input.path");
  }
  return path.resolve(cwd, root);
}

export async function authorizeLocalReadPath(
  targetPath: string,
  options: Pick<LocalFilesystemReadOptions, "cwd" | "allowedReadRoots" | "allowAllDeviceRead"> = {},
): Promise<string> {
  const resolvedTarget = path.resolve(targetPath);
  const realTarget = await fs.realpath(resolvedTarget);
  if (options.allowAllDeviceRead) {
    return realTarget;
  }

  const roots =
    options.allowedReadRoots && options.allowedReadRoots.length > 0
      ? options.allowedReadRoots
      : [options.cwd ?? process.cwd()];
  const authorizedRoots = await Promise.all(
    roots.map(async (root) => {
      const resolvedRoot = path.resolve(options.cwd ?? process.cwd(), root);
      try {
        return await fs.realpath(resolvedRoot);
      } catch {
        return resolvedRoot;
      }
    }),
  );
  if (!authorizedRoots.some((root) => isPathInside(root, realTarget))) {
    throw new Error(`local read path is outside configured roots: ${resolvedTarget}`);
  }
  return realTarget;
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function direntType(entry: Dirent): "file" | "directory" | "symlink" | "other" {
  if (entry.isFile()) return "file";
  if (entry.isDirectory()) return "directory";
  if (entry.isSymbolicLink()) return "symlink";
  return "other";
}

function isLikelyBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }
  let suspicious = 0;
  for (const byte of buffer) {
    if (byte === 0) {
      return true;
    }
    if (byte < 7 || (byte > 14 && byte < 32)) {
      suspicious += 1;
    }
  }
  return suspicious / buffer.length > 0.08;
}

function createGlobMatcher(glob: string | undefined): (baseName: string, relativePath: string) => boolean {
  const trimmed = glob?.trim();
  if (!trimmed) {
    return () => true;
  }
  const normalizedGlob = normalizePath(trimmed);
  const targetIsPath = normalizedGlob.includes("/");
  const regex = globToRegExp(normalizedGlob);
  return (baseName, relativePath) => regex.test(targetIsPath ? relativePath : baseName);
}

function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    source += escapeRegExp(char ?? "");
  }
  return new RegExp(`^${source}$`, "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function shouldSkipDirectory(name: string): boolean {
  return name === ".git" || name === "node_modules";
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}
