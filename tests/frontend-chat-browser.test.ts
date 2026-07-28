import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { chromium, type Browser, type Page } from "playwright-core";

import { type ProviderIntentionRequest, type ProviderInvoker } from "../src/agents/live";
import { type AgentSmokeReport, type AgentSmokeResult } from "../src/agents/smoke";
import { RoomLedger } from "../src/kernel/ledger";
import { createSpeciesHttpServer } from "../src/server/http";
import { SpeciesRoomRuntime } from "../src/server/runtime";

test("frontend browser flow sends messages, carries refs, and surfaces new-message jump", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-browser-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 smoke_ready");
    await waitForText(page, "#messageList", "房间已准备好");
    assert.equal(await page.locator(".message-row.system").count(), 0);
    assert.equal((await page.locator("#messageList").textContent())?.includes("Room Kernel"), false);
    assert.equal(await page.locator("#addContextButton").isDisabled(), true);
    assert.equal(await page.locator("#overviewToggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#overviewPanel").evaluate((element) => (element as HTMLElement).hidden), true);
    await page.locator("#overviewToggle").click();
    assert.equal(await page.locator("#overviewToggle").getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#overviewPanel").evaluate((element) => (element as HTMLElement).hidden), false);
    await page.locator("#overviewToggle").click();
    assert.equal(await page.locator("#overviewToggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#overviewPanel").evaluate((element) => (element as HTMLElement).hidden), true);
    await verifySettingsFocusBoundary(page);

    await page.fill("#messageInput", "@kimi");
    await page.waitForFunction(() => document.querySelector("#mentionPopover")?.hasAttribute("hidden") === false);
    assert.equal(await page.locator(".mention-option .avatar-fallback").count(), 2);
    await page.press("#messageInput", "ArrowDown");
    await page.waitForFunction(() => document.querySelector(".mention-option.active")?.textContent?.includes("kimi-k2.7-code"));
    await page.press("#messageInput", "Enter");
    await page.waitForFunction(() => {
      const input = document.querySelector<HTMLTextAreaElement>("#messageInput");
      return input?.value === "@kimi_member_02 ";
    });
    assert.equal(await page.locator("#mentionPopover").evaluate((element) => (element as HTMLElement).hidden), true);
    await page.fill("#messageInput", "");

    const firstText = `browser-flow-send-${Date.now()} 消息应该通过真实 HTTP runtime 写入内部房间记录。`;
    await page.fill("#messageInput", firstText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, firstText);
    await page.waitForFunction(() => document.querySelectorAll(".message-row.agent").length >= 4);
    assert.equal(await page.locator(".message-row.agent .avatar-fallback").count() >= 4, true);
    assert.equal(await page.locator(".message-row.system").count(), 0);
    assert.equal(await page.locator("#addContextButton").isDisabled(), false);
    const messageListText = (await page.locator("#messageList").textContent()) ?? "";
    assert.equal(messageListText.includes("Room Ledger"), false);
    assert.equal(messageListText.includes("Room Rhythm"), false);
    assert.doesNotMatch(messageListText, /\b(?:evt|question|topic)_[a-z0-9_:-]+\b/i);
    assert.equal(
      (await roomState(baseUrl)).messages?.some((message) => message.authorKind === "system"),
      true,
    );
    await page.waitForFunction(() => {
      const text = document.querySelector("#timelinePreview")?.textContent ?? "";
      return (
        text.includes("ledger timeline") &&
        text.includes("events") &&
        text.includes("msg") &&
        text.includes("rhythm") &&
        text.includes("archive") &&
        text.includes("social") &&
        text.includes("memory") &&
        text.includes("continuity") &&
        text.includes("provider") &&
        text.includes("contest")
      );
    });
    await page.waitForFunction(() => (document.querySelector("#evidenceStrip")?.textContent ?? "").includes("co-visible"));
    await verifyContextAuditCards(page);

    const firstAgentMessage = page.locator(".message-row.agent").first();
    await firstAgentMessage.locator("[data-message-action='more']").click();
    await page.locator(".message-overflow-menu [data-message-menu-action='context']").click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    assert.equal(await page.locator(".message-row.context-selected").count(), 1);

    await firstAgentMessage.locator("[data-message-action='more']").click();
    await page.locator(".message-overflow-menu [data-message-menu-action='reply']").click();
    await page.waitForFunction(() => {
      const input = document.querySelector<HTMLTextAreaElement>("#messageInput");
      return Boolean(input?.value.includes("@"));
    });

    const replyText = `browser-flow-reply-${Date.now()} 这条回复必须携带前端选择的 context ref。`;
    await page.locator("#messageInput").pressSequentially(replyText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, replyText);

    const replyEvent = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        typeof event.payload?.content === "string" &&
        event.payload.content.includes(replyText),
    );
    assert.ok(replyEvent.payload);
    assert.equal(Array.isArray(replyEvent.payload.contextRefs) && replyEvent.payload.contextRefs.length > 0, true);
    assert.equal(Array.isArray(replyEvent.payload.mentions) && replyEvent.payload.mentions.length > 0, true);

    const longText = `browser-flow-long-${Date.now()} ${"自治生活室需要长消息仍然留在气泡内部滚动。".repeat(80)}`;
    await page.fill("#messageInput", longText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, "browser-flow-long-");
    await page.waitForFunction(() => document.querySelectorAll(".message-row.user .message-text.scrollable").length > 0);
    assert.equal(await page.locator(".message-row.user .message-text.scrollable").count() > 0, true);
    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await page.waitForFunction(() => {
      const list = document.querySelector<HTMLElement>("#messageList");
      return Boolean(list && list.scrollHeight > list.clientHeight + 120);
    });

    await page.evaluate(() => {
      const list = document.querySelector<HTMLElement>("#messageList");
      if (list) list.scrollTop = 0;
      const jump = document.querySelector<HTMLElement>("#newMessageJump");
      if (jump) jump.hidden = true;
    });
    await page.waitForFunction(() => {
      const list = document.querySelector<HTMLElement>("#messageList");
      return Boolean(list && list.scrollTop < 4 && list.scrollHeight - list.clientHeight > 96);
    });
    const remoteText = `browser-flow-remote-${Date.now()} 这条外部写入用于验证新消息跳转。`;
    await postRoomMessage(baseUrl, remoteText);
    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#newMessageJump")?.hidden === false);
    await page.locator("#newMessageJump").click();
    await page.waitForFunction(() => {
      const list = document.querySelector<HTMLElement>("#messageList");
      return Boolean(list && list.scrollHeight - list.scrollTop - list.clientHeight < 4);
    });
    assert.equal(await page.locator("#newMessageJump").evaluate((element) => (element as HTMLElement).hidden), true);

    await verifyArchiveReviewControls(page, baseUrl);
    await verifyRoomRhythmOverviewRefs(page, baseUrl);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend polls room state for external messages without manual refresh", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-polling-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#messageList", "房间已准备好");

    const remoteText = `browser-flow-poll-${Date.now()} 这条外部写入不需要刷新页面也应该出现。`;
    await postRoomMessage(baseUrl, remoteText);
    await waitForMessage(page, remoteText);
    assert.equal((await page.locator("#messageList").textContent())?.includes(remoteText), true);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend overview surfaces long-run operational readiness", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-long-run-readiness-"));
  const harnessReportDir = path.join(dir, "harness");
  await mkdir(harnessReportDir);
  await writeFile(
    path.join(harnessReportDir, "long-run-readiness.json"),
    JSON.stringify({
      operationalSummary: {
        status: "fail",
        checkedAt: "2000-01-01T00:00:00.000Z",
        passedDomainCount: 14,
        failedDomainCount: 1,
        evidenceRefCount: 3,
        evidenceRefs: ["evt_forced_speech", "evt_context_visible", "memory_reviewed"],
        domains: [
          {
            key: "duration_window",
            label: "20-60 minute run window",
            ok: true,
            metrics: {
              requestedMs: 1_500_000,
              observedMs: 1_420_000,
              requestedWithinWindow: true,
              observedAtLeastMin: true,
            },
            evidenceRefs: [],
            gaps: [],
          },
          {
            key: "workflow_drift",
            label: "Workflow drift guard",
            ok: false,
            metrics: { forbiddenSchedulerEvents: 0, forcedSpeechMarkers: 1, sideEffectExecutions: 0 },
            evidenceRefs: ["evt_forced_speech"],
            gaps: ["workflow drift: forced speech markers appeared"],
          },
          {
            key: "action_boundary",
            label: "Action boundary evidence",
            ok: true,
            metrics: {
              sideEffectRequests: 1,
              sideEffectReviews: 1,
              sideEffectApprovals: 0,
              sideEffectDenials: 0,
              sideEffectExpiries: 0,
              sideEffectResults: 0,
              unapprovedResults: 0,
              capabilityInvocations: 1,
              capabilityResults: 1,
              workspaceArtifacts: 1,
              workspaceReviews: 1,
              skillCapsuleReviews: 1,
              capabilityReviews: 1,
              contextBoundaryRefs: 4,
              actionBoundaryGaps: 0,
            },
            evidenceRefs: [
              "sidefx_action_boundary_001",
              "side_effect_review_action_boundary_001",
              "evt_capability_action_boundary_001",
              "artifact_action_boundary_001",
              "skill_capsule_review_action_boundary_001",
              "capability_review_action_boundary_001",
            ],
            gaps: [],
          },
          {
            key: "speech_monopoly",
            label: "Speech balance",
            ok: true,
            metrics: {
              totalAgentMessages: 12,
              activeSpeakers: 3,
              minimumActiveSpeakers: 2,
              maxSpeaker: "mimo_member_01",
              maxSpeakerShare: 0.42,
              maxSpeakerShareThreshold: 0.65,
              speakerBalanceGaps: 0,
              deferredSpeeches: 1,
              deferredSpeechIntentions: 1,
              deferredRecoveryContextRefs: 2,
              deferredRecoveryGaps: 0,
            },
            evidenceRefs: ["msg_agent_balance_001", "msg_agent_balance_002", "evt_deferred_speech_001"],
            gaps: [],
          },
          {
            key: "autonomy_rhythm_balance",
            label: "Autonomy rhythm balance",
            ok: true,
            metrics: {
              consideredActions: 7,
              distinctActions: 5,
              dominantAction: "archive_and_invite_review",
              dominantActionShare: 0.29,
            },
            evidenceRefs: ["evt_rhythm_balance_001", "evt_rhythm_balance_002"],
            gaps: [],
          },
          {
            key: "context_visibility",
            label: "Co-visible context",
            ok: true,
            metrics: {
              auditCount: 5,
              coVisibleAuditCount: 2,
              coVisibleDomains: 5,
              coVisibleContextRefs: 7,
              socialLineageRefs: 3,
              criticalFragmentGaps: 0,
            },
            evidenceRefs: ["packet_context_visible", "archive_context_visible", "memory_reviewed", "social_lineage_visible"],
            gaps: [],
          },
          {
            key: "scheduler_continuity",
            label: "Scheduler continuity",
            ok: true,
            metrics: {
              samples: 4,
              maxDriftMs: 1200,
              maxDurationMs: 3400,
              maxOverrunMs: 0,
              overdueTicks: 0,
              overrunTicks: 0,
            },
            evidenceRefs: ["autonomy_tick_cadence_001", "evt_scheduler_tick_001"],
            gaps: [],
          },
          {
            key: "long_term_rhythm",
            label: "Long-term rhythm coverage",
            ok: true,
            metrics: {
              archiveActions: 2,
              memoryHygieneActions: 1,
              continuityReviewActions: 1,
              providerBoundaryReviewActions: 1,
              idleSocialActions: 1,
              idleSocialTargets: 2,
              idleSocialEvidenceRefs: 2,
              preservedSilenceActions: 2,
              choiceSetTargetRefs: 6,
              choiceSetEvidenceRefs: 8,
              choiceSetGaps: 0,
            },
            evidenceRefs: [
              "evt_archive_rhythm_long_run_001",
              "evt_memory_hygiene_long_run_001",
              "evt_continuity_review_long_run_001",
              "evt_provider_review_long_run_001",
            ],
            gaps: [],
          },
          {
            key: "silence_reentry",
            label: "Silence re-entry evidence",
            ok: true,
            metrics: {
              configuredSilenceReentryMs: 300000,
              silenceReentryActions: 1,
              reentryMessages: 1,
              quietAnchorRefs: 2,
              archiveRefs: 1,
              evidenceRefs: 3,
              missingAnchorActions: 0,
              preservedSilenceAnchorRefs: 1,
              missingPreservedSilenceActions: 0,
              preservedSilenceActions: 2,
              deliberateSilenceIntentions: 2,
              silenceReentryGaps: 0,
            },
            evidenceRefs: [
              "evt_silence_reentry_long_run_001",
              "msg_quiet_anchor_long_run_001",
              "archive_silence_long_run_001",
              "evt_preserved_silence_long_run_001",
            ],
            gaps: [],
          },
          {
            key: "archive_rhythm",
            label: "Archive rhythm evidence",
            ok: true,
            metrics: {
              archiveEvents: 2,
              archiveRefs: 2,
              ledgerEvidenceRefs: 6,
              archivesWithContinuity: 1,
              archivedContinuityItems: 2,
              acceptedArchivedContinuityItems: 2,
              archiveActions: 2,
              archiveReviewActions: 1,
              archiveActionMessages: 2,
              archiveActionArchives: 2,
              archiveReviewRequests: 2,
              archiveActionEvidenceRefs: 5,
              archiveReviewLedgerEvents: 1,
              acceptedMemoryArchives: 1,
              acceptedMemoryArchiveEvidenceRefs: 3,
              acceptedMemoryArchivesWithoutEvidence: 0,
              archiveEvidenceGaps: 0,
            },
            evidenceRefs: [
              "archive_rhythm_domain_long_run_001",
              "archive_review_request_long_run_001",
              "archive_ledger_evidence_long_run_001",
            ],
            gaps: [],
          },
          {
            key: "memory_contest",
            label: "Memory contest evidence",
            ok: true,
            metrics: {
              memoryProposals: 2,
              memoryAcceptances: 1,
              memoryContests: 1,
              memoryReviews: 1,
              reviewedMemoryRefs: 2,
              memoryPressureEvents: 1,
              memoryHygieneActions: 1,
              memoryHygieneTargets: 2,
              memoryHygieneEvidenceRefs: 3,
              acceptedWithoutEvidence: 0,
              acceptedWithoutReview: 0,
              personaLikeMemory: 0,
              acceptedPersonaLikeMemory: 0,
              acceptedMemoryArchives: 1,
              acceptedMemoryArchiveEvidenceRefs: 3,
              acceptedMemoryArchivesWithoutEvidence: 0,
              contestEvidenceGaps: 0,
            },
            evidenceRefs: [
              "memory_claim_long_run_001",
              "evt_memory_contested_long_run_001",
              "evt_memory_reviewed_long_run_001",
              "evt_memory_hygiene_long_run_001",
              "daily_archive_long_run_001",
            ],
            gaps: [],
          },
          {
            key: "agent_continuity",
            label: "Agent continuity evidence",
            ok: true,
            metrics: {
              personaDeltas: 3,
              acceptedPersonaDeltas: 2,
              roleClaims: 1,
              acceptedRoleClaims: 1,
              dailyMoodRecords: 1,
              acceptedDailyMoods: 1,
              continuityReviewActions: 1,
              continuityReviewTargets: 2,
              archivedContinuityItems: 2,
              acceptedArchivedContinuityItems: 2,
              archiveContinuityEvidenceRefs: 4,
              archiveContinuityResponseRefs: 2,
              continuityEvidenceGaps: 0,
            },
            evidenceRefs: [
              "persona_delta_long_run_001",
              "role_claim_long_run_001",
              "daily_mood_long_run_001",
              "evt_continuity_review_long_run_001",
            ],
            gaps: [],
          },
          {
            key: "autonomous_social_loop",
            label: "Autonomous social loop",
            ok: true,
            metrics: {
              choiceCount: 9,
              roomRhythmMessages: 3,
              invitations: 2,
              questions: 1,
              handoffs: 1,
              reviews: 3,
              silenceChoices: 2,
              requiredChoiceKinds: 5,
              coveredChoiceKinds: 5,
              missingChoiceKinds: "none",
              choiceCoverageGaps: 0,
              requiredRoomEventPressureKinds: 9,
              coveredRoomEventPressureKinds: 9,
              missingRoomEventPressureKinds: "none",
              roomEventPressureCoverageGaps: 0,
              roomEventPressureRefs: 9,
              choicesWithoutRoomEventPressureRefs: 0,
              archivePressureChoices: 1,
              memoryPressureChoices: 1,
              continuityPressureChoices: 1,
              providerBoundaryPressureChoices: 1,
              openQuestionPressureChoices: 1,
              handoffPressureChoices: 1,
              invitationPressureChoices: 1,
              silenceReentryPressureChoices: 1,
              idleSocialPressureChoices: 1,
              choiceSilenceWindows: 7,
              cleanChoiceSilenceWindows: 7,
              interruptedSilenceWindows: 0,
              interruptingUserMessages: 0,
              choicesAfterUserSilence: 7,
              interruptedChoices: 0,
              lineageGaps: 0,
            },
            evidenceRefs: [
              "evt_room_rhythm_social_001",
              "evt_autonomy_pressure_social_001",
              "invitation_social_long_run_001",
              "question_social_long_run_001",
              "handoff_social_long_run_001",
            ],
            gaps: [],
          },
          {
            key: "provider_boundary",
            label: "Provider boundary evidence",
            ok: true,
            metrics: {
              degradations: 1,
              boundaryRefs: 1,
              choicePressureRefs: 4,
              requiredChoicePressureKinds: 5,
              coveredChoicePressureKinds: 5,
              missingChoicePressureKinds: "none",
              choicePressureCoverageGaps: 0,
              repairPressureRefs: 1,
              retryPressureRefs: 1,
              silencePressureRefs: 1,
              contestedMemoryPressureRefs: 1,
              archiveCarryoverPressureRefs: 1,
              carriedAcrossArchives: true,
              secretLikeDiagnostics: 0,
            },
            evidenceRefs: [
              "evt_provider_degraded_long_run_001",
              "provider_boundary_long_run_001",
              "provider_choice_pressure_long_run_001",
              "archive_provider_carryover_long_run_001",
            ],
            gaps: [],
          },
          {
            key: "evidence_sediment",
            label: "Ledger-backed sediment",
            ok: true,
            metrics: {
              memoryProposals: 2,
              memoryContests: 1,
              personaLikeMemory: 0,
              acceptedPersonaLikeMemory: 0,
              acceptedWithoutReview: 0,
              memoryReviewTraces: 2,
              memoryPressureEvents: 1,
              personaDeltas: 3,
              roleClaims: 1,
              dailyMoodRecords: 1,
              continuityEvidenceRefs: 4,
              continuityResponseRefs: 2,
              continuityEvidenceGaps: 0,
              archivedContinuityItems: 2,
              archiveEvents: 1,
              acceptedMemoryArchives: 1,
              acceptedMemoryArchiveEvidenceRefs: 3,
              acceptedMemoryArchivesWithoutEvidence: 0,
            },
            evidenceRefs: [
              "memory_claim_long_run_001",
              "evt_memory_contested_long_run_001",
              "persona_delta_long_run_001",
              "daily_archive_long_run_001",
            ],
            gaps: [],
          },
        ],
      },
    }),
  );
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
    harnessReportDir,
    harnessReportStaleAfterMs: 1,
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await page.locator("#overviewToggle").click();
    await waitForText(page, "#longRunReadinessCount", "stale");
    const previewText = await page.locator("#longRunReadinessPreview").textContent();
    assert.match(previewText ?? "", /stale long-run report/);
    assert.match(previewText ?? "", /stale report/);
    assert.match(previewText ?? "", /Workflow drift guard/);
    assert.match(previewText ?? "", /long-run-readiness\.json/);
    assert.equal(await page.locator("#longRunReadinessPreview .long-run-readiness-state.stale").textContent(), "stale report");
    assert.equal(await page.locator("#longRunReadinessPreview .long-run-domain.gap").textContent(), "workflow");
    assert.equal(
      await page.locator("#longRunReadinessPreview .long-run-domain.ok", { hasText: "context" }).textContent(),
      "context",
    );
    const runBalanceText = await page.locator("#longRunReadinessPreview .long-run-run-balance").textContent();
    assert.match(runBalanceText ?? "", /run balance/);
    assert.match(runBalanceText ?? "", /run/);
    assert.match(runBalanceText ?? "", /window/);
    assert.match(runBalanceText ?? "", /observed/);
    assert.match(runBalanceText ?? "", /actions/);
    assert.match(runBalanceText ?? "", /dominant/);
    await page.locator(`#longRunReadinessPreview [data-long-run-readiness-ref="evt_rhythm_balance_001"]`).click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const guardrailText = await page.locator("#longRunReadinessPreview .long-run-guardrails").textContent();
    assert.match(guardrailText ?? "", /guardrails/);
    assert.match(guardrailText ?? "", /forced/);
    assert.match(guardrailText ?? "", /sidefx/);
    assert.match(guardrailText ?? "", /scheduler/);
    assert.match(guardrailText ?? "", /messages/);
    assert.match(guardrailText ?? "", /speakers/);
    assert.match(guardrailText ?? "", /max share/);
    assert.match(guardrailText ?? "", /balance/);
    assert.match(guardrailText ?? "", /deferred/);
    assert.match(guardrailText ?? "", /recovery/);
    assert.match(guardrailText ?? "", /recovery gaps/);
    await page.locator(`#longRunReadinessPreview [data-long-run-readiness-ref="evt_forced_speech"]`).click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const actionText = await page.locator("#longRunReadinessPreview .long-run-action-boundary").textContent();
    assert.match(actionText ?? "", /actions/);
    assert.match(actionText ?? "", /sidefx/);
    assert.match(actionText ?? "", /reviews/);
    assert.match(actionText ?? "", /results/);
    assert.match(actionText ?? "", /unapproved/);
    assert.match(actionText ?? "", /capability/);
    assert.match(actionText ?? "", /workspace/);
    assert.match(actionText ?? "", /skill/);
    assert.match(actionText ?? "", /context/);
    assert.match(actionText ?? "", /gaps/);
    await page.locator(`#longRunReadinessPreview [data-long-run-readiness-ref="sidefx_action_boundary_001"]`).click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const schedulerText = await page.locator("#longRunReadinessPreview .long-run-scheduler-continuity").textContent();
    assert.match(schedulerText ?? "", /scheduler/);
    assert.match(schedulerText ?? "", /4/);
    assert.match(schedulerText ?? "", /max drift/);
    assert.match(schedulerText ?? "", /max run/);
    await page.locator(`#longRunReadinessPreview [data-long-run-readiness-ref="autonomy_tick_cadence_001"]`).click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const longRhythmText = await page.locator("#longRunReadinessPreview .long-run-long-rhythm").textContent();
    assert.match(longRhythmText ?? "", /long rhythm/);
    assert.match(longRhythmText ?? "", /archive/);
    assert.match(longRhythmText ?? "", /memory/);
    assert.match(longRhythmText ?? "", /continuity/);
    assert.match(longRhythmText ?? "", /provider/);
    assert.match(longRhythmText ?? "", /idle/);
    assert.match(longRhythmText ?? "", /idle refs/);
    assert.match(longRhythmText ?? "", /silence/);
    assert.match(longRhythmText ?? "", /targets/);
    assert.match(longRhythmText ?? "", /evidence/);
    assert.match(longRhythmText ?? "", /gaps/);
    await page
      .locator(`#longRunReadinessPreview .long-run-long-rhythm [data-long-run-readiness-ref="evt_archive_rhythm_long_run_001"]`)
      .click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const silenceText = await page.locator("#longRunReadinessPreview .long-run-silence-reentry").textContent();
    assert.match(silenceText ?? "", /silence/);
    assert.match(silenceText ?? "", /threshold/);
    assert.match(silenceText ?? "", /re-entry/);
    assert.match(silenceText ?? "", /messages/);
    assert.match(silenceText ?? "", /anchors/);
    assert.match(silenceText ?? "", /archive/);
    assert.match(silenceText ?? "", /evidence/);
    assert.match(silenceText ?? "", /linked silence/);
    assert.match(silenceText ?? "", /preserved/);
    assert.match(silenceText ?? "", /intentions/);
    assert.match(silenceText ?? "", /gaps/);
    await page
      .locator(`#longRunReadinessPreview .long-run-silence-reentry [data-long-run-readiness-ref="evt_silence_reentry_long_run_001"]`)
      .click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const archiveRhythmText = await page.locator("#longRunReadinessPreview .long-run-archive-rhythm").textContent();
    assert.match(archiveRhythmText ?? "", /archive/);
    assert.match(archiveRhythmText ?? "", /events/);
    assert.match(archiveRhythmText ?? "", /ledger/);
    assert.match(archiveRhythmText ?? "", /actions/);
    assert.match(archiveRhythmText ?? "", /reviews/);
    assert.match(archiveRhythmText ?? "", /continuity/);
    assert.match(archiveRhythmText ?? "", /accepted/);
    assert.match(archiveRhythmText ?? "", /memory/);
    assert.match(archiveRhythmText ?? "", /evidence/);
    assert.match(archiveRhythmText ?? "", /gaps/);
    await page
      .locator(`#longRunReadinessPreview .long-run-archive-rhythm [data-long-run-readiness-ref="archive_rhythm_domain_long_run_001"]`)
      .click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const memoryContestText = await page.locator("#longRunReadinessPreview .long-run-memory-contest").textContent();
    assert.match(memoryContestText ?? "", /memory contest/);
    assert.match(memoryContestText ?? "", /proposals/);
    assert.match(memoryContestText ?? "", /accepted/);
    assert.match(memoryContestText ?? "", /reviews/);
    assert.match(memoryContestText ?? "", /pressure/);
    assert.match(memoryContestText ?? "", /hygiene/);
    assert.match(memoryContestText ?? "", /targets/);
    assert.match(memoryContestText ?? "", /evidence/);
    assert.match(memoryContestText ?? "", /archive/);
    assert.match(memoryContestText ?? "", /archive evidence/);
    assert.match(memoryContestText ?? "", /pollution/);
    assert.match(memoryContestText ?? "", /gaps/);
    await page
      .locator(`#longRunReadinessPreview .long-run-memory-contest [data-long-run-readiness-ref="evt_memory_contested_long_run_001"]`)
      .click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const continuityText = await page.locator("#longRunReadinessPreview .long-run-agent-continuity").textContent();
    assert.match(continuityText ?? "", /continuity/);
    assert.match(continuityText ?? "", /deltas/);
    assert.match(continuityText ?? "", /accepted/);
    assert.match(continuityText ?? "", /roles/);
    assert.match(continuityText ?? "", /mood/);
    assert.match(continuityText ?? "", /reviews/);
    assert.match(continuityText ?? "", /targets/);
    assert.match(continuityText ?? "", /archive/);
    assert.match(continuityText ?? "", /evidence/);
    assert.match(continuityText ?? "", /gaps/);
    await page
      .locator(`#longRunReadinessPreview .long-run-agent-continuity [data-long-run-readiness-ref="persona_delta_long_run_001"]`)
      .click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const socialText = await page.locator("#longRunReadinessPreview .long-run-social-loop").textContent();
    assert.match(socialText ?? "", /social loop/);
    assert.match(socialText ?? "", /choices/);
    assert.match(socialText ?? "", /invites/);
    assert.match(socialText ?? "", /questions/);
    assert.match(socialText ?? "", /handoffs/);
    assert.match(socialText ?? "", /reviews/);
    assert.match(socialText ?? "", /silence/);
    assert.match(socialText ?? "", /coverage/);
    assert.match(socialText ?? "", /missing/);
    assert.match(socialText ?? "", /5\/5/);
    assert.match(socialText ?? "", /pressure/);
    assert.match(socialText ?? "", /9\/9/);
    assert.match(socialText ?? "", /event refs/);
    assert.match(socialText ?? "", /idle/);
    assert.match(socialText ?? "", /unlinked/);
    assert.match(socialText ?? "", /windows/);
    assert.match(socialText ?? "", /clean windows/);
    assert.match(socialText ?? "", /user interrupts/);
    assert.match(socialText ?? "", /clean/);
    assert.match(socialText ?? "", /interrupts/);
    assert.match(socialText ?? "", /lineage/);
    await page.locator(`#longRunReadinessPreview [data-long-run-readiness-ref="evt_room_rhythm_social_001"]`).click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const providerText = await page.locator("#longRunReadinessPreview .long-run-provider-boundary").textContent();
    assert.match(providerText ?? "", /provider/);
    assert.match(providerText ?? "", /degraded/);
    assert.match(providerText ?? "", /boundaries/);
    assert.match(providerText ?? "", /pressure/);
    assert.match(providerText ?? "", /coverage/);
    assert.match(providerText ?? "", /missing/);
    assert.match(providerText ?? "", /repair/);
    assert.match(providerText ?? "", /retry/);
    assert.match(providerText ?? "", /silence/);
    assert.match(providerText ?? "", /contest/);
    assert.match(providerText ?? "", /archive/);
    assert.match(providerText ?? "", /secrets/);
    await page.locator(`#longRunReadinessPreview [data-long-run-readiness-ref="evt_provider_degraded_long_run_001"]`).click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const sedimentText = await page.locator("#longRunReadinessPreview .long-run-sediment-evidence").textContent();
    assert.match(sedimentText ?? "", /sediment/);
    assert.match(sedimentText ?? "", /memory/);
    assert.match(sedimentText ?? "", /contests/);
    assert.match(sedimentText ?? "", /pollution/);
    assert.match(sedimentText ?? "", /review/);
    assert.match(sedimentText ?? "", /persona/);
    assert.match(sedimentText ?? "", /roles/);
    assert.match(sedimentText ?? "", /mood/);
    assert.match(sedimentText ?? "", /evidence/);
    assert.match(sedimentText ?? "", /gaps/);
    assert.match(sedimentText ?? "", /archive/);
    assert.match(sedimentText ?? "", /memory archive/);
    await page
      .locator(`#longRunReadinessPreview .long-run-sediment-evidence [data-long-run-readiness-ref="memory_claim_long_run_001"]`)
      .click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const contextText = await page.locator("#longRunReadinessPreview .long-run-context-visibility").textContent();
    assert.match(contextText ?? "", /context/);
    assert.match(contextText ?? "", /audits/);
    assert.match(contextText ?? "", /co-visible/);
    assert.match(contextText ?? "", /domains/);
    assert.match(contextText ?? "", /visible refs/);
    assert.match(contextText ?? "", /social refs/);
    assert.match(contextText ?? "", /critical/);
    await page.locator(`#longRunReadinessPreview [data-long-run-readiness-ref="packet_context_visible"]`).click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend archive repair apply control creates an explicit revision", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-archive-apply-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: archiveRepairTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator("#archiveNowButton").click();
    await page.waitForFunction(() => document.querySelector("#archiveState")?.textContent?.includes("这是时间骨架"));
    assert.equal(await page.locator("#archiveApplyRepairButton").isDisabled(), true);

    const archivedState = await roomState(baseUrl);
    const archiveId = archivedState.socialState?.archives?.at(-1)?.archiveId;
    assert.match(archiveId ?? "", /^day_/);
    if (!archiveId) assert.fail("archive control should create a daily archive ref");

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose an archive repair for this contestable daily skeleton.",
      clientMessageId: "client_browser_archive_apply_propose",
      mentions: ["kimi_member_01"],
      contextRefs: [archiveId],
    });
    const repairRef = proposed.socialState.archiveReviews.find((review) => review.kind === "repair_proposal")?.id;
    assert.match(repairRef ?? "", /^archive_repair_/);
    if (!repairRef) assert.fail("agent repair proposal should create an archive repair ref");

    await runtime.postUserMessage({
      content: "@kimi_member_01 accept that archive repair but do not apply it yourself.",
      clientMessageId: "client_browser_archive_apply_accept",
      mentions: ["kimi_member_01"],
      contextRefs: [repairRef],
    });

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await page.waitForFunction(
      (repairRef) =>
        document.querySelector("#archiveReviewList")?.textContent?.includes(repairRef) &&
        document.querySelector<HTMLButtonElement>("#archiveApplyRepairButton")?.disabled === false,
      repairRef,
    );

    await page.locator("#archiveApplyRepairButton").click();
    await page.waitForFunction(
      (repairRef) =>
        document.querySelector("#archiveState")?.textContent?.includes(repairRef) &&
        document.querySelector("#archiveState")?.textContent?.includes("原 archive 保持不变"),
      repairRef,
    );
    await page.waitForFunction(() => document.querySelector<HTMLButtonElement>("#archiveApplyRepairButton")?.disabled === true);

    const appliedState = await roomState(baseUrl);
    const application = appliedState.socialState?.archiveReviews?.find(
      (review) => review.kind === "repair_application" && review.repairRef === repairRef,
    );
    assert.ok(application, "accepted repair should be recorded as explicitly applied");
    assert.match(application.revisedArchiveRef ?? "", /^day_/);
    assert.notEqual(application.revisedArchiveRef, archiveId);

    const sourceArchive = appliedState.socialState?.archives?.find((archive) => archive.archiveId === archiveId);
    const revisedArchive = appliedState.socialState?.archives?.find((archive) => archive.archiveId === application.revisedArchiveRef);
    assert.ok(sourceArchive, "original archive should remain visible");
    assert.ok(revisedArchive, "archive revision should be visible");
    assert.equal(sourceArchive.revisionOf, undefined);
    assert.equal(revisedArchive.revisionOf, archiveId);
    assert.equal(revisedArchive.appliedRepairRef, repairRef);
    assert.equal(revisedArchive.provenanceRefs?.includes(repairRef), true);

    const events = await rawEvents(baseUrl);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_applied").length, 1);
    assert.equal(events.filter((event) => event.event_type === "daily_archive.created").length, 2);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend side-effect expire control writes a room-visible permission retirement", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-side-effect-expire-"));
  const ledgerPath = path.join(dir, "room-ledger.jsonl");
  const runtime = new SpeciesRoomRuntime({
    ledgerPath,
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: sideEffectPermissionTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const requested = await runtime.postUserMessage({
      content: "@kimi_member_01 request a private side-effect permission for browser settings expiry.",
      clientMessageId: "client_browser_side_effect_expire_request",
      mentions: ["kimi_member_01"],
    });
    const sideEffect = requested.socialState.sideEffects[0];
    assert.ok(sideEffect, "side-effect request should be projected");
    assert.equal(sideEffect.status, "requested");

    await appendSideEffectApproval(ledgerPath, sideEffect);
    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (requestId) =>
        document.querySelector("#sideEffectList")?.textContent?.includes("approved") &&
        document.querySelector(`#sideEffectList [data-side-effect-expire-ref="${requestId}"]`) !== null,
      sideEffect.requestId,
    );

    await page.locator(`#sideEffectList [data-side-effect-expire-ref="${sideEffect.requestId}"]`).click();
    await waitForText(page, "#composerState", "未执行外部动作");
    await page.waitForFunction(() => document.querySelector("#sideEffectList")?.textContent?.includes("expired"));
    assert.equal(await page.locator(`#sideEffectList [data-side-effect-expire-ref="${sideEffect.requestId}"]`).count(), 0);

    const events = await rawEvents(baseUrl);
    assert.equal(events.filter((event) => event.event_type === "side_effect.requested").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.approved").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.expired").length, 1);
    assert.equal(events.some((event) => event.event_type === "side_effect.result_reported"), false);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend side-effect approval controls approve and execute a simple task", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-side-effect-approval-"));
  const ledgerPath = path.join(dir, "room-ledger.jsonl");
  const targetPath = path.join(dir, "browser-approved-note.txt");
  const runtime = new SpeciesRoomRuntime({
    ledgerPath,
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: {
      kimiInvoker: async (request) => {
        if (request.agent.agentId !== "kimi_member_01") {
          return staySilentJson("This browser test targets one capability requester.");
        }
        return JSON.stringify({
          kind: "use_capability",
          capabilityId: "local.filesystem.write",
          operation: "write_file",
          input: { path: targetPath },
          reason: "Request one approved browser-test file write.",
          contextRefs: [request.packet.triggeringEventId],
        });
      },
      mimoInvoker: async () => staySilentJson("This browser test targets one capability requester."),
    },
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const requested = await runtime.postUserMessage({
      content: "@kimi_member_01 request a private side-effect permission for browser settings approval.",
      clientMessageId: "client_browser_side_effect_approval_request",
      mentions: ["kimi_member_01"],
    });
    const sideEffect = requested.socialState.sideEffects[0];
    assert.ok(sideEffect, "side-effect request should be projected");
    assert.equal(sideEffect.status, "requested");
    assert.equal(sideEffect.target, targetPath);

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (requestId) =>
        document.querySelector("#sideEffectList")?.textContent?.includes("requested") &&
        document.querySelector(`#sideEffectList [data-side-effect-approve-ref="${requestId}"]`) !== null,
      sideEffect.requestId,
    );

    await page.locator(`#sideEffectList [data-side-effect-approve-ref="${sideEffect.requestId}"]`).click();
    await waitForText(page, "#composerState", "尚未执行");
    await page.waitForFunction(
      (requestId) =>
        document.querySelector("#sideEffectList")?.textContent?.includes("approved") &&
        document.querySelector(`#sideEffectList [data-side-effect-execute-ref="${requestId}"]`) !== null,
      sideEffect.requestId,
    );

    await page.locator(`#sideEffectList [data-side-effect-execute-ref="${sideEffect.requestId}"]`).click();
    await waitForText(page, "#composerState", "result 已写入内部房间记录");
    await page.waitForFunction(() => document.querySelector("#sideEffectList")?.textContent?.includes("completed"));
    assert.equal(await readFile(targetPath, "utf8"), `approved side-effect write from settings for ${sideEffect.requestId}\n`);

    const events = await rawEvents(baseUrl);
    assert.equal(events.filter((event) => event.event_type === "side_effect.requested").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.approved").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.result_reported").length, 1);
    assert.equal(events.some((event) => event.event_type === "side_effect.expired"), false);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend side-effect review appears as social timeline pressure without approval", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-side-effect-review-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: {
      kimiInvoker: async (request) => {
        if (request.agent.agentId !== "kimi_member_01") {
          return staySilentJson("This browser test targets one side-effect requester.");
        }
        return JSON.stringify({
          kind: "request_side_effect",
          sideEffectKind: "filesystem.write",
          target: `${request.agent.workspace.scratchPath}browser-review-boundary.md`,
          reason: "This browser review fixture should remain approval-gated.",
          expectedImpact: "Create one private scratch note only if later approved.",
          proposedCommand: "write browser-review-boundary.md",
          contextRefs: [request.packet.triggeringEventId],
        });
      },
      mimoInvoker: async (request) => {
        const sideEffectRef = request.packet.contextFragments
          ?.find((fragment) => fragment.type === "side_effect_boundary")
          ?.refs.find((ref) => ref.startsWith("sidefx_"));
        return JSON.stringify({
          kind: "speak",
          content: "This side-effect request is still too broad; keep review pressure visible without approval or execution.",
          contextRefs: sideEffectRef ? [sideEffectRef] : [],
        });
      },
    },
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");

    const requested = await runtime.postUserMessage({
      content: "@kimi_member_01 request a side-effect boundary for browser review only.",
      clientMessageId: "client_browser_side_effect_review_request",
      mentions: ["kimi_member_01"],
    });
    const sideEffectRef = requested.socialState.sideEffects[0]?.requestId;
    assert.match(sideEffectRef ?? "", /^sidefx_/);
    if (!sideEffectRef) assert.fail("side-effect request should expose a request ref");

    await runtime.postUserMessage({
      content: `@mimo_member_01 review this side-effect request without approving or executing it.`,
      clientMessageId: "client_browser_side_effect_review_speech",
      mentions: ["mimo_member_01"],
      contextRefs: [sideEffectRef],
    });
    const reviewedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(
        state.timeline?.some(
          (entry) =>
            entry.category === "social_loop" &&
            entry.title === "Side-effect request reviewed" &&
            entry.refs?.includes(sideEffectRef),
        ),
      ),
    );
    assert.equal(reviewedState.socialState?.sideEffects?.find((item) => item.requestId === sideEffectRef)?.status, "requested");

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await page.waitForFunction(() => {
      const text = document.querySelector("#timelinePreview")?.textContent ?? "";
      return text.includes("Side-effect request reviewed") && text.includes("social");
    });

    const events = await rawEvents(baseUrl);
    assert.equal(events.filter((event) => event.event_type === "side_effect.requested").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.approved").length, 0);
    assert.equal(events.filter((event) => event.event_type === "side_effect.result_reported").length, 0);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend mobile short viewport keeps composer and settings usable", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-mobile-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 560 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 smoke_ready");

    await page.fill("#messageInput", `mobile-short-${Date.now()} ${"窄屏键盘状态也要保留消息区、输入区和发送按钮。".repeat(28)}`);
    await page.setViewportSize({ width: 390, height: 360 });
    await page.focus("#messageInput");
    await page.waitForFunction(() => {
      const input = document.querySelector("#messageInput");
      return input instanceof HTMLElement && input.getBoundingClientRect().height <= 126;
    });

    const metrics = await page.evaluate(() => {
      const rectFor = (id: string) => {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing element ${id}`);
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        messageList: rectFor("messageList"),
        composer: rectFor("composer"),
        input: rectFor("messageInput"),
        sendButton: rectFor("sendButton"),
        composerStateDisplay: window.getComputedStyle(document.querySelector("#composerState") as Element).display,
      };
    });

    assert.equal(metrics.documentWidth <= metrics.innerWidth, true);
    assert.equal(metrics.bodyWidth <= metrics.innerWidth, true);
    assert.equal(metrics.messageList.height >= 70, true);
    assert.equal(metrics.input.height <= 126, true);
    assert.equal(metrics.composer.left >= 0 && metrics.composer.right <= metrics.innerWidth, true);
    assert.equal(metrics.composer.bottom <= metrics.innerHeight, true);
    assert.equal(metrics.sendButton.right <= metrics.innerWidth && metrics.sendButton.bottom <= metrics.innerHeight, true);
    assert.equal(metrics.composerStateDisplay, "none");

    await page.fill("#messageInput", "@ki");
    await page.waitForFunction(() => document.querySelector("#mentionPopover")?.hasAttribute("hidden") === false);
    const mention = await page.evaluate(() => {
      const element = document.getElementById("mentionPopover");
      if (!element) throw new Error("Missing mentionPopover");
      const rect = element.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        popover: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      };
    });
    assert.equal(mention.popover.left >= 0, true);
    assert.equal(mention.popover.top >= 0, true);
    assert.equal(mention.popover.right <= mention.innerWidth, true);
    assert.equal(mention.popover.bottom <= mention.innerHeight, true);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(() => {
      const panel = document.querySelector("#settingsPanel");
      if (!(panel instanceof HTMLElement)) return false;
      const rect = panel.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth;
    });
    const settings = await page.evaluate(() => {
      const rectFor = (id: string) => {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing element ${id}`);
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        panel: rectFor("settingsPanel"),
        close: rectFor("closeSettings"),
        activeInsideSettings: document.activeElement instanceof HTMLElement && document.activeElement.closest("#settingsPanel") !== null,
      };
    });
    assert.equal(settings.panel.left >= 0, true);
    assert.equal(settings.panel.right <= settings.innerWidth, true);
    assert.equal(settings.panel.bottom <= settings.innerHeight, true);
    assert.equal(settings.close.right <= settings.innerWidth && settings.close.top >= 0, true);
    assert.equal(settings.activeInsideSettings, true);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend memory claim cards expose provisional state and review flow", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-memory-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: memoryClaimTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const proposeText = `@kimi_member_01 propose a public memory card test ${Date.now()}`;
    await page.fill("#messageInput", proposeText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, proposeText);

    const proposedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.memoryClaims?.some((claim) => claim.state === "proposed")),
    );
    const claim = proposedState.socialState?.memoryClaims?.find((item) => item.state === "proposed");
    const memoryId = claim?.memoryId;
    assert.match(memoryId ?? "", /^memory_/);
    if (!memoryId) assert.fail("memory proposal should create a memory ref");
    assert.equal(claim?.provisionalNote?.includes("not truth"), true);
    assert.equal((claim?.sourceRefs ?? []).length > 0, true);
    const sourceRef = claim?.sourceRefs?.[0];
    if (!sourceRef) assert.fail("memory proposal should carry a source ref");
    await expandLivingOverview(page);
    await page.waitForFunction(() => {
      const text = document.querySelector("#memoryContestPreview")?.closest(".overview-tile")?.textContent ?? "";
      return text.includes("Memory Pressure");
    });
    await page.waitForFunction(() => document.querySelector("#memoryContestCount")?.textContent?.trim() === "1");
    await page.locator(`#memoryContestPreview [data-social-context-ref="${sourceRef}"]`).waitFor();
    await page.waitForFunction(
      (shortSourceRef) => {
        const text = document.querySelector("#memoryContestPreview")?.textContent ?? "";
        return text.includes("proposed") && text.includes("evidence refs") && text.includes(shortSourceRef);
      },
      shortRefForTest(sourceRef),
    );
    await page.waitForFunction(() => {
      const text = document.querySelector("#memoryContestPreview")?.textContent ?? "";
      return (
        text.includes("hygiene pressure") &&
        text.includes("reviewable") &&
        text.includes("contested") &&
        text.includes("stale") &&
        text.includes("revisions") &&
        text.includes("source pressure")
      );
    });
    await page.locator(`#memoryContestPreview [data-social-context-ref="${sourceRef}"]`).click();
    await page.waitForFunction(
      (shortSourceRef) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("memory") && text.includes("proposed") && text.includes(shortSourceRef);
      },
      shortRefForTest(sourceRef),
    );

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#memoryClaimList [data-social-context-ref="${memoryId}"]`).waitFor();
    await page.locator(`#memoryClaimList [data-memory-source-ref="${sourceRef}"]`).waitFor();
    await page.waitForFunction(() => document.querySelector("#memoryClaimList .memory-card") !== null);
    await page.waitForFunction(() =>
      document.querySelector("#memoryClaimList .memory-state-boundary")?.textContent?.includes("proposed, not adopted"),
    );
    await page.waitForFunction(() => {
      const labels = Array.from(document.querySelectorAll("#memoryClaimList .memory-fact small")).map(
        (element) => element.textContent ?? "",
      );
      return labels.includes("state") && labels.includes("transitions") && labels.includes("source refs");
    });
    await page.waitForFunction(() => document.querySelector("#memoryClaimList .social-note")?.textContent?.includes("not truth"));

    await page.locator(`#memoryClaimList [data-memory-source-ref="${sourceRef}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortSourceRef) => (document.querySelector("#contextTray")?.textContent ?? "").includes(shortSourceRef),
      shortRefForTest(sourceRef),
    );

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#memoryClaimList [data-social-context-ref="${memoryId}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortMemoryId) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("memory") && text.includes("proposed") && text.includes("transitions") && text.includes(shortMemoryId);
      },
      shortRefForTest(memoryId),
    );

    const revisionText = `@kimi_member_01 revise public memory card test ${Date.now()}`;
    await page.fill("#messageInput", revisionText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, revisionText);

    const revisedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.memoryClaims?.some((item) => item.revisedFromMemoryRef === memoryId)),
    );
    const revisedClaim = revisedState.socialState?.memoryClaims?.find((item) => item.revisedFromMemoryRef === memoryId);
    const revisedMemoryId = revisedClaim?.memoryId;
    assert.match(revisedMemoryId ?? "", /^memory_/);
    if (!revisedMemoryId) assert.fail("memory revision should create a fresh memory ref");
    assert.notEqual(revisedMemoryId, memoryId);
    assert.equal(revisedClaim?.state, "proposed");
    assert.equal(revisedClaim?.sourceRefs?.includes(memoryId), true);
    await page.waitForFunction(() => document.querySelector("#memoryContestCount")?.textContent?.trim() === "2");

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#memoryClaimList [data-social-context-ref="${revisedMemoryId}"]`).waitFor();
    await page.waitForFunction(
      (memoryId) => {
        const text = document.querySelector("#memoryClaimList")?.textContent ?? "";
        return text.includes(`revises ${memoryId}`) && text.includes("fresh proposal") && text.includes("previous claim unchanged");
      },
      memoryId,
    );
    await page.waitForFunction(() => {
      const labels = Array.from(document.querySelectorAll("#memoryClaimList .memory-fact small")).map(
        (element) => element.textContent ?? "",
      );
      return labels.includes("revises");
    });

    await page.locator(`#memoryClaimList [data-social-context-ref="${revisedMemoryId}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (args) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("memory") && text.includes("fresh proposal") && text.includes(args.shortOriginalRef);
      },
      { shortOriginalRef: shortRefForTest(memoryId) },
    );

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#memoryClaimList [data-memory-claim-review-ref="${revisedMemoryId}"]`).click();
    await waitForMessage(page, "请审阅这条公共记忆沉淀");

    const reviewMessage = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        Boolean(event.payload.content?.includes("请审阅这条公共记忆沉淀")),
    );
    assert.ok(reviewMessage, "memory review should be a normal room message");
    assert.equal(reviewMessage.payload?.content?.includes(revisedMemoryId), false);
    assert.equal(reviewMessage.payload?.content?.includes(memoryId), false);
    assert.equal(reviewMessage.payload?.content?.includes("从上一条公共记忆沉淀修订来的 fresh proposal"), true);
    assert.equal(reviewMessage.payload?.content?.includes("旧沉淀不会因此被改写"), true);
    assert.equal(reviewMessage.payload?.contextRefs?.includes(revisedMemoryId), true);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend agent continuity cards expose ledger evidence refs", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-continuity-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: personaContinuityTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const moodText = `@kimi_member_01 propose a daily mood continuity evidence test ${Date.now()}`;
    await page.fill("#messageInput", moodText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, moodText);

    const proposedMoodState = await waitForRoomState(baseUrl, (state) =>
      Boolean(
        state.socialState?.personas?.some((persona) =>
          persona.evolutionLog?.some((delta) => delta.field === "dailyMood" && delta.status === "proposed"),
        ),
      ),
    );
    const moodDeltaRef =
      proposedMoodState.socialState?.personas
        ?.flatMap((persona) => persona.evolutionLog ?? [])
        .find((delta) => delta.field === "dailyMood" && delta.status === "proposed")?.deltaId ?? "";
    assert.match(moodDeltaRef, /^persona_delta_/);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#personaEvolutionList .social-context-button[data-social-context-ref="${moodDeltaRef}"]`).waitFor();
    await page.locator(`#personaEvolutionList .social-context-button[data-social-context-ref="${moodDeltaRef}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));

    const acceptText = `@mimo_member_01 review the carried daily mood continuity test ${Date.now()}`;
    await page.fill("#messageInput", acceptText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, acceptText);

    const acceptedMoodState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.personas?.some((persona) => persona.dailyMoodRecord?.posture === "quietly curious from ledger evidence")),
    );
    const moodSourceRef =
      acceptedMoodState.socialState?.personas?.find((persona) => persona.agentId === "kimi_member_01")?.dailyMoodRecord?.sourceRef ?? "";
    assert.match(moodSourceRef, /^(evt|msg)_/);
    const moodEvidenceRefs =
      acceptedMoodState.socialState?.personas?.find((persona) => persona.agentId === "kimi_member_01")?.dailyMoodRecord?.evidenceRefs ?? [];
    const moodResponseRef =
      acceptedMoodState.socialState?.personas
        ?.find((persona) => persona.agentId === "kimi_member_01")
        ?.dailyMoodRecord?.responseRefs?.find((ref) => ref.startsWith("persona_delta_response_")) ?? "";
    assert.equal(moodEvidenceRefs.includes(moodDeltaRef), true);
    assert.match(moodResponseRef, /^persona_delta_response_/);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#agentList [data-agent-continuity-ref="${moodSourceRef}"]`).waitFor();
    await page.locator(`#agentList [data-agent-continuity-ref="${moodResponseRef}"]`).waitFor();
    await page.locator(`#agentList [data-agent-continuity-ref="${moodResponseRef}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortResponseRef) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("continuity") && text.includes("daily mood") && text.includes(shortResponseRef);
      },
      shortRefForTest(moodResponseRef),
    );
    assert.equal(await page.locator(".context-chip.continuity-context").count(), 1);

    const roleText = `@kimi_member_01 propose a role claim continuity evidence test ${Date.now()}`;
    await page.fill("#messageInput", roleText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, roleText);

    const roleState = await waitForRoomState(baseUrl, (state) =>
      Boolean(
        state.socialState?.personas?.some((persona) =>
          persona.roleClaims?.some((claim) => claim.label === "careful ledger evidence carrier"),
        ),
      ),
    );
    const roleClaimRef =
      roleState.socialState?.personas
        ?.flatMap((persona) => persona.roleClaims ?? [])
        .find((claim) => claim.label === "careful ledger evidence carrier")?.roleClaimId ?? "";
    assert.match(roleClaimRef, /^role_claim_persona_delta_/);
    const roleDeltaRef =
      roleState.socialState?.personas
        ?.flatMap((persona) => persona.evolutionLog ?? [])
        .find((delta) => delta.field === "roleClaims" && delta.status === "proposed")?.deltaId ?? "";
    assert.match(roleDeltaRef, /^persona_delta_/);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#personaEvolutionList .social-context-button[data-social-context-ref="${roleDeltaRef}"]`).waitFor();
    await page.locator(`#personaEvolutionList .social-context-button[data-social-context-ref="${roleDeltaRef}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));

    const roleAcceptText = `@mimo_member_01 review the carried role claim continuity test ${Date.now()}`;
    await page.fill("#messageInput", roleAcceptText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, roleAcceptText);

    const acceptedRoleState = await waitForRoomState(baseUrl, (state) =>
      Boolean(
        state.socialState?.personas?.some((persona) =>
          persona.roleClaims?.some(
            (claim) => claim.label === "careful ledger evidence carrier" && claim.status === "accepted",
          ),
        ),
      ),
    );
    const roleResponseRef =
      acceptedRoleState.socialState?.personas
        ?.flatMap((persona) => persona.roleClaims ?? [])
        .find((claim) => claim.label === "careful ledger evidence carrier")
        ?.responseRefs?.find((ref) => ref.startsWith("persona_delta_response_")) ?? "";
    assert.match(roleResponseRef, /^persona_delta_response_/);
    await expandLivingOverview(page);
    await page.locator(`#agentContinuityPreview [data-social-context-ref="${roleResponseRef}"]`).waitFor();
    await page.waitForFunction(
      (shortRoleResponseRef) => {
        const text = document.querySelector("#agentContinuityPreview")?.textContent ?? "";
        return text.includes("role claim") && text.includes("evidence refs") && text.includes(shortRoleResponseRef);
      },
      shortRefForTest(roleResponseRef),
    );
    await page.waitForFunction(
      (shortRoleResponseRef) => {
        const text = document.querySelector("#agentContinuityPreview")?.textContent ?? "";
        return (
          text.includes("continuity sediment") &&
          text.includes("pending") &&
          text.includes("role claims") &&
          text.includes("daily mood") &&
          text.includes("response refs") &&
          text.includes(shortRoleResponseRef)
        );
      },
      shortRefForTest(roleResponseRef),
    );

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#agentList [data-agent-continuity-ref="${roleClaimRef}"]`).waitFor();
    await page.locator(`#agentList [data-agent-continuity-ref="${roleResponseRef}"]`).waitFor();
    await page.locator(`#agentList [data-agent-continuity-ref="${roleResponseRef}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortRoleResponseRef) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("continuity") && text.includes("role claim") && text.includes(shortRoleResponseRef);
      },
      shortRefForTest(roleResponseRef),
    );
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend open question cards carry unresolved questions as semantic context", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-open-question-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: openQuestionTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 2,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const askText = `@kimi_member_01 ask an open question card test ${Date.now()}`;
    await page.fill("#messageInput", askText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, askText);

    const askedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.openQuestions?.some((question) => question.questionId?.startsWith("question_"))),
    );
    const question = askedState.socialState?.openQuestions?.find((item) => item.questionId?.startsWith("question_"));
    const questionId = question?.questionId;
    assert.match(questionId ?? "", /^question_/);
    if (!questionId) assert.fail("ask_question should create an open question ref");
    assert.equal(question?.boundaryNote?.includes("not a demand"), true);
    assert.equal(
      askedState.timeline?.some((entry) => entry.category === "social_loop" && entry.title === "Open question raised"),
      true,
    );
    await page.waitForFunction(() => {
      const text = document.querySelector("#timelinePreview")?.textContent ?? "";
      return text.includes("Open question raised") && text.includes("social");
    });

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#openQuestionList [data-social-context-ref="${questionId}"]`).waitFor();
    await page.waitForFunction(() => {
      const text = document.querySelector("#openQuestionList")?.textContent ?? "";
      return text.includes("open question") && text.includes("not a demand") && text.includes("refs");
    });

    await page.locator(`#openQuestionList [data-social-context-ref="${questionId}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortQuestionId) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("open question") && text.includes("unresolved room question") && text.includes(shortQuestionId);
      },
      shortRefForTest(questionId),
    );
    assert.equal(await page.locator(".context-chip.question-context").count(), 1);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    const beforeEvents = await rawEvents(baseUrl);
    await page.locator(`#openQuestionList [data-open-question-review-ref="${questionId}"]`).click();
    await waitForMessage(page, "请重访这个未解决问题");

    const reviewMessage = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        typeof event.payload?.content === "string" &&
        event.payload.content.includes("请重访这个未解决问题"),
    );
    assert.ok(reviewMessage, "open question review should be an ordinary room message");
    assert.equal(reviewMessage.payload?.content?.includes(questionId), false);
    assert.deepEqual(reviewMessage.payload?.contextRefs, [questionId]);

    await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "open_question.responded" &&
        (event.payload as Record<string, unknown> | undefined)?.questionRef === questionId,
    );
    const afterEvents = await rawEvents(baseUrl);
    const newEvents = afterEvents.slice(beforeEvents.length);
    assert.equal(newEvents.some((event) => event.event_type === "open_question.responded"), true);
    for (const lifecycleEventType of ["memory.accepted", "protocol.responded", "topic.applied"]) {
      assert.equal(
        newEvents.some((event) => event.event_type === lifecycleEventType),
        false,
        `${lifecycleEventType} should not be created by open question revisit prompt`,
      );
    }
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend handoff cards keep transfer social and rejectable", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-handoff-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: handoffTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const proposeText = `@kimi_member_01 propose a handoff card test ${Date.now()}`;
    await page.fill("#messageInput", proposeText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, proposeText);

    const proposedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.handoffs?.some((handoff) => handoff.status === "challenged")),
    );
    const handoff = proposedState.socialState?.handoffs?.find((item) => item.status === "challenged");
    const handoffId = handoff?.handoffId;
    assert.match(handoffId ?? "", /^handoff_/);
    if (!handoffId) assert.fail("handoff proposal should create a handoff ref");
    assert.equal(handoff?.fromAgentId, "kimi_member_01");
    assert.equal(handoff?.toAgentId, "mimo_member_01");
    assert.equal(handoff?.requestedResponse?.includes("weakest assumption"), true);
    assert.equal(handoff?.responseCount, 1);
    assert.equal(handoff?.responses?.[0]?.byAgentId, "mimo_member_01");
    assert.equal(handoff?.responses?.[0]?.response, "challenged");
    assert.equal(handoff?.responses?.[0]?.reason?.includes("not a forced transfer"), true);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#handoffList [data-social-context-ref="${handoffId}"]`).waitFor();
    await page.waitForFunction(() => document.querySelector("#handoffList .handoff-card") !== null);
    await page.waitForFunction(() => document.querySelector("#handoffList .handoff-boundary")?.textContent?.includes("challenged handoff"));
    await page.waitForFunction(() =>
      document.querySelector("#handoffList .handoff-response")?.textContent?.includes("mimo_member_01 challenged"),
    );
    await page.waitForFunction(() => {
      const labels = Array.from(document.querySelectorAll("#handoffList .handoff-fact small")).map(
        (element) => element.textContent ?? "",
      );
      return labels.includes("status") && labels.includes("from") && labels.includes("to") && labels.includes("responses");
    });

    await page.locator(`#handoffList [data-social-context-ref="${handoffId}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortHandoffId) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return (
          text.includes("handoff") &&
          text.includes("kimi_member_01") &&
          text.includes("mimo_member_01") &&
          text.includes("mimo_member_01 challenged") &&
          text.includes(shortHandoffId)
        );
      },
      shortRefForTest(handoffId),
    );

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#handoffList [data-handoff-review-ref="${handoffId}"]`).click();
    await waitForMessage(page, "请重访这条 handoff proposal");

    const reviewMessage = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        Boolean(event.payload.content?.includes("请重访这条 handoff proposal")),
    );
    assert.ok(reviewMessage, "handoff review should be a normal room message");
    assert.equal(reviewMessage.payload?.content?.includes(handoffId), false);
    assert.equal(reviewMessage.payload?.contextRefs?.includes(handoffId), true);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend delegated handoff chains stay visible as fresh proposals", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-handoff-delegate-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: delegatedHandoffTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const proposeText = `@kimi_member_01 propose a delegated handoff chain test ${Date.now()}`;
    await page.fill("#messageInput", proposeText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, proposeText);

    const delegatedState = await waitForRoomState(baseUrl, (state) => {
      const handoffs = state.socialState?.handoffs ?? [];
      return (
        handoffs.some((handoff) => handoff.status === "redirected" && handoff.responses?.some((response) => response.redirectTo === "mimo_member_02")) &&
        handoffs.some((handoff) => handoff.status === "proposed" && handoff.delegatedFromHandoffRef && handoff.toAgentId === "mimo_member_02")
      );
    });
    const original = delegatedState.socialState?.handoffs?.find((handoff) => handoff.status === "redirected");
    const delegated = delegatedState.socialState?.handoffs?.find((handoff) => handoff.delegatedFromHandoffRef === original?.handoffId);
    const originalId = original?.handoffId;
    const delegatedId = delegated?.handoffId;
    assert.match(originalId ?? "", /^handoff_/);
    assert.match(delegatedId ?? "", /^handoff_/);
    if (!originalId || !delegatedId) assert.fail("delegated handoff chain should expose both handoff refs");
    assert.notEqual(delegatedId, originalId);
    assert.equal(original?.responses?.[0]?.response, "redirected");
    assert.equal(original?.responses?.[0]?.redirectTo, "mimo_member_02");
    assert.equal(delegated?.fromAgentId, "mimo_member_01");
    assert.equal(delegated?.toAgentId, "mimo_member_02");
    assert.equal(delegated?.delegatedBy, "mimo_member_01");
    assert.equal(delegated?.delegatedFromHandoffRef, originalId);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#handoffList [data-social-context-ref="${delegatedId}"]`).waitFor();
    await page.waitForFunction(() =>
      document.querySelector("#handoffList")?.textContent?.includes("redirect to mimo_member_02"),
    );
    await page.waitForFunction(
      (shortOriginalId) =>
        document.querySelector("#handoffList")?.textContent?.includes(`delegated from ${shortOriginalId}`) &&
        document.querySelector("#handoffList")?.textContent?.includes("delegated by mimo_member_01"),
      shortRefForTest(originalId),
    );

    await page.locator(`#handoffList [data-social-context-ref="${delegatedId}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortDelegatedId) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("handoff") && text.includes("mimo_member_01") && text.includes("mimo_member_02") && text.includes(shortDelegatedId);
      },
      shortRefForTest(delegatedId),
    );

    const events = await rawEvents(baseUrl);
    assert.equal(events.filter((event) => event.event_type === "handoff.proposed").length, 2);
    assert.equal(events.filter((event) => event.event_type === "handoff.responded").length, 1);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend invitation cards keep social knocks optional and reviewable", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-invitation-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: invitationTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxAwakenedAgents: 8,
    maxSpeakers: 2,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const inviteText = `@kimi_member_01 create an invitation card test ${Date.now()}`;
    await page.fill("#messageInput", inviteText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, inviteText);

    const invitedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.invitations?.some((invitation) => invitation.invitationId?.startsWith("invite_"))),
    );
    const invitation = invitedState.socialState?.invitations?.find((item) => item.invitationId?.startsWith("invite_"));
    const invitationId = invitation?.invitationId;
    assert.match(invitationId ?? "", /^invite_/);
    if (!invitationId) assert.fail("invite_other should create an invitation ref");
    assert.equal(invitation?.fromAgentId, "kimi_member_01");
    assert.equal(invitation?.toAgentId, "mimo_member_01");
    assert.equal(invitation?.status, "invited");
    assert.equal(invitation?.responseCount, 0);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#invitationList [data-social-context-ref="${invitationId}"]`).waitFor();
    await page.waitForFunction(() => {
      const text = document.querySelector("#invitationList")?.textContent ?? "";
      return text.includes("social knock") && text.includes("0 responses") && text.includes("0 reviews");
    });

    await page.locator(`#invitationList [data-social-context-ref="${invitationId}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortInvitationId) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return (
          text.includes("invitation") &&
          text.includes("social knock") &&
          text.includes("kimi_member_01 -> mimo_member_01") &&
          text.includes(shortInvitationId)
        );
      },
      shortRefForTest(invitationId),
    );
    assert.equal(await page.locator(".context-chip.invitation-context").count(), 1);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    const beforeEvents = await rawEvents(baseUrl);
    await page.locator(`#invitationList [data-invitation-review-ref="${invitationId}"]`).click();
    await waitForMessage(page, "请重访这次 social knock");

    const reviewMessage = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        typeof event.payload?.content === "string" &&
        event.payload.content.includes("请重访这次 social knock"),
    );
    assert.ok(reviewMessage, "invitation review should be an ordinary room message");
    assert.equal(reviewMessage.payload?.content?.includes(invitationId), false);
    assert.deepEqual(reviewMessage.payload?.contextRefs, [invitationId]);

    await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "agent.invitation_reviewed" &&
        (event.payload as Record<string, unknown> | undefined)?.invitationRef === invitationId,
    );
    const reviewedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.invitationReviews?.some((review) => review.invitationRef === invitationId)),
    );
    const reviewedInvitation = reviewedState.socialState?.invitations?.find((item) => item.invitationId === invitationId);
    assert.equal(reviewedInvitation?.status, "invited");
    assert.equal(reviewedInvitation?.responseCount, 0);

    const afterEvents = await rawEvents(baseUrl);
    const newEvents = afterEvents.slice(beforeEvents.length);
    assert.equal(newEvents.some((event) => event.event_type === "agent.invitation_reviewed"), true);
    assert.equal(newEvents.some((event) => event.event_type === "agent.invitation_responded"), false);
    for (const lifecycleEventType of ["memory.accepted", "protocol.responded", "topic.applied"]) {
      assert.equal(
        newEvents.some((event) => event.event_type === lifecycleEventType),
        false,
        `${lifecycleEventType} should not be created by invitation review prompt`,
      );
    }
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend overview long rhythm strip surfaces autonomous social loop evidence", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-long-rhythm-social-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: socialRhythmTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxAwakenedAgents: 8,
    maxSpeakers: 2,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    await runtime.postUserMessage({
      content: "@kimi_member_01 create an autonomous social rhythm question.",
      clientMessageId: "client_browser_long_rhythm_question",
      mentions: ["kimi_member_01"],
    });
    await runtime.postUserMessage({
      content: "@kimi_member_01 create an autonomous social rhythm handoff.",
      clientMessageId: "client_browser_long_rhythm_handoff",
      mentions: ["kimi_member_01"],
    });
    await runtime.postUserMessage({
      content: "@kimi_member_01 create an autonomous social rhythm invitation.",
      clientMessageId: "client_browser_long_rhythm_invitation",
      mentions: ["kimi_member_01"],
    });

    const seededState = await waitForRoomState(baseUrl, (state) => {
      const social = state.socialState;
      return Boolean(
        social?.openQuestions?.some((question) => question.questionId?.startsWith("question_")) &&
          social?.handoffs?.some((handoff) => handoff.handoffId?.startsWith("handoff_")) &&
          social?.invitations?.some((invitation) => invitation.invitationId?.startsWith("invite_") && invitation.status === "invited"),
      );
    });
    const questionId = seededState.socialState?.openQuestions?.find((question) => question.questionId?.startsWith("question_"))?.questionId;
    const handoffId = seededState.socialState?.handoffs?.find((handoff) => handoff.handoffId?.startsWith("handoff_"))?.handoffId;
    const invitationId = seededState.socialState?.invitations?.find(
      (invitation) => invitation.invitationId?.startsWith("invite_") && invitation.status === "invited",
    )?.invitationId;
    assert.match(questionId ?? "", /^question_/);
    assert.match(handoffId ?? "", /^handoff_/);
    assert.match(invitationId ?? "", /^invite_/);
    if (!questionId || !handoffId || !invitationId) assert.fail("social rhythm setup should create question, handoff, and invitation refs");

    await runtime.createDailyArchive({ timezone: "Asia/Shanghai" });
    await postUntilExpectedAutonomyTick(baseUrl, "review_open_archive");
    const questionTickId = await postUntilExpectedAutonomyTick(baseUrl, "open_question_revisit");
    const handoffTickId = await postUntilExpectedAutonomyTick(baseUrl, "handoff_review");
    const invitationTickId = await postUntilExpectedAutonomyTick(baseUrl, "invitation_review");

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });

    await expandLivingOverview(page);
    const longRhythmText = await page.locator("#evidenceStrip .long-rhythm-evidence").textContent();
    assert.match(longRhythmText ?? "", /questions visible/);
    assert.match(longRhythmText ?? "", /handoffs visible/);
    assert.match(longRhythmText ?? "", /invites visible/);
    const balanceText = await page.locator("#evidenceStrip .rhythm-balance-evidence").textContent();
    assert.match(balanceText ?? "", /Rhythm balance/);
    assert.match(balanceText ?? "", /3 kinds/);
    assert.match(balanceText ?? "", /3 social ticks/);
    assert.match(balanceText ?? "", /warming sample|balanced/);
    for (const tickId of [questionTickId, handoffTickId, invitationTickId]) {
      await page.locator(`#evidenceStrip [data-long-rhythm-ref="${tickId}"]`).waitFor();
    }
    for (const tickId of [questionTickId, handoffTickId, invitationTickId]) {
      await page.locator(`#evidenceStrip [data-rhythm-balance-ref="${tickId}"]`).waitFor();
    }
    assert.equal(await page.locator("#evidenceStrip [data-long-rhythm-ref]").count(), 8);
    assert.equal(await page.locator("#evidenceStrip [data-rhythm-balance-ref]").count() >= 3, true);

    await page.locator(`#evidenceStrip [data-long-rhythm-ref="${questionTickId}"]`).click();
    await page.waitForFunction(
      (shortTickId) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("room rhythm") && text.includes("choices") && text.includes(shortTickId);
      },
      shortRefForTest(questionTickId),
    );
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend protocol cards keep etiquette temporary and reviewable", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-protocol-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: protocolTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const proposeText = `@kimi_member_01 propose a temporary protocol card test ${Date.now()}`;
    await page.fill("#messageInput", proposeText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, proposeText);

    const proposedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.protocols?.some((protocol) => protocol.status === "proposed")),
    );
    const protocol = proposedState.socialState?.protocols?.find((item) => item.status === "proposed");
    const protocolId = protocol?.protocolId;
    assert.match(protocolId ?? "", /^protocol_/);
    if (!protocolId) assert.fail("protocol proposal should create a protocol ref");
    assert.equal(protocol?.scope, "current_topic");
    assert.equal(protocol?.expiryPolicy, "explicit");
    assert.ok(Date.parse(protocol?.expiresAt ?? "") > Date.now());

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#protocolList [data-social-context-ref="${protocolId}"]`).waitFor();
    await page.waitForFunction(() => document.querySelector("#protocolList .protocol-card") !== null);
    await page.waitForFunction(() =>
      document.querySelector("#protocolList .protocol-boundary")?.textContent?.includes("proposal, not guidance"),
    );
    await page.waitForFunction(() => {
      const labels = Array.from(document.querySelectorAll("#protocolList .protocol-fact small")).map(
        (element) => element.textContent ?? "",
      );
      return labels.includes("status") && labels.includes("scope") && labels.includes("lifetime");
    });

    await page.locator(`#protocolList [data-social-context-ref="${protocolId}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortProtocolId) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("protocol") && text.includes("current_topic") && text.includes("expires in") && text.includes(shortProtocolId);
      },
      shortRefForTest(protocolId),
    );

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#protocolList [data-protocol-review-ref="${protocolId}"]`).click();
    await waitForMessage(page, "请重访这条临时房间礼仪");

    const reviewMessage = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        Boolean(event.payload.content?.includes("请重访这条临时房间礼仪")),
    );
    assert.ok(reviewMessage, "protocol review should be a normal room message");
    assert.equal(reviewMessage.payload?.content?.includes(protocolId), false);
    assert.equal(reviewMessage.payload?.contextRefs?.includes(protocolId), true);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend mixed review pressure cards carry unresolved pressure without lifecycle commands", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-mixed-pressure-"));
  const ledgerPath = path.join(dir, "room-ledger.jsonl");
  const runtime = new SpeciesRoomRuntime({
    ledgerPath,
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: mixedPressureTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 2,
  });
  const pressureRef = await appendMixedReviewPressureFixture(ledgerPath);
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    const fixtureState = await waitForRoomState(baseUrl, (state) =>
      Boolean(
        state.timeline?.some(
          (entry) =>
            entry.category === "social_loop" &&
            entry.title === "Protocol reviewed" &&
            entry.refs?.includes("protocol_browser_mixed_pressure"),
        ),
      ),
    );
    assert.equal(
      fixtureState.timeline?.some((entry) => entry.title === "Protocol reviewed" && entry.refs?.includes("protocol_review_browser_mixed_pressure")),
      true,
    );
    await page.waitForFunction(() => {
      const text = document.querySelector("#timelinePreview")?.textContent ?? "";
      return text.includes("Protocol reviewed") && text.includes("social");
    });

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#mixedReviewList [data-social-context-ref="${pressureRef}"]`).waitFor();
    await page.waitForFunction(() => {
      const text = document.querySelector("#mixedReviewList")?.textContent ?? "";
      return (
        text.includes("unresolved pressure") &&
        text.includes("memory claim") &&
        text.includes("protocol") &&
        text.includes("pressure")
      );
    });

    await page.locator(`#mixedReviewList [data-social-context-ref="${pressureRef}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortPressureRef) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("pressure") && text.includes("unresolved room pressure") && text.includes(shortPressureRef);
      },
      shortRefForTest(pressureRef),
    );
    assert.equal(await page.locator(".context-chip.pressure-context").count(), 1);

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    const beforeEvents = await rawEvents(baseUrl);
    await page.locator(`#mixedReviewList [data-mixed-pressure-review-ref="${pressureRef}"]`).click();
    await waitForMessage(page, "请重访这条未解压力");

    const revisitMessage = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        typeof event.payload?.content === "string" &&
        event.payload.content.includes("请重访这条未解压力"),
    );
    assert.ok(revisitMessage, "pressure revisit should be an ordinary room message");
    assert.equal(revisitMessage.payload?.content?.includes(pressureRef), false);
    assert.deepEqual(revisitMessage.payload?.contextRefs, [pressureRef]);

    await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "mixed_review_pressure.reviewed" &&
        (event.payload as Record<string, unknown> | undefined)?.pressureRef === pressureRef,
    );
    const afterEvents = await rawEvents(baseUrl);
    const newEvents = afterEvents.slice(beforeEvents.length);
    assert.equal(newEvents.some((event) => event.event_type === "mixed_review_pressure.reviewed"), true);
    for (const lifecycleEventType of [
      "memory.accepted",
      "memory.contested",
      "protocol.responded",
      "handoff.responded",
      "persona_delta.responded",
      "topic.responded",
      "topic.applied",
      "side_effect.approved",
      "side_effect.denied",
      "side_effect.result_reported",
    ]) {
      assert.equal(
        newEvents.some((event) => event.event_type === lifecycleEventType),
        false,
        `${lifecycleEventType} should not be created by pressure revisit prompt`,
      );
    }

    const state = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.contextAudits?.some((audit) => audit.selectedByType?.mixed_review_pressure === 1)),
    );
    assert.equal(
      state.contextAudits?.some((audit) => audit.selectedByType?.mixed_review_pressure === 1),
      true,
      "pressure revisit should reach agents as a typed mixed_review_pressure fragment",
    );
    await expandLivingOverview(page);
    await page.waitForFunction(() => {
      const text = document.querySelector("#evidenceStrip")?.textContent ?? "";
      return text.includes("social visible");
    });
    await page.locator(`#evidenceStrip [data-social-context-ref="${pressureRef}"]`).waitFor();
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend topic proposal ref can be carried into visible topic application", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-topic-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: topicProposalTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const proposeText = `@kimi_member_01 propose a topic split for browser topic movement ${Date.now()}`;
    await page.fill("#messageInput", proposeText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, proposeText);

    const proposedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.topicProposals?.some((proposal) => proposal.status === "proposed")),
    );
    const topicBeforeApply = proposedState.activeTopicId;
    assert.ok(topicBeforeApply, "first room message should establish an active topic before application");
    const proposal = proposedState.socialState?.topicProposals?.find((item) => item.status === "proposed");
    const proposalId = proposal?.proposalId;
    assert.match(proposalId ?? "", /^topic_proposal_/);
    if (!proposalId) assert.fail("topic proposal should be projected as a ref");

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    const proposalContextButton = page.locator(`#topicProposalList [data-social-context-ref="${proposalId}"]`);
    await proposalContextButton.waitFor();
    await page.waitForFunction(() => document.querySelector("#topicProposalList")?.textContent?.includes("proposed"));
    const proposalReviewButton = page.locator(`#topicProposalList [data-topic-proposal-review-ref="${proposalId}"]`);
    await proposalReviewButton.waitFor();
    await proposalReviewButton.click();
    const reviewMessage = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        typeof event.payload?.content === "string" &&
        event.payload.content.includes("请重访这条话题建议"),
    );
    assert.ok(reviewMessage, "topic proposal review should be a normal room message");
    assert.equal(reviewMessage.payload?.content?.includes(proposalId), false);
    assert.deepEqual(reviewMessage.payload?.contextRefs, [proposalId]);
    const reviewedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.topicProposalReviews?.some((review) => review.topicProposalRef === proposalId)),
    );
    const reviewedProposal = reviewedState.socialState?.topicProposals?.find((item) => item.proposalId === proposalId);
    assert.equal(reviewedProposal?.status, "proposed");
    assert.equal(reviewedProposal?.responseCount, 0);
    assert.equal(
      reviewedState.socialState?.topicProposalReviews?.some(
        (review) =>
          review.topicProposalRef === proposalId &&
          review.response === "cautioned" &&
          review.summary?.includes("keep the review visible"),
      ),
      true,
    );
    assert.equal(
      reviewedState.timeline?.some(
        (entry) =>
          entry.category === "social_loop" &&
          entry.title === "Topic proposal reviewed" &&
          entry.refs?.includes(proposalId),
      ),
      true,
    );
    await page.waitForFunction(() => {
      const text = document.querySelector("#timelinePreview")?.textContent ?? "";
      return text.includes("Topic proposal reviewed") && text.includes("social");
    });

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (proposalId) =>
        /\d+ reviews/.test(document.querySelector("#topicProposalList")?.textContent ?? "") &&
        document.querySelector("#topicProposalList")?.textContent?.includes("keep the review visible") &&
        document.querySelector(`#topicProposalList [data-social-context-ref="${proposalId}"]`) !== null,
      proposalId,
    );
    await proposalContextButton.click();
    await page.waitForFunction(() => document.querySelector("#contextTray")?.hasAttribute("hidden") === false);
    const shortProposalId = shortRefForTest(proposalId);
    await page.waitForFunction(
      (shortProposalId) => document.querySelector("#contextTray")?.textContent?.includes(shortProposalId),
      shortProposalId,
    );
    await page.waitForFunction(() => {
      const text = document.querySelector("#contextTray")?.textContent ?? "";
      return text.includes("topic proposal") && text.includes("proposed") && text.includes("split");
    });
    await waitForText(page, "#composerState", "topic proposal context");

    const applyText = `@kimi_member_01 apply the selected topic proposal as visible room movement ${Date.now()}`;
    await page.fill("#messageInput", applyText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, applyText);

    const appliedState = await waitForRoomState(baseUrl, (state) =>
      Boolean(
        state.activeTopicId &&
          state.activeTopicId !== topicBeforeApply &&
          state.socialState?.topicProposals?.some((item) => item.proposalId === proposalId && item.status === "applied"),
      ),
    );
    const appliedProposal = appliedState.socialState?.topicProposals?.find((item) => item.proposalId === proposalId);
    assert.equal(appliedProposal?.status, "applied");
    assert.equal(appliedProposal?.appliedBy, "kimi_member_01");
    assert.match(appliedProposal?.resultingTopicId ?? "", /^topic_/);
    assert.equal(appliedState.activeTopicId, appliedProposal?.resultingTopicId);
    assert.equal(
      appliedState.timeline?.some(
        (entry) =>
          entry.category === "social_loop" &&
          entry.title === "Topic proposal applied" &&
          entry.refs?.includes(proposalId) &&
          entry.refs?.includes(appliedProposal?.resultingTopicId ?? ""),
      ),
      true,
    );

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await waitForText(page, "#topicBar", "Applied browser topic movement");
    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (proposalId) =>
        document.querySelector("#topicProposalList")?.textContent?.includes("applied") &&
        document.querySelector(`#topicProposalList [data-social-context-ref="${proposalId}"]`) !== null &&
        document.querySelector("#topicProposalList")?.textContent?.includes("applied by kimi_member_01"),
      proposalId,
    );

    const events = await rawEvents(baseUrl);
    const applyMessage = events.find(
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        typeof event.payload?.content === "string" &&
        event.payload.content.includes(applyText),
    );
    assert.deepEqual(applyMessage?.payload?.contextRefs, [proposalId]);
    assert.equal(events.filter((event) => event.event_type === "topic.proposed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "topic.reviewed").length >= 1, true);
    assert.equal(events.filter((event) => event.event_type === "topic.applied").length, 1);
    assert.equal(events.filter((event) => event.event_type === "topic.responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "topic.created").length >= 2, true);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend provider boundary cards keep runtime failures separate from agent silence", async (t) => {
  const executablePath = browserExecutablePath();
  if (executablePath === null) {
    t.skip("No Chrome or Edge executable was found for browser-level frontend coverage.");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "species-frontend-provider-boundary-"));
  const runtime = new SpeciesRoomRuntime({
    ledgerPath: path.join(dir, "room-ledger.jsonl"),
    smoke: async () => smokeReport(),
    liveAgents: true,
    agentAdapterOptions: providerBoundaryTestInvokers(),
    maxConcurrentBackgroundTurns: 1,
    maxSpeakers: 4,
  });
  const server = createSpeciesHttpServer({
    runtime,
    webRoot: path.resolve(__dirname, "../../web"),
  });
  await listen(server);

  let browser: Browser | null = null;
  try {
    const baseUrl = serverBaseUrl(server);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    await page.goto(baseUrl);
    await waitForText(page, "#connectionStatus", "connected");
    await waitForText(page, "#roomSubtitle", "6 live");

    const triggerText = `@kimi_member_01 trigger provider boundary card ${Date.now()}`;
    await page.fill("#messageInput", triggerText);
    await page.press("#messageInput", "Enter");
    await waitForMessage(page, triggerText);

    const boundaryState = await waitForRoomState(baseUrl, (state) =>
      Boolean(state.socialState?.providerBoundaries?.some((boundary) => boundary.agentId === "kimi_member_01")),
    );
    const boundary = boundaryState.socialState?.providerBoundaries?.find((item) => item.agentId === "kimi_member_01");
    const boundaryId = boundary?.boundaryId;
    assert.match(boundaryId ?? "", /^evt_/);
    if (!boundaryId) assert.fail("provider degradation should create a provider boundary ref");
    assert.equal(boundary?.boundaryNote, "provider degradation is not agent silence");
    assert.equal(boundary?.providerLabel, "Volcengine Ark Plan kimi-k2.6");
    assert.equal(boundary?.sourceRefs?.some((ref) => ref.startsWith("evt_")), true);
    const staleBoundaryId = await appendStaleProviderBoundary(path.join(dir, "room-ledger.jsonl"));
    await appendProviderBoundaryChoicePressureFixture(path.join(dir, "room-ledger.jsonl"), boundaryId);

    await page.evaluate(async () => {
      await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
        preserveComposerState: true,
      });
    });
    await expandLivingOverview(page);
    await page.locator(`#providerBoundaryPreview [data-social-context-ref="${boundaryId}"]`).waitFor();
    await page.waitForFunction(() => {
      const count = document.querySelector("#providerBoundaryCount")?.textContent ?? "";
      const text = document.querySelector("#providerBoundaryPreview")?.textContent ?? "";
      return (
        count.trim() === "1/2" &&
        text.includes("choice pressure traces") &&
        text.includes("mixed choices") &&
        text.includes("multi-agent") &&
        text.includes("boundary pressure") &&
        text.includes("repair") &&
        text.includes("denied") &&
        text.includes("retry") &&
        text.includes("silence") &&
        text.includes("memory contest") &&
        text.includes("archives") &&
        text.includes("agents") &&
        text.includes("pressure refs") &&
        text.includes("evidence refs")
      );
    });
    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#providerBoundaryList [data-social-context-ref="${boundaryId}"]`).waitFor();
    await page.waitForFunction(() => document.querySelector("#providerBoundaryList .provider-boundary-card") !== null);
    await page.waitForFunction(() => {
      const text = document.querySelector("#providerBoundaryList .provider-boundary-warning")?.textContent ?? "";
      return text.includes("runtime availability") && text.includes("not agent silence") && text.includes("not personality");
    });
    await page.waitForFunction(() => {
      const card = document.querySelector("#providerBoundaryList .provider-boundary-card");
      const text = card?.textContent ?? "";
      const body = card?.querySelector(".social-body")?.textContent ?? "";
      return (
        body.includes("Provider availability changed") &&
        body.includes("provider degradation is not agent silence") &&
        text.includes("diagnostic") &&
        text.includes("recorded as bounded evidence") &&
        !text.includes("simulated provider outage")
      );
    });
    await page.waitForFunction(() => {
      const labels = Array.from(document.querySelectorAll("#providerBoundaryList .provider-boundary-fact small")).map(
        (element) => element.textContent ?? "",
      );
      return labels.includes("agent") && labels.includes("provider") && labels.includes("repeat") && labels.includes("age");
    });
    await page.waitForFunction(() => {
      const text = document.querySelector("#providerBoundaryList .provider-choice-pressure")?.textContent ?? "";
      return (
        text.includes("choice pressure") &&
        text.includes("mixed choices") &&
        text.includes("multi-agent") &&
        text.includes("repair") &&
        text.includes("denied") &&
        text.includes("retry") &&
        text.includes("silence") &&
        text.includes("memory contest") &&
        text.includes("agents")
      );
    });
    await page.waitForFunction(() => {
      const text = document.querySelector("#providerBoundaryList .provider-boundary-controls")?.textContent ?? "";
      return text.includes("1 active") && text.includes("1 hidden stale") && text.includes("2 total");
    });
    assert.equal(await page.locator(`#providerBoundaryList [data-social-context-ref="${staleBoundaryId}"]`).count(), 0);

    await page.locator("#providerBoundaryList [data-provider-boundary-filter='all']").click();
    await page.locator(`#providerBoundaryList [data-social-context-ref="${staleBoundaryId}"]`).waitFor();
    await page.waitForFunction(() => {
      const stale = document.querySelector("#providerBoundaryList .provider-boundary-card.stale");
      return (
        stale?.textContent?.includes("stale runtime record") &&
        stale.textContent.includes("Volcengine Ark deepseek-v4-pro") &&
        stale.textContent.includes("3d ago") &&
        !stale.textContent.includes("stale provider diagnostic")
      );
    });

    await page.locator(`#providerBoundaryList [data-social-context-ref="${boundaryId}"]`).click();
    await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.waitForFunction(
      (shortBoundaryId) => {
        const text = document.querySelector("#contextTray")?.textContent ?? "";
        return text.includes("provider boundary") && text.includes("runtime availability") && text.includes(shortBoundaryId);
      },
      shortRefForTest(boundaryId),
    );

    await page.locator("#settingsButton").click();
    await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
    await page.locator(`#providerBoundaryList [data-provider-boundary-repair-ref="${boundaryId}"]`).click();
    await waitForMessage(page, "请讨论这条运行时边界");

    const repairMessage = await waitForRawEvent(
      baseUrl,
      (event) =>
        event.event_type === "message.created" &&
        event.payload?.authorKind === "user" &&
        Boolean(event.payload.content?.includes("请讨论这条运行时边界")),
    );
    assert.ok(repairMessage, "provider boundary repair prompt should be a normal room message");
    assert.equal(repairMessage.payload?.content?.includes(boundaryId), false);
    assert.equal(repairMessage.payload?.contextRefs?.includes(boundaryId), true);
  } finally {
    await browser?.close();
    await close(server);
    await rm(dir, { recursive: true, force: true });
  }
});

