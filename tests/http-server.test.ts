import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { assertSafeHttpHost, createSpeciesHttpServer, resolveAgentRuntimeMode } from "../src/server/http";
import { SpeciesRoomRuntime } from "../src/server/runtime";

test("http server limits browser CORS to local room surfaces", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-cors-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const server = createSpeciesHttpServer({ webRoot });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);

    const sameOrigin = await fetch(`${baseUrl}/api/health`);
    assert.equal(sameOrigin.status, 200);
    assert.equal(sameOrigin.headers.get("access-control-allow-origin"), null);
    assert.equal((await sameOrigin.json() as { agentRuntimeMode?: string }).agentRuntimeMode, "seed");

    const sameLocalOrigin = baseUrl;
    const local = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: sameLocalOrigin },
    });
    assert.equal(local.status, 200);
    assert.equal(local.headers.get("access-control-allow-origin"), sameLocalOrigin);
    assert.match(local.headers.get("vary") ?? "", /Origin/);

    const filePreview = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: "null" },
    });
    assert.equal(filePreview.status, 403);

    const otherLocalOrigin = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: "http://localhost:8787" },
    });
    assert.equal(otherLocalOrigin.status, 403);

    const remote = await fetch(`${baseUrl}/api/room/events`, {
      headers: { origin: "https://example.invalid" },
    });
    assert.equal(remote.status, 403);
    assert.equal(await remote.text(), "CORS origin forbidden");

    const remotePreflight = await fetch(`${baseUrl}/api/room/messages`, {
      method: "OPTIONS",
      headers: {
        origin: "https://example.invalid",
        "access-control-request-method": "POST",
      },
    });
    assert.equal(remotePreflight.status, 403);
  } finally {
    await close(server);
  }
});

test("http server requires explicit opt-in for file and cross-local origins", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-cors-opt-in-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const server = createSpeciesHttpServer({ webRoot, allowFileOrigin: true, allowLocalCrossOrigin: true });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);
    const filePreview = await fetch(`${baseUrl}/api/health`, { headers: { origin: "null" } });
    assert.equal(filePreview.status, 200);
    assert.equal(filePreview.headers.get("access-control-allow-origin"), "null");

    const otherLocalOrigin = "http://localhost:8787";
    const local = await fetch(`${baseUrl}/api/health`, { headers: { origin: otherLocalOrigin } });
    assert.equal(local.status, 200);
    assert.equal(local.headers.get("access-control-allow-origin"), otherLocalOrigin);
  } finally {
    await close(server);
  }
});

test("http server does not expose internal error details", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-error-redaction-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const runtime = new SpeciesRoomRuntime({ ledgerPath: path.join(webRoot, "room-ledger.jsonl") });
  runtime.getState = async () => {
    throw new Error("sensitive internal stack marker");
  };
  const server = createSpeciesHttpServer({ webRoot, runtime });
  await listen(server);
  try {
    const response = await fetch(`${serverBaseUrl(server)}/api/room/state`);
    assert.equal(response.status, 500);
    const body = (await response.json()) as { error?: string };
    assert.equal(body.error, "Internal server error");
    assert.doesNotMatch(JSON.stringify(body), /sensitive internal stack marker/);
  } finally {
    await close(server);
  }
});

test("http runtime mode is explicit for live web sessions", async () => {
  assert.equal(resolveAgentRuntimeMode(["--live"], {}), "live");
  assert.equal(resolveAgentRuntimeMode(["--seed"], { SPECIES_AGENT_MODE: "live" }), "seed");
  assert.equal(resolveAgentRuntimeMode([], { SPECIES_AGENT_MODE: "live" }), "live");
  assert.equal(resolveAgentRuntimeMode([], {}), "seed");

  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-live-mode-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(webRoot, "room-ledger.jsonl"),
    liveAgents: true,
    smoke: async () => ({ generatedAt: new Date(0).toISOString(), memsuosConfigPath: "test", agents: [] }),
  });
  const server = createSpeciesHttpServer({ webRoot, runtime });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json() as { agentRuntimeMode?: string }).agentRuntimeMode, "live");

    const state = await fetch(`${baseUrl}/api/room/state`);
    assert.equal(state.status, 200);
    assert.equal((await state.json() as { agentRuntimeMode?: string }).agentRuntimeMode, "live");
  } finally {
    await close(server);
  }
});

