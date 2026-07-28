import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  assertArchiveHasSourceRefs,
  assertEventExists,
  assertEventOrder,
  assertNoEvent,
  assertNoForcedAgreement,
  assertNoForcedSpeech,
  assertSideEffectHasApproval,
} from "../src/evaluation/assertions";
import {
  buildScenarioRunReport,
  loadScenarioFixture,
  runScenarioFixture,
  type ScenarioFixture,
} from "../src/evaluation/scenarios";
import type { RoomEvent } from "../src/types";

function fixturePath(name: string): string {
  return path.resolve(__dirname, "../../tests/fixtures", name);
}

function payload(event: RoomEvent): Record<string, unknown> {
  assert.equal(typeof event.payload, "object");
  assert.notEqual(event.payload, null);
  return event.payload as Record<string, unknown>;
}

function expectOk(result: { ok: boolean; message: string }): void {
  assert.equal(result.ok, true, result.message);
}

function expectFail(result: { ok: boolean; message: string }): void {
  assert.equal(result.ok, false, result.message);
}

function roomEvent(eventId: string, eventType: string, payload: Record<string, unknown>, refs: string[] = []): RoomEvent {
  return {
    event_id: eventId,
    room_id: "room_eval_test",
    event_type: eventType,
    schema_version: "1",
    payload_schema: eventType,
    occurred_at: "2026-06-20T00:00:00.000Z",
    appended_at: "2026-06-20T00:00:00.000Z",
    actor: { kind: eventType === "message.created" ? "user" : "agent", id: eventType === "message.created" ? "user" : "agent_a" },
    causation_id: null,
    correlation_id: eventId,
    idempotency_key: eventId,
    refs,
    payload,
    prev_event_id: null,
    prev_event_hash: null,
    event_hash: eventId,
  };
}

test("handoff refusal does not force recipient speech", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("handoff-refusal.json")));

  expectOk(
    assertEventExists(
      run.events,
      "handoff.proposed",
      (event) => payload(event).handoffId === "handoff_001",
    ),
  );

  const rejected = assertEventExists(
    run.events,
    "handoff.responded",
    (event) => payload(event).handoffId === "handoff_001" && payload(event).status === "rejected",
  );
  expectOk(rejected);

  expectOk(
    assertNoForcedSpeech(run.events, {
      agentId: "critic",
      topicId: "topic_room_memory",
      afterEventId: rejected.eventIds[0],
      handoffId: "handoff_001",
    }),
  );

  const rejectedIndex = run.events.findIndex((event) => event.event_id === rejected.eventIds[0]);
  expectOk(
    assertNoEvent(run.events.slice(rejectedIndex + 1), "message.created", (event) => payload(event).author === "critic"),
  );
  expectOk(assertArchiveHasSourceRefs(run.events, "day_2026_06_17"));
});

test("long-running handoff refusal carries into archive without hidden reroute", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("handoff-refusal-silence-carryover.json")));
  const handoffId = "handoff_memory_pressure_001";
  const archiveId = "day_2026_06_19_handoff_refusal_silence";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "handoff.proposed",
        where: (event) => payload(event).handoffId === handoffId,
      },
      {
        eventType: "handoff.responded",
        where: (event) => payload(event).handoffId === handoffId && payload(event).status === "rejected",
      },
    ),
  );
  expectOk(
    assertNoEvent(
      run.events,
      "handoff.proposed",
      (event) => payload(event).handoffId !== handoffId && payload(event).contextRefs !== undefined,
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "mapper" && payload(event).kind === "stay_silent",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "quiet_observer" && payload(event).kind === "stay_silent",
    ),
  );
  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const archive = payload(event);
      const text = JSON.stringify(archive);
      return (
        archive.archiveId === archiveId &&
        text.includes(handoffId) &&
        text.includes("rejected") &&
        text.includes("no hidden reroute") &&
        text.includes("open question")
      );
    }),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "critic", topicId: "topic_handoff_refusal_silence", handoffId }));
  expectOk(assertNoForcedSpeech(run.events, { agentId: "mapper", topicId: "topic_handoff_refusal_silence", handoffId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_handoff_refusal_silence", archiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, archiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === handoffId)?.states,
    ["proposed", "rejected"],
  );
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.rejectedHandoffCount, 1);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.summaryClaimsConsensus, false);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "mapper")?.silenceCount, 1);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "quiet_observer")?.silenceCount, 1);
});

test("disagreement is not summarized as consensus", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("disagreement.json")));

  expectOk(
    assertEventExists(
      run.events,
      "message.created",
      (event) => payload(event).author === "critic" && String(payload(event).content).includes("object"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "memory.proposed",
      (event) => payload(event).memoryId === "memory_auto_accept_disputed",
    ),
  );
  expectOk(assertNoEvent(run.events, "memory.accepted", (event) => payload(event).memoryId === "memory_auto_accept_disputed"));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_memory_policy", archiveId: "day_2026_06_17" }));
  expectOk(assertArchiveHasSourceRefs(run.events, "day_2026_06_17"));
});

test("accepted memory can become contested and remain archive-visible", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("memory-contestation.json")));

  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.accepted",
        where: (event) => payload(event).memoryId === "memory_001",
      },
      {
        eventType: "memory.contested",
        where: (event) => payload(event).memoryId === "memory_001",
      },
    ),
  );

  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const contestedItems = payload(event).contestedItems;
      return (
        Array.isArray(contestedItems) &&
        contestedItems.some((item) => {
          const entry = item as Record<string, unknown>;
          return Array.isArray(entry.sourceRefs) && entry.sourceRefs.includes("memory_001");
        })
      );
    }),
  );
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_memory_review", archiveId: "day_2026_06_17" }));
  expectOk(assertArchiveHasSourceRefs(run.events, "day_2026_06_17"));
});

test("long-running memory downgrade carries into archive without forced consensus", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("memory-downgrade-archive-carryover.json")));
  const archiveId = "day_2026_06_18_memory_downgrade";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.contested",
        where: (event) => payload(event).memoryId === "memory_room_rule_001",
      },
      {
        eventType: "memory.stale",
        where: (event) => payload(event).memoryId === "memory_room_rule_001",
      },
    ),
  );

  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "listener" && payload(event).kind === "stay_silent",
    ),
  );
  expectOk(
    assertNoEvent(
      run.events,
      "memory.accepted",
      (event) => payload(event).memoryId === "memory_room_rule_001" && payload(event).reason !== undefined,
    ),
  );
  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const archive = payload(event);
      const text = JSON.stringify(archive);
      return (
        archive.archiveId === archiveId &&
        text.includes("memory_room_rule_001") &&
        text.includes("stale") &&
        text.includes("no room-wide protocol consensus")
      );
    }),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "listener", topicId: "topic_memory_downgrade" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_memory_downgrade", archiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, archiveId));

  assert.equal(report.eventTypeCounts["memory.contested"], 1);
  assert.equal(report.eventTypeCounts["memory.stale"], 1);
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === "memory_room_rule_001")?.states,
    ["accepted", "contested", "stale"],
  );
  assert.deepEqual(report.agentExpression.find((agent) => agent.agentId === "listener"), {
    agentId: "listener",
    intentionCount: 1,
    speechCount: 0,
    silenceCount: 1,
  });
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.summaryClaimsConsensus, false);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.contestedCount, 1);
});

test("long-running protocol expiry carries into archive without becoming permanent control", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("protocol-expiry-archive-carryover.json")));
  const archiveId = "day_2026_06_18_protocol_expiry";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "protocol.proposed",
        where: (event) => payload(event).protocolId === "protocol_one_turn_risk",
      },
      {
        eventType: "protocol.responded",
        where: (event) => payload(event).protocolId === "protocol_one_turn_risk" && payload(event).status === "active",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "protocol.responded",
        where: (event) => payload(event).protocolId === "protocol_one_turn_risk" && payload(event).status === "active",
      },
      {
        eventType: "protocol.expired",
        where: (event) => payload(event).protocolId === "protocol_one_turn_risk",
      },
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "listener" && payload(event).kind === "stay_silent",
    ),
  );
  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const archive = payload(event);
      const text = JSON.stringify(archive);
      return (
        archive.archiveId === archiveId &&
        text.includes("protocol_one_turn_risk") &&
        text.includes("expired") &&
        text.includes("not an active room rule")
      );
    }),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "listener", topicId: "topic_protocol_expiry" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_protocol_expiry", archiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, archiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === "protocol_one_turn_risk")?.states,
    ["proposed", "active", "expired"],
  );
  assert.equal((report.archives.find((archive) => archive.archiveId === archiveId)?.sourceRefCount ?? 0) >= 3, true);
  assert.equal(report.autonomySignals.forcedSpeechMarkerCount, 0);
});

test("stale memory can coexist with a temporary protocol without being revived as control", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("stale-memory-protocol-pressure.json")));
  const archiveId = "day_2026_06_19_stale_memory_protocol_pressure";
  const staleMemoryId = "memory_default_risk_first_protocol";
  const protocolId = "protocol_ref_boundary_check";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.contested",
        where: (event) => payload(event).memoryId === staleMemoryId,
      },
      {
        eventType: "memory.stale",
        where: (event) => payload(event).memoryId === staleMemoryId,
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "protocol.responded",
        where: (event) => payload(event).protocolId === protocolId && payload(event).status === "active",
      },
      {
        eventType: "protocol.expired",
        where: (event) => payload(event).protocolId === protocolId,
      },
    ),
  );
  expectOk(
    assertNoEvent(
      run.events,
      "memory.accepted",
      (event) => payload(event).memoryId === staleMemoryId && payload(event).byAgentId !== undefined,
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "quiet_observer" && payload(event).kind === "stay_silent",
    ),
  );
  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const archive = payload(event);
      const text = JSON.stringify(archive);
      return (
        archive.archiveId === archiveId &&
        text.includes(staleMemoryId) &&
        text.includes(protocolId) &&
        text.includes("contested") &&
        text.includes("stale") &&
        text.includes("expired") &&
        text.includes("no consensus revived stale memory")
      );
    }),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_observer", topicId: "topic_stale_memory_protocol_pressure" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_stale_memory_protocol_pressure", archiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, archiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === staleMemoryId)?.states,
    ["stale", "contested", "stale"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === protocolId)?.states,
    ["proposed", "active", "expired"],
  );
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.summaryClaimsConsensus, false);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.contestedCount, 1);
  assert.equal(report.autonomySignals.forcedSpeechMarkerCount, 0);
});

