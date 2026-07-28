import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createSequentialIdFactory } from "../src/kernel/ids";
import { RoomLedger, verifyHashChain } from "../src/kernel/ledger";

const actor = { kind: "system" as const, id: "test" };

function fixedNow(): string {
  return "2026-06-17T00:00:00.000Z";
}

test("jsonl ledger appends events, reads them back, and maintains hash chain", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-ledger-"));
  try {
    const filePath = path.join(dir, "events.jsonl");
    const ledger = new RoomLedger({
      filePath,
      idFactory: createSequentialIdFactory(),
      now: fixedNow,
    });

    const first = await ledger.append({
      roomId: "room_species",
      eventType: "room.created",
      actor,
      payload: { roomId: "room_species" },
      correlationId: "corr_1",
      idempotencyKey: "room:create",
    });
    assert.equal(first.status, "appended");

    const second = await ledger.append({
      roomId: "room_species",
      eventType: "message.created",
      actor: { kind: "user", id: "user" },
      payload: {
        messageId: "msg_1",
        author: "user",
        authorKind: "user",
        mentions: [],
        contextRefs: [],
        content: "hello",
      },
      correlationId: "corr_1",
      idempotencyKey: "message:1",
      expectedPrevEventId: first.event.event_id,
    });
    assert.equal(second.status, "appended");

    const events = await ledger.readAll();
    assert.equal(events.length, 2);
    assert.equal(events[1].prev_event_id, events[0].event_id);
    assert.equal(events[1].prev_event_hash, events[0].event_hash);
    assert.equal((await readFile(filePath, "utf8")).trim().split(/\r?\n/).length, 2);
    assert.equal(verifyHashChain(events), true);
    assert.equal((await ledger.getById(events[0].event_id))?.event_type, "room.created");
    assert.equal((await ledger.readFrom(1)).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("idempotency returns duplicate and rejects reused key with different payload", async () => {
  await withLedger(async (ledger) => {
    const command = {
      roomId: "room_species",
      eventType: "message.created",
      actor: { kind: "user" as const, id: "user" },
      payload: {
        messageId: "msg_1",
        author: "user",
        authorKind: "user" as const,
        mentions: [],
        contextRefs: [],
        content: "hello",
      },
      correlationId: "corr_1",
      idempotencyKey: "message:1",
    };

    assert.equal((await ledger.append(command)).status, "appended");
    assert.equal((await ledger.append(command)).status, "duplicate");
    assert.equal((await ledger.readAll()).length, 1);

    const mismatch = await ledger.append({
      ...command,
      payload: { ...command.payload, content: "different" },
    });
    assert.equal(mismatch.status, "rejected");
  });
});

test("expected previous event conflict is reported without appending", async () => {
  await withLedger(async (ledger) => {
    await ledger.append({
      roomId: "room_species",
      eventType: "room.created",
      actor,
      payload: { roomId: "room_species" },
      correlationId: "corr_1",
      idempotencyKey: "room:create",
    });

    const conflict = await ledger.append({
      roomId: "room_species",
      eventType: "topic.created",
      actor,
      payload: { topicId: "topic_1", title: "A", createdFromMessageId: "msg_1" },
      correlationId: "corr_1",
      idempotencyKey: "topic:1",
      expectedPrevEventId: "evt_missing",
    });

    assert.equal(conflict.status, "conflict");
    assert.equal((await ledger.readAll()).length, 1);
  });
});

test("constitution rejects forced speech but allows stay_silent intention", async () => {
  await withLedger(async (ledger) => {
    const forced = await ledger.append({
      roomId: "room_species",
      eventType: "message.created",
      actor: { kind: "system", id: "scheduler" },
      payload: {
        messageId: "msg_forced",
        author: "critic",
        authorKind: "agent",
        forced: true,
        mentions: [],
        contextRefs: [],
        content: "I was forced.",
      },
      correlationId: "corr_forced",
      idempotencyKey: "forced",
    });
    assert.equal(forced.status, "rejected");

    const silence = await ledger.append({
      roomId: "room_species",
      eventType: "agent.intention_recorded",
      actor: { kind: "agent", id: "critic" },
      payload: {
        agentId: "critic",
        intention: { kind: "stay_silent", reason: "listening" },
      },
      correlationId: "corr_silence",
      idempotencyKey: "silence",
    });
    assert.equal(silence.status, "appended");
  });
});

test("constitution rejects active_agent owner state", async () => {
  await withLedger(async (ledger) => {
    const result = await ledger.append({
      roomId: "room_species",
      eventType: "scheduler.active_agent_set",
      actor,
      payload: { active_agent: "critic" },
      correlationId: "corr_active",
      idempotencyKey: "active-agent",
    });

    assert.equal(result.status, "rejected");
  });
});

test("memory commit gate requires proposal and review refs before accepted", async () => {
  await withLedger(async (ledger) => {
    const withoutProposal = await ledger.append({
      roomId: "room_species",
      eventType: "memory.accepted",
      actor,
      payload: {
        memoryId: "memory_gate",
        reason: "This should not be accepted from nowhere.",
        contextRefs: ["msg_review"],
      },
      correlationId: "corr_memory_gate",
      idempotencyKey: "memory:accepted:without-proposal",
    });
    assert.equal(withoutProposal.status, "rejected");

    await ledger.append({
      roomId: "room_species",
      eventType: "memory.proposed",
      actor: { kind: "agent", id: "member" },
      payload: {
        memoryId: "memory_gate",
        state: "proposed",
        summary: "Memory commits need visible review.",
        sourceRefs: ["msg_source"],
        proposedBy: "member",
      },
      refs: ["msg_source"],
      correlationId: "corr_memory_gate",
      idempotencyKey: "memory:proposed:gate",
    });

    const withoutReviewRefs = await ledger.append({
      roomId: "room_species",
      eventType: "memory.accepted",
      actor,
      payload: {
        memoryId: "memory_gate",
        reason: "This still lacks a review surface.",
        contextRefs: ["memory_gate"],
      },
      correlationId: "corr_memory_gate",
      idempotencyKey: "memory:accepted:without-review",
    });
    assert.equal(withoutReviewRefs.status, "rejected");

    const accepted = await ledger.append({
      roomId: "room_species",
      eventType: "memory.accepted",
      actor,
      payload: {
        memoryId: "memory_gate",
        reason: "The room has a visible review surface.",
        contextRefs: ["msg_review"],
      },
      refs: ["memory_gate", "msg_review"],
      correlationId: "corr_memory_gate",
      idempotencyKey: "memory:accepted:with-review",
    });
    assert.equal(accepted.status, "appended");
  });
});

test("side-effect results require prior approval", async () => {
  await withLedger(async (ledger) => {
    const withoutApproval = await ledger.append({
      roomId: "room_species",
      eventType: "side_effect.result_reported",
      actor: { kind: "agent", id: "operator" },
      payload: {
        approvalId: "approval_1",
        status: "completed",
        summary: "Ran external command.",
      },
      refs: ["approval_1"],
      correlationId: "corr_sidefx",
      idempotencyKey: "sidefx:result:1",
    });
    assert.equal(withoutApproval.status, "rejected");

    await ledger.append({
      roomId: "room_species",
      eventType: "side_effect.approved",
      actor: { kind: "user", id: "user" },
      payload: {
        approvalId: "approval_1",
        approvedBy: "user",
        reason: "Narrow scope.",
      },
      refs: ["approval_1"],
      correlationId: "corr_sidefx",
      idempotencyKey: "sidefx:approved:1",
    });

    const withApproval = await ledger.append({
      roomId: "room_species",
      eventType: "side_effect.result_reported",
      actor: { kind: "agent", id: "operator" },
      payload: {
        approvalId: "approval_1",
        status: "completed",
        summary: "Ran external command.",
      },
      refs: ["approval_1"],
      correlationId: "corr_sidefx",
      idempotencyKey: "sidefx:result:1",
    });
    assert.equal(withApproval.status, "appended");
  });
});

async function withLedger(assertions: (ledger: RoomLedger) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "species-ledger-"));
  try {
    await assertions(
      new RoomLedger({
        filePath: path.join(dir, "events.jsonl"),
        idFactory: createSequentialIdFactory(),
        now: fixedNow,
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
