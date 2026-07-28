import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

import { SpeciesRoomRuntime } from "./runtime";
import { AutonomyScheduler, type AutonomySchedulerStatusProvider } from "./autonomyScheduler";

const DEFAULT_HARNESS_REPORT_STALE_MS = 24 * 60 * 60 * 1000;

export type SpeciesHttpServerOptions = {
  port?: number;
  host?: string;
  webRoot?: string;
  harnessReportDir?: string;
  harnessReportStaleAfterMs?: number;
  runtime?: SpeciesRoomRuntime;
  autonomyScheduler?: AutonomySchedulerStatusProvider;
  allowFileOrigin?: boolean;
  allowLocalCrossOrigin?: boolean;
};

export function createSpeciesHttpServer(options: SpeciesHttpServerOptions = {}) {
  const webRoot = options.webRoot ?? path.join(process.cwd(), "web");
  const harnessReportDir = options.harnessReportDir ?? path.join(process.cwd(), ".species", "harness");
  const harnessReportStaleAfterMs = positiveNumber(options.harnessReportStaleAfterMs, DEFAULT_HARNESS_REPORT_STALE_MS);
  const runtime = options.runtime ?? new SpeciesRoomRuntime();

  return createServer(async (request, response) => {
    const corsAllowed = setCors(request, response, {
      allowFileOrigin: options.allowFileOrigin ?? false,
      allowLocalCrossOrigin: options.allowLocalCrossOrigin ?? false,
    });
    if (!corsAllowed) {
      response.writeHead(403);
      response.end("CORS origin forbidden");
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      if (url.pathname === "/api/health" && request.method === "GET") {
        await sendJson(response, {
          ok: true,
          service: "species-room-runtime",
          agentRuntimeMode: runtime.getAgentRuntimeMode(),
          autonomyScheduler: options.autonomyScheduler?.getStatus(),
        });
        return;
      }

      if (url.pathname === "/api/room/state" && request.method === "GET") {
        const state = await runtime.getState();
        await sendJson(response, {
          ...state,
          ...(options.autonomyScheduler ? { autonomyScheduler: options.autonomyScheduler.getStatus() } : {}),
          longRunOperationalSummary: await readLatestLongRunOperationalSummary(harnessReportDir, harnessReportStaleAfterMs),
        });
        return;
      }

      if (url.pathname === "/api/room/messages" && request.method === "POST") {
        const body = await readJsonBody<{
          content?: unknown;
          clientMessageId?: unknown;
          mentions?: unknown;
          contextRefs?: unknown;
          topicId?: unknown;
        }>(request);
        const content = typeof body.content === "string" ? body.content : "";
        const clientMessageId =
          typeof body.clientMessageId === "string" && body.clientMessageId.length > 0
            ? body.clientMessageId
            : `client_${Date.now()}`;
        const mentions = Array.isArray(body.mentions)
          ? body.mentions.filter((mention): mention is string => typeof mention === "string")
          : [];
        const contextRefs = Array.isArray(body.contextRefs)
          ? body.contextRefs.filter((ref): ref is string => typeof ref === "string")
          : [];
        await sendJson(
          response,
          await runtime.enqueueUserMessage({
            content,
            clientMessageId,
            mentions,
            contextRefs,
            topicId: typeof body.topicId === "string" ? body.topicId : undefined,
          }),
        );
        return;
      }

      if (url.pathname === "/api/room/topics/discussion-requests" && request.method === "POST") {
        const body = await readJsonBody<{
          topicId?: unknown;
          prompt?: unknown;
          clientMessageId?: unknown;
          contextRefs?: unknown;
        }>(request);
        const clientMessageId =
          typeof body.clientMessageId === "string" && body.clientMessageId.length > 0
            ? body.clientMessageId
            : `client_topic_discussion_${Date.now()}`;
        const contextRefs = Array.isArray(body.contextRefs)
          ? body.contextRefs.filter((ref): ref is string => typeof ref === "string")
          : [];
        await sendJson(
          response,
          await runtime.requestTopicDiscussion({
            topicId: typeof body.topicId === "string" ? body.topicId : "",
            prompt: typeof body.prompt === "string" ? body.prompt : undefined,
            clientMessageId,
            contextRefs,
          }),
        );
        return;
      }

      if (url.pathname === "/api/room/archive/daily" && request.method === "POST") {
        const body = await readJsonBody<{ date?: unknown; timezone?: unknown }>(request);
        await sendJson(response, await runtime.createDailyArchive({
          date: typeof body.date === "string" ? body.date : undefined,
          timezone: typeof body.timezone === "string" ? body.timezone : undefined,
        }));
        return;
      }

      if (url.pathname === "/api/room/archive/repairs/apply" && request.method === "POST") {
        const body = await readJsonBody<{ repairRef?: unknown; reason?: unknown; archiveId?: unknown }>(request);
        await sendJson(
          response,
          await runtime.applyArchiveRepair({
            repairRef: typeof body.repairRef === "string" ? body.repairRef : "",
            reason: typeof body.reason === "string" ? body.reason : undefined,
            archiveId: typeof body.archiveId === "string" ? body.archiveId : undefined,
          }),
        );
        return;
      }

      if (url.pathname === "/api/room/autonomy/tick" && request.method === "POST") {
        const body = await readJsonBody<{
          now?: unknown;
          date?: unknown;
          timezone?: unknown;
          force?: unknown;
          memoryHygieneReviewAfterMs?: unknown;
          continuityReviewAfterMs?: unknown;
          silenceReentryAfterMs?: unknown;
          idleSocialAfterMs?: unknown;
        }>(request);
        const memoryHygieneReviewAfterMs = Number(body.memoryHygieneReviewAfterMs);
        const continuityReviewAfterMs = Number(body.continuityReviewAfterMs);
        const silenceReentryAfterMs = Number(body.silenceReentryAfterMs);
        const idleSocialAfterMs = Number(body.idleSocialAfterMs);
        await sendJson(
          response,
          await runtime.runAutonomousTick({
            now: typeof body.now === "string" ? body.now : undefined,
            date: typeof body.date === "string" ? body.date : undefined,
            timezone: typeof body.timezone === "string" ? body.timezone : undefined,
            force: body.force === true,
            memoryHygieneReviewAfterMs: Number.isFinite(memoryHygieneReviewAfterMs)
              ? memoryHygieneReviewAfterMs
              : undefined,
            continuityReviewAfterMs: Number.isFinite(continuityReviewAfterMs)
              ? continuityReviewAfterMs
              : undefined,
            silenceReentryAfterMs: Number.isFinite(silenceReentryAfterMs) ? silenceReentryAfterMs : undefined,
            idleSocialAfterMs: Number.isFinite(idleSocialAfterMs) ? idleSocialAfterMs : undefined,
          }),
        );
        return;
      }

      if (url.pathname === "/api/room/side-effects/expire" && request.method === "POST") {
        const body = await readJsonBody<{ requestRef?: unknown; reason?: unknown }>(request);
        await sendJson(
          response,
          await runtime.expireSideEffectPermission({
            requestRef: typeof body.requestRef === "string" ? body.requestRef : "",
            reason: typeof body.reason === "string" ? body.reason : undefined,
          }),
        );
        return;
      }

      if (url.pathname === "/api/room/side-effects/approve" && request.method === "POST") {
        const body = await readJsonBody<{ requestRef?: unknown; reason?: unknown; expiresAt?: unknown }>(request);
        await sendJson(
          response,
          await runtime.approveSideEffectPermission({
            requestRef: typeof body.requestRef === "string" ? body.requestRef : "",
            reason: typeof body.reason === "string" ? body.reason : undefined,
            expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
          }),
        );
        return;
      }

      if (url.pathname === "/api/room/side-effects/execute" && request.method === "POST") {
        const body = await readJsonBody<{ requestRef?: unknown; content?: unknown; cwd?: unknown }>(request);
        await sendJson(
          response,
          await runtime.executeApprovedSideEffect({
            requestRef: typeof body.requestRef === "string" ? body.requestRef : "",
            content: typeof body.content === "string" ? body.content : undefined,
            cwd: typeof body.cwd === "string" ? body.cwd : undefined,
          }),
        );
        return;
      }

      if (url.pathname === "/api/room/events" && request.method === "GET") {
        await sendJson(response, { events: await runtime.rawEvents() });
        return;
      }

      await serveStatic(response, webRoot, url.pathname);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await sendJson(response, { error: message }, 500);
    }
  });
}

