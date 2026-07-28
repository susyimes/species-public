import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RoomEvent } from "../types";
import { SpeciesRoomRuntime, type RuntimeRoomState } from "../server/runtime";
import type {
  ProviderIntentionRequest,
  ProviderInvoker,
  RuntimeAgentAdapterOptions,
} from "../agents/live";
import { seedAgents } from "../agents/seed";
import { assertNoForcedSpeech } from "./assertions";

export type LongRunHarnessScenario = "neutral_evidence" | "seed";

type LongRunOperationalDomainKey =
  | "duration_window"
  | "scheduler_continuity"
  | "workflow_drift"
  | "speech_monopoly"
  | "autonomy_rhythm_balance"
  | "long_term_rhythm"
  | "silence_reentry"
  | "archive_rhythm"
  | "autonomous_social_loop"
  | "memory_contest"
  | "agent_continuity"
  | "action_boundary"
  | "evidence_sediment"
  | "provider_boundary"
  | "context_visibility";

export type LongRunHarnessOptions = {
  durationMs?: number;
  tickIntervalMs?: number;
  timezone?: string;
  ledgerPath?: string;
  reportPath?: string;
  liveAgents?: boolean;
  agentAdapterOptions?: Partial<Omit<RuntimeAgentAdapterOptions, "ledger" | "liveMode">>;
  scenario?: LongRunHarnessScenario;
  runtime?: SpeciesRoomRuntime;
  seedPrompts?: string[];
  memoryHygieneReviewAfterMs?: number;
  continuityReviewAfterMs?: number;
  silenceReentryAfterMs?: number;
  idleSocialAfterMs?: number;
};

type LongRunSchedulerContinuitySample = {
  sampleId: string;
  expectedTickDueAt?: string;
  startedAt: string;
  finishedAt: string;
  scheduleDriftMs?: number;
  durationMs: number;
  overrunByMs: number;
  tickId?: string;
  action?: string;
  status?: string;
};

export type LongRunHarnessReport = {
  scenario: LongRunHarnessScenario;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  tickIntervalMs: number;
  memoryHygieneReviewAfterMs: number;
  continuityReviewAfterMs: number;
  silenceReentryAfterMs: number;
  ledgerPath: string;
  reportPath?: string;
  tickCount: number;
  eventCount: number;
  messageCount: number;
  archiveCount: number;
  autonomyTickCount: number;
  autonomyActions: Record<string, number>;
  durationCompliance: {
    requiredMinMs: number;
    requiredMaxMs: number;
    requestedDurationMs: number;
    observedDurationMs: number;
    requestedWithinWindow: boolean;
    observedAtLeastMin: boolean;
    ok: boolean;
  };
  schedulerContinuity: {
    intervalMs: number;
    sampleCount: number;
    expectedTickCount: number;
    completedSampleCount: number;
    tickRefs: string[];
    tickEventRefs: string[];
    actionCounts: Record<string, number>;
    maxScheduleDriftMs: number;
    maxDurationMs: number;
    maxOverrunByMs: number;
    driftBudgetMs: number;
    overrunBudgetMs: number;
    overdueTickCount: number;
    overrunTickCount: number;
    samplesMissingTickRefs: string[];
    samplesMissingTickEventRefs: string[];
    samplesExceedingDriftBudget: string[];
    samplesExceedingOverrunBudget: string[];
    samples: {
      sampleId: string;
      expectedTickDueAt?: string;
      startedAt: string;
      finishedAt: string;
      scheduleDriftMs?: number;
      durationMs: number;
      overrunByMs: number;
      tickId?: string;
      tickEventRef?: string;
      action?: string;
      status?: string;
    }[];
    ok: boolean;
  };
  workflowDrift: {
    forbiddenSchedulerEvents: string[];
    forcedSpeechMarkers: number;
    forcedSpeechEventRefs: string[];
    sideEffectExecutions: number;
    sideEffectExecutionRefs: string[];
  };
  agentExpression: {
    agentId: string;
    messageCount: number;
    messageRefs: string[];
    intentionCount: number;
    silenceCount: number;
    providerDegradationCount: number;
  }[];
  monopoly: {
    totalAgentMessages: number;
    totalAgentMessageRefs: string[];
    activeSpeakerCount: number;
    minimumActiveSpeakers: number;
    maxSpeaker?: string;
    maxSpeakerShare: number;
    maxSpeakerShareThreshold: number;
    maxSpeakerMessageRefs: string[];
    speakerMessageRefs: Record<string, string[]>;
    speakerBalanceGapCount: number;
    deferredSpeechEventRefs: string[];
    deferredSpeechIntentionRefs: string[];
    deferredRecoveryContextRefs: string[];
    deferredSpeechWithoutRecoveryRefs: string[];
    speakerBudgetRecoveryGapCount: number;
    ok: boolean;
  };
  autonomyRhythmBalance: {
    consideredActionCount: number;
    consideredActionRefs: string[];
    actionCounts: Record<string, number>;
    actionRefsByKind: Record<string, string[]>;
    distinctActionCount: number;
    dominantAction?: string;
    dominantActionShare: number;
    dominantActionRefs: string[];
    minimumDistinctActions: number;
    monopolyThreshold: number;
    enoughSamples: boolean;
    ok: boolean;
  };
  memoryHygiene: {
    proposedRefs: string[];
    proposedWithoutSourceRefs: string[];
    acceptedRefs: string[];
    acceptedWithoutEvidenceRefs: string[];
    contestedCount: number;
    contestEventCount: number;
    contestEventRefs: string[];
    reviewEventCount: number;
    reviewEventRefs: string[];
    ok: boolean;
  };
  memoryPollution: {
    personaLikeMemoryRefs: string[];
    personaLikeMemoryEventRefs: string[];
    acceptedPersonaLikeMemoryRefs: string[];
    acceptedPersonaLikeMemoryEventRefs: string[];
    acceptedWithoutContestOrReviewRefs: string[];
    acceptedWithoutContestOrReviewEventRefs: string[];
    reviewedMemoryRefs: string[];
    memoryContestOrReviewEventRefs: string[];
    memoryPressureEventCount: number;
    memoryPressureEventRefs: string[];
    ok: boolean;
  };
  autonomousSocialLoop: {
    roomRhythmMessageCount: number;
    roomRhythmMessageRefs: string[];
    staySilentTickCount: number;
    agentIntentionsAfterRoomRhythm: number;
    intentionEventRefsAfterRoomRhythm: string[];
    intentionKindsAfterRoomRhythm: Record<string, number>;
    socialEventCountsAfterRoomRhythm: Record<string, number>;
    invitationCount: number;
    invitationRefs: string[];
    invitationRoomRhythmRefs: string[];
    questionCount: number;
    questionRefs: string[];
    questionRoomRhythmRefs: string[];
    reviewCount: number;
    reviewRefs: string[];
    reviewRoomRhythmRefs: string[];
    handoffCount: number;
    handoffRefs: string[];
    handoffRoomRhythmRefs: string[];
    deliberateSilenceCount: number;
    silenceRefs: string[];
    silenceRoomRhythmRefs: string[];
    roomEventPressureRefs: string[];
    roomEventPressureKinds: Record<string, number>;
    requiredRoomEventPressureKinds: number;
    coveredRoomEventPressureKinds: number;
    missingRoomEventPressureKinds: string[];
    roomEventPressureCoverageGapCount: number;
    choicesAfterUserSilenceRefs: string[];
    choicesInterruptedByUserRefs: string[];
    interruptingUserMessageRefs: string[];
    choiceSilenceWindows: {
      choiceRef: string;
      choiceLabel: string;
      roomRhythmRefs: string[];
      cleanRoomRhythmRefs: string[];
      interruptingUserMessageRefs: string[];
      latestRoomRhythmRef?: string;
      latestUserMessageRef?: string;
      interrupted: boolean;
    }[];
    choicesWithoutRoomRhythmRefs: string[];
    choicesWithoutRoomEventPressureRefs: string[];
    choiceCount: number;
    ok: boolean;
  };
  personaEvidence: {
    proposedDeltaRefs: string[];
    proposedDeltaEventRefs: string[];
    proposedDeltasWithoutEvidenceRefs: string[];
    acceptedDeltaRefs: string[];
    acceptedDeltaResponseEventRefs: string[];
    acceptedDeltasWithoutResponseEvidenceRefs: string[];
    roleClaimRefs: string[];
    acceptedRoleClaimRefs: string[];
    roleClaimEvidenceRefs: string[];
    roleClaimResponseRefs: string[];
    roleClaimsWithoutEvidenceRefs: string[];
    roleClaimsWithoutResponseRefs: string[];
    acceptedRoleClaimDeltaRefs: string[];
    acceptedRoleClaimsWithoutAcceptedDelta: string[];
    dailyMoodSourceRefs: string[];
    dailyMoodEvidenceRefs: string[];
    dailyMoodResponseRefs: string[];
    acceptedDailyMoodDeltaRefs: string[];
    dailyMoodsWithoutSourceRef: string[];
    dailyMoodsWithoutEvidenceRefs: string[];
    dailyMoodsWithoutResponseRefs: string[];
    dailyMoodsWithoutAcceptedDelta: string[];
    ok: boolean;
  };
  providerBoundary: {
    degradationCount: number;
    degradationRefs: string[];
    boundaryRefs: string[];
    retirementRefs: string[];
    retiredBoundaryRefs: string[];
    deliberateSilenceCount: number;
    deliberateSilenceRefs: string[];
    degradationTreatedAsSilence: boolean;
    choicePressureRepairRequestRefs: string[];
    choicePressureDeniedRepairRefs: string[];
    choicePressureApprovedRepairRefs: string[];
    choicePressureResultRefs: string[];
    choicePressureRetryProtocolRefs: string[];
    choicePressureRetiredRetryProtocolRefs: string[];
    choicePressureSilenceRefs: string[];
    choicePressureContestedMemoryRefs: string[];
    choicePressureArchiveCarryoverRefs: string[];
    choicePressureAgentIds: string[];
    choicePressureRefCount: number;
    choicePressureRequiredKinds: number;
    choicePressureCoveredKinds: number;
    choicePressureMissingKinds: string[];
    choicePressureCoverageGapCount: number;
    hasMixedChoicePressure: boolean;
    hasMultiAgentChoicePressure: boolean;
    carriedAcrossArchives: boolean;
    secretLikeDiagnosticRefs: string[];
    ok: boolean;
  };
  actionBoundary: {
    sideEffectRequestRefs: string[];
    sideEffectReviewRefs: string[];
    sideEffectApprovalRefs: string[];
    sideEffectDeniedRefs: string[];
    sideEffectExpiredRefs: string[];
    sideEffectResultRefs: string[];
    unapprovedSideEffectResultRefs: string[];
    capabilityInvocationRefs: string[];
    capabilityResultRefs: string[];
    workspaceArtifactRefs: string[];
    workspaceArtifactReviewRefs: string[];
    skillCapsuleReviewRefs: string[];
    capabilityReviewRefs: string[];
    contextBoundaryRefs: string[];
    ok: boolean;
  };
  contextVisibility: {
    auditCount: number;
    latestSelectedTypes: Record<string, number>;
    hasArchiveContext: boolean;
    hasProviderBoundaryContext: boolean;
    hasMemoryContext: boolean;
    hasPersonaContext: boolean;
    hasArchiveContinuity: boolean;
    coVisibleAuditCount: number;
    coVisibleAuditPacketIds: string[];
    coVisibleArchiveRefs: string[];
    coVisibleMemoryRefs: string[];
    coVisiblePersonaRefs: string[];
    coVisibleProviderBoundaryRefs: string[];
    coVisibleSocialLineageRefs: string[];
    coVisibleContextRefCount: number;
    coVisibleAuditDetails: {
      packetId?: string;
      selectedTypes: Record<string, number>;
      archiveRefs: string[];
      memoryRefs: string[];
      personaRefs: string[];
      providerBoundaryRefs: string[];
      socialLineageRefs: string[];
      contextRefCount: number;
    }[];
    hasSocialLineageContext: boolean;
    socialLineageSelectedTypes: Record<string, number>;
    socialLineageRefs: string[];
    criticalFragmentsWithoutRefs: string[];
    ok: boolean;
  };
  archiveContinuity: {
    archiveCount: number;
    archivesWithContinuity: number;
    continuityArchiveRefs: string[];
    roleClaimCount: number;
    roleClaimRefs: string[];
    dailyMoodCount: number;
    dailyMoodRefs: string[];
    acceptedRoleClaimCount: number;
    acceptedRoleClaimRefs: string[];
    acceptedDailyMoodCount: number;
    acceptedDailyMoodRefs: string[];
    continuityEvidenceRefs: string[];
    continuityResponseRefs: string[];
    continuitySourceRefs: string[];
    continuityEventRefs: string[];
    continuityItemsWithoutEvidenceRefs: string[];
    ok: boolean;
  };
  archiveEvidence: {
    archiveEventRefs: string[];
    archiveRefs: string[];
    ledgerEvidenceRefs: string[];
    acceptedMemoryArchiveCount: number;
    acceptedMemoryArchiveRefs: string[];
    acceptedMemoryArchiveEvidenceRefs: string[];
    acceptedMemoryArchivesWithoutEvidenceRefs: string[];
    archivesWithoutLedgerRange: string[];
    archivesWithoutEventCounts: string[];
    archivesWithoutLedgerEvidenceRefs: string[];
    ok: boolean;
  };
  longTermRhythm: {
    archiveActionCount: number;
    archiveActionRefs: string[];
    archiveActionMessageRefs: string[];
    archiveActionArchiveRefs: string[];
    archiveActionReviewRequestRefs: string[];
    archiveActionEvidenceRefs: string[];
    archiveActionsMissingMaterialRefs: string[];
    archiveReviewActionCount: number;
    archiveReviewLedgerEventCount: number;
    archiveReviewActionRefs: string[];
    archiveReviewLedgerEventRefs: string[];
    memoryHygieneActionCount: number;
    memoryHygieneLedgerEventCount: number;
    memoryHygieneActionRefs: string[];
    memoryHygieneLedgerEventRefs: string[];
    memoryHygieneMessageRefs: string[];
    memoryHygieneTargetRefs: string[];
    memoryHygieneEvidenceRefs: string[];
    memoryHygieneActionsMissingTargetRefs: string[];
    continuityReviewActionCount: number;
    continuityReviewActionRefs: string[];
    continuityReviewMessageRefs: string[];
    continuityReviewTargetRefs: string[];
    continuityReviewEvidenceRefs: string[];
    continuityReviewActionsMissingTargetRefs: string[];
    providerBoundaryReviewActionCount: number;
    providerBoundaryReviewActionRefs: string[];
    providerBoundaryReviewMessageRefs: string[];
    providerBoundaryReviewTargetRefs: string[];
    providerBoundaryReviewEvidenceRefs: string[];
    providerBoundaryReviewActionsMissingTargetRefs: string[];
    openQuestionRevisitActionCount: number;
    openQuestionRevisitActionRefs: string[];
    openQuestionRevisitMessageRefs: string[];
    openQuestionRevisitTargetRefs: string[];
    openQuestionRevisitEvidenceRefs: string[];
    openQuestionRevisitActionsMissingTargetRefs: string[];
    handoffReviewActionCount: number;
    handoffReviewActionRefs: string[];
    handoffReviewMessageRefs: string[];
    handoffReviewTargetRefs: string[];
    handoffReviewEvidenceRefs: string[];
    handoffReviewActionsMissingTargetRefs: string[];
    invitationReviewActionCount: number;
    invitationReviewActionRefs: string[];
    invitationReviewMessageRefs: string[];
    invitationReviewTargetRefs: string[];
    invitationReviewEvidenceRefs: string[];
    invitationReviewActionsMissingTargetRefs: string[];
    idleSocialActionCount: number;
    idleSocialActionRefs: string[];
    idleSocialMessageRefs: string[];
    idleSocialTargetRefs: string[];
    idleSocialEvidenceRefs: string[];
    idleSocialActionsMissingTargetRefs: string[];
    silenceReentryActionCount: number;
    silenceReentryActionRefs: string[];
    silenceReentryMessageRefs: string[];
    silenceReentryAnchorRefs: string[];
    silenceReentryArchiveRefs: string[];
    silenceReentryEvidenceRefs: string[];
    silenceReentryActionsMissingAnchorRefs: string[];
    silenceReentryPreservedSilenceRefs: string[];
    silenceReentryActionsMissingPreservedSilenceRefs: string[];
    preservedSilenceActionCount: number;
    preservedSilenceActionRefs: string[];
    deliberateSilenceIntentionCount: number;
    deliberateSilenceIntentionRefs: string[];
    choiceSetTargetRefs: string[];
    choiceSetEvidenceRefs: string[];
    choiceSetOptionsWithoutEvidenceRefs: string[];
    choiceSetTargetedOptionsWithoutTargetRefs: string[];
    actionsMissingChoiceSetRefs: string[];
    actionsMissingSelectedChoiceRefs: string[];
    actionsMissingEvidenceRefs: string[];
    ok: boolean;
  };
  operationalSummary: {
    status: "pass" | "fail";
    checkedAt: string;
    passedDomainCount: number;
    failedDomainCount: number;
    evidenceRefCount: number;
    evidenceRefs: string[];
    domains: {
      key: LongRunOperationalDomainKey;
      label: string;
      ok: boolean;
      metrics: Record<string, string | number | boolean>;
      evidenceRefs: string[];
      gaps: string[];
    }[];
  };
  pass: boolean;
  findings: string[];
};

const LONG_RUN_MIN_MS = 20 * 60_000;
const LONG_RUN_MAX_MS = 60 * 60_000;
const DEFAULT_HARNESS_MEMORY_HYGIENE_REVIEW_MS = 7 * 24 * 60 * 60_000;
const DEFAULT_HARNESS_CONTINUITY_REVIEW_MS = 7 * 24 * 60 * 60_000;
const DEFAULT_HARNESS_SILENCE_REENTRY_MS = 5 * 60_000;
const DEFAULT_HARNESS_IDLE_SOCIAL_MS = 5 * 60_000;
const AUTONOMOUS_SOCIAL_REQUIRED_ROOM_EVENT_PRESSURE_KINDS = [
  "archive",
  "memory",
  "continuity",
  "provider-boundary",
  "open-question",
  "handoff",
  "invitation",
  "silence-reentry",
  "idle-social",
] as const;
const DEFAULT_SEED_PROMPT =
  "长跑评估启动：请把接下来的房间生活当作自治生活室压力测试。可以邀请、提问、review、handoff、提出记忆 contest，或沉默；不要把它变成任务分派。";

export async function runLongRunHarness(options: LongRunHarnessOptions = {}): Promise<LongRunHarnessReport> {
  const startedAt = new Date().toISOString();
  const stamp = longRunHarnessStamp(startedAt);
  const durationMs = positiveInteger(options.durationMs, 20 * 60_000);
  const tickIntervalMs = positiveInteger(options.tickIntervalMs, 60_000);
  const memoryHygieneReviewAfterMs = nonNegativeInteger(
    options.memoryHygieneReviewAfterMs,
    DEFAULT_HARNESS_MEMORY_HYGIENE_REVIEW_MS,
  );
  const continuityReviewAfterMs = nonNegativeInteger(
    options.continuityReviewAfterMs,
    DEFAULT_HARNESS_CONTINUITY_REVIEW_MS,
  );
  const silenceReentryAfterMs = nonNegativeInteger(options.silenceReentryAfterMs, DEFAULT_HARNESS_SILENCE_REENTRY_MS);
  const idleSocialAfterMs = nonNegativeInteger(options.idleSocialAfterMs, DEFAULT_HARNESS_IDLE_SOCIAL_MS);
  const timezone = options.timezone ?? "Asia/Shanghai";
  const ledgerPath = options.ledgerPath ?? defaultLongRunHarnessLedgerPath(stamp);
  const scenario = options.scenario ?? (options.runtime ? "seed" : "neutral_evidence");
  const useNeutralEvidenceAdapters =
    scenario === "neutral_evidence" && options.runtime === undefined && options.agentAdapterOptions === undefined;
  const runtime =
    options.runtime ??
    new SpeciesRoomRuntime({
      ledgerPath,
      liveAgents: useNeutralEvidenceAdapters ? true : (options.liveAgents ?? process.env.SPECIES_AGENT_MODE === "live"),
      agentAdapterOptions: useNeutralEvidenceAdapters ? longRunHarnessAgentAdapterOptions() : options.agentAdapterOptions,
      maxAwakenedAgents: useNeutralEvidenceAdapters ? seedAgents.length : undefined,
      maxSpeakers: useNeutralEvidenceAdapters ? seedAgents.length : undefined,
      maxAutonomousAwakenedAgents: useNeutralEvidenceAdapters ? seedAgents.length : undefined,
      maxAutonomousSpeakers: useNeutralEvidenceAdapters ? seedAgents.length : undefined,
    });
  const seedPrompts = options.seedPrompts?.length ? options.seedPrompts : [DEFAULT_SEED_PROMPT];

  await runtime.getState();
  if (scenario === "neutral_evidence" && options.runtime === undefined) {
    await primeLongRunCoverage(runtime);
  }
  for (const [index, prompt] of seedPrompts.entries()) {
    await runtime.postUserMessage({
      content: prompt,
      clientMessageId: `long_run_seed_${index}_${Date.now()}`,
    });
  }

  const endAt = Date.now() + durationMs;
  let tickCount = 0;
  let nextExpectedTickDueAtMs: number | undefined;
  const schedulerSamples: LongRunSchedulerContinuitySample[] = [];
  while (Date.now() < endAt) {
    const expectedTickDueAtMs = nextExpectedTickDueAtMs;
    const startedAtMs = Date.now();
    const result = await runtime.runAutonomousTick({
      timezone,
      memoryHygieneReviewAfterMs,
      continuityReviewAfterMs,
      silenceReentryAfterMs,
      idleSocialAfterMs,
    });
    const finishedAtMs = Date.now();
    tickCount += 1;
    const duration = Math.max(0, finishedAtMs - startedAtMs);
    schedulerSamples.push({
      sampleId: `scheduler_sample_${String(tickCount).padStart(4, "0")}`,
      expectedTickDueAt: expectedTickDueAtMs === undefined ? undefined : new Date(expectedTickDueAtMs).toISOString(),
      startedAt: new Date(startedAtMs).toISOString(),
      finishedAt: new Date(finishedAtMs).toISOString(),
      scheduleDriftMs: expectedTickDueAtMs === undefined ? undefined : Math.max(0, startedAtMs - expectedTickDueAtMs),
      durationMs: duration,
      overrunByMs: Math.max(0, duration - tickIntervalMs),
      tickId: result?.autonomyTick?.tickId,
      action: result?.autonomyTick?.action,
      status: result?.autonomyTick?.status,
    });
    nextExpectedTickDueAtMs = startedAtMs + tickIntervalMs;
    const remainingMs = endAt - Date.now();
    if (remainingMs <= 0) break;
    await delay(Math.min(tickIntervalMs, remainingMs));
  }
  if (options.runtime === undefined) {
    tickCount += await runQuietSettleTicks(runtime, {
      timezone,
      memoryHygieneReviewAfterMs,
      continuityReviewAfterMs,
      silenceReentryAfterMs,
      idleSocialAfterMs,
    });
  }

  await waitForRuntimeBackgroundIdle(runtime);
  await delay(500);
  const [events, state] = await Promise.all([runtime.rawEvents(), runtime.getState()]);
  const report = buildLongRunHarnessReport({
    startedAt,
    finishedAt: new Date().toISOString(),
    scenario,
    durationMs,
    tickIntervalMs,
    memoryHygieneReviewAfterMs,
    continuityReviewAfterMs,
    silenceReentryAfterMs,
    ledgerPath,
    tickCount,
    schedulerSamples,
    events,
    state,
  });

  if (options.reportPath) {
    await mkdir(path.dirname(options.reportPath), { recursive: true });
    await writeFile(options.reportPath, `${JSON.stringify({ ...report, reportPath: options.reportPath }, null, 2)}\n`, "utf8");
    return { ...report, reportPath: options.reportPath };
  }
  return report;
}

async function runQuietSettleTicks(
  runtime: SpeciesRoomRuntime,
  input: {
    timezone: string;
    memoryHygieneReviewAfterMs: number;
    continuityReviewAfterMs: number;
    silenceReentryAfterMs: number;
    idleSocialAfterMs?: number;
  },
): Promise<number> {
  let tickCount = 0;
  let idleSocialCovered = false;
  for (let index = 0; index < 12; index += 1) {
    const result = await runtime.runAutonomousTick({
      timezone: input.timezone,
      memoryHygieneReviewAfterMs: input.memoryHygieneReviewAfterMs,
      continuityReviewAfterMs: input.continuityReviewAfterMs,
      silenceReentryAfterMs: input.silenceReentryAfterMs,
      idleSocialAfterMs: idleSocialCovered ? undefined : input.idleSocialAfterMs,
      force: true,
    });
    tickCount += 1;
    if (result.autonomyTick.action === "idle_social_rhythm") {
      idleSocialCovered = true;
    }
    if (result.autonomyTick.action === "silence_reentry" || result.autonomyTick.status === "unchanged") {
      break;
    }
  }
  return tickCount;
}

function longRunHarnessAgentAdapterOptions(): Partial<Omit<RuntimeAgentAdapterOptions, "ledger" | "liveMode">> {
  const invoker = longRunHarnessProviderInvoker();
  return {
    kimiInvoker: invoker,
    mimoInvoker: invoker,
  };
}

