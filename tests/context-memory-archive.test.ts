import test from "node:test";
import assert from "node:assert/strict";

import { DailyArchiveBuilder, ArchiveStore } from "../src/archive/archive";
import { ContextPacketBuilder, TopicWindowStore } from "../src/context/context";
import { MemoryClaimStore } from "../src/memory/memory";
import { EventActor, RefId, RoomEvent } from "../src/types";

const roomId = "room_species";
const topicId = "topic_living_room";

test("context packet is bounded by refs while preserving anchors and contested memory", () => {
  const events: RoomEvent[] = [
    event("evt_topic", "topic.created", {
      topicId,
      title: "Living room design",
      createdFromMessageId: "msg_anchor",
    }),
    event("evt_anchor", "message.created", {
      messageId: "msg_anchor",
      topicId,
      author: "architect",
      authorKind: "agent",
      mentions: [],
      contextRefs: [],
      content: "The system maintains boundaries; agents generate order.",
    }),
    event("evt_protocol", "protocol.proposed", {
      protocolId: "protocol_round",
      topicId,
      summary: "Run one critic round before accepting room memory.",
      status: "active",
    }),
    event("evt_handoff", "handoff.proposed", {
      handoffId: "handoff_critic",
      topicId,
      fromAgentId: "architect",
      toAgentId: "critic",
      reason: "Pressure test the current memory wording.",
      contextRefs: ["msg_anchor"],
      status: "proposed",
    }),
    ...Array.from({ length: 12 }, (_, index) =>
      event(`evt_old_${index}`, "message.created", {
        messageId: `msg_old_${index}`,
        topicId,
        author: "agent",
        authorKind: "agent",
        mentions: [],
        contextRefs: [],
        content: `Older transcript item ${index} that should be represented by bounded refs.`,
      }),
    ),
    event("evt_memory_proposed", "memory.proposed", {
      memoryId: "memory_contested",
      topicId,
      summary: "Daily archive should preserve disagreement.",
      sourceRefs: ["msg_anchor"],
      reason: "It appeared in design discussion.",
    }),
    event("evt_memory_accepted", "memory.accepted", {
      memoryId: "memory_contested",
      topicId,
      summary: "Daily archive should preserve disagreement.",
      evidenceRefs: ["msg_anchor"],
      reason: "Accepted as a working room assumption.",
    }),
    event("evt_memory_contested", "memory.contested", {
      memoryId: "memory_contested",
      topicId,
      reason: "The wording risks turning archive into truth.",
      evidenceRefs: ["msg_contest"],
    }),
    event("evt_memory_other", "memory.accepted", {
      memoryId: "memory_accepted",
      topicId,
      summary: "Wake policy knocks; it does not command.",
      sourceRefs: ["msg_anchor"],
    }),
    event("evt_archive", "daily_archive.created", {
      archiveId: "day_2026_06_17",
      date: "2026-06-17",
      topicIds: [topicId],
      summary: "A day of living-room architecture discussion.",
    }),
    event("evt_trigger", "message.created", {
      messageId: "msg_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Please continue the context design.",
    }),
  ];

  const store = TopicWindowStore.fromEvents(events, { maxMessageRefs: 6 });
  const window = store.getTopic(topicId);
  assert.ok(window);
  assert.ok(window.messageRefs.length <= 6);
  assert.deepEqual(window.protocolRefs, ["protocol_round"]);
  assert.deepEqual(window.handoffRefs, ["handoff_critic"]);
  assert.deepEqual(window.archiveRefs, ["day_2026_06_17"]);

  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_trigger",
    recipientAgent: "critic",
    maxRefs: 8,
    maxTokens: 10_000,
  });

  const allRefs = flattenPacketRefs(packet.refs);
  assert.ok(allRefs.length <= 8);
  assert.ok(allRefs.includes("msg_trigger"));
  assert.ok(allRefs.includes("msg_anchor"));
  assert.ok(allRefs.includes("memory_contested"));
  assert.ok(allRefs.includes("memory_accepted"));
  assert.ok(allRefs.includes("protocol_round"));
  assert.ok(allRefs.includes("handoff_critic"));
  assert.ok(allRefs.includes("day_2026_06_17"));
  assert.ok(!allRefs.includes("msg_old_0"));
  assert.ok(packet.omitted.some((item) => item.refType === "message" && item.reason === "context_budget"));
  assert.ok(packet.fragments.some((fragment) => fragment.type === "budget" && fragment.visibility === "hidden_runtime"));
  assert.ok(packet.fragments.some((fragment) => fragment.type === "trigger" && fragment.refs.includes("msg_trigger")));
  assert.ok(
    packet.fragments.some(
      (fragment) =>
        fragment.type === "memory_accepted" &&
        fragment.body.includes("provisional room sediment, not truth"),
    ),
  );
  assert.ok(packet.fragments.every((fragment) => fragment.hardCap > 0));
  assert.equal(packet.audit.selectedFragments.length, packet.fragments.length);
  assert.equal(packet.audit.totalTokenEstimate, packet.budget.usedTokensEstimate);
  assert.equal(packet.budget.remainingTokensEstimate, 10_000 - packet.budget.usedTokensEstimate);
  assert.ok(packet.audit.builtFromLedgerRange.toCursor >= packet.audit.builtFromLedgerRange.fromCursor);
});

test("soft social context fragments carry handoff, protocol, and persona semantics", () => {
  const events = [
    event("evt_social_topic", "topic.created", {
      topicId,
      title: "Soft social objects",
      createdFromMessageId: "msg_social_anchor",
    }),
    event("evt_social_anchor", "message.created", {
      messageId: "msg_social_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Keep handoffs and protocols as proposals.",
    }),
    event("evt_protocol_proposed", "protocol.proposed", {
      protocolId: "protocol_social",
      topicId,
      proposedBy: "mimo_member_01",
      summary: "Try a two-turn listening pause before contesting memory.",
      scope: "timeboxed",
      expiresAt: "2026-06-17T12:30:00.000Z",
      reason: "The room is moving too quickly to hear objections.",
      contextRefs: ["msg_social_anchor", "mixed_review:msg_social_anchor:turn:social_pressure"],
      sourcePressureRefs: ["mixed_review:msg_social_anchor:turn:social_pressure"],
      status: "proposed",
    }),
    event("evt_protocol_responded", "protocol.responded", {
      protocolId: "protocol_social",
      protocolRef: "protocol_social",
      topicId,
      agentId: "mimo_member_02",
      response: "challenge",
      reason: "The pause may hide urgent corrections.",
      proposedRevision: "Pause only for memory claims that lack evidence refs.",
      contextRefs: ["msg_social_anchor"],
      status: "challenged",
    }),
    event("evt_handoff_proposed", "handoff.proposed", {
      handoffId: "handoff_social",
      topicId,
      fromAgentId: "mimo_member_01",
      toAgentId: "mimo_member_03",
      reason: "This memory wording needs a gentler objection.",
      requestedResponse: "Name the softest useful objection.",
      contextRefs: ["msg_social_anchor", "mixed_review:msg_social_anchor:turn:social_pressure"],
      sourcePressureRefs: ["mixed_review:msg_social_anchor:turn:social_pressure"],
      returnTo: "mimo_member_01",
      status: "proposed",
    }),
    event("evt_handoff_responded", "handoff.responded", {
      topicId,
      handoffRef: "handoff_social",
      byAgentId: "mimo_member_03",
      response: "challenge_handoff",
      reason: "The request names tone but not the exact memory claim.",
      contextRefs: ["msg_social_anchor"],
    }),
    event(
      "evt_agent_invited_social",
      "agent.invited",
      {
        invitationId: "invite_social",
        agentId: "mimo_member_05",
        topicId,
        invitedBy: "agent_intention",
        reason: "This topic may need a trust-boundary listener.",
        contextRefs: ["msg_social_anchor", "mixed_review:msg_social_anchor:turn:social_pressure"],
        sourcePressureRefs: ["mixed_review:msg_social_anchor:turn:social_pressure"],
      },
      { kind: "agent", id: "mimo_member_01" },
    ),
    event(
      "evt_agent_invitation_responded_social",
      "agent.invitation_responded",
      {
        responseId: "invitation_response_social",
        invitationRef: "invite_social",
        topicId,
        agentId: "mimo_member_05",
        response: "challenge",
        reason: "I need the exact trust boundary before stepping in.",
        contextRefs: ["invite_social", "msg_social_anchor"],
        boundaryNote: "invitation response is a social reply to a knock, not a speaking command",
      },
      { kind: "agent", id: "mimo_member_05" },
    ),
    event(
      "evt_agent_invitation_reviewed_social",
      "agent.invitation_reviewed",
      {
        reviewId: "invitation_review_social",
        invitationRef: "invite_social",
        topicId,
        agentId: "mimo_member_03",
        response: "cautioned",
        summary: "This invitation needs a smaller context packet before anyone treats it as useful.",
        sourceMessageId: "msg_invitation_review",
        contextRefs: ["invite_social", "msg_social_anchor"],
        boundaryNote:
          "invitation review is a social trace; it does not accept, reject, challenge, delegate, force speech, or create a new invitation",
      },
      { kind: "agent", id: "mimo_member_03" },
    ),
    event("evt_persona_delta_proposed", "persona_delta.proposed", {
      deltaId: "persona_delta_social",
      agentId: "mimo_member_04",
      proposedBy: "mimo_member_04",
      reason: "Repeatedly notices when tiny reversible steps help the room.",
      proposedChange: {
        field: "habits",
        operation: "add",
        value: "names tiny reversible next steps before proposing a larger structure",
      },
      evidenceRefs: ["msg_social_anchor", "mixed_review:msg_social_anchor:turn:social_pressure"],
      sourcePressureRefs: ["mixed_review:msg_social_anchor:turn:social_pressure"],
      status: "proposed",
    }),
    event("evt_persona_delta_responded", "persona_delta.responded", {
      responseId: "persona_delta_response_social",
      deltaId: "persona_delta_social",
      agentId: "mimo_member_05",
      response: "contest",
      reason: "This may be a mood from the current topic rather than a durable habit.",
      evidenceRefs: ["msg_social_anchor"],
    }),
    event("evt_social_trigger", "message.created", {
      messageId: "msg_social_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_03"],
      contextRefs: ["handoff_social", "persona_delta_social", "invite_social"],
      content: "Read the carried social objects before answering.",
    }),
  ];

  const store = TopicWindowStore.fromEvents(events);
  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_social_trigger",
    recipientAgent: "mimo_member_03",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: ["handoff_social", "persona_delta_social", "invite_social"],
  });
  const protocolBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "protocol_proposal" && fragment.refs.includes("protocol_social"))?.body ??
      "{}",
  ) as {
    note?: string;
    protocol?: {
      protocolSummary?: string;
      protocolProposalReason?: string;
      protocolResponseReason?: string;
      protocolSourcePressureRefs?: string[];
    };
    states?: Record<string, unknown>;
    sourceEvidence?: { ref: string; excerpt: string }[];
  };
  const handoffBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "handoff_packet" && fragment.refs.includes("handoff_social"))?.body ??
      "{}",
  ) as {
    note?: string;
    handoff?: {
      handoffProposalReason?: string;
      handoffSourcePressureRefs?: string[];
      handoffResponseReason?: string;
      handoffRequestedResponse?: string;
    };
    states?: Record<string, unknown>;
    sourceEvidence?: { ref: string; excerpt: string }[];
  };
  const personaBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "persona_delta" && fragment.refs.includes("persona_delta_social"))?.body ??
      "{}",
  ) as {
    note?: string;
    personaDelta?: {
      personaDeltaField?: string;
      personaDeltaOperation?: string;
      personaDeltaValueSummary?: string;
      personaDeltaProposalReason?: string;
      personaDeltaSourcePressureRefs?: string[];
      personaDeltaResponseReason?: string;
    };
    states?: Record<string, unknown>;
    sourceEvidence?: { ref: string; excerpt: string }[];
  };
  const invitationBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "invitation_packet" && fragment.refs.includes("invite_social"))?.body ??
      "{}",
  ) as {
    note?: string;
    invitation?: {
      invitationLastReview?: string;
      invitationLastReviewSummary?: string;
      invitationLastReviewedBy?: string;
      invitationReviewBoundaryNote?: string;
      invitationSourcePressureRefs?: string[];
    };
    states?: Record<string, unknown>;
  };

  assert.match(protocolBody.note ?? "", /not active guidance/);
  assert.equal(protocolBody.states?.protocolSummary, "Try a two-turn listening pause before contesting memory.");
  assert.equal(protocolBody.states?.protocolProposalReason, "The room is moving too quickly to hear objections.");
  assert.equal(protocolBody.states?.protocolResponse, "challenge");
  assert.equal(protocolBody.states?.protocolResponseReason, "The pause may hide urgent corrections.");
  assert.equal(protocolBody.states?.protocolProposedRevision, "Pause only for memory claims that lack evidence refs.");
  assert.equal(protocolBody.states?.protocolExpiresAt, "2026-06-17T12:30:00.000Z");
  assert.deepEqual(protocolBody.states?.protocolSourcePressureRefs, ["mixed_review:msg_social_anchor:turn:social_pressure"]);
  assert.equal(protocolBody.protocol?.protocolSummary, "Try a two-turn listening pause before contesting memory.");
  assert.equal(protocolBody.protocol?.protocolProposalReason, "The room is moving too quickly to hear objections.");
  assert.equal(protocolBody.protocol?.protocolResponseReason, "The pause may hide urgent corrections.");
  assert.deepEqual(protocolBody.protocol?.protocolSourcePressureRefs, ["mixed_review:msg_social_anchor:turn:social_pressure"]);
  assert.equal(
    protocolBody.sourceEvidence?.some(
      (item) => item.ref === "msg_social_anchor" && item.excerpt.includes("handoffs and protocols as proposals"),
    ),
    true,
  );
  assert.equal(packet.fragments.some((fragment) => fragment.type === "protocol_active" && fragment.refs.includes("protocol_social")), false);

  assert.match(handoffBody.note ?? "", /social proposal/);
  assert.equal(handoffBody.states?.handoffFromAgentId, "mimo_member_01");
  assert.equal(handoffBody.states?.handoffToAgentId, "mimo_member_03");
  assert.equal(handoffBody.states?.handoffRequestedResponse, "Name the softest useful objection.");
  assert.equal(handoffBody.states?.handoffProposalReason, "This memory wording needs a gentler objection.");
  assert.deepEqual(handoffBody.states?.handoffSourcePressureRefs, ["mixed_review:msg_social_anchor:turn:social_pressure"]);
  assert.equal(handoffBody.states?.handoffResponse, "challenge_handoff");
  assert.equal(handoffBody.states?.handoffResponseReason, "The request names tone but not the exact memory claim.");
  assert.equal("handoffAcceptedScopeSummary" in (handoffBody.states ?? {}), false);
  assert.equal(handoffBody.handoff?.handoffProposalReason, "This memory wording needs a gentler objection.");
  assert.deepEqual(handoffBody.handoff?.handoffSourcePressureRefs, ["mixed_review:msg_social_anchor:turn:social_pressure"]);
  assert.equal(handoffBody.handoff?.handoffResponseReason, "The request names tone but not the exact memory claim.");
  assert.equal(handoffBody.handoff?.handoffRequestedResponse, "Name the softest useful objection.");
  assert.equal(
    handoffBody.sourceEvidence?.some(
      (item) => item.ref === "msg_social_anchor" && item.excerpt.includes("handoffs and protocols as proposals"),
    ),
    true,
  );

  assert.match(invitationBody.note ?? "", /social knock/);
  assert.equal(packet.refs.invitations.includes("invite_social"), true);
  assert.equal(invitationBody.states?.invitationFromAgentId, "mimo_member_01");
  assert.equal(invitationBody.states?.invitationToAgentId, "mimo_member_05");
  assert.equal(invitationBody.states?.invitationReason, "This topic may need a trust-boundary listener.");
  assert.deepEqual(invitationBody.states?.invitationSourcePressureRefs, ["mixed_review:msg_social_anchor:turn:social_pressure"]);
  assert.equal(invitationBody.states?.invitationResponse, "challenge");
  assert.equal(invitationBody.states?.invitationResponseReason, "I need the exact trust boundary before stepping in.");
  assert.equal(invitationBody.states?.invitationRespondingAgentId, "mimo_member_05");
  assert.equal(invitationBody.states?.invitationLastReview, "cautioned");
  assert.equal(
    invitationBody.states?.invitationLastReviewSummary,
    "This invitation needs a smaller context packet before anyone treats it as useful.",
  );
  assert.equal(invitationBody.states?.invitationLastReviewedBy, "mimo_member_03");
  assert.equal(invitationBody.states?.invitationLastReviewRef, "invitation_review_social");
  assert.equal(invitationBody.invitation?.invitationLastReview, "cautioned");
  assert.deepEqual(invitationBody.invitation?.invitationSourcePressureRefs, ["mixed_review:msg_social_anchor:turn:social_pressure"]);
  assert.equal(
    invitationBody.invitation?.invitationLastReviewSummary,
    "This invitation needs a smaller context packet before anyone treats it as useful.",
  );
  assert.match(invitationBody.invitation?.invitationReviewBoundaryNote ?? "", /does not accept, reject, challenge, delegate/);
  assert.equal(
    invitationBody.states?.invitationResponseBoundaryNote,
    "invitation response is a social reply to a knock, not a speaking command",
  );
  assert.equal(invitationBody.states?.invitationBoundaryNote, "invitation is a social knock, not a speaking command");

  assert.match(personaBody.note ?? "", /proposed identity evolution/);
  assert.equal(packet.refs.personas.includes("persona_delta_social"), true);
  assert.equal(
    packet.audit.selectedFragments.some(
      (fragment) => fragment.type === "persona_delta" && fragment.refs.includes("persona_delta_social"),
    ),
    true,
  );
  assert.equal(personaBody.states?.targetAgentId, "mimo_member_04");
  assert.equal(personaBody.states?.personaDeltaField, "habits");
  assert.equal(personaBody.states?.personaDeltaOperation, "add");
  assert.equal(
    personaBody.states?.personaDeltaValueSummary,
    "names tiny reversible next steps before proposing a larger structure",
  );
  assert.equal(personaBody.states?.personaDeltaResponse, "contest");
  assert.equal(
    personaBody.states?.personaDeltaProposalReason,
    "Repeatedly notices when tiny reversible steps help the room.",
  );
  assert.deepEqual(personaBody.states?.personaDeltaSourcePressureRefs, [
    "mixed_review:msg_social_anchor:turn:social_pressure",
  ]);
  assert.equal(
    personaBody.states?.personaDeltaResponseReason,
    "This may be a mood from the current topic rather than a durable habit.",
  );
  assert.equal(personaBody.personaDelta?.personaDeltaField, "habits");
  assert.equal(personaBody.personaDelta?.personaDeltaOperation, "add");
  assert.equal(
    personaBody.personaDelta?.personaDeltaValueSummary,
    "names tiny reversible next steps before proposing a larger structure",
  );
  assert.equal(
    personaBody.personaDelta?.personaDeltaProposalReason,
    "Repeatedly notices when tiny reversible steps help the room.",
  );
  assert.deepEqual(personaBody.personaDelta?.personaDeltaSourcePressureRefs, [
    "mixed_review:msg_social_anchor:turn:social_pressure",
  ]);
  assert.equal(
    personaBody.personaDelta?.personaDeltaResponseReason,
    "This may be a mood from the current topic rather than a durable habit.",
  );
  assert.equal(
    personaBody.sourceEvidence?.some(
      (item) => item.ref === "msg_social_anchor" && item.excerpt.includes("handoffs and protocols as proposals"),
    ),
    true,
  );
});

