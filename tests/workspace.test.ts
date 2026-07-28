import test from "node:test";
import assert from "node:assert/strict";

import { MemoryClaimStore } from "../src/memory/memory";
import {
  WorkspaceStore,
  workspaceIdForAgent,
  workspaceProvisionedPayload,
  type WorkspaceArtifactSharedPayload,
} from "../src/workspace/workspace";
import { EventActor, RoomEvent } from "../src/types";

const roomId = "room_species";

test("workspace projection keeps private home metadata out of public memory", () => {
  const provisioned = event("evt_workspace", "workspace.provisioned", workspaceProvisionedPayload({
    agentId: "mimo_member_01",
    privateHome: "agents/mimo_member_01/",
    scratchPath: "agents/mimo_member_01/workspace/",
  }));
  const shared = event<WorkspaceArtifactSharedPayload>("evt_artifact", "workspace.artifact_shared", {
    artifactId: "artifact_workspace_note",
    workspaceId: workspaceIdForAgent("mimo_member_01"),
    agentId: "mimo_member_01",
    pathRef: "agents/mimo_member_01/workspace/note.md",
    summary: "A private note was shared as an explicit artifact ref.",
    contextRefs: ["msg_share", "mixed_review:workspace_store_pressure"],
    sourcePressureRefs: ["mixed_review:workspace_store_pressure"],
    status: "shared",
    boundaryNote: "artifact ref is room-visible; private workspace contents are not copied into memory",
  });
  const events = [provisioned, shared];

  const workspaceView = WorkspaceStore.fromEvents(events).view();
  assert.equal(workspaceView.workspaces.length, 1);
  assert.equal(workspaceView.workspaces[0]?.visibility, "private");
  assert.deepEqual(workspaceView.workspaces[0]?.sharedArtifactRefs, ["artifact_workspace_note"]);
  assert.equal(workspaceView.sharedArtifacts[0]?.pathRef, "agents/mimo_member_01/workspace/note.md");
  assert.deepEqual(workspaceView.sharedArtifacts[0]?.sourcePressureRefs, ["mixed_review:workspace_store_pressure"]);
  assert.match(workspaceView.sharedArtifacts[0]?.boundaryNote ?? "", /not copied into memory/);

  const memoryView = MemoryClaimStore.fromEvents(events).view();
  assert.deepEqual(memoryView.claims, []);
});

function event<TPayload>(
  eventId: string,
  eventType: string,
  payload: TPayload,
  actor: EventActor = { kind: "system", id: "test" },
): RoomEvent<TPayload> {
  return {
    event_id: eventId,
    room_id: roomId,
    event_type: eventType,
    schema_version: "1",
    payload_schema: eventType,
    occurred_at: "2026-06-19T12:00:00+08:00",
    appended_at: "2026-06-19T12:00:00+08:00",
    actor,
    causation_id: null,
    correlation_id: "corr_workspace",
    idempotency_key: eventId,
    refs: [],
    payload,
    prev_event_id: null,
    prev_event_hash: null,
    event_hash: `hash_${eventId}`,
  };
}