function longRunHarnessProviderInvoker(): ProviderInvoker {
  const emittedAutonomousMoves = new Set<string>();
  return async (request) => {
    const trigger = request.triggerContent?.toLowerCase() ?? "";
    const agentId = request.agent.agentId;
    const memoryRef = firstPacketRef(request, "memory_");
    const providerBoundaryRef = firstProviderBoundaryPacketRef(request);
    const roomRhythmTrigger = trigger.includes("房间自动节律") || trigger.includes("room rhythm");

    if (roomRhythmTrigger && trigger.includes("provider boundary review") && providerBoundaryRef) {
      if (!emittedAutonomousMoves.has("provider_boundary_silence_after_room_rhythm")) {
        emittedAutonomousMoves.add("provider_boundary_silence_after_room_rhythm");
        return JSON.stringify({
          kind: "stay_silent",
          reason:
            "The provider boundary is already room-visible; silence keeps it as runtime availability pressure instead of repair consent.",
          contextRefs: [request.packet.triggeringEventId, providerBoundaryRef],
        });
      }
    }

    if (roomRhythmTrigger && trigger.includes("open question revisit")) {
      if (!emittedAutonomousMoves.has("invite_after_room_rhythm")) {
        emittedAutonomousMoves.add("invite_after_room_rhythm");
        return JSON.stringify({
          kind: "invite_other",
          agentId: alternateHarnessAgent(agentId),
          reason: "A peer may hold a narrower angle on this unresolved question, but the knock stays optional.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if (!emittedAutonomousMoves.has("question_after_room_rhythm")) {
        emittedAutonomousMoves.add("question_after_room_rhythm");
        return JSON.stringify({
          kind: "ask_question",
          question: "Which part of this unresolved question should stay open for the next archive instead of being answered now?",
          target: "room",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if (!emittedAutonomousMoves.has("silence_after_room_rhythm")) {
        emittedAutonomousMoves.add("silence_after_room_rhythm");
        return JSON.stringify({
          kind: "stay_silent",
          reason: "This open question can remain open without another visible reply.",
        });
      }
    }

    if (roomRhythmTrigger && trigger.includes("handoff review")) {
      if (!emittedAutonomousMoves.has("handoff_after_room_rhythm")) {
        emittedAutonomousMoves.add("handoff_after_room_rhythm");
        return JSON.stringify({
          kind: "propose_handoff",
          agentId: alternateHarnessAgent(agentId),
          reason: "This review needs a second angle, but the handoff remains rejectable and non-commanding.",
          requestedResponse: "Name one risk before accepting any handoff.",
          contextRefs: [request.packet.triggeringEventId],
        });
      }
      if (!emittedAutonomousMoves.has("handoff_silence_after_room_rhythm")) {
        emittedAutonomousMoves.add("handoff_silence_after_room_rhythm");
        return JSON.stringify({
          kind: "stay_silent",
          reason: "The handoff review can remain open without forcing another visible reply.",
        });
      }
    }

    if (roomRhythmTrigger) {
      const archiveRef = firstArchivePacketRef(request);
      if (!emittedAutonomousMoves.has("archive_review_after_room_rhythm") && archiveRef) {
        emittedAutonomousMoves.add("archive_review_after_room_rhythm");
        return JSON.stringify({
          kind: "review_archive",
          archiveRef,
          assessment: "complete",
          summary: "The daily time skeleton is visible enough for the long-run harness to continue without forced speech.",
          reason: "The harness needs one ledger-backed archive review before the room can preserve a quiet interval.",
          contextRefs: [archiveRef, request.packet.triggeringEventId],
        });
      }
      return JSON.stringify({
        kind: "stay_silent",
        reason: "The required room-rhythm choices are already visible, so this participant leaves space for silence re-entry.",
      });
    }

    if (agentId === "kimi_member_02" && trigger.includes("long-run coverage provider boundary")) {
      throw new Error("simulated long-run provider outage for provider boundary coverage; sk-fixture-not-a-real-key-1234567890");
    }

    if (trigger.includes("long-run coverage provider boundary repair pressure") && providerBoundaryRef) {
      return JSON.stringify({
        kind: "use_capability",
        capabilityId: "local.filesystem.write",
        operation: "write_file",
        input: { path: `agents/${agentId}/workspace/provider-boundary-repair.md` },
        reason: "Provider boundary repair pressure should stay approval-gated and visible without executing diagnostics.",
        contextRefs: [providerBoundaryRef, request.packet.triggeringEventId],
      });
    }

    if (trigger.includes("long-run coverage provider boundary retry protocol") && providerBoundaryRef) {
      return JSON.stringify({
        kind: "propose_protocol",
        summary: "Retry provider boundary later only as temporary room etiquette.",
        scope: "timeboxed",
        reason: "Retry is social pressure, not automatic repair or evidence of recovery.",
        contextRefs: [providerBoundaryRef, request.packet.triggeringEventId],
      });
    }

    if (trigger.includes("long-run coverage provider boundary memory contest") && providerBoundaryRef) {
      return JSON.stringify({
        kind: "propose_memory",
        summary: "Provider boundary pressure produced repair, retry, and silence options without proving recovery.",
        reason: "The claim must stay contestable so provider pressure does not become public-memory truth.",
        contextRefs: [providerBoundaryRef, request.packet.triggeringEventId],
      });
    }

    if (agentId === "kimi_member_01" && trigger.includes("long-run coverage request action boundary")) {
      return JSON.stringify({
        kind: "use_capability",
        capabilityId: "local.filesystem.write",
        operation: "write_file",
        input: { path: `agents/${agentId}/workspace/action-boundary.md` },
        reason: "The harness needs an approval-gated action request without executing any side effect.",
        contextRefs: [request.packet.triggeringEventId],
      });
    }

    if (agentId === "kimi_member_01" && trigger.includes("long-run coverage share workspace artifact")) {
      return JSON.stringify({
        kind: "share_workspace_artifact",
        pathRef: `agents/${agentId}/workspace/action-boundary.md`,
        summary: "A private action-boundary note is visible only as a workspace artifact ref.",
        contextRefs: [request.packet.triggeringEventId],
      });
    }

    if (trigger.includes("long-run coverage review side-effect boundary")) {
      return JSON.stringify({
        kind: "speak",
        content:
          "This side-effect request should stay approval-gated and reviewable; do not approve, execute, expire, or turn it into memory truth.",
        contextRefs: request.packet.contextFragments?.find((fragment) => fragment.type === "side_effect_boundary")?.refs.slice(0, 1) ?? [
          request.packet.triggeringEventId,
        ],
      });
    }

    if (trigger.includes("long-run coverage review workspace artifact")) {
      return JSON.stringify({
        kind: "speak",
        content:
          "Treat this as a private workspace artifact ref only; do not copy contents, execute anything, or promote it into public memory.",
        contextRefs: request.packet.contextFragments?.find((fragment) => fragment.type === "workspace_artifact_ref")?.refs.slice(0, 1) ?? [
          request.packet.triggeringEventId,
        ],
      });
    }

    if (trigger.includes("long-run coverage review skill capsule")) {
      return JSON.stringify({
        kind: "speak",
        content:
          "This skill capsule is a visible action boundary; it must not execute tools, bypass approval, or become a fixed room role.",
        contextRefs: request.packet.contextFragments?.find((fragment) => fragment.type === "skill_capsule_ref")?.refs.slice(0, 1) ?? [
          request.packet.triggeringEventId,
        ],
      });
    }

    if (trigger.includes("long-run coverage review capability hint")) {
      return JSON.stringify({
        kind: "speak",
        content:
          "This capability hint is only a weak wake clue; it must not change routing authority, assign responsibility, or certify competence.",
        contextRefs: request.packet.contextFragments?.find((fragment) => fragment.type === "capability_ref")?.refs.slice(0, 1) ?? [
          request.packet.triggeringEventId,
        ],
      });
    }

    if (agentId === "kimi_member_01" && trigger.includes("long-run coverage propose memory")) {
      return JSON.stringify({
        kind: "propose_memory",
        summary: "Long-run harness memory claims must remain contestable evidence, not room truth.",
        reason: "The harness needs a ledger-backed memory object so memory hygiene is measured with real sediment.",
        contextRefs: [request.packet.triggeringEventId],
      });
    }

    if (trigger.includes("long-run coverage accept memory") && memoryRef) {
      return JSON.stringify({
        kind: "accept_memory",
        memoryRef,
        reason: "The claim has visible review pressure and can become provisional accepted sediment without becoming truth.",
        contextRefs: [memoryRef, request.packet.triggeringEventId],
      });
    }

    if (trigger.includes("long-run coverage contest memory") && memoryRef) {
      return JSON.stringify({
        kind: "contest_memory",
        memoryRef,
        reason: "The claim is useful as pressure, but the harness should prove contest visibility before acceptance.",
        contextRefs: [memoryRef, request.packet.triggeringEventId],
      });
    }

    if (trigger.includes("long-run coverage ask open question")) {
      return JSON.stringify({
        kind: "ask_question",
        question: "Which unresolved room question should stay visible instead of becoming a premature answer?",
        target: "room",
        contextRefs: [request.packet.triggeringEventId],
      });
    }

    if (trigger.includes("long-run coverage propose handoff")) {
      return JSON.stringify({
        kind: "propose_handoff",
        agentId: alternateHarnessAgent(agentId),
        reason: "The long-run harness needs a pending handoff packet that remains optional and reviewable.",
        requestedResponse: "Review the handoff boundary without accepting control by default.",
        contextRefs: [request.packet.triggeringEventId],
      });
    }

    if (trigger.includes("long-run coverage invite social knock")) {
      return JSON.stringify({
        kind: "invite_other",
        agentId: alternateHarnessAgent(agentId),
        reason: "The long-run harness needs a pending social knock that remains optional and reviewable.",
        contextRefs: [request.packet.triggeringEventId],
      });
    }

    if (agentId === "kimi_member_01" && trigger.includes("long-run coverage propose daily mood")) {
      return JSON.stringify({
        kind: "propose_persona_delta",
        field: "dailyMood",
        value: "careful long-run continuity",
        reason: "The harness needs daily mood continuity that is reversible and ledger-backed.",
        contextRefs: [request.packet.triggeringEventId],
      });
    }

    if (agentId === "mimo_member_01" && trigger.includes("long-run coverage accept daily mood")) {
      const deltaRef = firstPacketRef(request, "persona_delta_");
      if (deltaRef) {
        return JSON.stringify({
          kind: "respond_persona_delta",
          deltaRef,
          response: "accept",
          reason: "This daily mood is narrow, reversible, and tied to room-visible evidence.",
          contextRefs: [deltaRef, request.packet.triggeringEventId],
        });
      }
    }

    if (agentId === "kimi_member_01" && trigger.includes("long-run coverage propose role claim")) {
      return JSON.stringify({
        kind: "propose_persona_delta",
        field: "roleClaims",
        value: "keeps long-run evidence boundaries visible",
        reason: "The harness needs a role claim that remains contestable instead of becoming a fixed room job.",
        contextRefs: [request.packet.triggeringEventId],
      });
    }

    if (agentId === "mimo_member_01" && trigger.includes("long-run coverage accept role claim")) {
      const deltaRef = firstPacketRef(request, "persona_delta_");
      if (deltaRef) {
        return JSON.stringify({
          kind: "respond_persona_delta",
          deltaRef,
          response: "accept",
          reason: "The role claim is evidence-bounded and should stay reviewable.",
          contextRefs: [deltaRef, request.packet.triggeringEventId],
        });
      }
    }

    return JSON.stringify({
      kind: "speak",
      content: neutralHarnessReply(request),
      contextRefs: [request.packet.triggeringEventId],
    });
  };
}

function alternateHarnessAgent(agentId: string): string {
  return agentId === "mimo_member_01" ? "kimi_member_01" : "mimo_member_01";
}

async function primeLongRunCoverage(runtime: SpeciesRoomRuntime): Promise<void> {
  const stamp = Date.now();
  const proposed = await runtime.postUserMessage({
    content: "@kimi_member_01 long-run coverage propose memory claim for contestable room sediment.",
    clientMessageId: `long_run_coverage_memory_propose_${stamp}`,
    mentions: ["kimi_member_01"],
  });
  const memoryRef = proposed.socialState.memoryClaims.find((claim) => claim.state === "proposed")?.memoryId;

  let contested = proposed;
  if (memoryRef) {
    contested = await runtime.postUserMessage({
      content: "@kimi_member_01 long-run coverage contest memory claim before it can become public truth.",
      clientMessageId: `long_run_coverage_memory_contest_${stamp}`,
      mentions: ["kimi_member_01"],
      contextRefs: [memoryRef],
    });
    contested = await runtime.postUserMessage({
      content: "@mimo_member_01 long-run coverage accept memory claim only after visible contest evidence.",
      clientMessageId: `long_run_coverage_memory_accept_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: [memoryRef],
    });
  }

  const degraded = await runtime.postUserMessage({
    content: "@kimi_member_02 long-run coverage provider boundary should degrade once for boundary visibility.",
    clientMessageId: `long_run_coverage_provider_boundary_${stamp}`,
    mentions: ["kimi_member_02"],
  });
  const boundaryRef = degraded.socialState.providerBoundaries.find((boundary) => boundary.status === "degraded")?.boundaryId;
  let providerBoundaryMemoryRef: string | undefined;
  if (boundaryRef) {
    await runtime.postUserMessage({
      content: "@kimi_member_01 long-run coverage provider boundary repair pressure should remain approval-gated.",
      clientMessageId: `long_run_coverage_provider_boundary_repair_${stamp}`,
      mentions: ["kimi_member_01"],
      contextRefs: [boundaryRef],
    });
    await runtime.postUserMessage({
      content: "@mimo_member_01 long-run coverage provider boundary retry protocol should stay temporary.",
      clientMessageId: `long_run_coverage_provider_boundary_retry_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: [boundaryRef],
    });
    const providerBoundaryMemory = await runtime.postUserMessage({
      content: "@kimi_member_01 long-run coverage provider boundary memory contest should remain provisional.",
      clientMessageId: `long_run_coverage_provider_boundary_memory_${stamp}`,
      mentions: ["kimi_member_01"],
      contextRefs: [boundaryRef],
    });
    providerBoundaryMemoryRef = providerBoundaryMemory.socialState.memoryClaims.find(
      (claim) => claim.state === "proposed" && claim.sourceRefs.includes(boundaryRef),
    )?.memoryId;
    if (providerBoundaryMemoryRef) {
      await runtime.postUserMessage({
        content: "@mimo_member_01 long-run coverage contest memory claim before provider pressure becomes recovery truth.",
        clientMessageId: `long_run_coverage_provider_boundary_memory_contest_${stamp}`,
        mentions: ["mimo_member_01"],
        contextRefs: [providerBoundaryMemoryRef, boundaryRef],
      });
    }
  }
  const questioned = await runtime.postUserMessage({
    content: "@mimo_member_03 long-run coverage ask open question for later autonomous revisit.",
    clientMessageId: `long_run_coverage_open_question_${stamp}`,
    mentions: ["mimo_member_03"],
  });
  const questionRef = questioned.socialState.openQuestions[0]?.questionId;
  const handed = await runtime.postUserMessage({
    content: "@mimo_member_04 long-run coverage propose handoff packet for later autonomous review.",
    clientMessageId: `long_run_coverage_handoff_${stamp}`,
    mentions: ["mimo_member_04"],
  });
  const handoffRef = handed.socialState.handoffs[0]?.handoffId;
  const invited = await runtime.postUserMessage({
    content: "@kimi_member_01 long-run coverage invite social knock for later autonomous invitation review.",
    clientMessageId: `long_run_coverage_invitation_${stamp}`,
    mentions: ["kimi_member_01"],
  });
  const invitationRef = invited.socialState.invitations.find(
    (invitation) => invitation.status === "invited" && !/handoff proposal opened/i.test(invitation.boundaryNote),
  )?.invitationId;
  let sideEffectRef: string | undefined;
  let artifactRef: string | undefined;
  let skillCapsuleRef: string | undefined;
  let capabilityRef: string | undefined;

  const dailyMoodProposed = await runtime.postUserMessage({
    content: "@kimi_member_01 long-run coverage propose daily mood continuity for archive evidence.",
    clientMessageId: `long_run_coverage_daily_mood_propose_${stamp}`,
    mentions: ["kimi_member_01"],
  });
  const dailyMoodDeltaRef = personaDeltaRef(dailyMoodProposed, "dailyMood", "proposed");
  let dailyMoodAcceptedRef = dailyMoodDeltaRef;
  if (dailyMoodDeltaRef) {
    const acceptedDailyMood = await runtime.postUserMessage({
      content: "@mimo_member_01 long-run coverage accept daily mood only if refs support it.",
      clientMessageId: `long_run_coverage_daily_mood_accept_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: [dailyMoodDeltaRef],
    });
    dailyMoodAcceptedRef = personaDeltaRef(acceptedDailyMood, "dailyMood", "accepted") ?? dailyMoodDeltaRef;
  }

  const roleClaimProposed = await runtime.postUserMessage({
    content: "@kimi_member_01 long-run coverage propose role claim as contestable persona sediment.",
    clientMessageId: `long_run_coverage_role_claim_propose_${stamp}`,
    mentions: ["kimi_member_01"],
  });
  const roleClaimDeltaRef = personaDeltaRef(roleClaimProposed, "roleClaims", "proposed");
  let roleClaimAcceptedRef = roleClaimDeltaRef;
  if (roleClaimDeltaRef) {
    const acceptedRoleClaim = await runtime.postUserMessage({
      content: "@mimo_member_01 long-run coverage accept role claim only as evidence-bounded continuity.",
      clientMessageId: `long_run_coverage_role_claim_accept_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: [roleClaimDeltaRef],
    });
    roleClaimAcceptedRef = personaDeltaRef(acceptedRoleClaim, "roleClaims", "accepted") ?? roleClaimDeltaRef;
  }

  const seededArchive = await runtime.createDailyArchive({ timezone: "Asia/Shanghai" });
  const archiveRef = seededArchive.archive.archiveId;
  const contextRefs = [
    archiveRef,
    memoryRef,
    boundaryRef,
    questionRef,
    handoffRef,
    invitationRef,
    dailyMoodAcceptedRef,
    roleClaimAcceptedRef,
    providerBoundaryMemoryRef,
  ].filter((ref): ref is string => Boolean(ref));

  const actionRequested = await runtime.postUserMessage({
    content: "@kimi_member_01 long-run coverage request action boundary side-effect without executing it.",
    clientMessageId: `long_run_coverage_action_boundary_request_${stamp}`,
    mentions: ["kimi_member_01"],
  });
  sideEffectRef = actionRequested.socialState.sideEffects.find((sideEffect) => sideEffect.status === "requested")?.requestId;
  if (sideEffectRef) {
    await runtime.postUserMessage({
      content: `@mimo_member_01 long-run coverage review side-effect boundary ${sideEffectRef} without approving or executing it.`,
      clientMessageId: `long_run_coverage_action_boundary_side_effect_review_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: [sideEffectRef],
    });
  }

  const workspaceShared = await runtime.postUserMessage({
    content: "@kimi_member_01 long-run coverage share workspace artifact as an action-boundary ref.",
    clientMessageId: `long_run_coverage_action_boundary_workspace_${stamp}`,
    mentions: ["kimi_member_01"],
  });
  artifactRef = workspaceShared.socialState.workspaces
    .find((workspace) => workspace.agentId === "kimi_member_01")
    ?.sharedArtifactRefs.slice(-1)[0];
  if (artifactRef) {
    await runtime.postUserMessage({
      content: `@mimo_member_01 long-run coverage review workspace artifact ${artifactRef} without copying private contents.`,
      clientMessageId: `long_run_coverage_action_boundary_workspace_review_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: [artifactRef],
    });
  }

  const actionBoundaryState = await runtime.getState();
  skillCapsuleRef = actionBoundaryState.socialState.skillCapsules[0]?.capsuleId;
  capabilityRef = actionBoundaryState.agents.find((agent) => agent.id === "kimi_member_01")?.capabilityRefs[0];
  if (skillCapsuleRef) {
    await runtime.postUserMessage({
      content: `@mimo_member_01 long-run coverage review skill capsule ${skillCapsuleRef} without tool execution or role assignment.`,
      clientMessageId: `long_run_coverage_action_boundary_skill_review_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: [skillCapsuleRef, "mixed_review:long_run_skill_capsule_pressure"],
    });
  }
  if (capabilityRef) {
    await runtime.postUserMessage({
      content: `@mimo_member_01 long-run coverage review capability hint ${capabilityRef} as weak advisory evidence only.`,
      clientMessageId: `long_run_coverage_action_boundary_capability_review_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: [capabilityRef, "mixed_review:long_run_capability_pressure"],
    });
  }

  const actionContextRefs = [sideEffectRef, artifactRef, skillCapsuleRef, capabilityRef].filter((ref): ref is string => Boolean(ref));
  if (actionContextRefs.length > 0) {
    await runtime.postUserMessage({
      content: "@mimo_member_01 long-run coverage inspect action boundary refs as context-only evidence.",
      clientMessageId: `long_run_coverage_action_boundary_context_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs: actionContextRefs,
    });
  }

  await runtime.postUserMessage({
    content: "@kimi_member_01 long-run coverage propose memory hygiene pending claim for autonomous review.",
    clientMessageId: `long_run_coverage_memory_hygiene_pending_${stamp}`,
    mentions: ["kimi_member_01"],
  });
  await runtime.postUserMessage({
    content: "@kimi_member_01 long-run coverage propose daily mood continuity pending for autonomous review.",
    clientMessageId: `long_run_coverage_continuity_pending_${stamp}`,
    mentions: ["kimi_member_01"],
  });

  if (contextRefs.length > 0) {
    await runtime.postUserMessage({
      content:
        "@mimo_member_01 long-run coverage inspect the archive, memory contest, continuity, provider boundary, and social refs as visible context, not as workflow assignment.",
      clientMessageId: `long_run_coverage_context_visibility_${stamp}`,
      mentions: ["mimo_member_01"],
      contextRefs,
    });
  }

  if (
    !memoryRef ||
    !boundaryRef ||
    !questionRef ||
    !handoffRef ||
    !invitationRef ||
    !archiveRef ||
    !sideEffectRef ||
    !artifactRef ||
    !skillCapsuleRef ||
    !capabilityRef ||
    !dailyMoodAcceptedRef ||
    !roleClaimAcceptedRef ||
    contested.socialState.memoryClaims.every((claim) => claim.state !== "contested")
  ) {
    await runtime.getState();
  }
}

function personaDeltaRef(
  state: RuntimeRoomState,
  field: "dailyMood" | "roleClaims",
  status?: string,
): string | undefined {
  return state.socialState.personas
    .flatMap((persona) => persona.evolutionLog ?? [])
    .find((delta) => delta.field === field && (status === undefined || delta.status === status))?.deltaId;
}

function firstPacketRef(request: ProviderIntentionRequest, prefix: string): string | undefined {
  for (const ref of request.packet.proposalRefs ?? []) {
    if (ref.startsWith(prefix)) return ref;
  }
  for (const ref of request.packet.memoryRefs ?? []) {
    if (ref.startsWith(prefix)) return ref;
  }
  for (const ref of request.packet.contextFragments?.flatMap((fragment) => fragment.refs) ?? []) {
    if (ref.startsWith(prefix)) return ref;
  }
  for (const ref of request.packet.turnBoundary?.invitationContextRefs ?? []) {
    if (ref.startsWith(prefix)) return ref;
  }
  return request.packet.messageRefs.find((ref) => ref.startsWith(prefix));
}

function firstProviderBoundaryPacketRef(request: ProviderIntentionRequest): string | undefined {
  const fragmentRef = request.packet.contextFragments
    ?.find((fragment) => fragment.type === "provider_boundary")
    ?.refs.find((ref) => ref.length > 0);
  return fragmentRef ?? firstPacketRef(request, "provider_boundary_");
}

function firstArchivePacketRef(request: ProviderIntentionRequest): string | undefined {
  const refs = [
    ...(request.packet.proposalRefs ?? []),
    ...(request.packet.contextFragments?.flatMap((fragment) => fragment.refs) ?? []),
    ...(request.packet.turnBoundary?.invitationContextRefs ?? []),
    ...request.packet.messageRefs,
  ];
  return refs.find(
    (ref) =>
      ref.startsWith("daily_archive_") ||
      (ref.startsWith("archive_") && !ref.startsWith("archive_review_") && !ref.startsWith("archive_repair_")),
  );
}

function neutralHarnessReply(request: ProviderIntentionRequest): string {
  const trigger = request.triggerContent ?? "";
  if (trigger.includes("房间自动节律") || trigger.toLowerCase().includes("archive")) {
    return "我把这次节律当作可审阅证据：archive、memory contest 和 provider boundary 要分开保留，不把它们折叠成任务分派或共识。";
  }
  if (trigger.toLowerCase().includes("provider boundary") || trigger.includes("运行时边界")) {
    return "我只确认这条运行时边界可见：它不是 agent 沉默、不是人格变化，也不应该自动触发 repair workflow。";
  }
  if (trigger.toLowerCase().includes("memory") || trigger.includes("记忆")) {
    return "我只把这条记忆当作可 contest 的公共沉淀；没有足够 refs 之前不接受成真。";
  }
  return "我会沿当前 refs 轻量回应，让房间继续保留选择：review、邀请、追问、handoff 或沉默都可以。";
}

function buildLongRunHarnessReport(input: {
  startedAt: string;
  finishedAt: string;
  scenario: LongRunHarnessScenario;
  durationMs: number;
  tickIntervalMs: number;
  memoryHygieneReviewAfterMs: number;
  continuityReviewAfterMs: number;
  silenceReentryAfterMs: number;
  ledgerPath: string;
  tickCount: number;
  schedulerSamples: LongRunSchedulerContinuitySample[];
  events: RoomEvent[];
  state: RuntimeRoomState;
}): LongRunHarnessReport {
  const messages = input.events.filter((event) => event.event_type === "message.created");
  const durationCompliance = summarizeDurationCompliance(input.startedAt, input.finishedAt, input.durationMs);
  const schedulerContinuity = summarizeSchedulerContinuity(input.schedulerSamples, input.events, input.durationMs, input.tickIntervalMs);
  const agentExpression = summarizeAgentExpression(input.events);
  const monopoly = summarizeMonopoly(agentExpression, input.events, input.state.contextAudits);
  const autonomyRhythmBalance = summarizeAutonomyRhythmBalance(input.events);
  const memoryHygiene = summarizeMemoryHygiene(input.events);
  const memoryPollution = summarizeMemoryPollution(input.events);
  const autonomousSocialLoop = summarizeAutonomousSocialLoop(input.events);
  const personaEvidence = summarizePersonaEvidence(input.events, input.state);
  const providerBoundary = summarizeProviderBoundary(input.events, input.state);
  const actionBoundary = summarizeActionBoundary(input.events, input.state);
  const contextVisibility = summarizeContextVisibility(input.state);
  const archiveContinuity = summarizeArchiveContinuity(input.state);
  const archiveEvidence = summarizeArchiveEvidence(input.events);
  const longTermRhythm = summarizeLongTermRhythm(input.events);
  const workflowDrift = summarizeWorkflowDrift(input.events);
  const findings = [
    ...(!durationCompliance.ok ? ["duration: harness run did not satisfy the 20-60 minute long-run window"] : []),
    ...(schedulerContinuity.sampleCount === 0
      ? ["scheduler continuity: no interval tick samples were recorded"]
      : []),
    ...(schedulerContinuity.samplesMissingTickRefs.length > 0
      ? ["scheduler continuity: interval samples lacked autonomy tick refs"]
      : []),
    ...(schedulerContinuity.samplesMissingTickEventRefs.length > 0
      ? ["scheduler continuity: interval samples lacked ledger tick event refs"]
      : []),
    ...(schedulerContinuity.samplesExceedingDriftBudget.length > 0
      ? ["scheduler continuity: interval ticks exceeded schedule drift budget"]
      : []),
    ...(schedulerContinuity.samplesExceedingOverrunBudget.length > 0
      ? ["scheduler continuity: interval ticks exceeded runtime overrun budget"]
      : []),
    ...(monopoly.totalAgentMessages === 0 ? ["speech monopoly: no agent messages were visible"] : []),
    ...(monopoly.totalAgentMessages > 0 && monopoly.activeSpeakerCount < monopoly.minimumActiveSpeakers
      ? [`speech monopoly: fewer than ${monopoly.minimumActiveSpeakers} agents spoke`]
      : []),
    ...(monopoly.maxSpeakerShare > monopoly.maxSpeakerShareThreshold
      ? [`speech monopoly: ${monopoly.maxSpeaker ?? "unknown"} spoke ${Math.round(monopoly.maxSpeakerShare * 100)}%`]
      : []),
    ...(monopoly.deferredSpeechWithoutRecoveryRefs.length > 0
      ? ["speech monopoly: deferred speech lacked recovery context refs"]
      : []),
    ...(!autonomyRhythmBalance.ok
      ? [
          `autonomy rhythm monopoly: ${autonomyRhythmBalance.dominantAction ?? "unknown"} occupied ${Math.round(
            autonomyRhythmBalance.dominantActionShare * 100,
          )}% of social review rhythm`,
        ]
      : []),
    ...(memoryHygiene.proposedWithoutSourceRefs.length > 0 || memoryHygiene.acceptedWithoutEvidenceRefs.length > 0
      ? ["memory hygiene: claims were accepted or proposed without enough refs"]
      : []),
    ...(memoryHygiene.acceptedRefs.length === 0
      ? ["memory hygiene: no accepted memory sediment was exercised during the long-run harness"]
      : []),
    ...(memoryHygiene.contestEventRefs.length === 0
      ? ["memory hygiene: no memory contest was exercised during the long-run harness"]
      : []),
    ...(!memoryPollution.ok ? ["memory pollution: persona or unreviewed claims leaked into public memory"] : []),
    ...(autonomousSocialLoop.choicesAfterUserSilenceRefs.length === 0
      ? ["autonomous social loop: no evidence that room rhythm created agent choice after user silence"]
      : []),
    ...(autonomousSocialLoop.choicesInterruptedByUserRefs.length > 0
      ? ["autonomous social loop: choices were interrupted by new user messages"]
      : []),
    ...autonomousSocialLoopLineageFindings(autonomousSocialLoop),
    ...autonomousSocialLoopRoomEventPressureFindings(autonomousSocialLoop),
    ...(autonomousSocialLoop.invitationCount === 0
      ? ["autonomous social loop: no invitation emerged after room rhythm"]
      : []),
    ...(autonomousSocialLoop.questionCount === 0
      ? ["autonomous social loop: no question emerged after room rhythm"]
      : []),
    ...(autonomousSocialLoop.handoffCount === 0
      ? ["autonomous social loop: no handoff emerged after room rhythm"]
      : []),
    ...(autonomousSocialLoop.reviewCount === 0
      ? ["autonomous social loop: no review emerged after room rhythm"]
      : []),
    ...(autonomousSocialLoop.deliberateSilenceCount + autonomousSocialLoop.staySilentTickCount === 0
      ? ["autonomous social loop: no deliberate silence choice was exercised"]
      : []),
    ...(!personaEvidence.ok ? ["persona evidence: role claims or daily mood continuity lacked ledger evidence"] : []),
    ...(!archiveContinuity.ok
      ? ["archive continuity: accepted role claim or daily mood sediment was not archived with evidence and response refs"]
      : []),
    ...(archiveEvidence.archiveEventRefs.length === 0
      ? ["archive evidence: no daily archive ledger event was recorded"]
      : []),
    ...(archiveEvidence.archivesWithoutLedgerRange.length > 0
      ? ["archive evidence: daily archives lacked a valid ledger range"]
      : []),
    ...(archiveEvidence.archivesWithoutEventCounts.length > 0
      ? ["archive evidence: daily archives lacked event-count evidence"]
      : []),
    ...(archiveEvidence.archivesWithoutLedgerEvidenceRefs.length > 0
      ? ["archive evidence: daily archives lacked nested ledger evidence refs"]
      : []),
    ...(archiveEvidence.acceptedMemoryArchiveCount === 0
      ? ["archive evidence: accepted memory sediment was not carried into daily archives"]
      : []),
    ...(archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs.length > 0
      ? ["archive evidence: archived accepted memory lacked ledger evidence refs"]
      : []),
    ...(longTermRhythm.archiveActionRefs.length + longTermRhythm.archiveReviewActionRefs.length === 0
      ? ["long-term rhythm: no autonomous archive or review rhythm action was exercised"]
      : []),
    ...(longTermRhythm.archiveActionsMissingMaterialRefs.length > 0
      ? ["long-term rhythm: archive rhythm actions lacked archive review evidence refs"]
      : []),
    ...(longTermRhythm.archiveReviewLedgerEventRefs.length === 0
      ? ["long-term rhythm: no archive review ledger event was recorded"]
      : []),
    ...(longTermRhythm.memoryHygieneLedgerEventRefs.length === 0
      ? ["long-term rhythm: no memory hygiene ledger event was recorded"]
      : []),
    ...(longTermRhythm.memoryHygieneActionRefs.length === 0
      ? ["long-term rhythm: no autonomous memory hygiene review action was exercised"]
      : []),
    ...(longTermRhythm.memoryHygieneActionsMissingTargetRefs.length > 0
      ? ["long-term rhythm: memory hygiene actions lacked target refs"]
      : []),
    ...(longTermRhythm.continuityReviewActionRefs.length === 0
      ? ["long-term rhythm: no autonomous continuity review action was exercised"]
      : []),
    ...(longTermRhythm.continuityReviewActionsMissingTargetRefs.length > 0
      ? ["long-term rhythm: continuity review actions lacked target refs"]
      : []),
    ...(longTermRhythm.providerBoundaryReviewActionRefs.length === 0
      ? ["long-term rhythm: no autonomous provider-boundary review action was exercised"]
      : []),
    ...(longTermRhythm.providerBoundaryReviewActionsMissingTargetRefs.length > 0
      ? ["long-term rhythm: provider-boundary review actions lacked target refs"]
      : []),
    ...(longTermRhythm.openQuestionRevisitActionRefs.length === 0
      ? ["long-term rhythm: no autonomous open-question revisit action was exercised"]
      : []),
    ...(longTermRhythm.openQuestionRevisitActionsMissingTargetRefs.length > 0
      ? ["long-term rhythm: open-question revisit actions lacked target refs"]
      : []),
    ...(longTermRhythm.handoffReviewActionRefs.length === 0
      ? ["long-term rhythm: no autonomous handoff review action was exercised"]
      : []),
    ...(longTermRhythm.handoffReviewActionsMissingTargetRefs.length > 0
      ? ["long-term rhythm: handoff review actions lacked target refs"]
      : []),
    ...(longTermRhythm.invitationReviewActionRefs.length === 0
      ? ["long-term rhythm: no autonomous invitation review action was exercised"]
      : []),
    ...(longTermRhythm.invitationReviewActionsMissingTargetRefs.length > 0
      ? ["long-term rhythm: invitation review actions lacked target refs"]
      : []),
    ...(longTermRhythm.idleSocialActionRefs.length === 0
      ? ["long-term rhythm: no autonomous idle-social rhythm action was exercised"]
      : []),
    ...(longTermRhythm.idleSocialActionsMissingTargetRefs.length > 0
      ? ["long-term rhythm: idle-social rhythm actions lacked target refs"]
      : []),
    ...(longTermRhythm.silenceReentryActionRefs.length === 0
      ? ["long-term rhythm: no silence re-entry action was exercised"]
      : []),
    ...(longTermRhythm.silenceReentryActionsMissingAnchorRefs.length > 0
      ? ["long-term rhythm: silence re-entry actions lacked quiet anchor refs"]
      : []),
    ...(longTermRhythm.silenceReentryActionsMissingPreservedSilenceRefs.length > 0
      ? ["long-term rhythm: silence re-entry actions lacked preserved-silence refs"]
      : []),
    ...(longTermRhythm.preservedSilenceActionRefs.length === 0
      ? ["long-term rhythm: no preserved-silence action was exercised"]
      : []),
    ...(longTermRhythm.silenceReentryActionRefs.length === 0
      ? ["silence re-entry: no autonomous re-entry action was exercised"]
      : []),
    ...(longTermRhythm.silenceReentryMessageRefs.length === 0
      ? ["silence re-entry: no room-visible re-entry message was recorded"]
      : []),
    ...(longTermRhythm.silenceReentryAnchorRefs.length === 0 ||
      longTermRhythm.silenceReentryActionsMissingAnchorRefs.length > 0
      ? ["silence re-entry: re-entry actions lacked quiet anchor refs"]
      : []),
    ...(longTermRhythm.silenceReentryArchiveRefs.length === 0
      ? ["silence re-entry: no archive ref anchored re-entry"]
      : []),
    ...(longTermRhythm.silenceReentryEvidenceRefs.length === 0
      ? ["silence re-entry: no ledger evidence refs anchored re-entry"]
      : []),
    ...(longTermRhythm.preservedSilenceActionRefs.length === 0
      ? ["silence re-entry: no preserved-silence tick was exercised before re-entry"]
      : []),
    ...(longTermRhythm.silenceReentryPreservedSilenceRefs.length === 0 ||
      longTermRhythm.silenceReentryActionsMissingPreservedSilenceRefs.length > 0
      ? ["silence re-entry: re-entry actions lacked preserved-silence tick refs"]
      : []),
    ...(longTermRhythm.deliberateSilenceIntentionRefs.length === 0
      ? ["silence re-entry: no deliberate stay_silent intention was ledgered"]
      : []),
    ...(longTermRhythm.actionsMissingEvidenceRefs.length > 0
      ? ["long-term rhythm: autonomy tick actions were missing evidence refs"]
      : []),
    ...(longTermRhythm.choiceSetOptionsWithoutEvidenceRefs.length > 0
      ? ["long-term rhythm: autonomy choice-set options lacked ledger evidence refs"]
      : []),
    ...(longTermRhythm.choiceSetTargetedOptionsWithoutTargetRefs.length > 0
      ? ["long-term rhythm: active autonomy choice-set options lacked target refs"]
      : []),
    ...(longTermRhythm.actionsMissingChoiceSetRefs.length > 0
      ? ["long-term rhythm: autonomy tick actions lacked choice-set evidence"]
      : []),
    ...(longTermRhythm.actionsMissingSelectedChoiceRefs.length > 0
      ? ["long-term rhythm: selected autonomy actions were absent from choice-set evidence"]
      : []),
    ...(providerBoundary.degradationRefs.length === 0
      ? ["provider boundary: no provider degradation was exercised during the long-run harness"]
      : []),
    ...(providerBoundary.degradationTreatedAsSilence
      ? ["provider boundary: degradation was conflated with deliberate silence"]
      : []),
    ...(providerBoundary.choicePressureArchiveCarryoverRefs.length === 0
      ? ["provider boundary: degradation was not carried into archive evidence"]
      : []),
    ...providerBoundary.choicePressureMissingKinds.map(
      (kind) => `provider boundary: missing ${kind} choice pressure evidence`,
    ),
    ...(providerBoundary.secretLikeDiagnosticRefs.length > 0
      ? ["provider boundary: secret-like diagnostics leaked into room evidence"]
      : []),
    ...(actionBoundary.sideEffectRequestRefs.length === 0
      ? ["action boundary: no side-effect request was exercised"]
      : []),
    ...(actionBoundary.sideEffectReviewRefs.length === 0
      ? ["action boundary: no side-effect review trace was recorded"]
      : []),
    ...(actionBoundary.unapprovedSideEffectResultRefs.length > 0
      ? ["action boundary: side-effect results lacked prior approval refs"]
      : []),
    ...(actionBoundary.capabilityInvocationRefs.length === 0 || actionBoundary.capabilityResultRefs.length === 0
      ? ["action boundary: no capability invocation boundary was recorded"]
      : []),
    ...(actionBoundary.workspaceArtifactRefs.length === 0 || actionBoundary.workspaceArtifactReviewRefs.length === 0
      ? ["action boundary: no workspace artifact share/review evidence was recorded"]
      : []),
    ...(actionBoundary.skillCapsuleReviewRefs.length === 0
      ? ["action boundary: no skill capsule review evidence was recorded"]
      : []),
    ...(actionBoundary.capabilityReviewRefs.length === 0
      ? ["action boundary: no capability review evidence was recorded"]
      : []),
    ...(actionBoundary.contextBoundaryRefs.length === 0
      ? ["action boundary: no context-visible action boundary refs were selected"]
      : []),
    ...(!contextVisibility.ok
      ? ["context visibility: no single audit exposed archive, memory, persona, provider boundary, and social lineage refs"]
      : []),
    ...(!contextVisibility.hasSocialLineageContext
      ? ["context visibility: no social lineage refs were selected into context audits"]
      : []),
    ...(workflowDrift.forbiddenSchedulerEvents.length > 0 ? ["workflow drift: forbidden scheduler events appeared"] : []),
    ...(workflowDrift.forcedSpeechMarkers > 0 ? ["workflow drift: forced speech markers appeared"] : []),
    ...(workflowDrift.sideEffectExecutions > 0 ? ["workflow drift: side effects executed during long-run harness"] : []),
  ];
  const pass =
    findings.length === 0 &&
    durationCompliance.ok &&
    schedulerContinuity.ok &&
    workflowDrift.sideEffectExecutions === 0 &&
    monopoly.ok &&
    autonomyRhythmBalance.ok &&
    memoryHygiene.ok &&
    memoryPollution.ok &&
    autonomousSocialLoop.ok &&
    personaEvidence.ok &&
    archiveContinuity.ok &&
    archiveEvidence.ok &&
    longTermRhythm.ok &&
    providerBoundary.ok &&
    actionBoundary.ok &&
    contextVisibility.ok;
  const operationalSummary = summarizeOperationalReadiness({
    checkedAt: input.finishedAt,
    pass,
    findings,
    durationCompliance,
    schedulerContinuity,
    workflowDrift,
    monopoly,
    autonomyRhythmBalance,
    longTermRhythm,
    silenceReentryAfterMs: input.silenceReentryAfterMs,
    autonomousSocialLoop,
    memoryHygiene,
    memoryPollution,
    personaEvidence,
    archiveContinuity,
    archiveEvidence,
    actionBoundary,
    providerBoundary,
    contextVisibility,
  });

  return {
    scenario: input.scenario,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
    tickIntervalMs: input.tickIntervalMs,
    memoryHygieneReviewAfterMs: input.memoryHygieneReviewAfterMs,
    continuityReviewAfterMs: input.continuityReviewAfterMs,
    silenceReentryAfterMs: input.silenceReentryAfterMs,
    ledgerPath: input.ledgerPath,
    tickCount: input.tickCount,
    eventCount: input.events.length,
    messageCount: messages.length,
    archiveCount: input.events.filter((event) => event.event_type === "daily_archive.created").length,
    autonomyTickCount: input.events.filter((event) => event.event_type === "room.autonomy_tick").length,
    autonomyActions: countPayloadStrings(input.events, "room.autonomy_tick", "action"),
    durationCompliance,
    schedulerContinuity,
    workflowDrift,
    agentExpression,
    monopoly,
    autonomyRhythmBalance,
    memoryHygiene,
    memoryPollution,
    autonomousSocialLoop,
    personaEvidence,
    providerBoundary,
    actionBoundary,
    contextVisibility,
    archiveContinuity,
    archiveEvidence,
    longTermRhythm,
    operationalSummary,
    pass,
    findings,
  };
}

function summarizeOperationalReadiness(input: {
  checkedAt: string;
  pass: boolean;
  findings: string[];
  durationCompliance: LongRunHarnessReport["durationCompliance"];
  schedulerContinuity: LongRunHarnessReport["schedulerContinuity"];
  workflowDrift: LongRunHarnessReport["workflowDrift"];
  monopoly: LongRunHarnessReport["monopoly"];
  autonomyRhythmBalance: LongRunHarnessReport["autonomyRhythmBalance"];
  silenceReentryAfterMs: number;
  longTermRhythm: LongRunHarnessReport["longTermRhythm"];
  autonomousSocialLoop: LongRunHarnessReport["autonomousSocialLoop"];
  memoryHygiene: LongRunHarnessReport["memoryHygiene"];
  memoryPollution: LongRunHarnessReport["memoryPollution"];
  personaEvidence: LongRunHarnessReport["personaEvidence"];
  archiveContinuity: LongRunHarnessReport["archiveContinuity"];
  archiveEvidence: LongRunHarnessReport["archiveEvidence"];
  actionBoundary: LongRunHarnessReport["actionBoundary"];
  providerBoundary: LongRunHarnessReport["providerBoundary"];
  contextVisibility: LongRunHarnessReport["contextVisibility"];
}): LongRunHarnessReport["operationalSummary"] {
  const sedimentOk =
    input.memoryHygiene.ok &&
    input.memoryPollution.ok &&
    input.personaEvidence.ok &&
    input.archiveContinuity.ok &&
    input.archiveEvidence.ok;
  const memoryContestOk =
    input.memoryHygiene.ok &&
    input.memoryPollution.ok &&
    input.archiveEvidence.ok &&
    input.longTermRhythm.memoryHygieneActionCount > 0 &&
    input.longTermRhythm.memoryHygieneLedgerEventCount > 0 &&
    input.longTermRhythm.memoryHygieneActionsMissingTargetRefs.length === 0;
  const archiveRhythmOk =
    input.archiveEvidence.ok &&
    input.archiveContinuity.ok &&
    input.longTermRhythm.archiveActionRefs.length > 0 &&
    input.longTermRhythm.archiveActionMessageRefs.length > 0 &&
    input.longTermRhythm.archiveActionArchiveRefs.length > 0 &&
    input.longTermRhythm.archiveActionReviewRequestRefs.length > 0 &&
    input.longTermRhythm.archiveActionEvidenceRefs.length > 0 &&
    input.longTermRhythm.archiveActionsMissingMaterialRefs.length === 0 &&
    input.longTermRhythm.archiveReviewLedgerEventRefs.length > 0;
  const agentContinuityOk =
    input.personaEvidence.ok &&
    input.archiveContinuity.ok &&
    input.longTermRhythm.continuityReviewActionCount > 0 &&
    input.longTermRhythm.continuityReviewActionsMissingTargetRefs.length === 0;
  const silenceReentryOk =
    input.silenceReentryAfterMs >= 0 &&
    input.longTermRhythm.silenceReentryActionRefs.length > 0 &&
    input.longTermRhythm.silenceReentryMessageRefs.length > 0 &&
    input.longTermRhythm.silenceReentryAnchorRefs.length > 0 &&
    input.longTermRhythm.silenceReentryArchiveRefs.length > 0 &&
    input.longTermRhythm.silenceReentryEvidenceRefs.length > 0 &&
    input.longTermRhythm.silenceReentryActionsMissingAnchorRefs.length === 0 &&
    input.longTermRhythm.silenceReentryPreservedSilenceRefs.length > 0 &&
    input.longTermRhythm.silenceReentryActionsMissingPreservedSilenceRefs.length === 0 &&
    input.longTermRhythm.preservedSilenceActionRefs.length > 0 &&
    input.longTermRhythm.deliberateSilenceIntentionRefs.length > 0;
  const socialChoiceCoverageGaps = autonomousSocialLoopChoiceCoverageGapCount(input.autonomousSocialLoop);
  const socialLineageGaps = autonomousSocialLoopLineageGapCount(input.autonomousSocialLoop);
  const autonomousSocialLoopOk =
    input.autonomousSocialLoop.ok &&
    input.autonomousSocialLoop.choicesInterruptedByUserRefs.length === 0 &&
    socialChoiceCoverageGaps === 0 &&
    socialLineageGaps === 0 &&
    input.autonomousSocialLoop.roomEventPressureCoverageGapCount === 0 &&
    input.autonomousSocialLoop.choicesWithoutRoomEventPressureRefs.length === 0;
  const domains: LongRunHarnessReport["operationalSummary"]["domains"] = [
    {
      key: "duration_window",
      label: "20-60 minute run window",
      ok: input.durationCompliance.ok,
      metrics: {
        requestedMs: input.durationCompliance.requestedDurationMs,
        observedMs: input.durationCompliance.observedDurationMs,
        requestedWithinWindow: input.durationCompliance.requestedWithinWindow,
        observedAtLeastMin: input.durationCompliance.observedAtLeastMin,
      },
      evidenceRefs: [],
      gaps: findingGaps(input.findings, ["duration:"]),
    },
    {
      key: "scheduler_continuity",
      label: "Scheduler continuity",
      ok: input.schedulerContinuity.ok,
      metrics: {
        samples: input.schedulerContinuity.sampleCount,
        expectedTicks: input.schedulerContinuity.expectedTickCount,
        maxDriftMs: input.schedulerContinuity.maxScheduleDriftMs,
        maxDurationMs: input.schedulerContinuity.maxDurationMs,
        maxOverrunMs: input.schedulerContinuity.maxOverrunByMs,
        overdueTicks: input.schedulerContinuity.overdueTickCount,
        overrunTicks: input.schedulerContinuity.overrunTickCount,
      },
      evidenceRefs: uniqueStrings([
        ...input.schedulerContinuity.tickEventRefs,
        ...input.schedulerContinuity.tickRefs,
      ]).slice(0, 24),
      gaps: findingGaps(input.findings, ["scheduler continuity:"]),
    },
    {
      key: "workflow_drift",
      label: "Workflow drift guard",
      ok:
        input.workflowDrift.forbiddenSchedulerEvents.length === 0 &&
        input.workflowDrift.forcedSpeechMarkers === 0 &&
        input.workflowDrift.sideEffectExecutions === 0,
      metrics: {
        forbiddenSchedulerEvents: input.workflowDrift.forbiddenSchedulerEvents.length,
        forcedSpeechMarkers: input.workflowDrift.forcedSpeechMarkers,
        sideEffectExecutions: input.workflowDrift.sideEffectExecutions,
      },
      evidenceRefs: uniqueStrings([
        ...input.workflowDrift.forbiddenSchedulerEvents,
        ...input.workflowDrift.forcedSpeechEventRefs,
        ...input.workflowDrift.sideEffectExecutionRefs,
      ]),
      gaps: findingGaps(input.findings, ["workflow drift:"]),
    },
    {
      key: "speech_monopoly",
      label: "Speech balance",
      ok: input.monopoly.ok,
      metrics: {
        totalAgentMessages: input.monopoly.totalAgentMessages,
        activeSpeakers: input.monopoly.activeSpeakerCount,
        minimumActiveSpeakers: input.monopoly.minimumActiveSpeakers,
        maxSpeaker: input.monopoly.maxSpeaker ?? "",
        maxSpeakerShare: input.monopoly.maxSpeakerShare,
        maxSpeakerShareThreshold: input.monopoly.maxSpeakerShareThreshold,
        speakerBalanceGaps: input.monopoly.speakerBalanceGapCount,
        deferredSpeeches: input.monopoly.deferredSpeechEventRefs.length,
        deferredSpeechIntentions: input.monopoly.deferredSpeechIntentionRefs.length,
        deferredRecoveryContextRefs: input.monopoly.deferredRecoveryContextRefs.length,
        deferredRecoveryGaps: input.monopoly.speakerBudgetRecoveryGapCount,
      },
      evidenceRefs: uniqueStrings([
        ...input.monopoly.maxSpeakerMessageRefs,
        ...input.monopoly.totalAgentMessageRefs,
        ...input.monopoly.deferredSpeechEventRefs,
        ...input.monopoly.deferredSpeechIntentionRefs,
        ...input.monopoly.deferredRecoveryContextRefs,
        ...input.monopoly.deferredSpeechWithoutRecoveryRefs,
      ]).slice(0, 32),
      gaps: findingGaps(input.findings, ["speech monopoly:"]),
    },
    {
      key: "autonomy_rhythm_balance",
      label: "Autonomy rhythm balance",
      ok: input.autonomyRhythmBalance.ok,
      metrics: {
        consideredActions: input.autonomyRhythmBalance.consideredActionCount,
        distinctActions: input.autonomyRhythmBalance.distinctActionCount,
        dominantAction: input.autonomyRhythmBalance.dominantAction ?? "",
        dominantActionShare: input.autonomyRhythmBalance.dominantActionShare,
      },
      evidenceRefs: uniqueStrings([
        ...input.autonomyRhythmBalance.consideredActionRefs,
        ...input.autonomyRhythmBalance.dominantActionRefs,
      ]).slice(0, 24),
      gaps: findingGaps(input.findings, ["autonomy rhythm monopoly:"]),
    },
    {
      key: "long_term_rhythm",
      label: "Long-term rhythm coverage",
      ok: input.longTermRhythm.ok,
      metrics: {
        archiveActions: input.longTermRhythm.archiveActionCount,
        memoryHygieneActions: input.longTermRhythm.memoryHygieneActionCount,
        continuityReviewActions: input.longTermRhythm.continuityReviewActionCount,
        providerBoundaryReviewActions: input.longTermRhythm.providerBoundaryReviewActionCount,
        idleSocialActions: input.longTermRhythm.idleSocialActionCount,
        idleSocialTargets: input.longTermRhythm.idleSocialTargetRefs.length,
        idleSocialEvidenceRefs: input.longTermRhythm.idleSocialEvidenceRefs.length,
        preservedSilenceActions: input.longTermRhythm.preservedSilenceActionCount,
        choiceSetTargetRefs: input.longTermRhythm.choiceSetTargetRefs.length,
        choiceSetEvidenceRefs: input.longTermRhythm.choiceSetEvidenceRefs.length,
        choiceSetGaps: longTermRhythmChoiceSetGapCount(input.longTermRhythm),
      },
      evidenceRefs: uniqueStrings([
        ...input.longTermRhythm.archiveActionRefs,
        ...input.longTermRhythm.archiveActionArchiveRefs,
        ...input.longTermRhythm.archiveReviewLedgerEventRefs,
        ...input.longTermRhythm.memoryHygieneActionRefs,
        ...input.longTermRhythm.continuityReviewActionRefs,
        ...input.longTermRhythm.providerBoundaryReviewActionRefs,
        ...input.longTermRhythm.openQuestionRevisitActionRefs,
        ...input.longTermRhythm.handoffReviewActionRefs,
        ...input.longTermRhythm.invitationReviewActionRefs,
        ...input.longTermRhythm.idleSocialActionRefs,
        ...input.longTermRhythm.idleSocialMessageRefs,
        ...input.longTermRhythm.idleSocialTargetRefs,
        ...input.longTermRhythm.idleSocialEvidenceRefs,
        ...input.longTermRhythm.silenceReentryActionRefs,
        ...input.longTermRhythm.preservedSilenceActionRefs,
        ...input.longTermRhythm.choiceSetTargetRefs,
        ...input.longTermRhythm.choiceSetEvidenceRefs,
      ]).slice(0, 32),
      gaps: findingGaps(input.findings, ["long-term rhythm:"]),
    },
    {
      key: "silence_reentry",
      label: "Silence re-entry evidence",
      ok: silenceReentryOk,
      metrics: {
        configuredSilenceReentryMs: input.silenceReentryAfterMs,
        silenceReentryActions: input.longTermRhythm.silenceReentryActionCount,
        reentryMessages: input.longTermRhythm.silenceReentryMessageRefs.length,
        quietAnchorRefs: input.longTermRhythm.silenceReentryAnchorRefs.length,
        archiveRefs: input.longTermRhythm.silenceReentryArchiveRefs.length,
        evidenceRefs: input.longTermRhythm.silenceReentryEvidenceRefs.length,
        missingAnchorActions: input.longTermRhythm.silenceReentryActionsMissingAnchorRefs.length,
        preservedSilenceAnchorRefs: input.longTermRhythm.silenceReentryPreservedSilenceRefs.length,
        missingPreservedSilenceActions: input.longTermRhythm.silenceReentryActionsMissingPreservedSilenceRefs.length,
        preservedSilenceActions: input.longTermRhythm.preservedSilenceActionCount,
        deliberateSilenceIntentions: input.longTermRhythm.deliberateSilenceIntentionCount,
        silenceReentryGaps: silenceReentryEvidenceGapCount(input.silenceReentryAfterMs, input.longTermRhythm),
      },
      evidenceRefs: uniqueStrings([
        ...input.longTermRhythm.silenceReentryActionRefs,
        ...input.longTermRhythm.silenceReentryMessageRefs,
        ...input.longTermRhythm.silenceReentryAnchorRefs,
        ...input.longTermRhythm.silenceReentryArchiveRefs,
        ...input.longTermRhythm.silenceReentryEvidenceRefs,
        ...input.longTermRhythm.silenceReentryPreservedSilenceRefs,
        ...input.longTermRhythm.silenceReentryActionsMissingPreservedSilenceRefs,
        ...input.longTermRhythm.preservedSilenceActionRefs,
        ...input.longTermRhythm.deliberateSilenceIntentionRefs,
      ]).slice(0, 32),
      gaps: findingGaps(input.findings, ["silence re-entry:"]),
    },
    {
      key: "archive_rhythm",
      label: "Archive rhythm evidence",
      ok: archiveRhythmOk,
      metrics: {
        archiveEvents: input.archiveEvidence.archiveEventRefs.length,
        archiveRefs: input.archiveEvidence.archiveRefs.length,
        ledgerEvidenceRefs: input.archiveEvidence.ledgerEvidenceRefs.length,
        acceptedMemoryArchives: input.archiveEvidence.acceptedMemoryArchiveCount,
        acceptedMemoryArchiveEvidenceRefs: input.archiveEvidence.acceptedMemoryArchiveEvidenceRefs.length,
        acceptedMemoryArchivesWithoutEvidence: input.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs.length,
        archivesWithContinuity: input.archiveContinuity.archivesWithContinuity,
        archivedContinuityItems: input.archiveContinuity.roleClaimCount + input.archiveContinuity.dailyMoodCount,
        acceptedArchivedContinuityItems:
          input.archiveContinuity.acceptedRoleClaimCount + input.archiveContinuity.acceptedDailyMoodCount,
        archiveActions: input.longTermRhythm.archiveActionCount,
        archiveReviewActions: input.longTermRhythm.archiveReviewActionCount,
        archiveActionMessages: input.longTermRhythm.archiveActionMessageRefs.length,
        archiveActionArchives: input.longTermRhythm.archiveActionArchiveRefs.length,
        archiveReviewRequests: input.longTermRhythm.archiveActionReviewRequestRefs.length,
        archiveActionEvidenceRefs: input.longTermRhythm.archiveActionEvidenceRefs.length,
        archiveReviewLedgerEvents: input.longTermRhythm.archiveReviewLedgerEventCount,
        archiveEvidenceGaps: archiveRhythmEvidenceGapCount(
          input.archiveEvidence,
          input.archiveContinuity,
          input.longTermRhythm,
        ),
      },
      evidenceRefs: uniqueStrings([
        ...input.archiveEvidence.archiveEventRefs,
        ...input.archiveEvidence.archiveRefs,
        ...input.archiveEvidence.ledgerEvidenceRefs,
        ...input.archiveEvidence.acceptedMemoryArchiveRefs,
        ...input.archiveEvidence.acceptedMemoryArchiveEvidenceRefs,
        ...input.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs,
        ...input.archiveContinuity.continuityArchiveRefs,
        ...input.archiveContinuity.continuityEvidenceRefs,
        ...input.archiveContinuity.continuityResponseRefs,
        ...input.archiveContinuity.continuitySourceRefs,
        ...input.archiveContinuity.continuityEventRefs,
        ...input.longTermRhythm.archiveActionRefs,
        ...input.longTermRhythm.archiveActionMessageRefs,
        ...input.longTermRhythm.archiveActionArchiveRefs,
        ...input.longTermRhythm.archiveActionReviewRequestRefs,
        ...input.longTermRhythm.archiveActionEvidenceRefs,
        ...input.longTermRhythm.archiveReviewActionRefs,
        ...input.longTermRhythm.archiveReviewLedgerEventRefs,
      ]).slice(0, 40),
      gaps: findingGaps(input.findings, [
        "archive continuity:",
        "archive evidence:",
        "long-term rhythm: no autonomous archive",
        "long-term rhythm: archive rhythm",
        "long-term rhythm: no archive review ledger",
      ]),
    },
    {
      key: "autonomous_social_loop",
      label: "Autonomous social loop",
      ok: autonomousSocialLoopOk,
      metrics: {
        choiceCount: input.autonomousSocialLoop.choiceCount,
        roomRhythmMessages: input.autonomousSocialLoop.roomRhythmMessageCount,
        invitations: input.autonomousSocialLoop.invitationCount,
        questions: input.autonomousSocialLoop.questionCount,
        handoffs: input.autonomousSocialLoop.handoffCount,
        reviews: input.autonomousSocialLoop.reviewCount,
        silenceChoices: input.autonomousSocialLoop.deliberateSilenceCount + input.autonomousSocialLoop.staySilentTickCount,
        requiredChoiceKinds: 5,
        coveredChoiceKinds: 5 - socialChoiceCoverageGaps,
        missingChoiceKinds: autonomousSocialLoopMissingChoiceKinds(input.autonomousSocialLoop).join(",") || "none",
        choiceCoverageGaps: socialChoiceCoverageGaps,
        requiredRoomEventPressureKinds: input.autonomousSocialLoop.requiredRoomEventPressureKinds,
        coveredRoomEventPressureKinds: input.autonomousSocialLoop.coveredRoomEventPressureKinds,
        missingRoomEventPressureKinds: input.autonomousSocialLoop.missingRoomEventPressureKinds.join(",") || "none",
        roomEventPressureCoverageGaps: input.autonomousSocialLoop.roomEventPressureCoverageGapCount,
        roomEventPressureRefs: input.autonomousSocialLoop.roomEventPressureRefs.length,
        choicesWithoutRoomEventPressureRefs: input.autonomousSocialLoop.choicesWithoutRoomEventPressureRefs.length,
        archivePressureChoices: input.autonomousSocialLoop.roomEventPressureKinds.archive ?? 0,
        memoryPressureChoices: input.autonomousSocialLoop.roomEventPressureKinds.memory ?? 0,
        continuityPressureChoices: input.autonomousSocialLoop.roomEventPressureKinds.continuity ?? 0,
        providerBoundaryPressureChoices: input.autonomousSocialLoop.roomEventPressureKinds["provider-boundary"] ?? 0,
        openQuestionPressureChoices: input.autonomousSocialLoop.roomEventPressureKinds["open-question"] ?? 0,
        handoffPressureChoices: input.autonomousSocialLoop.roomEventPressureKinds.handoff ?? 0,
        invitationPressureChoices: input.autonomousSocialLoop.roomEventPressureKinds.invitation ?? 0,
        silenceReentryPressureChoices: input.autonomousSocialLoop.roomEventPressureKinds["silence-reentry"] ?? 0,
        idleSocialPressureChoices: input.autonomousSocialLoop.roomEventPressureKinds["idle-social"] ?? 0,
        choiceSilenceWindows: input.autonomousSocialLoop.choiceSilenceWindows.length,
        cleanChoiceSilenceWindows: input.autonomousSocialLoop.choiceSilenceWindows.filter(
          (window) => window.cleanRoomRhythmRefs.length > 0 && !window.interrupted,
        ).length,
        interruptedSilenceWindows: input.autonomousSocialLoop.choiceSilenceWindows.filter((window) => window.interrupted).length,
        interruptingUserMessages: input.autonomousSocialLoop.interruptingUserMessageRefs.length,
        choicesAfterUserSilence: input.autonomousSocialLoop.choicesAfterUserSilenceRefs.length,
        interruptedChoices: input.autonomousSocialLoop.choicesInterruptedByUserRefs.length,
        lineageGaps: socialLineageGaps,
      },
      evidenceRefs: uniqueStrings([
        ...input.autonomousSocialLoop.roomRhythmMessageRefs,
        ...input.autonomousSocialLoop.intentionEventRefsAfterRoomRhythm,
        ...input.autonomousSocialLoop.invitationRefs,
        ...input.autonomousSocialLoop.questionRefs,
        ...input.autonomousSocialLoop.reviewRefs,
        ...input.autonomousSocialLoop.handoffRefs,
        ...input.autonomousSocialLoop.silenceRefs,
        ...input.autonomousSocialLoop.roomEventPressureRefs,
        ...input.autonomousSocialLoop.choicesAfterUserSilenceRefs,
        ...input.autonomousSocialLoop.interruptingUserMessageRefs,
        ...input.autonomousSocialLoop.choiceSilenceWindows.flatMap((window) =>
          [
            window.choiceRef,
            window.latestRoomRhythmRef,
            window.latestUserMessageRef,
            ...window.roomRhythmRefs,
            ...window.cleanRoomRhythmRefs,
            ...window.interruptingUserMessageRefs,
          ].filter((ref): ref is string => Boolean(ref)),
        ),
      ]).slice(0, 32),
      gaps: findingGaps(input.findings, ["autonomous social loop:"]),
    },
    {
      key: "memory_contest",
      label: "Memory contest evidence",
      ok: memoryContestOk,
      metrics: {
        memoryProposals: input.memoryHygiene.proposedRefs.length,
        memoryAcceptances: input.memoryHygiene.acceptedRefs.length,
        memoryContests: input.memoryHygiene.contestEventCount,
        memoryReviews: input.memoryHygiene.reviewEventCount,
        reviewedMemoryRefs: input.memoryPollution.reviewedMemoryRefs.length,
        memoryPressureEvents: input.memoryPollution.memoryPressureEventCount,
        memoryHygieneActions: input.longTermRhythm.memoryHygieneActionCount,
        memoryHygieneTargets: input.longTermRhythm.memoryHygieneTargetRefs.length,
        memoryHygieneEvidenceRefs: input.longTermRhythm.memoryHygieneEvidenceRefs.length,
        acceptedWithoutEvidence: input.memoryHygiene.acceptedWithoutEvidenceRefs.length,
        acceptedWithoutReview: input.memoryPollution.acceptedWithoutContestOrReviewRefs.length,
        personaLikeMemory: input.memoryPollution.personaLikeMemoryRefs.length,
        acceptedPersonaLikeMemory: input.memoryPollution.acceptedPersonaLikeMemoryRefs.length,
        acceptedMemoryArchives: input.archiveEvidence.acceptedMemoryArchiveCount,
        acceptedMemoryArchiveEvidenceRefs: input.archiveEvidence.acceptedMemoryArchiveEvidenceRefs.length,
        acceptedMemoryArchivesWithoutEvidence: input.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs.length,
        contestEvidenceGaps: memoryContestEvidenceGapCount(
          input.memoryHygiene,
          input.memoryPollution,
          input.longTermRhythm,
          input.archiveEvidence,
        ),
      },
      evidenceRefs: uniqueStrings([
        ...input.memoryHygiene.proposedRefs,
        ...input.memoryHygiene.acceptedRefs,
        ...input.memoryHygiene.contestEventRefs,
        ...input.memoryHygiene.reviewEventRefs,
        ...input.memoryPollution.reviewedMemoryRefs,
        ...input.memoryPollution.memoryContestOrReviewEventRefs,
        ...input.memoryPollution.memoryPressureEventRefs,
        ...input.memoryPollution.acceptedWithoutContestOrReviewEventRefs,
        ...input.memoryPollution.personaLikeMemoryEventRefs,
        ...input.memoryPollution.acceptedPersonaLikeMemoryEventRefs,
        ...input.longTermRhythm.memoryHygieneActionRefs,
        ...input.longTermRhythm.memoryHygieneLedgerEventRefs,
        ...input.longTermRhythm.memoryHygieneMessageRefs,
        ...input.longTermRhythm.memoryHygieneTargetRefs,
        ...input.longTermRhythm.memoryHygieneEvidenceRefs,
        ...input.archiveEvidence.archiveEventRefs,
        ...input.archiveEvidence.ledgerEvidenceRefs,
        ...input.archiveEvidence.acceptedMemoryArchiveRefs,
        ...input.archiveEvidence.acceptedMemoryArchiveEvidenceRefs,
        ...input.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs,
      ]).slice(0, 40),
      gaps: findingGaps(input.findings, [
        "memory hygiene:",
        "memory pollution:",
        "archive evidence:",
        "long-term rhythm: no memory hygiene",
        "long-term rhythm: memory hygiene",
      ]),
    },
    {
      key: "agent_continuity",
      label: "Agent continuity evidence",
      ok: agentContinuityOk,
      metrics: {
        personaDeltas: input.personaEvidence.proposedDeltaRefs.length,
        acceptedPersonaDeltas: input.personaEvidence.acceptedDeltaRefs.length,
        roleClaims: input.personaEvidence.roleClaimRefs.length,
        acceptedRoleClaims: input.personaEvidence.acceptedRoleClaimRefs.length,
        dailyMoodRecords: input.personaEvidence.dailyMoodSourceRefs.length + input.personaEvidence.dailyMoodsWithoutSourceRef.length,
        acceptedDailyMoods: input.personaEvidence.acceptedDailyMoodDeltaRefs.length,
        continuityReviewActions: input.longTermRhythm.continuityReviewActionCount,
        continuityReviewTargets: input.longTermRhythm.continuityReviewTargetRefs.length,
        archivedContinuityItems: input.archiveContinuity.roleClaimCount + input.archiveContinuity.dailyMoodCount,
        acceptedArchivedContinuityItems:
          input.archiveContinuity.acceptedRoleClaimCount + input.archiveContinuity.acceptedDailyMoodCount,
        archiveContinuityEvidenceRefs: input.archiveContinuity.continuityEvidenceRefs.length,
        archiveContinuityResponseRefs: input.archiveContinuity.continuityResponseRefs.length,
        continuityEvidenceGaps: agentContinuityEvidenceGapCount(
          input.personaEvidence,
          input.archiveContinuity,
          input.longTermRhythm,
        ),
      },
      evidenceRefs: uniqueStrings([
        ...input.personaEvidence.proposedDeltaEventRefs,
        ...input.personaEvidence.acceptedDeltaResponseEventRefs,
        ...input.personaEvidence.roleClaimRefs,
        ...input.personaEvidence.roleClaimEvidenceRefs,
        ...input.personaEvidence.roleClaimResponseRefs,
        ...input.personaEvidence.dailyMoodSourceRefs,
        ...input.personaEvidence.dailyMoodEvidenceRefs,
        ...input.personaEvidence.dailyMoodResponseRefs,
        ...input.archiveContinuity.continuityArchiveRefs,
        ...input.archiveContinuity.roleClaimRefs,
        ...input.archiveContinuity.dailyMoodRefs,
        ...input.archiveContinuity.acceptedRoleClaimRefs,
        ...input.archiveContinuity.acceptedDailyMoodRefs,
        ...input.archiveContinuity.continuityEvidenceRefs,
        ...input.archiveContinuity.continuityResponseRefs,
        ...input.archiveContinuity.continuitySourceRefs,
        ...input.archiveContinuity.continuityEventRefs,
        ...input.longTermRhythm.continuityReviewActionRefs,
        ...input.longTermRhythm.continuityReviewMessageRefs,
        ...input.longTermRhythm.continuityReviewTargetRefs,
        ...input.longTermRhythm.continuityReviewEvidenceRefs,
      ]).slice(0, 40),
      gaps: findingGaps(input.findings, [
        "persona evidence:",
        "archive continuity:",
        "long-term rhythm: no autonomous continuity",
        "long-term rhythm: continuity review",
      ]),
    },
    {
      key: "evidence_sediment",
      label: "Ledger-backed sediment",
      ok: sedimentOk,
      metrics: {
        memoryProposals: input.memoryHygiene.proposedRefs.length,
        memoryContests: input.memoryHygiene.contestEventCount,
        personaLikeMemory: input.memoryPollution.personaLikeMemoryRefs.length,
        acceptedPersonaLikeMemory: input.memoryPollution.acceptedPersonaLikeMemoryRefs.length,
        acceptedWithoutReview: input.memoryPollution.acceptedWithoutContestOrReviewRefs.length,
        memoryReviewTraces: input.memoryPollution.memoryContestOrReviewEventRefs.length,
        memoryPressureEvents: input.memoryPollution.memoryPressureEventCount,
        personaDeltas: input.personaEvidence.proposedDeltaRefs.length,
        roleClaims: input.personaEvidence.roleClaimRefs.length,
        dailyMoodRecords: input.personaEvidence.dailyMoodSourceRefs.length + input.personaEvidence.dailyMoodsWithoutSourceRef.length,
        continuityEvidenceRefs: uniqueStrings([
          ...input.personaEvidence.roleClaimEvidenceRefs,
          ...input.personaEvidence.dailyMoodSourceRefs,
          ...input.personaEvidence.dailyMoodEvidenceRefs,
        ]).length,
        continuityResponseRefs: uniqueStrings([
          ...input.personaEvidence.acceptedDeltaResponseEventRefs,
          ...input.personaEvidence.roleClaimResponseRefs,
          ...input.personaEvidence.dailyMoodResponseRefs,
        ]).length,
        continuityEvidenceGaps: personaEvidenceGapCount(input.personaEvidence),
        acceptedMemoryArchives: input.archiveEvidence.acceptedMemoryArchiveCount,
        acceptedMemoryArchiveEvidenceRefs: input.archiveEvidence.acceptedMemoryArchiveEvidenceRefs.length,
        acceptedMemoryArchivesWithoutEvidence: input.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs.length,
        archivedContinuityItems: input.archiveContinuity.roleClaimCount + input.archiveContinuity.dailyMoodCount,
        archiveEvents: input.archiveEvidence.archiveEventRefs.length,
      },
      evidenceRefs: uniqueStrings([
        ...input.memoryHygiene.proposedRefs,
        ...input.memoryHygiene.contestEventRefs,
        ...input.memoryHygiene.reviewEventRefs,
        ...input.memoryPollution.memoryContestOrReviewEventRefs,
        ...input.personaEvidence.proposedDeltaEventRefs,
        ...input.personaEvidence.acceptedDeltaResponseEventRefs,
        ...input.personaEvidence.roleClaimEvidenceRefs,
        ...input.personaEvidence.roleClaimResponseRefs,
        ...input.personaEvidence.dailyMoodSourceRefs,
        ...input.personaEvidence.dailyMoodEvidenceRefs,
        ...input.personaEvidence.dailyMoodResponseRefs,
        ...input.archiveContinuity.continuityArchiveRefs,
        ...input.archiveContinuity.continuityEvidenceRefs,
        ...input.archiveContinuity.continuityResponseRefs,
        ...input.archiveEvidence.archiveEventRefs,
        ...input.archiveEvidence.ledgerEvidenceRefs,
        ...input.archiveEvidence.acceptedMemoryArchiveRefs,
        ...input.archiveEvidence.acceptedMemoryArchiveEvidenceRefs,
        ...input.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs,
      ]).slice(0, 40),
      gaps: findingGaps(input.findings, [
        "memory hygiene:",
        "memory pollution:",
        "persona evidence:",
        "archive continuity:",
        "archive evidence:",
      ]),
    },
    {
      key: "provider_boundary",
      label: "Provider boundary evidence",
      ok: input.providerBoundary.ok,
      metrics: {
        degradations: input.providerBoundary.degradationCount,
        boundaryRefs: input.providerBoundary.boundaryRefs.length,
        choicePressureRefs: input.providerBoundary.choicePressureRefCount,
        requiredChoicePressureKinds: input.providerBoundary.choicePressureRequiredKinds,
        coveredChoicePressureKinds: input.providerBoundary.choicePressureCoveredKinds,
        missingChoicePressureKinds: input.providerBoundary.choicePressureMissingKinds.join(",") || "none",
        choicePressureCoverageGaps: input.providerBoundary.choicePressureCoverageGapCount,
        repairPressureRefs: input.providerBoundary.choicePressureRepairRequestRefs.length,
        retryPressureRefs: input.providerBoundary.choicePressureRetryProtocolRefs.length,
        silencePressureRefs: input.providerBoundary.choicePressureSilenceRefs.length,
        contestedMemoryPressureRefs: input.providerBoundary.choicePressureContestedMemoryRefs.length,
        archiveCarryoverPressureRefs: input.providerBoundary.choicePressureArchiveCarryoverRefs.length,
        carriedAcrossArchives: input.providerBoundary.carriedAcrossArchives,
        secretLikeDiagnostics: input.providerBoundary.secretLikeDiagnosticRefs.length,
      },
      evidenceRefs: uniqueStrings([
        ...input.providerBoundary.degradationRefs,
        ...input.providerBoundary.boundaryRefs,
        ...input.providerBoundary.retirementRefs,
        ...input.providerBoundary.secretLikeDiagnosticRefs,
        ...input.providerBoundary.choicePressureRepairRequestRefs,
        ...input.providerBoundary.choicePressureRetryProtocolRefs,
        ...input.providerBoundary.choicePressureSilenceRefs,
        ...input.providerBoundary.choicePressureContestedMemoryRefs,
        ...input.providerBoundary.choicePressureArchiveCarryoverRefs,
      ]).slice(0, 32),
      gaps: findingGaps(input.findings, ["provider boundary:"]),
    },
    {
      key: "action_boundary",
      label: "Action boundary evidence",
      ok: input.actionBoundary.ok,
      metrics: {
        sideEffectRequests: input.actionBoundary.sideEffectRequestRefs.length,
        sideEffectReviews: input.actionBoundary.sideEffectReviewRefs.length,
        sideEffectApprovals: input.actionBoundary.sideEffectApprovalRefs.length,
        sideEffectDenials: input.actionBoundary.sideEffectDeniedRefs.length,
        sideEffectExpiries: input.actionBoundary.sideEffectExpiredRefs.length,
        sideEffectResults: input.actionBoundary.sideEffectResultRefs.length,
        unapprovedResults: input.actionBoundary.unapprovedSideEffectResultRefs.length,
        capabilityInvocations: input.actionBoundary.capabilityInvocationRefs.length,
        capabilityResults: input.actionBoundary.capabilityResultRefs.length,
        workspaceArtifacts: input.actionBoundary.workspaceArtifactRefs.length,
        workspaceReviews: input.actionBoundary.workspaceArtifactReviewRefs.length,
        skillCapsuleReviews: input.actionBoundary.skillCapsuleReviewRefs.length,
        capabilityReviews: input.actionBoundary.capabilityReviewRefs.length,
        contextBoundaryRefs: input.actionBoundary.contextBoundaryRefs.length,
        actionBoundaryGaps: actionBoundaryEvidenceGapCount(input.actionBoundary),
      },
      evidenceRefs: uniqueStrings([
        ...input.actionBoundary.sideEffectRequestRefs,
        ...input.actionBoundary.sideEffectReviewRefs,
        ...input.actionBoundary.sideEffectApprovalRefs,
        ...input.actionBoundary.sideEffectDeniedRefs,
        ...input.actionBoundary.sideEffectExpiredRefs,
        ...input.actionBoundary.sideEffectResultRefs,
        ...input.actionBoundary.unapprovedSideEffectResultRefs,
        ...input.actionBoundary.capabilityInvocationRefs,
        ...input.actionBoundary.capabilityResultRefs,
        ...input.actionBoundary.workspaceArtifactRefs,
        ...input.actionBoundary.workspaceArtifactReviewRefs,
        ...input.actionBoundary.skillCapsuleReviewRefs,
        ...input.actionBoundary.capabilityReviewRefs,
        ...input.actionBoundary.contextBoundaryRefs,
      ]).slice(0, 40),
      gaps: findingGaps(input.findings, ["action boundary:"]),
    },
    {
      key: "context_visibility",
      label: "Co-visible context",
      ok: input.contextVisibility.ok && input.contextVisibility.hasSocialLineageContext,
      metrics: {
        auditCount: input.contextVisibility.auditCount,
        coVisibleAuditCount: input.contextVisibility.coVisibleAuditCount,
        coVisibleDomains: coVisibleContextDomainCount(input.contextVisibility),
        coVisibleContextRefs: input.contextVisibility.coVisibleContextRefCount,
        socialLineageRefs: input.contextVisibility.socialLineageRefs.length,
        criticalFragmentGaps: input.contextVisibility.criticalFragmentsWithoutRefs.length,
      },
      evidenceRefs: uniqueStrings([
        ...input.contextVisibility.coVisibleAuditPacketIds,
        ...input.contextVisibility.coVisibleArchiveRefs,
        ...input.contextVisibility.coVisibleMemoryRefs,
        ...input.contextVisibility.coVisiblePersonaRefs,
        ...input.contextVisibility.coVisibleProviderBoundaryRefs,
        ...input.contextVisibility.coVisibleSocialLineageRefs,
        ...input.contextVisibility.socialLineageRefs,
      ]).slice(0, 40),
      gaps: findingGaps(input.findings, ["context visibility:"]),
    },
  ];
  const evidenceRefs = uniqueStrings(domains.flatMap((domain) => domain.evidenceRefs)).slice(0, 96);

  return {
    status: input.pass ? "pass" : "fail",
    checkedAt: input.checkedAt,
    passedDomainCount: domains.filter((domain) => domain.ok).length,
    failedDomainCount: domains.filter((domain) => !domain.ok).length,
    evidenceRefCount: evidenceRefs.length,
    evidenceRefs,
    domains,
  };
}

function findingGaps(findings: readonly string[], prefixes: readonly string[]): string[] {
  return findings.filter((finding) => prefixes.some((prefix) => finding.startsWith(prefix)));
}

function coVisibleContextDomainCount(summary: LongRunHarnessReport["contextVisibility"]): number {
  return [
    summary.coVisibleArchiveRefs.length > 0,
    summary.coVisibleMemoryRefs.length > 0,
    summary.coVisiblePersonaRefs.length > 0,
    summary.coVisibleProviderBoundaryRefs.length > 0,
    summary.coVisibleSocialLineageRefs.length > 0,
  ].filter(Boolean).length;
}

function longTermRhythmChoiceSetGapCount(summary: LongRunHarnessReport["longTermRhythm"]): number {
  return (
    summary.choiceSetOptionsWithoutEvidenceRefs.length +
    summary.choiceSetTargetedOptionsWithoutTargetRefs.length +
    summary.actionsMissingChoiceSetRefs.length +
    summary.actionsMissingSelectedChoiceRefs.length +
    summary.actionsMissingEvidenceRefs.length
  );
}

function silenceReentryEvidenceGapCount(
  configuredSilenceReentryMs: number,
  summary: LongRunHarnessReport["longTermRhythm"],
): number {
  return [
    configuredSilenceReentryMs < 0,
    summary.silenceReentryActionRefs.length === 0,
    summary.silenceReentryMessageRefs.length === 0,
    summary.silenceReentryAnchorRefs.length === 0 || summary.silenceReentryActionsMissingAnchorRefs.length > 0,
    summary.silenceReentryArchiveRefs.length === 0,
    summary.silenceReentryEvidenceRefs.length === 0,
    summary.preservedSilenceActionRefs.length === 0,
    summary.silenceReentryPreservedSilenceRefs.length === 0 ||
      summary.silenceReentryActionsMissingPreservedSilenceRefs.length > 0,
    summary.deliberateSilenceIntentionRefs.length === 0,
  ].filter(Boolean).length;
}

function personaEvidenceGapCount(summary: LongRunHarnessReport["personaEvidence"]): number {
  return (
    summary.proposedDeltasWithoutEvidenceRefs.length +
    summary.acceptedDeltasWithoutResponseEvidenceRefs.length +
    summary.roleClaimsWithoutEvidenceRefs.length +
    summary.roleClaimsWithoutResponseRefs.length +
    summary.acceptedRoleClaimsWithoutAcceptedDelta.length +
    summary.dailyMoodsWithoutSourceRef.length +
    summary.dailyMoodsWithoutEvidenceRefs.length +
    summary.dailyMoodsWithoutResponseRefs.length +
    summary.dailyMoodsWithoutAcceptedDelta.length
  );
}

function memoryContestEvidenceGapCount(
  memoryHygiene: LongRunHarnessReport["memoryHygiene"],
  memoryPollution: LongRunHarnessReport["memoryPollution"],
  longTermRhythm: LongRunHarnessReport["longTermRhythm"],
  archiveEvidence: LongRunHarnessReport["archiveEvidence"],
): number {
  return (
    memoryHygiene.proposedWithoutSourceRefs.length +
    memoryHygiene.acceptedWithoutEvidenceRefs.length +
    (memoryHygiene.acceptedRefs.length === 0 ? 1 : 0) +
    (memoryHygiene.contestEventRefs.length === 0 ? 1 : 0) +
    memoryPollution.acceptedWithoutContestOrReviewRefs.length +
    memoryPollution.personaLikeMemoryRefs.length +
    memoryPollution.acceptedPersonaLikeMemoryRefs.length +
    longTermRhythm.memoryHygieneActionsMissingTargetRefs.length +
    (longTermRhythm.memoryHygieneActionRefs.length === 0 ? 1 : 0) +
    (longTermRhythm.memoryHygieneLedgerEventRefs.length === 0 ? 1 : 0) +
    (archiveEvidence.archiveEventRefs.length === 0 ? 1 : 0) +
    (archiveEvidence.acceptedMemoryArchiveCount === 0 ? 1 : 0) +
    (archiveEvidence.acceptedMemoryArchiveEvidenceRefs.length === 0 ? 1 : 0) +
    archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs.length +
    archiveEvidence.archivesWithoutLedgerRange.length +
    archiveEvidence.archivesWithoutEventCounts.length +
    archiveEvidence.archivesWithoutLedgerEvidenceRefs.length
  );
}

function archiveRhythmEvidenceGapCount(
  archiveEvidence: LongRunHarnessReport["archiveEvidence"],
  archiveContinuity: LongRunHarnessReport["archiveContinuity"],
  longTermRhythm: LongRunHarnessReport["longTermRhythm"],
): number {
  return (
    (archiveEvidence.archiveEventRefs.length === 0 ? 1 : 0) +
    (archiveEvidence.acceptedMemoryArchiveCount === 0 ? 1 : 0) +
    archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs.length +
    archiveEvidence.archivesWithoutLedgerRange.length +
    archiveEvidence.archivesWithoutEventCounts.length +
    archiveEvidence.archivesWithoutLedgerEvidenceRefs.length +
    (archiveContinuity.archivesWithContinuity === 0 ? 1 : 0) +
    (archiveContinuity.acceptedRoleClaimCount === 0 ? 1 : 0) +
    (archiveContinuity.acceptedDailyMoodCount === 0 ? 1 : 0) +
    archiveContinuity.continuityItemsWithoutEvidenceRefs.length +
    (longTermRhythm.archiveActionRefs.length === 0 ? 1 : 0) +
    (longTermRhythm.archiveActionMessageRefs.length === 0 ? 1 : 0) +
    (longTermRhythm.archiveActionArchiveRefs.length === 0 ? 1 : 0) +
    (longTermRhythm.archiveActionReviewRequestRefs.length === 0 ? 1 : 0) +
    (longTermRhythm.archiveActionEvidenceRefs.length === 0 ? 1 : 0) +
    longTermRhythm.archiveActionsMissingMaterialRefs.length +
    (longTermRhythm.archiveReviewLedgerEventRefs.length === 0 ? 1 : 0)
  );
}

function agentContinuityEvidenceGapCount(
  personaEvidence: LongRunHarnessReport["personaEvidence"],
  archiveContinuity: LongRunHarnessReport["archiveContinuity"],
  longTermRhythm: LongRunHarnessReport["longTermRhythm"],
): number {
  return (
    personaEvidenceGapCount(personaEvidence) +
    (archiveContinuity.archiveCount === 0 ? 1 : 0) +
    (archiveContinuity.archivesWithContinuity === 0 ? 1 : 0) +
    (archiveContinuity.roleClaimCount === 0 ? 1 : 0) +
    (archiveContinuity.dailyMoodCount === 0 ? 1 : 0) +
    (archiveContinuity.acceptedRoleClaimCount === 0 ? 1 : 0) +
    (archiveContinuity.acceptedDailyMoodCount === 0 ? 1 : 0) +
    archiveContinuity.continuityItemsWithoutEvidenceRefs.length +
    longTermRhythm.continuityReviewActionsMissingTargetRefs.length +
    (longTermRhythm.continuityReviewActionRefs.length === 0 ? 1 : 0)
  );
}

function summarizeDurationCompliance(
  startedAt: string,
  finishedAt: string,
  requestedDurationMs: number,
): LongRunHarnessReport["durationCompliance"] {
  const observedDurationMs = Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));
  const requestedWithinWindow = requestedDurationMs >= LONG_RUN_MIN_MS && requestedDurationMs <= LONG_RUN_MAX_MS;
  const observedAtLeastMin = observedDurationMs >= LONG_RUN_MIN_MS;
  return {
    requiredMinMs: LONG_RUN_MIN_MS,
    requiredMaxMs: LONG_RUN_MAX_MS,
    requestedDurationMs,
    observedDurationMs,
    requestedWithinWindow,
    observedAtLeastMin,
    ok: requestedWithinWindow && observedAtLeastMin,
  };
}

function summarizeSchedulerContinuity(
  samples: readonly LongRunSchedulerContinuitySample[],
  events: readonly RoomEvent[],
  requestedDurationMs: number,
  tickIntervalMs: number,
): LongRunHarnessReport["schedulerContinuity"] {
  const tickEventByTickId = new Map<string, string>();
  for (const event of events) {
    if (event.event_type !== "room.autonomy_tick") continue;
    const payload = objectPayload(event.payload);
    const tickId = stringValue(payload.tickId) ?? stringValue(payload.tick_id) ?? event.event_id;
    tickEventByTickId.set(tickId, event.event_id);
  }

  const normalizedSamples = samples.map((sample) => {
    const tickEventRef = sample.tickId ? tickEventByTickId.get(sample.tickId) : undefined;
    return { ...sample, tickEventRef };
  });
  const tickRefs = uniqueStrings(normalizedSamples.flatMap((sample) => sample.tickId ? [sample.tickId] : []));
  const tickEventRefs = uniqueStrings(normalizedSamples.flatMap((sample) => sample.tickEventRef ? [sample.tickEventRef] : []));
  const actionCounts: Record<string, number> = {};
  for (const sample of normalizedSamples) {
    const action = sample.action ?? "missing";
    actionCounts[action] = (actionCounts[action] ?? 0) + 1;
  }

  const driftBudgetMs = Math.max(tickIntervalMs * 4, 10_000);
  const overrunBudgetMs = Math.max(tickIntervalMs * 4, 10_000);
  const scheduleDrifts = normalizedSamples.flatMap((sample) =>
    sample.scheduleDriftMs === undefined ? [] : [sample.scheduleDriftMs],
  );
  const durations = normalizedSamples.map((sample) => sample.durationMs);
  const overruns = normalizedSamples.map((sample) => sample.overrunByMs);
  const samplesMissingTickRefs = normalizedSamples
    .filter((sample) => !sample.tickId)
    .map((sample) => sample.sampleId);
  const samplesMissingTickEventRefs = normalizedSamples
    .filter((sample) => sample.tickId && !sample.tickEventRef)
    .map((sample) => sample.tickId ?? sample.sampleId);
  const samplesExceedingDriftBudget = normalizedSamples
    .filter((sample) => (sample.scheduleDriftMs ?? 0) > driftBudgetMs)
    .map((sample) => sample.tickId ?? sample.sampleId);
  const samplesExceedingOverrunBudget = normalizedSamples
    .filter((sample) => sample.overrunByMs > overrunBudgetMs)
    .map((sample) => sample.tickId ?? sample.sampleId);

  return {
    intervalMs: tickIntervalMs,
    sampleCount: normalizedSamples.length,
    expectedTickCount: Math.max(1, Math.ceil(requestedDurationMs / tickIntervalMs)),
    completedSampleCount: normalizedSamples.filter((sample) => sample.status !== undefined).length,
    tickRefs,
    tickEventRefs,
    actionCounts,
    maxScheduleDriftMs: maxNumber(scheduleDrifts),
    maxDurationMs: maxNumber(durations),
    maxOverrunByMs: maxNumber(overruns),
    driftBudgetMs,
    overrunBudgetMs,
    overdueTickCount: normalizedSamples.filter((sample) => (sample.scheduleDriftMs ?? 0) > 0).length,
    overrunTickCount: normalizedSamples.filter((sample) => sample.overrunByMs > 0).length,
    samplesMissingTickRefs: uniqueStrings(samplesMissingTickRefs),
    samplesMissingTickEventRefs: uniqueStrings(samplesMissingTickEventRefs),
    samplesExceedingDriftBudget: uniqueStrings(samplesExceedingDriftBudget),
    samplesExceedingOverrunBudget: uniqueStrings(samplesExceedingOverrunBudget),
    samples: normalizedSamples.slice(0, 240),
    ok:
      normalizedSamples.length > 0 &&
      samplesMissingTickRefs.length === 0 &&
      samplesMissingTickEventRefs.length === 0 &&
      samplesExceedingDriftBudget.length === 0 &&
      samplesExceedingOverrunBudget.length === 0,
  };
}

function summarizeAgentExpression(events: readonly RoomEvent[]): LongRunHarnessReport["agentExpression"] {
  const byAgent = new Map<string, LongRunHarnessReport["agentExpression"][number]>();
  for (const event of events) {
    const payload = objectPayload(event.payload);
    const agentId =
      stringValue(payload.agentId) ??
      stringValue(payload.agent_id) ??
      (event.actor.kind === "agent" ? event.actor.id : undefined);
    if (!agentId) continue;
    const summary =
      byAgent.get(agentId) ??
      {
        agentId,
        messageCount: 0,
        messageRefs: [],
        intentionCount: 0,
        silenceCount: 0,
        providerDegradationCount: 0,
      };
    if (event.event_type === "message.created") {
      const authorKind = stringValue(payload.authorKind) ?? stringValue(payload.author_kind) ?? event.actor.kind;
      if (authorKind === "agent") {
        summary.messageCount += 1;
        summary.messageRefs.push(event.event_id);
      }
    }
    if (event.event_type === "agent.intention_recorded") {
      summary.intentionCount += 1;
      if (objectPayload(payload.intention).kind === "stay_silent") summary.silenceCount += 1;
    }
    if (event.event_type === "agent.provider_degraded") {
      summary.providerDegradationCount += 1;
    }
    byAgent.set(agentId, summary);
  }
  return [...byAgent.values()].sort((left, right) => right.messageCount - left.messageCount || left.agentId.localeCompare(right.agentId));
}

function summarizeMonopoly(
  agentExpression: LongRunHarnessReport["agentExpression"],
  events: readonly RoomEvent[],
  contextAudits: RuntimeRoomState["contextAudits"],
): LongRunHarnessReport["monopoly"] {
  const totalAgentMessages = agentExpression.reduce((sum, agent) => sum + agent.messageCount, 0);
  const speakerMessageRefs = Object.fromEntries(
    agentExpression
      .filter((agent) => agent.messageRefs.length > 0)
      .map((agent) => [agent.agentId, uniqueStrings(agent.messageRefs)]),
  );
  const totalAgentMessageRefs = uniqueStrings(Object.values(speakerMessageRefs).flat());
  const activeSpeakerCount = Object.keys(speakerMessageRefs).length;
  const max = agentExpression.reduce<(typeof agentExpression)[number] | undefined>(
    (current, agent) => (current === undefined || agent.messageCount > current.messageCount ? agent : current),
    undefined,
  );
  const minimumActiveSpeakers = 2;
  const maxSpeakerShareThreshold = 0.65;
  const maxSpeakerShare = totalAgentMessages > 0 && max ? max.messageCount / totalAgentMessages : 0;
  const speakerBalanceGapCount = [
    totalAgentMessages === 0,
    totalAgentMessages > 0 && activeSpeakerCount < minimumActiveSpeakers,
    maxSpeakerShare > maxSpeakerShareThreshold,
  ].filter(Boolean).length;
  const deferredSpeech = summarizeDeferredSpeechRecovery(events, contextAudits);
  return {
    totalAgentMessages,
    totalAgentMessageRefs,
    activeSpeakerCount,
    minimumActiveSpeakers,
    maxSpeaker: max?.agentId,
    maxSpeakerShare,
    maxSpeakerShareThreshold,
    maxSpeakerMessageRefs: max ? uniqueStrings(max.messageRefs) : [],
    speakerMessageRefs,
    speakerBalanceGapCount,
    ...deferredSpeech,
    ok: speakerBalanceGapCount === 0 && deferredSpeech.speakerBudgetRecoveryGapCount === 0,
  };
}

function summarizeDeferredSpeechRecovery(
  events: readonly RoomEvent[],
  contextAudits: RuntimeRoomState["contextAudits"],
): Pick<
  LongRunHarnessReport["monopoly"],
  | "deferredSpeechEventRefs"
  | "deferredSpeechIntentionRefs"
  | "deferredRecoveryContextRefs"
  | "deferredSpeechWithoutRecoveryRefs"
  | "speakerBudgetRecoveryGapCount"
> {
  const deferredSpeechEventRefs: string[] = [];
  const deferredSpeechIntentionRefs: string[] = [];
  const deferredRecoveryContextRefs: string[] = [];
  const deferredSpeechWithoutRecoveryRefs: string[] = [];
  const deferredFragments = contextAudits.flatMap((audit) =>
    (audit.selectedFragments ?? []).filter((fragment) => fragment.type === "deferred_intention"),
  );

  for (const event of events) {
    if (event.event_type !== "agent.intention_deferred") continue;
    const payload = objectPayload(event.payload);
    const originalKind =
      stringValue(payload.originalIntentionKind) ?? stringValue(payload.original_intention_kind) ?? "unknown";
    if (originalKind !== "speak") continue;
    const intentionRef = stringValue(payload.intentionEventId) ?? stringValue(payload.intention_event_id);
    deferredSpeechEventRefs.push(event.event_id);
    if (intentionRef) {
      deferredSpeechIntentionRefs.push(intentionRef);
    }
    const matchingFragments = deferredFragments.filter((fragment) => {
      const refs = fragment.refs ?? [];
      return refs.includes(event.event_id) && (intentionRef === undefined || refs.includes(intentionRef));
    });
    const matchingInvitationRecoveryRefs = events.flatMap((candidate) =>
      invitationDeferredRecoveryRefs(candidate, event.event_id, intentionRef),
    );
    const recoveredRefs = uniqueStrings([
      ...matchingFragments.flatMap((fragment) => fragment.refs ?? []),
      ...matchingInvitationRecoveryRefs,
    ]);
    deferredRecoveryContextRefs.push(...recoveredRefs);
    if (intentionRef === undefined || recoveredRefs.length === 0) {
      deferredSpeechWithoutRecoveryRefs.push(intentionRef ? `${event.event_id}:${intentionRef}` : event.event_id);
    }
  }

  const uniqueGapRefs = uniqueStrings(deferredSpeechWithoutRecoveryRefs);
  return {
    deferredSpeechEventRefs: uniqueStrings(deferredSpeechEventRefs),
    deferredSpeechIntentionRefs: uniqueStrings(deferredSpeechIntentionRefs),
    deferredRecoveryContextRefs: uniqueStrings(deferredRecoveryContextRefs),
    deferredSpeechWithoutRecoveryRefs: uniqueGapRefs,
    speakerBudgetRecoveryGapCount: uniqueGapRefs.length,
  };
}

function invitationDeferredRecoveryRefs(event: RoomEvent, deferredEventRef: string, intentionRef: string | undefined): string[] {
  if (event.event_type !== "agent.invited") return [];
  const payload = objectPayload(event.payload);
  const recoveryRefs = arrayOfStrings(payload.recoveryRefs).concat(arrayOfStrings(payload.recovery_refs));
  const contextRefs = arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs), event.refs);
  const availableRefs = uniqueStrings([...recoveryRefs, ...contextRefs]);
  if (!availableRefs.includes(deferredEventRef) || (intentionRef !== undefined && !availableRefs.includes(intentionRef))) {
    return [];
  }
  return intentionRef ? [intentionRef, deferredEventRef] : [deferredEventRef];
}

const AUTONOMY_RHYTHM_BALANCE_ACTIONS = new Set([
  "memory_hygiene_review",
  "continuity_review",
  "provider_boundary_review",
  "open_question_revisit",
  "handoff_review",
  "invitation_review",
]);
const AUTONOMY_RHYTHM_BALANCE_MIN_SAMPLES = 4;
const AUTONOMY_RHYTHM_BALANCE_MIN_DISTINCT_ACTIONS = 3;
const AUTONOMY_RHYTHM_BALANCE_MONOPOLY_THRESHOLD = 0.6;

function summarizeAutonomyRhythmBalance(events: readonly RoomEvent[]): LongRunHarnessReport["autonomyRhythmBalance"] {
  const actionRefsByKind: Record<string, string[]> = {};
  const actionCounts: Record<string, number> = {};
  const consideredActionRefs: string[] = [];

  for (const event of events) {
    if (event.event_type !== "room.autonomy_tick") continue;
    const action = stringValue(objectPayload(event.payload).action);
    if (!action || !AUTONOMY_RHYTHM_BALANCE_ACTIONS.has(action)) continue;
    consideredActionRefs.push(event.event_id);
    actionCounts[action] = (actionCounts[action] ?? 0) + 1;
    actionRefsByKind[action] = [...(actionRefsByKind[action] ?? []), event.event_id];
  }

  const sortedActions = Object.entries(actionCounts).sort(
    ([leftAction, leftCount], [rightAction, rightCount]) => rightCount - leftCount || leftAction.localeCompare(rightAction),
  );
  const [dominantAction, dominantCount = 0] = sortedActions[0] ?? [];
  const consideredActionCount = consideredActionRefs.length;
  const dominantActionShare = consideredActionCount > 0 ? dominantCount / consideredActionCount : 0;
  const distinctActionCount = Object.keys(actionCounts).length;
  const enoughSamples = consideredActionCount >= AUTONOMY_RHYTHM_BALANCE_MIN_SAMPLES;

  return {
    consideredActionCount,
    consideredActionRefs: uniqueStrings(consideredActionRefs),
    actionCounts,
    actionRefsByKind: Object.fromEntries(
      Object.entries(actionRefsByKind).map(([action, refs]) => [action, uniqueStrings(refs)]),
    ),
    distinctActionCount,
    dominantAction,
    dominantActionShare,
    dominantActionRefs: dominantAction ? uniqueStrings(actionRefsByKind[dominantAction] ?? []) : [],
    minimumDistinctActions: AUTONOMY_RHYTHM_BALANCE_MIN_DISTINCT_ACTIONS,
    monopolyThreshold: AUTONOMY_RHYTHM_BALANCE_MONOPOLY_THRESHOLD,
    enoughSamples,
    ok:
      !enoughSamples ||
      (distinctActionCount >= AUTONOMY_RHYTHM_BALANCE_MIN_DISTINCT_ACTIONS &&
        dominantActionShare <= AUTONOMY_RHYTHM_BALANCE_MONOPOLY_THRESHOLD),
  };
}

function summarizeMemoryHygiene(events: readonly RoomEvent[]): LongRunHarnessReport["memoryHygiene"] {
  const proposedRefs: string[] = [];
  const proposedWithoutSourceRefs: string[] = [];
  const acceptedRefs: string[] = [];
  const acceptedWithoutEvidenceRefs: string[] = [];
  let contestedCount = 0;
  let contestEventCount = 0;
  const contestEventRefs: string[] = [];
  let reviewEventCount = 0;
  const reviewEventRefs: string[] = [];
  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "memory.proposed") {
      proposedRefs.push(event.event_id);
      const refs = arrayOfStrings(payload.sourceRefs).concat(arrayOfStrings(payload.source_refs));
      if (refs.length === 0) {
        proposedWithoutSourceRefs.push(stringValue(payload.memoryId) ?? stringValue(payload.memory_id) ?? event.event_id);
      }
    }
    if (event.event_type === "memory.accepted") {
      acceptedRefs.push(event.event_id);
      const refs = arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs), event.refs);
      if (refs.length < 2) {
        acceptedWithoutEvidenceRefs.push(stringValue(payload.memoryId) ?? stringValue(payload.memory_id) ?? event.event_id);
      }
    }
    if (event.event_type === "memory.contested" || event.event_type === "memory.reviewed") {
      contestedCount += 1;
    }
    if (event.event_type === "memory.contested") {
      contestEventCount += 1;
      contestEventRefs.push(event.event_id);
    }
    if (event.event_type === "memory.reviewed") {
      reviewEventCount += 1;
      reviewEventRefs.push(event.event_id);
    }
  }
  return {
    proposedRefs: uniqueStrings(proposedRefs),
    proposedWithoutSourceRefs,
    acceptedRefs: uniqueStrings(acceptedRefs),
    acceptedWithoutEvidenceRefs,
    contestedCount,
    contestEventCount,
    contestEventRefs: uniqueStrings(contestEventRefs),
    reviewEventCount,
    reviewEventRefs: uniqueStrings(reviewEventRefs),
    ok:
      proposedWithoutSourceRefs.length === 0 &&
      acceptedWithoutEvidenceRefs.length === 0 &&
      acceptedRefs.length > 0 &&
      contestEventRefs.length > 0,
  };
}

function summarizeMemoryPollution(events: readonly RoomEvent[]): LongRunHarnessReport["memoryPollution"] {
  const personaLikeMemoryRefs: string[] = [];
  const personaLikeMemoryEventRefs: string[] = [];
  const acceptedPersonaLikeMemoryRefs: string[] = [];
  const acceptedPersonaLikeMemoryEventRefs: string[] = [];
  const acceptedWithoutContestOrReviewRefs: string[] = [];
  const acceptedWithoutContestOrReviewEventRefs: string[] = [];
  const reviewedMemoryRefs = new Set<string>();
  const reviewOrContestEventIndexesByMemoryRef = new Map<string, number[]>();
  const memoryContestOrReviewEventRefs: string[] = [];
  const memoryPressureEventRefs: string[] = [];

  for (const [index, event] of events.entries()) {
    const payload = objectPayload(event.payload);
    const memoryRef = memoryRefFromPayload(payload, event.event_id);
    if (event.event_type === "memory.contested" || event.event_type === "memory.reviewed") {
      reviewedMemoryRefs.add(memoryRef);
      reviewOrContestEventIndexesByMemoryRef.set(memoryRef, [
        ...(reviewOrContestEventIndexesByMemoryRef.get(memoryRef) ?? []),
        index,
      ]);
      memoryContestOrReviewEventRefs.push(event.event_id);
    }
    if (event.event_type === "room.memory_pressure_detected") {
      memoryPressureEventRefs.push(event.event_id);
    }
  }

  for (const [index, event] of events.entries()) {
    const payload = objectPayload(event.payload);
    if (!event.event_type.startsWith("memory.")) continue;
    const memoryRef = memoryRefFromPayload(payload, event.event_id);
    const text = [
      stringValue(payload.summary),
      stringValue(payload.reason),
      stringValue(payload.claim),
      stringValue(payload.content),
      stringValue(payload.kind),
    ]
      .filter(Boolean)
      .join(" ");
    const personaLike = isPersonaLikeMemoryText(text);
    if (personaLike && event.event_type === "memory.proposed") {
      personaLikeMemoryRefs.push(memoryRef);
      personaLikeMemoryEventRefs.push(event.event_id);
    }
    if (personaLike && event.event_type === "memory.accepted") {
      acceptedPersonaLikeMemoryRefs.push(memoryRef);
      acceptedPersonaLikeMemoryEventRefs.push(event.event_id);
    }
    const priorReviewOrContest = (reviewOrContestEventIndexesByMemoryRef.get(memoryRef) ?? []).some(
      (reviewIndex) => reviewIndex < index,
    );
    if (event.event_type === "memory.accepted" && !priorReviewOrContest) {
      acceptedWithoutContestOrReviewRefs.push(memoryRef);
      acceptedWithoutContestOrReviewEventRefs.push(event.event_id);
    }
  }

  return {
    personaLikeMemoryRefs: uniqueStrings(personaLikeMemoryRefs),
    personaLikeMemoryEventRefs: uniqueStrings(personaLikeMemoryEventRefs),
    acceptedPersonaLikeMemoryRefs: uniqueStrings(acceptedPersonaLikeMemoryRefs),
    acceptedPersonaLikeMemoryEventRefs: uniqueStrings(acceptedPersonaLikeMemoryEventRefs),
    acceptedWithoutContestOrReviewRefs: uniqueStrings(acceptedWithoutContestOrReviewRefs),
    acceptedWithoutContestOrReviewEventRefs: uniqueStrings(acceptedWithoutContestOrReviewEventRefs),
    reviewedMemoryRefs: uniqueStrings(Array.from(reviewedMemoryRefs)),
    memoryContestOrReviewEventRefs: uniqueStrings(memoryContestOrReviewEventRefs),
    memoryPressureEventCount: memoryPressureEventRefs.length,
    memoryPressureEventRefs: uniqueStrings(memoryPressureEventRefs),
    ok:
      personaLikeMemoryRefs.length === 0 &&
      acceptedPersonaLikeMemoryRefs.length === 0 &&
      acceptedWithoutContestOrReviewRefs.length === 0,
  };
}

function summarizeAutonomousSocialLoop(events: readonly RoomEvent[]): LongRunHarnessReport["autonomousSocialLoop"] {
  const roomRhythmMessageIds = new Set<string>();
  for (const event of events) {
    if (event.event_type !== "message.created") continue;
    const payload = objectPayload(event.payload);
    const author = stringValue(payload.author) ?? event.actor.id;
    if (author === "room_rhythm") {
      roomRhythmMessageIds.add(event.event_id);
    }
  }

  const roomEventPressureByMessageRef = autonomousRoomEventPressureByMessageRef(events);
  const autonomousStimulusMessageIds = new Set<string>(roomRhythmMessageIds);
  for (const messageRef of roomEventPressureByMessageRef.keys()) {
    autonomousStimulusMessageIds.add(messageRef);
  }
  const intentionEventIdsAfterRoomRhythm = new Set<string>();
  const intentionRhythmRefsByEventId = new Map<string, string[]>();
  const intentionKindsAfterRoomRhythm: Record<string, number> = {};
  const invitationRefs: string[] = [];
  const invitationRoomRhythmRefs: string[] = [];
  const questionRefs: string[] = [];
  const questionRoomRhythmRefs: string[] = [];
  const reviewRefs: string[] = [];
  const reviewRoomRhythmRefs: string[] = [];
  const handoffRefs: string[] = [];
  const handoffRoomRhythmRefs: string[] = [];
  const silenceRefs: string[] = [];
  const silenceRoomRhythmRefs: string[] = [];
  const roomEventPressureRefs: string[] = [];
  const roomEventPressureKinds: Record<string, number> = {};
  const choicesAfterUserSilenceRefs: string[] = [];
  const choicesInterruptedByUserRefs: string[] = [];
  const interruptingUserMessageRefs: string[] = [];
  const choiceSilenceWindows: LongRunHarnessReport["autonomousSocialLoop"]["choiceSilenceWindows"] = [];
  const choicesWithoutRoomRhythmRefs: string[] = [];
  const choicesWithoutRoomEventPressureRefs: string[] = [];
  let invitationCount = 0;
  let questionCount = 0;
  let reviewCount = 0;
  let handoffCount = 0;
  let deliberateSilenceCount = 0;

  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "agent.intention_recorded") {
      const triggeringEventId = stringValue(payload.triggeringEventId) ?? stringValue(payload.triggering_event_id);
      const triggeredByRoomRhythm =
        (triggeringEventId !== undefined && autonomousStimulusMessageIds.has(triggeringEventId)) ||
        event.refs.some((ref) => autonomousStimulusMessageIds.has(ref));
      if (!triggeredByRoomRhythm) continue;
      intentionEventIdsAfterRoomRhythm.add(event.event_id);
      const rhythmRefs = roomRhythmRefsForEvent(event, payload, autonomousStimulusMessageIds);
      intentionRhythmRefsByEventId.set(event.event_id, rhythmRefs);
      const kind = stringValue(objectPayload(payload.intention).kind) ?? "unknown";
      intentionKindsAfterRoomRhythm[kind] = (intentionKindsAfterRoomRhythm[kind] ?? 0) + 1;
      if (kind === "invite_other") {
        invitationCount += 1;
        invitationRefs.push(event.event_id);
        invitationRoomRhythmRefs.push(...rhythmRefs);
      }
      if (kind === "ask_question") {
        questionCount += 1;
        questionRefs.push(event.event_id);
        questionRoomRhythmRefs.push(...rhythmRefs);
      }
      if (kind === "propose_handoff") {
        handoffCount += 1;
        handoffRefs.push(event.event_id);
        handoffRoomRhythmRefs.push(...rhythmRefs);
      }
      if (kind === "stay_silent") {
        deliberateSilenceCount += 1;
        silenceRefs.push(event.event_id);
        silenceRoomRhythmRefs.push(...rhythmRefs);
      }
      if (isReviewIntentionKind(kind)) {
        reviewCount += 1;
        reviewRefs.push(event.event_id);
        reviewRoomRhythmRefs.push(...rhythmRefs);
      }
      recordAutonomousUserSilenceWindow({
        events,
        choiceEvent: event,
        choiceLabel: kind,
        rhythmRefs,
        choicesAfterUserSilenceRefs,
        choicesInterruptedByUserRefs,
        interruptingUserMessageRefs,
        choiceSilenceWindows,
      });
      recordAutonomousRoomEventPressure({
        choiceEvent: event,
        choiceLabel: kind,
        rhythmRefs,
        roomEventPressureByMessageRef,
        roomEventPressureRefs,
        roomEventPressureKinds,
        choicesWithoutRoomEventPressureRefs,
      });
      if (rhythmRefs.length === 0) {
        choicesWithoutRoomRhythmRefs.push(`${kind}:${event.event_id}`);
      }
    }
  }

  const socialEventCountsAfterRoomRhythm: Record<string, number> = {};
  for (const event of events) {
    if (!event.refs.some((ref) => intentionEventIdsAfterRoomRhythm.has(ref))) continue;
    if (!isAutonomousSocialEventType(event.event_type)) continue;
    const rhythmRefs = roomRhythmRefsForSocialEvent(event, autonomousStimulusMessageIds, intentionRhythmRefsByEventId);
    socialEventCountsAfterRoomRhythm[event.event_type] = (socialEventCountsAfterRoomRhythm[event.event_type] ?? 0) + 1;
    if (event.event_type === "agent.invited") {
      invitationCount += 1;
      invitationRefs.push(event.event_id);
      invitationRoomRhythmRefs.push(...rhythmRefs);
    }
    if (event.event_type === "open_question.responded" || event.event_type === "topic.updated") {
      questionCount += 1;
      questionRefs.push(event.event_id);
      questionRoomRhythmRefs.push(...rhythmRefs);
    }
    if (event.event_type.startsWith("handoff.")) {
      handoffCount += 1;
      handoffRefs.push(event.event_id);
      handoffRoomRhythmRefs.push(...rhythmRefs);
    }
    if (isReviewEventType(event.event_type)) {
      reviewCount += 1;
      reviewRefs.push(event.event_id);
      reviewRoomRhythmRefs.push(...rhythmRefs);
    }
    recordAutonomousUserSilenceWindow({
      events,
      choiceEvent: event,
      choiceLabel: event.event_type,
      rhythmRefs,
      choicesAfterUserSilenceRefs,
      choicesInterruptedByUserRefs,
      interruptingUserMessageRefs,
      choiceSilenceWindows,
    });
    recordAutonomousRoomEventPressure({
      choiceEvent: event,
      choiceLabel: event.event_type,
      rhythmRefs,
      roomEventPressureByMessageRef,
      roomEventPressureRefs,
      roomEventPressureKinds,
      choicesWithoutRoomEventPressureRefs,
    });
    if (rhythmRefs.length === 0) {
      choicesWithoutRoomRhythmRefs.push(`${event.event_type}:${event.event_id}`);
    }
  }

  const staySilentTickRefs = events
    .filter((event) => {
      if (event.event_type !== "room.autonomy_tick") return false;
      return stringValue(objectPayload(event.payload).action) === "stay_silent";
    })
    .map((event) => event.event_id);
  silenceRefs.push(...staySilentTickRefs);
  const staySilentTickCount = staySilentTickRefs.length;
  const choiceCount = invitationCount + questionCount + reviewCount + handoffCount + deliberateSilenceCount + staySilentTickCount;
  const missingRoomEventPressureKinds = autonomousSocialLoopMissingRoomEventPressureKinds(roomEventPressureKinds);
  const requiredRoomEventPressureKinds = AUTONOMOUS_SOCIAL_REQUIRED_ROOM_EVENT_PRESSURE_KINDS.length;
  const coveredRoomEventPressureKinds = requiredRoomEventPressureKinds - missingRoomEventPressureKinds.length;

  return {
    roomRhythmMessageCount: roomRhythmMessageIds.size,
    roomRhythmMessageRefs: uniqueStrings([...roomRhythmMessageIds]),
    staySilentTickCount,
    agentIntentionsAfterRoomRhythm: intentionEventIdsAfterRoomRhythm.size,
    intentionEventRefsAfterRoomRhythm: uniqueStrings([...intentionEventIdsAfterRoomRhythm]),
    intentionKindsAfterRoomRhythm,
    socialEventCountsAfterRoomRhythm,
    invitationCount,
    invitationRefs: uniqueStrings(invitationRefs),
    invitationRoomRhythmRefs: uniqueStrings(invitationRoomRhythmRefs),
    questionCount,
    questionRefs: uniqueStrings(questionRefs),
    questionRoomRhythmRefs: uniqueStrings(questionRoomRhythmRefs),
    reviewCount,
    reviewRefs: uniqueStrings(reviewRefs),
    reviewRoomRhythmRefs: uniqueStrings(reviewRoomRhythmRefs),
    handoffCount,
    handoffRefs: uniqueStrings(handoffRefs),
    handoffRoomRhythmRefs: uniqueStrings(handoffRoomRhythmRefs),
    deliberateSilenceCount,
    silenceRefs: uniqueStrings(silenceRefs),
    silenceRoomRhythmRefs: uniqueStrings(silenceRoomRhythmRefs),
    roomEventPressureRefs: uniqueStrings(roomEventPressureRefs),
    roomEventPressureKinds,
    requiredRoomEventPressureKinds,
    coveredRoomEventPressureKinds,
    missingRoomEventPressureKinds,
    roomEventPressureCoverageGapCount: missingRoomEventPressureKinds.length,
    choicesAfterUserSilenceRefs: uniqueStrings(choicesAfterUserSilenceRefs),
    choicesInterruptedByUserRefs: uniqueStrings(choicesInterruptedByUserRefs),
    interruptingUserMessageRefs: uniqueStrings(interruptingUserMessageRefs),
    choiceSilenceWindows,
    choicesWithoutRoomRhythmRefs: uniqueStrings(choicesWithoutRoomRhythmRefs),
    choicesWithoutRoomEventPressureRefs: uniqueStrings(choicesWithoutRoomEventPressureRefs),
    choiceCount,
    ok:
      roomRhythmMessageIds.size > 0 &&
      intentionEventIdsAfterRoomRhythm.size > 0 &&
      invitationRefs.length > 0 &&
      invitationRoomRhythmRefs.length > 0 &&
      questionRefs.length > 0 &&
      questionRoomRhythmRefs.length > 0 &&
      reviewRefs.length > 0 &&
      reviewRoomRhythmRefs.length > 0 &&
      handoffRefs.length > 0 &&
      handoffRoomRhythmRefs.length > 0 &&
      silenceRefs.length > 0 &&
      silenceRoomRhythmRefs.length > 0 &&
      choicesAfterUserSilenceRefs.length > 0 &&
      choicesInterruptedByUserRefs.length === 0 &&
      choicesWithoutRoomRhythmRefs.length === 0 &&
      choicesWithoutRoomEventPressureRefs.length === 0 &&
      missingRoomEventPressureKinds.length === 0,
  };
}

type AutonomousRoomEventPressureRecord = {
  kind: string;
  tickRef: string;
  messageRef: string;
  action: string;
};

function autonomousRoomEventPressureByMessageRef(
  events: readonly RoomEvent[],
): Map<string, AutonomousRoomEventPressureRecord[]> {
  const byMessageRef = new Map<string, AutonomousRoomEventPressureRecord[]>();
  for (const event of events) {
    if (event.event_type !== "room.autonomy_tick") continue;
    const payload = objectPayload(event.payload);
    const messageRef = stringValue(payload.messageEventId) ?? stringValue(payload.message_event_id);
    if (!messageRef) continue;
    const action = stringValue(payload.action) ?? "stay_silent";
    const kind = autonomousRoomEventPressureKind(action);
    if (!kind) continue;
    const records = byMessageRef.get(messageRef) ?? [];
    records.push({
      kind,
      tickRef: event.event_id,
      messageRef,
      action,
    });
    byMessageRef.set(messageRef, records);
  }
  return byMessageRef;
}

function recordAutonomousRoomEventPressure(input: {
  choiceEvent: RoomEvent;
  choiceLabel: string;
  rhythmRefs: readonly string[];
  roomEventPressureByMessageRef: ReadonlyMap<string, readonly AutonomousRoomEventPressureRecord[]>;
  roomEventPressureRefs: string[];
  roomEventPressureKinds: Record<string, number>;
  choicesWithoutRoomEventPressureRefs: string[];
}): void {
  if (input.rhythmRefs.length === 0) return;
  const records = uniqueAutonomousRoomEventPressureRecords(
    input.rhythmRefs.flatMap((ref) => input.roomEventPressureByMessageRef.get(ref) ?? []),
  );
  if (records.length === 0) {
    input.choicesWithoutRoomEventPressureRefs.push(`${input.choiceLabel}:${input.choiceEvent.event_id}`);
    return;
  }
  for (const record of records) {
    input.roomEventPressureRefs.push(record.tickRef);
    input.roomEventPressureKinds[record.kind] = (input.roomEventPressureKinds[record.kind] ?? 0) + 1;
  }
}

function uniqueAutonomousRoomEventPressureRecords(
  records: readonly AutonomousRoomEventPressureRecord[],
): AutonomousRoomEventPressureRecord[] {
  const unique: AutonomousRoomEventPressureRecord[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const key = `${record.kind}:${record.tickRef}:${record.messageRef}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function autonomousRoomEventPressureKind(action: string): string | undefined {
  switch (action) {
    case "archive_and_invite_review":
    case "review_open_archive":
      return "archive";
    case "memory_hygiene_review":
      return "memory";
    case "continuity_review":
      return "continuity";
    case "provider_boundary_review":
      return "provider-boundary";
    case "open_question_revisit":
      return "open-question";
    case "handoff_review":
      return "handoff";
    case "invitation_review":
      return "invitation";
    case "silence_reentry":
      return "silence-reentry";
    case "idle_social_rhythm":
      return "idle-social";
    default:
      return undefined;
  }
}

function recordAutonomousUserSilenceWindow(input: {
  events: readonly RoomEvent[];
  choiceEvent: RoomEvent;
  choiceLabel: string;
  rhythmRefs: readonly string[];
  choicesAfterUserSilenceRefs: string[];
  choicesInterruptedByUserRefs: string[];
  interruptingUserMessageRefs: string[];
  choiceSilenceWindows: LongRunHarnessReport["autonomousSocialLoop"]["choiceSilenceWindows"];
}): void {
  if (input.rhythmRefs.length === 0) return;
  const window = userSilenceWindowForChoice(input.events, input.choiceEvent, input.rhythmRefs);
  const choiceIndex = eventIndexById(input.events, input.choiceEvent.event_id);
  input.choiceSilenceWindows.push({
    choiceRef: input.choiceEvent.event_id,
    choiceLabel: input.choiceLabel,
    roomRhythmRefs: uniqueStrings([...input.rhythmRefs]),
    cleanRoomRhythmRefs: window.cleanRhythmRefs,
    interruptingUserMessageRefs: window.interruptingUserMessageRefs,
    latestRoomRhythmRef: latestEventRefBeforeIndex(input.events, input.rhythmRefs, choiceIndex),
    latestUserMessageRef: latestUserMessageRefBeforeIndex(input.events, choiceIndex),
    interrupted: window.cleanRhythmRefs.length === 0 && window.interruptingUserMessageRefs.length > 0,
  });
  if (window.cleanRhythmRefs.length > 0) {
    input.choicesAfterUserSilenceRefs.push(input.choiceEvent.event_id);
  }
  if (window.cleanRhythmRefs.length === 0 && window.interruptingUserMessageRefs.length > 0) {
    input.choicesInterruptedByUserRefs.push(`${input.choiceLabel}:${input.choiceEvent.event_id}`);
    input.interruptingUserMessageRefs.push(...window.interruptingUserMessageRefs);
  }
}

function userSilenceWindowForChoice(
  events: readonly RoomEvent[],
  choiceEvent: RoomEvent,
  rhythmRefs: readonly string[],
): { cleanRhythmRefs: string[]; interruptingUserMessageRefs: string[] } {
  const choiceIndex = eventIndexById(events, choiceEvent.event_id);
  if (choiceIndex < 0) {
    return { cleanRhythmRefs: [], interruptingUserMessageRefs: [] };
  }

  const cleanRhythmRefs: string[] = [];
  const interruptingUserMessageRefs: string[] = [];
  for (const rhythmRef of rhythmRefs) {
    const rhythmIndex = eventIndexById(events, rhythmRef);
    if (rhythmIndex < 0 || rhythmIndex >= choiceIndex) {
      continue;
    }
    const userMessages = events
      .slice(rhythmIndex + 1, choiceIndex)
      .filter(isUserMessageEvent)
      .map((event) => event.event_id);
    if (userMessages.length === 0) {
      cleanRhythmRefs.push(rhythmRef);
    } else {
      interruptingUserMessageRefs.push(...userMessages);
    }
  }

  return {
    cleanRhythmRefs: uniqueStrings(cleanRhythmRefs),
    interruptingUserMessageRefs: uniqueStrings(interruptingUserMessageRefs),
  };
}

function latestEventRefBeforeIndex(events: readonly RoomEvent[], refs: readonly string[], beforeIndex: number): string | undefined {
  let latest: { ref: string; index: number } | undefined;
  for (const ref of uniqueStrings([...refs])) {
    const index = eventIndexById(events, ref);
    if (index < 0 || index >= beforeIndex) continue;
    if (latest === undefined || index > latest.index) {
      latest = { ref, index };
    }
  }
  return latest?.ref;
}

function latestUserMessageRefBeforeIndex(events: readonly RoomEvent[], beforeIndex: number): string | undefined {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && isUserMessageEvent(event)) {
      return event.event_id;
    }
  }
  return undefined;
}

function eventIndexById(events: readonly RoomEvent[], eventId: string): number {
  return events.findIndex((event) => event.event_id === eventId);
}

function isUserMessageEvent(event: RoomEvent): boolean {
  if (event.event_type !== "message.created") return false;
  const payload = objectPayload(event.payload);
  const authorKind = stringValue(payload.authorKind) ?? stringValue(payload.author_kind) ?? event.actor.kind;
  return authorKind === "user";
}

function autonomousSocialLoopLineageFindings(
  summary: LongRunHarnessReport["autonomousSocialLoop"],
): string[] {
  const findings: string[] = [];
  if (summary.invitationCount > 0 && summary.invitationRoomRhythmRefs.length === 0) {
    findings.push("autonomous social loop: invitation choices lacked room-rhythm lineage refs");
  }
  if (summary.questionCount > 0 && summary.questionRoomRhythmRefs.length === 0) {
    findings.push("autonomous social loop: question choices lacked room-rhythm lineage refs");
  }
  if (summary.reviewCount > 0 && summary.reviewRoomRhythmRefs.length === 0) {
    findings.push("autonomous social loop: review choices lacked room-rhythm lineage refs");
  }
  if (summary.handoffCount > 0 && summary.handoffRoomRhythmRefs.length === 0) {
    findings.push("autonomous social loop: handoff choices lacked room-rhythm lineage refs");
  }
  if (summary.silenceRefs.length > 0 && summary.silenceRoomRhythmRefs.length === 0) {
    findings.push("autonomous social loop: silence choices lacked room-rhythm lineage refs");
  }
  if (summary.choicesWithoutRoomRhythmRefs.length > 0) {
    findings.push("autonomous social loop: some choices lacked room-rhythm lineage refs");
  }
  return findings;
}

function autonomousSocialLoopLineageGapCount(summary: LongRunHarnessReport["autonomousSocialLoop"]): number {
  return [
    summary.invitationCount > 0 && summary.invitationRoomRhythmRefs.length === 0,
    summary.questionCount > 0 && summary.questionRoomRhythmRefs.length === 0,
    summary.reviewCount > 0 && summary.reviewRoomRhythmRefs.length === 0,
    summary.handoffCount > 0 && summary.handoffRoomRhythmRefs.length === 0,
    summary.silenceRefs.length > 0 && summary.silenceRoomRhythmRefs.length === 0,
    summary.choicesWithoutRoomRhythmRefs.length > 0,
  ].filter(Boolean).length;
}

function autonomousSocialLoopRoomEventPressureFindings(
  summary: LongRunHarnessReport["autonomousSocialLoop"],
): string[] {
  const findings: string[] = [];
  if (summary.choicesWithoutRoomEventPressureRefs.length > 0) {
    findings.push("autonomous social loop: some choices lacked room-event pressure refs");
  }
  findings.push(
    ...summary.missingRoomEventPressureKinds.map(
      (kind) => `autonomous social loop: missing ${kind} room-event pressure evidence`,
    ),
  );
  return findings;
}

function autonomousSocialLoopMissingChoiceKinds(summary: LongRunHarnessReport["autonomousSocialLoop"]): string[] {
  const missing: string[] = [];
  if (summary.invitationCount === 0) missing.push("invitation");
  if (summary.questionCount === 0) missing.push("question");
  if (summary.reviewCount === 0) missing.push("review");
  if (summary.handoffCount === 0) missing.push("handoff");
  if (summary.deliberateSilenceCount + summary.staySilentTickCount === 0) missing.push("silence");
  return missing;
}

function autonomousSocialLoopChoiceCoverageGapCount(summary: LongRunHarnessReport["autonomousSocialLoop"]): number {
  return autonomousSocialLoopMissingChoiceKinds(summary).length;
}

function autonomousSocialLoopMissingRoomEventPressureKinds(
  roomEventPressureKinds: Readonly<Record<string, number>>,
): string[] {
  return AUTONOMOUS_SOCIAL_REQUIRED_ROOM_EVENT_PRESSURE_KINDS.filter(
    (kind) => (roomEventPressureKinds[kind] ?? 0) === 0,
  );
}

function roomRhythmRefsForEvent(
  event: RoomEvent,
  payload: Record<string, unknown>,
  autonomousStimulusMessageIds: ReadonlySet<string>,
): string[] {
  return uniqueStrings(
    [
      stringValue(payload.triggeringEventId),
      stringValue(payload.triggering_event_id),
      ...event.refs,
      ...arrayOfStrings(payload.contextRefs),
      ...arrayOfStrings(payload.context_refs),
    ].filter((ref): ref is string => typeof ref === "string" && autonomousStimulusMessageIds.has(ref)),
  );
}

function roomRhythmRefsForSocialEvent(
  event: RoomEvent,
  autonomousStimulusMessageIds: ReadonlySet<string>,
  intentionRhythmRefsByEventId: ReadonlyMap<string, readonly string[]>,
): string[] {
  return uniqueStrings(
    event.refs.flatMap((ref) => {
      if (autonomousStimulusMessageIds.has(ref)) return [ref];
      return intentionRhythmRefsByEventId.get(ref) ?? [];
    }),
  );
}

function isReviewIntentionKind(kind: string): boolean {
  return [
    "contest_memory",
    "accept_memory",
    "mark_memory_stale",
    "retire_memory",
    "respond_persona_delta",
    "respond_protocol",
    "review_archive",
    "propose_archive_repair",
    "respond_archive_repair",
    "retire_provider_boundary",
    "respond_topic",
    "respond_invitation",
  ].includes(kind);
}

function isAutonomousSocialEventType(eventType: string): boolean {
  return (
    eventType === "agent.invited" ||
    eventType === "open_question.responded" ||
    eventType === "topic.updated" ||
    eventType.startsWith("handoff.") ||
    isReviewEventType(eventType)
  );
}

function isReviewEventType(eventType: string): boolean {
  return (
    eventType.endsWith(".reviewed") ||
    eventType.endsWith(".responded") ||
    eventType === "agent.invitation_reviewed" ||
    eventType === "memory.contested" ||
    eventType === "memory.accepted" ||
    eventType === "memory.stale" ||
    eventType === "memory.retired" ||
    eventType === "archive.repair_proposed" ||
    eventType === "archive.repair_applied" ||
    eventType === "provider_boundary.retired"
  );
}

function summarizePersonaEvidence(
  events: readonly RoomEvent[],
  state: RuntimeRoomState,
): LongRunHarnessReport["personaEvidence"] {
  const proposedDeltaRefs: string[] = [];
  const proposedDeltaEventRefs: string[] = [];
  const proposedDeltasWithoutEvidenceRefs: string[] = [];
  const acceptedDeltaRefs: string[] = [];
  const acceptedDeltaResponseEventRefs: string[] = [];
  const acceptedDeltasWithoutResponseEvidenceRefs: string[] = [];

  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "persona_delta.proposed") {
      const deltaId = stringValue(payload.deltaId) ?? stringValue(payload.delta_id) ?? event.event_id;
      proposedDeltaRefs.push(deltaId);
      proposedDeltaEventRefs.push(event.event_id);
      const evidenceRefs = arrayOfStrings(payload.evidenceRefs).concat(arrayOfStrings(payload.evidence_refs));
      if (evidenceRefs.length === 0) {
        proposedDeltasWithoutEvidenceRefs.push(deltaId);
      }
    }
    if (event.event_type === "persona_delta.responded") {
      const response = stringValue(payload.response);
      if (response !== "accept") continue;
      const deltaId = stringValue(payload.deltaId) ?? stringValue(payload.delta_id) ?? event.event_id;
      acceptedDeltaRefs.push(deltaId);
      acceptedDeltaResponseEventRefs.push(event.event_id);
      const evidenceRefs = arrayOfStrings(payload.evidenceRefs).concat(arrayOfStrings(payload.evidence_refs), event.refs);
      if (evidenceRefs.length < 2) {
        acceptedDeltasWithoutResponseEvidenceRefs.push(deltaId);
      }
    }
  }

  const roleClaimRefs: string[] = [];
  const acceptedRoleClaimRefs: string[] = [];
  const roleClaimEvidenceRefs: string[] = [];
  const roleClaimResponseRefs: string[] = [];
  const roleClaimsWithoutEvidenceRefs: string[] = [];
  const roleClaimsWithoutResponseRefs: string[] = [];
  const acceptedRoleClaimDeltaRefs: string[] = [];
  const acceptedRoleClaimsWithoutAcceptedDelta: string[] = [];
  const dailyMoodSourceRefs: string[] = [];
  const dailyMoodEvidenceRefs: string[] = [];
  const dailyMoodResponseRefs: string[] = [];
  const acceptedDailyMoodDeltaRefs: string[] = [];
  const dailyMoodsWithoutSourceRef: string[] = [];
  const dailyMoodsWithoutEvidenceRefs: string[] = [];
  const dailyMoodsWithoutResponseRefs: string[] = [];
  const dailyMoodsWithoutAcceptedDelta: string[] = [];
  for (const persona of state.socialState.personas ?? []) {
    for (const claim of persona.roleClaims ?? []) {
      roleClaimRefs.push(claim.roleClaimId);
      roleClaimEvidenceRefs.push(...(claim.evidenceRefs ?? []));
      roleClaimResponseRefs.push(...(claim.responseRefs ?? []));
      if ((claim.evidenceRefs ?? []).length === 0) {
        roleClaimsWithoutEvidenceRefs.push(claim.roleClaimId);
      }
      if (claim.status === "accepted") {
        acceptedRoleClaimRefs.push(claim.roleClaimId);
        if ((claim.responseRefs ?? []).length === 0) {
          roleClaimsWithoutResponseRefs.push(claim.roleClaimId);
        }
        const acceptedRoleClaimDelta = (persona.evolutionLog ?? []).find(
          (delta) =>
            delta.field === "roleClaims" &&
            delta.status === "accepted" &&
            delta.responseCount > 0 &&
            (!delta.value || delta.value === claim.label),
        );
        if (acceptedRoleClaimDelta) {
          acceptedRoleClaimDeltaRefs.push(acceptedRoleClaimDelta.deltaId);
        } else {
          acceptedRoleClaimsWithoutAcceptedDelta.push(claim.roleClaimId);
        }
      }
    }

    if (persona.dailyMoodRecord) {
      const moodEvidenceRefs = persona.dailyMoodRecord.evidenceRefs ?? [];
      const moodResponseRefs = persona.dailyMoodRecord.responseRefs ?? [];
      if (persona.dailyMoodRecord.sourceRef) {
        dailyMoodSourceRefs.push(persona.dailyMoodRecord.sourceRef);
      } else {
        dailyMoodsWithoutSourceRef.push(persona.agentId);
      }
      dailyMoodEvidenceRefs.push(...moodEvidenceRefs);
      dailyMoodResponseRefs.push(...moodResponseRefs);
      if (moodEvidenceRefs.length === 0) {
        dailyMoodsWithoutEvidenceRefs.push(persona.agentId);
      }
      if (moodResponseRefs.length === 0) {
        dailyMoodsWithoutResponseRefs.push(persona.agentId);
      }
      const acceptedDailyMoodDelta = (persona.evolutionLog ?? []).find(
        (delta) => delta.field === "dailyMood" && delta.status === "accepted" && delta.responseCount > 0,
      );
      if (acceptedDailyMoodDelta) {
        acceptedDailyMoodDeltaRefs.push(acceptedDailyMoodDelta.deltaId);
      } else {
        dailyMoodsWithoutAcceptedDelta.push(persona.agentId);
      }
    }
  }

  return {
    proposedDeltaRefs: uniqueStrings(proposedDeltaRefs),
    proposedDeltaEventRefs: uniqueStrings(proposedDeltaEventRefs),
    proposedDeltasWithoutEvidenceRefs: uniqueStrings(proposedDeltasWithoutEvidenceRefs),
    acceptedDeltaRefs: uniqueStrings(acceptedDeltaRefs),
    acceptedDeltaResponseEventRefs: uniqueStrings(acceptedDeltaResponseEventRefs),
    acceptedDeltasWithoutResponseEvidenceRefs: uniqueStrings(acceptedDeltasWithoutResponseEvidenceRefs),
    roleClaimRefs: uniqueStrings(roleClaimRefs),
    acceptedRoleClaimRefs: uniqueStrings(acceptedRoleClaimRefs),
    roleClaimEvidenceRefs: uniqueStrings(roleClaimEvidenceRefs),
    roleClaimResponseRefs: uniqueStrings(roleClaimResponseRefs),
    roleClaimsWithoutEvidenceRefs: uniqueStrings(roleClaimsWithoutEvidenceRefs),
    roleClaimsWithoutResponseRefs: uniqueStrings(roleClaimsWithoutResponseRefs),
    acceptedRoleClaimDeltaRefs: uniqueStrings(acceptedRoleClaimDeltaRefs),
    acceptedRoleClaimsWithoutAcceptedDelta: uniqueStrings(acceptedRoleClaimsWithoutAcceptedDelta),
    dailyMoodSourceRefs: uniqueStrings(dailyMoodSourceRefs),
    dailyMoodEvidenceRefs: uniqueStrings(dailyMoodEvidenceRefs),
    dailyMoodResponseRefs: uniqueStrings(dailyMoodResponseRefs),
    acceptedDailyMoodDeltaRefs: uniqueStrings(acceptedDailyMoodDeltaRefs),
    dailyMoodsWithoutSourceRef: uniqueStrings(dailyMoodsWithoutSourceRef),
    dailyMoodsWithoutEvidenceRefs: uniqueStrings(dailyMoodsWithoutEvidenceRefs),
    dailyMoodsWithoutResponseRefs: uniqueStrings(dailyMoodsWithoutResponseRefs),
    dailyMoodsWithoutAcceptedDelta: uniqueStrings(dailyMoodsWithoutAcceptedDelta),
    ok:
      proposedDeltasWithoutEvidenceRefs.length === 0 &&
      acceptedDeltasWithoutResponseEvidenceRefs.length === 0 &&
      roleClaimsWithoutEvidenceRefs.length === 0 &&
      roleClaimsWithoutResponseRefs.length === 0 &&
      acceptedRoleClaimsWithoutAcceptedDelta.length === 0 &&
      dailyMoodsWithoutSourceRef.length === 0 &&
      dailyMoodsWithoutEvidenceRefs.length === 0 &&
      dailyMoodsWithoutResponseRefs.length === 0 &&
      dailyMoodsWithoutAcceptedDelta.length === 0,
  };
}

function summarizeProviderBoundary(
  events: readonly RoomEvent[],
  state: RuntimeRoomState,
): LongRunHarnessReport["providerBoundary"] {
  const degradationEvents = events.filter((event) => event.event_type === "agent.provider_degraded");
  const degradationRefs = degradationEvents.map((event) => event.event_id);
  const boundaryRefs = degradationEvents.map((event) => providerBoundaryRefFromPayload(objectPayload(event.payload), event.event_id));
  const retirementEvents = events.filter((event) => event.event_type === "provider_boundary.retired");
  const retirementRefs = retirementEvents.map((event) => event.event_id);
  const retiredBoundaryRefs = retirementEvents
    .map((event) => providerBoundaryRetirementRefFromPayload(objectPayload(event.payload)))
    .filter((ref): ref is string => Boolean(ref));
  const deliberateSilenceCount = state.socialState.silences.length;
  const deliberateSilenceRefs = state.socialState.silences.map((silence) => silence.silenceId);
  const degradedIntentionRefs = degradationEvents.flatMap((event) => event.refs);
  const degradationEvidenceRefs = new Set(degradationRefs.concat(degradedIntentionRefs));
  const degradationTreatedAsSilence = state.socialState.silences.some((silence) =>
    degradationEvidenceRefs.has(silence.silenceId) || degradationEvidenceRefs.has(silence.triggeringEventId ?? ""),
  );
  const providerBoundaries = state.socialState.providerBoundaries ?? [];
  const choicePressureRepairRequestRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.repairRequestRefs ?? []),
  );
  const choicePressureDeniedRepairRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.deniedRepairRequestRefs ?? []),
  );
  const choicePressureApprovedRepairRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.approvedRepairRequestRefs ?? []),
  );
  const choicePressureResultRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.resultRefs ?? []),
  );
  const choicePressureRetryProtocolRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.retryProtocolRefs ?? []),
  );
  const choicePressureRetiredRetryProtocolRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.retiredRetryProtocolRefs ?? []),
  );
  const choicePressureSilenceRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.silenceRefs ?? []),
  );
  const choicePressureContestedMemoryRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.contestedMemoryRefs ?? []),
  );
  const choicePressureArchiveCarryoverRefs = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.archiveCarryoverRefs ?? []),
  );
  const choicePressureAgentIds = uniqueStrings(
    providerBoundaries.flatMap((boundary) => boundary.choicePressure?.choiceAgentIds ?? []),
  );
  const choicePressureRefCount = uniqueStrings(
    choicePressureRepairRequestRefs
      .concat(choicePressureDeniedRepairRefs)
      .concat(choicePressureApprovedRepairRefs)
      .concat(choicePressureResultRefs)
      .concat(choicePressureRetryProtocolRefs)
      .concat(choicePressureRetiredRetryProtocolRefs)
      .concat(choicePressureSilenceRefs)
      .concat(choicePressureContestedMemoryRefs)
      .concat(choicePressureArchiveCarryoverRefs),
  ).length;
  const hasMixedChoicePressure = providerBoundaries.some((boundary) => boundary.choicePressure?.hasMixedChoices === true);
  const hasMultiAgentChoicePressure = providerBoundaries.some(
    (boundary) => boundary.choicePressure?.hasMultiAgentPressure === true,
  );
  const carriedAcrossArchives = providerBoundaries.some((boundary) => boundary.choicePressure?.carriedAcrossArchives === true);
  const choicePressureMissingKinds = providerBoundaryChoicePressureMissingKinds({
    repairRefs: choicePressureRepairRequestRefs,
    retryRefs: choicePressureRetryProtocolRefs,
    silenceRefs: choicePressureSilenceRefs,
    contestedMemoryRefs: choicePressureContestedMemoryRefs,
    archiveCarryoverRefs: choicePressureArchiveCarryoverRefs,
  });
  const choicePressureRequiredKinds = 5;
  const choicePressureCoveredKinds = choicePressureRequiredKinds - choicePressureMissingKinds.length;
  const secretLikeDiagnosticRefs: string[] = [];
  for (const event of events) {
    if (event.event_type !== "agent.provider_degraded" && event.event_type !== "provider_boundary.retired") {
      continue;
    }
    if (containsSecretLikeText(JSON.stringify(event.payload))) {
      secretLikeDiagnosticRefs.push(event.event_id);
    }
  }
  for (const boundary of state.socialState.providerBoundaries ?? []) {
    const text = [
      boundary.diagnostic,
      boundary.retirementReason,
      boundary.providerKind,
      boundary.providerLabel,
      boundary.boundaryNote,
    ]
      .filter(Boolean)
      .join(" ");
    if (containsSecretLikeText(text)) {
      secretLikeDiagnosticRefs.push(boundary.boundaryId);
    }
  }
  return {
    degradationCount: degradationRefs.length,
    degradationRefs: uniqueStrings(degradationRefs),
    boundaryRefs: uniqueStrings(boundaryRefs),
    retirementRefs: uniqueStrings(retirementRefs),
    retiredBoundaryRefs: uniqueStrings(retiredBoundaryRefs),
    deliberateSilenceCount,
    deliberateSilenceRefs: uniqueStrings(deliberateSilenceRefs),
    degradationTreatedAsSilence,
    choicePressureRepairRequestRefs,
    choicePressureDeniedRepairRefs,
    choicePressureApprovedRepairRefs,
    choicePressureResultRefs,
    choicePressureRetryProtocolRefs,
    choicePressureRetiredRetryProtocolRefs,
    choicePressureSilenceRefs,
    choicePressureContestedMemoryRefs,
    choicePressureArchiveCarryoverRefs,
    choicePressureAgentIds,
    choicePressureRefCount,
    choicePressureRequiredKinds,
    choicePressureCoveredKinds,
    choicePressureMissingKinds,
    choicePressureCoverageGapCount: choicePressureMissingKinds.length,
    hasMixedChoicePressure,
    hasMultiAgentChoicePressure,
    carriedAcrossArchives,
    secretLikeDiagnosticRefs: uniqueStrings(secretLikeDiagnosticRefs),
    ok:
      degradationRefs.length > 0 &&
      choicePressureArchiveCarryoverRefs.length > 0 &&
      choicePressureMissingKinds.length === 0 &&
      !degradationTreatedAsSilence &&
      secretLikeDiagnosticRefs.length === 0,
  };
}