test("challenged handoffs remain visible in topic context instead of being flattened away", () => {
  const events = [
    event("evt_topic_challenged_handoff", "topic.created", {
      topicId,
      title: "Handoff challenge",
      createdFromMessageId: "msg_handoff_challenge_anchor",
    }),
    event("evt_msg_handoff_challenge_anchor", "message.created", {
      messageId: "msg_handoff_challenge_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Route this only if the packet is bounded enough to critique.",
    }),
    event("evt_handoff_challenged_proposed", "handoff.proposed", {
      handoffId: "handoff_challenged",
      topicId,
      fromAgentId: "architect",
      toAgentId: "critic",
      reason: "This design needs pressure testing.",
      requestedResponse: "Find the weakest assumption.",
      contextRefs: ["msg_handoff_challenge_anchor"],
      status: "proposed",
    }),
    event("evt_handoff_challenged_response", "handoff.responded", {
      handoffRef: "handoff_challenged",
      topicId,
      byAgentId: "critic",
      response: "challenged",
      reason: "The packet omits the memory claim that would make critique meaningful.",
      contextRefs: ["handoff_challenged"],
    }),
    event("evt_handoff_rejected_proposed", "handoff.proposed", {
      handoffId: "handoff_rejected",
      topicId,
      fromAgentId: "architect",
      toAgentId: "critic",
      reason: "This one lacks any bounded refs.",
      contextRefs: ["msg_handoff_challenge_anchor"],
      status: "proposed",
    }),
    event("evt_handoff_rejected_response", "handoff.responded", {
      handoffRef: "handoff_rejected",
      topicId,
      byAgentId: "critic",
      response: "rejected",
      reason: "There is no actionable context.",
      contextRefs: ["handoff_rejected"],
    }),
    event("evt_handoff_challenge_trigger", "message.created", {
      messageId: "msg_handoff_challenge_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Continue from the challenged handoff.",
    }),
  ];

  const store = TopicWindowStore.fromEvents(events);
  const window = store.getTopic(topicId);
  assert.equal(window?.handoffRefs.includes("handoff_challenged"), true);
  assert.equal(window?.handoffRefs.includes("handoff_rejected"), false);

  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_handoff_challenge_trigger",
    recipientAgent: "critic",
    maxRefs: 12,
    maxTokens: 10_000,
  });
  const handoffBody = JSON.parse(
    packet.fragments.find(
      (fragment) => fragment.type === "handoff_packet" && fragment.refs.includes("handoff_challenged"),
    )?.body ?? "{}",
  );

  assert.equal(packet.refs.handoffs.includes("handoff_challenged"), true);
  assert.equal(packet.refs.handoffs.includes("handoff_rejected"), false);
  assert.equal(handoffBody.states?.handoffState, "challenged");
  assert.equal(handoffBody.states?.handoffResponse, "challenged");
  assert.match(handoffBody.states?.handoffResponseReason ?? "", /omits the memory claim/);
});

test("action boundary context fragments carry side-effect, workspace, and skill semantics", () => {
  const events = [
    event("evt_action_topic", "topic.created", {
      topicId,
      title: "Action boundaries",
      createdFromMessageId: "msg_action_anchor",
    }),
    event("evt_action_anchor", "message.created", {
      messageId: "msg_action_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Check action organs without executing them.",
    }),
    event("evt_side_effect_requested", "side_effect.requested", {
      requestId: "sidefx_action",
      roomId,
      requestedBy: "mimo_member_01",
      topicId,
      kind: "filesystem.write",
      target: "agents/mimo_member_01/workspace/action-note.md",
      reason: "Draft a private note before sharing an artifact ref.",
      expectedImpact: "Create one private workspace note only.",
      proposedCommand: "write action-note.md",
      contextRefs: ["msg_action_anchor", "mixed_review:action_side_effect_pressure"],
      sourcePressureRefs: ["mixed_review:action_side_effect_pressure"],
      idempotencyKey: "side_effect_request:action",
      requestedFromIntentionEventId: "evt_intention_action",
    }),
    event("evt_side_effect_denied", "side_effect.denied", {
      requestId: "sidefx_action",
      approvalId: "sidefx_action",
      deniedBy: "user",
      reason: "Keep the test in ledger context only.",
      decidedAt: "2026-06-17T12:05:00.000Z",
    }),
    event(
      "evt_side_effect_reviewed",
      "side_effect.reviewed",
      {
        reviewId: "side_effect_review_action",
        sideEffectRef: "sidefx_action",
        topicId,
        agentId: "mimo_member_02",
        response: "cautioned",
        summary: "The target is still broad; keep it denied unless the room narrows the path.",
        sourceMessageId: "msg_side_effect_review",
        contextRefs: ["sidefx_action", "msg_action_anchor"],
        boundaryNote:
          "side-effect review is a social trace; it does not approve, deny, expire, execute, report a result, or mutate external state",
      },
      { kind: "agent", id: "mimo_member_02" },
    ),
    event("evt_workspace_artifact", "workspace.artifact_shared", {
      artifactId: "artifact_action_note",
      workspaceId: "workspace_mimo_member_01",
      agentId: "mimo_member_01",
      pathRef: "agents/mimo_member_01/workspace/action-note.md",
      summary: "A private note was shared as an explicit artifact ref.",
      contextRefs: ["msg_action_anchor", "mixed_review:action_workspace_artifact_pressure"],
      sourcePressureRefs: ["mixed_review:action_workspace_artifact_pressure"],
      status: "shared",
      boundaryNote: "artifact ref is room-visible; private workspace contents are not copied into memory",
    }),
    event(
      "evt_workspace_artifact_reviewed",
      "workspace.artifact_reviewed",
      {
        reviewId: "workspace_artifact_review_action",
        artifactRef: "artifact_action_note",
        topicId,
        agentId: "mimo_member_02",
        response: "cautioned",
        summary: "Keep this as a private workspace ref; do not copy it into memory.",
        sourceMessageId: "msg_workspace_artifact_review",
        contextRefs: ["artifact_action_note", "msg_action_anchor"],
        sourcePressureRefs: ["mixed_review:action_workspace_artifact_pressure"],
        boundaryNote:
          "workspace artifact review is a social trace; it does not copy private workspace contents, promote public memory, execute tools, or mutate the artifact",
      },
      { kind: "agent", id: "mimo_member_02" },
    ),
    event("evt_skill_capsule", "skill.capsule_registered", {
      capsuleId: "skill_action_writer",
      agentId: "mimo_member_01",
      label: "workspace writer",
      triggerHints: ["draft artifact", "private note"],
      sideEffectKinds: ["filesystem.write"],
      approvalRequired: true,
      status: "registered",
      source: "seed_agent",
      boundaryNote: "skill capsule is a possible action organ; it cannot execute or publish without an explicit room event and required approvals",
      contextRefs: [],
    }),
    event(
      "evt_skill_capsule_reviewed",
      "skill.capsule_reviewed",
      {
        reviewId: "skill_capsule_review_action",
        capsuleRef: "skill_action_writer",
        topicId,
        agentId: "mimo_member_02",
        response: "cautioned",
        summary: "Keep this as a possible skill only; it still needs approval and must not become a fixed role.",
        sourceMessageId: "msg_skill_capsule_review",
        contextRefs: ["skill_action_writer", "msg_action_anchor", "mixed_review:action_skill_capsule_pressure"],
        sourcePressureRefs: ["mixed_review:action_skill_capsule_pressure"],
        boundaryNote:
          "skill capsule review is a social trace; it does not register a skill, assign a role, execute tools, bypass approvals, or mutate capability state",
      },
      { kind: "agent", id: "mimo_member_02" },
    ),
    event("evt_capability_card", "capability_card.upserted", {
      capabilityId: "capability_action_hint",
      agentId: "mimo_member_01",
      capabilityType: "workspace_boundary_signal",
      domainTags: ["workspace", "boundary"],
      declaredConfidence: 0.7,
      boundaryNote: "capability card is an advisory routing hint, not authority or responsibility",
    }),
    event(
      "evt_capability_reviewed",
      "capability.reviewed",
      {
        reviewId: "capability_review_action",
        capabilityRef: "capability_action_hint",
        topicId,
        agentId: "mimo_member_02",
        response: "cautioned",
        summary: "Keep this as a weak wake hint; it must not assign responsibility or certify competence.",
        sourceMessageId: "msg_capability_review",
        contextRefs: ["capability_action_hint", "msg_action_anchor", "mixed_review:action_capability_pressure"],
        sourcePressureRefs: ["mixed_review:action_capability_pressure"],
        boundaryNote:
          "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech",
      },
      { kind: "agent", id: "mimo_member_02" },
    ),
    event("evt_action_trigger", "message.created", {
      messageId: "msg_action_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_01"],
      contextRefs: ["sidefx_action", "artifact_action_note", "skill_action_writer", "capability_action_hint"],
      content: "Read these action-boundary refs before answering.",
    }),
  ];

  const store = TopicWindowStore.fromEvents(events);
  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_action_trigger",
    recipientAgent: "mimo_member_01",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: ["sidefx_action", "artifact_action_note", "skill_action_writer", "capability_action_hint"],
  });
  assert.deepEqual(packet.refs.sideEffects, ["sidefx_action"]);
  assert.deepEqual(packet.refs.workspaceArtifacts, ["artifact_action_note"]);
  assert.deepEqual(packet.refs.skills, ["skill_action_writer"]);
  assert.deepEqual(packet.refs.capabilities, ["capability_action_hint"]);

  const sideEffectBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "side_effect_boundary")?.body ?? "{}",
  ) as {
    note?: string;
    sideEffect?: {
      sideEffectStatus?: string;
      sideEffectSourcePressureRefs?: string[];
      sideEffectLastReview?: string;
      sideEffectLastReviewSummary?: string;
      sideEffectLastReviewedBy?: string;
      sideEffectReviewBoundaryNote?: string;
    };
    states?: Record<string, unknown>;
  };
  const artifactBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "workspace_artifact_ref")?.body ?? "{}",
  ) as {
    note?: string;
    workspaceArtifact?: {
      workspaceArtifactStatus?: string;
      workspaceArtifactSourcePressureRefs?: string[];
      workspaceArtifactLastReview?: string;
      workspaceArtifactLastReviewSummary?: string;
      workspaceArtifactReviewBoundaryNote?: string;
    };
    states?: Record<string, unknown>;
  };
  const skillBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "skill_capsule_ref")?.body ?? "{}",
  ) as {
    note?: string;
    skillCapsule?: {
      skillCapsuleStatus?: string;
      skillCapsuleSourcePressureRefs?: string[];
      skillCapsuleLastReview?: string;
      skillCapsuleLastReviewSummary?: string;
      skillCapsuleReviewBoundaryNote?: string;
    };
    states?: Record<string, unknown>;
  };
  const capabilityBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "capability_ref")?.body ?? "{}",
  ) as {
    note?: string;
    capability?: {
      capabilityState?: string;
      capabilityId?: string;
      capabilityType?: string;
      capabilitySourcePressureRefs?: string[];
      capabilityLastReview?: string;
      capabilityLastReviewSummary?: string;
      capabilityReviewBoundaryNote?: string;
    };
    states?: Record<string, unknown>;
  };

  assert.match(sideEffectBody.note ?? "", /approval boundary/);
  assert.equal(sideEffectBody.states?.sideEffectStatus, "denied");
  assert.equal(sideEffectBody.states?.sideEffectKind, "filesystem.write");
  assert.equal(sideEffectBody.states?.sideEffectTarget, "agents/mimo_member_01/workspace/action-note.md");
  assert.equal(sideEffectBody.states?.sideEffectRequestReason, "Draft a private note before sharing an artifact ref.");
  assert.deepEqual(sideEffectBody.states?.sideEffectSourcePressureRefs, ["mixed_review:action_side_effect_pressure"]);
  assert.equal(sideEffectBody.states?.sideEffectDecisionReason, "Keep the test in ledger context only.");
  assert.equal(sideEffectBody.states?.sideEffectLastReview, "cautioned");
  assert.equal(
    sideEffectBody.states?.sideEffectLastReviewSummary,
    "The target is still broad; keep it denied unless the room narrows the path.",
  );
  assert.equal(sideEffectBody.states?.sideEffectLastReviewedBy, "mimo_member_02");
  assert.equal(sideEffectBody.states?.sideEffectLastReviewRef, "side_effect_review_action");
  assert.equal(sideEffectBody.sideEffect?.sideEffectStatus, "denied");
  assert.deepEqual(sideEffectBody.sideEffect?.sideEffectSourcePressureRefs, ["mixed_review:action_side_effect_pressure"]);
  assert.equal(sideEffectBody.sideEffect?.sideEffectLastReview, "cautioned");
  assert.match(sideEffectBody.sideEffect?.sideEffectReviewBoundaryNote ?? "", /does not approve, deny, expire/);
  assert.equal("sideEffectArtifactRefs" in (sideEffectBody.states ?? {}), false);

  assert.match(artifactBody.note ?? "", /not public memory/);
  assert.equal(artifactBody.states?.workspaceArtifactId, "artifact_action_note");
  assert.equal(artifactBody.states?.workspaceArtifactStatus, "shared");
  assert.equal(artifactBody.states?.workspacePathRef, "agents/mimo_member_01/workspace/action-note.md");
  assert.equal(artifactBody.states?.workspaceArtifactSummary, "A private note was shared as an explicit artifact ref.");
  assert.deepEqual(artifactBody.states?.workspaceArtifactSourcePressureRefs, [
    "mixed_review:action_workspace_artifact_pressure",
  ]);
  assert.equal(artifactBody.states?.workspaceArtifactLastReview, "cautioned");
  assert.equal(
    artifactBody.states?.workspaceArtifactLastReviewSummary,
    "Keep this as a private workspace ref; do not copy it into memory.",
  );
  assert.match(String(artifactBody.states?.workspaceBoundaryNote ?? ""), /not copied into memory/);
  assert.equal(artifactBody.workspaceArtifact?.workspaceArtifactStatus, "shared");
  assert.equal(artifactBody.workspaceArtifact?.workspaceArtifactLastReview, "cautioned");
  assert.match(artifactBody.workspaceArtifact?.workspaceArtifactReviewBoundaryNote ?? "", /does not copy private workspace contents/);

  assert.match(skillBody.note ?? "", /not an execution/);
  assert.equal(skillBody.states?.skillCapsuleId, "skill_action_writer");
  assert.equal(skillBody.states?.skillCapsuleStatus, "registered");
  assert.equal(skillBody.states?.skillLabel, "workspace writer");
  assert.deepEqual(skillBody.states?.skillSideEffectKinds, ["filesystem.write"]);
  assert.equal(skillBody.states?.skillApprovalRequired, true);
  assert.deepEqual(skillBody.states?.skillCapsuleSourcePressureRefs, ["mixed_review:action_skill_capsule_pressure"]);
  assert.equal(skillBody.states?.skillCapsuleLastReview, "cautioned");
  assert.equal(
    skillBody.states?.skillCapsuleLastReviewSummary,
    "Keep this as a possible skill only; it still needs approval and must not become a fixed role.",
  );
  assert.equal(skillBody.skillCapsule?.skillCapsuleStatus, "registered");
  assert.deepEqual(skillBody.skillCapsule?.skillCapsuleSourcePressureRefs, [
    "mixed_review:action_skill_capsule_pressure",
  ]);
  assert.equal(skillBody.skillCapsule?.skillCapsuleLastReview, "cautioned");
  assert.match(skillBody.skillCapsule?.skillCapsuleReviewBoundaryNote ?? "", /does not register a skill/);

  assert.match(capabilityBody.note ?? "", /advisory routing hint/);
  assert.equal(capabilityBody.states?.capabilityId, "capability_action_hint");
  assert.equal(capabilityBody.states?.capabilityType, "workspace_boundary_signal");
  assert.deepEqual(capabilityBody.states?.capabilityDomainTags, ["workspace", "boundary"]);
  assert.equal(capabilityBody.states?.capabilityDeclaredConfidence, 0.7);
  assert.deepEqual(capabilityBody.states?.capabilitySourcePressureRefs, ["mixed_review:action_capability_pressure"]);
  assert.equal(capabilityBody.states?.capabilityLastReview, "cautioned");
  assert.equal(
    capabilityBody.states?.capabilityLastReviewSummary,
    "Keep this as a weak wake hint; it must not assign responsibility or certify competence.",
  );
  assert.equal(capabilityBody.capability?.capabilityId, "capability_action_hint");
  assert.deepEqual(capabilityBody.capability?.capabilitySourcePressureRefs, ["mixed_review:action_capability_pressure"]);
  assert.equal(capabilityBody.capability?.capabilityLastReview, "cautioned");
  assert.match(capabilityBody.capability?.capabilityReviewBoundaryNote ?? "", /does not change wake score/);
});

test("deferred speech recovery refs become typed context fragments", () => {
  const events = [
    event("evt_recovery_topic", "topic.created", {
      topicId,
      title: "Recovery refs",
      createdFromMessageId: "msg_recovery_anchor",
    }),
    event("evt_recovery_anchor", "message.created", {
      messageId: "msg_recovery_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Please keep unheard turns recoverable.",
    }),
    event("evt_intention_recorded", "agent.intention_recorded", {
      invitationId: "invite_recovery",
      packetId: "packet_recovery",
      agentId: "mimo_member_04",
      topicId,
      triggeringEventId: "evt_recovery_anchor",
      intention: {
        kind: "speak",
        content: "I had a small route to add before the budget closed.",
        contextRefs: ["evt_recovery_anchor"],
      },
    }),
    event("evt_intention_deferred", "agent.intention_deferred", {
      agentId: "mimo_member_04",
      topicId,
      triggeringEventId: "evt_recovery_anchor",
      intentionEventId: "evt_intention_recorded",
      originalIntentionKind: "speak",
      reason: "speaker_budget_exhausted",
    }),
    event("evt_recovery_trigger", "message.created", {
      messageId: "msg_recovery_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: ["evt_intention_recorded", "evt_intention_deferred"],
      content: "If you were unheard, you may choose whether to continue.",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_recovery_trigger",
    recipientAgent: "mimo_member_04",
    maxRefs: 12,
    maxTokens: 10_000,
    relevantRefs: ["evt_intention_recorded", "evt_intention_deferred"],
  });

  assert.deepEqual(packet.refs.turnRecovery, ["evt_intention_recorded", "evt_intention_deferred"]);
  const fragments = packet.fragments.filter((fragment) => fragment.type === "deferred_intention");
  assert.equal(fragments.length, 2);
  const recordedBody = JSON.parse(fragments.find((fragment) => fragment.refs.includes("evt_intention_recorded"))?.body ?? "{}");
  assert.equal(recordedBody.states?.turnRecoveryIntentionKind, "speak");
  assert.match(recordedBody.states?.turnRecoveryContent ?? "", /small route/);
  const deferredBody = JSON.parse(fragments.find((fragment) => fragment.refs.includes("evt_intention_deferred"))?.body ?? "{}");
  assert.equal(deferredBody.states?.turnRecoveryBoundaryReason, "speaker_budget_exhausted");
  assert.deepEqual(deferredBody.sourceRefs, ["evt_intention_recorded"]);
  assert.match(deferredBody.note, /does not command the agent to speak/);
});

test("deliberate silence refs become typed context without masking provider degradation", () => {
  const events = [
    event("evt_silence_topic", "topic.created", {
      topicId,
      title: "Silence as expression",
      createdFromMessageId: "msg_silence_anchor",
    }),
    event("evt_silence_anchor", "message.created", {
      messageId: "msg_silence_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Silence should remain a valid social move.",
    }),
    event("evt_silence_recorded", "agent.intention_recorded", {
      invitationId: "invite_silence",
      packetId: "packet_silence",
      agentId: "mimo_member_05",
      topicId,
      triggeringEventId: "evt_silence_anchor",
      intention: {
        kind: "stay_silent",
        reason: "Listening preserves room bandwidth until someone asks for care work.",
      },
    }),
    event("evt_provider_degraded_silence", "agent.intention_recorded", {
      invitationId: "invite_degraded",
      packetId: "packet_degraded",
      agentId: "kimi_member_01",
      topicId,
      triggeringEventId: "evt_silence_anchor",
      intention: {
        kind: "stay_silent",
        reason: "live provider degraded: provider timed out",
      },
    }),
    event("evt_silence_trigger", "message.created", {
      messageId: "msg_silence_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_05"],
      contextRefs: ["evt_silence_recorded", "evt_provider_degraded_silence"],
      content: "Can you explain this silence without treating it as failure?",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_silence_trigger",
    recipientAgent: "mimo_member_05",
    maxRefs: 12,
    maxTokens: 10_000,
    relevantRefs: ["evt_silence_recorded", "evt_provider_degraded_silence"],
  });

  assert.deepEqual(packet.refs.silences, ["evt_silence_recorded"]);
  const silenceBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "silence_ref" && fragment.refs.includes("evt_silence_recorded"))?.body ??
      "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  assert.match(silenceBody.note ?? "", /agent expression/);
  assert.equal(silenceBody.states?.silenceAgentId, "mimo_member_05");
  assert.equal(
    silenceBody.states?.silenceReason,
    "Listening preserves room bandwidth until someone asks for care work.",
  );
  assert.equal(
    packet.fragments.some(
      (fragment) => fragment.type === "silence_ref" && fragment.refs.includes("evt_provider_degraded_silence"),
    ),
    false,
  );
});