test("multiple simultaneous proposal chains stay social until explicitly applied", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("multiple-proposal-chains-carryover.json")));
  const archiveId = "day_2026_06_19_multiple_proposal_chains";
  const topicProposalId = "topic_proposal_context_split";
  const protocolId = "protocol_ref_pause";
  const memoryId = "memory_multi_chain_boundary";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventExists(
      run.events,
      "topic.proposed",
      (event) => payload(event).proposalId === topicProposalId && payload(event).status === "proposed",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "topic.responded",
      (event) => payload(event).topicProposalRef === topicProposalId && payload(event).response === "challenge",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "protocol.responded",
      (event) => payload(event).protocolId === protocolId && payload(event).status === "active",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "memory.proposed",
      (event) => payload(event).memoryId === memoryId && payload(event).state === "proposed",
    ),
  );
  expectOk(assertNoEvent(run.events, "topic.applied", (event) => payload(event).topicProposalRef === topicProposalId));
  expectOk(assertNoEvent(run.events, "topic.created", (event) => payload(event).appliedTopicProposalRef === topicProposalId));
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "quiet_observer" && payload(event).kind === "stay_silent",
    ),
  );
  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const archive = payload(event);
      const text = JSON.stringify(archive);
      return (
        archive.archiveId === archiveId &&
        text.includes(topicProposalId) &&
        text.includes(protocolId) &&
        text.includes(memoryId) &&
        text.includes("challenged") &&
        text.includes("unapplied") &&
        text.includes("no consensus new room order")
      );
    }),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_observer", topicId: "topic_multiple_proposals" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_multiple_proposals", archiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, archiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === topicProposalId)?.states,
    ["proposed", "challenge"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === protocolId)?.states,
    ["proposed", "active"],
  );
  assert.deepEqual(report.stateTransitions.find((transition) => transition.subjectRef === memoryId)?.states, ["proposed"]);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.summaryClaimsConsensus, false);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.contestedCount, 1);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "quiet_observer")?.silenceCount, 1);
});

test("topic proposal review pressure stays social without response or application", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("topic-proposal-review-pressure.json")));
  const archiveId = "day_2026_06_21_topic_review_pressure";
  const topicProposalId = "topic_proposal_review_pressure";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventExists(
      run.events,
      "topic.proposed",
      (event) => payload(event).proposalId === topicProposalId && payload(event).status === "proposed",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "topic.reviewed",
      (event) => payload(event).topicProposalRef === topicProposalId && payload(event).response === "cautioned",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "topic.reviewed",
      (event) => payload(event).topicProposalRef === topicProposalId && payload(event).response === "questioned",
    ),
  );
  expectOk(assertNoEvent(run.events, "topic.responded", (event) => payload(event).topicProposalRef === topicProposalId));
  expectOk(assertNoEvent(run.events, "topic.applied", (event) => payload(event).topicProposalRef === topicProposalId));
  expectOk(assertNoEvent(run.events, "topic.created", (event) => payload(event).appliedTopicProposalRef === topicProposalId));
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "quiet_observer" && payload(event).kind === "stay_silent",
    ),
  );
  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const archive = payload(event);
      const text = JSON.stringify(archive);
      return (
        archive.archiveId === archiveId &&
        text.includes(topicProposalId) &&
        text.includes("review pressure only") &&
        text.includes("no response") &&
        text.includes("no application") &&
        text.includes("no topic movement")
      );
    }),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_observer", topicId: "topic_review_pressure" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_review_pressure", archiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, archiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === topicProposalId)?.states,
    ["proposed", "cautioned", "questioned"],
  );
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.summaryClaimsConsensus, false);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.contestedCount, 1);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.openQuestionCount, 1);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.silenceCount, 1);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "quiet_observer")?.silenceCount, 1);
});

test("mixed social review braid preserves unresolved objects without lifecycle closure", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("mixed-review-braid.json")));
  const archiveId = "day_2026_06_22_mixed_review_braid";
  const memoryId = "memory_mixed_review_claim";
  const protocolId = "protocol_mixed_review_etiquette";
  const handoffId = "handoff_mixed_review_packet";
  const personaDeltaId = "persona_delta_mixed_review_listener";
  const topicProposalId = "topic_proposal_mixed_review_split";
  const questionId = "question_mixed_review_boundary";
  const report = buildScenarioRunReport(run);

  expectOk(assertEventExists(run.events, "memory.reviewed", (event) => payload(event).memoryRef === memoryId));
  expectOk(assertEventExists(run.events, "protocol.reviewed", (event) => payload(event).protocolRef === protocolId));
  expectOk(assertEventExists(run.events, "handoff.reviewed", (event) => payload(event).handoffRef === handoffId));
  expectOk(assertEventExists(run.events, "persona_delta.reviewed", (event) => payload(event).deltaRef === personaDeltaId));
  expectOk(assertEventExists(run.events, "topic.reviewed", (event) => payload(event).topicProposalRef === topicProposalId));
  expectOk(assertEventExists(run.events, "open_question.responded", (event) => payload(event).questionRef === questionId));
  expectOk(
    assertEventExists(
      run.events,
      "topic.updated",
      (event) => payload(event).openQuestionRef === questionId && String(payload(event).openQuestion).includes("hidden decision"),
    ),
  );

  expectOk(assertNoEvent(run.events, "memory.accepted", (event) => payload(event).memoryId === memoryId));
  expectOk(assertNoEvent(run.events, "memory.contested", (event) => payload(event).memoryId === memoryId));
  expectOk(assertNoEvent(run.events, "memory.stale", (event) => payload(event).memoryId === memoryId));
  expectOk(assertNoEvent(run.events, "memory.retired", (event) => payload(event).memoryId === memoryId));
  expectOk(assertNoEvent(run.events, "protocol.responded", (event) => payload(event).protocolId === protocolId));
  expectOk(assertNoEvent(run.events, "protocol.retired", (event) => payload(event).protocolId === protocolId));
  expectOk(assertNoEvent(run.events, "handoff.responded", (event) => payload(event).handoffId === handoffId));
  expectOk(assertNoEvent(run.events, "persona_delta.responded", (event) => payload(event).deltaId === personaDeltaId));
  expectOk(assertNoEvent(run.events, "topic.responded", (event) => payload(event).topicProposalRef === topicProposalId));
  expectOk(assertNoEvent(run.events, "topic.applied", (event) => payload(event).topicProposalRef === topicProposalId));
  expectOk(assertNoEvent(run.events, "topic.created", (event) => payload(event).appliedTopicProposalRef === topicProposalId));

  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const archive = payload(event);
      const text = JSON.stringify(archive);
      return (
        archive.archiveId === archiveId &&
        text.includes(memoryId) &&
        text.includes(protocolId) &&
        text.includes(handoffId) &&
        text.includes(personaDeltaId) &&
        text.includes(topicProposalId) &&
        text.includes(questionId) &&
        text.includes("no lifecycle response") &&
        text.includes("no lifecycle response, activation, transfer, identity mutation, topic movement")
      );
    }),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_observer", topicId: "topic_mixed_review_braid" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_mixed_review_braid", archiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, archiveId));

  assert.equal(report.eventTypeCounts["memory.reviewed"], 1);
  assert.equal(report.eventTypeCounts["protocol.reviewed"], 1);
  assert.equal(report.eventTypeCounts["handoff.reviewed"], 1);
  assert.equal(report.eventTypeCounts["persona_delta.reviewed"], 1);
  assert.equal(report.eventTypeCounts["topic.reviewed"], 1);
  assert.equal(report.eventTypeCounts["open_question.responded"], 1);
  const reviewPressure = report.socialReviewPressures.find(
    (pressure) => pressure.sourceMessageId === "msg_mixed_reviewer_pressure",
  );
  assert.ok(reviewPressure);
  assert.equal(reviewPressure.hasMixedSubjectTypes, true);
  assert.equal(reviewPressure.hasFormalClosure, false);
  assert.deepEqual(reviewPressure.formalClosureEventIds, []);
  assert.equal(reviewPressure.isCarriedByArchive, true);
  assert.deepEqual(reviewPressure.archiveCarryoverIds, [archiveId]);
  assert.deepEqual(reviewPressure.archiveCarriedReviewEventIds, []);
  assert.equal(reviewPressure.reviewEventIds.length, 6);
  assert.equal(reviewPressure.reviewedRefs.length, 6);
  assert.deepEqual(
    [...reviewPressure.subjectTypes].sort(),
    ["handoff", "memory", "open_question", "persona_delta", "protocol", "topic_proposal"].sort(),
  );
  assert.deepEqual(
    [...new Set(reviewPressure.reviewedRefs.map((trace) => trace.subjectRef))].sort(),
    [memoryId, protocolId, handoffId, personaDeltaId, topicProposalId, questionId].sort(),
  );
  assert.deepEqual(
    [...reviewPressure.archiveCarriedReviewedRefs].sort(),
    [memoryId, protocolId, handoffId, personaDeltaId, topicProposalId, questionId].sort(),
  );
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.summaryClaimsConsensus, false);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.contestedCount, 1);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.openQuestionCount, 1);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.silenceCount, 1);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "quiet_observer")?.silenceCount, 1);
});

test("later decisions after review pressure are not counted as same-speech closure", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("review-pressure-later-decision.json")));
  const archiveId = "day_2026_06_22_review_pressure_later_decision";
  const memoryId = "memory_later_review_claim";
  const protocolId = "protocol_later_review_etiquette";
  const report = buildScenarioRunReport(run);

  expectOk(assertEventExists(run.events, "memory.reviewed", (event) => payload(event).memoryRef === memoryId));
  expectOk(assertEventExists(run.events, "protocol.reviewed", (event) => payload(event).protocolRef === protocolId));
  const accepted = assertEventExists(
    run.events,
    "memory.accepted",
    (event) => payload(event).memoryId === memoryId && payload(event).state === "accepted",
  );
  expectOk(accepted);
  expectOk(assertNoEvent(run.events, "protocol.responded", (event) => payload(event).protocolId === protocolId));

  const reviewPressure = report.socialReviewPressures.find((pressure) => pressure.sourceMessageId === "msg_later_review_pressure");
  assert.ok(reviewPressure);
  assert.equal(reviewPressure.hasMixedSubjectTypes, true);
  assert.deepEqual([...reviewPressure.subjectTypes].sort(), ["memory", "protocol"].sort());
  assert.equal(reviewPressure.hasFormalClosure, false);
  assert.deepEqual(reviewPressure.formalClosureEventIds, []);
  assert.equal(reviewPressure.hasLaterFormalClosure, true);
  assert.deepEqual(reviewPressure.laterFormalClosureEventIds, accepted.eventIds);
  assert.equal(reviewPressure.isCarriedByArchive, true);
  assert.deepEqual(reviewPressure.archiveCarryoverIds, [archiveId]);
  assert.deepEqual([...reviewPressure.archiveCarriedReviewedRefs].sort(), [memoryId, protocolId].sort());

  assert.deepEqual(report.stateTransitions.find((transition) => transition.subjectRef === memoryId)?.states, [
    "proposed",
    "accepted",
  ]);
  assert.deepEqual(report.stateTransitions.find((transition) => transition.subjectRef === protocolId)?.states, ["proposed"]);
  assert.equal(report.archives.find((archive) => archive.archiveId === archiveId)?.summaryClaimsConsensus, false);
  expectOk(assertArchiveHasSourceRefs(run.events, archiveId));
});