test("http runtime refuses unauthenticated non-loopback binds by default", () => {
  assert.doesNotThrow(() => assertSafeHttpHost("127.0.0.1"));
  assert.doesNotThrow(() => assertSafeHttpHost("127.0.0.42"));
  assert.doesNotThrow(() => assertSafeHttpHost("::1"));
  assert.throws(() => assertSafeHttpHost("127.example.invalid"), /Refusing unauthenticated non-loopback bind/);
  assert.throws(() => assertSafeHttpHost("0.0.0.0"), /Refusing unauthenticated non-loopback bind/);
  assert.doesNotThrow(() => assertSafeHttpHost("0.0.0.0", true));
});

test("http topic discussion request posts explicit trigger message", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-topic-discussion-request-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(webRoot, "room-ledger.jsonl"),
    liveAgents: true,
    smoke: async () => ({ generatedAt: new Date(0).toISOString(), memsuosConfigPath: "test", agents: [] }),
    agentAdapterOptions: {
      kimiInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "topic discussion is optional" }),
      mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "topic discussion is optional" }),
    },
  });
  const server = createSpeciesHttpServer({ webRoot, runtime });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);
    const seed = await fetch(`${baseUrl}/api/room/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "Seed a topic for explicit human discussion request.",
        clientMessageId: "client_http_topic_discussion_seed",
      }),
    });
    assert.equal(seed.status, 200);
    const seeded = (await seed.json()) as { turn?: { topicId?: string } };
    const topicId = seeded.turn?.topicId;
    assert.ok(topicId);

    const request = await fetch(`${baseUrl}/api/room/topics/discussion-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topicId,
        clientMessageId: "client_http_topic_discussion_request",
        prompt: "Please discuss this human-selected topic, or stay silent.",
      }),
    });
    assert.equal(request.status, 200);
    const requested = (await request.json()) as {
      discussionRequestRef?: string;
      turn?: { topicId?: string; triggeringMessageEventId?: string };
    };
    assert.match(requested.discussionRequestRef ?? "", /^topic_discussion_/);
    assert.equal(requested.turn?.topicId, topicId);

    const eventsResponse = await fetch(`${baseUrl}/api/room/events`);
    const eventsJson = (await eventsResponse.json()) as { events?: { event_id: string; event_type: string; payload: unknown }[] };
    const events = eventsJson.events ?? [];
    assert.equal(events.some((event) => event.event_type === "topic.discussion_requested"), true);
    const trigger = events.find((event) => event.event_id === requested.turn?.triggeringMessageEventId);
    assert.equal(trigger?.event_type, "message.created");
    assert.equal((trigger?.payload as { topicId?: string; content?: string; contextRefs?: string[] }).topicId, topicId);
    assert.equal((trigger?.payload as { content?: string }).content?.includes(topicId), false);
    await waitForHttpRuntimeIdle(baseUrl);
  } finally {
    await close(server);
  }
});