function browserExecutablePath(): string | null {
  const candidates = [
    process.env.SPECIES_BROWSER_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  const executable = candidates.find((candidate) => existsSync(candidate)) ?? null;
  if (executable === null && process.env.SPECIES_REQUIRE_BROWSER_TESTS === "1") {
    throw new Error("SPECIES_REQUIRE_BROWSER_TESTS=1 but no supported Chrome, Chromium, or Edge executable was found");
  }
  return executable;
}

async function waitForText(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForFunction(
    ({ selector, text }) => document.querySelector(selector)?.textContent?.includes(text),
    { selector, text },
  );
}

async function waitForMessage(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (text) =>
      Array.from(document.querySelectorAll(".message-row .message-text")).some((element) =>
        element.textContent?.includes(text),
      ),
    text,
  );
}

async function expandLivingOverview(page: Page): Promise<void> {
  const toggle = page.locator("#overviewToggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await page.waitForFunction(() => document.querySelector<HTMLDivElement>("#overviewPanel")?.hidden === false);
}

async function verifySettingsFocusBoundary(page: Page): Promise<void> {
  await page.locator("#settingsButton").click();
  await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
  assert.equal(await page.locator("#settingsPanel").getAttribute("role"), "dialog");
  assert.equal(await page.locator("#settingsPanel").getAttribute("aria-modal"), "true");
  assert.equal(await page.locator("#settingsPanel").getAttribute("aria-hidden"), "false");
  assert.equal(await page.locator("#settingsButton").getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#chatShell").evaluate((element) => element.hasAttribute("inert")), true);
  assert.equal(await page.locator("#roomRail").evaluate((element) => element.hasAttribute("inert")), true);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "closeSettings");

  await page.keyboard.press("Shift+Tab");
  await page.waitForFunction(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.closest("#settingsPanel") !== null && active.id !== "closeSettings";
  });
  const lastFocusId = await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent?.trim());
  assert.notEqual(lastFocusId, "settingsButton");

  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement?.id === "closeSettings");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
  assert.equal(await page.locator("#settingsPanel").getAttribute("aria-hidden"), "true");
  assert.equal(await page.locator("#settingsButton").getAttribute("aria-expanded"), "false");
  assert.equal(await page.locator("#chatShell").evaluate((element) => element.hasAttribute("inert")), false);
  assert.equal(await page.locator("#roomRail").evaluate((element) => element.hasAttribute("inert")), false);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "settingsButton");
}