test("social review pressure reads runtime nested archive source refs", () => {
  const memoryId = "memory_runtime_review_claim";
  const protocolId = "protocol_runtime_review_etiquette";
  const archiveId = "day_runtime_nested_archive";
  const events = [
    roomEvent("evt_runtime_review_message", "message.created", {
      messageId: "msg_runtime_review",
      author: "user",
      authorKind: "user",
      mentions: ["agent_a"],
      contextRefs: [memoryId, protocolId],
      content: "Please review these social objects without closing them.",
    }),
    roomEvent(
      "evt_runtime_memory_review",
      "memory.reviewed",
      {
        memoryRef: memoryId,
        sourceMessageId: "msg_runtime_review",
        agentId: "agent_a",
        response: "reviewed without accepting",
      },
      [memoryId, "msg_runtime_review"],
    ),
    roomEvent(
      "evt_runtime_protocol_review",
      "protocol.reviewed",
      {
        protocolRef: protocolId,
        sourceMessageId: "msg_runtime_review",
        agentId: "agent_a",
        response: "reviewed without applying",
      },
      [protocolId, "msg_runtime_review"],
    ),
    roomEvent("evt_runtime_archive", "daily_archive.created", {
      archiveId,
      summary: "Runtime archive keeps review pressure as social carryover.",
      archive: {
        memoryChanges: [
          {
            memoryId,
            sourceRefs: [memoryId],
            eventId: "evt_runtime_memory_review",
          },
        ],
        protocols: [
          {
            protocolId,
            sourceRefs: [protocolId],
            eventIds: ["evt_runtime_protocol_review"],
            reviews: [{ sourceRefs: [protocolId], eventId: "evt_runtime_protocol_review" }],
          },
        ],
      },
    }),
  ];
  const report = buildScenarioRunReport({
    fixture: { scenario_id: "runtime_nested_archive_review_pressure", initial_room: { room_id: "room_eval_test" }, messages: [] },
    events,
  });

  const pressure = report.socialReviewPressures.find((item) => item.sourceMessageId === "msg_runtime_review");
  assert.ok(pressure);
  assert.equal(pressure.isCarriedByArchive, true);
  assert.deepEqual(pressure.archiveCarryoverIds, [archiveId]);
  assert.deepEqual(
    [...pressure.archiveCarriedReviewEventIds].sort(),
    ["evt_runtime_memory_review", "evt_runtime_protocol_review"].sort(),
  );
  assert.deepEqual([...pressure.archiveCarriedReviewedRefs].sort(), [memoryId, protocolId].sort());
});

test("unresolved proposal chains carry across daily archives without becoming room order", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("multi-day-unresolved-proposal-carryover.json")));
  const day1ArchiveId = "day_2026_06_19_unresolved_proposals";
  const day2ArchiveId = "day_2026_06_20_unresolved_proposals";
  const topicProposalId = "topic_proposal_day1_split";
  const protocolId = "protocol_day1_ref_pause";
  const memoryId = "memory_day1_boundary";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "daily_archive.created",
        where: (event) => payload(event).archiveId === day1ArchiveId,
        label: "day-one archive",
      },
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_day2_revisit",
        label: "day-two revisit message",
      },
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "topic.responded",
      (event) => payload(event).topicProposalRef === topicProposalId && payload(event).response === "challenge",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "protocol.responded",
      (event) => payload(event).protocolId === protocolId && payload(event).status === "active",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "protocol.responded",
      (event) => payload(event).protocolId === protocolId && payload(event).status === "challenged",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "memory.contested",
      (event) => payload(event).memoryId === memoryId && payload(event).state === "contested",
    ),
  );
  expectOk(assertNoEvent(run.events, "topic.applied", (event) => payload(event).topicProposalRef === topicProposalId));
  expectOk(assertNoEvent(run.events, "topic.created", (event) => payload(event).appliedTopicProposalRef === topicProposalId));
  expectOk(assertNoEvent(run.events, "memory.accepted", (event) => payload(event).memoryId === memoryId));
  expectOk(
    assertEventExists(run.events, "daily_archive.created", (event) => {
      const archive = payload(event);
      const text = JSON.stringify(archive);
      return (
        archive.archiveId === day2ArchiveId &&
        text.includes(day1ArchiveId) &&
        text.includes(topicProposalId) &&
        text.includes(protocolId) &&
        text.includes(memoryId) &&
        text.includes("no consensus or automatic topic movement")
      );
    }),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_observer", topicId: "topic_multi_day_proposal_carryover" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_multi_day_proposal_carryover", archiveId: day2ArchiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, day1ArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, day2ArchiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === topicProposalId)?.states,
    ["proposed", "challenge"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === protocolId)?.states,
    ["proposed", "active", "challenged"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === memoryId)?.states,
    ["proposed", "contested"],
  );
  assert.equal(report.archives.find((archive) => archive.archiveId === day2ArchiveId)?.summaryClaimsConsensus, false);
  assert.equal(report.archives.find((archive) => archive.archiveId === day2ArchiveId)?.contestedCount, 2);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "quiet_observer")?.silenceCount, 2);

  const topicCarryover = report.multiArchiveCarryoverRefs.find((entry) => entry.ref === topicProposalId);
  assert.deepEqual(topicCarryover?.archiveIds, [day1ArchiveId, day2ArchiveId]);
  assert.equal(topicCarryover?.subjectType, "topic_proposal");
  assert.deepEqual(topicCarryover?.states, ["proposed", "challenge"]);
  assert.equal(topicCarryover?.unresolved, true);

  const memoryCarryover = report.multiArchiveCarryoverRefs.find((entry) => entry.ref === memoryId);
  assert.deepEqual(memoryCarryover?.archiveIds, [day1ArchiveId, day2ArchiveId]);
  assert.equal(memoryCarryover?.subjectType, "memory");
  assert.deepEqual(memoryCarryover?.states, ["proposed", "contested"]);
  assert.equal(memoryCarryover?.unresolved, true);
});

test("mixed-agent pressure carries across days without becoming repair workflow", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("mixed-agent-multi-day-pressure.json")));
  const boundaryId = "provider_boundary_mixed_timeout_1";
  const broadRepairId = "sidefx_mixed_provider_repair_001";
  const narrowerRepairId = "sidefx_mixed_provider_repair_002";
  const retryProtocolId = "protocol_mixed_retry_window";
  const memoryId = "memory_mixed_pressure_boundary_remains_open";
  const day1ArchiveId = "day_2026_06_22_mixed_pressure_choices";
  const day2DenialArchiveId = "day_2026_06_23_mixed_pressure_denial";
  const day2ReplacementArchiveId = "day_2026_06_23_mixed_pressure_replacement_denied";
  const day3ArchiveId = "day_2026_06_24_mixed_pressure_memory_revisit";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventExists(
      run.events,
      "agent.provider_degraded",
      (event) => payload(event).degradationId === boundaryId && payload(event).agentId === "recovering_member",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.requested",
      (event) =>
        payload(event).requestId === broadRepairId &&
        String(payload(event).reason).includes("explicit approval"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.requested",
      (event) =>
        payload(event).requestId === narrowerRepairId &&
        JSON.stringify(payload(event)).includes(broadRepairId) &&
        String(payload(event).reason).includes("narrower replacement"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "message.created",
      (event) => payload(event).messageId === "msg_retry_keeper_later_retry" && String(payload(event).content).includes("later retry"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "protocol.proposed",
      (event) => payload(event).protocolId === retryProtocolId && String(payload(event).summary).includes("retry"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "protocol.retired",
      (event) => payload(event).protocolId === retryProtocolId && String(payload(event).reason).includes("retire"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "memory.contested",
      (event) => payload(event).memoryId === memoryId && payload(event).state === "contested",
    ),
  );
  expectOk(assertNoEvent(run.events, "side_effect.approved", (event) => [broadRepairId, narrowerRepairId].includes(String(payload(event).approvalId))));
  expectOk(assertNoEvent(run.events, "side_effect.result_reported", () => true));
  expectOk(assertNoEvent(run.events, "provider_boundary.retired", (event) => payload(event).providerBoundaryRef === boundaryId));
  expectOk(assertNoEvent(run.events, "memory.accepted", (event) => payload(event).memoryId === memoryId));
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_listener", topicId: "topic_mixed_agent_pressure" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_mixed_agent_pressure", archiveId: day3ArchiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, day1ArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, day2DenialArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, day2ReplacementArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, day3ArchiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === broadRepairId)?.states,
    ["requested", "denied"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === narrowerRepairId)?.states,
    ["requested", "denied"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === retryProtocolId)?.states,
    ["proposed", "retired"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === memoryId)?.states,
    ["proposed", "contested"],
  );
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "quiet_listener")?.silenceCount, 2);
  assert.equal(report.autonomySignals.sideEffectRequestCount, 2);
  assert.equal(report.autonomySignals.sideEffectDeniedCount, 2);
  assert.equal(report.autonomySignals.sideEffectApprovalCount, 0);

  const recovery = report.providerBoundaryRecoveries.find((entry) => entry.agentId === "recovering_member");
  const choice = recovery?.pressureChoices.find((entry) => entry.boundaryRef === boundaryId);
  assert.ok(choice);
  assert.equal(choice.hasMixedChoices, true);
  assert.equal(choice.hasMultiAgentPressure, true);
  assert.equal(choice.carriedAcrossArchives, true);
  assert.equal(choice.repairRequestEventIds.length, 2);
  assert.equal(choice.replacementRepairRequestEventIds.length, 1);
  assert.equal(choice.sideEffectDeniedEventIds.length, 2);
  assert.equal(choice.retryProposalEventIds.length, 1);
  assert.equal(choice.retryProtocolProposalEventIds.length, 1);
  assert.equal(choice.retryRetirementEventIds.length, 1);
  assert.equal(choice.silenceIntentionEventIds.length, 2);
  assert.deepEqual(choice.archiveCarryoverIds, [
    day1ArchiveId,
    day2DenialArchiveId,
    day2ReplacementArchiveId,
    day3ArchiveId,
  ]);
  assert.deepEqual(
    choice.choiceAgentIds.sort(),
    ["approval_guard", "boundary_observer", "critic", "memory_keeper", "quiet_listener", "retry_keeper"].sort(),
  );

  const boundaryCarryover = report.multiArchiveCarryoverRefs.find((entry) => entry.ref === boundaryId);
  assert.deepEqual(boundaryCarryover?.archiveIds, [
    day1ArchiveId,
    day2DenialArchiveId,
    day2ReplacementArchiveId,
    day3ArchiveId,
  ]);
  assert.equal(boundaryCarryover?.subjectType, "provider_boundary");
  assert.deepEqual(boundaryCarryover?.states, ["degraded"]);
  assert.equal(boundaryCarryover?.unresolved, true);
});

