import assert from "node:assert/strict";
import test from "node:test";

import { AutonomyScheduler } from "../src/server/autonomyScheduler";
import type { RuntimeAutonomyTickResult } from "../src/server/runtime";

test("autonomy scheduler records ticks and skips overlapping runs", async () => {
  let releaseTick: (() => void) | undefined;
  let callCount = 0;
  const scheduler = new AutonomyScheduler(
    {
      runAutonomousTick: async (input) => {
        callCount += 1;
        assert.equal(input?.memoryHygieneReviewAfterMs, 86_400_000);
        assert.equal(input?.continuityReviewAfterMs, 604_800_000);
        assert.equal(input?.silenceReentryAfterMs, 1234);
        assert.equal(input?.idleSocialAfterMs, 1800000);
        assert.equal(input?.archiveReviewQuietAfterMs, 600000);
        await new Promise<void>((resolve) => {
          releaseTick = resolve;
        });
        return {
          autonomyTick: {
            tickId: "autonomy_tick_test_silence_reentry",
            action: "silence_reentry",
            status: "posted",
            messageEventId: "msg_autonomy_reentry",
            anchorEventId: "msg_quiet_anchor",
            targetRefs: ["msg_quiet_anchor"],
            contextRefs: ["msg_quiet_anchor"],
            evidenceRefs: ["msg_quiet_anchor", "msg_autonomy_reentry"],
            choiceSet: [
              {
                action: "silence_reentry",
                eligible: true,
                targetRefs: ["msg_quiet_anchor"],
                evidenceRefs: ["msg_quiet_anchor"],
                reason: "quiet anchor was eligible for re-entry",
              },
            ],
          },
        } as unknown as RuntimeAutonomyTickResult;
      },
    },
    {
      intervalMs: 60_000,
      memoryHygieneReviewAfterMs: 86_400_000,
      continuityReviewAfterMs: 604_800_000,
      silenceReentryAfterMs: 1234,
      idleSocialAfterMs: 1_800_000,
      archiveReviewQuietAfterMs: 600_000,
    },
  );

  const first = scheduler.tickOnce(new Date("2026-06-21T10:00:00.000Z"));
  const overlapped = await scheduler.tickOnce(new Date("2026-06-21T10:00:01.000Z"));
  assert.equal(overlapped.running, true);
  assert.equal(overlapped.skippedOverlapCount, 1);
  assert.equal(callCount, 1);

  releaseTick?.();
  const completed = await first;
  assert.equal(completed.running, false);
  assert.equal(completed.memoryHygieneReviewAfterMs, 86_400_000);
  assert.equal(completed.continuityReviewAfterMs, 604_800_000);
  assert.equal(completed.idleSocialAfterMs, 1_800_000);
  assert.equal(completed.archiveReviewQuietAfterMs, 600_000);
  assert.equal(completed.completedTickCount, 1);
  assert.equal(completed.skippedOverlapCount, 1);
  assert.equal(completed.overdueTickCount, 0);
  assert.equal(completed.overrunTickCount, 0);
  assert.equal(completed.nextTickDueAt, "2026-06-21T10:01:00.000Z");
  assert.equal(completed.lastExpectedTickDueAt, undefined);
  assert.equal(completed.lastScheduleDriftMs, undefined);
  assert.equal(completed.lastOverdueByMs, undefined);
  assert.equal(Number.isFinite(completed.lastDurationMs), true);
  assert.equal(completed.lastOverrunByMs, 0);
  assert.equal(completed.lastTickId, "autonomy_tick_test_silence_reentry");
  assert.equal(completed.lastAction, "silence_reentry");
  assert.equal(completed.lastStatus, "posted");
  assert.equal(completed.lastMessageEventId, "msg_autonomy_reentry");
  assert.equal(completed.lastAnchorEventId, "msg_quiet_anchor");
  assert.deepEqual(completed.lastTargetRefs, ["msg_quiet_anchor"]);
  assert.deepEqual(completed.lastChoiceSetRefs, ["msg_quiet_anchor"]);
  assert.equal(completed.lastChoiceSetOptionCount, 1);
  assert.deepEqual(completed.lastChoiceSetTargetRefs, ["msg_quiet_anchor"]);
  assert.deepEqual(completed.lastChoiceSetEvidenceRefs, ["msg_quiet_anchor"]);
  assert.deepEqual(completed.lastChoiceSetOptionsWithoutEvidenceRefs, []);
  assert.deepEqual(completed.lastChoiceSetTargetedOptionsWithoutTargetRefs, []);
  assert.deepEqual(completed.lastContextRefs, ["msg_quiet_anchor"]);
  assert.deepEqual(completed.lastEvidenceRefs, ["msg_quiet_anchor", "msg_autonomy_reentry"]);
  assert.match(completed.boundaryNote, /never assigns speakers/);
});

