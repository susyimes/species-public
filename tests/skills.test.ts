import test from "node:test";
import assert from "node:assert/strict";

import {
  SkillRegistryStore,
  skillCapsuleRegisteredPayload,
  type SkillCapsuleRegisteredPayload,
} from "../src/skills/skills";
import { EventActor, RoomEvent } from "../src/types";

const roomId = "room_species";

test("skill capsule registration is replayable and does not execute actions", () => {
  const events = [
    event<SkillCapsuleRegisteredPayload>("evt_skill", "skill.capsule_registered", skillCapsuleRegisteredPayload({
      capsuleId: "skill_member_quiet_reflection",
      agentId: "kimi_member_01",
      label: "quiet reflection",
      triggerHints: ["unspoken need", "low-intervention reply"],
      sideEffectKinds: [],
    })),
  ];

  const view = SkillRegistryStore.fromEvents(events).view();

  assert.equal(view.capsules.length, 1);
  assert.equal(view.capsules[0]?.capsuleId, "skill_member_quiet_reflection");
  assert.equal(view.capsules[0]?.approvalRequired, false);
  assert.equal(view.capsules[0]?.sideEffectKinds.length, 0);
  assert.equal(view.capsules[0]?.disclosurePolicy, "brief_first_full_on_request");
  assert.equal(view.capsules[0]?.instructionRef, "skill://kimi_member_01/skill_member_quiet_reflection/SKILL.md");
  assert.match(view.capsules[0]?.summary ?? "", /private reasoning organ/);
  assert.match(view.capsules[0]?.fullInstructions ?? "", /Use this capsule as private guidance/);
  assert.match(view.capsules[0]?.inputContract ?? "", /current room refs/);
  assert.match(view.capsules[0]?.outputContract ?? "", /approval-gated request/);
  assert.equal(view.capsules[0]?.approvalProfile.approvalRequired, false);
  assert.match(view.capsules[0]?.boundaryNote ?? "", /cannot execute/);
  assert.equal(events.some((item) => item.event_type.startsWith("side_effect.")), false);
});

test("skill capsule with side-effect kinds is marked approval-required", () => {
  const registration = skillCapsuleRegisteredPayload({
    capsuleId: "skill_member_workspace_writer",
    agentId: "mimo_member_02",
    label: "workspace writer",
    triggerHints: ["draft artifact"],
    sideEffectKinds: ["filesystem.write"],
  });

  assert.equal(registration.approvalRequired, true);
  assert.equal(registration.approvalProfile.approvalRequired, true);
  assert.deepEqual(registration.approvalProfile.sideEffectKinds, ["filesystem.write"]);
  assert.match(registration.approvalProfile.boundaryNote, /explicit room approval/);
  assert.match(registration.fullInstructions, /Side-effect kinds requiring approval: filesystem.write/);
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
    correlation_id: "corr_skill",
    idempotency_key: eventId,
    refs: [],
    payload,
    prev_event_id: null,
    prev_event_hash: null,
    event_hash: `hash_${eventId}`,
  };
}
