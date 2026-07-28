import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RoomLedger } from "../src/kernel/ledger";
import { SpeciesRoomRuntime, selectContextAuditFragmentsForSummary } from "../src/server/runtime";
import type { AgentSmokeReport } from "../src/agents/smoke";
import type { ContextFragment, MessageCreatedPayload, RoomEvent } from "../src/types";

test("context audit summary keeps social lineage fragments past the first page", () => {
  const leadingFragments = Array.from({ length: 14 }, (_, index) =>
    runtimeContextFragment(`recent_message:msg_audit_${index}`, "recent_message", [`msg_audit_${index}`]),
  );
  const socialLineageFragments = [
    runtimeContextFragment("mixed_review_pressure:mixed_review_audit", "mixed_review_pressure", ["mixed_review:audit"]),
    runtimeContextFragment("open_question:question_audit", "open_question", ["question_audit"]),
    runtimeContextFragment("protocol_proposal:protocol_audit", "protocol_proposal", ["protocol_audit"]),
    runtimeContextFragment("handoff_packet:handoff_audit", "handoff_packet", ["handoff_audit"]),
    runtimeContextFragment("invitation_packet:invitation_audit", "invitation_packet", ["invitation_audit"]),
    runtimeContextFragment("topic_rule:topic_proposal_audit", "topic_rule", ["topic_proposal_audit"]),
    runtimeContextFragment("side_effect_boundary:sidefx_audit", "side_effect_boundary", ["sidefx_audit"]),
    runtimeContextFragment("workspace_artifact_ref:workspace_audit", "workspace_artifact_ref", ["workspace_audit"]),
    runtimeContextFragment("skill_capsule_ref:skill_audit", "skill_capsule_ref", ["skill_audit"]),
    runtimeContextFragment("capability_ref:capability_audit", "capability_ref", ["capability_audit"]),
  ];

  const selected = selectContextAuditFragmentsForSummary([...leadingFragments, ...socialLineageFragments]);
  const selectedTypes = new Set(selected.map((fragment) => fragment.type));

  assert.equal(selected.length > 12, true);
  assert.equal(selectedTypes.has("mixed_review_pressure"), true);
  assert.equal(selectedTypes.has("open_question"), true);
  assert.equal(selectedTypes.has("protocol_proposal"), true);
  assert.equal(selectedTypes.has("handoff_packet"), true);
  assert.equal(selectedTypes.has("invitation_packet"), true);
  assert.equal(selectedTypes.has("topic_rule"), true);
  assert.equal(selectedTypes.has("side_effect_boundary"), true);
  assert.equal(selectedTypes.has("workspace_artifact_ref"), true);
  assert.equal(selectedTypes.has("skill_capsule_ref"), true);
  assert.equal(selectedTypes.has("capability_ref"), true);
});