test("autonomy scheduler exposes cadence drift and runtime pressure", async () => {
  let callCount = 0;
  const scheduler = new AutonomyScheduler(
    {
      runAutonomousTick: async () => {
        callCount += 1;
        if (callCount === 2) {
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
        return {
          autonomyTick: {
            tickId: `autonomy_tick_cadence_${callCount}`,
            action: "stay_silent",
            status: "silent",
            targetRefs: [],
            contextRefs: [],
            evidenceRefs: [],
            choiceSet: [],
          },
        } as unknown as RuntimeAutonomyTickResult;
      },
    },
    { intervalMs: 1 },
  );

  const first = await scheduler.tickOnce(new Date("2026-06-21T10:00:00.000Z"));
  assert.equal(first.nextTickDueAt, "2026-06-21T10:00:00.001Z");
  assert.equal(first.overdueTickCount, 0);

  const second = await scheduler.tickOnce(new Date("2026-06-21T10:00:01.001Z"));
  assert.equal(second.completedTickCount, 2);
  assert.equal(second.lastExpectedTickDueAt, "2026-06-21T10:00:00.001Z");
  assert.equal(second.lastScheduleDriftMs, 1_000);
  assert.equal(second.lastOverdueByMs, 1_000);
  assert.equal(second.overdueTickCount, 1);
  assert.equal(Number.isFinite(second.lastDurationMs), true);
  assert.equal((second.lastDurationMs ?? 0) >= 1, true);
  assert.equal((second.lastOverrunByMs ?? 0) > 0, true);
  assert.equal(second.overrunTickCount >= 1, true);
});

test("autonomy scheduler exposes choice-set evidence gaps", async () => {
  const scheduler = new AutonomyScheduler(
    {
      runAutonomousTick: async () =>
        ({
          autonomyTick: {
            tickId: "autonomy_tick_bad_choice_set",
            action: "stay_silent",
            status: "silent",
            targetRefs: [],
            contextRefs: [],
            evidenceRefs: [],
            choiceSet: [
              {
                action: "stay_silent",
                eligible: true,
                targetRefs: [],
                evidenceRefs: [],
                reason: "preserved silence without a ledger anchor",
              },
              {
                action: "memory_hygiene_review",
                eligible: true,
                targetRefs: [],
                evidenceRefs: [],
                reason: "bad candidate lacks target and evidence refs",
              },
            ],
          },
        }) as unknown as RuntimeAutonomyTickResult,
    },
    { intervalMs: 60_000 },
  );

  const status = await scheduler.tickOnce(new Date("2026-06-21T10:05:00.000Z"));

  assert.equal(status.completedTickCount, 1);
  assert.equal(Number.isFinite(status.lastDurationMs), true);
  assert.equal(status.lastChoiceSetOptionCount, 2);
  assert.deepEqual(status.lastChoiceSetRefs, []);
  assert.deepEqual(status.lastChoiceSetTargetRefs, []);
  assert.deepEqual(status.lastChoiceSetEvidenceRefs, []);
  assert.deepEqual(status.lastChoiceSetOptionsWithoutEvidenceRefs, [
    "stay_silent:autonomy_tick_bad_choice_set",
    "memory_hygiene_review:autonomy_tick_bad_choice_set",
  ]);
  assert.deepEqual(status.lastChoiceSetTargetedOptionsWithoutTargetRefs, [
    "memory_hygiene_review:autonomy_tick_bad_choice_set",
  ]);
});

test("autonomy scheduler exposes errors without throwing the loop", async () => {
  const scheduler = new AutonomyScheduler(
    {
      runAutonomousTick: async () => {
        throw new Error("provider clock failed");
      },
    },
    { intervalMs: 60_000 },
  );

  const status = await scheduler.tickOnce(new Date("2026-06-21T11:00:00.000Z"));
  assert.equal(status.running, false);
  assert.equal(status.completedTickCount, 0);
  assert.equal(status.overdueTickCount, 0);
  assert.equal(status.overrunTickCount, 0);
  assert.equal(status.errorCount, 1);
  assert.equal(Number.isFinite(status.lastDurationMs), true);
  assert.equal(status.lastError, "provider clock failed");
  assert.equal(status.nextTickDueAt, "2026-06-21T11:01:00.000Z");
  assert.deepEqual(status.lastTargetRefs, []);
  assert.deepEqual(status.lastChoiceSetRefs, []);
  assert.equal(status.lastChoiceSetOptionCount, 0);
  assert.deepEqual(status.lastChoiceSetTargetRefs, []);
  assert.deepEqual(status.lastChoiceSetEvidenceRefs, []);
  assert.deepEqual(status.lastChoiceSetOptionsWithoutEvidenceRefs, []);
  assert.deepEqual(status.lastChoiceSetTargetedOptionsWithoutTargetRefs, []);
  assert.deepEqual(status.lastContextRefs, []);
  assert.deepEqual(status.lastEvidenceRefs, []);
});