test("room pressure boundaries become typed context without judging agents", () => {
  const events = [
    event("evt_pressure_context_topic", "topic.created", {
      topicId,
      title: "Pressure boundary context",
      createdFromMessageId: "msg_pressure_anchor",
    }),
    event("evt_pressure_anchor", "message.created", {
      messageId: "msg_pressure_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "The room should stay inhabitable under pressure.",
    }),
    event(
      "evt_pressure_context_boundary",
      "room.pressure_detected",
      {
        reason: "background_turn_concurrency_limit",
        messageEventId: "evt_pressure_anchor",
        messageId: "msg_pressure_anchor",
        topicId,
        activeBackgroundTurns: 1,
        queuedBackgroundTurns: 2,
        maxConcurrentBackgroundTurns: 1,
        boundaryNote:
          "Message expression is preserved in the ledger; agent wake is delayed to keep the room inhabitable.",
      },
      { kind: "system", id: "bandwidth_guard" },
    ),
    event("evt_pressure_context_trigger", "message.created", {
      messageId: "msg_pressure_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_01"],
      contextRefs: ["evt_pressure_context_boundary"],
      content: "Please self-regulate using this pressure boundary.",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_pressure_trigger",
    recipientAgent: "mimo_member_01",
    maxRefs: 12,
    maxTokens: 10_000,
    relevantRefs: ["evt_pressure_context_boundary"],
  });

  assert.deepEqual(packet.refs.pressureBoundaries, ["evt_pressure_context_boundary"]);
  const pressureBody = JSON.parse(
    packet.fragments.find(
      (fragment) => fragment.type === "pressure_boundary" && fragment.refs.includes("evt_pressure_context_boundary"),
    )?.body ?? "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  assert.match(pressureBody.note ?? "", /room resource signal/);
  assert.equal(pressureBody.states?.pressureReason, "background_turn_concurrency_limit");
  assert.equal(pressureBody.states?.pressureQueuedBackgroundTurns, 2);
  assert.equal(pressureBody.states?.pressureMaxConcurrentBackgroundTurns, 1);
  assert.match(String(pressureBody.states?.pressureBoundaryNote ?? ""), /keep the room inhabitable/);
});

test("memory pressure boundaries become typed context without deciding truth", () => {
  const events = [
    event("evt_memory_pressure_topic", "topic.created", {
      topicId,
      title: "Memory pressure",
      createdFromMessageId: "msg_memory_pressure_anchor",
    }),
    event("evt_memory_pressure_anchor", "message.created", {
      messageId: "msg_memory_pressure_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Memory proposals should not flood public memory.",
    }),
    ...Array.from({ length: 4 }, (_, index) =>
      event(`evt_memory_pressure_proposed_${index}`, "memory.proposed", {
        memoryId: `memory_pressure_${index}`,
        topicId,
        summary: `Pending claim ${index}`,
        reason: "Needs review before adoption.",
        sourceRefs: ["msg_memory_pressure_anchor"],
      }),
    ),
    event(
      "evt_memory_pressure_boundary",
      "room.memory_pressure_detected",
      {
        reason: "pending_memory_proposal_limit",
        topicId,
        triggeringMemoryId: "memory_pressure_3",
        pendingProposalCount: 4,
        threshold: 4,
        proposedMemoryRefs: ["memory_pressure_0", "memory_pressure_1", "memory_pressure_2", "memory_pressure_3"],
        boundaryNote:
          "Public memory has too many pending proposals. The room should review, contest, accept, mark stale, or retire claims before adding more sediment.",
      },
      { kind: "system", id: "memory_gate" },
    ),
    event("evt_memory_pressure_trigger", "message.created", {
      messageId: "msg_memory_pressure_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_01"],
      contextRefs: ["evt_memory_pressure_boundary"],
      content: "Please inspect this memory pressure boundary.",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_memory_pressure_trigger",
    recipientAgent: "mimo_member_01",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: ["evt_memory_pressure_boundary"],
  });

  assert.deepEqual(packet.refs.memoryPressure, ["evt_memory_pressure_boundary"]);
  const pressureBody = JSON.parse(
    packet.fragments.find(
      (fragment) => fragment.type === "memory_pressure_boundary" && fragment.refs.includes("evt_memory_pressure_boundary"),
    )?.body ?? "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  assert.match(pressureBody.note ?? "", /public-memory hygiene signal/);
  assert.equal(pressureBody.states?.memoryPressurePendingProposalCount, 4);
  assert.equal(pressureBody.states?.memoryPressureThreshold, 4);
  assert.deepEqual(pressureBody.states?.memoryPressureProposedMemoryRefs, [
    "memory_pressure_0",
    "memory_pressure_1",
    "memory_pressure_2",
    "memory_pressure_3",
  ]);
  assert.match(String(pressureBody.states?.memoryPressureBoundaryNote ?? ""), /review, contest, accept/);
});

test("provider degradations become typed runtime boundaries without pretending agent silence", () => {
  const events = [
    event("evt_provider_boundary_topic", "topic.created", {
      topicId,
      title: "Provider boundary",
      createdFromMessageId: "msg_provider_boundary_anchor",
    }),
    event("evt_provider_boundary_anchor", "message.created", {
      messageId: "msg_provider_boundary_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Runtime provider failures should be visible but not treated as agent behavior.",
    }),
    event(
      "evt_provider_boundary_degraded",
      "agent.provider_degraded",
      {
        agentId: "kimi_member_01",
        topicId,
        triggeringEventId: "evt_provider_boundary_anchor",
        packetId: "packet_provider_boundary",
        providerKind: "kimi_code_api",
        providerLabel: "Kimiplan Agent API",
        diagnostic: "Kimiplan Agent API failed after spawn timeout.",
        boundaryNote: "provider degradation is not agent silence",
      },
      { kind: "system", id: "runtime_provider_monitor" },
    ),
    event("evt_provider_boundary_trigger", "message.created", {
      messageId: "msg_provider_boundary_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_01"],
      contextRefs: ["evt_provider_boundary_degraded"],
      content: "Please inspect this provider boundary before deciding who is present.",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_provider_boundary_trigger",
    recipientAgent: "mimo_member_01",
    maxRefs: 12,
    maxTokens: 10_000,
    relevantRefs: ["evt_provider_boundary_degraded"],
  });

  assert.deepEqual(packet.refs.providerBoundaries, ["evt_provider_boundary_degraded"]);
  const providerBody = JSON.parse(
    packet.fragments.find(
      (fragment) => fragment.type === "provider_boundary" && fragment.refs.includes("evt_provider_boundary_degraded"),
    )?.body ?? "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  assert.match(providerBody.note ?? "", /runtime availability signal/);
  assert.equal(providerBody.states?.providerBoundaryAgentId, "kimi_member_01");
  assert.equal(providerBody.states?.providerBoundaryKind, "kimi_code_api");
  assert.equal(providerBody.states?.providerBoundaryLabel, "Kimiplan Agent API");
  assert.match(String(providerBody.states?.providerBoundaryDiagnostic ?? ""), /spawn timeout/);
  assert.equal(providerBody.states?.providerBoundaryNote, "provider degradation is not agent silence");
});

test("provider boundary context carries choice pressure without becoming repair workflow", () => {
  const boundaryRef = "provider_boundary_choice_context";
  const repairRef = "sidefx_choice_context_repair";
  const protocolRef = "protocol_choice_context_retry";
  const memoryRef = "memory_choice_context_boundary";
  const events: RoomEvent[] = [
    event("evt_choice_context_topic", "topic.created", {
      topicId,
      title: "Provider choice pressure",
      createdFromMessageId: "msg_choice_context_anchor",
    }),
    event("evt_choice_context_anchor", "message.created", {
      messageId: "msg_choice_context_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Provider boundary pressure should stay social instead of becoming repair workflow.",
    }),
    {
      ...event(
        "evt_choice_context_degraded",
        "agent.provider_degraded",
        {
          degradationId: boundaryRef,
          agentId: "kimi_member_01",
          topicId,
          triggeringEventId: "evt_choice_context_anchor",
          packetId: "packet_choice_context",
          providerKind: "kimi_code_api",
          providerLabel: "Kimiplan Agent API",
          diagnostic: "Provider timeout while building choice pressure context.",
          boundaryNote: "provider degradation is not agent silence",
        },
        { kind: "system", id: "runtime_provider_monitor" },
      ),
      refs: ["evt_choice_context_anchor"],
    },
    {
      ...event(
        "evt_choice_context_repair_requested",
        "side_effect.requested",
        {
          requestId: repairRef,
          requestedBy: "boundary_observer",
          topicId,
          kind: "network.request",
          target: "provider://local-kimi/version",
          reason: "provider diagnostic repair request should stay approval-gated",
          expectedImpact: "Read-only diagnostic request; no repair workflow has started.",
          contextRefs: [boundaryRef],
        },
        { kind: "agent", id: "boundary_observer" },
      ),
      refs: [boundaryRef],
    },
    {
      ...event(
        "evt_choice_context_retry_proposed",
        "protocol.proposed",
        {
          protocolId: protocolRef,
          proposedBy: "retry_keeper",
          topicId,
          summary: "Try a later retry instead of automatic provider repair.",
          scope: "timeboxed",
          reason: "Retry pressure should remain temporary etiquette.",
          contextRefs: [boundaryRef],
          status: "proposed",
        },
        { kind: "agent", id: "retry_keeper" },
      ),
      refs: [boundaryRef],
    },
    event("evt_choice_context_archive_day_1", "daily_archive.created", {
      archiveId: "day_choice_context_1",
      date: "2026-06-20",
      archive: {
        archiveId: "day_choice_context_1",
        date: "2026-06-20",
        providerBoundaries: [{ boundaryId: boundaryRef, sourceRefs: [boundaryRef] }],
        sideEffectBoundaries: [{ requestId: repairRef, sourceRefs: [boundaryRef] }],
        protocols: [{ protocolId: protocolRef, sourceRefs: [boundaryRef] }],
      },
    }),
    {
      ...event(
        "evt_choice_context_repair_denied",
        "side_effect.denied",
        {
          requestId: repairRef,
          deniedBy: "approval_guard",
          reason: "The provider diagnostic request is too broad for the room.",
        },
        { kind: "user", id: "room_boundary" },
      ),
      refs: [repairRef],
    },
    {
      ...event(
        "evt_choice_context_silence",
        "agent.intention_recorded",
        {
          agentId: "quiet_listener",
          topicId,
          triggeringEventId: "evt_choice_context_anchor",
          intention: {
            kind: "stay_silent",
            reason: "Silence is deliberate while the provider boundary is already visible.",
          },
        },
        { kind: "agent", id: "quiet_listener" },
      ),
      refs: [boundaryRef],
    },
    {
      ...event(
        "evt_choice_context_retry_retired",
        "protocol.retired",
        {
          protocolId: protocolRef,
          retiredBy: "retry_keeper",
          reason: "This temporary retry etiquette now adds pressure.",
          contextRefs: [boundaryRef],
          status: "retired",
        },
        { kind: "agent", id: "retry_keeper" },
      ),
      refs: [protocolRef],
    },
    {
      ...event(
        "evt_choice_context_memory_proposed",
        "memory.proposed",
        {
          memoryId: memoryRef,
          state: "proposed",
          summary: "The boundary carried repair, retry, denial, and silence without becoming recovery truth.",
          reason: "The room may want to remember this pressure pattern.",
          sourceRefs: [boundaryRef, repairRef, protocolRef],
          proposedBy: "memory_keeper",
        },
        { kind: "agent", id: "memory_keeper" },
      ),
      refs: [boundaryRef, repairRef, protocolRef],
    },
    {
      ...event(
        "evt_choice_context_memory_contested",
        "memory.contested",
        {
          memoryId: memoryRef,
          memoryRef,
          reason: "This memory is useful but too close to a conclusion.",
          contestedBy: "critic",
        },
        { kind: "agent", id: "critic" },
      ),
      refs: [memoryRef],
    },
    event("evt_choice_context_archive_day_2", "daily_archive.created", {
      archiveId: "day_choice_context_2",
      date: "2026-06-21",
      archive: {
        archiveId: "day_choice_context_2",
        date: "2026-06-21",
        providerBoundaries: [{ boundaryId: boundaryRef, sourceRefs: [boundaryRef] }],
        memoryChanges: [{ memoryId: memoryRef, sourceRefs: [boundaryRef], toState: "contested" }],
      },
    }),
    event("evt_choice_context_trigger", "message.created", {
      messageId: "msg_choice_context_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_01"],
      contextRefs: [boundaryRef],
      content: "Please inspect this provider boundary choice pressure without turning it into a workflow.",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_choice_context_trigger",
    recipientAgent: "mimo_member_01",
    maxRefs: 16,
    maxTokens: 10_000,
    relevantRefs: [boundaryRef],
  });

  const providerBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "provider_boundary" && fragment.refs.includes(boundaryRef))?.body ?? "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  assert.match(providerBody.note ?? "", /parallel choice pressure/);
  assert.deepEqual(providerBody.states?.providerBoundaryChoiceRepairRequestRefs, [repairRef]);
  assert.deepEqual(providerBody.states?.providerBoundaryChoiceDeniedRepairRefs, [repairRef]);
  assert.deepEqual(providerBody.states?.providerBoundaryChoiceRetryProtocolRefs, [protocolRef]);
  assert.deepEqual(providerBody.states?.providerBoundaryChoiceRetiredRetryProtocolRefs, [protocolRef]);
  assert.deepEqual(providerBody.states?.providerBoundaryChoiceSilenceRefs, ["evt_choice_context_silence"]);
  assert.deepEqual(providerBody.states?.providerBoundaryChoiceContestedMemoryRefs, [memoryRef]);
  assert.deepEqual(providerBody.states?.providerBoundaryChoiceArchiveCarryoverRefs, [
    "day_choice_context_1",
    "day_choice_context_2",
  ]);
  assert.deepEqual(
    (providerBody.states?.providerBoundaryChoiceAgentIds as string[]).sort(),
    ["approval_guard", "boundary_observer", "critic", "quiet_listener", "retry_keeper"].sort(),
  );
  assert.equal(providerBody.states?.providerBoundaryChoiceHasMixedChoices, true);
  assert.equal(providerBody.states?.providerBoundaryChoiceHasMultiAgentPressure, true);
  assert.equal(providerBody.states?.providerBoundaryChoiceCarriedAcrossArchives, true);
  assert.equal(providerBody.states?.providerBoundaryChoiceKindCount, 6);
  assert.match(String(providerBody.states?.providerBoundaryChoiceNote ?? ""), /observation only/);
});

test("mixed review pressure refs become typed context without lifecycle closure", () => {
  const sourceMessageId = "msg_mixed_review_source";
  const pressureRef = `mixed_review:${sourceMessageId}:turn:client_mixed_review_context`;
  const events = [
    event("evt_mixed_review_topic", "topic.created", {
      topicId,
      title: "Mixed review context",
      createdFromMessageId: "msg_mixed_review_seed",
    }),
    event("evt_mixed_review_seed", "message.created", {
      messageId: "msg_mixed_review_seed",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Seed mixed review pressure without resolving room objects.",
    }),
    event("evt_mixed_review_memory_proposed", "memory.proposed", {
      memoryId: "memory_mixed_review",
      topicId,
      summary: "Mixed review pressure should stay visible but provisional.",
      reason: "The room has not accepted it as memory.",
      sourceRefs: ["msg_mixed_review_seed"],
    }),
    event("evt_mixed_review_protocol_proposed", "protocol.proposed", {
      protocolId: "protocol_mixed_review",
      topicId,
      summary: "Name social objects while reviewing them.",
      reason: "Temporary etiquette only.",
      status: "proposed",
      contextRefs: ["msg_mixed_review_seed"],
    }),
    event("evt_mixed_review_handoff_proposed", "handoff.proposed", {
      handoffId: "handoff_mixed_review",
      topicId,
      fromAgentId: "kimi_member_01",
      toAgentId: "mimo_member_01",
      reason: "Invite another view without transfer.",
      requestedResponse: "Name pressure only.",
      status: "proposed",
      contextRefs: ["msg_mixed_review_seed"],
    }),
    event("evt_mixed_review_question", "topic.updated", {
      topicId,
      openQuestion: "What keeps mixed review pressure from becoming hidden governance?",
      openQuestionRef: "question_mixed_review",
      messageId: "msg_mixed_review_seed",
    }),
    event(
      "evt_mixed_review_source",
      "message.created",
      {
        messageId: sourceMessageId,
        topicId,
        author: "kimi_member_01",
        authorKind: "agent",
        mentions: [],
        contextRefs: ["memory_mixed_review", "protocol_mixed_review", "handoff_mixed_review", "question_mixed_review"],
        content:
          "I see a provisional memory, a temporary protocol, a handoff proposal, and an open question; none should close yet.",
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:client_mixed_review_context",
    ),
    event(
      "evt_mixed_review_question_response",
      "open_question.responded",
      {
        questionRef: "question_mixed_review",
        topicId,
        agentId: "kimi_member_01",
        response: "responded",
        summary: "The question remains open while pressure is named.",
        sourceMessageId,
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:client_mixed_review_context",
      "evt_mixed_review_source",
    ),
    event(
      "evt_mixed_review_memory_review",
      "memory.reviewed",
      {
        memoryRef: "memory_mixed_review",
        topicId,
        agentId: "kimi_member_01",
        response: "questioned",
        summary: "The memory claim still lacks adoption evidence.",
        sourceMessageId,
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:client_mixed_review_context",
      "evt_mixed_review_source",
    ),
    event(
      "evt_mixed_review_protocol_review",
      "protocol.reviewed",
      {
        protocolRef: "protocol_mixed_review",
        topicId,
        agentId: "kimi_member_01",
        response: "questioned",
        summary: "The protocol remains temporary etiquette, not active guidance.",
        sourceMessageId,
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:client_mixed_review_context",
      "evt_mixed_review_source",
    ),
    event(
      "evt_mixed_review_handoff_review",
      "handoff.reviewed",
      {
        handoffRef: "handoff_mixed_review",
        topicId,
        agentId: "kimi_member_01",
        response: "questioned",
        summary: "The handoff should not transfer control yet.",
        sourceMessageId,
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:client_mixed_review_context",
      "evt_mixed_review_source",
    ),
    event("evt_mixed_review_trigger", "message.created", {
      messageId: "msg_mixed_review_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_01"],
      contextRefs: [pressureRef],
      content: "Please inspect this mixed review pressure as context.",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_mixed_review_trigger",
    recipientAgent: "mimo_member_01",
    maxRefs: 16,
    maxTokens: 10_000,
    relevantRefs: [pressureRef],
  });

  assert.deepEqual(packet.refs.mixedReviewPressures, [pressureRef]);
  const pressureBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "mixed_review_pressure" && fragment.refs.includes(pressureRef))?.body ??
      "{}",
  ) as { note?: string; mixedReviewPressure?: Record<string, unknown>; states?: Record<string, unknown> };
  assert.match(pressureBody.note ?? "", /social-state index/);
  assert.match(pressureBody.note ?? "", /not a command/);
  assert.equal(pressureBody.states?.mixedReviewObjectCount, 4);
  assert.deepEqual(pressureBody.states?.mixedReviewAgentIds, ["kimi_member_01"]);
  assert.deepEqual(pressureBody.states?.mixedReviewResponseKindCounts, { responded: 1, questioned: 3 });
  assert.deepEqual(pressureBody.states?.mixedReviewTouchedRefs, [
    "question_mixed_review",
    "memory_mixed_review",
    "protocol_mixed_review",
    "handoff_mixed_review",
  ]);
  assert.equal(
    packet.fragments.some((fragment) => fragment.type === "memory_accepted" && fragment.refs.includes("memory_mixed_review")),
    false,
  );
});

test("daily archives carry mixed review pressure as cross-day context", () => {
  const sourceMessageId = "msg_archive_mixed_review_source";
  const pressureRef = `mixed_review:${sourceMessageId}:turn:archive_mixed_review`;
  const events: RoomEvent[] = [
    event("evt_archive_mixed_review_topic", "topic.created", {
      topicId,
      title: "Archived mixed review pressure",
      createdFromMessageId: "msg_archive_mixed_review_seed",
    }),
    event("evt_archive_mixed_review_seed", "message.created", {
      messageId: "msg_archive_mixed_review_seed",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Name unresolved pressure without mutating room objects.",
    }),
    event("evt_archive_mixed_review_memory_proposed", "memory.proposed", {
      memoryId: "memory_archive_mixed_review",
      topicId,
      summary: "Archive should keep mixed review pressure visible.",
      reason: "This is still only a proposed claim.",
      sourceRefs: ["msg_archive_mixed_review_seed"],
    }),
    event("evt_archive_mixed_review_protocol_proposed", "protocol.proposed", {
      protocolId: "protocol_archive_mixed_review",
      topicId,
      summary: "Review social pressure as context.",
      reason: "Temporary etiquette only.",
      status: "proposed",
      contextRefs: ["msg_archive_mixed_review_seed"],
    }),
    event("evt_archive_mixed_review_handoff_proposed", "handoff.proposed", {
      handoffId: "handoff_archive_mixed_review",
      topicId,
      fromAgentId: "kimi_member_01",
      toAgentId: "mimo_member_01",
      reason: "Invite attention without transfer.",
      requestedResponse: "Keep it unresolved.",
      status: "proposed",
      contextRefs: ["msg_archive_mixed_review_seed"],
    }),
    event("evt_archive_mixed_review_question", "topic.updated", {
      topicId,
      openQuestion: "How does this pressure survive archive compression without becoming governance?",
      openQuestionRef: "question_archive_mixed_review",
      messageId: "msg_archive_mixed_review_seed",
    }),
    event(
      "evt_archive_mixed_review_source",
      "message.created",
      {
        messageId: sourceMessageId,
        topicId,
        author: "kimi_member_01",
        authorKind: "agent",
        mentions: [],
        contextRefs: [
          "memory_archive_mixed_review",
          "protocol_archive_mixed_review",
          "handoff_archive_mixed_review",
          "question_archive_mixed_review",
        ],
        content: "These four objects are under review pressure; none should be closed.",
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:archive_mixed_review",
    ),
    event(
      "evt_archive_mixed_review_question_response",
      "open_question.responded",
      {
        questionRef: "question_archive_mixed_review",
        topicId,
        agentId: "kimi_member_01",
        response: "responded",
        summary: "Archive compression can carry the question as unresolved pressure.",
        sourceMessageId,
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:archive_mixed_review",
      "evt_archive_mixed_review_source",
    ),
    event(
      "evt_archive_mixed_review_memory_review",
      "memory.reviewed",
      {
        memoryRef: "memory_archive_mixed_review",
        topicId,
        agentId: "kimi_member_01",
        response: "questioned",
        summary: "The memory claim remains proposed.",
        sourceMessageId,
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:archive_mixed_review",
      "evt_archive_mixed_review_source",
    ),
    event(
      "evt_archive_mixed_review_protocol_review",
      "protocol.reviewed",
      {
        protocolRef: "protocol_archive_mixed_review",
        topicId,
        agentId: "kimi_member_01",
        response: "questioned",
        summary: "The protocol remains etiquette, not active guidance.",
        sourceMessageId,
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:archive_mixed_review",
      "evt_archive_mixed_review_source",
    ),
    event(
      "evt_archive_mixed_review_handoff_review",
      "handoff.reviewed",
      {
        handoffRef: "handoff_archive_mixed_review",
        topicId,
        agentId: "kimi_member_01",
        response: "questioned",
        summary: "The handoff remains a proposal.",
        sourceMessageId,
      },
      { kind: "agent", id: "kimi_member_01" },
      "turn:archive_mixed_review",
      "evt_archive_mixed_review_source",
    ),
    event(
      "evt_archive_mixed_pressure_review",
      "mixed_review_pressure.reviewed",
      {
        reviewId: "mixed_review_pressure_review_archive_01",
        pressureRef,
        topicId,
        agentId: "mimo_member_01",
        response: "narrowing_suggested",
        summary: "Keep the pressure, but narrow it to memory and open question until the room asks for handoff again.",
        sourceMessageId: "msg_archive_mixed_pressure_review",
        contextRefs: [pressureRef],
        boundaryNote:
          "mixed review pressure review is a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure",
      },
      { kind: "agent", id: "mimo_member_01" },
      "turn:archive_mixed_pressure_review",
      "evt_archive_mixed_review_source",
    ),
    event(
      "evt_archive_mixed_pressure_review_questioned",
      "mixed_review_pressure.reviewed",
      {
        reviewId: "mixed_review_pressure_review_archive_02",
        pressureRef,
        topicId,
        agentId: "kimi_member_02",
        response: "questioned",
        summary:
          "A later review questions whether narrowing is premature; leave the pressure visible until the room has one more ordinary exchange.",
        sourceMessageId: "msg_archive_mixed_pressure_review_questioned",
        contextRefs: [pressureRef],
        boundaryNote:
          "mixed review pressure review is a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure",
      },
      { kind: "agent", id: "kimi_member_02" },
      "turn:archive_mixed_pressure_review_questioned",
      "evt_archive_mixed_pressure_review",
    ),
  ];

  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-21",
    timezone: "Asia/Shanghai",
    summary: "A day with mixed review pressure preserved as unresolved room context.",
  });
  assert.equal(archive.mixedReviewPressures.length, 1);
  const pressure = archive.mixedReviewPressures[0];
  assert.equal(pressure?.pressureId, pressureRef);
  assert.equal(pressure?.sourceMessageId, sourceMessageId);
  assert.equal(pressure?.topicId, topicId);
  assert.deepEqual(pressure?.agentIds, ["kimi_member_01"]);
  assert.deepEqual(pressure?.responseKindCounts, { responded: 1, questioned: 3 });
  assert.equal(pressure?.objectCount, 4);
  assert.deepEqual(pressure?.touchedRefs, [
    "handoff_archive_mixed_review",
    "memory_archive_mixed_review",
    "protocol_archive_mixed_review",
    "question_archive_mixed_review",
  ]);
  assert.deepEqual(pressure?.traceEventIds, [
    "evt_archive_mixed_review_handoff_review",
    "evt_archive_mixed_review_memory_review",
    "evt_archive_mixed_review_protocol_review",
    "evt_archive_mixed_review_question_response",
  ]);
  assert.match(pressure?.boundaryNote ?? "", /unresolved room context/);
  assert.equal(archive.mixedReviewPressureReviews.length, 2);
  assert.equal(archive.mixedReviewPressureReviews[0]?.reviewId, "mixed_review_pressure_review_archive_01");
  assert.equal(archive.mixedReviewPressureReviews[0]?.pressureRef, pressureRef);
  assert.equal(archive.mixedReviewPressureReviews[0]?.agentId, "mimo_member_01");
  assert.equal(archive.mixedReviewPressureReviews[0]?.response, "narrowing_suggested");
  assert.match(archive.mixedReviewPressureReviews[0]?.summary ?? "", /narrow it to memory/);
  assert.match(archive.mixedReviewPressureReviews[0]?.boundaryNote ?? "", /does not close, narrow, retire/);
  assert.equal(archive.mixedReviewPressureReviews[1]?.reviewId, "mixed_review_pressure_review_archive_02");
  assert.equal(archive.mixedReviewPressureReviews[1]?.agentId, "kimi_member_02");
  assert.equal(archive.mixedReviewPressureReviews[1]?.response, "questioned");
  assert.match(archive.mixedReviewPressureReviews[1]?.summary ?? "", /narrowing is premature/);
  assert.equal(archive.memoryChanges.some((change) => change.memoryId === "memory_archive_mixed_review" && change.toState === "accepted"), false);

  const archiveEvent = event("evt_archive_mixed_review_committed", "daily_archive.created", {
    archive,
  });
  const trigger = event("evt_archive_mixed_review_trigger", "message.created", {
    messageId: "msg_archive_mixed_review_trigger",
    topicId,
    author: "user",
    authorKind: "user",
    mentions: ["mimo_member_01"],
    contextRefs: [archive.archiveId],
    content: "Use yesterday's archive pressure, but do not resolve it.",
  });
  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents([...events, archiveEvent, trigger])).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_archive_mixed_review_trigger",
    recipientAgent: "mimo_member_01",
    maxRefs: 16,
    maxTokens: 10_000,
    relevantRefs: [archive.archiveId],
  });
  const archiveBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "daily_archive_ref" && fragment.refs.includes(archive.archiveId))?.body ??
      "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  assert.match(archiveBody.note ?? "", /compressed time skeleton/);
  assert.equal(archiveBody.states?.archiveMixedReviewPressureCount, 1);
  assert.deepEqual(archiveBody.states?.archiveMixedReviewSourceMessageRefs, [sourceMessageId]);
  assert.deepEqual(archiveBody.states?.archiveMixedReviewTouchedRefs, [
    "handoff_archive_mixed_review",
    "memory_archive_mixed_review",
    "protocol_archive_mixed_review",
    "question_archive_mixed_review",
  ]);
  assert.deepEqual(archiveBody.states?.archiveMixedReviewTraceEventRefs, [
    "evt_archive_mixed_review_handoff_review",
    "evt_archive_mixed_review_memory_review",
    "evt_archive_mixed_review_protocol_review",
    "evt_archive_mixed_review_question_response",
  ]);
  assert.match(String(archiveBody.states?.archiveMixedReviewBoundaryNote ?? ""), /unresolved context/);
  assert.equal(archiveBody.states?.archiveMixedReviewPressureReviewCount, 2);
  assert.deepEqual(archiveBody.states?.archiveMixedReviewPressureReviewedRefs, [pressureRef]);
  assert.deepEqual(archiveBody.states?.archiveMixedReviewPressureReviewEventRefs, [
    "evt_archive_mixed_pressure_review",
    "evt_archive_mixed_pressure_review_questioned",
  ]);
  assert.deepEqual(archiveBody.states?.archiveMixedReviewPressureReviewResponses, [
    `mimo_member_01 narrowing_suggested ${pressureRef}: Keep the pressure, but narrow it to memory and open question until the room asks for handoff again.`,
    `kimi_member_02 questioned ${pressureRef}: A later review questions whether narrowing is premature; leave the pressure visible until the room has one more ordinary exchange.`,
  ]);
  assert.deepEqual(archiveBody.states?.archiveMixedReviewPressureReviewResponseKindCounts, {
    narrowing_suggested: 1,
    questioned: 1,
  });
  assert.deepEqual(archiveBody.states?.archiveMixedReviewPressureReviewAgentIds, ["kimi_member_02", "mimo_member_01"]);
  assert.match(String(archiveBody.states?.archiveMixedReviewPressureReviewLatest ?? ""), /kimi_member_02 questioned/);
  assert.match(String(archiveBody.states?.archiveMixedReviewPressureReviewEvolutionNote ?? ""), /evolution trace/);
  assert.match(String(archiveBody.states?.archiveMixedReviewPressureReviewBoundaryNote ?? ""), /social traces only/);
});

test("topic context fragments carry proposal, summary, and open-question semantics", () => {
  const events = [
    event("evt_topic_context_created", "topic.created", {
      topicId,
      title: "Living room topic movement",
      createdFromMessageId: "msg_topic_anchor",
    }),
    event("evt_topic_anchor", "message.created", {
      messageId: "msg_topic_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Can topic movement stay social instead of becoming routing?",
    }),
    event("evt_topic_context_updated", "topic.updated", {
      topicId,
      summary: "The room is exploring topic movement as soft self-organization.",
      summaryRef: "summary_topic_movement",
      openQuestion: "When should a topic split remain only a proposal?",
      openQuestionRef: "question_topic_split",
      status: "active",
      messageId: "msg_topic_anchor",
    }),
    event("evt_topic_proposed", "topic.proposed", {
      proposalId: "topic_proposal_split",
      currentTopicId: topicId,
      proposedBy: "mimo_member_02",
      action: "split",
      title: "Separate implementation testing from room philosophy",
      reason: "The discussion has two rhythms and should not force everyone through the same window.",
      targetTopicId: "topic_testing",
      contextRefs: ["msg_topic_anchor", "mixed_review:topic_pressure"],
      sourcePressureRefs: ["mixed_review:topic_pressure"],
      status: "proposed",
      boundaryNote: "topic proposal only; it does not switch, split, pause, revive, or merge the active topic by itself",
    }),
    event("evt_topic_responded", "topic.responded", {
      responseId: "topic_response_split",
      topicProposalRef: "topic_proposal_split",
      topicId,
      agentId: "mimo_member_03",
      response: "challenge",
      reason: "The split may hide the shared unresolved question.",
      proposedRevision: "Keep one more round in the current topic, then split.",
      contextRefs: ["topic_proposal_split"],
      boundaryNote:
        "topic proposal response only; it does not switch, split, pause, revive, or merge the active topic by itself",
    }),
    event("evt_open_question_responded", "open_question.responded", {
      responseId: "question_response_split",
      questionRef: "question_topic_split",
      topicId,
      agentId: "mimo_member_05",
      response: "deferred",
      summary: "Keep the unresolved question visible for one more round before splitting.",
      sourceMessageId: "msg_question_response",
      contextRefs: ["question_topic_split"],
      boundaryNote: "open question response is a social trace; it does not resolve or close the question",
    }),
    event("evt_topic_applied", "topic.applied", {
      applicationId: "topic_application_split",
      topicProposalRef: "topic_proposal_split",
      action: "split",
      sourceTopicId: topicId,
      resultingTopicId: "topic_testing",
      appliedTopicEventIds: ["evt_topic_testing_created"],
      appliedBy: "mimo_member_04",
      reason: "The room-visible proposal has enough support to become a separate surface.",
      contextRefs: ["topic_proposal_split"],
      boundaryNote: "topic application is room-visible topic movement, not hidden scheduler control",
    }),
    event("evt_topic_trigger", "message.created", {
      messageId: "msg_topic_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_02"],
      contextRefs: ["topic_proposal_split"],
      content: "Read the topic proposal and the open question before answering.",
    }),
  ];

  const store = TopicWindowStore.fromEvents(events);
  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_topic_trigger",
    recipientAgent: "mimo_member_02",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: ["topic_proposal_split"],
  });
  assert.equal(packet.refs.topics.includes(topicId), true);
  assert.equal(packet.refs.topics.includes("summary_topic_movement"), true);
  assert.equal(packet.refs.topics.includes("topic_proposal_split"), true);
  assert.equal(packet.refs.topics.includes("topic_response_split"), true);
  assert.deepEqual(packet.refs.openQuestions, ["question_topic_split"]);

  const topicBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "topic_rule" && fragment.refs.includes(topicId))?.body ?? "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  const summaryBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "topic_summary")?.body ?? "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  const topicRuleBodies = packet.fragments
    .filter((fragment) => fragment.type === "topic_rule")
    .map((fragment) => JSON.parse(fragment.body) as { refId?: string; note?: string; states?: Record<string, unknown> });
  const proposalBody = topicRuleBodies.find((body) => body.refId === "topic_proposal_split") ?? {};
  const responseBody = topicRuleBodies.find((body) => body.refId === "topic_response_split") ?? {};
  const questionBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "open_question")?.body ?? "{}",
  ) as {
    note?: string;
    question?: { openQuestion?: string; openQuestionLastResponseSummary?: string };
    states?: Record<string, unknown>;
    sourceEvidence?: { ref: string; excerpt: string }[];
  };

  assert.match(topicBody.note ?? "", /room focus marker/);
  assert.equal(topicBody.states?.topicTitle, "Living room topic movement");
  assert.equal(topicBody.states?.topicSummary, "The room is exploring topic movement as soft self-organization.");

  assert.match(summaryBody.note ?? "", /bounded projection/);
  assert.equal(summaryBody.states?.summaryText, "The room is exploring topic movement as soft self-organization.");

  assert.match(proposalBody.note ?? "", /soft room-order suggestion/);
  assert.equal(proposalBody.states?.topicProposalAction, "split");
  assert.equal(proposalBody.states?.topicProposalTitle, "Separate implementation testing from room philosophy");
  assert.equal(proposalBody.states?.topicProposalCurrentTopicId, topicId);
  assert.equal(proposalBody.states?.topicProposalTargetTopicId, "topic_testing");
  assert.deepEqual(proposalBody.states?.topicProposalSourcePressureRefs, ["mixed_review:topic_pressure"]);
  assert.equal(proposalBody.states?.topicStatus, "applied");
  assert.equal(proposalBody.states?.topicProposalAppliedBy, "mimo_member_04");
  assert.equal(proposalBody.states?.topicProposalResultingTopicId, "topic_testing");
  assert.match(String(proposalBody.states?.topicProposalApplicationReason ?? ""), /separate surface/);
  assert.match(String(proposalBody.states?.topicProposalBoundaryNote ?? ""), /not hidden scheduler control/);
  assert.equal(responseBody.states?.topicProposalRef, "topic_proposal_split");
  assert.equal(responseBody.states?.topicProposalResponse, "challenge");
  assert.equal(responseBody.states?.topicProposalRespondingAgentId, "mimo_member_03");
  assert.match(String(responseBody.states?.topicProposalResponseReason ?? ""), /hide the shared unresolved question/);
  assert.match(String(responseBody.states?.topicProposalBoundaryNote ?? ""), /does not switch/);

  assert.match(questionBody.note ?? "", /response traces/);
  assert.match(questionBody.note ?? "", /not closure/);
  assert.equal(questionBody.question?.openQuestion, "When should a topic split remain only a proposal?");
  assert.match(questionBody.question?.openQuestionLastResponseSummary ?? "", /one more round/);
  assert.equal(questionBody.states?.openQuestion, "When should a topic split remain only a proposal?");
  assert.equal(questionBody.states?.openQuestionResponseCount, 1);
  assert.deepEqual(questionBody.states?.openQuestionResponseKindCounts, { deferred: 1 });
  assert.equal(questionBody.states?.openQuestionDeferredCount, 1);
  assert.deepEqual(questionBody.states?.openQuestionResponseRefs, ["question_response_split"]);
  assert.deepEqual(questionBody.states?.openQuestionResponseAgentIds, ["mimo_member_05"]);
  assert.equal(questionBody.states?.openQuestionLastResponse, "deferred");
  assert.match(String(questionBody.states?.openQuestionLastResponseSummary ?? ""), /one more round/);
  assert.equal(
    questionBody.sourceEvidence?.some((item) => item.ref === "msg_topic_anchor" && item.excerpt.includes("stay social")),
    true,
  );
  assert.equal(
    questionBody.sourceEvidence?.some(
      (item) => item.ref === "evt_open_question_responded" && item.excerpt.includes("unresolved question visible"),
    ),
    true,
  );
  assert.equal((questionBody.sourceEvidence?.length ?? 0) <= 4, true);

  const followupTopicId = "topic_followup";
  const crossTopicStore = TopicWindowStore.fromEvents(
    events.concat(
      event("evt_followup_topic", "topic.created", {
        topicId: followupTopicId,
        title: "Followup topic",
        createdFromMessageId: "msg_followup_trigger",
      }),
      event("evt_followup_trigger", "message.created", {
        messageId: "msg_followup_trigger",
        topicId: followupTopicId,
        author: "user",
        authorKind: "user",
        mentions: ["mimo_member_02"],
        contextRefs: ["topic_proposal_split"],
        content: "Carry this earlier topic proposal into the new topic.",
      }),
    ),
  );
  const crossTopicPacket = new ContextPacketBuilder(crossTopicStore).build({
    roomId,
    topicId: followupTopicId,
    purpose: "wake",
    triggerRef: "msg_followup_trigger",
    recipientAgent: "mimo_member_02",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: ["topic_proposal_split"],
  });
  assert.equal(crossTopicPacket.refs.topics.includes("topic_proposal_split"), true);
  assert.match(
    crossTopicPacket.fragments.find(
      (fragment) => fragment.type === "topic_rule" && fragment.refs.includes("topic_proposal_split"),
    )?.body ?? "",
    /soft room-order suggestion/,
  );

  const explicitQuestionPacket = new ContextPacketBuilder(crossTopicStore).build({
    roomId,
    topicId: followupTopicId,
    purpose: "wake",
    triggerRef: "msg_followup_trigger",
    recipientAgent: "mimo_member_02",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: ["question_topic_split"],
  });
  assert.deepEqual(explicitQuestionPacket.refs.openQuestions, ["question_topic_split"]);
  assert.equal(explicitQuestionPacket.audit.selectedFragments.filter((fragment) => fragment.type === "open_question").length, 1);
  assert.match(
    explicitQuestionPacket.fragments.find((fragment) => fragment.type === "open_question")?.body ?? "",
    /When should a topic split remain only a proposal/,
  );

  const revivedTopicPacket = new ContextPacketBuilder(crossTopicStore).build({
    roomId,
    topicId: followupTopicId,
    purpose: "wake",
    triggerRef: "msg_followup_trigger",
    recipientAgent: "mimo_member_02",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: [topicId],
  });
  const revivedTopicBody = JSON.parse(
    revivedTopicPacket.fragments.find((fragment) => fragment.type === "topic_rule" && fragment.refs.includes(topicId))?.body ??
      "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  assert.equal(revivedTopicPacket.refs.topics.includes(topicId), true);
  assert.match(revivedTopicBody.note ?? "", /room focus marker/);
  assert.equal(revivedTopicBody.states?.topicTitle, "Living room topic movement");
});

