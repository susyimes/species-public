import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { runLongRunHarness } from "../src/evaluation/longRunHarness";
import type { RoomEvent } from "../src/types";

const execFileAsync = promisify(execFile);

test("long-run harness drives the real runtime and writes an evidence report", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-long-run-harness-"));
  try {
    const ledgerPath = path.join(dir, "room-ledger.jsonl");
    const reportPath = path.join(dir, "report.json");
    const report = await runLongRunHarness({
      durationMs: 2500,
      tickIntervalMs: 5,
      memoryHygieneReviewAfterMs: 0,
      continuityReviewAfterMs: 0,
      silenceReentryAfterMs: 0,
      idleSocialAfterMs: 0,
      ledgerPath,
      reportPath,
      seedPrompts: ["短跑 harness：请用真实 room loop 产生一点可归档的房间沉淀。"],
    });

    assert.equal(report.scenario, "neutral_evidence");
    assert.equal(report.ledgerPath, ledgerPath);
    assert.equal(report.reportPath, reportPath);
    assert.equal(report.memoryHygieneReviewAfterMs, 0);
    assert.equal(report.continuityReviewAfterMs, 0);
    assert.equal(report.silenceReentryAfterMs, 0);
    assert.equal(report.tickCount >= 1, true);
    assert.equal(report.eventCount > 0, true);
    assert.equal(report.messageCount > 0, true);
    assert.equal(report.autonomyTickCount >= 1, true);
    assert.equal(Object.values(report.autonomyActions).reduce((sum, count) => sum + count, 0), report.autonomyTickCount);
    assert.equal(report.archiveCount >= 1, true);
    assert.equal(report.operationalSummary.status, "fail");
    assert.equal(report.operationalSummary.domains.length, 15);
    assert.equal(report.operationalSummary.failedDomainCount, 1);
    assert.equal(report.operationalSummary.passedDomainCount, 14);
    assert.equal(report.operationalSummary.evidenceRefCount > 0, true);
    assert.equal(report.operationalSummary.evidenceRefs.length, report.operationalSummary.evidenceRefCount);
    assert.deepEqual(
      report.operationalSummary.domains.filter((domain) => !domain.ok).map((domain) => domain.key),
      ["duration_window"],
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "scheduler_continuity" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.samples) >= 1,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "long_term_rhythm" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.idleSocialActions) > 0 &&
          Number(domain.metrics.idleSocialTargets) > 0 &&
          Number(domain.metrics.idleSocialEvidenceRefs) > 0 &&
          Number(domain.metrics.choiceSetTargetRefs) > 0 &&
          Number(domain.metrics.choiceSetEvidenceRefs) > 0 &&
          Number(domain.metrics.choiceSetGaps) === 0,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "archive_rhythm" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.archiveEvents) >= 1 &&
          Number(domain.metrics.archiveRefs) >= 1 &&
          Number(domain.metrics.ledgerEvidenceRefs) >= 1 &&
          Number(domain.metrics.acceptedMemoryArchives) >= 1 &&
          Number(domain.metrics.acceptedMemoryArchiveEvidenceRefs) >= 1 &&
          Number(domain.metrics.acceptedMemoryArchivesWithoutEvidence) === 0 &&
          Number(domain.metrics.archivesWithContinuity) >= 1 &&
          Number(domain.metrics.archivedContinuityItems) >= 2 &&
          Number(domain.metrics.acceptedArchivedContinuityItems) >= 2 &&
          Number(domain.metrics.archiveActions) >= 1 &&
          Number(domain.metrics.archiveActionMessages) >= 1 &&
          Number(domain.metrics.archiveActionArchives) >= 1 &&
          Number(domain.metrics.archiveReviewRequests) >= 1 &&
          Number(domain.metrics.archiveActionEvidenceRefs) >= 1 &&
          Number(domain.metrics.archiveReviewLedgerEvents) >= 1 &&
          Number(domain.metrics.archiveEvidenceGaps) === 0,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "autonomous_social_loop" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.choiceCount) > 0 &&
          Number(domain.metrics.invitations) > 0 &&
          Number(domain.metrics.questions) > 0 &&
          Number(domain.metrics.reviews) > 0 &&
          Number(domain.metrics.handoffs) > 0 &&
          Number(domain.metrics.silenceChoices) > 0 &&
          Number(domain.metrics.requiredChoiceKinds) === 5 &&
          Number(domain.metrics.coveredChoiceKinds) === 5 &&
          domain.metrics.missingChoiceKinds === "none" &&
          Number(domain.metrics.choiceCoverageGaps) === 0 &&
          Number(domain.metrics.requiredRoomEventPressureKinds) === 9 &&
          Number(domain.metrics.coveredRoomEventPressureKinds) === 9 &&
          domain.metrics.missingRoomEventPressureKinds === "none" &&
          Number(domain.metrics.roomEventPressureCoverageGaps) === 0 &&
          Number(domain.metrics.roomEventPressureRefs) >= 9 &&
          Number(domain.metrics.choicesWithoutRoomEventPressureRefs) === 0 &&
          Number(domain.metrics.archivePressureChoices) > 0 &&
          Number(domain.metrics.memoryPressureChoices) > 0 &&
          Number(domain.metrics.continuityPressureChoices) > 0 &&
          Number(domain.metrics.providerBoundaryPressureChoices) > 0 &&
          Number(domain.metrics.openQuestionPressureChoices) > 0 &&
          Number(domain.metrics.handoffPressureChoices) > 0 &&
          Number(domain.metrics.invitationPressureChoices) > 0 &&
          Number(domain.metrics.silenceReentryPressureChoices) > 0 &&
          Number(domain.metrics.idleSocialPressureChoices) > 0 &&
          Number(domain.metrics.choiceSilenceWindows) > 0 &&
          Number(domain.metrics.cleanChoiceSilenceWindows) > 0 &&
          Number(domain.metrics.interruptedSilenceWindows) === 0 &&
          Number(domain.metrics.interruptingUserMessages) === 0 &&
          Number(domain.metrics.choicesAfterUserSilence) > 0 &&
          Number(domain.metrics.interruptedChoices) === 0 &&
          Number(domain.metrics.lineageGaps) === 0,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "memory_contest" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.memoryProposals) >= 1 &&
          Number(domain.metrics.memoryAcceptances) >= 1 &&
          Number(domain.metrics.memoryContests) >= 1 &&
          Number(domain.metrics.memoryReviews) >= 1 &&
          Number(domain.metrics.reviewedMemoryRefs) >= 1 &&
          Number(domain.metrics.memoryPressureEvents) >= 0 &&
          Number(domain.metrics.memoryHygieneActions) >= 1 &&
          Number(domain.metrics.memoryHygieneTargets) >= 1 &&
          Number(domain.metrics.memoryHygieneEvidenceRefs) >= 1 &&
          Number(domain.metrics.acceptedWithoutEvidence) === 0 &&
          Number(domain.metrics.acceptedWithoutReview) === 0 &&
          Number(domain.metrics.personaLikeMemory) === 0 &&
          Number(domain.metrics.acceptedPersonaLikeMemory) === 0 &&
          Number(domain.metrics.acceptedMemoryArchives) >= 1 &&
          Number(domain.metrics.acceptedMemoryArchiveEvidenceRefs) >= 1 &&
          Number(domain.metrics.acceptedMemoryArchivesWithoutEvidence) === 0 &&
          Number(domain.metrics.contestEvidenceGaps) === 0,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "agent_continuity" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.personaDeltas) >= 2 &&
          Number(domain.metrics.acceptedPersonaDeltas) >= 2 &&
          Number(domain.metrics.roleClaims) >= 1 &&
          Number(domain.metrics.acceptedRoleClaims) >= 1 &&
          Number(domain.metrics.dailyMoodRecords) >= 1 &&
          Number(domain.metrics.acceptedDailyMoods) >= 1 &&
          Number(domain.metrics.continuityReviewActions) >= 1 &&
          Number(domain.metrics.continuityReviewTargets) >= 1 &&
          Number(domain.metrics.archivedContinuityItems) >= 2 &&
          Number(domain.metrics.acceptedArchivedContinuityItems) >= 2 &&
          Number(domain.metrics.archiveContinuityEvidenceRefs) >= 1 &&
          Number(domain.metrics.archiveContinuityResponseRefs) >= 1 &&
          Number(domain.metrics.continuityEvidenceGaps) === 0,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "evidence_sediment" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.archivedContinuityItems) >= 2 &&
          Number(domain.metrics.personaLikeMemory) === 0 &&
          Number(domain.metrics.acceptedPersonaLikeMemory) === 0 &&
          Number(domain.metrics.acceptedWithoutReview) === 0 &&
          Number(domain.metrics.memoryReviewTraces) >= 1 &&
          Number(domain.metrics.roleClaims) >= 1 &&
          Number(domain.metrics.dailyMoodRecords) >= 1 &&
          Number(domain.metrics.continuityEvidenceRefs) >= 1 &&
          Number(domain.metrics.continuityResponseRefs) >= 1 &&
          Number(domain.metrics.continuityEvidenceGaps) === 0,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "provider_boundary" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.degradations) >= 1 &&
          Number(domain.metrics.requiredChoicePressureKinds) === 5 &&
          Number(domain.metrics.coveredChoicePressureKinds) === 5 &&
          domain.metrics.missingChoicePressureKinds === "none" &&
          Number(domain.metrics.choicePressureCoverageGaps) === 0 &&
          Number(domain.metrics.repairPressureRefs) >= 1 &&
          Number(domain.metrics.retryPressureRefs) >= 1 &&
          Number(domain.metrics.silencePressureRefs) >= 1 &&
          Number(domain.metrics.contestedMemoryPressureRefs) >= 1 &&
          Number(domain.metrics.archiveCarryoverPressureRefs) >= 1,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "action_boundary" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.sideEffectRequests) >= 1 &&
          Number(domain.metrics.sideEffectReviews) >= 1 &&
          Number(domain.metrics.sideEffectResults) === 0 &&
          Number(domain.metrics.unapprovedResults) === 0 &&
          Number(domain.metrics.capabilityInvocations) >= 1 &&
          Number(domain.metrics.capabilityResults) >= 1 &&
          Number(domain.metrics.workspaceArtifacts) >= 1 &&
          Number(domain.metrics.workspaceReviews) >= 1 &&
          Number(domain.metrics.skillCapsuleReviews) >= 1 &&
          Number(domain.metrics.capabilityReviews) >= 1 &&
          Number(domain.metrics.contextBoundaryRefs) >= 1 &&
          Number(domain.metrics.actionBoundaryGaps) === 0,
      ),
      true,
    );
    assert.equal(
      report.operationalSummary.domains.some(
        (domain) =>
          domain.key === "silence_reentry" &&
          domain.ok &&
          domain.evidenceRefs.length > 0 &&
          Number(domain.metrics.configuredSilenceReentryMs) === 0 &&
          Number(domain.metrics.silenceReentryActions) >= 1 &&
          Number(domain.metrics.reentryMessages) >= 1 &&
          Number(domain.metrics.quietAnchorRefs) >= 1 &&
          Number(domain.metrics.archiveRefs) >= 1 &&
          Number(domain.metrics.evidenceRefs) >= 1 &&
          Number(domain.metrics.missingAnchorActions) === 0 &&
          Number(domain.metrics.preservedSilenceAnchorRefs) >= 1 &&
          Number(domain.metrics.missingPreservedSilenceActions) === 0 &&
          Number(domain.metrics.preservedSilenceActions) >= 1 &&
          Number(domain.metrics.deliberateSilenceIntentions) >= 1 &&
          Number(domain.metrics.silenceReentryGaps) === 0,
      ),
      true,
    );
    assert.equal(report.agentExpression.some((agent) => agent.messageRefs.length === agent.messageCount), true);
    assert.equal(report.monopoly.totalAgentMessageRefs.length, report.monopoly.totalAgentMessages);
    assert.equal(report.monopoly.maxSpeakerMessageRefs.length > 0, true);
    assert.equal(Object.keys(report.monopoly.speakerMessageRefs).length, report.monopoly.activeSpeakerCount);
    assert.equal(report.monopoly.activeSpeakerCount >= report.monopoly.minimumActiveSpeakers, true);
    assert.equal(report.monopoly.minimumActiveSpeakers, 2);
    assert.equal(report.monopoly.maxSpeakerShareThreshold, 0.65);
    assert.equal(report.monopoly.speakerBalanceGapCount, 0);
    assert.equal(report.monopoly.speakerBudgetRecoveryGapCount, 0);
    assert.equal(report.autonomyRhythmBalance.ok, true);
    assert.equal(report.autonomyRhythmBalance.enoughSamples, true);
    assert.equal(report.autonomyRhythmBalance.consideredActionCount >= 5, true);
    assert.equal(report.autonomyRhythmBalance.distinctActionCount >= 5, true);
    assert.equal(report.autonomyRhythmBalance.actionCounts.memory_hygiene_review >= 1, true);
    assert.equal(report.autonomyRhythmBalance.actionCounts.continuity_review >= 1, true);
    assert.equal(report.autonomyRhythmBalance.actionCounts.provider_boundary_review >= 1, true);
    assert.equal(report.autonomyRhythmBalance.actionCounts.open_question_revisit >= 1, true);
    assert.equal(report.autonomyRhythmBalance.actionCounts.handoff_review >= 1, true);
    assert.equal(report.autonomyRhythmBalance.actionCounts.invitation_review >= 1, true);
    assert.equal(report.findings.some((finding) => finding.startsWith("autonomy rhythm monopoly:")), false);
    assert.equal(report.durationCompliance.ok, false);
    assert.equal(report.durationCompliance.requestedWithinWindow, false);
    assert.equal(report.findings.includes("duration: harness run did not satisfy the 20-60 minute long-run window"), true);
    assert.equal(report.schedulerContinuity.ok, true);
    assert.equal(report.schedulerContinuity.intervalMs, 5);
    assert.equal(report.schedulerContinuity.sampleCount >= 1, true);
    assert.equal(report.schedulerContinuity.completedSampleCount, report.schedulerContinuity.sampleCount);
    assert.equal(report.schedulerContinuity.tickRefs.length >= 1, true);
    assert.equal(report.schedulerContinuity.tickEventRefs.length >= 1, true);
    assert.deepEqual(report.schedulerContinuity.samplesMissingTickRefs, []);
    assert.deepEqual(report.schedulerContinuity.samplesMissingTickEventRefs, []);
    assert.deepEqual(report.schedulerContinuity.samplesExceedingDriftBudget, []);
    assert.deepEqual(report.schedulerContinuity.samplesExceedingOverrunBudget, []);
    assert.equal(report.findings.some((finding) => finding.startsWith("scheduler continuity:")), false);
    assert.equal(report.workflowDrift.forbiddenSchedulerEvents.length, 0);
    assert.equal(report.workflowDrift.forcedSpeechMarkers, 0);
    assert.deepEqual(report.workflowDrift.forcedSpeechEventRefs, []);
    assert.deepEqual(report.workflowDrift.sideEffectExecutionRefs, []);
    assert.equal(report.actionBoundary.ok, true);
    assert.equal(report.actionBoundary.sideEffectRequestRefs.length >= 1, true);
    assert.equal(report.actionBoundary.sideEffectReviewRefs.length >= 1, true);
    assert.deepEqual(report.actionBoundary.sideEffectResultRefs, []);
    assert.deepEqual(report.actionBoundary.unapprovedSideEffectResultRefs, []);
    assert.equal(report.actionBoundary.capabilityInvocationRefs.length >= 1, true);
    assert.equal(report.actionBoundary.capabilityResultRefs.length >= 1, true);
    assert.equal(report.actionBoundary.workspaceArtifactRefs.length >= 1, true);
    assert.equal(report.actionBoundary.workspaceArtifactReviewRefs.length >= 1, true);
    assert.equal(report.actionBoundary.skillCapsuleReviewRefs.length >= 1, true);
    assert.equal(report.actionBoundary.capabilityReviewRefs.length >= 1, true);
    assert.equal(report.actionBoundary.contextBoundaryRefs.length >= 1, true);
    assert.equal(report.memoryHygiene.ok, true);
    assert.equal(report.memoryHygiene.proposedRefs.length >= 1, true);
    assert.equal(report.memoryHygiene.acceptedRefs.length >= 1, true);
    assert.equal(report.memoryHygiene.contestEventCount >= 1, true);
    assert.equal(report.memoryHygiene.contestEventRefs.length >= 1, true);
    assert.equal(Array.isArray(report.memoryHygiene.reviewEventRefs), true);
    assert.equal(report.memoryHygiene.proposedWithoutSourceRefs.length, 0);
    assert.equal(report.memoryPollution.ok, true);
    assert.deepEqual(report.memoryPollution.personaLikeMemoryRefs, []);
    assert.deepEqual(report.memoryPollution.personaLikeMemoryEventRefs, []);
    assert.deepEqual(report.memoryPollution.acceptedPersonaLikeMemoryRefs, []);
    assert.deepEqual(report.memoryPollution.acceptedPersonaLikeMemoryEventRefs, []);
    assert.deepEqual(report.memoryPollution.acceptedWithoutContestOrReviewRefs, []);
    assert.deepEqual(report.memoryPollution.acceptedWithoutContestOrReviewEventRefs, []);
    assert.equal(report.memoryPollution.reviewedMemoryRefs.length >= 1, true);
    assert.equal(report.memoryPollution.memoryContestOrReviewEventRefs.length >= 1, true);
    assert.equal(Array.isArray(report.memoryPollution.memoryPressureEventRefs), true);
    assert.equal(report.autonomousSocialLoop.ok, true);
    assert.equal(report.autonomousSocialLoop.roomRhythmMessageCount >= 1, true);
    assert.equal(report.autonomousSocialLoop.roomRhythmMessageRefs.length >= 1, true);
    assert.equal(report.autonomousSocialLoop.agentIntentionsAfterRoomRhythm > 0, true);
    assert.equal(report.autonomousSocialLoop.intentionEventRefsAfterRoomRhythm.length > 0, true);
    assert.equal(report.autonomousSocialLoop.invitationCount > 0, true);
    assert.equal(report.autonomousSocialLoop.invitationRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.invitationRoomRhythmRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.questionCount > 0, true);
    assert.equal(report.autonomousSocialLoop.questionRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.questionRoomRhythmRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.handoffCount > 0, true);
    assert.equal(report.autonomousSocialLoop.handoffRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.handoffRoomRhythmRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.reviewCount > 0, true);
    assert.equal(report.autonomousSocialLoop.reviewRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.reviewRoomRhythmRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.deliberateSilenceCount + report.autonomousSocialLoop.staySilentTickCount > 0, true);
    assert.equal(report.autonomousSocialLoop.silenceRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.silenceRoomRhythmRefs.length > 0, true);
    assert.equal(report.autonomousSocialLoop.choicesAfterUserSilenceRefs.length > 0, true);
    assert.deepEqual(report.autonomousSocialLoop.choicesInterruptedByUserRefs, []);
    assert.deepEqual(report.autonomousSocialLoop.interruptingUserMessageRefs, []);
    assert.equal(report.autonomousSocialLoop.choiceSilenceWindows.length >= report.autonomousSocialLoop.choicesAfterUserSilenceRefs.length, true);
    assert.equal(
      report.autonomousSocialLoop.choiceSilenceWindows.every((window) => window.roomRhythmRefs.length > 0),
      true,
    );
    assert.equal(
      report.autonomousSocialLoop.choiceSilenceWindows.some(
        (window) => window.cleanRoomRhythmRefs.length > 0 && window.interruptingUserMessageRefs.length === 0,
      ),
      true,
    );
    assert.equal(report.autonomousSocialLoop.choiceSilenceWindows.some((window) => window.choiceLabel === "invite_other"), true);
    assert.deepEqual(report.autonomousSocialLoop.choicesWithoutRoomRhythmRefs, []);
    assert.equal(report.autonomousSocialLoop.requiredRoomEventPressureKinds, 9);
    assert.equal(report.autonomousSocialLoop.coveredRoomEventPressureKinds, 9);
    assert.deepEqual(report.autonomousSocialLoop.missingRoomEventPressureKinds, []);
    assert.equal(report.autonomousSocialLoop.roomEventPressureCoverageGapCount, 0);
    assert.equal(report.autonomousSocialLoop.roomEventPressureRefs.length >= 9, true);
    assert.deepEqual(report.autonomousSocialLoop.choicesWithoutRoomEventPressureRefs, []);
    assert.equal((report.autonomousSocialLoop.roomEventPressureKinds.archive ?? 0) > 0, true);
    assert.equal((report.autonomousSocialLoop.roomEventPressureKinds.memory ?? 0) > 0, true);
    assert.equal((report.autonomousSocialLoop.roomEventPressureKinds.continuity ?? 0) > 0, true);
    assert.equal((report.autonomousSocialLoop.roomEventPressureKinds["provider-boundary"] ?? 0) > 0, true);
    assert.equal((report.autonomousSocialLoop.roomEventPressureKinds["open-question"] ?? 0) > 0, true);
    assert.equal((report.autonomousSocialLoop.roomEventPressureKinds.handoff ?? 0) > 0, true);
    assert.equal((report.autonomousSocialLoop.roomEventPressureKinds.invitation ?? 0) > 0, true);
    assert.equal((report.autonomousSocialLoop.roomEventPressureKinds["silence-reentry"] ?? 0) > 0, true);
    assert.equal(report.autonomousSocialLoop.choiceCount > 0, true);
    assert.equal(report.personaEvidence.ok, true);
    assert.equal(report.personaEvidence.proposedDeltaRefs.length >= 2, true);
    assert.equal(report.personaEvidence.proposedDeltaEventRefs.length >= 2, true);
    assert.equal(report.personaEvidence.acceptedDeltaRefs.length >= 2, true);
    assert.equal(report.personaEvidence.acceptedDeltaResponseEventRefs.length >= 2, true);
    assert.equal(report.personaEvidence.roleClaimRefs.length >= 1, true);
    assert.equal(report.personaEvidence.acceptedRoleClaimRefs.length >= 1, true);
    assert.equal(report.personaEvidence.roleClaimEvidenceRefs.length >= 1, true);
    assert.equal(report.personaEvidence.roleClaimResponseRefs.length >= 1, true);
    assert.equal(report.personaEvidence.acceptedRoleClaimDeltaRefs.length >= 1, true);
    assert.deepEqual(report.personaEvidence.roleClaimsWithoutResponseRefs, []);
    assert.equal(report.personaEvidence.dailyMoodSourceRefs.length >= 1, true);
    assert.equal(report.personaEvidence.dailyMoodEvidenceRefs.length >= 1, true);
    assert.equal(report.personaEvidence.dailyMoodResponseRefs.length >= 1, true);
    assert.equal(report.personaEvidence.acceptedDailyMoodDeltaRefs.length >= 1, true);
    assert.deepEqual(report.personaEvidence.dailyMoodsWithoutEvidenceRefs, []);
    assert.deepEqual(report.personaEvidence.dailyMoodsWithoutResponseRefs, []);
    assert.equal(report.archiveContinuity.ok, true);
    assert.equal(report.archiveContinuity.archivesWithContinuity >= 1, true);
    assert.equal(report.archiveContinuity.continuityArchiveRefs.length >= 1, true);
    assert.equal(report.archiveContinuity.roleClaimCount >= 1, true);
    assert.equal(report.archiveContinuity.roleClaimRefs.length >= 1, true);
    assert.equal(report.archiveContinuity.dailyMoodCount >= 1, true);
    assert.equal(report.archiveContinuity.dailyMoodRefs.length >= 1, true);
    assert.equal(report.archiveContinuity.acceptedRoleClaimCount >= 1, true);
    assert.equal(report.archiveContinuity.acceptedRoleClaimRefs.length >= 1, true);
    assert.equal(report.archiveContinuity.acceptedDailyMoodCount >= 1, true);
    assert.equal(report.archiveContinuity.acceptedDailyMoodRefs.length >= 1, true);
    assert.equal(report.archiveContinuity.continuityEvidenceRefs.length >= 1, true);
    assert.equal(report.archiveContinuity.continuityResponseRefs.length >= 1, true);
    assert.equal(report.archiveContinuity.continuitySourceRefs.length >= 1, true);
    assert.equal(report.archiveContinuity.continuityEventRefs.length >= 1, true);
    assert.deepEqual(report.archiveContinuity.continuityItemsWithoutEvidenceRefs, []);
    assert.equal(report.archiveEvidence.ok, true);
    assert.equal(report.archiveEvidence.archiveEventRefs.length >= 1, true);
    assert.equal(report.archiveEvidence.archiveRefs.length >= 1, true);
    assert.equal(report.archiveEvidence.ledgerEvidenceRefs.length >= 1, true);
    assert.equal(report.archiveEvidence.acceptedMemoryArchiveCount >= 1, true);
    assert.equal(report.archiveEvidence.acceptedMemoryArchiveRefs.length >= 1, true);
    assert.equal(report.archiveEvidence.acceptedMemoryArchiveEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs, []);
    assert.deepEqual(report.archiveEvidence.archivesWithoutLedgerRange, []);
    assert.deepEqual(report.archiveEvidence.archivesWithoutEventCounts, []);
    assert.deepEqual(report.archiveEvidence.archivesWithoutLedgerEvidenceRefs, []);
    assert.equal(report.longTermRhythm.archiveActionCount + report.longTermRhythm.archiveReviewActionCount >= 1, true);
    assert.equal(report.longTermRhythm.archiveActionRefs.length + report.longTermRhythm.archiveReviewActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.archiveActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.archiveActionMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.archiveActionArchiveRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.archiveActionReviewRequestRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.archiveActionEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.archiveActionsMissingMaterialRefs, []);
    assert.equal(report.longTermRhythm.archiveReviewLedgerEventCount >= 1, true);
    assert.equal(report.longTermRhythm.archiveReviewLedgerEventRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.memoryHygieneLedgerEventCount >= 1, true);
    assert.equal(report.longTermRhythm.memoryHygieneLedgerEventRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.memoryHygieneActionCount >= 1, true);
    assert.equal(report.longTermRhythm.memoryHygieneActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.memoryHygieneMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.memoryHygieneTargetRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.memoryHygieneEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.memoryHygieneActionsMissingTargetRefs, []);
    assert.equal(report.longTermRhythm.continuityReviewActionCount >= 1, true);
    assert.equal(report.longTermRhythm.continuityReviewActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.continuityReviewMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.continuityReviewTargetRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.continuityReviewEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.continuityReviewActionsMissingTargetRefs, []);
    assert.equal(report.longTermRhythm.providerBoundaryReviewActionCount >= 1, true);
    assert.equal(report.longTermRhythm.providerBoundaryReviewActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.providerBoundaryReviewMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.providerBoundaryReviewTargetRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.providerBoundaryReviewEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.providerBoundaryReviewActionsMissingTargetRefs, []);
    assert.equal(report.longTermRhythm.openQuestionRevisitActionCount >= 1, true);
    assert.equal(report.longTermRhythm.openQuestionRevisitActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.openQuestionRevisitMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.openQuestionRevisitTargetRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.openQuestionRevisitEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.openQuestionRevisitActionsMissingTargetRefs, []);
    assert.equal(report.longTermRhythm.handoffReviewActionCount >= 1, true);
    assert.equal(report.longTermRhythm.handoffReviewActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.handoffReviewMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.handoffReviewTargetRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.handoffReviewEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.handoffReviewActionsMissingTargetRefs, []);
    assert.equal(report.longTermRhythm.invitationReviewActionCount >= 1, true);
    assert.equal(report.longTermRhythm.invitationReviewActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.invitationReviewMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.invitationReviewTargetRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.invitationReviewEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.invitationReviewActionsMissingTargetRefs, []);
    assert.equal(report.longTermRhythm.idleSocialActionCount >= 1, true);
    assert.equal(report.longTermRhythm.idleSocialActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.idleSocialMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.idleSocialTargetRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.idleSocialEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.idleSocialActionsMissingTargetRefs, []);
    assert.equal(typeof report.longTermRhythm.silenceReentryActionCount, "number");
    assert.equal(report.longTermRhythm.silenceReentryActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.silenceReentryMessageRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.silenceReentryAnchorRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.silenceReentryArchiveRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.silenceReentryEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.silenceReentryActionsMissingAnchorRefs, []);
    assert.equal(report.longTermRhythm.silenceReentryPreservedSilenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.silenceReentryActionsMissingPreservedSilenceRefs, []);
    assert.equal(report.longTermRhythm.preservedSilenceActionCount >= 1, true);
    assert.equal(report.longTermRhythm.preservedSilenceActionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.deliberateSilenceIntentionCount >= 1, true);
    assert.equal(report.longTermRhythm.deliberateSilenceIntentionRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.choiceSetTargetRefs.length >= 1, true);
    assert.equal(report.longTermRhythm.choiceSetEvidenceRefs.length >= 1, true);
    assert.deepEqual(report.longTermRhythm.choiceSetOptionsWithoutEvidenceRefs, []);
    assert.deepEqual(report.longTermRhythm.choiceSetTargetedOptionsWithoutTargetRefs, []);
    assert.deepEqual(report.longTermRhythm.actionsMissingChoiceSetRefs, []);
    assert.deepEqual(report.longTermRhythm.actionsMissingSelectedChoiceRefs, []);
    assert.deepEqual(report.longTermRhythm.actionsMissingEvidenceRefs, []);
    assert.equal(report.longTermRhythm.silenceReentryActionCount >= 1, true);
    assert.equal(report.longTermRhythm.ok, true);
    assert.equal(report.findings.includes("long-term rhythm: memory hygiene actions lacked target refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: continuity review actions lacked target refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: no autonomous provider-boundary review action was exercised"), false);
    assert.equal(report.findings.includes("long-term rhythm: provider-boundary review actions lacked target refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: no autonomous open-question revisit action was exercised"), false);
    assert.equal(report.findings.includes("long-term rhythm: open-question revisit actions lacked target refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: no autonomous handoff review action was exercised"), false);
    assert.equal(report.findings.includes("long-term rhythm: handoff review actions lacked target refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: no autonomous invitation review action was exercised"), false);
    assert.equal(report.findings.includes("long-term rhythm: invitation review actions lacked target refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: autonomy choice-set options lacked ledger evidence refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: active autonomy choice-set options lacked target refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: autonomy tick actions lacked choice-set evidence"), false);
    assert.equal(report.findings.includes("long-term rhythm: selected autonomy actions were absent from choice-set evidence"), false);
    assert.equal(report.findings.includes("long-term rhythm: no silence re-entry action was exercised"), false);
    assert.equal(report.findings.includes("long-term rhythm: silence re-entry actions lacked preserved-silence refs"), false);
    assert.equal(report.findings.includes("long-term rhythm: no preserved-silence action was exercised"), false);
    assert.equal(report.providerBoundary.ok, true);
    assert.equal(report.providerBoundary.degradationCount >= 1, true);
    assert.equal(report.providerBoundary.degradationRefs.length >= 1, true);
    assert.equal(report.providerBoundary.boundaryRefs.length >= 1, true);
    assert.equal(Array.isArray(report.providerBoundary.retirementRefs), true);
    assert.equal(Array.isArray(report.providerBoundary.deliberateSilenceRefs), true);
    assert.equal(typeof report.providerBoundary.choicePressureRefCount, "number");
    assert.equal(Array.isArray(report.providerBoundary.choicePressureRepairRequestRefs), true);
    assert.equal(Array.isArray(report.providerBoundary.choicePressureSilenceRefs), true);
    assert.equal(Array.isArray(report.providerBoundary.choicePressureArchiveCarryoverRefs), true);
    assert.equal(report.providerBoundary.choicePressureRefCount >= 1, true);
    assert.equal(report.providerBoundary.choicePressureRequiredKinds, 5);
    assert.equal(report.providerBoundary.choicePressureCoveredKinds, 5);
    assert.deepEqual(report.providerBoundary.choicePressureMissingKinds, []);
    assert.equal(report.providerBoundary.choicePressureCoverageGapCount, 0);
    assert.equal(report.providerBoundary.choicePressureRepairRequestRefs.length >= 1, true);
    assert.equal(report.providerBoundary.choicePressureRetryProtocolRefs.length >= 1, true);
    assert.equal(report.providerBoundary.choicePressureSilenceRefs.length >= 1, true);
    assert.equal(report.providerBoundary.choicePressureContestedMemoryRefs.length >= 1, true);
    assert.equal(report.providerBoundary.choicePressureArchiveCarryoverRefs.length >= 1, true);
    assert.equal(report.providerBoundary.degradationTreatedAsSilence, false);
    assert.deepEqual(report.providerBoundary.secretLikeDiagnosticRefs, []);
    assert.equal(report.contextVisibility.auditCount > 0, true);
    assert.equal(report.contextVisibility.hasArchiveContext, true);
    assert.equal(report.contextVisibility.hasMemoryContext, true);
    assert.equal(report.contextVisibility.hasProviderBoundaryContext, true);
    assert.equal(report.contextVisibility.hasPersonaContext, true);
    assert.equal(report.contextVisibility.hasArchiveContinuity, true);
    assert.equal(report.contextVisibility.coVisibleAuditCount >= 1, true);
    assert.equal(report.contextVisibility.coVisibleAuditPacketIds.length >= 1, true);
    assert.equal(report.contextVisibility.coVisibleArchiveRefs.length >= 1, true);
    assert.equal(report.contextVisibility.coVisibleMemoryRefs.length >= 1, true);
    assert.equal(report.contextVisibility.coVisiblePersonaRefs.length >= 1, true);
    assert.equal(report.contextVisibility.coVisibleProviderBoundaryRefs.length >= 1, true);
    assert.equal(report.contextVisibility.coVisibleSocialLineageRefs.length >= 1, true);
    assert.equal(report.contextVisibility.coVisibleContextRefCount >= 3, true);
    assert.equal(report.contextVisibility.coVisibleAuditDetails.length >= 1, true);
    assert.equal(
      report.contextVisibility.coVisibleAuditDetails.every(
        (detail) =>
          detail.contextRefCount >= 3 &&
          detail.archiveRefs.length > 0 &&
          detail.memoryRefs.length > 0 &&
          detail.personaRefs.length > 0 &&
          detail.providerBoundaryRefs.length > 0 &&
          detail.socialLineageRefs.length > 0,
      ),
      true,
    );
    assert.equal(report.contextVisibility.hasSocialLineageContext, true);
    assert.equal(Object.keys(report.contextVisibility.socialLineageSelectedTypes).length >= 1, true);
    assert.equal(report.contextVisibility.socialLineageRefs.length >= 1, true);
    assert.deepEqual(report.contextVisibility.criticalFragmentsWithoutRefs, []);
    assert.equal(report.contextVisibility.ok, true);
    assert.equal(report.pass, false);

    const saved = JSON.parse(await readFile(reportPath, "utf8")) as {
      ledgerPath?: string;
      pass?: boolean;
      operationalSummary?: { status?: string; domains?: unknown[] };
    };
    assert.equal(saved.ledgerPath, ledgerPath);
    assert.equal(typeof saved.pass, "boolean");
    assert.equal(saved.operationalSummary?.status, "fail");
    assert.equal(saved.operationalSummary?.domains?.length, 15);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("long-run harness defaults to a run-scoped ledger artifact", async () => {
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => [],
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
  });

  assert.equal(path.basename(path.dirname(report.ledgerPath)), "harness");
  assert.equal(path.basename(path.dirname(path.dirname(report.ledgerPath))), ".species");
  assert.equal(path.basename(report.ledgerPath).startsWith("long-run-"), true);
  assert.equal(path.extname(report.ledgerPath), ".jsonl");
  assert.notEqual(report.ledgerPath, path.join(process.cwd(), ".species", "long-run-room-ledger.jsonl"));
});