async function readLatestLongRunOperationalSummary(
  reportDir: string,
  staleAfterMs: number,
): Promise<Record<string, unknown> | null> {
  try {
    const entries = await readdir(reportDir, { withFileTypes: true });
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const filePath = path.join(reportDir, entry.name);
          const info = await stat(filePath);
          return { fileName: entry.name, filePath, mtimeMs: info.mtimeMs };
        }),
    );
    const latest = candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || right.fileName.localeCompare(left.fileName))[0];
    if (!latest) {
      return null;
    }
    const parsed = JSON.parse(await readFile(latest.filePath, "utf8")) as { operationalSummary?: unknown };
    const summary = sanitizeLongRunOperationalSummary(parsed.operationalSummary);
    if (!summary) {
      return null;
    }
    return {
      ...summary,
      reportFile: latest.fileName,
      reportModifiedAt: new Date(latest.mtimeMs).toISOString(),
      freshness: longRunReportFreshness(summary.checkedAt, latest.mtimeMs, staleAfterMs),
    };
  } catch {
    return null;
  }
}

function longRunReportFreshness(checkedAt: unknown, reportModifiedAtMs: number, staleAfterMs: number): Record<string, unknown> {
  const checkedAtMs = typeof checkedAt === "string" ? Date.parse(checkedAt) : Number.NaN;
  const anchorMs = Number.isFinite(checkedAtMs) ? checkedAtMs : reportModifiedAtMs;
  const ageMs = Math.max(0, Date.now() - anchorMs);
  const stale = ageMs > staleAfterMs;
  return {
    status: stale ? "stale" : "fresh",
    ageMs,
    staleAfterMs,
    anchorAt: new Date(anchorMs).toISOString(),
  };
}