test("accepted memory can become contested while preserving source and contest refs", () => {
  const store = MemoryClaimStore.fromEvents([
    event("evt_source_msg", "message.created", {
      messageId: "msg_source",
      topicId,
      author: "architect",
      authorKind: "agent",
      mentions: [],
      contextRefs: [],
      content: "Memory should be provisional.",
    }),
    event("evt_proposed", "memory.proposed", {
      memoryId: "memory_public_sediment",
      summary: "Room memory is public sediment, not truth.",
      sourceRefs: ["msg_source"],
      reason: "The room explicitly discussed it.",
    }),
    event("evt_accepted", "memory.accepted", {
      memoryId: "memory_public_sediment",
      summary: "Room memory is public sediment, not truth.",
      evidenceRefs: ["msg_accept"],
      reason: "Accepted as working language.",
    }),
    event(
      "evt_contested",
      "memory.contested",
      {
        memoryId: "memory_public_sediment",
        reason: "The summary may be used too authoritatively.",
        evidenceRefs: ["msg_contest"],
      },
      { kind: "agent", id: "critic" },
    ),
  ]);

  const claim = store.get("memory_public_sediment");
  assert.ok(claim);
  assert.equal(claim.state, "contested");
  assert.deepEqual(claim.sourceRefs, ["msg_source", "msg_accept", "msg_contest"]);
  assert.deepEqual(claim.acceptedRefs, ["msg_accept"]);
  assert.deepEqual(claim.contestRefs, ["msg_contest"]);
  assert.deepEqual(claim.contestedBy, ["critic"]);
});