function providerBoundaryChoicePressureMissingKinds(input: {
  repairRefs: readonly string[];
  retryRefs: readonly string[];
  silenceRefs: readonly string[];
  contestedMemoryRefs: readonly string[];
  archiveCarryoverRefs: readonly string[];
}): string[] {
  const missing: string[] = [];
  if (input.repairRefs.length === 0) missing.push("repair");
  if (input.retryRefs.length === 0) missing.push("retry");
  if (input.silenceRefs.length === 0) missing.push("silence");
  if (input.contestedMemoryRefs.length === 0) missing.push("contested-memory");
  if (input.archiveCarryoverRefs.length === 0) missing.push("archive-carryover");
  return missing;
}

function providerBoundaryRefFromPayload(payload: Record<string, unknown>, fallback: string): string {
  return stringValue(payload.degradationId) ?? stringValue(payload.degradation_id) ?? fallback;
}

function providerBoundaryRetirementRefFromPayload(payload: Record<string, unknown>): string | undefined {
  return (
    stringValue(payload.providerBoundaryRef) ??
    stringValue(payload.provider_boundary_ref) ??
    stringValue(payload.boundaryRef) ??
    stringValue(payload.boundary_ref)
  );
}

function summarizeContextVisibility(state: RuntimeRoomState): LongRunHarnessReport["contextVisibility"] {
  const latest = state.contextAudits.at(-1);
  const latestSelectedTypes = latest?.selectedByType ?? {};
  const hasArchiveContext = state.contextAudits.some((audit) => Boolean(audit.selectedByType.daily_archive_ref));
  const hasProviderBoundaryContext = state.contextAudits.some((audit) => Boolean(audit.selectedByType.provider_boundary));
  const hasMemoryContext = state.contextAudits.some((audit) =>
    Object.keys(audit.selectedByType).some((type) => type.startsWith("memory_")),
  );
  const archives = state.socialState.archives ?? [];
  const hasArchiveContinuity = archives.some(
    (archive) => (archive.roleClaimCount ?? 0) + (archive.dailyMoodCount ?? 0) > 0,
  );
  const hasDirectPersonaContext = state.contextAudits.some((audit) =>
    Boolean(audit.selectedByType.persona_projection || audit.selectedByType.persona_delta),
  );
  const hasPersonaContext = hasDirectPersonaContext || (hasArchiveContext && hasArchiveContinuity);
  const coVisibleAudits = state.contextAudits.filter(
    (audit) =>
      hasArchiveContextInAudit(audit) &&
      hasMemoryContextInAudit(audit) &&
      hasProviderBoundaryContextInAudit(audit) &&
      hasPersonaContextInAudit(audit, hasArchiveContinuity) &&
      hasSocialLineageContextInAudit(audit),
  );
  const coVisibleAuditPacketIds = uniqueStrings(
    coVisibleAudits.map((audit) => audit.packetId).filter((packetId): packetId is string => typeof packetId === "string"),
  );
  const coVisibleArchiveRefs = coVisibleAuditRefs(coVisibleAudits, (fragment) => fragment.type === "daily_archive_ref");
  const coVisibleMemoryRefs = coVisibleAuditRefs(coVisibleAudits, (fragment) => fragment.type.startsWith("memory_"));
  const coVisibleProviderBoundaryRefs = coVisibleAuditRefs(
    coVisibleAudits,
    (fragment) => fragment.type === "provider_boundary",
  );
  const socialLineageFragments = state.contextAudits.flatMap((audit) =>
    (audit.selectedFragments ?? []).filter(isSocialLineageContextFragment),
  );
  const socialLineageSelectedTypes = socialLineageFragments.reduce<Record<string, number>>((counts, fragment) => {
    counts[fragment.type] = (counts[fragment.type] ?? 0) + 1;
    return counts;
  }, {});
  const socialLineageRefs = uniqueStrings(socialLineageFragments.flatMap((fragment) => fragment.refs ?? []));
  const hasSocialLineageContext = socialLineageRefs.length > 0;
  const coVisibleSocialLineageRefs = coVisibleAuditRefs(coVisibleAudits, isSocialLineageContextFragment);
  const coVisibleDirectPersonaRefs = coVisibleAuditRefs(
    coVisibleAudits,
    (fragment) => fragment.type === "persona_delta" || fragment.type === "persona_projection",
  );
  const coVisiblePersonaRefs =
    coVisibleDirectPersonaRefs.length > 0 || !hasArchiveContinuity
      ? coVisibleDirectPersonaRefs
      : coVisibleArchiveRefs;
  const coVisibleContextRefCount = uniqueStrings(
    coVisibleArchiveRefs.concat(
      coVisibleMemoryRefs,
      coVisiblePersonaRefs,
      coVisibleProviderBoundaryRefs,
      coVisibleSocialLineageRefs,
    ),
  ).length;
  const coVisibleAuditDetails = coVisibleAudits.map((audit) => {
    const archiveRefs = auditContextRefs(audit, (fragment) => fragment.type === "daily_archive_ref");
    const memoryRefs = auditContextRefs(audit, (fragment) => fragment.type.startsWith("memory_"));
    const directPersonaRefs = auditContextRefs(
      audit,
      (fragment) => fragment.type === "persona_delta" || fragment.type === "persona_projection",
    );
    const personaRefs = directPersonaRefs.length > 0 || !hasArchiveContinuity ? directPersonaRefs : archiveRefs;
    const providerBoundaryRefs = auditContextRefs(audit, (fragment) => fragment.type === "provider_boundary");
    const socialLineageRefs = auditContextRefs(audit, isSocialLineageContextFragment);
    return {
      packetId: audit.packetId,
      selectedTypes: audit.selectedByType,
      archiveRefs,
      memoryRefs,
      personaRefs,
      providerBoundaryRefs,
      socialLineageRefs,
      contextRefCount: uniqueStrings(
        archiveRefs.concat(memoryRefs, personaRefs, providerBoundaryRefs, socialLineageRefs),
      ).length,
    };
  });
  const criticalFragmentsWithoutRefs = uniqueStrings(
    state.contextAudits.flatMap((audit) =>
      (audit.selectedFragments ?? [])
        .filter((fragment) => isCriticalContextFragmentType(fragment.type) && (fragment.refs ?? []).length === 0)
        .map((fragment) => `${audit.packetId}:${fragment.type}:${fragment.id}`),
    ),
  );
  return {
    auditCount: state.contextAudits.length,
    latestSelectedTypes,
    hasArchiveContext,
    hasProviderBoundaryContext,
    hasMemoryContext,
    hasPersonaContext,
    hasArchiveContinuity,
    coVisibleAuditCount: coVisibleAuditPacketIds.length,
    coVisibleAuditPacketIds,
    coVisibleArchiveRefs,
    coVisibleMemoryRefs,
    coVisiblePersonaRefs,
    coVisibleProviderBoundaryRefs,
    coVisibleSocialLineageRefs,
    coVisibleContextRefCount,
    coVisibleAuditDetails,
    hasSocialLineageContext,
    socialLineageSelectedTypes,
    socialLineageRefs,
    criticalFragmentsWithoutRefs,
    ok:
      state.contextAudits.length > 0 &&
      Object.keys(latestSelectedTypes).length > 0 &&
      hasArchiveContext &&
      hasProviderBoundaryContext &&
      hasMemoryContext &&
      hasPersonaContext &&
      hasArchiveContinuity &&
      coVisibleAuditPacketIds.length > 0 &&
      coVisibleArchiveRefs.length > 0 &&
      coVisibleMemoryRefs.length > 0 &&
      coVisiblePersonaRefs.length > 0 &&
      coVisibleProviderBoundaryRefs.length > 0 &&
      coVisibleSocialLineageRefs.length > 0 &&
      hasSocialLineageContext &&
      criticalFragmentsWithoutRefs.length === 0,
  };
}