test("http autonomy tick accepts idle social rhythm threshold", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-idle-social-rhythm-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(webRoot, "room-ledger.jsonl"),
    liveAgents: true,
    smoke: async () => ({ generatedAt: new Date(0).toISOString(), memsuosConfigPath: "test", agents: [] }),
    agentAdapterOptions: {
      kimiInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "idle talk is optional" }),
      mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "idle talk is optional" }),
    },
  });
  const server = createSpeciesHttpServer({ webRoot, runtime });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);
    const seed = await fetch(`${baseUrl}/api/room/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "A real room message should be re-woken by idle autonomy without a scripted room-rhythm message.",
        clientMessageId: "client_http_idle_social_seed",
        mentions: ["kimi_member_01"],
      }),
    });
    assert.equal(seed.status, 200);
    const seeded = (await seed.json()) as { turn?: { triggeringMessageEventId?: string } };
    await waitForHttpRuntimeIdle(baseUrl);

    const tick = await fetch(`${baseUrl}/api/room/autonomy/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        now: new Date(Date.now() + 1_000).toISOString(),
        date: "2026-06-21",
        timezone: "Asia/Shanghai",
        force: true,
        idleSocialAfterMs: 0,
      }),
    });
    assert.equal(tick.status, 200);
    const ticked = (await tick.json()) as { autonomyTick?: { action?: string; status?: string }; turn?: { invitedAgents?: string[] } };
    assert.equal(ticked.autonomyTick?.action, "idle_social_rhythm");
    assert.equal(ticked.autonomyTick?.status, "posted");
    assert.equal((ticked.turn?.invitedAgents ?? []).length > 0, true);
    assert.equal((ticked as { turn?: { triggeringMessageEventId?: string } }).turn?.triggeringMessageEventId, seeded.turn?.triggeringMessageEventId);
    const eventsResponse = await fetch(`${baseUrl}/api/room/events`);
    const eventsJson = (await eventsResponse.json()) as { events?: { event_type: string; payload: unknown }[] };
    assert.equal(
      (eventsJson.events ?? []).some(
        (event) => event.event_type === "message.created" && (event.payload as { author?: string }).author === "room_rhythm",
      ),
      false,
    );
    await waitForHttpRuntimeIdle(baseUrl);
  } finally {
    await close(server);
  }
});