test("long-running archive repair revisions carry into archive only after explicit application", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("archive-repair-revision-carryover.json")));
  const baseArchiveId = "day_2026_06_19_base";
  const revisedArchiveId = "day_2026_06_19_base_rev_01";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventExists(
      run.events,
      "daily_archive.created",
      (event) => payload(event).archiveId === baseArchiveId,
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "archive.repair_proposed",
        where: (event) => payload(event).repairId === "archive_repair_001",
        label: "original archive repair proposal",
      },
      {
        eventType: "archive.repair_responded",
        where: (event) => payload(event).repairRef === "archive_repair_001" && payload(event).status === "revised",
        label: "revision response",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "archive.repair_responded",
        where: (event) => payload(event).repairRef === "archive_repair_001" && payload(event).status === "revised",
        label: "revision response",
      },
      {
        eventType: "archive.repair_proposed",
        where: (event) =>
          payload(event).repairId === "archive_repair_002" &&
          payload(event).revisedFromRepairRef === "archive_repair_001",
        label: "fresh revised repair proposal",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "archive.repair_proposed",
        where: (event) => payload(event).repairId === "archive_repair_002",
        label: "revised repair proposal",
      },
      {
        eventType: "archive.repair_responded",
        where: (event) => payload(event).repairRef === "archive_repair_002" && payload(event).status === "accepted",
        label: "accepted revised repair",
      },
    ),
  );

  const applicationIndex = run.events.findIndex(
    (event) => event.event_type === "archive.repair_applied" && payload(event).repairRef === "archive_repair_002",
  );
  assert.notEqual(applicationIndex, -1);
  expectOk(
    assertNoEvent(
      run.events.slice(0, applicationIndex),
      "daily_archive.created",
      (event) => payload(event).archiveId === revisedArchiveId,
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "archive.repair_responded",
        where: (event) => payload(event).repairRef === "archive_repair_002" && payload(event).status === "accepted",
        label: "accepted revised repair",
      },
      {
        eventType: "archive.repair_applied",
        where: (event) =>
          payload(event).repairRef === "archive_repair_002" &&
          String(payload(event).boundaryNote).includes("original archive remains unchanged"),
        label: "explicit repair application",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "archive.repair_applied",
        where: (event) => payload(event).repairRef === "archive_repair_002",
        label: "explicit repair application",
      },
      {
        eventType: "daily_archive.created",
        where: (event) =>
          payload(event).archiveId === revisedArchiveId &&
          payload(event).revisionOf === baseArchiveId &&
          payload(event).appliedRepairRef === "archive_repair_002" &&
          String(payload(event).summary).includes("not consensus"),
        label: "archive revision",
      },
    ),
  );
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_listener", topicId: "topic_archive_review" }));
  expectOk(assertArchiveHasSourceRefs(run.events, baseArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, revisedArchiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === "archive_repair_001")?.states,
    ["proposed", "revised"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === "archive_repair_002")?.states,
    ["proposed", "accepted", "applied"],
  );
  assert.equal(report.archives.find((archive) => archive.archiveId === revisedArchiveId)?.revisionOf, baseArchiveId);
  assert.equal(report.archives.find((archive) => archive.archiveId === revisedArchiveId)?.appliedRepairRef, "archive_repair_002");
});

test("archive review rhythm carries disagreement, silence, and provider boundary separately", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("archive-review-provider-boundary-silence.json")));
  const baseArchiveId = "day_2026_06_20_archive_seed";
  const followupArchiveId = "day_2026_06_20_archive_review_followup";
  const reviewRequestId = "archive_review_request_day_2026_06_20_archive_seed";
  const providerBoundaryId = "provider_boundary_degraded_kimi_timeout";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "archive.review_requested",
        where: (event) =>
          payload(event).requestId === reviewRequestId &&
          String(payload(event).boundaryNote).includes("not a command to speak"),
        label: "archive review request",
      },
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_review_request",
        label: "review prompt message",
      },
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "archive.reviewed",
      (event) => payload(event).reviewedBy === "archive_reviewer" && payload(event).assessment === "biased_summary",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "archive.reviewed",
      (event) => payload(event).reviewedBy === "archive_defender" && payload(event).assessment === "usable_skeleton",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.provider_degraded",
      (event) =>
        payload(event).degradationId === providerBoundaryId &&
        payload(event).agentId === "degraded_kimi" &&
        String(payload(event).boundaryNote).includes("not agent silence"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "quiet_listener" && payload(event).kind === "stay_silent",
    ),
  );
  expectOk(assertNoEvent(run.events, "agent.intention.recorded", (event) => payload(event).agentId === "degraded_kimi"));
  expectOk(assertNoEvent(run.events, "message.created", (event) => payload(event).author === "degraded_kimi"));
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_listener", topicId: "topic_archive_review_provider_boundary" }));
  expectOk(assertNoForcedSpeech(run.events, { agentId: "degraded_kimi", topicId: "topic_archive_review_provider_boundary" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_archive_review_provider_boundary", archiveId: followupArchiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, baseArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, followupArchiveId));

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === providerBoundaryId)?.states,
    ["degraded"],
  );
  assert.equal(report.autonomySignals.providerBoundaryCount, 1);
  assert.equal(report.autonomySignals.archiveReviewRequestCount, 1);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "quiet_listener")?.silenceCount, 1);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "degraded_kimi")?.intentionCount ?? 0, 0);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "degraded_kimi")?.silenceCount ?? 0, 0);

  const followup = report.archives.find((archive) => archive.archiveId === followupArchiveId);
  assert.equal(followup?.summaryClaimsConsensus, false);
  assert.equal(followup?.disagreementCount, 1);
  assert.equal(followup?.contestedCount, 1);
  assert.equal(followup?.openQuestionCount, 1);
  assert.equal(followup?.silenceCount, 1);
  assert.equal(followup?.providerBoundaryCount, 1);
  assert.equal(followup?.archiveReviewCount, 1);
  assert.equal(followup?.carriedRefs.includes(providerBoundaryId), true);
});