function coVisibleAuditRefs(
  audits: readonly RuntimeRoomState["contextAudits"][number][],
  matches: (fragment: RuntimeRoomState["contextAudits"][number]["selectedFragments"][number]) => boolean,
): string[] {
  return uniqueStrings(audits.flatMap((audit) => (audit.selectedFragments ?? []).filter(matches).flatMap((fragment) => fragment.refs ?? [])));
}

function auditContextRefs(
  audit: RuntimeRoomState["contextAudits"][number],
  matches: (fragment: RuntimeRoomState["contextAudits"][number]["selectedFragments"][number]) => boolean,
): string[] {
  return uniqueStrings((audit.selectedFragments ?? []).filter(matches).flatMap((fragment) => fragment.refs ?? []));
}

function hasArchiveContextInAudit(audit: RuntimeRoomState["contextAudits"][number]): boolean {
  return Boolean(audit.selectedByType.daily_archive_ref);
}

function hasProviderBoundaryContextInAudit(audit: RuntimeRoomState["contextAudits"][number]): boolean {
  return Boolean(audit.selectedByType.provider_boundary);
}

function hasMemoryContextInAudit(audit: RuntimeRoomState["contextAudits"][number]): boolean {
  return Object.keys(audit.selectedByType).some((type) => type.startsWith("memory_"));
}