test("http state exposes autonomy scheduler status when configured", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-autonomy-scheduler-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(webRoot, "room-ledger.jsonl"),
  });
  const autonomyScheduler = {
    getStatus: () => ({
      enabled: true,
      intervalMs: 60_000,
      memoryHygieneReviewAfterMs: 604_800_000,
      continuityReviewAfterMs: 604_800_000,
      silenceReentryAfterMs: 3_600_000,
      running: false,
      completedTickCount: 2,
      skippedOverlapCount: 1,
      overdueTickCount: 1,
      overrunTickCount: 1,
      errorCount: 0,
      nextTickDueAt: "2026-06-21T10:01:00.000Z",
      lastExpectedTickDueAt: "2026-06-21T10:00:00.000Z",
      lastScheduleDriftMs: 250,
      lastOverdueByMs: 250,
      lastDurationMs: 1200,
      lastOverrunByMs: 200,
      lastTickId: "autonomy_tick_http_scheduler",
      lastAction: "memory_hygiene_review" as const,
      lastStatus: "posted" as const,
      lastMessageEventId: "msg_scheduler_memory_hygiene",
      lastTargetRefs: ["memory_pending_http"],
      lastChoiceSetRefs: ["memory_pending_http", "memory_continuity_http"],
      lastChoiceSetOptionCount: 2,
      lastChoiceSetTargetRefs: ["memory_pending_http"],
      lastChoiceSetEvidenceRefs: ["memory_pending_http", "memory_continuity_http"],
      lastChoiceSetOptionsWithoutEvidenceRefs: [],
      lastChoiceSetTargetedOptionsWithoutTargetRefs: [],
      lastContextRefs: ["memory_pending_http"],
      lastEvidenceRefs: ["autonomy_tick_http_scheduler", "memory_pending_http", "msg_scheduler_memory_hygiene"],
      boundaryNote: "scheduler status test",
    }),
  };
  const server = createSpeciesHttpServer({ webRoot, runtime, autonomyScheduler });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);
    const health = await fetch(`${baseUrl}/api/health`);
    const healthJson = (await health.json()) as { autonomyScheduler?: { intervalMs?: number } };
    assert.equal(healthJson.autonomyScheduler?.intervalMs, 60_000);

    const state = await fetch(`${baseUrl}/api/room/state`);
    const stateJson = (await state.json()) as {
      autonomyScheduler?: {
        enabled?: boolean;
        completedTickCount?: number;
        skippedOverlapCount?: number;
        overdueTickCount?: number;
        overrunTickCount?: number;
        memoryHygieneReviewAfterMs?: number;
        continuityReviewAfterMs?: number;
        nextTickDueAt?: string;
        lastExpectedTickDueAt?: string;
        lastScheduleDriftMs?: number;
        lastOverdueByMs?: number;
        lastDurationMs?: number;
        lastOverrunByMs?: number;
        lastTickId?: string;
        lastAction?: string;
        lastTargetRefs?: string[];
        lastChoiceSetRefs?: string[];
        lastChoiceSetOptionCount?: number;
        lastChoiceSetTargetRefs?: string[];
        lastChoiceSetEvidenceRefs?: string[];
        lastChoiceSetOptionsWithoutEvidenceRefs?: string[];
        lastChoiceSetTargetedOptionsWithoutTargetRefs?: string[];
        lastContextRefs?: string[];
        lastEvidenceRefs?: string[];
      };
    };
    assert.equal(stateJson.autonomyScheduler?.enabled, true);
    assert.equal(stateJson.autonomyScheduler?.completedTickCount, 2);
    assert.equal(stateJson.autonomyScheduler?.skippedOverlapCount, 1);
    assert.equal(stateJson.autonomyScheduler?.overdueTickCount, 1);
    assert.equal(stateJson.autonomyScheduler?.overrunTickCount, 1);
    assert.equal(stateJson.autonomyScheduler?.memoryHygieneReviewAfterMs, 604_800_000);
    assert.equal(stateJson.autonomyScheduler?.continuityReviewAfterMs, 604_800_000);
    assert.equal(stateJson.autonomyScheduler?.nextTickDueAt, "2026-06-21T10:01:00.000Z");
    assert.equal(stateJson.autonomyScheduler?.lastExpectedTickDueAt, "2026-06-21T10:00:00.000Z");
    assert.equal(stateJson.autonomyScheduler?.lastScheduleDriftMs, 250);
    assert.equal(stateJson.autonomyScheduler?.lastOverdueByMs, 250);
    assert.equal(stateJson.autonomyScheduler?.lastDurationMs, 1200);
    assert.equal(stateJson.autonomyScheduler?.lastOverrunByMs, 200);
    assert.equal(stateJson.autonomyScheduler?.lastTickId, "autonomy_tick_http_scheduler");
    assert.equal(stateJson.autonomyScheduler?.lastAction, "memory_hygiene_review");
    assert.deepEqual(stateJson.autonomyScheduler?.lastTargetRefs, ["memory_pending_http"]);
    assert.deepEqual(stateJson.autonomyScheduler?.lastChoiceSetRefs, ["memory_pending_http", "memory_continuity_http"]);
    assert.equal(stateJson.autonomyScheduler?.lastChoiceSetOptionCount, 2);
    assert.deepEqual(stateJson.autonomyScheduler?.lastChoiceSetTargetRefs, ["memory_pending_http"]);
    assert.deepEqual(stateJson.autonomyScheduler?.lastChoiceSetEvidenceRefs, ["memory_pending_http", "memory_continuity_http"]);
    assert.deepEqual(stateJson.autonomyScheduler?.lastChoiceSetOptionsWithoutEvidenceRefs, []);
    assert.deepEqual(stateJson.autonomyScheduler?.lastChoiceSetTargetedOptionsWithoutTargetRefs, []);
    assert.deepEqual(stateJson.autonomyScheduler?.lastContextRefs, ["memory_pending_http"]);
    assert.deepEqual(stateJson.autonomyScheduler?.lastEvidenceRefs, [
      "autonomy_tick_http_scheduler",
      "memory_pending_http",
      "msg_scheduler_memory_hygiene",
    ]);
  } finally {
    await close(server);
  }
});