async function verifyArchiveReviewControls(page: Page, baseUrl: string): Promise<void> {
  await expandLivingOverview(page);

  await page.locator("#settingsButton").click();
  await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));

  const beforeRhythmEvents = await rawEvents(baseUrl);
  await page.locator("#archiveRhythmButton").click();
  await page.waitForFunction(() => document.querySelector("#archiveState")?.textContent?.includes("已进入房间"));
  await waitForMessage(page, "daily rhythm check-in");
  const afterRhythmEvents = await rawEvents(baseUrl);
  const rhythmEvents = afterRhythmEvents.slice(beforeRhythmEvents.length);
  const rhythmMessage = rhythmEvents.find(
    (event) =>
      event.event_type === "message.created" &&
      event.payload?.authorKind === "user" &&
      typeof event.payload?.content === "string" &&
      event.payload.content.includes("daily rhythm check-in"),
  );
  assert.ok(rhythmMessage, "daily rhythm should be a normal room message");
  assert.deepEqual(rhythmMessage.payload?.contextRefs, []);
  assert.equal(
    rhythmEvents.some((event) => event.event_type === "daily_archive.created"),
    false,
  );
  assert.equal(
    rhythmEvents.some((event) => event.event_type === "archive.review_requested"),
    false,
  );

  await page.locator("#archiveNowButton").click();
  await page.waitForFunction(() => document.querySelector("#archiveState")?.textContent?.includes("这是时间骨架"));
  await page.waitForFunction(() => document.querySelector("#archiveList")?.textContent?.includes("archive"));
  await page.waitForFunction(() => document.querySelector("#archiveList .archive-card") !== null);
  await page.waitForFunction(() => document.querySelector("#archiveList .archive-boundary")?.textContent?.includes("not consensus"));
  await page.waitForFunction(() => {
    const labels = Array.from(document.querySelectorAll("#archiveList .archive-stat small")).map((element) => element.textContent ?? "");
    return labels.includes("events") && labels.includes("memory") && labels.includes("open questions");
  });

  const archivedState = await roomState(baseUrl);
  const archiveId = archivedState.socialState?.archives?.at(-1)?.archiveId;
  assert.match(archiveId ?? "", /^day_/);
  if (!archiveId) assert.fail("archive view should expose a daily archive ref");
  const archiveReviewRequest = archivedState.socialState?.archiveReviews?.find(
    (review) => review.kind === "review_request" && review.archiveRef === archiveId,
  );
  const archiveReviewRequestId = archiveReviewRequest?.id;
  assert.match(archiveReviewRequestId ?? "", /^archive_review_request_/);
  if (!archiveReviewRequestId) assert.fail("archive review request should be exposed as a social ref");
  await page.locator(`#archivePreview [data-social-context-ref="${archiveReviewRequestId}"]`).first().waitFor();
  await page.waitForFunction(
    (shortReviewRequestId) => {
      const text = document.querySelector("#archivePreview")?.textContent ?? "";
      return text.includes("time skeleton") && text.includes("evidence refs") && text.includes(shortReviewRequestId);
    },
    shortRefForTest(archiveReviewRequestId),
  );
  await page.waitForFunction(() => {
    const text = document.querySelector("#archivePreview")?.textContent ?? "";
    return (
      text.includes("time rhythm") &&
      text.includes("events") &&
      text.includes("reviews") &&
      text.includes("repairs") &&
      text.includes("lineage") &&
      text.includes("continuity") &&
      text.includes("providers")
    );
  });
  await page.locator(`#archiveList [data-social-context-ref="${archiveId}"]`).waitFor();
  await page.locator(`#archiveReviewList [data-social-context-ref="${archiveReviewRequestId}"]`).waitFor();
  const archiveEvents = await rawEvents(baseUrl);
  assert.equal(
    archiveEvents.some((event) => event.event_type === "daily_archive.created"),
    true,
  );
  assert.equal(
    archiveEvents.some((event) => event.event_type === "archive.review_requested"),
    true,
  );

  await page.locator(`#archiveReviewList [data-social-context-ref="${archiveReviewRequestId}"]`).click();
  await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
  await page.waitForFunction(
    (shortReviewRequestId) => {
      const text = document.querySelector("#contextTray")?.textContent ?? "";
      return (
        text.includes("archive review") &&
        text.includes("daily rhythm invitation") &&
        text.includes(shortReviewRequestId)
      );
    },
    shortRefForTest(archiveReviewRequestId),
  );
  assert.equal(await page.locator(".context-chip.archive-review-context").count(), 1);

  await page.locator("#settingsButton").click();
  await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));

  const beforeArchiveRhythmEvents = await rawEvents(baseUrl);
  await page.locator("#archiveRhythmButton").click();
  await page.waitForFunction(() => document.querySelector("#archiveState")?.textContent?.includes("已进入房间"));
  const afterArchiveRhythmEvents = await rawEvents(baseUrl);
  const archiveRhythmEvents = afterArchiveRhythmEvents.slice(beforeArchiveRhythmEvents.length);
  const archiveRhythmMessage = archiveRhythmEvents.find(
    (event) =>
      event.event_type === "message.created" &&
      event.payload?.authorKind === "user" &&
      typeof event.payload?.content === "string" &&
      event.payload.content.includes("daily rhythm check-in"),
  );
  assert.ok(archiveRhythmMessage, "daily rhythm should remain a normal room message after archive creation");
  assert.equal(archiveRhythmMessage.payload?.contextRefs?.includes(archiveId), true);
  assert.equal(
    archiveRhythmEvents.some((event) => event.event_type === "daily_archive.created"),
    false,
  );
  assert.equal(
    archiveRhythmEvents.some((event) => event.event_type === "archive.review_requested"),
    false,
  );

  await page.locator("#archiveReviewButton").click();
  await page.waitForFunction(() => document.querySelector("#archiveState")?.textContent?.includes("agent 可反驳"));
  await waitForMessage(page, "请审阅这份 daily time skeleton");

  const reviewMessage = await waitForRawEvent(
    baseUrl,
    (event) =>
      event.event_type === "message.created" &&
      event.payload?.authorKind === "user" &&
      typeof event.payload?.content === "string" &&
      event.payload.content.includes("请审阅这份 daily time skeleton"),
  );
  const reviewEvents = await rawEvents(baseUrl);
  assert.ok(reviewMessage, "archive review invitation should be a normal room message");
  assert.equal(reviewMessage.payload?.content?.includes(archiveId), false);
  assert.deepEqual(reviewMessage.payload?.contextRefs, [archiveId]);
  assert.equal(
    reviewEvents.filter((event) => event.event_type === "daily_archive.created").length,
    1,
  );
  assert.equal(
    reviewEvents.filter((event) => event.event_type === "archive.review_requested").length,
    1,
  );

  await page.locator(`#archiveList [data-social-context-ref="${archiveId}"]`).click();
  await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
  await page.waitForFunction(
    (shortArchiveId) => {
      const text = document.querySelector("#contextTray")?.textContent ?? "";
      return text.includes("archive") && text.includes("daily") && text.includes(shortArchiveId);
    },
    shortRefForTest(archiveId ?? ""),
  );
}