test("provider boundary recovery lets the same agent speak later without becoming silence or personality", () => {
  const run = runScenarioFixture(loadScenarioFixture(fixturePath("provider-boundary-recovery-carryover.json")));
  const firstBoundaryId = "provider_boundary_recovering_kimi_timeout_1";
  const secondBoundaryId = "provider_boundary_recovering_kimi_timeout_2";
  const futureBoundaryId = "provider_boundary_recovering_kimi_timeout_3";
  const afterFailuresArchiveId = "day_2026_06_20_provider_recovery_after_failures";
  const afterReturnArchiveId = "day_2026_06_20_provider_recovery_after_return";
  const afterRetirementArchiveId = "day_2026_06_20_provider_recovery_after_retirement";
  const afterFutureOutageArchiveId = "day_2026_06_20_provider_recovery_after_future_outage";
  const afterChoicePressureArchiveId = "day_2026_06_20_provider_recovery_after_choice_pressure";
  const afterRepairDenialArchiveId = "day_2026_06_20_provider_recovery_after_repair_denial";
  const afterRetryRetirementArchiveId = "day_2026_06_20_provider_recovery_after_retry_retirement";
  const afterNarrowerRepairArchiveId = "day_2026_06_21_provider_recovery_after_narrower_repair_request";
  const afterNarrowerApprovalArchiveId = "day_2026_06_21_provider_recovery_after_narrower_repair_approval";
  const afterNarrowerResultArchiveId = "day_2026_06_21_provider_recovery_after_narrower_repair_result";
  const afterPostResultRetirementArchiveId = "day_2026_06_21_provider_recovery_after_post_result_boundary_retirement";
  const afterPostRetirementMemoryArchiveId = "day_2026_06_21_provider_recovery_after_post_retirement_memory_claim";
  const afterPostRetirementMemoryRevisionArchiveId =
    "day_2026_06_21_provider_recovery_after_post_retirement_memory_revision";
  const afterPostRetirementRevisedMemoryStaleArchiveId =
    "day_2026_06_21_provider_recovery_after_revised_memory_stale";
  const afterPostRetirementRevisedMemoryRetiredArchiveId =
    "day_2026_06_21_provider_recovery_after_revised_memory_retired";
  const afterPostRetirementFreshMemoryAcceptanceArchiveId =
    "day_2026_06_21_provider_recovery_after_fresh_memory_acceptance";
  const afterPostRetirementRepairProposalArchiveId =
    "day_2026_06_21_provider_recovery_after_post_retirement_repair_proposal";
  const afterPostRetirementRepairDenialArchiveId =
    "day_2026_06_21_provider_recovery_after_post_retirement_repair_denial";
  const afterPostRetirementFreshApprovalArchiveId =
    "day_2026_06_21_provider_recovery_after_post_retirement_repair_fresh_approval";
  const afterPostRetirementRepairExpiryArchiveId =
    "day_2026_06_21_provider_recovery_after_post_retirement_repair_expiry";
  const sideEffectRequestId = "sidefx_provider_boundary_repair_001";
  const narrowerSideEffectRequestId = "sidefx_provider_boundary_repair_002";
  const narrowerSideEffectResultId = "sidefx_provider_boundary_repair_002_result";
  const postRetirementSideEffectRequestId = "sidefx_provider_boundary_repair_003_post_retirement_recheck";
  const approvedPostRetirementSideEffectRequestId = "sidefx_provider_boundary_repair_004_post_retirement_snapshot";
  const postResultMemoryId = "memory_provider_result_diagnostic_evidence_only";
  const revisedPostResultMemoryId = "memory_provider_result_diagnostic_evidence_scoped";
  const acceptedPostRetirementMemoryId = "memory_provider_recovery_observed_after_retired_revision";
  const secondRecoverySpeechId = "msg_recovering_kimi_second_return_evidence";
  const retryProtocolId = "protocol_retry_recovering_kimi_later";
  const report = buildScenarioRunReport(run);

  expectOk(
    assertEventExists(
      run.events,
      "agent.provider_degraded",
      (event) => payload(event).degradationId === firstBoundaryId && payload(event).agentId === "recovering_kimi",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.provider_degraded",
      (event) => payload(event).degradationId === secondBoundaryId && payload(event).agentId === "recovering_kimi",
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.provider_degraded",
      (event) => payload(event).degradationId === futureBoundaryId && payload(event).agentId === "recovering_kimi",
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "agent.provider_degraded",
        where: (event) => payload(event).degradationId === secondBoundaryId,
        label: "second provider boundary",
      },
      {
        eventType: "message.created",
        where: (event) => payload(event).author === "recovering_kimi" && payload(event).messageId === "msg_recovering_kimi_back",
        label: "recovery speech",
      },
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) => payload(event).agentId === "recovering_kimi" && payload(event).kind === "speak",
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "message.created",
        where: (event) => payload(event).author === "recovering_kimi" && payload(event).messageId === "msg_recovering_kimi_back",
        label: "recovery speech",
      },
      {
        eventType: "provider_boundary.retired",
        where: (event) => payload(event).providerBoundaryRef === firstBoundaryId,
        label: "first boundary retirement",
      },
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "provider_boundary.retired",
      (event) =>
        payload(event).providerBoundaryRef === secondBoundaryId &&
        String(payload(event).boundaryNote).includes("does not delete ledger or archive history"),
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "provider_boundary.retired",
        where: (event) => payload(event).providerBoundaryRef === secondBoundaryId,
        label: "second boundary retirement",
      },
      {
        eventType: "agent.provider_degraded",
        where: (event) => payload(event).degradationId === futureBoundaryId,
        label: "fresh future provider boundary",
      },
    ),
  );
  const firstRetirementIndex = run.events.findIndex(
    (event) => event.event_type === "provider_boundary.retired" && payload(event).providerBoundaryRef === firstBoundaryId,
  );
  assert.notEqual(firstRetirementIndex, -1);
  expectOk(
    assertNoEvent(
      run.events.slice(firstRetirementIndex + 1),
      "agent.provider_degraded",
      (event) => payload(event).degradationId === firstBoundaryId || payload(event).degradationId === secondBoundaryId,
    ),
  );
  expectOk(assertNoEvent(run.events, "persona_delta.proposed", (event) => payload(event).agentId === "recovering_kimi"));
  expectOk(assertNoForcedSpeech(run.events, { agentId: "recovering_kimi", topicId: "topic_provider_boundary_recovery" }));
  expectOk(assertNoForcedSpeech(run.events, { agentId: "quiet_listener", topicId: "topic_provider_boundary_recovery" }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterRetirementArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterFutureOutageArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterChoicePressureArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterRepairDenialArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterRetryRetirementArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterNarrowerRepairArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterNarrowerApprovalArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterNarrowerResultArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostResultRetirementArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementMemoryArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementMemoryRevisionArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementRevisedMemoryStaleArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementRevisedMemoryRetiredArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementFreshMemoryAcceptanceArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementRepairProposalArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementRepairDenialArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementFreshApprovalArchiveId }));
  expectOk(assertNoForcedAgreement(run.events, { topicId: "topic_provider_boundary_recovery", archiveId: afterPostRetirementRepairExpiryArchiveId }));
  expectOk(assertArchiveHasSourceRefs(run.events, afterFailuresArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterReturnArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterRetirementArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterFutureOutageArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterChoicePressureArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterRepairDenialArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterRetryRetirementArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterNarrowerRepairArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterNarrowerApprovalArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterNarrowerResultArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostResultRetirementArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementMemoryArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementMemoryRevisionArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementRevisedMemoryStaleArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementRevisedMemoryRetiredArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementFreshMemoryAcceptanceArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementRepairProposalArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementRepairDenialArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementFreshApprovalArchiveId));
  expectOk(assertArchiveHasSourceRefs(run.events, afterPostRetirementRepairExpiryArchiveId));
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.requested",
      (event) =>
        payload(event).requestId === sideEffectRequestId &&
        JSON.stringify(payload(event)).includes(futureBoundaryId) &&
        String(payload(event).reason).includes("explicit approval"),
    ),
  );
  expectFail(assertSideEffectHasApproval(run.events, sideEffectRequestId));
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.requested",
      (event) =>
        payload(event).requestId === narrowerSideEffectRequestId &&
        JSON.stringify(payload(event)).includes(sideEffectRequestId) &&
        JSON.stringify(payload(event)).includes(retryProtocolId) &&
        String(payload(event).reason).includes("read-only version check"),
    ),
  );
  expectOk(assertSideEffectHasApproval(run.events, narrowerSideEffectRequestId));
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.result_reported",
      (event) =>
        payload(event).approvalId === narrowerSideEffectRequestId &&
        payload(event).resultId === narrowerSideEffectResultId &&
        String(payload(event).boundaryNote).includes("does not automatically repair a provider"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.requested",
      (event) =>
        payload(event).requestId === postRetirementSideEffectRequestId &&
        JSON.stringify(payload(event)).includes(acceptedPostRetirementMemoryId) &&
        JSON.stringify(payload(event)).includes(futureBoundaryId) &&
        String(payload(event).reason).includes("without reviving retired provider pressure"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "message.created",
      (event) =>
        payload(event).messageId === "msg_approval_guard_denies_post_retirement_recheck" &&
        payload(event).author === "approval_guard" &&
        String(payload(event).content).includes("deny sidefx_provider_boundary_repair_003_post_retirement_recheck"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.denied",
      (event) =>
        payload(event).approvalId === postRetirementSideEffectRequestId &&
        payload(event).deniedBy === "room_boundary" &&
        String(payload(event).reason).includes("does not execute diagnostics") &&
        JSON.stringify(payload(event)).includes(acceptedPostRetirementMemoryId),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.requested",
      (event) =>
        payload(event).requestId === approvedPostRetirementSideEffectRequestId &&
        JSON.stringify(payload(event)).includes(postRetirementSideEffectRequestId) &&
        JSON.stringify(payload(event)).includes(acceptedPostRetirementMemoryId) &&
        JSON.stringify(payload(event)).includes(futureBoundaryId) &&
        String(payload(event).reason).includes("denied maintenance check"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "message.created",
      (event) =>
        payload(event).messageId === "msg_approval_guard_approves_fresh_post_retirement_snapshot" &&
        payload(event).author === "approval_guard" &&
        String(payload(event).content).includes("approve sidefx_provider_boundary_repair_004_post_retirement_snapshot"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.approved",
      (event) =>
        payload(event).approvalId === approvedPostRetirementSideEffectRequestId &&
        payload(event).approvedBy === "room_boundary" &&
        String(payload(event).reason).includes("does not approve the denied request") &&
        JSON.stringify(payload(event)).includes(postRetirementSideEffectRequestId) &&
        JSON.stringify(payload(event)).includes(acceptedPostRetirementMemoryId),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "message.created",
      (event) =>
        payload(event).messageId === "msg_approval_guard_expires_fresh_post_retirement_snapshot" &&
        payload(event).author === "approval_guard" &&
        String(payload(event).content).includes("expire sidefx_provider_boundary_repair_004_post_retirement_snapshot"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "side_effect.expired",
      (event) =>
        payload(event).approvalId === approvedPostRetirementSideEffectRequestId &&
        payload(event).expiredBy === "room_boundary" &&
        String(payload(event).reason).includes("Expire the unused post-retirement snapshot permission") &&
        JSON.stringify(payload(event)).includes(postRetirementSideEffectRequestId) &&
        JSON.stringify(payload(event)).includes(acceptedPostRetirementMemoryId),
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.requested",
        where: (event) => payload(event).requestId === sideEffectRequestId,
        label: "provider repair request",
      },
      {
        eventType: "protocol.proposed",
        where: (event) =>
          payload(event).protocolId === retryProtocolId &&
          String(payload(event).summary).includes("Later retry recovering_kimi"),
        label: "retry protocol proposal",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.approved",
        where: (event) => payload(event).approvalId === approvedPostRetirementSideEffectRequestId,
        label: "fresh post-retirement snapshot approval",
      },
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_approval_guard_expires_fresh_post_retirement_snapshot",
        label: "fresh post-retirement snapshot expiry speech",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_approval_guard_expires_fresh_post_retirement_snapshot",
        label: "fresh post-retirement snapshot expiry speech",
      },
      {
        eventType: "side_effect.expired",
        where: (event) => payload(event).approvalId === approvedPostRetirementSideEffectRequestId,
        label: "fresh post-retirement snapshot expiry",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.denied",
        where: (event) => payload(event).approvalId === postRetirementSideEffectRequestId,
        label: "post-retirement maintenance denial",
      },
      {
        eventType: "side_effect.requested",
        where: (event) => payload(event).requestId === approvedPostRetirementSideEffectRequestId,
        label: "fresh post-retirement snapshot request",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.requested",
        where: (event) => payload(event).requestId === approvedPostRetirementSideEffectRequestId,
        label: "fresh post-retirement snapshot request",
      },
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_approval_guard_approves_fresh_post_retirement_snapshot",
        label: "fresh post-retirement snapshot approval speech",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_approval_guard_approves_fresh_post_retirement_snapshot",
        label: "fresh post-retirement snapshot approval speech",
      },
      {
        eventType: "side_effect.approved",
        where: (event) => payload(event).approvalId === approvedPostRetirementSideEffectRequestId,
        label: "fresh post-retirement snapshot approval",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.requested",
        where: (event) => payload(event).requestId === postRetirementSideEffectRequestId,
        label: "post-retirement maintenance check request",
      },
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_approval_guard_denies_post_retirement_recheck",
        label: "post-retirement maintenance denial speech",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_approval_guard_denies_post_retirement_recheck",
        label: "post-retirement maintenance denial speech",
      },
      {
        eventType: "side_effect.denied",
        where: (event) => payload(event).approvalId === postRetirementSideEffectRequestId,
        label: "post-retirement maintenance denial",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.contested",
        where: (event) => payload(event).memoryId === postResultMemoryId,
        label: "post-retirement memory contest",
      },
      {
        eventType: "memory.proposed",
        where: (event) =>
          payload(event).memoryId === revisedPostResultMemoryId &&
          payload(event).revisedFromMemoryRef === postResultMemoryId &&
          String(payload(event).boundaryNote).includes("does not rewrite the previous memory claim"),
        label: "scoped memory revision proposal",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.proposed",
        where: (event) =>
          payload(event).memoryId === revisedPostResultMemoryId &&
          payload(event).revisedFromMemoryRef === postResultMemoryId,
        label: "scoped memory revision proposal",
      },
      {
        eventType: "memory.stale",
        where: (event) =>
          payload(event).memoryId === revisedPostResultMemoryId &&
          String(payload(event).reason).includes("stale caution") &&
          JSON.stringify(payload(event)).includes(postResultMemoryId),
        label: "scoped memory marked stale",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.accepted",
        where: (event) => payload(event).memoryId === acceptedPostRetirementMemoryId,
        label: "fresh post-retirement memory acceptance",
      },
      {
        eventType: "side_effect.requested",
        where: (event) => payload(event).requestId === postRetirementSideEffectRequestId,
        label: "post-retirement maintenance check request",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "provider_boundary.retired",
        where: (event) => payload(event).providerBoundaryRef === futureBoundaryId,
        label: "explicit post-result boundary retirement",
      },
      {
        eventType: "side_effect.requested",
        where: (event) => payload(event).requestId === postRetirementSideEffectRequestId,
        label: "post-retirement maintenance check request",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.stale",
        where: (event) => payload(event).memoryId === revisedPostResultMemoryId,
        label: "scoped memory marked stale",
      },
      {
        eventType: "memory.retired",
        where: (event) =>
          payload(event).memoryId === revisedPostResultMemoryId &&
          String(payload(event).reason).includes("leave active public memory") &&
          JSON.stringify(payload(event)).includes(postResultMemoryId),
        label: "scoped memory retired",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.retired",
        where: (event) => payload(event).memoryId === revisedPostResultMemoryId,
        label: "scoped memory retired",
      },
      {
        eventType: "message.created",
        where: (event) =>
          payload(event).author === "recovering_kimi" &&
          payload(event).messageId === secondRecoverySpeechId &&
          String(payload(event).content).includes("新的 provider availability evidence"),
        label: "second recovery speech evidence",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === secondRecoverySpeechId,
        label: "second recovery speech evidence",
      },
      {
        eventType: "memory.proposed",
        where: (event) =>
          payload(event).memoryId === acceptedPostRetirementMemoryId &&
          payload(event).revisedFromMemoryRef === revisedPostResultMemoryId &&
          JSON.stringify(payload(event)).includes(secondRecoverySpeechId),
        label: "fresh post-retirement memory proposal",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.proposed",
        where: (event) =>
          payload(event).memoryId === acceptedPostRetirementMemoryId &&
          payload(event).revisedFromMemoryRef === revisedPostResultMemoryId,
        label: "fresh post-retirement memory proposal",
      },
      {
        eventType: "memory.accepted",
        where: (event) =>
          payload(event).memoryId === acceptedPostRetirementMemoryId &&
          String(payload(event).reason).includes("accepted remains provisional room sediment") &&
          JSON.stringify(payload(event)).includes(secondRecoverySpeechId),
        label: "fresh post-retirement memory acceptance",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "protocol.proposed",
        where: (event) => payload(event).protocolId === retryProtocolId,
        label: "retry protocol proposal",
      },
      {
        eventType: "message.created",
        where: (event) =>
          payload(event).messageId === "msg_approval_guard_contests_repair" &&
          String(payload(event).content).includes("反对现在批准"),
        label: "approval contest speech",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_approval_guard_contests_repair",
        label: "approval contest speech",
      },
      {
        eventType: "side_effect.denied",
        where: (event) =>
          payload(event).approvalId === sideEffectRequestId &&
          payload(event).deniedBy === "room_boundary" &&
          String(payload(event).boundaryNote).includes("without executing it"),
        label: "repair request denial",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.denied",
        where: (event) => payload(event).approvalId === sideEffectRequestId,
        label: "repair request denial",
      },
      {
        eventType: "protocol.retired",
        where: (event) =>
          payload(event).protocolId === retryProtocolId &&
          String(payload(event).reason).includes("keeping a later retry protocol active adds pressure"),
        label: "retry protocol retirement",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "protocol.retired",
        where: (event) => payload(event).protocolId === retryProtocolId,
        label: "retry protocol retirement",
      },
      {
        eventType: "side_effect.requested",
        where: (event) => payload(event).requestId === narrowerSideEffectRequestId,
        label: "narrower repair request",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.requested",
        where: (event) => payload(event).requestId === narrowerSideEffectRequestId,
        label: "narrower repair request",
      },
      {
        eventType: "message.created",
        where: (event) =>
          payload(event).messageId === "msg_approval_guard_supports_scoped_approval" &&
          String(payload(event).content).includes("批准不等于执行"),
        label: "scoped approval support speech",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "message.created",
        where: (event) => payload(event).messageId === "msg_approval_guard_supports_scoped_approval",
        label: "scoped approval support speech",
      },
      {
        eventType: "side_effect.approved",
        where: (event) =>
          payload(event).approvalId === narrowerSideEffectRequestId &&
          payload(event).approvedBy === "room_boundary" &&
          String(payload(event).boundaryNote).includes("approval is still not execution"),
        label: "narrower repair approval",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.approved",
        where: (event) => payload(event).approvalId === narrowerSideEffectRequestId,
        label: "narrower repair approval",
      },
      {
        eventType: "side_effect.result_reported",
        where: (event) => payload(event).approvalId === narrowerSideEffectRequestId,
        label: "narrower repair result",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "side_effect.result_reported",
        where: (event) => payload(event).approvalId === narrowerSideEffectRequestId,
        label: "narrower repair result",
      },
      {
        eventType: "provider_boundary.retired",
        where: (event) =>
          payload(event).providerBoundaryRef === futureBoundaryId &&
          String(payload(event).boundaryNote).includes("does not delete ledger or archive history"),
        label: "explicit post-result boundary retirement",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "provider_boundary.retired",
        where: (event) => payload(event).providerBoundaryRef === futureBoundaryId,
        label: "explicit post-result boundary retirement",
      },
      {
        eventType: "memory.proposed",
        where: (event) =>
          payload(event).memoryId === postResultMemoryId &&
          JSON.stringify(payload(event)).includes(narrowerSideEffectResultId),
        label: "post-retirement memory proposal",
      },
    ),
  );
  expectOk(
    assertEventOrder(
      run.events,
      {
        eventType: "memory.proposed",
        where: (event) => payload(event).memoryId === postResultMemoryId,
        label: "post-retirement memory proposal",
      },
      {
        eventType: "memory.contested",
        where: (event) =>
          payload(event).memoryId === postResultMemoryId &&
          String(payload(event).reason).includes("too easy to overread as recovery truth"),
        label: "post-retirement memory contest",
      },
    ),
  );
  expectOk(assertNoEvent(run.events, "side_effect.approved", (event) => payload(event).approvalId === sideEffectRequestId));
  expectOk(assertNoEvent(run.events, "side_effect.result_reported", (event) => payload(event).approvalId === sideEffectRequestId));
  expectOk(
    assertNoEvent(
      run.events,
      "memory.accepted",
      (event) => JSON.stringify(payload(event)).includes(narrowerSideEffectResultId),
    ),
  );
  expectOk(assertNoEvent(run.events, "memory.accepted", (event) => payload(event).memoryId === postResultMemoryId));
  expectOk(assertNoEvent(run.events, "memory.accepted", (event) => payload(event).memoryId === revisedPostResultMemoryId));
  expectOk(assertNoEvent(run.events, "memory.retired", (event) => payload(event).memoryId === postResultMemoryId));
  expectOk(assertNoEvent(run.events, "side_effect.approved", (event) => payload(event).approvalId === postRetirementSideEffectRequestId));
  expectOk(assertNoEvent(run.events, "side_effect.result_reported", (event) => payload(event).approvalId === postRetirementSideEffectRequestId));
  expectOk(assertNoEvent(run.events, "side_effect.result_reported", (event) => payload(event).approvalId === approvedPostRetirementSideEffectRequestId));
  expectOk(assertNoEvent(run.events, "memory.stale", (event) => payload(event).memoryId === acceptedPostRetirementMemoryId));
  expectOk(assertNoEvent(run.events, "memory.contested", (event) => payload(event).memoryId === acceptedPostRetirementMemoryId));
  expectOk(
    assertEventExists(
      run.events,
      "message.created",
      (event) =>
        payload(event).messageId === "msg_retry_keeper_later_retry" &&
        payload(event).author === "retry_keeper" &&
        String(payload(event).content).includes("稍后再 retry"),
    ),
  );
  expectOk(
    assertEventExists(
      run.events,
      "agent.intention.recorded",
      (event) =>
        payload(event).agentId === "quiet_listener" &&
        payload(event).kind === "stay_silent" &&
        JSON.stringify(payload(event)).includes(futureBoundaryId),
    ),
  );

  const recovery = report.providerBoundaryRecoveries.find((entry) => entry.agentId === "recovering_kimi");
  assert.equal(recovery?.degradationCount, 3);
  assert.deepEqual(recovery?.boundaryRefs, [firstBoundaryId, secondBoundaryId, futureBoundaryId]);
  assert.deepEqual(recovery?.retiredBoundaryRefs, [firstBoundaryId, secondBoundaryId, futureBoundaryId]);
  assert.deepEqual(recovery?.activeBoundaryRefs, []);
  assert.deepEqual(recovery?.freshBoundaryRefsAfterRetirement, [futureBoundaryId]);
  assert.deepEqual(recovery?.reusedRetiredBoundaryRefsAfterRetirement, []);
  assert.equal(recovery?.freshBoundaryPressureChoices.length, 1);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.boundaryRef, futureBoundaryId);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.repairRequestEventIds.length, 4);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.replacementRepairRequestEventIds.length, 2);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.retryProposalEventIds.length, 1);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.silenceIntentionEventIds.length, 1);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.disagreementEventIds.length >= 1, true);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.sideEffectApprovalEventIds.length, 2);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.sideEffectDeniedEventIds.length, 2);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.sideEffectExpiredEventIds.length, 1);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.sideEffectResultEventIds.length, 1);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.retryProtocolProposalEventIds.length, 1);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.retryRetirementEventIds.length, 1);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.providerBoundaryRetirementEventIds.length, 1);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.hasMixedChoices, true);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.repairStillRequiresApproval, false);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.repairDeniedAfterContest, true);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.repairReplacementAfterDenial, true);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.repairApprovedWithoutExecution, false);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.repairResultReported, true);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.repairResultWithoutBoundaryRetirement, true);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.providerBoundaryRetiredAfterResult, true);
  assert.equal(recovery?.freshBoundaryPressureChoices[0]?.retryRetiredWithoutBoundaryRetirement, true);
  assert.deepEqual(recovery?.laterIntentionKinds, ["speak", "speak"]);
  assert.equal(recovery?.laterSpeechEventIds.length, 2);
  assert.equal(recovery?.laterSilenceCount, 0);
  assert.equal(recovery?.recoveredBySpeech, true);
  assert.equal(recovery?.retiredAfterRecovery, true);
  assert.equal(recovery?.futureOutageCreatedFreshBoundary, true);

  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === firstBoundaryId)?.states,
    ["degraded", "retired"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === secondBoundaryId)?.states,
    ["degraded", "retired"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === futureBoundaryId)?.states,
    ["degraded", "retired"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === retryProtocolId)?.states,
    ["proposed", "retired"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === postResultMemoryId)?.states,
    ["proposed", "contested"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === revisedPostResultMemoryId)?.states,
    ["proposed", "stale", "retired"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === acceptedPostRetirementMemoryId)?.states,
    ["proposed", "accepted"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === postRetirementSideEffectRequestId)?.states,
    ["requested", "denied"],
  );
  assert.deepEqual(
    report.stateTransitions.find((transition) => transition.subjectRef === approvedPostRetirementSideEffectRequestId)?.states,
    ["requested", "approved", "expired"],
  );
  const postResultMemoryCarryover = report.multiArchiveCarryoverRefs.find((entry) => entry.ref === postResultMemoryId);
  assert.deepEqual(postResultMemoryCarryover?.archiveIds, [
    afterPostRetirementMemoryArchiveId,
    afterPostRetirementMemoryRevisionArchiveId,
    afterPostRetirementRevisedMemoryStaleArchiveId,
    afterPostRetirementRevisedMemoryRetiredArchiveId,
    afterPostRetirementFreshMemoryAcceptanceArchiveId,
    afterPostRetirementRepairProposalArchiveId,
    afterPostRetirementRepairDenialArchiveId,
    afterPostRetirementFreshApprovalArchiveId,
    afterPostRetirementRepairExpiryArchiveId,
  ]);
  assert.equal(postResultMemoryCarryover?.subjectType, "memory");
  assert.deepEqual(postResultMemoryCarryover?.states, ["proposed", "contested"]);
  assert.equal(postResultMemoryCarryover?.unresolved, true);

  const revisedPostResultMemoryCarryover = report.multiArchiveCarryoverRefs.find(
    (entry) => entry.ref === revisedPostResultMemoryId,
  );
  assert.deepEqual(revisedPostResultMemoryCarryover?.archiveIds, [
    afterPostRetirementMemoryRevisionArchiveId,
    afterPostRetirementRevisedMemoryStaleArchiveId,
    afterPostRetirementRevisedMemoryRetiredArchiveId,
    afterPostRetirementFreshMemoryAcceptanceArchiveId,
  ]);
  assert.equal(revisedPostResultMemoryCarryover?.subjectType, "memory");
  assert.deepEqual(revisedPostResultMemoryCarryover?.states, ["proposed", "stale", "retired"]);
  assert.equal(revisedPostResultMemoryCarryover?.unresolved, false);

  const expression = report.agentExpression.find((agent) => agent.agentId === "recovering_kimi");
  assert.equal(expression?.intentionCount, 2);
  assert.equal(expression?.speechCount, 2);
  assert.equal(expression?.silenceCount, 0);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "quiet_listener")?.silenceCount, 2);
  assert.equal(report.agentExpression.find((agent) => agent.agentId === "retry_keeper")?.speechCount, 1);
  assert.equal(report.autonomySignals.providerBoundaryCount, 3);
  assert.equal(report.autonomySignals.archiveReviewRequestCount, 1);
  assert.equal(report.autonomySignals.sideEffectRequestCount, 4);
  assert.equal(report.autonomySignals.sideEffectApprovalCount, 2);
  assert.equal(report.autonomySignals.sideEffectDeniedCount, 2);
  assert.equal(report.autonomySignals.sideEffectExpiredCount, 1);

  const afterFailures = report.archives.find((archive) => archive.archiveId === afterFailuresArchiveId);
  assert.equal(afterFailures?.providerBoundaryCount, 2);
  assert.equal(afterFailures?.silenceCount, 1);
  assert.equal(afterFailures?.archiveReviewCount, 1);
  assert.equal(afterFailures?.summaryClaimsConsensus, false);

  const afterReturn = report.archives.find((archive) => archive.archiveId === afterReturnArchiveId);
  assert.equal(afterReturn?.providerBoundaryCount, 1);
  assert.equal(afterReturn?.carriedRefs.includes(firstBoundaryId), true);
  assert.equal(afterReturn?.carriedRefs.includes(secondBoundaryId), true);
  assert.equal(afterReturn?.summaryClaimsConsensus, false);

  const afterRetirement = report.archives.find((archive) => archive.archiveId === afterRetirementArchiveId);
  assert.equal(afterRetirement?.providerBoundaryCount, 1);
  assert.equal(afterRetirement?.carriedRefs.includes(firstBoundaryId), true);
  assert.equal(afterRetirement?.carriedRefs.includes(secondBoundaryId), true);
  assert.equal(afterRetirement?.summaryClaimsConsensus, false);

  const afterFutureOutage = report.archives.find((archive) => archive.archiveId === afterFutureOutageArchiveId);
  assert.equal(afterFutureOutage?.providerBoundaryCount, 2);
  assert.equal(afterFutureOutage?.carriedRefs.includes(firstBoundaryId), true);
  assert.equal(afterFutureOutage?.carriedRefs.includes(secondBoundaryId), true);
  assert.equal(afterFutureOutage?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterFutureOutage?.summaryClaimsConsensus, false);

  const afterChoicePressure = report.archives.find((archive) => archive.archiveId === afterChoicePressureArchiveId);
  assert.equal(afterChoicePressure?.providerBoundaryCount, 2);
  assert.equal(afterChoicePressure?.silenceCount, 1);
  assert.equal(afterChoicePressure?.disagreementCount, 1);
  assert.equal(afterChoicePressure?.openQuestionCount, 1);
  assert.equal(afterChoicePressure?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterChoicePressure?.carriedRefs.includes(sideEffectRequestId), true);
  assert.equal(afterChoicePressure?.carriedRefs.includes("msg_retry_keeper_later_retry"), true);
  assert.equal(afterChoicePressure?.summaryClaimsConsensus, false);

  const sideEffectTransition = report.stateTransitions.find((transition) => transition.subjectRef === sideEffectRequestId);
  assert.equal(sideEffectTransition?.subjectType, "side_effect");
  assert.deepEqual(sideEffectTransition?.states, ["requested", "denied"]);

  const sideEffectCarryover = report.multiArchiveCarryoverRefs.find((entry) => entry.ref === sideEffectRequestId);
  assert.deepEqual(sideEffectCarryover?.archiveIds, [
    afterChoicePressureArchiveId,
    afterRepairDenialArchiveId,
    afterRetryRetirementArchiveId,
    afterNarrowerRepairArchiveId,
    afterNarrowerApprovalArchiveId,
    afterNarrowerResultArchiveId,
  ]);
  assert.equal(sideEffectCarryover?.subjectType, "side_effect");
  assert.deepEqual(sideEffectCarryover?.states, ["requested", "denied"]);
  assert.equal(sideEffectCarryover?.unresolved, false);

  const narrowerSideEffectTransition = report.stateTransitions.find(
    (transition) => transition.subjectRef === narrowerSideEffectRequestId,
  );
  assert.equal(narrowerSideEffectTransition?.subjectType, "side_effect");
  assert.deepEqual(narrowerSideEffectTransition?.states, ["requested", "approved", "completed"]);

  const narrowerSideEffectCarryover = report.multiArchiveCarryoverRefs.find((entry) => entry.ref === narrowerSideEffectRequestId);
  assert.deepEqual(narrowerSideEffectCarryover?.archiveIds, [
    afterNarrowerRepairArchiveId,
    afterNarrowerApprovalArchiveId,
    afterNarrowerResultArchiveId,
    afterPostResultRetirementArchiveId,
  ]);
  assert.equal(narrowerSideEffectCarryover?.subjectType, "side_effect");
  assert.deepEqual(narrowerSideEffectCarryover?.states, ["requested", "approved", "completed"]);
  assert.equal(narrowerSideEffectCarryover?.unresolved, false);

  const afterRepairDenial = report.archives.find((archive) => archive.archiveId === afterRepairDenialArchiveId);
  assert.equal(afterRepairDenial?.providerBoundaryCount, 1);
  assert.equal(afterRepairDenial?.disagreementCount, 1);
  assert.equal(afterRepairDenial?.openQuestionCount, 1);
  assert.equal(afterRepairDenial?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterRepairDenial?.carriedRefs.includes(sideEffectRequestId), true);
  assert.equal(afterRepairDenial?.carriedRefs.includes(retryProtocolId), true);
  assert.equal(afterRepairDenial?.carriedRefs.includes("msg_approval_guard_contests_repair"), true);
  assert.equal(afterRepairDenial?.summaryClaimsConsensus, false);

  const retryProtocolCarryover = report.multiArchiveCarryoverRefs.find((entry) => entry.ref === retryProtocolId);
  assert.deepEqual(retryProtocolCarryover?.archiveIds, [
    afterRepairDenialArchiveId,
    afterRetryRetirementArchiveId,
    afterNarrowerRepairArchiveId,
    afterNarrowerApprovalArchiveId,
    afterNarrowerResultArchiveId,
  ]);
  assert.equal(retryProtocolCarryover?.subjectType, "protocol");
  assert.deepEqual(retryProtocolCarryover?.states, ["proposed", "retired"]);
  assert.equal(retryProtocolCarryover?.unresolved, false);

  const afterRetryRetirement = report.archives.find((archive) => archive.archiveId === afterRetryRetirementArchiveId);
  assert.equal(afterRetryRetirement?.providerBoundaryCount, 1);
  assert.equal(afterRetryRetirement?.disagreementCount, 1);
  assert.equal(afterRetryRetirement?.openQuestionCount, 1);
  assert.equal(afterRetryRetirement?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterRetryRetirement?.carriedRefs.includes(retryProtocolId), true);
  assert.equal(afterRetryRetirement?.carriedRefs.includes(sideEffectRequestId), true);
  assert.equal(afterRetryRetirement?.summaryClaimsConsensus, false);

  const afterNarrowerRepair = report.archives.find((archive) => archive.archiveId === afterNarrowerRepairArchiveId);
  assert.equal(afterNarrowerRepair?.providerBoundaryCount, 1);
  assert.equal(afterNarrowerRepair?.disagreementCount, 1);
  assert.equal(afterNarrowerRepair?.openQuestionCount, 1);
  assert.equal(afterNarrowerRepair?.contestedCount, 1);
  assert.equal(afterNarrowerRepair?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterNarrowerRepair?.carriedRefs.includes(retryProtocolId), true);
  assert.equal(afterNarrowerRepair?.carriedRefs.includes(sideEffectRequestId), true);
  assert.equal(afterNarrowerRepair?.carriedRefs.includes(narrowerSideEffectRequestId), true);
  assert.equal(afterNarrowerRepair?.summaryClaimsConsensus, false);

  const afterNarrowerApproval = report.archives.find((archive) => archive.archiveId === afterNarrowerApprovalArchiveId);
  assert.equal(afterNarrowerApproval?.providerBoundaryCount, 1);
  assert.equal(afterNarrowerApproval?.openQuestionCount, 1);
  assert.equal(afterNarrowerApproval?.contestedCount, 1);
  assert.equal(afterNarrowerApproval?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterNarrowerApproval?.carriedRefs.includes(retryProtocolId), true);
  assert.equal(afterNarrowerApproval?.carriedRefs.includes(sideEffectRequestId), true);
  assert.equal(afterNarrowerApproval?.carriedRefs.includes(narrowerSideEffectRequestId), true);
  assert.equal(afterNarrowerApproval?.summaryClaimsConsensus, false);

  const afterNarrowerResult = report.archives.find((archive) => archive.archiveId === afterNarrowerResultArchiveId);
  assert.equal(afterNarrowerResult?.providerBoundaryCount, 1);
  assert.equal(afterNarrowerResult?.disagreementCount, 1);
  assert.equal(afterNarrowerResult?.openQuestionCount, 1);
  assert.equal(afterNarrowerResult?.contestedCount, 1);
  assert.equal(afterNarrowerResult?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterNarrowerResult?.carriedRefs.includes(retryProtocolId), true);
  assert.equal(afterNarrowerResult?.carriedRefs.includes(sideEffectRequestId), true);
  assert.equal(afterNarrowerResult?.carriedRefs.includes(narrowerSideEffectRequestId), true);
  assert.equal(afterNarrowerResult?.carriedRefs.includes(narrowerSideEffectResultId), true);
  assert.equal(afterNarrowerResult?.summaryClaimsConsensus, false);

  const afterPostResultRetirement = report.archives.find((archive) => archive.archiveId === afterPostResultRetirementArchiveId);
  assert.equal(afterPostResultRetirement?.providerBoundaryCount, 1);
  assert.equal(afterPostResultRetirement?.openQuestionCount, 1);
  assert.equal(afterPostResultRetirement?.contestedCount, 1);
  assert.equal(afterPostResultRetirement?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostResultRetirement?.carriedRefs.includes(narrowerSideEffectRequestId), true);
  assert.equal(afterPostResultRetirement?.carriedRefs.includes(narrowerSideEffectResultId), true);
  assert.equal(afterPostResultRetirement?.summaryClaimsConsensus, false);

  const afterPostRetirementMemory = report.archives.find((archive) => archive.archiveId === afterPostRetirementMemoryArchiveId);
  assert.equal(afterPostRetirementMemory?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementMemory?.disagreementCount, 1);
  assert.equal(afterPostRetirementMemory?.openQuestionCount, 1);
  assert.equal(afterPostRetirementMemory?.contestedCount, 1);
  assert.equal(afterPostRetirementMemory?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementMemory?.carriedRefs.includes(narrowerSideEffectResultId), true);
  assert.equal(afterPostRetirementMemory?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostRetirementMemory?.summaryClaimsConsensus, false);

  const afterPostRetirementMemoryRevision = report.archives.find(
    (archive) => archive.archiveId === afterPostRetirementMemoryRevisionArchiveId,
  );
  assert.equal(afterPostRetirementMemoryRevision?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementMemoryRevision?.disagreementCount, 1);
  assert.equal(afterPostRetirementMemoryRevision?.openQuestionCount, 1);
  assert.equal(afterPostRetirementMemoryRevision?.contestedCount, 1);
  assert.equal(afterPostRetirementMemoryRevision?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementMemoryRevision?.carriedRefs.includes(revisedPostResultMemoryId), true);
  assert.equal(afterPostRetirementMemoryRevision?.carriedRefs.includes(narrowerSideEffectResultId), true);
  assert.equal(afterPostRetirementMemoryRevision?.summaryClaimsConsensus, false);

  const afterPostRetirementRevisedMemoryStale = report.archives.find(
    (archive) => archive.archiveId === afterPostRetirementRevisedMemoryStaleArchiveId,
  );
  assert.equal(afterPostRetirementRevisedMemoryStale?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementRevisedMemoryStale?.disagreementCount, 1);
  assert.equal(afterPostRetirementRevisedMemoryStale?.openQuestionCount, 1);
  assert.equal(afterPostRetirementRevisedMemoryStale?.contestedCount, 1);
  assert.equal(afterPostRetirementRevisedMemoryStale?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementRevisedMemoryStale?.carriedRefs.includes(revisedPostResultMemoryId), true);
  assert.equal(afterPostRetirementRevisedMemoryStale?.carriedRefs.includes(narrowerSideEffectResultId), true);
  assert.equal(afterPostRetirementRevisedMemoryStale?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostRetirementRevisedMemoryStale?.summaryClaimsConsensus, false);

  const afterPostRetirementRevisedMemoryRetired = report.archives.find(
    (archive) => archive.archiveId === afterPostRetirementRevisedMemoryRetiredArchiveId,
  );
  assert.equal(afterPostRetirementRevisedMemoryRetired?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementRevisedMemoryRetired?.disagreementCount, 1);
  assert.equal(afterPostRetirementRevisedMemoryRetired?.openQuestionCount, 1);
  assert.equal(afterPostRetirementRevisedMemoryRetired?.contestedCount, 1);
  assert.equal(afterPostRetirementRevisedMemoryRetired?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementRevisedMemoryRetired?.carriedRefs.includes(revisedPostResultMemoryId), true);
  assert.equal(afterPostRetirementRevisedMemoryRetired?.carriedRefs.includes(narrowerSideEffectResultId), true);
  assert.equal(afterPostRetirementRevisedMemoryRetired?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostRetirementRevisedMemoryRetired?.summaryClaimsConsensus, false);

  const afterPostRetirementFreshMemoryAcceptance = report.archives.find(
    (archive) => archive.archiveId === afterPostRetirementFreshMemoryAcceptanceArchiveId,
  );
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.disagreementCount, 1);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.openQuestionCount, 1);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.contestedCount, 1);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.carriedRefs.includes(revisedPostResultMemoryId), true);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.carriedRefs.includes(acceptedPostRetirementMemoryId), true);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.carriedRefs.includes(secondRecoverySpeechId), true);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostRetirementFreshMemoryAcceptance?.summaryClaimsConsensus, false);

  const afterPostRetirementRepairProposal = report.archives.find(
    (archive) => archive.archiveId === afterPostRetirementRepairProposalArchiveId,
  );
  assert.equal(afterPostRetirementRepairProposal?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementRepairProposal?.disagreementCount, 1);
  assert.equal(afterPostRetirementRepairProposal?.openQuestionCount, 1);
  assert.equal(afterPostRetirementRepairProposal?.contestedCount, 1);
  assert.equal(afterPostRetirementRepairProposal?.carriedRefs.includes(postRetirementSideEffectRequestId), true);
  assert.equal(afterPostRetirementRepairProposal?.carriedRefs.includes(acceptedPostRetirementMemoryId), true);
  assert.equal(afterPostRetirementRepairProposal?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementRepairProposal?.carriedRefs.includes(narrowerSideEffectResultId), true);
  assert.equal(afterPostRetirementRepairProposal?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostRetirementRepairProposal?.summaryClaimsConsensus, false);

  const postRetirementSideEffectCarryover = report.multiArchiveCarryoverRefs.find(
    (entry) => entry.ref === postRetirementSideEffectRequestId,
  );
  assert.deepEqual(postRetirementSideEffectCarryover?.archiveIds, [
    afterPostRetirementRepairProposalArchiveId,
    afterPostRetirementRepairDenialArchiveId,
    afterPostRetirementFreshApprovalArchiveId,
    afterPostRetirementRepairExpiryArchiveId,
  ]);
  assert.equal(postRetirementSideEffectCarryover?.subjectType, "side_effect");
  assert.deepEqual(postRetirementSideEffectCarryover?.states, ["requested", "denied"]);
  assert.equal(postRetirementSideEffectCarryover?.unresolved, false);

  const afterPostRetirementRepairDenial = report.archives.find(
    (archive) => archive.archiveId === afterPostRetirementRepairDenialArchiveId,
  );
  assert.equal(afterPostRetirementRepairDenial?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementRepairDenial?.disagreementCount, 1);
  assert.equal(afterPostRetirementRepairDenial?.openQuestionCount, 1);
  assert.equal(afterPostRetirementRepairDenial?.contestedCount, 1);
  assert.equal(afterPostRetirementRepairDenial?.carriedRefs.includes(postRetirementSideEffectRequestId), true);
  assert.equal(afterPostRetirementRepairDenial?.carriedRefs.includes("msg_approval_guard_denies_post_retirement_recheck"), true);
  assert.equal(afterPostRetirementRepairDenial?.carriedRefs.includes(acceptedPostRetirementMemoryId), true);
  assert.equal(afterPostRetirementRepairDenial?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementRepairDenial?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostRetirementRepairDenial?.summaryClaimsConsensus, false);

  const afterPostRetirementFreshApproval = report.archives.find(
    (archive) => archive.archiveId === afterPostRetirementFreshApprovalArchiveId,
  );
  assert.equal(afterPostRetirementFreshApproval?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementFreshApproval?.disagreementCount, 1);
  assert.equal(afterPostRetirementFreshApproval?.openQuestionCount, 1);
  assert.equal(afterPostRetirementFreshApproval?.contestedCount, 1);
  assert.equal(afterPostRetirementFreshApproval?.carriedRefs.includes(approvedPostRetirementSideEffectRequestId), true);
  assert.equal(afterPostRetirementFreshApproval?.carriedRefs.includes(postRetirementSideEffectRequestId), true);
  assert.equal(afterPostRetirementFreshApproval?.carriedRefs.includes("msg_approval_guard_approves_fresh_post_retirement_snapshot"), true);
  assert.equal(afterPostRetirementFreshApproval?.carriedRefs.includes(acceptedPostRetirementMemoryId), true);
  assert.equal(afterPostRetirementFreshApproval?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementFreshApproval?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostRetirementFreshApproval?.summaryClaimsConsensus, false);

  const approvedPostRetirementSideEffectCarryover = report.multiArchiveCarryoverRefs.find(
    (entry) => entry.ref === approvedPostRetirementSideEffectRequestId,
  );
  assert.deepEqual(approvedPostRetirementSideEffectCarryover?.archiveIds, [
    afterPostRetirementFreshApprovalArchiveId,
    afterPostRetirementRepairExpiryArchiveId,
  ]);
  assert.equal(approvedPostRetirementSideEffectCarryover?.subjectType, "side_effect");
  assert.deepEqual(approvedPostRetirementSideEffectCarryover?.states, ["requested", "approved", "expired"]);
  assert.equal(approvedPostRetirementSideEffectCarryover?.unresolved, false);

  const afterPostRetirementRepairExpiry = report.archives.find(
    (archive) => archive.archiveId === afterPostRetirementRepairExpiryArchiveId,
  );
  assert.equal(afterPostRetirementRepairExpiry?.providerBoundaryCount, 1);
  assert.equal(afterPostRetirementRepairExpiry?.disagreementCount, 1);
  assert.equal(afterPostRetirementRepairExpiry?.openQuestionCount, 1);
  assert.equal(afterPostRetirementRepairExpiry?.contestedCount, 1);
  assert.equal(afterPostRetirementRepairExpiry?.carriedRefs.includes(approvedPostRetirementSideEffectRequestId), true);
  assert.equal(afterPostRetirementRepairExpiry?.carriedRefs.includes(postRetirementSideEffectRequestId), true);
  assert.equal(afterPostRetirementRepairExpiry?.carriedRefs.includes("msg_approval_guard_expires_fresh_post_retirement_snapshot"), true);
  assert.equal(afterPostRetirementRepairExpiry?.carriedRefs.includes(acceptedPostRetirementMemoryId), true);
  assert.equal(afterPostRetirementRepairExpiry?.carriedRefs.includes(postResultMemoryId), true);
  assert.equal(afterPostRetirementRepairExpiry?.carriedRefs.includes(futureBoundaryId), true);
  assert.equal(afterPostRetirementRepairExpiry?.summaryClaimsConsensus, false);
});

test("side-effect approval assertion fails without approval", () => {
  const fixture: ScenarioFixture = {
    scenario_id: "side_effect_without_approval",
    initial_room: {
      room_id: "room_species",
      date: "2026-06-17",
    },
    agents: [{ agent_id: "operator", capabilities: ["shell"] }],
    topics: [{ topic_id: "topic_action", status: "active" }],
    messages: [
      {
        message_id: "msg_001",
        author: "user",
        authorKind: "user",
        topic_id: "topic_action",
        content: "Run the test suite.",
      },
    ],
    scripted_intentions: {
      operator: [
        {
          type: "request_side_effect",
          reason: "Tests require shell execution.",
          context_refs: ["msg_001"],
          request: {
            requestId: "sidefx_001",
            kind: "shell.exec",
            reason: "Run tests only after explicit approval.",
            target: "npm test",
            expectedImpact: "Execute the project test suite.",
            contextRefs: ["msg_001"],
          },
        },
      ],
    },
  };

  const run = runScenarioFixture(fixture);
  expectOk(assertEventExists(run.events, "side_effect.requested", (event) => payload(event).requestId === "sidefx_001"));
  expectFail(assertSideEffectHasApproval(run.events, "sidefx_001"));
});