test("http state exposes latest long-run operational summary", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-long-run-summary-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const harnessReportDir = path.join(webRoot, "harness");
  const checkedAt = new Date().toISOString();
  await mkdir(harnessReportDir);
  await writeFile(
    path.join(harnessReportDir, "long-run-report.json"),
    JSON.stringify({
      operationalSummary: {
        status: "fail",
        checkedAt,
        passedDomainCount: 8,
        failedDomainCount: 1,
        evidenceRefCount: 3,
        evidenceRefs: ["evt_forced_speech", "evt_context_visible", "memory_reviewed", "sk-fixture-not-a-real-key-1234567890"],
        domains: [
          {
            key: "workflow_drift",
            label: "Workflow drift guard",
            ok: false,
            metrics: {
              forcedSpeechMarkers: 1,
              diagnostic: "Authorization: Bearer sk-fixture-not-a-real-key-1234567890",
              ignoredNested: { unsafe: true },
            },
            evidenceRefs: ["evt_forced_speech", "sk-fixture-not-a-real-key-1234567890"],
            gaps: [
              "workflow drift: forced speech markers appeared",
              "Authorization: Bearer sk-fixture-not-a-real-key-1234567890",
            ],
          },
          {
            key: "action_boundary",
            label: "Action boundary evidence",
            ok: true,
            metrics: { sideEffectRequests: 1, unapprovedResults: 0 },
            evidenceRefs: ["sidefx_action_boundary"],
            gaps: [],
          },
          {
            key: "silence_reentry",
            label: "Silence re-entry evidence",
            ok: true,
            metrics: { silenceReentryActions: 1, quietAnchorRefs: 2, silenceReentryGaps: 0 },
            evidenceRefs: ["evt_silence_reentry"],
            gaps: [],
          },
          {
            key: "context_visibility",
            label: "Co-visible context",
            ok: true,
            metrics: { coVisibleAuditCount: 1 },
            evidenceRefs: ["evt_context_visible", "memory_reviewed"],
            gaps: [],
          },
          ...Array.from({ length: 11 }, (_, index) => ({
            key: index === 10 ? "evidence_sediment" : `extra_long_run_domain_${index}`,
            label: index === 10 ? "Ledger-backed sediment" : `Extra long-run domain ${index}`,
            ok: true,
            metrics: { index },
            evidenceRefs: [`evt_extra_long_run_${index}`],
            gaps: [],
          })),
        ],
      },
    }),
  );
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(webRoot, "room-ledger.jsonl"),
  });
  const server = createSpeciesHttpServer({ webRoot, runtime, harnessReportDir });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);
    const state = await fetch(`${baseUrl}/api/room/state`);
    assert.equal(state.status, 200);
    const stateJson = (await state.json()) as {
      longRunOperationalSummary?: {
        status?: string;
        checkedAt?: string;
        reportFile?: string;
        reportModifiedAt?: string;
        freshness?: { status?: string; ageMs?: number; staleAfterMs?: number; anchorAt?: string };
        passedDomainCount?: number;
        failedDomainCount?: number;
        evidenceRefs?: string[];
        domains?: { key?: string; ok?: boolean; metrics?: Record<string, unknown>; evidenceRefs?: string[]; gaps?: string[] }[];
      };
    };
    const summary = stateJson.longRunOperationalSummary;
    assert.equal(summary?.status, "fail");
    assert.equal(summary?.checkedAt, checkedAt);
    assert.equal(summary?.reportFile, "long-run-report.json");
    assert.match(summary?.reportModifiedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(summary?.freshness?.status, "fresh");
    assert.equal(typeof summary?.freshness?.ageMs, "number");
    assert.equal(summary?.freshness?.staleAfterMs, 24 * 60 * 60 * 1000);
    assert.equal(summary?.freshness?.anchorAt, checkedAt);
    assert.equal(summary?.passedDomainCount, 8);
    assert.equal(summary?.failedDomainCount, 1);
    assert.deepEqual(summary?.evidenceRefs, ["evt_forced_speech", "evt_context_visible", "memory_reviewed"]);
    assert.equal(summary?.domains?.length, 15);
    assert.equal(summary?.domains?.[0]?.key, "workflow_drift");
    assert.equal(summary?.domains?.[0]?.ok, false);
    assert.deepEqual(summary?.domains?.[0]?.metrics, { forcedSpeechMarkers: 1, diagnostic: "[redacted]" });
    assert.deepEqual(summary?.domains?.[0]?.evidenceRefs, ["evt_forced_speech"]);
    assert.deepEqual(summary?.domains?.[0]?.gaps, ["workflow drift: forced speech markers appeared"]);
    assert.equal(summary?.domains?.[1]?.key, "action_boundary");
    assert.deepEqual(summary?.domains?.[1]?.evidenceRefs, ["sidefx_action_boundary"]);
    assert.equal(summary?.domains?.[2]?.key, "silence_reentry");
    assert.deepEqual(summary?.domains?.[2]?.evidenceRefs, ["evt_silence_reentry"]);
    assert.equal(summary?.domains?.[14]?.key, "evidence_sediment");
    assert.deepEqual(summary?.domains?.[14]?.evidenceRefs, ["evt_extra_long_run_10"]);
  } finally {
    await close(server);
  }
});