async function verifyRoomRhythmOverviewRefs(page: Page, baseUrl: string): Promise<void> {
  const ticked = await postAutonomyTick(baseUrl, { force: true, timezone: "Asia/Shanghai" });
  const tick = ticked.autonomyTick;
  const tickId = tick?.tickId;
  assert.match(tickId ?? "", /^autonomy_tick_/);
  if (!tickId) assert.fail("autonomy tick should expose a rhythm ref");

  await page.evaluate(async () => {
    await (window as unknown as { loadRoomState: (options: { preserveComposerState: boolean }) => Promise<void> }).loadRoomState({
      preserveComposerState: true,
    });
  });
  await expandLivingOverview(page);
  await page.locator(`#evidenceStrip [data-room-rhythm-ref="${tickId}"]`).waitFor();
  const overviewText = await page.locator("#evidenceStrip .rhythm-evidence").textContent();
  assert.match(overviewText ?? "", /Room rhythm/);
  assert.match(overviewText ?? "", /Choices/);
  assert.match(overviewText ?? "", /Decision refs/);
  assert.match(overviewText ?? "", /decision refs/);
  if (tick.action?.includes("_")) {
    assert.equal((overviewText ?? "").includes(tick.action), false);
  }
  const expectedTimelineTitle = roomRhythmTimelineTitleForTest(tick.action);
  await page.waitForFunction(
    (expectedTitle) => {
      const text = document.querySelector("#timelinePreview")?.textContent ?? "";
      return text.includes(expectedTitle);
    },
    expectedTimelineTitle,
  );
  const timelineText = await page.locator("#timelinePreview").textContent();
  assert.match(timelineText ?? "", /rhythm/);
  if (tick.action?.includes("_")) {
    assert.equal((timelineText ?? "").includes(tick.action), false);
  }
  const choiceLabels = (tick.choiceSet ?? []).map((choice) => roomRhythmActionLabelForTest(choice.action));
  assert.equal(
    choiceLabels.some((label) => label && (overviewText ?? "").includes(label)),
    true,
  );
  const choiceButtonCount = await page.locator("#evidenceStrip [data-room-rhythm-choice-ref]").count();
  assert.equal(choiceButtonCount >= 1, true);
  const firstChoice = tick.choiceSet?.[0];
  assert.ok(firstChoice, "autonomy tick should expose at least one visible rhythm choice");
  const expectedChoiceEvidence = `T${firstChoice.targetRefs?.length ?? 0} · E${firstChoice.evidenceRefs?.length ?? 0}`;
  assert.equal(await page.locator("#evidenceStrip .room-rhythm-choice-evidence").first().textContent(), expectedChoiceEvidence);
  assert.equal(await page.locator("#evidenceStrip .room-rhythm-choice.missing-evidence").count(), 0);
  const firstChoiceTitle = await page.locator("#evidenceStrip .room-rhythm-choice").first().getAttribute("title");
  assert.match(firstChoiceTitle ?? "", /target refs/);
  assert.match(firstChoiceTitle ?? "", /evidence refs/);

  await page.locator(`#evidenceStrip [data-room-rhythm-ref="${tickId}"]`).click();
  await page.waitForFunction(
    (shortTickId) => {
      const text = document.querySelector("#contextTray")?.textContent ?? "";
      return text.includes("room rhythm") && text.includes("choices") && text.includes(shortTickId);
    },
    shortRefForTest(tickId),
  );
}