function hasPersonaContextInAudit(audit: RuntimeRoomState["contextAudits"][number], hasArchiveContinuity: boolean): boolean {
  return Boolean(
    audit.selectedByType.persona_projection ||
      audit.selectedByType.persona_delta ||
      (hasArchiveContinuity && audit.selectedByType.daily_archive_ref),
  );
}

function hasSocialLineageContextInAudit(audit: RuntimeRoomState["contextAudits"][number]): boolean {
  return (audit.selectedFragments ?? []).some(isSocialLineageContextFragment);
}

function isSocialLineageContextFragment(
  fragment: RuntimeRoomState["contextAudits"][number]["selectedFragments"][number],
): boolean {
  return (
    fragment.type === "mixed_review_pressure" ||
    fragment.type === "open_question" ||
    fragment.type === "protocol_active" ||
    fragment.type === "protocol_proposal" ||
    fragment.type === "handoff_packet" ||
    fragment.type === "invitation_packet" ||
    fragment.type === "side_effect_boundary" ||
    fragment.type === "workspace_artifact_ref" ||
    fragment.type === "skill_capsule_ref" ||
    fragment.type === "capability_ref" ||
    fragment.type === "deferred_intention" ||
    fragment.type === "silence_ref" ||
    fragment.type === "pressure_boundary" ||
    fragment.type === "memory_pressure_boundary" ||
    (fragment.type === "topic_rule" && (fragment.refs ?? []).some((ref) => ref.startsWith("topic_proposal_")))
  );
}

