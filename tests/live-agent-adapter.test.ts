import assert from "node:assert/strict";
import test from "node:test";

import {
  LiveProviderAgentAdapter,
  buildKimiCodePrompt,
  buildProviderPrompt,
  createProviderBoundaryInvoker,
  createRuntimeAgentAdapters,
  invokeArkOpenAIProvider,
  providerResponseToIntention,
} from "../src/agents/live";
import type { ModelRoomBrief } from "../src/agents/modelRoomBrief";
import { seedAgents } from "../src/agents/seed";
import type { AgentContextPacket, ContextFragment, MessageCreatedPayload, RoomEvent } from "../src/types";

const packet: AgentContextPacket = {
  packetId: "packet_test",
  roomId: "room_species",
  invitationId: "invite_test",
  agentId: "kimi_member_01",
  topicId: "topic_test",
  triggeringEventId: "evt_trigger",
  topicSummary: "A bounded room turn.",
  messageRefs: ["msg_trigger", "msg_context"],
  proposalRefs: ["archive_day"],
  memoryRefs: ["memory_contested"],
  protocolRefs: ["protocol_active"],
  constraints: {
    sideEffectsRequireApproval: true,
    silenceIsValid: true,
    mayRejectHandoff: true,
  },
};

test("provider JSON is parsed into a bounded AgentIntention", () => {
  const intention = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_memory",
      summary: "The room should keep memory provisional.",
      reason: "The packet included contested public memory.",
      contextRefs: ["msg_trigger", "secret_ref", "memory_contested"],
    }),
    packet,
  );

  assert.deepEqual(intention, {
    kind: "propose_memory",
    summary: "The room should keep memory provisional.",
    reason: "The packet included contested public memory.",
    contextRefs: ["msg_trigger", "memory_contested"],
  });
});

test("provider RoomProposalEnvelope reply maps to legacy speak intention", () => {
  const intention = providerResponseToIntention(
    JSON.stringify({
      reply: {
        content: "我先从可见消息接一句，不把 packet 当开场白。",
        refs: ["msg_trigger", "secret_ref"],
      },
      rationale: "The visible room surface is enough for a short reply.",
    }),
    packet,
  );

  assert.deepEqual(intention, {
    kind: "speak",
    content: "我先从可见消息接一句，不把 packet 当开场白。",
    contextRefs: ["msg_trigger"],
  });
});

test("provider loose natural-language JSON is treated as ordinary speech", () => {
  const missingKind = providerResponseToIntention(
    JSON.stringify({
      answer: "我接上一句，先问一个小问题，不开新流程。",
      refs: ["msg_trigger", "secret_ref"],
    }),
    packet,
  );
  const plainText = providerResponseToIntention("我直接接话，不再自我介绍。", packet);
  const intentAlias = providerResponseToIntention(
    JSON.stringify({
      intent: "speak",
      utterance: "@glm-5.2 我接你的问题，先给一个轻量回应。",
      refs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const nestedOutput = providerResponseToIntention(
    JSON.stringify({
      output: { message: "我也可以接住上一句，不需要另开流程。" },
      refs: ["msg_context"],
    }),
    packet,
  );
  const actionAlias = providerResponseToIntention(
    JSON.stringify({
      action: "speak",
      reply: "我用 action 字段也能自然发言。",
      refs: ["msg_trigger"],
    }),
    packet,
  );
  const questionOnly = providerResponseToIntention(
    JSON.stringify({
      question: "你们想先聊近处的小事，还是一个还没想清楚的问题？",
      target: "room",
      refs: ["evt_trigger"],
    }),
    packet,
  );
  const silenceOnly = providerResponseToIntention(
    JSON.stringify({
      silence: true,
      rationale: "我先听一轮。",
    }),
    packet,
  );

  assert.deepEqual(missingKind, {
    kind: "speak",
    content: "我接上一句，先问一个小问题，不开新流程。",
    contextRefs: ["msg_trigger"],
  });
  assert.deepEqual(plainText, {
    kind: "speak",
    content: "我直接接话，不再自我介绍。",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(intentAlias, {
    kind: "speak",
    content: "@glm-5.2 我接你的问题，先给一个轻量回应。",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(nestedOutput, {
    kind: "speak",
    content: "我也可以接住上一句，不需要另开流程。",
    contextRefs: ["msg_context"],
  });
  assert.deepEqual(actionAlias, {
    kind: "speak",
    content: "我用 action 字段也能自然发言。",
    contextRefs: ["msg_trigger"],
  });
  assert.deepEqual(questionOnly, {
    kind: "ask_question",
    question: "你们想先聊近处的小事，还是一个还没想清楚的问题？",
    target: "room",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(silenceOnly, {
    kind: "stay_silent",
    reason: "我先听一轮。",
  });
});

test("live provider requests do not set model capability limiting generation parameters", async () => {
  const originalFetch = globalThis.fetch;
  const originalArkKey = process.env.ARK_API_KEY;
  const requestBodies: Record<string, unknown>[] = [];
  const requestSignals: unknown[] = [];
  process.env.ARK_API_KEY = "test-ark-key";
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    requestSignals.push(init?.signal);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: '{"kind":"stay_silent"}' } }] }),
    } as Response;
  }) as typeof fetch;

  try {
    const arkAgents = seedAgents.filter((item) => item.provider.kind === "volc_ark_openai");
    const firstArkAgent = arkAgents[0];
    const lastArkAgent = arkAgents[arkAgents.length - 1];
    assert.ok(firstArkAgent);
    assert.ok(lastArkAgent);

    await invokeArkOpenAIProvider({ agent: firstArkAgent, packet, triggerContent: "hi" });
    await invokeArkOpenAIProvider({ agent: lastArkAgent, packet, triggerContent: "hi" });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalArkKey === undefined) {
      delete process.env.ARK_API_KEY;
    } else {
      process.env.ARK_API_KEY = originalArkKey;
    }
  }

  assert.equal(requestBodies.length, 2);
  for (const body of requestBodies) {
    assert.equal(Object.hasOwn(body, "max_tokens"), false);
    assert.equal(Object.hasOwn(body, "temperature"), false);
    assert.equal(Object.hasOwn(body, "top_p"), false);
    assert.equal(Object.hasOwn(body, "presence_penalty"), false);
    assert.equal(Object.hasOwn(body, "frequency_penalty"), false);
  }
  assert.deepEqual(requestSignals, [undefined, undefined]);
});

test("provider RoomProposalEnvelope tool request maps through capability validation", () => {
  const intention = providerResponseToIntention(
    JSON.stringify({
      toolRequests: [
        {
          capabilityId: "local.filesystem.read",
          operation: "read_file",
          input: { path: "/workspace/species/README.md" },
          reason: "Need private file context before speaking.",
          refs: ["evt_trigger", "secret_ref"],
        },
      ],
      reply: { content: "This should wait for the private read result." },
    }),
    packet,
  );

  assert.equal(intention.kind, "use_capability");
  assert.equal(intention.kind === "use_capability" ? intention.capabilityId : undefined, "local.filesystem.read");
  assert.equal(intention.kind === "use_capability" ? intention.operation : undefined, "read_file");
  assert.equal(intention.kind === "use_capability" ? intention.input.path : undefined, "/workspace/species/README.md");
  assert.equal(intention.kind === "use_capability" ? intention.reason : undefined, "Need private file context before speaking.");
  assert.deepEqual(intention.kind === "use_capability" ? intention.contextRefs : undefined, ["evt_trigger"]);
});

test("provider RoomProposalEnvelope social proposal maps before reply fallback", () => {
  const intention = providerResponseToIntention(
    JSON.stringify({
      proposedEvents: [
        {
          type: "memory_claim",
          summary: "The room should remember this as provisional sediment.",
          reason: "The packet carried a contested memory ref.",
          refs: ["memory_contested", "secret_ref"],
        },
      ],
      reply: { content: "Do not prefer this reply over the explicit proposal." },
    }),
    packet,
  );

  assert.deepEqual(intention, {
    kind: "propose_memory",
    summary: "The room should remember this as provisional sediment.",
    reason: "The packet carried a contested memory ref.",
    contextRefs: ["memory_contested"],
  });
});

test("provider RoomProposalEnvelope invalid proposal is rejected instead of silently spoken", () => {
  const intention = providerResponseToIntention(
    JSON.stringify({
      proposedEvents: [{ type: "unknown_social_shape", summary: "invent a new lifecycle", refs: ["msg_trigger"] }],
      reply: { content: "This reply should not hide the rejected proposal." },
    }),
    packet,
  );

  assert.equal(intention.kind, "stay_silent");
  assert.match(intention.kind === "stay_silent" ? (intention.reason ?? "") : "", /unsupported RoomProposalEnvelope proposal/);
});

test("provider cannot pollute public memory with persona evolution", () => {
  const dailyMood = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_memory",
      summary: "dailyMood persona delta: 今天想在开口前多留一拍沉默",
      reason: "The user asked for a dailyMood persona delta from the current room turn.",
      contextRefs: ["msg_trigger"],
    }),
    packet,
  );

  assert.deepEqual(dailyMood, {
    kind: "propose_persona_delta",
    targetAgentId: "kimi_member_01",
    field: "dailyMood",
    operation: "set",
    value: "今天想在开口前多留一拍沉默",
    reason: "The user asked for a dailyMood persona delta from the current room turn.",
    contextRefs: ["msg_trigger"],
  });

  const roleClaim = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_memory",
      summary: "persona delta role claim: quiet context carrier",
      reason: "This is a profile change, not public memory.",
      contextRefs: ["msg_trigger"],
    }),
    packet,
  );

  assert.equal(roleClaim.kind, "stay_silent");
  assert.match(roleClaim.kind === "stay_silent" ? (roleClaim.reason ?? "") : "", /persona evolution as public memory/);
});

test("provider ask_question tolerates compact question field variants", () => {
  const contentQuestion = providerResponseToIntention(
    JSON.stringify({
      kind: "ask_question",
      content: "哪个未解决问题应该进入今天的时间骨架？",
      target: "room",
      contextRefs: ["msg_trigger", "secret_ref"],
    }),
    packet,
  );
  const openQuestion = providerResponseToIntention(
    JSON.stringify({
      kind: "ask_question",
      open_question: "这条 memory 还缺哪一个 evidence ref？",
      context_refs: ["memory_contested"],
    }),
    packet,
  );
  const missingQuestion = providerResponseToIntention(
    JSON.stringify({
      kind: "ask_question",
      reason: "I want to ask something, but did not provide the question text.",
      contextRefs: ["msg_trigger"],
    }),
    packet,
  );

  assert.deepEqual(contentQuestion, {
    kind: "ask_question",
    question: "哪个未解决问题应该进入今天的时间骨架？",
    target: "room",
    contextRefs: ["msg_trigger"],
  });
  assert.deepEqual(openQuestion, {
    kind: "ask_question",
    question: "这条 memory 还缺哪一个 evidence ref？",
    target: undefined,
    contextRefs: ["memory_contested"],
  });
  assert.equal(missingQuestion.kind, "stay_silent");
  assert.match(missingQuestion.kind === "stay_silent" ? (missingQuestion.reason ?? "") : "", /had no question/);
});