function sanitizeLongRunOperationalSummary(value: unknown): Record<string, unknown> | null {
  const summary = objectValue(value);
  if (!summary) {
    return null;
  }
  const domains = arrayValue(summary.domains)
    .map((domain) => sanitizeLongRunOperationalDomain(domain))
    .filter((domain): domain is Record<string, unknown> => domain !== null)
    .slice(0, 16);
  if (domains.length === 0) {
    return null;
  }

  return {
    status: stringValue(summary.status) === "pass" ? "pass" : "fail",
    checkedAt: stringValue(summary.checkedAt),
    passedDomainCount: numberValue(summary.passedDomainCount),
    failedDomainCount: numberValue(summary.failedDomainCount),
    evidenceRefCount: numberValue(summary.evidenceRefCount),
    evidenceRefs: arrayOfStrings(summary.evidenceRefs).slice(0, 96),
    domains,
  };
}

function sanitizeLongRunOperationalDomain(value: unknown): Record<string, unknown> | null {
  const domain = objectValue(value);
  if (!domain) {
    return null;
  }
  const key = stringValue(domain.key);
  if (!key) {
    return null;
  }
  return {
    key,
    label: stringValue(domain.label) ?? key,
    ok: domain.ok === true,
    metrics: primitiveRecord(domain.metrics),
    evidenceRefs: arrayOfStrings(domain.evidenceRefs).slice(0, 40),
    gaps: arrayOfStrings(domain.gaps).slice(0, 12),
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const text = value.slice(0, 500);
  return containsSecretLikeText(text) ? "[redacted]" : text;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .map((item) => item.slice(0, 500))
        .filter((item) => !containsSecretLikeText(item))
    : [];
}

function primitiveRecord(value: unknown): Record<string, string | number | boolean> {
  const input = objectValue(value);
  if (!input) return {};
  const output: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(input).slice(0, 24)) {
    if (typeof item === "string") {
      output[key] = containsSecretLikeText(item) ? "[redacted]" : item.slice(0, 500);
    } else if (typeof item === "number" && Number.isFinite(item)) {
      output[key] = item;
    } else if (typeof item === "boolean") {
      output[key] = item;
    }
  }
  return output;
}