function roomRhythmActionLabelForTest(action: string | undefined): string {
  if (action === "archive_and_invite_review") return "archive + review invitation";
  if (action === "review_open_archive") return "review invitation";
  if (action === "memory_hygiene_review") return "memory hygiene";
  if (action === "continuity_review") return "continuity review";
  if (action === "provider_boundary_review") return "provider boundary review";
  if (action === "open_question_revisit") return "open question revisit";
  if (action === "invitation_review") return "invitation review";
  if (action === "handoff_review") return "handoff review";
  if (action === "idle_social_rhythm") return "idle social rhythm";
  if (action === "silence_reentry") return "silence re-entry";
  if (action === "stay_silent") return "preserved silence";
  return action ?? "";
}

function roomRhythmTimelineTitleForTest(action: string | undefined): string {
  if (action === "archive_and_invite_review") return "Room rhythm archived the day and invited review";
  if (action === "review_open_archive") return "Room rhythm carried an archive review invitation";
  if (action === "memory_hygiene_review") return "Room rhythm opened memory hygiene review";
  if (action === "continuity_review") return "Room rhythm opened agent continuity review";
  if (action === "provider_boundary_review") return "Room rhythm opened provider boundary review";
  if (action === "open_question_revisit") return "Room rhythm revisited an open question";
  if (action === "invitation_review") return "Room rhythm carried an invitation review";
  if (action === "handoff_review") return "Room rhythm carried a handoff review";
  if (action === "idle_social_rhythm") return "Room rhythm opened idle social talk";
  if (action === "silence_reentry") return "Room rhythm reopened after silence";
  if (action === "stay_silent") return "Room rhythm preserved silence";
  return "Room rhythm recorded an autonomous choice";
}