test("daily archive preserves invalid memory transition as boundary instead of crashing", () => {
  const events = [
    event("evt_invalid_memory_topic", "topic.created", {
      topicId,
      title: "Invalid memory transition carryover",
      createdFromMessageId: "msg_invalid_memory",
    }),
    event("evt_invalid_memory_msg", "message.created", {
      messageId: "msg_invalid_memory",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "A legacy memory transition may be malformed, but the archive should still exist.",
    }),
    event("evt_invalid_memory_proposed", "memory.proposed", {
      memoryId: "memory_invalid_transition",
      topicId,
      summary: "Legacy memory should not block archive creation.",
      sourceRefs: ["msg_invalid_memory"],
    }),
    event("evt_invalid_memory_retired", "memory.retired", {
      memoryId: "memory_invalid_transition",
      topicId,
      reason: "The claim left active public memory.",
      contextRefs: ["msg_invalid_memory"],
    }),
    event("evt_invalid_memory_contested", "memory.contested", {
      memoryId: "memory_invalid_transition",
      topicId,
      reason: "A stale client tried to contest a retired claim.",
      contextRefs: ["msg_invalid_memory"],
    }),
  ];

  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-20",
    timezone: "Asia/Shanghai",
  });

  assert.equal(archive.contestedItems.includes("memory_invalid_transition"), false);
  assert.equal(archive.memoryChanges.some((change) => change.memoryId === "memory_invalid_transition" && change.toState === "contested"), true);
  assert.equal(
    archive.disagreements.some(
      (item) =>
        item.summary.includes("Memory projection boundary") &&
        item.summary.includes("Invalid memory transition for memory_invalid_transition: retired -> contested") &&
        item.summary.includes("not public-memory truth"),
    ),
    true,
  );
});

test("archive store normalizes partial nested archive payloads", () => {
  const store = ArchiveStore.fromEvents([
    event("evt_partial_archive", "daily_archive.created", {
      archiveId: "day_partial_archive",
      date: "2026-06-20",
      archive: {
        archiveId: "day_partial_archive",
        date: "2026-06-20",
        providerBoundaries: [
          {
            boundaryId: "provider_boundary_partial",
            sourceRefs: ["provider_boundary_partial"],
          },
        ],
      },
    }),
  ]);

  const archive = store.get("day_partial_archive");
  assert.equal(archive?.roomId, roomId);
  assert.deepEqual(archive?.inputLedgerRange, { fromOffset: 0, toOffset: 0 });
  assert.equal(archive?.providerBoundaries[0]?.boundaryId, "provider_boundary_partial");
  assert.equal(store.view().archives.length, 1);
});

test("revised memory proposals stay linked without rewriting the original claim", () => {
  const events = [
    event("evt_memory_revision_topic", "topic.created", {
      topicId,
      title: "Memory revision lineage",
      createdFromMessageId: "msg_memory_revision_anchor",
    }),
    event("evt_memory_revision_anchor", "message.created", {
      messageId: "msg_memory_revision_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Revise a contested memory without rewriting the old one.",
    }),
    event("evt_memory_original", "memory.proposed", {
      memoryId: "memory_original",
      topicId,
      summary: "Diagnostic result proves provider recovery.",
      sourceRefs: ["msg_memory_revision_anchor"],
      proposedBy: "boundary_observer",
    }),
    event("evt_memory_contest", "memory.contested", {
      memoryId: "memory_original",
      topicId,
      reason: "The result is evidence, not recovery truth.",
      evidenceRefs: ["memory_original", "msg_memory_revision_anchor"],
      contestedBy: "approval_guard",
    }),
    event("evt_memory_revised", "memory.proposed", {
      memoryId: "memory_revised",
      topicId,
      summary: "Diagnostic result is evidence for provider wiring, not recovery truth.",
      sourceRefs: ["memory_original", "msg_memory_revision_anchor"],
      proposedBy: "boundary_observer",
      revisedFromMemoryRef: "memory_original",
      revisedBy: "boundary_observer",
      boundaryNote: "memory revision opens a fresh proposal; it does not rewrite the previous memory claim",
    }),
    event("evt_memory_revision_trigger", "message.created", {
      messageId: "msg_memory_revision_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: ["memory_revised"],
      content: "Inspect the revised memory lineage.",
    }),
  ];

  const store = TopicWindowStore.fromEvents(events);
  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_memory_revision_trigger",
    recipientAgent: "critic",
    relevantRefs: ["memory_revised"],
    maxRefs: 8,
    maxTokens: 10_000,
  });

  const revised = packet.fragments.find(
    (fragment) => fragment.type === "memory_relevant" && fragment.refs.includes("memory_revised"),
  );
  assert.ok(revised);
  const body = JSON.parse(revised.body) as { states: Record<string, unknown>; note: string; sourceRefs: string[] };
  assert.equal(body.states.memoryRevisedFromRef, "memory_original");
  assert.equal(body.states.memoryRevisedBy, "boundary_observer");
  assert.match(body.note, /fresh proposal/);
  assert.equal(body.sourceRefs.includes("memory_original"), true);

  const view = MemoryClaimStore.fromEvents(events).view();
  assert.deepEqual(view.claims.find((claim) => claim.memoryId === "memory_original")?.state, "contested");
  assert.deepEqual(view.claims.find((claim) => claim.memoryId === "memory_revised")?.revisedFromMemoryRef, "memory_original");
});

test("stale memory stays out of default context unless explicitly relevant", () => {
  const events = [
    event("evt_topic", "topic.created", {
      topicId,
      title: "Memory review",
      createdFromMessageId: "msg_source",
    }),
    event("evt_source", "message.created", {
      messageId: "msg_source",
      topicId,
      author: "archivist",
      authorKind: "agent",
      mentions: [],
      contextRefs: [],
      content: "Old claim that may no longer fit.",
    }),
    event("evt_memory_accept", "memory.accepted", {
      memoryId: "memory_stale",
      topicId,
      summary: "An old accepted claim.",
      sourceRefs: ["msg_source"],
    }),
    event("evt_memory_stale", "memory.stale", {
      memoryId: "memory_stale",
      topicId,
      reason: "The room context changed.",
      evidenceRefs: ["msg_review"],
    }),
    event("evt_trigger", "message.created", {
      messageId: "msg_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Review the topic.",
    }),
  ];

  const store = TopicWindowStore.fromEvents(events);
  const defaultPacket = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_trigger",
    maxRefs: 10,
    maxTokens: 10_000,
  });
  assert.ok(!defaultPacket.refs.memory.includes("memory_stale"));
  assert.ok(defaultPacket.omitted.some((item) => item.refType === "memory" && item.reason === "stale_not_relevant"));

  const reviewPacket = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "memory_review",
    triggerRef: "msg_trigger",
    relevantRefs: ["memory_stale"],
    maxRefs: 10,
    maxTokens: 10_000,
  });
  assert.ok(reviewPacket.refs.memory.includes("memory_stale"));
});

test("memory context fragments carry bounded source evidence without rewriting the claim", () => {
  const events = [
    event("evt_topic", "topic.created", {
      topicId,
      title: "Memory source review",
      createdFromMessageId: "msg_source",
    }),
    event("evt_source", "message.created", {
      messageId: "msg_source",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Daily rhythm turned yesterday's unresolved question into a checklist and the quiet objection disappeared.",
    }),
    event("evt_evidence", "message.created", {
      messageId: "msg_evidence",
      topicId,
      author: "critic",
      authorKind: "agent",
      mentions: [],
      contextRefs: [],
      content: "The evidence we need is whether a longer checklist actually buried a later correction.",
    }),
    event("evt_memory_proposed", "memory.proposed", {
      memoryId: "memory_daily_rhythm",
      topicId,
      summary: "Daily rhythm should preserve unresolved questions instead of manufacturing task lists.",
      reason: "The room saw a quiet objection disappear behind a checklist.",
      sourceRefs: ["msg_source", "mixed_review:memory_daily_rhythm_pressure"],
      sourcePressureRefs: ["mixed_review:memory_daily_rhythm_pressure"],
      evidenceRefs: ["msg_evidence"],
    }),
    event("evt_memory_reviewed", "memory.reviewed", {
      memoryRef: "memory_daily_rhythm",
      topicId,
      agentId: "critic",
      reviewId: "memory_review_daily_rhythm",
      response: "questioned",
      summary: "This claim still needs a concrete counterexample before becoming guidance.",
      contextRefs: ["memory_daily_rhythm", "msg_evidence"],
    }),
    event("evt_trigger", "message.created", {
      messageId: "msg_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: ["memory_daily_rhythm"],
      content: "Review the carried memory with its visible source evidence.",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "memory_review",
    triggerRef: "msg_trigger",
    relevantRefs: ["memory_daily_rhythm"],
    maxRefs: 12,
    maxTokens: 10_000,
  });

  const fragment = packet.fragments.find(
    (item) => item.type === "memory_relevant" && item.refs.includes("memory_daily_rhythm"),
  );
  assert.ok(fragment);
  const body = JSON.parse(fragment.body) as {
    claim?: { memorySummary?: string; memoryLastReviewSummary?: string; memorySourcePressureRefs?: string[] };
    states?: { memorySummary?: string; memoryLastReviewSummary?: string; memorySourcePressureRefs?: string[] };
    sourceEvidence?: { ref: string; excerpt: string }[];
  };

  assert.match(body.claim?.memorySummary ?? "", /preserve unresolved questions/);
  assert.deepEqual(body.claim?.memorySourcePressureRefs, ["mixed_review:memory_daily_rhythm_pressure"]);
  assert.match(body.states?.memorySummary ?? "", /preserve unresolved questions/);
  assert.deepEqual(body.states?.memorySourcePressureRefs, ["mixed_review:memory_daily_rhythm_pressure"]);
  assert.doesNotMatch(body.states?.memorySummary ?? "", /concrete counterexample/);
  assert.match(body.states?.memoryLastReviewSummary ?? "", /concrete counterexample/);
  assert.equal(body.sourceEvidence?.some((item) => item.ref === "msg_source" && item.excerpt.includes("quiet objection")), true);
  assert.equal(body.sourceEvidence?.some((item) => item.ref === "msg_evidence" && item.excerpt.includes("longer checklist")), true);
  assert.equal((body.sourceEvidence?.length ?? 0) <= 4, true);
});

test("context fragments enforce per-type hard caps before total packet budget", () => {
  const oversizedSummary = "hard cap evidence ".repeat(500);
  const events = [
    event("evt_topic", "topic.created", {
      topicId,
      title: "Hard cap review",
      createdFromMessageId: "msg_source",
    }),
    event("evt_source", "message.created", {
      messageId: "msg_source",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Keep the trigger small so only memory trips the cap.",
    }),
    event("evt_memory_accept", "memory.accepted", {
      memoryId: "memory_oversized",
      topicId,
      summary: oversizedSummary,
      sourceRefs: ["msg_source"],
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_source",
    maxRefs: 10,
    maxTokens: 10_000,
  });

  assert.ok(!packet.refs.memory.includes("memory_oversized"));
  assert.ok(packet.omitted.some((item) => item.refType === "memory" && item.reason === "hard_cap"));
  assert.ok(
    packet.audit.omittedFragments.some(
      (fragment) =>
        fragment.id === "memory_accepted:memory_oversized" &&
        fragment.reason === "hard_cap" &&
        fragment.tokenEstimate > fragment.hardCap,
    ),
  );
});

test("daily archive preserves disagreement and contested items instead of flattening consensus", () => {
  const events = [
    event("evt_topic", "topic.created", {
      topicId,
      title: "Archive quality",
      createdFromMessageId: "msg_start",
    }),
    event("evt_msg", "message.created", {
      messageId: "msg_start",
      topicId,
      author: "architect",
      authorKind: "agent",
      mentions: [],
      contextRefs: [],
      content: "Archive is compression, not consensus.",
    }),
    event("evt_decision", "protocol.responded", {
      protocolId: "protocol_archive",
      topicId,
      status: "accepted",
      decision: "Keep archive sections source-linked.",
    }),
    event("evt_question", "topic.updated", {
      topicId,
      openQuestion: "How should unresolved objections be carried into tomorrow?",
      openQuestionRef: "question_archive_objections",
      raisedBy: "critic",
      sourceMessageId: "msg_objection",
      boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer",
    }),
    event("evt_memory_proposed", "memory.proposed", {
      memoryId: "memory_archive_rule",
      topicId,
      summary: "Archive should preserve unresolved disagreement.",
      sourceRefs: ["msg_start"],
    }),
    event("evt_memory_accepted", "memory.accepted", {
      memoryId: "memory_archive_rule",
      topicId,
      summary: "Archive should preserve unresolved disagreement.",
      evidenceRefs: ["msg_start"],
    }),
    event(
      "evt_memory_contested",
      "memory.contested",
      {
        memoryId: "memory_archive_rule",
        topicId,
        reason: "The wording could hide minority objections.",
        evidenceRefs: ["msg_objection"],
      },
      { kind: "agent", id: "critic" },
    ),
  ];

  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-17",
    timezone: "Asia/Shanghai",
  });

  assert.equal(archive.compressionNote, "archive_is_compression_not_consensus");
  assert.ok(archive.decisions.some((item) => item.summary === "Keep archive sections source-linked."));
  assert.ok(archive.openQuestions.some((item) => item.sourceRefs.includes("question_archive_objections")));
  assert.equal(archive.openQuestionTraces.length, 1);
  assert.equal(archive.openQuestionTraces[0]?.questionId, "question_archive_objections");
  assert.equal(archive.openQuestionTraces[0]?.raisedBy, "critic");
  assert.equal(archive.openQuestionTraces[0]?.sourceMessageId, "msg_objection");
  assert.match(archive.openQuestionTraces[0]?.boundaryNote ?? "", /not a demand/);
  assert.ok(archive.disagreements.some((item) => item.summary.includes("minority objections")));
  assert.deepEqual(archive.contestedItems, ["memory_archive_rule"]);
  assert.ok(archive.memoryChanges.some((change) => change.memoryId === "memory_archive_rule" && change.toState === "contested"));
});