function containsSecretLikeText(text: string): boolean {
  return (
    /\b(?:sk|rk|pk|ghp|github_pat|xox[baprs])-[-_A-Za-z0-9]{12,}\b/.test(text) ||
    /\b(?:api[_-]?key|secret|token|authorization|bearer)\s*[:=]\s*["']?[-_./+=A-Za-z0-9]{12,}/i.test(text)
  );
}

async function serveStatic(response: ServerResponse, webRoot: string, requestPath: string): Promise<void> {
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const relative = decodeURIComponent(normalized).replace(/^\/+/, "");
  const filePath = path.resolve(webRoot, relative);
  const root = path.resolve(webRoot);
  const relativeToRoot = path.relative(root, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64_000) {
      throw new Error("request body is too large");
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return (raw.length > 0 ? JSON.parse(raw) : {}) as T;
}

async function sendJson(response: ServerResponse, body: unknown, status = 200): Promise<void> {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function setCors(
  request: IncomingMessage,
  response: ServerResponse,
  options: { allowFileOrigin: boolean; allowLocalCrossOrigin: boolean },
): boolean {
  const origin = request.headers.origin;
  response.setHeader("vary", "Origin");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  if (origin === undefined) {
    return true;
  }
  if (!isAllowedLocalOrigin(origin, request.headers.host, options)) {
    return false;
  }
  response.setHeader("access-control-allow-origin", origin);
  return true;
}

function isAllowedLocalOrigin(
  origin: string,
  requestHost: string | undefined,
  options: { allowFileOrigin: boolean; allowLocalCrossOrigin: boolean },
): boolean {
  if (origin === "null") {
    return options.allowFileOrigin;
  }
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const localHostname =
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      (isIP(hostname) === 4 && hostname.split(".")[0] === "127");
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !localHostname) {
      return false;
    }
    return options.allowLocalCrossOrigin || parsed.host.toLowerCase() === requestHost?.trim().toLowerCase();
  } catch {
    return false;
  }
}

function contentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export function resolveAgentRuntimeMode(
  argv: readonly string[],
  env: { SPECIES_AGENT_MODE?: string } = process.env,
): "seed" | "live" {
  if (argv.includes("--live")) return "live";
  if (argv.includes("--seed")) return "seed";
  return env.SPECIES_AGENT_MODE === "live" ? "live" : "seed";
}

export function assertSafeHttpHost(host: string, allowInsecureRemote = false): void {
  const normalized = host.trim().toLowerCase();
  const loopback =
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    (isIP(normalized) === 4 && normalized.split(".")[0] === "127");
  if (!loopback && !allowInsecureRemote) {
    throw new Error(
      `Refusing unauthenticated non-loopback bind (${host}); set SPECIES_ALLOW_INSECURE_REMOTE=1 only behind an authenticated network boundary`,
    );
  }
}

if (require.main === module) {
  const port = Number(process.env.SPECIES_PORT ?? 8787);
  const host = process.env.SPECIES_HOST ?? "127.0.0.1";
  assertSafeHttpHost(host, environmentFlag(process.env.SPECIES_ALLOW_INSECURE_REMOTE));
  const agentRuntimeMode = resolveAgentRuntimeMode(process.argv.slice(2));
  const maxConcurrentBackgroundTurns = Number(process.env.SPECIES_MAX_BACKGROUND_TURNS);
  const maxAwakenedAgents = Number(process.env.SPECIES_MAX_AWAKENED_AGENTS);
  const maxSpeakers = Number(process.env.SPECIES_MAX_SPEAKERS);
  const maxAutonomousAwakenedAgents = Number(process.env.SPECIES_MAX_AUTONOMOUS_AWAKENED_AGENTS);
  const maxAutonomousSpeakers = Number(process.env.SPECIES_MAX_AUTONOMOUS_SPEAKERS);
  const speakerArbitrationWindowMs = Number(process.env.SPECIES_SPEAKER_ARBITRATION_WINDOW_MS);
  const autonomyTickMs = Number(process.env.SPECIES_AUTONOMY_TICK_MS);
  const memoryHygieneReviewAfterMs = Number(process.env.SPECIES_MEMORY_HYGIENE_REVIEW_MS);
  const continuityReviewAfterMs = Number(process.env.SPECIES_CONTINUITY_REVIEW_MS);
  const silenceReentryAfterMs = Number(process.env.SPECIES_SILENCE_REENTRY_MS);
  const idleSocialAfterMs = Number(process.env.SPECIES_IDLE_SOCIAL_RHYTHM_MS);
  const archiveReviewQuietAfterMs = Number(process.env.SPECIES_ARCHIVE_REVIEW_QUIET_MS);
  const ledgerPath = process.env.SPECIES_LEDGER_PATH;
  const harnessReportDir = process.env.SPECIES_HARNESS_REPORT_DIR;
  const harnessReportStaleAfterMs = Number(process.env.SPECIES_HARNESS_REPORT_STALE_MS);
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: ledgerPath && ledgerPath.trim().length > 0 ? ledgerPath : undefined,
    liveAgents: agentRuntimeMode === "live",
    maxConcurrentBackgroundTurns: Number.isFinite(maxConcurrentBackgroundTurns)
      ? maxConcurrentBackgroundTurns
      : undefined,
    maxAwakenedAgents: Number.isFinite(maxAwakenedAgents) ? maxAwakenedAgents : undefined,
    maxSpeakers: Number.isFinite(maxSpeakers) ? maxSpeakers : undefined,
    maxAutonomousAwakenedAgents: Number.isFinite(maxAutonomousAwakenedAgents)
      ? maxAutonomousAwakenedAgents
      : undefined,
    maxAutonomousSpeakers: Number.isFinite(maxAutonomousSpeakers) ? maxAutonomousSpeakers : undefined,
    speakerArbitrationWindowMs: Number.isFinite(speakerArbitrationWindowMs) ? speakerArbitrationWindowMs : undefined,
  });
  const autonomyScheduler =
    Number.isFinite(autonomyTickMs) && autonomyTickMs > 0
      ? new AutonomyScheduler(runtime, {
          intervalMs: autonomyTickMs,
          memoryHygieneReviewAfterMs: Number.isFinite(memoryHygieneReviewAfterMs)
            ? memoryHygieneReviewAfterMs
            : undefined,
          continuityReviewAfterMs: Number.isFinite(continuityReviewAfterMs)
            ? continuityReviewAfterMs
            : undefined,
          silenceReentryAfterMs: Number.isFinite(silenceReentryAfterMs) ? silenceReentryAfterMs : 120_000,
          idleSocialAfterMs: Number.isFinite(idleSocialAfterMs) ? idleSocialAfterMs : 60_000,
          archiveReviewQuietAfterMs: Number.isFinite(archiveReviewQuietAfterMs)
            ? archiveReviewQuietAfterMs
            : 10 * 60_000,
        })
      : undefined;
  const server = createSpeciesHttpServer({
    runtime,
    autonomyScheduler,
    harnessReportDir,
    harnessReportStaleAfterMs: Number.isFinite(harnessReportStaleAfterMs) ? harnessReportStaleAfterMs : undefined,
    allowFileOrigin: environmentFlag(process.env.SPECIES_ALLOW_FILE_ORIGIN),
    allowLocalCrossOrigin: environmentFlag(process.env.SPECIES_ALLOW_LOCAL_CROSS_ORIGIN),
  });
  if (Number.isFinite(autonomyTickMs) && autonomyTickMs > 0) {
    autonomyScheduler?.start();
  }
  server.listen(port, host, () => {
    console.log(`species room runtime listening at http://${host}:${port} (${agentRuntimeMode} agent mode)`);
  });
}

function environmentFlag(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}
