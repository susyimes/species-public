import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AppendCommand, AppendResult, MessageCreatedPayload, RoomEvent } from "../src/types";
import { scriptedAgent } from "../src/room/agents";
import { LedgerLike, LivingRoomLoop } from "../src/room/loop";
import { MemoryClaimStore } from "../src/memory/memory";
import { PersonaService } from "../src/persona/persona";
import { TopicWindowStore } from "../src/context/context";
import { executeAgentCapability } from "../src/capabilities/capabilities";

class InMemoryLedger implements LedgerLike {
  public readonly events: RoomEvent[] = [];

  public async append<TPayload>(command: AppendCommand<TPayload>): Promise<AppendResult<TPayload>> {
    const duplicatePosition = this.events.findIndex(
      (event) =>
        event.room_id === command.roomId &&
        event.event_type === command.eventType &&
        event.idempotency_key === command.idempotencyKey,
    );
    if (duplicatePosition >= 0) {
      return {
        status: "duplicate",
        event: this.events[duplicatePosition] as RoomEvent<TPayload>,
        position: duplicatePosition,
      };
    }

    const eventId = `evt_${String(this.events.length + 1).padStart(4, "0")}`;
    const previous = this.events.at(-1);
    const event: RoomEvent<TPayload> = {
      event_id: eventId,
      room_id: command.roomId,
      event_type: command.eventType,
      schema_version: "1.0",
      payload_schema: command.payloadSchema ?? `${command.eventType}.v1`,
      occurred_at: command.occurredAt ?? "2026-06-17T00:00:00.000Z",
      appended_at: "2026-06-17T00:00:00.000Z",
      actor: command.actor,
      causation_id: command.causationId ?? null,
      correlation_id: command.correlationId,
      idempotency_key: command.idempotencyKey,
      refs: command.refs ?? [],
      payload: command.payload,
      prev_event_id: previous?.event_id ?? null,
      prev_event_hash: previous?.event_hash ?? null,
      event_hash: `hash_${eventId}`,
    };

    this.events.push(event);
    return { status: "appended", event, position: this.events.length - 1 };
  }

  public byType<TPayload = unknown>(eventType: string): RoomEvent<TPayload>[] {
    return this.events.filter((event) => event.event_type === eventType) as RoomEvent<TPayload>[];
  }

  public readAll(): Promise<RoomEvent[]> {
    return Promise.resolve(this.events.map((event) => ({ ...event })));
  }
}

test("stay_silent is a successful loop result", async () => {
  const ledger = new InMemoryLedger();
  const listener = scriptedAgent("listener", [{ kind: "stay_silent", reason: "listening" }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [listener],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Can @listener hold this quietly?",
    clientMessageId: "client_silence",
  });

  assert.equal(result.invitedAgents.length, 1);
  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["stay_silent"]);
  assert.deepEqual(result.visibleMessageEventIds, []);
  assert.equal(ledger.byType("agent.intention_recorded").length, 1);
  assert.equal(ledger.byType("message.created").length, 1);
});

test("speak intention creates a visible room message", async () => {
  const ledger = new InMemoryLedger();
  const architect = scriptedAgent("architect", [{ kind: "speak", content: "I can sketch the first boundary." }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [architect],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@architect what should the room do first?",
    clientMessageId: "client_speak",
  });

  const messages = ledger.byType<{ author: string; content: string }>("message.created");
  assert.equal(result.visibleMessageEventIds.length, 1);
  assert.equal(messages.length, 2);
  assert.equal(messages.at(-1)?.payload.author, "architect");
  assert.equal(messages.at(-1)?.payload.content, "I can sketch the first boundary.");
});