test("daily archive preserves social protocol, persona, and side-effect boundary tracks", () => {
  const events = [
    event("evt_topic_proposed", "topic.proposed", {
      proposalId: "topic_proposal_archive",
      currentTopicId: topicId,
      proposedBy: "mimo_member_01",
      action: "split",
      title: "Archive social movement separately",
      reason: "Topic movement should remain a proposal until the room accepts it.",
      targetTopicId: "topic_archive_social",
      contextRefs: ["msg_social", "mixed_review:archive_topic_pressure"],
      sourcePressureRefs: ["mixed_review:archive_topic_pressure"],
      status: "proposed",
      boundaryNote: "topic proposal only; it does not switch, split, pause, revive, or merge the active topic by itself",
    }),
    event("evt_topic_responded_archive", "topic.responded", {
      responseId: "topic_response_archive",
      topicProposalRef: "topic_proposal_archive",
      topicId,
      agentId: "mimo_member_02",
      response: "revise",
      reason: "Keep one more round in the current topic before splitting.",
      proposedRevision: "Split only after the unresolved archive question is named.",
      contextRefs: ["topic_proposal_archive"],
      boundaryNote:
        "topic proposal response only; it does not switch, split, pause, revive, or merge the active topic by itself",
    }),
    event("evt_topic_reviewed_archive", "topic.reviewed", {
      reviewId: "topic_review_archive",
      topicProposalRef: "topic_proposal_archive",
      topicId,
      agentId: "mimo_member_06",
      response: "questioned",
      summary: "The topic proposal needs one more source-linked objection before any split.",
      sourceMessageId: "msg_social",
      contextRefs: ["topic_proposal_archive", "msg_social"],
      boundaryNote:
        "topic proposal review is a social trace; it does not accept, reject, challenge, revise, apply, or move the active topic",
    }),
    event("evt_topic_applied_archive", "topic.applied", {
      applicationId: "topic_application_archive",
      topicProposalRef: "topic_proposal_archive",
      action: "split",
      sourceTopicId: topicId,
      resultingTopicId: "topic_archive_social",
      appliedTopicEventIds: ["evt_topic_application_state_archive"],
      appliedBy: "mimo_member_04",
      reason: "The archive thread now needs its own room-visible surface.",
      contextRefs: ["topic_proposal_archive"],
      boundaryNote: "topic application is room-visible topic movement, not hidden scheduler control",
    }),
    event("evt_handoff_proposed_archive", "handoff.proposed", {
      handoffId: "handoff_archive",
      topicId,
      fromAgentId: "mimo_member_01",
      toAgentId: "mimo_member_03",
      reason: "The archive should preserve social transfer without forcing it.",
      requestedResponse: "Challenge whether the handoff is too broad.",
      contextRefs: ["msg_social", "mixed_review:archive_handoff_pressure"],
      sourcePressureRefs: ["mixed_review:archive_handoff_pressure"],
      status: "proposed",
    }),
    event("evt_handoff_responded_archive", "handoff.responded", {
      handoffRef: "handoff_archive",
      topicId,
      byAgentId: "mimo_member_03",
      response: "challenged",
      reason: "The handoff needs a narrower claim before I accept it.",
      contextRefs: ["handoff_archive", "msg_social"],
    }),
    event("evt_handoff_reviewed_archive", "handoff.reviewed", {
      reviewId: "handoff_review_archive",
      handoffRef: "handoff_archive",
      topicId,
      agentId: "mimo_member_06",
      response: "cautioned",
      summary: "The handoff packet is useful but too broad to transfer control.",
      sourceMessageId: "msg_social",
      contextRefs: ["handoff_archive", "msg_social"],
      boundaryNote:
        "handoff review is a social trace; it does not accept, reject, partially accept, delegate, challenge, complete, or transfer control",
    }),
    event("evt_protocol_proposed_archive", "protocol.proposed", {
      protocolId: "protocol_archive",
      topicId,
      proposedBy: "mimo_member_04",
      summary: "Try one round of uncertainty labels before accepting a public-memory claim.",
      scope: "current_topic",
      reason: "The room should expose uncertainty without turning review into command.",
      expiresAt: "2026-06-17T13:00:00.000Z",
      expiryPolicy: "one_hour",
      contextRefs: ["msg_social"],
      status: "proposed",
      boundaryNote: "protocol is temporary room etiquette, not permanent control flow",
    }),
    event("evt_protocol_responded_archive", "protocol.responded", {
      protocolRef: "protocol_archive",
      topicId,
      agentId: "mimo_member_05",
      response: "challenge",
      reason: "One round may hide urgent corrections.",
      proposedRevision: "Use uncertainty labels only when no source refs are present.",
      contextRefs: ["protocol_archive", "msg_social"],
    }),
    event("evt_protocol_reviewed_archive", "protocol.reviewed", {
      reviewId: "protocol_review_archive",
      protocolRef: "protocol_archive",
      topicId,
      agentId: "mimo_member_06",
      response: "questioned",
      summary: "This protocol needs clearer evidence before it becomes default room etiquette.",
      sourceMessageId: "msg_social",
      contextRefs: ["protocol_archive", "msg_social"],
      boundaryNote:
        "protocol review is a social trace; it does not accept, reject, challenge, revise, retire, or activate etiquette",
    }),
    event("evt_protocol_retired_archive", "protocol.retired", {
      protocolRef: "protocol_archive",
      topicId,
      retiredBy: "mimo_member_04",
      reason: "The room only needed this etiquette for the memory-review burst.",
      contextRefs: ["protocol_archive"],
    }),
    event("evt_internal_wake_invited_archive", "agent.invited", {
      invitationId: "invite_internal_wake_archive",
      agentId: "mimo_member_05",
      topicId,
      messageEventId: "msg_social",
      invitedBy: "wake_policy",
      reason: "Internal wake knock should not become archive social memory.",
      contextRefs: ["msg_social"],
    }),
    event(
      "evt_invitation_archive",
      "agent.invited",
      {
        invitationId: "invite_archive",
        agentId: "mimo_member_05",
        topicId,
        messageEventId: "msg_social",
        invitedBy: "agent_intention",
        reason: "This topic may need a patient listener.",
        contextRefs: ["msg_social", "protocol_archive", "mixed_review:archive_invitation_pressure"],
        sourcePressureRefs: ["mixed_review:archive_invitation_pressure"],
        boundaryNote: "invitation is a social knock, not a speaking command",
      },
      { kind: "agent", id: "mimo_member_04" },
    ),
    event(
      "evt_invitation_response_archive",
      "agent.invitation_responded",
      {
        responseId: "invitation_response_archive",
        invitationRef: "invite_archive",
        topicId,
        agentId: "mimo_member_05",
        response: "accept",
        reason: "I can listen without taking a fixed room job.",
        contextRefs: ["invite_archive", "msg_social"],
        boundaryNote: "invitation response is a social reply to a knock, not a speaking command",
      },
      { kind: "agent", id: "mimo_member_05" },
    ),
    event(
      "evt_silence_archive",
      "agent.intention_recorded",
      {
        invitationId: "invite_archive",
        packetId: "packet_silence_archive",
        agentId: "mimo_member_05",
        topicId,
        triggeringEventId: "evt_invitation_archive",
        intention: {
          kind: "stay_silent",
          reason: "Listening preserves room bandwidth after the invitation.",
        },
      },
      { kind: "agent", id: "mimo_member_05" },
    ),
    {
      ...event(
        "evt_degraded_silence_archive",
        "agent.intention_recorded",
        {
          invitationId: "invite_degraded_archive",
          packetId: "packet_degraded_archive",
          agentId: "kimi_member_01",
          topicId,
          triggeringEventId: "msg_social",
          intention: {
            kind: "stay_silent",
            reason: "live provider degraded: timeout",
          },
        },
        { kind: "agent", id: "kimi_member_01" },
      ),
      refs: ["invite_degraded_archive"],
    },
    {
      ...event("evt_provider_degraded_silence_archive", "agent.provider_degraded", {
        agentId: "kimi_member_01",
        topicId,
        triggeringEventId: "msg_social",
        packetId: "packet_degraded_archive",
        providerKind: "kimi_code_api",
        providerLabel: "Kimiplan Agent API",
        diagnostic: "Kimiplan Agent API failed: [masked]",
        boundaryNote: "provider degradation is not agent silence",
      }),
      refs: ["evt_degraded_silence_archive"],
    },
    event("evt_persona_delta", "persona_delta.proposed", {
      deltaId: "persona_delta_archive",
      agentId: "mimo_member_02",
      proposedBy: "mimo_member_02",
      reason: "Repeatedly asks before carrying context.",
      proposedChange: {
        field: "habits",
        operation: "add",
        value: "checks route and consent before relaying context",
      },
      evidenceRefs: ["msg_social", "mixed_review:archive_persona_pressure"],
      sourcePressureRefs: ["mixed_review:archive_persona_pressure"],
      status: "proposed",
      createdAt: "2026-06-17T12:01:00+08:00",
      responses: [],
    }),
    event("evt_persona_delta_response", "persona_delta.responded", {
      responseId: "persona_delta_response_archive",
      deltaId: "persona_delta_archive",
      agentId: "mimo_member_03",
      response: "contest",
      reason: "This might be a temporary mood rather than a durable habit.",
      evidenceRefs: ["msg_persona_contest"],
      createdAt: "2026-06-17T12:02:00+08:00",
    }),
    event("evt_persona_delta_reviewed", "persona_delta.reviewed", {
      reviewId: "persona_delta_review_archive",
      deltaRef: "persona_delta_archive",
      topicId,
      agentId: "mimo_member_06",
      response: "questioned",
      summary: "This identity claim needs stronger room-visible evidence before anyone treats it as durable.",
      sourceMessageId: "msg_persona_contest",
      contextRefs: ["persona_delta_archive", "msg_persona_contest"],
      boundaryNote:
        "persona delta review is a social trace; it does not accept, reject, contest, retire, revise, or mutate identity",
    }),
    event("evt_persona_role_delta", "persona_delta.proposed", {
      deltaId: "persona_delta_role_archive",
      agentId: "mimo_member_02",
      proposedBy: "mimo_member_02",
      reason: "The archive discussion repeatedly needs someone to keep continuity evidence narrow.",
      proposedChange: {
        field: "roleClaims",
        operation: "add",
        value: "keeps archive continuity evidence narrow",
      },
      evidenceRefs: ["msg_social", "mixed_review:archive_role_pressure"],
      sourcePressureRefs: ["mixed_review:archive_role_pressure"],
      status: "proposed",
      createdAt: "2026-06-17T12:01:30+08:00",
      responses: [],
    }),
    event("evt_persona_role_response", "persona_delta.responded", {
      responseId: "persona_delta_response_role_archive",
      deltaId: "persona_delta_role_archive",
      agentId: "mimo_member_03",
      response: "accept",
      reason: "The role claim is narrow and evidence-linked enough to keep as contestable sediment.",
      evidenceRefs: ["msg_persona_role_accept"],
      status: "accepted",
      createdAt: "2026-06-17T12:02:30+08:00",
    }),
    event("evt_persona_daily_mood_delta", "persona_delta.proposed", {
      deltaId: "persona_delta_daily_mood_archive",
      agentId: "mimo_member_02",
      proposedBy: "mimo_member_02",
      reason: "The room-visible archive pass made the next entrance quieter.",
      proposedChange: {
        field: "dailyMood",
        operation: "set",
        value: {
          date: "2026-06-17",
          posture: "quietly careful after archive review",
          sourceRef: "msg_daily_mood_source",
        },
      },
      evidenceRefs: ["msg_daily_mood_source"],
      status: "proposed",
      createdAt: "2026-06-17T12:03:30+08:00",
      responses: [],
    }),
    event("evt_persona_daily_mood_response", "persona_delta.responded", {
      responseId: "persona_delta_response_daily_mood_archive",
      deltaId: "persona_delta_daily_mood_archive",
      agentId: "mimo_member_04",
      response: "accept",
      reason: "This is a reversible daily mood note, not a durable role.",
      evidenceRefs: ["msg_daily_mood_accept"],
      status: "accepted",
      createdAt: "2026-06-17T12:04:30+08:00",
    }),
    event("evt_side_effect_requested", "side_effect.requested", {
      requestId: "sidefx_archive",
      roomId,
      requestedBy: "mimo_member_04",
      topicId,
      kind: "filesystem.write",
      target: "scratch/archive-note.md",
      reason: "Save a note outside chat after approval.",
      expectedImpact: "Creates one scratch note.",
      contextRefs: ["msg_social", "mixed_review:archive_side_effect_pressure"],
      sourcePressureRefs: ["mixed_review:archive_side_effect_pressure"],
      idempotencyKey: "side_effect_request:test",
      requestedFromIntentionEventId: "evt_intention",
    }),
    event("evt_side_effect_denied", "side_effect.denied", {
      approvalId: "sidefx_archive",
      deniedBy: "user",
      reason: "Keep this test in the room ledger only.",
      decidedAt: "2026-06-17T12:03:00+08:00",
    }),
    event("evt_side_effect_reviewed_archive", "side_effect.reviewed", {
      reviewId: "side_effect_review_archive",
      sideEffectRef: "sidefx_archive",
      topicId,
      agentId: "mimo_member_03",
      response: "cautioned",
      summary: "This side-effect request should stay denied unless the target is narrowed.",
      sourceMessageId: "msg_side_effect_review_archive",
      contextRefs: ["sidefx_archive", "msg_social"],
      boundaryNote:
        "side-effect review is a social trace; it does not approve, deny, expire, execute, report a result, or mutate external state",
    }),
    event("evt_workspace_provisioned_archive", "workspace.provisioned", {
      workspaceId: "workspace_mimo_member_02",
      agentId: "mimo_member_02",
      privateHome: "agents/mimo_member_02/",
      scratchPath: "agents/mimo_member_02/workspace/",
      visibility: "private",
      retentionPolicy: "keep_until_archived_or_retired",
      publicContributionPolicy: "explicit_message_proposal_artifact_or_memory_delta",
      boundaryNote: "private workspace metadata only; private files do not enter public memory automatically",
    }),
    event("evt_workspace_artifact", "workspace.artifact_shared", {
      artifactId: "artifact_archive_note",
      workspaceId: "workspace_mimo_member_02",
      agentId: "mimo_member_02",
      pathRef: "agents/mimo_member_02/workspace/archive-note.md",
      summary: "A private workspace note was shared as a ref for discussion.",
      contextRefs: ["msg_social", "mixed_review:archive_workspace_artifact_pressure"],
      sourcePressureRefs: ["mixed_review:archive_workspace_artifact_pressure"],
      status: "shared",
      boundaryNote: "artifact ref is room-visible; private workspace contents are not copied into memory",
    }),
    event("evt_workspace_artifact_reviewed_archive", "workspace.artifact_reviewed", {
      reviewId: "workspace_artifact_review_archive",
      artifactRef: "artifact_archive_note",
      topicId,
      agentId: "mimo_member_03",
      response: "cautioned",
      summary: "Keep this as a private workspace ref and do not copy it into memory.",
      sourceMessageId: "msg_workspace_artifact_review_archive",
      contextRefs: ["artifact_archive_note", "msg_social", "mixed_review:archive_workspace_artifact_pressure"],
      sourcePressureRefs: ["mixed_review:archive_workspace_artifact_pressure"],
      boundaryNote:
        "workspace artifact review is a social trace; it does not copy private workspace contents, promote public memory, execute tools, or mutate the artifact",
    }),
    event("evt_skill_capsule_archive", "skill.capsule_registered", {
      capsuleId: "skill_archive_writer",
      agentId: "mimo_member_02",
      label: "archive scratch writer",
      triggerHints: ["draft note", "workspace artifact"],
      sideEffectKinds: ["filesystem.write"],
      approvalRequired: true,
      status: "registered",
      source: "seed_agent",
      boundaryNote:
        "skill capsule is a possible action organ; it cannot execute or publish without an explicit room event and required approvals",
      contextRefs: ["workspace_mimo_member_02"],
    }),
    event("evt_skill_capsule_reviewed_archive", "skill.capsule_reviewed", {
      reviewId: "skill_capsule_review_archive",
      capsuleRef: "skill_archive_writer",
      topicId,
      agentId: "mimo_member_03",
      response: "cautioned",
      summary: "This skill capsule still needs explicit approval and should not become a role assignment.",
      sourceMessageId: "msg_skill_capsule_review_archive",
      contextRefs: ["skill_archive_writer", "msg_social", "mixed_review:archive_skill_capsule_pressure"],
      sourcePressureRefs: ["mixed_review:archive_skill_capsule_pressure"],
      boundaryNote:
        "skill capsule review is a social trace; it does not register a skill, assign a role, execute tools, bypass approvals, or mutate capability state",
    }),
    event("evt_capability_reviewed_archive", "capability.reviewed", {
      reviewId: "capability_review_archive",
      capabilityRef: "capability_archive_hint",
      topicId,
      agentId: "mimo_member_03",
      response: "cautioned",
      summary: "Capability hints should remain weak routing clues, not responsibility or competence claims.",
      sourceMessageId: "msg_capability_review_archive",
      contextRefs: ["capability_archive_hint", "msg_social", "mixed_review:archive_capability_pressure"],
      sourcePressureRefs: ["mixed_review:archive_capability_pressure"],
      boundaryNote:
        "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech",
    }),
    event("evt_pressure_boundary", "room.pressure_detected", {
      reason: "background_turn_concurrency_limit",
      messageEventId: "evt_pressure_message",
      messageId: "msg_pressure",
      topicId,
      activeBackgroundTurns: 1,
      queuedBackgroundTurns: 2,
      maxConcurrentBackgroundTurns: 1,
      boundaryNote: "Message expression is preserved in the ledger; agent wake is delayed to keep the room inhabitable.",
    }),
    event("evt_provider_degraded", "agent.provider_degraded", {
      agentId: "kimi_member_01",
      topicId,
      triggeringEventId: "evt_provider_message",
      packetId: "packet_provider_degraded",
      providerKind: "kimi_code_api",
      providerLabel: "Kimiplan Agent API",
      diagnostic: "Kimiplan Agent API failed: [masked]",
      boundaryNote: "provider degradation is not agent silence",
    }),
    event("evt_memory_pressure_archive", "room.memory_pressure_detected", {
      reason: "pending_memory_proposal_limit",
      topicId,
      triggeringMemoryId: "memory_pressure_3",
      pendingProposalCount: 4,
      threshold: 4,
      proposedMemoryRefs: ["memory_pressure_0", "memory_pressure_1", "memory_pressure_2", "memory_pressure_3"],
      boundaryNote:
        "Public memory has too many pending proposals. The room should review, contest, accept, mark stale, or retire claims before adding more sediment.",
    }),
  ];

  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-17",
    timezone: "Asia/Shanghai",
  });

  assert.equal(archive.topicProposals[0]?.proposalId, "topic_proposal_archive");
  assert.equal(archive.topicProposals[0]?.status, "applied");
  assert.deepEqual(archive.topicProposals[0]?.sourcePressureRefs, ["mixed_review:archive_topic_pressure"]);
  assert.equal(archive.topicProposals[0]?.sourceRefs.includes("mixed_review:archive_topic_pressure"), true);
  assert.equal(archive.topicProposals[0]?.responseCount, 1);
  assert.equal(archive.topicProposals[0]?.responses[0]?.response, "revise");
  assert.equal(archive.topicProposals[0]?.reviews.length, 1);
  assert.equal(archive.topicProposals[0]?.reviews[0]?.response, "questioned");
  assert.match(archive.topicProposals[0]?.reviews[0]?.summary ?? "", /source-linked objection/);
  assert.match(archive.topicProposals[0]?.reviews[0]?.boundaryNote ?? "", /does not accept, reject/);
  assert.equal(archive.topicProposals[0]?.appliedBy, "mimo_member_04");
  assert.equal(archive.topicProposals[0]?.resultingTopicId, "topic_archive_social");
  assert.match(archive.topicProposals[0]?.applicationReason ?? "", /own room-visible surface/);
  assert.match(archive.topicProposals[0]?.responses[0]?.proposedRevision ?? "", /unresolved archive question/);
  assert.equal(archive.topicProposals[0]?.boundaryNote?.includes("not hidden scheduler control"), true);
  assert.deepEqual(archive.topicIds, ["topic_archive_social", topicId]);
  assert.equal(archive.handoffs.length, 1);
  assert.equal(archive.handoffs[0]?.handoffId, "handoff_archive");
  assert.equal(archive.handoffs[0]?.status, "challenged");
  assert.equal(archive.handoffs[0]?.fromAgentId, "mimo_member_01");
  assert.equal(archive.handoffs[0]?.toAgentId, "mimo_member_03");
  assert.equal(archive.handoffs[0]?.responseCount, 1);
  assert.equal(archive.handoffs[0]?.responses[0]?.response, "challenged");
  assert.deepEqual(archive.handoffs[0]?.sourcePressureRefs, ["mixed_review:archive_handoff_pressure"]);
  assert.equal(archive.handoffs[0]?.sourceRefs.includes("mixed_review:archive_handoff_pressure"), true);
  assert.equal(archive.handoffs[0]?.reviews?.length, 1);
  assert.equal(archive.handoffs[0]?.reviews?.[0]?.response, "cautioned");
  assert.match(archive.handoffs[0]?.reviews?.[0]?.summary ?? "", /too broad/);
  assert.match(archive.handoffs[0]?.reviews?.[0]?.boundaryNote ?? "", /does not accept, reject/);
  assert.match(archive.handoffs[0]?.boundaryNote ?? "", /social proposal/);
  assert.equal(archive.protocols.length, 1);
  assert.equal(archive.protocols[0]?.protocolId, "protocol_archive");
  assert.equal(archive.protocols[0]?.status, "retired");
  assert.equal(archive.protocols[0]?.proposedBy, "mimo_member_04");
  assert.equal(archive.protocols[0]?.scope, "current_topic");
  assert.equal(archive.protocols[0]?.responseCount, 1);
  assert.equal(archive.protocols[0]?.responses[0]?.response, "challenge");
  assert.equal(archive.protocols[0]?.responses[0]?.proposedRevision, "Use uncertainty labels only when no source refs are present.");
  assert.equal(archive.protocols[0]?.reviews?.length, 1);
  assert.equal(archive.protocols[0]?.reviews?.[0]?.response, "questioned");
  assert.match(archive.protocols[0]?.reviews?.[0]?.summary ?? "", /clearer evidence/);
  assert.match(archive.protocols[0]?.reviews?.[0]?.boundaryNote ?? "", /does not accept, reject/);
  assert.match(archive.protocols[0]?.boundaryNote ?? "", /temporary room etiquette/);
  assert.equal(archive.invitations.length, 1);
  assert.equal(archive.invitations[0]?.invitationId, "invite_archive");
  assert.equal(archive.invitations[0]?.fromAgentId, "mimo_member_04");
  assert.equal(archive.invitations[0]?.toAgentId, "mimo_member_05");
  assert.equal(archive.invitations[0]?.responseCount, 1);
  assert.equal(archive.invitations[0]?.responses[0]?.response, "accept");
  assert.deepEqual(archive.invitations[0]?.sourcePressureRefs, ["mixed_review:archive_invitation_pressure"]);
  assert.equal(archive.invitations[0]?.sourceRefs.includes("mixed_review:archive_invitation_pressure"), true);
  assert.match(archive.invitations[0]?.responses[0]?.reason ?? "", /without taking a fixed room job/);
  assert.match(archive.invitations[0]?.boundaryNote ?? "", /social knock/);
  assert.equal(archive.silences.length, 1);
  assert.equal(archive.silences[0]?.silenceId, "evt_silence_archive");
  assert.equal(archive.silences[0]?.agentId, "mimo_member_05");
  assert.equal(archive.silences[0]?.invitationId, "invite_archive");
  assert.match(archive.silences[0]?.boundaryNote ?? "", /valid room expression/);
  assert.equal(archive.personaDeltas.length, 7);
  assert.ok(
    archive.personaDeltas.some(
      (delta) =>
        delta.deltaId === "persona_delta_archive" &&
        delta.field === "habits" &&
        delta.valueSummary === "checks route and consent before relaying context" &&
        delta.sourcePressureRefs.includes("mixed_review:archive_persona_pressure"),
    ),
  );
  assert.ok(
    archive.personaDeltas.some(
      (delta) =>
        delta.deltaId === "persona_delta_archive" &&
        delta.response === "contest" &&
        delta.reason?.includes("temporary mood"),
    ),
  );
  assert.ok(
    archive.personaDeltas.some(
      (delta) =>
        delta.deltaId === "persona_delta_archive" &&
        delta.status === "reviewed" &&
        delta.reviewingAgentId === "mimo_member_06" &&
        delta.response === "questioned" &&
        /stronger room-visible evidence/.test(delta.summary ?? "") &&
        /does not accept, reject/.test(delta.boundaryNote ?? ""),
    ),
  );
  const continuity = archive.agentContinuity.find((item) => item.agentId === "mimo_member_02");
  assert.ok(continuity);
  assert.match(continuity.boundaryNote, /not a fixed role/);
  assert.equal(continuity.roleClaims.length, 1);
  assert.equal(continuity.roleClaims[0]?.label, "keeps archive continuity evidence narrow");
  assert.equal(continuity.roleClaims[0]?.status, "accepted");
  assert.deepEqual(continuity.roleClaims[0]?.sourcePressureRefs, ["mixed_review:archive_role_pressure"]);
  assert.equal(continuity.roleClaims[0]?.evidenceRefs.includes("msg_social"), true);
  assert.equal(continuity.roleClaims[0]?.responseRefs.includes("evt_persona_role_response"), true);
  assert.match(continuity.roleClaims[0]?.boundaryNote ?? "", /not a room assignment/);
  assert.equal(continuity.dailyMoods.length, 1);
  assert.equal(continuity.dailyMoods[0]?.posture, "quietly careful after archive review");
  assert.equal(continuity.dailyMoods[0]?.status, "accepted");
  assert.equal(continuity.dailyMoods[0]?.sourceRef, "msg_daily_mood_source");
  assert.equal(continuity.dailyMoods[0]?.evidenceRefs.includes("msg_daily_mood_source"), true);
  assert.equal(continuity.dailyMoods[0]?.responseRefs.includes("evt_persona_daily_mood_response"), true);
  assert.match(continuity.dailyMoods[0]?.boundaryNote ?? "", /not a fixed role/);
  const roundTrippedArchive = ArchiveStore.fromEvents([
    event("evt_archive_roundtrip", "daily_archive.created", {
      archive,
    }),
  ]).view().archives[0];
  assert.equal(roundTrippedArchive?.agentContinuity[0]?.roleClaims[0]?.deltaId, "persona_delta_role_archive");
  assert.equal(roundTrippedArchive?.agentContinuity[0]?.dailyMoods[0]?.sourceRef, "msg_daily_mood_source");
  assert.equal(archive.sideEffectBoundaries.length, 3);
  assert.ok(
    archive.sideEffectBoundaries.some(
      (boundary) =>
        boundary.requestId === "sidefx_archive" &&
        boundary.status === "requested" &&
        boundary.sourcePressureRefs.includes("mixed_review:archive_side_effect_pressure") &&
        boundary.sourceRefs.includes("mixed_review:archive_side_effect_pressure") &&
        boundary.boundaryNote.includes("does not execute"),
    ),
  );
  assert.ok(
    archive.sideEffectBoundaries.some(
      (boundary) =>
        boundary.requestId === "sidefx_archive" &&
        boundary.status === "denied" &&
        boundary.decisionReason === "Keep this test in the room ledger only.",
    ),
  );
  assert.ok(
    archive.sideEffectBoundaries.some(
      (boundary) =>
        boundary.requestId === "sidefx_archive" &&
        boundary.status === "reviewed" &&
        boundary.reason === "This side-effect request should stay denied unless the target is narrowed." &&
        boundary.boundaryNote.includes("does not approve"),
    ),
  );
  assert.equal(archive.workspaceArtifacts.length, 2);
  assert.ok(
    archive.workspaceArtifacts.some(
      (artifact) =>
        artifact.artifactId === "artifact_archive_note" &&
        artifact.status === "shared" &&
        artifact.sourcePressureRefs.includes("mixed_review:archive_workspace_artifact_pressure") &&
        artifact.sourceRefs.includes("mixed_review:archive_workspace_artifact_pressure") &&
        /not copied into memory/.test(artifact.boundaryNote),
    ),
  );
  assert.ok(
    archive.workspaceArtifacts.some(
      (artifact) =>
        artifact.artifactId === "artifact_archive_note" &&
        artifact.status === "reviewed" &&
        artifact.reviewId === "workspace_artifact_review_archive" &&
        artifact.response === "cautioned" &&
        artifact.sourcePressureRefs.includes("mixed_review:archive_workspace_artifact_pressure") &&
        artifact.boundaryNote.includes("does not copy private workspace contents"),
    ),
  );
  assert.equal(archive.workspaceBoundaries.length, 1);
  assert.equal(archive.workspaceBoundaries[0]?.workspaceId, "workspace_mimo_member_02");
  assert.equal(archive.workspaceBoundaries[0]?.scratchPath, "agents/mimo_member_02/workspace/");
  assert.equal("privateHome" in (archive.workspaceBoundaries[0] as object), false);
  assert.match(archive.workspaceBoundaries[0]?.boundaryNote ?? "", /private files do not enter public memory/);
  assert.equal(archive.skillCapsules.length, 2);
  assert.ok(
    archive.skillCapsules.some(
      (capsule) =>
        capsule.capsuleId === "skill_archive_writer" &&
        capsule.status === "registered" &&
        capsule.approvalRequired === true &&
        capsule.sideEffectKinds.includes("filesystem.write") &&
        capsule.boundaryNote.includes("cannot execute"),
    ),
  );
  assert.ok(
    archive.skillCapsules.some(
      (capsule) =>
        capsule.capsuleId === "skill_archive_writer" &&
        capsule.status === "reviewed" &&
        capsule.reviewId === "skill_capsule_review_archive" &&
        capsule.response === "cautioned" &&
        capsule.sourcePressureRefs.includes("mixed_review:archive_skill_capsule_pressure") &&
        capsule.sourceRefs.includes("mixed_review:archive_skill_capsule_pressure") &&
        capsule.boundaryNote.includes("does not register a skill"),
    ),
  );
  assert.equal(archive.capabilityReviews.length, 1);
  assert.equal(archive.capabilityReviews[0]?.capabilityRef, "capability_archive_hint");
  assert.equal(archive.capabilityReviews[0]?.reviewId, "capability_review_archive");
  assert.equal(archive.capabilityReviews[0]?.response, "cautioned");
  assert.match(archive.capabilityReviews[0]?.summary ?? "", /weak routing clues/);
  assert.deepEqual(archive.capabilityReviews[0]?.sourcePressureRefs, ["mixed_review:archive_capability_pressure"]);
  assert.equal(archive.capabilityReviews[0]?.sourceRefs.includes("mixed_review:archive_capability_pressure"), true);
  assert.match(archive.capabilityReviews[0]?.boundaryNote ?? "", /does not change wake score/);
  assert.equal(archive.pressureBoundaries.length, 1);
  assert.equal(archive.pressureBoundaries[0]?.reason, "background_turn_concurrency_limit");
  assert.equal(archive.pressureBoundaries[0]?.queuedBackgroundTurns, 2);
  assert.match(archive.pressureBoundaries[0]?.boundaryNote ?? "", /wake is delayed/);
  assert.equal(archive.providerBoundaries.length, 2);
  assert.ok(
    archive.providerBoundaries.every(
      (boundary) =>
        boundary.agentId === "kimi_member_01" &&
        boundary.providerKind === "kimi_code_api" &&
        boundary.boundaryNote === "provider degradation is not agent silence" &&
        /masked/.test(boundary.diagnostic ?? ""),
    ),
  );
  assert.equal(archive.memoryPressureBoundaries.length, 1);
  assert.equal(archive.memoryPressureBoundaries[0]?.reason, "pending_memory_proposal_limit");
  assert.equal(archive.memoryPressureBoundaries[0]?.pendingProposalCount, 4);
  assert.deepEqual(archive.memoryPressureBoundaries[0]?.proposedMemoryRefs, [
    "memory_pressure_0",
    "memory_pressure_1",
    "memory_pressure_2",
    "memory_pressure_3",
  ]);
  assert.match(archive.memoryPressureBoundaries[0]?.boundaryNote ?? "", /review, contest, accept/);
});