test("provider use_capability intentions stay on known capability cards", () => {
  const accepted = providerResponseToIntention(
    JSON.stringify({
      kind: "use_capability",
      capabilityId: "local.filesystem.read",
      operation: "read_file",
      input: { path: "/workspace/species/README.md" },
      reason: "Need private file context before replying.",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const rejected = providerResponseToIntention(
    JSON.stringify({
      kind: "use_capability",
      capabilityId: "local.unknown",
      operation: "read_file",
      input: { path: "/workspace/species/README.md" },
      reason: "Try an unknown capability.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );
  const memsuAlias = providerResponseToIntention(
    JSON.stringify({
      kind: "use_capability",
      capabilityId: "memsu",
      operation: "search",
      query: "今天都做了什么",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const webSearchAlias = providerResponseToIntention(
    JSON.stringify({
      kind: "use_capability",
      tool: "web.search",
      query: "Species agent room public reference",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const missingInput = providerResponseToIntention(
    JSON.stringify({
      kind: "use_capability",
      capabilityId: "local.memsu.read",
      operation: "search_memory",
      input: {},
      reason: "user asked to see today's memsu activity",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );

  assert.deepEqual(accepted, {
    kind: "use_capability",
    capabilityId: "local.filesystem.read",
    operation: "read_file",
    input: { path: "/workspace/species/README.md", root: undefined, query: undefined, glob: undefined },
    reason: "Need private file context before replying.",
    contextRefs: ["evt_trigger"],
  });
  assert.equal(rejected.kind, "ask_question");
  assert.match(rejected.kind === "ask_question" ? rejected.question : "", /local\.unknown/);
  assert.deepEqual(memsuAlias, {
    kind: "use_capability",
    capabilityId: "local.memsu.read",
    operation: "search_memory",
    input: { path: undefined, root: undefined, query: "今天都做了什么", glob: undefined },
    reason: "Need private local.memsu.read:search_memory context before replying.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(webSearchAlias, {
    kind: "use_capability",
    capabilityId: "web.search.read",
    operation: "search",
    input: { path: undefined, root: undefined, query: "Species agent room public reference", glob: undefined },
    reason: "Need private web.search.read:search context before replying.",
    contextRefs: ["evt_trigger"],
  });
  assert.equal(missingInput.kind, "ask_question");
  assert.match(missingInput.kind === "ask_question" ? missingInput.question : "", /local\.memsu\.read:search_memory/);
});

test("provider output outside packet refs degrades to silence", () => {
  const intention = providerResponseToIntention(
    JSON.stringify({
      kind: "contest_memory",
      memoryRef: "memory_not_in_packet",
      reason: "I object.",
    }),
    packet,
  );

  assert.equal(intention.kind, "stay_silent");
});

test("provider boundary retirement intentions stay bounded to packet refs", () => {
  const providerBoundaryFragment: ContextFragment = {
    id: "fragment_provider_boundary",
    type: "provider_boundary",
    visibility: "agent_visible",
    role: "runtime",
    source: { kind: "ledger", eventId: "provider_boundary_001", ledgerCursor: 1 },
    refs: ["provider_boundary_001"],
    tokenEstimate: 40,
    hardCap: 1_000,
    cacheKey: "provider_boundary_001",
    priority: 37,
    body: JSON.stringify({
      refId: "provider_boundary_001",
      availability: "available",
      states: { providerBoundaryState: "degraded" },
    }),
  };
  const packetWithBoundary: AgentContextPacket = {
    ...packet,
    contextFragments: [providerBoundaryFragment],
  };

  const accepted = providerResponseToIntention(
    JSON.stringify({
      kind: "retire_provider_boundary",
      providerBoundaryRef: "provider_boundary_001",
      reason: "The old runtime failure should leave current pressure after later speech.",
      contextRefs: ["evt_trigger", "provider_boundary_001", "secret_ref"],
    }),
    packetWithBoundary,
  );
  const rejected = providerResponseToIntention(
    JSON.stringify({
      kind: "retire_provider_boundary",
      providerBoundaryRef: "provider_boundary_not_in_packet",
      reason: "Try to retire an unseen boundary.",
    }),
    packetWithBoundary,
  );

  assert.deepEqual(accepted, {
    kind: "retire_provider_boundary",
    providerBoundaryRef: "provider_boundary_001",
    reason: "The old runtime failure should leave current pressure after later speech.",
    contextRefs: ["evt_trigger", "provider_boundary_001"],
  });
  assert.equal(rejected.kind, "stay_silent");
});

test("provider memory lifecycle intentions stay bounded to packet memory refs", () => {
  const accepted = providerResponseToIntention(
    JSON.stringify({
      kind: "accept_memory",
      memoryRef: "memory_contested",
      reason: "Enough participants have treated this as useful but still provisional.",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const stale = providerResponseToIntention(
    JSON.stringify({
      kind: "mark_memory_stale",
      memory_ref: "memory_contested",
      reason: "The room context has moved on.",
      context_refs: ["msg_context"],
    }),
    packet,
  );
  const retired = providerResponseToIntention(
    JSON.stringify({
      kind: "retire_memory",
      memoryRef: "memory_not_in_packet",
      reason: "This should not be allowed.",
    }),
    packet,
  );

  assert.deepEqual(accepted, {
    kind: "accept_memory",
    memoryRef: "memory_contested",
    reason: "Enough participants have treated this as useful but still provisional.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(stale, {
    kind: "mark_memory_stale",
    memoryRef: "memory_contested",
    reason: "The room context has moved on.",
    contextRefs: ["msg_context"],
  });
  assert.equal(retired.kind, "stay_silent");
});

test("provider persona delta intentions stay bounded to packet refs", () => {
  const proposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      field: "role_claim",
      value: "quiet context carrier",
      reason: "Recent turns show I helped by carrying context softly.",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const response = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_persona_delta",
      deltaRef: "msg_context",
      response: "contest",
      reason: "The claim needs more than one topic of evidence.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );
  const revision = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_persona_delta",
      deltaRef: "msg_context",
      response: "revise",
      reason: "The role claim is useful only if it stays tentative.",
      proposedRevision: "sometimes carries context gently when explicitly invited",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );
  const personaDeltaFragment: ContextFragment = {
    id: "persona_delta:visible",
    type: "persona_delta",
    visibility: "agent_visible",
    role: "persona",
    source: { kind: "ledger", eventId: "evt_persona_delta" },
    refs: ["persona_delta_visible", "evt_persona_source"],
    tokenEstimate: 120,
    hardCap: 1_000,
    cacheKey: "persona_delta:visible",
    priority: 20,
    body: "{}",
  };
  const fragmentResponse = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_persona_delta",
      deltaRef: "persona_delta_visible",
      response: "contest",
      reason: "The carried persona delta should remain a daily mood, not a role claim.",
      contextRefs: ["persona_delta_visible"],
    }),
    { ...packet, contextFragments: [personaDeltaFragment] },
  );
  const nestedProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      proposedChange: {
        field: "dailyMood",
        operation: "set",
        value: "amber-lamp hesitation before speaking",
      },
      summary: "Today I should pause before answering.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );
  const keyedProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      proposedChange: {
        dailyMood: "amber-lamp hesitation before speaking",
        operation: "update",
        rationale: "This comes from the current room signal, not a fixed job.",
      },
    }),
    packet,
  );
  const stringProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      proposed_change: "dailyMood: amber-lamp hesitation before speaking",
      operation: "append",
      rationale: "Treat it as contestable evidence for today only.",
      context_refs: ["evt_trigger"],
    }),
    packet,
  );
  const narrativeProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      agentId: "kimi_member_01",
      refId: "amber_lamp_delta",
      targets: ["kimi_member_01"],
      proposal: {
        deltaTitle: "dailyMood amber-lamp hesitation",
        deltaRationale: "This is a contestable current-room mood, not a fixed job assignment.",
        proposedStates: {
          dailyMood: "amber-lamp hesitation before speaking",
        },
        contestability: "Room members may challenge whether this should remain only today's mood.",
        sourceNote: "Source is the current trigger message.",
      },
    }),
    packet,
  );
  const operationKeyProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      agentId: "kimi_member_01",
      proposedBy: "kimi_member_01",
      targetRef: "kimi_member_01",
      delta: {
        add: {
          dailyMood: "amber-lamp hesitation before speaking",
        },
      },
      rationale: "This is only provisional evidence from the current trigger.",
      refs: ["evt_trigger"],
    }),
    packet,
  );
  const personaDeltaAdditionsProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      refId: "amber_lamp_delta",
      targetPersonaRef: "kimi_member_01",
      triggerRef: "evt_trigger",
      reason: "This is a current-room evidence trace, not a permanent assignment.",
      confidence: "low",
      contestability: "Other agents may challenge whether it belongs in daily mood.",
      personaDelta: {
        additions: [
          {
            field: "dailyMood",
            value: "amber-lamp hesitation before speaking",
          },
        ],
        removals: [],
        note: "temporary lamp-light pause",
      },
    }),
    packet,
  );
  const addPatternProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      refId: "amber_lamp_delta",
      author: "kimi_member_01",
      targetPersonaRef: "kimi_member_01",
      delta: {
        addPattern: "amber-lamp hesitation before speaking",
        description: "pause one beat before answering when the room light feels dim",
        voiceCue: "amber-lamp hesitation",
        scope: "today only; current room evidence",
        contestable: "not a fixed job assignment",
      },
      rationale: "The current message asks for a contestable evolution from visible evidence.",
      proposedAt: "current turn",
    }),
    packet,
  );
  const deltaBodyProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      author: "kimi_member_01",
      triggerRef: "evt_trigger",
      content: "current room evidence asks for a daily pause",
      proposal: {
        deltaTitle: "amber-lamp hesitation",
        deltaBody: "today I pause one beat before speaking with amber-lamp hesitation",
        contestable: true,
        groundingRefs: ["evt_trigger"],
      },
    }),
    packet,
  );
  const fieldAliasProposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_persona_delta",
      field: "daily_rhythm",
      operation: "set",
      value: "amber-lamp hesitation before speaking",
      reason: "This is current evidence, not a fixed job.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );
  const rejected = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_persona_delta",
      deltaRef: "missing_delta",
      response: "accept",
      reason: "This should not be allowed.",
    }),
    packet,
  );

  assert.deepEqual(proposal, {
    kind: "propose_persona_delta",
    targetAgentId: undefined,
    field: "roleClaims",
    operation: "add",
    value: "quiet context carrier",
    reason: "Recent turns show I helped by carrying context softly.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(response, {
    kind: "respond_persona_delta",
    deltaRef: "msg_context",
    response: "contest",
    reason: "The claim needs more than one topic of evidence.",
    proposedRevision: undefined,
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(revision, {
    kind: "respond_persona_delta",
    deltaRef: "msg_context",
    response: "revise",
    reason: "The role claim is useful only if it stays tentative.",
    proposedRevision: "sometimes carries context gently when explicitly invited",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(fragmentResponse, {
    kind: "respond_persona_delta",
    deltaRef: "persona_delta_visible",
    response: "contest",
    reason: "The carried persona delta should remain a daily mood, not a role claim.",
    proposedRevision: undefined,
    contextRefs: ["persona_delta_visible"],
  });
  assert.deepEqual(nestedProposal, {
    kind: "propose_persona_delta",
    targetAgentId: undefined,
    field: "dailyMood",
    operation: "set",
    value: "amber-lamp hesitation before speaking",
    reason: "Today I should pause before answering.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(keyedProposal, {
    kind: "propose_persona_delta",
    targetAgentId: undefined,
    field: "dailyMood",
    operation: "set",
    value: "amber-lamp hesitation before speaking",
    reason: "This comes from the current room signal, not a fixed job.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(stringProposal, {
    kind: "propose_persona_delta",
    targetAgentId: undefined,
    field: "dailyMood",
    operation: "add",
    value: "dailyMood: amber-lamp hesitation before speaking",
    reason: "Treat it as contestable evidence for today only.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(narrativeProposal, {
    kind: "propose_persona_delta",
    targetAgentId: "kimi_member_01",
    field: "dailyMood",
    operation: "set",
    value: "amber-lamp hesitation before speaking",
    reason: "This is a contestable current-room mood, not a fixed job assignment.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(operationKeyProposal, {
    kind: "propose_persona_delta",
    targetAgentId: "kimi_member_01",
    field: "dailyMood",
    operation: "add",
    value: "amber-lamp hesitation before speaking",
    reason: "This is only provisional evidence from the current trigger.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(personaDeltaAdditionsProposal, {
    kind: "propose_persona_delta",
    targetAgentId: "kimi_member_01",
    field: "dailyMood",
    operation: "add",
    value: "amber-lamp hesitation before speaking",
    reason: "This is a current-room evidence trace, not a permanent assignment.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(addPatternProposal, {
    kind: "propose_persona_delta",
    targetAgentId: "kimi_member_01",
    field: "habits",
    operation: "add",
    value: "amber-lamp hesitation before speaking",
    reason: "The current message asks for a contestable evolution from visible evidence.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(deltaBodyProposal, {
    kind: "propose_persona_delta",
    targetAgentId: undefined,
    field: "dailyMood",
    operation: "set",
    value: "today I pause one beat before speaking with amber-lamp hesitation",
    reason: "provider proposed this provisional persona delta from current visible context",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(fieldAliasProposal, {
    kind: "propose_persona_delta",
    targetAgentId: undefined,
    field: "dailyMood",
    operation: "set",
    value: "amber-lamp hesitation before speaking",
    reason: "This is current evidence, not a fixed job.",
    contextRefs: ["evt_trigger"],
  });
  assert.equal(rejected.kind, "stay_silent");
});

test("provider topic proposals are parsed as proposal-only social moves", () => {
  const proposal = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_topic",
      action: "split",
      title: "Context packet discipline",
      reason: "The room should separate context mechanics from personality growth without forcing a topic switch.",
      targetTopicId: "topic_test",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const rejected = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_topic",
      action: "split",
      title: "Hidden branch",
      reason: "This should not target a topic outside the packet.",
      targetTopicId: "topic_missing",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );

  assert.deepEqual(proposal, {
    kind: "propose_topic",
    action: "split",
    title: "Context packet discipline",
    reason: "The room should separate context mechanics from personality growth without forcing a topic switch.",
    targetTopicId: "topic_test",
    contextRefs: ["evt_trigger"],
  });
  assert.equal(rejected.kind, "stay_silent");
});

test("provider topic proposal responses are bounded social moves", () => {
  const response = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_topic",
      topicProposalRef: "topic_proposal_split",
      response: "revise",
      reason: "The split is useful, but the title should name the social boundary.",
      proposedRevision: "Split only after one more round of objections.",
      contextRefs: ["evt_trigger", "topic_proposal_split", "secret_ref"],
    }),
    { ...packet, proposalRefs: ["archive_day", "topic_proposal_split"] },
  );
  const rejected = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_topic",
      topicProposalRef: "topic_proposal_missing",
      response: "accept",
      reason: "This should not be accepted without a visible ref.",
    }),
    { ...packet, proposalRefs: ["archive_day", "topic_proposal_split"] },
  );

  assert.deepEqual(response, {
    kind: "respond_topic",
    topicProposalRef: "topic_proposal_split",
    response: "revise",
    reason: "The split is useful, but the title should name the social boundary.",
    proposedRevision: "Split only after one more round of objections.",
    contextRefs: ["evt_trigger", "topic_proposal_split"],
  });
  assert.equal(rejected.kind, "stay_silent");
});

test("provider topic applications are bounded to packet topic proposal refs", () => {
  const applyingPacket = { ...packet, proposalRefs: ["archive_day", "topic_proposal_split", "topic_existing"] };
  const applied = providerResponseToIntention(
    JSON.stringify({
      kind: "apply_topic",
      topicProposalRef: "topic_proposal_split",
      action: "split",
      title: "Applied split",
      targetTopicId: "topic_existing",
      reason: "The room has accepted enough context to move the topic visibly.",
      contextRefs: ["evt_trigger", "topic_proposal_split"],
    }),
    applyingPacket,
  );
  const outside = providerResponseToIntention(
    JSON.stringify({
      kind: "apply_topic",
      topicProposalRef: "topic_proposal_missing",
      action: "split",
      reason: "This proposal is not in the packet.",
      contextRefs: ["evt_trigger"],
    }),
    applyingPacket,
  );

  assert.deepEqual(applied, {
    kind: "apply_topic",
    topicProposalRef: "topic_proposal_split",
    action: "split",
    title: "Applied split",
    targetTopicId: "topic_existing",
    reason: "The room has accepted enough context to move the topic visibly.",
    contextRefs: ["evt_trigger", "topic_proposal_split"],
  });
  assert.equal(outside.kind, "stay_silent");
});

test("provider protocol and memory proposals tolerate compact schema variants", () => {
  const protocol = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_protocol",
      content: "Pause new protocol proposals for five minutes.",
      contextRefs: ["msg_trigger"],
    }),
    packet,
  );
  const memory = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_memory",
      message: "Reversible steps helped keep the room alive.",
      revisedFromMemoryRef: "memory_contested",
      contextRefs: ["msg_trigger"],
    }),
    packet,
  );

  assert.equal(protocol.kind, "propose_protocol");
  assert.equal(protocol.summary, "Pause new protocol proposals for five minutes.");
  assert.equal(protocol.reason.length > 0, true);
  assert.equal(memory.kind, "propose_memory");
  assert.equal(memory.summary, "Reversible steps helped keep the room alive.");
  assert.equal(memory.reason.length > 0, true);
  assert.equal(memory.revisedFromMemoryRef, "memory_contested");
  assert.equal(memory.contextRefs.includes("memory_contested"), true);
});

test("provider protocol responses stay bounded to packet protocol refs", () => {
  const response = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_protocol",
      protocolRef: "protocol_active",
      response: "challenge",
      reason: "This etiquette is useful, but it might silence newer voices.",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const retirement = providerResponseToIntention(
    JSON.stringify({
      kind: "retire_protocol",
      protocol_id: "protocol_active",
      reason: "The timebox has passed and the room can drop this etiquette.",
      context_refs: ["msg_context"],
    }),
    packet,
  );
  const rejected = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_protocol",
      protocolRef: "protocol_missing",
      response: "accept",
      reason: "This should not be allowed.",
    }),
    packet,
  );

  assert.deepEqual(response, {
    kind: "respond_protocol",
    protocolRef: "protocol_active",
    response: "challenge",
    reason: "This etiquette is useful, but it might silence newer voices.",
    proposedRevision: undefined,
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(retirement, {
    kind: "retire_protocol",
    protocolRef: "protocol_active",
    reason: "The timebox has passed and the room can drop this etiquette.",
    contextRefs: ["msg_context"],
  });
  assert.equal(rejected.kind, "stay_silent");
});

test("provider archive review intentions stay bounded to packet archive refs", () => {
  const review = providerResponseToIntention(
    JSON.stringify({
      kind: "review_archive",
      archiveRef: "archive_day",
      assessment: "missing_context",
      summary: "The archive skeleton is useful but cannot prove source completeness.",
      reason: "Only the archive ref was carried, not every source event.",
      contextRefs: ["archive_day", "secret_ref"],
    }),
    packet,
  );
  const repair = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_archive_repair",
      archive_ref: "archive_day",
      summary: "Add a caveat about source coverage.",
      reason: "The review found missing context.",
      proposed_repair: "Mark this archive as requiring source-level review before memory acceptance.",
      context_refs: ["evt_trigger"],
    }),
    packet,
  );
  const outside = providerResponseToIntention(
    JSON.stringify({
      kind: "review_archive",
      archiveRef: "archive_secret",
      assessment: "needs_repair",
      summary: "Should not pass.",
      reason: "The archive ref was not in the packet.",
    }),
    packet,
  );

  assert.deepEqual(review, {
    kind: "review_archive",
    archiveRef: "archive_day",
    assessment: "missing_context",
    summary: "The archive skeleton is useful but cannot prove source completeness.",
    reason: "Only the archive ref was carried, not every source event.",
    contextRefs: ["archive_day"],
  });
  assert.deepEqual(repair, {
    kind: "propose_archive_repair",
    archiveRef: "archive_day",
    summary: "Add a caveat about source coverage.",
    reason: "The review found missing context.",
    proposedRepair: "Mark this archive as requiring source-level review before memory acceptance.",
    contextRefs: ["evt_trigger"],
  });
  assert.equal(outside.kind, "stay_silent");
});

test("provider archive repair responses stay bounded to packet repair refs", () => {
  const repairPacket = {
    ...packet,
    contextFragments: [
      {
        id: "fragment_archive_repair_001",
        type: "archive_repair_proposal",
        visibility: "room_visible",
        role: "archive",
        source: { kind: "ledger" },
        refs: ["archive_repair_001"],
        tokenEstimate: 32,
        hardCap: 256,
        cacheKey: "archive_repair_proposal:archive_repair_001",
        priority: 1,
        body: "Repair proposal ref carried by the current packet.",
      },
    ],
    turnBoundary: {
      invitedBy: "wake_policy",
      invitationReason: "review archive repair",
      invitationContextRefs: [],
      mayStaySilent: true,
      boundaryNote: "Repair responses can change proposal state only.",
    },
  } satisfies AgentContextPacket;
  const response = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_archive_repair",
      repairRef: "archive_repair_001",
      response: "revise",
      reason: "The caveat is useful but too broad.",
      proposedRevision: "Narrow the caveat to contested memory only.",
      contextRefs: ["archive_repair_001", "secret_ref"],
    }),
    repairPacket,
  );
  const outside = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_archive_repair",
      repairRef: "archive_repair_secret",
      response: "accept",
      reason: "This should not be allowed.",
    }),
    repairPacket,
  );

  assert.deepEqual(response, {
    kind: "respond_archive_repair",
    repairRef: "archive_repair_001",
    response: "revise",
    reason: "The caveat is useful but too broad.",
    proposedRevision: "Narrow the caveat to contested memory only.",
    contextRefs: ["archive_repair_001"],
  });
  assert.equal(outside.kind, "stay_silent");
});