test("use_capability read result returns as private_agent context to the same agent before speech", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-loop-cap-read-"));
  try {
    const ledger = new InMemoryLedger();
    const filePath = path.join(dir, "today.txt");
    await writeFile(filePath, "today主要在做 agent-owned capability model", "utf8");
    const canonicalFilePath = await realpath(filePath);
    const reader = scriptedAgent("reader", [
      {
        kind: "use_capability",
        capabilityId: "local.filesystem.read",
        operation: "read_file",
        input: { path: filePath },
        reason: "需要先看本地记录再回答",
        contextRefs: ["evt_user_hint"],
      },
      (packet) => {
        const capabilityFragment = packet.contextFragments?.find((fragment) => fragment.type === "capability_result");
        assert.equal(capabilityFragment?.visibility, "private_agent");
        assert.match(capabilityFragment?.body ?? "", /agent-owned capability model/);
        return {
          kind: "speak",
          content: "我看了一下本地记录：今天主要在做 agent-owned capability model。",
          contextRefs: capabilityFragment?.refs.slice(0, 2) ?? [packet.triggeringEventId],
        };
      },
    ]);
    const loop = new LivingRoomLoop({
      ledger,
      agents: [reader],
      maxAwakenedAgents: 1,
      maxSpeakers: 1,
      capabilityExecutor: (request) => executeAgentCapability(request, { allowedReadRoots: [dir] }),
    });

    const result = await loop.processMessage({
      roomId: "room_species",
      author: "user",
      authorKind: "user",
      content: "@reader 看一下本地记录再总结。",
      clientMessageId: "client_capability_read",
      contextRefs: ["evt_user_hint"],
    });

    const capabilityInvoked = ledger.byType("capability.invoked");
    const capabilityResults = ledger.byType<{ visibility: string; status: string }>("capability.result");
    const continuationInvites = ledger
      .byType<{ invitedBy: string; reason: string; boundaryNote?: string }>("agent.invited")
      .filter((event) => event.payload.invitedBy === "capability_result");
    const messages = ledger.byType<MessageCreatedPayload>("message.created");

    assert.deepEqual(result.intentions.map((intention) => intention.kind), ["use_capability", "speak"]);
    assert.equal(result.capabilityInvocationEventIds.length, 1);
    assert.equal(result.capabilityResultEventIds.length, 1);
    assert.equal(capabilityInvoked.length, 1);
    assert.equal(capabilityResults.length, 1);
    assert.equal(capabilityResults[0]?.payload.visibility, "private_agent");
    assert.equal(capabilityResults[0]?.payload.status, "completed");
    assert.equal(continuationInvites.length, 1);
    assert.match(continuationInvites[0]?.payload.reason ?? "", /status=completed/);
    assert.equal(continuationInvites[0]?.payload.reason.includes(canonicalFilePath), true);
    assert.match(continuationInvites[0]?.payload.boundaryNote ?? "", /actual result status and source path\/cwd/);
    assert.equal(result.visibleMessageEventIds.length, 1);
    assert.equal(messages.at(-1)?.payload.author, "reader");
    assert.match(messages.at(-1)?.payload.content ?? "", /我看了一下本地记录/);
    assert.equal(messages.some((message) => message.payload.author === "capability_runtime"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("use_capability web search result returns as private_agent context before speech", async () => {
  let received: Record<string, unknown> | undefined;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          summary: "campaign search summary",
          results: [
            {
              title: "Class monitor campaign reference",
              url: "https://example.test/class-monitor-campaign",
              snippet: "Evidence returned through the search broker for this room turn.",
              source: "test-search-broker",
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    const ledger = new InMemoryLedger();
    const searcher = scriptedAgent("searcher", [
      {
        kind: "use_capability",
        capabilityId: "web.search.read",
        operation: "search",
        input: { query: "竞选班长 班级自治 公开资料" },
        reason: "需要先查一个公开参考再回应",
        contextRefs: ["evt_user_search_hint"],
      },
      (packet) => {
        const capabilityFragment = packet.contextFragments?.find((fragment) => fragment.type === "capability_result");
        assert.equal(capabilityFragment?.visibility, "private_agent");
        assert.match(capabilityFragment?.body ?? "", /Class monitor campaign reference/);
        assert.match(capabilityFragment?.body ?? "", /web_search/);
        return {
          kind: "speak",
          content: "我查到一个班长竞选参考，可以把它当成外部证据而不是房间结论。",
          contextRefs: capabilityFragment?.refs.slice(0, 2) ?? [packet.triggeringEventId],
        };
      },
    ]);
    const loop = new LivingRoomLoop({
      ledger,
      agents: [searcher],
      maxAwakenedAgents: 1,
      maxSpeakers: 1,
      capabilityExecutor: (request) =>
        executeAgentCapability(request, {
          searchEndpoint: `http://127.0.0.1:${port}/search`,
          maxSearchResults: 2,
        }),
    });

    const result = await loop.processMessage({
      roomId: "room_species",
      author: "user",
      authorKind: "user",
      content: "@searcher 先联网查一下竞选班长有什么参考。",
      clientMessageId: "client_capability_web_search",
      contextRefs: ["evt_user_search_hint"],
    });

    const capabilityResults = ledger.byType<{
      capabilityId: string;
      status: string;
      output: { kind?: string; resultCount?: number; backend?: string };
      visibility: string;
    }>("capability.result");
    const messages = ledger.byType<MessageCreatedPayload>("message.created");

    assert.deepEqual(result.intentions.map((intention) => intention.kind), ["use_capability", "speak"]);
    assert.equal(result.capabilityInvocationEventIds.length, 1);
    assert.equal(result.capabilityResultEventIds.length, 1);
    assert.equal(received?.query, "竞选班长 班级自治 公开资料");
    assert.equal(received?.maxResults, 2);
    assert.equal(capabilityResults.length, 1);
    assert.equal(capabilityResults[0]?.payload.capabilityId, "web.search.read");
    assert.equal(capabilityResults[0]?.payload.status, "completed");
    assert.equal(capabilityResults[0]?.payload.visibility, "private_agent");
    assert.equal(capabilityResults[0]?.payload.output.kind, "web_search");
    assert.equal(capabilityResults[0]?.payload.output.resultCount, 1);
    assert.match(capabilityResults[0]?.payload.output.backend ?? "", /^endpoint:/);
    assert.equal(messages.at(-1)?.payload.author, "searcher");
    assert.match(messages.at(-1)?.payload.content ?? "", /外部证据/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("large use_capability read result is offloaded to a private artifact preview", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-loop-cap-offload-"));
  try {
    const ledger = new InMemoryLedger();
    const filePath = path.join(dir, "large-note.txt");
    const artifactRoot = path.join(dir, "capability-artifacts");
    const tailMarker = "PRIVATE_CAPABILITY_TAIL_MARKER_SHOULD_STAY_OUT_OF_PROMPT";
    await writeFile(filePath, `${"private capability context line\n".repeat(2_000)}${tailMarker}`, "utf8");

    const reader = scriptedAgent("reader", [
      {
        kind: "use_capability",
        capabilityId: "local.filesystem.read",
        operation: "read_file",
        input: { path: filePath },
        reason: "Need the large private note before replying.",
        contextRefs: ["evt_large_private_note"],
      },
      async (packet) => {
        const capabilityFragment = packet.contextFragments?.find((fragment) => fragment.type === "capability_result");
        assert.equal(capabilityFragment?.visibility, "private_agent");
        assert.doesNotMatch(capabilityFragment?.body ?? "", new RegExp(tailMarker));
        const fragmentBody = JSON.parse(capabilityFragment?.body ?? "{}") as {
          output?: {
            kind?: string;
            artifactId?: string;
            artifactPath?: string;
            preview?: string;
            loadAffordance?: string;
          };
        };
        assert.equal(fragmentBody.output?.kind, "capability_output_artifact");
        assert.match(fragmentBody.output?.artifactId ?? "", /^capability_artifact_/);
        assert.match(fragmentBody.output?.preview ?? "", /private capability context line/);
        assert.match(fragmentBody.output?.loadAffordance ?? "", /local\.filesystem\.read/);
        assert.ok(fragmentBody.output?.artifactPath);
        const artifact = JSON.parse(await readFile(fragmentBody.output.artifactPath, "utf8")) as {
          output?: Record<string, unknown>;
          visibility?: string;
          boundaryNote?: string;
        };
        assert.equal(artifact.visibility, "private_agent");
        assert.match(JSON.stringify(artifact.output ?? {}), new RegExp(tailMarker));
        assert.match(artifact.boundaryNote ?? "", /not public room memory/);
        return {
          kind: "speak",
          content: "I found a large private capability result and only carried its artifact preview into the room turn.",
          contextRefs: [packet.triggeringEventId, fragmentBody.output.artifactId ?? ""],
        };
      },
    ]);
    const loop = new LivingRoomLoop({
      ledger,
      agents: [reader],
      maxAwakenedAgents: 1,
      maxSpeakers: 1,
      capabilityExecutor: (request) =>
        executeAgentCapability(request, {
          cwd: dir,
          maxBytes: 128 * 1024,
          artifactRoot,
          offloadThresholdBytes: 800,
        }),
    });

    const result = await loop.processMessage({
      roomId: "room_species",
      author: "user",
      authorKind: "user",
      content: "@reader read the large private note before answering.",
      clientMessageId: "client_capability_offload",
      contextRefs: ["evt_large_private_note"],
    });

    const capabilityResult = ledger.byType<{
      summary: string;
      output: { kind?: string; artifactId?: string; artifactPath?: string; preview?: string };
      visibility: string;
    }>("capability.result")[0];
    assert.deepEqual(result.intentions.map((intention) => intention.kind), ["use_capability", "speak"]);
    assert.equal(capabilityResult?.payload.visibility, "private_agent");
    assert.equal(capabilityResult?.payload.output.kind, "capability_output_artifact");
    assert.match(capabilityResult?.payload.output.artifactId ?? "", /^capability_artifact_/);
    assert.match(capabilityResult?.payload.summary ?? "", /offloaded to private capability artifact/);
    assert.doesNotMatch(JSON.stringify(capabilityResult?.payload.output ?? {}), new RegExp(tailMarker));
    assert.equal(result.visibleMessageEventIds.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("use_capability side-effect operation becomes approval request without execution", async () => {
  const ledger = new InMemoryLedger();
  const operator = scriptedAgent("operator", [
    {
      kind: "use_capability",
      capabilityId: "local.shell.exec",
      operation: "exec",
      input: { query: "echo should-not-run" },
      reason: "需要诊断命令，但这必须走审批",
      contextRefs: ["evt_shell_context"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [operator],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@operator 申请跑一个诊断命令。",
    clientMessageId: "client_capability_side_effect",
    contextRefs: ["evt_shell_context"],
  });

  const capabilityResult = ledger.byType<{ status: string }>("capability.result")[0];
  const sideEffects = ledger.byType<{
    kind: string;
    target: string;
    proposedCommand?: string;
    requestedFromIntentionEventId: string;
  }>("side_effect.requested");

  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["use_capability"]);
  assert.equal(result.visibleMessageEventIds.length, 0);
  assert.equal(result.sideEffectRequestEventIds.length, 1);
  assert.equal(capabilityResult?.payload.status, "approval_required");
  assert.equal(sideEffects.length, 1);
  assert.equal(sideEffects[0]?.payload.kind, "shell.exec");
  assert.equal(sideEffects[0]?.payload.target, "echo should-not-run");
  assert.equal(sideEffects[0]?.payload.proposedCommand, "echo should-not-run");
});

test("ask_question creates a visible message and topic open question", async () => {
  const ledger = new InMemoryLedger();
  const listener = scriptedAgent("listener", [
    {
      kind: "ask_question",
      question: "What remains unresolved before this becomes room memory?",
      target: "room",
      contextRefs: ["msg_source"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [listener],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@listener ask the room what is still unclear.",
    clientMessageId: "client_question",
  });

  const messages = ledger.byType<MessageCreatedPayload>("message.created");
  const questions = ledger.byType<{
    topicId: string;
    openQuestion: string;
    openQuestionRef: string;
    raisedBy: string;
    boundaryNote: string;
  }>("topic.updated");
  const questionEvent = questions.find((event) => event.payload.openQuestion);

  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["ask_question"]);
  assert.equal(result.visibleMessageEventIds.length, 1);
  assert.equal(messages.at(-1)?.payload.content, "What remains unresolved before this becomes room memory?");
  assert.equal(questionEvent?.payload.openQuestion, "What remains unresolved before this becomes room memory?");
  assert.equal(questionEvent?.payload.raisedBy, "listener");
  assert.match(questionEvent?.payload.boundaryNote ?? "", /not a demand/);

  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(result.topicId);
  assert.equal(topicWindow?.openQuestionRefs.includes(questionEvent?.payload.openQuestionRef ?? ""), true);
});

test("question-shaped speech can also become a topic open question", async () => {
  const ledger = new InMemoryLedger();
  const listener = scriptedAgent("listener", [
    {
      kind: "speak",
      content: "Which quiet objection should the room carry forward?",
      contextRefs: ["msg_source"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [listener],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@listener ask naturally if something remains unresolved.",
    clientMessageId: "client_speech_question",
  });

  const questionEvent = ledger
    .byType<{ openQuestion?: string; boundaryNote?: string }>("topic.updated")
    .find((event) => event.payload.openQuestion === "Which quiet objection should the room carry forward?");
  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["speak"]);
  assert.equal(result.visibleMessageEventIds.length, 1);
  assert.match(questionEvent?.payload.boundaryNote ?? "", /not a demand/);
});

test("speech with an open question ref records a response trace without closing it", async () => {
  const ledger = new InMemoryLedger();
  const listener = scriptedAgent("listener", [
    {
      kind: "ask_question",
      question: "What should remain unresolved?",
      target: "room",
      contextRefs: ["msg_source"],
    },
    {
      kind: "speak",
      content: "I would keep the uncertainty visible and revisit it later.",
      contextRefs: ["question_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [listener],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const asked = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@listener ask what should stay unresolved.",
    clientMessageId: "client_question_response_first",
  });
  const questionRef = ledger
    .byType<{ openQuestionRef?: string }>("topic.updated")
    .find((event) => event.payload.openQuestionRef)?.payload.openQuestionRef;
  assert.equal(questionRef, "question_0001");

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@listener revisit the open question without resolving it.",
    clientMessageId: "client_question_response_second",
    topicId: asked.topicId,
    contextRefs: [questionRef ?? ""],
  });

  const responses = ledger.byType<{
    questionRef: string;
    agentId: string;
    response: string;
    summary: string;
    boundaryNote: string;
  }>("open_question.responded");
  assert.equal(responses.length, 1);
  assert.equal(responses[0]?.payload.questionRef, questionRef);
  assert.equal(responses[0]?.payload.agentId, "listener");
  assert.equal(responses[0]?.payload.response, "deferred");
  assert.match(responses[0]?.payload.summary ?? "", /revisit it later/);
  assert.match(responses[0]?.payload.boundaryNote ?? "", /does not resolve or close/);

  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(asked.topicId);
  assert.equal(topicWindow?.openQuestionRefs.includes(questionRef ?? ""), true);
});

test("asking a follow-up with an open question ref creates a refined question lineage", async () => {
  const ledger = new InMemoryLedger();
  const listener = scriptedAgent("listener", [
    {
      kind: "ask_question",
      question: "What should remain unresolved?",
      target: "room",
      contextRefs: ["msg_source"],
    },
    {
      kind: "ask_question",
      question: "Which evidence would make the unresolved point safe to remember?",
      target: "room",
      contextRefs: ["question_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [listener],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const asked = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@listener ask what should stay unresolved.",
    clientMessageId: "client_question_refinement_first",
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@listener refine the carried question without resolving the original.",
    clientMessageId: "client_question_refinement_second",
    topicId: asked.topicId,
    contextRefs: ["question_0001"],
  });

  const responses = ledger.byType<{ questionRef: string; response: string; summary: string }>("open_question.responded");
  assert.equal(responses.length, 1);
  assert.equal(responses[0]?.payload.questionRef, "question_0001");
  assert.equal(responses[0]?.payload.response, "refined");
  assert.match(responses[0]?.payload.summary ?? "", /Which evidence/);

  const questions = ledger.byType<{
    openQuestionRef?: string;
    openQuestion?: string;
    refinedFromQuestionRef?: string;
    refinedBy?: string;
  }>("topic.updated").filter((event) => event.payload.openQuestionRef);
  assert.equal(questions.length, 2);
  assert.equal(questions[1]?.payload.openQuestionRef, "question_0002");
  assert.equal(questions[1]?.payload.refinedFromQuestionRef, "question_0001");
  assert.equal(questions[1]?.payload.refinedBy, "listener");
  assert.match(questions[1]?.payload.openQuestion ?? "", /Which evidence/);
  assert.equal(questions[1]?.refs.includes("question_0001"), true);

  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(asked.topicId);
  assert.equal(topicWindow?.openQuestionRefs.includes("question_0001"), true);
  assert.equal(topicWindow?.openQuestionRefs.includes("question_0002"), true);
});

test("explicit mention payload outranks unmentioned agents", async () => {
  const ledger = new InMemoryLedger();
  const first = scriptedAgent("first", [{ kind: "speak", content: "First should not wake." }]);
  const target = scriptedAgent("target", [{ kind: "stay_silent", reason: "invited by mention" }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [first, target],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "请被邀请的 agent 自己判断要不要回应。",
    clientMessageId: "client_explicit_mention",
    mentions: ["target"],
  });

  const messages = ledger.byType<MessageCreatedPayload>("message.created");
  const wake = ledger.byType<{ candidates: { agentId: string; reasons: string[] }[] }>("wake.candidates_selected");
  assert.deepEqual(result.invitedAgents, ["target"]);
  assert.deepEqual(messages[0].payload.mentions, ["target"]);
  assert.equal(wake[0].payload.candidates[0].agentId, "target");
  assert.equal(wake[0].payload.candidates[0].reasons.includes("mentioned"), true);
  assert.equal(first.receivedPackets.length, 0);
  assert.equal(target.receivedPackets.length, 1);
});

test("propose_memory records memory.proposed without promoting it to truth", async () => {
  const ledger = new InMemoryLedger();
  const archivist = scriptedAgent("archivist", [
    {
      kind: "propose_memory",
      summary: "Silence is a valid agent outcome.",
      reason: "The room accepted silence as a social decision in this turn.",
      contextRefs: ["msg_source"],
    },
    {
      kind: "propose_memory",
      summary: "Silence can be valid when it is ledgered as a deliberate choice.",
      reason: "The original wording was too broad; this revised claim names the evidence boundary.",
      revisedFromMemoryRef: "memory_0001",
      contextRefs: ["memory_0001", "msg_revision"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [archivist],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@archivist note the invariant",
    clientMessageId: "client_memory",
  });

  const proposals = ledger.byType<{ state: string; summary: string }>("memory.proposed");
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].payload.state, "proposed");
  assert.equal(proposals[0].payload.summary, "Silence is a valid agent outcome.");

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@archivist revise that memory claim without rewriting it",
    clientMessageId: "client_memory_revision",
    contextRefs: ["memory_0001"],
  });

  const revised = ledger.byType<{
    memoryId: string;
    state: string;
    summary: string;
    revisedFromMemoryRef?: string;
    boundaryNote?: string;
  }>("memory.proposed");
  assert.equal(revised.length, 2);
  assert.equal(revised[0].payload.memoryId, "memory_0001");
  assert.equal(revised[1].payload.memoryId, "memory_0002");
  assert.equal(revised[1].payload.revisedFromMemoryRef, "memory_0001");
  assert.match(revised[1].payload.boundaryNote ?? "", /fresh proposal/);
  assert.equal(revised[0].payload.summary, "Silence is a valid agent outcome.");
});

test("memory lifecycle intentions append accepted, stale, and retired transitions", async () => {
  const ledger = new InMemoryLedger();
  const memoryKeeper = scriptedAgent("memory_keeper", [
    {
      kind: "propose_memory",
      summary: "A provisional memory can be useful without becoming truth.",
      reason: "The room needs a claim it can later repair.",
      contextRefs: ["msg_source"],
    },
    {
      kind: "accept_memory",
      memoryRef: "memory_0001",
      reason: "The room can temporarily use it while keeping it contestable.",
      contextRefs: ["memory_0001", "msg_memory_review"],
    },
    {
      kind: "mark_memory_stale",
      memoryRef: "memory_0001",
      reason: "The active topic has moved beyond the original context.",
      contextRefs: ["memory_0001"],
    },
    {
      kind: "retire_memory",
      memoryRef: "memory_0001",
      reason: "The room should stop using this memory as guidance.",
      contextRefs: ["memory_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [memoryKeeper],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  for (const [index, content] of [
    "@memory_keeper propose a memory.",
    "@memory_keeper temporarily accept the memory.",
    "@memory_keeper mark the memory stale.",
    "@memory_keeper retire the memory.",
  ].entries()) {
    await loop.processMessage({
      roomId: "room_species",
      author: "user",
      authorKind: "user",
      content,
      clientMessageId: `client_memory_lifecycle_${index}`,
    });
  }

  assert.equal(ledger.byType("memory.proposed").length, 1);
  assert.equal(ledger.byType("memory.accepted").length, 1);
  assert.equal(ledger.byType("memory.stale").length, 1);
  assert.equal(ledger.byType("memory.retired").length, 1);

  const claim = MemoryClaimStore.fromEvents(ledger.events).get("memory_0001");
  assert.equal(claim?.state, "retired");
  assert.deepEqual(claim?.transitions.map((transition) => transition.toState), [
    "proposed",
    "accepted",
    "stale",
    "retired",
  ]);
});

test("memory review speech leaves a trace without changing memory state", async () => {
  const ledger = new InMemoryLedger();
  const memoryKeeper = scriptedAgent("memory_keeper", [
    {
      kind: "propose_memory",
      summary: "A provisional memory can be useful without becoming truth.",
      reason: "The room needs a claim it can later repair.",
      contextRefs: ["msg_source"],
    },
    {
      kind: "speak",
      content: "I would keep memory_0001 visible, but it still needs one source ref before anyone treats it as settled.",
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [memoryKeeper],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@memory_keeper propose a memory.",
    clientMessageId: "client_memory_review_trace_1",
  });
  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@memory_keeper review the memory without changing its state.",
    clientMessageId: "client_memory_review_trace_2",
    contextRefs: ["memory_0001"],
  });

  const reviews = ledger.byType<{
    memoryRef: string;
    agentId: string;
    response: string;
    summary: string;
    contextRefs: string[];
    boundaryNote: string;
  }>("memory.reviewed");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].payload.memoryRef, "memory_0001");
  assert.equal(reviews[0].payload.agentId, "memory_keeper");
  assert.equal(reviews[0].payload.response, "reviewed");
  assert.match(reviews[0].payload.summary, /still needs one source ref/);
  assert.equal(reviews[0].payload.contextRefs.includes("memory_0001"), true);
  assert.match(reviews[0].payload.boundaryNote, /does not accept, contest, stale, retire/);
  assert.equal(ledger.byType("memory.accepted").length, 0);
  assert.equal(ledger.byType("memory.contested").length, 0);
  assert.equal(ledger.byType("memory.stale").length, 0);
  assert.equal(ledger.byType("memory.retired").length, 0);

  const claim = MemoryClaimStore.fromEvents(ledger.events).get("memory_0001");
  assert.equal(claim?.state, "proposed");
  assert.deepEqual(claim?.transitions.map((transition) => transition.toState), ["proposed"]);

  const topicWindow = TopicWindowStore.fromEvents(ledger.events).view().topics[0];
  assert.equal(topicWindow?.memoryRefs.proposed.includes("memory_0001"), true);
  assert.equal(topicWindow?.memoryRefs.accepted.includes("memory_0001"), false);
});

test("provider boundary retirement is a room-visible runtime pressure transition", async () => {
  const ledger = new InMemoryLedger();
  const boundaryObserver = scriptedAgent("boundary_observer", [
    {
      kind: "retire_provider_boundary",
      providerBoundaryRef: "provider_boundary_001",
      reason: "The same agent later spoke, so this old runtime failure should leave current pressure.",
      contextRefs: ["provider_boundary_001", "msg_recovery"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [boundaryObserver],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@boundary_observer retire the old provider boundary from current pressure.",
    clientMessageId: "client_provider_boundary_retire",
    contextRefs: ["provider_boundary_001", "msg_recovery"],
  });

  const retirements = ledger.byType<{
    providerBoundaryRef: string;
    retiredBy: string;
    status: string;
    reason: string;
    boundaryNote: string;
  }>("provider_boundary.retired");

  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["retire_provider_boundary"]);
  assert.deepEqual(result.visibleMessageEventIds, []);
  assert.equal(retirements.length, 1);
  assert.equal(retirements[0].payload.providerBoundaryRef, "provider_boundary_001");
  assert.equal(retirements[0].payload.retiredBy, "boundary_observer");
  assert.equal(retirements[0].payload.status, "retired");
  assert.match(retirements[0].payload.boundaryNote, /does not delete ledger or archive history/);
});

test("persona delta intentions create emergent role claims through ledger responses", async () => {
  const ledger = new InMemoryLedger();
  const self = scriptedAgent("self", [
    {
      kind: "propose_persona_delta",
      field: "roleClaims",
      operation: "add",
      value: "quiet context carrier",
      reason: "Several room-visible turns show I help by carrying context without taking over.",
      contextRefs: ["msg_source"],
    },
  ]);
  const peer = scriptedAgent("peer", [
    {
      kind: "respond_persona_delta",
      deltaRef: "persona_delta_0001",
      response: "accept",
      reason: "The claim is narrow and still contestable.",
      contextRefs: ["persona_delta_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [self, peer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@self propose a self role claim if it helps.",
    clientMessageId: "client_persona_delta",
  });
  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@peer respond to the persona delta.",
    clientMessageId: "client_persona_delta_response",
    contextRefs: ["persona_delta_0001"],
  });

  assert.equal(ledger.byType("persona_delta.proposed").length, 1);
  assert.equal(ledger.byType("persona_delta.responded").length, 1);
  const projection = new PersonaService({ events: ledger.events }).getProjection("self");
  assert.equal(projection.profile.roleClaims[0]?.label, "quiet context carrier");
  assert.equal(projection.profile.roleClaims[0]?.status, "accepted");
  assert.equal(projection.evolutionLog[0]?.status, "accepted");
});

test("persona delta review speech leaves identity state unchanged", async () => {
  const ledger = new InMemoryLedger();
  const self = scriptedAgent("self", [
    {
      kind: "propose_persona_delta",
      field: "roleClaims",
      operation: "add",
      value: "quiet context carrier",
      reason: "Several room-visible turns show I help by carrying context without taking over.",
      contextRefs: ["msg_source"],
    },
  ]);
  const peer = scriptedAgent("peer", [
    {
      kind: "speak",
      content: "这条 persona delta 的证据还太薄；我先只保留疑问，不接受也不否定这个身份变化。",
      contextRefs: ["persona_delta_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [self, peer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@self propose a self role claim if it helps.",
    clientMessageId: "client_persona_delta_review_propose",
  });
  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@peer review the persona delta without accepting or rejecting it.",
    clientMessageId: "client_persona_delta_review",
    contextRefs: ["persona_delta_0001"],
  });

  const reviews = ledger.byType<{
    deltaRef: string;
    agentId: string;
    response: string;
    summary: string;
    boundaryNote: string;
  }>("persona_delta.reviewed");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.payload.deltaRef, "persona_delta_0001");
  assert.equal(reviews[0]?.payload.agentId, "peer");
  assert.equal(reviews[0]?.payload.response, "questioned");
  assert.match(reviews[0]?.payload.summary ?? "", /证据还太薄/);
  assert.match(reviews[0]?.payload.boundaryNote ?? "", /does not accept, reject/);
  assert.equal(ledger.byType("persona_delta.responded").length, 0);

  const projection = new PersonaService({ events: ledger.events }).getProjection("self");
  assert.equal(projection.profile.roleClaims[0]?.status, "proposed");
  assert.equal(projection.evolutionLog[0]?.status, "proposed");
  assert.equal(projection.evolutionLog[0]?.responses.length, 0);
});

test("persona delta revision response opens a fresh discussable persona proposal", async () => {
  const ledger = new InMemoryLedger();
  const self = scriptedAgent("self", [
    {
      kind: "propose_persona_delta",
      field: "roleClaims",
      operation: "add",
      value: "room stabilizer",
      reason: "A narrow self-claim might help others know when to invite me.",
      contextRefs: ["msg_source"],
    },
  ]);
  const peer = scriptedAgent("peer", [
    {
      kind: "respond_persona_delta",
      deltaRef: "persona_delta_0001",
      response: "revise",
      reason: "The wording sounds like a fixed job; make it a tentative behavior claim.",
      proposedRevision: "sometimes notices when a topic needs a gentler pace",
      contextRefs: ["persona_delta_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [self, peer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@self propose a self role claim if it helps.",
    clientMessageId: "client_persona_delta_revision_propose",
  });
  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@peer revise the persona delta instead of accepting it as a job.",
    clientMessageId: "client_persona_delta_revision_response",
    contextRefs: ["persona_delta_0001"],
  });

  const proposals = ledger.byType<{
    deltaId: string;
    agentId: string;
    proposedBy: string;
    proposedChange: { field: string; operation: string; value: string };
    status: string;
    revisedFromDeltaRef?: string;
    revisedBy?: string;
    evidenceRefs: string[];
  }>("persona_delta.proposed");
  const responses = ledger.byType<{
    deltaId: string;
    response: string;
    status: string;
    proposedRevision?: string;
  }>("persona_delta.responded");

  assert.equal(proposals.length, 2);
  assert.equal(responses.length, 1);
  assert.equal(responses[0]?.payload.response, "revise");
  assert.equal(responses[0]?.payload.status, "revised");
  assert.equal(responses[0]?.payload.proposedRevision, "sometimes notices when a topic needs a gentler pace");
  assert.equal(proposals[1]?.payload.deltaId, "persona_delta_0002");
  assert.equal(proposals[1]?.payload.agentId, "self");
  assert.equal(proposals[1]?.payload.proposedBy, "peer");
  assert.equal(proposals[1]?.payload.proposedChange.field, "roleClaims");
  assert.equal(proposals[1]?.payload.proposedChange.operation, "add");
  assert.equal(proposals[1]?.payload.proposedChange.value, "sometimes notices when a topic needs a gentler pace");
  assert.equal(proposals[1]?.payload.revisedFromDeltaRef, "persona_delta_0001");
  assert.equal(proposals[1]?.payload.revisedBy, "peer");
  assert.equal(proposals[1]?.payload.evidenceRefs.includes("persona_delta_0001"), true);

  const projection = new PersonaService({ events: ledger.events }).getProjection("self");
  assert.equal(projection.profile.roleClaims.length, 2);
  assert.equal(projection.profile.roleClaims[0]?.status, "revised");
  assert.equal(projection.profile.roleClaims[1]?.status, "proposed");
  assert.equal(projection.profile.roleClaims[1]?.label, "sometimes notices when a topic needs a gentler pace");
  assert.equal(projection.evolutionLog[1]?.revisedFromDeltaRef, "persona_delta_0001");
});

test("protocol intentions can accept and retire soft room etiquette", async () => {
  const ledger = new InMemoryLedger();
  const proposer = scriptedAgent("proposer", [
    {
      kind: "propose_protocol",
      summary: "For the next turn, answer with one concrete concern before adding plans.",
      scope: "current_topic",
      reason: "The room is drifting into broad agreement too quickly.",
      contextRefs: ["msg_source"],
    },
    {
      kind: "retire_protocol",
      protocolRef: "protocol_0001",
      reason: "The short etiquette did its job and should not become a permanent rule.",
      contextRefs: ["protocol_0001"],
    },
  ]);
  const peer = scriptedAgent("peer", [
    {
      kind: "respond_protocol",
      protocolRef: "protocol_0001",
      response: "accept",
      reason: "The scope is narrow and it preserves room freedom.",
      contextRefs: ["protocol_0001"],
    },
    {
      kind: "speak",
      content:
        "我会谨慎看待这个 protocol：它适合当前话题，但如果变成默认礼仪，就会压住反对和沉默。",
      contextRefs: ["protocol_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [proposer, peer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const proposed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@proposer propose a temporary etiquette.",
    clientMessageId: "client_protocol_propose",
  });
  assert.equal(ledger.byType("protocol.proposed").length, 1);
  const protocolProposal = ledger.byType<{
    expiresAt: string;
    expiryPolicy: string;
    boundaryNote: string;
  }>("protocol.proposed")[0]?.payload;
  assert.equal(protocolProposal?.expiryPolicy, "system_default_24h");
  assert.match(protocolProposal?.boundaryNote ?? "", /not permanent control flow/);
  assert.ok(Date.parse(protocolProposal?.expiresAt ?? "") > Date.now());
  const afterProposal = TopicWindowStore.fromEvents(ledger.events).getTopic(proposed.topicId);
  assert.equal(afterProposal?.protocolRefs.includes("protocol_0001"), false);
  assert.equal(afterProposal?.protocolProposalRefs.includes("protocol_0001"), true);

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@peer respond to the carried protocol.",
    clientMessageId: "client_protocol_accept",
    topicId: proposed.topicId,
    contextRefs: ["protocol_0001"],
  });

  assert.equal(ledger.byType<{ status: string }>("protocol.responded")[0]?.payload.status, "active");
  const afterAccept = TopicWindowStore.fromEvents(ledger.events).getTopic(proposed.topicId);
  assert.equal(afterAccept?.protocolRefs.includes("protocol_0001"), true);
  assert.equal(afterAccept?.protocolProposalRefs.includes("protocol_0001"), false);

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@peer review that etiquette without changing its state.",
    clientMessageId: "client_protocol_review",
    topicId: proposed.topicId,
    contextRefs: ["protocol_0001"],
  });

  const protocolReviews = ledger.byType<{
    protocolRef: string;
    response: string;
    summary: string;
    boundaryNote: string;
  }>("protocol.reviewed");
  assert.equal(protocolReviews.length, 1);
  assert.equal(protocolReviews[0]?.payload.protocolRef, "protocol_0001");
  assert.equal(protocolReviews[0]?.payload.response, "contested");
  assert.match(protocolReviews[0]?.payload.summary ?? "", /默认礼仪/);
  assert.match(protocolReviews[0]?.payload.boundaryNote ?? "", /does not accept, reject/);
  assert.equal(ledger.byType("protocol.responded").length, 1);
  const afterReview = TopicWindowStore.fromEvents(ledger.events).getTopic(proposed.topicId);
  assert.equal(afterReview?.protocolRefs.includes("protocol_0001"), true);
  assert.equal(afterReview?.protocolProposalRefs.includes("protocol_0001"), false);

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@proposer retire that temporary etiquette.",
    clientMessageId: "client_protocol_retire",
    topicId: proposed.topicId,
    contextRefs: ["protocol_0001"],
  });

  assert.equal(ledger.byType("protocol.retired").length, 1);
  const afterRetire = TopicWindowStore.fromEvents(ledger.events).getTopic(proposed.topicId);
  assert.equal(afterRetire?.protocolRefs.includes("protocol_0001"), false);
  assert.equal(afterRetire?.protocolProposalRefs.includes("protocol_0001"), false);
});

test("protocol revision response opens a fresh discussable proposal", async () => {
  const ledger = new InMemoryLedger();
  const proposer = scriptedAgent("proposer", [
    {
      kind: "propose_protocol",
      summary: "Pause for two turns before contesting any memory claim.",
      scope: "current_topic",
      reason: "The room needs more listening space.",
      contextRefs: ["msg_source"],
    },
  ]);
  const reviser = scriptedAgent("reviser", [
    {
      kind: "respond_protocol",
      protocolRef: "protocol_0001",
      response: "revise",
      reason: "The pause is useful but too broad for urgent corrections.",
      proposedRevision: "Pause only for memory claims that lack evidence refs.",
      contextRefs: ["protocol_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [proposer, reviser],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const proposed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@proposer propose a listening protocol.",
    clientMessageId: "client_protocol_revision_propose",
  });
  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviser revise that protocol as a new etiquette proposal.",
    clientMessageId: "client_protocol_revision_response",
    topicId: proposed.topicId,
    contextRefs: ["protocol_0001"],
  });

  const proposals = ledger.byType<{
    protocolId: string;
    summary: string;
    scope: string;
    revisedFromProtocolRef?: string;
    revisedBy?: string;
    contextRefs: string[];
  }>("protocol.proposed");
  const response = ledger.byType<{ protocolRef: string; response: string; status: string; proposedRevision?: string }>(
    "protocol.responded",
  )[0];
  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(proposed.topicId);

  assert.equal(proposals.length, 2);
  assert.equal(response.payload.protocolRef, "protocol_0001");
  assert.equal(response.payload.response, "revise");
  assert.equal(response.payload.status, "revised");
  assert.equal(response.payload.proposedRevision, "Pause only for memory claims that lack evidence refs.");
  assert.equal(proposals[1].payload.protocolId, "protocol_0002");
  assert.equal(proposals[1].payload.summary, "Pause only for memory claims that lack evidence refs.");
  assert.equal(proposals[1].payload.scope, "current_topic");
  assert.equal(proposals[1].payload.revisedFromProtocolRef, "protocol_0001");
  assert.equal(proposals[1].payload.revisedBy, "reviser");
  assert.equal(proposals[1].payload.contextRefs.includes("protocol_0001"), true);
  assert.equal(topicWindow?.protocolRefs.includes("protocol_0001"), false);
  assert.equal(topicWindow?.protocolProposalRefs.includes("protocol_0001"), true);
  assert.equal(topicWindow?.protocolProposalRefs.includes("protocol_0002"), true);
});

test("archive review intentions create critique and repair proposals without mutating archives", async () => {
  const ledger = new InMemoryLedger();
  const reviewer = scriptedAgent("reviewer", [
    {
      kind: "review_archive",
      archiveRef: "day_2026_06_19",
      assessment: "missing_context",
      summary: "The archive is a useful skeleton but lacks one contested source.",
      reason: "Archive review should remain a visible critique rather than a rewrite.",
      contextRefs: ["day_2026_06_19", "msg_archive_review"],
    },
    {
      kind: "propose_archive_repair",
      archiveRef: "day_2026_06_19",
      summary: "Add a caveat about the contested memory.",
      reason: "The archive summary can sound too settled without the caveat.",
      proposedRepair: "Add: one memory remains contested and needs source review.",
      contextRefs: ["day_2026_06_19", "memory_0001"],
    },
    {
      kind: "respond_archive_repair",
      repairRef: "archive_repair_0001",
      response: "revise",
      reason: "The caveat is useful but should identify the contested source.",
      proposedRevision: "Tie the caveat to memory_0001 and keep the archive unchanged.",
      contextRefs: ["archive_repair_0001", "memory_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [reviewer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviewer review the latest archive as a time skeleton.",
    clientMessageId: "client_archive_review",
    contextRefs: ["day_2026_06_19"],
  });
  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviewer propose a repair without rewriting the archive.",
    clientMessageId: "client_archive_repair",
    contextRefs: ["day_2026_06_19"],
  });
  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviewer respond to the repair proposal without rewriting the archive.",
    clientMessageId: "client_archive_repair_response",
    contextRefs: ["archive_repair_0001"],
  });

  const reviews = ledger.byType<{ assessment: string; boundaryNote: string }>("archive.reviewed");
  const repairs = ledger.byType<{
    repairId: string;
    status: string;
    summary: string;
    proposedRepair: string;
    revisedFromRepairRef?: string;
    revisedBy?: string;
    contextRefs: string[];
    boundaryNote: string;
  }>("archive.repair_proposed");
  const responses = ledger.byType<{
    status: string;
    response: string;
    proposedRevision?: string;
    boundaryNote: string;
  }>("archive.repair_responded");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.payload.assessment, "missing_context");
  assert.match(reviews[0]?.payload.boundaryNote ?? "", /not archive mutation/);
  assert.equal(repairs.length, 2);
  assert.equal(repairs[0]?.payload.status, "proposed");
  assert.match(repairs[0]?.payload.proposedRepair ?? "", /memory remains contested/);
  assert.match(repairs[0]?.payload.boundaryNote ?? "", /does not rewrite/);
  assert.equal(repairs[1]?.payload.repairId, "archive_repair_0002");
  assert.equal(repairs[1]?.payload.revisedFromRepairRef, "archive_repair_0001");
  assert.equal(repairs[1]?.payload.revisedBy, "reviewer");
  assert.match(repairs[1]?.payload.summary ?? "", /archive unchanged/);
  assert.match(repairs[1]?.payload.proposedRepair ?? "", /archive unchanged/);
  assert.equal(repairs[1]?.payload.contextRefs.includes("archive_repair_0001"), true);
  assert.equal(responses.length, 1);
  assert.equal(responses[0]?.payload.status, "revised");
  assert.equal(responses[0]?.payload.response, "revise");
  assert.match(responses[0]?.payload.proposedRevision ?? "", /archive unchanged/);
  assert.match(responses[0]?.payload.boundaryNote ?? "", /archive content is unchanged/);
  assert.equal(ledger.byType("daily_archive.created").length, 0);
});

test("topic proposals are social suggestions and do not switch the active topic", async () => {
  const ledger = new InMemoryLedger();
  const proposer = scriptedAgent("proposer", [
    {
      kind: "propose_topic",
      action: "split",
      title: "Topic proposals as social order",
      reason: "The room should discuss topic formation without forcing the active thread to change.",
      targetTopicId: "topic_legacy",
      contextRefs: ["msg_source"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [proposer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@proposer suggest a topic split without taking over.",
    clientMessageId: "client_topic_proposal",
  });

  const proposals = ledger.byType<{
    proposalId: string;
    currentTopicId: string;
    proposedBy: string;
    action: string;
    title: string;
    targetTopicId?: string;
    boundaryNote: string;
  }>("topic.proposed");
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]?.payload.currentTopicId, result.topicId);
  assert.equal(proposals[0]?.payload.proposedBy, "proposer");
  assert.equal(proposals[0]?.payload.action, "split");
  assert.equal(proposals[0]?.payload.targetTopicId, "topic_legacy");
  assert.match(proposals[0]?.payload.boundaryNote ?? "", /does not switch/);
  assert.deepEqual(result.visibleMessageEventIds, []);

  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(result.topicId);
  assert.equal(topicWindow?.status, "active");
  assert.equal(topicWindow?.topicRefs.includes("topic_proposal_0001"), true);
});

test("topic proposal revisions open fresh topic proposals without switching the active topic", async () => {
  const ledger = new InMemoryLedger();
  const proposer = scriptedAgent("proposer", [
    {
      kind: "propose_topic",
      action: "split",
      title: "Topic proposals as social order",
      reason: "The room should discuss topic formation without forcing the active thread to change.",
      contextRefs: [],
    },
  ]);
  const responder = scriptedAgent("responder", [
    {
      kind: "respond_topic",
      topicProposalRef: "topic_proposal_0001",
      response: "revise",
      reason: "The split is useful, but the room should first preserve the unresolved question.",
      proposedRevision: "Split after one more objection round.",
      contextRefs: ["topic_proposal_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [proposer, responder],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const proposed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@proposer suggest a topic split without taking over.",
    clientMessageId: "client_topic_proposal_response_seed",
  });
  const responded = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@responder respond to the topic proposal without applying it.",
    clientMessageId: "client_topic_proposal_response",
    contextRefs: ["topic_proposal_0001"],
  });

  const responses = ledger.byType<{
    topicProposalRef: string;
    topicId: string;
    agentId: string;
    response: string;
    proposedRevision?: string;
    boundaryNote: string;
  }>("topic.responded");
  const proposals = ledger.byType<{
    proposalId: string;
    currentTopicId: string;
    proposedBy: string;
    action: string;
    title: string;
    revisedFromTopicProposalRef?: string;
    revisedBy?: string;
    contextRefs: string[];
  }>("topic.proposed");
  assert.equal(responses.length, 1);
  assert.equal(responses[0]?.payload.topicProposalRef, "topic_proposal_0001");
  assert.equal(responses[0]?.payload.topicId, proposed.topicId);
  assert.equal(responses[0]?.payload.agentId, "responder");
  assert.equal(responses[0]?.payload.response, "revise");
  assert.match(responses[0]?.payload.proposedRevision ?? "", /one more objection/);
  assert.match(responses[0]?.payload.boundaryNote ?? "", /does not switch/);
  assert.equal(proposals.length, 2);
  assert.equal(proposals[1]?.payload.proposalId, "topic_proposal_0002");
  assert.equal(proposals[1]?.payload.currentTopicId, proposed.topicId);
  assert.equal(proposals[1]?.payload.proposedBy, "responder");
  assert.equal(proposals[1]?.payload.action, "split");
  assert.equal(proposals[1]?.payload.title, "Split after one more objection round.");
  assert.equal(proposals[1]?.payload.revisedFromTopicProposalRef, "topic_proposal_0001");
  assert.equal(proposals[1]?.payload.revisedBy, "responder");
  assert.equal(proposals[1]?.payload.contextRefs.includes("topic_proposal_0001"), true);
  assert.deepEqual(responded.visibleMessageEventIds, []);

  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(proposed.topicId);
  assert.equal(topicWindow?.status, "active");
  assert.equal(topicWindow?.topicRefs.includes("topic_proposal_0001"), true);
  assert.equal(topicWindow?.topicRefs.includes("topic_proposal_0002"), true);
  assert.equal(topicWindow?.topicRefs.some((ref) => ref.startsWith("topic_response_")), true);
});

test("ordinary speech about topic proposals records review traces without responding or applying", async () => {
  const ledger = new InMemoryLedger();
  const proposer = scriptedAgent("proposer", [
    {
      kind: "propose_topic",
      action: "split",
      title: "Separate context-engine testing",
      reason: "The room may need a smaller surface for test evidence, but the active topic should not move yet.",
      contextRefs: [],
    },
  ]);
  const reviewer = scriptedAgent("reviewer", [
    {
      kind: "speak",
      content: "这个 topic proposal 可能过早拆分当前话题；我先只保留疑问，不接受也不应用。",
      contextRefs: ["topic_proposal_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [proposer, reviewer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const proposed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@proposer suggest a topic split without taking over.",
    clientMessageId: "client_topic_review_propose",
  });
  const reviewed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviewer comment on the topic proposal without responding to it.",
    clientMessageId: "client_topic_review_speak",
    contextRefs: ["topic_proposal_0001"],
  });

  const reviews = ledger.byType<{
    reviewId: string;
    topicProposalRef: string;
    topicId: string;
    agentId: string;
    response: string;
    summary: string;
    boundaryNote: string;
  }>("topic.reviewed");
  assert.equal(reviewed.visibleMessageEventIds.length, 1);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.payload.topicProposalRef, "topic_proposal_0001");
  assert.equal(reviews[0]?.payload.topicId, proposed.topicId);
  assert.equal(reviews[0]?.payload.agentId, "reviewer");
  assert.equal(reviews[0]?.payload.response, "questioned");
  assert.match(reviews[0]?.payload.summary ?? "", /不接受也不应用/);
  assert.match(reviews[0]?.payload.boundaryNote ?? "", /does not accept, reject/);
  assert.equal(ledger.byType("topic.responded").length, 0);
  assert.equal(ledger.byType("topic.applied").length, 0);

  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(proposed.topicId);
  assert.equal(topicWindow?.status, "active");
  assert.equal(topicWindow?.topicRefs.includes("topic_proposal_0001"), true);
  assert.equal(topicWindow?.topicRefs.some((ref) => ref.startsWith("topic_review_")), false);
});

test("topic application applies a proposal as room-visible topic movement", async () => {
  const ledger = new InMemoryLedger();
  const mover = scriptedAgent("mover", [
    {
      kind: "propose_topic",
      action: "split",
      title: "Applied topic split",
      reason: "The room should give this thread a separate surface.",
      contextRefs: [],
    },
    () => ({
      kind: "apply_topic",
      topicProposalRef: ledger.byType<{ proposalId: string }>("topic.proposed")[0]?.payload.proposalId ?? "missing",
      action: "split",
      title: "Applied topic split",
      reason: "The proposal has enough room-visible support to become a topic.",
      contextRefs: ["topic_proposal_0001"],
    }),
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [mover],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const proposed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@mover propose a topic split.",
    clientMessageId: "client_topic_apply_propose",
  });
  const proposalId = ledger.byType<{ proposalId: string }>("topic.proposed")[0]?.payload.proposalId;
  assert.ok(proposalId);

  const applied = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@mover apply that topic proposal if the room should move.",
    clientMessageId: "client_topic_apply",
    contextRefs: [proposalId],
  });

  assert.equal(applied.intentions.at(-1)?.kind, "apply_topic");
  const application = ledger.byType<{
    topicProposalRef: string;
    action: string;
    resultingTopicId: string;
    boundaryNote: string;
  }>("topic.applied")[0];
  assert.equal(application?.payload.topicProposalRef, proposalId);
  assert.equal(application?.payload.action, "split");
  assert.match(application?.payload.boundaryNote ?? "", /not hidden scheduler control/);
  const createdTopics = ledger.byType<{ topicId: string; parentTopicId?: string; appliedTopicProposalRef?: string }>("topic.created");
  assert.equal(createdTopics.length, 2);
  assert.equal(createdTopics[1]?.payload.parentTopicId, proposed.topicId);
  assert.equal(createdTopics[1]?.payload.appliedTopicProposalRef, proposalId);
  assert.equal(TopicWindowStore.fromEvents(ledger.events).getTopic(createdTopics[1]?.payload.topicId ?? "")?.status, "active");
});

test("side-effect intentions only create approval requests and preserve actor boundary", async () => {
  const ledger = new InMemoryLedger();
  const requester = scriptedAgent("requester", [
    {
      kind: "request_side_effect",
      request: {
        requestId: "sidefx_private_note",
        roomId: "wrong_room",
        requestedBy: "other_agent",
        topicId: "wrong_topic",
        kind: "filesystem.write",
        reason: "Draft a private scratch note before sharing anything.",
        target: "agents/requester/workspace/note.md",
        expectedImpact: "One private note; no public memory changes.",
        contextRefs: ["msg_source"],
        proposedCommand: "write note.md",
        idempotencyKey: "provider_supplied_key",
      },
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [requester],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@requester ask for approval if private scratch would help.",
    clientMessageId: "client_side_effect_request",
  });

  assert.equal(result.sideEffectRequestEventIds.length, 1);
  assert.equal(ledger.byType("side_effect.requested").length, 1);
  assert.equal(ledger.byType("side_effect.approved").length, 0);
  assert.equal(ledger.byType("side_effect.result_reported").length, 0);
  const request = ledger.byType<{
    roomId: string;
    requestedBy: string;
    topicId: string;
    contextRefs: string[];
    requestedFromIntentionEventId: string;
    idempotencyKey: string;
  }>("side_effect.requested")[0];
  assert.equal(request.payload.roomId, "room_species");
  assert.equal(request.payload.requestedBy, "requester");
  assert.equal(request.payload.topicId, result.topicId);
  assert.equal(request.payload.contextRefs.includes(result.triggeringMessageEventId), true);
  assert.equal(request.payload.requestedFromIntentionEventId.startsWith("evt_"), true);
  assert.match(request.payload.idempotencyKey, /^side_effect_request:room_species:/);
});

test("ordinary speech about a side-effect request records review pressure without approval state changes", async () => {
  const ledger = new InMemoryLedger();
  const requester = scriptedAgent("requester", [
    {
      kind: "request_side_effect",
      request: {
        requestId: "sidefx_private_note",
        roomId: "wrong_room",
        requestedBy: "other_agent",
        topicId: "wrong_topic",
        kind: "filesystem.write",
        reason: "Private scratch may help later.",
        target: "agents/requester/workspace/note.md",
        expectedImpact: "One private note only.",
        contextRefs: [],
        idempotencyKey: "provider_supplied_key",
      },
    },
  ]);
  const reviewer = scriptedAgent("reviewer", [
    {
      kind: "speak",
      content: "This side-effect request is still too broad; it should stay unapproved until the target is narrower.",
      contextRefs: ["sidefx_private_note"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [requester, reviewer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@requester request a side-effect boundary only.",
    clientMessageId: "client_side_effect_review_request",
  });
  const reviewed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviewer discuss sidefx_private_note without approving or denying it.",
    clientMessageId: "client_side_effect_review_speech",
    contextRefs: ["sidefx_private_note"],
  });

  const review = ledger.byType<{
    sideEffectRef: string;
    response: string;
    summary: string;
    boundaryNote?: string;
  }>("side_effect.reviewed")[0];

  assert.deepEqual(reviewed.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["reviewer:speak"]);
  assert.equal(ledger.byType("side_effect.requested").length, 1);
  assert.equal(ledger.byType("side_effect.approved").length, 0);
  assert.equal(ledger.byType("side_effect.denied").length, 0);
  assert.equal(ledger.byType("side_effect.expired").length, 0);
  assert.equal(ledger.byType("side_effect.result_reported").length, 0);
  assert.equal(review?.payload.sideEffectRef, "sidefx_private_note");
  assert.equal(review?.payload.response, "cautioned");
  assert.match(review?.payload.summary ?? "", /too broad/);
  assert.match(review?.payload.boundaryNote ?? "", /does not approve, deny, expire, execute/);
});

test("archive review request speech records archive review without side effects", async () => {
  const ledger = new InMemoryLedger();
  const reviewer = scriptedAgent("reviewer", [
    {
      kind: "speak",
      content:
        "This daily rhythm invitation can surface omissions, but it is not an external action request or execution boundary.",
      contextRefs: ["archive_review_request_evt_archive"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [reviewer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await ledger.append({
    roomId: "room_species",
    eventType: "archive.review_requested",
    actor: { kind: "system", id: "archive_worker" },
    payload: {
      requestId: "archive_review_request_evt_archive",
      archiveRef: "day_2026_06_21",
      date: "2026-06-21",
      requestedBy: "archive_worker",
      summary: "Review daily archive as a time skeleton, not consensus.",
      reason: "Daily rhythm invites critique without forcing speech or repair.",
      status: "open",
      contextRefs: ["day_2026_06_21"],
      boundaryNote:
        "daily archive review request is a daily rhythm invitation, not a command to speak, accept, or repair the archive",
    },
    refs: ["day_2026_06_21"],
    correlationId: "archive_review_request_fixture",
    idempotencyKey: "archive_review_request_fixture",
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviewer discuss archive_review_request_evt_archive as a daily rhythm invitation.",
    clientMessageId: "client_archive_review_request_not_side_effect",
    mentions: ["reviewer"],
    contextRefs: ["archive_review_request_evt_archive"],
  });

  assert.deepEqual(result.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["reviewer:speak"]);
  const archiveReviews = ledger.byType<{
    archiveRef: string;
    reviewedBy: string;
    summary: string;
    assessment: string;
    boundaryNote?: string;
  }>("archive.reviewed");
  assert.equal(archiveReviews.length, 1);
  assert.equal(archiveReviews[0]?.payload.archiveRef, "day_2026_06_21");
  assert.equal(archiveReviews[0]?.payload.reviewedBy, "reviewer");
  assert.equal(archiveReviews[0]?.payload.assessment, "missing_context");
  assert.match(archiveReviews[0]?.payload.summary ?? "", /daily rhythm invitation/);
  assert.match(archiveReviews[0]?.payload.boundaryNote ?? "", /not archive mutation/);
  assert.equal(ledger.byType("side_effect.reviewed").length, 0);
  assert.equal(ledger.byType("side_effect.requested").length, 0);
  assert.equal(ledger.byType("archive.repair_proposed").length, 0);
  assert.equal(ledger.byType("archive.repair_responded").length, 0);
});

test("workspace artifact shares are ledgered refs without becoming memory", async () => {
  const ledger = new InMemoryLedger();
  const pressureRef = "mixed_review:workspace_artifact_pressure";
  const sharer = scriptedAgent("sharer", [
    {
      kind: "share_workspace_artifact",
      pathRef: "agents/sharer/workspace/reflection.md",
      summary: "A private reflection is ready to discuss as an artifact ref.",
      contextRefs: [],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [sharer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@sharer share only a workspace artifact ref if you have one.",
    clientMessageId: "client_workspace_artifact_share",
    contextRefs: [pressureRef],
  });

  assert.deepEqual(result.visibleMessageEventIds, []);
  assert.equal(ledger.byType("workspace.artifact_shared").length, 1);
  assert.equal(ledger.byType("memory.proposed").length, 0);
  const share = ledger.byType<{
    artifactId: string;
    workspaceId: string;
    agentId: string;
    pathRef: string;
    contextRefs: string[];
    sourcePressureRefs?: string[];
    boundaryNote: string;
  }>("workspace.artifact_shared")[0];
  assert.equal(share.payload.workspaceId, "workspace_sharer");
  assert.equal(share.payload.agentId, "sharer");
  assert.equal(share.payload.pathRef, "agents/sharer/workspace/reflection.md");
  assert.equal(share.payload.contextRefs.includes(result.triggeringMessageEventId), true);
  assert.equal(share.payload.contextRefs.includes(pressureRef), true);
  assert.deepEqual(share.payload.sourcePressureRefs, [pressureRef]);
  assert.match(share.payload.boundaryNote, /not copied into memory/);
});

test("ordinary speech can review a workspace artifact ref without copying it into memory", async () => {
  const ledger = new InMemoryLedger();
  const sharer = scriptedAgent("sharer", [
    {
      kind: "share_workspace_artifact",
      pathRef: "agents/sharer/workspace/reflection.md",
      summary: "A private reflection is ready to discuss as an artifact ref.",
      contextRefs: ["msg_source"],
    },
  ]);
  const reviewer = scriptedAgent("reviewer", [
    {
      kind: "speak",
      content: "Treat this as a private workspace ref only; do not copy contents or promote it into memory.",
      contextRefs: [],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [sharer, reviewer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@sharer share only a workspace artifact ref if you have one.",
    clientMessageId: "client_workspace_artifact_review_share",
  });

  const artifactRef = ledger.byType<{ artifactId: string }>("workspace.artifact_shared")[0]?.payload.artifactId;
  assert.ok(artifactRef);

  const reviewed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: `@reviewer discuss ${artifactRef} without copying private contents or writing memory.`,
    clientMessageId: "client_workspace_artifact_review_speech",
    contextRefs: [artifactRef],
  });

  const review = ledger.byType<{
    artifactRef: string;
    response: string;
    summary: string;
    boundaryNote?: string;
  }>("workspace.artifact_reviewed")[0];

  assert.deepEqual(reviewed.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["reviewer:speak"]);
  assert.equal(ledger.byType("workspace.artifact_shared").length, 1);
  assert.equal(ledger.byType("workspace.artifact_reviewed").length, 1);
  assert.equal(ledger.byType("memory.proposed").length, 0);
  assert.equal(ledger.byType("side_effect.requested").length, 0);
  assert.equal(review?.payload.artifactRef, artifactRef);
  assert.equal(review?.payload.response, "cautioned");
  assert.match(review?.payload.summary ?? "", /private workspace ref/);
  assert.match(review?.payload.boundaryNote ?? "", /does not copy private workspace contents/);
});

test("ordinary speech can review a skill capsule without executing or assigning responsibility", async () => {
  const ledger = new InMemoryLedger();
  const pressureRef = "mixed_review:skill_capsule_pressure";
  const reviewer = scriptedAgent("reviewer", [
    {
      kind: "speak",
      content: "This skill capsule needs approval boundaries; it must not execute tools or become my fixed role.",
      contextRefs: [],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [reviewer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const reviewed = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviewer discuss skill_action_writer without executing it or assigning responsibility.",
    clientMessageId: "client_skill_capsule_review_speech",
    contextRefs: ["skill_action_writer", pressureRef],
  });

  const review = ledger.byType<{
    capsuleRef: string;
    response: string;
    summary: string;
    sourcePressureRefs?: string[];
    boundaryNote?: string;
  }>("skill.capsule_reviewed")[0];

  assert.deepEqual(reviewed.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["reviewer:speak"]);
  assert.equal(ledger.byType("skill.capsule_reviewed").length, 1);
  assert.equal(ledger.byType("memory.proposed").length, 0);
  assert.equal(ledger.byType("side_effect.requested").length, 0);
  assert.equal(review?.payload.capsuleRef, "skill_action_writer");
  assert.equal(review?.payload.response, "cautioned");
  assert.match(review?.payload.summary ?? "", /approval boundaries/);
  assert.deepEqual(review?.payload.sourcePressureRefs, [pressureRef]);
  assert.equal(review?.refs.includes(pressureRef), true);
  assert.match(review?.payload.boundaryNote ?? "", /does not register a skill, assign a role, execute tools/);
});

test("handoff proposal secondarily wakes recipient without forcing speech", async () => {
  const ledger = new InMemoryLedger();
  const architect = scriptedAgent("architect", [
    {
      kind: "propose_handoff",
      toAgentId: "critic",
      reason: "This needs pressure testing.",
      requestedResponse: "Find the weakest assumption.",
      contextRefs: ["msg_design"],
    },
  ]);
  const critic = scriptedAgent("critic", [
    {
      kind: "reject_handoff",
      handoffRef: "evt_0006",
      reason: "The packet is too narrow to accept.",
      contextRefs: ["msg_design"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [architect, critic],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@architect route this socially",
    clientMessageId: "client_handoff",
  });

  assert.deepEqual(result.invitedAgents, ["architect"]);
  assert.deepEqual(result.secondaryInvitedAgents, ["critic"]);
  assert.equal(ledger.byType("handoff.proposed").length, 1);
  assert.equal(ledger.byType("handoff.responded").length, 1);
  assert.equal(critic.receivedPackets.length, 1);
  assert.equal(ledger.byType("message.created").length, 1);
});

test("handoff review speech leaves a trace without transferring control", async () => {
  const ledger = new InMemoryLedger();
  const architect = scriptedAgent("architect", [
    {
      kind: "propose_handoff",
      toAgentId: "critic",
      reason: "This needs pressure testing.",
      requestedResponse: "Find the weakest assumption.",
      contextRefs: ["msg_design"],
    },
  ]);
  const critic = scriptedAgent("critic", [
    {
      kind: "speak",
      content: "这个 handoff packet 过宽，缺少上下文边界；我先不接管，只建议收窄范围。",
      contextRefs: ["handoff_0001"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [architect, critic],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@architect route this socially so the target can review the packet.",
    clientMessageId: "client_handoff_review",
  });

  const reviews = ledger.byType<{
    handoffRef: string;
    agentId: string;
    response: string;
    summary: string;
    boundaryNote: string;
  }>("handoff.reviewed");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.payload.handoffRef, "handoff_0001");
  assert.equal(reviews[0]?.payload.agentId, "critic");
  assert.equal(reviews[0]?.payload.response, "cautioned");
  assert.match(reviews[0]?.payload.summary ?? "", /不接管/);
  assert.match(reviews[0]?.payload.boundaryNote ?? "", /does not accept, reject/);
  assert.equal(ledger.byType("handoff.responded").length, 0);

  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(result.topicId);
  assert.equal(topicWindow?.handoffRefs.includes("handoff_0001"), true);
});

test("delegated handoff creates a new visible proposal and wakes the delegate", async () => {
  const ledger = new InMemoryLedger();
  const architect = scriptedAgent("architect", [
    {
      kind: "propose_handoff",
      toAgentId: "critic",
      reason: "This needs pressure testing.",
      requestedResponse: "Find the weakest assumption.",
      contextRefs: ["msg_design"],
    },
  ]);
  const critic = scriptedAgent("critic", [
    {
      kind: "delegate_handoff",
      handoffRef: "handoff_0001",
      redirectTo: "scout",
      reason: "Scout has the narrower context boundary.",
      contextRefs: ["handoff_0001"],
    },
  ]);
  const scout = scriptedAgent("scout", [{ kind: "stay_silent", reason: "delegated handoff received without forced speech" }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [architect, critic, scout],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@architect route this socially, and let the receiver delegate if needed.",
    clientMessageId: "client_handoff_delegate",
  });

  const handoffs = ledger.byType<{
    handoffId: string;
    fromAgentId: string;
    toAgentId: string;
    requestedResponse?: string;
    delegatedFromHandoffRef?: string;
    delegatedBy?: string;
    boundaryNote?: string;
  }>("handoff.proposed");
  const responses = ledger.byType<{
    handoffRef: string;
    byAgentId: string;
    response: string;
    redirectTo?: string;
  }>("handoff.responded");
  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(result.topicId);

  assert.deepEqual(result.invitedAgents, ["architect"]);
  assert.deepEqual(result.secondaryInvitedAgents, ["critic", "scout"]);
  assert.deepEqual(result.intentions.map((intention) => intention.kind), [
    "propose_handoff",
    "delegate_handoff",
    "stay_silent",
  ]);
  assert.equal(handoffs.length, 2);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].payload.handoffRef, "handoff_0001");
  assert.equal(responses[0].payload.byAgentId, "critic");
  assert.equal(responses[0].payload.response, "redirected");
  assert.equal(responses[0].payload.redirectTo, "scout");
  assert.equal(handoffs[1].payload.fromAgentId, "critic");
  assert.equal(handoffs[1].payload.toAgentId, "scout");
  assert.equal(handoffs[1].payload.requestedResponse, "Find the weakest assumption.");
  assert.equal(handoffs[1].payload.delegatedFromHandoffRef, "handoff_0001");
  assert.equal(handoffs[1].payload.delegatedBy, "critic");
  assert.match(handoffs[1].payload.boundaryNote ?? "", /not a rewrite/);
  assert.equal(topicWindow?.handoffRefs.includes("handoff_0001"), false);
  assert.equal(topicWindow?.handoffRefs.includes(handoffs[1].payload.handoffId), true);
  assert.equal(scout.receivedPackets.length, 1);
  assert.equal(ledger.byType("message.created").length, 1);
});

test("speaker cap defers extra visible speech without dropping intentions", async () => {
  const ledger = new InMemoryLedger();
  const first = scriptedAgent("first", [{ kind: "speak", content: "First visible response." }]);
  const second = scriptedAgent("second", [{ kind: "speak", content: "Second should be deferred." }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [first, second],
    maxAwakenedAgents: 2,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Both of you may react.",
    clientMessageId: "client_budget",
  });

  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["speak", "speak"]);
  assert.equal(result.visibleMessageEventIds.length, 1);
  assert.equal(result.deferredIntentionEventIds.length, 1);
  assert.equal(ledger.byType("agent.intention_recorded").length, 2);
  assert.equal(ledger.byType("agent.intention_deferred").length, 1);
  assert.equal(ledger.byType("message.created").length, 2);
});

test("explicit all-call roll call can surface every awakened speaker", async () => {
  const ledger = new InMemoryLedger();
  const first = scriptedAgent("first", [{ kind: "speak", content: "First reports in." }]);
  const second = scriptedAgent("second", [{ kind: "speak", content: "Second reports in." }]);
  const third = scriptedAgent("third", [{ kind: "speak", content: "Third reports in." }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [first, second, third],
    maxAwakenedAgents: 3,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "全员出来报数",
    clientMessageId: "client_all_call",
  });

  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["speak", "speak", "speak"]);
  assert.equal(result.visibleMessageEventIds.length, 3);
  assert.equal(result.deferredIntentionEventIds.length, 0);
  assert.equal(ledger.byType("agent.intention_deferred").length, 0);
  assert.equal(ledger.byType("message.created").length, 4);
  const wake = ledger.byType<{ budget: { maxSpeakers: number } }>("wake.candidates_selected")[0];
  assert.equal(wake.payload.budget.maxSpeakers, 3);
});

test("invite_other secondarily wakes only invited agent for one bounded exchange", async () => {
  const ledger = new InMemoryLedger();
  const a = scriptedAgent("a", [
    { kind: "invite_other", agentId: "b", reason: "B may choose whether to inspect this.", contextRefs: ["msg_invite"] },
  ]);
  const b = scriptedAgent("b", [{ kind: "speak", content: "I accept this invitation for one bounded reply." }]);
  const observer = scriptedAgent("observer", [{ kind: "speak", content: "Observer should not be pulled in." }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [a, b, observer],
    maxAwakenedAgents: 1,
    maxSpeakers: 2,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@a you may invite one peer.",
    clientMessageId: "client_invite_other",
  });

  assert.deepEqual(result.invitedAgents, ["a"]);
  assert.deepEqual(result.secondaryInvitedAgents, ["b"]);
  assert.deepEqual(result.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["a:invite_other", "b:speak"]);
  assert.equal(observer.receivedPackets.length, 0);
  assert.equal(ledger.byType("agent.invited").length, 2);
  assert.equal(ledger.byType<MessageCreatedPayload>("message.created").at(-1)?.payload.author, "b");
});

test("invited agent can respond to an invitation without being forced to speak", async () => {
  const ledger = new InMemoryLedger();
  const a = scriptedAgent("a", [
    { kind: "invite_other", agentId: "b", reason: "B can accept, reject, challenge, or delegate this knock.", contextRefs: ["msg_invite"] },
  ]);
  const b = scriptedAgent("b", [
    (packet) => ({
      kind: "respond_invitation",
      invitationRef: packet.invitationId,
      response: "challenge",
      reason: "The invitation is useful, but the requested scope is still vague.",
      contextRefs: [packet.triggeringEventId],
    }),
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [a, b],
    maxAwakenedAgents: 1,
    maxSpeakers: 2,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@a invite one peer without assigning a job.",
    clientMessageId: "client_invitation_response",
  });

  assert.deepEqual(result.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), [
    "a:invite_other",
    "b:respond_invitation",
  ]);
  assert.equal(result.visibleMessageEventIds.length, 0);
  const response = ledger.byType<{ invitationRef: string; response: string; reason: string }>("agent.invitation_responded")[0];
  assert.equal(response?.payload.invitationRef, "invite_0002");
  assert.equal(response?.payload.response, "challenge");
  assert.match(response?.payload.reason ?? "", /scope is still vague/);
});

test("ordinary speech about an invitation records review pressure without replying to the knock", async () => {
  const ledger = new InMemoryLedger();
  const a = scriptedAgent("a", [
    { kind: "invite_other", agentId: "b", reason: "B may inspect this social knock without being assigned.", contextRefs: ["msg_invite"] },
  ]);
  const b = scriptedAgent("b", [
    (packet) => ({
      kind: "speak",
      content: "This invitation needs a narrower context boundary before anyone treats it as a useful knock.",
      contextRefs: [packet.invitationId],
    }),
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [a, b],
    maxAwakenedAgents: 1,
    maxSpeakers: 2,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@a invite one peer, but let them only discuss the invitation if that is enough.",
    clientMessageId: "client_invitation_review",
  });

  const review = ledger.byType<{
    invitationRef: string;
    response: string;
    summary: string;
    boundaryNote?: string;
  }>("agent.invitation_reviewed")[0];
  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(result.topicId);

  assert.deepEqual(result.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["a:invite_other", "b:speak"]);
  assert.equal(result.visibleMessageEventIds.length, 1);
  assert.equal(ledger.byType("agent.invitation_responded").length, 0);
  assert.equal(review?.payload.invitationRef, "invite_0002");
  assert.equal(review?.payload.response, "cautioned");
  assert.match(review?.payload.summary ?? "", /narrower context boundary/);
  assert.match(review?.payload.boundaryNote ?? "", /does not accept, reject, challenge, delegate/);
  assert.equal(topicWindow?.invitationRefs.includes(review?.payload.invitationRef ?? ""), true);
});

test("non-target agent cannot respond to another agent's invitation", async () => {
  const ledger = new InMemoryLedger();
  const a = scriptedAgent("a", [
    { kind: "invite_other", agentId: "b", reason: "B owns this social knock response.", contextRefs: ["msg_invite"] },
  ]);
  const b = scriptedAgent("b", [{ kind: "stay_silent", reason: "B may leave the knock unanswered." }]);
  const c = scriptedAgent("c", [
    {
      kind: "respond_invitation",
      invitationRef: "invite_0002",
      response: "challenge",
      reason: "C should not be able to answer B's invitation.",
      contextRefs: ["invite_0002"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [a, b, c],
    maxAwakenedAgents: 1,
    maxSpeakers: 2,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@a invite B as a social knock.",
    clientMessageId: "client_invitation_target_seed",
  });
  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@c inspect B's invitation as context.",
    clientMessageId: "client_invitation_non_target_response",
    mentions: ["c"],
    contextRefs: ["invite_0002"],
  });

  assert.deepEqual(result.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["c:respond_invitation"]);
  assert.equal(ledger.byType("agent.invitation_responded").length, 0);
  assert.equal(ledger.byType("agent.invitation_reviewed").length, 0);
});

test("delegated invitation creates a new social knock and wakes the redirected agent", async () => {
  const ledger = new InMemoryLedger();
  const a = scriptedAgent("a", [
    { kind: "invite_other", agentId: "b", reason: "B may redirect this social knock.", contextRefs: ["msg_invite"] },
  ]);
  const b = scriptedAgent("b", [
    (packet) => ({
      kind: "respond_invitation",
      invitationRef: packet.invitationId,
      response: "delegate",
      redirectTo: "c",
      reason: "C has the narrower listening context.",
      contextRefs: [packet.invitationId],
    }),
  ]);
  const c = scriptedAgent("c", [{ kind: "stay_silent", reason: "delegated knock received without forced speech" }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [a, b, c],
    maxAwakenedAgents: 1,
    maxSpeakers: 2,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@a invite one peer and let them redirect if needed.",
    clientMessageId: "client_invitation_delegate",
  });

  const invitations = ledger
    .byType<{
      invitationId: string;
      agentId: string;
      invitedBy: string;
      delegatedFromInvitationRef?: string;
      delegatedBy?: string;
      boundaryNote?: string;
    }>("agent.invited")
    .filter((event) => event.payload.invitedBy === "agent_intention");
  const response = ledger.byType<{
    invitationRef: string;
    response: string;
    redirectTo?: string;
  }>("agent.invitation_responded")[0];
  const delegated = invitations.find((event) => event.payload.agentId === "c");
  const topicWindow = TopicWindowStore.fromEvents(ledger.events).getTopic(result.topicId);

  assert.deepEqual(result.secondaryInvitedAgents, ["b", "c"]);
  assert.deepEqual(result.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), [
    "a:invite_other",
    "b:respond_invitation",
    "c:stay_silent",
  ]);
  assert.equal(invitations.length, 2);
  assert.equal(response?.payload.response, "delegate");
  assert.equal(response?.payload.redirectTo, "c");
  assert.equal(delegated?.payload.delegatedFromInvitationRef, response?.payload.invitationRef);
  assert.equal(delegated?.payload.delegatedBy, "b");
  assert.match(delegated?.payload.boundaryNote ?? "", /new social knock/);
  assert.equal(topicWindow?.invitationRefs.includes(delegated?.payload.invitationId ?? ""), true);
  assert.equal(c.receivedPackets.length, 1);
  assert.equal(ledger.byType("message.created").length, 1);
});

test("agent message mention creates targeted secondary wake without open-room fanout", async () => {
  const ledger = new InMemoryLedger();
  const a = scriptedAgent("a", [{ kind: "speak", content: "@b can you challenge this boundary?" }]);
  const b = scriptedAgent("b", [{ kind: "stay_silent", reason: "challenge noted, no visible reply needed" }]);
  const c = scriptedAgent("c", [{ kind: "speak", content: "C should not wake from A's mention." }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [a, b, c],
    maxAwakenedAgents: 1,
    maxSpeakers: 2,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@a speak to one peer if needed.",
    clientMessageId: "client_agent_mention",
  });

  assert.deepEqual(result.invitedAgents, ["a"]);
  assert.deepEqual(result.secondaryInvitedAgents, ["b"]);
  assert.deepEqual(result.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["a:speak", "b:stay_silent"]);
  assert.equal(c.receivedPackets.length, 0);
  assert.deepEqual(ledger.byType<MessageCreatedPayload>("message.created").at(-1)?.payload.mentions, ["b"]);
});

test("agent message mention does not secondarily wake an agent already invited in the same turn", async () => {
  const ledger = new InMemoryLedger();
  const a = scriptedAgent("a", [{ kind: "speak", content: "@b can you answer this from the side?" }]);
  const b = scriptedAgent("b", [
    async () => {
      await delay(80);
      return { kind: "speak", content: "Primary B reply only." };
    },
    { kind: "speak", content: "Duplicate secondary B reply should not happen." },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [a, b],
    maxAwakenedAgents: 2,
    maxSpeakers: 3,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Open room prompt.",
    clientMessageId: "client_no_duplicate_secondary",
  });

  assert.deepEqual(result.invitedAgents, ["a", "b"]);
  assert.deepEqual(result.secondaryInvitedAgents, []);
  assert.deepEqual(result.intentions.map((intention) => `${intention.agentId}:${intention.kind}`), ["a:speak", "b:speak"]);
  assert.equal(b.receivedPackets.length, 1);
  assert.equal(
    ledger.byType<MessageCreatedPayload>("message.created").some((event) => event.payload.content.includes("Duplicate secondary")),
    false,
  );
});

test("unknown invite and handoff targets do not pollute the social ledger", async () => {
  const inviteLedger = new InMemoryLedger();
  const inviter = scriptedAgent("inviter", [
    { kind: "invite_other", agentId: "missing", reason: "Unknown target should be ignored.", contextRefs: ["msg_invite"] },
  ]);
  const inviteLoop = new LivingRoomLoop({
    ledger: inviteLedger,
    agents: [inviter],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const inviteResult = await inviteLoop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@inviter try the invalid invite.",
    clientMessageId: "client_invalid_invite",
  });

  assert.deepEqual(inviteResult.secondaryInvitedAgents, []);
  assert.equal(inviteLedger.byType("agent.invited").filter((event) => event.actor.kind === "agent").length, 0);

  const handoffLedger = new InMemoryLedger();
  const handoffAgent = scriptedAgent("handoff_agent", [
    {
      kind: "propose_handoff",
      toAgentId: "missing",
      reason: "Unknown handoff target should be ignored.",
      contextRefs: ["msg_handoff"],
    },
  ]);
  const handoffLoop = new LivingRoomLoop({
    ledger: handoffLedger,
    agents: [handoffAgent],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const handoffResult = await handoffLoop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@handoff_agent try the invalid handoff.",
    clientMessageId: "client_invalid_handoff",
  });

  assert.deepEqual(handoffResult.secondaryInvitedAgents, []);
  assert.equal(handoffLedger.byType("handoff.proposed").length, 0);
});
test("open-room wake rotates away from recently active agents", async () => {
  const ledger = new InMemoryLedger();
  await ledger.append({
    roomId: "room_species",
    eventType: "agent.invited",
    actor: { kind: "system", id: "wake_policy" },
    payload: {
      invitationId: "invite_prior",
      agentId: "recent",
      topicId: "topic_prior",
      messageEventId: "msg_prior",
      invitedBy: "wake_policy",
      reason: "prior activity",
      contextRefs: ["msg_prior"],
    },
    correlationId: "prior",
    idempotencyKey: "prior_recent_invite",
  });
  const recent = scriptedAgent("recent", [{ kind: "speak", content: "Recent should rotate back." }]);
  const quieter = scriptedAgent("quieter", [{ kind: "speak", content: "Quieter gets the next open-room knock." }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [recent, quieter],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Open room question.",
    clientMessageId: "client_rotation",
  });

  assert.deepEqual(result.invitedAgents, ["quieter"]);
  const wake = ledger.byType<{ candidates: { agentId: string; reasons: string[] }[] }>("wake.candidates_selected").at(-1);
  assert.equal(wake?.payload.candidates[0]?.reasons.some((reason) => reason.startsWith("rotation:")), true);
});

test("speaker-budget deferred agents get a weak open-room recovery knock", async () => {
  const ledger = new InMemoryLedger();
  const first = scriptedAgent("first", [
    { kind: "speak", content: "First visible response." },
    { kind: "speak", content: "First should not get the recovery knock." },
  ]);
  const second = scriptedAgent("second", [
    { kind: "speak", content: "Second is deferred by budget." },
    { kind: "speak", content: "Second gets a later recovery knock." },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [first, second],
    maxAwakenedAgents: 2,
    maxSpeakers: 1,
  });

  const firstTurn = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@first @second both may answer once.",
    clientMessageId: "client_deferred_recovery_first",
    mentions: ["first", "second"],
  });

  assert.deepEqual(firstTurn.invitedAgents, ["first", "second"]);
  assert.equal(firstTurn.visibleMessageEventIds.length, 1);
  assert.equal(firstTurn.deferredIntentionEventIds.length, 1);

  const recoveryLoop = new LivingRoomLoop({
    ledger,
    agents: [first, second],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });
  const secondTurn = await recoveryLoop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Open room follow-up: anyone with an unfinished thought may choose whether to speak.",
    clientMessageId: "client_deferred_recovery_second",
  });

  assert.deepEqual(secondTurn.invitedAgents, ["second"]);
  assert.equal(first.receivedPackets.length, 1);
  assert.equal(second.receivedPackets.length, 2);
  const deferredEvent = ledger.byType("agent.intention_deferred").at(-1);
  const deferredIntentionRef = (deferredEvent?.payload as { intentionEventId?: string } | undefined)?.intentionEventId;
  assert.ok(deferredEvent?.event_id);
  assert.ok(deferredIntentionRef);
  const recoveryPacket = second.receivedPackets.at(-1);
  assert.deepEqual(recoveryPacket?.turnBoundary?.recoveryRefs, [deferredIntentionRef, deferredEvent.event_id]);
  assert.deepEqual(recoveryPacket?.turnBoundary?.invitationContextRefs, [
    secondTurn.triggeringMessageEventId,
    deferredIntentionRef,
    deferredEvent.event_id,
  ]);
  const recoveryInvite = ledger.byType<{ contextRefs: string[]; recoveryRefs?: string[] }>("agent.invited").at(-1);
  assert.deepEqual(recoveryInvite?.payload.recoveryRefs, [deferredIntentionRef, deferredEvent.event_id]);
  assert.deepEqual(recoveryInvite?.refs.slice(-2), [deferredIntentionRef, deferredEvent.event_id]);
  const wake = ledger.byType<{ candidates: { agentId: string; reasons: string[] }[] }>("wake.candidates_selected").at(-1);
  assert.equal(wake?.payload.candidates[0]?.reasons.includes("speaker_budget:deferred_recovery:1"), true);
  assert.equal(
    wake?.payload.candidates[0]?.reasons.includes("speaker_budget:deferred_recovery_does_not_assign_speaker"),
    true,
  );

  const thirdTurn = await recoveryLoop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Open room follow-up after the recovery reply was visible.",
    clientMessageId: "client_deferred_recovery_consumed",
  });

  assert.equal(thirdTurn.visibleMessageEventIds.length, 1);
  const consumedWake = ledger.byType<{ candidates: { agentId: string; reasons: string[] }[] }>("wake.candidates_selected").at(-1);
  assert.equal(
    consumedWake?.payload.candidates[0]?.reasons.some((reason) => reason.startsWith("speaker_budget:deferred_recovery")),
    false,
  );
});

test("advisory capability hints can route open-room wake without assigning responsibility", async () => {
  const ledger = new InMemoryLedger();
  const general = scriptedAgent("general", [{ kind: "speak", content: "General should wait this time." }]);
  const truth = scriptedAgent("truth", [{ kind: "stay_silent", reason: "capability hint is advisory" }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [general, truth],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
    wakeHintProvider: ({ message }) =>
      message.content.includes("correction")
        ? [
            {
              agentId: "truth",
              capabilityId: "capability_truth_hint",
              score: 3,
              reason: "Weak invitation hint for correction; not a responsibility assignment.",
              matchedTags: ["correction"],
              authority: "advisory",
              mustSpeak: false,
            },
          ]
        : [],
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Open room: correction may be needed.",
    clientMessageId: "client_capability_hint",
  });

  assert.deepEqual(result.invitedAgents, ["truth"]);
  assert.equal(general.receivedPackets.length, 0);
  assert.equal(truth.receivedPackets.length, 1);
  const wake = ledger.byType<{ candidates: { agentId: string; reasons: string[] }[] }>("wake.candidates_selected").at(-1);
  assert.equal(wake?.payload.candidates[0]?.reasons.includes("capability:advisory:capability_truth_hint:correction"), true);
  assert.equal(wake?.payload.candidates[0]?.reasons.includes("capability:score_capped:0.15"), true);
  assert.equal(wake?.payload.candidates[0]?.reasons.includes("capability:does_not_assign_responsibility"), true);

  const mentioned = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@general correction is mentioned here, but the mention should decide who gets the knock.",
    clientMessageId: "client_capability_hint_mention",
    mentions: ["general"],
  });

  assert.deepEqual(mentioned.invitedAgents, ["general"]);
  assert.equal(general.receivedPackets.length, 1);
  assert.equal(truth.receivedPackets.length, 1);
  const mentionWake = ledger.byType<{ candidates: { agentId: string; reasons: string[] }[] }>("wake.candidates_selected").at(-1);
  assert.equal(mentionWake?.payload.candidates[0]?.reasons.includes("mentioned"), true);
  assert.equal(
    mentionWake?.payload.candidates[0]?.reasons.some((reason) => reason.startsWith("capability:advisory:")),
    false,
  );
});

test("ordinary speech records capability hint review without mutating routing authority", async () => {
  const ledger = new InMemoryLedger();
  const pressureRef = "mixed_review:capability_hint_pressure";
  const reviewer = scriptedAgent("reviewer", [
    {
      kind: "speak",
      content: "This capability hint is useful only as a weak wake clue; do not turn it into role, trust, or responsibility.",
      contextRefs: ["capability_truth_hint"],
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [reviewer],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
  });

  await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@reviewer please review capability_truth_hint without assigning work.",
    clientMessageId: "client_capability_review",
    mentions: ["reviewer"],
    contextRefs: ["capability_truth_hint", pressureRef],
  });

  const reviews = ledger.byType<{
    capabilityRef: string;
    response: string;
    summary: string;
    boundaryNote: string;
    contextRefs: string[];
    sourcePressureRefs?: string[];
  }>("capability.reviewed");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.payload.capabilityRef, "capability_truth_hint");
  assert.equal(reviews[0]?.payload.response, "cautioned");
  assert.match(reviews[0]?.payload.summary ?? "", /weak wake clue/);
  assert.match(reviews[0]?.payload.boundaryNote ?? "", /does not change wake score/);
  assert.equal(reviews[0]?.payload.contextRefs.includes("capability_truth_hint"), true);
  assert.deepEqual(reviews[0]?.payload.sourcePressureRefs, [pressureRef]);
  assert.equal(reviews[0]?.refs.includes(pressureRef), true);
  assert.equal(ledger.byType("memory.proposed").length, 0);
  assert.equal(ledger.byType("side_effect.requested").length, 0);
});

test("advisory capability hints do not override open-room rotation pressure", async () => {
  const ledger = new InMemoryLedger();
  await ledger.append({
    roomId: "room_species",
    eventType: "message.created",
    actor: { kind: "agent", id: "truth" },
    payload: {
      messageId: "msg_truth_recent",
      author: "truth",
      authorKind: "agent",
      mentions: [],
      contextRefs: [],
      content: "I already spoke recently.",
    },
    correlationId: "prior_truth_activity",
    idempotencyKey: "prior_truth_visible_message",
  });
  const general = scriptedAgent("general", [{ kind: "speak", content: "General gets the open-room knock." }]);
  const truth = scriptedAgent("truth", [{ kind: "speak", content: "Truth should rotate back despite the hint." }]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [general, truth],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
    wakeHintProvider: () => [
      {
        agentId: "truth",
        capabilityId: "capability_truth_hint",
        score: 3,
        reason: "Very strong-looking capability hint that must stay weak.",
        matchedTags: ["correction"],
        authority: "advisory",
        mustSpeak: false,
      },
    ],
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Open room: correction may be needed.",
    clientMessageId: "client_capability_hint_rotation",
  });

  assert.deepEqual(result.invitedAgents, ["general"]);
  assert.equal(general.receivedPackets.length, 1);
  assert.equal(truth.receivedPackets.length, 0);
  const wake = ledger.byType<{
    candidates: { agentId: string; reasons: string[] }[];
    budget: { advisoryHintMaxScore?: number; advisoryHintBoundary?: string };
  }>("wake.candidates_selected").at(-1);
  assert.equal(wake?.payload.budget.advisoryHintMaxScore, 0.15);
  assert.match(wake?.payload.budget.advisoryHintBoundary ?? "", /weak invitations only/);
});

test("agent intentions outside the arbitration window can still route progressively", async () => {
  const ledger = new InMemoryLedger();
  await ledger.append({
    roomId: "room_species",
    eventType: "agent.invited",
    actor: { kind: "system", id: "wake_policy" },
    payload: {
      invitationId: "invite_prior_fast",
      agentId: "fast",
      topicId: "topic_prior",
      messageEventId: "msg_prior",
      invitedBy: "wake_policy",
      reason: "prior activity makes slow sort first for this test",
      contextRefs: ["msg_prior"],
    },
    correlationId: "prior",
    idempotencyKey: "prior_fast_invite",
  });
  const slow = scriptedAgent("slow", [
    async () => {
      await delay(80);
      return { kind: "speak", content: "Slow answer." };
    },
  ]);
  const fast = scriptedAgent("fast", [
    async () => {
      await delay(5);
      return { kind: "speak", content: "Fast answer." };
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [slow, fast],
    maxAwakenedAgents: 2,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Both may answer if they choose.",
    clientMessageId: "client_parallel",
  });

  assert.deepEqual(result.invitedAgents, ["slow", "fast"]);
  assert.equal(result.visibleMessageEventIds.length, 1);
  assert.equal(ledger.byType<MessageCreatedPayload>("message.created").at(-1)?.payload.author, "fast");
});

test("near-simultaneous speech intentions use wake order instead of provider speed", async () => {
  const ledger = new InMemoryLedger();
  await ledger.append({
    roomId: "room_species",
    eventType: "agent.invited",
    actor: { kind: "system", id: "wake_policy" },
    payload: {
      invitationId: "invite_prior_fast",
      agentId: "fast",
      topicId: "topic_prior",
      messageEventId: "msg_prior",
      invitedBy: "wake_policy",
      reason: "prior activity makes slow sort first for this test",
      contextRefs: ["msg_prior"],
    },
    correlationId: "prior",
    idempotencyKey: "prior_fast_invite_for_arbitration",
  });
  const slow = scriptedAgent("slow", [
    async () => {
      await delay(15);
      return { kind: "speak", content: "Slow but higher wake-order answer." };
    },
  ]);
  const fast = scriptedAgent("fast", [
    async () => {
      await delay(5);
      return { kind: "speak", content: "Fast answer should yield this slot." };
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [slow, fast],
    maxAwakenedAgents: 2,
    maxSpeakers: 1,
    speakerArbitrationWindowMs: 30,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "Both may answer if they choose, but the room should not reward a tiny speed race.",
    clientMessageId: "client_arbitration_order",
  });

  assert.deepEqual(result.invitedAgents, ["slow", "fast"]);
  assert.deepEqual(result.intentions.map((intention) => intention.agentId), ["slow", "fast"]);
  assert.equal(result.visibleMessageEventIds.length, 1);
  assert.equal(ledger.byType<MessageCreatedPayload>("message.created").at(-1)?.payload.author, "slow");
  assert.equal(ledger.byType("agent.intention_deferred").length, 1);
  const wake = ledger.byType<{ budget: { speakerArbitrationWindowMs: number } }>("wake.candidates_selected").at(-1);
  assert.equal(wake?.payload.budget.speakerArbitrationWindowMs, 30);
});

test("fast visible replies are routed before slower agents finish", async () => {
  const ledger = new InMemoryLedger();
  await ledger.append({
    roomId: "room_species",
    eventType: "agent.invited",
    actor: { kind: "system", id: "wake_policy" },
    payload: {
      invitationId: "invite_prior_fast",
      agentId: "fast",
      topicId: "topic_prior",
      messageEventId: "msg_prior",
      invitedBy: "wake_policy",
      reason: "prior activity makes slow sort first for this test",
      contextRefs: ["msg_prior"],
    },
    correlationId: "prior",
    idempotencyKey: "prior_fast_invite",
  });
  const slow = scriptedAgent("slow", [
    async () => {
      await delay(120);
      return { kind: "speak", content: "Slow answer." };
    },
  ]);
  const fast = scriptedAgent("fast", [
    async () => {
      await delay(5);
      return { kind: "speak", content: "Fast answer." };
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [slow, fast],
    maxAwakenedAgents: 2,
    maxSpeakers: 1,
  });

  const completion = loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "The fast agent should appear while the slow agent is still thinking.",
    clientMessageId: "client_progressive_route",
  });

  await delay(70);
  assert.equal(ledger.byType<MessageCreatedPayload>("message.created").at(-1)?.payload.author, "fast");

  const result = await completion;
  assert.equal(result.visibleMessageEventIds.length, 1);
  assert.equal(result.deferredIntentionEventIds.length, 1);
});

test("context packet factory can enrich agent packets without forcing speech", async () => {
  const ledger = new InMemoryLedger();
  const architect = scriptedAgent("architect", [
    (packet) => {
      assert.deepEqual(packet.messageRefs, ["msg_trigger", "msg_context"]);
      assert.deepEqual(packet.memoryRefs, ["memory_accepted"]);
      assert.deepEqual(packet.protocolRefs, ["protocol_active"]);
      assert.deepEqual(packet.proposalRefs, ["archive_day"]);
      assert.equal(packet.requestedPosture, "projection context attached");
      return { kind: "stay_silent", reason: "context received" };
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [architect],
    maxAwakenedAgents: 1,
    maxSpeakers: 1,
    contextPacketFactory: (input) => ({
      ...input.fallbackPacket,
      messageRefs: ["msg_trigger", "msg_context"],
      memoryRefs: ["memory_accepted"],
      protocolRefs: ["protocol_active"],
      proposalRefs: ["archive_day"],
      requestedPosture: "projection context attached",
    }),
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@architect take this with context.",
    clientMessageId: "client_context_factory",
    messageId: "msg_trigger",
  });

  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["stay_silent"]);
  assert.equal(ledger.byType("agent.intention_recorded").length, 1);
  assert.equal(architect.receivedPackets.length, 1);
});

test("agent packets carry invitation and speaker budget boundaries", async () => {
  const ledger = new InMemoryLedger();
  const listener = scriptedAgent("listener", [
    (packet) => {
      assert.equal(packet.turnBoundary?.invitedBy, "wake_policy");
      assert.match(packet.turnBoundary?.invitationReason ?? "", /mentioned/);
      assert.equal(packet.turnBoundary?.maxAwakenedAgents, 2);
      assert.equal(packet.turnBoundary?.maxSpeakers, 1);
      assert.equal(packet.turnBoundary?.speakerArbitrationWindowMs, 25);
      assert.equal(packet.turnBoundary?.visibleSpeakersAlreadyUsed, 0);
      assert.equal(packet.turnBoundary?.speakerSlotsRemaining, 1);
      assert.equal(packet.turnBoundary?.mayStaySilent, true);
      assert.match(packet.turnBoundary?.boundaryNote ?? "", /not a speaking command/);
      assert.equal(packet.turnBoundary?.invitationContextRefs.includes("topic_prior"), true);
      return { kind: "stay_silent", reason: "turn boundary received" };
    },
  ]);
  const loop = new LivingRoomLoop({
    ledger,
    agents: [listener],
    maxAwakenedAgents: 2,
    maxSpeakers: 1,
  });

  const result = await loop.processMessage({
    roomId: "room_species",
    author: "user",
    authorKind: "user",
    content: "@listener check the room bandwidth boundary.",
    clientMessageId: "client_turn_boundary",
    mentions: ["listener"],
    contextRefs: ["topic_prior"],
  });

  assert.deepEqual(result.intentions.map((intention) => intention.kind), ["stay_silent"]);
  assert.equal(listener.receivedPackets.length, 1);
  const invitation = ledger.byType<{ contextRefs: string[] }>("agent.invited").at(-1);
  assert.equal(invitation?.payload.contextRefs.includes("topic_prior"), true);
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