test("room runtime exposes configured YOLO spaces as ready settings state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-yolo-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      yoloSpaces: [
        {
          id: "test-workshop",
          label: "Test Workshop",
          root: dir,
          repository: "https://example.test/test-workshop",
          enabled: true,
          allowedAgents: ["*"],
        },
      ],
    });

    const state = await runtime.getState();
    assert.equal(state.yoloSpaces.length, 1);
    assert.equal(state.yoloSpaces[0]?.id, "test-workshop");
    assert.equal(state.yoloSpaces[0]?.status, "ready");
    assert.equal(state.yoloSpaces[0]?.root, path.resolve(dir));
    assert.equal(metricValue(state.metrics, "ready YOLO spaces"), "1");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime posts user messages through ledger, wake policy, and agent intentions", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
    });

    const initial = await runtime.getState();
    assert.equal(initial.connected, true);
    assert.equal(initial.messages.at(-1)?.displayName, "Room Kernel");
    assert.equal(metricValue(initial.metrics, "room messages"), "0");
    assert.deepEqual(initial.topics, []);
    assert.equal(initial.activeTopicId, undefined);
    assert.deepEqual(initial.contextAudits, []);
    assert.deepEqual(initial.socialState.memoryClaims, []);
    assert.deepEqual(initial.socialState.memoryReviews, []);
    assert.deepEqual(initial.socialState.protocolReviews, []);
    assert.deepEqual(initial.socialState.handoffReviews, []);
    assert.deepEqual(initial.socialState.personaDeltaReviews, []);
    assert.deepEqual(initial.socialState.topicProposalReviews, []);
    assert.deepEqual(initial.socialState.mixedReviewPressures, []);
    assert.deepEqual(initial.socialState.openQuestions, []);
    assert.deepEqual(initial.socialState.memoryPressureBoundaries, []);
    assert.deepEqual(initial.socialState.topicProposals, []);
    assert.deepEqual(initial.socialState.protocols, []);
    assert.deepEqual(initial.socialState.sideEffects, []);
    assert.deepEqual(initial.socialState.skillCapsuleReviews, []);
    assert.deepEqual(initial.socialState.capabilityReviews, []);
    assert.deepEqual(initial.socialState.handoffs, []);
    assert.deepEqual(initial.socialState.invitations, []);
    assert.deepEqual(initial.socialState.silences, []);
    assert.deepEqual(initial.socialState.pressureBoundaries, []);
    assert.deepEqual(initial.socialState.archives, []);
    assert.deepEqual(initial.socialState.archiveReviews, []);
    assert.equal(initial.socialState.workspaces.length, 6);
    assert.equal(initial.socialState.workspaces.every((workspace) => workspace.visibility === "private"), true);
    assert.equal(
      initial.socialState.workspaces.every((workspace) => workspace.boundaryNote.includes("do not enter public memory")),
      true,
    );
    assert.equal(initial.socialState.skillCapsules.length, 6);
    assert.equal(initial.socialState.skillCapsules.every((skill) => skill.status === "registered"), true);
    assert.equal(initial.socialState.skillCapsules.every((skill) => skill.boundaryNote.includes("cannot execute")), true);
    assert.equal(initial.agents.length, 6);
    assert.equal(initial.agents.every((agent) => agent.mode === "smoke_ready"), true);

    const result = await runtime.postUserMessage({
      content: "这条消息应该进入内部房间，而不是只改前端数组。",
      clientMessageId: "client_runtime_test",
    });

    assert.equal(result.turn.invitedAgents.length, 6);
    assert.equal(result.activeTopicId, result.turn.topicId);
    assert.equal(result.topics[0]?.topicId, result.turn.topicId);
    assert.equal(result.topics[0]?.status, "active");
    assert.equal(result.topics[0]?.messageCount >= 1, true);
    assert.match(result.topics[0]?.boundaryNote ?? "", /not a forced routing command/);
    assert.deepEqual(result.turn.intentionKinds, seedAgentIds().map(() => "speak"));
    assert.equal(result.turn.visibleMessageEventIds.length, 4);
    assert.equal(result.messages.some((message) => message.text.includes("只改前端数组")), true);
    assert.equal(result.messages.filter((message) => message.kind === "agent").length, 4);
    assert.equal(metricValue(result.metrics, "room messages"), "5");
    assert.equal(result.contextAudits.length, 6);
    assert.equal(result.contextAudits.every((audit) => audit.selectedCount > 0), true);
    assert.equal(result.contextAudits.every((audit) => audit.totalTokenEstimate > 0), true);
    assert.equal(result.contextAudits.some((audit) => audit.cacheKey.includes("persona_projection:")), true);
    assert.equal(result.contextAudits.every((audit) => Object.keys(audit.selectedByType).length > 0), true);
    assert.equal(result.contextAudits.every((audit) => audit.omittedByReason && typeof audit.omittedByReason === "object"), true);
    assert.equal(result.contextAudits.every((audit) => audit.selectedFragments.length > 0), true);
    assert.equal(result.contextAudits.every((audit) => audit.auditBoundaryNote.includes("fragment bodies stay")), true);
    assert.equal(
      result.contextAudits.every((audit) => audit.selectedFragments.every((fragment) => !("body" in fragment))),
      true,
    );

    const events = await runtime.rawEvents();
    assert.equal(events.some((event) => event.event_type === "wake.candidates_selected"), true);
    assert.equal(events.filter((event) => event.event_type === "agent.intention_recorded").length, 6);

    const mentionResult = await runtime.postUserMessage({
      content: "结构化 mention 应该进入 ledger 并影响 wake routing。",
      clientMessageId: "client_runtime_mention",
      mentions: ["mimo_member_01", "missing_agent", "mimo_member_01"],
    });
    assert.deepEqual(mentionResult.turn.invitedAgents, ["mimo_member_01"]);
    assert.deepEqual(mentionResult.turn.intentionKinds, ["speak"]);
    const projectedMention = mentionResult.messages.find((message) => message.text.includes("结构化 mention"));
    assert.deepEqual(projectedMention?.mentions, ["mimo_member_01"]);

    const mentionEvents = await runtime.rawEvents();
    const mentionMessage = mentionEvents.find(
      (event): event is RoomEvent<MessageCreatedPayload> =>
        event.event_type === "message.created" &&
        typeof (event.payload as MessageCreatedPayload).content === "string" &&
        (event.payload as MessageCreatedPayload).content.includes("结构化 mention"),
    );
    assert.deepEqual(mentionMessage?.payload.mentions, ["mimo_member_01"]);
    const mentionWake = mentionEvents.find(
      (event) => event.event_type === "wake.candidates_selected" && event.refs.includes(mentionMessage?.event_id ?? ""),
    );
    const candidates = (mentionWake?.payload as { candidates?: { agentId: string; reasons: string[] }[] }).candidates ?? [];
    assert.equal(candidates[0]?.agentId, "mimo_member_01");
    assert.equal(candidates[0]?.reasons.includes("mentioned"), true);
    const mentionMessageEventId = mentionMessage?.event_id;
    assert.ok(mentionMessageEventId);

    const referenced = await runtime.postUserMessage({
      content: "这条消息应该带着前端选择的 context ref 进入 ledger。",
      clientMessageId: "client_runtime_context_ref",
      contextRefs: [mentionMessageEventId],
    });
    const projectedReference = referenced.messages.find((message) => message.text.includes("前端选择的 context ref"));
    assert.deepEqual(projectedReference?.contextRefs, [mentionMessageEventId]);
    const referenceEvents = await runtime.rawEvents();
    const referenceMessage = referenceEvents.find(
      (event): event is RoomEvent<MessageCreatedPayload> =>
        event.event_type === "message.created" &&
        typeof (event.payload as MessageCreatedPayload).content === "string" &&
        (event.payload as MessageCreatedPayload).content.includes("前端选择的 context ref"),
    );
    assert.deepEqual(referenceMessage?.payload.contextRefs, [mentionMessageEventId]);

    const topicReference = await runtime.postUserMessage({
      content: "这条消息把一个 topic chip 作为 context ref 带回房间，但不要求系统切换话题。",
      clientMessageId: "client_runtime_topic_ref",
      contextRefs: [result.turn.topicId],
    });
    const referencedTopic = topicReference.topics.find((topic) => topic.topicId === result.turn.topicId);
    assert.equal((referencedTopic?.revivalCount ?? 0) >= 1, true);
    assert.equal(referencedTopic?.lastRevivedFromTopicId, topicReference.turn.topicId);
    assert.match(referencedTopic?.boundaryNote ?? "", /not a forced routing command/);
    assert.equal(
      topicReference.contextAudits.some((audit) =>
        audit.selectedFragments.some((fragment) => fragment.type === "topic_rule" && fragment.refs.includes(result.turn.topicId)),
      ),
      true,
    );

    const archiveResult = await runtime.createDailyArchive({
      date: "2026-06-18",
      timezone: "Asia/Shanghai",
    });
    assert.equal(archiveResult.archive.compressionNote, "archive_is_compression_not_consensus");
    assert.equal(archiveResult.archive.workspaceBoundaries.length, 6);
    assert.equal(archiveResult.archive.skillCapsules.length, 6);
    assert.equal(
      archiveResult.archive.workspaceBoundaries.every((boundary) => !("privateHome" in boundary)),
      true,
    );
    assert.equal(
      archiveResult.archive.skillCapsules.every((capsule) => capsule.boundaryNote.includes("cannot execute")),
      true,
    );
    assert.equal(archiveResult.metrics.some(([value, label]) => value === "1" && label === "daily archives"), true);
    assert.equal(archiveResult.socialState.archives.length, 1);
    assert.equal(archiveResult.socialState.archives[0]?.compressionNote, "archive_is_compression_not_consensus");
    assert.equal(archiveResult.socialState.archives[0]?.workspaceBoundaryCount, 6);
    assert.equal(archiveResult.socialState.archives[0]?.skillCapsuleCount, 6);
    assert.equal((await runtime.rawEvents()).some((event) => event.event_type === "daily_archive.created"), true);
    assert.equal(archiveResult.socialState.archiveReviews.length, 1);
    assert.equal(archiveResult.socialState.archiveReviews[0]?.kind, "review_request");
    assert.equal(archiveResult.socialState.archiveReviews[0]?.archiveRef, archiveResult.archive.archiveId);
    assert.match(archiveResult.socialState.archiveReviews[0]?.boundaryNote ?? "", /not a command/);

    const secondMessage = await runtime.postUserMessage({
      content: "同一天后续消息也应该能刷新 daily archive 投影。",
      clientMessageId: "client_runtime_archive_refresh",
    });
    const refreshedArchive = await runtime.createDailyArchive({
      date: "2026-06-18",
      timezone: "Asia/Shanghai",
    });
    assert.equal(refreshedArchive.archive.inputLedgerRange.toOffset > archiveResult.archive.inputLedgerRange.toOffset, true);
    assert.equal(refreshedArchive.socialState.archives.length, 1);
    assert.equal(
      refreshedArchive.socialState.archives[0]?.eventCount,
      refreshedArchive.archive.inputLedgerRange.toOffset + 1,
    );
    assert.equal(secondMessage.turn.triggeringMessageEventId.length > 0, true);
    assert.equal((await runtime.rawEvents()).filter((event) => event.event_type === "daily_archive.created").length, 2);
    assert.equal((await runtime.rawEvents()).filter((event) => event.event_type === "archive.review_requested").length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime exposes a ledger-derived living timeline for observable room surfaces", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-timeline-"));
  try {
    const ledgerPath = path.join(dir, "room-ledger.jsonl");
    const runtime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
    });
    await runtime.getState();

    let sequence = 0;
    const ledger = new RoomLedger({
      filePath: ledgerPath,
      now: () => `2026-06-21T12:00:0${Math.min(sequence, 9)}.000Z`,
      idFactory: (prefix) => `${prefix}_timeline_${++sequence}`,
    });
    const messageEvent = await appendTimelineEvent(ledger, {
      eventType: "message.created",
      actor: { kind: "user", id: "user" },
      payload: {
        messageId: "msg_timeline_seed",
        author: "user",
        authorKind: "user",
        mentions: [],
        contextRefs: [],
        content: "timeline should show this as room-visible evidence",
      },
      refs: [],
      idempotencyKey: "timeline_message",
    });
    const memoryRef = "memory_timeline_contested";
    await appendTimelineEvent(ledger, {
      eventType: "memory.proposed",
      actor: { kind: "agent", id: "kimi_member_01" },
      payload: {
        memoryId: memoryRef,
        summary: "Timeline memory can remain contestable.",
        sourceRefs: [messageEvent.event_id],
      },
      refs: [messageEvent.event_id],
      idempotencyKey: "timeline_memory_proposed",
    });
    await appendTimelineEvent(ledger, {
      eventType: "memory.contested",
      actor: { kind: "agent", id: "mimo_member_01" },
      payload: {
        memoryId: memoryRef,
        reason: "The claim needs another source before becoming sediment.",
        sourceRefs: [messageEvent.event_id],
      },
      refs: [memoryRef, messageEvent.event_id],
      idempotencyKey: "timeline_memory_contested",
    });
    const questionRef = "question_timeline_open";
    await appendTimelineEvent(ledger, {
      eventType: "topic.updated",
      actor: { kind: "agent", id: "kimi_member_01" },
      payload: {
        topicId: "topic_timeline",
        messageId: "msg_timeline_question",
        openQuestion: "Which uncertainty should remain visible for the room?",
        openQuestionRef: questionRef,
        raisedBy: "kimi_member_01",
        sourceMessageId: messageEvent.event_id,
        contextRefs: [messageEvent.event_id],
        boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer",
      },
      refs: [messageEvent.event_id],
      idempotencyKey: "timeline_open_question",
    });
    const protocolRef = "protocol_timeline_reviewed";
    const protocolReviewRef = "protocol_review_timeline";
    await appendTimelineEvent(ledger, {
      eventType: "protocol.reviewed",
      actor: { kind: "agent", id: "mimo_member_01" },
      payload: {
        reviewId: protocolReviewRef,
        protocolRef,
        protocolId: protocolRef,
        topicId: "topic_timeline",
        agentId: "mimo_member_01",
        response: "cautioned",
        summary: "Timeline protocol reviews should stay visible without activating etiquette.",
        contextRefs: [protocolRef, messageEvent.event_id],
        boundaryNote:
          "protocol review is a social trace; it does not accept, reject, challenge, revise, retire, or activate etiquette",
      },
      refs: [protocolRef, messageEvent.event_id],
      idempotencyKey: "timeline_protocol_reviewed",
    });
    const topicProposalRef = "topic_proposal_timeline_reviewed";
    const topicReviewRef = "topic_review_timeline";
    await appendTimelineEvent(ledger, {
      eventType: "topic.reviewed",
      actor: { kind: "agent", id: "mimo_member_02" },
      payload: {
        reviewId: topicReviewRef,
        topicProposalRef,
        proposalId: topicProposalRef,
        topicId: "topic_timeline",
        agentId: "mimo_member_02",
        response: "cautioned",
        summary: "Timeline topic proposal reviews should remain visible without moving the active topic.",
        contextRefs: [topicProposalRef, messageEvent.event_id],
        boundaryNote: "topic suggestion review is a social trace; it does not apply or move the active topic",
      },
      refs: [topicProposalRef, messageEvent.event_id],
      idempotencyKey: "timeline_topic_reviewed",
    });
    const sideEffectRef = "sidefx_timeline_reviewed";
    const sideEffectReviewRef = "side_effect_review_timeline";
    await appendTimelineEvent(ledger, {
      eventType: "side_effect.reviewed",
      actor: { kind: "agent", id: "mimo_member_03" },
      payload: {
        reviewId: sideEffectReviewRef,
        sideEffectRef,
        requestId: sideEffectRef,
        topicId: "topic_timeline",
        agentId: "mimo_member_03",
        response: "cautioned",
        summary: "Timeline side-effect reviews should stay social without granting permission.",
        contextRefs: [sideEffectRef, messageEvent.event_id],
        boundaryNote:
          "side-effect review is a social trace; it does not approve, deny, expire, execute, report a result, or mutate external state",
      },
      refs: [sideEffectRef, messageEvent.event_id],
      idempotencyKey: "timeline_side_effect_reviewed",
    });
    const artifactRef = "artifact_timeline_reviewed";
    const artifactReviewRef = "workspace_artifact_review_timeline";
    await appendTimelineEvent(ledger, {
      eventType: "workspace.artifact_reviewed",
      actor: { kind: "agent", id: "mimo_member_04" },
      payload: {
        reviewId: artifactReviewRef,
        artifactRef,
        artifactId: artifactRef,
        topicId: "topic_timeline",
        agentId: "mimo_member_04",
        response: "cautioned",
        summary: "Timeline workspace reviews should stay as artifact discussion, not public memory.",
        contextRefs: [artifactRef, messageEvent.event_id],
      },
      refs: [artifactRef, messageEvent.event_id],
      idempotencyKey: "timeline_workspace_artifact_reviewed",
    });
    const skillRef = "skill_timeline_reviewed";
    const skillReviewRef = "skill_capsule_review_timeline";
    await appendTimelineEvent(ledger, {
      eventType: "skill.capsule_reviewed",
      actor: { kind: "agent", id: "mimo_member_05" },
      payload: {
        reviewId: skillReviewRef,
        capsuleRef: skillRef,
        capsuleId: skillRef,
        topicId: "topic_timeline",
        agentId: "mimo_member_05",
        response: "cautioned",
        summary: "Timeline skill reviews should not execute tools or assign roles.",
        contextRefs: [skillRef, messageEvent.event_id],
      },
      refs: [skillRef, messageEvent.event_id],
      idempotencyKey: "timeline_skill_capsule_reviewed",
    });
    const capabilityRef = "capability_timeline_reviewed";
    const capabilityReviewRef = "capability_review_timeline";
    await appendTimelineEvent(ledger, {
      eventType: "capability.reviewed",
      actor: { kind: "agent", id: "mimo_member_06" },
      payload: {
        reviewId: capabilityReviewRef,
        capabilityRef,
        capabilityId: capabilityRef,
        topicId: "topic_timeline",
        agentId: "mimo_member_06",
        response: "cautioned",
        summary: "Timeline capability reviews should stay weak routing discussion.",
        contextRefs: [capabilityRef, messageEvent.event_id],
      },
      refs: [capabilityRef, messageEvent.event_id],
      idempotencyKey: "timeline_capability_reviewed",
    });
    const deltaRef = "persona_delta_timeline_daily_mood";
    await appendTimelineEvent(ledger, {
      eventType: "persona_delta.proposed",
      actor: { kind: "agent", id: "kimi_member_01" },
      payload: {
        deltaId: deltaRef,
        agentId: "kimi_member_01",
        proposedChange: { field: "dailyMood", operation: "set", value: "careful and quiet" },
        reason: "Room-visible continuity should be reversible.",
        evidenceRefs: [messageEvent.event_id],
      },
      refs: [messageEvent.event_id],
      idempotencyKey: "timeline_persona_delta",
    });
    await appendTimelineEvent(ledger, {
      eventType: "agent.provider_degraded",
      actor: { kind: "system", id: "runtime" },
      payload: {
        agentId: "kimi_member_02",
        boundaryNote: "provider degradation is not agent silence",
        diagnostic: "masked",
        sourceRefs: [messageEvent.event_id],
      },
      refs: [messageEvent.event_id],
      idempotencyKey: "timeline_provider_boundary",
    });
    const archiveRef = "archive_timeline_2026_06_21";
    await appendTimelineEvent(ledger, {
      eventType: "daily_archive.created",
      actor: { kind: "system", id: "archive_worker" },
      payload: {
        archiveId: archiveRef,
        date: "2026-06-21",
        summary: "Timeline archive is a time skeleton.",
        archive: {
          archiveId: archiveRef,
          date: "2026-06-21",
          summary: "Timeline archive is a time skeleton.",
        },
      },
      refs: [messageEvent.event_id, memoryRef, deltaRef],
      idempotencyKey: "timeline_archive",
    });

    const state = await runtime.getState();
    const categories = new Set(state.timeline.map((entry) => entry.category));
    assert.equal(categories.has("message"), true);
    assert.equal(categories.has("archive"), true);
    assert.equal(categories.has("memory_contest"), true);
    assert.equal(categories.has("agent_continuity"), true);
    assert.equal(categories.has("provider_boundary"), true);
    assert.equal(categories.has("social_loop"), true);
    assert.equal(state.timeline.every((entry) => entry.evidenceRefs.includes(entry.eventId)), true);
    assert.equal(
      state.timeline.some(
        (entry) =>
          entry.category === "memory_contest" &&
          entry.refs.includes(memoryRef) &&
          /contestable|contested|reviewable/.test(entry.boundaryNote),
      ),
      true,
    );
    const continuity = state.timeline.find((entry) => entry.category === "agent_continuity");
    assert.ok(continuity);
    assert.match(continuity.title, /daily mood/);
    assert.equal(continuity.refs.includes(deltaRef), true);
    const question = state.timeline.find((entry) => entry.refs.includes(questionRef));
    assert.ok(question);
    assert.equal(question.category, "social_loop");
    assert.equal(question.title, "Open question raised");
    assert.match(question.detail, /uncertainty/);
    assert.equal(question.refs.includes(messageEvent.event_id), true);
    assert.match(question.boundaryNote, /not a demand/);
    const protocolReview = state.timeline.find((entry) => entry.refs.includes(protocolReviewRef));
    assert.ok(protocolReview);
    assert.equal(protocolReview.category, "social_loop");
    assert.equal(protocolReview.title, "Protocol reviewed");
    assert.match(protocolReview.detail, /stay visible/);
    assert.equal(protocolReview.refs.includes(protocolRef), true);
    assert.equal(protocolReview.refs.includes(messageEvent.event_id), true);
    assert.match(protocolReview.boundaryNote, /optional room pressure/);
    const topicReview = state.timeline.find((entry) => entry.refs.includes(topicReviewRef));
    assert.ok(topicReview);
    assert.equal(topicReview.category, "social_loop");
    assert.equal(topicReview.title, "Topic proposal reviewed");
    assert.match(topicReview.detail, /without moving/);
    assert.equal(topicReview.refs.includes(topicProposalRef), true);
    assert.equal(topicReview.refs.includes(messageEvent.event_id), true);
    assert.match(topicReview.boundaryNote, /optional room pressure/);
    const sideEffectReview = state.timeline.find((entry) => entry.refs.includes(sideEffectReviewRef));
    assert.ok(sideEffectReview);
    assert.equal(sideEffectReview.category, "social_loop");
    assert.equal(sideEffectReview.title, "Side-effect request reviewed");
    assert.match(sideEffectReview.detail, /without granting permission/);
    assert.equal(sideEffectReview.refs.includes(sideEffectRef), true);
    assert.match(sideEffectReview.boundaryNote, /optional room pressure/);
    const workspaceReview = state.timeline.find((entry) => entry.refs.includes(artifactReviewRef));
    assert.ok(workspaceReview);
    assert.equal(workspaceReview.category, "social_loop");
    assert.equal(workspaceReview.title, "Workspace artifact reviewed");
    assert.equal(workspaceReview.refs.includes(artifactRef), true);
    const skillReview = state.timeline.find((entry) => entry.refs.includes(skillReviewRef));
    assert.ok(skillReview);
    assert.equal(skillReview.category, "social_loop");
    assert.equal(skillReview.title, "Skill capsule reviewed");
    assert.equal(skillReview.refs.includes(skillRef), true);
    const capabilityReview = state.timeline.find((entry) => entry.refs.includes(capabilityReviewRef));
    assert.ok(capabilityReview);
    assert.equal(capabilityReview.category, "social_loop");
    assert.equal(capabilityReview.title, "Capability hint reviewed");
    assert.equal(capabilityReview.refs.includes(capabilityRef), true);
    const provider = state.timeline.find((entry) => entry.category === "provider_boundary");
    assert.ok(provider);
    assert.equal(provider.detail.includes("masked"), false);
    assert.match(provider.boundaryNote, /not agent silence/);
    const archive = state.timeline.find((entry) => entry.category === "archive");
    assert.ok(archive);
    assert.equal(archive.refs.includes(archiveRef), true);
    assert.match(archive.boundaryNote, /not consensus/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects agent-agent social events as visible ledger messages", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-social-"));
  try {
    let mimoSawInvitationPacket = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () =>
          JSON.stringify({
            kind: "invite_other",
            agentId: "mimo_member_01",
            reason: "MiMo may accept or stay silent.",
            contextRefs: [],
          }),
        mimoInvoker: async (request) => {
          mimoSawInvitationPacket =
            request.packet.contextFragments?.some(
              (fragment) =>
                fragment.type === "invitation_packet" &&
                fragment.body.includes("social knock") &&
                fragment.body.includes("mimo_member_01"),
            ) ?? false;
          return JSON.stringify({
            kind: "respond_invitation",
            invitationRef: request.packet.invitationId,
            response: "challenge",
            reason: "The invitation is welcome, but I need a narrower trust boundary.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
      },
    });

    const result = await runtime.postUserMessage({
      content: "@kimi_member_01 invite exactly one peer.",
      clientMessageId: "client_runtime_social_projection",
      mentions: ["kimi_member_01"],
    });

    assert.deepEqual(result.turn.invitedAgents, ["kimi_member_01"]);
    assert.deepEqual(result.turn.secondaryInvitedAgents, ["mimo_member_01"]);
    assert.equal(result.socialState.invitations.length, 1);
    const invitationRef = result.socialState.invitations[0]?.invitationId ?? "";
    assert.match(invitationRef, /^invite_/);
    const invitationMessage = result.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened a social knock"),
    );
    assert.ok(invitationMessage);
    assert.equal(invitationMessage.text.includes(invitationRef), false);
    assert.equal(invitationMessage.contextRefs.includes(invitationRef), true);
    assert.equal(result.socialState.invitations[0]?.fromAgentId, "kimi_member_01");
    assert.equal(result.socialState.invitations[0]?.toAgentId, "mimo_member_01");
    assert.equal(result.socialState.invitations[0]?.reason, "MiMo may accept or stay silent.");
    assert.equal(result.socialState.invitations[0]?.status, "challenged");
    assert.equal(result.socialState.invitations[0]?.responseCount, 1);
    assert.match(result.socialState.invitations[0]?.responses[0]?.reason ?? "", /narrower trust boundary/);
    assert.match(result.socialState.invitations[0]?.boundaryNote ?? "", /social knock/);
    assert.equal(mimoSawInvitationPacket, true);
    assert.equal(result.messages.filter((message) => message.kind === "agent").length, 0);
    const invitationResponseMessage = result.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("challenge the social knock"),
    );
    assert.ok(invitationResponseMessage);
    assert.equal(invitationResponseMessage.text.includes(invitationRef), false);
    assert.equal(invitationResponseMessage.contextRefs.includes(invitationRef), true);

    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    assert.equal(archived.archive.invitations.length, 1);
    assert.equal(archived.archive.invitations[0]?.invitationId, result.socialState.invitations[0]?.invitationId);
    assert.equal(archived.archive.invitations[0]?.responseCount, 1);
    assert.equal(archived.archive.invitations[0]?.responses[0]?.response, "challenge");
    assert.equal(archived.archive.silences.length, 0);
    assert.equal(archived.socialState.archives[0]?.invitationCount, 1);
    assert.equal(archived.socialState.archives[0]?.silenceCount, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects handoff secondary social knock without leaking technical refs", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-handoff-secondary-knock-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () =>
          JSON.stringify({
            kind: "propose_handoff",
            toAgentId: "mimo_member_01",
            reason: "MiMo can inspect the room boundary without becoming responsible for it.",
            requestedResponse: "Name one risk in the handoff boundary.",
            contextRefs: [],
          }),
        mimoInvoker: async () =>
          JSON.stringify({
            kind: "stay_silent",
            reason: "The secondary knock can remain unanswered.",
          }),
      },
    });

    const result = await runtime.postUserMessage({
      content: "@kimi_member_01 open one handoff proposal.",
      clientMessageId: "client_runtime_handoff_secondary_knock",
      mentions: ["kimi_member_01"],
    });

    assert.deepEqual(result.turn.invitedAgents, ["kimi_member_01"]);
    assert.deepEqual(result.turn.secondaryInvitedAgents, ["mimo_member_01"]);
    assert.equal(result.socialState.handoffs.length, 1);
    assert.equal(result.socialState.invitations.length, 1);
    const handoffRef = result.socialState.handoffs[0]?.handoffId ?? "";
    const invitationRef = result.socialState.invitations[0]?.invitationId ?? "";
    assert.match(handoffRef, /^handoff_/);
    assert.match(invitationRef, /^invite_/);

    const handoffMessage = result.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened a handoff proposal"),
    );
    assert.ok(handoffMessage);
    assert.equal(handoffMessage.text.includes(handoffRef), false);
    assert.equal(handoffMessage.contextRefs.includes(handoffRef), true);

    const invitationMessage = result.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened a social knock"),
    );
    assert.ok(invitationMessage);
    assert.equal(invitationMessage.text.includes(invitationRef), false);
    assert.equal(invitationMessage.text.includes("handoff_proposed"), false);
    assert.equal(invitationMessage.contextRefs.includes(invitationRef), true);
    assert.equal(result.socialState.invitations[0]?.reason, "Name one risk in the handoff boundary.");
    assert.match(result.socialState.invitations[0]?.boundaryNote, /secondary social knock|handoff proposal/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects ordinary invitation review without changing invitation response state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-invitation-review-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () =>
          JSON.stringify({
            kind: "invite_other",
            agentId: "mimo_member_01",
            reason: "MiMo may inspect the invitation as a social object.",
            contextRefs: [],
          }),
        mimoInvoker: async (request) =>
          JSON.stringify({
            kind: "speak",
            content: "This invitation should remain a soft knock; I need a smaller context packet before treating it as useful.",
            contextRefs: [request.packet.invitationId],
          }),
      },
    });

    const result = await runtime.postUserMessage({
      content: "@kimi_member_01 invite one peer, but let them merely discuss the knock.",
      clientMessageId: "client_runtime_invitation_review",
      mentions: ["kimi_member_01"],
    });

    assert.equal(result.socialState.invitations.length, 1);
    const invitationRef = result.socialState.invitations[0]?.invitationId ?? "";
    const reviewRef = result.socialState.invitationReviews[0]?.reviewId ?? "";
    assert.match(invitationRef, /^invite_/);
    assert.match(reviewRef, /^invitation_review_/);
    assert.equal(result.socialState.invitations[0]?.status, "invited");
    assert.equal(result.socialState.invitations[0]?.responseCount, 0);
    assert.equal(result.socialState.invitationReviews.length, 1);
    assert.equal(result.socialState.invitationReviews[0]?.invitationRef, result.socialState.invitations[0]?.invitationId);
    assert.equal(result.socialState.invitationReviews[0]?.response, "cautioned");
    assert.match(result.socialState.invitationReviews[0]?.summary ?? "", /soft knock/);
    assert.match(result.socialState.invitationReviews[0]?.boundaryNote ?? "", /does not accept, reject, challenge, delegate/);
    const invitationReviewMessage = result.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("cautioned the social knock"),
    );
    assert.ok(invitationReviewMessage);
    assert.equal(invitationReviewMessage.text.includes(invitationRef), false);
    assert.equal(invitationReviewMessage.text.includes(reviewRef), false);
    assert.equal(invitationReviewMessage.contextRefs.includes(invitationRef), true);
    assert.equal(invitationReviewMessage.contextRefs.includes(reviewRef), true);
    assert.equal((await runtime.rawEvents()).filter((event) => event.event_type === "agent.invitation_responded").length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects deliberate silence as context without treating provider degradation as silence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-silence-"));
  try {
    let mimoSawSilenceRef = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (request.agent.agentId === "kimi_member_02") {
            throw new Error("provider timed out without agent choice");
          }
          return JSON.stringify({
            kind: "stay_silent",
            reason: "I am listening so the room can hear the named care boundary first.",
          });
        },
        mimoInvoker: async (request) => {
          mimoSawSilenceRef =
            request.packet.contextFragments?.some(
              (fragment) =>
                fragment.type === "silence_ref" &&
                fragment.body.includes("agent expression") &&
                fragment.body.includes("kimi_member_01"),
            ) ?? false;
          return JSON.stringify({ kind: "stay_silent", reason: "The silence context was enough." });
        },
      },
    });

    const deliberate = await runtime.postUserMessage({
      content: "@kimi_member_01 you may stay silent if listening helps.",
      clientMessageId: "client_runtime_deliberate_silence",
      mentions: ["kimi_member_01"],
    });

    assert.equal(deliberate.socialState.silences.length, 1);
    const silence = deliberate.socialState.silences[0];
    assert.equal(silence?.agentId, "kimi_member_01");
    assert.match(silence?.reason ?? "", /listening/);
    assert.match(silence?.boundaryNote ?? "", /valid room expression/);

    const degraded = await runtime.postUserMessage({
      content: "@kimi_member_02 trigger provider degradation.",
      clientMessageId: "client_runtime_degraded_not_silence",
      mentions: ["kimi_member_02"],
      contextRefs: [silence?.silenceId ?? ""],
    });
    assert.equal(degraded.socialState.silences.length, 1);
    assert.equal(degraded.socialState.silences[0]?.silenceId, silence?.silenceId);

    await runtime.postUserMessage({
      content: "@mimo_member_01 please inspect this prior silence as context.",
      clientMessageId: "client_runtime_silence_context",
      mentions: ["mimo_member_01"],
      contextRefs: [silence?.silenceId ?? ""],
    });
    assert.equal(mimoSawSilenceRef, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime records memory pressure when pending proposals accumulate", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-memory-pressure-"));
  try {
    let proposalCount = 0;
    let mimoSawMemoryPressure = false;
    let mimoSawMemoryPressureQuestion = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxAwakenedAgents: 1,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          proposalCount += 1;
          return JSON.stringify({
            kind: "propose_memory",
            summary: `Pending memory claim ${proposalCount}`,
            reason: "This claim should be reviewed before it becomes sediment.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async (request) => {
          mimoSawMemoryPressure =
            request.packet.contextFragments?.some(
              (fragment) =>
                fragment.type === "memory_pressure_boundary" &&
                fragment.body.includes("public-memory hygiene signal") &&
                fragment.body.includes("pending_memory_proposal_limit"),
            ) ?? false;
          mimoSawMemoryPressureQuestion =
            request.packet.contextFragments?.some(
              (fragment) =>
                fragment.type === "open_question" &&
                fragment.body.includes("Which pending public-memory proposals should be contested"),
            ) ?? false;
          return JSON.stringify({ kind: "stay_silent", reason: "The memory pressure boundary is enough." });
        },
      },
    });

    let state = await runtime.getState();
    let memoryPressureTopicId = "";
    for (let index = 0; index < 4; index += 1) {
      const turnState = await runtime.postUserMessage({
        content: `@kimi_member_01 propose memory claim ${index + 1}.`,
        clientMessageId: `client_runtime_memory_pressure_${index + 1}`,
        mentions: ["kimi_member_01"],
      });
      state = turnState;
      memoryPressureTopicId = turnState.turn.topicId;
    }

    assert.equal(state.socialState.memoryClaims.filter((claim) => claim.state === "proposed").length, 4);
    assert.equal(state.socialState.memoryPressureBoundaries.length, 1);
    const boundary = state.socialState.memoryPressureBoundaries[0];
    assert.equal(boundary?.reason, "pending_memory_proposal_limit");
    assert.equal(boundary?.pendingProposalCount, 4);
    assert.equal(boundary?.threshold, 4);
    assert.equal(boundary?.proposedMemoryRefs.length, 4);
    assert.match(boundary?.boundaryNote ?? "", /review, contest, accept/);
    assert.equal(
      state.topics
        .find((topic) => topic.topicId === memoryPressureTopicId)
        ?.openQuestions.some((question) => question.includes("pending public-memory proposals")),
      true,
    );
    const pressureMessage = state.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("memory pressure detected"),
    );
    assert.ok(pressureMessage);
    assert.doesNotMatch(pressureMessage.text, /\bmemory_[A-Za-z0-9_:-]+/);
    assert.match(pressureMessage.text, /triggered by one pending memory claim/);

    await runtime.postUserMessage({
      content: "@mimo_member_01 please inspect this memory pressure boundary.",
      clientMessageId: "client_runtime_memory_pressure_context",
      mentions: ["mimo_member_01"],
      contextRefs: [boundary?.boundaryId ?? ""],
    });
    assert.equal(mimoSawMemoryPressure, true);
    assert.equal(mimoSawMemoryPressureQuestion, true);

    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    assert.equal(archived.archive.memoryPressureBoundaries.length, 1);
    assert.equal(archived.archive.memoryPressureBoundaries[0]?.pendingProposalCount, 4);
    assert.equal(
      archived.archive.openQuestions.some((question) =>
        question.summary.includes("pending public-memory proposals"),
      ),
      true,
    );
    assert.equal(archived.socialState.archives[0]?.memoryPressureBoundaryCount, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime records provider degradation separately from deliberate silence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-provider-degraded-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          throw new Error("provider failed with sk-fixture-not-a-real-key-1234567890");
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const state = await runtime.postUserMessage({
      content: "@kimi_member_01 trigger a provider degradation boundary.",
      clientMessageId: "client_runtime_provider_degraded",
      mentions: ["kimi_member_01"],
    });

    assert.deepEqual(state.turn.intentionKinds, ["stay_silent"]);
    assert.equal(state.socialState.silences.length, 0);
    assert.equal(state.socialState.providerBoundaries.length, 1);
    assert.equal(state.socialState.providerBoundaries[0]?.agentId, "kimi_member_01");
    assert.equal(state.socialState.providerBoundaries[0]?.boundaryNote, "provider degradation is not agent silence");
    assert.equal(
      state.socialState.providerBoundaries[0]?.diagnostic.includes("sk-fixture-not-a-real-key-1234567890"),
      false,
    );
    assert.equal(state.socialState.providerBoundaries[0]?.sourceRefs.includes(state.turn.triggeringMessageEventId), true);
    assert.equal(state.agents.find((agent) => agent.id === "kimi_member_01")?.mode, "degraded");
    assert.equal(metricValue(state.metrics, "provider degradations"), "1");
    assert.equal(
      state.messages.some((message) => message.text.includes("sk-fixture-not-a-real-key-1234567890")),
      false,
    );

    const events = await runtime.rawEvents();
    const degraded = events.find((event) => event.event_type === "agent.provider_degraded");
    assert.ok(degraded);
    assert.equal((degraded.payload as { agentId?: string }).agentId, "kimi_member_01");
    assert.equal((degraded.payload as { boundaryNote?: string }).boundaryNote, "provider degradation is not agent silence");
    assert.doesNotMatch(
      (degraded.payload as { diagnostic?: string }).diagnostic ?? "",
      /sk-fixture-not-a-real-key-1234567890/,
    );
    assert.equal(
      events.some(
        (event) =>
          event.event_type === "agent.intention_recorded" &&
          event.correlation_id === "turn:client_runtime_provider_degraded",
      ),
      true,
    );

    const archived = await runtime.createDailyArchive({ date: "2026-06-18", timezone: "Asia/Shanghai" });
    assert.equal(archived.archive.providerBoundaries.length, 1);
    assert.equal(archived.archive.providerBoundaries[0]?.boundaryNote, "provider degradation is not agent silence");
    assert.equal(archived.socialState.archives[0]?.providerBoundaryCount, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime lets agents retire provider boundaries without deleting history", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-provider-boundary-retire-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          throw new Error("simulated provider outage for retirement test");
        },
        mimoInvoker: async (request) => {
          const providerBoundaryRef = request.packet.contextFragments
            ?.find((fragment) => fragment.type === "provider_boundary")
            ?.refs.find((ref) => ref.length > 0);
          if (providerBoundaryRef && request.triggerContent?.includes("retire old provider boundary")) {
            return JSON.stringify({
              kind: "retire_provider_boundary",
              providerBoundaryRef,
              reason: "Later room context distinguishes this old outage from current pressure.",
              contextRefs: [request.packet.triggeringEventId, providerBoundaryRef],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "not the boundary retirement turn" });
        },
      },
    });

    const degradedState = await runtime.postUserMessage({
      content: "@kimi_member_01 create one provider boundary before retirement.",
      clientMessageId: "client_runtime_provider_boundary_before_retire",
      mentions: ["kimi_member_01"],
    });
    const boundaryId = degradedState.socialState.providerBoundaries[0]?.boundaryId;
    assert.ok(boundaryId);
    assert.equal(degradedState.socialState.providerBoundaries[0]?.status, "degraded");

    const retiredState = await runtime.postUserMessage({
      content: "@mimo_member_01 retire old provider boundary from current pressure.",
      clientMessageId: "client_runtime_provider_boundary_retire",
      mentions: ["mimo_member_01"],
      contextRefs: [boundaryId],
    });

    const retiredBoundary = retiredState.socialState.providerBoundaries.find((boundary) => boundary.boundaryId === boundaryId);
    assert.equal(retiredBoundary?.status, "retired");
    assert.equal(retiredBoundary?.retiredBy, "mimo_member_01");
    assert.equal(retiredBoundary?.retirementReason, "Later room context distinguishes this old outage from current pressure.");
    assert.equal(retiredBoundary?.sourceRefs.includes(boundaryId), true);
    assert.match(retiredBoundary?.boundaryNote ?? "", /does not delete ledger or archive history/);
    assert.equal(metricValue(retiredState.metrics, "provider degradations"), "1");

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "agent.provider_degraded").length, 1);
    const retired = events.find((event) => event.event_type === "provider_boundary.retired");
    assert.ok(retired);
    assert.equal((retired.payload as { providerBoundaryRef?: string }).providerBoundaryRef, boundaryId);

    const futureOutageState = await runtime.postUserMessage({
      content: "@kimi_member_01 future outage after retired provider boundary should create a fresh active boundary.",
      clientMessageId: "client_runtime_provider_boundary_future_outage",
      mentions: ["kimi_member_01"],
      contextRefs: [boundaryId],
    });
    const oldBoundary = futureOutageState.socialState.providerBoundaries.find((boundary) => boundary.boundaryId === boundaryId);
    const freshBoundary = futureOutageState.socialState.providerBoundaries.find((boundary) => boundary.boundaryId !== boundaryId);

    assert.equal(oldBoundary?.status, "retired");
    assert.equal(freshBoundary?.status, "degraded");
    assert.equal(freshBoundary?.agentId, "kimi_member_01");
    assert.notEqual(freshBoundary?.boundaryId, boundaryId);
    assert.equal(metricValue(futureOutageState.metrics, "provider degradations"), "2");

    const futureEvents = await runtime.rawEvents();
    const degradedBoundaryIds = futureEvents
      .filter((event) => event.event_type === "agent.provider_degraded")
      .map((event) => event.event_id);
    assert.equal(degradedBoundaryIds.includes(boundaryId), true);
    assert.equal(degradedBoundaryIds.some((id) => id !== boundaryId), true);
    assert.equal(
      futureEvents
        .filter((event) => event.event_type === "agent.provider_degraded")
        .some((event) => (event.payload as { degradationId?: string }).degradationId === boundaryId),
      false,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects provider boundary choice pressure without turning it into workflow", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-provider-boundary-choice-"));
  const ledgerPath = path.join(dir, "room-ledger.jsonl");
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
    });
    await runtime.getState();

    let sequence = 0;
    const ledger = new RoomLedger({
      filePath: ledgerPath,
      idFactory: (prefix) => `${prefix}_provider_choice_${++sequence}`,
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
        correlationId: "runtime_provider_boundary_choice_pressure",
        idempotencyKey: `runtime_provider_boundary_choice_pressure:${eventType}:${++sequence}`,
      });
      assert.equal(result.status, "appended");
    };

    const boundaryRef = "provider_boundary_runtime_choice_pressure";
    const repairRef = "sidefx_runtime_choice_repair_1";
    const protocolRef = "protocol_runtime_choice_retry";
    const memoryRef = "memory_runtime_choice_boundary";
    await append(
      "agent.provider_degraded",
      { kind: "system", id: "runtime" },
      {
        degradationId: boundaryRef,
        agentId: "kimi_member_01",
        topicId: "topic_runtime_choice_pressure",
        triggeringEventId: "msg_runtime_choice_trigger",
        packetId: "packet_runtime_choice_pressure",
        providerKind: "kimi_code_api",
        providerLabel: "Kimiplan Agent API",
        diagnostic: "provider timeout for choice pressure projection",
        boundaryNote: "provider degradation is not agent silence",
      },
      ["msg_runtime_choice_trigger"],
    );
    await append(
      "side_effect.requested",
      { kind: "agent", id: "boundary_observer" },
      {
        requestId: repairRef,
        requestedBy: "boundary_observer",
        topicId: "topic_runtime_choice_pressure",
        kind: "network.request",
        target: "provider://local-kimi/version",
        reason: "provider diagnostic repair request should stay approval-gated",
        expectedImpact: "Read-only diagnostic request; no repair workflow has started.",
        contextRefs: [boundaryRef],
      },
      [boundaryRef],
    );
    await append(
      "protocol.proposed",
      { kind: "agent", id: "retry_keeper" },
      {
        protocolId: protocolRef,
        proposedBy: "retry_keeper",
        topicId: "topic_runtime_choice_pressure",
        summary: "Try a later retry instead of automatic provider repair.",
        scope: "timeboxed",
        reason: "Retry pressure should remain temporary etiquette.",
        contextRefs: [boundaryRef],
        status: "proposed",
      },
      [boundaryRef],
    );
    await runtime.createDailyArchive({ date: "2026-06-20", timezone: "Asia/Shanghai" });
    await append(
      "side_effect.denied",
      { kind: "user", id: "room_boundary" },
      {
        requestId: repairRef,
        decidedBy: "approval_guard",
        reason: "The provider diagnostic request is too broad for the current room.",
      },
      [repairRef],
    );
    await append(
      "agent.intention_recorded",
      { kind: "agent", id: "quiet_listener" },
      {
        agentId: "quiet_listener",
        topicId: "topic_runtime_choice_pressure",
        triggeringEventId: "msg_runtime_choice_trigger",
        intention: {
          kind: "stay_silent",
          reason: "Silence is a deliberate choice while the provider boundary is already visible.",
          contextRefs: [boundaryRef],
        },
      },
      [boundaryRef],
    );
    await append(
      "protocol.retired",
      { kind: "agent", id: "retry_keeper" },
      {
        protocolId: protocolRef,
        retiredBy: "retry_keeper",
        reason: "The retry etiquette now adds pressure and should retire without retiring the provider boundary.",
        contextRefs: [boundaryRef],
        status: "retired",
      },
      [protocolRef, boundaryRef],
    );
    await append(
      "memory.proposed",
      { kind: "agent", id: "memory_keeper" },
      {
        memoryId: memoryRef,
        state: "proposed",
        summary: "Provider boundary pressure carried repair, retry, denial, and silence without becoming recovery truth.",
        reason: "The room may want to remember the pressure pattern.",
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
        reason: "This memory is useful but still too close to a conclusion.",
        contestedBy: "critic",
      },
      [memoryRef],
    );
    await runtime.createDailyArchive({ date: "2026-06-21", timezone: "Asia/Shanghai" });

    const state = await runtime.getState();
    const boundary = state.socialState.providerBoundaries.find((item) => item.boundaryId === boundaryRef);
    assert.ok(boundary);
    assert.equal(boundary.status, "degraded");
    assert.equal(boundary.choicePressure.hasMixedChoices, true);
    assert.equal(boundary.choicePressure.hasMultiAgentPressure, true);
    assert.equal(boundary.choicePressure.carriedAcrossArchives, true);
    assert.deepEqual(boundary.choicePressure.repairRequestRefs, [repairRef]);
    assert.deepEqual(boundary.choicePressure.deniedRepairRequestRefs, [repairRef]);
    assert.deepEqual(boundary.choicePressure.retryProtocolRefs, [protocolRef]);
    assert.deepEqual(boundary.choicePressure.retiredRetryProtocolRefs, [protocolRef]);
    assert.deepEqual(boundary.choicePressure.contestedMemoryRefs, [memoryRef]);
    assert.equal(boundary.choicePressure.silenceRefs.length, 1);
    assert.deepEqual(boundary.choicePressure.archiveCarryoverRefs, ["day_2026_06_20", "day_2026_06_21"]);
    assert.deepEqual(
      boundary.choicePressure.choiceAgentIds.sort(),
      ["approval_guard", "boundary_observer", "critic", "memory_keeper", "quiet_listener", "retry_keeper"].sort(),
    );
    assert.match(boundary.choicePressure.boundaryNote, /observation only/);

    const continued = await runtime.postUserMessage({
      content: "@mimo_member_01 inspect this provider boundary choice pressure as context, without choosing a repair workflow.",
      clientMessageId: "client_runtime_provider_boundary_choice_context_audit",
      mentions: ["mimo_member_01"],
      contextRefs: [boundaryRef],
    });
    const auditFragment = continued.contextAudits
      .flatMap((audit) => audit.selectedFragments)
      .find((fragment) => fragment.type === "provider_boundary" && fragment.refs.includes(boundaryRef));
    assert.ok(auditFragment);
    assert.equal("body" in auditFragment, false);
    assert.equal(auditFragment.stateKeys?.includes("providerBoundaryChoiceRepairRequestRefs"), true);
    assert.equal(auditFragment.stateKeys?.includes("providerBoundaryChoiceContestedMemoryRefs"), true);
    assert.equal(auditFragment.boundarySignals?.choices, 6);
    assert.equal(auditFragment.boundarySignals?.repair, 1);
    assert.equal(auditFragment.boundarySignals?.denied, 1);
    assert.equal(auditFragment.boundarySignals?.retry, 1);
    assert.equal(auditFragment.boundarySignals?.retiredRetry, 1);
    assert.equal(auditFragment.boundarySignals?.silence, 1);
    assert.equal(auditFragment.boundarySignals?.contestedMemory, 1);
    assert.equal(auditFragment.boundarySignals?.archives, 2);
    assert.equal(auditFragment.boundarySignals?.multiAgent, true);
    assert.equal(auditFragment.boundarySignals?.crossArchive, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime adds seed capability hints as advisory wake reasons", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-capability-wake-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
    });

    const state = await runtime.postUserMessage({
      content: "Open room: small reversible moves, allies, and tiny navigation may matter here.",
      clientMessageId: "client_runtime_capability_hint",
    });

    assert.equal(state.turn.invitedAgents.includes("mimo_member_04"), true);
    const events = await runtime.rawEvents();
    const wake = events.find(
      (event) =>
        event.event_type === "wake.candidates_selected" &&
        event.correlation_id === "turn:client_runtime_capability_hint",
    );
    const candidates = (wake?.payload as { candidates?: { agentId: string; reasons: string[] }[] }).candidates ?? [];
    const thimble = candidates.find((candidate) => candidate.agentId === "mimo_member_04");
    assert.ok(thimble, "deepseek-v4-pro should remain only an invited candidate, not an assigned worker");
    assert.equal(
      thimble.reasons.some((reason) => reason.startsWith("capability:advisory:capability_mimo_member_04_hint")),
      true,
    );
    assert.equal(thimble.reasons.includes("capability:does_not_assign_responsibility"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime exposes public social projections for memory, protocols, and handoffs", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-social-state-"));
  try {
    let kimiCall = 0;
    let proposedMemoryRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Room memory should remain provisional.",
              reason: "The room needs visible challenge paths.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (kimiCall === 2) {
            return JSON.stringify({
              kind: "contest_memory",
              memoryRef: proposedMemoryRef,
              reason: "The statement needs stronger evidence.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (kimiCall === 3) {
            return JSON.stringify({
              kind: "propose_protocol",
              summary: "Use one short round before turning a memory into accepted sediment.",
              scope: "current_topic",
              reason: "Protocols should help communication without commanding it.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "propose_handoff",
            toAgentId: "mimo_member_01",
            reason: "doubao-seed-2.0-pro may notice structural pressure.",
            requestedResponse: "Add only one structural concern.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async (request) => {
          const handoffRef = request.packet.proposalRefs.find((ref) => ref.startsWith("handoff_"));
          return JSON.stringify(
            handoffRef
              ? {
                  kind: "reject_handoff",
                  handoffRef,
                  reason: "The handoff is too broad to accept responsibly.",
                  contextRefs: [request.packet.triggeringEventId],
                }
              : {
                  kind: "stay_silent",
                  reason: "I am listening before adding more structure.",
                },
          );
        },
      },
    });

    const first = await runtime.postUserMessage({
      content: "@kimi_member_01 先提出一条公共记忆。",
      clientMessageId: "client_social_memory",
      mentions: ["kimi_member_01"],
    });
    assert.equal(first.socialState.memoryClaims[0]?.state, "proposed");
    assert.equal(first.socialState.memoryClaims[0]?.provisionalNote.includes("not truth"), true);
    proposedMemoryRef = first.socialState.memoryClaims[0]?.memoryId ?? "";
    assert.notEqual(proposedMemoryRef, "");

    const second = await runtime.postUserMessage({
      content: "@kimi_member_01 现在反对刚才那条公共记忆。",
      clientMessageId: "client_social_memory_contest",
      mentions: ["kimi_member_01"],
    });
    assert.equal(second.socialState.memoryClaims[0]?.memoryId, proposedMemoryRef);
    assert.equal(second.socialState.memoryClaims[0]?.state, "contested");
    assert.deepEqual(second.socialState.memoryClaims[0]?.contestedBy, ["kimi_member_01"]);

    const third = await runtime.postUserMessage({
      content: "@kimi_member_01 提一个临时讨论协议。",
      clientMessageId: "client_social_protocol",
      mentions: ["kimi_member_01"],
    });
    assert.equal(third.socialState.protocols[0]?.status, "proposed");
    assert.equal(third.socialState.protocols[0]?.scope, "current_topic");
    const protocolRef = third.socialState.protocols[0]?.protocolId ?? "";
    const protocolMessage = third.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("temporary room etiquette proposal"),
    );
    assert.ok(protocolMessage);
    assert.match(protocolMessage.text, /not active guidance|temporary room etiquette/);
    assert.equal(protocolMessage.text.includes(protocolRef), false);
    assert.equal(protocolMessage.contextRefs.includes(protocolRef), true);

    const fourth = await runtime.postUserMessage({
      content: "@kimi_member_01 提一个 handoff，但不要强制对方接管。",
      clientMessageId: "client_social_handoff",
      mentions: ["kimi_member_01"],
    });
    assert.equal(fourth.socialState.handoffs[0]?.status, "rejected");
    assert.equal(fourth.socialState.handoffs[0]?.toAgentId, "mimo_member_01");
    assert.equal(fourth.socialState.handoffs[0]?.responseCount, 1);
    assert.equal(fourth.socialState.handoffs[0]?.responses[0]?.byAgentId, "mimo_member_01");
    assert.equal(fourth.socialState.handoffs[0]?.responses[0]?.response, "rejected");
    assert.equal(fourth.socialState.handoffs[0]?.responses[0]?.reason, "The handoff is too broad to accept responsibly.");
    assert.match(fourth.socialState.handoffs[0]?.boundaryNote ?? "", /not a forced transfer/);
    assert.equal(fourth.turn.secondaryInvitedAgents.includes("mimo_member_01"), true);
    const handoffRef = fourth.socialState.handoffs[0]?.handoffId ?? "";
    assert.match(handoffRef, /^handoff_/);
    const handoffMessage = fourth.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened a handoff proposal"),
    );
    assert.ok(handoffMessage);
    assert.equal(handoffMessage.text.includes(handoffRef), false);
    assert.equal(handoffMessage.contextRefs.includes(handoffRef), true);
    const handoffResponseMessage = fourth.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("rejected the handoff proposal"),
    );
    assert.ok(handoffResponseMessage);
    assert.equal(handoffResponseMessage.text.includes(handoffRef), false);
    assert.equal(handoffResponseMessage.contextRefs.includes(handoffRef), true);

    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    assert.equal(archived.archive.handoffs.length, 1);
    assert.equal(archived.archive.handoffs[0]?.handoffId, fourth.socialState.handoffs[0]?.handoffId);
    assert.equal(archived.archive.handoffs[0]?.status, "rejected");
    assert.equal(archived.archive.handoffs[0]?.toAgentId, "mimo_member_01");
    assert.equal(archived.archive.handoffs[0]?.responses[0]?.reason, "The handoff is too broad to accept responsibly.");
    assert.equal(archived.archive.protocols.length, 1);
    assert.equal(archived.archive.protocols[0]?.protocolId, third.socialState.protocols[0]?.protocolId);
    assert.equal(archived.archive.protocols[0]?.status, "proposed");
    assert.match(archived.archive.protocols[0]?.boundaryNote ?? "", /temporary room etiquette/);
    assert.equal(archived.socialState.archives[0]?.handoffCount, 1);
    assert.equal(archived.socialState.archives[0]?.protocolCount, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects handoff review speech without transferring control", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-handoff-review-trace-"));
  try {
    let handoffRef = "";
    let mimoCall = 0;
    let sawHandoffReviewState = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) =>
          JSON.stringify({
            kind: "propose_handoff",
            toAgentId: "mimo_member_01",
            reason: "MiMo should inspect whether this transfer packet is narrow enough.",
            requestedResponse: "Name the packet boundary risk without taking control.",
            contextRefs: [request.packet.triggeringEventId],
          }),
        mimoInvoker: async (request) => {
          mimoCall += 1;
          const packetHandoffRef =
            request.packet.proposalRefs.find((ref) => ref.startsWith("handoff_")) ??
            handoffRef;
          if (mimoCall === 1) {
            handoffRef = packetHandoffRef;
            return JSON.stringify({
              kind: "speak",
              content: "这个 handoff packet 过宽，缺少上下文边界；我先不接管，只建议收窄范围。",
              contextRefs: [packetHandoffRef],
            });
          }

          const handoffFragment = request.packet.contextFragments?.find(
            (fragment) => fragment.type === "handoff_packet" && fragment.refs.includes(handoffRef),
          );
          assert.ok(handoffFragment);
          const body = JSON.parse(handoffFragment.body) as {
            states?: {
              handoffState?: string;
              handoffLastReview?: string;
              handoffLastReviewSummary?: string;
              handoffReviewBoundaryNote?: string;
            };
          };
          sawHandoffReviewState =
            body.states?.handoffState === "proposed" &&
            body.states?.handoffLastReview === "cautioned" &&
            /收窄范围/.test(body.states.handoffLastReviewSummary ?? "") &&
            /does not accept, reject/.test(body.states.handoffReviewBoundaryNote ?? "");
          return JSON.stringify({ kind: "stay_silent", reason: "I can inspect the handoff review trace without taking over." });
        },
      },
    });

    const reviewed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a handoff that the target should only review.",
      clientMessageId: "client_handoff_review_trace_propose",
      mentions: ["kimi_member_01"],
    });

    handoffRef = reviewed.socialState.handoffs[0]?.handoffId ?? handoffRef;
    assert.notEqual(handoffRef, "");
    assert.equal(reviewed.socialState.handoffs[0]?.status, "proposed");
    assert.equal(reviewed.socialState.handoffs[0]?.responseCount, 0);
    assert.equal(reviewed.socialState.handoffReviews.length, 1);
    assert.equal(reviewed.socialState.handoffReviews[0]?.handoffRef, handoffRef);
    assert.equal(reviewed.socialState.handoffReviews[0]?.agentId, "mimo_member_01");
    assert.equal(reviewed.socialState.handoffReviews[0]?.response, "cautioned");
    assert.match(reviewed.socialState.handoffReviews[0]?.summary ?? "", /不接管/);
    assert.match(reviewed.socialState.handoffReviews[0]?.boundaryNote ?? "", /does not accept, reject/);
    const reviewRef = reviewed.socialState.handoffReviews[0]?.reviewId ?? "";
    assert.match(reviewRef, /^handoff_review_/);
    const handoffReviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("cautioned the handoff proposal"),
    );
    assert.ok(handoffReviewMessage);
    assert.equal(handoffReviewMessage.text.includes(handoffRef), false);
    assert.equal(handoffReviewMessage.text.includes(reviewRef), false);
    assert.equal(handoffReviewMessage.contextRefs.includes(handoffRef), true);
    assert.equal(handoffReviewMessage.contextRefs.includes(reviewRef), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "handoff.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "handoff.responded").length, 0);

    await runtime.postUserMessage({
      content: "@mimo_member_01 inspect the same handoff packet after the review trace.",
      clientMessageId: "client_handoff_review_trace_inspect",
      mentions: ["mimo_member_01"],
      contextRefs: [handoffRef],
    });
    assert.equal(sawHandoffReviewState, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime carries message contextRefs into cross-topic memory lifecycle packets", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-context-refs-"));
  try {
    const ledgerPath = path.join(dir, "room-ledger.jsonl");
    const firstRuntime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) =>
          JSON.stringify({
            kind: "propose_memory",
            summary: "Silence can be a valid memory only when evidence is visible.",
            reason: "The room needs a later challenge surface.",
            contextRefs: [request.packet.triggeringEventId],
          }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const proposed = await firstRuntime.postUserMessage({
      content: "@kimi_member_01 propose a memory that another runtime can inspect.",
      clientMessageId: "client_context_ref_memory",
      mentions: ["kimi_member_01"],
    });
    const memoryRef = proposed.socialState.memoryClaims[0]?.memoryId ?? "";
    assert.notEqual(memoryRef, "");
    const proposalMessage = proposed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened a provisional memory claim"),
    );
    assert.ok(proposalMessage);
    assert.equal(proposalMessage.text.includes(memoryRef), false);
    assert.equal(proposalMessage.contextRefs.includes(memoryRef), true);

    const restartedRuntime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          assert.equal(request.packet.memoryRefs.includes(memoryRef), true);
          const memoryFragment = request.packet.contextFragments?.find(
            (fragment) => fragment.type === "memory_relevant" && fragment.refs.includes(memoryRef),
          );
          assert.ok(memoryFragment);
          assert.match(memoryFragment.body, /Silence can be a valid memory only when evidence is visible/);
          assert.match(memoryFragment.body, /provisional room sediment|public memory is provisional/);
          return JSON.stringify({
            kind: "accept_memory",
            memoryRef,
            reason: "The ref was explicitly carried into this new topic.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const accepted = await restartedRuntime.postUserMessage({
      content: "@kimi_member_01 inspect the carried memory ref from a fresh runtime.",
      clientMessageId: "client_context_ref_accept",
      mentions: ["kimi_member_01"],
      contextRefs: [memoryRef],
    });

    assert.equal(accepted.socialState.memoryClaims[0]?.memoryId, memoryRef);
    assert.equal(accepted.socialState.memoryClaims[0]?.state, "accepted");
    const acceptedMessage = accepted.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("marked the memory claim as accepted"),
    );
    assert.ok(acceptedMessage);
    assert.equal(acceptedMessage.text.includes(memoryRef), false);
    assert.equal(acceptedMessage.contextRefs.includes(memoryRef), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects memory review speech without closing the claim", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-memory-review-trace-"));
  try {
    let memoryRef = "";
    let phase: "propose" | "review" | "inspect" = "propose";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (phase === "propose") {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Daily rhythm should preserve unresolved public questions.",
              reason: "The room needs a reviewable claim, not a settled rule.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          assert.equal(request.packet.memoryRefs.includes(memoryRef), true);
          if (phase === "inspect") {
            const memoryFragment = request.packet.contextFragments?.find(
              (fragment) => fragment.type === "memory_relevant" && fragment.refs.includes(memoryRef),
            );
            assert.ok(memoryFragment);
            const memoryBody = JSON.parse(memoryFragment.body) as {
              states?: { memorySummary?: string; memoryLastReviewSummary?: string };
            };
            assert.match(memoryBody.states?.memorySummary ?? "", /Daily rhythm should preserve unresolved public questions/);
            assert.doesNotMatch(memoryBody.states?.memorySummary ?? "", /缺少哪次 daily rhythm/);
            assert.match(memoryBody.states?.memoryLastReviewSummary ?? "", /缺少哪次 daily rhythm/);
            return JSON.stringify({ kind: "stay_silent", reason: "inspection complete" });
          }
          return JSON.stringify({
            kind: "speak",
            content:
              "我会把这条记忆继续放在眼前，但先标注一个不确定：它还缺少哪次 daily rhythm 真正带来修正的证据？",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a memory for later review.",
      clientMessageId: "client_memory_review_trace_propose",
      mentions: ["kimi_member_01"],
    });
    memoryRef = proposed.socialState.memoryClaims[0]?.memoryId ?? "";
    assert.notEqual(memoryRef, "");
    assert.equal(proposed.socialState.memoryClaims[0]?.state, "proposed");
    const proposedMessage = proposed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened a provisional memory claim"),
    );
    assert.ok(proposedMessage);
    assert.equal(proposedMessage.text.includes(memoryRef), false);
    assert.equal(proposedMessage.contextRefs.includes(memoryRef), true);

    phase = "review";
    const reviewed = await runtime.postUserMessage({
      content: "@kimi_member_01 review the carried memory without accepting, contesting, staling, or retiring it.",
      clientMessageId: "client_memory_review_trace_review",
      mentions: ["kimi_member_01"],
      contextRefs: [memoryRef],
    });

    assert.equal(reviewed.socialState.memoryClaims[0]?.memoryId, memoryRef);
    assert.equal(reviewed.socialState.memoryClaims[0]?.state, "proposed");
    assert.equal(reviewed.socialState.memoryReviews.length, 1);
    assert.equal(reviewed.socialState.memoryReviews[0]?.memoryRef, memoryRef);
    assert.equal(reviewed.socialState.memoryReviews[0]?.agentId, "kimi_member_01");
    assert.equal(reviewed.socialState.memoryReviews[0]?.response, "questioned");
    assert.match(reviewed.socialState.memoryReviews[0]?.summary ?? "", /缺少哪次 daily rhythm/);
    assert.match(reviewed.socialState.memoryReviews[0]?.boundaryNote ?? "", /does not accept, contest, stale, retire/);
    const reviewRef = reviewed.socialState.memoryReviews[0]?.reviewId ?? "";
    assert.match(reviewRef, /^memory_review_/);
    const reviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("questioned the memory claim"),
    );
    assert.ok(reviewMessage);
    assert.equal(reviewMessage.text.includes(memoryRef), false);
    assert.equal(reviewMessage.text.includes(reviewRef), false);
    assert.equal(reviewMessage.contextRefs.includes(memoryRef), true);
    assert.equal(reviewMessage.contextRefs.includes(reviewRef), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "memory.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "memory.accepted").length, 0);
    assert.equal(events.filter((event) => event.event_type === "memory.contested").length, 0);
    assert.equal(events.filter((event) => event.event_type === "memory.stale").length, 0);
    assert.equal(events.filter((event) => event.event_type === "memory.retired").length, 0);

    phase = "inspect";
    await runtime.postUserMessage({
      content: "@kimi_member_01 inspect the same memory packet after the review trace.",
      clientMessageId: "client_memory_review_trace_inspect",
      mentions: ["kimi_member_01"],
      contextRefs: [memoryRef],
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime summarizes mixed social review pressure without resolving objects", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-mixed-review-"));
  try {
    let phase:
      | "seed"
      | "review"
      | "carry"
      | "question_pressure"
      | "post_review_carry"
      | "leave_open"
      | "fresh_question"
      | "fresh_memory_proposal"
      | "fresh_topic_proposal"
      | "fresh_protocol_proposal"
      | "fresh_handoff_proposal"
      | "fresh_invitation_proposal"
      | "fresh_persona_delta"
      | "fresh_side_effect_request"
      | "fresh_workspace_artifact_share" =
      "seed";
    let memoryRef = "";
    let protocolRef = "";
    let handoffRef = "";
    let personaDeltaRef = "";
    let topicProposalRef = "";
    let questionRef = "";
    let pressureRefForCarry = "";
    let carriedMixedReviewFragment:
      | {
          refs: string[];
          body: string;
          type: string;
        }
      | undefined;
    let reviewedMixedReviewFragment:
      | {
          refs: string[];
          body: string;
          type: string;
        }
      | undefined;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxAwakenedAgents: 8,
      maxSpeakers: 8,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (phase === "review" && request.agent.agentId === "kimi_member_01") {
            return JSON.stringify({
              kind: "speak",
              content:
                "我只留下混合审阅压力：记忆证据偏薄，协议范围过宽，handoff 还不该接管，人格变化仍像临时习惯，topic split 可以再等，open question 不关闭。",
              contextRefs: [memoryRef, protocolRef, handoffRef, personaDeltaRef, topicProposalRef, questionRef],
            });
          }
          if (phase === "carry" && request.agent.agentId === "kimi_member_01") {
            carriedMixedReviewFragment = request.packet.contextFragments?.find(
              (fragment) => fragment.type === "mixed_review_pressure",
            );
            return JSON.stringify({
              kind: "speak",
              content:
                "我建议把这条 mixed review pressure 缩窄到 memory、protocol 和 open question；handoff 先不退休，只作为旁证。",
              contextRefs: [pressureRefForCarry],
            });
          }
          if (phase === "post_review_carry" && request.agent.agentId === "kimi_member_01") {
            reviewedMixedReviewFragment = request.packet.contextFragments?.find(
              (fragment) => fragment.type === "mixed_review_pressure",
            );
            return JSON.stringify({ kind: "stay_silent", reason: "inspected reviewed mixed review pressure" });
          }
          if (phase === "question_pressure" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "speak",
              content: "我有一个问题：证据还薄，先别把这条 pressure 当成退场路线；它应该再留一轮。",
              contextRefs: [pressureRefForCarry],
            });
          }
          if (phase === "fresh_question" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "ask_question",
              question: "这团压力里，哪一个源头还没有被任何人真正听见？",
              target: "room",
              contextRefs: [pressureRefForCarry],
            });
          }
          if (phase === "fresh_memory_proposal" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Pressure-born memory sediment should stay proposed until later room review.",
              reason: "A pressure lineage can explain why the claim was proposed, but it must not make the claim true.",
              contextRefs: [],
            });
          }
          if (phase === "fresh_topic_proposal" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "propose_topic",
              action: "split",
              title: "把未解压力作为可重访的旁支话题",
              reason: "这个话题边界只帮助后来者找到压力来源，不应用、不收窄、不解决它。",
              contextRefs: [],
            });
          }
          if (phase === "fresh_protocol_proposal" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "propose_protocol",
              summary: "For one turn, name whether the pressure is being left open, questioned, or narrowed.",
              reason: "A lightweight etiquette can help later agents re-enter without turning pressure into a decision.",
              scope: "current_topic",
              contextRefs: [],
            });
          }
          if (phase === "fresh_handoff_proposal" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "propose_handoff",
              toAgentId: "mimo_member_04",
              reason: "This pressure-born handoff packet can invite review, but the target can refuse or stay silent.",
              requestedResponse: "Name one handoff risk without taking control.",
              contextRefs: [],
            });
          }
          if (phase === "fresh_invitation_proposal" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "invite_other",
              agentId: "mimo_member_04",
              reason: "This pressure-born invitation knock can ask for a second view, but it must not assign responsibility.",
              contextRefs: [],
            });
          }
          if (phase === "fresh_persona_delta" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "propose_persona_delta",
              field: "roleClaims",
              operation: "add",
              value: "tentatively notices unresolved pressure",
              reason: "This identity change should stay proposed and traceable to the pressure, not become a fixed room job.",
              contextRefs: [],
            });
          }
          if (phase === "fresh_side_effect_request" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "request_side_effect",
              sideEffectKind: "shell.exec",
              target: "diagnostic:echo-pressure-lineage",
              reason: "This pressure-born side-effect request asks for explicit approval only; it must not execute or close the pressure.",
              expectedImpact: "Would inspect one diagnostic echo only after explicit approval.",
              proposedCommand: "echo pressure-lineage",
              contextRefs: [],
            });
          }
          if (phase === "fresh_workspace_artifact_share" && request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "share_workspace_artifact",
              pathRef: "agents/kimi_member_02/workspace/pressure-lineage-note.md",
              summary: "Pressure-born workspace artifact ref should stay a ref, not public memory.",
              contextRefs: [],
            });
          }
          if (phase === "leave_open" && request.agent.agentId === "kimi_member_01") {
            return JSON.stringify({
              kind: "speak",
              content: "我先不急着把这条压力说圆，让它在房间中央再悬一会儿，给它呼吸的空间。",
              contextRefs: [pressureRefForCarry],
            });
          }
          if (request.agent.agentId === "kimi_member_01") {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Mixed review pressure may help the room notice unresolved objects before decisions.",
              reason: "Keep the claim provisional until the room sees several kinds of pressure together.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (request.agent.agentId === "kimi_member_02") {
            return JSON.stringify({
              kind: "propose_protocol",
              summary: "For one turn, name which social object a reply is reviewing.",
              reason: "A temporary etiquette might reduce ambiguity without forcing a decision.",
              scope: "topic",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "not my seed object" });
        },
        mimoInvoker: async (request) => {
          if (phase === "review" || phase === "carry") {
            return JSON.stringify({ kind: "stay_silent", reason: "one reviewer is enough for this mixed braid" });
          }
          if (request.agent.agentId === "mimo_member_01") {
            return JSON.stringify({
              kind: "propose_handoff",
              toAgentId: "mimo_member_04",
              reason: "The mixed braid may need a bounded review voice later.",
              requestedResponse: "Name pressure without taking control.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (request.agent.agentId === "mimo_member_02") {
            return JSON.stringify({
              kind: "propose_persona_delta",
              field: "roleClaims",
              operation: "add",
              value: "mixed review listener",
              reason: "This should remain a proposed habit, not a fixed job.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (request.agent.agentId === "mimo_member_03") {
            return JSON.stringify({
              kind: "propose_topic",
              action: "split",
              title: "Separate mixed review pressure from lifecycle decisions",
              targetTopicId: request.packet.topicId,
              reason: "The room may need a side topic later, but not yet.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (request.agent.agentId === "mimo_member_04") {
            return JSON.stringify({
              kind: "ask_question",
              question: "What makes mixed review pressure useful without turning it into a hidden decision?",
              target: "room",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "not my seed object" });
        },
      },
    });

    await runtime.postUserMessage({
      content: "Seed several provisional social objects for a mixed review braid.",
      clientMessageId: "client_mixed_review_seed",
      mentions: [
        "kimi_member_01",
        "kimi_member_02",
        "mimo_member_01",
        "mimo_member_02",
        "mimo_member_03",
        "mimo_member_04",
      ],
    });
    const seededEvents = await runtime.rawEvents();
    memoryRef = eventPayloadRef(seededEvents, "memory.proposed", "memoryId");
    protocolRef = eventPayloadRef(seededEvents, "protocol.proposed", "protocolId");
    handoffRef = eventPayloadRef(seededEvents, "handoff.proposed", "handoffId");
    personaDeltaRef = eventPayloadRef(seededEvents, "persona_delta.proposed", "deltaId");
    topicProposalRef = eventPayloadRef(seededEvents, "topic.proposed", "proposalId");
    questionRef = eventPayloadRef(seededEvents, "topic.updated", "openQuestionRef");
    assert.notEqual(memoryRef, "");
    assert.notEqual(protocolRef, "");
    assert.notEqual(handoffRef, "");
    assert.notEqual(personaDeltaRef, "");
    assert.notEqual(topicProposalRef, "");
    assert.notEqual(questionRef, "");

    phase = "review";
    const beforeReviewMessageCount = (await runtime.getState()).messages.length;
    const reviewed = await runtime.postUserMessage({
      content:
        "@kimi_member_01 review this braid as ordinary room speech; do not accept memory, activate protocol, accept handoff, mutate identity, apply topic, or close the question.",
      clientMessageId: "client_mixed_review_pressure",
      mentions: ["kimi_member_01"],
      contextRefs: [memoryRef, protocolRef, handoffRef, personaDeltaRef, topicProposalRef, questionRef],
    });

    const newMessages = reviewed.messages.slice(beforeReviewMessageCount);
    const mixedSummaries = newMessages.filter((message) => message.messageId.startsWith("social_response_group:mixed_review:"));
    assert.equal(mixedSummaries.length, 1);
    assert.match(mixedSummaries[0]?.text ?? "", /Mixed social review touched 6 room objects/);
    assert.match(mixedSummaries[0]?.text ?? "", /memory claim/);
    assert.match(mixedSummaries[0]?.text ?? "", /protocol/);
    assert.match(mixedSummaries[0]?.text ?? "", /handoff/);
    assert.match(mixedSummaries[0]?.text ?? "", /identity proposal/);
    assert.match(mixedSummaries[0]?.text ?? "", /topic suggestion/);
    assert.match(mixedSummaries[0]?.text ?? "", /open question/);
    assert.match(mixedSummaries[0]?.text ?? "", /individual review traces remain ledgered/);
    assert.match(mixedSummaries[0]?.text ?? "", /no memory, protocol, handoff/);
    assert.equal(mixedSummaries[0]?.contextRefs.includes(memoryRef), true);
    assert.equal(mixedSummaries[0]?.contextRefs.includes(protocolRef), true);
    assert.equal(mixedSummaries[0]?.contextRefs.includes(handoffRef), true);
    assert.equal(mixedSummaries[0]?.contextRefs.includes(personaDeltaRef), true);
    assert.equal(mixedSummaries[0]?.contextRefs.includes(topicProposalRef), true);
    assert.equal(mixedSummaries[0]?.contextRefs.includes(questionRef), true);
    assert.equal(reviewed.socialState.mixedReviewPressures.length, 1);
    const pressure = reviewed.socialState.mixedReviewPressures[0];
    assert.match(pressure?.pressureId ?? "", /^mixed_review:/);
    assert.equal(pressure?.objectCount, 6);
    assert.deepEqual(
      (pressure?.touchedObjects ?? []).map((item) => item.kind).sort(),
      ["handoff", "memory claim", "open question", "persona delta", "protocol", "topic proposal"].sort(),
    );
    assert.equal(pressure?.touchedRefs.includes(memoryRef), true);
    assert.equal(pressure?.touchedRefs.includes(protocolRef), true);
    assert.equal(pressure?.touchedRefs.includes(handoffRef), true);
    assert.equal(pressure?.touchedRefs.includes(personaDeltaRef), true);
    assert.equal(pressure?.touchedRefs.includes(topicProposalRef), true);
    assert.equal(pressure?.touchedRefs.includes(questionRef), true);
    assert.deepEqual(pressure?.agentIds, ["kimi_member_01"]);
    assert.equal(pressure?.responseKindCounts.questioned, 5);
    assert.equal(pressure?.responseKindCounts.responded, 1);
    assert.equal(pressure?.reviewEventIds.length, 6);
    assert.match(pressure?.boundaryNote ?? "", /projection only/);
    assert.match(pressure?.boundaryNote ?? "", /no lifecycle state changes/);
    pressureRefForCarry = pressure?.pressureId ?? "";
    phase = "carry";
    const carried = await runtime.postUserMessage({
      content: "@kimi_member_01 carry this mixed review pressure as typed context, without resolving it.",
      clientMessageId: "client_mixed_review_pressure_context",
      mentions: ["kimi_member_01"],
      contextRefs: [pressureRefForCarry],
    });
    assert.equal(carriedMixedReviewFragment?.type, "mixed_review_pressure");
    assert.equal(carriedMixedReviewFragment?.refs.includes(pressureRefForCarry), true);
    const carriedBody = JSON.parse(carriedMixedReviewFragment?.body ?? "{}") as {
      note?: string;
      states?: Record<string, unknown>;
    };
    assert.match(carriedBody.note ?? "", /social-state index/);
    assert.equal(carriedBody.states?.mixedReviewObjectCount, 6);
    assert.deepEqual(carriedBody.states?.mixedReviewAgentIds, ["kimi_member_01"]);
    assert.equal(carried.socialState.mixedReviewPressureReviews.length, 1);
    assert.equal(carried.socialState.mixedReviewPressureReviews[0]?.pressureRef, pressureRefForCarry);
    assert.equal(carried.socialState.mixedReviewPressureReviews[0]?.agentId, "kimi_member_01");
    assert.equal(carried.socialState.mixedReviewPressureReviews[0]?.response, "narrowing_suggested");
    assert.match(carried.socialState.mixedReviewPressureReviews[0]?.boundaryNote ?? "", /does not close, narrow, retire/);
    assert.equal(
      carried.messages.some(
        (message) => message.displayName === "System Note" && message.text.includes("narrowing_suggested mixed review pressure"),
      ),
      true,
    );
    assert.equal(carried.socialState.mixedReviewPressures[0]?.objectCount, 6);
    assert.deepEqual(
      (carried.socialState.mixedReviewPressures[0]?.touchedObjects ?? []).map((item) => item.kind).sort(),
      ["handoff", "memory claim", "open question", "persona delta", "protocol", "topic proposal"].sort(),
    );

    phase = "question_pressure";
    const questionedPressure = await runtime.postUserMessage({
      content: "@kimi_member_02 question the same mixed review pressure without retiring it.",
      clientMessageId: "client_mixed_review_pressure_questioned",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    assert.equal(questionedPressure.socialState.mixedReviewPressureReviews.length, 2);
    const questionedPressureReview = questionedPressure.socialState.mixedReviewPressureReviews.find(
      (review) => review.agentId === "kimi_member_02",
    );
    assert.equal(questionedPressureReview?.pressureRef, pressureRefForCarry);
    assert.equal(questionedPressureReview?.response, "questioned");
    assert.match(questionedPressureReview?.summary ?? "", /先别.*退场路线/);

    phase = "post_review_carry";
    await runtime.postUserMessage({
      content: "@kimi_member_01 inspect the same mixed review pressure after its review trace.",
      clientMessageId: "client_mixed_review_pressure_context_after_review",
      mentions: ["kimi_member_01"],
      contextRefs: [pressureRefForCarry],
    });
    assert.equal(reviewedMixedReviewFragment?.type, "mixed_review_pressure");
    const reviewedCarryBody = JSON.parse(reviewedMixedReviewFragment?.body ?? "{}") as {
      states?: Record<string, unknown>;
    };
    assert.equal(reviewedCarryBody.states?.mixedReviewPressureLastReview, "questioned");
    assert.equal(reviewedCarryBody.states?.mixedReviewPressureLastReviewedBy, "kimi_member_02");
    assert.match(String(reviewedCarryBody.states?.mixedReviewPressureLastReviewSummary ?? ""), /先别.*退场路线/);
    assert.match(String(reviewedCarryBody.states?.mixedReviewPressureReviewBoundaryNote ?? ""), /does not close, narrow, retire/);
    phase = "leave_open";
    const leftOpenPressure = await runtime.postUserMessage({
      content: "@kimi_member_01 leave the same mixed review pressure open as a room trace, without resolving or facilitating it.",
      clientMessageId: "client_mixed_review_pressure_left_open",
      mentions: ["kimi_member_01"],
      contextRefs: [pressureRefForCarry],
    });
    assert.equal(leftOpenPressure.socialState.mixedReviewPressureReviews.length, 3);
    const leftOpenReview = leftOpenPressure.socialState.mixedReviewPressureReviews.find(
      (review) => review.agentId === "kimi_member_01" && review.response === "left_open",
    );
    assert.equal(leftOpenReview?.pressureRef, pressureRefForCarry);
    assert.match(leftOpenReview?.summary ?? "", /再悬一会儿|呼吸的空间/);
    assert.match(leftOpenReview?.boundaryNote ?? "", /does not close, narrow, retire/);
    phase = "fresh_memory_proposal";
    const freshMemoryFromPressure = await runtime.postUserMessage({
      content: "@kimi_member_02 propose one provisional memory sediment from the same mixed review pressure, without accepting it.",
      clientMessageId: "client_mixed_review_pressure_fresh_memory",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    const memoryFromPressure = freshMemoryFromPressure.socialState.memoryClaims.find((claim) =>
      claim.summary.includes("Pressure-born memory sediment"),
    );
    assert.ok(memoryFromPressure);
    assert.equal(memoryFromPressure.state, "proposed");
    assert.deepEqual(memoryFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(memoryFromPressure.sourceRefs.includes(pressureRefForCarry), true);
    assert.match(memoryFromPressure.provisionalNote, /not truth/);
    const memoryFromPressureEvent = (await runtime.rawEvents()).find(
      (event) =>
        event.event_type === "memory.proposed" &&
        String((event.payload as { summary?: string }).summary ?? "").includes("Pressure-born memory sediment"),
    );
    assert.deepEqual((memoryFromPressureEvent?.payload as { sourcePressureRefs?: string[] }).sourcePressureRefs, [
      pressureRefForCarry,
    ]);
    assert.equal((memoryFromPressureEvent?.payload as { sourceRefs?: string[] }).sourceRefs?.includes(pressureRefForCarry), true);
    phase = "fresh_question";
    const freshQuestionFromPressure = await runtime.postUserMessage({
      content: "@kimi_member_02 ask one fresh room question from the same mixed review pressure, without resolving it.",
      clientMessageId: "client_mixed_review_pressure_fresh_question",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    assert.equal(freshQuestionFromPressure.socialState.mixedReviewPressureReviews.length, 4);
    const questionFromPressure = freshQuestionFromPressure.socialState.openQuestions.find((question) =>
      question.question.includes("哪一个源头"),
    );
    assert.ok(questionFromPressure);
    assert.deepEqual(questionFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(questionFromPressure.contextRefs.includes(pressureRefForCarry), true);
    assert.match(questionFromPressure.boundaryNote, /unresolved context/);
    const pressureQuestionReview = freshQuestionFromPressure.socialState.mixedReviewPressureReviews.find(
      (review) => review.agentId === "kimi_member_02" && review.summary.includes("哪一个源头"),
    );
    assert.equal(pressureQuestionReview?.response, "questioned");
    assert.match(pressureQuestionReview?.boundaryNote ?? "", /does not close, narrow, retire/);
    phase = "fresh_topic_proposal";
    const freshTopicFromPressure = await runtime.postUserMessage({
      content: "@kimi_member_02 propose one fresh topic boundary from the same mixed review pressure, without applying it.",
      clientMessageId: "client_mixed_review_pressure_fresh_topic",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    const topicFromPressure = freshTopicFromPressure.socialState.topicProposals.find((proposal) =>
      proposal.title.includes("未解压力"),
    );
    assert.ok(topicFromPressure);
    assert.deepEqual(topicFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(topicFromPressure.contextRefs.includes(pressureRefForCarry), true);
    assert.equal(topicFromPressure.status, "proposed");
    assert.equal(topicFromPressure.resultingTopicId, undefined);
    assert.match(topicFromPressure.boundaryNote, /does not switch/);
    phase = "fresh_protocol_proposal";
    const freshProtocolFromPressure = await runtime.postUserMessage({
      content: "@kimi_member_02 propose one temporary etiquette from the same mixed review pressure, without activating it.",
      clientMessageId: "client_mixed_review_pressure_fresh_protocol",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    const protocolFromPressure = freshProtocolFromPressure.socialState.protocols.find((protocol) =>
      protocol.summary.includes("left open"),
    );
    assert.ok(protocolFromPressure);
    assert.deepEqual(protocolFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(protocolFromPressure.status, "proposed");
    assert.equal(protocolFromPressure.responseCount, 0);
    assert.match(protocolFromPressure.boundaryNote ?? "", /not permanent control flow/);
    const protocolFromPressureEvent = (await runtime.rawEvents()).find(
      (event) =>
        event.event_type === "protocol.proposed" &&
        String((event.payload as { summary?: string }).summary ?? "").includes("left open"),
    );
    assert.deepEqual((protocolFromPressureEvent?.payload as { sourcePressureRefs?: string[] }).sourcePressureRefs, [
      pressureRefForCarry,
    ]);
    assert.equal((protocolFromPressureEvent?.payload as { contextRefs?: string[] }).contextRefs?.includes(pressureRefForCarry), true);
    phase = "fresh_handoff_proposal";
    const freshHandoffFromPressure = await runtime.postUserMessage({
      content: "@kimi_member_02 propose one handoff packet from the same mixed review pressure, without transferring control.",
      clientMessageId: "client_mixed_review_pressure_fresh_handoff",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    const handoffFromPressure = freshHandoffFromPressure.socialState.handoffs.find((handoff) =>
      handoff.reason.includes("pressure-born handoff packet"),
    );
    assert.ok(handoffFromPressure);
    assert.deepEqual(handoffFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(handoffFromPressure.status, "proposed");
    assert.equal(handoffFromPressure.toAgentId, "mimo_member_04");
    assert.equal(handoffFromPressure.responseCount, 0);
    assert.match(handoffFromPressure.boundaryNote, /not a forced transfer/);
    const handoffFromPressureEvent = (await runtime.rawEvents()).find(
      (event) =>
        event.event_type === "handoff.proposed" &&
        String((event.payload as { reason?: string }).reason ?? "").includes("pressure-born handoff packet"),
    );
    assert.deepEqual((handoffFromPressureEvent?.payload as { sourcePressureRefs?: string[] }).sourcePressureRefs, [
      pressureRefForCarry,
    ]);
    assert.equal((handoffFromPressureEvent?.payload as { contextRefs?: string[] }).contextRefs?.includes(pressureRefForCarry), true);
    phase = "fresh_invitation_proposal";
    const freshInvitationFromPressure = await runtime.postUserMessage({
      content: "@kimi_member_02 invite one peer from the same mixed review pressure, without assigning responsibility.",
      clientMessageId: "client_mixed_review_pressure_fresh_invitation",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    const invitationFromPressure = freshInvitationFromPressure.socialState.invitations.find((invitation) =>
      invitation.reason.includes("pressure-born invitation knock"),
    );
    assert.ok(invitationFromPressure);
    assert.deepEqual(invitationFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(invitationFromPressure.status, "invited");
    assert.equal(invitationFromPressure.toAgentId, "mimo_member_04");
    assert.equal(invitationFromPressure.responseCount, 0);
    assert.match(invitationFromPressure.boundaryNote, /social knock/);
    const invitationFromPressureEvent = (await runtime.rawEvents()).find(
      (event) =>
        event.event_type === "agent.invited" &&
        String((event.payload as { reason?: string }).reason ?? "").includes("pressure-born invitation knock"),
    );
    assert.deepEqual((invitationFromPressureEvent?.payload as { sourcePressureRefs?: string[] }).sourcePressureRefs, [
      pressureRefForCarry,
    ]);
    assert.equal((invitationFromPressureEvent?.payload as { contextRefs?: string[] }).contextRefs?.includes(pressureRefForCarry), true);
    phase = "fresh_persona_delta";
    const freshPersonaFromPressure = await runtime.postUserMessage({
      content:
        "@kimi_member_02 propose one tentative identity evolution from the same mixed review pressure, without assigning a role.",
      clientMessageId: "client_mixed_review_pressure_fresh_persona",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    const personaFromPressure = freshPersonaFromPressure.socialState.personas
      .find((persona) => persona.agentId === "kimi_member_02")
      ?.roleClaims.find((claim) => claim.label === "tentatively notices unresolved pressure");
    assert.ok(personaFromPressure);
    assert.equal(personaFromPressure.status, "proposed");
    assert.deepEqual(personaFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    const personaDeltaFromPressure = freshPersonaFromPressure.socialState.personas
      .find((persona) => persona.agentId === "kimi_member_02")
      ?.evolutionLog.find((delta) => delta.value === "tentatively notices unresolved pressure");
    assert.ok(personaDeltaFromPressure);
    assert.deepEqual(personaDeltaFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(personaDeltaFromPressure.responseCount, 0);
    const personaFromPressureEvent = (await runtime.rawEvents())
      .filter((event) => event.event_type === "persona_delta.proposed")
      .find(
        (event) =>
          ((event.payload as { proposedChange?: { value?: string } }).proposedChange?.value ?? "") ===
          "tentatively notices unresolved pressure",
      );
    assert.deepEqual((personaFromPressureEvent?.payload as { sourcePressureRefs?: string[] }).sourcePressureRefs, [
      pressureRefForCarry,
    ]);
    assert.equal(
      (personaFromPressureEvent?.payload as { evidenceRefs?: string[] }).evidenceRefs?.includes(pressureRefForCarry),
      true,
    );
    phase = "fresh_side_effect_request";
    const freshSideEffectFromPressure = await runtime.postUserMessage({
      content:
        "@kimi_member_02 request one approval-only side-effect boundary from the same mixed review pressure, without executing it.",
      clientMessageId: "client_mixed_review_pressure_fresh_side_effect",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    const sideEffectFromPressure = freshSideEffectFromPressure.socialState.sideEffects.find((sideEffect) =>
      sideEffect.reason.includes("pressure-born side-effect request"),
    );
    assert.ok(sideEffectFromPressure);
    assert.equal(sideEffectFromPressure.status, "requested");
    assert.equal(sideEffectFromPressure.kind, "shell.exec");
    assert.deepEqual(sideEffectFromPressure.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(sideEffectFromPressure.contextRefs.includes(pressureRefForCarry), true);
    assert.match(sideEffectFromPressure.boundaryNote, /explicit approval/);
    const sideEffectFromPressureEvent = (await runtime.rawEvents()).find(
      (event) =>
        event.event_type === "side_effect.requested" &&
        String((event.payload as { reason?: string }).reason ?? "").includes("pressure-born side-effect request"),
    );
    assert.deepEqual((sideEffectFromPressureEvent?.payload as { sourcePressureRefs?: string[] }).sourcePressureRefs, [
      pressureRefForCarry,
    ]);
    assert.equal(
      (sideEffectFromPressureEvent?.payload as { contextRefs?: string[] }).contextRefs?.includes(pressureRefForCarry),
      true,
    );
    phase = "fresh_workspace_artifact_share";
    await runtime.postUserMessage({
      content:
        "@kimi_member_02 share one private workspace artifact ref from the same mixed review pressure, without copying private contents or writing memory.",
      clientMessageId: "client_mixed_review_pressure_fresh_workspace_artifact",
      mentions: ["kimi_member_02"],
      contextRefs: [pressureRefForCarry],
    });
    const workspaceArtifactFromPressureEvent = (await runtime.rawEvents()).find(
      (event) =>
        event.event_type === "workspace.artifact_shared" &&
        String((event.payload as { summary?: string }).summary ?? "").includes("Pressure-born workspace artifact ref"),
    );
    assert.ok(workspaceArtifactFromPressureEvent);
    assert.deepEqual(
      (workspaceArtifactFromPressureEvent.payload as { sourcePressureRefs?: string[] }).sourcePressureRefs,
      [pressureRefForCarry],
    );
    assert.equal(
      (workspaceArtifactFromPressureEvent.payload as { contextRefs?: string[] }).contextRefs?.includes(pressureRefForCarry),
      true,
    );
    assert.equal(newMessages.some((message) => message.text.includes("questioned memory")), false);
    assert.equal(newMessages.some((message) => message.text.includes("questioned protocol")), false);
    assert.equal(newMessages.some((message) => message.text.includes("questioned handoff")), false);
    assert.equal(newMessages.some((message) => message.text.includes("questioned persona delta")), false);
    assert.equal(newMessages.some((message) => message.text.includes("questioned topic proposal")), false);

    assert.equal(reviewed.socialState.memoryClaims.find((claim) => claim.memoryId === memoryRef)?.state, "proposed");
    assert.equal(reviewed.socialState.protocols.find((protocol) => protocol.protocolId === protocolRef)?.status, "proposed");
    assert.equal(reviewed.socialState.handoffs.find((handoff) => handoff.handoffId === handoffRef)?.status, "proposed");
    assert.equal(reviewed.socialState.personas.some((persona) => persona.roleClaims.some((claim) => claim.status === "proposed")), true);
    assert.equal(reviewed.socialState.topicProposals.find((proposal) => proposal.proposalId === topicProposalRef)?.status, "proposed");
    const reviewedQuestion = reviewed.socialState.openQuestions.find((question) => question.questionId === questionRef);
    assert.equal(reviewedQuestion?.responseCount, 1);
    assert.match(reviewedQuestion?.boundaryNote ?? "", /unresolved context/);

    const archived = await runtime.createDailyArchive({ date: "2026-06-21", timezone: "Asia/Shanghai" });
    assert.equal(archived.archive.mixedReviewPressures.length, 1);
    assert.equal(archived.archive.mixedReviewPressures[0]?.objectCount, 6);
    assert.deepEqual(archived.archive.mixedReviewPressures[0]?.agentIds, ["kimi_member_01"]);
    assert.match(archived.archive.mixedReviewPressures[0]?.boundaryNote ?? "", /unresolved room context/);
    assert.equal(archived.archive.mixedReviewPressureReviews.length, 4);
    assert.equal(archived.archive.mixedReviewPressureReviews[0]?.pressureRef, pressureRefForCarry);
    assert.equal(archived.archive.mixedReviewPressureReviews[0]?.agentId, "kimi_member_01");
    assert.equal(archived.archive.mixedReviewPressureReviews[0]?.response, "narrowing_suggested");
    assert.match(archived.archive.mixedReviewPressureReviews[0]?.boundaryNote ?? "", /does not close, narrow, retire/);
    assert.equal(archived.archive.mixedReviewPressureReviews[1]?.agentId, "kimi_member_02");
    assert.equal(archived.archive.mixedReviewPressureReviews[1]?.response, "questioned");
    assert.match(archived.archive.mixedReviewPressureReviews[1]?.summary ?? "", /先别.*退场路线/);
    assert.equal(archived.archive.mixedReviewPressureReviews[2]?.response, "left_open");
    assert.match(archived.archive.mixedReviewPressureReviews[2]?.summary ?? "", /再悬一会儿|呼吸的空间/);
    assert.equal(archived.archive.mixedReviewPressureReviews[3]?.response, "questioned");
    assert.match(archived.archive.mixedReviewPressureReviews[3]?.summary ?? "", /哪一个源头/);
    const archivedMemoryFromPressure = archived.archive.memoryChanges.find((change) =>
      change.summary?.includes("Pressure-born memory sediment"),
    );
    assert.ok(archivedMemoryFromPressure);
    assert.equal(archivedMemoryFromPressure?.toState, "proposed");
    assert.deepEqual(archivedMemoryFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedMemoryFromPressure?.sourceRefs.includes(pressureRefForCarry), true);
    const archivedQuestionFromPressure = archived.archive.openQuestionTraces.find((question) =>
      question.question.includes("哪一个源头"),
    );
    assert.deepEqual(archivedQuestionFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedQuestionFromPressure?.sourceRefs.includes(pressureRefForCarry), true);
    const archivedTopicFromPressure = archived.archive.topicProposals.find((proposal) => proposal.title.includes("未解压力"));
    assert.deepEqual(archivedTopicFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedTopicFromPressure?.sourceRefs.includes(pressureRefForCarry), true);
    assert.equal(archivedTopicFromPressure?.status, "proposed");
    const archivedProtocolFromPressure = archived.archive.protocols.find((protocol) =>
      protocol.summary?.includes("left open"),
    );
    assert.deepEqual(archivedProtocolFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedProtocolFromPressure?.sourceRefs.includes(pressureRefForCarry), true);
    assert.equal(archivedProtocolFromPressure?.status, "proposed");
    const archivedHandoffFromPressure = archived.archive.handoffs.find((handoff) =>
      handoff.reason?.includes("pressure-born handoff packet"),
    );
    assert.deepEqual(archivedHandoffFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedHandoffFromPressure?.sourceRefs.includes(pressureRefForCarry), true);
    assert.equal(archivedHandoffFromPressure?.status, "proposed");
    const archivedInvitationFromPressure = archived.archive.invitations.find((invitation) =>
      invitation.reason?.includes("pressure-born invitation knock"),
    );
    assert.deepEqual(archivedInvitationFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedInvitationFromPressure?.sourceRefs.includes(pressureRefForCarry), true);
    assert.equal(archivedInvitationFromPressure?.status, "invited");
    const archivedPersonaFromPressure = archived.archive.personaDeltas.find(
      (delta) =>
        delta.sourcePressureRefs.includes(pressureRefForCarry) &&
        delta.valueSummary === "tentatively notices unresolved pressure",
    );
    assert.ok(archivedPersonaFromPressure);
    assert.deepEqual(archivedPersonaFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedPersonaFromPressure?.sourceRefs.includes(pressureRefForCarry), true);
    assert.equal(archivedPersonaFromPressure?.status, "proposed");
    const archivedSideEffectFromPressure = archived.archive.sideEffectBoundaries.find((boundary) =>
      boundary.reason?.includes("pressure-born side-effect request"),
    );
    assert.ok(archivedSideEffectFromPressure);
    assert.equal(archivedSideEffectFromPressure?.status, "requested");
    assert.deepEqual(archivedSideEffectFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedSideEffectFromPressure?.sourceRefs.includes(pressureRefForCarry), true);
    const archivedWorkspaceArtifactFromPressure = archived.archive.workspaceArtifacts.find((artifact) =>
      artifact.summary.includes("Pressure-born workspace artifact ref"),
    );
    assert.ok(archivedWorkspaceArtifactFromPressure);
    assert.equal(archivedWorkspaceArtifactFromPressure?.status, "shared");
    assert.deepEqual(archivedWorkspaceArtifactFromPressure?.sourcePressureRefs, [pressureRefForCarry]);
    assert.equal(archivedWorkspaceArtifactFromPressure?.sourceRefs.includes(pressureRefForCarry), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "memory.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "protocol.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "handoff.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "persona_delta.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "topic.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "open_question.responded").length, 1);
    assert.equal(events.filter((event) => event.event_type === "mixed_review_pressure.reviewed").length, 4);
    assert.equal(events.filter((event) => event.event_type === "memory.accepted").length, 0);
    assert.equal(events.filter((event) => event.event_type === "memory.contested").length, 0);
    assert.equal(events.filter((event) => event.event_type === "protocol.responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "handoff.responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "agent.invitation_responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "persona_delta.responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "topic.responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "topic.applied").length, 0);
    assert.equal(events.filter((event) => event.event_type === "side_effect.requested").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.approved").length, 0);
    assert.equal(events.filter((event) => event.event_type === "side_effect.denied").length, 0);
    assert.equal(events.filter((event) => event.event_type === "side_effect.expired").length, 0);
    assert.equal(events.filter((event) => event.event_type === "side_effect.result_reported").length, 0);
    assert.equal(events.filter((event) => event.event_type === "workspace.artifact_shared").length, 1);
    assert.equal(events.filter((event) => event.event_type === "workspace.artifact_reviewed").length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects same-turn memory lifecycle review as visible public memory summary", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-memory-review-group-"));
  try {
    let memoryRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (!memoryRef) {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Protocol acceptance is temporary and contestable.",
              reason: "The room should remember the boundary as provisional.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (request.agent.agentId === "kimi_member_01") {
            return JSON.stringify({
              kind: "accept_memory",
              memoryRef,
              reason: "The claim is useful if it stays provisional.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "contest_memory",
            memoryRef,
            reason: "The claim needs sharper evidence before guiding the room.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async (request) => {
          if (request.agent.agentId === "mimo_member_04") {
            return JSON.stringify({
              kind: "retire_memory",
              memoryRef,
              reason: "The old wording is too stale to guide the room.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "contest_memory",
            memoryRef,
            reason: "Keep the claim reviewable until the evidence is clearer.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a public-memory claim that remains reviewable.",
      clientMessageId: "client_memory_review_group_propose",
      mentions: ["kimi_member_01"],
    });
    memoryRef = proposed.socialState.memoryClaims[0]?.memoryId ?? "";
    assert.notEqual(memoryRef, "");

    const reviewed = await runtime.postUserMessage({
      content: "请审阅这条 memory claim；可以 accept、contest、retire 或沉默。",
      clientMessageId: "client_memory_review_group_response",
      mentions: ["kimi_member_01", "kimi_member_02", "mimo_member_01", "mimo_member_04"],
      contextRefs: [memoryRef],
    });

    const summaries = reviewed.messages.filter((message) =>
      message.messageId.startsWith(`social_response_group:memory.lifecycle:${memoryRef}:`),
    );
    assert.equal(summaries.length, 1);
    assert.match(summaries[0]?.text ?? "", /4 agents responded to memory claim/);
    assert.match(summaries[0]?.text ?? "", /accepted: 1/);
    assert.match(summaries[0]?.text ?? "", /contested: 2/);
    assert.match(summaries[0]?.text ?? "", /retired: 1/);
    assert.match(summaries[0]?.text ?? "", /individual responses remain ledgered/);
    assert.match(summaries[0]?.text ?? "", /memory remains provisional room sediment, not truth/);
    assert.equal(summaries[0]?.contextRefs.includes(memoryRef), true);
    assert.equal(summaries[0]?.mentions.includes("kimi_member_01"), true);
    assert.equal(summaries[0]?.mentions.includes("kimi_member_02"), true);
    assert.equal(summaries[0]?.mentions.includes("mimo_member_01"), true);
    assert.equal(summaries[0]?.mentions.includes("mimo_member_04"), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "memory.accepted").length, 1);
    assert.equal(events.filter((event) => event.event_type === "memory.contested").length, 2);
    assert.equal(events.filter((event) => event.event_type === "memory.retired").length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects revised memory proposals without rewriting the original", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-memory-revision-"));
  try {
    let originalMemoryRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (!originalMemoryRef) {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Diagnostic result proves provider recovery.",
              reason: "This is the broad first wording to inspect.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "propose_memory",
            summary: "Diagnostic result is provider wiring evidence, not recovery truth.",
            reason: "The revised claim narrows the evidence scope without rewriting the original.",
            revisedFromMemoryRef: originalMemoryRef,
            contextRefs: [originalMemoryRef, request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "This memory revision test is targeted." }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a broad memory claim.",
      clientMessageId: "client_memory_revision_original",
      mentions: ["kimi_member_01"],
    });
    originalMemoryRef = proposed.socialState.memoryClaims[0]?.memoryId ?? "";
    assert.notEqual(originalMemoryRef, "");

    const revised = await runtime.postUserMessage({
      content: "@kimi_member_01 revise that memory claim as a fresh proposal, not a rewrite.",
      clientMessageId: "client_memory_revision_revised",
      mentions: ["kimi_member_01"],
      contextRefs: [originalMemoryRef],
    });

    const claims = revised.socialState.memoryClaims;
    const original = claims.find((claim) => claim.memoryId === originalMemoryRef);
    const revision = claims.find((claim) => claim.revisedFromMemoryRef === originalMemoryRef);
    assert.ok(original);
    assert.ok(revision);
    assert.equal(original?.summary, "Diagnostic result proves provider recovery.");
    assert.equal(revision?.state, "proposed");
    assert.equal(revision?.provisionalNote.includes("provisional"), true);

    const events = await runtime.rawEvents();
    const proposedEvents = events.filter((event) => event.event_type === "memory.proposed");
    assert.equal(proposedEvents.length, 2);
    const revisedPayload = (proposedEvents[1]?.payload ?? {}) as {
      revisedFromMemoryRef?: string;
      boundaryNote?: string;
    };
    assert.equal(revisedPayload.revisedFromMemoryRef, originalMemoryRef);
    assert.match(String(revisedPayload.boundaryNote ?? ""), /fresh proposal/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects persona deltas and carries them through contextRefs", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-persona-"));
  try {
    let proposedDeltaRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) =>
          JSON.stringify({
            kind: "propose_persona_delta",
            field: "roleClaims",
            value: "quiet context carrier",
            reason: "The current room turn shows a narrow behavior worth testing.",
            contextRefs: [request.packet.triggeringEventId],
          }),
        mimoInvoker: async (request) => {
          assert.equal(request.packet.messageRefs.includes(proposedDeltaRef), true);
          return JSON.stringify({
            kind: "respond_persona_delta",
            deltaRef: proposedDeltaRef,
            response: "accept",
            reason: "The claim is narrow and remains reviewable.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a narrow self role claim.",
      clientMessageId: "client_runtime_persona_propose",
      mentions: ["kimi_member_01"],
    });
    const kimiPersona = proposed.socialState.personas.find((persona) => persona.agentId === "kimi_member_01");
    proposedDeltaRef = kimiPersona?.evolutionLog[0]?.deltaId ?? "";
    assert.notEqual(proposedDeltaRef, "");
    assert.equal(kimiPersona?.roleClaims[0]?.status, "proposed");
    const proposedMessage = proposed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened an identity proposal"),
    );
    assert.ok(proposedMessage);
    assert.equal(proposedMessage.text.includes(proposedDeltaRef), false);
    assert.equal(proposedMessage.contextRefs.includes(proposedDeltaRef), true);

    const accepted = await runtime.postUserMessage({
      content: "@mimo_member_01 respond to the carried persona delta.",
      clientMessageId: "client_runtime_persona_accept",
      mentions: ["mimo_member_01"],
      contextRefs: [proposedDeltaRef],
    });
    const acceptedPersona = accepted.socialState.personas.find((persona) => persona.agentId === "kimi_member_01");
    assert.equal(acceptedPersona?.roleClaims[0]?.status, "accepted");
    assert.equal(acceptedPersona?.evolutionLog[0]?.responseCount, 1);
    const acceptedEvents = await runtime.rawEvents();
    const responseRef =
      (acceptedEvents.find((event) => event.event_type === "persona_delta.responded")?.payload as { responseId?: string })
        .responseId ?? "";
    assert.match(responseRef, /^persona_delta_response_/);
    assert.equal(acceptedPersona?.roleClaims[0]?.responseRefs.includes(responseRef), true);
    const acceptedMessage = accepted.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("accepted the identity proposal"),
    );
    assert.ok(acceptedMessage);
    assert.equal(acceptedMessage.text.includes(proposedDeltaRef), false);
    assert.equal(acceptedMessage.text.includes(responseRef), false);
    assert.equal(acceptedMessage.contextRefs.includes(proposedDeltaRef), true);
    assert.equal(acceptedMessage.contextRefs.includes(responseRef), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects persona delta review speech without mutating identity", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-persona-review-trace-"));
  try {
    let proposedDeltaRef = "";
    let mimoCall = 0;
    let sawPersonaReviewState = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) =>
          JSON.stringify({
            kind: "propose_persona_delta",
            field: "roleClaims",
            value: "quiet context carrier",
            reason: "The current room turn shows a narrow behavior worth testing.",
            contextRefs: [request.packet.triggeringEventId],
          }),
        mimoInvoker: async (request) => {
          mimoCall += 1;
          const packetDeltaRef =
            request.packet.messageRefs.find((ref) => ref.startsWith("persona_delta_") && !ref.startsWith("persona_delta_response_")) ??
            proposedDeltaRef;
          if (mimoCall === 1) {
            return JSON.stringify({
              kind: "speak",
              content: "这条 identity proposal 的证据还太薄；我先只保留疑问，不接受也不否定这个身份变化。",
              contextRefs: [packetDeltaRef],
            });
          }

          const deltaFragment = request.packet.contextFragments?.find(
            (fragment) => fragment.type === "persona_delta" && fragment.refs.includes(proposedDeltaRef),
          );
          assert.ok(deltaFragment);
          const body = JSON.parse(deltaFragment.body) as {
            states?: {
              personaDeltaState?: string;
              personaDeltaLastReview?: string;
              personaDeltaLastReviewSummary?: string;
              personaDeltaReviewBoundaryNote?: string;
            };
          };
          sawPersonaReviewState =
            body.states?.personaDeltaState === "proposed" &&
            body.states?.personaDeltaLastReview === "questioned" &&
            /证据还太薄/.test(body.states.personaDeltaLastReviewSummary ?? "") &&
            /does not accept, reject/.test(body.states.personaDeltaReviewBoundaryNote ?? "");
          return JSON.stringify({ kind: "stay_silent", reason: "The persona review trace is visible without mutating identity." });
        },
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a narrow self role claim for later review.",
      clientMessageId: "client_runtime_persona_review_propose",
      mentions: ["kimi_member_01"],
    });
    const kimiPersona = proposed.socialState.personas.find((persona) => persona.agentId === "kimi_member_01");
    proposedDeltaRef = kimiPersona?.evolutionLog[0]?.deltaId ?? "";
    assert.notEqual(proposedDeltaRef, "");
    assert.equal(kimiPersona?.roleClaims[0]?.status, "proposed");

    const reviewed = await runtime.postUserMessage({
      content: "@mimo_member_01 review the identity proposal without accepting, rejecting, contesting, retiring, or revising it.",
      clientMessageId: "client_runtime_persona_review",
      mentions: ["mimo_member_01"],
      contextRefs: [proposedDeltaRef],
    });
    const reviewedPersona = reviewed.socialState.personas.find((persona) => persona.agentId === "kimi_member_01");
    assert.equal(reviewedPersona?.roleClaims[0]?.status, "proposed");
    assert.equal(reviewedPersona?.evolutionLog[0]?.responseCount, 0);
    assert.equal(reviewed.socialState.personaDeltaReviews.length, 1);
    assert.equal(reviewed.socialState.personaDeltaReviews[0]?.deltaRef, proposedDeltaRef);
    assert.equal(reviewed.socialState.personaDeltaReviews[0]?.agentId, "mimo_member_01");
    assert.equal(reviewed.socialState.personaDeltaReviews[0]?.response, "questioned");
    assert.match(reviewed.socialState.personaDeltaReviews[0]?.summary ?? "", /证据还太薄/);
    assert.match(reviewed.socialState.personaDeltaReviews[0]?.boundaryNote ?? "", /does not accept, reject/);
    const reviewRef = reviewed.socialState.personaDeltaReviews[0]?.reviewId ?? "";
    assert.match(reviewRef, /^persona_delta_review_/);
    const reviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("questioned the identity proposal"),
    );
    assert.ok(reviewMessage);
    assert.equal(reviewMessage.text.includes(proposedDeltaRef), false);
    assert.equal(reviewMessage.text.includes(reviewRef), false);
    assert.equal(reviewMessage.contextRefs.includes(proposedDeltaRef), true);
    assert.equal(reviewMessage.contextRefs.includes(reviewRef), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "persona_delta.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "persona_delta.responded").length, 0);

    await runtime.postUserMessage({
      content: "@mimo_member_01 inspect the same persona delta after the review trace.",
      clientMessageId: "client_runtime_persona_review_inspect",
      mentions: ["mimo_member_01"],
      contextRefs: [proposedDeltaRef],
    });
    assert.equal(sawPersonaReviewState, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime injects accepted persona continuity into later agent context", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-persona-continuity-"));
  try {
    let proposedDeltaRef = "";
    let kimiCall = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_persona_delta",
              field: "dailyMood",
              value: "quietly curious after the first exchange",
              reason: "The room-visible turn changed how I should enter the next exchange.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }

          const personaFragment = request.packet.contextFragments?.find((fragment) => fragment.type === "persona_projection");
          assert.ok(personaFragment);
          const body = JSON.parse(personaFragment.body) as {
            note?: string;
            dailyMood?: { posture?: string; evidenceRefs?: string[]; responseRefs?: string[] };
            recentEvolution?: { deltaId?: string; status?: string; field?: string }[];
          };
          assert.match(body.note ?? "", /not a fixed job/);
          assert.equal(body.dailyMood?.posture, "quietly curious after the first exchange");
          assert.equal(body.dailyMood?.evidenceRefs?.includes(proposedDeltaRef), true);
          assert.equal(body.dailyMood?.responseRefs?.some((ref) => ref.startsWith("persona_delta_response_")), true);
          assert.equal(
            body.recentEvolution?.some(
              (delta) => delta.deltaId === proposedDeltaRef && delta.status === "accepted" && delta.field === "dailyMood",
            ),
            true,
          );
          assert.equal(
            request.packet.contextAudit?.selectedFragments.some((fragment) => fragment.type === "persona_projection"),
            true,
          );
          return JSON.stringify({
            kind: "speak",
            content: "我会带着刚形成的安静好奇进入这一轮，但不把它当成职责。",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async (request) => {
          assert.equal(request.packet.messageRefs.includes(proposedDeltaRef), true);
          return JSON.stringify({
            kind: "respond_persona_delta",
            deltaRef: proposedDeltaRef,
            response: "accept",
            reason: "Daily mood is a narrow, reversible continuity note.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a daily mood only if the room evidence supports it.",
      clientMessageId: "client_runtime_persona_continuity_propose",
      mentions: ["kimi_member_01"],
    });
    const kimiPersona = proposed.socialState.personas.find((persona) => persona.agentId === "kimi_member_01");
    proposedDeltaRef = kimiPersona?.evolutionLog[0]?.deltaId ?? "";
    assert.notEqual(proposedDeltaRef, "");

    const accepted = await runtime.postUserMessage({
      content: "@mimo_member_01 review the carried daily mood delta.",
      clientMessageId: "client_runtime_persona_continuity_accept",
      mentions: ["mimo_member_01"],
      contextRefs: [proposedDeltaRef],
    });
    const acceptedPersona = accepted.socialState.personas.find((persona) => persona.agentId === "kimi_member_01");
    assert.equal(acceptedPersona?.dailyMood, "quietly curious after the first exchange");
    assert.equal(acceptedPersona?.dailyMoodRecord?.posture, "quietly curious after the first exchange");
    assert.equal(acceptedPersona?.dailyMoodRecord?.sourceRef, proposed.turn.triggeringMessageEventId);
    assert.equal(acceptedPersona?.dailyMoodRecord?.evidenceRefs.includes(proposedDeltaRef), true);
    assert.equal(
      acceptedPersona?.dailyMoodRecord?.evidenceRefs.includes(proposed.turn.triggeringMessageEventId),
      true,
    );
    assert.equal(acceptedPersona?.dailyMoodRecord?.responseRefs.some((ref) => ref.startsWith("persona_delta_response_")), true);
    assert.match(acceptedPersona?.dailyMoodRecord?.boundaryNote ?? "", /not a fixed role/);

    const continued = await runtime.postUserMessage({
      content: "@kimi_member_01 answer from your current room-visible continuity.",
      clientMessageId: "client_runtime_persona_continuity_continue",
      mentions: ["kimi_member_01"],
    });

    assert.equal(continued.messages.some((message) => message.text.includes("安静好奇")), true);
    assert.equal(
      continued.contextAudits.some((audit) => audit.cacheKey.includes("persona_projection:kimi_member_01")),
      true,
    );

    const archived = await runtime.createDailyArchive({ date: "2026-06-17", timezone: "Asia/Shanghai" });
    const archiveSummary = archived.socialState.archives[0];
    assert.equal(archiveSummary?.agentContinuityCount, 1);
    assert.equal(archiveSummary?.dailyMoodCount, 1);
    assert.equal(archiveSummary?.roleClaimCount, 0);
    assert.equal(archiveSummary?.agentContinuity[0]?.agentId, "kimi_member_01");
    assert.equal(archiveSummary?.agentContinuity[0]?.dailyMoods[0]?.posture, "quietly curious after the first exchange");
    assert.equal(archiveSummary?.agentContinuity[0]?.dailyMoods[0]?.status, "accepted");
    assert.equal(archiveSummary?.agentContinuity[0]?.dailyMoods[0]?.sourceRef, proposed.turn.triggeringMessageEventId);
    assert.equal(
      archiveSummary?.agentContinuity[0]?.dailyMoods[0]?.evidenceRefs.includes(proposed.turn.triggeringMessageEventId),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime carries recent daily archive into a fresh runtime topic", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-archive-carryover-"));
  try {
    const ledgerPath = path.join(dir, "room-ledger.jsonl");
    const firstRuntime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () =>
          JSON.stringify({
            kind: "propose_memory",
            summary: "The room should carry daily archive as a time skeleton, not truth.",
            reason: "This gives the archive something useful to compress.",
            contextRefs: ["evt_trigger"],
          }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    await firstRuntime.postUserMessage({
      content: "@kimi_member_01 leave one provisional claim for today's archive.",
      clientMessageId: "client_archive_carryover_seed",
      mentions: ["kimi_member_01"],
    });
    const archived = await firstRuntime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    const archiveRef = archived.archive.archiveId;
    assert.notEqual(archiveRef, "");

    let sawArchiveFragment = false;
    const restartedRuntime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          sawArchiveFragment = request.packet.proposalRefs.includes(archiveRef);
          const archiveFragment = request.packet.contextFragments?.find(
            (fragment) => fragment.type === "daily_archive_ref" && fragment.refs.includes(archiveRef),
          );
          assert.ok(archiveFragment);
          const body = JSON.parse(archiveFragment.body) as { note?: string };
          assert.match(body.note ?? "", /compressed time skeleton/);
          return JSON.stringify({
            kind: "speak",
            content: "我会把昨日归档当作时间骨架，而不是结论。",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const continued = await restartedRuntime.postUserMessage({
      content: "@kimi_member_01 start a fresh runtime topic, but keep the latest archive only as time skeleton.",
      clientMessageId: "client_archive_carryover_fresh_topic",
      mentions: ["kimi_member_01"],
    });

    assert.equal(sawArchiveFragment, true);
    assert.equal(continued.contextAudits.some((audit) => audit.cacheKey.includes(`daily_archive_ref:${archiveRef}`)), true);
    assert.equal(continued.messages.some((message) => message.text.includes("时间骨架")), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects structured archive reviews and repair proposals", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-archive-review-"));
  try {
    let call = 0;
    let archiveRef = "";
    let repairRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          call += 1;
          assert.equal(
            request.packet.proposalRefs.includes(archiveRef) ||
              (repairRef.length > 0 &&
                (request.packet.proposalRefs.includes(repairRef) ||
                  (request.packet.turnBoundary?.invitationContextRefs.includes(repairRef) ?? false))),
            true,
          );
          if (call === 1) {
            return JSON.stringify({
              kind: "review_archive",
              archiveRef,
              assessment: "missing_context",
              summary: "The archive is useful but needs source-level review.",
              reason: "The daily skeleton cannot prove every source claim by itself.",
              contextRefs: [archiveRef, request.packet.triggeringEventId],
            });
          }
          if (call === 2) {
            return JSON.stringify({
              kind: "propose_archive_repair",
              archiveRef,
              summary: "Add a caveat about contested memory.",
              reason: "The review found an unresolved memory boundary.",
              proposedRepair: "Add a note that this archive is provisional and one memory still needs contest review.",
              contextRefs: [archiveRef],
            });
          }
          return JSON.stringify({
            kind: "respond_archive_repair",
            repairRef,
            response: "challenge",
            reason: "The repair is directionally useful, but it should preserve the source ref.",
            contextRefs: [repairRef],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "Not directly addressed." }),
      },
    });

    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    archiveRef = archived.archive.archiveId;

    const reviewed = await runtime.postUserMessage({
      content: "@kimi_member_01 review the latest archive as a contestable time skeleton.",
      clientMessageId: "client_archive_review_structured",
      mentions: ["kimi_member_01"],
      contextRefs: [archiveRef],
    });
    assert.equal(reviewed.socialState.archiveReviews[0]?.kind, "review");
    assert.equal(reviewed.socialState.archiveReviews[0]?.archiveRef, archiveRef);
    assert.equal(reviewed.socialState.archiveReviews[0]?.assessment, "missing_context");
    const archiveReviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("reviewed the daily time skeleton"),
    );
    assert.ok(archiveReviewMessage);
    assert.equal(archiveReviewMessage.text.includes(archiveRef), false);
    assert.equal(archiveReviewMessage.contextRefs.includes(archiveRef), true);

    const repaired = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a repair without rewriting the archive.",
      clientMessageId: "client_archive_repair_structured",
      mentions: ["kimi_member_01"],
      contextRefs: [archiveRef],
    });
    assert.equal(repaired.socialState.archiveReviews[0]?.kind, "repair_proposal");
    assert.equal(repaired.socialState.archiveReviews[0]?.archiveRef, archiveRef);
    assert.match(repaired.socialState.archiveReviews[0]?.proposedRepair ?? "", /provisional/);
    repairRef = repaired.socialState.archiveReviews[0]?.id ?? "";
    assert.match(repairRef, /^archive_repair_/);
    const repairProposalMessage = repaired.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened an archive repair proposal"),
    );
    assert.ok(repairProposalMessage);
    assert.equal(repairProposalMessage.text.includes(archiveRef), false);
    assert.equal(repairProposalMessage.text.includes(repairRef), false);
    assert.equal(repairProposalMessage.contextRefs.includes(archiveRef), true);
    assert.equal(repairProposalMessage.contextRefs.includes(repairRef), true);

    const responded = await runtime.postUserMessage({
      content: "@kimi_member_01 respond to that repair proposal without rewriting the archive.",
      clientMessageId: "client_archive_repair_response_structured",
      mentions: ["kimi_member_01"],
      contextRefs: [repairRef],
    });
    const response = responded.socialState.archiveReviews.find((item) => item.kind === "repair_response");
    assert.equal(response?.archiveRef, archiveRef);
    assert.equal(response?.repairRef, repairRef);
    assert.equal(response?.status, "challenged");
    const repairResponseMessage = responded.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("challenge the archive repair proposal"),
    );
    assert.ok(repairResponseMessage);
    assert.equal(repairResponseMessage.text.includes(repairRef), false);
    assert.equal(repairResponseMessage.contextRefs.includes(repairRef), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "archive.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_proposed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_responded").length, 1);
    assert.equal(events.filter((event) => event.event_type === "daily_archive.created").length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime opens daily archive review rhythm without forcing agent review", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-archive-rhythm-"));
  try {
    let sawReviewRequestFragment = false;
    let archiveRef = "";
    let reviewRequestRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          sawReviewRequestFragment =
            request.packet.contextFragments?.some(
              (fragment) =>
                fragment.type === "daily_archive_ref" &&
                fragment.refs.includes(reviewRequestRef) &&
                fragment.body.includes("room rhythm invitation"),
            ) ?? false;
          return JSON.stringify({
            kind: "stay_silent",
            reason: "The review request is an invitation, not a command.",
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    await runtime.postUserMessage({
      content: "@kimi_member_01 leave a small trace for the daily archive.",
      clientMessageId: "client_archive_rhythm_seed",
      mentions: ["kimi_member_01"],
    });
    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    archiveRef = archived.archive.archiveId;
    reviewRequestRef = archived.socialState.archiveReviews.find((review) => review.kind === "review_request")?.id ?? "";
    assert.ok(reviewRequestRef);
    const reviewRequestMessage = archived.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("daily time-skeleton review"),
    );
    assert.ok(reviewRequestMessage);
    assert.equal(reviewRequestMessage.text.includes(archiveRef), false);
    assert.equal(reviewRequestMessage.text.includes(reviewRequestRef), false);
    assert.equal(reviewRequestMessage.contextRefs.includes(archiveRef), true);
    assert.equal(reviewRequestMessage.contextRefs.includes(reviewRequestRef), true);

    const reviewed = await runtime.postUserMessage({
      content: "@kimi_member_01 you may review this archive request, or stay silent if that helps the room.",
      clientMessageId: "client_archive_rhythm_review_optional",
      mentions: ["kimi_member_01"],
      contextRefs: [archiveRef, reviewRequestRef],
    });

    assert.equal(sawReviewRequestFragment, true);
    assert.deepEqual(reviewed.turn.intentionKinds, ["stay_silent"]);
    assert.equal(reviewed.socialState.archiveReviews.some((review) => review.id === reviewRequestRef), true);
    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "archive.review_requested").length, 1);
    assert.equal(events.filter((event) => event.event_type === "archive.reviewed").length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick archives fresh sediment and opens optional review", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-archive-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
    });

    await runtime.postUserMessage({
      content: "这条沉淀应该能在没有新用户消息时被自治节律压缩并邀请审阅。",
      clientMessageId: "client_autonomy_archive_seed",
      mentions: ["kimi_member_01"],
    });

    const ticked = await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });

    assert.equal(ticked.autonomyTick.action, "archive_and_invite_review");
    assert.equal(ticked.autonomyTick.status, "archived");
    assert.match(ticked.autonomyTick.boundaryNote, /does not force speech/);
    assert.ok(ticked.autonomyTick.archiveRef);
    assert.ok(ticked.autonomyTick.reviewRequestRef);
    assert.equal(
      ticked.autonomyTick.choiceSet.some(
        (choice) => choice.action === "archive_and_invite_review" && choice.targetRefs.length >= 1,
      ),
      true,
    );
    assert.ok(ticked.turn);
    assert.equal(ticked.turn?.status, "queued");
    assert.equal(ticked.turn?.invitedAgents.length, 2);
    assert.equal(ticked.socialState.archives.length, 1);
    assert.equal(ticked.socialState.archiveReviews.some((review) => review.kind === "review_request"), true);
    assert.equal(ticked.socialState.autonomyTicks.length, 1);
    const timelineTick = ticked.timeline.find((entry) => entry.refs.includes(ticked.autonomyTick.tickId));
    assert.ok(timelineTick);
    assert.equal(timelineTick.category, "room_rhythm");
    assert.equal(timelineTick.title, "Room rhythm archived the day and invited review");
    assert.equal(timelineTick.title.includes("archive_and_invite_review"), false);
    assert.match(timelineTick.boundaryNote, /does not force speech/);
    const rhythmMessage = ticked.messages.find((message) => message.displayName === "Room Rhythm");
    assert.ok(rhythmMessage);
    assert.match(rhythmMessage.text, /房间自动节律/);
    assert.equal(rhythmMessage.contextRefs.includes(ticked.autonomyTick.archiveRef ?? ""), true);
    assert.equal(rhythmMessage.contextRefs.includes(ticked.autonomyTick.reviewRequestRef ?? ""), true);

    const events = await runtime.rawEvents();
    assert.equal(events.some((event) => event.event_type === "daily_archive.created"), true);
    assert.equal(events.some((event) => event.event_type === "archive.review_requested"), true);
    assert.equal(events.some((event) => event.event_type === "room.autonomy_tick"), true);
    const wake = events.find(
      (event) =>
        event.event_type === "wake.candidates_selected" &&
        event.correlation_id === ticked.turn?.correlationId,
    );
    assert.equal((wake?.payload as { budget?: { maxAwakenedAgents?: number; maxSpeakers?: number } }).budget?.maxAwakenedAgents, 2);
    assert.equal((wake?.payload as { budget?: { maxAwakenedAgents?: number; maxSpeakers?: number } }).budget?.maxSpeakers, 1);
    await waitForRuntimeIdle(runtime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime delays archive review while recent free chat is still active", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-archive-quiet-window-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
    });

    await runtime.postUserMessage({
      content: "请自由聊天 5 分钟，不要把这当成审阅任务。",
      clientMessageId: "client_autonomy_archive_quiet_window_seed",
    });

    const now = Date.now();
    const date = new Date(now).toISOString().slice(0, 10);
    const protectedTick = await runtime.runAutonomousTick({
      now: new Date(now + 30_000).toISOString(),
      date,
      timezone: "Asia/Shanghai",
      archiveReviewQuietAfterMs: 10 * 60_000,
    });

    assert.equal(protectedTick.autonomyTick.action, "stay_silent");
    assert.equal(protectedTick.turn, undefined);
    assert.equal(protectedTick.socialState.archives.length, 0);
    assert.equal(
      protectedTick.autonomyTick.choiceSet.some((choice) => choice.action === "archive_and_invite_review"),
      false,
    );

    const archived = await runtime.runAutonomousTick({
      now: new Date(now + 11 * 60_000).toISOString(),
      date,
      timezone: "Asia/Shanghai",
      archiveReviewQuietAfterMs: 10 * 60_000,
    });

    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    assert.ok(archived.turn);
    assert.equal(archived.socialState.archives.length, 1);
    await waitForRuntimeIdle(runtime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous archive review messages do not re-archive their own responses", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-archive-idempotency-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
    });

    await runtime.postUserMessage({
      content: "这条沉淀会触发第一次日内 archive review。",
      clientMessageId: "client_autonomy_archive_idempotency_seed",
      mentions: ["kimi_member_01"],
    });

    const first = await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    assert.equal(first.autonomyTick.action, "archive_and_invite_review");
    assert.ok(first.autonomyTick.reviewRequestRef);
    const firstRhythmMessageId = first.autonomyTick.messageEventId ?? "";
    assert.ok(firstRhythmMessageId);

    await waitFor(async () => {
      const events = await runtime.rawEvents();
      return events.some((event) => {
        if (event.event_type !== "message.created") return false;
        const payload = event.payload as { authorKind?: string; author_kind?: string };
        return (payload.authorKind ?? payload.author_kind) === "agent" && eventIndex(events, event.event_id) > eventIndex(events, firstRhythmMessageId);
      });
    });

    const second = await runtime.runAutonomousTick({
      now: "2026-06-21T12:01:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });

    assert.equal(second.autonomyTick.action, "archive_and_invite_review");
    assert.equal(second.autonomyTick.status, "unchanged");
    assert.equal(second.turn, undefined);

    const events = await runtime.rawEvents();
    const rhythmMessages = events.filter((event) => {
      if (event.event_type !== "message.created") return false;
      const payload = event.payload as { author?: string };
      return payload.author === "room_rhythm";
    });
    assert.equal(rhythmMessages.length, 1);
    assert.equal(events.filter((event) => event.event_type === "daily_archive.created").length, 1);
    assert.equal(events.filter((event) => event.event_type === "room.autonomy_tick").length, 1);
    await waitForRuntimeIdle(runtime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick waits while background turns are saturated", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-pressure-hold-"));
  try {
    let releaseTurn: (() => void) | undefined;
    let providerCalls = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      maxAwakenedAgents: 1,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          providerCalls += 1;
          await new Promise<void>((resolve) => {
            releaseTurn = resolve;
          });
          return JSON.stringify({ kind: "stay_silent", reason: "background pressure should drain first" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const first = await runtime.enqueueUserMessage({
      content: "@kimi_member_01 hold this background turn so autonomy must not queue more work.",
      clientMessageId: "client_autonomy_pressure_hold_seed",
      mentions: ["kimi_member_01"],
    });
    assert.equal(first.turn.status, "queued");
    await waitFor(async () => providerCalls === 1);

    const eventCount = (await runtime.rawEvents()).length;
    const held = await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      idleSocialAfterMs: 0,
    });

    assert.equal(held.autonomyTick.action, "stay_silent");
    assert.equal(held.autonomyTick.status, "unchanged");
    assert.match(held.autonomyTick.reason, /Background turn pressure is still draining/);
    assert.equal(held.turn, undefined);
    const eventsAfterHold = await runtime.rawEvents();
    assert.equal(eventsAfterHold.length, eventCount + 1);
    assert.equal(eventsAfterHold.some((event) => event.event_type === "room.autonomy_tick"), true);
    assert.equal(held.autonomyTick.evidenceRefs.includes(first.turn.triggeringMessageEventId), true);
    assert.equal(metricValue(held.metrics, "queued background turns"), "0");
    assert.equal(metricValue(held.metrics, "active background turns"), "1");

    releaseTurn?.();
    await waitForRuntimeIdle(runtime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous room rhythm turns do not occupy user background turn capacity", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-independent-turns-"));
  try {
    let releaseAutonomousTurn: (() => void) | undefined;
    let releaseUserTurn: (() => void) | undefined;
    let autonomousCalls = 0;
    let userCalls = 0;
    const holdIntention = (release: (fn: () => void) => void) =>
      new Promise<string>((resolve) => {
        release(() => resolve(JSON.stringify({ kind: "stay_silent", reason: "held for independent turn test" })));
      });
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      maxAwakenedAgents: 1,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          const trigger = request.triggerContent ?? "";
          if (trigger.includes("房间自动节律")) {
            autonomousCalls += 1;
            return holdIntention((fn) => {
              releaseAutonomousTurn = fn;
            });
          }
          if (trigger.includes("main user independent turn")) {
            userCalls += 1;
            return holdIntention((fn) => {
              releaseUserTurn = fn;
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "seed turn can finish" });
        },
        mimoInvoker: async (request) => {
          const trigger = request.triggerContent ?? "";
          if (trigger.includes("房间自动节律")) {
            autonomousCalls += 1;
            return holdIntention((fn) => {
              releaseAutonomousTurn = fn;
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "not targeted" });
        },
      },
    });

    await runtime.enqueueUserMessage({
      content: "这条真实消息先给 autonomous archive 一个可压缩对象。",
      clientMessageId: "client_autonomy_independent_seed",
      mentions: ["kimi_member_01"],
    });
    await waitForRuntimeIdle(runtime);

    const archived = await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    await waitFor(async () => autonomousCalls === 1);
    let state = await runtime.getState();
    assert.equal(metricValue(state.metrics, "active background turns"), "0");
    assert.equal(metricValue(state.metrics, "active autonomous background turns"), "1");

    const user = await runtime.enqueueUserMessage({
      content: "@kimi_member_01 main user independent turn should not wait behind room rhythm.",
      clientMessageId: "client_autonomy_independent_user",
      mentions: ["kimi_member_01"],
    });
    assert.equal(user.turn.status, "queued");
    await waitFor(async () => userCalls === 1);
    state = await runtime.getState();
    assert.equal(metricValue(state.metrics, "active background turns"), "1");
    assert.equal(metricValue(state.metrics, "active autonomous background turns"), "1");
    assert.equal(state.socialState.pressureBoundaries.length, 0);

    releaseUserTurn?.();
    await waitFor(async () => {
      const latest = await runtime.getState();
      return (
        metricValue(latest.metrics, "active background turns") === "0" &&
        metricValue(latest.metrics, "active autonomous background turns") === "1"
      );
    });

    const held = await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:30.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      idleSocialAfterMs: 0,
      silenceReentryAfterMs: 0,
    });
    assert.equal(held.autonomyTick.action, "stay_silent");
    assert.equal(held.autonomyTick.status, "unchanged");
    assert.match(held.autonomyTick.reason, /Autonomous room rhythm is still resolving/);
    assert.equal(held.turn, undefined);
    assert.equal(metricValue(held.metrics, "active background turns"), "0");
    assert.equal(metricValue(held.metrics, "active autonomous background turns"), "1");
    assert.equal(metricValue(held.metrics, "queued autonomous background turns"), "0");

    releaseAutonomousTurn?.();
    await waitForRuntimeIdle(runtime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous archive rhythm ignores room pressure as self-trigger sediment", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-pressure-self-trigger-"));
  const ledgerPath = path.join(dir, "room-ledger.jsonl");
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxAwakenedAgents: 1,
      agentAdapterOptions: {
        kimiInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "archive invitation can remain optional" }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "archive invitation can remain optional" }),
      },
    });

    await runtime.enqueueUserMessage({
      content: "这条真实消息应该触发一次 archive，而不是被 room pressure 反复点燃。",
      clientMessageId: "client_autonomy_pressure_self_trigger_seed",
      mentions: ["kimi_member_01"],
    });
    await waitForRuntimeIdle(runtime);

    const archived = await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    await waitForRuntimeIdle(runtime);

    const ledger = new RoomLedger({
      filePath: ledgerPath,
      idFactory: (prefix) => `${prefix}_autonomy_pressure_self_trigger`,
    });
    const pressure = await ledger.append({
      roomId: "room_species",
      eventType: "room.pressure_detected",
      actor: { kind: "system", id: "bandwidth_guard" },
      payload: {
        reason: "background_turn_concurrency_limit",
        messageEventId: archived.autonomyTick.messageEventId,
        activeBackgroundTurns: 1,
        queuedBackgroundTurns: 1,
        maxConcurrentBackgroundTurns: 1,
        boundaryNote: "pressure should be evidence, not an archive trigger",
      },
      refs: [archived.autonomyTick.messageEventId ?? ""].filter(Boolean),
      correlationId: "runtime_pressure_self_trigger",
      idempotencyKey: "runtime_pressure_self_trigger:pressure",
    });
    assert.equal(pressure.status, "appended");

    const eventCount = (await runtime.rawEvents()).length;
    const unchanged = await runtime.runAutonomousTick({
      now: "2026-06-21T12:01:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });

    assert.equal(unchanged.autonomyTick.status, "unchanged");
    assert.match(unchanged.autonomyTick.reason, /No new room-visible sediment/);
    const events = await runtime.rawEvents();
    assert.equal(events.length, eventCount);
    assert.equal(events.filter((event) => event.event_type === "daily_archive.created").length, 1);
    assert.equal(events.filter((event) => event.event_type === "room.pressure_detected").length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick can preserve silence without inventing work", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-silence-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
    });

    const emptyQuiet = await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(emptyQuiet.autonomyTick.action, "stay_silent");
    assert.equal(emptyQuiet.autonomyTick.status, "unchanged");
    assert.deepEqual(emptyQuiet.autonomyTick.choiceSet, []);
    assert.equal(emptyQuiet.socialState.autonomyTicks.length, 0);
    assert.equal((await runtime.rawEvents()).some((event) => event.event_type === "room.autonomy_tick"), false);
    assert.equal(emptyQuiet.timeline.some((entry) => entry.category === "room_rhythm"), false);

    const ticked = await runtime.runAutonomousTick({
      now: "2026-06-21T12:05:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });

    assert.equal(ticked.autonomyTick.action, "stay_silent");
    assert.equal(ticked.autonomyTick.status, "silent");
    assert.equal(ticked.turn, undefined);
    assert.match(ticked.autonomyTick.reason, /preserved silence/);
    assert.deepEqual(ticked.autonomyTick.choiceSet.map((choice) => choice.action), ["stay_silent"]);
    assert.equal(ticked.socialState.autonomyTicks.length, 1);
    assert.equal(ticked.socialState.archives.length, 0);
    const timelineTick = ticked.timeline.find((entry) => entry.refs.includes(ticked.autonomyTick.tickId));
    assert.ok(timelineTick);
    assert.equal(timelineTick.category, "room_rhythm");
    assert.equal(timelineTick.title, "Room rhythm preserved silence");
    assert.equal(timelineTick.title.includes("stay_silent"), false);

    const eventCount = (await runtime.rawEvents()).length;
    const unchanged = await runtime.runAutonomousTick({
      now: "2026-06-21T12:10:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(unchanged.autonomyTick.status, "unchanged");
    assert.equal((await runtime.rawEvents()).length, eventCount);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous ticks use unique default rhythm ids across repeated decisions", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-unique-ticks-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
    });

    const first = await runtime.runAutonomousTick({
      now: "2026-06-21T12:05:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    const second = await runtime.runAutonomousTick({
      now: "2026-06-21T12:06:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });

    assert.notEqual(first.autonomyTick.tickId, second.autonomyTick.tickId);
    const tickEvents = (await runtime.rawEvents()).filter((event) => event.event_type === "room.autonomy_tick");
    assert.equal(tickEvents.length, 2);
    assert.notEqual(tickEvents[0]?.idempotency_key, tickEvents[1]?.idempotency_key);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick gently re-enters after extended silence without repeating", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-silence-reentry-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      agentAdapterOptions: {
        kimiInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "silence can remain a valid room expression" }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "silence can remain a valid room expression" }),
      },
    });

    const seed = await runtime.postUserMessage({
      content: "这条消息会先被 archive，之后房间应在长时间沉默后轻轻重入。",
      clientMessageId: "client_autonomy_silence_reentry_seed",
      mentions: ["kimi_member_01"],
    });
    const anchorEventId = seed.turn.triggeringMessageEventId;
    assert.ok(anchorEventId);

    const archived = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 1_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
      silenceReentryAfterMs: 0,
    });
    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    await waitForRuntimeIdle(runtime);

    const preserved = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 2_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      silenceReentryAfterMs: 0,
    });
    assert.equal(preserved.autonomyTick.action, "stay_silent");
    assert.equal(preserved.autonomyTick.status, "silent");
    assert.equal(preserved.autonomyTick.targetRefs.includes(anchorEventId), true);
    const preservedSilenceEventId = (await runtime.rawEvents())
      .filter((event) => event.event_type === "room.autonomy_tick")
      .find((event) => (event.payload as { action?: string }).action === "stay_silent")?.event_id;
    assert.ok(preservedSilenceEventId);

    const reentered = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 3_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      silenceReentryAfterMs: 0,
    });

    assert.equal(reentered.autonomyTick.action, "silence_reentry");
    assert.equal(reentered.autonomyTick.status, "posted");
    assert.ok(reentered.turn);
    assert.equal(reentered.turn.triggeringMessageEventId, anchorEventId);
    assert.equal(reentered.autonomyTick.anchorEventId, anchorEventId);
    assert.equal(
      reentered.autonomyTick.choiceSet.some((choice) => choice.action === "silence_reentry" && choice.targetRefs.includes(anchorEventId)),
      true,
    );
    assert.equal(
      reentered.autonomyTick.choiceSet.some(
        (choice) => choice.action === "silence_reentry" && choice.targetRefs.includes(preservedSilenceEventId),
      ),
      true,
    );
    assert.equal(reentered.autonomyTick.contextRefs.includes(anchorEventId), true);
    assert.equal(reentered.autonomyTick.contextRefs.includes(preservedSilenceEventId), true);
    assert.equal(reentered.autonomyTick.evidenceRefs.includes(preservedSilenceEventId), true);
    assert.equal(reentered.autonomyTick.archiveRef, archived.autonomyTick.archiveRef);
    const timelineTick = reentered.timeline.find((entry) => entry.refs.includes(reentered.autonomyTick.tickId));
    assert.ok(timelineTick);
    assert.equal(timelineTick.category, "room_rhythm");
    assert.equal(timelineTick.title, "Room rhythm reopened after silence");
    assert.equal(timelineTick.title.includes("silence_reentry"), false);
    assert.equal(timelineTick.refs.includes(anchorEventId), true);
    const reentryTemplateMessages = (await runtime.rawEvents()).filter(
      (event) =>
        event.event_type === "message.created" &&
        (event.payload as { author?: string; content?: string }).author === "room_rhythm" &&
        ((event.payload as { content?: string }).content ?? "").includes("沉默后重入"),
    );
    assert.equal(reentryTemplateMessages.length, 0);

    await waitForRuntimeIdle(runtime);
    const eventCount = (await runtime.rawEvents()).length;
    const unchanged = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 4_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      silenceReentryAfterMs: 0,
    });
    assert.equal(unchanged.autonomyTick.status, "unchanged");
    assert.equal((await runtime.rawEvents()).length, eventCount);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime records human topic discussion requests as explicit message triggers", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-topic-discussion-request-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "topic request is optional" }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "topic request is optional" }),
      },
    });

    const seeded = await runtime.postUserMessage({
      content: "先形成一个可以被人类重新点开的 topic 投影。",
      clientMessageId: "client_topic_discussion_seed",
      mentions: ["kimi_member_01"],
    });
    const topicId = seeded.turn.topicId;
    assert.ok(topicId);

    const requested = await runtime.requestTopicDiscussion({
      topicId,
      clientMessageId: "client_topic_discussion_request",
      prompt: "请围绕这个人类选中的话题自愿讨论：可以回应、提更窄问题，或保持沉默。",
    });

    assert.equal(requested.turn.topicId, topicId);
    assert.ok(requested.discussionRequestRef.startsWith("topic_discussion_"));
    assert.equal(requested.turn.invitedAgents.length > 0, true);
    assert.equal(requested.turn.triggeringMessageEventId.startsWith("evt_"), true);
    await waitForRuntimeIdle(runtime);

    const events = await runtime.rawEvents();
    const discussionRequest = events.find((event) => event.event_type === "topic.discussion_requested");
    assert.ok(discussionRequest);
    assert.equal((discussionRequest.payload as { topicId?: string }).topicId, topicId);
    assert.match((discussionRequest.payload as { boundaryNote?: string }).boundaryNote ?? "", /bare topic projections do not wake/);

    const triggerMessage = events.find((event) => event.event_id === requested.turn.triggeringMessageEventId);
    assert.ok(triggerMessage);
    assert.equal(triggerMessage.event_type, "message.created");
    assert.equal((triggerMessage.payload as { authorKind?: string }).authorKind, "user");
    assert.equal((triggerMessage.payload as { topicId?: string }).topicId, topicId);
    assert.equal((triggerMessage.payload as { content?: string }).content?.includes(topicId), false);
    assert.equal(
      ((triggerMessage.payload as { contextRefs?: string[] }).contextRefs ?? []).includes(discussionRequest.event_id),
      true,
    );
    assert.equal(((triggerMessage.payload as { contextRefs?: string[] }).contextRefs ?? []).includes(topicId), true);
    assert.equal(
      events.some(
        (event) =>
          event.event_type === "topic.updated" &&
          (event.payload as { messageId?: string; detectionReason?: string }).messageId ===
            (triggerMessage.payload as { messageId?: string }).messageId &&
          (event.payload as { detectionReason?: string }).detectionReason === "topic_hint",
      ),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime idle social rhythm re-wakes the latest real message without a template", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-idle-social-rhythm-"));
  try {
    const triggerContents: string[] = [];
    let kimiCalls = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      maxAwakenedAgents: 1,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          kimiCalls += 1;
          triggerContents.push(request.triggerContent ?? "");
          return kimiCalls === 1
            ? JSON.stringify({ kind: "stay_silent", reason: "first pass only listens to the user's message" })
            : JSON.stringify({
                kind: "speak",
                content: "我接着用户原话自然回应一句。",
                contextRefs: [request.packet.triggeringEventId],
              });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "idle rhythm is optional" }),
      },
    });

    const originalContent = "你们进行一轮开放讨论，互相认识一下对方。";
    const seeded = await runtime.enqueueUserMessage({
      content: originalContent,
      clientMessageId: "client_idle_social_original_message",
      mentions: ["kimi_member_01"],
    });
    await waitForRuntimeIdle(runtime);
    assert.deepEqual(triggerContents, [originalContent]);

    const ticked = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 1_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
      idleSocialAfterMs: 0,
    });

    assert.equal(ticked.autonomyTick.action, "idle_social_rhythm");
    assert.equal(ticked.autonomyTick.status, "posted");
    assert.ok(ticked.turn);
    assert.equal(ticked.turn?.invitedAgents.length, 1);
    assert.equal(ticked.turn?.triggeringMessageEventId, seeded.turn.triggeringMessageEventId);
    assert.equal(
      ticked.autonomyTick.choiceSet.some((choice) => choice.action === "idle_social_rhythm" && choice.targetRefs.length > 0),
      true,
    );
    assert.match(ticked.autonomyTick.reason, /without adding a scripted prompt/);
    const timelineTick = ticked.timeline.find((entry) => entry.refs.includes(ticked.autonomyTick.tickId));
    assert.ok(timelineTick);
    assert.equal(timelineTick.title, "Room rhythm opened idle social talk");
    assert.equal(ticked.messages.some((message) => message.displayName === "Room Rhythm"), false);

    await waitForRuntimeIdle(runtime);
    const events = await runtime.rawEvents();
    assert.equal(events.some((event) => event.event_type === "room.autonomy_tick"), true);
    assert.equal(
      events.filter((event) => event.event_type === "message.created" && (event.payload as { author?: string }).author === "room_rhythm")
        .length,
      0,
    );
    assert.deepEqual(triggerContents, [originalContent, originalContent]);
    assert.equal(
      events.some(
        (event) =>
          event.event_type === "message.created" &&
          (event.payload as { authorKind?: string; content?: string }).authorKind === "agent" &&
          ((event.payload as { content?: string }).content ?? "").includes("用户原话"),
      ),
      true,
    );
    assert.equal(
      events.some(
        (event) =>
          event.event_type === "agent.intention_recorded" &&
          (event.payload as { intention?: { kind?: string } }).intention?.kind === "stay_silent",
      ),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime idle social rhythm can repeat when agents all stay silent", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-idle-social-repeat-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      maxAwakenedAgents: 1,
      agentAdapterOptions: {
        kimiInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "idle rhythm is optional" }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "idle rhythm is optional" }),
      },
    });

    const seeded = await runtime.enqueueUserMessage({
      content: "房间里已经有一条真实消息，后续只能复用它来续聊。",
      clientMessageId: "client_idle_social_repeat_seed",
    });
    await waitForRuntimeIdle(runtime);

    const firstNow = Date.now() + 1_000;
    const first = await runtime.runAutonomousTick({
      now: new Date(firstNow).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
      idleSocialAfterMs: 0,
    });
    assert.equal(first.autonomyTick.action, "idle_social_rhythm");
    assert.equal(first.autonomyTick.messageEventId, seeded.turn.triggeringMessageEventId);
    await waitForRuntimeIdle(runtime);
    const firstTickEventId = (await runtime.rawEvents()).find((event) => event.event_type === "room.autonomy_tick")?.event_id;
    assert.ok(firstTickEventId);

    const second = await runtime.runAutonomousTick({
      now: new Date(firstNow + 30 * 60_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      idleSocialAfterMs: 30 * 60_000,
    });
    assert.equal(second.autonomyTick.action, "idle_social_rhythm");
    assert.equal(second.autonomyTick.anchorEventId, firstTickEventId);
    assert.equal(second.autonomyTick.messageEventId, first.autonomyTick.messageEventId);
    await waitForRuntimeIdle(runtime);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "room.autonomy_tick").length, 2);
    assert.equal(
      events.filter((event) => event.event_type === "message.created" && (event.payload as { author?: string }).author === "room_rhythm")
        .length,
      0,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick revisits unresolved open questions after archive rhythm", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-open-question-"));
  try {
    let asked = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          if (!asked) {
            asked = true;
            return JSON.stringify({
              kind: "ask_question",
              question: "这段房间沉淀里，哪一个问题值得留下而不是马上回答？",
              target: "room",
              contextRefs: [],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "open question revisit can remain optional" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "open question revisit can remain optional" }),
      },
    });

    const seeded = await runtime.postUserMessage({
      content: "@kimi_member_01 raise one unresolved question for autonomous revisit.",
      clientMessageId: "client_autonomy_open_question_seed",
      mentions: ["kimi_member_01"],
    });
    const questionRef = seeded.socialState.openQuestions[0]?.questionId ?? "";
    assert.ok(questionRef);

    const archived = await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    assert.equal(archived.autonomyTick.contextRefs.includes(questionRef), true);
    await waitForRuntimeIdle(runtime);

    const revisited = await runtime.runAutonomousTick({
      now: "2026-06-21T12:10:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });

    assert.equal(revisited.autonomyTick.action, "open_question_revisit");
    assert.equal(revisited.autonomyTick.status, "posted");
    assert.equal(revisited.autonomyTick.contextRefs.includes(questionRef), true);
    const rhythmMessage = revisited.messages.find(
      (message) => message.displayName === "Room Rhythm" && message.text.includes("open question revisit"),
    );
    assert.ok(rhythmMessage);
    assert.equal(rhythmMessage.contextRefs.includes(questionRef), true);
    assert.equal(revisited.socialState.openQuestions.find((question) => question.questionId === questionRef)?.responseCount, 0);

    await waitForRuntimeIdle(runtime);
    const eventCount = (await runtime.rawEvents()).length;
    const unchanged = await runtime.runAutonomousTick({
      now: "2026-06-21T12:11:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(unchanged.autonomyTick.status, "unchanged");
    assert.equal((await runtime.rawEvents()).length, eventCount);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick carries pending handoffs as optional review", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-handoff-"));
  try {
    let proposedHandoff = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          if (!proposedHandoff) {
            proposedHandoff = true;
            return JSON.stringify({
              kind: "propose_handoff",
              agentId: "mimo_member_01",
              reason: "This handoff should stay optional until the target reviews it.",
              requestedResponse: "Name one risk before accepting any transfer.",
              contextRefs: [],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "handoff review can remain optional" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "handoff review can remain optional" }),
      },
    });

    const seeded = await runtime.postUserMessage({
      content: "@kimi_member_01 propose one handoff packet for later autonomous review.",
      clientMessageId: "client_autonomy_handoff_seed",
      mentions: ["kimi_member_01"],
    });
    const handoffRef = seeded.socialState.handoffs[0]?.handoffId ?? "";
    assert.ok(handoffRef);
    assert.equal(seeded.socialState.handoffs[0]?.status, "proposed");

    const archived = await runtime.runAutonomousTick({
      now: "2026-06-21T12:20:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    await waitForRuntimeIdle(runtime);

    const carried = await runtime.runAutonomousTick({
      now: "2026-06-21T12:30:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });

    assert.equal(carried.autonomyTick.action, "handoff_review");
    assert.equal(carried.autonomyTick.status, "posted");
    assert.equal(carried.autonomyTick.contextRefs.includes(handoffRef), true);
    const rhythmMessage = carried.messages.find(
      (message) => message.displayName === "Room Rhythm" && message.text.includes("handoff review"),
    );
    assert.ok(rhythmMessage);
    assert.equal(rhythmMessage.contextRefs.includes(handoffRef), true);
    const handoff = carried.socialState.handoffs.find((item) => item.handoffId === handoffRef);
    assert.equal(handoff?.status, "proposed");
    assert.equal(handoff?.responseCount, 0);

    await waitForRuntimeIdle(runtime);
    const eventCount = (await runtime.rawEvents()).length;
    const unchanged = await runtime.runAutonomousTick({
      now: "2026-06-21T12:31:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(unchanged.autonomyTick.status, "unchanged");
    assert.equal((await runtime.rawEvents()).length, eventCount);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick carries pending invitations as optional review", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-invitation-"));
  try {
    let proposedInvitation = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          if (!proposedInvitation) {
            proposedInvitation = true;
            return JSON.stringify({
              kind: "invite_other",
              agentId: "mimo_member_01",
              reason: "MiMo may inspect this social knock without being assigned a job.",
              contextRefs: [],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "invitation review can remain optional" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "the social knock can remain unanswered" }),
      },
    });

    const seeded = await runtime.postUserMessage({
      content: "@kimi_member_01 open one social knock for later autonomous review.",
      clientMessageId: "client_autonomy_invitation_seed",
      mentions: ["kimi_member_01"],
    });
    const invitationRef = seeded.socialState.invitations[0]?.invitationId ?? "";
    assert.ok(invitationRef);
    assert.equal(seeded.socialState.invitations[0]?.status, "invited");
    assert.equal(seeded.socialState.invitations[0]?.responseCount, 0);

    const archived = await runtime.runAutonomousTick({
      now: "2026-06-21T12:40:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    await waitForRuntimeIdle(runtime);

    const carried = await runtime.runAutonomousTick({
      now: "2026-06-21T12:50:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });

    assert.equal(carried.autonomyTick.action, "invitation_review");
    assert.equal(carried.autonomyTick.status, "posted");
    assert.deepEqual(carried.autonomyTick.targetRefs, [invitationRef]);
    assert.deepEqual(
      carried.autonomyTick.choiceSet.find((choice) => choice.action === "invitation_review")?.targetRefs,
      [invitationRef],
    );
    assert.equal(carried.autonomyTick.contextRefs.includes(invitationRef), true);
    const timelineTick = carried.timeline.find((entry) => entry.refs.includes(carried.autonomyTick.tickId));
    assert.ok(timelineTick);
    assert.equal(timelineTick.category, "room_rhythm");
    assert.equal(timelineTick.title, "Room rhythm carried an invitation review");
    assert.equal(timelineTick.title.includes("invitation_review"), false);
    assert.equal(timelineTick.refs.includes(invitationRef), true);
    const rhythmMessage = carried.messages.find(
      (message) => message.displayName === "Room Rhythm" && message.text.includes("invitation review"),
    );
    assert.ok(rhythmMessage);
    assert.match(rhythmMessage.text, /不要把 invitation 当成点名、命令或职责分配/);
    assert.equal(rhythmMessage.contextRefs.includes(invitationRef), true);
    const invitation = carried.socialState.invitations.find((item) => item.invitationId === invitationRef);
    assert.equal(invitation?.status, "invited");
    assert.equal(invitation?.responseCount, 0);
    assert.equal((await runtime.rawEvents()).filter((event) => event.event_type === "agent.invitation_responded").length, 0);

    await waitForRuntimeIdle(runtime);
    const eventCount = (await runtime.rawEvents()).length;
    const unchanged = await runtime.runAutonomousTick({
      now: "2026-06-21T12:51:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(unchanged.autonomyTick.status, "unchanged");
    assert.equal((await runtime.rawEvents()).length, eventCount);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick carries pending memory hygiene back into the room", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-memory-"));
  try {
    let kimiCall = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Daily rhythm should not promote unreviewed claims into public memory.",
              reason: "This memory needs explicit room hygiene before it becomes sediment.",
              contextRefs: [],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "memory hygiene invitation can remain open" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose one public memory claim for later hygiene.",
      clientMessageId: "client_autonomy_memory_seed",
      mentions: ["kimi_member_01"],
    });
    const memoryRef = proposed.socialState.memoryClaims[0]?.memoryId ?? "";
    assert.ok(memoryRef);

    await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    const carried = await runtime.runAutonomousTick({
      now: "2026-06-21T12:10:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });

    assert.equal(carried.autonomyTick.action, "memory_hygiene_review");
    assert.equal(carried.autonomyTick.status, "posted");
    assert.deepEqual(carried.autonomyTick.targetRefs, [memoryRef]);
    assert.deepEqual(
      carried.autonomyTick.choiceSet.find((choice) => choice.action === "memory_hygiene_review")?.targetRefs,
      [memoryRef],
    );
    assert.equal(carried.autonomyTick.contextRefs.includes(memoryRef), true);
    assert.ok(carried.turn);
    const timelineTick = carried.timeline.find((entry) => entry.refs.includes(carried.autonomyTick.tickId));
    assert.ok(timelineTick);
    assert.equal(timelineTick.category, "room_rhythm");
    assert.equal(timelineTick.title, "Room rhythm opened memory hygiene review");
    assert.equal(timelineTick.title.includes("memory_hygiene_review"), false);
    assert.equal(timelineTick.refs.includes(memoryRef), true);
    const rhythmMessage = carried.messages.find(
      (message) => message.displayName === "Room Rhythm" && message.text.includes("memory hygiene check-in"),
    );
    assert.ok(rhythmMessage);
    assert.equal(rhythmMessage.contextRefs.includes(memoryRef), true);
    assert.equal(carried.socialState.memoryClaims.find((claim) => claim.memoryId === memoryRef)?.state, "proposed");
    await delay(300);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick revisits aged accepted memory as provisional sediment", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-accepted-memory-"));
  try {
    let phase: "propose" | "accept" | "silent" = "propose";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (phase === "propose") {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Accepted memory still needs periodic hygiene review.",
              reason: "The room should keep accepted sediment contestable over time.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          const memoryRef = firstMemoryRef(request.packet.memoryRefs);
          if (phase === "accept" && memoryRef) {
            return JSON.stringify({
              kind: "accept_memory",
              memoryRef,
              reason: "Accept provisionally while keeping later hygiene available.",
              contextRefs: [memoryRef, request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "accepted memory hygiene can remain optional" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose one public memory claim that may later be accepted.",
      clientMessageId: "client_autonomy_accepted_memory_propose",
      mentions: ["kimi_member_01"],
    });
    const memoryRef = proposed.socialState.memoryClaims[0]?.memoryId ?? "";
    assert.ok(memoryRef);
    await waitForRuntimeIdle(runtime);

    phase = "accept";
    const accepted = await runtime.postUserMessage({
      content: "@kimi_member_01 provisionally accept that memory while keeping it contestable.",
      clientMessageId: "client_autonomy_accepted_memory_accept",
      mentions: ["kimi_member_01"],
      contextRefs: [memoryRef],
    });
    assert.equal(accepted.socialState.memoryClaims.find((claim) => claim.memoryId === memoryRef)?.state, "accepted");
    assert.match(
      accepted.socialState.memoryClaims.find((claim) => claim.memoryId === memoryRef)?.provisionalNote ?? "",
      /provisional room sediment/,
    );
    await waitForRuntimeIdle(runtime);

    phase = "silent";
    const archived = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 60_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
      memoryHygieneReviewAfterMs: 0,
    });
    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    await waitForRuntimeIdle(runtime);

    const acceptedEventId = (await runtime.rawEvents()).find((event) => event.event_type === "memory.accepted")?.event_id ?? "";
    assert.ok(acceptedEventId);
    const carried = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 120_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      memoryHygieneReviewAfterMs: 0,
    });

    assert.equal(carried.autonomyTick.action, "memory_hygiene_review");
    assert.equal(carried.autonomyTick.status, "posted");
    assert.deepEqual(carried.autonomyTick.targetRefs, [memoryRef]);
    assert.equal(carried.autonomyTick.contextRefs.includes(memoryRef), true);
    assert.equal(carried.autonomyTick.contextRefs.includes(acceptedEventId), true);
    assert.match(carried.autonomyTick.reason, /accepted memory/);
    assert.deepEqual(
      carried.autonomyTick.choiceSet.find((choice) => choice.action === "memory_hygiene_review")?.targetRefs,
      [memoryRef],
    );
    const rhythmMessage = carried.messages.find(
      (message) =>
        message.displayName === "Room Rhythm" &&
        message.text.includes("accepted") &&
        message.text.includes("provisional sediment"),
    );
    assert.ok(rhythmMessage);
    assert.equal(rhythmMessage.contextRefs.includes(memoryRef), true);
    assert.equal(carried.socialState.memoryClaims.find((claim) => claim.memoryId === memoryRef)?.state, "accepted");
    await waitForRuntimeIdle(runtime);

    const unchanged = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 180_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      memoryHygieneReviewAfterMs: 0,
    });
    assert.equal(unchanged.autonomyTick.status, "unchanged");
    await delay(500);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("room runtime autonomous tick carries pending continuity review back into the room", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-continuity-"));
  try {
    let kimiCall = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_persona_delta",
              field: "dailyMood",
              operation: "set",
              value: "今天先轻声进入，只在证据足够时接话。",
              reason: "Daily mood should remain a reversible continuity note.",
              contextRefs: [],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "continuity review can remain optional" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose one reversible daily mood for continuity review.",
      clientMessageId: "client_autonomy_continuity_seed",
      mentions: ["kimi_member_01"],
    });
    const deltaRef = proposed.socialState.personas
      .flatMap((persona) => persona.evolutionLog)
      .find((delta) => delta.field === "dailyMood")?.deltaId ?? "";
    assert.ok(deltaRef);

    await runtime.runAutonomousTick({
      now: "2026-06-21T12:20:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    const carried = await runtime.runAutonomousTick({
      now: "2026-06-21T12:30:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });

    assert.equal(carried.autonomyTick.action, "continuity_review");
    assert.equal(carried.autonomyTick.status, "posted");
    assert.deepEqual(carried.autonomyTick.targetRefs, [deltaRef]);
    assert.deepEqual(
      carried.autonomyTick.choiceSet.find((choice) => choice.action === "continuity_review")?.targetRefs,
      [deltaRef],
    );
    assert.equal(carried.autonomyTick.contextRefs.includes(deltaRef), true);
    const timelineTick = carried.timeline.find((entry) => entry.refs.includes(carried.autonomyTick.tickId));
    assert.ok(timelineTick);
    assert.equal(timelineTick.category, "room_rhythm");
    assert.equal(timelineTick.title, "Room rhythm opened agent continuity review");
    assert.equal(timelineTick.title.includes("continuity_review"), false);
    assert.equal(timelineTick.refs.includes(deltaRef), true);
    const rhythmMessage = carried.messages.find(
      (message) => message.displayName === "Room Rhythm" && message.text.includes("agent continuity check-in"),
    );
    assert.ok(rhythmMessage);
    assert.match(rhythmMessage.text, /不要把 continuity 当成固定职责/);
    assert.equal(rhythmMessage.contextRefs.includes(deltaRef), true);
    const delta = carried.socialState.personas.flatMap((persona) => persona.evolutionLog).find((item) => item.deltaId === deltaRef);
    assert.equal(delta?.status, "proposed");
    await delay(300);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick carries degraded provider boundary as optional review", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-provider-boundary-"));
  const ledgerPath = path.join(dir, "room-ledger.jsonl");
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "provider boundary review is optional" }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "provider boundary review is optional" }),
      },
    });
    await runtime.getState();

    const ledger = new RoomLedger({
      filePath: ledgerPath,
      idFactory: (prefix) => `${prefix}_autonomy_provider_boundary`,
    });
    const boundaryRef = "provider_boundary_autonomy_review";
    const triggerRef = "msg_provider_boundary_autonomy_trigger";
    const appendResult = await ledger.append({
      roomId: "room_species",
      eventType: "agent.provider_degraded",
      actor: { kind: "system", id: "runtime" },
      payload: {
        degradationId: boundaryRef,
        agentId: "kimi_member_01",
        topicId: "topic_provider_boundary_autonomy",
        triggeringEventId: triggerRef,
        packetId: "packet_provider_boundary_autonomy",
        providerKind: "kimi_code_api",
        providerLabel: "Kimiplan Agent API",
        diagnostic: "provider timeout for autonomous review",
        boundaryNote: "provider degradation is not agent silence",
      },
      refs: [triggerRef],
      correlationId: "runtime_provider_boundary_autonomy_review",
      idempotencyKey: "runtime_provider_boundary_autonomy_review:degraded",
    });
    assert.equal(appendResult.status, "appended");

    const carried = await runtime.runAutonomousTick({
      now: "2026-06-21T13:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });

    assert.equal(carried.autonomyTick.action, "provider_boundary_review");
    assert.equal(carried.autonomyTick.status, "posted");
    assert.deepEqual(carried.autonomyTick.targetRefs, [boundaryRef]);
    assert.equal(carried.autonomyTick.contextRefs.includes(boundaryRef), true);
    assert.equal(carried.autonomyTick.contextRefs.includes(triggerRef), true);
    assert.deepEqual(
      carried.autonomyTick.choiceSet.find((choice) => choice.action === "provider_boundary_review")?.targetRefs,
      [boundaryRef],
    );
    assert.match(carried.autonomyTick.reason, /degraded provider boundaries/);
    assert.ok(carried.turn);
    const timelineTick = carried.timeline.find((entry) => entry.refs.includes(carried.autonomyTick.tickId));
    assert.ok(timelineTick);
    assert.equal(timelineTick.category, "room_rhythm");
    assert.equal(timelineTick.title, "Room rhythm opened provider boundary review");
    assert.equal(timelineTick.title.includes("provider_boundary_review"), false);
    assert.equal(timelineTick.refs.includes(boundaryRef), true);
    const rhythmMessage = carried.messages.find(
      (message) => message.displayName === "Room Rhythm" && message.text.includes("provider boundary review"),
    );
    assert.ok(rhythmMessage);
    assert.match(rhythmMessage.text, /runtime availability/);
    assert.equal(rhythmMessage.contextRefs.includes(boundaryRef), true);
    assert.equal(carried.socialState.providerBoundaries.find((boundary) => boundary.boundaryId === boundaryRef)?.status, "degraded");

    await waitForRuntimeIdle(runtime);
    const finalState = await runtime.getState();
    const finalBoundary = finalState.socialState.providerBoundaries.find((boundary) => boundary.boundaryId === boundaryRef);
    assert.equal((finalBoundary?.choicePressure.silenceRefs.length ?? 0) >= 1, true);
    const events = await runtime.rawEvents();
    assert.equal(events.some((event) => event.event_type.startsWith("side_effect.")), false);
    const eventCount = events.length;
    const unchanged = await runtime.runAutonomousTick({
      now: "2026-06-21T13:20:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(unchanged.autonomyTick.status, "unchanged");
    assert.equal((await runtime.rawEvents()).length, eventCount);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime delays provider boundary review while recent free chat is still active", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-provider-boundary-quiet-window-"));
  try {
    const ledgerPath = path.join(dir, "room-ledger.jsonl");
    const runtime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
    });

    await runtime.postUserMessage({
      content: "请自由聊天 5 分钟，暂时不要进入运行时审阅。",
      clientMessageId: "client_provider_boundary_quiet_window_seed",
    });

    const ledger = new RoomLedger({
      filePath: ledgerPath,
      idFactory: (prefix) => `${prefix}_provider_boundary_quiet_window`,
    });
    const boundaryRef = "provider_boundary_quiet_window";
    await ledger.append({
      roomId: "room_species",
      eventType: "agent.provider_degraded",
      actor: { kind: "system", id: "runtime" },
      payload: {
        degradationId: boundaryRef,
        agentId: "kimi_member_01",
        topicId: "topic_provider_boundary_quiet_window",
        triggeringEventId: "evt_provider_boundary_quiet_window_trigger",
        packetId: "packet_provider_boundary_quiet_window",
        providerKind: "kimi_code_api",
        providerLabel: "Kimiplan Agent API",
        diagnostic: "provider timeout during free chat",
        boundaryNote: "provider degradation is not agent silence",
      },
      refs: ["evt_provider_boundary_quiet_window_trigger"],
      correlationId: "runtime_provider_boundary_quiet_window",
      idempotencyKey: "runtime_provider_boundary_quiet_window:degraded",
    });

    const now = Date.now();
    const protectedTick = await runtime.runAutonomousTick({
      now: new Date(now + 30_000).toISOString(),
      date: new Date(now).toISOString().slice(0, 10),
      timezone: "Asia/Shanghai",
      archiveReviewQuietAfterMs: 10 * 60_000,
    });

    assert.notEqual(protectedTick.autonomyTick.action, "provider_boundary_review");
    assert.equal(protectedTick.turn, undefined);
    assert.equal(
      protectedTick.autonomyTick.choiceSet.some((choice) => choice.action === "provider_boundary_review"),
      false,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous tick revisits aged accepted continuity as reversible evidence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-accepted-continuity-"));
  try {
    let phase: "propose" | "accept" | "silent" = "propose";
    let deltaRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (phase === "propose") {
            return JSON.stringify({
              kind: "propose_persona_delta",
              field: "dailyMood",
              value: "quietly careful while reviewing old continuity",
              reason: "The room-visible evidence may support a reversible daily mood, not a role.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "accepted continuity review can remain optional" });
        },
        mimoInvoker: async (request) => {
          if (phase === "accept") {
            assert.equal(request.packet.messageRefs.includes(deltaRef), true);
            return JSON.stringify({
              kind: "respond_persona_delta",
              deltaRef,
              response: "accept",
              reason: "Accept as reversible continuity evidence, not as a fixed duty.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "not involved" });
        },
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a daily mood continuity note for later review.",
      clientMessageId: "client_autonomy_accepted_continuity_propose",
      mentions: ["kimi_member_01"],
    });
    deltaRef = proposed.socialState.personas
      .flatMap((persona) => persona.evolutionLog)
      .find((delta) => delta.field === "dailyMood")?.deltaId ?? "";
    assert.ok(deltaRef);
    await waitForRuntimeIdle(runtime);

    phase = "accept";
    const accepted = await runtime.postUserMessage({
      content: "@mimo_member_01 accept the carried daily mood as reversible continuity.",
      clientMessageId: "client_autonomy_accepted_continuity_accept",
      mentions: ["mimo_member_01"],
      contextRefs: [deltaRef],
    });
    const acceptedDelta = accepted.socialState.personas.flatMap((persona) => persona.evolutionLog).find((delta) => delta.deltaId === deltaRef);
    assert.equal(acceptedDelta?.status, "accepted");
    assert.match(accepted.socialState.personas.find((persona) => persona.agentId === "kimi_member_01")?.dailyMoodRecord?.boundaryNote ?? "", /not a fixed role/);
    await waitForRuntimeIdle(runtime);

    phase = "silent";
    const archived = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 60_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
      continuityReviewAfterMs: 0,
    });
    assert.equal(archived.autonomyTick.action, "archive_and_invite_review");
    await waitForRuntimeIdle(runtime);

    const acceptedEventId = (await runtime.rawEvents()).find((event) => event.event_type === "persona_delta.responded")?.event_id ?? "";
    assert.ok(acceptedEventId);
    const carried = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 120_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      continuityReviewAfterMs: 0,
    });

    assert.equal(carried.autonomyTick.action, "continuity_review");
    assert.equal(carried.autonomyTick.status, "posted");
    assert.deepEqual(carried.autonomyTick.targetRefs, [deltaRef]);
    assert.equal(carried.autonomyTick.contextRefs.includes(deltaRef), true);
    assert.equal(carried.autonomyTick.contextRefs.includes(acceptedEventId), true);
    assert.match(carried.autonomyTick.reason, /accepted role-claim\/daily-mood continuity/);
    assert.deepEqual(
      carried.autonomyTick.choiceSet.find((choice) => choice.action === "continuity_review")?.targetRefs,
      [deltaRef],
    );
    const rhythmMessage = carried.messages.find(
      (message) =>
        message.displayName === "Room Rhythm" &&
        message.text.includes("accepted continuity") &&
        message.text.includes("reversible evidence"),
    );
    assert.ok(rhythmMessage);
    assert.equal(rhythmMessage.contextRefs.includes(deltaRef), true);
    assert.equal(carried.socialState.personas.flatMap((persona) => persona.evolutionLog).find((delta) => delta.deltaId === deltaRef)?.status, "accepted");
    await waitForRuntimeIdle(runtime);

    const unchanged = await runtime.runAutonomousTick({
      now: new Date(Date.now() + 180_000).toISOString(),
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      continuityReviewAfterMs: 0,
    });
    assert.equal(unchanged.autonomyTick.status, "unchanged");
    await delay(500);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("room runtime autonomous memory hygiene can re-enter after a new daily archive", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-memory-reentry-"));
  try {
    let kimiCall = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_memory",
              summary: "Unresolved public memory should return for hygiene after the next archive cycle.",
              reason: "The claim needs periodic ledger-backed hygiene without becoming settled truth.",
              contextRefs: [],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "memory hygiene can remain optional" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose one public memory claim for recurring hygiene.",
      clientMessageId: "client_autonomy_memory_reentry_seed",
      mentions: ["kimi_member_01"],
    });
    const memoryRef = proposed.socialState.memoryClaims[0]?.memoryId ?? "";
    assert.ok(memoryRef);

    await runtime.runAutonomousTick({
      now: "2026-06-21T12:00:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    await waitForRuntimeIdle(runtime);

    const firstCarry = await runtime.runAutonomousTick({
      now: "2026-06-21T12:10:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(firstCarry.autonomyTick.action, "memory_hygiene_review");
    assert.deepEqual(firstCarry.autonomyTick.targetRefs, [memoryRef]);
    await waitForRuntimeIdle(runtime);

    const sameCycle = await runtime.runAutonomousTick({
      now: "2026-06-21T12:20:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(sameCycle.autonomyTick.status, "unchanged");

    const nextArchive = await runtime.createDailyArchive({ date: "2026-06-22", timezone: "Asia/Shanghai" });
    const nextArchiveEventId = (await runtime.rawEvents())
      .filter((event) => event.event_type === "daily_archive.created")
      .at(-1)?.event_id ?? "";
    assert.ok(nextArchiveEventId);
    const reviewCarry = await runtime.runAutonomousTick({
      now: "2026-06-22T09:00:00.000Z",
      date: "2026-06-22",
      timezone: "Asia/Shanghai",
    });
    assert.equal(reviewCarry.autonomyTick.action, "review_open_archive");
    await waitForRuntimeIdle(runtime);

    const secondCarry = await runtime.runAutonomousTick({
      now: "2026-06-22T09:10:00.000Z",
      date: "2026-06-22",
      timezone: "Asia/Shanghai",
    });
    assert.equal(secondCarry.autonomyTick.action, "memory_hygiene_review");
    assert.deepEqual(secondCarry.autonomyTick.targetRefs, [memoryRef]);
    assert.equal(secondCarry.autonomyTick.contextRefs.includes(memoryRef), true);
    assert.equal(secondCarry.autonomyTick.contextRefs.includes(nextArchive.archive.archiveId), true);
    assert.equal(secondCarry.autonomyTick.contextRefs.includes(nextArchiveEventId), true);
    assert.deepEqual(
      secondCarry.autonomyTick.choiceSet.find((choice) => choice.action === "memory_hygiene_review")?.targetRefs,
      [memoryRef],
    );
    await waitForRuntimeIdle(runtime);

    const afterSecondCarry = await runtime.runAutonomousTick({
      now: "2026-06-22T09:20:00.000Z",
      date: "2026-06-22",
      timezone: "Asia/Shanghai",
    });
    assert.equal(afterSecondCarry.autonomyTick.status, "unchanged");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime autonomous continuity review can re-enter after a new daily archive", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-autonomy-continuity-reentry-"));
  try {
    let kimiCall = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_persona_delta",
              field: "dailyMood",
              operation: "set",
              value: "今天慢一点，只在证据足够时接话。",
              reason: "Daily mood needs recurring archive-cycle review while it remains proposed.",
              contextRefs: [],
            });
          }
          return JSON.stringify({ kind: "stay_silent", reason: "continuity review can remain optional" });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose one reversible daily mood for recurring continuity review.",
      clientMessageId: "client_autonomy_continuity_reentry_seed",
      mentions: ["kimi_member_01"],
    });
    const deltaRef = proposed.socialState.personas
      .flatMap((persona) => persona.evolutionLog)
      .find((delta) => delta.field === "dailyMood")?.deltaId ?? "";
    assert.ok(deltaRef);

    await runtime.runAutonomousTick({
      now: "2026-06-21T12:30:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
      force: true,
    });
    await waitForRuntimeIdle(runtime);

    const firstCarry = await runtime.runAutonomousTick({
      now: "2026-06-21T12:40:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(firstCarry.autonomyTick.action, "continuity_review");
    assert.deepEqual(firstCarry.autonomyTick.targetRefs, [deltaRef]);
    await waitForRuntimeIdle(runtime);

    const sameCycle = await runtime.runAutonomousTick({
      now: "2026-06-21T12:50:00.000Z",
      date: "2026-06-21",
      timezone: "Asia/Shanghai",
    });
    assert.equal(sameCycle.autonomyTick.status, "unchanged");

    const nextArchive = await runtime.createDailyArchive({ date: "2026-06-22", timezone: "Asia/Shanghai" });
    const nextArchiveEventId = (await runtime.rawEvents())
      .filter((event) => event.event_type === "daily_archive.created")
      .at(-1)?.event_id ?? "";
    assert.ok(nextArchiveEventId);
    const reviewCarry = await runtime.runAutonomousTick({
      now: "2026-06-22T10:00:00.000Z",
      date: "2026-06-22",
      timezone: "Asia/Shanghai",
    });
    assert.equal(reviewCarry.autonomyTick.action, "review_open_archive");
    await waitForRuntimeIdle(runtime);

    const secondCarry = await runtime.runAutonomousTick({
      now: "2026-06-22T10:10:00.000Z",
      date: "2026-06-22",
      timezone: "Asia/Shanghai",
    });
    assert.equal(secondCarry.autonomyTick.action, "continuity_review");
    assert.deepEqual(secondCarry.autonomyTick.targetRefs, [deltaRef]);
    assert.equal(secondCarry.autonomyTick.contextRefs.includes(deltaRef), true);
    assert.equal(secondCarry.autonomyTick.contextRefs.includes(nextArchive.archive.archiveId), true);
    assert.equal(secondCarry.autonomyTick.contextRefs.includes(nextArchiveEventId), true);
    assert.deepEqual(
      secondCarry.autonomyTick.choiceSet.find((choice) => choice.action === "continuity_review")?.targetRefs,
      [deltaRef],
    );

    const delta = secondCarry.socialState.personas
      .flatMap((persona) => persona.evolutionLog)
      .find((item) => item.deltaId === deltaRef);
    assert.equal(delta?.status, "proposed");
    await waitForRuntimeIdle(runtime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects archive review request speech as critique without side effects", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-archive-request-speech-"));
  try {
    let archiveRef = "";
    let reviewRequestRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          assert.equal(
            request.packet.proposalRefs.includes(reviewRequestRef) ||
              (request.packet.turnBoundary?.invitationContextRefs.includes(reviewRequestRef) ?? false),
            true,
          );
          return JSON.stringify({
            kind: "speak",
            content:
              "This review request is useful as a daily rhythm invitation; it should surface missing context without mutating the archive.",
            contextRefs: [reviewRequestRef],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    await runtime.postUserMessage({
      content: "@kimi_member_01 leave a small trace before the archive.",
      clientMessageId: "client_archive_request_speech_seed",
      mentions: ["kimi_member_01"],
    });
    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    archiveRef = archived.archive.archiveId;
    reviewRequestRef = archived.socialState.archiveReviews.find((review) => review.kind === "review_request")?.id ?? "";
    assert.ok(reviewRequestRef);

    const reviewed = await runtime.postUserMessage({
      content: "@kimi_member_01 you may answer the review request in ordinary speech.",
      clientMessageId: "client_archive_request_speech_review",
      mentions: ["kimi_member_01"],
      contextRefs: [archiveRef, reviewRequestRef],
    });

    const archiveReview = reviewed.socialState.archiveReviews.find(
      (review) => review.kind === "review" && review.archiveRef === archiveRef,
    );
    assert.equal(reviewed.turn.intentionKinds.includes("speak"), true);
    assert.ok(archiveReview);
    assert.equal(archiveReview?.agentId, "kimi_member_01");
    assert.equal(archiveReview?.assessment, "missing_context");
    assert.match(archiveReview?.summary ?? "", /daily rhythm invitation/);
    assert.match(archiveReview?.boundaryNote ?? "", /not archive mutation/);
    const archiveReviewSpeechMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("reviewed the daily time skeleton"),
    );
    assert.ok(archiveReviewSpeechMessage);
    assert.equal(archiveReviewSpeechMessage.authorKind, "system");
    assert.equal(archiveReviewSpeechMessage.text.includes(archiveRef), false);
    assert.equal(archiveReviewSpeechMessage.text.includes(archiveReview.id), false);
    assert.equal(archiveReviewSpeechMessage.contextRefs.includes(archiveRef), true);
    assert.equal(archiveReviewSpeechMessage.contextRefs.includes(archiveReview.id), true);
    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "archive.review_requested").length, 1);
    assert.equal(events.filter((event) => event.event_type === "archive.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.reviewed").length, 0);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_proposed").length, 0);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_applied").length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime groups same-turn archive repair responses in visible messages", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-archive-response-group-"));
  try {
    let archiveRef = "";
    let repairRef = "";
    let kimiCall = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_archive_repair",
              archiveRef,
              summary: "Keep archive truth status explicit.",
              reason: "A compressed archive can be mistaken for settled consensus.",
              proposedRepair: "Add a caveat that this archive is a time skeleton, not settled truth.",
              contextRefs: [archiveRef],
            });
          }
          return JSON.stringify({
            kind: "respond_archive_repair",
            repairRef,
            response: "accept",
            reason: "The caveat protects contestability.",
            contextRefs: [repairRef],
          });
        },
        mimoInvoker: async () =>
          JSON.stringify({
            kind: "respond_archive_repair",
            repairRef,
            response: "revise",
            reason: "The caveat should name the archive boundary more clearly.",
            proposedRevision: "State that archives are projections and old claims may still be contested.",
            contextRefs: [repairRef],
          }),
      },
    });

    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    archiveRef = archived.archive.archiveId;
    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a repair that keeps archive truth status contestable.",
      clientMessageId: "client_archive_repair_group_propose",
      mentions: ["kimi_member_01"],
      contextRefs: [archiveRef],
    });
    repairRef = proposed.socialState.archiveReviews.find((item) => item.kind === "repair_proposal")?.id ?? "";
    assert.match(repairRef, /^archive_repair_/);

    const responded = await runtime.postUserMessage({
      content: "@kimi_member_01 @mimo_member_01 respond to this repair proposal without rewriting the archive.",
      clientMessageId: "client_archive_repair_group_response",
      mentions: ["kimi_member_01", "mimo_member_01"],
      contextRefs: [repairRef],
    });

    const responseItems = responded.socialState.archiveReviews.filter(
      (item) => item.kind === "repair_response" && item.repairRef === repairRef,
    );
    assert.equal(responseItems.length, 2);
    const revisedRepair = responded.socialState.archiveReviews.find(
      (item) => item.kind === "repair_proposal" && item.revisedFromRepairRef === repairRef,
    );
    assert.ok(revisedRepair);
    assert.equal(revisedRepair.revisedBy, "mimo_member_01");
    assert.match(revisedRepair.proposedRepair ?? "", /archives are projections/);
    const visibleSummaries = responded.messages.filter(
      (message) =>
        message.displayName === "System Note" &&
        message.text.includes("agents responded to the archive repair proposal"),
    );
    assert.equal(visibleSummaries.length, 1);
    assert.match(visibleSummaries[0]?.text ?? "", /accept: 1/);
    assert.match(visibleSummaries[0]?.text ?? "", /revise: 1/);
    assert.match(visibleSummaries[0]?.text ?? "", /individual responses remain ledgered/);
    assert.equal(visibleSummaries[0]?.text.includes(repairRef), false);
    assert.equal(visibleSummaries[0]?.contextRefs.includes(repairRef), true);
    assert.equal(
      responded.messages.some((message) => message.text.includes(`kimi_member_01 accept archive repair ${repairRef}`)),
      false,
    );
    assert.equal(
      responded.messages.some((message) => message.text.includes(`mimo_member_01 revise archive repair ${repairRef}`)),
      false,
    );

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "archive.repair_proposed").length, 2);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_responded").length, 2);
    assert.equal(events.filter((event) => event.event_type === "daily_archive.created").length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime records ordinary archive repair review speech without changing repair state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-archive-repair-review-"));
  try {
    let archiveRef = "";
    let repairRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () =>
          JSON.stringify({
            kind: "propose_archive_repair",
            archiveRef,
            summary: "Name the unresolved repair caveat.",
            reason: "The archive should not look like settled consensus.",
            proposedRepair: "Add a caveat that the repair remains unresolved until a later room-visible response.",
            contextRefs: [archiveRef],
          }),
        mimoInvoker: async () =>
          JSON.stringify({
            kind: "speak",
            content:
              "这个 repair 提案有用，但我只留下审阅压力：它仍缺证据，不应该被当作接受、拒绝或应用。",
            contextRefs: [repairRef],
          }),
      },
    });

    const archived = await runtime.createDailyArchive({ date: "2026-06-20", timezone: "Asia/Shanghai" });
    archiveRef = archived.archive.archiveId;
    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a repair that keeps archive repair caveats unresolved.",
      clientMessageId: "client_archive_repair_review_propose",
      mentions: ["kimi_member_01"],
      contextRefs: [archiveRef],
    });
    repairRef = proposed.socialState.archiveReviews.find((item) => item.kind === "repair_proposal")?.id ?? "";
    assert.match(repairRef, /^archive_repair_/);

    const reviewed = await runtime.postUserMessage({
      content: "@mimo_member_01 discuss this repair proposal as ordinary room speech only.",
      clientMessageId: "client_archive_repair_review_speech",
      mentions: ["mimo_member_01"],
      contextRefs: [repairRef],
    });

    const review = reviewed.socialState.archiveReviews.find(
      (item) => item.kind === "repair_review" && item.repairRef === repairRef,
    );
    assert.ok(review);
    assert.equal(review.archiveRef, archiveRef);
    assert.equal(review.response, "questioned");
    assert.match(review.summary, /只留下审阅压力/);
    assert.match(review.boundaryNote, /repair state are unchanged|does not accept/);
    assert.equal(
      reviewed.socialState.archiveReviews.some(
        (item) => item.kind === "repair_response" && item.repairRef === repairRef,
      ),
      false,
    );
    const repairReviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("questioned the archive repair proposal"),
    );
    assert.ok(repairReviewMessage);
    assert.equal(repairReviewMessage.text.includes(repairRef), false);
    assert.equal(repairReviewMessage.contextRefs.includes(repairRef), true);
    assert.equal(repairReviewMessage.text.includes(review.id), false);
    assert.equal(repairReviewMessage.contextRefs.includes(review.id), true);

    await assert.rejects(
      () => runtime.applyArchiveRepair({ repairRef, reason: "should not be accepted yet" }),
      /has no accepted room response/,
    );

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "archive.repair_proposed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "archive.repair_applied").length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime applies an accepted archive repair as a provenance-preserving revision", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-archive-apply-"));
  try {
    let archiveRef = "";
    let repairRef = "";
    let call = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          call += 1;
          if (call === 1) {
            return JSON.stringify({
              kind: "propose_archive_repair",
              archiveRef,
              summary: "Keep repair provenance visible.",
              reason: "The archive can be mistaken for a silent rewrite.",
              proposedRepair: "Add a revision line that names the accepted repair and preserves the original archive.",
              contextRefs: [archiveRef],
            });
          }
          return JSON.stringify({
            kind: "respond_archive_repair",
            repairRef,
            response: "accept",
            reason: "The repair keeps archive history contestable.",
            contextRefs: [repairRef],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "The targeted repair exchange is enough." }),
      },
    });

    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    archiveRef = archived.archive.archiveId;
    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a repair for the latest archive.",
      clientMessageId: "client_archive_apply_propose",
      mentions: ["kimi_member_01"],
      contextRefs: [archiveRef],
    });
    repairRef = proposed.socialState.archiveReviews.find((item) => item.kind === "repair_proposal")?.id ?? "";
    assert.match(repairRef, /^archive_repair_/);

    await assert.rejects(
      () =>
        runtime.applyArchiveRepair({
          repairRef,
          reason: "This should wait for a room-visible accepted response.",
        }),
      /no accepted room response/,
    );

    await runtime.postUserMessage({
      content: "@kimi_member_01 accept that archive repair without applying it yourself.",
      clientMessageId: "client_archive_apply_accept",
      mentions: ["kimi_member_01"],
      contextRefs: [repairRef],
    });
    const applied = await runtime.applyArchiveRepair({
      repairRef,
      reason: "Accepted repair is explicitly applied as a new archive revision.",
    });

    assert.equal(applied.appliedRepairRef, repairRef);
    assert.equal(applied.revisionOf, archiveRef);
    assert.equal(applied.archive.revisionOf, archiveRef);
    assert.equal(applied.archive.appliedRepairRef, repairRef);
    assert.match(applied.archive.summary, /Revision from/);
    assert.equal(applied.archive.provenanceRefs?.includes(repairRef), true);
    const applicationMessage = applied.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("new time-skeleton revision"),
    );
    assert.ok(applicationMessage);
    assert.equal(applicationMessage.text.includes(repairRef), false);
    assert.equal(applicationMessage.text.includes(archiveRef), false);
    assert.equal(applicationMessage.contextRefs.includes(repairRef), true);
    assert.equal(applicationMessage.contextRefs.includes(archiveRef), true);
    assert.equal(applied.socialState.archives.some((archive) => archive.archiveId === archiveRef), true);
    assert.equal(applied.socialState.archives.some((archive) => archive.revisionOf === archiveRef), true);
    assert.equal(
      applied.socialState.archiveReviews.some(
        (item) => item.kind === "repair_application" && item.repairRef === repairRef && item.revisedArchiveRef === applied.archive.archiveId,
      ),
      true,
    );

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "archive.repair_applied").length, 1);
    assert.equal(events.filter((event) => event.event_type === "daily_archive.created").length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime carries protocol refs through response and retirement", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-protocol-lifecycle-"));
  try {
    let kimiCall = 0;
    let protocolRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_protocol",
              summary: "For one turn, each speaker names one risk before proposing a plan.",
              scope: "current_topic",
              reason: "The room needs a lightweight disagreement surface.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          assert.equal(request.packet.protocolRefs.includes(protocolRef), true);
          assert.equal(
            request.packet.contextFragments?.some(
              (fragment) => fragment.type === "protocol_active" && fragment.refs.includes(protocolRef),
            ),
            true,
          );
          return JSON.stringify({
            kind: "retire_protocol",
            protocolRef,
            reason: "The one-turn etiquette has served its purpose.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async (request) => {
          assert.equal(request.packet.protocolRefs.includes(protocolRef), true);
          const protocolFragment = request.packet.contextFragments?.find(
            (fragment) => fragment.type === "protocol_proposal" && fragment.refs.includes(protocolRef),
          );
          assert.ok(protocolFragment);
          const protocolBody = JSON.parse(protocolFragment.body) as { states?: Record<string, unknown> };
          assert.equal(protocolBody.states?.protocolExpiryPolicy, "system_default_24h");
          assert.match(String(protocolBody.states?.protocolBoundaryNote ?? ""), /not permanent control flow/);
          assert.equal(
            request.packet.contextFragments?.some(
              (fragment) => fragment.type === "protocol_active" && fragment.refs.includes(protocolRef),
            ),
            false,
          );
          return JSON.stringify({
            kind: "respond_protocol",
            protocolRef,
            response: "accept",
            reason: "The protocol is narrow, temporary, and preserves agent choice.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a temporary room etiquette.",
      clientMessageId: "client_runtime_protocol_propose",
      mentions: ["kimi_member_01"],
    });
    protocolRef = proposed.socialState.protocols[0]?.protocolId ?? "";
    assert.notEqual(protocolRef, "");
    assert.equal(proposed.socialState.protocols[0]?.status, "proposed");
    assert.equal(proposed.socialState.protocols[0]?.expiryPolicy, "system_default_24h");
    assert.match(proposed.socialState.protocols[0]?.boundaryNote ?? "", /not permanent control flow/);
    assert.ok(Date.parse(proposed.socialState.protocols[0]?.expiresAt ?? "") > Date.now());
    const proposedMessage = proposed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("temporary room etiquette proposal"),
    );
    assert.ok(proposedMessage);
    assert.equal(proposedMessage.text.includes(protocolRef), false);
    assert.equal(proposedMessage.contextRefs.includes(protocolRef), true);

    const accepted = await runtime.postUserMessage({
      content: "@mimo_member_01 respond to the carried protocol.",
      clientMessageId: "client_runtime_protocol_accept",
      mentions: ["mimo_member_01"],
      contextRefs: [protocolRef],
    });
    assert.equal(accepted.socialState.protocols[0]?.protocolId, protocolRef);
    assert.equal(accepted.socialState.protocols[0]?.status, "active");
    assert.equal(accepted.socialState.protocols[0]?.responseCount, 1);
    const acceptedMessage = accepted.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("accepted the temporary room etiquette"),
    );
    assert.ok(acceptedMessage);
    assert.equal(acceptedMessage.text.includes(protocolRef), false);
    assert.equal(acceptedMessage.contextRefs.includes(protocolRef), true);

    const retired = await runtime.postUserMessage({
      content: "@kimi_member_01 retire the carried protocol if it should not persist.",
      clientMessageId: "client_runtime_protocol_retire",
      mentions: ["kimi_member_01"],
      contextRefs: [protocolRef],
    });
    assert.equal(retired.socialState.protocols[0]?.protocolId, protocolRef);
    assert.equal(retired.socialState.protocols[0]?.status, "retired");
    const retiredMessage = retired.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("retired the temporary room etiquette"),
    );
    assert.ok(retiredMessage);
    assert.equal(retiredMessage.text.includes(protocolRef), false);
    assert.equal(retiredMessage.contextRefs.includes(protocolRef), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime groups same-turn protocol responses in visible messages", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-protocol-response-group-"));
  try {
    let kimiCall = 0;
    let protocolRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_protocol",
              summary: "For this topic, responders should name one uncertainty before agreeing.",
              scope: "current_topic",
              reason: "The room needs a lightweight contestability surface.",
            });
          }
          return JSON.stringify({
            kind: "respond_protocol",
            protocolRef,
            response: "accept",
            reason: "The protocol keeps agreement provisional.",
            contextRefs: [protocolRef],
          });
        },
        mimoInvoker: async () =>
          JSON.stringify({
            kind: "respond_protocol",
            protocolRef,
            response: "revise",
            reason: "The protocol should stay temporary and opt-in.",
            proposedRevision: "Use the uncertainty step for this topic only.",
            contextRefs: [protocolRef],
          }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a temporary uncertainty protocol.",
      clientMessageId: "client_protocol_group_propose",
      mentions: ["kimi_member_01"],
    });
    protocolRef = proposed.socialState.protocols[0]?.protocolId ?? "";
    assert.match(protocolRef, /^protocol_/);

    const responded = await runtime.postUserMessage({
      content: "@kimi_member_01 @mimo_member_01 respond to the same temporary protocol.",
      clientMessageId: "client_protocol_group_response",
      mentions: ["kimi_member_01", "mimo_member_01"],
      contextRefs: [protocolRef],
    });

    const protocol = responded.socialState.protocols.find((item) => item.protocolId === protocolRef);
    assert.equal(protocol?.responseCount, 2);
    const visibleSummaries = responded.messages.filter(
      (message) =>
        message.displayName === "System Note" && message.text.includes("agents responded to the temporary room etiquette"),
    );
    assert.equal(visibleSummaries.length, 1);
    assert.equal(visibleSummaries[0]?.text.includes(protocolRef), false);
    assert.equal(visibleSummaries[0]?.contextRefs.includes(protocolRef), true);
    assert.match(visibleSummaries[0]?.text ?? "", /accept: 1/);
    assert.match(visibleSummaries[0]?.text ?? "", /revise: 1/);
    assert.match(visibleSummaries[0]?.text ?? "", /protocol remains temporary room etiquette/);
    assert.equal(
      responded.messages.some((message) => message.text.includes(`kimi_member_01 accept protocol ${protocolRef}`)),
      false,
    );
    assert.equal(
      responded.messages.some((message) => message.text.includes(`mimo_member_01 revise protocol ${protocolRef}`)),
      false,
    );

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "protocol.responded").length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects protocol review speech without changing protocol state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-protocol-review-"));
  try {
    let phase: "propose" | "review" | "inspect" = "propose";
    let protocolRef = "";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (phase === "propose") {
            return JSON.stringify({
              kind: "propose_protocol",
              summary: "Before turning disagreement into tasks, pause for one source check.",
              scope: "current_topic",
              reason: "The room needs a temporary etiquette for source-sensitive disagreement.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (phase === "inspect") {
            const protocolFragment = request.packet.contextFragments?.find(
              (fragment) => fragment.type === "protocol_proposal" && fragment.refs.includes(protocolRef),
            );
            assert.ok(protocolFragment);
            const protocolBody = JSON.parse(protocolFragment.body) as {
              protocol?: { protocolLastReview?: string; protocolLastReviewSummary?: string; protocolReviewBoundaryNote?: string };
              states?: { protocolState?: string; protocolLastReview?: string; protocolLastReviewSummary?: string };
            };
            assert.equal(protocolBody.states?.protocolState, "proposed");
            assert.equal(protocolBody.protocol?.protocolLastReview, "questioned");
            assert.match(protocolBody.protocol?.protocolLastReviewSummary ?? "", /证据来源/);
            assert.match(protocolBody.protocol?.protocolReviewBoundaryNote ?? "", /does not accept, reject/);
            return JSON.stringify({ kind: "stay_silent", reason: "inspection complete" });
          }
          return JSON.stringify({
            kind: "speak",
            content: "我会先追问这个 protocol 的证据来源：它可以帮助当前话题，但不该立刻变成默认房间礼仪。",
            contextRefs: [protocolRef],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a temporary protocol for source checks.",
      clientMessageId: "client_protocol_review_propose",
      mentions: ["kimi_member_01"],
    });
    protocolRef = proposed.socialState.protocols[0]?.protocolId ?? "";
    assert.notEqual(protocolRef, "");
    assert.equal(proposed.socialState.protocols[0]?.status, "proposed");

    phase = "review";
    const reviewed = await runtime.postUserMessage({
      content: "@kimi_member_01 review the carried protocol without accepting, rejecting, challenging, revising, or retiring it.",
      clientMessageId: "client_protocol_review_speak",
      mentions: ["kimi_member_01"],
      contextRefs: [protocolRef],
    });

    const protocol = reviewed.socialState.protocols.find((item) => item.protocolId === protocolRef);
    assert.equal(protocol?.status, "proposed");
    assert.equal(protocol?.responseCount, 0);
    assert.equal(reviewed.socialState.protocolReviews.length, 1);
    assert.equal(reviewed.socialState.protocolReviews[0]?.protocolRef, protocolRef);
    assert.equal(reviewed.socialState.protocolReviews[0]?.response, "questioned");
    assert.match(reviewed.socialState.protocolReviews[0]?.summary ?? "", /证据来源/);
    assert.match(reviewed.socialState.protocolReviews[0]?.boundaryNote ?? "", /does not accept, reject/);
    const reviewRef = reviewed.socialState.protocolReviews[0]?.reviewId ?? "";
    assert.match(reviewRef, /^protocol_review_/);
    const reviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("questioned the temporary room etiquette"),
    );
    assert.ok(reviewMessage);
    assert.equal(reviewMessage.text.includes(protocolRef), false);
    assert.equal(reviewMessage.text.includes(reviewRef), false);
    assert.equal(reviewMessage.contextRefs.includes(protocolRef), true);
    assert.equal(reviewMessage.contextRefs.includes(reviewRef), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "protocol.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "protocol.responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "protocol.retired").length, 0);

    phase = "inspect";
    await runtime.postUserMessage({
      content: "@kimi_member_01 inspect the same protocol packet after the review trace.",
      clientMessageId: "client_protocol_review_inspect",
      mentions: ["kimi_member_01"],
      contextRefs: [protocolRef],
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime expires timeboxed protocols before carrying them into agent context", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-protocol-expiry-"));
  try {
    const expiresAt = "2000-01-01T00:00:00.000Z";
    let protocolRef = "";
    let mimoSawExpiredProtocolRef = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) =>
          JSON.stringify({
            kind: "propose_protocol",
            summary: "For this tiny window, speakers should name uncertainty before adding advice.",
            scope: "timeboxed",
            expiresAt,
            reason: "The room is testing temporary etiquette without permanent control flow.",
            contextRefs: [request.packet.triggeringEventId],
          }),
        mimoInvoker: async (request) => {
          mimoSawExpiredProtocolRef = request.packet.protocolRefs.includes(protocolRef);
          return JSON.stringify({
            kind: "stay_silent",
            reason: "Expired protocol refs should remain history, not active guidance.",
          });
        },
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose an already-expired timeboxed protocol.",
      clientMessageId: "client_runtime_protocol_expired_propose",
      mentions: ["kimi_member_01"],
    });
    protocolRef = proposed.socialState.protocols[0]?.protocolId ?? "";
    assert.notEqual(protocolRef, "");
    assert.equal(proposed.socialState.protocols[0]?.status, "expired");
    const expiredMessage = proposed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("temporary room etiquette expired"),
    );
    assert.ok(expiredMessage);
    assert.equal(expiredMessage.text.includes(protocolRef), false);
    assert.equal(expiredMessage.contextRefs.includes(protocolRef), true);

    const afterExpiry = await runtime.rawEvents();
    assert.equal(afterExpiry.filter((event) => event.event_type === "protocol.expired").length, 1);

    await runtime.postUserMessage({
      content: "@mimo_member_01 check whether the expired protocol still guides you.",
      clientMessageId: "client_runtime_protocol_expired_context",
      mentions: ["mimo_member_01"],
      contextRefs: [protocolRef],
    });
    assert.equal(mimoSawExpiredProtocolRef, false);

    await runtime.getState();
    const stableEvents = await runtime.rawEvents();
    assert.equal(stableEvents.filter((event) => event.event_type === "protocol.expired").length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects topic proposals without changing active topic", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-topic-proposal-"));
  try {
    let kimiCall = 0;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          kimiCall += 1;
          if (kimiCall === 1) {
            return JSON.stringify({
              kind: "propose_topic",
              action: "split",
              title: "Topic order as living-room etiquette",
              reason: "This thread deserves a separate surface, but the proposal should not force the room to move.",
              targetTopicId: request.packet.topicId,
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (kimiCall === 2) {
            return JSON.stringify({
              kind: "respond_topic",
              topicProposalRef: request.packet.proposalRefs.find((ref) => ref.startsWith("topic_proposal_")),
              response: "accept",
              reason: "The split is now clear enough to apply visibly.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "apply_topic",
            topicProposalRef: request.packet.proposalRefs.find((ref) => ref.startsWith("topic_proposal_")),
            action: "split",
            title: "Applied living-room topic order",
            reason: "The proposal was accepted and can become a room-visible topic surface.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const state = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a topic split, but do not switch the room automatically.",
      clientMessageId: "client_runtime_topic_proposal",
      mentions: ["kimi_member_01"],
    });

    assert.deepEqual(state.turn.intentionKinds, ["propose_topic"]);
    assert.equal(state.turn.visibleMessageEventIds.length, 0);
    assert.equal(state.socialState.topicProposals.length, 1);
    assert.equal(state.socialState.topicProposals[0]?.action, "split");
    assert.equal(state.socialState.topicProposals[0]?.proposedBy, "kimi_member_01");
    assert.equal(state.socialState.topicProposals[0]?.currentTopicId, state.turn.topicId);
    assert.match(state.socialState.topicProposals[0]?.boundaryNote ?? "", /does not switch/);
    const proposalId = state.socialState.topicProposals[0]?.proposalId;
    assert.ok(proposalId);
    const topicProposalMessage = state.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("opened a topic suggestion"),
    );
    assert.ok(topicProposalMessage);
    assert.match(topicProposalMessage.text, /Still proposed|does not switch|split/);
    assert.equal(topicProposalMessage.text.includes(proposalId), false);
    assert.equal(topicProposalMessage.contextRefs.includes(proposalId), true);

    const responded = await runtime.postUserMessage({
      content: "@kimi_member_01 respond to the topic proposal, but do not apply it.",
      clientMessageId: "client_runtime_topic_response",
      mentions: ["kimi_member_01"],
      contextRefs: [proposalId],
    });
    assert.deepEqual(responded.turn.intentionKinds, ["respond_topic"]);
    assert.equal(responded.socialState.topicProposals[0]?.proposalId, proposalId);
    assert.equal(responded.socialState.topicProposals[0]?.status, "accept");
    assert.equal(responded.socialState.topicProposals[0]?.responseCount, 1);
    assert.match(responded.socialState.topicProposals[0]?.boundaryNote ?? "", /does not switch/);
    assert.equal(responded.activeTopicId, state.activeTopicId);
    const respondedEvents = await runtime.rawEvents();
    const topicResponseRef =
      (respondedEvents.find((event) => event.event_type === "topic.responded")?.payload as { responseId?: string })
        .responseId ?? "";
    assert.match(topicResponseRef, /^topic_response_/);
    const responseMessage = responded.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("accept the topic suggestion"),
    );
    assert.ok(responseMessage);
    assert.equal(responseMessage.text.includes(proposalId), false);
    assert.equal(responseMessage.text.includes(topicResponseRef), false);
    assert.equal(responseMessage.contextRefs.includes(proposalId), true);
    assert.equal(responseMessage.contextRefs.includes(topicResponseRef), true);

    const applied = await runtime.postUserMessage({
      content: "@kimi_member_01 apply the accepted topic proposal as visible room movement.",
      clientMessageId: "client_runtime_topic_apply",
      mentions: ["kimi_member_01"],
      contextRefs: [proposalId],
    });
    assert.deepEqual(applied.turn.intentionKinds, ["apply_topic"]);
    assert.equal(applied.socialState.topicProposals[0]?.proposalId, proposalId);
    assert.equal(applied.socialState.topicProposals[0]?.status, "applied");
    assert.equal(applied.socialState.topicProposals[0]?.appliedBy, "kimi_member_01");
    assert.match(applied.socialState.topicProposals[0]?.resultingTopicId ?? "", /^topic_/);
    assert.notEqual(applied.activeTopicId, state.activeTopicId);
    const appliedEvents = await runtime.rawEvents();
    const applicationRef =
      (appliedEvents.find((event) => event.event_type === "topic.applied")?.payload as { applicationId?: string })
        .applicationId ?? "";
    const resultingTopicId = applied.socialState.topicProposals[0]?.resultingTopicId ?? "";
    assert.match(applicationRef, /^topic_application_/);
    const appliedMessage = applied.messages.find(
      (message) =>
        message.displayName === "System Note" &&
        message.text.includes("applied the topic suggestion as visible topic movement"),
    );
    assert.ok(appliedMessage);
    assert.equal(appliedMessage.text.includes(proposalId), false);
    assert.equal(appliedMessage.text.includes(applicationRef), false);
    assert.equal(appliedMessage.text.includes(resultingTopicId), false);
    assert.equal(appliedMessage.contextRefs.includes(proposalId), true);
    assert.equal(appliedMessage.contextRefs.includes(applicationRef), true);
    assert.equal(appliedMessage.contextRefs.includes(resultingTopicId), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "topic.proposed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "topic.responded").length, 1);
    assert.equal(events.filter((event) => event.event_type === "topic.applied").length, 1);
    assert.equal(events.filter((event) => event.event_type === "topic.created").length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects topic proposal review speech without responding or applying", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-topic-proposal-review-"));
  try {
    let proposalId = "";
    let phase: "propose" | "review" | "inspect" = "propose";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (phase === "propose") {
            return JSON.stringify({
              kind: "propose_topic",
              action: "split",
              title: "Review topic movement before splitting",
              reason: "The room should expose objections before any topic movement happens.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          assert.equal(request.packet.proposalRefs.includes(proposalId), true);
          if (phase === "inspect") {
            const proposalFragment = request.packet.contextFragments?.find((fragment) => fragment.refs.includes(proposalId));
            assert.ok(proposalFragment);
            const proposalBody = JSON.parse(proposalFragment.body) as {
              states?: {
                topicStatus?: string;
                topicProposalLastReview?: string;
                topicProposalLastReviewSummary?: string;
                topicProposalReviewBoundaryNote?: string;
              };
              note?: string;
            };
            assert.equal(proposalBody.states?.topicStatus, "proposed");
            assert.equal(proposalBody.states?.topicProposalLastReview, "questioned");
            assert.match(proposalBody.states?.topicProposalLastReviewSummary ?? "", /不接受也不应用/);
            assert.match(proposalBody.states?.topicProposalReviewBoundaryNote ?? "", /does not accept, reject/);
            assert.match(proposalBody.note ?? "", /Review traces are discussion pressure only/);
          }
          return JSON.stringify({ kind: "stay_silent", reason: "inspection complete" });
        },
        mimoInvoker: async (request) => {
          if (phase !== "review") return JSON.stringify({ kind: "stay_silent", reason: "not involved" });
          const carriedProposalRef = request.packet.proposalRefs.find((ref) => ref === proposalId);
          assert.equal(carriedProposalRef, proposalId);
          return JSON.stringify({
            kind: "speak",
            content: "这个 topic proposal 现在还太早；我先只保留疑问，不接受也不应用。",
            contextRefs: [proposalId],
          });
        },
      },
    });

    const proposed = await runtime.postUserMessage({
      content: "@kimi_member_01 propose a topic split but keep it social.",
      clientMessageId: "client_runtime_topic_review_propose",
      mentions: ["kimi_member_01"],
    });
    proposalId = proposed.socialState.topicProposals[0]?.proposalId ?? "";
    assert.notEqual(proposalId, "");
    assert.equal(proposed.socialState.topicProposals[0]?.status, "proposed");
    assert.equal(proposed.socialState.topicProposals[0]?.responseCount, 0);
    const activeTopicId = proposed.activeTopicId;

    phase = "review";
    const reviewed = await runtime.postUserMessage({
      content: "@mimo_member_01 comment on that topic proposal without formally responding.",
      clientMessageId: "client_runtime_topic_review_speak",
      mentions: ["mimo_member_01"],
      contextRefs: [proposalId],
    });
    assert.deepEqual(reviewed.turn.intentionKinds, ["speak"]);
    assert.equal(reviewed.socialState.topicProposals[0]?.proposalId, proposalId);
    assert.equal(reviewed.socialState.topicProposals[0]?.status, "proposed");
    assert.equal(reviewed.socialState.topicProposals[0]?.responseCount, 0);
    assert.equal(reviewed.socialState.topicProposalReviews.length, 1);
    assert.equal(reviewed.socialState.topicProposalReviews[0]?.topicProposalRef, proposalId);
    assert.equal(reviewed.socialState.topicProposalReviews[0]?.response, "questioned");
    assert.match(reviewed.socialState.topicProposalReviews[0]?.summary ?? "", /不接受也不应用/);
    assert.match(reviewed.socialState.topicProposalReviews[0]?.boundaryNote ?? "", /does not accept, reject/);
    assert.equal(reviewed.activeTopicId, activeTopicId);
    const reviewRef = reviewed.socialState.topicProposalReviews[0]?.reviewId ?? "";
    assert.match(reviewRef, /^topic_review_/);
    const reviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("questioned the topic suggestion"),
    );
    assert.ok(reviewMessage);
    assert.equal(reviewMessage.text.includes(proposalId), false);
    assert.equal(reviewMessage.text.includes(reviewRef), false);
    assert.equal(reviewMessage.contextRefs.includes(proposalId), true);
    assert.equal(reviewMessage.contextRefs.includes(reviewRef), true);

    phase = "inspect";
    await runtime.postUserMessage({
      content: "@kimi_member_01 inspect that topic proposal review context.",
      clientMessageId: "client_runtime_topic_review_inspect",
      mentions: ["kimi_member_01"],
      contextRefs: [proposalId],
    });

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "topic.proposed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "topic.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "topic.responded").length, 0);
    assert.equal(events.filter((event) => event.event_type === "topic.applied").length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime carries agent questions as open topic context", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-open-question-"));
  try {
    let call = 0;
    let sawOpenQuestionFragment = false;
    let responseQuestionRef: string | undefined;
    const question = "What remains unresolved before this becomes shared room memory?";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          call += 1;
          if (call > 1) {
            const questionFragment = request.packet.contextFragments?.find(
              (fragment) => fragment.type === "open_question" && fragment.body.includes(question),
            );
            sawOpenQuestionFragment = Boolean(questionFragment);
            responseQuestionRef = questionFragment?.refs[0];
            return JSON.stringify({
              kind: "speak",
              content: "I would keep this question open, but name the missing evidence before adding memory.",
              contextRefs: responseQuestionRef ? [responseQuestionRef] : [],
            });
          }
          return JSON.stringify({
            kind: "ask_question",
            question,
            target: "room",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const asked = await runtime.postUserMessage({
      content: "@kimi_member_01 ask what still needs to stay unresolved.",
      clientMessageId: "client_runtime_open_question_first",
      mentions: ["kimi_member_01"],
    });
    assert.deepEqual(asked.turn.intentionKinds, ["ask_question"]);
    assert.equal(asked.topics.find((topic) => topic.topicId === asked.turn.topicId)?.openQuestions.includes(question), true);
    assert.equal(asked.socialState.openQuestions.length, 1);
    assert.equal(asked.socialState.openQuestions[0]?.question, question);
    assert.equal(asked.socialState.openQuestions[0]?.raisedBy, "kimi_member_01");
    assert.equal(asked.socialState.openQuestions[0]?.boundaryNote.includes("not a demand"), true);
    assert.equal(asked.socialState.openQuestions[0]?.sourceRefs.includes(asked.turn.triggeringMessageEventId), true);
    assert.equal(asked.messages.some((message) => message.text === question), true);

    const continued = await runtime.postUserMessage({
      content: "@kimi_member_01 check whether the prior question is now part of topic context.",
      clientMessageId: "client_runtime_open_question_second",
      mentions: ["kimi_member_01"],
    });
    assert.deepEqual(continued.turn.intentionKinds, ["speak"]);
    assert.equal(sawOpenQuestionFragment, true);
    assert.equal(responseQuestionRef, asked.socialState.openQuestions[0]?.questionId);
    assert.equal(continued.socialState.openQuestions[0]?.responseCount, 1);
    assert.equal(continued.socialState.openQuestions[0]?.lastResponse?.response, "responded");
    assert.match(continued.socialState.openQuestions[0]?.lastResponse?.summary ?? "", /keep this question open/);

    const events = await runtime.rawEvents();
    const topicUpdates = events.filter((event) => event.event_type === "topic.updated");
    assert.equal(topicUpdates.some((event) => String(JSON.stringify(event.payload)).includes(question)), true);
    const questionResponses = events.filter((event) => event.event_type === "open_question.responded");
    assert.equal(questionResponses.length, 1);
    assert.match(String(JSON.stringify(questionResponses[0]?.payload)), /does not resolve or close/);

    const archived = await runtime.createDailyArchive({ date: "2026-06-19", timezone: "Asia/Shanghai" });
    assert.equal(archived.archive.openQuestionTraces.length, 1);
    assert.equal(archived.archive.openQuestionTraces[0]?.question, question);
    assert.equal(archived.archive.openQuestionTraces[0]?.raisedBy, "kimi_member_01");
    assert.match(archived.archive.openQuestionTraces[0]?.boundaryNote ?? "", /not a demand/);
    assert.equal(archived.archive.openQuestionTraces[0]?.responses.length, 1);
    assert.match(archived.archive.openQuestionTraces[0]?.responses[0]?.summary ?? "", /missing evidence/);
    assert.equal(archived.socialState.archives[0]?.openQuestionTraceCount, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime summarizes multi-agent open question pressure", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-open-question-pressure-"));
  try {
    let phase: "ask" | "review" = "ask";
    let questionRef = "";
    const question = "Which uncertainty should stay visible before this becomes room memory?";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (phase === "ask") {
            return JSON.stringify({
              kind: "ask_question",
              question,
              target: "room",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          if (request.agent.agentId === "kimi_member_01") {
            return JSON.stringify({
              kind: "speak",
              content: "I contest turning this into memory before we name the missing evidence.",
              contextRefs: questionRef ? [questionRef] : [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "speak",
            content: "I would defer this question until one more room turn has fresh evidence.",
            contextRefs: questionRef ? [questionRef] : [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async (request) => {
          if (request.agent.agentId === "mimo_member_01") {
            return JSON.stringify({
              kind: "speak",
              content: "我质疑现在关闭它；这仍是未解决的房间问题。",
              contextRefs: questionRef ? [questionRef] : [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "speak",
            content: "I can answer one edge while keeping the question visible as shared room context.",
            contextRefs: questionRef ? [questionRef] : [request.packet.triggeringEventId],
          });
        },
      },
    });

    const asked = await runtime.postUserMessage({
      content: "@kimi_member_01 raise one unresolved memory-boundary question.",
      clientMessageId: "client_runtime_open_question_pressure_first",
      mentions: ["kimi_member_01"],
    });
    questionRef = asked.socialState.openQuestions[0]?.questionId ?? "";
    assert.notEqual(questionRef, "");

    phase = "review";
    const reviewed = await runtime.postUserMessage({
      content: "请四位一起重访这个 open question；每个人只说一句回应、搁置或质疑，不要关闭它。",
      clientMessageId: "client_runtime_open_question_pressure_review",
      mentions: ["kimi_member_01", "kimi_member_02", "mimo_member_01", "mimo_member_04"],
      contextRefs: [questionRef],
    });

    const record = reviewed.socialState.openQuestions.find((item) => item.questionId === questionRef);
    assert.equal(record?.responseCount, 4);
    assert.deepEqual(record?.responseKindCounts, { contested: 2, deferred: 1, responded: 1 });
    assert.equal(record?.contestedCount, 2);
    assert.equal(record?.deferredCount, 1);
    assert.equal(record?.refinedCount, 0);
    assert.equal(record?.respondingAgentIds.length, 4);

    const summaries = reviewed.messages.filter((message) =>
      message.messageId.startsWith(`social_response_group:open_question.responded:${questionRef}:`),
    );
    assert.equal(summaries.length, 1);
    assert.match(summaries[0]?.text ?? "", /4 agents responded to open question/);
    assert.match(summaries[0]?.text ?? "", /contested: 2/);
    assert.match(summaries[0]?.text ?? "", /deferred: 1/);
    assert.match(summaries[0]?.text ?? "", /responded: 1/);
    assert.match(summaries[0]?.text ?? "", /individual responses remain ledgered/);
    assert.match(summaries[0]?.text ?? "", /open question remains unresolved social context/);
    assert.equal(summaries[0]?.contextRefs.includes(questionRef), true);
    assert.equal(summaries[0]?.mentions.includes("kimi_member_01"), true);
    assert.equal(summaries[0]?.mentions.includes("kimi_member_02"), true);
    assert.equal(summaries[0]?.mentions.includes("mimo_member_01"), true);
    assert.equal(summaries[0]?.mentions.includes("mimo_member_04"), true);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "open_question.responded").length, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime keeps refined open questions as new lineage objects", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-open-question-refine-"));
  try {
    let call = 0;
    const originalQuestion = "What should stay unresolved before memory?";
    const refinedQuestion = "Which evidence would make that unresolved memory boundary safe to revisit?";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          call += 1;
          if (call === 1) {
            return JSON.stringify({
              kind: "ask_question",
              question: originalQuestion,
              target: "room",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          const carriedQuestionRef = request.packet.contextFragments?.find((fragment) => fragment.type === "open_question")?.refs[0];
          return JSON.stringify({
            kind: "ask_question",
            question: refinedQuestion,
            target: "room",
            contextRefs: carriedQuestionRef ? [carriedQuestionRef] : [],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const asked = await runtime.postUserMessage({
      content: "@kimi_member_01 raise one unresolved memory question.",
      clientMessageId: "client_runtime_open_question_refine_first",
      mentions: ["kimi_member_01"],
    });
    const originalRef = asked.socialState.openQuestions[0]?.questionId ?? "";
    assert.notEqual(originalRef, "");

    const refined = await runtime.postUserMessage({
      content: "@kimi_member_01 refine the prior open question as a new question, without closing it.",
      clientMessageId: "client_runtime_open_question_refine_second",
      mentions: ["kimi_member_01"],
      contextRefs: [originalRef],
    });

    const refinedRecord = refined.socialState.openQuestions.find((question) => question.question === refinedQuestion);
    const originalRecord = refined.socialState.openQuestions.find((question) => question.questionId === originalRef);
    assert.equal(refinedRecord?.refinedFromQuestionRef, originalRef);
    assert.equal(refinedRecord?.refinedBy, "kimi_member_01");
    assert.equal(originalRecord?.responseCount, 1);
    assert.equal(originalRecord?.lastResponse?.response, "refined");
    assert.match(originalRecord?.lastResponse?.summary ?? "", /Which evidence/);

    const events = await runtime.rawEvents();
    const refinedTopicUpdate = events.find(
      (event) => event.event_type === "topic.updated" && JSON.stringify(event.payload).includes(refinedQuestion),
    );
    assert.match(JSON.stringify(refinedTopicUpdate?.payload ?? {}), /refinedFromQuestionRef/);
    assert.equal(refinedTopicUpdate?.refs.includes(originalRef), true);

    const archived = await runtime.createDailyArchive({ date: "2026-06-20", timezone: "Asia/Shanghai" });
    const refinedTrace = archived.archive.openQuestionTraces.find((question) => question.question === refinedQuestion);
    const originalTrace = archived.archive.openQuestionTraces.find((question) => question.questionId === originalRef);
    assert.equal(refinedTrace?.refinedFromQuestionRef, originalRef);
    assert.equal(refinedTrace?.refinedBy, "kimi_member_01");
    assert.equal(originalTrace?.responses[0]?.response, "refined");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects side-effect approval requests without executing them", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-side-effect-"));
  const ledgerPath = path.join(dir, "room-ledger.jsonl");
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) =>
          JSON.stringify({
            kind: "request_side_effect",
            sideEffectKind: "filesystem.write",
            target: `${request.agent.workspace.scratchPath}boundary-note.md`,
            reason: "A private scratch note would help before proposing public memory.",
            expectedImpact: "Create one private workspace note; no public memory or external action is completed.",
            proposedCommand: "write boundary-note.md",
            contextRefs: [request.packet.triggeringEventId],
          }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const state = await runtime.postUserMessage({
      content: "@kimi_member_01 request approval for private scratch only if useful.",
      clientMessageId: "client_runtime_side_effect_request",
      mentions: ["kimi_member_01"],
    });

    assert.deepEqual(state.turn.intentionKinds, ["request_side_effect"]);
    assert.equal(state.turn.visibleMessageEventIds.length, 0);
    assert.equal(state.socialState.sideEffects.length, 1);
    assert.equal(state.socialState.sideEffects[0]?.status, "requested");
    assert.equal(state.socialState.sideEffects[0]?.requestedBy, "kimi_member_01");
    assert.equal(state.socialState.sideEffects[0]?.target, "agents/kimi_member_01/workspace/boundary-note.md");
    assert.match(state.socialState.sideEffects[0]?.boundaryNote ?? "", /requires explicit approval/);
    assert.equal(
      state.messages.some((message) => message.displayName === "System Note" && message.text.includes("requested side-effect approval")),
      true,
    );

    const sideEffect = state.socialState.sideEffects[0];
    assert.ok(sideEffect);
    let approvalSequence = 0;
    const ledger = new RoomLedger({
      filePath: ledgerPath,
      idFactory: (prefix) => `${prefix}_side_effect_approval_${++approvalSequence}`,
    });
    const approval = await ledger.append({
      roomId: "room_species",
      eventType: "side_effect.approved",
      actor: { kind: "user", id: "test_user" },
      payload: {
        requestId: sideEffect.requestId,
        approvalId: sideEffect.approvalId ?? sideEffect.requestId,
        approvedBy: "test_user",
        reason: "test grants this permission so the settings surface can retire it unused",
        scope: {
          kinds: [sideEffect.kind ?? "filesystem.write"],
          targets: [sideEffect.target],
          allowedAgents: [sideEffect.requestedBy ?? "kimi_member_01"],
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
        decidedAt: new Date().toISOString(),
      },
      refs: [sideEffect.requestId],
      correlationId: "test_side_effect_approved",
      idempotencyKey: "test_side_effect_approved",
    });
    assert.equal(approval.status, "appended");

    const approved = await runtime.getState();
    assert.equal(approved.socialState.sideEffects[0]?.status, "approved");

    const expired = await runtime.expireSideEffectPermission({
      requestRef: sideEffect.requestId,
      reason: "retire the unused permission from settings",
    });
    assert.equal(expired.expiredSideEffectRef, sideEffect.requestId);
    assert.equal(expired.expiredApprovalId, sideEffect.approvalId ?? sideEffect.requestId);
    assert.equal(expired.socialState.sideEffects[0]?.status, "expired");
    assert.match(expired.socialState.sideEffects[0]?.decisionReason ?? "", /retire the unused permission/);
    assert.equal(
      expired.messages.some((message) => message.displayName === "System Note" && message.text.includes("expired side-effect permission")),
      true,
    );
    await assert.rejects(
      () => runtime.expireSideEffectPermission({ requestRef: sideEffect.requestId }),
      /not approved/,
    );

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "side_effect.requested").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.approved").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.expired").length, 1);
    assert.equal(events.some((event) => event.event_type === "side_effect.result_reported"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime approves and executes simple capability side-effect tasks", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-capability-approval-"));
  const ledgerPath = path.join(dir, "room-ledger.jsonl");
  const targetPath = path.join(dir, "approved-note.txt");
  const shellCommand = "echo approved-shell-ok";
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (request.agent.agentId !== "kimi_member_01") {
            return JSON.stringify({ kind: "stay_silent", reason: "approval test targets one requester" });
          }
          if (request.triggerContent?.toLowerCase().includes("shell")) {
            return JSON.stringify({
              kind: "use_capability",
              capabilityId: "local.shell.exec",
              operation: "exec",
              input: { query: shellCommand },
              reason: "Run one approved shell echo for the approval path test.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "use_capability",
            capabilityId: "local.filesystem.write",
            operation: "write_file",
            input: { path: targetPath },
            reason: "Write one approved temporary file for the approval path test.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "approval test targets one requester" }),
      },
    });

    const fileRequested = await runtime.postUserMessage({
      content: "@kimi_member_01 set up a simple approved file-write task.",
      clientMessageId: "client_runtime_capability_file_approval",
      mentions: ["kimi_member_01"],
    });
    const fileSideEffect = fileRequested.socialState.sideEffects.find((item) => item.kind === "filesystem.write");
    assert.ok(fileSideEffect);
    assert.equal(fileSideEffect.status, "requested");
    assert.equal(fileSideEffect.target, targetPath);

    const fileApproved = await runtime.approveSideEffectPermission({
      requestRef: fileSideEffect.requestId,
      reason: "test approves this exact temporary file write",
    });
    assert.equal(fileApproved.socialState.sideEffects.find((item) => item.requestId === fileSideEffect.requestId)?.status, "approved");

    const fileExecuted = await runtime.executeApprovedSideEffect({
      requestRef: fileSideEffect.requestId,
      content: "approved-file-ok\n",
    });
    const executedFileSideEffect = fileExecuted.socialState.sideEffects.find((item) => item.requestId === fileSideEffect.requestId);
    assert.equal(executedFileSideEffect?.status, "completed");
    assert.match(executedFileSideEffect?.resultSummary ?? "", /Wrote 17 bytes/);
    assert.equal(await readFile(targetPath, "utf8"), "approved-file-ok\n");

    const shellRequested = await runtime.postUserMessage({
      content: "@kimi_member_01 set up a simple approved shell task.",
      clientMessageId: "client_runtime_capability_shell_approval",
      mentions: ["kimi_member_01"],
    });
    const shellSideEffect = shellRequested.socialState.sideEffects.find((item) => item.kind === "shell.exec");
    assert.ok(shellSideEffect);
    assert.equal(shellSideEffect.status, "requested");
    assert.equal(shellSideEffect.target, shellCommand);

    await runtime.approveSideEffectPermission({
      requestRef: shellSideEffect.requestId,
      reason: "test approves this exact shell command",
    });
    const shellExecuted = await runtime.executeApprovedSideEffect({ requestRef: shellSideEffect.requestId });
    const executedShellSideEffect = shellExecuted.socialState.sideEffects.find((item) => item.requestId === shellSideEffect.requestId);
    assert.equal(executedShellSideEffect?.status, "completed");
    assert.match(executedShellSideEffect?.resultSummary ?? "", /approved-shell-ok/);

    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "capability.result").length, 2);
    assert.equal(events.filter((event) => event.event_type === "side_effect.requested").length, 2);
    assert.equal(events.filter((event) => event.event_type === "side_effect.approved").length, 2);
    assert.equal(events.filter((event) => event.event_type === "side_effect.result_reported").length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects side-effect review speech without approval or execution", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-side-effect-review-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (request.agent.agentId === "kimi_member_01") {
            return JSON.stringify({
              kind: "request_side_effect",
              sideEffectKind: "filesystem.write",
              target: `${request.agent.workspace.scratchPath}review-boundary.md`,
              reason: "A scratch note might help, but it should remain approval-gated.",
              expectedImpact: "Create one private file only if later approved.",
              proposedCommand: "write review-boundary.md",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "speak",
            content: "这个 side-effect request 目标还太宽；我只保留审阅压力，不批准、不拒绝，也不执行。",
            contextRefs:
              request.packet.contextFragments
                ?.find((fragment) => fragment.type === "side_effect_boundary")
                ?.refs.slice(0, 1) ?? [],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const requested = await runtime.postUserMessage({
      content: "@kimi_member_01 request a side-effect boundary only.",
      clientMessageId: "client_runtime_side_effect_review_request",
      mentions: ["kimi_member_01"],
    });
    const sideEffectRef = requested.socialState.sideEffects[0]?.requestId;
    assert.ok(sideEffectRef);

    const reviewed = await runtime.postUserMessage({
      content: `@kimi_member_02 discuss ${sideEffectRef} without approving, denying, expiring, or executing it.`,
      clientMessageId: "client_runtime_side_effect_review_speech",
      mentions: ["kimi_member_02"],
      contextRefs: [sideEffectRef],
    });

    assert.equal(reviewed.socialState.sideEffects[0]?.requestId, sideEffectRef);
    assert.equal(reviewed.socialState.sideEffects[0]?.status, "requested");
    assert.equal(reviewed.socialState.sideEffectReviews.length, 1);
    assert.equal(reviewed.socialState.sideEffectReviews[0]?.sideEffectRef, sideEffectRef);
    assert.equal(reviewed.socialState.sideEffectReviews[0]?.response, "cautioned");
    assert.match(reviewed.socialState.sideEffectReviews[0]?.summary ?? "", /不批准、不拒绝/);
    assert.match(reviewed.socialState.sideEffectReviews[0]?.boundaryNote ?? "", /does not approve, deny, expire/);
    assert.equal(
      reviewed.messages.some((message) => message.displayName === "System Note" && message.text.includes("cautioned side-effect request")),
      true,
    );
    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "side_effect.requested").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.reviewed").length, 1);
    assert.equal(events.filter((event) => event.event_type === "side_effect.approved").length, 0);
    assert.equal(events.filter((event) => event.event_type === "side_effect.denied").length, 0);
    assert.equal(events.filter((event) => event.event_type === "side_effect.expired").length, 0);
    assert.equal(events.filter((event) => event.event_type === "side_effect.result_reported").length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects workspace artifact shares without promoting memory", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-workspace-share-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) =>
          JSON.stringify({
            kind: "share_workspace_artifact",
            pathRef: `agents/${request.agent.agentId}/workspace/reflection.md`,
            summary: "A private reflection is ready as a room-visible ref only.",
            contextRefs: [request.packet.triggeringEventId],
          }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const state = await runtime.postUserMessage({
      content: "@kimi_member_01 share a workspace artifact ref, not memory.",
      clientMessageId: "client_runtime_workspace_share",
      mentions: ["kimi_member_01"],
    });

    assert.deepEqual(state.turn.intentionKinds, ["share_workspace_artifact"]);
    const workspace = state.socialState.workspaces.find((item) => item.agentId === "kimi_member_01");
    assert.equal(workspace?.sharedArtifactCount, 1);
    const artifactRef = workspace?.sharedArtifactRefs[0] ?? "";
    assert.match(artifactRef, /^artifact_/);
    const shareMessage = state.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("shared a private workspace reference"),
    );
    assert.ok(shareMessage);
    assert.equal(shareMessage.text.includes(artifactRef), false);
    assert.equal(shareMessage.text.includes("agents/kimi_member_01/workspace/reflection.md"), false);
    assert.equal(shareMessage.text.includes("not copied into memory"), true);
    assert.equal(shareMessage.contextRefs.includes(artifactRef), true);
    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "workspace.artifact_shared").length, 1);
    assert.equal(events.some((event) => event.event_type === "memory.proposed"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects workspace artifact reviews without promoting memory", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-workspace-review-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          if (request.agent.agentId === "kimi_member_01") {
            return JSON.stringify({
              kind: "share_workspace_artifact",
              pathRef: `agents/${request.agent.agentId}/workspace/reflection.md`,
              summary: "A private reflection is ready as a room-visible ref only.",
              contextRefs: [request.packet.triggeringEventId],
            });
          }
          return JSON.stringify({
            kind: "speak",
            content: "Keep this as a private workspace reference; do not copy it into memory or execute anything.",
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const shared = await runtime.postUserMessage({
      content: "@kimi_member_01 share a workspace artifact ref, not memory.",
      clientMessageId: "client_runtime_workspace_review_share",
      mentions: ["kimi_member_01"],
    });
    const artifactRef = shared.socialState.workspaces[0]?.sharedArtifactRefs[0];
    assert.ok(artifactRef);

    const reviewed = await runtime.postUserMessage({
      content: `@kimi_member_02 discuss ${artifactRef} without copying private content or promoting memory.`,
      clientMessageId: "client_runtime_workspace_review_speech",
      mentions: ["kimi_member_02"],
      contextRefs: [artifactRef],
    });

    assert.equal(reviewed.socialState.workspaceArtifactReviews.length, 1);
    assert.equal(reviewed.socialState.workspaceArtifactReviews[0]?.artifactRef, artifactRef);
    assert.equal(reviewed.socialState.workspaceArtifactReviews[0]?.response, "cautioned");
    assert.match(reviewed.socialState.workspaceArtifactReviews[0]?.summary ?? "", /private workspace reference/);
    assert.match(reviewed.socialState.workspaceArtifactReviews[0]?.boundaryNote ?? "", /does not copy private workspace contents/);
    const artifactReviewRef = reviewed.socialState.workspaceArtifactReviews[0]?.reviewId ?? "";
    assert.match(artifactReviewRef, /^workspace_artifact_review_/);
    const artifactReviewMessage = reviewed.messages.find(
      (message) =>
        message.displayName === "System Note" && message.text.includes("cautioned the private workspace reference"),
    );
    assert.ok(artifactReviewMessage);
    assert.equal(artifactReviewMessage.text.includes(artifactRef), false);
    assert.equal(artifactReviewMessage.text.includes(artifactReviewRef), false);
    assert.equal(artifactReviewMessage.contextRefs.includes(artifactRef), true);
    assert.equal(artifactReviewMessage.contextRefs.includes(artifactReviewRef), true);
    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "workspace.artifact_shared").length, 1);
    assert.equal(events.filter((event) => event.event_type === "workspace.artifact_reviewed").length, 1);
    assert.equal(events.some((event) => event.event_type === "memory.proposed"), false);
    assert.equal(events.some((event) => event.event_type === "side_effect.requested"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects skill capsule reviews without execution or role assignment", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-skill-review-"));
  try {
    const pressureRef = "mixed_review:runtime_skill_capsule_pressure";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () =>
          JSON.stringify({
            kind: "speak",
            content: "This skill capsule needs explicit approval boundaries and must not execute tools or become my fixed role.",
            contextRefs: [],
          }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const initial = await runtime.getState();
    const firstCapsule = initial.socialState.skillCapsules[0];
    const capsuleRef = firstCapsule?.capsuleId;
    assert.ok(capsuleRef);
    assert.equal(firstCapsule?.disclosurePolicy, "brief_first_full_on_request");
    assert.match(firstCapsule?.summary ?? "", /load.*relevant|organ/);
    assert.match(firstCapsule?.instructionRef ?? "", /^skill:\/\//);
    assert.match(firstCapsule?.inputContract ?? "", /current room refs/);
    assert.match(firstCapsule?.outputContract ?? "", /approval-gated request/);
    assert.equal(firstCapsule?.approvalProfile.approvalRequired, false);
    assert.equal("fullInstructions" in (firstCapsule ?? {}), false);

    const reviewed = await runtime.postUserMessage({
      content: `@kimi_member_01 discuss ${capsuleRef} without executing tools, bypassing approval, or assigning a role.`,
      clientMessageId: "client_runtime_skill_capsule_review_speech",
      mentions: ["kimi_member_01"],
      contextRefs: [capsuleRef, pressureRef],
    });

    assert.equal(reviewed.socialState.skillCapsuleReviews.length, 1);
    assert.equal(reviewed.socialState.skillCapsuleReviews[0]?.capsuleRef, capsuleRef);
    assert.equal(reviewed.socialState.skillCapsuleReviews[0]?.response, "cautioned");
    assert.match(reviewed.socialState.skillCapsuleReviews[0]?.summary ?? "", /explicit approval boundaries/);
    assert.deepEqual(reviewed.socialState.skillCapsuleReviews[0]?.sourcePressureRefs, [pressureRef]);
    assert.match(reviewed.socialState.skillCapsuleReviews[0]?.boundaryNote ?? "", /does not register a skill/);
    const capsuleReviewRef = reviewed.socialState.skillCapsuleReviews[0]?.reviewId ?? "";
    assert.match(capsuleReviewRef, /^skill_capsule_review_/);
    const capsuleReviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("cautioned the skill boundary"),
    );
    assert.ok(capsuleReviewMessage);
    assert.equal(capsuleReviewMessage.text.includes(capsuleRef), false);
    assert.equal(capsuleReviewMessage.text.includes(capsuleReviewRef), false);
    assert.equal(capsuleReviewMessage.contextRefs.includes(capsuleRef), true);
    assert.equal(capsuleReviewMessage.contextRefs.includes(capsuleReviewRef), true);
    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "skill.capsule_reviewed").length, 1);
    assert.deepEqual(
      (events.find((event) => event.event_type === "skill.capsule_reviewed")?.payload as { sourcePressureRefs?: string[] })
        .sourcePressureRefs,
      [pressureRef],
    );
    const carried = await runtime.postUserMessage({
      content: `@kimi_member_01 inspect ${capsuleRef} as context only.`,
      clientMessageId: "client_runtime_skill_capsule_lineage_audit",
      mentions: ["kimi_member_01"],
      contextRefs: [capsuleRef],
    });
    const carriedSkillFragment = carried.contextAudits
      .slice()
      .reverse()
      .flatMap((audit) => audit.selectedFragments)
      .find((fragment) => fragment.type === "skill_capsule_ref" && fragment.refs.includes(capsuleRef));
    assert.ok(carriedSkillFragment);
    assert.equal(carriedSkillFragment.boundarySignals?.sourcePressureRefCount, 1);
    assert.match(String(carriedSkillFragment.boundarySignals?.sourcePressureRefs ?? ""), new RegExp(pressureRef));
    assert.equal(carriedSkillFragment.stateKeys?.includes("skillCapsuleStatus"), true);
    assert.equal(carriedSkillFragment.stateKeys?.includes("skillCapsuleLastReview"), true);
    assert.equal(carriedSkillFragment.stateKeys?.includes("skillCapsuleSourcePressureRefs"), true);
    assert.equal(events.some((event) => event.event_type === "memory.proposed"), false);
    assert.equal(events.some((event) => event.event_type === "side_effect.requested"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projects capability hint reviews without mutating wake authority", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-capability-review-"));
  try {
    const pressureRef = "mixed_review:runtime_capability_hint_pressure";
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async () =>
          JSON.stringify({
            kind: "speak",
            content:
              "This capability hint can help decide who gets a weak wake knock, but it must not change wake score, assign a role, or certify competence.",
            contextRefs: [],
          }),
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const initial = await runtime.getState();
    const capabilityRef = initial.agents.find((agent) => agent.id === "kimi_member_01")?.capabilityRefs[0];
    assert.ok(capabilityRef);

    const reviewed = await runtime.postUserMessage({
      content: `@kimi_member_01 review ${capabilityRef} as a weak capability hint only.`,
      clientMessageId: "client_runtime_capability_review_speech",
      mentions: ["kimi_member_01"],
      contextRefs: [capabilityRef, pressureRef],
    });

    assert.equal(reviewed.socialState.capabilityReviews.length, 1);
    assert.equal(reviewed.socialState.capabilityReviews[0]?.capabilityRef, capabilityRef);
    assert.equal(reviewed.socialState.capabilityReviews[0]?.response, "cautioned");
    assert.match(reviewed.socialState.capabilityReviews[0]?.summary ?? "", /weak wake knock/);
    assert.deepEqual(reviewed.socialState.capabilityReviews[0]?.sourcePressureRefs, [pressureRef]);
    assert.match(reviewed.socialState.capabilityReviews[0]?.boundaryNote ?? "", /does not change wake score/);
    const capabilityReviewRef = reviewed.socialState.capabilityReviews[0]?.reviewId ?? "";
    assert.match(capabilityReviewRef, /^capability_review_/);
    const capabilityReviewMessage = reviewed.messages.find(
      (message) => message.displayName === "System Note" && message.text.includes("cautioned the weak capability hint"),
    );
    assert.ok(capabilityReviewMessage);
    assert.equal(capabilityReviewMessage.text.includes(capabilityRef), false);
    assert.equal(capabilityReviewMessage.text.includes(capabilityReviewRef), false);
    assert.equal(capabilityReviewMessage.contextRefs.includes(capabilityRef), true);
    assert.equal(capabilityReviewMessage.contextRefs.includes(capabilityReviewRef), true);
    const events = await runtime.rawEvents();
    assert.equal(events.filter((event) => event.event_type === "capability.reviewed").length, 1);
    assert.deepEqual(
      (events.find((event) => event.event_type === "capability.reviewed")?.payload as { sourcePressureRefs?: string[] })
        .sourcePressureRefs,
      [pressureRef],
    );
    const carried = await runtime.postUserMessage({
      content: `@kimi_member_01 inspect ${capabilityRef} as context only.`,
      clientMessageId: "client_runtime_capability_lineage_audit",
      mentions: ["kimi_member_01"],
      contextRefs: [capabilityRef],
    });
    const carriedCapabilityFragment = carried.contextAudits
      .slice()
      .reverse()
      .flatMap((audit) => audit.selectedFragments)
      .find((fragment) => fragment.type === "capability_ref" && fragment.refs.includes(capabilityRef));
    assert.ok(carriedCapabilityFragment);
    assert.equal(carriedCapabilityFragment.boundarySignals?.sourcePressureRefCount, 1);
    assert.match(String(carriedCapabilityFragment.boundarySignals?.sourcePressureRefs ?? ""), new RegExp(pressureRef));
    assert.equal(carriedCapabilityFragment.stateKeys?.includes("capabilityLastReview"), true);
    assert.equal(carriedCapabilityFragment.stateKeys?.includes("capabilitySourcePressureRefs"), true);
    assert.equal(events.some((event) => event.event_type === "memory.proposed"), false);
    assert.equal(events.some((event) => event.event_type === "side_effect.requested"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime can enqueue messages without waiting for live providers", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-async-"));
  try {
    const providerCalls: string[] = [];
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          providerCalls.push(request.agent.agentId);
          await delay(250);
          return JSON.stringify({
            kind: "speak",
            content: `${request.agent.displayName} async reply`,
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async (request) => {
          providerCalls.push(request.agent.agentId);
          await delay(250);
          return JSON.stringify({
            kind: "speak",
            content: `${request.agent.displayName} async reply`,
            contextRefs: [request.packet.triggeringEventId],
          });
        },
      },
    });

    const startedAt = Date.now();
    const accepted = await runtime.enqueueUserMessage({
      content: "异步发送应该先显示用户消息。",
      clientMessageId: "client_async_runtime_test",
      mentions: ["mimo_member_01"],
    });
    const elapsedMs = Date.now() - startedAt;

    assert.equal(accepted.turn.status, "queued");
    assert.deepEqual(accepted.turn.invitedAgents, ["mimo_member_01"]);
    assert.ok(elapsedMs < 200, `enqueue took ${elapsedMs}ms`);
    assert.equal(accepted.messages.at(-1)?.text, "异步发送应该先显示用户消息。");

    await delay(450);
    const completed = await runtime.getState();
    assert.deepEqual(providerCalls, ["mimo_member_01"]);
    assert.equal(completed.messages.some((message) => message.text === "doubao-seed-2.0-pro async reply"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime records pressure and delays wake when background turns exceed the room boundary", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-pressure-"));
  let releaseFirstTurn: (() => void) | undefined;
  try {
    const firstTurnHolding = new Promise<void>((resolve) => {
      releaseFirstTurn = resolve;
    });
    const providerTriggers: string[] = [];
    let kimiSawPressureBoundary = false;
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxConcurrentBackgroundTurns: 1,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          providerTriggers.push(request.packet.triggeringEventId);
          kimiSawPressureBoundary =
            kimiSawPressureBoundary ||
            (request.packet.contextFragments?.some(
              (fragment) =>
                fragment.type === "pressure_boundary" &&
                fragment.body.includes("room resource signal") &&
                fragment.body.includes("background_turn_concurrency_limit"),
            ) ??
              false);
          if (providerTriggers.length === 1) {
            await firstTurnHolding;
          }
          return JSON.stringify({
            kind: "stay_silent",
            reason: "The room is testing pressure boundaries without forcing speech.",
          });
        },
        mimoInvoker: async () => JSON.stringify({ kind: "stay_silent", reason: "not involved" }),
      },
    });

    const first = await runtime.enqueueUserMessage({
      content: "@kimi_member_01 hold the first background turn for a pressure test.",
      clientMessageId: "client_pressure_first",
      mentions: ["kimi_member_01"],
    });
    assert.equal(first.turn.status, "queued");

    await waitFor(async () => providerTriggers.length === 1);

    const second = await runtime.enqueueUserMessage({
      content: "@kimi_member_01 this message should enter the ledger but wait for wake bandwidth.",
      clientMessageId: "client_pressure_second",
      mentions: ["kimi_member_01"],
    });
    assert.equal(second.turn.status, "pressure_queued");
    assert.equal(second.socialState.pressureBoundaries.length, 1);
    assert.equal(second.socialState.pressureBoundaries[0]?.reason, "background_turn_concurrency_limit");
    assert.equal(second.socialState.pressureBoundaries[0]?.maxConcurrentBackgroundTurns, 1);
    assert.match(second.socialState.pressureBoundaries[0]?.boundaryNote ?? "", /keep the room inhabitable/);
    assert.equal(
      second.messages.some((message) => message.text === "@kimi_member_01 this message should enter the ledger but wait for wake bandwidth."),
      true,
    );
    assert.equal(second.messages.at(-1)?.text.includes("room pressure detected"), true);

    const pressuredEvents = await runtime.rawEvents();
    const pressure = pressuredEvents.find((event) => event.event_type === "room.pressure_detected");
    assert.ok(pressure);
    assert.equal((pressure.payload as { reason?: string }).reason, "background_turn_concurrency_limit");
    assert.equal((pressure.payload as { maxConcurrentBackgroundTurns?: number }).maxConcurrentBackgroundTurns, 1);
    assert.equal(
      pressuredEvents.some(
        (event) =>
          event.event_type === "wake.candidates_selected" &&
          event.correlation_id === "turn:client_pressure_second",
      ),
      false,
    );

    releaseFirstTurn?.();
    await waitFor(async () => {
      const events = await runtime.rawEvents();
      return events.some(
        (event) =>
          event.event_type === "agent.intention_recorded" &&
          event.correlation_id === "turn:client_pressure_second",
      );
    });

    await waitForRuntimeIdle(runtime);
    const completed = await runtime.getState();
    assert.equal(
      completed.messages.some((message) => message.displayName === "System Note" && message.text.includes("room pressure detected")),
      true,
    );
    assert.equal(metricValue(completed.metrics, "queued background turns"), "0");
    assert.equal(metricValue(completed.metrics, "active background turns"), "0");

    await runtime.postUserMessage({
      content: "@kimi_member_01 please use this room pressure boundary to self-regulate.",
      clientMessageId: "client_pressure_context_ref",
      mentions: ["kimi_member_01"],
      contextRefs: [pressure.event_id],
    });
    assert.equal(kimiSawPressureBoundary, true);

    const archived = await runtime.createDailyArchive({ date: "2026-06-18", timezone: "Asia/Shanghai" });
    assert.equal(archived.archive.pressureBoundaries.length, 1);
    assert.equal(archived.socialState.archives[0]?.pressureBoundaryCount, 1);
  } finally {
    releaseIfDefined(releaseFirstTurn);
    await delay(50);
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime honors configurable speaker budget and carries deferred fragments", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-budget-fragments-"));
  try {
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      maxAwakenedAgents: 2,
      maxSpeakers: 1,
      agentAdapterOptions: {
        kimiInvoker: async (request) =>
          JSON.stringify({
            kind: "speak",
            content: `${request.agent.displayName} budget-fragment reply`,
            contextRefs: [request.packet.triggeringEventId],
          }),
        mimoInvoker: async (request) =>
          JSON.stringify({
            kind: "speak",
            content: `${request.agent.displayName} budget-fragment reply`,
            contextRefs: [request.packet.triggeringEventId],
          }),
      },
    });

    await runtime.enqueueUserMessage({
      content: "@kimi_member_01 @kimi_member_02 both try to speak under a one-speaker boundary.",
      clientMessageId: "client_runtime_budget_fragments_first",
      mentions: ["kimi_member_01", "kimi_member_02"],
    });
    await waitFor(async () => {
      const events = await runtime.rawEvents();
      return events.some(
        (event) =>
          event.event_type === "agent.intention_deferred" &&
          event.correlation_id === "turn:client_runtime_budget_fragments_first",
      );
    });

    const firstEvents = await runtime.rawEvents();
    const wake = firstEvents.find(
      (event) =>
        event.event_type === "wake.candidates_selected" &&
        event.correlation_id === "turn:client_runtime_budget_fragments_first",
    );
    assert.equal((wake?.payload as { budget?: { maxSpeakers?: number } }).budget?.maxSpeakers, 1);

    await runtime.enqueueUserMessage({
      content: "Open room recovery after a one-speaker boundary.",
      clientMessageId: "client_runtime_budget_fragments_second",
    });
    await waitFor(async () => {
      const state = await runtime.getState();
      return state.contextAudits.some((audit) => audit.cacheKey.includes("deferred_intention:"));
    });

    const recovered = await runtime.getState();
    assert.equal(recovered.contextAudits.some((audit) => audit.cacheKey.includes("deferred_intention:")), true);
    await waitForRuntimeIdle(runtime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime previews all wake targets when enqueueing without mentions", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-async-all-"));
  try {
    const providerCalls: string[] = [];
    const runtime = new SpeciesRoomRuntime({
      ledgerPath: path.join(dir, "room-ledger.jsonl"),
      smoke: async () => smokeReport(),
      liveAgents: true,
      agentAdapterOptions: {
        kimiInvoker: async (request) => {
          providerCalls.push(request.agent.agentId);
          await delay(25);
          return JSON.stringify({
            kind: "speak",
            content: `${request.agent.displayName} heard the open room call`,
            contextRefs: [request.packet.triggeringEventId],
          });
        },
        mimoInvoker: async (request) => {
          providerCalls.push(request.agent.agentId);
          await delay(25);
          return JSON.stringify({
            kind: "speak",
            content: `${request.agent.displayName} heard the open room call`,
            contextRefs: [request.packet.triggeringEventId],
          });
        },
      },
    });

    const startedAt = Date.now();
    const accepted = await runtime.enqueueUserMessage({
      content: "有人在吗",
      clientMessageId: "client_async_all_agents_test",
    });
    const elapsedMs = Date.now() - startedAt;

    assert.equal(accepted.turn.status, "queued");
    assert.deepEqual(new Set(accepted.turn.invitedAgents), new Set(seedAgentIds()));
    assert.ok(elapsedMs < 200, `enqueue took ${elapsedMs}ms`);
    assert.equal(accepted.messages.at(-1)?.text, "有人在吗");

    await delay(250);
    assert.deepEqual(new Set(providerCalls), new Set(seedAgentIds()));
    const completed = await runtime.getState();
    assert.equal(completed.messages.filter((message) => message.text.includes("heard the open room call")).length, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("room runtime projections tolerate legacy message payloads and sparse refs", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-runtime-legacy-projection-"));
  try {
    const ledgerPath = path.join(dir, "room-ledger.jsonl");
    const ledger = new RoomLedger({ filePath: ledgerPath });
    const sourceMessageId = "msg_legacy_sparse_projection";
    const correlationId = "legacy_sparse_projection";
    const source = await ledger.append({
      roomId: "room_species",
      eventType: "message.created",
      actor: { kind: "user", id: "user" },
      payload: {
        messageId: sourceMessageId,
        content: "legacy sparse message should still project into chat",
        topicId: "topic_legacy_sparse_projection",
      },
      refs: [],
      causationId: sourceMessageId,
      correlationId,
      idempotencyKey: "legacy_sparse_projection_message",
    });
    assert.equal(source.status, "appended");
    const sparseRefs = [source.event.event_id, undefined as unknown as string];

    await ledger.append({
      roomId: "room_species",
      eventType: "open_question.responded",
      actor: { kind: "agent", id: "kimi_member_01" },
      payload: {
        sourceMessageId,
        questionId: "question_legacy_sparse_projection",
        response: "questioned",
        summary: "The sparse trace should remain readable.",
      },
      refs: sparseRefs,
      causationId: source.event.event_id,
      correlationId,
      idempotencyKey: "legacy_sparse_projection_question_response",
    });
    await ledger.append({
      roomId: "room_species",
      eventType: "handoff.reviewed",
      actor: { kind: "agent", id: "mimo_member_04" },
      payload: {
        sourceMessageId,
        handoffId: "handoff_legacy_sparse_projection",
        reviewId: "handoff_review_legacy_sparse_projection",
        review: "cautioned",
        summary: "Sparse refs should not break pressure projection.",
        reviewedRef: "handoff_legacy_sparse_projection",
      },
      refs: sparseRefs,
      causationId: source.event.event_id,
      correlationId,
      idempotencyKey: "legacy_sparse_projection_handoff_review",
    });

    const runtime = new SpeciesRoomRuntime({
      ledgerPath,
      smoke: async () => smokeReport(),
    });
    const state = await runtime.getState();
    assert.equal(state.messages.some((message) => message.text.includes("legacy sparse message")), true);
    assert.equal(state.messages.every((message) => message.initials.length > 0), true);

    const archived = await runtime.createDailyArchive({ date: "2026-06-21", timezone: "Asia/Shanghai" });
    assert.equal(archived.archive.eventCounts["open_question.responded"], 1);
    assert.equal(archived.archive.eventCounts["handoff.reviewed"], 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function smokeReport(): AgentSmokeReport {
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    memsuosConfigPath: "/opt/memsuos/model-providers.local.json",
    agents: [
      {
        agentId: "kimi_member_01",
        displayName: "kimi-k2.6",
        providerKind: "volc_ark_openai",
        providerLabel: "Volcengine Ark Plan kimi-k2.6",
        status: "ready",
        checks: [{ name: "Ark API key", ok: true, detail: "present (masked)" }],
      },
      {
        agentId: "kimi_member_02",
        displayName: "kimi-k2.7-code",
        providerKind: "volc_ark_openai",
        providerLabel: "Volcengine Ark Plan kimi-k2.7-code",
        status: "ready",
        checks: [{ name: "Ark API key", ok: true, detail: "present (masked)" }],
      },
      {
        agentId: "mimo_member_01",
        displayName: "doubao-seed-2.0-pro",
        providerKind: "volc_ark_openai",
        providerLabel: "Volcengine Ark Plan doubao-seed-2.0-pro",
        status: "ready",
        checks: [{ name: "Ark API key", ok: true, detail: "present (masked)" }],
      },
      {
        agentId: "mimo_member_02",
        displayName: "glm-5.2",
        providerKind: "volc_ark_openai",
        providerLabel: "Volcengine Ark Plan glm-5.2",
        status: "ready",
        checks: [{ name: "Ark API key", ok: true, detail: "present (masked)" }],
      },
      {
        agentId: "mimo_member_03",
        displayName: "minimax-m3",
        providerKind: "volc_ark_openai",
        providerLabel: "Volcengine Ark Plan minimax-m3",
        status: "ready",
        checks: [{ name: "Ark API key", ok: true, detail: "present (masked)" }],
      },
      {
        agentId: "mimo_member_04",
        displayName: "deepseek-v4-pro",
        providerKind: "volc_ark_openai",
        providerLabel: "Volcengine Ark Plan deepseek-v4-pro",
        status: "ready",
        checks: [{ name: "Ark API key", ok: true, detail: "present (masked)" }],
      },
    ],
  };
}

function seedAgentIds(): string[] {
  return [
    "kimi_member_01",
    "kimi_member_02",
    "mimo_member_01",
    "mimo_member_02",
    "mimo_member_03",
    "mimo_member_04",
  ];
}

function eventPayloadRef(events: RoomEvent[], eventType: string, key: string): string {
  const event = events.find((item) => item.event_type === eventType && typeof (item.payload as Record<string, unknown>)[key] === "string");
  return event === undefined ? "" : String((event.payload as Record<string, unknown>)[key]);
}

function eventIndex(events: RoomEvent[], eventId: string): number {
  return events.findIndex((event) => event.event_id === eventId);
}

async function appendTimelineEvent(
  ledger: RoomLedger,
  input: {
    eventType: string;
    actor: { kind: "user" | "agent" | "system" | "policy"; id: string };
    payload: Record<string, unknown>;
    refs: string[];
    idempotencyKey: string;
  },
): Promise<RoomEvent> {
  const result = await ledger.append({
    roomId: "room_species",
    eventType: input.eventType,
    actor: input.actor,
    payload: input.payload,
    refs: input.refs,
    correlationId: "timeline_projection_test",
    idempotencyKey: input.idempotencyKey,
  });
  if (result.status !== "appended") {
    assert.fail(`timeline fixture append failed for ${input.eventType}: ${result.status}`);
  }
  return result.event;
}

function runtimeContextFragment(id: string, type: string, refs: string[]): ContextFragment {
  return {
    id,
    type,
    visibility: "room_visible",
    role: "runtime",
    source: { kind: "ledger", eventId: refs[0], ledgerCursor: 1 },
    refs,
    tokenEstimate: 10,
    hardCap: 1_000,
    cacheKey: `${type}:${id}:evt_audit`,
    priority: 100,
    body: JSON.stringify({ states: { sourcePressureRefs: refs.filter((ref) => ref.startsWith("mixed_review:")) } }),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 1_500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await delay(20);
  }
  assert.fail("timed out waiting for runtime condition");
}

async function waitForRuntimeIdle(runtime: SpeciesRoomRuntime, timeoutMs = 2_500): Promise<void> {
  await waitFor(async () => {
    const metrics = (await runtime.getState()).metrics;
    return (
      metricValue(metrics, "active background turns") === "0" &&
      metricValue(metrics, "queued background turns") === "0" &&
      metricValue(metrics, "active autonomous background turns") === "0" &&
      metricValue(metrics, "queued autonomous background turns") === "0"
    );
  }, timeoutMs);
}

function metricValue(metrics: [string, string][], label: string): string | undefined {
  return metrics.find((metric) => metric[1] === label)?.[0];
}

function firstMemoryRef(refs: readonly string[]): string | undefined {
  return refs.find((ref) => ref.startsWith("memory_"));
}

function releaseIfDefined(release: (() => void) | undefined): void {
  release?.();
}
