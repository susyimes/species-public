import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SideEffectApprovalError, SideEffectGate, InMemorySideEffectEventAppender } from "../src/actions/sideEffectGate";
import { RoomLedgerEventAppender } from "../src/kernel/ledgerAppender";
import { RoomLedger } from "../src/kernel/ledger";
import { CapabilityService, InMemoryPersonaEventAppender, PersonaService } from "../src/persona/persona";
import { HandoffService, InMemorySocialEventAppender, ProtocolService } from "../src/social/social";

const roomId = "room_species";
const topicId = "topic_living_room_design";

test("handoff rejection records social state without forcing a message", async () => {
  const appender = new InMemorySocialEventAppender();
  const handoffs = new HandoffService({
    appender,
    now: () => "2026-06-17T15:00:00.000Z",
  });

  const proposal = await handoffs.propose({
    roomId,
    topicId,
    fromAgent: "architect",
    toAgent: "critic",
    reason: "The design needs pressure testing.",
    requestedResponse: "Find the weakest assumption.",
    contextRefs: ["msg_182", "memory_007"],
  });

  const rejected = await handoffs.respond({
    handoffId: proposal.proposal.handoffId,
    agentId: "critic",
    response: "reject",
    reason: "I do not have enough context to do this responsibly.",
  });

  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.responses[0]?.createsForcedMessage, false);
  assert.equal(handoffs.getActiveForTopic(topicId).length, 0);
  assert.equal(appender.allEvents().some((event) => event.event_type === "message.created"), false);
});