async function verifyContextAuditCards(page: Page): Promise<void> {
  await page.locator("#settingsButton").click();
  await page.waitForFunction(() => document.querySelector("#settingsPanel")?.classList.contains("open"));
  await page.waitForFunction(() => document.querySelector("#contextAuditList .audit-card") !== null);
  await page.waitForFunction(() => {
    const labels = Array.from(document.querySelectorAll("#contextAuditList .audit-fact small")).map(
      (element) => element.textContent ?? "",
    );
    return labels.includes("selected") && labels.includes("omitted") && labels.includes("largest") && labels.includes("ledger");
  });
  await page.waitForFunction(() => {
    const text = document.querySelector("#contextAuditList")?.textContent ?? "";
    return (
      text.includes("fragment bodies hidden") &&
      text.includes("Co-visible context") &&
      text.includes("/5 domains") &&
      text.includes("archive") &&
      text.includes("memory") &&
      text.includes("continuity") &&
      text.includes("provider") &&
      text.includes("social lineage") &&
      text.includes("Selected fragments") &&
      text.includes("Omitted fragments") &&
      text.includes("cache")
    );
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#settingsPanel")?.classList.contains("open"));
}

async function postRoomMessage(baseUrl: string, content: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/room/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content,
      clientMessageId: `browser_remote_${Date.now()}`,
      mentions: [],
      contextRefs: [],
    }),
  });
  if (!response.ok) {
    assert.fail(await response.text());
  }
}