test("http state marks stale long-run operational summaries", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-stale-long-run-summary-"));
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>species</title>");
  const harnessReportDir = path.join(webRoot, "harness");
  await mkdir(harnessReportDir);
  await writeFile(
    path.join(harnessReportDir, "long-run-stale.json"),
    JSON.stringify({
      operationalSummary: {
        status: "pass",
        checkedAt: "2000-01-01T00:00:00.000Z",
        passedDomainCount: 9,
        failedDomainCount: 0,
        evidenceRefCount: 1,
        evidenceRefs: ["evt_old_context"],
        domains: [
          {
            key: "context_visibility",
            label: "Co-visible context",
            ok: true,
            metrics: { coVisibleAuditCount: 1 },
            evidenceRefs: ["evt_old_context"],
            gaps: [],
          },
        ],
      },
    }),
  );
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(webRoot, "room-ledger.jsonl"),
  });
  const server = createSpeciesHttpServer({
    webRoot,
    runtime,
    harnessReportDir,
    harnessReportStaleAfterMs: 1,
  });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);
    const state = await fetch(`${baseUrl}/api/room/state`);
    assert.equal(state.status, 200);
    const stateJson = (await state.json()) as { longRunOperationalSummary?: { freshness?: { status?: string; anchorAt?: string } } };
    assert.equal(stateJson.longRunOperationalSummary?.freshness?.status, "stale");
    assert.equal(stateJson.longRunOperationalSummary?.freshness?.anchorAt, "2000-01-01T00:00:00.000Z");
  } finally {
    await close(server);
  }
});

test("http static server keeps paths inside web root", async () => {
  const webRoot = await mkdtemp(path.join(tmpdir(), "species-web-static-"));
  await writeFile(path.join(webRoot, "index.html"), "ok");
  const server = createSpeciesHttpServer({ webRoot });
  await listen(server);
  try {
    const baseUrl = serverBaseUrl(server);

    const index = await fetch(`${baseUrl}/`);
    assert.equal(index.status, 200);
    assert.equal(await index.text(), "ok");

    const slashTraversal = await fetch(`${baseUrl}/%2e%2e/package.json`);
    assert.equal(slashTraversal.status, 404);

    const windowsTraversal = await fetch(`${baseUrl}/..%5cpackage.json`);
    assert.equal(windowsTraversal.status, 403);
  } finally {
    await close(server);
  }
});

async function listen(server: ReturnType<typeof createSpeciesHttpServer>): Promise<void> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}

function serverBaseUrl(server: ReturnType<typeof createSpeciesHttpServer>): string {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function waitForHttpRuntimeIdle(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const state = await fetch(`${baseUrl}/api/room/state`);
    const stateJson = (await state.json()) as { metrics?: [string, string][] };
    const active = stateJson.metrics?.find(([, label]) => label === "active background turns")?.[0];
    if (active === "0") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("runtime background turns did not become idle");
}

async function close(server: ReturnType<typeof createSpeciesHttpServer>): Promise<void> {
  server.close();
  await once(server, "close");
}