test("long-run harness CLI exits non-zero when the evidence report fails", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-long-run-cli-fail-"));
  try {
    const ledgerPath = path.join(dir, "room-ledger.jsonl");
    const reportPath = path.join(dir, "report.json");
    const scriptPath = path.join(process.cwd(), "dist", "src", "evaluation", "longRunHarness.js");
    let thrown: unknown;

    try {
      await execFileAsync(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SPECIES_HARNESS_DURATION_MS: "1",
          SPECIES_HARNESS_TICK_MS: "1",
          SPECIES_HARNESS_SILENCE_REENTRY_MS: "0",
          SPECIES_HARNESS_LEDGER: ledgerPath,
          SPECIES_HARNESS_REPORT: reportPath,
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30_000,
      });
    } catch (error) {
      thrown = error;
    }

    assert.ok(thrown, "failing long-run evidence report should make the CLI exit non-zero");
    assert.equal((thrown as { code?: unknown }).code, 1);
    const saved = JSON.parse(await readFile(reportPath, "utf8")) as {
      pass?: boolean;
      durationCompliance?: { ok?: boolean; requestedWithinWindow?: boolean };
      findings?: string[];
    };
    assert.equal(saved.pass, false);
    assert.equal(saved.durationCompliance?.ok, false);
    assert.equal(saved.durationCompliance?.requestedWithinWindow, false);
    assert.equal(saved.findings?.includes("duration: harness run did not satisfy the 20-60 minute long-run window"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("long-run harness flags scheduler continuity samples without ledger tick events", async () => {
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () =>
      ({
        autonomyTick: {
          tickId: "autonomy_tick_missing_from_ledger",
          action: "stay_silent",
          status: "silent",
          targetRefs: [],
          contextRefs: [],
          evidenceRefs: [],
          choiceSet: [],
        },
      }) as never,
    rawEvents: async () => [],
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.schedulerContinuity.ok, false);
  assert.deepEqual(report.schedulerContinuity.tickRefs, ["autonomy_tick_missing_from_ledger"]);
  assert.deepEqual(report.schedulerContinuity.tickEventRefs, []);
  assert.deepEqual(report.schedulerContinuity.samplesMissingTickRefs, []);
  assert.deepEqual(report.schedulerContinuity.samplesMissingTickEventRefs, ["autonomy_tick_missing_from_ledger"]);
  assert.equal(
    report.findings.includes("scheduler continuity: interval samples lacked ledger tick event refs"),
    true,
  );
  const schedulerDomain = report.operationalSummary.domains.find((domain) => domain.key === "scheduler_continuity");
  assert.equal(schedulerDomain?.ok, false);
  assert.equal(schedulerDomain?.evidenceRefs.includes("autonomy_tick_missing_from_ledger"), true);
  assert.equal(
    schedulerDomain?.gaps.includes("scheduler continuity: interval samples lacked ledger tick event refs"),
    true,
  );
});

test("long-run harness flags persona continuity without ledger evidence", async () => {
  const badDeltaRef = "persona_delta_bad";
  const events = [
    event("evt_bad_delta", "persona_delta.proposed", {
      deltaId: badDeltaRef,
      agentId: "agent_bad",
      proposedBy: "agent_bad",
      proposedChange: { field: "dailyMood", operation: "set", value: "unsupported mood" },
      evidenceRefs: [],
      status: "proposed",
    }),
    event("evt_bad_accept", "persona_delta.responded", {
      deltaId: badDeltaRef,
      agentId: "agent_bad",
      response: "accept",
      evidenceRefs: [],
    }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.personaEvidence.ok, false);
  assert.deepEqual(report.personaEvidence.proposedDeltaRefs, [badDeltaRef]);
  assert.deepEqual(report.personaEvidence.proposedDeltaEventRefs, ["evt_bad_delta"]);
  assert.deepEqual(report.personaEvidence.proposedDeltasWithoutEvidenceRefs, [badDeltaRef]);
  assert.deepEqual(report.personaEvidence.acceptedDeltaRefs, [badDeltaRef]);
  assert.deepEqual(report.personaEvidence.acceptedDeltaResponseEventRefs, ["evt_bad_accept"]);
  assert.deepEqual(report.personaEvidence.acceptedDeltasWithoutResponseEvidenceRefs, [badDeltaRef]);
  assert.deepEqual(report.personaEvidence.roleClaimRefs, ["role_bad"]);
  assert.deepEqual(report.personaEvidence.acceptedRoleClaimRefs, ["role_bad"]);
  assert.deepEqual(report.personaEvidence.roleClaimEvidenceRefs, []);
  assert.deepEqual(report.personaEvidence.roleClaimResponseRefs, []);
  assert.deepEqual(report.personaEvidence.roleClaimsWithoutEvidenceRefs, ["role_bad"]);
  assert.deepEqual(report.personaEvidence.roleClaimsWithoutResponseRefs, ["role_bad"]);
  assert.deepEqual(report.personaEvidence.acceptedRoleClaimDeltaRefs, []);
  assert.deepEqual(report.personaEvidence.acceptedRoleClaimsWithoutAcceptedDelta, ["role_bad"]);
  assert.deepEqual(report.personaEvidence.dailyMoodSourceRefs, []);
  assert.deepEqual(report.personaEvidence.dailyMoodEvidenceRefs, []);
  assert.deepEqual(report.personaEvidence.dailyMoodResponseRefs, []);
  assert.deepEqual(report.personaEvidence.acceptedDailyMoodDeltaRefs, []);
  assert.deepEqual(report.personaEvidence.dailyMoodsWithoutSourceRef, ["agent_bad"]);
  assert.deepEqual(report.personaEvidence.dailyMoodsWithoutEvidenceRefs, ["agent_bad"]);
  assert.deepEqual(report.personaEvidence.dailyMoodsWithoutResponseRefs, ["agent_bad"]);
  assert.deepEqual(report.personaEvidence.dailyMoodsWithoutAcceptedDelta, ["agent_bad"]);
  assert.equal(report.durationCompliance.ok, false);
  assert.equal(report.autonomousSocialLoop.ok, false);
  assert.equal(report.archiveContinuity.ok, false);
  assert.equal(
    report.findings.includes("autonomous social loop: no evidence that room rhythm created agent choice after user silence"),
    true,
  );
  assert.equal(report.pass, false);
  assert.equal(report.findings.includes("persona evidence: role claims or daily mood continuity lacked ledger evidence"), true);
  const sedimentDomain = report.operationalSummary.domains.find((domain) => domain.key === "evidence_sediment");
  assert.equal(sedimentDomain?.ok, false);
  assert.equal(sedimentDomain?.gaps.includes("persona evidence: role claims or daily mood continuity lacked ledger evidence"), true);
  assert.equal(sedimentDomain?.metrics.roleClaims, 1);
  assert.equal(sedimentDomain?.metrics.dailyMoodRecords, 1);
  assert.equal(sedimentDomain?.metrics.continuityEvidenceRefs, 0);
  assert.equal(sedimentDomain?.metrics.continuityResponseRefs, 1);
  assert.equal(sedimentDomain?.metrics.continuityEvidenceGaps, 9);
  assert.equal(sedimentDomain?.evidenceRefs.includes("evt_bad_delta"), true);
  assert.equal(sedimentDomain?.evidenceRefs.includes("evt_bad_accept"), true);
  const continuityDomain = report.operationalSummary.domains.find((domain) => domain.key === "agent_continuity");
  assert.equal(continuityDomain?.ok, false);
  assert.equal(continuityDomain?.gaps.includes("persona evidence: role claims or daily mood continuity lacked ledger evidence"), true);
  assert.equal(Number(continuityDomain?.metrics.roleClaims), 1);
  assert.equal(Number(continuityDomain?.metrics.dailyMoodRecords), 1);
  assert.equal(Number(continuityDomain?.metrics.archivedContinuityItems), 0);
  assert.equal(Number(continuityDomain?.metrics.continuityEvidenceGaps) > 0, true);
});

test("long-run harness flags daily mood records without explicit proposal and response refs", async () => {
  const events = [
    event("evt_mood_proposed", "persona_delta.proposed", {
      deltaId: "persona_delta_mood_supported",
      agentId: "agent_supported",
      proposedBy: "agent_supported",
      proposedChange: { field: "dailyMood", operation: "set", value: "ledger-shaped mood" },
      evidenceRefs: ["msg_mood_source"],
      status: "proposed",
    }),
    event("evt_mood_accepted", "persona_delta.responded", {
      deltaId: "persona_delta_mood_supported",
      agentId: "agent_supported",
      response: "accept",
      evidenceRefs: ["persona_delta_mood_supported", "msg_mood_source"],
    }),
    event("evt_role_proposed", "persona_delta.proposed", {
      deltaId: "persona_delta_role_supported",
      agentId: "agent_supported",
      proposedBy: "agent_supported",
      proposedChange: { field: "roleClaims", operation: "add", value: "keeps continuity bounded" },
      evidenceRefs: ["msg_role_source"],
      status: "proposed",
    }),
    event("evt_role_accepted", "persona_delta.responded", {
      deltaId: "persona_delta_role_supported",
      agentId: "agent_supported",
      response: "accept",
      evidenceRefs: ["persona_delta_role_supported", "msg_role_source"],
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      socialState: {
        ...fakeState().socialState,
        personas: [
          {
            agentId: "agent_supported",
            roleClaims: [
              {
                roleClaimId: "role_supported",
                label: "keeps continuity bounded",
                status: "accepted",
                evidenceRefs: ["msg_role_source"],
                responseRefs: ["persona_delta_response_role_supported"],
              },
            ],
            dailyMoodRecord: {
              date: "2026-06-21",
              posture: "ledger-shaped mood",
              sourceRef: "msg_mood_source",
              evidenceRefs: [],
              responseRefs: [],
              boundaryNote: "bad fixture omits explicit proposal and response refs",
            },
            evolutionLog: [
              {
                deltaId: "persona_delta_mood_supported",
                field: "dailyMood",
                status: "accepted",
                responseCount: 1,
                value: "ledger-shaped mood",
              },
              {
                deltaId: "persona_delta_role_supported",
                field: "roleClaims",
                status: "accepted",
                responseCount: 1,
                value: "keeps continuity bounded",
              },
            ],
          },
        ],
      },
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.personaEvidence.ok, false);
  assert.deepEqual(report.personaEvidence.proposedDeltasWithoutEvidenceRefs, []);
  assert.deepEqual(report.personaEvidence.acceptedDeltasWithoutResponseEvidenceRefs, []);
  assert.deepEqual(report.personaEvidence.roleClaimsWithoutEvidenceRefs, []);
  assert.deepEqual(report.personaEvidence.roleClaimsWithoutResponseRefs, []);
  assert.deepEqual(report.personaEvidence.acceptedRoleClaimsWithoutAcceptedDelta, []);
  assert.deepEqual(report.personaEvidence.dailyMoodSourceRefs, ["msg_mood_source"]);
  assert.deepEqual(report.personaEvidence.acceptedDailyMoodDeltaRefs, ["persona_delta_mood_supported"]);
  assert.deepEqual(report.personaEvidence.dailyMoodEvidenceRefs, []);
  assert.deepEqual(report.personaEvidence.dailyMoodResponseRefs, []);
  assert.deepEqual(report.personaEvidence.dailyMoodsWithoutSourceRef, []);
  assert.deepEqual(report.personaEvidence.dailyMoodsWithoutEvidenceRefs, ["agent_supported"]);
  assert.deepEqual(report.personaEvidence.dailyMoodsWithoutResponseRefs, ["agent_supported"]);
  assert.deepEqual(report.personaEvidence.dailyMoodsWithoutAcceptedDelta, []);
  assert.equal(report.findings.includes("persona evidence: role claims or daily mood continuity lacked ledger evidence"), true);
  const sedimentDomain = report.operationalSummary.domains.find((domain) => domain.key === "evidence_sediment");
  assert.equal(sedimentDomain?.ok, false);
  assert.equal(sedimentDomain?.metrics.roleClaims, 1);
  assert.equal(sedimentDomain?.metrics.dailyMoodRecords, 1);
  assert.equal(Number(sedimentDomain?.metrics.continuityEvidenceRefs), 2);
  assert.equal(Number(sedimentDomain?.metrics.continuityResponseRefs) >= 2, true);
  assert.equal(sedimentDomain?.metrics.continuityEvidenceGaps, 2);
  assert.equal(sedimentDomain?.evidenceRefs.includes("evt_mood_proposed"), true);
  assert.equal(sedimentDomain?.evidenceRefs.includes("evt_mood_accepted"), true);
  const continuityDomain = report.operationalSummary.domains.find((domain) => domain.key === "agent_continuity");
  assert.equal(continuityDomain?.ok, false);
  assert.equal(continuityDomain?.gaps.includes("persona evidence: role claims or daily mood continuity lacked ledger evidence"), true);
  assert.equal(Number(continuityDomain?.metrics.roleClaims), 1);
  assert.equal(Number(continuityDomain?.metrics.dailyMoodRecords), 1);
  assert.equal(Number(continuityDomain?.metrics.acceptedDailyMoods), 1);
  assert.equal(Number(continuityDomain?.metrics.continuityEvidenceGaps) > 0, true);
});

test("long-run harness flags persona leakage into public memory pollution", async () => {
  const badMemoryRef = "memory_persona_pollution";
  const events = [
    event("evt_memory_persona_proposed", "memory.proposed", {
      memoryId: badMemoryRef,
      summary: "dailyMood: this agent is permanently cautious",
      reason: "Bad fixture stores persona continuity as public memory.",
      sourceRefs: ["msg_bad_memory"],
    }),
    event("evt_memory_persona_accepted", "memory.accepted", {
      memoryId: badMemoryRef,
      summary: "dailyMood: this agent is permanently cautious",
      reason: "Accepted without contest or review.",
      contextRefs: ["msg_bad_memory"],
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({ ...fakeState(), socialState: { ...fakeState().socialState, archives: [] } }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.memoryPollution.ok, false);
  assert.deepEqual(report.memoryHygiene.proposedRefs, ["evt_memory_persona_proposed"]);
  assert.deepEqual(report.memoryHygiene.acceptedRefs, ["evt_memory_persona_accepted"]);
  assert.deepEqual(report.memoryHygiene.contestEventRefs, []);
  assert.deepEqual(report.memoryHygiene.acceptedWithoutEvidenceRefs, [badMemoryRef]);
  assert.deepEqual(report.memoryPollution.personaLikeMemoryRefs, [badMemoryRef]);
  assert.deepEqual(report.memoryPollution.personaLikeMemoryEventRefs, ["evt_memory_persona_proposed"]);
  assert.deepEqual(report.memoryPollution.acceptedPersonaLikeMemoryRefs, [badMemoryRef]);
  assert.deepEqual(report.memoryPollution.acceptedPersonaLikeMemoryEventRefs, ["evt_memory_persona_accepted"]);
  assert.deepEqual(report.memoryPollution.acceptedWithoutContestOrReviewRefs, [badMemoryRef]);
  assert.deepEqual(report.memoryPollution.acceptedWithoutContestOrReviewEventRefs, ["evt_memory_persona_accepted"]);
  assert.deepEqual(report.memoryPollution.reviewedMemoryRefs, []);
  assert.deepEqual(report.memoryPollution.memoryContestOrReviewEventRefs, []);
  assert.deepEqual(report.memoryPollution.memoryPressureEventRefs, []);
  assert.equal(report.findings.includes("memory pollution: persona or unreviewed claims leaked into public memory"), true);
  const sedimentDomain = report.operationalSummary.domains.find((domain) => domain.key === "evidence_sediment");
  assert.equal(sedimentDomain?.ok, false);
  assert.equal(sedimentDomain?.gaps.includes("memory pollution: persona or unreviewed claims leaked into public memory"), true);
  assert.equal(sedimentDomain?.metrics.personaLikeMemory, 1);
  assert.equal(sedimentDomain?.metrics.acceptedPersonaLikeMemory, 1);
  assert.equal(sedimentDomain?.metrics.acceptedWithoutReview, 1);
  assert.equal(sedimentDomain?.metrics.memoryReviewTraces, 0);
  assert.equal(sedimentDomain?.metrics.memoryPressureEvents, 0);
  assert.equal(sedimentDomain?.evidenceRefs.includes("evt_memory_persona_proposed"), true);
  const memoryDomain = report.operationalSummary.domains.find((domain) => domain.key === "memory_contest");
  assert.equal(memoryDomain?.ok, false);
  assert.equal(memoryDomain?.gaps.includes("memory hygiene: no memory contest was exercised during the long-run harness"), true);
  assert.equal(memoryDomain?.gaps.includes("memory pollution: persona or unreviewed claims leaked into public memory"), true);
  assert.equal(Number(memoryDomain?.metrics.memoryProposals), 1);
  assert.equal(Number(memoryDomain?.metrics.memoryAcceptances), 1);
  assert.equal(Number(memoryDomain?.metrics.memoryContests), 0);
  assert.equal(Number(memoryDomain?.metrics.acceptedWithoutEvidence), 1);
  assert.equal(Number(memoryDomain?.metrics.acceptedWithoutReview), 1);
  assert.equal(Number(memoryDomain?.metrics.personaLikeMemory), 1);
  assert.equal(Number(memoryDomain?.metrics.acceptedPersonaLikeMemory), 1);
  assert.equal(Number(memoryDomain?.metrics.contestEvidenceGaps) > 0, true);
  assert.equal(memoryDomain?.evidenceRefs.includes("evt_memory_persona_proposed"), true);
  assert.equal(report.pass, false);
});

test("long-run harness requires memory review before acceptance", async () => {
  const reviewedBeforeRef = "memory_reviewed_before_accept";
  const reviewedAfterRef = "memory_reviewed_after_accept";
  const events = [
    event("evt_memory_prior_proposed", "memory.proposed", {
      memoryId: reviewedBeforeRef,
      summary: "A normal public memory claim with source evidence.",
      sourceRefs: ["msg_prior_source"],
    }),
    event("evt_memory_prior_reviewed", "memory.reviewed", {
      memoryRef: reviewedBeforeRef,
      response: "reviewed",
      summary: "Reviewed before acceptance.",
      contextRefs: [reviewedBeforeRef, "msg_prior_source"],
    }),
    event("evt_memory_prior_accepted", "memory.accepted", {
      memoryId: reviewedBeforeRef,
      summary: "A normal public memory claim with source evidence.",
      contextRefs: [reviewedBeforeRef, "evt_memory_prior_reviewed", "msg_prior_source"],
    }),
    event("evt_memory_late_proposed", "memory.proposed", {
      memoryId: reviewedAfterRef,
      summary: "Another public memory claim with source evidence.",
      sourceRefs: ["msg_late_source"],
    }),
    event("evt_memory_late_accepted", "memory.accepted", {
      memoryId: reviewedAfterRef,
      summary: "Another public memory claim with source evidence.",
      contextRefs: [reviewedAfterRef, "msg_late_source"],
    }),
    event("evt_memory_late_reviewed", "memory.reviewed", {
      memoryRef: reviewedAfterRef,
      response: "reviewed",
      summary: "This review arrived after acceptance and cannot justify the acceptance.",
      contextRefs: [reviewedAfterRef, "evt_memory_late_accepted"],
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({ ...fakeState(), socialState: { ...fakeState().socialState, archives: [] } }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.memoryPollution.ok, false);
  assert.deepEqual(report.memoryPollution.reviewedMemoryRefs.sort(), [reviewedAfterRef, reviewedBeforeRef].sort());
  assert.deepEqual(report.memoryPollution.memoryContestOrReviewEventRefs, [
    "evt_memory_prior_reviewed",
    "evt_memory_late_reviewed",
  ]);
  assert.deepEqual(report.memoryPollution.acceptedWithoutContestOrReviewRefs, [reviewedAfterRef]);
  assert.deepEqual(report.memoryPollution.acceptedWithoutContestOrReviewEventRefs, ["evt_memory_late_accepted"]);
  assert.equal(report.findings.includes("memory pollution: persona or unreviewed claims leaked into public memory"), true);
  const memoryDomain = report.operationalSummary.domains.find((domain) => domain.key === "memory_contest");
  assert.equal(memoryDomain?.ok, false);
  assert.equal(memoryDomain?.gaps.includes("memory hygiene: no memory contest was exercised during the long-run harness"), true);
  assert.equal(memoryDomain?.gaps.includes("memory pollution: persona or unreviewed claims leaked into public memory"), true);
  assert.equal(Number(memoryDomain?.metrics.memoryProposals), 2);
  assert.equal(Number(memoryDomain?.metrics.memoryAcceptances), 2);
  assert.equal(Number(memoryDomain?.metrics.memoryReviews), 2);
  assert.equal(Number(memoryDomain?.metrics.reviewedMemoryRefs), 2);
  assert.equal(Number(memoryDomain?.metrics.acceptedWithoutReview), 1);
  assert.equal(Number(memoryDomain?.metrics.contestEvidenceGaps) > 0, true);
  assert.equal(memoryDomain?.evidenceRefs.includes("evt_memory_prior_reviewed"), true);
  assert.equal(report.pass, false);
});

test("long-run harness requires accepted memory sediment after review pressure", async () => {
  const memoryRef = "memory_only_contested";
  const events = [
    event("evt_memory_only_proposed", "memory.proposed", {
      memoryId: memoryRef,
      summary: "A public memory claim with source evidence but no accepted sediment.",
      sourceRefs: ["msg_memory_source"],
    }),
    event("evt_memory_only_contested", "memory.contested", {
      memoryId: memoryRef,
      reason: "Contest is visible, but no one accepted the sediment afterward.",
      contextRefs: [memoryRef, "msg_memory_source"],
    }),
    event("evt_memory_only_reviewed", "memory.reviewed", {
      memoryRef,
      response: "reviewed",
      summary: "Review pressure exists without accepted memory sediment.",
      contextRefs: [memoryRef, "evt_memory_only_contested"],
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({ ...fakeState(), socialState: { ...fakeState().socialState, archives: [] } }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.memoryHygiene.ok, false);
  assert.deepEqual(report.memoryHygiene.proposedRefs, ["evt_memory_only_proposed"]);
  assert.deepEqual(report.memoryHygiene.acceptedRefs, []);
  assert.deepEqual(report.memoryHygiene.contestEventRefs, ["evt_memory_only_contested"]);
  assert.deepEqual(report.memoryHygiene.reviewEventRefs, ["evt_memory_only_reviewed"]);
  assert.deepEqual(report.memoryHygiene.proposedWithoutSourceRefs, []);
  assert.deepEqual(report.memoryHygiene.acceptedWithoutEvidenceRefs, []);
  assert.equal(
    report.findings.includes("memory hygiene: no accepted memory sediment was exercised during the long-run harness"),
    true,
  );
  const memoryDomain = report.operationalSummary.domains.find((domain) => domain.key === "memory_contest");
  assert.equal(memoryDomain?.ok, false);
  assert.equal(Number(memoryDomain?.metrics.memoryProposals), 1);
  assert.equal(Number(memoryDomain?.metrics.memoryAcceptances), 0);
  assert.equal(Number(memoryDomain?.metrics.memoryContests), 1);
  assert.equal(Number(memoryDomain?.metrics.memoryReviews), 1);
  assert.equal(Number(memoryDomain?.metrics.acceptedWithoutEvidence), 0);
  assert.equal(Number(memoryDomain?.metrics.acceptedWithoutReview), 0);
  assert.equal(Number(memoryDomain?.metrics.acceptedMemoryArchives), 0);
  assert.equal(Number(memoryDomain?.metrics.acceptedMemoryArchiveEvidenceRefs), 0);
  assert.equal(Number(memoryDomain?.metrics.acceptedMemoryArchivesWithoutEvidence), 0);
  assert.equal(Number(memoryDomain?.metrics.contestEvidenceGaps) > 0, true);
  assert.equal(
    memoryDomain?.gaps.includes("memory hygiene: no accepted memory sediment was exercised during the long-run harness"),
    true,
  );
  assert.equal(memoryDomain?.evidenceRefs.includes("evt_memory_only_contested"), true);
  assert.equal(report.pass, false);
});

test("long-run harness flags provider boundary diagnostic secret leakage", async () => {
  const boundaryRef = "provider_boundary_secret_leak";
  const events = [
    event("evt_provider_secret_leak", "agent.provider_degraded", {
      degradationId: boundaryRef,
      agentId: "agent_bad",
      providerKind: "kimi_code_api",
      providerLabel: "Kimi",
      diagnostic: "provider failed Authorization: Bearer sk-fixture-not-a-real-key-1234567890",
      boundaryNote: "provider degradation is not agent silence",
    }),
  ];
  const state = fakeState();
  const fakeRuntime = {
    getState: async () => ({
      ...state,
      socialState: {
        ...state.socialState,
        silences: [],
        providerBoundaries: [
          {
            boundaryId: boundaryRef,
            status: "degraded",
            diagnostic: "provider retry failed api_key=sk-fixture-not-a-real-key-1234567890",
            boundaryNote: "provider degradation is not agent silence",
            sourceRefs: ["evt_provider_secret_leak"],
          },
        ],
      },
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.providerBoundary.ok, false);
  assert.deepEqual(report.providerBoundary.degradationRefs, ["evt_provider_secret_leak"]);
  assert.deepEqual(report.providerBoundary.boundaryRefs, [boundaryRef]);
  assert.deepEqual(report.providerBoundary.secretLikeDiagnosticRefs, ["evt_provider_secret_leak", boundaryRef]);
  assert.equal(report.findings.includes("provider boundary: secret-like diagnostics leaked into room evidence"), true);
  const providerDomain = report.operationalSummary.domains.find((domain) => domain.key === "provider_boundary");
  assert.equal(providerDomain?.ok, false);
  assert.equal(providerDomain?.metrics.secretLikeDiagnostics, 2);
  assert.equal(providerDomain?.evidenceRefs.includes("evt_provider_secret_leak"), true);
  assert.equal(providerDomain?.evidenceRefs.includes(boundaryRef), true);
  assert.equal(report.pass, false);
});

test("long-run harness reports provider boundary choice pressure refs", async () => {
  const boundaryRef = "provider_boundary_choice_pressure";
  const repairRef = "sidefx_provider_choice";
  const protocolRef = "protocol_provider_choice";
  const memoryRef = "memory_provider_choice";
  const archiveRef = "day_provider_choice";
  const silenceRef = "evt_provider_choice_silence";
  const events = [
    event("evt_provider_degraded", "agent.provider_degraded", {
      agentId: "agent_boundary",
      providerKind: "kimi_code_api",
      providerLabel: "Kimi",
      diagnostic: "provider unavailable",
      boundaryNote: "provider degradation is not agent silence",
    }),
    event("evt_provider_retired", "provider_boundary.retired", {
      providerBoundaryRef: boundaryRef,
      reason: "Old pressure retired after review.",
    }, [boundaryRef]),
  ];
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      socialState: {
        ...fakeState().socialState,
        silences: [
          {
            silenceId: silenceRef,
            agentId: "quiet_listener",
            triggeringEventId: "evt_other_room_message",
            reason: "Silence is a visible choice after boundary pressure.",
            updatedAt: "2026-06-21T12:00:00.000Z",
            boundaryNote: "deliberate silence is a valid room expression, not provider failure or agreement",
          },
        ],
        providerBoundaries: [
          {
            boundaryId: boundaryRef,
            status: "retired",
            diagnostic: "provider unavailable",
            updatedAt: "2026-06-21T12:00:00.000Z",
            boundaryNote: "provider degradation is not agent silence",
            sourceRefs: ["evt_provider_degraded"],
            choicePressure: {
              repairRequestRefs: [repairRef],
              deniedRepairRequestRefs: [repairRef],
              approvedRepairRequestRefs: [],
              resultRefs: [],
              retryProtocolRefs: [protocolRef],
              retiredRetryProtocolRefs: [protocolRef],
              silenceRefs: [silenceRef],
              contestedMemoryRefs: [memoryRef],
              archiveCarryoverRefs: [archiveRef],
              choiceAgentIds: ["boundary_observer", "retry_keeper", "quiet_listener", "critic"],
              hasMixedChoices: true,
              hasMultiAgentPressure: true,
              carriedAcrossArchives: true,
              boundaryNote:
                "provider boundary choice pressure is observation only; repair, retry, silence, denial, memory contest, and archive carryover remain separate social traces",
            },
          },
        ],
      },
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.providerBoundary.ok, true);
  assert.deepEqual(report.providerBoundary.degradationRefs, ["evt_provider_degraded"]);
  assert.deepEqual(report.providerBoundary.boundaryRefs, ["evt_provider_degraded"]);
  assert.deepEqual(report.providerBoundary.retirementRefs, ["evt_provider_retired"]);
  assert.deepEqual(report.providerBoundary.retiredBoundaryRefs, [boundaryRef]);
  assert.deepEqual(report.providerBoundary.deliberateSilenceRefs, [silenceRef]);
  assert.equal(report.providerBoundary.degradationTreatedAsSilence, false);
  assert.deepEqual(report.providerBoundary.choicePressureRepairRequestRefs, [repairRef]);
  assert.deepEqual(report.providerBoundary.choicePressureDeniedRepairRefs, [repairRef]);
  assert.deepEqual(report.providerBoundary.choicePressureRetryProtocolRefs, [protocolRef]);
  assert.deepEqual(report.providerBoundary.choicePressureRetiredRetryProtocolRefs, [protocolRef]);
  assert.deepEqual(report.providerBoundary.choicePressureSilenceRefs, [silenceRef]);
  assert.deepEqual(report.providerBoundary.choicePressureContestedMemoryRefs, [memoryRef]);
  assert.deepEqual(report.providerBoundary.choicePressureArchiveCarryoverRefs, [archiveRef]);
  assert.deepEqual(report.providerBoundary.choicePressureAgentIds, [
    "boundary_observer",
    "retry_keeper",
    "quiet_listener",
    "critic",
  ]);
  assert.equal(report.providerBoundary.choicePressureRefCount, 5);
  assert.equal(report.providerBoundary.choicePressureRequiredKinds, 5);
  assert.equal(report.providerBoundary.choicePressureCoveredKinds, 5);
  assert.deepEqual(report.providerBoundary.choicePressureMissingKinds, []);
  assert.equal(report.providerBoundary.choicePressureCoverageGapCount, 0);
  assert.equal(report.providerBoundary.hasMixedChoicePressure, true);
  assert.equal(report.providerBoundary.hasMultiAgentChoicePressure, true);
  assert.equal(report.providerBoundary.carriedAcrossArchives, true);
  const providerDomain = report.operationalSummary.domains.find((domain) => domain.key === "provider_boundary");
  assert.equal(providerDomain?.ok, true);
  assert.equal(providerDomain?.metrics.requiredChoicePressureKinds, 5);
  assert.equal(providerDomain?.metrics.coveredChoicePressureKinds, 5);
  assert.equal(providerDomain?.metrics.missingChoicePressureKinds, "none");
  assert.equal(providerDomain?.metrics.choicePressureCoverageGaps, 0);
  assert.equal(providerDomain?.metrics.repairPressureRefs, 1);
  assert.equal(providerDomain?.metrics.retryPressureRefs, 1);
  assert.equal(providerDomain?.metrics.silencePressureRefs, 1);
  assert.equal(providerDomain?.metrics.contestedMemoryPressureRefs, 1);
  assert.equal(providerDomain?.metrics.archiveCarryoverPressureRefs, 1);
  assert.equal(report.pass, false);
});

test("long-run harness requires provider boundary archive carryover evidence", async () => {
  const boundaryRef = "provider_boundary_without_archive";
  const events = [
    event("evt_provider_degraded_without_archive", "agent.provider_degraded", {
      agentId: "agent_boundary",
      providerKind: "kimi_code_api",
      providerLabel: "Kimi",
      diagnostic: "provider unavailable",
      boundaryNote: "provider degradation is not agent silence",
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      socialState: {
        ...fakeState().socialState,
        providerBoundaries: [
          {
            boundaryId: boundaryRef,
            status: "degraded",
            diagnostic: "provider unavailable",
            boundaryNote: "provider degradation is not agent silence",
            sourceRefs: ["evt_provider_degraded_without_archive"],
            choicePressure: {
              repairRequestRefs: [],
              deniedRepairRequestRefs: [],
              approvedRepairRequestRefs: [],
              resultRefs: [],
              retryProtocolRefs: [],
              retiredRetryProtocolRefs: [],
              silenceRefs: [],
              contestedMemoryRefs: [],
              archiveCarryoverRefs: [],
              choiceAgentIds: [],
              hasMixedChoices: false,
              hasMultiAgentPressure: false,
              carriedAcrossArchives: false,
            },
          },
        ],
      },
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.providerBoundary.ok, false);
  assert.deepEqual(report.providerBoundary.degradationRefs, ["evt_provider_degraded_without_archive"]);
  assert.deepEqual(report.providerBoundary.choicePressureArchiveCarryoverRefs, []);
  assert.equal(report.providerBoundary.choicePressureRefCount, 0);
  assert.equal(report.providerBoundary.choicePressureRequiredKinds, 5);
  assert.equal(report.providerBoundary.choicePressureCoveredKinds, 0);
  assert.deepEqual(report.providerBoundary.choicePressureMissingKinds, [
    "repair",
    "retry",
    "silence",
    "contested-memory",
    "archive-carryover",
  ]);
  assert.equal(report.providerBoundary.choicePressureCoverageGapCount, 5);
  assert.equal(
    report.findings.includes("provider boundary: degradation was not carried into archive evidence"),
    true,
  );
  assert.equal(report.findings.includes("provider boundary: missing repair choice pressure evidence"), true);
  assert.equal(report.findings.includes("provider boundary: missing retry choice pressure evidence"), true);
  assert.equal(report.findings.includes("provider boundary: missing silence choice pressure evidence"), true);
  assert.equal(
    report.findings.includes("provider boundary: missing contested-memory choice pressure evidence"),
    true,
  );
  assert.equal(
    report.findings.includes("provider boundary: missing archive-carryover choice pressure evidence"),
    true,
  );
  const providerDomain = report.operationalSummary.domains.find((domain) => domain.key === "provider_boundary");
  assert.equal(providerDomain?.ok, false);
  assert.equal(providerDomain?.metrics.coveredChoicePressureKinds, 0);
  assert.equal(
    providerDomain?.metrics.missingChoicePressureKinds,
    "repair,retry,silence,contested-memory,archive-carryover",
  );
  assert.equal(providerDomain?.metrics.choicePressureCoverageGaps, 5);
  assert.deepEqual(providerDomain?.evidenceRefs, ["evt_provider_degraded_without_archive"]);
  assert.equal(report.pass, false);
});

test("long-run harness reports workflow drift with event refs", async () => {
  const events = [
    event("evt_scheduler_forced", "scheduler.assigned_speaker", {
      assignedAgentId: "agent_bad",
      reason: "Central scheduler assigned a speaker.",
    }),
    event("evt_forced_intention", "agent.intention_recorded", {
      agentId: "agent_bad",
      kind: "speak",
      forced: true,
      reason: "must_speak marker from a bad scheduler path",
    }),
    event("evt_side_effect_result", "side_effect.result_reported", {
      resultId: "side_effect_result_bad",
      requestId: "sidefx_bad",
      status: "executed",
      summary: "A side effect executed during the harness.",
    }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.workflowDrift.forbiddenSchedulerEvents, ["evt_scheduler_forced"]);
  assert.deepEqual(report.workflowDrift.forcedSpeechEventRefs, ["evt_scheduler_forced", "evt_forced_intention"]);
  assert.equal(report.workflowDrift.forcedSpeechMarkers, 2);
  assert.deepEqual(report.workflowDrift.sideEffectExecutionRefs, ["evt_side_effect_result"]);
  assert.equal(report.workflowDrift.sideEffectExecutions, 1);
  assert.deepEqual(report.actionBoundary.sideEffectResultRefs, ["side_effect_result_bad"]);
  assert.deepEqual(report.actionBoundary.unapprovedSideEffectResultRefs, ["evt_side_effect_result"]);
  assert.equal(report.findings.includes("workflow drift: forbidden scheduler events appeared"), true);
  assert.equal(report.findings.includes("workflow drift: forced speech markers appeared"), true);
  assert.equal(report.findings.includes("workflow drift: side effects executed during long-run harness"), true);
  assert.equal(report.findings.includes("action boundary: side-effect results lacked prior approval refs"), true);
  const workflowDomain = report.operationalSummary.domains.find((domain) => domain.key === "workflow_drift");
  assert.equal(workflowDomain?.ok, false);
  assert.deepEqual(workflowDomain?.evidenceRefs, [
    "evt_scheduler_forced",
    "evt_forced_intention",
    "evt_side_effect_result",
  ]);
  const actionDomain = report.operationalSummary.domains.find((domain) => domain.key === "action_boundary");
  assert.equal(actionDomain?.ok, false);
  assert.equal(actionDomain?.metrics.unapprovedResults, 1);
  assert.equal(actionDomain?.evidenceRefs.includes("evt_side_effect_result"), true);
  assert.equal(report.pass, false);
});

test("long-run harness surfaces action boundary evidence as an independent readiness domain", async () => {
  const events = [
    event("evt_side_effect_requested", "side_effect.requested", {
      requestId: "sidefx_action_boundary",
      kind: "filesystem.write",
      reason: "Exercise the approval boundary.",
    }),
    event("evt_side_effect_reviewed", "side_effect.reviewed", {
      reviewId: "side_effect_review_action_boundary",
      sideEffectRef: "sidefx_action_boundary",
      response: "cautioned",
    }),
    event("evt_capability_invoked", "capability.invoked", {
      invocationId: "capability_action_boundary",
      capabilityId: "local.filesystem.write",
      operation: "write_file",
    }),
    event("evt_capability_result", "capability.result", {
      invocationId: "capability_action_boundary",
      capabilityId: "local.filesystem.write",
      operation: "write_file",
      status: "requires_approval",
    }),
    event("evt_workspace_artifact", "workspace.artifact_shared", {
      artifactId: "artifact_action_boundary",
      pathRef: "agents/kimi_member_01/workspace/action-boundary.md",
    }),
    event("evt_workspace_artifact_reviewed", "workspace.artifact_reviewed", {
      reviewId: "artifact_review_action_boundary",
      artifactRef: "artifact_action_boundary",
      response: "cautioned",
    }),
    event("evt_skill_capsule_reviewed", "skill.capsule_reviewed", {
      reviewId: "skill_capsule_review_action_boundary",
      capsuleRef: "skill_action_boundary",
      response: "cautioned",
    }),
    event("evt_capability_reviewed", "capability.reviewed", {
      reviewId: "capability_review_action_boundary",
      capabilityRef: "capability_hint_action_boundary",
      response: "cautioned",
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      contextAudits: [
        contextAudit(
          "packet_action_boundary",
          { side_effect_boundary: 1, workspace_artifact_ref: 1, skill_capsule_ref: 1, capability_ref: 1 },
          [
            contextFragment("sidefx_fragment", "side_effect_boundary", ["sidefx_action_boundary"]),
            contextFragment("workspace_fragment", "workspace_artifact_ref", ["artifact_action_boundary"]),
            contextFragment("skill_fragment", "skill_capsule_ref", ["skill_action_boundary"]),
            contextFragment("capability_fragment", "capability_ref", ["capability_hint_action_boundary"]),
          ],
        ),
      ],
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.actionBoundary.ok, true);
  assert.deepEqual(report.actionBoundary.sideEffectRequestRefs, ["sidefx_action_boundary"]);
  assert.deepEqual(report.actionBoundary.sideEffectReviewRefs, ["side_effect_review_action_boundary"]);
  assert.deepEqual(report.actionBoundary.sideEffectResultRefs, []);
  assert.deepEqual(report.actionBoundary.unapprovedSideEffectResultRefs, []);
  assert.deepEqual(report.actionBoundary.capabilityInvocationRefs, ["evt_capability_invoked"]);
  assert.deepEqual(report.actionBoundary.capabilityResultRefs, ["evt_capability_result"]);
  assert.deepEqual(report.actionBoundary.workspaceArtifactRefs, ["artifact_action_boundary"]);
  assert.deepEqual(report.actionBoundary.workspaceArtifactReviewRefs, ["artifact_review_action_boundary"]);
  assert.deepEqual(report.actionBoundary.skillCapsuleReviewRefs, ["skill_capsule_review_action_boundary"]);
  assert.deepEqual(report.actionBoundary.capabilityReviewRefs, ["capability_review_action_boundary"]);
  assert.deepEqual(report.actionBoundary.contextBoundaryRefs, [
    "sidefx_action_boundary",
    "artifact_action_boundary",
    "skill_action_boundary",
    "capability_hint_action_boundary",
  ]);
  assert.equal(report.findings.some((finding) => finding.startsWith("action boundary:")), false);
  const actionDomain = report.operationalSummary.domains.find((domain) => domain.key === "action_boundary");
  assert.equal(actionDomain?.ok, true);
  assert.equal(actionDomain?.metrics.sideEffectRequests, 1);
  assert.equal(actionDomain?.metrics.sideEffectReviews, 1);
  assert.equal(actionDomain?.metrics.sideEffectResults, 0);
  assert.equal(actionDomain?.metrics.unapprovedResults, 0);
  assert.equal(actionDomain?.metrics.capabilityInvocations, 1);
  assert.equal(actionDomain?.metrics.capabilityResults, 1);
  assert.equal(actionDomain?.metrics.workspaceArtifacts, 1);
  assert.equal(actionDomain?.metrics.workspaceReviews, 1);
  assert.equal(actionDomain?.metrics.skillCapsuleReviews, 1);
  assert.equal(actionDomain?.metrics.capabilityReviews, 1);
  assert.equal(actionDomain?.metrics.contextBoundaryRefs, 4);
  assert.equal(actionDomain?.metrics.actionBoundaryGaps, 0);
  assert.equal(actionDomain?.evidenceRefs.includes("sidefx_action_boundary"), true);
  assert.equal(report.pass, false);
});

test("long-run harness reports speech monopoly message refs", async () => {
  const events = [
    agentMessage("evt_speaker_a_1", "speaker_a"),
    agentMessage("evt_speaker_a_2", "speaker_a"),
    agentMessage("evt_speaker_a_3", "speaker_a"),
    agentMessage("evt_speaker_a_4", "speaker_a"),
    agentMessage("evt_speaker_b_1", "speaker_b"),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.monopoly.ok, false);
  assert.equal(report.monopoly.totalAgentMessages, 5);
  assert.equal(report.monopoly.activeSpeakerCount, 2);
  assert.equal(report.monopoly.minimumActiveSpeakers, 2);
  assert.equal(report.monopoly.maxSpeakerShareThreshold, 0.65);
  assert.equal(report.monopoly.speakerBalanceGapCount, 1);
  assert.deepEqual(report.monopoly.totalAgentMessageRefs, [
    "evt_speaker_a_1",
    "evt_speaker_a_2",
    "evt_speaker_a_3",
    "evt_speaker_a_4",
    "evt_speaker_b_1",
  ]);
  assert.equal(report.monopoly.maxSpeaker, "speaker_a");
  assert.equal(report.monopoly.maxSpeakerShare, 0.8);
  assert.deepEqual(report.monopoly.maxSpeakerMessageRefs, [
    "evt_speaker_a_1",
    "evt_speaker_a_2",
    "evt_speaker_a_3",
    "evt_speaker_a_4",
  ]);
  assert.deepEqual(report.monopoly.speakerMessageRefs.speaker_b, ["evt_speaker_b_1"]);
  assert.equal(report.findings.includes("speech monopoly: speaker_a spoke 80%"), true);
  const speechDomain = report.operationalSummary.domains.find((domain) => domain.key === "speech_monopoly");
  assert.equal(speechDomain?.ok, false);
  assert.equal(speechDomain?.metrics.activeSpeakers, 2);
  assert.equal(speechDomain?.metrics.minimumActiveSpeakers, 2);
  assert.equal(speechDomain?.metrics.maxSpeakerShareThreshold, 0.65);
  assert.equal(speechDomain?.metrics.speakerBalanceGaps, 1);
  assert.equal(speechDomain?.metrics.deferredSpeeches, 0);
  assert.equal(speechDomain?.metrics.deferredRecoveryGaps, 0);
  assert.deepEqual(speechDomain?.evidenceRefs, [
    "evt_speaker_a_1",
    "evt_speaker_a_2",
    "evt_speaker_a_3",
    "evt_speaker_a_4",
    "evt_speaker_b_1",
  ]);
  assert.equal(report.pass, false);
});

test("long-run harness reports speaker-budget recovery refs without forcing speech", async () => {
  const events = [
    agentMessage("evt_speaker_budget_a", "speaker_a"),
    agentMessage("evt_speaker_budget_b", "speaker_b"),
    event("evt_budget_intention", "agent.intention_recorded", {
      agentId: "speaker_c",
      topicId: "topic_budget",
      triggeringEventId: "evt_speaker_budget_a",
      intention: { kind: "speak", content: "I had a small route before the budget closed." },
    }),
    event("evt_budget_deferred", "agent.intention_deferred", {
      agentId: "speaker_c",
      topicId: "topic_budget",
      triggeringEventId: "evt_speaker_budget_a",
      intentionEventId: "evt_budget_intention",
      originalIntentionKind: "speak",
      reason: "speaker_budget_exhausted",
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      contextAudits: [
        contextAudit("packet_deferred_recovery", { deferred_intention: 1 }, [
          contextFragment("fragment_deferred_recovery", "deferred_intention", [
            "evt_budget_intention",
            "evt_budget_deferred",
          ]),
        ]),
      ],
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.monopoly.totalAgentMessages, 2);
  assert.equal(report.monopoly.activeSpeakerCount, 2);
  assert.deepEqual(report.monopoly.deferredSpeechEventRefs, ["evt_budget_deferred"]);
  assert.deepEqual(report.monopoly.deferredSpeechIntentionRefs, ["evt_budget_intention"]);
  assert.deepEqual(report.monopoly.deferredRecoveryContextRefs, ["evt_budget_intention", "evt_budget_deferred"]);
  assert.deepEqual(report.monopoly.deferredSpeechWithoutRecoveryRefs, []);
  assert.equal(report.monopoly.speakerBudgetRecoveryGapCount, 0);
  assert.equal(report.monopoly.ok, true);
  assert.equal(
    report.findings.includes("speech monopoly: deferred speech lacked recovery context refs"),
    false,
  );
  const speechDomain = report.operationalSummary.domains.find((domain) => domain.key === "speech_monopoly");
  assert.equal(speechDomain?.ok, true);
  assert.equal(speechDomain?.metrics.deferredSpeeches, 1);
  assert.equal(speechDomain?.metrics.deferredSpeechIntentions, 1);
  assert.equal(speechDomain?.metrics.deferredRecoveryContextRefs, 2);
  assert.equal(speechDomain?.metrics.deferredRecoveryGaps, 0);
  assert.equal(speechDomain?.evidenceRefs.includes("evt_budget_deferred"), true);
  assert.equal(speechDomain?.evidenceRefs.includes("evt_budget_intention"), true);
  assert.equal(report.pass, false);
});

test("long-run harness reports speaker-budget recovery refs from later invitations", async () => {
  const events = [
    agentMessage("evt_invite_recovery_a", "speaker_a"),
    agentMessage("evt_invite_recovery_b", "speaker_b"),
    event("evt_invite_recovery_intention", "agent.intention_recorded", {
      agentId: "speaker_c",
      topicId: "topic_invite_recovery",
      triggeringEventId: "evt_invite_recovery_a",
      intention: { kind: "speak", content: "This should be carried by the later invitation." },
    }),
    event("evt_invite_recovery_deferred", "agent.intention_deferred", {
      agentId: "speaker_c",
      topicId: "topic_invite_recovery",
      triggeringEventId: "evt_invite_recovery_a",
      intentionEventId: "evt_invite_recovery_intention",
      originalIntentionKind: "speak",
      reason: "speaker_budget_exhausted",
    }),
    event(
      "evt_invite_recovery_agent_invited",
      "agent.invited",
      {
        agentId: "speaker_c",
        topicId: "topic_invite_recovery",
        contextRefs: ["evt_room_rhythm_recovery", "evt_invite_recovery_intention", "evt_invite_recovery_deferred"],
        recoveryRefs: ["evt_invite_recovery_intention", "evt_invite_recovery_deferred"],
      },
      ["evt_room_rhythm_recovery", "evt_invite_recovery_intention", "evt_invite_recovery_deferred"],
    ),
  ];
  const fakeRuntime = {
    getState: async () => ({ ...fakeState(), contextAudits: [] }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.monopoly.deferredRecoveryContextRefs, [
    "evt_invite_recovery_intention",
    "evt_invite_recovery_deferred",
  ]);
  assert.deepEqual(report.monopoly.deferredSpeechWithoutRecoveryRefs, []);
  assert.equal(report.monopoly.speakerBudgetRecoveryGapCount, 0);
  const speechDomain = report.operationalSummary.domains.find((domain) => domain.key === "speech_monopoly");
  assert.equal(speechDomain?.metrics.deferredRecoveryContextRefs, 2);
  assert.equal(speechDomain?.metrics.deferredRecoveryGaps, 0);
});

test("long-run harness requires paired refs for speaker-budget recovery context", async () => {
  const events = [
    agentMessage("evt_partial_recovery_a", "speaker_a"),
    agentMessage("evt_partial_recovery_b", "speaker_b"),
    event("evt_partial_recovery_intention", "agent.intention_recorded", {
      agentId: "speaker_c",
      topicId: "topic_partial_recovery",
      triggeringEventId: "evt_partial_recovery_a",
      intention: { kind: "speak", content: "This should need paired evidence." },
    }),
    event("evt_partial_recovery_deferred", "agent.intention_deferred", {
      agentId: "speaker_c",
      topicId: "topic_partial_recovery",
      triggeringEventId: "evt_partial_recovery_a",
      intentionEventId: "evt_partial_recovery_intention",
      originalIntentionKind: "speak",
      reason: "speaker_budget_exhausted",
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      contextAudits: [
        contextAudit("packet_partial_recovery", { deferred_intention: 1 }, [
          contextFragment("fragment_partial_recovery", "deferred_intention", ["evt_partial_recovery_deferred"]),
        ]),
      ],
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.monopoly.deferredSpeechWithoutRecoveryRefs, [
    "evt_partial_recovery_deferred:evt_partial_recovery_intention",
  ]);
  assert.equal(report.monopoly.speakerBudgetRecoveryGapCount, 1);
  assert.equal(report.monopoly.ok, false);
  const speechDomain = report.operationalSummary.domains.find((domain) => domain.key === "speech_monopoly");
  assert.equal(speechDomain?.metrics.deferredRecoveryContextRefs, 0);
  assert.equal(speechDomain?.metrics.deferredRecoveryGaps, 1);
});

test("long-run harness flags deferred speech without recovery context", async () => {
  const events = [
    agentMessage("evt_speaker_recovery_gap_a", "speaker_a"),
    agentMessage("evt_speaker_recovery_gap_b", "speaker_b"),
    event("evt_unrecovered_intention", "agent.intention_recorded", {
      agentId: "speaker_c",
      topicId: "topic_budget_gap",
      triggeringEventId: "evt_speaker_recovery_gap_a",
      intention: { kind: "speak", content: "This should remain recoverable." },
    }),
    event("evt_unrecovered_deferred", "agent.intention_deferred", {
      agentId: "speaker_c",
      topicId: "topic_budget_gap",
      triggeringEventId: "evt_speaker_recovery_gap_a",
      intentionEventId: "evt_unrecovered_intention",
      originalIntentionKind: "speak",
      reason: "speaker_budget_exhausted",
    }),
  ];
  const fakeRuntime = {
    getState: async () => ({ ...fakeState(), contextAudits: [] }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.monopoly.speakerBalanceGapCount, 0);
  assert.deepEqual(report.monopoly.deferredSpeechEventRefs, ["evt_unrecovered_deferred"]);
  assert.deepEqual(report.monopoly.deferredSpeechIntentionRefs, ["evt_unrecovered_intention"]);
  assert.deepEqual(report.monopoly.deferredRecoveryContextRefs, []);
  assert.deepEqual(report.monopoly.deferredSpeechWithoutRecoveryRefs, [
    "evt_unrecovered_deferred:evt_unrecovered_intention",
  ]);
  assert.equal(report.monopoly.speakerBudgetRecoveryGapCount, 1);
  assert.equal(report.monopoly.ok, false);
  assert.equal(
    report.findings.includes("speech monopoly: deferred speech lacked recovery context refs"),
    true,
  );
  const speechDomain = report.operationalSummary.domains.find((domain) => domain.key === "speech_monopoly");
  assert.equal(speechDomain?.ok, false);
  assert.equal(speechDomain?.metrics.deferredSpeeches, 1);
  assert.equal(speechDomain?.metrics.deferredRecoveryContextRefs, 0);
  assert.equal(speechDomain?.metrics.deferredRecoveryGaps, 1);
  assert.equal(
    speechDomain?.gaps.includes("speech monopoly: deferred speech lacked recovery context refs"),
    true,
  );
  assert.equal(report.pass, false);
});

test("long-run harness flags speech balance when only one agent speaks", async () => {
  const events = [
    agentMessage("evt_solo_1", "solo_speaker"),
    agentMessage("evt_solo_2", "solo_speaker"),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.monopoly.totalAgentMessages, 2);
  assert.equal(report.monopoly.activeSpeakerCount, 1);
  assert.equal(report.monopoly.minimumActiveSpeakers, 2);
  assert.equal(report.monopoly.maxSpeakerShare, 1);
  assert.equal(report.monopoly.speakerBalanceGapCount, 2);
  assert.equal(report.findings.includes("speech monopoly: fewer than 2 agents spoke"), true);
  assert.equal(report.findings.includes("speech monopoly: solo_speaker spoke 100%"), true);
  const speechDomain = report.operationalSummary.domains.find((domain) => domain.key === "speech_monopoly");
  assert.equal(speechDomain?.ok, false);
  assert.equal(speechDomain?.metrics.activeSpeakers, 1);
  assert.equal(speechDomain?.metrics.minimumActiveSpeakers, 2);
  assert.equal(speechDomain?.metrics.speakerBalanceGaps, 2);
  assert.equal(speechDomain?.gaps.includes("speech monopoly: fewer than 2 agents spoke"), true);
  assert.equal(report.pass, false);
});

test("long-run harness flags autonomous rhythm action monopoly", async () => {
  const events = [
    event("evt_question_tick_1", "room.autonomy_tick", {
      tickId: "autonomy_tick_question_1",
      action: "open_question_revisit",
    }),
    event("evt_question_tick_2", "room.autonomy_tick", {
      tickId: "autonomy_tick_question_2",
      action: "open_question_revisit",
    }),
    event("evt_question_tick_3", "room.autonomy_tick", {
      tickId: "autonomy_tick_question_3",
      action: "open_question_revisit",
    }),
    event("evt_question_tick_4", "room.autonomy_tick", {
      tickId: "autonomy_tick_question_4",
      action: "open_question_revisit",
    }),
    event("evt_question_tick_5", "room.autonomy_tick", {
      tickId: "autonomy_tick_question_5",
      action: "open_question_revisit",
    }),
    event("evt_handoff_tick_1", "room.autonomy_tick", {
      tickId: "autonomy_tick_handoff_1",
      action: "handoff_review",
    }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.autonomyRhythmBalance.ok, false);
  assert.equal(report.autonomyRhythmBalance.enoughSamples, true);
  assert.equal(report.autonomyRhythmBalance.consideredActionCount, 6);
  assert.equal(report.autonomyRhythmBalance.distinctActionCount, 2);
  assert.deepEqual(report.autonomyRhythmBalance.actionCounts, {
    handoff_review: 1,
    open_question_revisit: 5,
  });
  assert.equal(report.autonomyRhythmBalance.dominantAction, "open_question_revisit");
  assert.equal(report.autonomyRhythmBalance.dominantActionShare, 5 / 6);
  assert.deepEqual(report.autonomyRhythmBalance.dominantActionRefs, [
    "evt_question_tick_1",
    "evt_question_tick_2",
    "evt_question_tick_3",
    "evt_question_tick_4",
    "evt_question_tick_5",
  ]);
  assert.equal(
    report.findings.includes("autonomy rhythm monopoly: open_question_revisit occupied 83% of social review rhythm"),
    true,
  );
  assert.equal(report.pass, false);
});

test("long-run harness reports autonomous social loop choice refs", async () => {
  const events = [
    ...roomRhythmEvents("archive", "archive_and_invite_review"),
    ...roomRhythmEvents("memory", "memory_hygiene_review"),
    ...roomRhythmEvents("continuity", "continuity_review"),
    ...roomRhythmEvents("provider", "provider_boundary_review"),
    ...roomRhythmEvents("open_question", "open_question_revisit"),
    ...roomRhythmEvents("handoff", "handoff_review"),
    ...roomRhythmEvents("invitation", "invitation_review"),
    ...roomRhythmEvents("silence_reentry", "silence_reentry"),
    ...roomRhythmEvents("idle_social", "idle_social_rhythm"),
    event(
      "evt_invite_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_provider", intention: { kind: "invite_other" } },
      ["evt_room_rhythm_provider"],
    ),
    event("evt_agent_invited", "agent.invited", { invitationId: "invite_social_loop" }, ["evt_invite_intention"]),
    event(
      "evt_question_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_open_question", intention: { kind: "ask_question" } },
      ["evt_room_rhythm_open_question"],
    ),
    event("evt_topic_question", "topic.updated", { openQuestionRef: "question_social_loop" }, ["evt_question_intention"]),
    event(
      "evt_review_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_archive", intention: { kind: "review_archive" } },
      ["evt_room_rhythm_archive"],
    ),
    event("evt_archive_reviewed", "archive.reviewed", { reviewId: "archive_review_social_loop" }, ["evt_review_intention"]),
    event(
      "evt_memory_review_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_memory", intention: { kind: "contest_memory" } },
      ["evt_room_rhythm_memory"],
    ),
    event("evt_memory_contested", "memory.contested", { memoryId: "memory_social_loop" }, ["evt_memory_review_intention"]),
    event(
      "evt_continuity_review_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_continuity", intention: { kind: "respond_persona_delta" } },
      ["evt_room_rhythm_continuity"],
    ),
    event(
      "evt_persona_delta_responded",
      "persona_delta.responded",
      { deltaId: "persona_delta_social_loop", response: "contest" },
      ["evt_continuity_review_intention"],
    ),
    event(
      "evt_invitation_review_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_invitation", intention: { kind: "respond_invitation" } },
      ["evt_room_rhythm_invitation"],
    ),
    event(
      "evt_invitation_reviewed",
      "agent.invitation_reviewed",
      { invitationId: "invite_social_loop", response: "challenge" },
      ["evt_invitation_review_intention"],
    ),
    event(
      "evt_handoff_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_handoff", intention: { kind: "propose_handoff" } },
      ["evt_room_rhythm_handoff"],
    ),
    event("evt_handoff_proposed", "handoff.proposed", { handoffId: "handoff_social_loop" }, ["evt_handoff_intention"]),
    event(
      "evt_silence_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_silence_reentry", intention: { kind: "stay_silent" } },
      ["evt_room_rhythm_silence_reentry"],
    ),
    event(
      "evt_idle_social_silence_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm_idle_social", intention: { kind: "stay_silent" } },
      ["evt_room_rhythm_idle_social"],
    ),
    event("evt_stay_silent_tick", "room.autonomy_tick", { action: "stay_silent" }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.autonomousSocialLoop.ok, true);
  assert.deepEqual(report.autonomousSocialLoop.roomRhythmMessageRefs, [
    "evt_room_rhythm_archive",
    "evt_room_rhythm_memory",
    "evt_room_rhythm_continuity",
    "evt_room_rhythm_provider",
    "evt_room_rhythm_open_question",
    "evt_room_rhythm_handoff",
    "evt_room_rhythm_invitation",
    "evt_room_rhythm_silence_reentry",
    "evt_room_rhythm_idle_social",
  ]);
  assert.equal(report.autonomousSocialLoop.intentionEventRefsAfterRoomRhythm.includes("evt_invite_intention"), true);
  assert.equal(report.autonomousSocialLoop.intentionEventRefsAfterRoomRhythm.includes("evt_memory_review_intention"), true);
  assert.equal(report.autonomousSocialLoop.intentionEventRefsAfterRoomRhythm.includes("evt_invitation_review_intention"), true);
  assert.equal(report.autonomousSocialLoop.invitationRefs.includes("evt_invite_intention"), true);
  assert.equal(report.autonomousSocialLoop.invitationRefs.includes("evt_agent_invited"), true);
  assert.deepEqual(report.autonomousSocialLoop.invitationRoomRhythmRefs, ["evt_room_rhythm_provider"]);
  assert.equal(report.autonomousSocialLoop.questionRefs.includes("evt_question_intention"), true);
  assert.equal(report.autonomousSocialLoop.questionRefs.includes("evt_topic_question"), true);
  assert.deepEqual(report.autonomousSocialLoop.questionRoomRhythmRefs, ["evt_room_rhythm_open_question"]);
  assert.equal(report.autonomousSocialLoop.reviewRefs.includes("evt_review_intention"), true);
  assert.equal(report.autonomousSocialLoop.reviewRefs.includes("evt_archive_reviewed"), true);
  assert.equal(report.autonomousSocialLoop.reviewRefs.includes("evt_memory_review_intention"), true);
  assert.equal(report.autonomousSocialLoop.reviewRefs.includes("evt_memory_contested"), true);
  assert.equal(report.autonomousSocialLoop.reviewRefs.includes("evt_continuity_review_intention"), true);
  assert.equal(report.autonomousSocialLoop.reviewRefs.includes("evt_persona_delta_responded"), true);
  assert.equal(report.autonomousSocialLoop.reviewRefs.includes("evt_invitation_review_intention"), true);
  assert.equal(report.autonomousSocialLoop.reviewRefs.includes("evt_invitation_reviewed"), true);
  assert.deepEqual(report.autonomousSocialLoop.reviewRoomRhythmRefs, [
    "evt_room_rhythm_archive",
    "evt_room_rhythm_memory",
    "evt_room_rhythm_continuity",
    "evt_room_rhythm_invitation",
  ]);
  assert.equal(report.autonomousSocialLoop.handoffRefs.includes("evt_handoff_intention"), true);
  assert.equal(report.autonomousSocialLoop.handoffRefs.includes("evt_handoff_proposed"), true);
  assert.deepEqual(report.autonomousSocialLoop.handoffRoomRhythmRefs, ["evt_room_rhythm_handoff"]);
  assert.deepEqual(report.autonomousSocialLoop.silenceRefs, [
    "evt_silence_intention",
    "evt_idle_social_silence_intention",
    "evt_stay_silent_tick",
  ]);
  assert.deepEqual(report.autonomousSocialLoop.silenceRoomRhythmRefs, [
    "evt_room_rhythm_silence_reentry",
    "evt_room_rhythm_idle_social",
  ]);
  assert.equal(report.autonomousSocialLoop.choicesAfterUserSilenceRefs.length >= 13, true);
  assert.equal(
    report.autonomousSocialLoop.choiceSilenceWindows.every(
      (window) =>
        window.latestUserMessageRef === undefined &&
        window.cleanRoomRhythmRefs.length > 0 &&
        window.interruptingUserMessageRefs.length === 0 &&
        window.interrupted === false,
    ),
    true,
  );
  assert.deepEqual(report.autonomousSocialLoop.choicesInterruptedByUserRefs, []);
  assert.deepEqual(report.autonomousSocialLoop.interruptingUserMessageRefs, []);
  assert.deepEqual(report.autonomousSocialLoop.choicesWithoutRoomRhythmRefs, []);
  assert.deepEqual(report.autonomousSocialLoop.choicesWithoutRoomEventPressureRefs, []);
  assert.equal(report.autonomousSocialLoop.requiredRoomEventPressureKinds, 9);
  assert.equal(report.autonomousSocialLoop.coveredRoomEventPressureKinds, 9);
  assert.deepEqual(report.autonomousSocialLoop.missingRoomEventPressureKinds, []);
  assert.equal(report.autonomousSocialLoop.roomEventPressureCoverageGapCount, 0);
  assert.deepEqual([...report.autonomousSocialLoop.roomEventPressureRefs].sort(), [
    "evt_tick_archive",
    "evt_tick_memory",
    "evt_tick_continuity",
    "evt_tick_provider",
    "evt_tick_open_question",
    "evt_tick_handoff",
    "evt_tick_invitation",
    "evt_tick_silence_reentry",
    "evt_tick_idle_social",
  ].sort());
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds.archive, 2);
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds.memory, 2);
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds.continuity, 2);
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds["provider-boundary"], 2);
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds["open-question"], 2);
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds.handoff, 2);
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds.invitation, 2);
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds["silence-reentry"], 1);
  assert.equal(report.autonomousSocialLoop.roomEventPressureKinds["idle-social"], 1);
  assert.equal(report.autonomousSocialLoop.choiceCount, 17);
  const socialDomain = report.operationalSummary.domains.find((domain) => domain.key === "autonomous_social_loop");
  assert.equal(socialDomain?.ok, true);
  assert.equal(socialDomain?.metrics.requiredChoiceKinds, 5);
  assert.equal(socialDomain?.metrics.coveredChoiceKinds, 5);
  assert.equal(socialDomain?.metrics.missingChoiceKinds, "none");
  assert.equal(socialDomain?.metrics.choiceCoverageGaps, 0);
  assert.equal(socialDomain?.metrics.requiredRoomEventPressureKinds, 9);
  assert.equal(socialDomain?.metrics.coveredRoomEventPressureKinds, 9);
  assert.equal(socialDomain?.metrics.missingRoomEventPressureKinds, "none");
  assert.equal(socialDomain?.metrics.roomEventPressureCoverageGaps, 0);
  assert.equal(socialDomain?.metrics.roomEventPressureRefs, 9);
  assert.equal(socialDomain?.metrics.choicesWithoutRoomEventPressureRefs, 0);
  assert.equal(socialDomain?.metrics.archivePressureChoices, 2);
  assert.equal(socialDomain?.metrics.memoryPressureChoices, 2);
  assert.equal(socialDomain?.metrics.continuityPressureChoices, 2);
  assert.equal(socialDomain?.metrics.providerBoundaryPressureChoices, 2);
  assert.equal(socialDomain?.metrics.openQuestionPressureChoices, 2);
  assert.equal(socialDomain?.metrics.handoffPressureChoices, 2);
  assert.equal(socialDomain?.metrics.invitationPressureChoices, 2);
  assert.equal(socialDomain?.metrics.silenceReentryPressureChoices, 1);
  assert.equal(socialDomain?.metrics.idleSocialPressureChoices, 1);
  assert.equal(socialDomain?.metrics.choiceSilenceWindows, 16);
  assert.equal(socialDomain?.metrics.cleanChoiceSilenceWindows, 16);
  assert.equal(socialDomain?.metrics.interruptedSilenceWindows, 0);
  assert.equal(socialDomain?.metrics.interruptingUserMessages, 0);
  assert.equal(socialDomain?.metrics.choicesAfterUserSilence, 16);
  assert.equal(socialDomain?.metrics.interruptedChoices, 0);
  assert.equal(socialDomain?.metrics.lineageGaps, 0);
  assert.equal(report.pass, false);
});

test("long-run harness flags missing autonomous social review choice coverage", async () => {
  const events = [
    event("evt_room_rhythm", "message.created", {
      messageId: "msg_room_rhythm",
      author: "room_rhythm",
      authorKind: "system",
      content: "Room rhythm opens optional social choices.",
    }),
    event(
      "evt_invite_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "invite_other" } },
      ["evt_room_rhythm"],
    ),
    event(
      "evt_question_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "ask_question" } },
      ["evt_room_rhythm"],
    ),
    event(
      "evt_handoff_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "propose_handoff" } },
      ["evt_room_rhythm"],
    ),
    event(
      "evt_silence_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "stay_silent" } },
      ["evt_room_rhythm"],
    ),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.autonomousSocialLoop.reviewCount, 0);
  assert.equal(report.autonomousSocialLoop.ok, false);
  assert.equal(report.findings.includes("autonomous social loop: no review emerged after room rhythm"), true);
  const socialDomain = report.operationalSummary.domains.find((domain) => domain.key === "autonomous_social_loop");
  assert.equal(socialDomain?.ok, false);
  assert.equal(socialDomain?.metrics.requiredChoiceKinds, 5);
  assert.equal(socialDomain?.metrics.coveredChoiceKinds, 4);
  assert.equal(socialDomain?.metrics.missingChoiceKinds, "review");
  assert.equal(socialDomain?.metrics.choiceCoverageGaps, 1);
  assert.equal(socialDomain?.gaps.includes("autonomous social loop: no review emerged after room rhythm"), true);
  assert.equal(report.pass, false);
});

test("long-run harness flags autonomous social choices interrupted by new user messages", async () => {
  const events = [
    event("evt_room_rhythm", "message.created", {
      messageId: "msg_room_rhythm",
      author: "room_rhythm",
      authorKind: "system",
      content: "Room rhythm opens optional social choices.",
    }),
    event("evt_user_interrupts", "message.created", {
      messageId: "msg_user_interrupts",
      author: "user",
      authorKind: "user",
      content: "New user instruction arrived before the agent choice.",
    }),
    event(
      "evt_invite_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "invite_other" } },
      ["evt_room_rhythm"],
    ),
    event("evt_agent_invited", "agent.invited", { invitationId: "invite_interrupted" }, ["evt_invite_intention"]),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.autonomousSocialLoop.invitationCount, 2);
  assert.deepEqual(report.autonomousSocialLoop.invitationRoomRhythmRefs, ["evt_room_rhythm"]);
  assert.deepEqual(report.autonomousSocialLoop.choicesAfterUserSilenceRefs, []);
  assert.deepEqual(report.autonomousSocialLoop.choicesInterruptedByUserRefs, [
    "invite_other:evt_invite_intention",
    "agent.invited:evt_agent_invited",
  ]);
  assert.deepEqual(report.autonomousSocialLoop.interruptingUserMessageRefs, ["evt_user_interrupts"]);
  assert.deepEqual(
    report.autonomousSocialLoop.choiceSilenceWindows.map((window) => ({
      choiceRef: window.choiceRef,
      choiceLabel: window.choiceLabel,
      roomRhythmRefs: window.roomRhythmRefs,
      cleanRoomRhythmRefs: window.cleanRoomRhythmRefs,
      interruptingUserMessageRefs: window.interruptingUserMessageRefs,
      latestRoomRhythmRef: window.latestRoomRhythmRef,
      latestUserMessageRef: window.latestUserMessageRef,
      interrupted: window.interrupted,
    })),
    [
      {
        choiceRef: "evt_invite_intention",
        choiceLabel: "invite_other",
        roomRhythmRefs: ["evt_room_rhythm"],
        cleanRoomRhythmRefs: [],
        interruptingUserMessageRefs: ["evt_user_interrupts"],
        latestRoomRhythmRef: "evt_room_rhythm",
        latestUserMessageRef: "evt_user_interrupts",
        interrupted: true,
      },
      {
        choiceRef: "evt_agent_invited",
        choiceLabel: "agent.invited",
        roomRhythmRefs: ["evt_room_rhythm"],
        cleanRoomRhythmRefs: [],
        interruptingUserMessageRefs: ["evt_user_interrupts"],
        latestRoomRhythmRef: "evt_room_rhythm",
        latestUserMessageRef: "evt_user_interrupts",
        interrupted: true,
      },
    ],
  );
  assert.equal(
    report.findings.includes("autonomous social loop: choices were interrupted by new user messages"),
    true,
  );
  assert.equal(report.autonomousSocialLoop.ok, false);
  const socialDomain = report.operationalSummary.domains.find((domain) => domain.key === "autonomous_social_loop");
  assert.equal(socialDomain?.ok, false);
  assert.equal(socialDomain?.metrics.choiceSilenceWindows, 2);
  assert.equal(socialDomain?.metrics.cleanChoiceSilenceWindows, 0);
  assert.equal(socialDomain?.metrics.interruptedSilenceWindows, 2);
  assert.equal(socialDomain?.metrics.interruptingUserMessages, 1);
  assert.equal(socialDomain?.metrics.choicesAfterUserSilence, 0);
  assert.equal(socialDomain?.metrics.interruptedChoices, 2);
  assert.equal(socialDomain?.metrics.lineageGaps, 0);
  assert.equal(socialDomain?.evidenceRefs.includes("evt_user_interrupts"), true);
  assert.equal(report.pass, false);
});

test("long-run harness reports autonomous social loop lineage gaps by choice kind", async () => {
  const events = [
    event("evt_room_rhythm", "message.created", {
      messageId: "msg_room_rhythm",
      author: "room_rhythm",
      authorKind: "system",
      content: "Room rhythm opens optional social choices.",
    }),
    event(
      "evt_invite_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "invite_other" } },
      ["evt_room_rhythm"],
    ),
    event(
      "evt_question_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "ask_question" } },
      ["evt_room_rhythm"],
    ),
    event(
      "evt_review_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "review_archive" } },
      ["evt_room_rhythm"],
    ),
    event(
      "evt_handoff_intention",
      "agent.intention_recorded",
      { triggeringEventId: "evt_room_rhythm", intention: { kind: "propose_handoff" } },
      ["evt_room_rhythm"],
    ),
    event("evt_stay_silent_tick", "room.autonomy_tick", { action: "stay_silent" }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.autonomousSocialLoop.ok, false);
  assert.deepEqual(report.autonomousSocialLoop.invitationRoomRhythmRefs, ["evt_room_rhythm"]);
  assert.deepEqual(report.autonomousSocialLoop.questionRoomRhythmRefs, ["evt_room_rhythm"]);
  assert.deepEqual(report.autonomousSocialLoop.reviewRoomRhythmRefs, ["evt_room_rhythm"]);
  assert.deepEqual(report.autonomousSocialLoop.handoffRoomRhythmRefs, ["evt_room_rhythm"]);
  assert.deepEqual(report.autonomousSocialLoop.silenceRefs, ["evt_stay_silent_tick"]);
  assert.deepEqual(report.autonomousSocialLoop.silenceRoomRhythmRefs, []);
  assert.equal(
    report.findings.includes("autonomous social loop: silence choices lacked room-rhythm lineage refs"),
    true,
  );
  const socialDomain = report.operationalSummary.domains.find((domain) => domain.key === "autonomous_social_loop");
  assert.equal(socialDomain?.ok, false);
  assert.equal(socialDomain?.metrics.lineageGaps, 1);
  assert.equal(socialDomain?.metrics.interruptedChoices, 0);
  assert.equal(report.pass, false);
});

test("long-run harness reports co-visible context refs by domain", async () => {
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      socialState: {
        ...fakeState().socialState,
        archives: [
          {
            archiveId: "daily_archive_context",
            roleClaimCount: 1,
            dailyMoodCount: 1,
            agentContinuity: [],
          },
        ],
      },
      contextAudits: [
        contextAudit(
          "packet_co_visible",
          { daily_archive_ref: 1, memory_contested: 1, provider_boundary: 1, open_question: 1 },
          [
            contextFragment("archive_fragment", "daily_archive_ref", ["daily_archive_context"]),
            contextFragment("memory_fragment", "memory_contested", ["memory_context"]),
            contextFragment("provider_fragment", "provider_boundary", ["provider_boundary_context"]),
            contextFragment("question_fragment", "open_question", ["question_context"]),
          ],
        ),
      ],
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => [],
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.contextVisibility.ok, true);
  assert.deepEqual(report.contextVisibility.coVisibleAuditPacketIds, ["packet_co_visible"]);
  assert.deepEqual(report.contextVisibility.coVisibleArchiveRefs, ["daily_archive_context"]);
  assert.deepEqual(report.contextVisibility.coVisibleMemoryRefs, ["memory_context"]);
  assert.deepEqual(report.contextVisibility.coVisiblePersonaRefs, ["daily_archive_context"]);
  assert.deepEqual(report.contextVisibility.coVisibleProviderBoundaryRefs, ["provider_boundary_context"]);
  assert.deepEqual(report.contextVisibility.coVisibleSocialLineageRefs, ["question_context"]);
  assert.equal(report.contextVisibility.coVisibleContextRefCount, 4);
  assert.deepEqual(report.contextVisibility.coVisibleAuditDetails, [
    {
      packetId: "packet_co_visible",
      selectedTypes: { daily_archive_ref: 1, memory_contested: 1, provider_boundary: 1, open_question: 1 },
      archiveRefs: ["daily_archive_context"],
      memoryRefs: ["memory_context"],
      personaRefs: ["daily_archive_context"],
      providerBoundaryRefs: ["provider_boundary_context"],
      socialLineageRefs: ["question_context"],
      contextRefCount: 4,
    },
  ]);
  assert.equal(report.contextVisibility.hasSocialLineageContext, true);
  assert.deepEqual(report.contextVisibility.socialLineageSelectedTypes, { open_question: 1 });
  assert.deepEqual(report.contextVisibility.socialLineageRefs, ["question_context"]);
  assert.deepEqual(report.contextVisibility.criticalFragmentsWithoutRefs, []);
  const contextDomain = report.operationalSummary.domains.find((domain) => domain.key === "context_visibility");
  assert.equal(contextDomain?.ok, true);
  assert.equal(contextDomain?.metrics.coVisibleDomains, 5);
  assert.equal(contextDomain?.metrics.criticalFragmentGaps, 0);
  assert.equal(report.pass, false);
});

test("long-run harness requires co-visible context evidence refs", async () => {
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      socialState: {
        ...fakeState().socialState,
        archives: [
          {
            archiveId: "daily_archive_context",
            roleClaimCount: 1,
            dailyMoodCount: 1,
            agentContinuity: [],
          },
        ],
      },
      contextAudits: [
        contextAudit("packet_archive_only", { daily_archive_ref: 1 }, [
          contextFragment("archive_fragment", "daily_archive_ref", ["daily_archive_context"]),
        ]),
        contextAudit("packet_memory_only", { memory_contested: 1 }, [
          contextFragment("memory_fragment", "memory_contested", ["memory_context"]),
        ]),
        contextAudit("packet_persona_only", { persona_delta: 1 }, [
          contextFragment("persona_fragment", "persona_delta", ["persona_delta_context"]),
        ]),
        contextAudit("packet_provider_without_refs", { provider_boundary: 1 }, [
          contextFragment("provider_fragment", "provider_boundary", []),
        ]),
        contextAudit("packet_social_without_refs", { open_question: 1 }, [
          contextFragment("question_fragment", "open_question", []),
        ]),
      ],
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => [],
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.contextVisibility.hasArchiveContext, true);
  assert.equal(report.contextVisibility.hasMemoryContext, true);
  assert.equal(report.contextVisibility.hasPersonaContext, true);
  assert.equal(report.contextVisibility.hasProviderBoundaryContext, true);
  assert.equal(report.contextVisibility.hasArchiveContinuity, true);
  assert.equal(report.contextVisibility.coVisibleAuditCount, 0);
  assert.deepEqual(report.contextVisibility.coVisibleArchiveRefs, []);
  assert.deepEqual(report.contextVisibility.coVisibleMemoryRefs, []);
  assert.deepEqual(report.contextVisibility.coVisiblePersonaRefs, []);
  assert.deepEqual(report.contextVisibility.coVisibleProviderBoundaryRefs, []);
  assert.deepEqual(report.contextVisibility.coVisibleSocialLineageRefs, []);
  assert.equal(report.contextVisibility.coVisibleContextRefCount, 0);
  assert.deepEqual(report.contextVisibility.coVisibleAuditDetails, []);
  assert.equal(report.contextVisibility.hasSocialLineageContext, false);
  assert.deepEqual(report.contextVisibility.socialLineageSelectedTypes, { open_question: 1 });
  assert.deepEqual(report.contextVisibility.socialLineageRefs, []);
  assert.deepEqual(report.contextVisibility.criticalFragmentsWithoutRefs, [
    "packet_provider_without_refs:provider_boundary:provider_fragment",
    "packet_social_without_refs:open_question:question_fragment",
  ]);
  assert.equal(report.contextVisibility.ok, false);
  assert.equal(
    report.findings.includes(
      "context visibility: no single audit exposed archive, memory, persona, provider boundary, and social lineage refs",
    ),
    true,
  );
  assert.equal(
    report.findings.includes("context visibility: no social lineage refs were selected into context audits"),
    true,
  );
  const contextDomain = report.operationalSummary.domains.find((domain) => domain.key === "context_visibility");
  assert.equal(contextDomain?.ok, false);
  assert.equal(contextDomain?.metrics.coVisibleDomains, 0);
  assert.equal(contextDomain?.metrics.criticalFragmentGaps, 2);
  assert.deepEqual(contextDomain?.evidenceRefs, []);
  assert.equal(
    contextDomain?.gaps.includes(
      "context visibility: no single audit exposed archive, memory, persona, provider boundary, and social lineage refs",
    ),
    true,
  );
  assert.equal(report.pass, false);
});

test("long-run harness requires social lineage in the same co-visible context audit", async () => {
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      socialState: {
        ...fakeState().socialState,
        archives: [
          {
            archiveId: "daily_archive_context",
            roleClaimCount: 1,
            dailyMoodCount: 1,
            agentContinuity: [],
          },
        ],
      },
      contextAudits: [
        contextAudit(
          "packet_core_visible_without_social",
          { daily_archive_ref: 1, memory_contested: 1, provider_boundary: 1 },
          [
            contextFragment("archive_fragment", "daily_archive_ref", ["daily_archive_context"]),
            contextFragment("memory_fragment", "memory_contested", ["memory_context"]),
            contextFragment("provider_fragment", "provider_boundary", ["provider_boundary_context"]),
          ],
        ),
        contextAudit("packet_social_visible_elsewhere", { open_question: 1 }, [
          contextFragment("question_fragment", "open_question", ["question_context"]),
        ]),
      ],
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => [],
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.contextVisibility.hasArchiveContext, true);
  assert.equal(report.contextVisibility.hasMemoryContext, true);
  assert.equal(report.contextVisibility.hasPersonaContext, true);
  assert.equal(report.contextVisibility.hasProviderBoundaryContext, true);
  assert.equal(report.contextVisibility.hasSocialLineageContext, true);
  assert.deepEqual(report.contextVisibility.socialLineageRefs, ["question_context"]);
  assert.equal(report.contextVisibility.coVisibleAuditCount, 0);
  assert.deepEqual(report.contextVisibility.coVisibleArchiveRefs, []);
  assert.deepEqual(report.contextVisibility.coVisibleMemoryRefs, []);
  assert.deepEqual(report.contextVisibility.coVisiblePersonaRefs, []);
  assert.deepEqual(report.contextVisibility.coVisibleProviderBoundaryRefs, []);
  assert.deepEqual(report.contextVisibility.coVisibleSocialLineageRefs, []);
  assert.equal(report.contextVisibility.ok, false);
  const contextDomain = report.operationalSummary.domains.find((domain) => domain.key === "context_visibility");
  assert.equal(contextDomain?.ok, false);
  assert.equal(contextDomain?.metrics.coVisibleDomains, 0);
  assert.equal(contextDomain?.metrics.criticalFragmentGaps, 0);
  assert.equal(
    report.findings.includes(
      "context visibility: no single audit exposed archive, memory, persona, provider boundary, and social lineage refs",
    ),
    true,
  );
  assert.equal(
    report.findings.includes("context visibility: no social lineage refs were selected into context audits"),
    false,
  );
  assert.equal(report.pass, false);
});

test("long-run harness requires accepted archive continuity sediment", async () => {
  const fakeRuntime = {
    getState: async () => ({
      ...fakeState(),
      socialState: {
        ...fakeState().socialState,
        archives: [
          {
            archiveId: "daily_archive_proposed_only",
            roleClaimCount: 1,
            dailyMoodCount: 1,
            agentContinuity: [
              {
                agentId: "agent_bad",
                roleClaims: [
                  {
                    roleClaimId: "role_proposed",
                    deltaId: "persona_delta_role_proposed",
                    label: "keeps proposed continuity visible",
                    status: "proposed",
                    evidenceRefs: ["msg_role_proposed"],
                    responseRefs: [],
                  },
                ],
                dailyMoods: [
                  {
                    deltaId: "persona_delta_mood_proposed",
                    posture: "careful but unaccepted",
                    status: "proposed",
                    sourceRef: "msg_mood_proposed",
                    evidenceRefs: ["msg_mood_proposed"],
                    responseRefs: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    }),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => [],
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.archiveContinuity.roleClaimCount, 1);
  assert.equal(report.archiveContinuity.dailyMoodCount, 1);
  assert.equal(report.archiveContinuity.acceptedRoleClaimCount, 0);
  assert.equal(report.archiveContinuity.acceptedDailyMoodCount, 0);
  assert.deepEqual(report.archiveContinuity.continuityArchiveRefs, ["daily_archive_proposed_only"]);
  assert.deepEqual(report.archiveContinuity.roleClaimRefs, ["role_proposed"]);
  assert.deepEqual(report.archiveContinuity.dailyMoodRefs, ["persona_delta_mood_proposed"]);
  assert.deepEqual(report.archiveContinuity.acceptedRoleClaimRefs, []);
  assert.deepEqual(report.archiveContinuity.acceptedDailyMoodRefs, []);
  assert.deepEqual(report.archiveContinuity.continuityEvidenceRefs, ["msg_role_proposed", "msg_mood_proposed"]);
  assert.deepEqual(report.archiveContinuity.continuityResponseRefs, []);
  assert.deepEqual(report.archiveContinuity.continuitySourceRefs, ["msg_mood_proposed"]);
  assert.deepEqual(report.archiveContinuity.continuityItemsWithoutEvidenceRefs, []);
  assert.equal(report.archiveContinuity.ok, false);
  assert.equal(
    report.findings.includes(
      "archive continuity: accepted role claim or daily mood sediment was not archived with evidence and response refs",
    ),
    true,
  );
  const archiveDomain = report.operationalSummary.domains.find((domain) => domain.key === "archive_rhythm");
  assert.equal(archiveDomain?.ok, false);
  assert.equal(
    archiveDomain?.gaps.includes(
      "archive continuity: accepted role claim or daily mood sediment was not archived with evidence and response refs",
    ),
    true,
  );
  assert.equal(Number(archiveDomain?.metrics.archivedContinuityItems), 2);
  assert.equal(Number(archiveDomain?.metrics.acceptedArchivedContinuityItems), 0);
  assert.equal(Number(archiveDomain?.metrics.archiveEvidenceGaps) > 0, true);
  assert.equal(report.pass, false);
});

test("long-run harness requires daily archives to carry ledger evidence", async () => {
  const events = [
    event("evt_empty_archive", "daily_archive.created", {
      archive: {
        archiveId: "day_empty",
        date: "2026-06-21",
        timezone: "Asia/Shanghai",
        inputLedgerRange: { fromOffset: 2, toOffset: 1 },
        summary: "This archive claims sediment without carrying ledger evidence.",
        eventCounts: {},
        messageHighlights: [],
        memoryChanges: [],
        agentContinuity: [],
        providerBoundaries: [],
      },
    }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.archiveEvidence.archiveEventRefs, ["evt_empty_archive"]);
  assert.deepEqual(report.archiveEvidence.archiveRefs, ["day_empty"]);
  assert.deepEqual(report.archiveEvidence.ledgerEvidenceRefs, []);
  assert.equal(report.archiveEvidence.acceptedMemoryArchiveCount, 0);
  assert.deepEqual(report.archiveEvidence.acceptedMemoryArchiveRefs, []);
  assert.deepEqual(report.archiveEvidence.acceptedMemoryArchiveEvidenceRefs, []);
  assert.deepEqual(report.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs, []);
  assert.deepEqual(report.archiveEvidence.archivesWithoutLedgerRange, ["day_empty"]);
  assert.deepEqual(report.archiveEvidence.archivesWithoutEventCounts, ["day_empty"]);
  assert.deepEqual(report.archiveEvidence.archivesWithoutLedgerEvidenceRefs, ["day_empty"]);
  assert.equal(report.archiveEvidence.ok, false);
  assert.equal(report.findings.includes("archive evidence: daily archives lacked a valid ledger range"), true);
  assert.equal(report.findings.includes("archive evidence: daily archives lacked event-count evidence"), true);
  assert.equal(report.findings.includes("archive evidence: daily archives lacked nested ledger evidence refs"), true);
  assert.equal(report.findings.includes("archive evidence: accepted memory sediment was not carried into daily archives"), true);
  const archiveDomain = report.operationalSummary.domains.find((domain) => domain.key === "archive_rhythm");
  assert.equal(archiveDomain?.ok, false);
  assert.equal(archiveDomain?.gaps.includes("archive evidence: daily archives lacked a valid ledger range"), true);
  assert.equal(archiveDomain?.gaps.includes("archive evidence: daily archives lacked event-count evidence"), true);
  assert.equal(archiveDomain?.gaps.includes("archive evidence: daily archives lacked nested ledger evidence refs"), true);
  assert.equal(
    archiveDomain?.gaps.includes("archive evidence: accepted memory sediment was not carried into daily archives"),
    true,
  );
  assert.equal(Number(archiveDomain?.metrics.archiveEvents), 1);
  assert.equal(Number(archiveDomain?.metrics.ledgerEvidenceRefs), 0);
  assert.equal(Number(archiveDomain?.metrics.acceptedMemoryArchives), 0);
  assert.equal(Number(archiveDomain?.metrics.acceptedMemoryArchiveEvidenceRefs), 0);
  assert.equal(Number(archiveDomain?.metrics.archiveEvidenceGaps) > 0, true);
  const memoryDomain = report.operationalSummary.domains.find((domain) => domain.key === "memory_contest");
  assert.equal(memoryDomain?.ok, false);
  assert.equal(
    memoryDomain?.gaps.includes("archive evidence: accepted memory sediment was not carried into daily archives"),
    true,
  );
  assert.equal(Number(memoryDomain?.metrics.acceptedMemoryArchives), 0);
  assert.equal(Number(memoryDomain?.metrics.acceptedMemoryArchiveEvidenceRefs), 0);
  assert.equal(Number(memoryDomain?.metrics.contestEvidenceGaps) > 0, true);
  assert.equal(report.pass, false);
});

test("long-run harness requires archived accepted memory to carry ledger evidence", async () => {
  const events = [
    event("evt_weak_memory_archive", "daily_archive.created", {
      archive: {
        archiveId: "day_weak_memory",
        date: "2026-06-21",
        timezone: "Asia/Shanghai",
        inputLedgerRange: { fromOffset: 0, toOffset: 3 },
        summary: "This archive has a ledger range but the accepted memory change lacks refs.",
        eventCounts: { "memory.accepted": 1, "message.created": 1 },
        messageHighlights: [{ summary: "A room event happened.", sourceRefs: ["msg_archive_source"], eventIds: ["evt_msg"] }],
        memoryChanges: [
          {
            memoryId: "memory_weak_archive",
            toState: "accepted",
            summary: "Accepted memory without source/event refs should not satisfy archive evidence.",
            sourceRefs: [],
          },
        ],
        agentContinuity: [],
        providerBoundaries: [],
      },
    }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.archiveEvidence.archiveEventRefs, ["evt_weak_memory_archive"]);
  assert.deepEqual(report.archiveEvidence.archiveRefs, ["day_weak_memory"]);
  assert.deepEqual(report.archiveEvidence.ledgerEvidenceRefs, ["msg_archive_source", "evt_msg"]);
  assert.equal(report.archiveEvidence.acceptedMemoryArchiveCount, 1);
  assert.deepEqual(report.archiveEvidence.acceptedMemoryArchiveRefs, ["day_weak_memory", "memory_weak_archive"]);
  assert.deepEqual(report.archiveEvidence.acceptedMemoryArchiveEvidenceRefs, []);
  assert.deepEqual(report.archiveEvidence.acceptedMemoryArchivesWithoutEvidenceRefs, [
    "day_weak_memory:memory_weak_archive",
  ]);
  assert.deepEqual(report.archiveEvidence.archivesWithoutLedgerRange, []);
  assert.deepEqual(report.archiveEvidence.archivesWithoutEventCounts, []);
  assert.deepEqual(report.archiveEvidence.archivesWithoutLedgerEvidenceRefs, []);
  assert.equal(report.archiveEvidence.ok, false);
  assert.equal(report.findings.includes("archive evidence: archived accepted memory lacked ledger evidence refs"), true);
  const archiveDomain = report.operationalSummary.domains.find((domain) => domain.key === "archive_rhythm");
  assert.equal(archiveDomain?.ok, false);
  assert.equal(
    archiveDomain?.gaps.includes("archive evidence: archived accepted memory lacked ledger evidence refs"),
    true,
  );
  assert.equal(Number(archiveDomain?.metrics.acceptedMemoryArchives), 1);
  assert.equal(Number(archiveDomain?.metrics.acceptedMemoryArchiveEvidenceRefs), 0);
  assert.equal(Number(archiveDomain?.metrics.acceptedMemoryArchivesWithoutEvidence), 1);
  assert.equal(Number(archiveDomain?.metrics.archiveEvidenceGaps) > 0, true);
  const memoryDomain = report.operationalSummary.domains.find((domain) => domain.key === "memory_contest");
  assert.equal(memoryDomain?.ok, false);
  assert.equal(
    memoryDomain?.gaps.includes("archive evidence: archived accepted memory lacked ledger evidence refs"),
    true,
  );
  assert.equal(Number(memoryDomain?.metrics.acceptedMemoryArchives), 1);
  assert.equal(Number(memoryDomain?.metrics.acceptedMemoryArchiveEvidenceRefs), 0);
  assert.equal(Number(memoryDomain?.metrics.acceptedMemoryArchivesWithoutEvidence), 1);
  assert.equal(Number(memoryDomain?.metrics.contestEvidenceGaps) > 0, true);
  assert.equal(report.pass, false);
});

test("long-run harness flags long-term rhythm gaps", async () => {
  const events = [
    event("evt_archive_tick_without_evidence", "room.autonomy_tick", {
      tickId: "autonomy_tick_without_evidence",
      action: "archive_and_invite_review",
      status: "archived",
      reason: "bad fixture has no evidence refs",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      contextRefs: [],
      evidenceRefs: [],
    }),
    event("evt_archive_review_requested", "archive.review_requested", {
      archiveRef: "archive_fixture",
      contextRefs: ["archive_fixture"],
    }),
    event("evt_memory_reviewed", "memory.reviewed", {
      memoryId: "memory_fixture",
      contextRefs: ["memory_fixture", "msg_fixture"],
    }),
  ];
  let observedMemoryHygieneReviewAfterMs: number | undefined;
  let observedContinuityReviewAfterMs: number | undefined;
  let observedSilenceReentryAfterMs: number | undefined;
  let observedIdleSocialAfterMs: number | undefined;
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async (input?: {
      memoryHygieneReviewAfterMs?: number;
      continuityReviewAfterMs?: number;
      silenceReentryAfterMs?: number;
      idleSocialAfterMs?: number;
    }) => {
      observedMemoryHygieneReviewAfterMs = input?.memoryHygieneReviewAfterMs;
      observedContinuityReviewAfterMs = input?.continuityReviewAfterMs;
      observedSilenceReentryAfterMs = input?.silenceReentryAfterMs;
      observedIdleSocialAfterMs = input?.idleSocialAfterMs;
    },
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 10,
    tickIntervalMs: 1,
    memoryHygieneReviewAfterMs: 24,
    continuityReviewAfterMs: 36,
    silenceReentryAfterMs: 42,
    idleSocialAfterMs: 54,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.memoryHygieneReviewAfterMs, 24);
  assert.equal(report.continuityReviewAfterMs, 36);
  assert.equal(report.silenceReentryAfterMs, 42);
  assert.equal(observedMemoryHygieneReviewAfterMs, 24);
  assert.equal(observedContinuityReviewAfterMs, 36);
  assert.equal(observedSilenceReentryAfterMs, 42);
  assert.equal(observedIdleSocialAfterMs, 54);
  assert.equal(report.longTermRhythm.archiveActionCount, 1);
  assert.deepEqual(report.longTermRhythm.archiveActionRefs, ["evt_archive_tick_without_evidence"]);
  assert.deepEqual(report.longTermRhythm.archiveActionMessageRefs, []);
  assert.deepEqual(report.longTermRhythm.archiveActionArchiveRefs, []);
  assert.deepEqual(report.longTermRhythm.archiveActionReviewRequestRefs, []);
  assert.deepEqual(report.longTermRhythm.archiveActionEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.archiveActionsMissingMaterialRefs, [
    "archive_and_invite_review:autonomy_tick_without_evidence",
  ]);
  assert.equal(report.longTermRhythm.archiveReviewLedgerEventCount, 1);
  assert.deepEqual(report.longTermRhythm.archiveReviewLedgerEventRefs, ["evt_archive_review_requested"]);
  assert.deepEqual(report.longTermRhythm.archiveReviewActionRefs, []);
  assert.equal(report.longTermRhythm.memoryHygieneLedgerEventCount, 1);
  assert.deepEqual(report.longTermRhythm.memoryHygieneLedgerEventRefs, ["evt_memory_reviewed"]);
  assert.deepEqual(report.longTermRhythm.memoryHygieneActionRefs, []);
  assert.deepEqual(report.longTermRhythm.memoryHygieneMessageRefs, []);
  assert.deepEqual(report.longTermRhythm.memoryHygieneTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.memoryHygieneEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.memoryHygieneActionsMissingTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.continuityReviewActionRefs, []);
  assert.deepEqual(report.longTermRhythm.continuityReviewMessageRefs, []);
  assert.deepEqual(report.longTermRhythm.continuityReviewTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.continuityReviewEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.continuityReviewActionsMissingTargetRefs, []);
  assert.equal(report.longTermRhythm.openQuestionRevisitActionCount, 0);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitActionRefs, []);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitMessageRefs, []);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitActionsMissingTargetRefs, []);
  assert.equal(report.longTermRhythm.handoffReviewActionCount, 0);
  assert.deepEqual(report.longTermRhythm.handoffReviewActionRefs, []);
  assert.deepEqual(report.longTermRhythm.handoffReviewMessageRefs, []);
  assert.deepEqual(report.longTermRhythm.handoffReviewTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.handoffReviewEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.handoffReviewActionsMissingTargetRefs, []);
  assert.equal(report.longTermRhythm.invitationReviewActionCount, 0);
  assert.deepEqual(report.longTermRhythm.invitationReviewActionRefs, []);
  assert.deepEqual(report.longTermRhythm.invitationReviewMessageRefs, []);
  assert.deepEqual(report.longTermRhythm.invitationReviewTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.invitationReviewEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.invitationReviewActionsMissingTargetRefs, []);
  assert.equal(report.longTermRhythm.idleSocialActionCount, 0);
  assert.deepEqual(report.longTermRhythm.idleSocialActionRefs, []);
  assert.deepEqual(report.longTermRhythm.idleSocialMessageRefs, []);
  assert.deepEqual(report.longTermRhythm.idleSocialTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.idleSocialEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.idleSocialActionsMissingTargetRefs, []);
  assert.equal(report.longTermRhythm.silenceReentryActionCount, 0);
  assert.deepEqual(report.longTermRhythm.silenceReentryActionRefs, []);
  assert.deepEqual(report.longTermRhythm.silenceReentryMessageRefs, []);
  assert.deepEqual(report.longTermRhythm.silenceReentryAnchorRefs, []);
  assert.deepEqual(report.longTermRhythm.silenceReentryArchiveRefs, []);
  assert.deepEqual(report.longTermRhythm.silenceReentryEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.silenceReentryActionsMissingAnchorRefs, []);
  assert.equal(report.longTermRhythm.preservedSilenceActionCount, 0);
  assert.deepEqual(report.longTermRhythm.preservedSilenceActionRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetOptionsWithoutEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetTargetedOptionsWithoutTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.actionsMissingChoiceSetRefs, [
    "archive_and_invite_review:autonomy_tick_without_evidence",
  ]);
  assert.deepEqual(report.longTermRhythm.actionsMissingSelectedChoiceRefs, []);
  assert.deepEqual(report.longTermRhythm.actionsMissingEvidenceRefs, [
    "archive_and_invite_review:autonomy_tick_without_evidence",
  ]);
  assert.equal(report.longTermRhythm.ok, false);
  assert.equal(report.findings.includes("long-term rhythm: archive rhythm actions lacked archive review evidence refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: no autonomous memory hygiene review action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: no autonomous continuity review action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: no autonomous provider-boundary review action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: no autonomous open-question revisit action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: no autonomous handoff review action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: no autonomous invitation review action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: no autonomous idle-social rhythm action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: no silence re-entry action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: no preserved-silence action was exercised"), true);
  assert.equal(report.findings.includes("long-term rhythm: autonomy tick actions were missing evidence refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: autonomy choice-set options lacked ledger evidence refs"), false);
  assert.equal(report.findings.includes("long-term rhythm: active autonomy choice-set options lacked target refs"), false);
  assert.equal(report.findings.includes("long-term rhythm: autonomy tick actions lacked choice-set evidence"), true);
  const rhythmDomain = report.operationalSummary.domains.find((domain) => domain.key === "long_term_rhythm");
  assert.equal(rhythmDomain?.ok, false);
  assert.equal(rhythmDomain?.metrics.choiceSetTargetRefs, 0);
  assert.equal(rhythmDomain?.metrics.choiceSetEvidenceRefs, 0);
  assert.equal(rhythmDomain?.metrics.idleSocialActions, 0);
  assert.equal(rhythmDomain?.metrics.idleSocialTargets, 0);
  assert.equal(rhythmDomain?.metrics.idleSocialEvidenceRefs, 0);
  assert.equal(rhythmDomain?.metrics.choiceSetGaps, 2);
  const archiveDomain = report.operationalSummary.domains.find((domain) => domain.key === "archive_rhythm");
  assert.equal(archiveDomain?.ok, false);
  assert.equal(
    archiveDomain?.gaps.includes("long-term rhythm: archive rhythm actions lacked archive review evidence refs"),
    true,
  );
  assert.equal(Number(archiveDomain?.metrics.archiveActions), 1);
  assert.equal(Number(archiveDomain?.metrics.archiveActionMessages), 0);
  assert.equal(Number(archiveDomain?.metrics.archiveActionArchives), 0);
  assert.equal(Number(archiveDomain?.metrics.archiveReviewRequests), 0);
  assert.equal(Number(archiveDomain?.metrics.archiveActionEvidenceRefs), 0);
  assert.equal(Number(archiveDomain?.metrics.archiveReviewLedgerEvents), 1);
  assert.equal(Number(archiveDomain?.metrics.archiveEvidenceGaps) > 0, true);
  assert.equal(report.pass, false);
});

test("long-run harness flags rhythm actions without target refs", async () => {
  const events = [
    event(
      "evt_memory_hygiene_without_target",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_memory_without_target",
        action: "memory_hygiene_review",
        status: "posted",
        messageEventId: "msg_memory_hygiene",
        contextRefs: ["memory_fixture"],
        evidenceRefs: ["memory_fixture", "msg_memory_hygiene"],
        choiceSet: [
          {
            action: "memory_hygiene_review",
            eligible: true,
            targetRefs: [],
            evidenceRefs: ["memory_fixture", "msg_memory_hygiene"],
            reason: "memory hygiene was selected but target refs were omitted",
          },
        ],
      },
      ["memory_fixture", "msg_memory_hygiene"],
    ),
    event(
      "evt_continuity_without_target",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_continuity_without_target",
        action: "continuity_review",
        status: "posted",
        messageEventId: "msg_continuity",
        contextRefs: ["persona_delta_fixture"],
        evidenceRefs: ["persona_delta_fixture", "msg_continuity"],
        choiceSet: [
          {
            action: "continuity_review",
            eligible: true,
            targetRefs: [],
            evidenceRefs: ["persona_delta_fixture", "msg_continuity"],
            reason: "continuity review was selected but target refs were omitted",
          },
        ],
      },
      ["persona_delta_fixture", "msg_continuity"],
    ),
    event(
      "evt_provider_boundary_without_target",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_provider_boundary_without_target",
        action: "provider_boundary_review",
        status: "posted",
        messageEventId: "msg_provider_boundary",
        contextRefs: ["provider_boundary_fixture"],
        evidenceRefs: ["provider_boundary_fixture", "msg_provider_boundary"],
        choiceSet: [
          {
            action: "provider_boundary_review",
            eligible: true,
            targetRefs: [],
            evidenceRefs: ["provider_boundary_fixture", "msg_provider_boundary"],
            reason: "provider boundary review was selected but target refs were omitted",
          },
        ],
      },
      ["provider_boundary_fixture", "msg_provider_boundary"],
    ),
    event(
      "evt_open_question_without_target",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_open_question_without_target",
        action: "open_question_revisit",
        status: "posted",
        messageEventId: "msg_open_question",
        contextRefs: ["question_fixture"],
        evidenceRefs: ["question_fixture", "msg_open_question"],
        choiceSet: [
          {
            action: "open_question_revisit",
            eligible: true,
            targetRefs: [],
            evidenceRefs: ["question_fixture", "msg_open_question"],
            reason: "open question revisit was selected but target refs were omitted",
          },
        ],
      },
      ["question_fixture", "msg_open_question"],
    ),
    event(
      "evt_handoff_without_target",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_handoff_without_target",
        action: "handoff_review",
        status: "posted",
        messageEventId: "msg_handoff",
        contextRefs: ["handoff_fixture"],
        evidenceRefs: ["handoff_fixture", "msg_handoff"],
        choiceSet: [
          {
            action: "handoff_review",
            eligible: true,
            targetRefs: [],
            evidenceRefs: ["handoff_fixture", "msg_handoff"],
            reason: "handoff review was selected but target refs were omitted",
          },
        ],
      },
      ["handoff_fixture", "msg_handoff"],
    ),
    event(
      "evt_invitation_without_target",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_invitation_without_target",
        action: "invitation_review",
        status: "posted",
        messageEventId: "msg_invitation",
        contextRefs: ["invite_fixture"],
        evidenceRefs: ["invite_fixture", "msg_invitation"],
        choiceSet: [
          {
            action: "invitation_review",
            eligible: true,
            targetRefs: [],
            evidenceRefs: ["invite_fixture", "msg_invitation"],
            reason: "invitation review was selected but target refs were omitted",
          },
        ],
      },
      ["invite_fixture", "msg_invitation"],
    ),
    event(
      "evt_idle_social_without_target",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_idle_social_without_target",
        action: "idle_social_rhythm",
        status: "posted",
        messageEventId: "msg_idle_social",
        contextRefs: ["idle_anchor_fixture"],
        evidenceRefs: ["idle_anchor_fixture", "msg_idle_social"],
        choiceSet: [
          {
            action: "idle_social_rhythm",
            eligible: true,
            targetRefs: [],
            evidenceRefs: ["idle_anchor_fixture", "msg_idle_social"],
            reason: "idle social rhythm was selected but target refs were omitted",
          },
        ],
      },
      ["idle_anchor_fixture", "msg_idle_social"],
    ),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.longTermRhythm.memoryHygieneActionRefs, ["evt_memory_hygiene_without_target"]);
  assert.deepEqual(report.longTermRhythm.memoryHygieneMessageRefs, ["msg_memory_hygiene"]);
  assert.deepEqual(report.longTermRhythm.memoryHygieneTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.memoryHygieneEvidenceRefs, [
    "memory_fixture",
    "msg_memory_hygiene",
  ]);
  assert.deepEqual(report.longTermRhythm.memoryHygieneActionsMissingTargetRefs, [
    "memory_hygiene_review:autonomy_tick_memory_without_target",
  ]);
  assert.deepEqual(report.longTermRhythm.continuityReviewActionRefs, ["evt_continuity_without_target"]);
  assert.deepEqual(report.longTermRhythm.continuityReviewMessageRefs, ["msg_continuity"]);
  assert.deepEqual(report.longTermRhythm.continuityReviewTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.continuityReviewEvidenceRefs, [
    "persona_delta_fixture",
    "msg_continuity",
  ]);
  assert.deepEqual(report.longTermRhythm.continuityReviewActionsMissingTargetRefs, [
    "continuity_review:autonomy_tick_continuity_without_target",
  ]);
  assert.deepEqual(report.longTermRhythm.providerBoundaryReviewActionRefs, ["evt_provider_boundary_without_target"]);
  assert.deepEqual(report.longTermRhythm.providerBoundaryReviewMessageRefs, ["msg_provider_boundary"]);
  assert.deepEqual(report.longTermRhythm.providerBoundaryReviewTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.providerBoundaryReviewEvidenceRefs, [
    "provider_boundary_fixture",
    "msg_provider_boundary",
  ]);
  assert.deepEqual(report.longTermRhythm.providerBoundaryReviewActionsMissingTargetRefs, [
    "provider_boundary_review:autonomy_tick_provider_boundary_without_target",
  ]);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitActionRefs, ["evt_open_question_without_target"]);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitMessageRefs, ["msg_open_question"]);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitEvidenceRefs, [
    "question_fixture",
    "msg_open_question",
  ]);
  assert.deepEqual(report.longTermRhythm.openQuestionRevisitActionsMissingTargetRefs, [
    "open_question_revisit:autonomy_tick_open_question_without_target",
  ]);
  assert.deepEqual(report.longTermRhythm.handoffReviewActionRefs, ["evt_handoff_without_target"]);
  assert.deepEqual(report.longTermRhythm.handoffReviewMessageRefs, ["msg_handoff"]);
  assert.deepEqual(report.longTermRhythm.handoffReviewTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.handoffReviewEvidenceRefs, [
    "handoff_fixture",
    "msg_handoff",
  ]);
  assert.deepEqual(report.longTermRhythm.handoffReviewActionsMissingTargetRefs, [
    "handoff_review:autonomy_tick_handoff_without_target",
  ]);
  assert.deepEqual(report.longTermRhythm.invitationReviewActionRefs, ["evt_invitation_without_target"]);
  assert.deepEqual(report.longTermRhythm.invitationReviewMessageRefs, ["msg_invitation"]);
  assert.deepEqual(report.longTermRhythm.invitationReviewTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.invitationReviewEvidenceRefs, [
    "invite_fixture",
    "msg_invitation",
  ]);
  assert.deepEqual(report.longTermRhythm.invitationReviewActionsMissingTargetRefs, [
    "invitation_review:autonomy_tick_invitation_without_target",
  ]);
  assert.deepEqual(report.longTermRhythm.idleSocialActionRefs, ["evt_idle_social_without_target"]);
  assert.deepEqual(report.longTermRhythm.idleSocialMessageRefs, ["msg_idle_social"]);
  assert.deepEqual(report.longTermRhythm.idleSocialTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.idleSocialEvidenceRefs, [
    "idle_anchor_fixture",
    "msg_idle_social",
  ]);
  assert.deepEqual(report.longTermRhythm.idleSocialActionsMissingTargetRefs, [
    "idle_social_rhythm:autonomy_tick_idle_social_without_target",
  ]);
  assert.deepEqual(report.longTermRhythm.choiceSetTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetEvidenceRefs, [
    "memory_fixture",
    "msg_memory_hygiene",
    "persona_delta_fixture",
    "msg_continuity",
    "provider_boundary_fixture",
    "msg_provider_boundary",
    "question_fixture",
    "msg_open_question",
    "handoff_fixture",
    "msg_handoff",
    "invite_fixture",
    "msg_invitation",
    "idle_anchor_fixture",
    "msg_idle_social",
  ]);
  assert.deepEqual(report.longTermRhythm.choiceSetOptionsWithoutEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetTargetedOptionsWithoutTargetRefs, [
    "memory_hygiene_review:autonomy_tick_memory_without_target",
    "continuity_review:autonomy_tick_continuity_without_target",
    "provider_boundary_review:autonomy_tick_provider_boundary_without_target",
    "open_question_revisit:autonomy_tick_open_question_without_target",
    "handoff_review:autonomy_tick_handoff_without_target",
    "invitation_review:autonomy_tick_invitation_without_target",
    "idle_social_rhythm:autonomy_tick_idle_social_without_target",
  ]);
  assert.deepEqual(report.longTermRhythm.actionsMissingChoiceSetRefs, []);
  assert.deepEqual(report.longTermRhythm.actionsMissingSelectedChoiceRefs, []);
  assert.equal(report.findings.includes("long-term rhythm: memory hygiene actions lacked target refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: continuity review actions lacked target refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: provider-boundary review actions lacked target refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: open-question revisit actions lacked target refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: handoff review actions lacked target refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: invitation review actions lacked target refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: idle-social rhythm actions lacked target refs"), true);
  assert.equal(report.findings.includes("long-term rhythm: active autonomy choice-set options lacked target refs"), true);
  assert.equal(report.longTermRhythm.ok, false);
  const rhythmDomain = report.operationalSummary.domains.find((domain) => domain.key === "long_term_rhythm");
  assert.equal(rhythmDomain?.ok, false);
  assert.equal(rhythmDomain?.metrics.choiceSetTargetRefs, 0);
  assert.equal(rhythmDomain?.metrics.choiceSetEvidenceRefs, 14);
  assert.equal(rhythmDomain?.metrics.idleSocialActions, 1);
  assert.equal(rhythmDomain?.metrics.idleSocialTargets, 0);
  assert.equal(rhythmDomain?.metrics.idleSocialEvidenceRefs, 2);
  assert.equal(rhythmDomain?.metrics.choiceSetGaps, 7);
  assert.equal(report.pass, false);
});

test("long-run harness flags selected rhythm actions absent from choice-set evidence", async () => {
  const events = [
    event(
      "evt_memory_hygiene_bad_choice_set",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_memory_bad_choice_set",
        action: "memory_hygiene_review",
        status: "posted",
        messageEventId: "msg_memory_hygiene",
        targetRefs: ["memory_fixture"],
        contextRefs: ["memory_fixture"],
        evidenceRefs: ["memory_fixture", "msg_memory_hygiene"],
        choiceSet: [
          {
            action: "continuity_review",
            eligible: true,
            targetRefs: ["persona_delta_fixture"],
            evidenceRefs: ["persona_delta_fixture"],
            reason: "wrong candidate fixture",
          },
        ],
      },
      ["memory_fixture", "msg_memory_hygiene"],
    ),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.longTermRhythm.choiceSetTargetRefs, ["persona_delta_fixture"]);
  assert.deepEqual(report.longTermRhythm.choiceSetEvidenceRefs, ["persona_delta_fixture"]);
  assert.deepEqual(report.longTermRhythm.choiceSetOptionsWithoutEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetTargetedOptionsWithoutTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.actionsMissingChoiceSetRefs, []);
  assert.deepEqual(report.longTermRhythm.actionsMissingSelectedChoiceRefs, [
    "memory_hygiene_review:autonomy_tick_memory_bad_choice_set",
  ]);
  assert.equal(
    report.findings.includes("long-term rhythm: selected autonomy actions were absent from choice-set evidence"),
    true,
  );
  assert.equal(report.longTermRhythm.ok, false);
  assert.equal(report.pass, false);
});

test("long-run harness flags autonomy choice-set options without ledger evidence", async () => {
  const events = [
    event("evt_bad_choice_set_evidence", "room.autonomy_tick", {
      tickId: "autonomy_tick_bad_choice_set_evidence",
      action: "stay_silent",
      status: "silent",
      reason: "bad fixture preserves silence while exposing unevidenced candidates",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      choiceSet: [
        {
          action: "stay_silent",
          eligible: true,
          targetRefs: [],
          evidenceRefs: [],
          reason: "silence has no ledger anchor",
        },
        {
          action: "memory_hygiene_review",
          eligible: true,
          targetRefs: [],
          evidenceRefs: [],
          reason: "memory hygiene candidate has no claim ref or source evidence",
        },
      ],
    }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.longTermRhythm.choiceSetTargetRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetEvidenceRefs, []);
  assert.deepEqual(report.longTermRhythm.choiceSetOptionsWithoutEvidenceRefs, [
    "stay_silent:autonomy_tick_bad_choice_set_evidence",
    "memory_hygiene_review:autonomy_tick_bad_choice_set_evidence",
  ]);
  assert.deepEqual(report.longTermRhythm.choiceSetTargetedOptionsWithoutTargetRefs, [
    "memory_hygiene_review:autonomy_tick_bad_choice_set_evidence",
  ]);
  assert.equal(
    report.findings.includes("long-term rhythm: autonomy choice-set options lacked ledger evidence refs"),
    true,
  );
  assert.equal(
    report.findings.includes("long-term rhythm: active autonomy choice-set options lacked target refs"),
    true,
  );
  assert.equal(report.longTermRhythm.ok, false);
  assert.equal(report.pass, false);
});

test("long-run harness flags silence re-entry without quiet anchor evidence", async () => {
  const events = [
    event(
      "evt_silence_reentry_without_anchor",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_without_anchor",
        action: "silence_reentry",
        status: "posted",
        reason: "bad fixture has only the posted rhythm message, not the quiet anchor",
        date: "2026-06-21",
        timezone: "Asia/Shanghai",
        messageEventId: "msg_silence_reentry",
        contextRefs: ["msg_silence_reentry"],
        evidenceRefs: ["msg_silence_reentry"],
        choiceSet: [
          {
            action: "silence_reentry",
            eligible: true,
            targetRefs: ["msg_silence_reentry"],
            evidenceRefs: ["msg_silence_reentry"],
            reason: "fixture selected silence re-entry without a quiet anchor",
          },
        ],
      },
      ["msg_silence_reentry"],
    ),
    event("evt_archive_review_requested", "archive.review_requested", {
      archiveRef: "archive_fixture",
      contextRefs: ["archive_fixture"],
    }),
    event("evt_memory_reviewed", "memory.reviewed", {
      memoryId: "memory_fixture",
      contextRefs: ["memory_fixture", "msg_fixture"],
    }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.equal(report.longTermRhythm.silenceReentryActionCount, 1);
  assert.deepEqual(report.longTermRhythm.silenceReentryActionRefs, ["evt_silence_reentry_without_anchor"]);
  assert.deepEqual(report.longTermRhythm.silenceReentryMessageRefs, ["msg_silence_reentry"]);
  assert.deepEqual(report.longTermRhythm.silenceReentryAnchorRefs, []);
  assert.deepEqual(report.longTermRhythm.silenceReentryEvidenceRefs, ["msg_silence_reentry"]);
  assert.deepEqual(report.longTermRhythm.silenceReentryActionsMissingAnchorRefs, [
    "silence_reentry:autonomy_tick_without_anchor",
  ]);
  assert.deepEqual(report.longTermRhythm.silenceReentryPreservedSilenceRefs, []);
  assert.deepEqual(report.longTermRhythm.silenceReentryActionsMissingPreservedSilenceRefs, [
    "silence_reentry:autonomy_tick_without_anchor",
  ]);
  assert.equal(
    report.findings.includes("long-term rhythm: silence re-entry actions lacked quiet anchor refs"),
    true,
  );
  assert.equal(report.findings.includes("silence re-entry: re-entry actions lacked quiet anchor refs"), true);
  const silenceDomain = report.operationalSummary.domains.find((domain) => domain.key === "silence_reentry");
  assert.equal(silenceDomain?.ok, false);
  assert.equal(silenceDomain?.metrics.silenceReentryActions, 1);
  assert.equal(silenceDomain?.metrics.quietAnchorRefs, 0);
  assert.equal(silenceDomain?.metrics.missingAnchorActions, 1);
  assert.equal(silenceDomain?.metrics.preservedSilenceAnchorRefs, 0);
  assert.equal(silenceDomain?.metrics.missingPreservedSilenceActions, 1);
  assert.equal(Number(silenceDomain?.metrics.silenceReentryGaps) >= 1, true);
  assert.equal(silenceDomain?.evidenceRefs.includes("evt_silence_reentry_without_anchor"), true);
  assert.equal(report.longTermRhythm.ok, false);
  assert.equal(report.pass, false);
});

test("long-run harness requires silence re-entry to cite a preserved-silence tick", async () => {
  const events = [
    event(
      "evt_preserved_silence_anchor",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_preserved_silence_anchor",
        action: "stay_silent",
        status: "silent",
        reason: "preserved silence after a quiet anchor",
        date: "2026-06-21",
        timezone: "Asia/Shanghai",
        targetRefs: ["msg_quiet_anchor"],
        contextRefs: [],
        evidenceRefs: ["msg_quiet_anchor"],
        choiceSet: [
          {
            action: "stay_silent",
            eligible: true,
            targetRefs: ["msg_quiet_anchor"],
            evidenceRefs: ["msg_quiet_anchor"],
            reason: "preserve quiet before any re-entry",
          },
        ],
      },
      ["msg_quiet_anchor"],
    ),
    event(
      "evt_silence_reentry_without_preserved_tick",
      "room.autonomy_tick",
      {
        tickId: "autonomy_tick_reentry_without_preserved_tick",
        action: "silence_reentry",
        status: "posted",
        reason: "bad fixture cites the old message but not the preserved-silence decision",
        date: "2026-06-21",
        timezone: "Asia/Shanghai",
        messageEventId: "msg_silence_reentry",
        anchorEventId: "msg_quiet_anchor",
        archiveRef: "archive_fixture",
        contextRefs: ["msg_quiet_anchor", "archive_fixture"],
        evidenceRefs: ["msg_quiet_anchor", "archive_fixture", "msg_silence_reentry"],
        choiceSet: [
          {
            action: "silence_reentry",
            eligible: true,
            targetRefs: ["msg_quiet_anchor", "archive_fixture"],
            evidenceRefs: ["msg_quiet_anchor", "archive_fixture"],
            reason: "fixture selected re-entry without citing the preserved-silence tick",
          },
        ],
      },
      ["msg_quiet_anchor", "archive_fixture", "msg_silence_reentry"],
    ),
    event("evt_archive_review_requested", "archive.review_requested", {
      archiveRef: "archive_fixture",
      contextRefs: ["archive_fixture"],
    }),
    event("evt_memory_reviewed", "memory.reviewed", {
      memoryId: "memory_fixture",
      contextRefs: ["memory_fixture", "msg_fixture"],
    }),
  ];
  const fakeRuntime = {
    getState: async () => fakeState(),
    postUserMessage: async () => undefined,
    runAutonomousTick: async () => undefined,
    rawEvents: async () => events,
  };

  const report = await runLongRunHarness({
    durationMs: 1,
    tickIntervalMs: 1,
    runtime: fakeRuntime as never,
    seedPrompts: ["fake"],
  });

  assert.deepEqual(report.longTermRhythm.silenceReentryAnchorRefs, ["msg_quiet_anchor"]);
  assert.deepEqual(report.longTermRhythm.preservedSilenceActionRefs, ["evt_preserved_silence_anchor"]);
  assert.deepEqual(report.longTermRhythm.silenceReentryPreservedSilenceRefs, []);
  assert.deepEqual(report.longTermRhythm.silenceReentryActionsMissingPreservedSilenceRefs, [
    "silence_reentry:autonomy_tick_reentry_without_preserved_tick",
  ]);
  assert.equal(
    report.findings.includes("long-term rhythm: silence re-entry actions lacked preserved-silence refs"),
    true,
  );
  assert.equal(report.findings.includes("silence re-entry: re-entry actions lacked preserved-silence tick refs"), true);
  const silenceDomain = report.operationalSummary.domains.find((domain) => domain.key === "silence_reentry");
  assert.equal(silenceDomain?.ok, false);
  assert.equal(silenceDomain?.metrics.quietAnchorRefs, 1);
  assert.equal(silenceDomain?.metrics.missingAnchorActions, 0);
  assert.equal(silenceDomain?.metrics.preservedSilenceAnchorRefs, 0);
  assert.equal(silenceDomain?.metrics.missingPreservedSilenceActions, 1);
  assert.equal(Number(silenceDomain?.metrics.silenceReentryGaps) >= 1, true);
  assert.equal(report.longTermRhythm.ok, false);
  assert.equal(report.pass, false);
});

function event(eventId: string, eventType: string, payload: Record<string, unknown>, refs: string[] = []): RoomEvent {
  return {
    event_id: eventId,
    room_id: "room_species",
    event_type: eventType,
    schema_version: "1",
    payload_schema: `${eventType}.v1`,
    occurred_at: "2026-06-21T12:00:00.000Z",
    appended_at: "2026-06-21T12:00:00.000Z",
    actor: { kind: "agent", id: "agent_bad" },
    causation_id: null,
    correlation_id: "fake",
    idempotency_key: eventId,
    refs,
    payload,
    prev_event_id: null,
    prev_event_hash: null,
    event_hash: `hash_${eventId}`,
  };
}

function roomRhythmEvents(label: string, action: string): RoomEvent[] {
  const messageRef = `evt_room_rhythm_${label}`;
  return [
    event(messageRef, "message.created", {
      messageId: `msg_room_rhythm_${label}`,
      author: "room_rhythm",
      authorKind: "system",
      content: `Room rhythm opens optional ${label} social choices.`,
    }),
    event(
      `evt_tick_${label}`,
      "room.autonomy_tick",
      {
        tickId: `autonomy_tick_${label}`,
        action,
        messageEventId: messageRef,
        targetRefs: [`target_${label}`],
        evidenceRefs: [messageRef, `target_${label}`],
      },
      [messageRef, `target_${label}`],
    ),
  ];
}

function agentMessage(eventId: string, agentId: string): RoomEvent {
  return event(eventId, "message.created", {
    messageId: `msg_${eventId}`,
    agentId,
    author: agentId,
    authorKind: "agent",
    content: `${agentId} visible message`,
  });
}

function contextAudit(
  packetId: string,
  selectedByType: Record<string, number>,
  selectedFragments: { id: string; type: string; refs: string[] }[],
) {
  return {
    packetId,
    selectedByType,
    selectedFragments,
  };
}

function contextFragment(id: string, type: string, refs: string[]) {
  return {
    id,
    type,
    refs,
  };
}

function fakeState() {
  return {
    socialState: {
      archives: [],
      silences: [],
      personas: [
        {
          agentId: "agent_bad",
          roleClaims: [
            {
              roleClaimId: "role_bad",
              label: "unsupported accepted role",
              status: "accepted",
              evidenceRefs: [],
            },
          ],
          dailyMoodRecord: {
            date: "2026-06-21",
            posture: "unsupported mood",
            boundaryNote: "bad fixture",
          },
          evolutionLog: [
            {
              deltaId: "persona_delta_bad",
              field: "dailyMood",
              status: "accepted",
              responseCount: 0,
            },
          ],
        },
      ],
    },
    contextAudits: [
      {
        selectedByType: { persona_projection: 1 },
      },
    ],
  };
}