async function postAutonomyTick(
  baseUrl: string,
  body: {
    force?: boolean;
    timezone?: string;
    memoryHygieneReviewAfterMs?: number;
    continuityReviewAfterMs?: number;
    silenceReentryAfterMs?: number;
  },
): Promise<{
  autonomyTick?: {
    tickId?: string;
    action?: string;
    choiceSet?: { action?: string; targetRefs?: string[]; evidenceRefs?: string[] }[];
  };
}> {
  const response = await fetch(`${baseUrl}/api/room/autonomy/tick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    assert.fail(await response.text());
  }
  return (await response.json()) as {
    autonomyTick?: {
      tickId?: string;
      action?: string;
      choiceSet?: { action?: string; targetRefs?: string[]; evidenceRefs?: string[] }[];
    };
  };
}

async function postUntilExpectedAutonomyTick(baseUrl: string, action: string): Promise<string> {
  const allowedInterleaves = new Set(["archive_and_invite_review", "review_open_archive"]);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await postAutonomyTick(baseUrl, { force: true, timezone: "Asia/Shanghai" });
    const tickAction = result.autonomyTick?.action;
    const tickId = result.autonomyTick?.tickId;
    assert.match(tickId ?? "", /^autonomy_tick_/);
    if (!tickId) assert.fail(`${tickAction ?? action} should expose an autonomy tick ref`);
    if (tickAction === action) {
      return tickId;
    }
    assert.equal(
      allowedInterleaves.has(tickAction ?? ""),
      true,
      `${action} should only be preceded by archive rhythm interleaves, got ${tickAction ?? "missing action"}`,
    );
  }
  assert.fail(`Timed out waiting for autonomous ${action} tick`);
}

async function rawEvents(baseUrl: string): Promise<RuntimeEvent[]> {
  const response = await fetch(`${baseUrl}/api/room/events`);
  if (!response.ok) {
    assert.fail(await response.text());
  }
  const body = (await response.json()) as { events: RuntimeEvent[] };
  return body.events;
}

async function waitForRawEvent(
  baseUrl: string,
  predicate: (event: RuntimeEvent) => boolean,
  timeoutMs = 15_000,
): Promise<RuntimeEvent> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const event = (await rawEvents(baseUrl)).find(predicate);
    if (event) {
      return event;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail(`Timed out waiting for ledger event after ${timeoutMs}ms`);
}

async function roomState(baseUrl: string): Promise<RuntimeRoomState> {
  const response = await fetch(`${baseUrl}/api/room/state`);
  if (!response.ok) {
    assert.fail(await response.text());
  }
  return (await response.json()) as RuntimeRoomState;
}

async function waitForRoomState(
  baseUrl: string,
  predicate: (state: RuntimeRoomState) => boolean,
  timeoutMs = 15_000,
): Promise<RuntimeRoomState> {
  const startedAt = Date.now();
  let latest = await roomState(baseUrl);
  while (Date.now() - startedAt < timeoutMs) {
    latest = await roomState(baseUrl);
    if (predicate(latest)) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail(`Timed out waiting for room state after ${timeoutMs}ms`);
}

async function listen(server: ReturnType<typeof createSpeciesHttpServer>): Promise<void> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}

function serverBaseUrl(server: ReturnType<typeof createSpeciesHttpServer>): string {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: ReturnType<typeof createSpeciesHttpServer>): Promise<void> {
  server.close();
  await once(server, "close");
}

type RuntimeEvent = {
  event_type: string;
  payload?: {
    authorKind?: string;
    content?: string;
    contextRefs?: string[];
    mentions?: string[];
  };
};

type RuntimeRoomState = {
  activeTopicId?: string;
  messages?: {
    authorKind?: string;
    displayName?: string;
    text?: string;
  }[];
  timeline?: {
    category?: string;
    title?: string;
    refs?: string[];
  }[];
  topics?: {
    topicId?: string;
    title?: string;
    status?: string;
  }[];
  contextAudits?: {
    selectedByType?: Record<string, number>;
  }[];
  socialState?: {
    topicProposals?: {
      proposalId?: string;
      status?: string;
      resultingTopicId?: string;
      appliedBy?: string;
      responseCount?: number;
    }[];
    topicProposalReviews?: {
      topicProposalRef?: string;
      response?: string;
      summary?: string;
    }[];
    archives?: {
      archiveId?: string;
      revisionOf?: string;
      appliedRepairRef?: string;
      provenanceRefs?: string[];
    }[];
    archiveReviews?: {
      id?: string;
      kind?: string;
      archiveRef?: string;
      repairRef?: string;
      revisedArchiveRef?: string;
    }[];
    memoryClaims?: {
      memoryId?: string;
      state?: string;
      summary?: string;
      revisedFromMemoryRef?: string;
      revisedBy?: string;
      sourceRefs?: string[];
      transitionCount?: number;
      provisionalNote?: string;
    }[];
    personas?: {
      agentId?: string;
      dailyMoodRecord?: {
        posture?: string;
        sourceRef?: string;
        evidenceRefs?: string[];
        responseRefs?: string[];
      };
      roleClaims?: {
        roleClaimId?: string;
        label?: string;
        status?: string;
        evidenceRefs?: string[];
        responseRefs?: string[];
      }[];
      evolutionLog?: {
        deltaId?: string;
        field?: string;
        status?: string;
      }[];
    }[];
    openQuestions?: {
      questionId?: string;
      question?: string;
      boundaryNote?: string;
      responseCount?: number;
    }[];
    handoffs?: {
      handoffId?: string;
      status?: string;
      fromAgentId?: string;
      toAgentId?: string;
      delegatedFromHandoffRef?: string;
      delegatedBy?: string;
      requestedResponse?: string;
      responseCount?: number;
      responses?: {
        byAgentId?: string;
        response?: string;
        reason?: string;
        redirectTo?: string;
      }[];
    }[];
    invitations?: {
      invitationId?: string;
      status?: string;
      fromAgentId?: string;
      toAgentId?: string;
      reason?: string;
      responseCount?: number;
      contextRefs?: string[];
      delegatedFromInvitationRef?: string;
    }[];
    invitationReviews?: {
      invitationRef?: string;
      response?: string;
      summary?: string;
    }[];
    protocols?: {
      protocolId?: string;
      status?: string;
      summary?: string;
      scope?: string;
      expiresAt?: string;
      expiryPolicy?: string;
    }[];
    providerBoundaries?: {
      boundaryId?: string;
      agentId?: string;
      providerLabel?: string;
      sourceRefs?: string[];
      boundaryNote?: string;
    }[];
    sideEffects?: {
      requestId: string;
      approvalId?: string;
      status?: string;
      requestedBy?: string;
      kind?: string;
      target: string;
      reason?: string;
      expectedImpact?: string;
      contextRefs?: string[];
    }[];
  };
};

async function appendStaleProviderBoundary(ledgerPath: string): Promise<string> {
  const oldOccurredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const ledger = new RoomLedger({
    filePath: ledgerPath,
    idFactory: (prefix) => `${prefix}_stale_provider_boundary`,
  });
  const result = await ledger.append({
    roomId: "room_species",
    eventType: "agent.provider_degraded",
    actor: { kind: "system", id: "runtime" },
    payload: {
      agentId: "mimo_member_04",
      providerKind: "volc_ark_openai",
      providerLabel: "Volcengine Ark deepseek-v4-pro",
      diagnostic: "stale provider diagnostic for browser filtering",
      triggeringEventId: "evt_stale_provider_trigger",
      packetId: "packet_stale_provider",
      boundaryNote: "provider degradation is not agent silence",
    },
    refs: ["evt_stale_provider_trigger"],
    correlationId: "browser_provider_boundary_filter",
    idempotencyKey: "browser_provider_boundary_filter:stale",
    occurredAt: oldOccurredAt,
  });
  if (result.status !== "appended") {
    assert.fail(`stale provider boundary fixture append failed: ${result.status}`);
  }
  return result.event.event_id;
}

async function appendProviderBoundaryChoicePressureFixture(ledgerPath: string, boundaryRef: string): Promise<void> {
  let sequence = 0;
  const ledger = new RoomLedger({
    filePath: ledgerPath,
    idFactory: (prefix) => `${prefix}_browser_provider_choice_${++sequence}`,
  });
  const append = async (
    eventType: string,
    actor: { kind: "user" | "agent" | "system" | "policy"; id: string },
    payload: Record<string, unknown>,
    refs: string[],
  ): Promise<void> => {
    const result = await ledger.append({
      roomId: "room_species",
      eventType,
      actor,
      payload,
      refs,
      correlationId: "browser_provider_boundary_choice_pressure",
      idempotencyKey: `browser_provider_boundary_choice_pressure:${eventType}:${++sequence}`,
    });
    if (result.status !== "appended") {
      assert.fail(`provider boundary choice pressure append failed: ${result.status}`);
    }
  };

  const repairRef = `sidefx_browser_provider_choice_${Date.now()}`;
  const protocolRef = `protocol_browser_provider_choice_${Date.now()}`;
  const memoryRef = `memory_browser_provider_choice_${Date.now()}`;
  await append(
    "side_effect.requested",
    { kind: "agent", id: "boundary_observer" },
    {
      requestId: repairRef,
      requestedBy: "boundary_observer",
      kind: "network.request",
      target: "provider://browser-test",
      reason: "provider diagnostic repair request should stay approval-gated",
      expectedImpact: "Record a possible repair path without executing it.",
      contextRefs: [boundaryRef],
    },
    [boundaryRef],
  );
  await append(
    "side_effect.denied",
    { kind: "user", id: "room_boundary" },
    {
      requestId: repairRef,
      decidedBy: "approval_guard",
      reason: "This repair request is too broad for the room.",
    },
    [repairRef],
  );
  await append(
    "protocol.proposed",
    { kind: "agent", id: "retry_keeper" },
    {
      protocolId: protocolRef,
      proposedBy: "retry_keeper",
      summary: "Later retry should stay temporary instead of becoming automatic repair.",
      scope: "timeboxed",
      reason: "Retry is social etiquette, not a command.",
      contextRefs: [boundaryRef],
      status: "proposed",
    },
    [boundaryRef],
  );
  await append(
    "agent.intention_recorded",
    { kind: "agent", id: "quiet_listener" },
    {
      agentId: "quiet_listener",
      triggeringEventId: boundaryRef,
      intention: {
        kind: "stay_silent",
        reason: "The provider boundary is already visible, so silence can be a real choice.",
        contextRefs: [boundaryRef],
      },
    },
    [boundaryRef],
  );
  await append(
    "memory.proposed",
    { kind: "agent", id: "memory_keeper" },
    {
      memoryId: memoryRef,
      state: "proposed",
      summary: "Provider boundary pressure produced repair, retry, denial, and silence without becoming recovery truth.",
      reason: "Browser card fixture for provider boundary choice pressure.",
      sourceRefs: [boundaryRef, repairRef, protocolRef],
      proposedBy: "memory_keeper",
    },
    [boundaryRef, repairRef, protocolRef],
  );
  await append(
    "memory.contested",
    { kind: "agent", id: "critic" },
    {
      memoryId: memoryRef,
      memoryRef,
      reason: "Keep the memory provisional instead of treating it as recovery truth.",
      contestedBy: "critic",
    },
    [memoryRef],
  );
}

async function appendMixedReviewPressureFixture(ledgerPath: string): Promise<string> {
  let sequence = 0;
  const ledger = new RoomLedger({
    filePath: ledgerPath,
    idFactory: (prefix) => `${prefix}_browser_mixed_pressure_${++sequence}`,
  });
  const correlationId = "browser_mixed_review_pressure";
  const sourceMessageId = "msg_browser_mixed_pressure_source";
  const memoryRef = "memory_browser_mixed_pressure";
  const protocolRef = "protocol_browser_mixed_pressure";
  const append = async (
    eventType: string,
    actor: { kind: "user" | "agent" | "system" | "policy"; id: string },
    payload: Record<string, unknown>,
    refs: string[],
  ): Promise<void> => {
    const result = await ledger.append({
      roomId: "room_species",
      eventType,
      actor,
      payload,
      refs,
      correlationId,
      idempotencyKey: `browser_mixed_review_pressure:${eventType}:${++sequence}`,
    });
    if (result.status !== "appended") {
      assert.fail(`mixed review pressure fixture append failed: ${result.status}`);
    }
  };

  await append(
    "message.created",
    { kind: "user", id: "browser_test_user" },
    {
      messageId: sourceMessageId,
      author: "user",
      authorKind: "user",
      authorId: "browser_test_user",
      content: "Browser fixture source message for mixed review pressure.",
      topicId: "topic_browser_mixed_pressure",
      contextRefs: [],
    },
    [],
  );
  await append(
    "memory.proposed",
    { kind: "agent", id: "kimi_member_01" },
    {
      memoryId: memoryRef,
      proposedBy: "kimi_member_01",
      state: "proposed",
      summary: "Browser mixed pressure memory claim should stay provisional.",
      reason: "Fixture object for pressure review.",
      sourceRefs: [sourceMessageId],
    },
    [sourceMessageId],
  );
  await append(
    "protocol.proposed",
    { kind: "agent", id: "kimi_member_02" },
    {
      protocolId: protocolRef,
      proposedBy: "kimi_member_02",
      status: "proposed",
      summary: "Browser mixed pressure etiquette should stay temporary.",
      scope: "topic",
      reason: "Fixture object for pressure review.",
      contextRefs: [sourceMessageId],
    },
    [sourceMessageId],
  );
  await append(
    "memory.reviewed",
    { kind: "agent", id: "kimi_member_01" },
    {
      reviewId: "memory_review_browser_mixed_pressure",
      memoryRef,
      memoryId: memoryRef,
      topicId: "topic_browser_mixed_pressure",
      agentId: "kimi_member_01",
      response: "questioned",
      summary: "The claim needs more evidence before it becomes room sediment.",
      sourceMessageId,
      contextRefs: [memoryRef, protocolRef],
      boundaryNote:
        "memory review is social pressure; it does not accept, contest, stale, retire, revise, or promote the claim",
    },
    [sourceMessageId, memoryRef, protocolRef],
  );
  await append(
    "protocol.reviewed",
    { kind: "agent", id: "kimi_member_01" },
    {
      reviewId: "protocol_review_browser_mixed_pressure",
      protocolRef,
      protocolId: protocolRef,
      topicId: "topic_browser_mixed_pressure",
      agentId: "kimi_member_01",
      response: "cautioned",
      summary: "The etiquette may help, but it should not become hidden room order.",
      sourceMessageId,
      contextRefs: [memoryRef, protocolRef],
      boundaryNote:
        "protocol review is social pressure; it does not accept, reject, expire, activate, retire, or revise the protocol",
    },
    [sourceMessageId, memoryRef, protocolRef],
  );

  return `mixed_review:${sourceMessageId}:${correlationId}`;
}

async function appendSideEffectApproval(
  ledgerPath: string,
  sideEffect: {
    requestId: string;
    approvalId?: string;
    requestedBy?: string;
    kind?: string;
    target: string;
  },
): Promise<void> {
  let sequence = 0;
  const ledger = new RoomLedger({
    filePath: ledgerPath,
    idFactory: (prefix) => `${prefix}_browser_side_effect_approval_${++sequence}`,
  });
  const result = await ledger.append({
    roomId: "room_species",
    eventType: "side_effect.approved",
    actor: { kind: "user", id: "browser_test_user" },
    payload: {
      requestId: sideEffect.requestId,
      approvalId: sideEffect.approvalId ?? sideEffect.requestId,
      approvedBy: "browser_test_user",
      reason: "browser test grants this permission so the settings surface can retire it unused",
      scope: {
        kinds: [sideEffect.kind ?? "filesystem.write"],
        targets: [sideEffect.target],
        allowedAgents: [sideEffect.requestedBy ?? "kimi_member_01"],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      decidedAt: new Date().toISOString(),
    },
    refs: [sideEffect.requestId],
    correlationId: "browser_side_effect_approved",
    idempotencyKey: `browser_side_effect_approved:${sideEffect.requestId}`,
  });
  if (result.status !== "appended") {
    assert.fail(`side-effect approval fixture append failed: ${result.status}`);
  }
}

function providerBoundaryTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (
        request.agent.agentId === "kimi_member_01" &&
        request.triggerContent?.toLowerCase().includes("trigger provider boundary card")
      ) {
        throw new Error("simulated provider outage for browser provider boundary");
      }
      return staySilentJson("Provider boundary browser test only needs the ledgered runtime boundary.");
    },
    mimoInvoker: async () => staySilentJson("Provider boundary browser test only needs the ledgered runtime boundary."),
  };
}

function sideEffectPermissionTestInvokers(targetPath?: string): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one side-effect requester.");
      }
      return JSON.stringify({
        kind: "request_side_effect",
        sideEffectKind: "filesystem.write",
        target: targetPath ?? `${request.agent.workspace.scratchPath}browser-boundary-note.md`,
        reason: "A private scratch note would help before any public room claim.",
        expectedImpact: "Create one private workspace note; no public memory or external action is completed.",
        proposedCommand: "write browser-boundary-note.md",
        contextRefs: [request.packet.triggeringEventId],
      });
    },
    mimoInvoker: async () => staySilentJson("This side-effect fixture only needs one requester."),
  };
}

function archiveRepairTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one repair participant.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      const archiveRef = firstPacketRef(request, "day_");
      const repairRef = firstPacketRef(request, "archive_repair_");
      if (trigger.includes("propose") && archiveRef) {
        return JSON.stringify({
          kind: "propose_archive_repair",
          archiveRef,
          summary: "Keep archive revision provenance visible.",
          reason: "Daily archives are time skeletons, not silent rewrites.",
          proposedRepair: "Add a revision note that names the accepted repair and keeps the original archive unchanged.",
          contextRefs: [archiveRef],
        });
      }
      if (trigger.includes("accept") && repairRef) {
        return JSON.stringify({
          kind: "respond_archive_repair",
          repairRef,
          response: "accept",
          reason: "The repair preserves archive contestability and source provenance.",
          contextRefs: [repairRef],
        });
      }
      return staySilentJson("No repair action is useful for this turn.");
    },
    mimoInvoker: async () => staySilentJson("This targeted repair exchange is already bounded."),
  };
}

function topicProposalTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one topic participant.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      const proposalRef = firstPacketRef(request, "topic_proposal_");
      if (trigger.includes("propose a topic")) {
        return JSON.stringify({
          kind: "propose_topic",
          action: "split",
          title: "Browser topic proposal boundary",
          reason: "The room should see this as a proposal before any topic movement happens.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if (trigger.includes("apply") && proposalRef) {
        return JSON.stringify({
          kind: "apply_topic",
          topicProposalRef: proposalRef,
          action: "split",
          title: "Applied browser topic movement",
          reason: "The user carried the proposal ref back into the room, so this movement can be visible and auditable.",
          contextRefs: [proposalRef, request.packet.triggeringEventId],
        });
      }
      return staySilentJson("No bounded topic movement is useful for this turn.");
    },
    mimoInvoker: async (request) => {
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      const proposalRef = firstPacketRef(request, "topic_proposal_");
      if ((trigger.includes("topic proposal") || trigger.includes("话题建议")) && proposalRef) {
        return JSON.stringify({
          kind: "speak",
          content: "This topic proposal may still be too broad; keep the review visible before any movement.",
          contextRefs: [proposalRef],
        });
      }
      return staySilentJson("This targeted topic exchange is already bounded.");
    },
  };
}

function protocolTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one protocol participant.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      const protocolRef = firstPacketRef(request, "protocol_");
      if (trigger.includes("propose")) {
        return JSON.stringify({
          kind: "propose_protocol",
          summary: "Use protocol cards as reviewable temporary room etiquette.",
          reason: "The room should see protocol scope and expiry before treating it as guidance.",
          scope: "current_topic",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if ((trigger.includes("protocol") || trigger.includes("临时房间礼仪")) && protocolRef) {
        return JSON.stringify({
          kind: "respond_protocol",
          protocolRef,
          response: "challenge",
          reason: "A protocol card should invite review without becoming permanent room control.",
          contextRefs: [protocolRef],
        });
      }
      return staySilentJson("No bounded protocol move is useful for this turn.");
    },
    mimoInvoker: async () => staySilentJson("This targeted protocol exchange is already bounded."),
  };
}

function mixedPressureTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  const respondToPressure = async (request: ProviderIntentionRequest): Promise<string> => {
    const pressureRef = mixedPressureRefFromRequest(request);
    if (!pressureRef) {
      return staySilentJson("No unresolved pressure ref is in this browser packet.");
    }
    return JSON.stringify({
      kind: "speak",
      content: "I will keep this unresolved pressure visible as a room trace without turning it into a workflow.",
      contextRefs: [pressureRef],
    });
  };
  return {
    kimiInvoker: respondToPressure,
    mimoInvoker: respondToPressure,
  };
}

function openQuestionTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one open-question participant.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      const questionRef = packetRefFromContext(request, "question_");
      if (trigger.includes("ask an open question")) {
        return JSON.stringify({
          kind: "ask_question",
          question: "Which room signal should stay unresolved long enough for others to answer freely?",
          target: "room",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if ((trigger.includes("open question") || trigger.includes("未解决问题")) && questionRef) {
        return JSON.stringify({
          kind: "speak",
          content: "I will answer this as a still-open room question, not close it into memory or a task.",
          contextRefs: [questionRef],
        });
      }
      return staySilentJson("No open question context is useful for this turn.");
    },
    mimoInvoker: async () => staySilentJson("This targeted open-question exchange is already bounded."),
  };
}

function memoryClaimTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one memory participant.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      const memoryRef = firstPacketRef(request, "memory_");
      if (trigger.includes("revise") && memoryRef) {
        return JSON.stringify({
          kind: "propose_memory",
          summary: "Revised memory cards should show lineage without overwriting the original claim.",
          reason: "A revision is a fresh public-memory proposal, not an edit of the previous claim.",
          revisedFromMemoryRef: memoryRef,
          contextRefs: [memoryRef, request.packet.triggeringEventId],
        });
      }
      if (trigger.includes("propose")) {
        return JSON.stringify({
          kind: "propose_memory",
          summary: "Memory cards should show provisional state before any claim becomes guidance.",
          reason: "Public memory must stay reviewable room sediment, not truth.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if ((trigger.includes("memory claim") || trigger.includes("公共记忆沉淀")) && memoryRef) {
        return JSON.stringify({
          kind: "contest_memory",
          memoryRef,
          reason: "Review should remain a visible room move, not silent promotion to truth.",
          contextRefs: [memoryRef, request.packet.triggeringEventId],
        });
      }
      return staySilentJson("No bounded memory move is useful for this turn.");
    },
    mimoInvoker: async () => staySilentJson("This targeted memory exchange is already bounded."),
  };
}

function personaContinuityTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one continuity participant.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      if (trigger.includes("propose") && trigger.includes("daily mood")) {
        return JSON.stringify({
          kind: "propose_persona_delta",
          field: "dailyMood",
          value: "quietly curious from ledger evidence",
          reason: "Daily mood should stay a reversible room-visible continuity note.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if (trigger.includes("propose") && trigger.includes("role claim")) {
        return JSON.stringify({
          kind: "propose_persona_delta",
          field: "roleClaims",
          value: "careful ledger evidence carrier",
          reason: "Role claim must remain evidence-backed and contestable.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      return staySilentJson("No bounded continuity move is useful for this turn.");
    },
    mimoInvoker: async (request) => {
      if (request.agent.agentId !== "mimo_member_01") {
        return staySilentJson("This continuity review is only for MiMo.");
      }
      const deltaRef = firstPacketRef(request, "persona_delta_");
      if (!deltaRef) {
        return staySilentJson("No persona delta ref was carried for review.");
      }
      return JSON.stringify({
        kind: "respond_persona_delta",
        deltaRef,
        response: "accept",
        reason: "The daily mood source is visible in the room ledger.",
        contextRefs: [deltaRef, request.packet.triggeringEventId],
      });
    },
  };
}

function socialRhythmTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one social-rhythm source agent.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      if (trigger.includes("social rhythm question")) {
        return JSON.stringify({
          kind: "ask_question",
          question: "Which autonomous room signal should stay open for later social rhythm?",
          target: "room",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if (trigger.includes("social rhythm handoff")) {
        return JSON.stringify({
          kind: "propose_handoff",
          toAgentId: "mimo_member_01",
          reason: "This unresolved signal may need a second reader later.",
          requestedResponse: "Name whether this handoff should be accepted, challenged, delegated, or left open.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if (trigger.includes("social rhythm invitation")) {
        return JSON.stringify({
          kind: "invite_other",
          agentId: "mimo_member_02",
          reason: "This is a social knock for a later autonomous invitation review.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      return staySilentJson("Autonomous rhythm review messages should remain optional.");
    },
    mimoInvoker: async () => staySilentJson("The social rhythm fixture leaves secondary agents free to stay silent."),
  };
}

function invitationTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one invitation participant.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      const invitationRef = packetRefFromContext(request, "invite_");
      if (trigger.includes("create an invitation")) {
        return JSON.stringify({
          kind: "invite_other",
          agentId: "mimo_member_01",
          reason: "This is a social knock that MiMo may ignore or revisit later.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if ((trigger.includes("invitation") || trigger.includes("social knock")) && invitationRef) {
        return JSON.stringify({
          kind: "speak",
          content: "This invitation remains a social knock; reviewing it should not become a speaking command.",
          contextRefs: [invitationRef],
        });
      }
      return staySilentJson("No invitation context is useful for this turn.");
    },
    mimoInvoker: async () => staySilentJson("The invited member may decline the knock by staying silent."),
  };
}

function handoffTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one handoff proposer.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      const handoffRef = firstPacketRef(request, "handoff_");
      if (trigger.includes("propose")) {
        return JSON.stringify({
          kind: "propose_handoff",
          toAgentId: "mimo_member_01",
          reason: "This context needs a second reader before it becomes room guidance.",
          requestedResponse: "Find the weakest assumption or reject the handoff.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if (trigger.includes("handoff") && handoffRef) {
        return JSON.stringify({
          kind: "challenge_handoff",
          handoffRef,
          reason: "The review should keep this as a social proposal, not a forced transfer.",
          contextRefs: [handoffRef, request.packet.triggeringEventId],
        });
      }
      return staySilentJson("No bounded handoff move is useful for this turn.");
    },
    mimoInvoker: async (request) => {
      if (request.agent.agentId !== "mimo_member_01") {
        return staySilentJson("This browser test targets one handoff recipient.");
      }
      const handoffRef = firstPacketRef(request, "handoff_");
      if (handoffRef) {
        return JSON.stringify({
          kind: "challenge_handoff",
          handoffRef,
          reason: "The handoff should remain a social proposal, not a forced transfer.",
          contextRefs: [handoffRef, request.packet.triggeringEventId],
        });
      }
      return staySilentJson("No handoff packet was carried.");
    },
  };
}

function delegatedHandoffTestInvokers(): { kimiInvoker: ProviderInvoker; mimoInvoker: ProviderInvoker } {
  return {
    kimiInvoker: async (request) => {
      if (request.agent.agentId !== "kimi_member_01") {
        return staySilentJson("This browser test targets one handoff proposer.");
      }
      const trigger = request.triggerContent?.toLowerCase() ?? "";
      if (trigger.includes("propose")) {
        return JSON.stringify({
          kind: "propose_handoff",
          toAgentId: "mimo_member_01",
          reason: "MiMo should decide whether this context belongs elsewhere.",
          requestedResponse: "Delegate if another member should inspect this bounded packet.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      return staySilentJson("No delegated handoff action is useful for this turn.");
    },
    mimoInvoker: async (request) => {
      const handoffRef = firstPacketRef(request, "handoff_");
      if (request.agent.agentId === "mimo_member_01" && handoffRef) {
        return JSON.stringify({
          kind: "delegate_handoff",
          handoffRef,
          redirectTo: "mimo_member_02",
          reason: "glm-5.2 is closer to this bounded packet.",
          contextRefs: [handoffRef, request.packet.triggeringEventId],
        });
      }
      return staySilentJson("Delegated handoff target may choose silence.");
    },
  };
}

function firstPacketRef(request: ProviderIntentionRequest, prefix: string): string | undefined {
  return [
    ...request.packet.proposalRefs,
    ...request.packet.messageRefs,
    ...request.packet.memoryRefs,
    ...request.packet.protocolRefs,
    ...(request.packet.actionRefs ?? []),
  ].find((ref) => ref.startsWith(prefix));
}

function mixedPressureRefFromRequest(request: ProviderIntentionRequest): string | undefined {
  return [
    ...request.packet.proposalRefs,
    ...request.packet.messageRefs,
    ...request.packet.memoryRefs,
    ...request.packet.protocolRefs,
    ...(request.packet.actionRefs ?? []),
    ...(request.packet.contextFragments ?? []).flatMap((fragment) => fragment.refs),
  ].find((ref) => ref.startsWith("mixed_review:"));
}

function packetRefFromContext(request: ProviderIntentionRequest, prefix: string): string | undefined {
  return [
    ...request.packet.proposalRefs,
    ...request.packet.messageRefs,
    ...request.packet.memoryRefs,
    ...request.packet.protocolRefs,
    ...(request.packet.actionRefs ?? []),
    ...(request.packet.contextFragments ?? []).flatMap((fragment) => fragment.refs),
  ].find((ref) => ref.startsWith(prefix));
}

function staySilentJson(reason: string): string {
  return JSON.stringify({ kind: "stay_silent", reason });
}

function shortRefForTest(ref: string): string {
  return ref.length > 18 ? `${ref.slice(0, 8)}...${ref.slice(-6)}` : ref;
}

function smokeReport(): AgentSmokeReport {
  return {
    generatedAt: "2026-06-19T00:00:00.000Z",
    memsuosConfigPath: "/opt/memsuos/model-providers.local.json",
    agents: [
      smokeAgent("kimi_member_01", "kimi-k2.6", "volc_ark_openai", "Volcengine Ark Plan kimi-k2.6"),
      smokeAgent("kimi_member_02", "kimi-k2.7-code", "volc_ark_openai", "Volcengine Ark Plan kimi-k2.7-code"),
      smokeAgent("mimo_member_01", "doubao-seed-2.0-pro", "volc_ark_openai", "Volcengine Ark Plan doubao-seed-2.0-pro"),
      smokeAgent("mimo_member_02", "glm-5.2", "volc_ark_openai", "Volcengine Ark Plan glm-5.2"),
      smokeAgent("mimo_member_03", "minimax-m3", "volc_ark_openai", "Volcengine Ark Plan minimax-m3"),
      smokeAgent("mimo_member_04", "deepseek-v4-pro", "volc_ark_openai", "Volcengine Ark Plan deepseek-v4-pro"),
    ],
  };
}

function smokeAgent(
  agentId: string,
  displayName: string,
  providerKind: AgentSmokeResult["providerKind"],
  providerLabel: string,
): AgentSmokeResult {
  return {
    agentId,
    displayName,
    providerKind,
    providerLabel,
    status: "ready" as const,
    checks: [{ name: providerLabel, ok: true, detail: "browser test fixture" }],
  };
}
