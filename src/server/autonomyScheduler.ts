import { performance } from "node:perf_hooks";

import type { SpeciesRoomRuntime, RuntimeAutonomyTickResult } from "./runtime";

export type AutonomySchedulerStatus = {
  enabled: boolean;
  intervalMs?: number;
  memoryHygieneReviewAfterMs?: number;
  continuityReviewAfterMs?: number;
  silenceReentryAfterMs?: number;
  idleSocialAfterMs?: number;
  archiveReviewQuietAfterMs?: number;
  running: boolean;
  completedTickCount: number;
  skippedOverlapCount: number;
  overdueTickCount: number;
  overrunTickCount: number;
  errorCount: number;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  nextTickDueAt?: string;
  lastExpectedTickDueAt?: string;
  lastScheduleDriftMs?: number;
  lastOverdueByMs?: number;
  lastDurationMs?: number;
  lastOverrunByMs?: number;
  lastTickId?: string;
  lastAction?: RuntimeAutonomyTickResult["autonomyTick"]["action"];
  lastStatus?: RuntimeAutonomyTickResult["autonomyTick"]["status"];
  lastMessageEventId?: string;
  lastAnchorEventId?: string;
  lastArchiveRef?: string;
  lastReviewRequestRef?: string;
  lastTargetRefs: string[];
  lastChoiceSetRefs: string[];
  lastChoiceSetOptionCount: number;
  lastChoiceSetTargetRefs: string[];
  lastChoiceSetEvidenceRefs: string[];
  lastChoiceSetOptionsWithoutEvidenceRefs: string[];
  lastChoiceSetTargetedOptionsWithoutTargetRefs: string[];
  lastContextRefs: string[];
  lastEvidenceRefs: string[];
  lastError?: string;
  boundaryNote: string;
};

export type AutonomySchedulerStatusProvider = {
  getStatus(): AutonomySchedulerStatus;
};

type AutonomySchedulerRuntime = Pick<SpeciesRoomRuntime, "runAutonomousTick">;

export type AutonomySchedulerOptions = {
  intervalMs: number;
  memoryHygieneReviewAfterMs?: number;
  continuityReviewAfterMs?: number;
  silenceReentryAfterMs?: number;
  idleSocialAfterMs?: number;
  archiveReviewQuietAfterMs?: number;
};

export class AutonomyScheduler implements AutonomySchedulerStatusProvider {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private completedTickCount = 0;
  private skippedOverlapCount = 0;
  private overdueTickCount = 0;
  private overrunTickCount = 0;
  private errorCount = 0;
  private lastStartedAt: string | undefined;
  private lastFinishedAt: string | undefined;
  private nextTickDueAt: string | undefined;
  private lastExpectedTickDueAt: string | undefined;
  private lastScheduleDriftMs: number | undefined;
  private lastOverdueByMs: number | undefined;
  private lastDurationMs: number | undefined;
  private lastOverrunByMs: number | undefined;
  private lastTickId: string | undefined;
  private lastAction: RuntimeAutonomyTickResult["autonomyTick"]["action"] | undefined;
  private lastStatus: RuntimeAutonomyTickResult["autonomyTick"]["status"] | undefined;
  private lastMessageEventId: string | undefined;
  private lastAnchorEventId: string | undefined;
  private lastArchiveRef: string | undefined;
  private lastReviewRequestRef: string | undefined;
  private lastTargetRefs: string[] = [];
  private lastChoiceSetRefs: string[] = [];
  private lastChoiceSetOptionCount = 0;
  private lastChoiceSetTargetRefs: string[] = [];
  private lastChoiceSetEvidenceRefs: string[] = [];
  private lastChoiceSetOptionsWithoutEvidenceRefs: string[] = [];
  private lastChoiceSetTargetedOptionsWithoutTargetRefs: string[] = [];
  private lastContextRefs: string[] = [];
  private lastEvidenceRefs: string[] = [];
  private lastError: string | undefined;

  constructor(
    private readonly runtime: AutonomySchedulerRuntime,
    private readonly options: AutonomySchedulerOptions,
  ) {}