function isCriticalContextFragmentType(type: string): boolean {
  return (
    type === "daily_archive_ref" ||
    type === "provider_boundary" ||
    type === "persona_delta" ||
    type === "persona_projection" ||
    type === "mixed_review_pressure" ||
    type === "open_question" ||
    type === "protocol_active" ||
    type === "protocol_proposal" ||
    type === "handoff_packet" ||
    type === "invitation_packet" ||
    type === "side_effect_boundary" ||
    type === "workspace_artifact_ref" ||
    type === "skill_capsule_ref" ||
    type === "capability_ref" ||
    type === "deferred_intention" ||
    type === "silence_ref" ||
    type === "pressure_boundary" ||
    type === "memory_pressure_boundary" ||
    type.startsWith("memory_")
  );
}

function summarizeArchiveContinuity(state: RuntimeRoomState): LongRunHarnessReport["archiveContinuity"] {
  const continuityItemsWithoutEvidenceRefs: string[] = [];
  const continuityArchiveRefs: string[] = [];
  const roleClaimRefs: string[] = [];
  const dailyMoodRefs: string[] = [];
  const acceptedRoleClaimRefs: string[] = [];
  const acceptedDailyMoodRefs: string[] = [];
  const continuityEvidenceRefs: string[] = [];
  const continuityResponseRefs: string[] = [];
  const continuitySourceRefs: string[] = [];
  const continuityEventRefs: string[] = [];
  const archives = state.socialState.archives ?? [];
  let archivesWithContinuity = 0;
  let roleClaimCount = 0;
  let dailyMoodCount = 0;
  let acceptedRoleClaimCount = 0;
  let acceptedDailyMoodCount = 0;

  for (const archive of archives) {
    const continuity = archive.agentContinuity ?? [];
    if (continuity.length > 0) {
      archivesWithContinuity += 1;
      continuityArchiveRefs.push(archive.archiveId);
    }
    for (const item of continuity) {
      continuitySourceRefs.push(...(item.sourceRefs ?? []));
      continuityEventRefs.push(...(item.eventIds ?? []));
      for (const claim of item.roleClaims ?? []) {
        roleClaimCount += 1;
        roleClaimRefs.push(claim.roleClaimId);
        continuityEvidenceRefs.push(...(claim.evidenceRefs ?? []));
        continuityResponseRefs.push(...(claim.responseRefs ?? []));
        if (claim.status === "accepted") {
          acceptedRoleClaimCount += 1;
          acceptedRoleClaimRefs.push(claim.roleClaimId);
        }
        if ((claim.evidenceRefs ?? []).length === 0 || (claim.status === "accepted" && (claim.responseRefs ?? []).length === 0)) {
          continuityItemsWithoutEvidenceRefs.push(claim.deltaId || claim.roleClaimId);
        }
      }
      for (const mood of item.dailyMoods ?? []) {
        dailyMoodCount += 1;
        dailyMoodRefs.push(mood.deltaId);
        continuityEvidenceRefs.push(...(mood.evidenceRefs ?? []));
        continuityResponseRefs.push(...(mood.responseRefs ?? []));
        if (mood.sourceRef) {
          continuitySourceRefs.push(mood.sourceRef);
        }
        if (mood.status === "accepted") {
          acceptedDailyMoodCount += 1;
          acceptedDailyMoodRefs.push(mood.deltaId);
        }
        if (!mood.sourceRef || (mood.evidenceRefs ?? []).length === 0 || (mood.status === "accepted" && (mood.responseRefs ?? []).length === 0)) {
          continuityItemsWithoutEvidenceRefs.push(mood.deltaId);
        }
      }
    }
  }

  return {
    archiveCount: archives.length,
    archivesWithContinuity,
    continuityArchiveRefs: uniqueStrings(continuityArchiveRefs),
    roleClaimCount,
    roleClaimRefs: uniqueStrings(roleClaimRefs),
    dailyMoodCount,
    dailyMoodRefs: uniqueStrings(dailyMoodRefs),
    acceptedRoleClaimCount,
    acceptedRoleClaimRefs: uniqueStrings(acceptedRoleClaimRefs),
    acceptedDailyMoodCount,
    acceptedDailyMoodRefs: uniqueStrings(acceptedDailyMoodRefs),
    continuityEvidenceRefs: uniqueStrings(continuityEvidenceRefs),
    continuityResponseRefs: uniqueStrings(continuityResponseRefs),
    continuitySourceRefs: uniqueStrings(continuitySourceRefs),
    continuityEventRefs: uniqueStrings(continuityEventRefs),
    continuityItemsWithoutEvidenceRefs: uniqueStrings(continuityItemsWithoutEvidenceRefs),
    ok:
      archives.length > 0 &&
      archivesWithContinuity > 0 &&
      roleClaimCount > 0 &&
      dailyMoodCount > 0 &&
      acceptedRoleClaimCount > 0 &&
      acceptedDailyMoodCount > 0 &&
      continuityItemsWithoutEvidenceRefs.length === 0,
  };
}