test("social services can write through the canonical RoomLedger appender", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-ledger-appender-"));
  try {
    const ledger = new RoomLedger({ filePath: path.join(dir, "room-ledger.jsonl") });
    const handoffs = new HandoffService({
      appender: new RoomLedgerEventAppender(ledger),
      now: () => "2026-06-18T10:00:00.000Z",
    });

    await handoffs.propose({
      roomId,
      topicId,
      fromAgent: "architect",
      toAgent: "critic",
      reason: "The room needs a rejectable social transfer.",
      requestedResponse: "Challenge the weakest assumption.",
      contextRefs: ["msg_ledger"],
    });

    const events = await ledger.readAll();
    assert.equal(events.length, 1);
    assert.equal(events[0].event_type, "handoff.proposed");
    assert.equal(events[0].payload_schema, "handoff.proposed.v1");
    assert.deepEqual(events[0].refs, ["msg_ledger"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("topic-scoped protocol can become active and then expire", async () => {
  const appender = new InMemorySocialEventAppender();
  const protocols = new ProtocolService({
    appender,
    now: () => "2026-06-17T15:00:00.000Z",
  });

  const proposal = await protocols.propose({
    roomId,
    proposedBy: "moderator",
    topicId,
    kind: "critic_round",
    summary: "Run one critic pass before accepting design memory.",
    body: { maxCriticMessages: 2 },
    scope: { type: "topic", topicIds: [topicId] },
    expiresAt: "2026-06-17T16:00:00.000Z",
  });

  await protocols.respond({
    protocolId: proposal.proposal.protocolId,
    agentId: "critic",
    response: "accept",
    reason: "A scoped critic pass is useful here.",
  });

  const beforeExpiry = protocols.getEffectiveProtocols({
    roomId,
    topicId,
    at: "2026-06-17T15:30:00.000Z",
  });
  assert.equal(beforeExpiry.length, 1);
  assert.equal(beforeExpiry[0]?.contextRef, proposal.proposal.protocolId);
  assert.equal(beforeExpiry[0]?.hiddenSchedulerRule, false);

  const expired = await protocols.expire("2026-06-17T16:00:00.000Z");

  assert.equal(expired.length, 1);
  assert.equal(protocols.get(proposal.proposal.protocolId)?.status, "expired");
  assert.equal(
    protocols.getEffectiveProtocols({
      roomId,
      topicId,
      at: "2026-06-17T16:01:00.000Z",
    }).length,
    0,
  );
  assert.equal(appender.allEvents().some((event) => event.event_type === "protocol.expired"), true);
});

test("persona changes require proposed and responded ledger events", async () => {
  const appender = new InMemoryPersonaEventAppender();
  const personas = new PersonaService({
    appender,
    now: () => "2026-06-17T20:00:00.000Z",
  });

  await assert.rejects(
    () =>
      personas.respondToDelta({
        roomId,
        deltaId: "persona_delta_missing",
        agentId: "critic",
        response: "accept",
        reason: "There is no proposed delta.",
      }),
    /requires a proposed ledger event/,
  );

  const delta = await personas.proposeDelta({
    roomId,
    agentId: "critic",
    proposedBy: "critic",
    reason: "I interrupted synthesis too often yesterday.",
    proposedChange: {
      field: "habits",
      operation: "add",
      value: "During synthesis, speak only when I can name a concrete risk.",
    },
    evidenceRefs: ["msg_091", "archive_2026_06_17"],
  });

  assert.deepEqual((await personas.getProfile("critic")).habits, []);

  const projection = await personas.respondToDelta({
    roomId,
    deltaId: delta.deltaId,
    agentId: "moderator",
    response: "accept",
    reason: "The evidence is clear and the change is narrow.",
    evidenceRefs: ["archive_2026_06_17"],
  });

  assert.deepEqual(projection.profile.habits, [
    "During synthesis, speak only when I can name a concrete risk.",
  ]);
  assert.equal((await personas.getEvolutionLog("critic"))[0]?.status, "accepted");
  assert.deepEqual(
    appender.allEvents().map((event) => event.event_type),
    ["persona_delta.proposed", "persona_delta.responded"],
  );
});

test("emergent role claims are stateful persona deltas, not fixed profile fields", async () => {
  const appender = new InMemoryPersonaEventAppender();
  const personas = new PersonaService({
    appender,
    now: () => "2026-06-17T20:10:00.000Z",
  });

  const delta = await personas.proposeDelta({
    roomId,
    agentId: "member_07",
    proposedBy: "member_07",
    reason: "Several room-visible turns show this member often notices memory boundary pressure.",
    proposedChange: {
      field: "roleClaims",
      operation: "add",
      value: "memory boundary pressure-noticer",
    },
    evidenceRefs: ["msg_201", "msg_233"],
  });

  assert.deepEqual((await personas.getProfile("member_07")).roleClaims, [
    {
      roleClaimId: `role_claim_${delta.deltaId}`,
      label: "memory boundary pressure-noticer",
      status: "proposed",
      proposedBy: "member_07",
      evidenceRefs: ["msg_201", "msg_233"],
      responseRefs: [],
      contestRefs: [],
      sourceDeltaId: delta.deltaId,
      createdAt: "2026-06-17T20:10:00.000Z",
      updatedAt: "2026-06-17T20:10:00.000Z",
    },
  ]);

  const projection = await personas.respondToDelta({
    roomId,
    deltaId: delta.deltaId,
    agentId: "member_11",
    response: "contest",
    reason: "The evidence may reflect one topic, not a durable role claim.",
    evidenceRefs: ["msg_240"],
  });

  assert.equal(projection.profile.roleClaims[0]?.status, "contested");
  assert.deepEqual(projection.profile.roleClaims[0]?.contestRefs, ["msg_240"]);
  assert.equal(projection.profile.roleClaims[0]?.responseRefs.includes("msg_240"), true);
  assert.equal(
    projection.profile.roleClaims[0]?.responseRefs.some((ref) => ref.startsWith("persona_delta_response_")),
    true,
  );
});

test("capability wake signal is advisory and cannot force a speaker", async () => {
  const appender = new InMemoryPersonaEventAppender();
  const capabilities = new CapabilityService({ appender });

  await capabilities.upsertCard({
    roomId,
    agentId: "critic",
    capabilityType: "design_review",
    domainTags: ["architecture", "failure_modes"],
    inputPreferences: ["compact_context_refs"],
    latency: "medium",
    sideEffectProfile: "none",
    declaredConfidence: 0.8,
  });

  const signals = await capabilities.buildWakeSignals({
    roomId,
    topicTags: ["architecture"],
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.authority, "advisory");
  assert.equal(signals[0]?.mustSpeak, false);
  assert.ok(signals[0]?.score !== undefined && signals[0].score < 0.2);
  assert.match(signals[0]?.reason ?? "", /does not assign responsibility/);
  assert.equal(appender.allEvents().some((event) => event.event_type === "message.created"), false);
});

test("side effects are blocked when approval is missing, pending, expired, or out of scope", async () => {
  const gate = new SideEffectGate({
    now: () => "2026-06-17T21:00:00.000Z",
  });

  await assert.rejects(
    () =>
      gate.assertAllowed({
        agentId: "implementer",
        kind: "filesystem.write",
        target: "agents/implementer/workspace/design.md",
      }),
    (error) => error instanceof SideEffectApprovalError && error.code === "missing_approval",
  );

  const request = await gate.request({
    roomId,
    requestedBy: "implementer",
    topicId,
    kind: "filesystem.write",
    target: "agents/implementer/workspace/design.md",
    reason: "Draft an implementation sketch for room review.",
    expectedImpact: "Create one private workspace file.",
    contextRefs: ["msg_201"],
    scope: {
      kinds: ["filesystem.write"],
      targetPrefixes: ["agents/implementer/workspace/"],
      allowedAgents: ["implementer"],
      expiresAt: "2026-06-17T22:00:00.000Z",
    },
  });

  await assert.rejects(
    () =>
      gate.assertAllowed({
        approvalId: request.approvalId,
        agentId: "implementer",
        kind: "filesystem.write",
        target: "agents/implementer/workspace/design.md",
      }),
    (error) => error instanceof SideEffectApprovalError && error.code === "not_approved",
  );

  await gate.approve({
    approvalId: request.approvalId,
    decidedBy: "user",
    reason: "The scope is narrow and private.",
  });

  await assert.rejects(
    () =>
      gate.assertAllowed({
        approvalId: request.approvalId,
        agentId: "implementer",
        kind: "filesystem.write",
        target: "agents/implementer/workspace/design.md",
        at: "2026-06-17T22:00:01.000Z",
      }),
    (error) => error instanceof SideEffectApprovalError && error.code === "expired_approval",
  );

  await assert.rejects(
    () =>
      gate.assertAllowed({
        approvalId: request.approvalId,
        agentId: "implementer",
        kind: "network.request",
        target: "agents/implementer/workspace/design.md",
        at: "2026-06-17T21:30:00.000Z",
      }),
    (error) => error instanceof SideEffectApprovalError && error.code === "kind_out_of_scope",
  );

  await assert.rejects(
    () =>
      gate.assertAllowed({
        approvalId: request.approvalId,
        agentId: "implementer",
        kind: "filesystem.write",
        target: "agents/other/workspace/design.md",
        at: "2026-06-17T21:30:00.000Z",
      }),
    (error) => error instanceof SideEffectApprovalError && error.code === "target_out_of_scope",
  );
});

test("side-effect approvals can expire as room-visible permission retirement", async () => {
  const appender = new InMemorySideEffectEventAppender();
  const gate = new SideEffectGate({
    appender,
    now: () => "2026-06-17T21:00:00.000Z",
  });

  const request = await gate.request({
    roomId,
    requestedBy: "implementer",
    topicId,
    kind: "filesystem.write",
    target: "agents/implementer/workspace/design.md",
    reason: "Draft an implementation sketch for room review.",
    expectedImpact: "Create one private workspace file.",
    contextRefs: ["msg_201"],
    scope: {
      kinds: ["filesystem.write"],
      targetPrefixes: ["agents/implementer/workspace/"],
      allowedAgents: ["implementer"],
      expiresAt: "2026-06-17T22:00:00.000Z",
    },
  });

  await gate.approve({
    approvalId: request.approvalId,
    decidedBy: "user",
    reason: "The action is scoped and timeboxed.",
  });
  const expired = await gate.expire({
    approvalId: request.approvalId,
    decidedBy: "room_boundary",
    reason: "The timeboxed permission was not used and should leave current pressure.",
  });

  assert.equal(expired.status, "expired");
  assert.equal(expired.expiredBy, "room_boundary");
  assert.equal(gate.getApproval(request.approvalId)?.status, "expired");
  assert.equal(appender.allEvents().some((event) => event.event_type === "side_effect.result_reported"), false);

  await assert.rejects(
    () =>
      gate.assertAllowed({
        approvalId: request.approvalId,
        agentId: "implementer",
        kind: "filesystem.write",
        target: "agents/implementer/workspace/design.md",
        at: "2026-06-17T21:30:00.000Z",
      }),
    (error) => error instanceof SideEffectApprovalError && error.code === "not_approved",
  );
});

test("action result is linked to approval and returned as a room-visible record", async () => {
  const appender = new InMemorySideEffectEventAppender();
  const gate = new SideEffectGate({
    appender,
    now: () => "2026-06-17T21:00:00.000Z",
  });

  const request = await gate.request({
    roomId,
    requestedBy: "implementer",
    topicId,
    kind: "filesystem.write",
    target: "agents/implementer/workspace/design.md",
    reason: "Draft an implementation sketch for room review.",
    expectedImpact: "Create one private workspace file.",
    contextRefs: ["msg_201", "protocol_001"],
    scope: {
      kinds: ["filesystem.write"],
      targetPrefixes: ["agents/implementer/workspace/"],
      allowedAgents: ["implementer"],
      expiresAt: "2026-06-17T22:00:00.000Z",
    },
  });

  await gate.approve({
    approvalId: request.approvalId,
    decidedBy: "user",
    reason: "The action is scoped and timeboxed.",
  });

  const allowed = await gate.assertAllowed({
    approvalId: request.approvalId,
    agentId: "implementer",
    kind: "filesystem.write",
    target: "agents/implementer/workspace/design.md",
    at: "2026-06-17T21:30:00.000Z",
  });
  assert.equal(allowed.approvalId, request.approvalId);

  const result = await gate.recordResult({
    approvalId: request.approvalId,
    agentId: "implementer",
    actionKind: "filesystem.write",
    target: "agents/implementer/workspace/design.md",
    status: "completed",
    summary: "Created a workspace draft for room review.",
    artifactRefs: ["artifact_workspace_design_draft"],
    followUpProposalRefs: ["memory_proposal_014"],
    completedAt: "2026-06-17T21:42:00.000Z",
  });

  assert.equal(result.approvalId, request.approvalId);
  assert.equal(gate.getApproval(request.approvalId)?.status, "executed");

  const resultEvent = appender.allEvents().find((event) => event.event_type === "side_effect.result_reported");
  assert.ok(resultEvent);
  assert.equal((resultEvent.payload as { approvalId: string }).approvalId, request.approvalId);
});