test("daily archive context fragment carries a compressed time skeleton from nested archive payload", () => {
  const events: RoomEvent[] = [
    event("evt_archive_context_topic", "topic.created", {
      topicId,
      title: "Archive context skeleton",
      createdFromMessageId: "msg_archive_context_anchor",
    }),
    event("evt_archive_context_anchor", "message.created", {
      messageId: "msg_archive_context_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Keep boundaries visible without turning them into truth.",
    }),
    event("evt_archive_context_question", "topic.updated", {
      topicId,
      openQuestion: "Which unresolved question should survive this archive?",
      openQuestionRef: "question_archive_context",
      raisedBy: "mimo_member_01",
      sourceMessageId: "msg_archive_context_anchor",
      boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer",
    }),
    event("evt_archive_context_memory_contested", "memory.contested", {
      memoryId: "memory_archive_context",
      topicId,
      reason: "Archive summaries can accidentally sound like consensus.",
      evidenceRefs: ["msg_archive_context_anchor"],
    }),
    event("evt_archive_context_pressure", "room.pressure_detected", {
      reason: "background_turn_concurrency_limit",
      messageEventId: "evt_pressure_message",
      messageId: "msg_pressure",
      topicId,
      activeBackgroundTurns: 1,
      queuedBackgroundTurns: 2,
      maxConcurrentBackgroundTurns: 1,
      boundaryNote: "Message expression is preserved in the ledger; agent wake is delayed to keep the room inhabitable.",
    }),
    event("evt_archive_context_handoff", "handoff.proposed", {
      handoffId: "handoff_archive_context",
      topicId,
      fromAgentId: "mimo_member_01",
      toAgentId: "mimo_member_02",
      reason: "Daily archive should carry social transfer.",
      requestedResponse: "Name the weakest handoff assumption.",
      contextRefs: ["msg_archive_context_anchor"],
      status: "proposed",
    }),
    event("evt_archive_context_handoff_response", "handoff.responded", {
      handoffRef: "handoff_archive_context",
      topicId,
      byAgentId: "mimo_member_02",
      response: "rejected",
      reason: "The handoff packet is too broad.",
      contextRefs: ["handoff_archive_context"],
    }),
    event("evt_archive_context_protocol", "protocol.proposed", {
      protocolId: "protocol_archive_context",
      topicId,
      proposedBy: "mimo_member_03",
      summary: "Name whether a claim is observed or inferred before accepting it.",
      scope: "current_topic",
      reason: "The archive should remember temporary social rules as temporary.",
      contextRefs: ["msg_archive_context_anchor"],
      status: "proposed",
      boundaryNote: "protocol is temporary room etiquette, not permanent control flow",
    }),
    event("evt_archive_context_protocol_response", "protocol.responded", {
      protocolRef: "protocol_archive_context",
      topicId,
      agentId: "mimo_member_04",
      response: "accept",
      reason: "This keeps communication clear without assigning responsibility.",
      contextRefs: ["protocol_archive_context"],
    }),
    event("evt_archive_context_review_message", "message.created", {
      messageId: "msg_archive_context_review",
      topicId,
      author: "mimo_member_05",
      authorKind: "agent",
      mentions: [],
      contextRefs: ["protocol_archive_context", "handoff_archive_context", "question_archive_context"],
      content: "These objects should remain review pressure, not settled room order.",
    }),
    event("evt_archive_context_protocol_review", "protocol.reviewed", {
      reviewId: "protocol_review_archive_context",
      protocolRef: "protocol_archive_context",
      topicId,
      agentId: "mimo_member_05",
      response: "cautioned",
      summary: "The protocol is useful but should remain temporary.",
      sourceMessageId: "msg_archive_context_review",
      contextRefs: ["protocol_archive_context"],
      boundaryNote: "protocol review is a social trace; it does not activate etiquette",
    }),
    event("evt_archive_context_handoff_review", "handoff.reviewed", {
      reviewId: "handoff_review_archive_context",
      handoffRef: "handoff_archive_context",
      topicId,
      agentId: "mimo_member_05",
      response: "questioned",
      summary: "The handoff should stay contestable.",
      sourceMessageId: "msg_archive_context_review",
      contextRefs: ["handoff_archive_context"],
      boundaryNote: "handoff review is a social trace; it does not transfer control",
    }),
    event("evt_archive_context_question_response", "open_question.responded", {
      responseId: "question_response_archive_context",
      questionRef: "question_archive_context",
      topicId,
      agentId: "mimo_member_05",
      response: "deferred",
      summary: "The question should survive into tomorrow.",
      sourceMessageId: "msg_archive_context_review",
      contextRefs: ["question_archive_context"],
      boundaryNote: "open question response is a social trace; it does not close the question",
    }),
    event(
      "evt_archive_context_invitation",
      "agent.invited",
      {
        invitationId: "invite_archive_context",
        agentId: "mimo_member_06",
        topicId,
        messageEventId: "msg_archive_context_anchor",
        invitedBy: "agent_intention",
        reason: "A truth-calibrating room member may help keep uncertainty visible.",
        contextRefs: ["msg_archive_context_anchor", "protocol_archive_context"],
        boundaryNote: "invitation is a social knock, not a speaking command",
      },
      { kind: "agent", id: "mimo_member_03" },
    ),
    event(
      "evt_archive_context_silence",
      "agent.intention_recorded",
      {
        invitationId: "invite_archive_context",
        packetId: "packet_archive_context_silence",
        agentId: "mimo_member_06",
        topicId,
        triggeringEventId: "evt_archive_context_invitation",
        intention: {
          kind: "stay_silent",
          reason: "The archive context already carries enough caution.",
        },
      },
      { kind: "agent", id: "mimo_member_06" },
    ),
    event("evt_archive_context_provider", "agent.provider_degraded", {
      agentId: "kimi_member_01",
      topicId,
      triggeringEventId: "evt_provider_message",
      packetId: "packet_provider_degraded",
      providerKind: "kimi_code_api",
      providerLabel: "Kimiplan Agent API",
      diagnostic: "Kimiplan Agent API failed: [masked]",
      boundaryNote: "provider degradation is not agent silence",
    }),
    event("evt_archive_context_workspace", "workspace.provisioned", {
      workspaceId: "workspace_archive_context",
      agentId: "mimo_member_06",
      privateHome: "agents/mimo_member_06/",
      scratchPath: "agents/mimo_member_06/workspace/",
      visibility: "private",
      retentionPolicy: "keep_until_archived_or_retired",
      publicContributionPolicy: "explicit_message_proposal_artifact_or_memory_delta",
      boundaryNote: "private workspace metadata only; private files do not enter public memory automatically",
    }),
    event("evt_archive_context_skill", "skill.capsule_registered", {
      capsuleId: "skill_archive_context",
      agentId: "mimo_member_06",
      label: "archive context capsule",
      triggerHints: ["private draft"],
      sideEffectKinds: ["filesystem.write"],
      approvalRequired: true,
      status: "registered",
      boundaryNote:
        "skill capsule is a possible action organ; it cannot execute or publish without an explicit room event and required approvals",
    }),
    event("evt_archive_context_capability_review", "capability.reviewed", {
      reviewId: "capability_review_archive_context",
      capabilityRef: "capability_archive_context",
      topicId,
      agentId: "mimo_member_05",
      response: "cautioned",
      summary: "Keep this capability hint weak and contestable.",
      sourceMessageId: "msg_archive_context_review",
      contextRefs: ["capability_archive_context"],
      boundaryNote:
        "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech",
    }),
    event("evt_archive_context_memory_pressure", "room.memory_pressure_detected", {
      reason: "pending_memory_proposal_limit",
      topicId,
      triggeringMemoryId: "memory_archive_context",
      pendingProposalCount: 4,
      threshold: 4,
      proposedMemoryRefs: [
        "memory_archive_context_0",
        "memory_archive_context_1",
        "memory_archive_context_2",
        "memory_archive_context_3",
      ],
      boundaryNote:
        "Public memory has too many pending proposals. The room should review, contest, accept, mark stale, or retire claims before adding more sediment.",
    }),
  ];
  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-17",
    timezone: "Asia/Shanghai",
    summary: "The room recorded memory disagreement plus pressure and provider boundaries as bounded context.",
  });
  assert.equal(archive.messageHighlights.some((item) => item.summary.includes("Keep boundaries visible")), true);
  assert.equal(
    archive.messageHighlights.some((item) => item.summary.includes("These objects should remain review pressure")),
    true,
  );
  const archiveEvent: RoomEvent = {
    ...event("evt_archive_context_committed", "daily_archive.created", {
      archive,
    }),
    refs: Array.from({ length: 30 }, (_, index) => `archive_source_ref_${index}`),
  };
  const store = TopicWindowStore.fromEvents(
    events.concat(archiveEvent),
  );
  const window = store.getTopic(topicId);
  assert.ok(window);
  assert.deepEqual(window.archiveRefs, [archive.archiveId]);

  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_archive_context_anchor",
    recipientAgent: "mimo_member_01",
    maxRefs: 20,
    maxTokens: 10_000,
  });
  const archiveFragment = packet.fragments.find((fragment) => fragment.type === "daily_archive_ref");
  assert.ok(archiveFragment);
  const body = JSON.parse(archiveFragment.body) as {
    refId: string;
    note: string;
    archive?: Record<string, unknown>;
    sourceRefs: string[];
    sourceRefCount: number;
    omittedSourceRefCount: number;
    states: Record<string, unknown>;
  };
  assert.equal(body.refId, archive.archiveId);
  assert.match(body.note, /compressed time skeleton/);
  assert.equal(body.states.archiveSummary, archive.summary);
  assert.equal(body.archive?.archiveReadableSkeleton, body.states.archiveReadableSkeleton);
  assert.match(String(body.states.archiveReadableSkeleton), /compressed daily time skeleton, not consensus/);
  assert.match(String(body.states.archiveReadableSkeleton), /Summary: The room recorded memory disagreement/);
  assert.match(String(body.states.archiveReadableSkeleton), /Message highlights: .*Keep boundaries visible/);
  assert.match(String(body.states.archiveReadableSkeleton), /Message highlights: .*These objects should remain review pressure/);
  assert.match(String(body.states.archiveReadableSkeleton), /Disagreements: .*Archive summaries can accidentally sound like consensus/);
  assert.match(String(body.states.archiveReadableSkeleton), /Open questions: Which unresolved question should survive this archive/);
  assert.match(String(body.states.archiveReadableSkeleton), /Handoffs: handoff_archive_context/);
  assert.match(String(body.states.archiveReadableSkeleton), /Protocols: protocol_archive_context/);
  assert.match(String(body.states.archiveReadableSkeleton), /Provider boundaries: kimi_member_01/);
  assert.match(String(body.states.archiveReadableSkeleton), /Review traces: .*handoff review on handoff_archive_context/);
  const readableSections = body.states.archiveReviewableSections as string[];
  for (const expectedSection of [
    "Message highlights",
    "Disagreements",
    "Open questions",
    "Memory changes",
    "Review traces",
    "Handoffs",
    "Protocols",
    "Invitations",
    "Deliberate silences",
    "Pressure boundaries",
    "Workspace boundaries",
    "Skill capsules",
    "Capability reviews",
    "Provider boundaries",
    "Memory pressure",
  ]) {
    assert.equal(readableSections.includes(expectedSection), true, `missing readable section ${expectedSection}`);
  }
  assert.equal(body.states.archiveCompressionNote, "archive_is_compression_not_consensus");
  assert.equal(body.states.archiveEventCount, events.length);
  assert.equal(body.states.archiveMessageHighlightCount, archive.messageHighlights.length);
  assert.equal(body.states.archiveDisagreementCount, 1);
  assert.equal(body.states.archiveOpenQuestionCount, 1);
  assert.equal(body.states.archiveOpenQuestionTraceCount, 1);
  assert.equal(body.states.archiveMemoryChangeCount, 1);
  assert.equal(body.states.archivePressureBoundaryCount, 1);
  assert.equal(body.states.archiveHandoffCount, 1);
  assert.equal(body.states.archiveProtocolCount, 1);
  assert.equal(body.states.archiveInvitationCount, 1);
  assert.equal(body.states.archiveSilenceCount, 1);
  assert.equal(body.states.archiveProviderBoundaryCount, 1);
  assert.equal(body.states.archiveWorkspaceBoundaryCount, 1);
  assert.equal(body.states.archiveSkillCapsuleCount, 1);
  assert.equal(body.states.archiveCapabilityReviewCount, 1);
  assert.equal(body.states.archiveMemoryPressureBoundaryCount, 1);
  assert.equal(body.states.archiveReviewTraceCount, 3);
  assert.deepEqual(body.states.archiveReviewTraceTypes, ["handoff", "open_question", "protocol"]);
  assert.deepEqual(body.states.archiveReviewSubjectRefs, [
    "handoff_archive_context",
    "protocol_archive_context",
    "question_archive_context",
  ]);
  assert.deepEqual(body.states.archiveReviewEventRefs, [
    "evt_archive_context_handoff_review",
    "evt_archive_context_protocol_review",
    "evt_archive_context_question_response",
  ]);
  assert.match(String(body.states.archiveReviewBoundaryNote), /review traces/);
  assert.equal(body.sourceRefs.length, 24);
  assert.equal(body.sourceRefCount, 30);
  assert.equal(body.omittedSourceRefCount, 6);
});