  start(): void {
    if (!this.isEnabled() || this.timer !== undefined) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tickOnce();
    }, this.options.intervalMs);
    this.nextTickDueAt = this.nextDueAfter(new Date());
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer === undefined) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
    this.nextTickDueAt = undefined;
  }

  async tickOnce(now: Date = new Date()): Promise<AutonomySchedulerStatus> {
    if (this.running) {
      this.skippedOverlapCount += 1;
      return this.getStatus();
    }

    this.running = true;
    this.lastStartedAt = now.toISOString();
    this.lastExpectedTickDueAt = this.nextTickDueAt;
    const expectedTickDueAtMs = Date.parse(this.nextTickDueAt ?? "");
    if (Number.isFinite(expectedTickDueAtMs)) {
      this.lastScheduleDriftMs = Math.max(0, now.getTime() - expectedTickDueAtMs);
      this.lastOverdueByMs = this.lastScheduleDriftMs;
      if (this.lastOverdueByMs > 0) {
        this.overdueTickCount += 1;
      }
    } else {
      this.lastScheduleDriftMs = undefined;
      this.lastOverdueByMs = undefined;
    }
    this.lastError = undefined;
    const startedAtMs = performance.now();
    try {
      const result = await this.runtime.runAutonomousTick({
        memoryHygieneReviewAfterMs: this.options.memoryHygieneReviewAfterMs,
        continuityReviewAfterMs: this.options.continuityReviewAfterMs,
        silenceReentryAfterMs: this.options.silenceReentryAfterMs,
        idleSocialAfterMs: this.options.idleSocialAfterMs,
        archiveReviewQuietAfterMs: this.options.archiveReviewQuietAfterMs,
      });
      this.completedTickCount += 1;
      this.lastTickId = result.autonomyTick.tickId;
      this.lastAction = result.autonomyTick.action;
      this.lastStatus = result.autonomyTick.status;
      this.lastMessageEventId = result.autonomyTick.messageEventId;
      this.lastAnchorEventId = result.autonomyTick.anchorEventId;
      this.lastArchiveRef = result.autonomyTick.archiveRef;
      this.lastReviewRequestRef = result.autonomyTick.reviewRequestRef;
      this.lastTargetRefs = [...(result.autonomyTick.targetRefs ?? [])];
      const choiceSet = result.autonomyTick.choiceSet ?? [];
      this.lastChoiceSetOptionCount = choiceSet.length;
      this.lastChoiceSetTargetRefs = uniqueSchedulerRefs(choiceSet.flatMap((choice) => choice.targetRefs ?? []));
      this.lastChoiceSetEvidenceRefs = uniqueSchedulerRefs(choiceSet.flatMap((choice) => choice.evidenceRefs ?? []));
      this.lastChoiceSetRefs = uniqueSchedulerRefs([...this.lastChoiceSetTargetRefs, ...this.lastChoiceSetEvidenceRefs]);
      this.lastChoiceSetOptionsWithoutEvidenceRefs = choiceSet
        .filter((choice) => (choice.evidenceRefs ?? []).length === 0)
        .map((choice) => `${choice.action}:${result.autonomyTick.tickId}`);
      this.lastChoiceSetTargetedOptionsWithoutTargetRefs = choiceSet
        .filter((choice) => choice.action !== "stay_silent" && (choice.targetRefs ?? []).length === 0)
        .map((choice) => `${choice.action}:${result.autonomyTick.tickId}`);
      this.lastContextRefs = [...(result.autonomyTick.contextRefs ?? [])];
      this.lastEvidenceRefs = [...(result.autonomyTick.evidenceRefs ?? [])];
    } catch (error) {
      this.errorCount += 1;
      this.lastError = error instanceof Error ? error.message : String(error);
    } finally {
      this.lastDurationMs = Math.max(0, Math.round(performance.now() - startedAtMs));
      this.lastOverrunByMs = this.isEnabled() ? Math.max(0, this.lastDurationMs - this.options.intervalMs) : undefined;
      if ((this.lastOverrunByMs ?? 0) > 0) {
        this.overrunTickCount += 1;
      }
      this.running = false;
      this.lastFinishedAt = new Date().toISOString();
      this.nextTickDueAt = this.nextDueAfter(now);
    }
    return this.getStatus();
  }

  getStatus(): AutonomySchedulerStatus {
    return {
      enabled: this.isEnabled(),
      intervalMs: this.isEnabled() ? this.options.intervalMs : undefined,
      memoryHygieneReviewAfterMs: Number.isFinite(this.options.memoryHygieneReviewAfterMs)
        ? this.options.memoryHygieneReviewAfterMs
        : undefined,
      continuityReviewAfterMs: Number.isFinite(this.options.continuityReviewAfterMs)
        ? this.options.continuityReviewAfterMs
        : undefined,
      silenceReentryAfterMs: Number.isFinite(this.options.silenceReentryAfterMs)
        ? this.options.silenceReentryAfterMs
        : undefined,
      idleSocialAfterMs: Number.isFinite(this.options.idleSocialAfterMs) ? this.options.idleSocialAfterMs : undefined,
      archiveReviewQuietAfterMs: Number.isFinite(this.options.archiveReviewQuietAfterMs)
        ? this.options.archiveReviewQuietAfterMs
        : undefined,
      running: this.running,
      completedTickCount: this.completedTickCount,
      skippedOverlapCount: this.skippedOverlapCount,
      overdueTickCount: this.overdueTickCount,
      overrunTickCount: this.overrunTickCount,
      errorCount: this.errorCount,
      lastStartedAt: this.lastStartedAt,
      lastFinishedAt: this.lastFinishedAt,
      nextTickDueAt: this.nextTickDueAt,
      lastExpectedTickDueAt: this.lastExpectedTickDueAt,
      lastScheduleDriftMs: this.lastScheduleDriftMs,
      lastOverdueByMs: this.lastOverdueByMs,
      lastDurationMs: this.lastDurationMs,
      lastOverrunByMs: this.lastOverrunByMs,
      lastTickId: this.lastTickId,
      lastAction: this.lastAction,
      lastStatus: this.lastStatus,
      lastMessageEventId: this.lastMessageEventId,
      lastAnchorEventId: this.lastAnchorEventId,
      lastArchiveRef: this.lastArchiveRef,
      lastReviewRequestRef: this.lastReviewRequestRef,
      lastTargetRefs: this.lastTargetRefs.slice(-12),
      lastChoiceSetRefs: this.lastChoiceSetRefs.slice(-12),
      lastChoiceSetOptionCount: this.lastChoiceSetOptionCount,
      lastChoiceSetTargetRefs: this.lastChoiceSetTargetRefs.slice(-12),
      lastChoiceSetEvidenceRefs: this.lastChoiceSetEvidenceRefs.slice(-12),
      lastChoiceSetOptionsWithoutEvidenceRefs: this.lastChoiceSetOptionsWithoutEvidenceRefs.slice(-12),
      lastChoiceSetTargetedOptionsWithoutTargetRefs: this.lastChoiceSetTargetedOptionsWithoutTargetRefs.slice(-12),
      lastContextRefs: this.lastContextRefs.slice(-12),
      lastEvidenceRefs: this.lastEvidenceRefs.slice(-12),
      lastError: this.lastError,
      boundaryNote:
        "Autonomy scheduler only opens periodic room rhythm; it never assigns speakers, forces replies, or treats silence as failure.",
    };
  }

  private isEnabled(): boolean {
    return Number.isFinite(this.options.intervalMs) && this.options.intervalMs > 0;
  }

  private nextDueAfter(now: Date): string | undefined {
    if (!this.isEnabled()) {
      return undefined;
    }
    return new Date(now.getTime() + this.options.intervalMs).toISOString();
  }
}

function uniqueSchedulerRefs(refs: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ref of refs) {
    if (typeof ref !== "string" || ref.length === 0 || seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    result.push(ref);
  }
  return result;
}