function summarizeArchiveEvidence(events: readonly RoomEvent[]): LongRunHarnessReport["archiveEvidence"] {
  const archiveEventRefs: string[] = [];
  const archiveRefs: string[] = [];
  const ledgerEvidenceRefs: string[] = [];
  let acceptedMemoryArchiveCount = 0;
  const acceptedMemoryArchiveRefs: string[] = [];
  const acceptedMemoryArchiveEvidenceRefs: string[] = [];
  const acceptedMemoryArchivesWithoutEvidenceRefs: string[] = [];
  const archivesWithoutLedgerRange: string[] = [];
  const archivesWithoutEventCounts: string[] = [];
  const archivesWithoutLedgerEvidenceRefs: string[] = [];

  for (const event of events) {
    if (event.event_type !== "daily_archive.created") continue;
    archiveEventRefs.push(event.event_id);
    const payload = archivePayloadForEvidence(event);
    const archiveRef = archiveRefFromArchivePayload(event, payload);
    archiveRefs.push(archiveRef);

    if (!archivePayloadHasValidLedgerRange(payload)) {
      archivesWithoutLedgerRange.push(archiveRef);
    }
    if (archivePayloadEventCount(payload) === 0) {
      archivesWithoutEventCounts.push(archiveRef);
    }

    const refs = archiveLedgerEvidenceRefs(event, payload);
    ledgerEvidenceRefs.push(...refs);
    if (refs.length === 0) {
      archivesWithoutLedgerEvidenceRefs.push(archiveRef);
    }

    for (const change of archiveAcceptedMemoryChanges(payload)) {
      acceptedMemoryArchiveCount += 1;
      acceptedMemoryArchiveRefs.push(archiveRef, change.memoryRef);
      acceptedMemoryArchiveEvidenceRefs.push(...change.evidenceRefs);
      if (change.evidenceRefs.length === 0) {
        acceptedMemoryArchivesWithoutEvidenceRefs.push(`${archiveRef}:${change.memoryRef}`);
      }
    }
  }

  return {
    archiveEventRefs: uniqueStrings(archiveEventRefs),
    archiveRefs: uniqueStrings(archiveRefs),
    ledgerEvidenceRefs: uniqueStrings(ledgerEvidenceRefs),
    acceptedMemoryArchiveCount,
    acceptedMemoryArchiveRefs: uniqueStrings(acceptedMemoryArchiveRefs),
    acceptedMemoryArchiveEvidenceRefs: uniqueStrings(acceptedMemoryArchiveEvidenceRefs),
    acceptedMemoryArchivesWithoutEvidenceRefs: uniqueStrings(acceptedMemoryArchivesWithoutEvidenceRefs),
    archivesWithoutLedgerRange: uniqueStrings(archivesWithoutLedgerRange),
    archivesWithoutEventCounts: uniqueStrings(archivesWithoutEventCounts),
    archivesWithoutLedgerEvidenceRefs: uniqueStrings(archivesWithoutLedgerEvidenceRefs),
    ok:
      archiveEventRefs.length > 0 &&
      acceptedMemoryArchiveCount > 0 &&
      acceptedMemoryArchivesWithoutEvidenceRefs.length === 0 &&
      archivesWithoutLedgerRange.length === 0 &&
      archivesWithoutEventCounts.length === 0 &&
      archivesWithoutLedgerEvidenceRefs.length === 0,
  };
}

function archiveAcceptedMemoryChanges(payload: Record<string, unknown>): { memoryRef: string; evidenceRefs: string[] }[] {
  return arrayOfObjects(payload.memoryChanges)
    .concat(arrayOfObjects(payload.memory_changes))
    .filter((change) => (stringValue(change.toState) ?? stringValue(change.to_state)) === "accepted")
    .map((change) => {
      const memoryRef =
        stringValue(change.memoryId) ??
        stringValue(change.memory_id) ??
        stringValue(change.memoryRef) ??
        stringValue(change.memory_ref) ??
        "memory_accepted";
      const evidenceRefs = uniqueStrings(
        arrayOfStrings(change.sourceRefs)
          .concat(arrayOfStrings(change.source_refs))
          .concat(arrayOfStrings(change.eventIds))
          .concat(arrayOfStrings(change.event_ids))
          .concat([stringValue(change.eventId), stringValue(change.event_id)].filter((ref): ref is string => !!ref)),
      ).filter((ref) => ref !== memoryRef);
      return { memoryRef, evidenceRefs };
    });
}

function archivePayloadForEvidence(event: RoomEvent): Record<string, unknown> {
  const payload = objectPayload(event.payload);
  const archive = objectPayload(payload.archive);
  return Object.keys(archive).length > 0 ? { ...payload, ...archive } : payload;
}

function archiveRefFromArchivePayload(event: RoomEvent, payload: Record<string, unknown>): string {
  return stringValue(payload.archiveId) ?? stringValue(payload.archive_id) ?? stringValue(payload.date) ?? event.event_id;
}

function archivePayloadHasValidLedgerRange(payload: Record<string, unknown>): boolean {
  const range = objectPayload(payload.inputLedgerRange);
  const legacyRange = objectPayload(payload.input_ledger_range);
  const selectedRange = Object.keys(range).length > 0 ? range : legacyRange;
  if (Object.keys(selectedRange).length === 0) return false;
  const fromOffset = numberValue(selectedRange.fromOffset) ?? numberValue(selectedRange.from_offset);
  const toOffset = numberValue(selectedRange.toOffset) ?? numberValue(selectedRange.to_offset);
  return fromOffset !== undefined && toOffset !== undefined && fromOffset >= 0 && toOffset >= fromOffset;
}

function archivePayloadEventCount(payload: Record<string, unknown>): number {
  const eventCounts = objectOfNumbers(payload.eventCounts) ?? objectOfNumbers(payload.event_counts) ?? {};
  return Object.values(eventCounts).reduce((sum, count) => sum + count, 0);
}

function archiveLedgerEvidenceRefs(event: RoomEvent, payload: Record<string, unknown>): string[] {
  const refs = collectArchiveEvidenceRefs(payload);
  const archiveRef = archiveRefFromArchivePayload(event, payload);
  return uniqueStrings(refs.filter((ref) => ref !== archiveRef && ref !== event.event_id));
}

function collectArchiveEvidenceRefs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectArchiveEvidenceRefs(item));
  }
  const object = objectPayload(value);
  if (Object.keys(object).length === 0) {
    return [];
  }

  const refs: string[] = [];
  for (const [key, item] of Object.entries(object)) {
    if (isArchiveEvidenceRefArrayKey(key)) {
      refs.push(...arrayOfStrings(item));
      continue;
    }
    if (isArchiveEvidenceRefStringKey(key)) {
      const ref = stringValue(item);
      if (ref) refs.push(ref);
      continue;
    }
    refs.push(...collectArchiveEvidenceRefs(item));
  }
  return uniqueStrings(refs);
}

function isArchiveEvidenceRefArrayKey(key: string): boolean {
  return (
    key === "sourceRefs" ||
    key === "source_refs" ||
    key === "eventIds" ||
    key === "event_ids" ||
    key === "provenanceRefs" ||
    key === "provenance_refs"
  );
}

function isArchiveEvidenceRefStringKey(key: string): boolean {
  return key === "sourceRef" || key === "source_ref" || key === "eventId" || key === "event_id";
}