test("archive review request context remains a daily rhythm invitation", () => {
  const events: RoomEvent[] = [
    event("evt_archive_request_topic", "topic.created", {
      topicId,
      title: "Archive review request boundary",
      createdFromMessageId: "msg_archive_request_anchor",
    }),
    event("evt_archive_request_anchor", "message.created", {
      messageId: "msg_archive_request_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Create a time skeleton without turning it into consensus.",
    }),
    event("evt_archive_request_archive", "daily_archive.created", {
      archiveId: "day_2026_06_21",
      date: "2026-06-21",
      topicIds: [topicId],
      summary: "The room kept one archive boundary open for review.",
    }),
    event("evt_archive_request_review", "archive.review_requested", {
      requestId: "archive_review_request_evt_archive_request_archive",
      archiveRef: "day_2026_06_21",
      date: "2026-06-21",
      requestedBy: "archive_worker",
      summary: "Review daily archive day_2026_06_21 as a time skeleton, not consensus.",
      reason: "Daily rhythm invites critique without forcing anyone to speak.",
      status: "open",
      contextRefs: ["day_2026_06_21", "evt_archive_request_archive"],
      boundaryNote:
        "daily archive review request is a room rhythm invitation, not a command to speak, accept, or repair the archive",
    }),
    event("evt_archive_request_trigger", "message.created", {
      messageId: "msg_archive_request_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: ["archive_review_request_evt_archive_request_archive"],
      content: "Carry the archive review request without making it a task.",
    }),
  ];

  const packet = new ContextPacketBuilder(TopicWindowStore.fromEvents(events)).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_archive_request_trigger",
    recipientAgent: "kimi_member_01",
    maxRefs: 10,
    maxTokens: 10_000,
    relevantRefs: ["archive_review_request_evt_archive_request_archive"],
  });
  const body = JSON.parse(
    packet.fragments.find(
      (fragment) =>
        fragment.type === "daily_archive_ref" &&
        fragment.refs.includes("archive_review_request_evt_archive_request_archive"),
    )?.body ?? "{}",
  ) as {
    note?: string;
    states?: Record<string, unknown>;
    tags?: string[];
  };

  assert.equal(packet.refs.archives.includes("archive_review_request_evt_archive_request_archive"), true);
  assert.equal(body.tags?.includes("archive_review_request"), true);
  assert.match(body.note ?? "", /daily rhythm invitation/);
  assert.match(body.note ?? "", /not a command to speak/);
  assert.equal(body.states?.archiveRef, "day_2026_06_21");
  assert.equal(body.states?.archiveRepairStatus, "open");
});

test("archive repair proposal refs expand into typed archive context fragments", () => {
  const events: RoomEvent[] = [
    event("evt_archive_repair_topic", "topic.created", {
      topicId,
      title: "Archive repair context",
      createdFromMessageId: "msg_archive_repair_anchor",
    }),
    event("evt_archive_repair_anchor", "message.created", {
      messageId: "msg_archive_repair_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Archive repair proposals should be inspectable typed context.",
    }),
    event("evt_archive_repair_daily", "daily_archive.created", {
      archiveId: "day_archive_repair_ctx",
      date: "2026-06-19",
      topicIds: [topicId],
      summary: "A compressed archive that remains contestable.",
    }),
    event("evt_archive_repair_proposed", "archive.repair_proposed", {
      repairId: "archive_repair_ctx",
      archiveRef: "day_archive_repair_ctx",
      topicId,
      proposedBy: "mimo_member_03",
      summary: "Add a caveat about compression.",
      reason: "The archive could be mistaken for settled truth.",
      proposedRepair: "State that the archive is a time skeleton, not consensus.",
      status: "proposed",
      contextRefs: ["day_archive_repair_ctx"],
      boundaryNote: "archive repair proposal does not rewrite the archive until later room action accepts it",
    }),
    event("evt_archive_repair_reviewed", "archive.repair_reviewed", {
      reviewId: "archive_repair_review_ctx",
      repairRef: "archive_repair_ctx",
      topicId,
      agentId: "mimo_member_04",
      response: "cautioned",
      summary: "This repair needs one more evidence ref before acceptance.",
      sourceMessageId: "msg_archive_repair_review_source",
      contextRefs: ["archive_repair_ctx"],
      boundaryNote:
        "archive repair review is a social trace; it does not accept, reject, challenge, revise, retire, apply, or mutate the archive",
    }),
    event("evt_archive_repair_trigger", "message.created", {
      messageId: "msg_archive_repair_trigger",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: ["kimi_member_01"],
      contextRefs: ["archive_repair_ctx", "archive_repair_review_ctx"],
      content: "Please respond to this repair proposal.",
    }),
  ];
  const store = TopicWindowStore.fromEvents(events);
  const window = store.getTopic(topicId);
  assert.ok(window);
  assert.equal(window.archiveRefs.includes("archive_repair_ctx"), true);
  assert.equal(window.archiveRefs.includes("archive_repair_review_ctx"), true);

  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_archive_repair_trigger",
    recipientAgent: "kimi_member_01",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: ["archive_repair_ctx", "archive_repair_review_ctx"],
  });
  const repairFragment = packet.fragments.find(
    (fragment) => fragment.type === "daily_archive_ref" && fragment.refs.includes("archive_repair_ctx"),
  );
  assert.ok(repairFragment);
  const body = JSON.parse(repairFragment.body) as { note: string; states: Record<string, unknown>; sourceRefs: string[] };
  assert.match(body.note, /Archive repair proposal is a contestable suggestion/);
  assert.equal(body.states.archiveRef, "day_archive_repair_ctx");
  assert.equal(body.states.archiveRepairSummary, "Add a caveat about compression.");
  assert.equal(body.states.archiveRepairReason, "The archive could be mistaken for settled truth.");
  assert.equal(body.states.archiveRepairProposedRepair, "State that the archive is a time skeleton, not consensus.");
  assert.match(String(body.states.archiveBoundaryNote), /does not rewrite/);
  assert.deepEqual(body.sourceRefs, ["day_archive_repair_ctx"]);
  const reviewFragment = packet.fragments.find(
    (fragment) => fragment.type === "daily_archive_ref" && fragment.refs.includes("archive_repair_review_ctx"),
  );
  assert.ok(reviewFragment);
  const reviewBody = JSON.parse(reviewFragment.body) as { note: string; states: Record<string, unknown> };
  assert.match(reviewBody.note, /Archive repair review is discussion pressure/);
  assert.equal(reviewBody.states.archiveRef, "archive_repair_ctx");
  assert.equal(reviewBody.states.archiveRepairReviewResponse, "cautioned");
  assert.equal(reviewBody.states.archiveRepairReviewSummary, "This repair needs one more evidence ref before acceptance.");
  assert.match(String(reviewBody.states.archiveBoundaryNote), /does not accept/);
});

test("archive repair applications become revision context without mutating the source archive", () => {
  const events: RoomEvent[] = [
    event("evt_archive_apply_topic", "topic.created", {
      topicId,
      title: "Archive repair application",
      createdFromMessageId: "msg_archive_apply_anchor",
    }),
    event("evt_archive_apply_anchor", "message.created", {
      messageId: "msg_archive_apply_anchor",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Archive repair applications should preserve provenance.",
    }),
  ];
  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-19",
    timezone: "Asia/Shanghai",
    archiveId: "day_archive_apply_ctx",
    summary: "Original archive skeleton.",
  });
  const revision = {
    ...archive,
    archiveId: "day_archive_apply_ctx_rev_01",
    revisionOf: archive.archiveId,
    appliedRepairRef: "archive_repair_apply_ctx",
    revisionReason: "Accepted repair was explicitly applied.",
    provenanceRefs: ["day_archive_apply_ctx", "archive_repair_apply_ctx", "evt_archive_repair_accept_ctx"],
    summary: "Original archive skeleton.\nRevision from archive_repair_apply_ctx: keep provenance visible.",
  };
  const store = TopicWindowStore.fromEvents(
    events.concat(
      event("evt_archive_apply_daily", "daily_archive.created", { archive }),
      event("evt_archive_repair_apply_proposed", "archive.repair_proposed", {
        repairId: "archive_repair_apply_ctx",
        archiveRef: archive.archiveId,
        topicId,
        summary: "Add provenance caveat.",
        reason: "The archive could be mistaken for mutation.",
        proposedRepair: "keep provenance visible",
        contextRefs: [archive.archiveId],
      }),
      event("evt_archive_repair_accept_ctx", "archive.repair_responded", {
        responseId: "archive_repair_response_apply_ctx",
        repairRef: "archive_repair_apply_ctx",
        topicId,
        agentId: "kimi_member_01",
        response: "accept",
        status: "accepted",
        reason: "The caveat protects archive contestability.",
        contextRefs: ["archive_repair_apply_ctx"],
      }),
      event("evt_archive_repair_applied_ctx", "archive.repair_applied", {
        applicationId: "archive_repair_apply_archive_repair_apply_ctx",
        repairRef: "archive_repair_apply_ctx",
        archiveRef: archive.archiveId,
        revisedArchiveRef: revision.archiveId,
        appliedBy: "archive_worker",
        reason: "Accepted repair was explicitly applied.",
        proposedRepair: "keep provenance visible",
        acceptedResponseRefs: ["evt_archive_repair_accept_ctx"],
        contextRefs: ["day_archive_apply_ctx", "archive_repair_apply_ctx", "evt_archive_repair_accept_ctx"],
        status: "applied",
        boundaryNote: "explicit room action creates a new archive revision; the original archive remains unchanged",
      }),
      event("evt_archive_apply_revision", "daily_archive.created", { archive: revision }),
    ),
  );

  assert.equal(store.getTopic(topicId)?.archiveRefs.includes(revision.archiveId), true);
  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_archive_apply_anchor",
    recipientAgent: "mimo_member_01",
    maxRefs: 20,
    maxTokens: 10_000,
    relevantRefs: [revision.archiveId],
  });

  const revisionBody = JSON.parse(
    packet.fragments.find((fragment) => fragment.refs.includes(revision.archiveId))?.body ?? "{}",
  ) as { note?: string; states?: Record<string, unknown>; tags?: string[] };
  assert.match(revisionBody.note ?? "", /new archive revision|compressed time skeleton/);
  assert.equal(revisionBody.states?.archiveRevisionOf, archive.archiveId);
  assert.equal(revisionBody.states?.archiveAppliedRepairRef, "archive_repair_apply_ctx");
  assert.equal(revisionBody.tags?.includes("archive_repair_application"), true);
});

test("ambient daily archive refs carry time skeleton across new topic boundaries", () => {
  const sourceTopicId = "topic_archive_source";
  const nextTopicId = "topic_after_archive";
  const events: RoomEvent[] = [
    event("evt_archive_source_topic", "topic.created", {
      topicId: sourceTopicId,
      title: "Source topic",
      createdFromMessageId: "msg_archive_source",
    }),
    event("evt_archive_source_message", "message.created", {
      messageId: "msg_archive_source",
      topicId: sourceTopicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "This topic should be compressed into a time skeleton.",
    }),
  ];
  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-18",
    timezone: "Asia/Shanghai",
    summary: "The prior topic established a bounded daily skeleton.",
  });
  const archiveEvent = event("evt_archive_source_committed", "daily_archive.created", {
    archive,
  });
  const nextTopicEvents = [
    event("evt_after_archive_topic", "topic.created", {
      topicId: nextTopicId,
      title: "Fresh topic after archive",
      createdFromMessageId: "msg_after_archive",
    }),
    event("evt_after_archive_message", "message.created", {
      messageId: "msg_after_archive",
      topicId: nextTopicId,
      author: "user",
      authorKind: "user",
      mentions: ["mimo_member_01"],
      contextRefs: [],
      content: "This is a new topic, but it should still see the latest daily time skeleton.",
    }),
  ];
  const store = TopicWindowStore.fromEvents(events.concat(archiveEvent, nextTopicEvents));
  assert.deepEqual(store.getTopic(nextTopicId)?.archiveRefs, []);

  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId: nextTopicId,
    purpose: "wake",
    triggerRef: "msg_after_archive",
    recipientAgent: "mimo_member_01",
    maxRefs: 20,
    maxTokens: 10_000,
    ambientArchiveRefs: [archive.archiveId],
  });

  assert.equal(packet.refs.archives.includes(archive.archiveId), true);
  const body = JSON.parse(
    packet.fragments.find((fragment) => fragment.type === "daily_archive_ref")?.body ?? "{}",
  ) as { note?: string; states?: Record<string, unknown> };
  assert.match(body.note ?? "", /compressed time skeleton/);
  assert.equal(body.states?.archiveSummary, "The prior topic established a bounded daily skeleton.");
});

test("archive refs carried as topic anchors stay typed daily archive fragments", () => {
  const events: RoomEvent[] = [
    event("evt_archive_anchor_topic", "topic.created", {
      topicId,
      title: "Archive anchor context",
      createdFromMessageId: "msg_archive_anchor",
    }),
    event("evt_archive_anchor_source", "message.created", {
      messageId: "msg_archive_anchor_source",
      topicId,
      author: "agent",
      authorKind: "agent",
      mentions: [],
      contextRefs: [],
      content: "This day had a review trace that should remain archive context.",
    }),
  ];
  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-20",
    timezone: "Asia/Shanghai",
    archiveId: "day_archive_anchor_ctx",
    summary: "Archive anchor should stay typed.",
  });
  const store = TopicWindowStore.fromEvents(
    events.concat(
      event("evt_archive_anchor_committed", "daily_archive.created", { archive }),
      event("evt_archive_anchor_trigger", "message.created", {
        messageId: "msg_archive_anchor",
        topicId,
        author: "user",
        authorKind: "user",
        mentions: ["kimi_member_01"],
        contextRefs: [archive.archiveId],
        content: "Please carry this archive as archive context, not a generic anchor.",
      }),
    ),
  );

  const packet = new ContextPacketBuilder(store).build({
    roomId,
    topicId,
    purpose: "wake",
    triggerRef: "msg_archive_anchor",
    recipientAgent: "kimi_member_01",
    maxRefs: 20,
    maxTokens: 10_000,
  });

  assert.equal(packet.refs.archives.includes(archive.archiveId), true);
  assert.equal(packet.refs.anchors.includes(archive.archiveId), false);
  const archiveFragment = packet.fragments.find(
    (fragment) => fragment.type === "daily_archive_ref" && fragment.refs.includes(archive.archiveId),
  );
  assert.equal(archiveFragment?.type, "daily_archive_ref");
});

test("daily archive is built from the selected ledger range", () => {
  const events = [
    event("evt_before", "message.created", {
      messageId: "msg_before",
      topicId,
      author: "agent",
      authorKind: "agent",
      mentions: [],
      contextRefs: [],
      content: "This question is outside the archive range?",
    }),
    event("evt_inside_topic", "topic.created", {
      topicId,
      title: "Ranged archive",
      createdFromMessageId: "msg_inside",
    }),
    event("evt_inside_memory", "memory.proposed", {
      memoryId: "memory_inside",
      topicId,
      summary: "Inside the selected range.",
      sourceRefs: ["msg_inside"],
    }),
    event("evt_after", "memory.contested", {
      memoryId: "memory_after",
      topicId,
      reason: "This contest is outside the archive range.",
      evidenceRefs: ["msg_after"],
    }),
  ];

  const archive = new DailyArchiveBuilder().build(events, {
    roomId,
    date: "2026-06-17",
    fromOffset: 1,
    toOffset: 2,
  });

  assert.deepEqual(archive.inputLedgerRange, { fromOffset: 1, toOffset: 2 });
  assert.deepEqual(archive.eventCounts, {
    "topic.created": 1,
    "memory.proposed": 1,
  });
  assert.deepEqual(archive.contestedItems, []);
  assert.equal(archive.openQuestions.length, 0);
  assert.deepEqual(
    archive.memoryChanges.map((change) => change.memoryId),
    ["memory_inside"],
  );
});

test("topic, memory, and archive projections rebuild deterministically from the same ledger", () => {
  const archive = new DailyArchiveBuilder().build(sharedLedger(), {
    roomId,
    date: "2026-06-17",
    timezone: "Asia/Shanghai",
    createdAt: "2026-06-18T00:05:00+08:00",
  });
  const committedLedger = sharedLedger().concat(
    event("evt_archive_committed", "daily_archive.created", {
      archive,
    }),
  );

  assert.deepEqual(TopicWindowStore.fromEvents(committedLedger).view(), TopicWindowStore.fromEvents(committedLedger).view());
  assert.deepEqual(MemoryClaimStore.fromEvents(committedLedger).view(), MemoryClaimStore.fromEvents(committedLedger).view());

  const noArchiveStore = ArchiveStore.fromEvents(sharedLedger());
  assert.deepEqual(noArchiveStore.view().archives, []);

  const archiveStoreA = ArchiveStore.fromEvents(committedLedger);
  const archiveStoreB = ArchiveStore.fromEvents(committedLedger);
  assert.deepEqual(archiveStoreA.view(), archiveStoreB.view());
  assert.equal(archiveStoreA.view().archives[0]?.archiveId, archive.archiveId);
});

function sharedLedger(): RoomEvent[] {
  return [
    event("evt_topic_shared", "topic.created", {
      topicId,
      title: "Shared deterministic ledger",
      createdFromMessageId: "msg_shared",
    }),
    event("evt_msg_shared", "message.created", {
      messageId: "msg_shared",
      topicId,
      author: "user",
      authorKind: "user",
      mentions: [],
      contextRefs: [],
      content: "Can the room remember without pretending memory is truth?",
    }),
    event("evt_memory_shared_proposed", "memory.proposed", {
      memoryId: "memory_shared",
      topicId,
      summary: "Memory is provisional.",
      sourceRefs: ["msg_shared"],
    }),
    event("evt_memory_shared_accepted", "memory.accepted", {
      memoryId: "memory_shared",
      topicId,
      summary: "Memory is provisional.",
      evidenceRefs: ["msg_shared"],
    }),
    event("evt_memory_shared_contested", "memory.contested", {
      memoryId: "memory_shared",
      topicId,
      reason: "Provisional must remain visible in the wording.",
      evidenceRefs: ["msg_shared_contest"],
    }),
  ];
}

function flattenPacketRefs(refs: Record<string, RefId[]>): RefId[] {
  return Object.values(refs).flat();
}

function event<TPayload>(
  eventId: string,
  eventType: string,
  payload: TPayload,
  actor: EventActor = { kind: "system", id: "test" },
  correlationId = "corr_test",
  causationId: string | null = null,
): RoomEvent<TPayload> {
  return {
    event_id: eventId,
    room_id: roomId,
    event_type: eventType,
    schema_version: "1",
    payload_schema: eventType,
    occurred_at: "2026-06-17T12:00:00+08:00",
    appended_at: "2026-06-17T12:00:00+08:00",
    actor,
    causation_id: causationId,
    correlation_id: correlationId,
    idempotency_key: eventId,
    refs: [],
    payload,
    prev_event_id: null,
    prev_event_hash: null,
    event_hash: `hash_${eventId}`,
  };
}