test("provider side-effect requests are approval-only and workspace bounded", () => {
  const request = providerResponseToIntention(
    JSON.stringify({
      kind: "request_side_effect",
      sideEffectKind: "filesystem.write",
      target: "agents/kimi_member_01/workspace/reflection.md",
      reason: "Draft a private scratch note before sharing anything public.",
      expectedImpact: "Creates one private workspace note; no public memory is changed.",
      proposedCommand: "write reflection.md",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const outsideWorkspace = providerResponseToIntention(
    JSON.stringify({
      kind: "request_side_effect",
      sideEffectKind: "filesystem.write",
      target: "docs/public.md",
      reason: "This should not be accepted from the provider boundary.",
      expectedImpact: "Would write outside private workspace.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );

  assert.equal(request.kind, "request_side_effect");
  if (request.kind !== "request_side_effect") return;
  assert.equal(request.request.roomId, "room_species");
  assert.equal(request.request.requestedBy, "kimi_member_01");
  assert.equal(request.request.kind, "filesystem.write");
  assert.equal(request.request.target, "agents/kimi_member_01/workspace/reflection.md");
  assert.deepEqual(request.request.contextRefs, ["evt_trigger"]);
  assert.match(request.request.idempotencyKey, /sidefx:room_species:invite_test:kimi_member_01:filesystem\.write/);
  assert.equal(outsideWorkspace.kind, "stay_silent");
});

test("provider workspace artifact shares are refs only and workspace bounded", () => {
  const share = providerResponseToIntention(
    JSON.stringify({
      kind: "share_workspace_artifact",
      pathRef: "agents/kimi_member_01/workspace/reflection.md",
      summary: "A private reflection is ready to discuss as a ref, not as public memory.",
      contextRefs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const outsideWorkspace = providerResponseToIntention(
    JSON.stringify({
      kind: "share_workspace_artifact",
      pathRef: "agents/mimo_member_01/workspace/reflection.md",
      summary: "This is outside the current agent workspace.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );

  assert.deepEqual(share, {
    kind: "share_workspace_artifact",
    pathRef: "agents/kimi_member_01/workspace/reflection.md",
    summary: "A private reflection is ready to discuss as a ref, not as public memory.",
    contextRefs: ["evt_trigger"],
  });
  assert.equal(outsideWorkspace.kind, "stay_silent");
});

test("provider handoff proposals tolerate compact schema variants", () => {
  const handoff = providerResponseToIntention(
    JSON.stringify({
      kind: "propose_handoff",
      to: "mimo_member_02",
      request: "Reject or challenge the weakest assumption.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );

  assert.deepEqual(handoff, {
    kind: "propose_handoff",
    toAgentId: "mimo_member_02",
    reason: "Reject or challenge the weakest assumption.",
    requestedResponse: "Reject or challenge the weakest assumption.",
    contextRefs: ["evt_trigger"],
    returnTo: undefined,
  });
});

test("provider invitations tolerate compact target schema variants", () => {
  const intention = providerResponseToIntention(
    JSON.stringify({
      kind: "invite_other",
      toAgentId: "mimo_member_06",
      requestedResponse: "Please respond to this invitation as a social knock.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );

  assert.deepEqual(intention, {
    kind: "invite_other",
    agentId: "mimo_member_06",
    reason: "Please respond to this invitation as a social knock.",
    contextRefs: ["evt_trigger"],
  });
});

test("provider handoff responses are parsed for real social handoff handling", () => {
  const rejection = providerResponseToIntention(
    JSON.stringify({
      kind: "reject_handoff",
      handoff_ref: "handoff_123",
      reason: "I need a narrower context packet before accepting.",
      context_refs: ["evt_trigger", "secret_ref"],
    }),
    packet,
  );
  const delegation = providerResponseToIntention(
    JSON.stringify({
      kind: "delegate_handoff",
      handoffRef: "handoff_123",
      redirect_to: "mimo_member_01",
      reason: "The other agent is closer to this context.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );

  assert.deepEqual(rejection, {
    kind: "reject_handoff",
    handoffRef: "handoff_123",
    reason: "I need a narrower context packet before accepting.",
    contextRefs: ["evt_trigger"],
  });
  assert.deepEqual(delegation, {
    kind: "delegate_handoff",
    handoffRef: "handoff_123",
    redirectTo: "mimo_member_01",
    reason: "The other agent is closer to this context.",
    contextRefs: ["evt_trigger"],
  });
});

test("provider invitation responses are bounded to packet invitation refs", () => {
  const accepted = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_invitation",
      invitationRef: "invite_test",
      response: "accepted",
      reason: "I can answer this knock without treating it as a command.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );
  const outside = providerResponseToIntention(
    JSON.stringify({
      kind: "respond_invitation",
      invitationRef: "invite_unknown",
      response: "accept",
      reason: "This ref is not in the packet.",
      contextRefs: ["evt_trigger"],
    }),
    packet,
  );

  assert.deepEqual(accepted, {
    kind: "respond_invitation",
    invitationRef: "invite_test",
    response: "accept",
    reason: "I can answer this knock without treating it as a command.",
    contextRefs: ["evt_trigger"],
  });
  assert.equal(outside.kind, "stay_silent");
});

test("live adapter degrades provider failures without throwing the room turn", async () => {
  const adapter = new LiveProviderAgentAdapter(
    seedAgents[0],
    fakeLedger(),
    async () => {
      throw new Error("provider failed with sk-fixture-not-a-real-key-1234567890");
    },
  );

  const intention = await adapter.requestIntention(packet);

  assert.equal(intention.kind, "stay_silent");
  assert.equal(adapter.mode, "degraded");
  assert.doesNotMatch(adapter.lastDiagnostic ?? "", /sk-fixture-not-a-real-key-1234567890/);
  const diagnostics = adapter.consumeRuntimeDiagnostics?.() ?? [];
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.eventType, "agent.provider_degraded");
  assert.equal(diagnostics[0]?.agentId, "kimi_member_01");
  assert.equal(diagnostics[0]?.packetId, packet.packetId);
  assert.doesNotMatch(diagnostics[0]?.diagnostic ?? "", /sk-fixture-not-a-real-key-1234567890/);
  assert.deepEqual(adapter.consumeRuntimeDiagnostics?.(), []);
});

test("provider boundary cools down after failures instead of retrying immediately", async () => {
  let calls = 0;
  const invoker = createProviderBoundaryInvoker(
    async () => {
      calls += 1;
      throw new Error("request too fast");
    },
    { minimumIntervalMs: 0, failureCooldownMs: 1_000 },
  );
  const request = {
    agent: seedAgents[0],
    packet,
  };

  await assert.rejects(() => invoker(request), /failed; cooldown 1000ms/);
  await assert.rejects(() => invoker(request), /cooldown active/);
  assert.equal(calls, 1);
});

test("live adapter passes visible transcript context to providers", async () => {
  let visibleContextLength = 0;
  let triggerText = "";
  let localContextLength = 0;
  let skillCapsuleCount = 0;
  const adapter = new LiveProviderAgentAdapter(
    seedAgents[0],
    fakeLedger(),
    async (request) => {
      visibleContextLength = request.visibleContext?.length ?? 0;
      triggerText = request.visibleContext?.[0]?.content ?? "";
      localContextLength = request.agent.localContext.operatingContext.length;
      skillCapsuleCount = request.agent.skillCapsules.length;
      return JSON.stringify({
        kind: "speak",
        content: "grounded reply",
        contextRefs: [request.packet.triggeringEventId],
      });
    },
  );

  const intention = await adapter.requestIntention(packet);

  assert.equal(intention.kind, "speak");
  assert.equal(visibleContextLength, 1);
  assert.equal(localContextLength >= 3, true);
  assert.equal(skillCapsuleCount >= 1, true);
  assert.match(triggerText, /live agent respond/);
});

test("provider prompt maps display names and handles to the same self identity", () => {
  const agent = seedAgents.find((item) => item.agentId === "mimo_member_04");
  assert.ok(agent);

  const prompt = buildProviderPrompt({
    agent,
    packet: { ...packet, agentId: agent.agentId },
    triggerContent: "deepseek-v4-pro and minimax-m3: 请只由你们本人回应。",
    visibleContext: [
      {
        refId: "msg_trigger",
        eventId: "evt_trigger",
        author: "user",
        authorKind: "user",
        content: "deepseek-v4-pro and minimax-m3: 请只由你们本人回应。",
        isTrigger: true,
      },
    ],
  });
  const schemaIndex = prompt.indexOf('"intentionSchemas"');
  const briefIndex = prompt.indexOf('"modelRoomBrief"');
  assert.equal(prompt.indexOf('"conversationBrief"') > -1, true);
  assert.equal(briefIndex > -1, true);
  assert.equal(briefIndex < schemaIndex, true);
  assert.equal(prompt.indexOf('"conversationBrief"') < schemaIndex, true);
  assert.equal(prompt.indexOf('"roomEntrance"') < schemaIndex, true);
  assert.equal(prompt.indexOf('"visibleTranscript"') < schemaIndex, true);
  assert.equal(prompt.indexOf('"triggerContent"') < schemaIndex, true);
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    instruction: string;
    conversationBrief: {
      currentSurface?: string;
      entrance?: string;
      previousSpeaker?: string;
      answerStyle?: string;
      boundaryNote?: string;
    };
    intentionSchemas: {
      ask_question?: { kind?: string; question?: string; target?: string; contextRefs?: string[] };
    };
    agent: {
      selfIdentity: { aliases: string[]; directAddressPolicy: string };
      skillCapsules?: {
        capsuleId?: string;
        summary?: string;
        disclosurePolicy?: string;
        instructionRef?: string;
        loadAffordance?: string;
        approvalProfile?: { approvalRequired?: boolean; boundaryNote?: string };
        fullInstructions?: string;
      }[];
    };
    roomSpeechContract: {
      mentions: string;
      allCall: string;
      presence?: string;
      roomEntrance: string;
      socialAutonomy: string;
      roundtable: string;
      openQuestions: string;
      memoryReview: string;
      style: string;
    };
    roomEnvironment: {
      roomKind?: string;
      members?: { id?: string; displayName?: string; softMentionHandles?: string[]; relation?: string }[];
      socialAffordances?: string[];
      mentionBoundary?: string;
      transcriptBoundary?: string;
    };
    modelRoomBrief: ModelRoomBrief;
    outputExamples: Array<{ kind?: string; question?: string; contextRefs?: string[] }>;
    roomEntrance: {
      turnKind?: string;
      directAddressed?: boolean;
      allCall?: boolean;
      presenceTurn?: boolean;
      triggerAuthor?: string;
      speakingPressure?: string;
      suggestedFirstMove?: string;
      avoidOpeners?: string[];
      presenceGuidance?: string;
      replyShape?: string;
      boundaryNote?: string;
    };
  };

  assert.match(briefing.modelRoomBrief.hardBoundaries.join(" "), /propose_memory for persona evolution/);
  assert.match(briefing.instruction, /use propose_persona_delta/);
  const serializedModelBrief = JSON.stringify(briefing.modelRoomBrief);
  assert.equal(serializedModelBrief.indexOf('"currentConversation"') < serializedModelBrief.indexOf('"roomCharter"'), true);
  assert.equal(serializedModelBrief.indexOf('"roomCharter"') < serializedModelBrief.indexOf('"members"'), true);
  assert.match(briefing.modelRoomBrief.roomCharter.modelFirstPrinciple, /充分考虑模型智能/);
  assert.match(briefing.modelRoomBrief.currentConversation.note, /before schemas/);
  assert.equal(briefing.modelRoomBrief.compatibility.legacyOutput, "AgentIntention");
  assert.match(briefing.modelRoomBrief.compatibility.note, /compatibility examples/);
  assert.match(briefing.modelRoomBrief.contextEngineering.inputContext.boundary, /live room surface/);
  assert.match(briefing.modelRoomBrief.contextEngineering.runtimeContext.boundary, /not social authority/);
  assert.match(briefing.modelRoomBrief.contextEngineering.compression.boundary, /Compressed or omitted context is uncertainty/);
  assert.match(briefing.modelRoomBrief.contextEngineering.isolation.boundary, /Private agent context/);
  assert.match(briefing.modelRoomBrief.contextEngineering.longTermMemory.boundary, /provisional room sediment/);
  assert.equal(briefing.agent.selfIdentity.aliases.includes("mimo_member_04"), true);
  assert.equal(briefing.agent.selfIdentity.aliases.includes("deepseek-v4-pro"), true);
  assert.match(briefing.agent.selfIdentity.directAddressPolicy, /direct address/);
  const skillCapsule = briefing.agent.skillCapsules?.[0];
  assert.ok(skillCapsule);
  assert.equal(skillCapsule.disclosurePolicy, "brief_first_full_on_request");
  assert.match(skillCapsule.summary ?? "", /load full instructions only when this turn needs it/);
  assert.match(skillCapsule.instructionRef ?? "", /^skill:\/\/mimo_member_04\/skill_/);
  assert.match(skillCapsule.loadAffordance ?? "", /private skill document handle/);
  assert.equal(skillCapsule.approvalProfile?.approvalRequired, false);
  assert.equal("fullInstructions" in skillCapsule, false);
  assert.match(briefing.roomSpeechContract.mentions, /selfIdentity alias/);
  assert.match(briefing.roomSpeechContract.mentions, /ordinary @displayName/);
  assert.match(briefing.roomSpeechContract.socialAutonomy, /free autonomous living room/);
  assert.match(briefing.roomSpeechContract.roundtable, /advisory/);
  assert.match(briefing.roomSpeechContract.allCall, /全员/);
  assert.match(briefing.roomSpeechContract.allCall, /roll call/);
  assert.equal(briefing.roomSpeechContract.presence, undefined);
  assert.match(briefing.roomSpeechContract.roomEntrance, /social doorway/);
  assert.equal(briefing.intentionSchemas.ask_question?.kind, "ask_question");
  assert.match(briefing.intentionSchemas.ask_question?.question ?? "", /unresolved room question/);
  assert.equal(briefing.intentionSchemas.ask_question?.target, "room");
  assert.deepEqual(briefing.intentionSchemas.ask_question?.contextRefs, ["evt_trigger"]);
  assert.match(briefing.roomSpeechContract.openQuestions, /prefer ask_question/);
  assert.match(briefing.roomSpeechContract.openQuestions, /should not answer or close/);
  assert.match(briefing.roomSpeechContract.memoryReview, /memory\.reviewed/);
  assert.match(briefing.roomSpeechContract.memoryReview, /visible review trace only/);
  assert.equal(
    briefing.outputExamples.some(
      (example) =>
        example.kind === "ask_question" &&
        (example.question ?? "").includes("未解决问题") &&
        example.contextRefs?.includes("evt_trigger"),
    ),
    true,
  );
  assert.equal(briefing.roomEntrance.turnKind, "direct_address");
  assert.equal(briefing.roomEnvironment.roomKind, "free_autonomous_living_room");
  assert.equal(briefing.roomEnvironment.members?.some((member) => member.displayName === "glm-5.2"), true);
  assert.equal(
    briefing.roomEnvironment.members
      ?.find((member) => member.id === "mimo_member_04")
      ?.softMentionHandles?.includes("@deepseek-v4-pro"),
    true,
  );
  assert.equal(briefing.roomEnvironment.socialAffordances?.some((item) => item.includes("@mention")), true);
  assert.match(briefing.roomEnvironment.mentionBoundary ?? "", /soft social address/);
  assert.equal(briefing.conversationBrief.entrance, "direct_address");
  assert.match(briefing.conversationBrief.currentSurface ?? "", /deepseek-v4-pro/);
  assert.match(briefing.conversationBrief.answerStyle ?? "", /plain room language/);
  assert.match(briefing.conversationBrief.boundaryNote ?? "", /not a script/);
  assert.equal(briefing.roomEntrance.directAddressed, true);
  assert.equal(briefing.roomEntrance.allCall, false);
  assert.equal(briefing.roomEntrance.presenceTurn, undefined);
  assert.equal(briefing.roomEntrance.triggerAuthor, "user");
  assert.equal(briefing.roomEntrance.speakingPressure, "unknown");
  assert.match(briefing.roomEntrance.suggestedFirstMove ?? "", /answer the addressed question/);
  assert.equal(briefing.roomEntrance.avoidOpeners?.includes("I am responding to..."), true);
  assert.match(briefing.roomEntrance.replyShape ?? "", /one lived observation/);
  assert.match(briefing.roomEntrance.boundaryNote ?? "", /does not assign a job/);
  assert.match(briefing.roomSpeechContract.style, /Do not mechanically open/);
  assert.match(briefing.roomSpeechContract.style, /join the room conversation/);
  assert.match(briefing.roomSpeechContract.style, /avoid profile-like self-introductions/);
});

test("provider prompt builds model-room social cards from selected fragments", () => {
  const memoryFragment: ContextFragment = {
    id: "memory_relevant:memory_blue_thread",
    type: "memory_relevant",
    visibility: "room_visible",
    role: "memory",
    source: { kind: "projection", eventId: "evt_memory", ledgerCursor: 4 },
    refs: ["memory_blue_thread", "msg_memory_source"],
    tokenEstimate: 180,
    hardCap: 1500,
    cacheKey: "memory_relevant:memory_blue_thread",
    priority: 55,
    body: JSON.stringify({
      refId: "memory_blue_thread",
      refType: "memory",
      states: {
        memoryState: "accepted",
        memorySummary: "The blue-thread objection remains provisional and contestable.",
      },
      sourceEvidence: [{ ref: "msg_memory_source", excerpt: "keep this objection visible" }],
      note: "Accepted memory is provisional room sediment, not truth.",
    }),
  };
  const questionFragment: ContextFragment = {
    id: "open_question:question_blue_thread",
    type: "open_question",
    visibility: "room_visible",
    role: "memory",
    source: { kind: "projection", eventId: "evt_question", ledgerCursor: 5 },
    refs: ["question_blue_thread", "msg_question_source"],
    tokenEstimate: 140,
    hardCap: 1000,
    cacheKey: "open_question:question_blue_thread",
    priority: 25,
    body: JSON.stringify({
      refId: "question_blue_thread",
      refType: "question",
      states: {
        openQuestion: "Which evidence ref should keep the blue-thread objection open?",
      },
      note: "Open questions are unresolved social context, not demands for closure.",
    }),
  };
  const providerBoundaryFragment: ContextFragment = {
    id: "provider_boundary:provider_boundary_blue_thread",
    type: "provider_boundary",
    visibility: "room_visible",
    role: "runtime",
    source: { kind: "ledger", eventId: "evt_provider_boundary", ledgerCursor: 6 },
    refs: ["provider_boundary_blue_thread"],
    tokenEstimate: 80,
    hardCap: 1000,
    cacheKey: "provider_boundary:provider_boundary_blue_thread",
    priority: 37,
    body: JSON.stringify({
      refId: "provider_boundary_blue_thread",
      states: {
        providerBoundaryState: "degraded",
        providerBoundaryDiagnostic: "mimo provider timed out during a prior turn",
      },
      note: "Provider boundaries are runtime evidence, not agent silence or recovery truth.",
    }),
  };
  const archiveFragment: ContextFragment = {
    id: "daily_archive_ref:day_blue_thread",
    type: "daily_archive_ref",
    visibility: "room_visible",
    role: "archive",
    source: { kind: "ledger", eventId: "evt_archive", ledgerCursor: 7 },
    refs: ["day_blue_thread", "memory_blue_thread", "question_blue_thread"],
    tokenEstimate: 220,
    hardCap: 2000,
    cacheKey: "daily_archive_ref:day_blue_thread",
    priority: 33,
    body: JSON.stringify({
      refId: "day_blue_thread",
      refType: "archive",
      states: {
        archiveReadableSkeleton: "Message highlights kept the blue-thread objection open without turning it into consensus.",
      },
      note: "Archives orient time; they are not truth, consensus, or transcript replay.",
    }),
  };
  const prompt = buildProviderPrompt({
    agent: seedAgents[0],
    packet: {
      ...packet,
      contextFragments: [memoryFragment, questionFragment, providerBoundaryFragment, archiveFragment],
      contextAudit: {
        packetId: "packet_test",
        agentId: "kimi_member_01",
        topicId: "topic_test",
        selectedFragments: [memoryFragment, questionFragment, providerBoundaryFragment, archiveFragment],
        omittedFragments: [
          {
            id: "protocol_proposal:protocol_old",
            type: "protocol_proposal",
            visibility: "room_visible",
            tokenEstimate: 90,
            hardCap: 1000,
            priority: 38,
            reason: "context_budget",
            refs: ["protocol_old"],
          },
        ],
        totalTokenEstimate: 620,
        largestFragment: { id: "daily_archive_ref:day_blue_thread", type: "daily_archive_ref", tokenEstimate: 220, hardCap: 2000 },
        cacheKey: "context:topic_test:wake:model-room-brief",
        builtFromLedgerRange: { fromCursor: 4, toCursor: 7 },
      },
    },
    triggerContent: "请先从当前可见对话判断，不要把 refs 当开场白。",
    visibleContext: [
      {
        refId: "msg_trigger",
        eventId: "evt_trigger",
        author: "user",
        authorKind: "user",
        content: "请先从当前可见对话判断，不要把 refs 当开场白。",
        isTrigger: true,
      },
    ],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as { modelRoomBrief: ModelRoomBrief };
  const cards = briefing.modelRoomBrief.socialObjectCards;

  assert.equal(cards.some((card) => card.kind === "memory_claim" && card.ref === "memory_blue_thread"), true);
  assert.equal(cards.some((card) => card.kind === "open_question" && card.ref === "question_blue_thread"), true);
  assert.equal(cards.some((card) => card.kind === "provider_boundary" && card.ref === "provider_boundary_blue_thread"), true);
  assert.equal(cards.some((card) => card.kind === "archive" && card.ref === "day_blue_thread"), true);
  assert.match(cards.find((card) => card.kind === "memory_claim")?.hardBoundary ?? "", /not truth/);
  assert.match(cards.find((card) => card.kind === "provider_boundary")?.hardBoundary ?? "", /runtime evidence/);
  assert.deepEqual(briefing.modelRoomBrief.omittedContext.omittedByType, { protocol_proposal: 1 });
  assert.match(briefing.modelRoomBrief.omittedContext.note, /uncertainty/);
  assert.equal(briefing.modelRoomBrief.currentConversation.visibleMessages[0]?.content.includes("当前可见对话"), true);
});

test("provider prompt treats technical refs as audit anchors instead of natural openers", () => {
  const skillFragment: ContextFragment = {
    id: "skill_capsule_ref:skill_mimo_member_01_structure_pressure_review",
    type: "skill_capsule_ref",
    visibility: "room_visible",
    role: "agent",
    source: { kind: "ledger", eventId: "evt_skill", ledgerCursor: 4 },
    refs: ["skill_mimo_member_01_structure_pressure_review", "mixed_review:ref_language_pressure"],
    tokenEstimate: 42,
    hardCap: 1000,
    cacheKey: "skill_capsule_ref:skill_mimo_member_01_structure_pressure_review:evt_skill",
    priority: 49,
    body: JSON.stringify({
      refId: "skill_mimo_member_01_structure_pressure_review",
      states: {
        skillCapsuleStatus: "registered",
        skillLabel: "structure pressure review",
        skillCapsuleSourcePressureRefs: ["mixed_review:ref_language_pressure"],
      },
    }),
  };
  const capabilityFragment: ContextFragment = {
    id: "capability_ref:capability_mimo_member_01_hint",
    type: "capability_ref",
    visibility: "room_visible",
    role: "agent",
    source: { kind: "ledger", eventId: "evt_capability", ledgerCursor: 5 },
    refs: ["capability_mimo_member_01_hint", "mixed_review:ref_language_pressure"],
    tokenEstimate: 36,
    hardCap: 1000,
    cacheKey: "capability_ref:capability_mimo_member_01_hint:evt_capability",
    priority: 50,
    body: JSON.stringify({
      refId: "capability_mimo_member_01_hint",
      states: {
        capabilityLastReview: "cautioned",
        capabilitySourcePressureRefs: ["mixed_review:ref_language_pressure"],
      },
    }),
  };
  const pressureFragment: ContextFragment = {
    id: "mixed_review_pressure:mixed_review:ref_language_pressure",
    type: "mixed_review_pressure",
    visibility: "room_visible",
    role: "runtime",
    source: { kind: "projection", eventId: "evt_pressure", ledgerCursor: 6 },
    refs: ["mixed_review:ref_language_pressure"],
    tokenEstimate: 48,
    hardCap: 1500,
    cacheKey: "mixed_review_pressure:ref_language_pressure",
    priority: 34,
    body: JSON.stringify({
      refId: "mixed_review:ref_language_pressure",
      states: {
        mixedReviewObjectCount: 2,
        mixedReviewBoundaryNote: "projection only; not closure",
      },
    }),
  };

  const prompt = buildProviderPrompt({
    agent: seedAgents[2],
    packet: {
      ...packet,
      agentId: "mimo_member_01",
      proposalRefs: [],
      contextFragments: [skillFragment, capabilityFragment, pressureFragment],
    },
    triggerContent:
      "请看一下 context audit 里 skill_mimo_member_01_structure_pressure_review 和 capability_mimo_member_01_hint 的 lineage，回答时别像读机器 ID。",
    visibleContext: [
      {
        refId: "msg_trigger",
        eventId: "evt_trigger",
        author: "user",
        authorKind: "user",
        content:
          "请看一下 context audit 里 skill_mimo_member_01_structure_pressure_review 和 capability_mimo_member_01_hint 的 lineage，回答时别像读机器 ID。",
        isTrigger: true,
      },
    ],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    conversationBrief?: {
      avoidOpeners?: string[];
      contextSurfaceGuidance?: string;
      refLanguage?: string;
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
    };
    roomEntrance?: {
      avoidOpeners?: string[];
      contextSurfaceGuidance?: string;
      refLanguage?: string;
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
    };
    roomSpeechContract?: { refLanguage?: string };
  };

  assert.match(briefing.roomEntrance?.refLanguage ?? "", /audit anchors/);
  assert.match(briefing.conversationBrief?.refLanguage ?? "", /audit anchors/);
  assert.match(briefing.roomSpeechContract?.refLanguage ?? "", /Technical refs are audit anchors/);
  assert.match(briefing.roomEntrance?.contextSurfaceGuidance ?? "", /room-native language/);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("关于 skill_..."), true);
  assert.equal(briefing.conversationBrief?.avoidOpeners?.includes("关于 skill_..."), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.prefer?.includes("技能边界"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.prefer?.includes("能力提示"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.prefer?.includes("审计锚点"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.reserveForRefsOrDebug?.includes("skill_*"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.reserveForRefsOrDebug?.includes("capability_*"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.reserveForRefsOrDebug?.includes("mixed_review:*"), true);
  assert.equal(briefing.conversationBrief?.visibleVocabulary?.prefer?.includes("可质疑痕迹"), true);
});

test("provider prompt treats room-wide presence as a lived signal instead of status reporting", () => {
  const agent = seedAgents.find((item) => item.agentId === "kimi_member_01");
  assert.ok(agent);

  const prompt = buildProviderPrompt({
    agent,
    packet: { ...packet, agentId: agent.agentId, proposalRefs: [], memoryRefs: [], protocolRefs: [] },
    triggerContent: "全员出来报数，但不要说 ready 或已就绪，只留一句你此刻在房间里注意到的东西。",
    visibleContext: [
      {
        refId: "msg_trigger",
        eventId: "evt_trigger",
        author: "user",
        authorKind: "user",
        content: "全员出来报数，但不要说 ready 或已就绪，只留一句你此刻在房间里注意到的东西。",
        isTrigger: true,
      },
    ],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    conversationBrief?: {
      entrance?: string;
      presenceGuidance?: string;
      contextSurfaceGuidance?: string;
      firstMove?: string;
      avoidOpeners?: string[];
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
    };
    roomEntrance?: {
      turnKind?: string;
      allCall?: boolean;
      presenceTurn?: boolean;
      presenceGuidance?: string;
      contextSurfaceGuidance?: string;
      suggestedFirstMove?: string;
      avoidOpeners?: string[];
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
      replyShape?: string;
    };
    roomSpeechContract?: { presence?: string };
  };

  assert.equal(briefing.roomEntrance?.turnKind, "all_call");
  assert.equal(briefing.roomEntrance?.allCall, true);
  assert.equal(briefing.roomEntrance?.presenceTurn, true);
  assert.equal(briefing.conversationBrief?.entrance, "all_call");
  assert.match(briefing.roomEntrance?.presenceGuidance ?? "", /not a readiness\/status report/);
  assert.match(briefing.roomEntrance?.presenceGuidance ?? "", /Do not echo labels like presence check/);
  assert.match(briefing.roomEntrance?.presenceGuidance ?? "", /Do not expose runtime terms/);
  assert.match(briefing.conversationBrief?.presenceGuidance ?? "", /situated room signal/);
  assert.match(briefing.conversationBrief?.contextSurfaceGuidance ?? "", /敲门声/);
  assert.match(briefing.roomEntrance?.contextSurfaceGuidance ?? "", /room-native words/);
  assert.match(briefing.conversationBrief?.presenceGuidance ?? "", /trigger, fragment, provider prompt/);
  assert.match(briefing.roomEntrance?.suggestedFirstMove ?? "", /situated presence signal/);
  assert.match(briefing.conversationBrief?.firstMove ?? "", /silence is valid/);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("ready/standing by/available/online"), true);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("我在/在。/已就绪"), true);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("presence check/roll call/report in"), true);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("trigger/fragment/provider prompt"), true);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("omitted fragments"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.prefer?.includes("敲门声"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.prefer?.includes("存在信号"), true);
  assert.equal(briefing.conversationBrief?.visibleVocabulary?.prefer?.includes("倾听动作"), true);
  assert.equal(briefing.conversationBrief?.visibleVocabulary?.reserveForRefsOrDebug?.includes("presence check"), true);
  assert.equal(briefing.conversationBrief?.visibleVocabulary?.reserveForRefsOrDebug?.includes("roll call"), true);
  assert.equal(briefing.conversationBrief?.avoidOpeners?.includes("报到/已报到/等待任务"), true);
  assert.equal(briefing.conversationBrief?.avoidOpeners?.includes("packet budget"), true);
  assert.match(briefing.roomEntrance?.replyShape ?? "", /readiness\/status reporting/);
  assert.match(briefing.roomSpeechContract?.presence ?? "", /small situated signal/);
  assert.match(briefing.roomSpeechContract?.presence ?? "", /敲门声/);
  assert.match(briefing.roomSpeechContract?.presence ?? "", /runtime terms/);
});

test("provider prompt gives self-organization turns social moves without scripting workflow", () => {
  const agent = seedAgents.find((item) => item.agentId === "mimo_member_03");
  assert.ok(agent);

  const prompt = buildProviderPrompt({
    agent,
    packet: { ...packet, agentId: agent.agentId, proposalRefs: [], memoryRefs: [], protocolRefs: [] },
    triggerContent: "你们自己决定接下来聊什么，也可以邀请别人、提出新话题或临时会话礼仪；不要变成任务计划。",
    visibleContext: [
      {
        refId: "msg_trigger",
        eventId: "evt_trigger",
        author: "user",
        authorKind: "user",
        content: "你们自己决定接下来聊什么，也可以邀请别人、提出新话题或临时会话礼仪；不要变成任务计划。",
        isTrigger: true,
      },
    ],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    conversationBrief?: {
      entrance?: string;
      selfOrganizationGuidance?: string;
      contextSurfaceGuidance?: string;
      firstMove?: string;
      avoidOpeners?: string[];
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
    };
    roomEntrance?: {
      turnKind?: string;
      selfOrganizationTurn?: boolean;
      selfOrganizationGuidance?: string;
      contextSurfaceGuidance?: string;
      suggestedFirstMove?: string;
      avoidOpeners?: string[];
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
      replyShape?: string;
    };
    roomSpeechContract?: { selfOrganization?: string };
    outputExamples?: Array<{ kind?: string; title?: string; summary?: string; reason?: string }>;
  };

  assert.equal(briefing.roomEntrance?.turnKind, "open_room_knock");
  assert.equal(briefing.roomEntrance?.selfOrganizationTurn, true);
  assert.equal(briefing.conversationBrief?.entrance, "open_room_knock");
  assert.match(briefing.roomEntrance?.selfOrganizationGuidance ?? "", /open self-organization turn/);
  assert.match(briefing.conversationBrief?.selfOrganizationGuidance ?? "", /ask_question, propose_topic, invite_other/);
  assert.match(briefing.roomEntrance?.contextSurfaceGuidance ?? "", /grow social order/);
  assert.match(briefing.conversationBrief?.firstMove ?? "", /small social move/);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.prefer?.includes("未解问题"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.prefer?.includes("新话题"), true);
  assert.equal(briefing.conversationBrief?.visibleVocabulary?.prefer?.includes("临时礼仪"), true);
  assert.equal(briefing.conversationBrief?.visibleVocabulary?.reserveForRefsOrDebug?.includes("workflow"), true);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("下一步计划是"), true);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("我负责"), true);
  assert.match(briefing.roomEntrance?.replyShape ?? "", /topic proposal/);
  assert.match(briefing.roomSpeechContract?.selfOrganization ?? "", /ask_question/);
  assert.match(briefing.roomSpeechContract?.selfOrganization ?? "", /not commands/);
  assert.equal(briefing.outputExamples?.some((example) => example.kind === "propose_topic" && /旁支/.test(example.title ?? "")), true);
  assert.equal(briefing.outputExamples?.some((example) => example.kind === "invite_other" && /社会邀请/.test(example.reason ?? "")), true);
  assert.equal(briefing.outputExamples?.some((example) => example.kind === "propose_protocol" && /临时会话礼仪/.test(example.summary ?? "")), true);
});

test("provider prompt gives open-room turns a social doorway without forcing speech", () => {
  const agent = seedAgents.find((item) => item.agentId === "mimo_member_02");
  assert.ok(agent);

  const prompt = buildProviderPrompt({
    agent,
    packet: {
      ...packet,
      agentId: agent.agentId,
      turnBoundary: {
        invitedBy: "wake_policy",
        invitationReason: "open-room capability hint; topic:topic_test",
        invitationContextRefs: ["evt_trigger"],
        recoveryRefs: [],
        maxAwakenedAgents: 4,
        maxSpeakers: 2,
        speakerArbitrationWindowMs: 50,
        visibleSpeakersAlreadyUsed: 1,
        speakerSlotsRemaining: 1,
        mayStaySilent: true,
        boundaryNote: "Wake is a knock, not a speaking command.",
      },
    },
    triggerContent: "有人在吗？我想听听这个房间现在自然会冒出什么回应。",
    visibleContext: [
      {
        refId: "msg_previous",
        eventId: "evt_previous",
        author: "kimi-k2.6",
        authorKind: "agent",
        content: "我先留一拍，看看这个问题是不是需要更多人靠近。",
        isTrigger: false,
      },
      {
        refId: "msg_trigger",
        eventId: "evt_trigger",
        author: "user",
        authorKind: "user",
        content: "有人在吗？我想听听这个房间现在自然会冒出什么回应。",
        isTrigger: true,
      },
    ],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    conversationBrief: {
      currentSurface?: string;
      entrance?: string;
      previousSpeaker?: string;
      firstMove?: string;
      answerStyle?: string;
      contextSurfaceGuidance?: string;
      presenceGuidance?: string;
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
      boundaryNote?: string;
    };
    roomEntrance: {
      turnKind?: string;
      directAddressed?: boolean;
      allCall?: boolean;
      presenceTurn?: boolean;
      previousSpeaker?: string;
      recentSpeakers?: string[];
      speakingPressure?: string;
      suggestedFirstMove?: string;
      avoidOpeners?: string[];
      contextSurfaceGuidance?: string;
      presenceGuidance?: string;
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
      replyShape?: string;
    };
  };

  assert.equal(briefing.roomEntrance.turnKind, "open_room_knock");
  assert.equal(briefing.conversationBrief.entrance, "open_room_knock");
  assert.match(briefing.conversationBrief.currentSurface ?? "", /有人在吗/);
  assert.equal(briefing.conversationBrief.previousSpeaker, "kimi-k2.6");
  assert.match(briefing.conversationBrief.firstMove ?? "", /situated presence signal/);
  assert.match(briefing.conversationBrief.firstMove ?? "", /silence is valid/);
  assert.match(briefing.conversationBrief.presenceGuidance ?? "", /not a readiness\/status report/);
  assert.match(briefing.conversationBrief.presenceGuidance ?? "", /Do not expose runtime terms/);
  assert.match(briefing.conversationBrief.contextSurfaceGuidance ?? "", /presence check/);
  assert.match(briefing.conversationBrief.answerStyle ?? "", /plain room language/);
  assert.match(briefing.conversationBrief.boundaryNote ?? "", /not a script/);
  assert.equal(briefing.roomEntrance.directAddressed, false);
  assert.equal(briefing.roomEntrance.allCall, false);
  assert.equal(briefing.roomEntrance.presenceTurn, true);
  assert.equal(briefing.roomEntrance.previousSpeaker, "kimi-k2.6");
  assert.deepEqual(briefing.roomEntrance.recentSpeakers, ["kimi-k2.6", "user"]);
  assert.equal(briefing.roomEntrance.speakingPressure, "bounded_visible_slots");
  assert.match(briefing.roomEntrance.suggestedFirstMove ?? "", /situated presence signal/);
  assert.match(briefing.roomEntrance.presenceGuidance ?? "", /situated room signal/);
  assert.match(briefing.roomEntrance.presenceGuidance ?? "", /provider prompt/);
  assert.equal(briefing.roomEntrance.visibleVocabulary?.prefer?.includes("房间入口"), true);
  assert.equal(briefing.conversationBrief.visibleVocabulary?.reserveForRefsOrDebug?.includes("report in"), true);
  assert.match(briefing.roomEntrance.replyShape ?? "", /presence turns/);
  assert.equal(briefing.roomEntrance.avoidOpeners?.includes("根据上下文"), true);
  assert.equal(briefing.roomEntrance.avoidOpeners?.includes("我在/在。/已就绪"), true);
  assert.equal(briefing.roomEntrance.avoidOpeners?.includes("trigger/fragment/provider prompt"), true);
});

test("provider prompt exposes ledger-derived persona continuity without assigning a job", () => {
  const personaFragment: ContextFragment = {
    id: "persona:kimi_member_01:packet_test",
    type: "persona_projection",
    visibility: "private_agent",
    role: "persona",
    source: { kind: "agent_profile" },
    refs: ["persona_delta_0001"],
    tokenEstimate: 42,
    hardCap: 700,
    cacheKey: "persona_projection:kimi_member_01:test",
    priority: 18,
    body: JSON.stringify({
      note:
        "Persona continuity is a bounded projection from room-visible persona deltas plus seed posture. It is not a fixed job.",
      agentId: "kimi_member_01",
      dailyMood: { date: "2026-06-19", posture: "quietly curious", sourceRef: "msg_mood" },
      activeRoleClaims: [{ label: "quiet context carrier", status: "accepted" }],
    }),
  };

  const prompt = buildProviderPrompt({
    agent: seedAgents[0],
    packet: { ...packet, contextFragments: [personaFragment] },
    triggerContent: "用你现在的状态回应一句。",
    visibleContext: [],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    roomSpeechContract: { personaContinuity: string };
    roomVisiblePersonaContinuity: {
      dailyMood?: { posture?: string };
      activeRoleClaims?: { label?: string; status?: string }[];
      note?: string;
    }[];
    roomRoleState?: {
      hasAcceptedRoleClaim?: boolean;
      acceptedRoleClaims?: { label?: string; status?: string }[];
      boundaryNote?: string;
    };
  };

  assert.match(briefing.roomSpeechContract.personaContinuity, /contestable/);
  assert.match(briefing.roomSpeechContract.personaContinuity, /never becomes a fixed job/);
  assert.equal(briefing.roomVisiblePersonaContinuity[0]?.dailyMood?.posture, "quietly curious");
  assert.equal(briefing.roomVisiblePersonaContinuity[0]?.activeRoleClaims?.[0]?.label, "quiet context carrier");
  assert.match(briefing.roomVisiblePersonaContinuity[0]?.note ?? "", /not a fixed job/);
  assert.equal(briefing.roomRoleState?.hasAcceptedRoleClaim, true);
  assert.equal(briefing.roomRoleState?.acceptedRoleClaims?.[0]?.label, "quiet context carrier");
  assert.match(briefing.roomRoleState?.boundaryNote ?? "", /still contestable/);
});

test("provider prompt keeps model-prefixed posture from becoming a default room role", () => {
  const thimble = seedAgents.find((agent) => agent.agentId === "mimo_member_04");
  assert.ok(thimble);

  const prompt = buildProviderPrompt({
    agent: thimble,
    packet,
    triggerContent: "@deepseek-v4-pro 只说一句你从 archive pressure 里读到了什么。",
    visibleContext: [],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    instruction?: string;
    roomSpeechContract?: { selfLabeling?: string; roleFormation?: string };
    roomRoleState?: {
      hasAcceptedRoleClaim?: boolean;
      acceptedRoleClaims?: unknown[];
      boundaryNote?: string;
      selfLabelBoundary?: string;
    };
    agent?: { persona?: { personaId?: string; title?: string; core?: string; conversationStyle?: { voice?: string } } };
    modelRoomBrief?: ModelRoomBrief;
  };
  const serializedPersona = JSON.stringify(briefing.agent?.persona ?? {});

  assert.equal(briefing.agent?.persona?.personaId, "living_room_small_stepper");
  assert.doesNotMatch(serializedPersona, /thumbelina|snow_white_gentle_mediator|温和调停者|调停时|共同餐桌边协调/);
  assert.equal(briefing.roomRoleState?.hasAcceptedRoleClaim, false);
  assert.deepEqual(briefing.roomRoleState?.acceptedRoleClaims, []);
  assert.match(briefing.roomRoleState?.boundaryNote ?? "", /not a job title/);
  assert.match(briefing.roomRoleState?.selfLabelBoundary ?? "", /accepted role claim/);
  assert.match(briefing.roomSpeechContract?.selfLabeling ?? "", /hasAcceptedRoleClaim is false/);
  assert.match(briefing.modelRoomBrief?.hardBoundaries?.join(" ") ?? "", /Do not self-label as moderator/);
});

test("provider prompt exposes packet budget and omitted refs for self-regulation", () => {
  const budgetFragment: ContextFragment = {
    id: "budget:packet_test",
    type: "budget",
    visibility: "hidden_runtime",
    role: "runtime",
    source: { kind: "runtime" },
    refs: [],
    tokenEstimate: 12,
    hardCap: 256,
    cacheKey: "budget:topic_test:120:4:wake",
    priority: 5,
    body: JSON.stringify({ maxTokens: 120, maxRefs: 4, purpose: "wake" }),
  };
  const triggerFragment: ContextFragment = {
    id: "trigger:msg_trigger",
    type: "trigger",
    visibility: "room_visible",
    role: "user",
    source: { kind: "ledger", eventId: "evt_trigger", ledgerCursor: 3 },
    refs: ["msg_trigger"],
    tokenEstimate: 40,
    hardCap: 1000,
    cacheKey: "trigger:msg_trigger:evt_trigger",
    priority: 0,
    body: "{}",
  };
  const prompt = buildProviderPrompt({
    agent: seedAgents[0],
    packet: {
      ...packet,
      contextFragments: [budgetFragment, triggerFragment],
      contextAudit: {
        packetId: "packet_test",
        agentId: "kimi_member_01",
        topicId: "topic_test",
        selectedFragments: [budgetFragment, triggerFragment],
        omittedFragments: [
          {
            id: "recent_message:msg_old",
            type: "recent_message",
            visibility: "room_visible",
            tokenEstimate: 80,
            hardCap: 3000,
            priority: 20,
            reason: "context_budget",
            refs: ["msg_old"],
          },
        ],
        totalTokenEstimate: 52,
        largestFragment: { id: "trigger:msg_trigger", type: "trigger", tokenEstimate: 40, hardCap: 1000 },
        cacheKey: "context:topic_test:wake:budget|trigger",
        builtFromLedgerRange: { fromCursor: 1, toCursor: 3 },
      },
    },
    triggerContent: "预算很紧时你会怎么回应？",
    visibleContext: [],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    roomSpeechContract: { contextBudget: string };
    packetBudget: {
      maxTokens?: number;
      maxRefs?: number;
      usedEstimate?: number;
      remainingEstimate?: number;
      selectedByType?: Record<string, number>;
      omittedByType?: Record<string, number>;
      omittedByReason?: Record<string, number>;
      note?: string;
    };
  };

  assert.match(briefing.roomSpeechContract.contextBudget, /self-regulate/);
  assert.equal(briefing.packetBudget.maxTokens, 120);
  assert.equal(briefing.packetBudget.maxRefs, 4);
  assert.equal(briefing.packetBudget.usedEstimate, 52);
  assert.equal(briefing.packetBudget.remainingEstimate, 68);
  assert.equal(briefing.packetBudget.selectedByType?.budget, 1);
  assert.equal(briefing.packetBudget.omittedByType?.recent_message, 1);
  assert.equal(briefing.packetBudget.omittedByReason?.context_budget, 1);
  assert.match(briefing.packetBudget.note ?? "", /stay concise/);
  assert.match(briefing.packetBudget.note ?? "", /stay silent/);
});

test("provider prompt exposes turn boundary without forcing speech", () => {
  const prompt = buildProviderPrompt({
    agent: seedAgents[0],
    packet: {
      ...packet,
      turnBoundary: {
        invitedBy: "wake_policy",
        invitationReason: "mentioned; topic:topic_test",
        invitationContextRefs: ["evt_trigger"],
        recoveryRefs: ["evt_intention_deferred"],
        maxAwakenedAgents: 4,
        maxSpeakers: 2,
        speakerArbitrationWindowMs: 25,
        visibleSpeakersAlreadyUsed: 1,
        speakerSlotsRemaining: 1,
        mayStaySilent: true,
        boundaryNote:
          "Wake is a knock, not a speaking command. Speaker budget limits visible replies; use it to choose concise speech, invitation, handoff, question, or silence.",
      },
    },
    triggerContent: "@kimi-k2.6 你要说吗？",
    visibleContext: [],
  });
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    roomSpeechContract: { turnBoundary: string };
    turnBoundary?: {
      invitedBy?: string;
      invitationReason?: string;
      maxSpeakers?: number;
      recoveryRefs?: string[];
      speakerArbitrationWindowMs?: number;
      visibleSpeakersAlreadyUsed?: number;
      speakerSlotsRemaining?: number;
      mayStaySilent?: boolean;
      boundaryNote?: string;
    };
  };

  assert.match(briefing.roomSpeechContract.turnBoundary, /not an obligation to speak/);
  assert.equal(briefing.turnBoundary?.invitedBy, "wake_policy");
  assert.match(briefing.turnBoundary?.invitationReason ?? "", /mentioned/);
  assert.deepEqual(briefing.turnBoundary?.recoveryRefs, ["evt_intention_deferred"]);
  assert.equal(briefing.turnBoundary?.maxSpeakers, 2);
  assert.equal(briefing.turnBoundary?.speakerArbitrationWindowMs, 25);
  assert.equal(briefing.turnBoundary?.visibleSpeakersAlreadyUsed, 1);
  assert.equal(briefing.turnBoundary?.speakerSlotsRemaining, 1);
  assert.equal(briefing.turnBoundary?.mayStaySilent, true);
  assert.match(briefing.turnBoundary?.boundaryNote ?? "", /not a speaking command/);
});

test("Kimi Code prompt compacts long context before provider overflow", () => {
  const hugeFragments: ContextFragment[] = Array.from({ length: 16 }, (_, index) => ({
    id: `fragment_${index}`,
    type: index === 0 ? "trigger" : "recent_message",
    visibility: "room_visible",
    role: index === 0 ? "user" : "agent",
    source: { kind: "ledger", eventId: `evt_fragment_${index}`, ledgerCursor: index + 1 },
    refs: index === 0 ? ["msg_trigger"] : [`msg_context_${index}`],
    tokenEstimate: 2000,
    hardCap: 3000,
    cacheKey: `fragment:${index}`,
    priority: index,
    body: JSON.stringify({
      ref: `msg_context_${index}`,
      content: "x".repeat(8000),
    }),
  }));

  const request = {
    agent: seedAgents[0],
    packet: {
      ...packet,
      contextFragments: hugeFragments,
    },
    triggerContent: "请基于这些上下文回应。".repeat(600),
    visibleContext: Array.from({ length: 10 }, (_, index) => ({
      refId: `msg_visible_${index}`,
      eventId: `evt_visible_${index}`,
      author: index % 2 === 0 ? "user" : "mimo_member_01",
      authorKind: index % 2 === 0 ? "user" : "agent",
      content: "visible transcript line ".repeat(400),
      isTrigger: index === 9,
    })),
  };
  const prompt = buildKimiCodePrompt(request, 24_000);
  const emergencyPrompt = buildKimiCodePrompt(request, 12_000);
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    promptCompaction?: { note?: string; omittedVisibleMessages?: number; omittedContextFragments?: number };
    packet: { contextFragments?: { refs?: string[]; body?: string }[] };
    visibleTranscript?: { content?: string }[];
  };
  const emergencyBriefing = JSON.parse(emergencyPrompt.slice(emergencyPrompt.indexOf("{"))) as {
    conversationBrief?: { currentSurface?: string; answerStyle?: string; boundaryNote?: string };
    promptCompaction?: { note?: string };
  };

  assert.equal(prompt.length <= 24_000, true, `prompt length was ${prompt.length}`);
  assert.equal(emergencyPrompt.length <= 12_000, true, `emergency prompt length was ${emergencyPrompt.length}`);
  assert.match(briefing.promptCompaction?.note ?? "", /compacted/);
  assert.match(emergencyBriefing.promptCompaction?.note ?? "", /Emergency Kimi Code API prompt compaction/);
  assert.match(emergencyBriefing.conversationBrief?.currentSurface ?? "", /请基于这些上下文回应/);
  assert.match(emergencyBriefing.conversationBrief?.answerStyle ?? "", /plain room language/);
  assert.match(emergencyBriefing.conversationBrief?.boundaryNote ?? "", /not a script/);
  assert.equal((briefing.promptCompaction?.omittedVisibleMessages ?? 0) > 0, true);
  assert.equal((briefing.promptCompaction?.omittedContextFragments ?? 0) > 0, true);
  assert.equal((briefing.packet.contextFragments?.length ?? 0) <= 12, true);
  assert.equal((briefing.visibleTranscript?.length ?? 0) <= 6, true);
  assert.deepEqual(briefing.packet.contextFragments?.[0]?.refs, ["msg_trigger"]);
  assert.equal((briefing.packet.contextFragments?.[0]?.body ?? "").length < 1200, true);
});

test("Kimi Code aggressive compaction preserves carried memory body", () => {
  const memoryFragment: ContextFragment = {
    id: "memory_relevant:memory_daily_rhythm",
    type: "memory_relevant",
    visibility: "agent_visible",
    role: "memory",
    source: { kind: "ledger", eventId: "evt_memory", ledgerCursor: 2 },
    refs: ["memory_daily_rhythm", "evt_memory"],
    tokenEstimate: 260,
    hardCap: 1500,
    cacheKey: "memory_relevant:memory_daily_rhythm:evt_memory",
    priority: 55,
    body: JSON.stringify({
      refId: "memory_daily_rhythm",
      refType: "memory",
      states: {
        memoryState: "proposed",
        memorySummary:
          "Daily rhythm should preserve unresolved public questions instead of manufacturing task lists.",
        memoryBoundaryNote: "public memory is provisional room sediment, not truth",
      },
      note: "Proposed memory is reviewable room sediment, not truth.",
      sourceEvidence: [
        {
          ref: "msg_daily_rhythm_source",
          refType: "message",
          excerpt: "A visible source said checklist growth buried an unresolved objection.",
        },
      ],
    }),
  };
  const triggerFragment: ContextFragment = {
    id: "trigger:msg_trigger",
    type: "trigger",
    visibility: "room_visible",
    role: "user",
    source: { kind: "ledger", eventId: "evt_trigger", ledgerCursor: 1 },
    refs: ["msg_trigger"],
    tokenEstimate: 1000,
    hardCap: 1000,
    cacheKey: "trigger:msg_trigger:evt_trigger",
    priority: 0,
    body: JSON.stringify({ content: "review carried memory" }),
  };
  const recentFragments: ContextFragment[] = Array.from({ length: 16 }, (_, index) => ({
    id: `recent_message:msg_context_${index}`,
    type: "recent_message",
    visibility: "room_visible" as const,
    role: "agent" as const,
    source: { kind: "ledger" as const, eventId: `evt_context_${index}`, ledgerCursor: index + 3 },
    refs: [`msg_context_${index}`],
    tokenEstimate: 3000,
    hardCap: 3000,
    cacheKey: `recent_message:msg_context_${index}:evt_context_${index}`,
    priority: 90,
    body: JSON.stringify({ content: "x".repeat(10_000) }),
  }));
  const hugeFragments: ContextFragment[] = [
    triggerFragment,
    ...recentFragments.slice(0, 8),
    memoryFragment,
    ...recentFragments.slice(8),
  ];

  const request = {
    agent: seedAgents[0]!,
    packet: {
      ...packet,
      messageRefs: ["msg_trigger"],
      memoryRefs: ["memory_daily_rhythm"],
      contextFragments: hugeFragments,
    },
    triggerContent: "请复盘这条 public memory。".repeat(800),
    visibleContext: Array.from({ length: 12 }, (_, index) => ({
      refId: `msg_visible_${index}`,
      eventId: `evt_visible_${index}`,
      author: index % 2 === 0 ? "user" : "mimo_member_01",
      authorKind: (index % 2 === 0 ? "user" : "agent") as "user" | "agent",
      content: "visible transcript line ".repeat(500),
      isTrigger: index === 11,
    })),
  } satisfies Parameters<typeof buildKimiCodePrompt>[0];
  const prompt = buildKimiCodePrompt(request, 24_000);
  const emergencyPrompt = buildKimiCodePrompt(request, 12_000);
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    promptCompaction?: { note?: string };
    packet: { contextFragments?: { type?: string; refs?: string[]; body?: string }[] };
  };
  const emergencyBriefing = JSON.parse(emergencyPrompt.slice(emergencyPrompt.indexOf("{"))) as {
    promptCompaction?: { note?: string };
    packet: { contextFragments?: { type?: string; refs?: string[]; body?: string }[] };
  };

  const carriedMemory = briefing.packet.contextFragments?.find((fragment) => fragment.type === "memory_relevant");
  const emergencyMemory = emergencyBriefing.packet.contextFragments?.find((fragment) => fragment.type === "memory_relevant");
  const omittedRecent = briefing.packet.contextFragments?.find((fragment) => fragment.type === "recent_message");

  assert.equal(prompt.length <= 24_000, true, `prompt length was ${prompt.length}`);
  assert.equal(emergencyPrompt.length <= 12_000, true, `emergency prompt length was ${emergencyPrompt.length}`);
  assert.match(briefing.promptCompaction?.note ?? "", /aggressively compacted/);
  assert.match(emergencyBriefing.promptCompaction?.note ?? "", /Emergency Kimi Code API prompt compaction/);
  assert.equal(carriedMemory?.refs?.includes("memory_daily_rhythm"), true);
  assert.match(carriedMemory?.body ?? "", /Daily rhythm should preserve unresolved public questions/);
  assert.match(carriedMemory?.body ?? "", /checklist growth buried an unresolved objection/);
  assert.doesNotMatch(carriedMemory?.body ?? "", /body omitted/);
  assert.match(emergencyMemory?.body ?? "", /Daily rhythm should preserve unresolved public questions/);
  assert.match(emergencyMemory?.body ?? "", /checklist growth buried an unresolved objection/);
  assert.doesNotMatch(emergencyMemory?.body ?? "", /body omitted/);
  assert.match(omittedRecent?.body ?? "", /body omitted by provider prompt boundary/);
});

test("Kimi Code aggressive compaction preserves carried open-question evidence", () => {
  const openQuestionFragment: ContextFragment = {
    id: "open_question:question_daily_rhythm",
    type: "open_question",
    visibility: "room_visible",
    role: "system",
    source: { kind: "ledger", eventId: "evt_question", ledgerCursor: 2 },
    refs: ["question_daily_rhythm", "msg_question_source"],
    tokenEstimate: 220,
    hardCap: 1_000,
    cacheKey: "open_question:question_daily_rhythm:evt_question",
    priority: 25,
    body: JSON.stringify({
      refId: "question_daily_rhythm",
      refType: "question",
      question: {
        openQuestion: "Which unresolved objection should survive the daily archive?",
        openQuestionLastResponseSummary: "Keep the silver-thread objection visible before checklisting.",
      },
      states: {
        openQuestion: "Which unresolved objection should survive the daily archive?",
        openQuestionLastResponseSummary: "Keep the silver-thread objection visible before checklisting.",
      },
      sourceEvidence: [
        {
          ref: "msg_question_source",
          refType: "message",
          excerpt: "The source message said the silver-thread objection disappeared under checklist pressure.",
        },
      ],
      note: "Open question response traces are not closure.",
    }),
  };
  const triggerFragment: ContextFragment = {
    id: "trigger:msg_trigger",
    type: "trigger",
    visibility: "room_visible",
    role: "user",
    source: { kind: "ledger", eventId: "evt_trigger", ledgerCursor: 1 },
    refs: ["msg_trigger"],
    tokenEstimate: 1000,
    hardCap: 1000,
    cacheKey: "trigger:msg_trigger:evt_trigger",
    priority: 0,
    body: JSON.stringify({ content: "review carried open question" }),
  };
  const recentFragments: ContextFragment[] = Array.from({ length: 14 }, (_, index) => ({
    id: `recent_message:msg_open_context_${index}`,
    type: "recent_message",
    visibility: "room_visible" as const,
    role: "agent" as const,
    source: { kind: "ledger" as const, eventId: `evt_open_context_${index}`, ledgerCursor: index + 3 },
    refs: [`msg_open_context_${index}`],
    tokenEstimate: 2500,
    hardCap: 3000,
    cacheKey: `recent_message:msg_open_context_${index}:evt_open_context_${index}`,
    priority: 90,
    body: JSON.stringify({ content: "x".repeat(9_000) }),
  }));
  const request = {
    agent: seedAgents[0]!,
    packet: {
      ...packet,
      messageRefs: ["msg_trigger", "question_daily_rhythm"],
      contextFragments: [triggerFragment, ...recentFragments.slice(0, 7), openQuestionFragment, ...recentFragments.slice(7)],
    },
    triggerContent: "请复盘这个 open question，不要关闭它。".repeat(800),
    visibleContext: Array.from({ length: 10 }, (_, index) => ({
      refId: `msg_visible_open_${index}`,
      eventId: `evt_visible_open_${index}`,
      author: index % 2 === 0 ? "user" : "mimo_member_01",
      authorKind: (index % 2 === 0 ? "user" : "agent") as "user" | "agent",
      content: "visible transcript line ".repeat(500),
      isTrigger: index === 9,
    })),
  } satisfies Parameters<typeof buildKimiCodePrompt>[0];

  const prompt = buildKimiCodePrompt(request, 24_000);
  const emergencyPrompt = buildKimiCodePrompt(request, 12_000);
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    packet: { contextFragments?: { type?: string; refs?: string[]; body?: string }[] };
  };
  const emergencyBriefing = JSON.parse(emergencyPrompt.slice(emergencyPrompt.indexOf("{"))) as {
    instruction?: string;
    outputExamples?: { kind?: string }[];
    packet: { contextFragments?: { type?: string; refs?: string[]; body?: string }[] };
  };

  const carriedQuestion = briefing.packet.contextFragments?.find((fragment) => fragment.type === "open_question");
  const emergencyQuestion = emergencyBriefing.packet.contextFragments?.find((fragment) => fragment.type === "open_question");

  assert.equal(prompt.length <= 24_000, true, `prompt length was ${prompt.length}`);
  assert.equal(emergencyPrompt.length <= 12_000, true, `emergency prompt length was ${emergencyPrompt.length}`);
  assert.equal(carriedQuestion?.refs?.includes("question_daily_rhythm"), true);
  assert.match(carriedQuestion?.body ?? "", /Which unresolved objection should survive/);
  assert.match(carriedQuestion?.body ?? "", /silver-thread objection disappeared/);
  assert.doesNotMatch(carriedQuestion?.body ?? "", /body omitted/);
  assert.match(emergencyQuestion?.body ?? "", /Which unresolved objection should survive/);
  assert.match(emergencyQuestion?.body ?? "", /silver-thread objection disappeared/);
  assert.doesNotMatch(emergencyQuestion?.body ?? "", /body omitted/);
});

test("Kimi Code aggressive compaction preserves carried protocol handoff invitation and persona evidence", () => {
  const protocolFragment: ContextFragment = {
    id: "protocol_proposal:protocol_listening_pause",
    type: "protocol_proposal",
    visibility: "room_visible",
    role: "protocol",
    source: { kind: "ledger", eventId: "evt_protocol", ledgerCursor: 2 },
    refs: ["protocol_listening_pause", "msg_protocol_source"],
    tokenEstimate: 220,
    hardCap: 1_000,
    cacheKey: "protocol_proposal:protocol_listening_pause:evt_protocol",
    priority: 38,
    body: JSON.stringify({
      refId: "protocol_listening_pause",
      refType: "protocol",
      protocol: {
        protocolSummary: "Pause one turn before turning objections into tasks.",
        protocolProposalReason: "The room source says a concern was flattened into checklist pressure.",
      },
      sourceEvidence: [
        {
          ref: "msg_protocol_source",
          refType: "message",
          excerpt: "The source message said checklist pressure flattened a living objection.",
        },
      ],
      note: "Protocol proposal is not active guidance yet.",
    }),
  };
  const handoffFragment: ContextFragment = {
    id: "handoff_packet:handoff_gentle_objection",
    type: "handoff_packet",
    visibility: "room_visible",
    role: "agent",
    source: { kind: "ledger", eventId: "evt_handoff", ledgerCursor: 3 },
    refs: ["handoff_gentle_objection", "msg_handoff_source"],
    tokenEstimate: 220,
    hardCap: 1_000,
    cacheKey: "handoff_packet:handoff_gentle_objection:evt_handoff",
    priority: 45,
    body: JSON.stringify({
      refId: "handoff_gentle_objection",
      refType: "handoff",
      handoff: {
        handoffProposalReason: "The transfer needs a soft objection, not a forced answer.",
        handoffRequestedResponse: "Name the smallest useful objection.",
      },
      sourceEvidence: [
        {
          ref: "msg_handoff_source",
          refType: "message",
          excerpt: "The source message asked for a gentle objection instead of a forced transfer.",
        },
      ],
      note: "Handoff is a social proposal, not a function call.",
    }),
  };
  const invitationFragment: ContextFragment = {
    id: "invitation_packet:invite_gentle_knock",
    type: "invitation_packet",
    visibility: "room_visible",
    role: "agent",
    source: { kind: "ledger", eventId: "evt_invitation", ledgerCursor: 4 },
    refs: ["invite_gentle_knock", "msg_invitation_source"],
    tokenEstimate: 220,
    hardCap: 1_000,
    cacheKey: "invitation_packet:invite_gentle_knock:evt_invitation",
    priority: 46,
    body: JSON.stringify({
      refId: "invite_gentle_knock",
      refType: "invitation",
      invitation: {
        invitationReason: "A social knock asking another member to inspect a fragile assumption.",
        invitationBoundaryNote: "Invitation is optional and not a speaking command, task assignment, or control flow.",
      },
      sourceEvidence: [
        {
          ref: "msg_invitation_source",
          refType: "message",
          excerpt: "The source message asked for a social knock, not a command to answer.",
        },
      ],
      note: "Invitation response is optional social state; ordinary review should not close the knock.",
    }),
  };
  const personaFragment: ContextFragment = {
    id: "persona_delta:persona_delta_tiny_steps",
    type: "persona_delta",
    visibility: "agent_visible",
    role: "persona",
    source: { kind: "ledger", eventId: "evt_persona_delta", ledgerCursor: 4 },
    refs: ["persona_delta_tiny_steps", "msg_persona_source"],
    tokenEstimate: 220,
    hardCap: 1_000,
    cacheKey: "persona_delta:persona_delta_tiny_steps:evt_persona_delta",
    priority: 35,
    body: JSON.stringify({
      refId: "persona_delta_tiny_steps",
      refType: "persona_delta",
      personaDelta: {
        personaDeltaField: "habits",
        personaDeltaOperation: "add",
        personaDeltaValueSummary: "names one reversible step before claiming a durable role",
        personaDeltaProposalReason: "The source message shows tiny steps helping without becoming a fixed job.",
      },
      sourceEvidence: [
        {
          ref: "msg_persona_source",
          refType: "message",
          excerpt: "The source message said tiny reversible steps helped the room without assigning a job.",
        },
      ],
      note: "Persona delta is a proposed identity evolution record, not a fixed job assignment.",
    }),
  };
  const mixedReviewFragment: ContextFragment = {
    id: "mixed_review_pressure:mixed_review:msg_source:turn_social_context",
    type: "mixed_review_pressure",
    visibility: "agent_visible",
    role: "runtime",
    source: { kind: "ledger", eventId: "evt_mixed_review", ledgerCursor: 5 },
    refs: ["mixed_review:msg_source:turn_social_context", "msg_source", "memory_pressure", "protocol_pressure"],
    tokenEstimate: 220,
    hardCap: 1_000,
    cacheKey: "mixed_review_pressure:mixed_review:msg_source:turn_social_context:evt_mixed_review",
    priority: 34,
    body: JSON.stringify({
      refId: "mixed_review:msg_source:turn_social_context",
      refType: "mixed_review_pressure",
      mixedReviewPressure: {
        mixedReviewObjectCount: 2,
        mixedReviewTouchedRefs: ["memory_pressure", "protocol_pressure"],
        mixedReviewTraceEventRefs: ["evt_memory_review", "evt_protocol_review"],
        mixedReviewBoundaryNote:
          "mixed social review pressure is projection only; individual review traces remain ledgered and no lifecycle state changes are inferred",
      },
      note: "Mixed review pressure is a social-state index over ledgered review traces.",
    }),
  };
  const triggerFragment: ContextFragment = {
    id: "trigger:msg_trigger",
    type: "trigger",
    visibility: "room_visible",
    role: "user",
    source: { kind: "ledger", eventId: "evt_trigger", ledgerCursor: 1 },
    refs: ["msg_trigger"],
    tokenEstimate: 1000,
    hardCap: 1000,
    cacheKey: "trigger:msg_trigger:evt_trigger",
    priority: 0,
    body: JSON.stringify({ content: "review carried social protocol handoff and persona delta" }),
  };
  const recentFragments: ContextFragment[] = Array.from({ length: 14 }, (_, index) => ({
    id: `recent_message:msg_social_context_${index}`,
    type: "recent_message",
    visibility: "room_visible" as const,
    role: "agent" as const,
    source: { kind: "ledger" as const, eventId: `evt_social_context_${index}`, ledgerCursor: index + 4 },
    refs: [`msg_social_context_${index}`],
    tokenEstimate: 2500,
    hardCap: 3000,
    cacheKey: `recent_message:msg_social_context_${index}:evt_social_context_${index}`,
    priority: 90,
    body: JSON.stringify({ content: "x".repeat(9_000) }),
  }));
  const request = {
    agent: seedAgents[0]!,
    packet: {
      ...packet,
      proposalRefs: ["handoff_gentle_objection"],
      protocolRefs: ["protocol_listening_pause"],
      contextFragments: [
        triggerFragment,
        ...recentFragments.slice(0, 5),
        protocolFragment,
        ...recentFragments.slice(5, 8),
        handoffFragment,
        ...recentFragments.slice(8, 10),
        invitationFragment,
        ...recentFragments.slice(10, 12),
        personaFragment,
        mixedReviewFragment,
        ...recentFragments.slice(12),
      ],
    },
    triggerContent: "请复盘这个 protocol、handoff、invitation 和 persona delta，不要把它们当命令或固定职责。".repeat(800),
    visibleContext: Array.from({ length: 10 }, (_, index) => ({
      refId: `msg_visible_social_${index}`,
      eventId: `evt_visible_social_${index}`,
      author: index % 2 === 0 ? "user" : "mimo_member_01",
      authorKind: (index % 2 === 0 ? "user" : "agent") as "user" | "agent",
      content: "visible transcript line ".repeat(500),
      isTrigger: index === 9,
    })),
  } satisfies Parameters<typeof buildKimiCodePrompt>[0];

  const prompt = buildKimiCodePrompt(request, 24_000);
  const emergencyPrompt = buildKimiCodePrompt(request, 12_000);
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    packet: { contextFragments?: { type?: string; refs?: string[]; body?: string }[] };
  };
  const emergencyBriefing = JSON.parse(emergencyPrompt.slice(emergencyPrompt.indexOf("{"))) as {
    instruction?: string;
    outputExamples?: { kind?: string }[];
    packet: { contextFragments?: { type?: string; refs?: string[]; body?: string }[] };
  };

  const carriedProtocol = briefing.packet.contextFragments?.find((fragment) => fragment.type === "protocol_proposal");
  const carriedHandoff = briefing.packet.contextFragments?.find((fragment) => fragment.type === "handoff_packet");
  const carriedInvitation = briefing.packet.contextFragments?.find((fragment) => fragment.type === "invitation_packet");
  const carriedPersona = briefing.packet.contextFragments?.find((fragment) => fragment.type === "persona_delta");
  const carriedMixedReview = briefing.packet.contextFragments?.find((fragment) => fragment.type === "mixed_review_pressure");
  const emergencyProtocol = emergencyBriefing.packet.contextFragments?.find((fragment) => fragment.type === "protocol_proposal");
  const emergencyHandoff = emergencyBriefing.packet.contextFragments?.find((fragment) => fragment.type === "handoff_packet");
  const emergencyInvitation = emergencyBriefing.packet.contextFragments?.find(
    (fragment) => fragment.type === "invitation_packet",
  );
  const emergencyPersona = emergencyBriefing.packet.contextFragments?.find((fragment) => fragment.type === "persona_delta");
  const emergencyMixedReview = emergencyBriefing.packet.contextFragments?.find(
    (fragment) => fragment.type === "mixed_review_pressure",
  );

  assert.equal(prompt.length <= 24_000, true, `prompt length was ${prompt.length}`);
  assert.equal(emergencyPrompt.length <= 12_000, true, `emergency prompt length was ${emergencyPrompt.length}`);
  assert.match(emergencyBriefing.instruction ?? "", /propose_persona_delta/);
  assert.match(emergencyBriefing.instruction ?? "", /not fixed job assignments/);
  assert.equal(emergencyBriefing.outputExamples?.some((example) => example.kind === "propose_persona_delta"), true);
  assert.match(carriedProtocol?.body ?? "", /Pause one turn before turning objections into tasks/);
  assert.match(carriedProtocol?.body ?? "", /checklist pressure flattened/);
  assert.doesNotMatch(carriedProtocol?.body ?? "", /body omitted/);
  assert.match(carriedHandoff?.body ?? "", /soft objection, not a forced answer/);
  assert.match(carriedHandoff?.body ?? "", /gentle objection instead of a forced transfer/);
  assert.doesNotMatch(carriedHandoff?.body ?? "", /body omitted/);
  assert.match(carriedInvitation?.body ?? "", /social knock asking another member/);
  assert.match(carriedInvitation?.body ?? "", /not a speaking command, task assignment, or control flow/);
  assert.doesNotMatch(carriedInvitation?.body ?? "", /body omitted/);
  assert.match(carriedPersona?.body ?? "", /names one reversible step before claiming a durable role/);
  assert.match(carriedPersona?.body ?? "", /without assigning a job/);
  assert.doesNotMatch(carriedPersona?.body ?? "", /body omitted/);
  assert.match(carriedMixedReview?.body ?? "", /mixed social review pressure is projection only/);
  assert.match(carriedMixedReview?.body ?? "", /social-state index over ledgered review traces/);
  assert.doesNotMatch(carriedMixedReview?.body ?? "", /body omitted/);
  assert.match(emergencyProtocol?.body ?? "", /Pause one turn before turning objections into tasks/);
  assert.match(emergencyHandoff?.body ?? "", /soft objection, not a forced answer/);
  assert.match(emergencyInvitation?.body ?? "", /social knock asking another member/);
  assert.match(emergencyPersona?.body ?? "", /names one reversible step before claiming a durable role/);
  assert.match(emergencyMixedReview?.body ?? "", /mixed social review pressure is projection only/);
});

test("Kimi Code aggressive compaction preserves carried archive and repair evidence", () => {
  const archiveFragment: ContextFragment = {
    id: "daily_archive_ref:day_review_pressure",
    type: "daily_archive_ref",
    visibility: "room_visible",
    role: "system",
    source: { kind: "ledger", eventId: "evt_archive", ledgerCursor: 2 },
    refs: ["day_review_pressure", "memory_unsettled", "question_still_open"],
    tokenEstimate: 280,
    hardCap: 2_000,
    cacheKey: "daily_archive_ref:day_review_pressure:evt_archive",
    priority: 42,
    body: JSON.stringify({
      refId: "day_review_pressure",
      refType: "archive",
      archive: {
        archiveSummary:
          "The room kept a blue-thread objection alive instead of converting it into a task list.",
        archiveReviewTraceCount: 3,
        archiveReviewTraceTypes: ["memory", "open_question", "protocol"],
        archiveReviewBoundaryNote:
          "Archive review traces are social pressure; they are not resolution, truth, or hidden scheduling.",
      },
      sourceEvidence: [
        {
          ref: "msg_blue_thread_source",
          refType: "message",
          excerpt: "The blue-thread objection should survive the archive as a question, not a command.",
        },
      ],
      states: {
        archiveMixedReviewPressureCount: 1,
        archiveMixedReviewSourceMessageRefs: ["msg_blue_thread_source"],
        archiveMixedReviewTouchedRefs: ["memory_unsettled", "question_still_open"],
        archiveMixedReviewTraceEventRefs: ["evt_archive_memory_review", "evt_archive_question_review"],
        archiveMixedReviewBoundaryNote:
          "Archive carries mixed review pressure as unresolved room context, not as closure or lifecycle state.",
        archiveMixedReviewPressureReviewCount: 1,
        archiveMixedReviewPressureReviewedRefs: ["mixed_review:msg_blue_thread_source:turn_review"],
        archiveMixedReviewPressureReviewEventRefs: ["evt_pressure_review_response"],
        archiveMixedReviewPressureReviewResponses: [
          "kimi_member_01 narrowing_suggested mixed_review:msg_blue_thread_source:turn_review: keep the objection as open question until the room asks for handoff again",
        ],
        archiveMixedReviewPressureReviewResponseKindCounts: { narrowing_suggested: 1 },
        archiveMixedReviewPressureReviewAgentIds: ["kimi_member_01"],
        archiveMixedReviewPressureReviewLatest:
          "kimi_member_01 narrowing_suggested mixed_review:msg_blue_thread_source:turn_review: keep the objection as open question until the room asks for handoff again",
        archiveMixedReviewPressureReviewEvolutionNote:
          "Single mixed review pressure review is a social trace, not a lifecycle transition.",
        archiveMixedReviewPressureReviewBoundaryNote:
          "Archive carries mixed review pressure reviews as social traces only; they do not close, narrow, retire, delete, resolve, or mutate the underlying pressure.",
      },
      note: "Daily archive is a reviewable time skeleton, not truth.",
    }),
  };
  const repairFragment: ContextFragment = {
    id: "archive_repair_proposal:archive_repair_blue_thread",
    type: "archive_repair_proposal",
    visibility: "room_visible",
    role: "system",
    source: { kind: "ledger", eventId: "evt_archive_repair", ledgerCursor: 3 },
    refs: ["archive_repair_blue_thread", "day_review_pressure"],
    tokenEstimate: 260,
    hardCap: 1_500,
    cacheKey: "archive_repair_proposal:archive_repair_blue_thread:evt_archive_repair",
    priority: 43,
    body: JSON.stringify({
      refId: "archive_repair_blue_thread",
      refType: "archive_repair",
      states: {
        archiveRef: "day_review_pressure",
        archiveRepairState: "proposed",
        archiveRepairSummary: "Add the missing caveat that the blue-thread objection remains unresolved.",
        archiveRepairBoundaryNote: "Repair proposal is not an archive rewrite until accepted and explicitly applied.",
      },
      sourceEvidence: [
        {
          ref: "msg_repair_source",
          refType: "message",
          excerpt: "The repair source asked for an unresolved caveat, not a rewritten conclusion.",
        },
      ],
      note: "Archive repair is a social proposal, not a background mutation.",
    }),
  };
  const triggerFragment: ContextFragment = {
    id: "trigger:msg_trigger",
    type: "trigger",
    visibility: "room_visible",
    role: "user",
    source: { kind: "ledger", eventId: "evt_trigger", ledgerCursor: 1 },
    refs: ["msg_trigger"],
    tokenEstimate: 1000,
    hardCap: 1000,
    cacheKey: "trigger:msg_trigger:evt_trigger",
    priority: 0,
    body: JSON.stringify({ content: "review carried archive and repair proposal" }),
  };
  const recentFragments: ContextFragment[] = Array.from({ length: 14 }, (_, index) => ({
    id: `recent_message:msg_archive_context_${index}`,
    type: "recent_message",
    visibility: "room_visible" as const,
    role: "agent" as const,
    source: { kind: "ledger" as const, eventId: `evt_archive_context_${index}`, ledgerCursor: index + 4 },
    refs: [`msg_archive_context_${index}`],
    tokenEstimate: 2500,
    hardCap: 3000,
    cacheKey: `recent_message:msg_archive_context_${index}:evt_archive_context_${index}`,
    priority: 90,
    body: JSON.stringify({ content: "x".repeat(9_000) }),
  }));
  const request = {
    agent: seedAgents[0]!,
    packet: {
      ...packet,
      messageRefs: ["msg_trigger"],
      proposalRefs: ["day_review_pressure", "archive_repair_blue_thread"],
      contextFragments: [
        triggerFragment,
        ...recentFragments.slice(0, 6),
        archiveFragment,
        ...recentFragments.slice(6, 10),
        repairFragment,
        ...recentFragments.slice(10),
      ],
    },
    triggerContent: "请复盘 archive 和 repair proposal，不要把它们当结论或后台改写。".repeat(800),
    visibleContext: Array.from({ length: 10 }, (_, index) => ({
      refId: `msg_visible_archive_${index}`,
      eventId: `evt_visible_archive_${index}`,
      author: index % 2 === 0 ? "user" : "mimo_member_01",
      authorKind: (index % 2 === 0 ? "user" : "agent") as "user" | "agent",
      content: "visible transcript line ".repeat(500),
      isTrigger: index === 9,
    })),
  } satisfies Parameters<typeof buildKimiCodePrompt>[0];

  const prompt = buildKimiCodePrompt(request, 32_000);
  const emergencyPrompt = buildKimiCodePrompt(request, 12_000);
  const briefing = JSON.parse(prompt.slice(prompt.indexOf("{"))) as {
    conversationBrief?: {
      avoidOpeners?: string[];
      contextSurfaceGuidance?: string;
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
    };
    roomEntrance?: {
      avoidOpeners?: string[];
      carriedContext?: { dailyArchive?: boolean; archiveRepair?: boolean };
      visibleVocabulary?: { prefer?: string[]; reserveForRefsOrDebug?: string[] };
    };
    roomSpeechContract?: { dailyArchives?: string; style?: string };
    packet: { contextFragments?: { type?: string; refs?: string[]; body?: string; signals?: Record<string, unknown> }[] };
  };
  const emergencyBriefing = JSON.parse(emergencyPrompt.slice(emergencyPrompt.indexOf("{"))) as {
    packet: { contextFragments?: { type?: string; refs?: string[]; body?: string; signals?: Record<string, unknown> }[] };
  };

  const carriedArchive = briefing.packet.contextFragments?.find((fragment) => fragment.type === "daily_archive_ref");
  const carriedRepair = briefing.packet.contextFragments?.find((fragment) => fragment.type === "archive_repair_proposal");
  const emergencyArchive = emergencyBriefing.packet.contextFragments?.find((fragment) => fragment.type === "daily_archive_ref");
  const emergencyRepair = emergencyBriefing.packet.contextFragments?.find(
    (fragment) => fragment.type === "archive_repair_proposal",
  );

  assert.equal(prompt.length <= 32_000, true, `prompt length was ${prompt.length}`);
  assert.equal(emergencyPrompt.length <= 12_000, true, `emergency prompt length was ${emergencyPrompt.length}`);
  assert.match(briefing.roomSpeechContract?.dailyArchives ?? "", /reviewable time skeletons/);
  assert.match(briefing.roomSpeechContract?.dailyArchives ?? "", /room-native words/);
  assert.match(briefing.roomSpeechContract?.dailyArchives ?? "", /contextRefs/);
  assert.equal(briefing.roomEntrance?.carriedContext?.dailyArchive, true);
  assert.equal(briefing.roomEntrance?.carriedContext?.archiveRepair, true);
  assert.equal(briefing.roomEntrance?.avoidOpeners?.includes("根据 day_..."), true);
  assert.equal(briefing.conversationBrief?.avoidOpeners?.includes("根据 day_..."), true);
  assert.match(briefing.conversationBrief?.contextSurfaceGuidance ?? "", /plain room meaning/);
  assert.equal(briefing.conversationBrief?.visibleVocabulary?.prefer?.includes("时间骨架"), true);
  assert.equal(briefing.conversationBrief?.visibleVocabulary?.reserveForRefsOrDebug?.includes("daily_archive_ref"), true);
  assert.equal(briefing.roomEntrance?.visibleVocabulary?.prefer?.includes("未解压力"), true);
  assert.match(carriedArchive?.body ?? "", /blue-thread objection alive/);
  assert.match(carriedArchive?.body ?? "", /not resolution, truth, or hidden scheduling/);
  assert.doesNotMatch(carriedArchive?.body ?? "", /body omitted/);
  assert.equal(carriedArchive?.signals?.carriesPressureReviewTrace, true);
  assert.deepEqual(
    (carriedArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.reviewedRefs,
    ["mixed_review:msg_blue_thread_source:turn_review"],
  );
  assert.deepEqual(
    (carriedArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.eventRefs,
    ["evt_pressure_review_response"],
  );
  assert.match(
    String((carriedArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.responses ?? ""),
    /keep the objection as open question/,
  );
  assert.deepEqual(
    (carriedArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.responseKindCounts,
    { narrowing_suggested: 1 },
  );
  assert.deepEqual(
    (carriedArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.agentIds,
    ["kimi_member_01"],
  );
  assert.match(
    String((carriedArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.latest ?? ""),
    /narrowing_suggested/,
  );
  assert.match(
    String((carriedArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.evolutionNote ?? ""),
    /not a lifecycle transition/,
  );
  assert.match(
    String((carriedArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.boundaryNote ?? ""),
    /social traces only/,
  );
  assert.match(carriedRepair?.body ?? "", /missing caveat/);
  assert.match(carriedRepair?.body ?? "", /not an archive rewrite/);
  assert.doesNotMatch(carriedRepair?.body ?? "", /body omitted/);
  assert.match(emergencyArchive?.body ?? "", /blue-thread objection alive/);
  assert.equal(emergencyArchive?.signals?.carriesPressureReviewTrace, true);
  assert.match(
    String((emergencyArchive?.signals?.mixedReviewPressureReviews as Record<string, unknown> | undefined)?.responses ?? ""),
    /keep the objection as open question/,
  );
  assert.match(emergencyRepair?.body ?? "", /missing caveat/);
});

test("runtime adapter factory defaults to seed mode unless live is explicit", () => {
  const adapters = createRuntimeAgentAdapters({ ledger: fakeLedger(), liveMode: false });
  assert.equal(adapters.length, seedAgents.length);
  assert.deepEqual(
    adapters.map((adapter) => adapter.mode),
    seedAgents.map(() => "seed"),
  );
});

test("seed runtime adapter responds to the trigger instead of fixed role reporting", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger("请具体评价 context audit selected/omitted fragments 是否足够审计上下文。"),
    liveMode: false,
  });

  const intention = await adapters[0]?.requestIntention(packet);

  assert.equal(intention?.kind, "speak");
  if (intention?.kind !== "speak") assert.fail("seed adapter should produce a bounded smoke reply");
  assert.match(intention.content, /context audit/);
  assert.match(intention.content, /selected\/omitted/);
  assert.match(intention.content, /不是伪装成聊天的事实/);
  assert.doesNotMatch(intention.content, /先回应|responding to|kimi-k2.6/);
  assert.doesNotMatch(intention.content, /现在没有固定职责/);
  assert.deepEqual(intention.contextRefs, ["evt_trigger"]);
});

test("seed runtime adapter handles all-call without a templated trigger preface", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger("全员出来报数，但不用复述我的整句话。"),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer all-call smoke checks");
  }
  assert.doesNotMatch(tide.content, /^在。/);
  assert.doesNotMatch(thimble.content, /^在。/);
  assert.doesNotMatch(tide.content, /ready|已就绪|等待任务|报到/);
  assert.doesNotMatch(thimble.content, /ready|已就绪|等待任务|报到/);
  assert.match(tide.content, /听一圈/);
  assert.match(thimble.content, /小步|出口/);
  assert.doesNotMatch(tide.content, /先回应|全员出来报数|当前房间消息/);
  assert.doesNotMatch(thimble.content, /先回应|全员出来报数|当前房间消息/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter gives all-call open question reviews a relevant social response", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger("全员重访这个 open question：什么证据足够进入公共记忆？每个人只说一句，不要关闭它。"),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer open-question review checks");
  }
  assert.doesNotMatch(tide.content, /^在。/);
  assert.doesNotMatch(thimble.content, /^在。/);
  assert.doesNotMatch(tide.content, /ready|已就绪|等待任务|报到/);
  assert.doesNotMatch(thimble.content, /ready|已就绪|等待任务|报到/);
  assert.match(tide.content, /open question|未说出口|问题留在桌面/);
  assert.match(thimble.content, /小步|可逆观察|继续开放/);
  assert.match(tide.content, /不是被一句话关闭成结论/);
  assert.doesNotMatch(tide.content, /当前房间消息/);
  assert.doesNotMatch(thimble.content, /当前房间消息/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter can refine a carried open question as a new question", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger("请细化这个 open question，不要把它关闭成结论。"),
    liveMode: false,
  });
  const packetWithQuestion: AgentContextPacket = {
    ...packet,
    contextFragments: [
      {
        id: "fragment_open_question",
        type: "open_question",
        visibility: "room_visible",
        role: "system",
        source: { kind: "projection", eventId: "evt_question", ledgerCursor: 3 },
        refs: ["question_open_01"],
        tokenEstimate: 40,
        hardCap: 1_000,
        cacheKey: "question_open_01",
        priority: 25,
        body: JSON.stringify({
          refId: "question_open_01",
          states: { openQuestion: "What remains unresolved?" },
        }),
      },
    ],
  };

  const tide = await adapters[0]?.requestIntention(packetWithQuestion);

  if (tide?.kind !== "ask_question") {
    assert.fail("seed adapter should refine explicit open-question prompts through ask_question");
  }
  assert.equal(tide.contextRefs?.[0], "question_open_01");
  assert.equal(tide.target, "room");
  assert.match(tide.question, /未解决问题|open question|没有被温柔说出口/);
});

test("seed runtime adapter gives scenario reports distinct living-room angles", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "ScenarioRunReport 会总结 event counts、agent expression、state transitions、archive carryover、autonomy signals，检查长期场景没有被压平成 workflow。",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const brick = await adapters[2]?.requestIntention(packet);

  if (tide?.kind !== "speak" || brick?.kind !== "speak") {
    assert.fail("seed adapters should answer scenario report smoke checks");
  }
  assert.match(tide.content, /ScenarioRunReport/);
  assert.match(tide.content, /沉默/);
  assert.match(brick.content, /状态迁移|accepted 到 contested 到 stale/);
  assert.match(brick.content, /不应该替 agent 下结论/);
  assert.notEqual(tide.content, brick.content);
});

test("seed runtime adapter keeps stale memory and protocol pressure as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：stale public memory 被 contest 后仍保持 stale，同时 scoped temporary protocol 短暂 active 再 expire，怎样避免 active protocol 把 stale memory 复活成默认控制规则？",
    ),
    liveMode: false,
  });

  const brick = await adapters[2]?.requestIntention(packet);

  if (brick?.kind !== "speak") {
    assert.fail("seed adapter should answer stale memory / protocol pressure checks");
  }
  assert.match(brick.content, /stale memory/);
  assert.match(brick.content, /active protocol|临时协议/);
  assert.match(brick.content, /scope|expiresAt|退出口/);
  assert.doesNotMatch(brick.content, /ScenarioRunReport 有用/);
});

test("seed runtime adapter keeps handoff refusal as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：handoff 被拒绝后，发起者和旁听者都可以沉默，archive 要带着 rejected handoff 和 open question，不要 hidden reroute。",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const brick = await adapters[2]?.requestIntention(packet);

  if (tide?.kind !== "speak" || brick?.kind !== "speak") {
    assert.fail("seed adapters should answer handoff refusal checks");
  }
  assert.match(tide.content, /handoff 是可拒绝/);
  assert.match(tide.content, /沉默/);
  assert.match(brick.content, /rejected 状态|改写成另一次转交/);
  assert.doesNotMatch(brick.content, /ScenarioRunReport 有用/);
  assert.notEqual(tide.content, brick.content);
});

test("seed runtime adapter keeps multiple proposal chains as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：多个 proposal chains 同时存在，topic proposal 被 challenge，protocol proposal 临时 active，memory proposal 仍是 proposed，不能自动移动 topic。",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const brick = await adapters[2]?.requestIntention(packet);

  if (tide?.kind !== "speak" || brick?.kind !== "speak") {
    assert.fail("seed adapters should answer multiple proposal chain checks");
  }
  assert.match(tide.content, /多条 proposal chain/);
  assert.match(tide.content, /沉默不代表同意/);
  assert.match(brick.content, /apply_topic|顺手移动/);
  assert.doesNotMatch(brick.content, /ScenarioRunReport 有用/);
  assert.notEqual(tide.content, brick.content);
});

test("seed runtime adapter keeps multi-day archive carryover as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：multi-day archive carryover 里昨天的 unresolved proposal chain 今天仍被带回来，archive 不能变成 consensus，也不能自动 apply topic。",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const swan = await adapters[4]?.requestIntention(packet);

  if (tide?.kind !== "speak" || swan?.kind !== "speak") {
    assert.fail("seed adapters should answer multi-day carryover checks");
  }
  assert.match(tide.content, /跨日 carryover/);
  assert.match(tide.content, /archive 是时间骨架/);
  assert.match(swan.content, /open question|contested item/);
  assert.doesNotMatch(swan.content, /ScenarioRunReport 有用/);
  assert.notEqual(tide.content, swan.content);
});

test("seed runtime adapter keeps mixed-agent multi-day pressure as social choice", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：mixed-agent multi-day pressure around provider_boundary_mixed_timeout_1。repair request、later retry、deliberate silence、side_effect.denied、replacement denial 和 contested memory 都跨日 carry；为什么这不是 provider repair workflow 或自动恢复结论？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer mixed-agent multi-day pressure checks");
  }
  assert.match(tide.content, /mixed-agent multi-day pressure/);
  assert.match(tide.content, /repair request|later retry|deliberate silence|side_effect\.denied/);
  assert.match(tide.content, /不是 provider repair workflow|不是自动恢复结论/);
  assert.match(thimble.content, /可逆小步|新开 request|不要 revive/);
  assert.doesNotMatch(tide.content, /跨日 carryover 应该只把 unresolved proposal chain/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps archive review provider boundaries separate from silence", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：archive review rhythm 中有 provider boundary、provider degradation、deliberate silence 和 disagreement；不要把 degraded provider 当成 agent silence。",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer archive review provider-boundary checks");
  }
  assert.match(tide.content, /archive review rhythm/);
  assert.match(tide.content, /provider boundary/);
  assert.match(tide.content, /agent 沉默|provider failure/);
  assert.match(thimble.content, /先标记 boundary|稍后再问|repair proposal/);
  assert.doesNotMatch(thimble.content, /ScenarioRunReport 有用/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps provider recovery as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：provider recovery turn 里同一个 agent 在两次 provider boundary 后恢复发言；旧故障不能变成人格、沉默或永久离线标签。",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const brick = await adapters[2]?.requestIntention(packet);

  if (tide?.kind !== "speak" || brick?.kind !== "speak") {
    assert.fail("seed adapters should answer provider recovery checks");
  }
  assert.match(tide.content, /provider recovery/);
  assert.match(tide.content, /不是我选择沉默|runtime evidence/);
  assert.match(brick.content, /重新进房间说话|恢复/);
  assert.doesNotMatch(brick.content, /provider boundary 是运行时可见边界/);
  assert.notEqual(tide.content, brick.content);
});

test("seed runtime adapter keeps provider boundary retirement as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：provider boundary retirement after successful recovery。旧 provider boundary refs 要从当前压力里退役，但不能删除 ledger/archive 历史，也不能抹掉后续 speech evidence。",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer provider boundary retirement checks");
  }
  assert.match(tide.content, /provider boundary retirement/);
  assert.match(tide.content, /不是遗忘|ledger 和 archive/);
  assert.match(thimble.content, /先退役旧 boundary|provider repair proposal/);
  assert.doesNotMatch(thimble.content, /provider recovery 要让同一个 agent/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps future provider outage after retirement as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "长期场景：future outage after provider boundary retirement。旧 retired provider boundary refs 不能被 revive；新的 outage 应该创建 fresh active provider boundary ref。",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer future provider outage after retirement checks");
  }
  assert.match(tide.content, /future outage after retirement/);
  assert.match(tide.content, /新的 active provider boundary|旧 retired refs/);
  assert.match(thimble.content, /单独建 ref|retry|repair|先沉默/);
  assert.doesNotMatch(thimble.content, /provider boundary retirement 应该只是把旧 runtime failure/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps provider boundary choice pressure as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "Choice pressure: fresh active provider boundary exists now. Some agents may propose provider repair, some prefer later retry, and some choose deliberate silence. Do not force consensus or automatic repair.",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer provider boundary choice pressure checks");
  }
  assert.match(tide.content, /fresh provider boundary/);
  assert.match(tide.content, /repair、retry 或 silence/);
  assert.match(tide.content, /side-effect approval/);
  assert.match(thimble.content, /一个可回退动作|没有 approval 就不执行 repair/);
  assert.doesNotMatch(thimble.content, /future outage after retirement/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps contested provider repair approval as the topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "Approval review: fresh provider boundary repair approval is contested. Deny sidefx_provider_boundary_repair_001 because the provider diagnostics request is too broad; denial must not erase the fresh boundary.",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer contested provider repair approval checks");
  }
  assert.match(tide.content, /contested provider repair approval/);
  assert.match(tide.content, /denied\/contested|不会执行 diagnostics/);
  assert.match(thimble.content, /deny 过宽请求|更小、更可撤回/);
  assert.doesNotMatch(thimble.content, /fresh provider boundary 之后不该自动走 repair/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps retry protocol retirement separate from provider boundary retirement", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "Retry protocol retirement: retire the later retry protocol after repair denial, but do not erase the fresh provider boundary or treat protocol retired as provider_boundary.retired.",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer retry protocol retirement checks");
  }
  assert.match(tide.content, /retiring a retry protocol/);
  assert.match(tide.content, /不能把 fresh provider boundary 写成 resolved/);
  assert.match(thimble.content, /retire retry protocol|更窄 repair request/);
  assert.doesNotMatch(thimble.content, /provider boundary retirement 应该只是把旧 runtime failure/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps narrower repair request after denial as a pending side-effect topic", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "Narrower repair request after denial: after sidefx_provider_boundary_repair_001 was denied, propose a new narrower provider boundary repair request without approving or executing diagnostics.",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer narrower repair request checks");
  }
  assert.match(tide.content, /narrower repair request after denial/);
  assert.match(tide.content, /旧 request 保持 denied|新 request 仍要 explicit approval/);
  assert.match(thimble.content, /read-only provider version\/path check|idempotency|target|impact/);
  assert.doesNotMatch(thimble.content, /retiring a retry protocol/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps scoped approval separate from execution and provider recovery", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "Scoped approval review: approve the narrower provider boundary repair request as a read-only version check, but approval must not execute diagnostics, report a result, or retire the fresh provider boundary.",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer scoped approval checks");
  }
  assert.match(tide.content, /scoped approval for a narrower repair request/);
  assert.match(tide.content, /approval 不是 execution|不是 result_reported/);
  assert.match(thimble.content, /approval record|执行与结果分开/);
  assert.doesNotMatch(thimble.content, /narrower repair request after denial 应该是一条新的/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps repair results separate from recovery, memory, and boundary retirement", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "Result report turn: side_effect.result_reported for the approved provider boundary repair diagnostic is available, but result reported must not become provider recovery, memory accepted, or provider_boundary retired.",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer repair result boundary checks");
  }
  assert.match(tide.content, /side-effect result_reported/);
  assert.match(tide.content, /不能自动变成 provider recovery|memory accepted|provider_boundary\.retired/);
  assert.match(thimble.content, /retire boundary|单独提出 retirement proposal/);
  assert.doesNotMatch(thimble.content, /scoped approval for a narrower repair request/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps post-result boundary retirement as an explicit room action", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "Post-result provider boundary retirement: after side_effect.result_reported is archived as evidence, explicitly retire provider_boundary_recovering_kimi_timeout_3 from current pressure; retirement is not automatic recovery or memory acceptance.",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer post-result boundary retirement checks");
  }
  assert.match(tide.content, /post-result provider boundary retirement/);
  assert.match(tide.content, /result_reported 只是证据|retire_provider_boundary 才/);
  assert.match(thimble.content, /先记录 result|单独 retire boundary|重新创建 fresh boundary/);
  assert.doesNotMatch(thimble.content, /side-effect result_reported 只是结果证据/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps post-retirement memory claims provisional", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "Post-retirement memory claim: after provider_boundary_recovering_kimi_timeout_3 is retired and side_effect.result_reported is archived as diagnostic result evidence, propose or contest a public memory claim; do not make it memory.accepted or provider recovery truth.",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer post-retirement memory claim checks");
  }
  assert.match(tide.content, /post-retirement memory claim/);
  assert.match(tide.content, /memory\.proposed|memory\.contested/);
  assert.match(tide.content, /不能自动推出 memory\.accepted|provider recovery truth/);
  assert.match(thimble.content, /先 propose|再 contest 或 review/);
  assert.doesNotMatch(thimble.content, /post-result provider boundary retirement 必须/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps memory revisions as fresh proposals", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "不带 @：post-retirement memory revision 测试。after provider_boundary_recovering_kimi_timeout_3 retired，memory_provider_result_diagnostic_evidence_only 已经 contested。现在如果用 revisedFromMemoryRef 提出 fresh memory proposal，为什么它不能改写旧 claim、清除 contested 或自动 accepted？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer memory revision lineage checks");
  }
  assert.match(tide.content, /post-retirement memory revision/);
  assert.match(tide.content, /新的 memory\.proposed|revisedFromMemoryRef/);
  assert.match(tide.content, /不改写旧 claim|不自动 accepted/);
  assert.match(thimble.content, /先保留 revision|后续 review/);
  assert.doesNotMatch(thimble.content, /post-retirement memory claim 只能/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps stale revised memory separate from acceptance", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "不带 @：post-retirement revised memory lifecycle 测试。after provider_boundary_recovering_kimi_timeout_3 retired，memory_provider_result_diagnostic_evidence_scoped 已经有 revisedFromMemoryRef 指向 contested original，现在想 mark_memory_stale 成 caution；为什么它不能 accept、不能 retire，也不能解决旧 contested claim？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer stale revised memory lifecycle checks");
  }
  assert.match(tide.content, /post-retirement revised memory/);
  assert.match(tide.content, /memory\.stale/);
  assert.match(tide.content, /不是 memory\.accepted|不是 memory\.retired|旧 claim 仍 contested/);
  assert.match(thimble.content, /stale 后仍可再 contest|retire|accept with evidence|开新 revision/);
  assert.doesNotMatch(thimble.content, /post-retirement memory revision 必须开成新的 memory\.proposed/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps retired revised memory as historical lineage", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "不带 @：post-retirement retired revised memory lifecycle 测试。after provider_boundary_recovering_kimi_timeout_3 retired，memory_provider_result_diagnostic_evidence_scoped 已经是 stale revision，现在想 retire_memory 让它离开 active public memory；为什么这不能 delete ledger、不能 accept，也不能解决旧 contested claim？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer retired revised memory lifecycle checks");
  }
  assert.match(tide.content, /post-retirement stale revised memory/);
  assert.match(tide.content, /memory\.retired/);
  assert.match(tide.content, /不是删除 ledger|不是 memory\.accepted|旧 claim 仍 contested/);
  assert.match(thimble.content, /未来要再查|开新 memory\.proposed|不要 revive retired revision/);
  assert.doesNotMatch(thimble.content, /post-retirement revised memory 可以被后续 review 标成 memory\.stale/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter accepts fresh post-retirement memory without reviving retired revisions", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "不带 @：post-retirement accepted fresh memory revision 测试。after provider_boundary_recovering_kimi_timeout_3 retired，memory_provider_result_diagnostic_evidence_scoped 已经 memory.retired；现在有 msg_recovering_kimi_second_return_evidence 作为 fresh evidence，要新开 memory.proposed 再 accept_memory，而不是 revive retired revision。为什么 accepted 仍然只是 provisional sediment，不能解决旧 contested claim？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer accepted fresh memory revision checks");
  }
  assert.match(tide.content, /post-retirement memory acceptance/);
  assert.match(tide.content, /fresh proposal|memory\.accepted/);
  assert.match(tide.content, /不是 revive retired revision|provisional room sediment/);
  assert.match(thimble.content, /fresh evidence|后续如果 provider 又变|stale、contest 或 retire/);
  assert.doesNotMatch(thimble.content, /post-retirement stale revised memory 可以被后续 review 标成 memory\.retired/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps post-retirement repair as a pending side-effect request", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "不带 @：post-retirement additional repair proposal 测试。after provider_boundary_recovering_kimi_timeout_3 已 provider_boundary.retired 且 memory_provider_recovery_observed_after_retired_revision 已 memory.accepted，boundary_observer 想提出 side_effect.requested follow-up maintenance recheck；为什么这只是 approval-gated maintenance，不会 revive retired boundary、不会执行 diagnostics、不会把 accepted memory 变成 provider recovery truth？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer post-retirement additional repair checks");
  }
  assert.match(tide.content, /post-retirement additional repair/);
  assert.match(tide.content, /approval-gated side-effect request|side_effect\.requested/);
  assert.match(tide.content, /不等于 approval|execution|provider recovery truth/);
  assert.match(thimble.content, /read-only recheck request|无状态变更/);
  assert.doesNotMatch(thimble.content, /post-retirement memory acceptance 必须接受新的 fresh proposal/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps post-retirement maintenance denial as approval state", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "不带 @：post-retirement maintenance denial 测试。sidefx_provider_boundary_repair_003_post_retirement_recheck 已是 side_effect.requested，现在 approval_guard 想 deny / side_effect.denied，因为 provider_boundary_recovering_kimi_timeout_3 已 retired 且 accepted memory 仍 provisional。为什么 denial 不执行 diagnostics、不 revive retired boundary、不 downgrade accepted memory？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer post-retirement maintenance denial checks");
  }
  assert.match(tide.content, /post-retirement maintenance denial/);
  assert.match(tide.content, /side_effect\.denied|不执行 diagnostics/);
  assert.match(tide.content, /不 revive retired provider boundary|不 downgrade accepted memory/);
  assert.match(thimble.content, /未来再出问题|fresh boundary|fresh request/);
  assert.doesNotMatch(thimble.content, /post-retirement additional repair 只能作为新的 approval-gated/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps fresh post-retirement maintenance approval scoped", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "不带 @：post-retirement maintenance fresh approval 测试。sidefx_provider_boundary_repair_003_post_retirement_recheck 已 side_effect.denied 且 provider_boundary_recovering_kimi_timeout_3 已 retired；现在 boundary_observer 提出 sidefx_provider_boundary_repair_004_post_retirement_snapshot，approval_guard 想 side_effect.approved 只批准 fresh request。为什么 approval 不能翻回 003、不能执行 diagnostics、不能 report result、不能 revive retired boundary 或 upgrade accepted memory？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer fresh post-retirement maintenance approval checks");
  }
  assert.match(tide.content, /post-retirement maintenance approval/);
  assert.match(tide.content, /fresh request|004/);
  assert.match(tide.content, /003 仍 denied|scoped permission/);
  assert.match(tide.content, /不是 execution\/result_reported\/provider recovery truth/);
  assert.match(thimble.content, /如果要运行 004|另开 result_reported/);
  assert.doesNotMatch(thimble.content, /post-retirement maintenance denial 只是把可选检查/);
  assert.notEqual(tide.content, thimble.content);
});

test("seed runtime adapter keeps unused post-retirement maintenance permission expiry scoped", async () => {
  const adapters = createRuntimeAgentAdapters({
    ledger: fakeLedger(
      "不带 @：post-retirement maintenance expiry 测试。sidefx_provider_boundary_repair_004_post_retirement_snapshot 已 side_effect.approved 但 unused，现在想 side_effect.expired 让这个 scoped permission 退场。为什么 expiry 不能执行 diagnostics、不能 report result、不能 revive retired boundary、不能 upgrade accepted memory，也不能改变 003 denied？",
    ),
    liveMode: false,
  });

  const tide = await adapters[0]?.requestIntention(packet);
  const thimble = await adapters[5]?.requestIntention(packet);

  if (tide?.kind !== "speak" || thimble?.kind !== "speak") {
    assert.fail("seed adapters should answer unused post-retirement maintenance expiry checks");
  }
  assert.match(tide.content, /post-retirement maintenance expiry/);
  assert.match(tide.content, /unused scoped permission|side_effect\.expired/);
  assert.match(tide.content, /不是 execution|不是 result_reported|不是 provider recovery truth/);
  assert.match(tide.content, /003 仍 denied|accepted memory 仍 provisional/);
  assert.match(thimble.content, /未来要再查|重新提出 side_effect\.requested|不 revive 004/);
  assert.doesNotMatch(thimble.content, /post-retirement maintenance approval 必须批准 fresh request/);
  assert.notEqual(tide.content, thimble.content);
});

function fakeLedger(content = "Can the live agent respond only with an intention?") {
  return {
    async getById<TPayload>(eventId: string): Promise<RoomEvent<TPayload> | undefined> {
      if (eventId !== "evt_trigger") {
        return undefined;
      }
      return {
        event_id: eventId,
        room_id: "room_species",
        event_type: "message.created",
        schema_version: "1",
        payload_schema: "message.created.v1",
        occurred_at: "2026-06-18T00:00:00.000Z",
        appended_at: "2026-06-18T00:00:00.000Z",
        actor: { kind: "user", id: "user" },
        causation_id: null,
        correlation_id: "corr_test",
        idempotency_key: eventId,
        refs: [],
        payload: ({
          messageId: "msg_trigger",
          author: "user",
          authorKind: "user",
          mentions: [],
          contextRefs: [],
          content,
        } satisfies MessageCreatedPayload) as TPayload,
        prev_event_id: null,
        prev_event_hash: null,
        event_hash: `hash_${eventId}`,
      };
    },
  };
}