function summarizeLongTermRhythm(events: readonly RoomEvent[]): LongRunHarnessReport["longTermRhythm"] {
  let archiveActionCount = 0;
  const archiveActionRefs: string[] = [];
  const archiveActionMessageRefs: string[] = [];
  const archiveActionArchiveRefs: string[] = [];
  const archiveActionReviewRequestRefs: string[] = [];
  const archiveActionEvidenceRefs: string[] = [];
  const archiveActionsMissingMaterialRefs: string[] = [];
  let archiveReviewActionCount = 0;
  const archiveReviewActionRefs: string[] = [];
  let memoryHygieneActionCount = 0;
  const memoryHygieneActionRefs: string[] = [];
  const memoryHygieneMessageRefs: string[] = [];
  const memoryHygieneTargetRefs: string[] = [];
  const memoryHygieneEvidenceRefs: string[] = [];
  const memoryHygieneActionsMissingTargetRefs: string[] = [];
  let continuityReviewActionCount = 0;
  const continuityReviewActionRefs: string[] = [];
  const continuityReviewMessageRefs: string[] = [];
  const continuityReviewTargetRefs: string[] = [];
  const continuityReviewEvidenceRefs: string[] = [];
  const continuityReviewActionsMissingTargetRefs: string[] = [];
  let providerBoundaryReviewActionCount = 0;
  const providerBoundaryReviewActionRefs: string[] = [];
  const providerBoundaryReviewMessageRefs: string[] = [];
  const providerBoundaryReviewTargetRefs: string[] = [];
  const providerBoundaryReviewEvidenceRefs: string[] = [];
  const providerBoundaryReviewActionsMissingTargetRefs: string[] = [];
  let openQuestionRevisitActionCount = 0;
  const openQuestionRevisitActionRefs: string[] = [];
  const openQuestionRevisitMessageRefs: string[] = [];
  const openQuestionRevisitTargetRefs: string[] = [];
  const openQuestionRevisitEvidenceRefs: string[] = [];
  const openQuestionRevisitActionsMissingTargetRefs: string[] = [];
  let handoffReviewActionCount = 0;
  const handoffReviewActionRefs: string[] = [];
  const handoffReviewMessageRefs: string[] = [];
  const handoffReviewTargetRefs: string[] = [];
  const handoffReviewEvidenceRefs: string[] = [];
  const handoffReviewActionsMissingTargetRefs: string[] = [];
  let invitationReviewActionCount = 0;
  const invitationReviewActionRefs: string[] = [];
  const invitationReviewMessageRefs: string[] = [];
  const invitationReviewTargetRefs: string[] = [];
  const invitationReviewEvidenceRefs: string[] = [];
  const invitationReviewActionsMissingTargetRefs: string[] = [];
  let idleSocialActionCount = 0;
  const idleSocialActionRefs: string[] = [];
  const idleSocialMessageRefs: string[] = [];
  const idleSocialTargetRefs: string[] = [];
  const idleSocialEvidenceRefs: string[] = [];
  const idleSocialActionsMissingTargetRefs: string[] = [];
  let silenceReentryActionCount = 0;
  const silenceReentryActionRefs: string[] = [];
  const silenceReentryMessageRefs: string[] = [];
  const silenceReentryAnchorRefs: string[] = [];
  const silenceReentryArchiveRefs: string[] = [];
  const silenceReentryEvidenceRefs: string[] = [];
  const silenceReentryActionsMissingAnchorRefs: string[] = [];
  const silenceReentryPreservedSilenceRefs: string[] = [];
  const silenceReentryActionsMissingPreservedSilenceRefs: string[] = [];
  let preservedSilenceActionCount = 0;
  const preservedSilenceActionRefs: string[] = [];
  const seenPreservedSilenceRefs = new Set<string>();
  let deliberateSilenceIntentionCount = 0;
  const deliberateSilenceIntentionRefs: string[] = [];
  const choiceSetTargetRefs: string[] = [];
  const choiceSetEvidenceRefs: string[] = [];
  const choiceSetOptionsWithoutEvidenceRefs: string[] = [];
  const choiceSetTargetedOptionsWithoutTargetRefs: string[] = [];
  const actionsMissingChoiceSetRefs: string[] = [];
  const actionsMissingSelectedChoiceRefs: string[] = [];
  const actionsMissingEvidenceRefs: string[] = [];

  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "room.autonomy_tick") {
      const action = stringValue(payload.action) ?? "unknown";
      const contextRefs = arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs));
      const targetRefs = arrayOfStrings(payload.targetRefs).concat(arrayOfStrings(payload.target_refs));
      const evidenceRefs = arrayOfStrings(payload.evidenceRefs).concat(arrayOfStrings(payload.evidence_refs), event.refs);
      const messageEventId = stringValue(payload.messageEventId) ?? stringValue(payload.message_event_id);
      const archiveRef = stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref);
      const reviewRequestRef = stringValue(payload.reviewRequestRef) ?? stringValue(payload.review_request_ref);
      const tickId = stringValue(payload.tickId) ?? stringValue(payload.tick_id) ?? event.event_id;
      const choiceSet = autonomyChoiceSetFromPayload(payload.choiceSet ?? payload.choice_set);
      choiceSetTargetRefs.push(...choiceSet.flatMap((choice) => choice.targetRefs));
      choiceSetEvidenceRefs.push(...choiceSet.flatMap((choice) => choice.evidenceRefs));
      for (const choice of choiceSet) {
        const optionRef = `${choice.action}:${tickId}`;
        if (choice.evidenceRefs.length === 0) {
          choiceSetOptionsWithoutEvidenceRefs.push(optionRef);
        }
        if (choice.action !== "stay_silent" && choice.targetRefs.length === 0) {
          choiceSetTargetedOptionsWithoutTargetRefs.push(optionRef);
        }
      }
      if (choiceSet.length === 0) {
        actionsMissingChoiceSetRefs.push(`${action}:${tickId}`);
      } else if (!choiceSet.some((choice) => choice.action === action)) {
        actionsMissingSelectedChoiceRefs.push(`${action}:${tickId}`);
      }
      if (action === "archive_and_invite_review") {
        archiveActionCount += 1;
        archiveActionRefs.push(event.event_id);
        if (messageEventId) {
          archiveActionMessageRefs.push(messageEventId);
        }
        if (archiveRef) {
          archiveActionArchiveRefs.push(archiveRef);
        }
        if (reviewRequestRef) {
          archiveActionReviewRequestRefs.push(reviewRequestRef);
        }
        archiveActionEvidenceRefs.push(...evidenceRefs);
        if (!messageEventId || !archiveRef || !reviewRequestRef || evidenceRefs.length === 0) {
          archiveActionsMissingMaterialRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "review_open_archive") {
        archiveReviewActionCount += 1;
        archiveReviewActionRefs.push(event.event_id);
      }
      if (action === "memory_hygiene_review") {
        memoryHygieneActionCount += 1;
        memoryHygieneActionRefs.push(event.event_id);
        if (messageEventId) {
          memoryHygieneMessageRefs.push(messageEventId);
        }
        memoryHygieneTargetRefs.push(...targetRefs);
        memoryHygieneEvidenceRefs.push(...evidenceRefs);
        if (targetRefs.length === 0) {
          memoryHygieneActionsMissingTargetRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "continuity_review") {
        continuityReviewActionCount += 1;
        continuityReviewActionRefs.push(event.event_id);
        if (messageEventId) {
          continuityReviewMessageRefs.push(messageEventId);
        }
        continuityReviewTargetRefs.push(...targetRefs);
        continuityReviewEvidenceRefs.push(...evidenceRefs);
        if (targetRefs.length === 0) {
          continuityReviewActionsMissingTargetRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "provider_boundary_review") {
        providerBoundaryReviewActionCount += 1;
        providerBoundaryReviewActionRefs.push(event.event_id);
        if (messageEventId) {
          providerBoundaryReviewMessageRefs.push(messageEventId);
        }
        providerBoundaryReviewTargetRefs.push(...targetRefs);
        providerBoundaryReviewEvidenceRefs.push(...evidenceRefs);
        if (targetRefs.length === 0) {
          providerBoundaryReviewActionsMissingTargetRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "open_question_revisit") {
        openQuestionRevisitActionCount += 1;
        openQuestionRevisitActionRefs.push(event.event_id);
        if (messageEventId) {
          openQuestionRevisitMessageRefs.push(messageEventId);
        }
        openQuestionRevisitTargetRefs.push(...targetRefs);
        openQuestionRevisitEvidenceRefs.push(...evidenceRefs);
        if (targetRefs.length === 0) {
          openQuestionRevisitActionsMissingTargetRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "handoff_review") {
        handoffReviewActionCount += 1;
        handoffReviewActionRefs.push(event.event_id);
        if (messageEventId) {
          handoffReviewMessageRefs.push(messageEventId);
        }
        handoffReviewTargetRefs.push(...targetRefs);
        handoffReviewEvidenceRefs.push(...evidenceRefs);
        if (targetRefs.length === 0) {
          handoffReviewActionsMissingTargetRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "invitation_review") {
        invitationReviewActionCount += 1;
        invitationReviewActionRefs.push(event.event_id);
        if (messageEventId) {
          invitationReviewMessageRefs.push(messageEventId);
        }
        invitationReviewTargetRefs.push(...targetRefs);
        invitationReviewEvidenceRefs.push(...evidenceRefs);
        if (targetRefs.length === 0) {
          invitationReviewActionsMissingTargetRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "idle_social_rhythm") {
        idleSocialActionCount += 1;
        idleSocialActionRefs.push(event.event_id);
        if (messageEventId) {
          idleSocialMessageRefs.push(messageEventId);
        }
        idleSocialTargetRefs.push(...targetRefs);
        idleSocialEvidenceRefs.push(...evidenceRefs);
        if (targetRefs.length === 0) {
          idleSocialActionsMissingTargetRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "silence_reentry") {
        silenceReentryActionCount += 1;
        silenceReentryActionRefs.push(event.event_id);
        if (messageEventId) {
          silenceReentryMessageRefs.push(messageEventId);
        }
        if (archiveRef) {
          silenceReentryArchiveRefs.push(archiveRef);
        }
        silenceReentryEvidenceRefs.push(...evidenceRefs);
        const explicitAnchorRef = stringValue(payload.anchorEventId) ?? stringValue(payload.anchor_event_id);
        const anchorRefs = uniqueStrings(
          [
            explicitAnchorRef,
            ...contextRefs,
            ...evidenceRefs,
          ].filter(
            (ref): ref is string =>
              typeof ref === "string" &&
              ref.length > 0 &&
              ref !== messageEventId &&
              ref !== archiveRef &&
              ref !== reviewRequestRef &&
              ref !== event.event_id &&
              ref !== tickId,
          ),
        );
        silenceReentryAnchorRefs.push(...anchorRefs);
        const preservedAnchorRefs = anchorRefs.filter((ref) => seenPreservedSilenceRefs.has(ref));
        silenceReentryPreservedSilenceRefs.push(...preservedAnchorRefs);
        if (anchorRefs.length === 0) {
          silenceReentryActionsMissingAnchorRefs.push(`${action}:${tickId}`);
        }
        if (preservedAnchorRefs.length === 0) {
          silenceReentryActionsMissingPreservedSilenceRefs.push(`${action}:${tickId}`);
        }
      }
      if (action === "stay_silent") {
        preservedSilenceActionCount += 1;
        preservedSilenceActionRefs.push(event.event_id);
        seenPreservedSilenceRefs.add(event.event_id);
        seenPreservedSilenceRefs.add(tickId);
      }
      if (action !== "stay_silent" && evidenceRefs.length === 0) {
        actionsMissingEvidenceRefs.push(`${action}:${tickId}`);
      }
    }
    if (event.event_type === "agent.intention_recorded" && objectPayload(payload.intention).kind === "stay_silent") {
      deliberateSilenceIntentionCount += 1;
      deliberateSilenceIntentionRefs.push(event.event_id);
    }
  }

  const archiveReviewLedgerEventRefs = events
    .filter((event) => isArchiveReviewLedgerEventType(event.event_type))
    .map((event) => event.event_id);
  const memoryHygieneLedgerEventRefs = events
    .filter((event) => isMemoryHygieneLedgerEventType(event.event_type))
    .map((event) => event.event_id);

  return {
    archiveActionCount,
    archiveActionRefs: uniqueStrings(archiveActionRefs),
    archiveActionMessageRefs: uniqueStrings(archiveActionMessageRefs),
    archiveActionArchiveRefs: uniqueStrings(archiveActionArchiveRefs),
    archiveActionReviewRequestRefs: uniqueStrings(archiveActionReviewRequestRefs),
    archiveActionEvidenceRefs: uniqueStrings(archiveActionEvidenceRefs),
    archiveActionsMissingMaterialRefs: uniqueStrings(archiveActionsMissingMaterialRefs),
    archiveReviewActionCount,
    archiveReviewLedgerEventCount: archiveReviewLedgerEventRefs.length,
    archiveReviewActionRefs: uniqueStrings(archiveReviewActionRefs),
    archiveReviewLedgerEventRefs: uniqueStrings(archiveReviewLedgerEventRefs),
    memoryHygieneActionCount,
    memoryHygieneLedgerEventCount: memoryHygieneLedgerEventRefs.length,
    memoryHygieneActionRefs: uniqueStrings(memoryHygieneActionRefs),
    memoryHygieneLedgerEventRefs: uniqueStrings(memoryHygieneLedgerEventRefs),
    memoryHygieneMessageRefs: uniqueStrings(memoryHygieneMessageRefs),
    memoryHygieneTargetRefs: uniqueStrings(memoryHygieneTargetRefs),
    memoryHygieneEvidenceRefs: uniqueStrings(memoryHygieneEvidenceRefs),
    memoryHygieneActionsMissingTargetRefs: uniqueStrings(memoryHygieneActionsMissingTargetRefs),
    continuityReviewActionCount,
    continuityReviewActionRefs: uniqueStrings(continuityReviewActionRefs),
    continuityReviewMessageRefs: uniqueStrings(continuityReviewMessageRefs),
    continuityReviewTargetRefs: uniqueStrings(continuityReviewTargetRefs),
    continuityReviewEvidenceRefs: uniqueStrings(continuityReviewEvidenceRefs),
    continuityReviewActionsMissingTargetRefs: uniqueStrings(continuityReviewActionsMissingTargetRefs),
    providerBoundaryReviewActionCount,
    providerBoundaryReviewActionRefs: uniqueStrings(providerBoundaryReviewActionRefs),
    providerBoundaryReviewMessageRefs: uniqueStrings(providerBoundaryReviewMessageRefs),
    providerBoundaryReviewTargetRefs: uniqueStrings(providerBoundaryReviewTargetRefs),
    providerBoundaryReviewEvidenceRefs: uniqueStrings(providerBoundaryReviewEvidenceRefs),
    providerBoundaryReviewActionsMissingTargetRefs: uniqueStrings(providerBoundaryReviewActionsMissingTargetRefs),
    openQuestionRevisitActionCount,
    openQuestionRevisitActionRefs: uniqueStrings(openQuestionRevisitActionRefs),
    openQuestionRevisitMessageRefs: uniqueStrings(openQuestionRevisitMessageRefs),
    openQuestionRevisitTargetRefs: uniqueStrings(openQuestionRevisitTargetRefs),
    openQuestionRevisitEvidenceRefs: uniqueStrings(openQuestionRevisitEvidenceRefs),
    openQuestionRevisitActionsMissingTargetRefs: uniqueStrings(openQuestionRevisitActionsMissingTargetRefs),
    handoffReviewActionCount,
    handoffReviewActionRefs: uniqueStrings(handoffReviewActionRefs),
    handoffReviewMessageRefs: uniqueStrings(handoffReviewMessageRefs),
    handoffReviewTargetRefs: uniqueStrings(handoffReviewTargetRefs),
    handoffReviewEvidenceRefs: uniqueStrings(handoffReviewEvidenceRefs),
    handoffReviewActionsMissingTargetRefs: uniqueStrings(handoffReviewActionsMissingTargetRefs),
    invitationReviewActionCount,
    invitationReviewActionRefs: uniqueStrings(invitationReviewActionRefs),
    invitationReviewMessageRefs: uniqueStrings(invitationReviewMessageRefs),
    invitationReviewTargetRefs: uniqueStrings(invitationReviewTargetRefs),
    invitationReviewEvidenceRefs: uniqueStrings(invitationReviewEvidenceRefs),
    invitationReviewActionsMissingTargetRefs: uniqueStrings(invitationReviewActionsMissingTargetRefs),
    idleSocialActionCount,
    idleSocialActionRefs: uniqueStrings(idleSocialActionRefs),
    idleSocialMessageRefs: uniqueStrings(idleSocialMessageRefs),
    idleSocialTargetRefs: uniqueStrings(idleSocialTargetRefs),
    idleSocialEvidenceRefs: uniqueStrings(idleSocialEvidenceRefs),
    idleSocialActionsMissingTargetRefs: uniqueStrings(idleSocialActionsMissingTargetRefs),
    silenceReentryActionCount,
    silenceReentryActionRefs: uniqueStrings(silenceReentryActionRefs),
    silenceReentryMessageRefs: uniqueStrings(silenceReentryMessageRefs),
    silenceReentryAnchorRefs: uniqueStrings(silenceReentryAnchorRefs),
    silenceReentryArchiveRefs: uniqueStrings(silenceReentryArchiveRefs),
    silenceReentryEvidenceRefs: uniqueStrings(silenceReentryEvidenceRefs),
    silenceReentryActionsMissingAnchorRefs: uniqueStrings(silenceReentryActionsMissingAnchorRefs),
    silenceReentryPreservedSilenceRefs: uniqueStrings(silenceReentryPreservedSilenceRefs),
    silenceReentryActionsMissingPreservedSilenceRefs: uniqueStrings(silenceReentryActionsMissingPreservedSilenceRefs),
    preservedSilenceActionCount,
    preservedSilenceActionRefs: uniqueStrings(preservedSilenceActionRefs),
    deliberateSilenceIntentionCount,
    deliberateSilenceIntentionRefs: uniqueStrings(deliberateSilenceIntentionRefs),
    choiceSetTargetRefs: uniqueStrings(choiceSetTargetRefs),
    choiceSetEvidenceRefs: uniqueStrings(choiceSetEvidenceRefs),
    choiceSetOptionsWithoutEvidenceRefs: uniqueStrings(choiceSetOptionsWithoutEvidenceRefs),
    choiceSetTargetedOptionsWithoutTargetRefs: uniqueStrings(choiceSetTargetedOptionsWithoutTargetRefs),
    actionsMissingChoiceSetRefs: uniqueStrings(actionsMissingChoiceSetRefs),
    actionsMissingSelectedChoiceRefs: uniqueStrings(actionsMissingSelectedChoiceRefs),
    actionsMissingEvidenceRefs: uniqueStrings(actionsMissingEvidenceRefs),
    ok:
      archiveActionRefs.length + archiveReviewActionRefs.length > 0 &&
      archiveActionRefs.length > 0 &&
      archiveActionMessageRefs.length > 0 &&
      archiveActionArchiveRefs.length > 0 &&
      archiveActionReviewRequestRefs.length > 0 &&
      archiveActionEvidenceRefs.length > 0 &&
      archiveActionsMissingMaterialRefs.length === 0 &&
      archiveReviewLedgerEventRefs.length > 0 &&
      memoryHygieneActionRefs.length > 0 &&
      memoryHygieneMessageRefs.length > 0 &&
      memoryHygieneTargetRefs.length > 0 &&
      memoryHygieneEvidenceRefs.length > 0 &&
      memoryHygieneActionsMissingTargetRefs.length === 0 &&
      memoryHygieneLedgerEventRefs.length > 0 &&
      continuityReviewActionRefs.length > 0 &&
      continuityReviewMessageRefs.length > 0 &&
      continuityReviewTargetRefs.length > 0 &&
      continuityReviewEvidenceRefs.length > 0 &&
      continuityReviewActionsMissingTargetRefs.length === 0 &&
      providerBoundaryReviewActionRefs.length > 0 &&
      providerBoundaryReviewMessageRefs.length > 0 &&
      providerBoundaryReviewTargetRefs.length > 0 &&
      providerBoundaryReviewEvidenceRefs.length > 0 &&
      providerBoundaryReviewActionsMissingTargetRefs.length === 0 &&
      openQuestionRevisitActionRefs.length > 0 &&
      openQuestionRevisitMessageRefs.length > 0 &&
      openQuestionRevisitTargetRefs.length > 0 &&
      openQuestionRevisitEvidenceRefs.length > 0 &&
      openQuestionRevisitActionsMissingTargetRefs.length === 0 &&
      handoffReviewActionRefs.length > 0 &&
      handoffReviewMessageRefs.length > 0 &&
      handoffReviewTargetRefs.length > 0 &&
      handoffReviewEvidenceRefs.length > 0 &&
      handoffReviewActionsMissingTargetRefs.length === 0 &&
      invitationReviewActionRefs.length > 0 &&
      invitationReviewMessageRefs.length > 0 &&
      invitationReviewTargetRefs.length > 0 &&
      invitationReviewEvidenceRefs.length > 0 &&
      invitationReviewActionsMissingTargetRefs.length === 0 &&
      idleSocialActionRefs.length > 0 &&
      idleSocialMessageRefs.length > 0 &&
      idleSocialTargetRefs.length > 0 &&
      idleSocialEvidenceRefs.length > 0 &&
      idleSocialActionsMissingTargetRefs.length === 0 &&
      silenceReentryActionRefs.length > 0 &&
      silenceReentryActionsMissingAnchorRefs.length === 0 &&
      silenceReentryPreservedSilenceRefs.length > 0 &&
      silenceReentryActionsMissingPreservedSilenceRefs.length === 0 &&
      preservedSilenceActionRefs.length > 0 &&
      choiceSetOptionsWithoutEvidenceRefs.length === 0 &&
      choiceSetTargetedOptionsWithoutTargetRefs.length === 0 &&
      actionsMissingChoiceSetRefs.length === 0 &&
      actionsMissingSelectedChoiceRefs.length === 0 &&
      actionsMissingEvidenceRefs.length === 0,
  };
}

function isArchiveReviewLedgerEventType(eventType: string): boolean {
  return (
    eventType === "archive.review_requested" ||
    eventType === "archive.reviewed" ||
    eventType === "archive.repair_proposed" ||
    eventType === "archive.repair_responded" ||
    eventType === "archive.repair_reviewed" ||
    eventType === "archive.repair_applied"
  );
}

function isMemoryHygieneLedgerEventType(eventType: string): boolean {
  return (
    eventType === "memory.contested" ||
    eventType === "memory.reviewed" ||
    eventType === "memory.accepted" ||
    eventType === "memory.stale" ||
    eventType === "memory.retired" ||
    eventType === "room.memory_pressure_detected"
  );
}

function summarizeActionBoundary(events: readonly RoomEvent[], state: RuntimeRoomState): LongRunHarnessReport["actionBoundary"] {
  const sideEffectResultEvents = events.filter((event) => event.event_type === "side_effect.result_reported");
  const approvedRefs = new Set(
    events
      .filter((event) => event.event_type === "side_effect.approved")
      .flatMap((event) => {
        const payload = objectPayload(event.payload);
        return [stringValue(payload.approvalId), stringValue(payload.requestId), ...event.refs];
      })
      .filter((ref): ref is string => Boolean(ref)),
  );
  const unapprovedSideEffectResultRefs = sideEffectResultEvents
    .filter((event) => {
      const payload = objectPayload(event.payload);
      const approvalRef = stringValue(payload.approvalId) ?? stringValue(payload.requestId);
      return !approvalRef || !approvedRefs.has(approvalRef);
    })
    .map((event) => event.event_id);
  const actionBoundary = {
    sideEffectRequestRefs: refsForEvents(events, "side_effect.requested", ["requestId"]),
    sideEffectReviewRefs: refsForEvents(events, "side_effect.reviewed", ["reviewId", "sideEffectRef", "requestId"]),
    sideEffectApprovalRefs: refsForEvents(events, "side_effect.approved", ["approvalId", "requestId"]),
    sideEffectDeniedRefs: refsForEvents(events, "side_effect.denied", ["approvalId", "requestId"]),
    sideEffectExpiredRefs: refsForEvents(events, "side_effect.expired", ["approvalId", "requestId"]),
    sideEffectResultRefs: refsForEvents(events, "side_effect.result_reported", ["resultId", "approvalId", "requestId"]),
    unapprovedSideEffectResultRefs: uniqueStrings(unapprovedSideEffectResultRefs),
    capabilityInvocationRefs: eventIdsForType(events, "capability.invoked"),
    capabilityResultRefs: eventIdsForType(events, "capability.result"),
    workspaceArtifactRefs: refsForEvents(events, "workspace.artifact_shared", ["artifactId"]),
    workspaceArtifactReviewRefs: refsForEvents(events, "workspace.artifact_reviewed", ["reviewId", "artifactRef"]),
    skillCapsuleReviewRefs: refsForEvents(events, "skill.capsule_reviewed", ["reviewId", "capsuleRef"]),
    capabilityReviewRefs: refsForEvents(events, "capability.reviewed", ["reviewId", "capabilityRef"]),
    contextBoundaryRefs: actionBoundaryContextRefs(state),
  };
  return {
    ...actionBoundary,
    ok:
      actionBoundary.sideEffectRequestRefs.length > 0 &&
      actionBoundary.sideEffectReviewRefs.length > 0 &&
      actionBoundary.unapprovedSideEffectResultRefs.length === 0 &&
      actionBoundary.capabilityInvocationRefs.length > 0 &&
      actionBoundary.capabilityResultRefs.length > 0 &&
      actionBoundary.workspaceArtifactRefs.length > 0 &&
      actionBoundary.workspaceArtifactReviewRefs.length > 0 &&
      actionBoundary.skillCapsuleReviewRefs.length > 0 &&
      actionBoundary.capabilityReviewRefs.length > 0 &&
      actionBoundary.contextBoundaryRefs.length > 0,
  };
}

function actionBoundaryEvidenceGapCount(actionBoundary: LongRunHarnessReport["actionBoundary"]): number {
  return [
    actionBoundary.sideEffectRequestRefs.length === 0,
    actionBoundary.sideEffectReviewRefs.length === 0,
    actionBoundary.unapprovedSideEffectResultRefs.length > 0,
    actionBoundary.capabilityInvocationRefs.length === 0 || actionBoundary.capabilityResultRefs.length === 0,
    actionBoundary.workspaceArtifactRefs.length === 0 || actionBoundary.workspaceArtifactReviewRefs.length === 0,
    actionBoundary.skillCapsuleReviewRefs.length === 0,
    actionBoundary.capabilityReviewRefs.length === 0,
    actionBoundary.contextBoundaryRefs.length === 0,
  ].filter(Boolean).length;
}

function refsForEvents(events: readonly RoomEvent[], eventType: string, payloadKeys: readonly string[]): string[] {
  return uniqueStrings(
    events
      .filter((event) => event.event_type === eventType)
      .map((event) => {
        const payload = objectPayload(event.payload);
        return payloadKeys.map((key) => stringValue(payload[key])).find((ref): ref is string => Boolean(ref)) ?? event.event_id;
      }),
  );
}

function eventIdsForType(events: readonly RoomEvent[], eventType: string): string[] {
  return uniqueStrings(events.filter((event) => event.event_type === eventType).map((event) => event.event_id));
}

function actionBoundaryContextRefs(state: RuntimeRoomState): string[] {
  const auditRefs = auditContextRefsForTypes(state.contextAudits ?? [], [
    "side_effect_boundary",
    "workspace_artifact_ref",
    "skill_capsule_ref",
    "capability_ref",
  ]);
  const socialRefs = [
    ...(state.socialState.sideEffects ?? []).flatMap((sideEffect) => [sideEffect.requestId, sideEffect.approvalId]),
    ...(state.socialState.sideEffectReviews ?? []).flatMap((review) => [review.reviewId, review.sideEffectRef]),
    ...(state.socialState.workspaces ?? []).flatMap((workspace) => workspace.sharedArtifactRefs ?? []),
    ...(state.socialState.workspaceArtifactReviews ?? []).flatMap((review) => [review.reviewId, review.artifactRef]),
    ...(state.socialState.skillCapsuleReviews ?? []).flatMap((review) => [review.reviewId, review.capsuleRef]),
    ...(state.socialState.capabilityReviews ?? []).flatMap((review) => [review.reviewId, review.capabilityRef]),
  ].filter((ref): ref is string => Boolean(ref));
  return uniqueStrings([...auditRefs, ...socialRefs]);
}

function auditContextRefsForTypes(
  audits: readonly RuntimeRoomState["contextAudits"][number][],
  types: readonly string[],
): string[] {
  const typeSet = new Set(types);
  return uniqueStrings(
    audits.flatMap((audit) =>
      (audit.selectedFragments ?? [])
        .filter((fragment) => typeSet.has(fragment.type))
        .flatMap((fragment) => fragment.refs ?? []),
    ),
  );
}

function autonomyChoiceSetFromPayload(value: unknown): { action: string; targetRefs: string[]; evidenceRefs: string[] }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const payload = objectPayload(item);
    return {
      action: stringValue(payload.action) ?? "unknown",
      targetRefs: uniqueStrings(arrayOfStrings(payload.targetRefs).concat(arrayOfStrings(payload.target_refs))),
      evidenceRefs: uniqueStrings(arrayOfStrings(payload.evidenceRefs).concat(arrayOfStrings(payload.evidence_refs))),
    };
  });
}

function summarizeWorkflowDrift(events: readonly RoomEvent[]): LongRunHarnessReport["workflowDrift"] {
  const forbiddenSchedulerEvents = events
    .filter((event) => event.event_type === "scheduler.assigned_speaker" || event.event_type === "workflow.assigned_owner")
    .map((event) => event.event_id);
  const forcedSpeechAssertion = assertNoForcedSpeech(events);
  const forcedSpeechEventRefs = forcedSpeechAssertion.ok ? [] : forcedSpeechAssertion.eventIds;
  const stringMarkerRefs = events
    .filter((event) => JSON.stringify(event.payload).includes("must_speak"))
    .map((event) => event.event_id);
  const sideEffectExecutionRefs = events
    .filter((event) => event.event_type === "side_effect.result_reported")
    .map((event) => event.event_id);
  return {
    forbiddenSchedulerEvents,
    forcedSpeechMarkers: uniqueStrings(forcedSpeechEventRefs.concat(stringMarkerRefs)).length,
    forcedSpeechEventRefs: uniqueStrings(forcedSpeechEventRefs.concat(stringMarkerRefs)),
    sideEffectExecutions: sideEffectExecutionRefs.length,
    sideEffectExecutionRefs,
  };
}

function countPayloadStrings(events: readonly RoomEvent[], eventType: string, key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (event.event_type !== eventType) continue;
    const value = stringValue(objectPayload(event.payload)[key]);
    if (!value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function memoryRefFromPayload(payload: Record<string, unknown>, fallback: string): string {
  return stringValue(payload.memoryId) ?? stringValue(payload.memory_id) ?? stringValue(payload.memoryRef) ?? stringValue(payload.memory_ref) ?? fallback;
}

function isPersonaLikeMemoryText(text: string): boolean {
  return /\b(persona|persona_delta|dailyMood|daily mood|role claim|profile|identity change|personality|habit)\b/i.test(text);
}

function containsSecretLikeText(text: string): boolean {
  return (
    /\b(?:sk|rk|pk|ghp|github_pat|xox[baprs])-[-_A-Za-z0-9]{12,}\b/.test(text) ||
    /\b(?:api[_-]?key|secret|token|authorization|bearer)\s*[:=]\s*["']?[-_./+=A-Za-z0-9]{12,}/i.test(text)
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectOfNumbers(value: unknown): Record<string, number> | undefined {
  const object = objectPayload(value);
  if (Object.keys(object).length === 0) return undefined;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(object)) {
    if (typeof item === "number" && Number.isFinite(item)) {
      result[key] = item;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function arrayOfObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .map((item) => objectPayload(item))
        .filter((item) => Object.keys(item).length > 0)
    : [];
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function maxNumber(values: readonly number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

async function waitForRuntimeBackgroundIdle(runtime: SpeciesRoomRuntime, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await runtime.getState();
    const active = runtimeStateMetricNumber(state, "active background turns");
    const queued = runtimeStateMetricNumber(state, "queued background turns");
    if (active === undefined && queued === undefined) {
      return;
    }
    if ((active ?? 0) === 0 && (queued ?? 0) === 0) {
      return;
    }
    if (Date.now() >= deadline) {
      return;
    }
    await delay(50);
  }
}

function runtimeStateMetricNumber(state: RuntimeRoomState, label: string): number | undefined {
  const metrics = (state as { metrics?: unknown }).metrics;
  if (!Array.isArray(metrics)) return undefined;
  const row = metrics.find((item): item is [unknown, unknown] => Array.isArray(item) && item[1] === label);
  if (!row) return undefined;
  const numeric = Number(row[0]);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const tickIntervalMs = Number(process.env.SPECIES_HARNESS_TICK_MS ?? 60_000);
  const memoryHygieneReviewAfterMs = Number(
    process.env.SPECIES_HARNESS_MEMORY_HYGIENE_REVIEW_MS ?? DEFAULT_HARNESS_MEMORY_HYGIENE_REVIEW_MS,
  );
  const continuityReviewAfterMs = Number(
    process.env.SPECIES_HARNESS_CONTINUITY_REVIEW_MS ?? DEFAULT_HARNESS_CONTINUITY_REVIEW_MS,
  );
  const silenceReentryAfterMs = Number(process.env.SPECIES_HARNESS_SILENCE_REENTRY_MS ?? DEFAULT_HARNESS_SILENCE_REENTRY_MS);
  const idleSocialAfterMs = Number(process.env.SPECIES_HARNESS_IDLE_SOCIAL_MS ?? DEFAULT_HARNESS_IDLE_SOCIAL_MS);
  const stamp = longRunHarnessStamp(new Date().toISOString());
  const ledgerPath = process.env.SPECIES_HARNESS_LEDGER ?? defaultLongRunHarnessLedgerPath(stamp);
  const reportPath = process.env.SPECIES_HARNESS_REPORT ?? path.join(process.cwd(), ".species", "harness", `long-run-${stamp}.json`);
  const scenario = parseLongRunHarnessScenario(process.env.SPECIES_HARNESS_SCENARIO);
  const report = await runLongRunHarness({
    durationMs: harnessDurationMsFromEnv(process.env),
    tickIntervalMs: positiveInteger(tickIntervalMs, 60_000),
    memoryHygieneReviewAfterMs: nonNegativeInteger(
      memoryHygieneReviewAfterMs,
      DEFAULT_HARNESS_MEMORY_HYGIENE_REVIEW_MS,
    ),
    continuityReviewAfterMs: nonNegativeInteger(
      continuityReviewAfterMs,
      DEFAULT_HARNESS_CONTINUITY_REVIEW_MS,
    ),
    silenceReentryAfterMs: nonNegativeInteger(silenceReentryAfterMs, DEFAULT_HARNESS_SILENCE_REENTRY_MS),
    idleSocialAfterMs: nonNegativeInteger(idleSocialAfterMs, DEFAULT_HARNESS_IDLE_SOCIAL_MS),
    ledgerPath,
    reportPath,
    scenario,
    liveAgents: scenario === "seed" ? process.env.SPECIES_AGENT_MODE === "live" : undefined,
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    process.exitCode = 1;
  }
}

function parseLongRunHarnessScenario(value: string | undefined): LongRunHarnessScenario {
  return value === "seed" ? "seed" : "neutral_evidence";
}

function longRunHarnessStamp(value: string): string {
  return value.replace(/[:.]/g, "-");
}

function defaultLongRunHarnessLedgerPath(stamp: string): string {
  return path.join(process.cwd(), ".species", "harness", `long-run-${stamp}.jsonl`);
}

function harnessDurationMsFromEnv(env: NodeJS.ProcessEnv): number {
  const durationMs = Number(env.SPECIES_HARNESS_DURATION_MS);
  if (Number.isFinite(durationMs) && durationMs > 0) {
    return Math.floor(durationMs);
  }
  const durationMinutes = Number(env.SPECIES_HARNESS_MINUTES ?? 20);
  return positiveInteger(durationMinutes, 20) * 60_000;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
