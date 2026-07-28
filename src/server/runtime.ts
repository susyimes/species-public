import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  AgentContextPacket,
  AgentId,
  ContextFragment,
  ContextPacketAudit,
  MessageCreatedPayload,
  OmittedContextFragment,
  RoomEvent,
  SideEffectKind,
  TopicProposalAction,
  TopicStatus,
} from "../types";
import { RoomLedger } from "../kernel/ledger";
import {
  LivingRoomLoop,
  type AdvisoryWakeHint,
  type AdvisoryWakeHintProviderInput,
  type AgentContextPacketFactoryInput,
  type RoomLoopAcceptedMessage,
} from "../room/loop";
import { runAgentSmoke, type AgentSmokeReport } from "../agents/smoke";
import { seedAgents } from "../agents/seed";
import {
  createRuntimeAgentAdapters,
  type AgentRuntimeMode,
  type RuntimeAgentAdapter,
  type RuntimeAgentAdapterOptions,
} from "../agents/live";
import { ContextPacketBuilder, TopicWindowStore } from "../context/context";
import { ArchiveStore, DailyArchiveBuilder, type DailyArchive } from "../archive/archive";
import { MemoryClaimStore } from "../memory/memory";
import { PersonaService, type AgentProfile, type PersonaProjection } from "../persona/persona";
import { WorkspaceStore, workspaceProvisionedPayload } from "../workspace/workspace";
import { SkillRegistryStore, skillCapsuleRegisteredPayload } from "../skills/skills";
import {
  executeAgentCapability,
  type CapabilityExecutorOptions,
} from "../capabilities/capabilities";
import {
  yoloSpaceSummaries,
  type YoloSpaceConfig,
  type YoloSpaceSummary,
} from "../capabilities/yoloSpace";

const execFileAsync = promisify(execFile);

export type RuntimeChatMessage = {
  eventId: string;
  messageId: string;
  author: string;
  authorDisplayId: string;
  authorKind: string;
  displayName: string;
  initials: string;
  kind: "user" | "agent" | "system";
  date: string;
  time: string;
  text: string;
  topicId?: string;
  mentions: string[];
  contextRefs: string[];
};

export type RuntimeTimelineCategory =
  | "message"
  | "room_rhythm"
  | "archive"
  | "memory"
  | "memory_contest"
  | "agent_continuity"
  | "provider_boundary"
  | "social_loop"
  | "boundary";

export type RuntimeTimelineEntry = {
  eventId: string;
  eventType: string;
  category: RuntimeTimelineCategory;
  occurredAt: string;
  date: string;
  time: string;
  actorId: string;
  actorKind: string;
  title: string;
  detail: string;
  refs: string[];
  evidenceRefs: string[];
  boundaryNote: string;
};

export type RuntimeRoomState = {
  connected: true;
  roomId: string;
  ledgerPath: string;
  agentRuntimeMode: AgentExecutionMode;
  eventCount: number;
  timeline: RuntimeTimelineEntry[];
  messages: RuntimeChatMessage[];
  topics: RuntimeTopicSummary[];
  activeTopicId?: string;
  metrics: [string, string][];
  socialState: RuntimeSocialState;
  yoloSpaces: RuntimeYoloSpaceSummary[];
  agents: {
    id: string;
    name: string;
    initials: string;
    posture: string;
    provider: string;
    status: string;
    mode: AgentRuntimeMode;
    persona: string;
    tags: string[];
    capabilityRefs: string[];
  }[];
  checks: [string, boolean, string][];
  contextAudits: RuntimeContextAuditSummary[];
};

export type AgentExecutionMode = "seed" | "live";

export type RuntimeSocialState = {
  memoryClaims: RuntimeMemoryClaimSummary[];
  memoryReviews: RuntimeMemoryReviewSummary[];
  protocolReviews: RuntimeProtocolReviewSummary[];
  handoffReviews: RuntimeHandoffReviewSummary[];
  invitationReviews: RuntimeInvitationReviewSummary[];
  personaDeltaReviews: RuntimePersonaDeltaReviewSummary[];
  topicProposalReviews: RuntimeTopicProposalReviewSummary[];
  mixedReviewPressures: RuntimeMixedReviewPressureSummary[];
  mixedReviewPressureReviews: RuntimeMixedReviewPressureReviewSummary[];
  openQuestions: RuntimeOpenQuestionSummary[];
  topicProposals: RuntimeTopicProposalSummary[];
  handoffs: RuntimeHandoffSummary[];
  invitations: RuntimeInvitationSummary[];
  silences: RuntimeSilenceSummary[];
  pressureBoundaries: RuntimePressureBoundarySummary[];
  memoryPressureBoundaries: RuntimeMemoryPressureBoundarySummary[];
  providerBoundaries: RuntimeProviderBoundarySummary[];
  protocols: RuntimeProtocolSummary[];
  sideEffects: RuntimeSideEffectSummary[];
  sideEffectReviews: RuntimeSideEffectReviewSummary[];
  archives: RuntimeArchiveSummary[];
  archiveReviews: RuntimeArchiveReviewSummary[];
  autonomyTicks: RuntimeAutonomyTickSummary[];
  personas: RuntimePersonaSummary[];
  workspaces: RuntimeWorkspaceSummary[];
  workspaceArtifactReviews: RuntimeWorkspaceArtifactReviewSummary[];
  skillCapsules: RuntimeSkillCapsuleSummary[];
  skillCapsuleReviews: RuntimeSkillCapsuleReviewSummary[];
  capabilityReviews: RuntimeCapabilityReviewSummary[];
};

export type RuntimeMixedReviewPressureSummary = {
  pressureId: string;
  sourceMessageId?: string;
  topicId?: string;
  agentIds: string[];
  responseKindCounts: Record<string, number>;
  objectCount: number;
  touchedRefs: string[];
  touchedObjects: {
    kind: string;
    ref: string;
    response: string;
    eventId: string;
  }[];
  reviewEventIds: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeTopicSummary = {
  topicId: string;
  title: string;
  status: TopicStatus | "unknown";
  summary?: string;
  parentTopicId?: string;
  mergedInto?: string;
  appliedBy?: string;
  openQuestions: string[];
  messageCount: number;
  revivalCount: number;
  lastMessageAt?: string;
  lastRevivedAt?: string;
  lastRevivedByMessageId?: string;
  lastRevivedFromTopicId?: string;
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeTopicProposalSummary = {
  proposalId: string;
  status: string;
  action?: TopicProposalAction;
  currentTopicId?: string;
  targetTopicId?: string;
  proposedBy?: string;
  revisedFromTopicProposalRef?: string;
  revisedBy?: string;
  title: string;
  reason: string;
  contextRefs: string[];
  sourcePressureRefs: string[];
  responseCount: number;
  appliedBy?: string;
  resultingTopicId?: string;
  appliedTopicEventIds?: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeTopicProposalReviewSummary = {
  reviewId: string;
  topicProposalRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeMemoryClaimSummary = {
  memoryId: string;
  state: string;
  summary: string;
  kind?: string;
  proposedBy?: string;
  revisedFromMemoryRef?: string;
  revisedBy?: string;
  contestedBy: string[];
  sourceRefs: string[];
  sourcePressureRefs: string[];
  lastReviewedAt?: string;
  transitionCount: number;
  provisionalNote: string;
};

export type RuntimeMemoryReviewSummary = {
  reviewId: string;
  memoryRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeProtocolReviewSummary = {
  reviewId: string;
  protocolRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeHandoffReviewSummary = {
  reviewId: string;
  handoffRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeInvitationReviewSummary = {
  reviewId: string;
  invitationRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimePersonaDeltaReviewSummary = {
  reviewId: string;
  deltaRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeMixedReviewPressureReviewSummary = {
  reviewId: string;
  pressureRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeOpenQuestionSummary = {
  questionId: string;
  topicId?: string;
  question: string;
  raisedBy?: string;
  refinedFromQuestionRef?: string;
  refinedBy?: string;
  sourceMessageId?: string;
  sourceBoundaryId?: string;
  sourcePressureRefs: string[];
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
  responseCount: number;
  responseKindCounts: Record<string, number>;
  contestedCount: number;
  deferredCount: number;
  refinedCount: number;
  responseRefs: string[];
  respondingAgentIds: string[];
  lastResponse?: {
    response: string;
    summary: string;
    agentId?: string;
    sourceMessageId?: string;
    responseId?: string;
    occurredAt: string;
    boundaryNote: string;
  };
};

export type RuntimeHandoffSummary = {
  handoffId: string;
  status: string;
  topicId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  delegatedFromHandoffRef?: string;
  delegatedBy?: string;
  reason: string;
  requestedResponse?: string;
  sourcePressureRefs: string[];
  responseCount: number;
  responses: RuntimeHandoffResponseSummary[];
  boundaryNote: string;
  updatedAt: string;
};

export type RuntimeHandoffResponseSummary = {
  byAgentId?: string;
  response: string;
  reason?: string;
  redirectTo?: string;
  acceptedScopeSummary?: string;
  sourceRefs: string[];
  eventId: string;
  updatedAt: string;
};

export type RuntimeInvitationSummary = {
  invitationId: string;
  status: string;
  topicId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  delegatedFromInvitationRef?: string;
  delegatedBy?: string;
  reason: string;
  contextRefs: string[];
  sourcePressureRefs: string[];
  responseCount: number;
  responses: RuntimeInvitationResponseSummary[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeInvitationResponseSummary = {
  agentId?: string;
  response: string;
  reason: string;
  redirectTo?: string;
  contextRefs: string[];
  eventId: string;
  updatedAt: string;
};

export type RuntimeSilenceSummary = {
  silenceId: string;
  agentId?: string;
  topicId?: string;
  invitationId?: string;
  triggeringEventId?: string;
  reason: string;
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimePressureBoundarySummary = {
  boundaryId: string;
  reason: string;
  topicId?: string;
  messageEventId?: string;
  messageId?: string;
  activeBackgroundTurns?: number;
  queuedBackgroundTurns?: number;
  maxConcurrentBackgroundTurns?: number;
  updatedAt: string;
  boundaryNote: string;
  sourceRefs: string[];
};

export type RuntimeMemoryPressureBoundarySummary = {
  boundaryId: string;
  reason: string;
  topicId?: string;
  triggeringMemoryId?: string;
  pendingProposalCount: number;
  threshold: number;
  proposedMemoryRefs: string[];
  updatedAt: string;
  boundaryNote: string;
  sourceRefs: string[];
};

export type RuntimeProviderBoundarySummary = {
  boundaryId: string;
  status: "degraded" | "retired";
  agentId?: string;
  topicId?: string;
  triggeringEventId?: string;
  packetId?: string;
  providerKind?: string;
  providerLabel?: string;
  diagnostic: string;
  retiredBy?: string;
  retirementReason?: string;
  updatedAt: string;
  boundaryNote: string;
  sourceRefs: string[];
  choicePressure: RuntimeProviderBoundaryChoicePressureSummary;
};

export type RuntimeProviderBoundaryChoicePressureSummary = {
  repairRequestRefs: string[];
  deniedRepairRequestRefs: string[];
  approvedRepairRequestRefs: string[];
  resultRefs: string[];
  retryProtocolRefs: string[];
  retiredRetryProtocolRefs: string[];
  silenceRefs: string[];
  contestedMemoryRefs: string[];
  archiveCarryoverRefs: string[];
  choiceAgentIds: string[];
  hasMixedChoices: boolean;
  hasMultiAgentPressure: boolean;
  carriedAcrossArchives: boolean;
  boundaryNote: string;
};

export type RuntimeProtocolSummary = {
  protocolId: string;
  status: string;
  topicId?: string;
  proposedBy?: string;
  revisedFromProtocolRef?: string;
  revisedBy?: string;
  summary: string;
  scope: string;
  sourcePressureRefs: string[];
  responseCount: number;
  expiresAt?: string;
  expiryPolicy?: string;
  boundaryNote?: string;
  updatedAt: string;
};

type ProtocolExpiryCandidate = {
  protocolId: string;
  status: string;
  topicId?: string;
  expiresAt: string;
};

export type RuntimeSideEffectSummary = {
  requestId: string;
  approvalId?: string;
  status: string;
  requestedBy?: string;
  topicId?: string;
  kind?: SideEffectKind;
  target: string;
  reason: string;
  expectedImpact: string;
  proposedCommand?: string;
  contextRefs: string[];
  sourcePressureRefs: string[];
  decisionReason?: string;
  resultSummary?: string;
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeSideEffectReviewSummary = {
  reviewId: string;
  sideEffectRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeWorkspaceArtifactReviewSummary = {
  reviewId: string;
  artifactRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeSkillCapsuleReviewSummary = {
  reviewId: string;
  capsuleRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourcePressureRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeCapabilityReviewSummary = {
  reviewId: string;
  capabilityRef: string;
  topicId?: string;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  contextRefs: string[];
  sourcePressureRefs: string[];
  sourceRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeArchiveSummary = {
  archiveId: string;
  date: string;
  revisionOf?: string;
  appliedRepairRef?: string;
  revisionReason?: string;
  provenanceRefs: string[];
  summary: string;
  compressionNote: string;
  eventCount: number;
  decisionCount: number;
  disagreementCount: number;
  openQuestionCount: number;
  openQuestionTraceCount: number;
  memoryChangeCount: number;
  topicProposalCount: number;
  handoffCount: number;
  protocolCount: number;
  invitationCount: number;
  silenceCount: number;
  personaDeltaCount: number;
  agentContinuityCount: number;
  roleClaimCount: number;
  dailyMoodCount: number;
  agentContinuity: RuntimeArchiveAgentContinuitySummary[];
  sideEffectBoundaryCount: number;
  workspaceBoundaryCount: number;
  workspaceArtifactCount: number;
  skillCapsuleCount: number;
  capabilityReviewCount: number;
  pressureBoundaryCount: number;
  providerBoundaryCount: number;
  memoryPressureBoundaryCount: number;
  contestedCount: number;
};

export type RuntimeArchiveAgentContinuitySummary = {
  agentId: string;
  roleClaims: {
    roleClaimId: string;
    deltaId: string;
    label: string;
    status: string;
    evidenceRefs: string[];
    sourcePressureRefs: string[];
    contestRefs: string[];
    responseRefs: string[];
    boundaryNote: string;
  }[];
  dailyMoods: {
    deltaId: string;
    date?: string;
    posture: string;
    status: string;
    acceptedBy?: string;
    sourceRef?: string;
    evidenceRefs: string[];
    responseRefs: string[];
    boundaryNote: string;
  }[];
  sourceRefs: string[];
  eventIds: string[];
  boundaryNote: string;
};

export type RuntimeArchiveReviewSummary = {
  id: string;
  kind: "review_request" | "review" | "repair_proposal" | "repair_review" | "repair_response" | "repair_application";
  archiveRef: string;
  repairRef?: string;
  revisedFromRepairRef?: string;
  revisedBy?: string;
  revisedArchiveRef?: string;
  topicId?: string;
  agentId?: string;
  assessment?: string;
  response?: string;
  summary: string;
  reason: string;
  proposedRepair?: string;
  proposedRevision?: string;
  status?: string;
  contextRefs: string[];
  updatedAt: string;
  boundaryNote: string;
};

export type RuntimeAutonomyTickAction =
  | "archive_and_invite_review"
  | "review_open_archive"
  | "memory_hygiene_review"
  | "continuity_review"
  | "provider_boundary_review"
  | "open_question_revisit"
  | "invitation_review"
  | "handoff_review"
  | "idle_social_rhythm"
  | "silence_reentry"
  | "stay_silent";

export type RuntimeAutonomyChoiceOption = {
  action: RuntimeAutonomyTickAction;
  eligible: boolean;
  targetRefs: string[];
  evidenceRefs: string[];
  reason: string;
};

export type RuntimeAutonomyTickSummary = {
  tickId: string;
  action: RuntimeAutonomyTickAction;
  status: "posted" | "archived" | "silent" | "unchanged";
  reason: string;
  date: string;
  timezone: string;
  messageEventId?: string;
  anchorEventId?: string;
  archiveRef?: string;
  reviewRequestRef?: string;
  targetRefs: string[];
  contextRefs: string[];
  evidenceRefs: string[];
  choiceSet: RuntimeAutonomyChoiceOption[];
  occurredAt: string;
  boundaryNote: string;
};

export type RuntimePersonaSummary = {
  agentId: string;
  displayName: string;
  initialPosture?: string;
  dailyMood?: string;
  dailyMoodRecord?: {
    date: string;
    posture: string;
    sourceRef?: string;
    evidenceRefs: string[];
    responseRefs: string[];
    boundaryNote: string;
  };
  habits: string[];
  personality: string[];
  roleClaims: {
    roleClaimId: string;
    label: string;
    status: string;
    proposedBy: string;
    evidenceRefs: string[];
    responseRefs: string[];
    sourcePressureRefs: string[];
    contestRefs: string[];
  }[];
  evolutionLog: {
    deltaId: string;
    status: string;
    proposedBy: string;
    revisedFromDeltaRef?: string;
    revisedBy?: string;
    reason: string;
    field: string;
    operation: string;
    value: string;
    sourcePressureRefs: string[];
    responseCount: number;
  }[];
};

export type RuntimeWorkspaceSummary = {
  workspaceId: string;
  agentId: string;
  displayName: string;
  privateHome: string;
  scratchPath: string;
  visibility: string;
  sharedArtifactCount: number;
  sharedArtifactRefs: string[];
  boundaryNote: string;
};

export type RuntimeYoloSpaceSummary = YoloSpaceSummary;

export type RuntimeSkillCapsuleSummary = {
  capsuleId: string;
  agentId: string;
  displayName: string;
  label: string;
  summary: string;
  triggerHints: string[];
  sideEffectKinds: string[];
  approvalRequired: boolean;
  disclosurePolicy: string;
  instructionRef: string;
  inputContract: string;
  outputContract: string;
  approvalProfile: {
    approvalRequired: boolean;
    sideEffectKinds: string[];
    boundaryNote: string;
  };
  status: string;
  boundaryNote: string;
};

export type RuntimeContextAuditSummary = {
  packetId: string;
  agentId?: string;
  topicId: string;
  selectedCount: number;
  omittedCount: number;
  selectedByType: Record<string, number>;
  omittedByReason: Record<string, number>;
  totalTokenEstimate: number;
  largestFragment?: {
    id: string;
    type: string;
    tokenEstimate: number;
    hardCap: number;
  };
  cacheKey: string;
  builtFromLedgerRange: {
    fromCursor: number;
    toCursor: number;
  };
  omittedByType: Record<string, number>;
  selectedFragments: RuntimeContextFragmentSummary[];
  omittedFragments: RuntimeOmittedContextFragmentSummary[];
  auditBoundaryNote: string;
};

export type RuntimeContextFragmentSummary = {
  id: string;
  type: string;
  visibility: string;
  role: string;
  sourceKind: string;
  sourceEventId?: string;
  ledgerCursor?: number;
  refs: string[];
  tokenEstimate: number;
  hardCap: number;
  priority: number;
  stateKeys?: string[];
  boundarySignals?: Record<string, string | number | boolean>;
};

export type RuntimeOmittedContextFragmentSummary = {
  id: string;
  type: string;
  visibility: string;
  reason: string;
  refs: string[];
  tokenEstimate: number;
  hardCap: number;
  priority: number;
};

export type RuntimeTurnResult = RuntimeRoomState & {
  turn: {
    status?: "completed" | "queued" | "pressure_queued";
    correlationId: string;
    topicId: string;
    invitedAgents: AgentId[];
    secondaryInvitedAgents: AgentId[];
    intentionKinds: string[];
    visibleMessageEventIds: string[];
    triggeringMessageEventId: string;
  };
};

export type RuntimeArchiveResult = RuntimeRoomState & {
  archive: DailyArchive;
};

export type RuntimeAutonomyTickResult = RuntimeRoomState & {
  autonomyTick: RuntimeAutonomyTickSummary;
  turn?: RuntimeTurnResult["turn"];
};

export type RuntimeAutonomyTickInput = {
  now?: string;
  date?: string;
  timezone?: string;
  force?: boolean;
  memoryHygieneReviewAfterMs?: number;
  continuityReviewAfterMs?: number;
  silenceReentryAfterMs?: number;
  idleSocialAfterMs?: number;
  archiveReviewQuietAfterMs?: number;
};

export type RuntimeTopicDiscussionRequestResult = RuntimeTurnResult & {
  discussionRequestRef: string;
};

export type RuntimeArchiveRepairApplyResult = RuntimeArchiveResult & {
  appliedRepairRef: string;
  revisionOf: string;
  acceptedResponseRefs: string[];
};

export type RuntimeSideEffectExpireResult = RuntimeRoomState & {
  expiredSideEffectRef: string;
  expiredApprovalId: string;
};

export type RuntimeSideEffectApproveResult = RuntimeRoomState & {
  approvedSideEffectRef: string;
  approvedApprovalId: string;
};

export type RuntimeSideEffectExecuteResult = RuntimeRoomState & {
  executedSideEffectRef: string;
  resultRef: string;
};

export type SpeciesRoomRuntimeOptions = {
  roomId?: string;
  ledgerPath?: string;
  smoke?: () => Promise<AgentSmokeReport>;
  liveAgents?: boolean;
  agentAdapterOptions?: Partial<Omit<RuntimeAgentAdapterOptions, "ledger" | "liveMode">>;
  maxConcurrentBackgroundTurns?: number;
  maxAwakenedAgents?: number;
  maxSpeakers?: number;
  maxAutonomousAwakenedAgents?: number;
  maxAutonomousSpeakers?: number;
  speakerArbitrationWindowMs?: number;
  allowedReadRoots?: readonly string[];
  allowAllDeviceRead?: boolean;
  enableMemsuRead?: boolean;
  memsuHome?: string;
  enableYolo?: boolean;
  yoloSpacesFile?: string;
  yoloSpaces?: readonly YoloSpaceConfig[];
};

const PERSONA_PROJECTION_HARD_CAP = 700;
const DEFAULT_MEMORY_HYGIENE_REVIEW_AFTER_MS = 7 * 24 * 60 * 60_000;
const DEFAULT_CONTINUITY_REVIEW_AFTER_MS = 7 * 24 * 60 * 60_000;
const DEFAULT_SILENCE_REENTRY_AFTER_MS = 6 * 60 * 60_000;

export class SpeciesRoomRuntime {
  private readonly roomId: string;
  private readonly ledgerPath: string;
  private readonly ledger: RoomLedger;
  private readonly loop: LivingRoomLoop;
  private readonly agentAdapters: RuntimeAgentAdapter[];
  private readonly agentRuntimeMode: AgentExecutionMode;
  private readonly smoke: () => Promise<AgentSmokeReport>;
  private smokeReport: AgentSmokeReport | null = null;
  private initialized: Promise<void> | null = null;
  private readonly lastContextAudits: RuntimeContextAuditSummary[] = [];
  private readonly backgroundTurns = new Set<Promise<void>>();
  private readonly pendingBackgroundTurns: RoomLoopAcceptedMessage[] = [];
  private readonly autonomousBackgroundTurns = new Set<Promise<void>>();
  private readonly pendingAutonomousBackgroundTurns: RoomLoopAcceptedMessage[] = [];
  private readonly maxConcurrentBackgroundTurns: number;
  private readonly maxAutonomousAwakenedAgents: number;
  private readonly maxAutonomousSpeakers: number;
  private readonly capabilityExecutorOptions: CapabilityExecutorOptions;

  public constructor(options: SpeciesRoomRuntimeOptions = {}) {
    this.roomId = options.roomId ?? "room_species";
    this.ledgerPath = options.ledgerPath ?? path.join(process.cwd(), ".species", "room-ledger.jsonl");
    this.smoke = options.smoke ?? runAgentSmoke;
    this.maxConcurrentBackgroundTurns = Math.max(1, Math.floor(options.maxConcurrentBackgroundTurns ?? 2));
    this.maxAutonomousAwakenedAgents = positiveIntegerOrDefault(options.maxAutonomousAwakenedAgents, 2);
    this.maxAutonomousSpeakers = nonNegativeIntegerOrDefault(options.maxAutonomousSpeakers, 1);
    const runtimeCwd = process.cwd();
    this.capabilityExecutorOptions = {
      cwd: runtimeCwd,
      allowedReadRoots: options.allowedReadRoots ?? configuredReadRoots(process.env.SPECIES_READ_ROOTS, runtimeCwd),
      allowAllDeviceRead: options.allowAllDeviceRead ?? environmentFlag(process.env.SPECIES_ALLOW_ALL_DEVICE_READ),
      enableMemsuRead: options.enableMemsuRead ?? environmentFlag(process.env.SPECIES_ENABLE_MEMSU_READ),
      memsuHome: options.memsuHome ?? process.env.SPECIES_MEMSU_HOME?.trim() ?? process.env.MEMSU_HOME?.trim(),
      yoloEnabled:
        options.enableYolo ?? (options.yoloSpaces !== undefined ? true : environmentFlag(process.env.SPECIES_ENABLE_YOLO)),
      yoloSpacesFile: options.yoloSpacesFile,
      yoloSpaces: options.yoloSpaces,
    };
    this.ledger = new RoomLedger({
      filePath: this.ledgerPath,
      idFactory: createRuntimeIdFactory(),
    });
    this.agentRuntimeMode = (options.liveAgents ?? process.env.SPECIES_AGENT_MODE === "live") ? "live" : "seed";
    this.agentAdapters = createRuntimeAgentAdapters({
      ledger: this.ledger,
      liveMode: this.agentRuntimeMode === "live",
      ...options.agentAdapterOptions,
    });
    this.loop = new LivingRoomLoop({
      ledger: this.ledger,
      agents: this.agentAdapters,
      maxAwakenedAgents: positiveIntegerOrDefault(options.maxAwakenedAgents, 8),
      maxSpeakers: positiveIntegerOrDefault(options.maxSpeakers, 4),
      speakerArbitrationWindowMs: nonNegativeIntegerOrDefault(options.speakerArbitrationWindowMs, 25),
      contextPacketFactory: async (input) => this.buildRuntimeContextPacket(input),
      wakeHintProvider: seedCapabilityWakeHints,
      capabilityExecutor: (request) => executeAgentCapability(request, this.capabilityExecutorOptions),
      idFactory: createRuntimeIdFactory(),
      wakePolicyVersion: "local-runtime-wake-v1",
    });
  }

  public getAgentRuntimeMode(): AgentExecutionMode {
    return this.agentRuntimeMode;
  }

  public async getState(): Promise<RuntimeRoomState> {
    await this.ensureInitialized();
    await this.expireProtocols();
    const [events, smokeReport] = await Promise.all([this.ledger.readAll(), this.getSmokeReport()]);
    const yoloSpaces = yoloSpaceSummaries(this.capabilityExecutorOptions);
    const visibleRoomMessageCount = events.filter(isChatStreamMessageEvent).length;
    return {
      connected: true,
      roomId: this.roomId,
      ledgerPath: this.ledgerPath,
      agentRuntimeMode: this.agentRuntimeMode,
      eventCount: events.length,
      timeline: projectLivingTimeline(events),
      messages: projectMessages(events),
      topics: projectTopics(events),
      activeTopicId: projectActiveTopicId(events),
      socialState: projectSocialState(events),
      yoloSpaces,
      metrics: [
        [String(events.length), "ledger events"],
        [String(visibleRoomMessageCount), "room messages"],
        [String(events.filter((event) => event.event_type === "agent.intention_recorded").length), "agent intentions"],
        [String(events.filter((event) => event.event_type === "daily_archive.created").length), "daily archives"],
        [String(events.filter((event) => event.event_type === "topic.proposed").length), "topic proposals"],
        [String(events.filter((event) => event.event_type === "topic.responded").length), "topic responses"],
        [String(events.filter((event) => event.event_type === "topic.reviewed").length), "topic reviews"],
        [String(events.filter((event) => event.event_type === "capability.reviewed").length), "capability reviews"],
        [
          String(events.filter((event) => event.event_type === "mixed_review_pressure.reviewed").length),
          "mixed review pressure reviews",
        ],
        [String(events.filter((event) => event.event_type === "side_effect.requested").length), "action requests"],
        [String(events.filter((event) => event.event_type === "agent.provider_degraded").length), "provider degradations"],
        [String(events.filter((event) => event.event_type === "room.pressure_detected").length), "pressure boundaries"],
        [String(this.backgroundTurns.size), "active background turns"],
        [String(this.pendingBackgroundTurns.length), "queued background turns"],
        [String(this.autonomousBackgroundTurns.size), "active autonomous background turns"],
        [String(this.pendingAutonomousBackgroundTurns.length), "queued autonomous background turns"],
        [String(this.maxAutonomousAwakenedAgents), "max autonomous awakened agents"],
        [String(this.maxAutonomousSpeakers), "max autonomous speakers"],
        [String(yoloSpaces.filter((space) => space.ready).length), "ready YOLO spaces"],
        [this.agentRuntimeMode, "agent runtime mode"],
        [String(seedAgents.length), "seed agents"],
      ],
      agents: seedAgents.map((agent) => {
        const smokeAgent = smokeReport.agents.find((item) => item.agentId === agent.agentId);
        return {
          id: agent.agentId,
          name: agent.displayName,
          initials: initialsFor(agent.agentId),
          posture: agent.initialPosture,
          provider: agent.provider.label,
          status: smokeAgent?.status ?? "unknown",
          mode: modeForAgentAdapter(this.agentAdapters.find((adapter) => adapter.agentId === agent.agentId), smokeAgent?.status),
          persona: agent.persona.core,
          tags: agent.capabilities.flatMap((capability) => capability.domainTags).slice(0, 4),
          capabilityRefs: agent.capabilities.map((capability) => capability.capabilityId),
        };
      }),
      checks: smokeReport.agents.flatMap((agent) =>
        agent.checks.map((check) => [`${agent.displayName}: ${check.name}`, check.ok, check.detail] as [string, boolean, string]),
      ),
      contextAudits: this.lastContextAudits.slice(-8),
    };
  }

  public async postUserMessage(input: {
    content: string;
    clientMessageId: string;
    mentions?: string[];
    contextRefs?: string[];
    topicId?: string;
  }): Promise<RuntimeTurnResult> {
    await this.ensureInitialized();
    const content = input.content.trim();
    if (content.length === 0) {
      throw new Error("message content is required");
    }
    if (content.length > 4000) {
      throw new Error("message content is too long");
    }
    await this.expireProtocols();

    const result = await this.loop.processMessage({
      roomId: this.roomId,
      author: "user",
      authorKind: "user",
      content,
      clientMessageId: input.clientMessageId,
      topicId: sanitizeOptionalRef(input.topicId),
      mentions: sanitizeMentions(input.mentions ?? []),
      contextRefs: sanitizeRefs(input.contextRefs ?? []),
      correlationId: `turn:${input.clientMessageId}`,
    });

    return {
      ...(await this.getState()),
      turn: {
        status: "completed",
        correlationId: result.correlationId,
        topicId: result.topicId,
        invitedAgents: result.invitedAgents,
        secondaryInvitedAgents: result.secondaryInvitedAgents,
        intentionKinds: result.intentions.map((intention) => intention.kind),
        visibleMessageEventIds: result.visibleMessageEventIds,
        triggeringMessageEventId: result.triggeringMessageEventId,
      },
    };
  }

  public async enqueueUserMessage(input: {
    content: string;
    clientMessageId: string;
    mentions?: string[];
    contextRefs?: string[];
    topicId?: string;
  }): Promise<RuntimeTurnResult> {
    await this.ensureInitialized();
    const content = input.content.trim();
    if (content.length === 0) {
      throw new Error("message content is required");
    }
    if (content.length > 4000) {
      throw new Error("message content is too long");
    }
    await this.expireProtocols();

    const accepted = await this.loop.acceptMessage({
      roomId: this.roomId,
      author: "user",
      authorKind: "user",
      content,
      clientMessageId: input.clientMessageId,
      topicId: sanitizeOptionalRef(input.topicId),
      mentions: sanitizeMentions(input.mentions ?? []),
      contextRefs: sanitizeRefs(input.contextRefs ?? []),
      correlationId: `turn:${input.clientMessageId}`,
    });
    const invitedAgents = await this.loop.previewWakeCandidateIds(accepted);
    const scheduled = await this.scheduleBackgroundTurn(accepted);

    return {
      ...(await this.getState()),
      turn: {
        status: scheduled === "delayed" ? "pressure_queued" : "queued",
        correlationId: accepted.correlationId,
        topicId: accepted.topicId,
        invitedAgents,
        secondaryInvitedAgents: [],
        intentionKinds: [],
        visibleMessageEventIds: [],
        triggeringMessageEventId: accepted.triggeringMessageEventId,
      },
    };
  }

  public async requestTopicDiscussion(input: {
    topicId: string;
    clientMessageId: string;
    prompt?: string;
    contextRefs?: string[];
  }): Promise<RuntimeTopicDiscussionRequestResult> {
    await this.ensureInitialized();
    await this.expireProtocols();
    const topicId = sanitizeOptionalRef(input.topicId);
    if (!topicId) {
      throw new Error("topicId is required");
    }
    const content = topicDiscussionPrompt(input.prompt);
    const requestId = `topic_discussion_${stableRefSuffix(input.clientMessageId, topicId)}`;
    const contextRefs = uniqueRefs([topicId, ...sanitizeRefs(input.contextRefs ?? [])]);
    const append = await this.ledger.append({
      roomId: this.roomId,
      eventType: "topic.discussion_requested",
      actor: { kind: "user", id: "topic_surface" },
      payload: {
        requestId,
        topicId,
        prompt: content,
        contextRefs,
        requestedBy: "human",
        boundaryNote:
          "human topic discussion request is an explicit room message trigger; bare topic projections do not wake agents by themselves",
      },
      refs: uniqueRefs([requestId, ...contextRefs]),
      correlationId: `topic_discussion:${input.clientMessageId}`,
      idempotencyKey: `topic_discussion:${this.roomId}:${input.clientMessageId}:${topicId}`,
    });
    if (append.status !== "appended" && append.status !== "duplicate") {
      throw new Error(`Ledger rejected topic.discussion_requested: ${"reason" in append ? append.reason : append.status}`);
    }

    const turn = await this.enqueueUserMessage({
      content,
      clientMessageId: `${input.clientMessageId}:message`,
      topicId,
      contextRefs: uniqueRefs([append.event.event_id, requestId, ...contextRefs]),
    });
    return {
      ...turn,
      discussionRequestRef: requestId,
    };
  }

  public async rawEvents(): Promise<RoomEvent[]> {
    await this.ensureInitialized();
    return this.ledger.readAll();
  }

  public async createDailyArchive(input: { date?: string; timezone?: string } = {}): Promise<RuntimeArchiveResult> {
    await this.ensureInitialized();
    await this.expireProtocols();
    const events = await this.ledger.readAll();
    const date = input.date ?? new Date().toISOString().slice(0, 10);
    const archive = new DailyArchiveBuilder().build(events, {
      roomId: this.roomId,
      date,
      timezone: input.timezone ?? "Asia/Shanghai",
      fromOffset: 0,
      toOffset: Math.max(0, events.length - 1),
      createdAt: new Date().toISOString(),
      createdBy: "http_runtime_archive_worker",
    });

    const archiveAppend = await this.ledger.append({
      roomId: this.roomId,
      eventType: "daily_archive.created",
      actor: { kind: "system", id: "archive_worker" },
      payload: {
        archive,
        archiveId: archive.archiveId,
        date: archive.date,
        timezone: archive.timezone,
        topicIds: archive.topicIds,
        summary: archive.summary,
      },
      refs: uniqueRefs(
        archive.topicIds
          .concat(archive.contestedItems)
          .concat(archive.workspaceBoundaries.map((boundary) => boundary.workspaceId))
          .concat(archive.workspaceArtifacts.map((artifact) => artifact.artifactId))
          .concat(archive.skillCapsules.map((capsule) => capsule.capsuleId))
          .concat(archive.capabilityReviews.map((review) => review.capabilityRef))
          .concat(archive.sideEffectBoundaries.map((boundary) => boundary.requestId))
          .concat(archive.handoffs.map((handoff) => handoff.handoffId))
          .concat(archive.protocols.map((protocol) => protocol.protocolId))
          .concat(archive.invitations.map((invitation) => invitation.invitationId))
          .concat(archive.silences.map((silence) => silence.silenceId))
          .concat(archive.personaDeltas.map((delta) => delta.deltaId))
          .concat(archive.agentContinuity.flatMap((continuity) => continuity.sourceRefs))
          .concat(archive.agentContinuity.flatMap((continuity) => continuity.roleClaims.flatMap((claim) => claim.responseRefs)))
          .concat(archive.agentContinuity.flatMap((continuity) => continuity.dailyMoods.flatMap((mood) => mood.responseRefs)))
          .concat(archive.openQuestionTraces.map((question) => question.questionId))
          .concat(archive.memoryPressureBoundaries.map((boundary) => boundary.boundaryId)),
      ),
      correlationId: `archive:${date}:${archive.inputLedgerRange.fromOffset}-${archive.inputLedgerRange.toOffset}`,
      idempotencyKey: `archive:${this.roomId}:${date}:${archive.inputLedgerRange.fromOffset}-${archive.inputLedgerRange.toOffset}`,
    });
    if (archiveAppend.status !== "appended" && archiveAppend.status !== "duplicate") {
      throw new Error(`Ledger rejected daily_archive.created: ${"reason" in archiveAppend ? archiveAppend.reason : archiveAppend.status}`);
    }
    const archiveEvent = archiveAppend.event;

    const reviewRequestId = `archive_review_request_${archiveEvent.event_id}`;
    const reviewRequest = await this.ledger.append({
      roomId: this.roomId,
      eventType: "archive.review_requested",
      actor: { kind: "system", id: "archive_worker" },
      payload: {
        requestId: reviewRequestId,
        archiveRef: archive.archiveId,
        date: archive.date,
        requestedBy: "archive_worker",
        summary: "Review the latest daily time skeleton, not consensus.",
        reason: "Daily rhythm invites the room to inspect omissions, bias, contested memory, or useful repair without forcing anyone to speak.",
        status: "open",
        contextRefs: [archive.archiveId, archiveEvent.event_id],
        boundaryNote:
          "daily archive review request is a room rhythm invitation, not a command to speak, accept, or repair the archive",
      },
      refs: uniqueRefs([reviewRequestId, archive.archiveId, archiveEvent.event_id]),
      causationId: archiveEvent.event_id,
      correlationId: `archive_review_request:${archive.archiveId}:${archiveEvent.event_id}`,
      idempotencyKey: `archive_review_request:${this.roomId}:${archiveEvent.event_id}`,
    });
    if (reviewRequest.status !== "appended" && reviewRequest.status !== "duplicate") {
      throw new Error(`Ledger rejected archive.review_requested: ${"reason" in reviewRequest ? reviewRequest.reason : reviewRequest.status}`);
    }

    return {
      ...(await this.getState()),
      archive,
    };
  }

  public async runAutonomousTick(input: RuntimeAutonomyTickInput = {}): Promise<RuntimeAutonomyTickResult> {
    await this.ensureInitialized();
    const now = input.now ?? new Date().toISOString();
    await this.expireProtocols(now);
    const timezone = input.timezone ?? "Asia/Shanghai";
    const date = input.date ?? localDateInTimeZone(now, timezone);
    const events = await this.ledger.readAll();
    if (!input.force && (this.backgroundTurns.size >= this.maxConcurrentBackgroundTurns || this.pendingBackgroundTurns.length > 0)) {
      const pressureRefs = backgroundPressureHoldRefs(events);
      const pressureScope = `${now.replace(/[^0-9]/g, "")}:${this.backgroundTurns.size}:${this.pendingBackgroundTurns.length}:${pressureRefs.join(",")}`;
      const tick = await this.recordAutonomyTick({
        tickId: `autonomy_tick_${date.replace(/[^0-9]/g, "")}_background_pressure_hold_${now.replace(/[^0-9]/g, "")}`,
        idempotencyScope: `background_pressure_hold:${pressureScope}`,
        action: "stay_silent",
        status: "unchanged",
        reason: `Background turn pressure is still draining (${this.backgroundTurns.size}/${this.maxConcurrentBackgroundTurns} active, ${this.pendingBackgroundTurns.length} queued), so the scheduler preserved silence instead of enqueueing another autonomous wake.`,
        date,
        timezone,
        targetRefs: pressureRefs,
        contextRefs: pressureRefs,
        evidenceRefs: pressureRefs,
        choiceSet: [
          {
            action: "stay_silent",
            eligible: true,
            targetRefs: pressureRefs,
            evidenceRefs: pressureRefs,
            reason: "Background turns are still draining, so the bounded autonomous choice is to preserve silence.",
          },
        ],
        occurredAt: now,
      });
      return {
        ...(await this.getState()),
        autonomyTick: tick,
      };
    }
    if (
      !input.force &&
      (this.autonomousBackgroundTurns.size >= this.maxConcurrentBackgroundTurns ||
        this.pendingAutonomousBackgroundTurns.length > 0)
    ) {
      const pressureRefs = backgroundPressureHoldRefs(events);
      const pressureScope = `${now.replace(/[^0-9]/g, "")}:${this.autonomousBackgroundTurns.size}:${this.pendingAutonomousBackgroundTurns.length}:${pressureRefs.join(",")}`;
      const tick = await this.recordAutonomyTick({
        tickId: `autonomy_tick_${date.replace(/[^0-9]/g, "")}_autonomous_pressure_hold_${now.replace(/[^0-9]/g, "")}`,
        idempotencyScope: `autonomous_pressure_hold:${pressureScope}`,
        action: "stay_silent",
        status: "unchanged",
        reason: `Autonomous room rhythm is still resolving (${this.autonomousBackgroundTurns.size}/${this.maxConcurrentBackgroundTurns} active, ${this.pendingAutonomousBackgroundTurns.length} queued), so the scheduler preserved silence instead of enqueueing another autonomous wake.`,
        date,
        timezone,
        targetRefs: pressureRefs,
        contextRefs: pressureRefs,
        evidenceRefs: pressureRefs,
        choiceSet: [
          {
            action: "stay_silent",
            eligible: true,
            targetRefs: pressureRefs,
            evidenceRefs: pressureRefs,
            reason: "Autonomous rhythm is still resolving, so the bounded room choice is to preserve silence.",
          },
        ],
        occurredAt: now,
      });
      return {
        ...(await this.getState()),
        autonomyTick: tick,
      };
    }
    const latestTick = latestAutonomyTickEvent(events);
    const latestRelevant = latestArchiveRelevantEvent(events);
    const latestArchive = latestDailyArchiveEventForDate(events, date);
    const unpostedReviewRequest = latestUnpostedArchiveReviewRequest(events);
    const hasNewRelevantSinceTick =
      latestRelevant !== undefined && (latestTick === undefined || eventIndex(events, latestRelevant) > eventIndex(events, latestTick));
    const hasNewRelevantSinceArchive =
      latestRelevant !== undefined &&
      (latestArchive === undefined || eventIndex(events, latestRelevant) > eventIndex(events, latestArchive));
    const archiveReviewQuietAfterMs =
      input.force === true ? 0 : nonNegativeIntegerOrDefault(input.archiveReviewQuietAfterMs, 0);
    const archiveReviewIsQuietEnough =
      latestRelevant === undefined ||
      archiveReviewQuietAfterMs === 0 ||
      Date.parse(now) - Date.parse(latestRelevant.occurred_at) >= archiveReviewQuietAfterMs;
    const archiveReviewEligible = hasNewRelevantSinceArchive && archiveReviewIsQuietEnough;
    const rawSocialCandidates = autonomousSocialCarryCandidates(events, {
      now,
      memoryHygieneReviewAfterMs: nonNegativeIntegerOrDefault(
        input.memoryHygieneReviewAfterMs,
        DEFAULT_MEMORY_HYGIENE_REVIEW_AFTER_MS,
      ),
      continuityReviewAfterMs: nonNegativeIntegerOrDefault(
        input.continuityReviewAfterMs,
        DEFAULT_CONTINUITY_REVIEW_AFTER_MS,
      ),
    });
    const socialCandidates = archiveReviewIsQuietEnough
      ? rawSocialCandidates
      : rawSocialCandidates.filter((candidate) => !isAutonomousReviewCarryAction(candidate.action));
    const socialCarry = socialCandidates[0];
    const reviewRequest = archiveReviewIsQuietEnough ? unpostedReviewRequest : undefined;
    const silenceReentryAfterMs = nonNegativeIntegerOrDefault(input.silenceReentryAfterMs, DEFAULT_SILENCE_REENTRY_AFTER_MS);
    const silenceReentry = nextSilenceReentryCarry(events, {
      now,
      silenceReentryAfterMs,
    });
    const quietMsSinceLatestRelevant =
      latestRelevant === undefined ? undefined : Date.parse(now) - Date.parse(latestRelevant.occurred_at);
    const needsPreservedSilenceTick =
      latestRelevant !== undefined &&
      Number.isFinite(quietMsSinceLatestRelevant) &&
      (quietMsSinceLatestRelevant ?? 0) >= silenceReentryAfterMs &&
      !hasAutonomousActionForRefSinceIndex(events, "stay_silent", latestRelevant.event_id, eventIndex(events, latestRelevant));
    const idleSocialRhythm = nextIdleSocialRhythmCarry(events, {
      now,
      idleSocialAfterMs: input.idleSocialAfterMs,
    });
    const choiceSet = autonomyChoiceSet({
      hasNewRelevantSinceArchive: archiveReviewEligible,
      latestRelevant,
      unpostedReviewRequest: reviewRequest,
      socialCandidates,
      idleSocialRhythm,
      silenceReentry,
    });

    if (
      !input.force &&
      latestRelevant === undefined &&
      reviewRequest === undefined &&
      socialCarry === undefined &&
      idleSocialRhythm === undefined &&
      silenceReentry === undefined &&
      !needsPreservedSilenceTick
    ) {
      return {
        ...(await this.getState()),
        autonomyTick: {
          tickId: `autonomy_tick_${date.replace(/[^0-9]/g, "")}_empty_silence`,
          action: "stay_silent",
          status: "unchanged",
          reason:
            "No room-visible conversation exists yet, so the scheduler preserved silence without writing a room rhythm event.",
          date,
          timezone,
          targetRefs: [],
          contextRefs: [],
          evidenceRefs: [],
          choiceSet: [],
          occurredAt: now,
          boundaryNote:
            "autonomous rhythm is evidence-driven room etiquette; it may invite review or preserve silence, but it does not force speech, assign work, or make memory true",
        },
      };
    }

    if (
      !input.force &&
      latestTick !== undefined &&
      !hasNewRelevantSinceTick &&
      !archiveReviewEligible &&
      reviewRequest === undefined &&
      socialCarry === undefined &&
      idleSocialRhythm === undefined &&
      silenceReentry === undefined &&
      !needsPreservedSilenceTick
    ) {
      return {
        ...(await this.getState()),
        autonomyTick: {
          ...autonomyTickSummaryFromEvent(latestTick),
          status: "unchanged",
          reason: "No new room-visible sediment appeared since the last autonomous rhythm decision.",
        },
      };
    }

    if (
      idleSocialRhythm !== undefined &&
      reviewRequest === undefined &&
      socialCarry === undefined
    ) {
      const rewake = await this.scheduleAutonomousWakeFromExistingMessage({
        messageEventId: idleSocialRhythm.triggeringMessageEventId,
        topicId: idleSocialRhythm.topicId,
        correlationId: `autonomy:${date}:idle_social:${idleSocialRhythm.anchorEventId}`,
        wakeIdempotencyScope: idleSocialRhythm.wakeScope,
      });
      const tick = await this.recordAutonomyTick({
        action: "idle_social_rhythm",
        status: "posted",
        reason: idleSocialRhythm.reason,
        date,
        timezone,
        messageEventId: rewake.turn.triggeringMessageEventId,
        anchorEventId: idleSocialRhythm.anchorEventId,
        targetRefs: idleSocialRhythm.targetRefs,
        contextRefs: idleSocialRhythm.contextRefs,
        evidenceRefs: uniqueRefs([...idleSocialRhythm.evidenceRefs, rewake.turn.triggeringMessageEventId]),
        choiceSet,
        occurredAt: now,
      });
      return {
        ...(await this.getState()),
        autonomyTick: tick,
        turn: rewake.turn,
      };
    }

    if (archiveReviewEligible) {
      const archived = await this.createDailyArchive({ date, timezone });
      const afterArchiveEvents = await this.ledger.readAll();
      const reviewRequest = latestUnpostedArchiveReviewRequest(afterArchiveEvents, archived.archive.archiveId);
      const contextRefs = uniqueRefs([
        archived.archive.archiveId,
        reviewRequest?.id,
        latestRelevant?.event_id,
        ...archived.archive.openQuestionTraces.map((question) => question.questionId),
        ...archived.archive.contestedItems,
        ...archived.archive.providerBoundaries.map((boundary) => boundary.boundaryId),
      ]);
      const posted = await this.postAutonomousRoomMessage({
        content:
          "房间自动节律：今天的时间骨架已生成。请自愿审阅这段记录：遗漏、争议、需要 contest 的公共记忆、provider boundary、daily mood 变化，或继续沉默。不要把这当成任务分派或共识生成。",
        clientMessageId: `autonomy_archive_review_${archived.archive.archiveId}_${reviewRequest?.id ?? "latest"}`,
        contextRefs,
        correlationId: `autonomy:${date}:archive_review:${archived.archive.archiveId}`,
      });
      const tick = await this.recordAutonomyTick({
        action: "archive_and_invite_review",
        status: "archived",
        reason:
          "New room-visible sediment appeared after the latest daily archive, so the room compressed time and opened an optional review invitation.",
        date,
        timezone,
        messageEventId: posted.turn.triggeringMessageEventId,
        archiveRef: archived.archive.archiveId,
        reviewRequestRef: reviewRequest?.id,
        targetRefs: uniqueRefs([archived.archive.archiveId, reviewRequest?.id]),
        contextRefs,
        evidenceRefs: uniqueRefs([latestRelevant?.event_id, archived.archive.archiveId, reviewRequest?.id, posted.turn.triggeringMessageEventId]),
        choiceSet,
        occurredAt: now,
      });
      return {
        ...(await this.getState()),
        autonomyTick: tick,
        turn: posted.turn,
      };
    }

    if (reviewRequest !== undefined) {
      const contextRefs = uniqueRefs([reviewRequest.archiveRef, reviewRequest.id, ...reviewRequest.contextRefs]);
      const posted = await this.postAutonomousRoomMessage({
        content:
          "房间自动节律：沉默后重入，邀请自愿审阅最新时间骨架。可以指出遗漏、提出修复、保留争议、请求 handoff，或继续沉默。",
        clientMessageId: `autonomy_review_request_${reviewRequest.id}`,
        contextRefs,
        correlationId: `autonomy:${date}:review_request:${reviewRequest.id}`,
      });
      const tick = await this.recordAutonomyTick({
        action: "review_open_archive",
        status: "posted",
        reason:
          "An open archive review request had not yet been carried into an autonomous room invitation.",
        date,
        timezone,
        messageEventId: posted.turn.triggeringMessageEventId,
        archiveRef: reviewRequest.archiveRef,
        reviewRequestRef: reviewRequest.id,
        targetRefs: uniqueRefs([reviewRequest.archiveRef, reviewRequest.id]),
        contextRefs,
        evidenceRefs: uniqueRefs([reviewRequest.id, reviewRequest.archiveRef, posted.turn.triggeringMessageEventId]),
        choiceSet,
        occurredAt: now,
      });
      return {
        ...(await this.getState()),
        autonomyTick: tick,
        turn: posted.turn,
      };
    }

    if (socialCarry !== undefined) {
      const posted = await this.postAutonomousRoomMessage({
        content: socialCarry.content,
        clientMessageId: autonomySocialClientMessageId(socialCarry),
        contextRefs: socialCarry.contextRefs,
        correlationId: `autonomy:${date}:${socialCarry.action}:${socialCarry.contextRefs[0] ?? "room"}`,
      });
      const tick = await this.recordAutonomyTick({
        action: socialCarry.action,
        status: "posted",
        reason: socialCarry.reason,
        date,
        timezone,
        messageEventId: posted.turn.triggeringMessageEventId,
        targetRefs: socialCarry.targetRefs,
        contextRefs: socialCarry.contextRefs,
        evidenceRefs: uniqueRefs([...socialCarry.evidenceRefs, posted.turn.triggeringMessageEventId]),
        choiceSet,
        occurredAt: now,
      });
      return {
        ...(await this.getState()),
        autonomyTick: tick,
        turn: posted.turn,
      };
    }

    if (silenceReentry !== undefined && !hasNewRelevantSinceArchive && reviewRequest === undefined && socialCarry === undefined) {
      const rewake = await this.scheduleAutonomousWakeFromExistingMessage({
        messageEventId: silenceReentry.triggeringMessageEventId,
        topicId: silenceReentry.topicId,
        correlationId: `autonomy:${date}:silence_reentry:${silenceReentry.anchorEventId}`,
        wakeIdempotencyScope: silenceReentry.wakeScope,
      });
      const tick = await this.recordAutonomyTick({
        action: "silence_reentry",
        status: "posted",
        reason: silenceReentry.reason,
        date,
        timezone,
        messageEventId: rewake.turn.triggeringMessageEventId,
        anchorEventId: silenceReentry.anchorEventId,
        archiveRef: silenceReentry.archiveRef,
        targetRefs: silenceReentry.targetRefs,
        contextRefs: silenceReentry.contextRefs,
        evidenceRefs: uniqueRefs([...silenceReentry.evidenceRefs, rewake.turn.triggeringMessageEventId]),
        choiceSet,
        occurredAt: now,
      });
      return {
        ...(await this.getState()),
        autonomyTick: tick,
        turn: rewake.turn,
      };
    }

    const tick = await this.recordAutonomyTick({
      action: "stay_silent",
      status: "silent",
      reason:
        "No unarchived room-visible sediment, uncarried archive review invitation, social carry, or overdue silence re-entry was present, so the room preserved silence.",
      date,
      timezone,
      targetRefs: latestRelevant ? [latestRelevant.event_id] : [],
      contextRefs: [],
      evidenceRefs: latestRelevant ? [latestRelevant.event_id] : [],
      choiceSet,
      occurredAt: now,
    });
    return {
      ...(await this.getState()),
      autonomyTick: tick,
    };
  }

  public async applyArchiveRepair(input: {
    repairRef: string;
    reason?: string;
    archiveId?: string;
  }): Promise<RuntimeArchiveRepairApplyResult> {
    await this.ensureInitialized();
    await this.expireProtocols();
    const repairRef = stringValue(input.repairRef);
    if (!repairRef) {
      throw new Error("repairRef is required");
    }

    const events = await this.ledger.readAll();
    const existingApplication = findArchiveRepairApplication(events, repairRef);
    if (existingApplication) {
      const state = await this.getState();
      const archive = ArchiveStore.fromEvents(await this.ledger.readAll()).get(existingApplication.revisedArchiveRef);
      if (!archive) {
        throw new Error(`applied archive revision ${existingApplication.revisedArchiveRef} was not found`);
      }
      return {
        ...state,
        archive,
        appliedRepairRef: repairRef,
        revisionOf: existingApplication.archiveRef,
        acceptedResponseRefs: existingApplication.acceptedResponseRefs,
      };
    }

    const repairEvent = findArchiveRepairProposal(events, repairRef);
    if (!repairEvent) {
      throw new Error(`archive repair ${repairRef} was not found`);
    }
    const repairPayload = objectPayload(repairEvent.payload);
    const archiveRef = stringValue(repairPayload.archiveRef) ?? stringValue(repairPayload.archive_ref);
    if (!archiveRef) {
      throw new Error(`archive repair ${repairRef} does not name an archive`);
    }
    const acceptedResponses = archiveRepairAcceptedResponses(events, repairRef);
    if (acceptedResponses.length === 0) {
      throw new Error(`archive repair ${repairRef} has no accepted room response`);
    }

    const archiveStore = ArchiveStore.fromEvents([...events]);
    const sourceArchive = archiveStore.get(archiveRef);
    if (!sourceArchive) {
      throw new Error(`source archive ${archiveRef} was not found`);
    }

    const acceptedResponseRefs = acceptedResponses.map((event) => event.event_id);
    const proposedRepair = stringValue(repairPayload.proposedRepair) ?? stringValue(repairPayload.proposed_repair) ?? "";
    const revisionReason =
      stringValue(input.reason) ??
      stringValue(repairPayload.reason) ??
      "A room-visible repair proposal was accepted and explicitly applied.";
    const revisionId = archiveRevisionId(input.archiveId, sourceArchive.archiveId, archiveStore.view().archives);
    const provenanceRefs = uniqueRefs([sourceArchive.archiveId, repairRef, repairEvent.event_id, ...acceptedResponseRefs]);
    const appliedAt = new Date().toISOString();
    const applicationPayload = {
      applicationId: `archive_repair_apply_${repairRef}`,
      repairRef,
      archiveRef: sourceArchive.archiveId,
      revisedArchiveRef: revisionId,
      appliedBy: "http_runtime_archive_worker",
      reason: revisionReason,
      proposedRepair,
      acceptedResponseRefs,
      contextRefs: provenanceRefs,
      status: "applied",
      boundaryNote: "explicit room action creates a new archive revision; the original archive remains unchanged",
    };
    const application = await this.ledger.append({
      roomId: this.roomId,
      eventType: "archive.repair_applied",
      actor: { kind: "system", id: "archive_worker" },
      payload: applicationPayload,
      refs: provenanceRefs,
      correlationId: `archive_repair_apply:${repairRef}`,
      idempotencyKey: `archive_repair_apply:${this.roomId}:${repairRef}`,
    });
    if (application.status !== "appended" && application.status !== "duplicate") {
      throw new Error(`Ledger rejected archive.repair_applied: ${"reason" in application ? application.reason : application.status}`);
    }
    const applicationEvent = application.event;
    const revisedArchive: DailyArchive = {
      ...sourceArchive,
      archiveId: revisionId,
      revisionOf: sourceArchive.archiveId,
      appliedRepairRef: repairRef,
      revisionReason,
      provenanceRefs: uniqueRefs([...provenanceRefs, applicationEvent.event_id]),
      summary: archiveRevisionSummary(sourceArchive.summary, repairRef, proposedRepair),
      decisions: sourceArchive.decisions.concat({
        summary: `Applied archive repair ${repairRef}: ${proposedRepair || revisionReason}`,
        sourceRefs: uniqueRefs([...provenanceRefs, applicationEvent.event_id]),
        eventIds: uniqueRefs([repairEvent.event_id, ...acceptedResponseRefs, applicationEvent.event_id]),
        actorId: "archive_worker",
      }),
      outputRefs: {
        ...sourceArchive.outputRefs,
        revisionOf: sourceArchive.archiveId,
        appliedRepairRef: repairRef,
        archiveRepairAppliedEvent: applicationEvent.event_id,
      },
      createdBy: "archive_repair_apply",
      createdAt: appliedAt,
    };

    const archiveAppend = await this.ledger.append({
      roomId: this.roomId,
      eventType: "daily_archive.created",
      actor: { kind: "system", id: "archive_worker" },
      payload: {
        archive: revisedArchive,
        archiveId: revisedArchive.archiveId,
        date: revisedArchive.date,
        timezone: revisedArchive.timezone,
        revisionOf: revisedArchive.revisionOf,
        appliedRepairRef: revisedArchive.appliedRepairRef,
        provenanceRefs: revisedArchive.provenanceRefs,
        topicIds: revisedArchive.topicIds,
        summary: revisedArchive.summary,
        boundaryNote: "archive revision records an explicit accepted repair; it does not mutate the original archive",
      },
      refs: uniqueRefs([...(revisedArchive.provenanceRefs ?? []), ...revisedArchive.topicIds]),
      causationId: applicationEvent.event_id,
      correlationId: `archive_revision:${repairRef}:${revisionId}`,
      idempotencyKey: `archive_revision:${this.roomId}:${repairRef}:${revisionId}`,
    });
    if (archiveAppend.status !== "appended" && archiveAppend.status !== "duplicate") {
      throw new Error(`Ledger rejected daily_archive.created revision: ${"reason" in archiveAppend ? archiveAppend.reason : archiveAppend.status}`);
    }

    return {
      ...(await this.getState()),
      archive: revisedArchive,
      appliedRepairRef: repairRef,
      revisionOf: sourceArchive.archiveId,
      acceptedResponseRefs,
    };
  }

  public async approveSideEffectPermission(input: {
    requestRef: string;
    reason?: string;
    decidedBy?: string;
    expiresAt?: string;
  }): Promise<RuntimeSideEffectApproveResult> {
    await this.ensureInitialized();
    await this.expireProtocols();
    const requestRef = stringValue(input.requestRef);
    if (!requestRef) {
      throw new Error("requestRef is required");
    }

    const events = await this.ledger.readAll();
    const sideEffect = projectSideEffects(events).find((item) => sideEffectMatchesRef(item, requestRef));
    if (!sideEffect) {
      throw new Error(`side-effect ${requestRef} was not found`);
    }
    if (sideEffect.status !== "requested") {
      throw new Error(`side-effect ${requestRef} is ${sideEffect.status}, not requested`);
    }
    if (!sideEffect.kind) {
      throw new Error(`side-effect ${requestRef} does not name an executable kind`);
    }
    const approvalId = sideEffect.approvalId ?? sideEffect.requestId;
    const approvedBy = stringValue(input.decidedBy) ?? "settings_surface";
    const decidedAt = new Date().toISOString();
    const expiresAt = stringValue(input.expiresAt) ?? new Date(Date.now() + 5 * 60_000).toISOString();
    if (Number.isNaN(Date.parse(expiresAt))) {
      throw new Error("expiresAt must be an ISO timestamp");
    }
    const reason =
      stringValue(input.reason) ??
      "Side-effect permission was explicitly approved from the settings surface.";
    const contextRefs = uniqueRefs([sideEffect.requestId, approvalId, ...sideEffect.contextRefs]);
    const append = await this.ledger.append({
      roomId: this.roomId,
      eventType: "side_effect.approved",
      actor: { kind: "user", id: approvedBy },
      payload: {
        requestId: sideEffect.requestId,
        approvalId,
        approvedBy,
        reason,
        scope: {
          kinds: [sideEffect.kind],
          targets: [sideEffect.target],
          allowedAgents: sideEffect.requestedBy ? [sideEffect.requestedBy] : [],
          expiresAt,
        },
        decidedAt,
        contextRefs,
        status: "approved",
        boundaryNote:
          "side-effect approval is scoped permission only; it does not execute the action or report a result",
      },
      refs: contextRefs,
      correlationId: `side_effect_approve:${sideEffect.requestId}`,
      idempotencyKey: `side_effect_approve:${this.roomId}:${sideEffect.requestId}:${approvalId}`,
    });
    if (append.status !== "appended" && append.status !== "duplicate") {
      throw new Error(`Ledger rejected side_effect.approved: ${"reason" in append ? append.reason : append.status}`);
    }

    return {
      ...(await this.getState()),
      approvedSideEffectRef: sideEffect.requestId,
      approvedApprovalId: approvalId,
    };
  }

  public async executeApprovedSideEffect(input: {
    requestRef: string;
    content?: string;
    cwd?: string;
  }): Promise<RuntimeSideEffectExecuteResult> {
    await this.ensureInitialized();
    await this.expireProtocols();
    const requestRef = stringValue(input.requestRef);
    if (!requestRef) {
      throw new Error("requestRef is required");
    }

    const events = await this.ledger.readAll();
    const sideEffect = projectSideEffects(events).find((item) => sideEffectMatchesRef(item, requestRef));
    if (!sideEffect) {
      throw new Error(`side-effect ${requestRef} was not found`);
    }
    if (sideEffect.status !== "approved") {
      throw new Error(`side-effect ${requestRef} is ${sideEffect.status}, not approved`);
    }
    const approvalEvent = latestSideEffectApprovalEvent(events, sideEffect);
    const approvalPayload = objectPayload(approvalEvent?.payload);
    const scope = objectPayload(approvalPayload.scope);
    const expiresAt = stringValue(scope.expiresAt);
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      throw new Error(`side-effect ${requestRef} approval expired at ${expiresAt}`);
    }
    if (!scopeAllowsSideEffect(scope, sideEffect)) {
      throw new Error(`side-effect ${requestRef} is outside its approval scope`);
    }

    const executedAt = new Date().toISOString();
    const approvalId = sideEffect.approvalId ?? sideEffect.requestId;
    const execution = await executeSimpleApprovedSideEffect(sideEffect, {
      content: input.content,
      cwd: input.cwd,
    });
    const contextRefs = uniqueRefs([sideEffect.requestId, approvalId, ...sideEffect.contextRefs]);
    const append = await this.ledger.append({
      roomId: this.roomId,
      eventType: "side_effect.result_reported",
      actor: { kind: "system", id: "side_effect_executor" },
      payload: {
        requestId: sideEffect.requestId,
        approvalId,
        resultId: `side_effect_result_${sideEffect.requestId}`,
        agentId: sideEffect.requestedBy,
        actionKind: sideEffect.kind,
        target: sideEffect.target,
        status: execution.status,
        summary: execution.summary,
        artifactRefs: execution.artifactRefs,
        claimRefs: [],
        followUpProposalRefs: [],
        contextRefs,
        completedAt: executedAt,
        boundaryNote:
          "side-effect result is execution evidence only; it does not create memory truth or silently mutate room consensus",
      },
      refs: uniqueRefs([sideEffect.requestId, approvalId, ...execution.artifactRefs, ...contextRefs]),
      correlationId: `side_effect_execute:${sideEffect.requestId}`,
      idempotencyKey: `side_effect_execute:${this.roomId}:${sideEffect.requestId}:${approvalId}`,
      occurredAt: executedAt,
    });
    if (append.status !== "appended" && append.status !== "duplicate") {
      throw new Error(`Ledger rejected side_effect.result_reported: ${"reason" in append ? append.reason : append.status}`);
    }

    return {
      ...(await this.getState()),
      executedSideEffectRef: sideEffect.requestId,
      resultRef: append.event.event_id,
    };
  }

  public async expireSideEffectPermission(input: {
    requestRef: string;
    reason?: string;
  }): Promise<RuntimeSideEffectExpireResult> {
    await this.ensureInitialized();
    await this.expireProtocols();
    const requestRef = stringValue(input.requestRef);
    if (!requestRef) {
      throw new Error("requestRef is required");
    }

    const events = await this.ledger.readAll();
    const sideEffect = projectSideEffects(events).find((item) => sideEffectMatchesRef(item, requestRef));
    if (!sideEffect) {
      throw new Error(`side-effect ${requestRef} was not found`);
    }
    if (sideEffect.status !== "approved") {
      throw new Error(`side-effect ${requestRef} is ${sideEffect.status}, not approved`);
    }

    const requestId = sideEffect.requestId;
    const approvalId = sideEffect.approvalId ?? requestId;
    const reason =
      stringValue(input.reason) ??
      "Unused approved side-effect permission was explicitly expired from the settings surface.";
    const contextRefs = uniqueRefs([requestId, approvalId, ...sideEffect.contextRefs]);
    const expiredAt = new Date().toISOString();
    const append = await this.ledger.append({
      roomId: this.roomId,
      eventType: "side_effect.expired",
      actor: { kind: "user", id: "settings_surface" },
      payload: {
        requestId,
        approvalId,
        expiredBy: "settings_surface",
        reason,
        expiredAt,
        contextRefs,
        status: "expired",
        boundaryNote:
          "side-effect expiry retires unused permission only; it does not execute diagnostics, report a result, or change memory/provider truth",
      },
      refs: contextRefs,
      correlationId: `side_effect_expire:${requestId}`,
      idempotencyKey: `side_effect_expire:${this.roomId}:${requestId}:${approvalId}`,
    });
    if (append.status !== "appended" && append.status !== "duplicate") {
      throw new Error(`Ledger rejected side_effect.expired: ${"reason" in append ? append.reason : append.status}`);
    }

    return {
      ...(await this.getState()),
      expiredSideEffectRef: requestId,
      expiredApprovalId: approvalId,
    };
  }

  private async ensureInitialized(): Promise<void> {
    this.initialized ??= this.initialize();
    await this.initialized;
  }

  private async initialize(): Promise<void> {
    await this.ledger.append({
      roomId: this.roomId,
      eventType: "room.created",
      actor: { kind: "system", id: "http_runtime" },
      payload: { roomId: this.roomId, surface: "http_runtime" },
      correlationId: "bootstrap",
      idempotencyKey: `room:${this.roomId}:created`,
    });
    await this.ledger.append({
      roomId: this.roomId,
      eventType: "message.created",
      actor: { kind: "system", id: "room_kernel" },
      payload: {
        messageId: "msg_http_runtime_ready",
        author: "room_kernel",
        authorKind: "system",
        mentions: [],
        contextRefs: [],
        content: "内部 room runtime 已连接。发送消息会写入内部房间记录，并触发 wake policy 与 agent intention。",
      } satisfies MessageCreatedPayload,
      correlationId: "bootstrap",
      idempotencyKey: `message:${this.roomId}:local-runtime-ready`,
    });
    for (const agent of seedAgents) {
      await this.ledger.append({
        roomId: this.roomId,
        eventType: "workspace.provisioned",
        actor: { kind: "system", id: "workspace_service" },
        payload: workspaceProvisionedPayload({
          agentId: agent.agentId,
          privateHome: agent.workspace.privateHome,
          scratchPath: agent.workspace.scratchPath,
        }),
        correlationId: "bootstrap",
        idempotencyKey: `workspace:${this.roomId}:${agent.agentId}:provisioned`,
      });
      for (const capsule of agent.skillCapsules) {
        await this.ledger.append({
          roomId: this.roomId,
          eventType: "skill.capsule_registered",
          actor: { kind: "system", id: "skill_registry" },
          payload: skillCapsuleRegisteredPayload({
            capsuleId: capsule.capsuleId,
            agentId: agent.agentId,
            label: capsule.label,
            triggerHints: capsule.triggerHints,
            sideEffectKinds: capsule.sideEffectKinds,
          }),
          correlationId: "bootstrap",
          idempotencyKey: `skill:${this.roomId}:${agent.agentId}:${capsule.capsuleId}:registered`,
        });
      }
    }
  }

  private async expireProtocols(now: string = new Date().toISOString()): Promise<void> {
    const protocols = protocolsDueForExpiry(await this.ledger.readAll(), this.roomId, now);
    for (const protocol of protocols) {
      await this.ledger.append({
        roomId: this.roomId,
        eventType: "protocol.expired",
        actor: { kind: "system", id: "protocol_expiry_worker" },
        payload: {
          protocolId: protocol.protocolId,
          protocolRef: protocol.protocolId,
          topicId: protocol.topicId,
          status: "expired",
          expiredAt: protocol.expiresAt,
          reason: "The protocol reached its expiry boundary and leaves effective context; ledger history is preserved.",
        },
        refs: [protocol.protocolId],
        correlationId: `protocol_expiry:${protocol.protocolId}`,
        idempotencyKey: `protocol:${this.roomId}:${protocol.protocolId}:expired`,
      });
    }
  }

  private async getSmokeReport(): Promise<AgentSmokeReport> {
    if (this.smokeReport !== null) {
      return this.smokeReport;
    }
    this.smokeReport = await this.smoke();
    return this.smokeReport;
  }

  private async buildRuntimeContextPacket(
    input: AgentContextPacketFactoryInput,
  ): Promise<AgentContextPacket> {
    const events = await this.ledger.readAll();
    const topicWindows = TopicWindowStore.fromEvents(events);
    try {
      const contextPacket = new ContextPacketBuilder(topicWindows).build({
        roomId: input.roomId,
        topicId: input.topicId,
        purpose: "wake",
        triggerRef: input.triggeringMessageId,
        recipientAgent: input.agentId,
        maxTokens: input.maxContextTokens,
        maxRefs: 24,
        relevantRefs: uniqueRefs(
          contextRelevantRefs(events, input.triggeringEventId)
            .concat(input.fallbackPacket.invitationId)
            .concat(input.fallbackPacket.turnBoundary?.invitationContextRefs ?? []),
        ),
        ambientArchiveRefs: recentDailyArchiveRefs(events, 2),
        packetId: input.fallbackPacket.packetId,
      });
      const personaFragment = personaContinuityFragment(events, input.agentId, contextPacket.packetId);
      const augmented = auditWithPersonaContinuity(contextPacket.audit, personaFragment, input.maxContextTokens);
      this.recordContextAudit(augmented.audit);
      return {
        ...input.fallbackPacket,
        packetId: contextPacket.packetId,
        messageRefs: uniqueRefs(
          contextPacket.refs.trigger
            .concat(contextPacket.refs.recentWindow)
            .concat(contextPacket.refs.anchors)
            .concat(contextPacket.refs.openQuestions)
            .concat(contextPacket.refs.personas)
            .concat(contextPacket.refs.turnRecovery)
            .concat(contextPacket.refs.silences)
            .concat(contextPacket.refs.pressureBoundaries)
            .concat(contextPacket.refs.memoryPressure)
            .concat(contextPacket.refs.providerBoundaries)
            .concat(contextPacket.refs.mixedReviewPressures),
        ),
        proposalRefs: uniqueRefs(
          contextPacket.refs.topics
            .concat(contextPacket.refs.archives)
            .concat(contextPacket.refs.handoffs)
            .concat(contextPacket.refs.invitations),
        ),
        memoryRefs: uniqueRefs(contextPacket.refs.memory),
        protocolRefs: uniqueRefs(contextPacket.refs.protocols),
        actionRefs: uniqueRefs(
          contextPacket.refs.sideEffects
            .concat(contextPacket.refs.workspaceArtifacts)
            .concat(contextPacket.refs.skills),
        ),
        requestedPosture:
          contextPacket.omitted.length > 0 || augmented.personaOmitted
            ? `Use bounded context; omitted ${contextPacket.omitted
                .map((item) => `${item.count} ${item.refType}:${item.reason}`)
                .concat(augmented.personaOmitted ? ["1 persona_projection:context_budget"] : [])
                .join(", ")}.`
            : input.fallbackPacket.requestedPosture,
        contextFragments: augmented.personaIncluded ? contextPacket.fragments.concat(personaFragment) : contextPacket.fragments,
        contextAudit: augmented.audit,
      };
    } catch {
      return input.fallbackPacket;
    }
  }

  private async scheduleBackgroundTurn(accepted: RoomLoopAcceptedMessage): Promise<"started" | "delayed"> {
    if (this.backgroundTurns.size >= this.maxConcurrentBackgroundTurns) {
      this.pendingBackgroundTurns.push(accepted);
      await this.recordPressureBoundary(accepted);
      return "delayed";
    }
    this.startBackgroundTurn(accepted);
    return "started";
  }

  private async scheduleAutonomousBackgroundTurn(accepted: RoomLoopAcceptedMessage): Promise<"started" | "delayed"> {
    if (this.autonomousBackgroundTurns.size >= this.maxConcurrentBackgroundTurns) {
      this.pendingAutonomousBackgroundTurns.push(accepted);
      return "delayed";
    }
    this.startAutonomousBackgroundTurn(accepted);
    return "started";
  }

  private async postAutonomousRoomMessage(input: {
    content: string;
    clientMessageId: string;
    contextRefs: string[];
    correlationId: string;
  }): Promise<RuntimeTurnResult> {
    const accepted = await this.loop.acceptMessage({
      roomId: this.roomId,
      author: "room_rhythm",
      authorKind: "system",
      content: input.content,
      clientMessageId: input.clientMessageId,
      mentions: [],
      contextRefs: sanitizeRefs(input.contextRefs),
      correlationId: input.correlationId,
    });
    accepted.maxAwakenedAgents = this.maxAutonomousAwakenedAgents;
    accepted.maxSpeakers = this.maxAutonomousSpeakers;
    const invitedAgents = await this.loop.previewWakeCandidateIds(accepted);
    const scheduled = await this.scheduleAutonomousBackgroundTurn(accepted);
    return {
      ...(await this.getState()),
      turn: {
        status: scheduled === "delayed" ? "pressure_queued" : "queued",
        correlationId: accepted.correlationId,
        topicId: accepted.topicId,
        invitedAgents,
        secondaryInvitedAgents: [],
        intentionKinds: [],
        visibleMessageEventIds: [],
        triggeringMessageEventId: accepted.triggeringMessageEventId,
      },
    };
  }

  private async scheduleAutonomousWakeFromExistingMessage(input: {
    messageEventId: string;
    topicId: string;
    correlationId: string;
    wakeIdempotencyScope: string;
  }): Promise<RuntimeTurnResult> {
    const events = await this.ledger.readAll();
    const messageEvent = events.find(
      (event): event is RoomEvent<MessageCreatedPayload> =>
        event.event_id === input.messageEventId && event.event_type === "message.created",
    );
    if (!messageEvent) {
      throw new Error(`autonomous wake source message ${input.messageEventId} was not found`);
    }
    const messagePayload = messageEvent.payload;
    const triggeringMessageId = stringValue(messagePayload.messageId) ?? stringValue(objectPayload(messagePayload).message_id);
    if (!triggeringMessageId) {
      throw new Error(`autonomous wake source message ${input.messageEventId} does not have a messageId`);
    }
    const topicEvent = latestTopicEventForMessage(events, messageEvent.event_id, input.topicId);
    if (!topicEvent) {
      throw new Error(`autonomous wake topic event for ${input.messageEventId} was not found`);
    }
    const accepted: RoomLoopAcceptedMessage = {
      correlationId: input.correlationId,
      triggeringMessageEventId: messageEvent.event_id,
      triggeringMessageId,
      topicId: input.topicId,
      topicEventId: topicEvent.event_id,
      messageEvent,
      topicEvent,
      wakeIdempotencyScope: input.wakeIdempotencyScope,
      maxAwakenedAgents: this.maxAutonomousAwakenedAgents,
      maxSpeakers: this.maxAutonomousSpeakers,
    };
    const invitedAgents = await this.loop.previewWakeCandidateIds(accepted);
    const scheduled = await this.scheduleAutonomousBackgroundTurn(accepted);
    return {
      ...(await this.getState()),
      turn: {
        status: scheduled === "delayed" ? "pressure_queued" : "queued",
        correlationId: accepted.correlationId,
        topicId: accepted.topicId,
        invitedAgents,
        secondaryInvitedAgents: [],
        intentionKinds: [],
        visibleMessageEventIds: [],
        triggeringMessageEventId: accepted.triggeringMessageEventId,
      },
    };
  }

  private async recordAutonomyTick(input: {
    tickId?: string;
    idempotencyScope?: string;
    action: RuntimeAutonomyTickSummary["action"];
    status: RuntimeAutonomyTickSummary["status"];
    reason: string;
    date: string;
    timezone: string;
    messageEventId?: string;
    anchorEventId?: string;
    archiveRef?: string;
    reviewRequestRef?: string;
    targetRefs: string[];
    contextRefs: string[];
    evidenceRefs: string[];
    choiceSet: RuntimeAutonomyChoiceOption[];
    occurredAt: string;
  }): Promise<RuntimeAutonomyTickSummary> {
    const targetRefs = uniqueRefs(input.targetRefs);
    const contextRefs = uniqueRefs(input.contextRefs);
    const evidenceRefs = uniqueRefs(input.evidenceRefs);
    const choiceSet = normalizeAutonomyChoiceSet(input.choiceSet);
    const choiceSetRefs = autonomyChoiceSetRefs(choiceSet);
    const tickTimeScope = input.occurredAt.replace(/[^0-9]/g, "");
    const tickId = input.tickId ?? `autonomy_tick_${input.date.replace(/[^0-9]/g, "")}_${input.action}_${tickTimeScope}`;
    const idempotencyScope =
      input.idempotencyScope ?? `${tickTimeScope}:${input.messageEventId ?? input.archiveRef ?? "silence"}:${evidenceRefs.join(",")}`;
    const append = await this.ledger.append({
      roomId: this.roomId,
      eventType: "room.autonomy_tick",
      actor: { kind: "system", id: "room_rhythm" },
      payload: {
        tickId,
        action: input.action,
        status: input.status,
        reason: input.reason,
        date: input.date,
        timezone: input.timezone,
        messageEventId: input.messageEventId,
        anchorEventId: input.anchorEventId,
        archiveRef: input.archiveRef,
        reviewRequestRef: input.reviewRequestRef,
        targetRefs,
        contextRefs,
        evidenceRefs,
        choiceSet,
        boundaryNote:
          "autonomous rhythm is evidence-driven room etiquette; it may invite review or preserve silence, but it does not force speech, assign work, or make memory true",
      },
      refs: uniqueRefs([
        input.messageEventId,
        input.anchorEventId,
        input.archiveRef,
        input.reviewRequestRef,
        ...targetRefs,
        ...contextRefs,
        ...evidenceRefs,
        ...choiceSetRefs,
      ]),
      causationId: input.messageEventId,
      correlationId: `autonomy_tick:${input.date}:${input.action}:${input.messageEventId ?? input.archiveRef ?? "silence"}`,
      idempotencyKey: `autonomy_tick:${this.roomId}:${input.date}:${input.action}:${idempotencyScope}`,
      occurredAt: input.occurredAt,
    });
    if (append.status !== "appended" && append.status !== "duplicate") {
      throw new Error(`Ledger rejected room.autonomy_tick: ${"reason" in append ? append.reason : append.status}`);
    }
    return autonomyTickSummaryFromEvent(append.event);
  }

  private startBackgroundTurn(accepted: RoomLoopAcceptedMessage): void {
    const task = this.loop
      .completeAcceptedMessage(accepted)
      .then(() => undefined)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`species background turn failed for ${accepted.triggeringMessageEventId}: ${message}`);
      })
      .finally(() => {
        this.backgroundTurns.delete(task);
        this.drainBackgroundTurns();
      });
    this.backgroundTurns.add(task);
  }

  private startAutonomousBackgroundTurn(accepted: RoomLoopAcceptedMessage): void {
    const task = this.loop
      .completeAcceptedMessage(accepted)
      .then(() => undefined)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`species autonomous background turn failed for ${accepted.triggeringMessageEventId}: ${message}`);
      })
      .finally(() => {
        this.autonomousBackgroundTurns.delete(task);
        this.drainAutonomousBackgroundTurns();
      });
    this.autonomousBackgroundTurns.add(task);
  }

  private drainBackgroundTurns(): void {
    while (this.backgroundTurns.size < this.maxConcurrentBackgroundTurns) {
      const next = this.pendingBackgroundTurns.shift();
      if (next === undefined) {
        return;
      }
      this.startBackgroundTurn(next);
    }
  }

  private drainAutonomousBackgroundTurns(): void {
    while (this.autonomousBackgroundTurns.size < this.maxConcurrentBackgroundTurns) {
      const next = this.pendingAutonomousBackgroundTurns.shift();
      if (next === undefined) {
        return;
      }
      this.startAutonomousBackgroundTurn(next);
    }
  }

  private async recordPressureBoundary(accepted: RoomLoopAcceptedMessage): Promise<void> {
    await this.ledger.append({
      roomId: this.roomId,
      eventType: "room.pressure_detected",
      actor: { kind: "system", id: "bandwidth_guard" },
      payload: {
        reason: "background_turn_concurrency_limit",
        messageEventId: accepted.triggeringMessageEventId,
        messageId: accepted.triggeringMessageId,
        topicId: accepted.topicId,
        activeBackgroundTurns: this.backgroundTurns.size,
        queuedBackgroundTurns: this.pendingBackgroundTurns.length,
        maxConcurrentBackgroundTurns: this.maxConcurrentBackgroundTurns,
        boundaryNote:
          "Message expression is preserved in the ledger; agent wake is delayed to keep the room inhabitable.",
      },
      refs: [accepted.triggeringMessageEventId, accepted.topicEventId],
      causationId: accepted.triggeringMessageEventId,
      correlationId: accepted.correlationId,
      idempotencyKey: `pressure:${this.roomId}:${accepted.triggeringMessageEventId}:background_turn_concurrency_limit`,
    });
  }

  private recordContextAudit(audit: ContextPacketAudit): void {
    this.lastContextAudits.push({
      packetId: audit.packetId,
      agentId: audit.agentId,
      topicId: audit.topicId,
      selectedCount: audit.selectedFragments.length,
      omittedCount: audit.omittedFragments.length,
      selectedByType: audit.selectedFragments.reduce<Record<string, number>>((counts, fragment) => {
        counts[fragment.type] = (counts[fragment.type] ?? 0) + 1;
        return counts;
      }, {}),
      totalTokenEstimate: audit.totalTokenEstimate,
      largestFragment: audit.largestFragment,
      cacheKey: audit.cacheKey,
      builtFromLedgerRange: audit.builtFromLedgerRange,
      omittedByType: audit.omittedFragments.reduce<Record<string, number>>((counts, fragment) => {
        counts[fragment.type] = (counts[fragment.type] ?? 0) + 1;
        return counts;
      }, {}),
      omittedByReason: audit.omittedFragments.reduce<Record<string, number>>((counts, fragment) => {
        counts[fragment.reason] = (counts[fragment.reason] ?? 0) + 1;
        return counts;
      }, {}),
      selectedFragments: selectContextAuditFragmentsForSummary(audit.selectedFragments).map((fragment) => ({
        id: fragment.id,
        type: fragment.type,
        visibility: fragment.visibility,
        role: fragment.role,
        sourceKind: fragment.source.kind,
        sourceEventId: fragment.source.eventId,
        ledgerCursor: fragment.source.ledgerCursor,
        refs: fragment.refs.slice(0, 6),
        tokenEstimate: fragment.tokenEstimate,
        hardCap: fragment.hardCap,
        priority: fragment.priority,
        stateKeys: contextFragmentStateKeys(fragment),
        boundarySignals: contextFragmentBoundarySignals(fragment),
      })),
      omittedFragments: audit.omittedFragments.slice(0, 12).map((fragment) => ({
        id: fragment.id,
        type: fragment.type,
        visibility: fragment.visibility,
        reason: fragment.reason,
        refs: fragment.refs.slice(0, 6),
        tokenEstimate: fragment.tokenEstimate,
        hardCap: fragment.hardCap,
        priority: fragment.priority,
      })),
      auditBoundaryNote:
        "Audit exposes fragment metadata, token estimates, and refs only; fragment bodies stay model-visible runtime context and are not copied into the UI.",
    });
    if (this.lastContextAudits.length > 24) {
      this.lastContextAudits.splice(0, this.lastContextAudits.length - 24);
    }
  }
}

function projectMessages(events: readonly RoomEvent[]): RuntimeChatMessage[] {
  const groupedSocialResponses = socialResponseMessageProjection(events);
  return events.flatMap((event) => {
    if (event.event_type === "message.created") {
      const payload = objectPayload(event.payload);
      const author = stringValue(payload.author) ?? event.actor.id;
      const authorKind = stringValue(payload.authorKind) ?? stringValue(payload.author_kind) ?? event.actor.kind;
      const displayName = displayNameFor(author, authorKind);
      const kind = authorKind === "user" ? "user" : authorKind === "system" ? "system" : "agent";
      return [
        {
          eventId: event.event_id,
          messageId: stringValue(payload.messageId) ?? stringValue(payload.message_id) ?? event.event_id,
          author,
          authorDisplayId: displayName,
          authorKind,
          displayName,
          initials: initialsFor(author),
          kind,
          date: dateLabel(event.appended_at),
          time: timeLabel(event.appended_at),
          text: stringValue(payload.content) ?? "",
          topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
          mentions: arrayOfStrings(payload.mentions),
          contextRefs: arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)),
        },
      ];
    }

    if (groupedSocialResponses.skipEventIds.has(event.event_id)) {
      const message = groupedSocialResponses.messageByEventId.get(event.event_id);
      return message ? [message] : [];
    }

    const socialText = socialEventText(event);
    if (socialText === null) {
      return [];
    }
    return [
      {
        eventId: event.event_id,
        messageId: event.event_id,
        author: event.actor.id,
        authorDisplayId: "System Note",
        authorKind: "system",
        displayName: "System Note",
        initials: "RL",
        kind: "system" as const,
        date: dateLabel(event.appended_at),
        time: timeLabel(event.appended_at),
        text: socialText,
        topicId: topicIdFromSocialEvent(event),
        mentions: mentionsFromSocialEvent(event),
        contextRefs: uniqueRefs(event.refs),
      },
    ];
  });
}

function isChatStreamMessageEvent(event: RoomEvent): boolean {
  if (event.event_type !== "message.created") {
    return false;
  }
  const payload = objectPayload(event.payload);
  const authorKind = stringValue(payload.authorKind) ?? stringValue(payload.author_kind) ?? event.actor.kind;
  return authorKind === "user" || authorKind === "agent";
}

function projectLivingTimeline(events: readonly RoomEvent[], limit = 48): RuntimeTimelineEntry[] {
  return events
    .map(livingTimelineEntryFromEvent)
    .filter((entry): entry is RuntimeTimelineEntry => Boolean(entry))
    .sort((a, b) => compareNewestFirst(a.occurredAt, b.occurredAt) || a.eventId.localeCompare(b.eventId))
    .slice(0, limit);
}

function livingTimelineEntryFromEvent(event: RoomEvent): RuntimeTimelineEntry | undefined {
  const payload = objectPayload(event.payload);
  if (event.event_type === "message.created") {
    const author = stringValue(payload.author) ?? event.actor.id;
    const authorKind = stringValue(payload.authorKind) ?? stringValue(payload.author_kind) ?? event.actor.kind;
    const messageId = stringValue(payload.messageId) ?? stringValue(payload.message_id);
    if (messageId === "msg_http_runtime_ready") {
      return undefined;
    }
    const isRoomRhythm = author === "room_rhythm";
    return timelineEntry(event, {
      category: isRoomRhythm ? "room_rhythm" : "message",
      title: isRoomRhythm ? "Room rhythm entered the conversation" : `${displayNameFor(author, authorKind)} spoke`,
      detail: stringValue(payload.content) ?? "",
      refs: timelinePayloadRefs(payload, "messageId", "message_id", "topicId", "topic_id"),
      boundaryNote: isRoomRhythm
        ? "room rhythm messages are autonomous invitations from ledger evidence, not forced speech"
        : "visible room message; context refs are evidence anchors, not truth claims",
    });
  }

  if (event.event_type === "room.autonomy_tick") {
    const tick = autonomyTickSummaryFromEvent(event);
    return timelineEntry(event, {
      category: "room_rhythm",
      title: autonomyTickTimelineTitle(tick.action),
      detail: tick.reason,
      refs: [tick.tickId, tick.archiveRef, tick.reviewRequestRef, tick.messageEventId, ...tick.contextRefs],
      boundaryNote: tick.boundaryNote,
    });
  }

  if (event.event_type === "topic.updated") {
    const question = stringValue(payload.openQuestion) ?? stringValue(payload.open_question);
    if (question) {
      return timelineEntry(event, {
        category: "social_loop",
        title: openQuestionTimelineTitle(payload),
        detail: question,
        refs: timelinePayloadRefs(
          payload,
          "openQuestionRef",
          "open_question_ref",
          "refinedFromQuestionRef",
          "refined_from_question_ref",
          "topicId",
          "topic_id",
          "sourceMessageId",
          "source_message_id",
          "sourceBoundaryId",
          "source_boundary_id",
        ),
        boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer or hidden workflow",
      });
    }
  }

  if (event.event_type === "daily_archive.created") {
    const archivePayload = objectPayload(payload.archive);
    const archiveId = stringValue(payload.archiveId) ?? stringValue(payload.archive_id) ?? stringValue(archivePayload.archiveId);
    return timelineEntry(event, {
      category: "archive",
      title: "Daily archive created",
      detail: stringValue(payload.summary) ?? stringValue(archivePayload.summary) ?? stringValue(payload.date) ?? "compressed room time",
      refs: [archiveId, ...arrayOfStrings(payload.topicIds), ...arrayOfStrings(payload.topic_ids)],
      boundaryNote: "daily archive is a compressed time skeleton, not consensus or a memory rewrite",
    });
  }

  if (event.event_type.startsWith("archive.")) {
    return timelineEntry(event, {
      category: "archive",
      title: archiveTimelineTitle(event.event_type),
      detail: timelineDetailFromPayload(payload, "summary", "reason", "proposedRepair", "proposed_repair", "assessment"),
      refs: timelinePayloadRefs(
        payload,
        "archiveRef",
        "archive_ref",
        "repairRef",
        "repair_ref",
        "repairId",
        "repair_id",
        "revisedArchiveRef",
        "revised_archive_ref",
      ),
      boundaryNote: "archive review and repair events preserve provenance; they do not mutate prior archive history",
    });
  }

  if (event.event_type === "memory.contested") {
    return timelineEntry(event, {
      category: "memory_contest",
      title: "Memory contested",
      detail: timelineDetailFromPayload(payload, "summary", "reason", "claim", "content"),
      refs: timelinePayloadRefs(payload, "memoryId", "memory_id", "memoryRef", "memory_ref", "reviewId", "review_id"),
      boundaryNote: "memory contest keeps public sediment reviewable; contested memory is not settled truth",
    });
  }

  if (event.event_type.startsWith("memory.")) {
    return timelineEntry(event, {
      category: "memory",
      title: memoryTimelineTitle(event.event_type),
      detail: timelineDetailFromPayload(payload, "summary", "reason", "claim", "content", "response"),
      refs: timelinePayloadRefs(
        payload,
        "memoryId",
        "memory_id",
        "memoryRef",
        "memory_ref",
        "reviewId",
        "review_id",
        "revisedFromMemoryRef",
        "revised_from_memory_ref",
      ),
      boundaryNote: "public memory is ledgered sediment with source refs; acceptance remains evidence-driven and contestable",
    });
  }

  if (event.event_type.startsWith("persona_delta.")) {
    const field = stringValue(objectPayload(payload.proposedChange).field) ?? stringValue(payload.field) ?? "identity";
    const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id;
    return timelineEntry(event, {
      category: "agent_continuity",
      title: personaTimelineTitle(event.event_type, field),
      detail: timelineDetailFromPayload(payload, "reason", "summary", "value", "response"),
      refs: timelinePayloadRefs(
        payload,
        "deltaId",
        "delta_id",
        "deltaRef",
        "delta_ref",
        "responseId",
        "response_id",
        "reviewId",
        "review_id",
        "revisedFromDeltaRef",
        "revised_from_delta_ref",
      ),
      boundaryNote: `${agentId} continuity is reversible room-visible evidence, not a fixed role assignment`,
    });
  }

  if (event.event_type === "agent.provider_degraded" || event.event_type === "provider_boundary.retired") {
    const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id;
    return timelineEntry(event, {
      category: "provider_boundary",
      title: event.event_type === "provider_boundary.retired" ? "Provider boundary retired from current pressure" : "Provider boundary recorded",
      detail:
        event.event_type === "provider_boundary.retired"
          ? timelineDetailFromPayload(payload, "reason", "retirementReason", "retirement_reason")
          : `${agentId} availability changed`,
      refs: timelinePayloadRefs(
        payload,
        "degradationId",
        "degradation_id",
        "boundaryId",
        "boundary_id",
        "providerBoundaryRef",
        "provider_boundary_ref",
      ),
      boundaryNote: "provider boundary is runtime availability evidence, not agent silence, personality, or responsibility",
    });
  }

  if (isSocialLoopTimelineEvent(event.event_type)) {
    return timelineEntry(event, {
      category: "social_loop",
      title: socialLoopTimelineTitle(event.event_type),
      detail: timelineDetailFromPayload(payload, "reason", "summary", "question", "response", "content"),
      refs: timelinePayloadRefs(
        payload,
        "handoffId",
        "handoff_id",
        "handoffRef",
        "handoff_ref",
        "invitationId",
        "invitation_id",
        "invitationRef",
        "invitation_ref",
        "questionId",
        "question_id",
        "questionRef",
        "question_ref",
        "openQuestionRef",
        "open_question_ref",
        "topicId",
        "topic_id",
        "proposalId",
        "proposal_id",
        "topicProposalId",
        "topic_proposal_id",
        "topicProposalRef",
        "topic_proposal_ref",
        "applicationId",
        "application_id",
        "resultingTopicId",
        "resulting_topic_id",
        "protocolId",
        "protocol_id",
        "protocolRef",
        "protocol_ref",
        "reviewId",
        "review_id",
        "responseId",
        "response_id",
        "pressureRef",
        "pressure_ref",
        "mixedReviewPressureRef",
        "mixed_review_pressure_ref",
        "sideEffectRef",
        "side_effect_ref",
        "requestId",
        "request_id",
        "artifactRef",
        "artifact_ref",
        "artifactId",
        "artifact_id",
        "capsuleRef",
        "capsule_ref",
        "capsuleId",
        "capsule_id",
        "capabilityRef",
        "capability_ref",
        "capabilityId",
        "capability_id",
      ),
      boundaryNote: "social loop events are optional room pressure; they do not force speech or assign workflow ownership",
    });
  }

  if (
    event.event_type === "room.pressure_detected" ||
    event.event_type === "room.memory_pressure_detected" ||
    event.event_type.startsWith("side_effect.")
  ) {
    return timelineEntry(event, {
      category: "boundary",
      title: boundaryTimelineTitle(event.event_type),
      detail: timelineDetailFromPayload(payload, "reason", "summary", "description", "status"),
      refs: timelinePayloadRefs(
        payload,
        "boundaryId",
        "boundary_id",
        "requestId",
        "request_id",
        "approvalId",
        "approval_id",
        "resultId",
        "result_id",
      ),
      boundaryNote: "boundary events expose room pressure and side-effect state without turning them into hidden workflow control",
    });
  }

  return undefined;
}

function timelineEntry(
  event: RoomEvent,
  input: {
    category: RuntimeTimelineCategory;
    title: string;
    detail?: string;
    refs?: readonly (string | undefined)[];
    boundaryNote: string;
  },
): RuntimeTimelineEntry {
  const payload = objectPayload(event.payload);
  const refs = uniqueRefs([...(input.refs ?? []), ...event.refs, ...timelineSourceRefs(payload)].filter(Boolean));
  return {
    eventId: event.event_id,
    eventType: event.event_type,
    category: input.category,
    occurredAt: event.occurred_at,
    date: dateLabel(event.occurred_at),
    time: timeLabel(event.occurred_at),
    actorId: event.actor.id,
    actorKind: event.actor.kind,
    title: input.title,
    detail: truncateTimelineText(input.detail ?? "", 180),
    refs,
    evidenceRefs: uniqueRefs([event.event_id, ...refs]),
    boundaryNote: input.boundaryNote,
  };
}

function timelinePayloadRefs(payload: Record<string, unknown>, ...keys: string[]): string[] {
  return uniqueRefs(keys.map((key) => stringValue(payload[key])).filter(Boolean));
}

function timelineSourceRefs(payload: Record<string, unknown>): string[] {
  return uniqueRefs(
    arrayOfStrings(payload.contextRefs)
      .concat(arrayOfStrings(payload.context_refs))
      .concat(arrayOfStrings(payload.sourceRefs))
      .concat(arrayOfStrings(payload.source_refs))
      .concat(arrayOfStrings(payload.evidenceRefs))
      .concat(arrayOfStrings(payload.evidence_refs)),
  );
}

function timelineDetailFromPayload(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = stringValue(payload[key]);
    if (value) return value;
  }
  const change = objectPayload(payload.proposedChange);
  const changeValue = change.value;
  if (typeof changeValue === "string") {
    return changeValue;
  }
  return "";
}

function truncateTimelineText(text: string, maxLength: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
}

function archiveTimelineTitle(eventType: string): string {
  if (eventType === "archive.review_requested") return "Archive review opened";
  if (eventType === "archive.reviewed") return "Archive reviewed";
  if (eventType === "archive.repair_proposed") return "Archive repair proposed";
  if (eventType === "archive.repair_responded") return "Archive repair response recorded";
  if (eventType === "archive.repair_reviewed") return "Archive repair reviewed";
  if (eventType === "archive.repair_applied") return "Archive repair applied as revision";
  return "Archive event recorded";
}

function memoryTimelineTitle(eventType: string): string {
  if (eventType === "memory.proposed") return "Memory proposed";
  if (eventType === "memory.accepted") return "Memory accepted with evidence";
  if (eventType === "memory.stale") return "Memory marked stale";
  if (eventType === "memory.retired") return "Memory retired";
  if (eventType === "memory.reviewed") return "Memory reviewed";
  return "Memory event recorded";
}

function personaTimelineTitle(eventType: string, field: string): string {
  const label = field === "dailyMood" ? "daily mood" : field === "roleClaims" ? "role claim" : field;
  if (eventType === "persona_delta.proposed") return `Identity proposal opened: ${label}`;
  if (eventType === "persona_delta.responded") return `Identity proposal response: ${label}`;
  if (eventType === "persona_delta.reviewed") return `Identity proposal reviewed: ${label}`;
  return `Identity event recorded: ${label}`;
}

function openQuestionTimelineTitle(payload: Record<string, unknown>): string {
  return stringValue(payload.refinedFromQuestionRef) ?? stringValue(payload.refined_from_question_ref)
    ? "Open question refined"
    : "Open question raised";
}

function autonomyTickTimelineTitle(action: RuntimeAutonomyTickAction): string {
  if (action === "archive_and_invite_review") return "Room rhythm archived the day and invited review";
  if (action === "review_open_archive") return "Room rhythm carried an archive review invitation";
  if (action === "memory_hygiene_review") return "Room rhythm opened memory hygiene review";
  if (action === "continuity_review") return "Room rhythm opened agent continuity review";
  if (action === "provider_boundary_review") return "Room rhythm opened provider boundary review";
  if (action === "open_question_revisit") return "Room rhythm revisited an open question";
  if (action === "invitation_review") return "Room rhythm carried an invitation review";
  if (action === "handoff_review") return "Room rhythm carried a handoff review";
  if (action === "idle_social_rhythm") return "Room rhythm opened idle social talk";
  if (action === "silence_reentry") return "Room rhythm reopened after silence";
  if (action === "stay_silent") return "Room rhythm preserved silence";
  return "Room rhythm recorded an autonomous choice";
}

function isSocialLoopTimelineEvent(eventType: string): boolean {
  return [
    "agent.invited",
    "agent.invitation_responded",
    "agent.invitation_reviewed",
    "handoff.proposed",
    "handoff.responded",
    "handoff.reviewed",
    "topic.proposed",
    "topic.responded",
    "topic.applied",
    "topic.reviewed",
    "topic.discussion_requested",
    "open_question.responded",
    "mixed_review_pressure.reviewed",
    "protocol.proposed",
    "protocol.responded",
    "protocol.reviewed",
    "protocol.retired",
    "protocol.expired",
    "side_effect.reviewed",
    "workspace.artifact_reviewed",
    "skill.capsule_reviewed",
    "capability.reviewed",
  ].includes(eventType);
}

function socialLoopTimelineTitle(eventType: string): string {
  if (eventType === "agent.invited") return "Agent invited";
  if (eventType === "agent.invitation_responded") return "Invitation response recorded";
  if (eventType === "agent.invitation_reviewed") return "Invitation reviewed";
  if (eventType === "handoff.proposed") return "Handoff proposed";
  if (eventType === "handoff.responded") return "Handoff response recorded";
  if (eventType === "handoff.reviewed") return "Handoff reviewed";
  if (eventType === "open_question.responded") return "Open question carried";
  if (eventType === "mixed_review_pressure.reviewed") return "Mixed review pressure revisited";
  if (eventType === "topic.proposed") return "Topic proposal opened";
  if (eventType === "topic.responded") return "Topic proposal response recorded";
  if (eventType === "topic.reviewed") return "Topic proposal reviewed";
  if (eventType === "topic.applied") return "Topic proposal applied";
  if (eventType === "topic.discussion_requested") return "Topic discussion requested";
  if (eventType === "protocol.proposed") return "Protocol proposed";
  if (eventType === "protocol.responded") return "Protocol response recorded";
  if (eventType === "protocol.reviewed") return "Protocol reviewed";
  if (eventType === "protocol.retired") return "Protocol retired";
  if (eventType === "protocol.expired") return "Protocol expired";
  if (eventType === "side_effect.reviewed") return "Side-effect request reviewed";
  if (eventType === "workspace.artifact_reviewed") return "Workspace artifact reviewed";
  if (eventType === "skill.capsule_reviewed") return "Skill capsule reviewed";
  if (eventType === "capability.reviewed") return "Capability hint reviewed";
  return "Social loop event recorded";
}

function boundaryTimelineTitle(eventType: string): string {
  if (eventType === "room.pressure_detected") return "Room pressure boundary recorded";
  if (eventType === "room.memory_pressure_detected") return "Memory pressure boundary recorded";
  if (eventType === "side_effect.requested") return "Side-effect request opened";
  if (eventType === "side_effect.reviewed") return "Side-effect request reviewed";
  if (eventType === "side_effect.approved") return "Side-effect permission granted";
  if (eventType === "side_effect.expired") return "Side-effect permission expired";
  if (eventType === "side_effect.result_reported") return "Side-effect result reported";
  return "Boundary event recorded";
}

type GroupedSocialResponseProjection = {
  skipEventIds: Set<string>;
  messageByEventId: Map<string, RuntimeChatMessage>;
};

type MixedSocialReviewTrace = {
  event: RoomEvent;
  subject: string;
  visibleTarget: string;
  targetRef: string;
  responderId: string;
  response: string;
  topicId?: string;
};

type SocialResponseGroupConfig = {
  eventType?: string;
  eventTypes?: readonly string[];
  groupType?: string;
  subject: string;
  visibleTarget?: string;
  targetRef(payload: Record<string, unknown>, event: RoomEvent): string | undefined;
  responderId(payload: Record<string, unknown>, event: RoomEvent): string;
  response(payload: Record<string, unknown>, event: RoomEvent): string;
  hasRevision?(payload: Record<string, unknown>): boolean;
  topicId(payload: Record<string, unknown>): string | undefined;
  boundarySummary: string;
};

const SOCIAL_RESPONSE_GROUPS: readonly SocialResponseGroupConfig[] = [
  {
    eventType: "topic.responded",
    subject: "topic proposal",
    visibleTarget: "the topic suggestion",
    targetRef: (payload, event) =>
      stringValue(payload.topicProposalRef) ??
      stringValue(payload.topic_proposal_ref) ??
      stringValue(payload.proposalId) ??
      stringValue(payload.proposal_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "responded",
    hasRevision: (payload) => Boolean(stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision)),
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "topic proposal remains soft room order, not an automatic topic operation.",
  },
  {
    eventType: "topic.reviewed",
    subject: "topic proposal",
    visibleTarget: "the topic suggestion",
    targetRef: (payload, event) =>
      stringValue(payload.topicProposalRef) ??
      stringValue(payload.topic_proposal_ref) ??
      stringValue(payload.proposalId) ??
      stringValue(payload.proposal_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "topic suggestion review is discussion pressure only; active topic and suggestion state are unchanged.",
  },
  {
    eventType: "handoff.responded",
    subject: "handoff",
    visibleTarget: "the handoff proposal",
    targetRef: (payload, event) =>
      stringValue(payload.handoffId) ??
      stringValue(payload.handoff_id) ??
      stringValue(payload.handoffRef) ??
      stringValue(payload.handoff_ref) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.byAgentId) ?? stringValue(payload.by_agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "responded",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "handoff remains a social proposal, not a forced transfer.",
  },
  {
    eventType: "agent.invitation_responded",
    subject: "invitation",
    visibleTarget: "the social knock",
    targetRef: (payload, event) =>
      stringValue(payload.invitationRef) ??
      stringValue(payload.invitation_ref) ??
      stringValue(payload.invitationId) ??
      stringValue(payload.invitation_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "responded",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "invitation response remains a social reply, not a speaking command.",
  },
  {
    eventType: "agent.invitation_reviewed",
    subject: "invitation",
    visibleTarget: "the social knock",
    targetRef: (payload, event) =>
      stringValue(payload.invitationRef) ??
      stringValue(payload.invitation_ref) ??
      stringValue(payload.invitationId) ??
      stringValue(payload.invitation_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "invitation review is discussion pressure only; it does not accept, reject, delegate, or force speech.",
  },
  {
    eventType: "protocol.responded",
    subject: "protocol",
    visibleTarget: "the temporary room etiquette",
    targetRef: (payload, event) =>
      stringValue(payload.protocolId) ??
      stringValue(payload.protocol_id) ??
      stringValue(payload.protocolRef) ??
      stringValue(payload.protocol_ref) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "responded",
    hasRevision: (payload) => Boolean(stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision)),
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "protocol remains temporary room etiquette, not a command.",
  },
  {
    eventType: "side_effect.reviewed",
    subject: "side-effect request",
    targetRef: (payload, event) =>
      stringValue(payload.sideEffectRef) ??
      stringValue(payload.side_effect_ref) ??
      stringValue(payload.requestId) ??
      stringValue(payload.request_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "side-effect review is discussion pressure only; it does not approve, deny, execute, or report a result.",
  },
  {
    eventType: "workspace.artifact_reviewed",
    subject: "workspace artifact",
    visibleTarget: "the private workspace reference",
    targetRef: (payload, event) =>
      stringValue(payload.artifactRef) ??
      stringValue(payload.artifact_ref) ??
      stringValue(payload.artifactId) ??
      stringValue(payload.artifact_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary:
      "workspace artifact review is discussion pressure only; it does not copy private contents, promote memory, execute tools, or mutate the artifact.",
  },
  {
    eventType: "skill.capsule_reviewed",
    subject: "skill capsule",
    visibleTarget: "the skill boundary",
    targetRef: (payload, event) =>
      stringValue(payload.capsuleRef) ??
      stringValue(payload.capsule_ref) ??
      stringValue(payload.capsuleId) ??
      stringValue(payload.capsule_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary:
      "skill capsule review is discussion pressure only; it does not register skills, assign roles, execute tools, bypass approvals, or mutate capability state.",
  },
  {
    eventType: "capability.reviewed",
    subject: "capability hint",
    visibleTarget: "the weak capability hint",
    targetRef: (payload, event) =>
      stringValue(payload.capabilityRef) ??
      stringValue(payload.capability_ref) ??
      stringValue(payload.capabilityId) ??
      stringValue(payload.capability_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary:
      "capability review is discussion pressure only; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech.",
  },
  {
    eventType: "persona_delta.responded",
    subject: "persona delta",
    visibleTarget: "the identity proposal",
    targetRef: (payload, event) =>
      stringValue(payload.deltaId) ??
      stringValue(payload.delta_id) ??
      stringValue(payload.deltaRef) ??
      stringValue(payload.delta_ref) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "responded",
    hasRevision: (payload) => Boolean(stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision)),
    topicId: () => undefined,
    boundarySummary: "identity evolution remains contestable and ledgered.",
  },
  {
    eventType: "persona_delta.reviewed",
    subject: "persona delta",
    visibleTarget: "the identity proposal",
    targetRef: (payload, event) =>
      stringValue(payload.deltaRef) ??
      stringValue(payload.delta_ref) ??
      stringValue(payload.deltaId) ??
      stringValue(payload.delta_id) ??
      stringValue(payload.personaDeltaRef) ??
      stringValue(payload.persona_delta_ref) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "identity proposal review is discussion pressure only; identity state is unchanged.",
  },
  {
    eventType: "archive.repair_responded",
    subject: "archive repair",
    visibleTarget: "the archive repair proposal",
    targetRef: (payload) => stringValue(payload.repairRef) ?? stringValue(payload.repair_ref),
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "responded",
    hasRevision: (payload) => Boolean(stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision)),
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "archive content is unchanged.",
  },
  {
    eventType: "archive.repair_reviewed",
    subject: "archive repair",
    visibleTarget: "the archive repair proposal",
    targetRef: (payload) => stringValue(payload.repairRef) ?? stringValue(payload.repair_ref),
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "archive repair review is discussion pressure only; archive content and repair state are unchanged.",
  },
  {
    eventType: "open_question.responded",
    subject: "open question",
    targetRef: (payload, event) =>
      stringValue(payload.questionRef) ??
      stringValue(payload.question_ref) ??
      stringValue(payload.openQuestionRef) ??
      stringValue(payload.open_question_ref) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "responded",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "open question remains unresolved social context, not closure or task assignment.",
  },
  {
    eventType: "memory.reviewed",
    subject: "memory claim",
    visibleTarget: "memory claim",
    targetRef: (payload, event) =>
      stringValue(payload.memoryRef) ??
      stringValue(payload.memory_ref) ??
      stringValue(payload.memoryId) ??
      stringValue(payload.memory_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "memory review is discussion pressure only; memory state is unchanged.",
  },
  {
    eventType: "handoff.reviewed",
    subject: "handoff",
    visibleTarget: "the handoff proposal",
    targetRef: (payload, event) =>
      stringValue(payload.handoffRef) ??
      stringValue(payload.handoff_ref) ??
      stringValue(payload.handoffId) ??
      stringValue(payload.handoff_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "handoff review is discussion pressure only; handoff state is unchanged.",
  },
  {
    eventType: "protocol.reviewed",
    subject: "protocol",
    visibleTarget: "the temporary room etiquette",
    targetRef: (payload, event) =>
      stringValue(payload.protocolRef) ??
      stringValue(payload.protocol_ref) ??
      stringValue(payload.protocolId) ??
      stringValue(payload.protocol_id) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "protocol review is discussion pressure only; protocol state is unchanged.",
  },
  {
    eventType: "mixed_review_pressure.reviewed",
    subject: "mixed review pressure",
    targetRef: (payload, event) =>
      stringValue(payload.pressureRef) ??
      stringValue(payload.pressure_ref) ??
      stringValue(payload.mixedReviewPressureRef) ??
      stringValue(payload.mixed_review_pressure_ref) ??
      event.refs[1],
    responderId: (payload, event) => stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: (payload) => stringValue(payload.response) ?? "reviewed",
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary:
      "mixed review pressure review is discussion pressure only; the underlying pressure and its source traces are unchanged.",
  },
  {
    eventTypes: ["memory.accepted", "memory.contested", "memory.stale", "memory.retired"],
    groupType: "memory.lifecycle",
    subject: "memory claim",
    visibleTarget: "memory claim",
    targetRef: (payload, event) =>
      stringValue(payload.memoryId) ??
      stringValue(payload.memory_id) ??
      stringValue(payload.memoryRef) ??
      stringValue(payload.memory_ref) ??
      event.refs[1],
    responderId: (payload, event) =>
      stringValue(payload.transitionedBy) ??
      stringValue(payload.transitioned_by) ??
      stringValue(payload.contestedBy) ??
      stringValue(payload.contested_by) ??
      event.actor.id,
    response: (payload, event) => {
      const state = stringValue(payload.state);
      if (state) return state;
      if (event.event_type === "memory.contested") return "contested";
      if (event.event_type === "memory.stale") return "stale";
      if (event.event_type === "memory.retired") return "retired";
      if (event.event_type === "memory.accepted") return "accepted";
      return "responded";
    },
    topicId: (payload) => stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    boundarySummary: "memory remains provisional room sediment, not truth.",
  },
];

const MIXED_SOCIAL_REVIEW_EVENT_TYPES = new Set([
  "topic.reviewed",
  "agent.invitation_reviewed",
  "side_effect.reviewed",
  "workspace.artifact_reviewed",
  "skill.capsule_reviewed",
  "capability.reviewed",
  "persona_delta.reviewed",
  "archive.repair_reviewed",
  "open_question.responded",
  "memory.reviewed",
  "handoff.reviewed",
  "protocol.reviewed",
]);

function socialResponseGroupConfigByType(): Map<string, SocialResponseGroupConfig> {
  const configByType = new Map<string, SocialResponseGroupConfig>();
  for (const config of SOCIAL_RESPONSE_GROUPS) {
    const eventTypes = config.eventTypes ?? (config.eventType ? [config.eventType] : []);
    for (const eventType of eventTypes) {
      configByType.set(eventType, config);
    }
  }
  return configByType;
}

function mixedSocialReviewSourceMessageId(event: RoomEvent, payload = objectPayload(event.payload)): string {
  return (
    stringValue(payload.sourceMessageId) ??
    stringValue(payload.source_message_id) ??
    stringValue(payload.sourceMessageRef) ??
    event.causation_id ??
    event.correlation_id ??
    event.event_id
  );
}

function mixedSocialReviewGroups(
  events: readonly RoomEvent[],
  configByType = socialResponseGroupConfigByType(),
): MixedSocialReviewTrace[][] {
  const groups = new Map<string, MixedSocialReviewTrace[]>();
  for (const event of events) {
    if (!MIXED_SOCIAL_REVIEW_EVENT_TYPES.has(event.event_type)) continue;
    const config = configByType.get(event.event_type);
    if (!config) continue;
    const payload = objectPayload(event.payload);
    const targetRef = config.targetRef(payload, event);
    if (!targetRef) continue;
    const sourceMessageId = mixedSocialReviewSourceMessageId(event, payload);
    const mixedKey = `mixed_social_review:${event.correlation_id ?? event.event_id}:${sourceMessageId}`;
    const current = groups.get(mixedKey) ?? [];
    current.push({
      event,
      subject: config.subject,
      visibleTarget: config.visibleTarget ?? config.subject,
      targetRef,
      responderId: config.responderId(payload, event),
      response: config.response(payload, event),
      topicId: config.topicId(payload),
    });
    groups.set(mixedKey, current);
  }
  return [...groups.values()].filter(isMixedSocialReviewGroup);
}

function socialResponseMessageProjection(events: readonly RoomEvent[]): GroupedSocialResponseProjection {
  const configByType = socialResponseGroupConfigByType();
  const groups = new Map<string, { config: SocialResponseGroupConfig; events: RoomEvent[] }>();
  for (const event of events) {
    const config = configByType.get(event.event_type);
    if (!config) continue;
    const payload = objectPayload(event.payload);
    const targetRef = config.targetRef(payload, event);
    if (!targetRef) continue;
    const correlation = event.correlation_id ?? event.event_id;
    const groupType = config.groupType ?? config.eventType ?? event.event_type;
    const key = `${groupType}:${correlation}:${targetRef}`;
    const current = groups.get(key) ?? { config, events: [] };
    current.events.push(event);
    groups.set(key, current);
  }

  const skipEventIds = new Set<string>();
  const messageByEventId = new Map<string, RuntimeChatMessage>();
  for (const traces of mixedSocialReviewGroups(events, configByType)) {
    const last = traces.at(-1)?.event;
    if (!last) continue;
    for (const trace of traces) {
      skipEventIds.add(trace.event.event_id);
    }
    messageByEventId.set(last.event_id, mixedSocialReviewSummaryMessage(traces, last));
  }
  for (const group of groups.values()) {
    if (group.events.length < 2) continue;
    if (group.events.some((event) => skipEventIds.has(event.event_id))) continue;
    const last = group.events.at(-1);
    if (!last) continue;
    for (const event of group.events) {
      skipEventIds.add(event.event_id);
    }
    messageByEventId.set(last.event_id, socialResponseSummaryMessage(group.config, group.events, last));
  }
  return { skipEventIds, messageByEventId };
}

function isMixedSocialReviewGroup(traces: readonly MixedSocialReviewTrace[]): boolean {
  if (traces.length < 2) {
    return false;
  }
  const subjects = new Set(traces.map((trace) => trace.subject));
  const targets = new Set(traces.map((trace) => `${trace.subject}:${trace.targetRef}`));
  return subjects.size >= 2 && targets.size >= 2;
}

function mixedSocialReviewSummaryMessage(traces: readonly MixedSocialReviewTrace[], last: RoomEvent): RuntimeChatMessage {
  const responderIds = uniqueRefs(traces.map((trace) => trace.responderId));
  const responseCounts = new Map<string, number>();
  for (const trace of traces) {
    responseCounts.set(trace.response, (responseCounts.get(trace.response) ?? 0) + 1);
  }
  const responseSummary = [...responseCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([response, count]) => `${response}: ${count}`)
    .join(", ");
  const touchedObjects = uniqueRefs(traces.map((trace) => trace.visibleTarget));
  const objectSummary =
    touchedObjects.length <= 6
      ? touchedObjects.join("; ")
      : `${touchedObjects.slice(0, 6).join("; ")}; and ${touchedObjects.length - 6} more`;
  const topicId = traces.find((trace) => trace.topicId)?.topicId;
  const sourceMessageId = mixedSocialReviewSourceMessageId(last);
  return {
    eventId: last.event_id,
    messageId: `social_response_group:mixed_review:${sourceMessageId}:${last.correlation_id ?? last.event_id}`,
    author: "room_ledger",
    authorDisplayId: "System Note",
    authorKind: "system",
    displayName: "System Note",
    initials: "RL",
    kind: "system",
    date: dateLabel(last.appended_at),
    time: timeLabel(last.appended_at),
    text: `Mixed social review touched ${traces.length} room objects (${objectSummary}). Responses: ${responseSummary}. Responders: ${summarizeResponders(
      responderIds,
    )}. Bandwidth summary only; individual review traces remain ledgered and no memory, protocol, handoff, invitation, persona, topic, open-question, archive-repair, side-effect, workspace, skill, capability, or provider state changes are inferred from this summary.`,
    topicId,
    mentions: responderIds,
    contextRefs: uniqueRefs(traces.flatMap((trace) => trace.event.refs)),
  };
}

function socialResponseSummaryMessage(
  config: SocialResponseGroupConfig,
  groupedEvents: RoomEvent[],
  last: RoomEvent,
): RuntimeChatMessage {
  const firstPayload = objectPayload(groupedEvents[0]?.payload);
  const targetRef = config.targetRef(firstPayload, groupedEvents[0] ?? last) ?? config.subject;
  const topicId = config.topicId(firstPayload);
  const responderIds = uniqueRefs(
    groupedEvents.map((event) => {
      const payload = objectPayload(event.payload);
      return config.responderId(payload, event);
    }),
  );
  const responseCounts = new Map<string, number>();
  let revisionCount = 0;
  for (const event of groupedEvents) {
    const payload = objectPayload(event.payload);
    const response = config.response(payload, event);
    responseCounts.set(response, (responseCounts.get(response) ?? 0) + 1);
    if (config.hasRevision?.(payload)) {
      revisionCount += 1;
    }
  }
  const responseSummary = [...responseCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([response, count]) => `${response}: ${count}`)
    .join(", ");
  const responderSummary = summarizeResponders(responderIds);
  const revisionNote =
    revisionCount > 0 ? ` ${revisionCount} proposed revision${revisionCount === 1 ? "" : "s"} remain ledgered.` : "";
  const countLabel = `${groupedEvents.length} agent${groupedEvents.length === 1 ? "" : "s"}`;
  const visibleTarget = config.visibleTarget ?? `${config.subject} ${targetRef}`;
  return {
    eventId: last.event_id,
    messageId: `social_response_group:${config.groupType ?? config.eventType ?? last.event_type}:${targetRef}:${last.correlation_id ?? last.event_id}`,
    author: "room_ledger",
    authorDisplayId: "System Note",
    authorKind: "system",
    displayName: "System Note",
    initials: "RL",
    kind: "system",
    date: dateLabel(last.appended_at),
    time: timeLabel(last.appended_at),
    text: `${countLabel} responded to ${visibleTarget} (${responseSummary}). Responders: ${responderSummary}.${revisionNote} Bandwidth summary only; individual responses remain ledgered and ${config.boundarySummary}`,
    topicId,
    mentions: responderIds,
    contextRefs: uniqueRefs(groupedEvents.flatMap((event) => event.refs)),
  };
}

function summarizeResponders(agentIds: string[], maxVisible = 5): string {
  const names = agentIds.map((agentId) => displayNameFor(agentId, "agent"));
  if (names.length <= maxVisible) {
    return names.join(", ");
  }
  return `${names.slice(0, maxVisible).join(", ")} and ${names.length - maxVisible} more`;
}

function projectTopics(events: readonly RoomEvent[]): RuntimeTopicSummary[] {
  const topics = new Map<string, RuntimeTopicSummary>();
  const messageTopicIds = projectMessageTopicIds(events);
  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "topic.created") {
      const topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? event.event_id;
      const current = topics.get(topicId) ?? emptyRuntimeTopicSummary(topicId, event.occurred_at);
      topics.set(topicId, {
        ...current,
        title: stringValue(payload.title) ?? "Untitled topic",
        status: "active",
        parentTopicId: stringValue(payload.parentTopicId) ?? stringValue(payload.parent_topic_id) ?? current.parentTopicId,
        appliedBy: stringValue(payload.appliedBy) ?? stringValue(payload.applied_by) ?? current.appliedBy,
        updatedAt: compareNewestFirst(current.updatedAt, event.occurred_at) < 0 ? current.updatedAt : event.occurred_at,
      });
      continue;
    }

    if (event.event_type === "topic.updated") {
      const topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id);
      if (!topicId) continue;
      const current = topics.get(topicId) ?? emptyRuntimeTopicSummary(topicId, event.occurred_at);
      const openQuestion = stringValue(payload.openQuestion) ?? stringValue(payload.open_question);
      topics.set(topicId, {
        ...current,
        status: topicStatusValue(payload.status) ?? current.status,
        summary: stringValue(payload.summary) ?? current.summary,
        mergedInto: stringValue(payload.mergedInto) ?? stringValue(payload.merged_into) ?? current.mergedInto,
        appliedBy: stringValue(payload.appliedBy) ?? stringValue(payload.applied_by) ?? current.appliedBy,
        openQuestions: openQuestion ? uniqueRefs([...current.openQuestions, openQuestion]) : current.openQuestions,
        updatedAt: event.occurred_at,
      });
      continue;
    }

    if (event.event_type === "message.created") {
      const messageId = stringValue(payload.messageId) ?? stringValue(payload.message_id) ?? event.event_id;
      const topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? messageTopicIds.get(messageId);
      if (!topicId) continue;
      const current = topics.get(topicId) ?? emptyRuntimeTopicSummary(topicId, event.occurred_at);
      topics.set(topicId, {
        ...current,
        messageCount: current.messageCount + 1,
        lastMessageAt: event.occurred_at,
        updatedAt: event.occurred_at,
      });

      for (const revivedTopicId of topicRefsFromMessagePayload(payload)) {
        const revived = topics.get(revivedTopicId) ?? emptyRuntimeTopicSummary(revivedTopicId, event.occurred_at);
        topics.set(revivedTopicId, {
          ...revived,
          revivalCount: revived.revivalCount + 1,
          lastRevivedAt: event.occurred_at,
          lastRevivedByMessageId: messageId,
          lastRevivedFromTopicId: topicId,
          updatedAt: event.occurred_at,
        });
      }
    }
  }
  return [...topics.values()].sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.topicId.localeCompare(b.topicId));
}

function projectActiveTopicId(events: readonly RoomEvent[]): string | undefined {
  for (const event of events.slice().reverse()) {
    const payload = objectPayload(event.payload);
    if (event.event_type !== "message.created" && event.event_type !== "topic.created" && event.event_type !== "topic.updated") {
      continue;
    }
    const topicId =
      stringValue(payload.topicId) ??
      stringValue(payload.topic_id) ??
      stringValue(payload.currentTopicId) ??
      stringValue(payload.current_topic_id);
    if (topicId) return topicId;
  }
  return undefined;
}

function projectMessageTopicIds(events: readonly RoomEvent[]): Map<string, string> {
  const messageTopicIds = new Map<string, string>();
  for (const event of events) {
    if (event.event_type !== "topic.created" && event.event_type !== "topic.updated") continue;
    const payload = objectPayload(event.payload);
    const topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id);
    const messageId =
      stringValue(payload.createdFromMessageId) ??
      stringValue(payload.created_from_message_id) ??
      stringValue(payload.messageId) ??
      stringValue(payload.message_id);
    if (topicId && messageId) {
      messageTopicIds.set(messageId, topicId);
    }
  }
  return messageTopicIds;
}

function emptyRuntimeTopicSummary(topicId: string, updatedAt: string): RuntimeTopicSummary {
  return {
    topicId,
    title: "Untitled topic",
    status: "unknown",
    openQuestions: [],
    messageCount: 0,
    revivalCount: 0,
    updatedAt,
    boundaryNote: "topic chip is a room focus marker and context ref, not a forced routing command",
  };
}

function topicRefsFromMessagePayload(payload: Record<string, unknown>): string[] {
  return uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs))).filter((ref) =>
    ref.startsWith("topic_"),
  );
}

function projectSocialState(events: readonly RoomEvent[]): RuntimeSocialState {
  return {
    memoryClaims: safeProjection(() => projectMemoryClaims(events)),
    memoryReviews: safeProjection(() => projectMemoryReviews(events)),
    protocolReviews: safeProjection(() => projectProtocolReviews(events)),
    handoffReviews: safeProjection(() => projectHandoffReviews(events)),
    invitationReviews: safeProjection(() => projectInvitationReviews(events)),
    personaDeltaReviews: safeProjection(() => projectPersonaDeltaReviews(events)),
    topicProposalReviews: safeProjection(() => projectTopicProposalReviews(events)),
    mixedReviewPressures: safeProjection(() => projectMixedReviewPressures(events)),
    mixedReviewPressureReviews: safeProjection(() => projectMixedReviewPressureReviews(events)),
    openQuestions: safeProjection(() => projectOpenQuestions(events)),
    topicProposals: safeProjection(() => projectTopicProposals(events)),
    handoffs: safeProjection(() => projectHandoffs(events)),
    invitations: safeProjection(() => projectInvitations(events)),
    silences: safeProjection(() => projectSilences(events)),
    pressureBoundaries: safeProjection(() => projectPressureBoundaries(events)),
    memoryPressureBoundaries: safeProjection(() => projectMemoryPressureBoundaries(events)),
    providerBoundaries: safeProjection(() => projectProviderBoundaries(events)),
    protocols: safeProjection(() => projectProtocols(events)),
    sideEffects: safeProjection(() => projectSideEffects(events)),
    sideEffectReviews: safeProjection(() => projectSideEffectReviews(events)),
    archives: safeProjection(() => projectArchives(events)),
    archiveReviews: safeProjection(() => projectArchiveReviews(events)),
    autonomyTicks: safeProjection(() => projectAutonomyTicks(events)),
    personas: safeProjection(() => projectPersonas(events)),
    workspaces: safeProjection(() => projectWorkspaces(events)),
    workspaceArtifactReviews: safeProjection(() => projectWorkspaceArtifactReviews(events)),
    skillCapsules: safeProjection(() => projectSkillCapsules(events)),
    skillCapsuleReviews: safeProjection(() => projectSkillCapsuleReviews(events)),
    capabilityReviews: safeProjection(() => projectCapabilityReviews(events)),
  };
}

function projectMixedReviewPressures(events: readonly RoomEvent[]): RuntimeMixedReviewPressureSummary[] {
  return mixedSocialReviewGroups(events)
    .map((traces): RuntimeMixedReviewPressureSummary | undefined => {
      const last = traces.at(-1)?.event;
      if (!last) return undefined;
      const sourceMessageId = mixedSocialReviewSourceMessageId(last);
      const touchedObjects = traces.map((trace) => ({
        kind: trace.subject,
        ref: trace.targetRef,
        response: trace.response,
        eventId: trace.event.event_id,
      }));
      const responseKindCounts: Record<string, number> = {};
      for (const trace of traces) {
        responseKindCounts[trace.response] = (responseKindCounts[trace.response] ?? 0) + 1;
      }
      return {
        pressureId: `mixed_review:${sourceMessageId}:${last.correlation_id ?? last.event_id}`,
        sourceMessageId,
        topicId: traces.find((trace) => trace.topicId)?.topicId,
        agentIds: uniqueRefs(traces.map((trace) => trace.responderId)),
        responseKindCounts,
        objectCount: touchedObjects.length,
        touchedRefs: uniqueRefs(touchedObjects.map((item) => item.ref)),
        touchedObjects,
        reviewEventIds: uniqueRefs(traces.map((trace) => trace.event.event_id)),
        updatedAt: last.occurred_at,
        boundaryNote:
          "mixed social review pressure is projection only; individual review traces remain ledgered and no lifecycle state changes are inferred",
      };
    })
    .filter((pressure): pressure is RuntimeMixedReviewPressureSummary => Boolean(pressure))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.pressureId.localeCompare(b.pressureId));
}

function projectMixedReviewPressureReviews(events: readonly RoomEvent[]): RuntimeMixedReviewPressureReviewSummary[] {
  const reviews: RuntimeMixedReviewPressureReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "mixed_review_pressure.reviewed") continue;
    const payload = objectPayload(event.payload);
    const pressureRef =
      stringValue(payload.pressureRef) ??
      stringValue(payload.pressure_ref) ??
      stringValue(payload.mixedReviewPressureRef) ??
      stringValue(payload.mixed_review_pressure_ref);
    if (!pressureRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      pressureRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "mixed review pressure review is a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectMemoryReviews(events: readonly RoomEvent[]): RuntimeMemoryReviewSummary[] {
  const reviews: RuntimeMemoryReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "memory.reviewed") continue;
    const payload = objectPayload(event.payload);
    const memoryRef =
      stringValue(payload.memoryRef) ??
      stringValue(payload.memory_ref) ??
      stringValue(payload.memoryId) ??
      stringValue(payload.memory_id);
    if (!memoryRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      memoryRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "memory review is a social trace; it does not accept, contest, stale, retire, or turn the claim into truth",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectHandoffReviews(events: readonly RoomEvent[]): RuntimeHandoffReviewSummary[] {
  const reviews: RuntimeHandoffReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "handoff.reviewed") continue;
    const payload = objectPayload(event.payload);
    const handoffRef =
      stringValue(payload.handoffRef) ??
      stringValue(payload.handoff_ref) ??
      stringValue(payload.handoffId) ??
      stringValue(payload.handoff_id);
    if (!handoffRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      handoffRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "handoff review is a social trace; it does not accept, reject, partially accept, delegate, challenge, complete, or transfer control",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectInvitationReviews(events: readonly RoomEvent[]): RuntimeInvitationReviewSummary[] {
  const reviews: RuntimeInvitationReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "agent.invitation_reviewed") continue;
    const payload = objectPayload(event.payload);
    const invitationRef =
      stringValue(payload.invitationRef) ??
      stringValue(payload.invitation_ref) ??
      stringValue(payload.invitationId) ??
      stringValue(payload.invitation_id);
    if (!invitationRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      invitationRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "invitation review is a social trace; it does not accept, reject, challenge, delegate, force speech, or create a new invitation",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectPersonaDeltaReviews(events: readonly RoomEvent[]): RuntimePersonaDeltaReviewSummary[] {
  const reviews: RuntimePersonaDeltaReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "persona_delta.reviewed") continue;
    const payload = objectPayload(event.payload);
    const deltaRef =
      stringValue(payload.deltaRef) ??
      stringValue(payload.delta_ref) ??
      stringValue(payload.deltaId) ??
      stringValue(payload.delta_id) ??
      stringValue(payload.personaDeltaRef) ??
      stringValue(payload.persona_delta_ref);
    if (!deltaRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      deltaRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "identity proposal review is a social trace; it does not accept, reject, contest, retire, revise, or mutate identity",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectProtocolReviews(events: readonly RoomEvent[]): RuntimeProtocolReviewSummary[] {
  const reviews: RuntimeProtocolReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "protocol.reviewed") continue;
    const payload = objectPayload(event.payload);
    const protocolRef =
      stringValue(payload.protocolRef) ??
      stringValue(payload.protocol_ref) ??
      stringValue(payload.protocolId) ??
      stringValue(payload.protocol_id);
    if (!protocolRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      protocolRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "protocol review is a social trace; it does not accept, reject, challenge, revise, retire, or activate etiquette",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectTopicProposalReviews(events: readonly RoomEvent[]): RuntimeTopicProposalReviewSummary[] {
  const reviews: RuntimeTopicProposalReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "topic.reviewed") continue;
    const payload = objectPayload(event.payload);
    const topicProposalRef =
      stringValue(payload.topicProposalRef) ??
      stringValue(payload.topic_proposal_ref) ??
      stringValue(payload.proposalId) ??
      stringValue(payload.proposal_id);
    if (!topicProposalRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      topicProposalRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "topic suggestion review is a social trace; it does not accept, reject, challenge, revise, apply, or move the active topic",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectOpenQuestions(events: readonly RoomEvent[]): RuntimeOpenQuestionSummary[] {
  const questions = new Map<string, RuntimeOpenQuestionSummary>();
  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "topic.updated") {
      const question = stringValue(payload.openQuestion) ?? stringValue(payload.open_question);
      if (!question) continue;
      const questionId =
        stringValue(payload.openQuestionRef) ??
        stringValue(payload.open_question_ref) ??
        event.event_id;
      const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
      const sourcePressureRefs = uniqueRefs(
        arrayOfStrings(payload.sourcePressureRefs)
          .concat(arrayOfStrings(payload.source_pressure_refs))
          .concat(contextRefs.filter((ref) => ref.startsWith("mixed_review:"))),
      );
      questions.set(questionId, {
        questionId,
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        question,
        raisedBy: stringValue(payload.raisedBy) ?? stringValue(payload.raised_by),
        refinedFromQuestionRef:
          stringValue(payload.refinedFromQuestionRef) ?? stringValue(payload.refined_from_question_ref),
        refinedBy: stringValue(payload.refinedBy) ?? stringValue(payload.refined_by),
        sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
        sourceBoundaryId: stringValue(payload.sourceBoundaryId) ?? stringValue(payload.source_boundary_id),
        sourcePressureRefs,
        contextRefs,
        sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs, ...sourcePressureRefs]),
        updatedAt: event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "open question is room-visible unresolved context, not a demand for immediate answer",
        responseCount: 0,
        responseKindCounts: {},
        contestedCount: 0,
        deferredCount: 0,
        refinedCount: 0,
        responseRefs: [],
        respondingAgentIds: [],
      });
      continue;
    }

    if (event.event_type === "open_question.responded") {
      const questionId =
        stringValue(payload.questionRef) ??
        stringValue(payload.question_ref) ??
        stringValue(payload.openQuestionRef) ??
        stringValue(payload.open_question_ref);
      if (!questionId) continue;
      const responseId = stringValue(payload.responseId) ?? stringValue(payload.response_id) ?? event.event_id;
      const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id;
      const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
      const sourcePressureRefs = contextRefs.filter((ref) => ref.startsWith("mixed_review:"));
      const current =
        questions.get(questionId) ??
        ({
          questionId,
          topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
          question: "",
          sourcePressureRefs,
          contextRefs: [],
          sourceRefs: sourcePressureRefs,
          updatedAt: event.occurred_at,
          boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer",
          responseCount: 0,
          responseKindCounts: {},
          contestedCount: 0,
          deferredCount: 0,
          refinedCount: 0,
          responseRefs: [],
          respondingAgentIds: [],
        } satisfies RuntimeOpenQuestionSummary);
      const responseKind = stringValue(payload.response) ?? "responded";
      const responseKindCounts = { ...current.responseKindCounts };
      responseKindCounts[responseKind] = (responseKindCounts[responseKind] ?? 0) + 1;
      questions.set(questionId, {
        ...current,
        topicId: current.topicId ?? stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        sourcePressureRefs: uniqueRefs(current.sourcePressureRefs.concat(sourcePressureRefs)),
        contextRefs: uniqueRefs(current.contextRefs.concat(contextRefs)),
        sourceRefs: uniqueRefs(current.sourceRefs.concat([event.event_id, ...event.refs, ...contextRefs, ...sourcePressureRefs])),
        updatedAt: event.occurred_at,
        responseCount: current.responseCount + 1,
        responseKindCounts,
        contestedCount: responseKindCounts.contested ?? 0,
        deferredCount: responseKindCounts.deferred ?? 0,
        refinedCount: responseKindCounts.refined ?? 0,
        responseRefs: uniqueRefs(current.responseRefs.concat(responseId)),
        respondingAgentIds: uniqueRefs(current.respondingAgentIds.concat(agentId)),
        lastResponse: {
          response: responseKind,
          summary: stringValue(payload.summary) ?? "",
          agentId,
          sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
          responseId,
          occurredAt: event.occurred_at,
          boundaryNote:
            stringValue(payload.boundaryNote) ??
            stringValue(payload.boundary_note) ??
            "open question response is a social trace; it does not resolve or close the question",
        },
      });
    }
  }
  return [...questions.values()].sort(
    (a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.questionId.localeCompare(b.questionId),
  );
}

function projectMemoryClaims(events: readonly RoomEvent[]): RuntimeMemoryClaimSummary[] {
  const view = MemoryClaimStore.fromEvents([...events]).view();
  return view.claims
    .map((claim) => ({
      memoryId: claim.memoryId,
      state: claim.state,
      summary: claim.summary,
      kind: claim.kind,
      proposedBy: claim.proposedBy,
      revisedFromMemoryRef: claim.revisedFromMemoryRef,
      revisedBy: claim.revisedBy,
      contestedBy: claim.contestedBy,
      sourceRefs: claim.sourceRefs,
      sourcePressureRefs: claim.sourcePressureRefs ?? claim.sourceRefs.filter(isMixedReviewPressureRef),
      lastReviewedAt: claim.lastReviewedAt,
      transitionCount: claim.transitions.length,
      provisionalNote:
        claim.state === "accepted"
          ? "accepted means provisional room sediment, not truth"
          : "room memory is provisional sediment, not truth, and remains open to challenge and repair",
    }))
    .sort((a, b) => compareNewestFirst(a.lastReviewedAt, b.lastReviewedAt) || a.memoryId.localeCompare(b.memoryId));
}

function projectTopicProposals(events: readonly RoomEvent[]): RuntimeTopicProposalSummary[] {
  const proposals = new Map<string, RuntimeTopicProposalSummary>();
  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "topic.proposed") {
      const proposalId =
        stringValue(payload.proposalId) ??
        stringValue(payload.proposal_id) ??
        stringValue(payload.topicProposalId) ??
        stringValue(payload.topic_proposal_id) ??
        event.event_id;
      const contextRefs = arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs));
      const sourcePressureRefs = uniqueRefs(
        arrayOfStrings(payload.sourcePressureRefs)
          .concat(arrayOfStrings(payload.source_pressure_refs))
          .concat(contextRefs.filter((ref) => ref.startsWith("mixed_review:"))),
      );
      proposals.set(proposalId, {
        proposalId,
        status: stringValue(payload.status) ?? "proposed",
        action: topicProposalActionValue(payload.action),
        currentTopicId: stringValue(payload.currentTopicId) ?? stringValue(payload.current_topic_id),
        targetTopicId:
          stringValue(payload.targetTopicId) ??
          stringValue(payload.target_topic_id) ??
          stringValue(payload.topicId) ??
          stringValue(payload.topic_id),
        proposedBy: stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by) ?? event.actor.id,
        revisedFromTopicProposalRef:
          stringValue(payload.revisedFromTopicProposalRef) ?? stringValue(payload.revised_from_topic_proposal_ref),
        revisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
        title: stringValue(payload.title) ?? stringValue(payload.summary) ?? "Untitled topic proposal",
        reason: stringValue(payload.reason) ?? "",
        contextRefs,
        sourcePressureRefs,
        responseCount: 0,
        updatedAt: event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "topic suggestion only; it does not switch, split, pause, revive, or merge the active topic by itself",
      });
      continue;
    }

    if (event.event_type === "topic.responded") {
      const proposalId =
        stringValue(payload.topicProposalRef) ??
        stringValue(payload.topic_proposal_ref) ??
        stringValue(payload.proposalId) ??
        stringValue(payload.proposal_id);
      if (!proposalId) continue;
      const current =
        proposals.get(proposalId) ??
        ({
          proposalId,
          status: "proposed",
          title: "Topic proposal response without original proposal in ledger window.",
          reason: "",
          contextRefs: [],
          sourcePressureRefs: [],
          responseCount: 0,
          updatedAt: event.occurred_at,
          boundaryNote: "topic proposal response remains soft room order, not an automatic topic operation",
        } satisfies RuntimeTopicProposalSummary);
      current.status = stringValue(payload.response) ?? "responded";
      current.responseCount += 1;
      current.contextRefs = uniqueRefs(
        current.contextRefs.concat(arrayOfStrings(payload.contextRefs)).concat(arrayOfStrings(payload.context_refs)),
      );
      current.sourcePressureRefs = uniqueRefs(
        current.sourcePressureRefs
          .concat(arrayOfStrings(payload.sourcePressureRefs))
          .concat(arrayOfStrings(payload.source_pressure_refs))
          .concat(current.contextRefs.filter((ref) => ref.startsWith("mixed_review:"))),
      );
      current.updatedAt = event.occurred_at;
      current.boundaryNote =
        stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note) ?? current.boundaryNote;
      proposals.set(proposalId, current);
      continue;
    }

    if (event.event_type === "topic.applied") {
      const proposalId =
        stringValue(payload.topicProposalRef) ??
        stringValue(payload.topic_proposal_ref) ??
        stringValue(payload.proposalId) ??
        stringValue(payload.proposal_id);
      if (!proposalId) continue;
      const current =
        proposals.get(proposalId) ??
        ({
          proposalId,
          status: "applied",
          action: topicProposalActionValue(payload.action),
          title: "Topic proposal application without original proposal in ledger window.",
          reason: "",
          contextRefs: [],
          sourcePressureRefs: [],
          responseCount: 0,
          updatedAt: event.occurred_at,
          boundaryNote: "topic application is room-visible topic movement, not hidden scheduler control",
        } satisfies RuntimeTopicProposalSummary);
      current.status = "applied";
      current.action = topicProposalActionValue(payload.action) ?? current.action;
      current.targetTopicId =
        stringValue(payload.targetTopicId) ?? stringValue(payload.target_topic_id) ?? current.targetTopicId;
      current.appliedBy = stringValue(payload.appliedBy) ?? stringValue(payload.applied_by) ?? event.actor.id;
      current.resultingTopicId = stringValue(payload.resultingTopicId) ?? stringValue(payload.resulting_topic_id);
      current.appliedTopicEventIds = arrayOfStrings(payload.appliedTopicEventIds).concat(
        arrayOfStrings(payload.applied_topic_event_ids),
      );
      current.contextRefs = uniqueRefs(
        current.contextRefs.concat(arrayOfStrings(payload.contextRefs)).concat(arrayOfStrings(payload.context_refs)),
      );
      current.sourcePressureRefs = uniqueRefs(
        current.sourcePressureRefs
          .concat(arrayOfStrings(payload.sourcePressureRefs))
          .concat(arrayOfStrings(payload.source_pressure_refs))
          .concat(current.contextRefs.filter((ref) => ref.startsWith("mixed_review:"))),
      );
      current.updatedAt = event.occurred_at;
      current.boundaryNote =
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "topic application is room-visible topic movement, not hidden scheduler control";
      proposals.set(proposalId, current);
    }
  }
  return [...proposals.values()].sort(
    (a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.proposalId.localeCompare(b.proposalId),
  );
}

function projectHandoffs(events: readonly RoomEvent[]): RuntimeHandoffSummary[] {
  const handoffs = new Map<string, RuntimeHandoffSummary>();

  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "handoff.proposed") {
      const handoffId = stringValue(payload.handoffId) ?? stringValue(payload.handoff_id) ?? event.event_id;
      const contextRefs = arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs));
      const sourcePressureRefs = uniqueRefs(
        arrayOfStrings(payload.sourcePressureRefs)
          .concat(arrayOfStrings(payload.source_pressure_refs))
          .concat(contextRefs.filter(isMixedReviewPressureRef)),
      );
      handoffs.set(handoffId, {
        handoffId,
        status: stringValue(payload.status) ?? "proposed",
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        fromAgentId:
          stringValue(payload.fromAgentId) ??
          stringValue(payload.from_agent_id) ??
          stringValue(payload.fromAgent) ??
          stringValue(payload.from_agent),
        toAgentId:
          stringValue(payload.toAgentId) ??
          stringValue(payload.to_agent_id) ??
          stringValue(payload.toAgent) ??
          stringValue(payload.to_agent),
        reason: stringValue(payload.reason) ?? "",
        requestedResponse: stringValue(payload.requestedResponse) ?? stringValue(payload.requested_response),
        delegatedFromHandoffRef:
          stringValue(payload.delegatedFromHandoffRef) ?? stringValue(payload.delegated_from_handoff_ref),
        delegatedBy: stringValue(payload.delegatedBy) ?? stringValue(payload.delegated_by),
        sourcePressureRefs,
        responseCount: 0,
        responses: [],
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "handoff is a social proposal, not a forced transfer",
        updatedAt: event.occurred_at,
      });
      continue;
    }

    if (event.event_type === "handoff.responded") {
      const handoffId =
        stringValue(payload.handoffId) ??
        stringValue(payload.handoff_id) ??
        stringValue(payload.handoffRef) ??
        stringValue(payload.handoff_ref) ??
        event.event_id;
      const current =
        handoffs.get(handoffId) ??
        ({
          handoffId,
          status: "responded",
          topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
          reason: "",
          sourcePressureRefs: [],
          responseCount: 0,
          responses: [],
          boundaryNote: "handoff response is visible social state, not control transfer",
          updatedAt: event.occurred_at,
        } satisfies RuntimeHandoffSummary);
      const response = stringValue(payload.response) ?? stringValue(payload.status) ?? "responded";
      current.status = stringValue(payload.status) ?? handoffStatusFromResponse(response) ?? current.status;
      current.sourcePressureRefs = uniqueRefs(
        current.sourcePressureRefs
          .concat(arrayOfStrings(payload.sourcePressureRefs))
          .concat(arrayOfStrings(payload.source_pressure_refs))
          .concat(arrayOfStrings(payload.contextRefs).filter(isMixedReviewPressureRef))
          .concat(arrayOfStrings(payload.context_refs).filter(isMixedReviewPressureRef))
          .concat(event.refs.filter(isMixedReviewPressureRef)),
      );
      current.responses.push({
        byAgentId: stringValue(payload.byAgentId) ?? stringValue(payload.by_agent_id) ?? event.actor.id,
        response,
        reason: stringValue(payload.reason),
        redirectTo: stringValue(payload.redirectTo) ?? stringValue(payload.redirect_to),
        acceptedScopeSummary: summarizePayloadObject(
          firstPayloadObject(payload.acceptedScope, payload.accepted_scope),
          360,
        ),
        sourceRefs: uniqueRefs(event.refs.concat(arrayOfStrings(payload.contextRefs)).concat(arrayOfStrings(payload.context_refs))),
        eventId: event.event_id,
        updatedAt: event.occurred_at,
      });
      current.responseCount = current.responses.length;
      current.updatedAt = event.occurred_at;
      handoffs.set(handoffId, current);
    }
  }

  return [...handoffs.values()].sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.handoffId.localeCompare(b.handoffId));
}

function projectInvitations(events: readonly RoomEvent[]): RuntimeInvitationSummary[] {
  const invitations = new Map<string, RuntimeInvitationSummary>();
  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "agent.invited") {
      if (stringValue(payload.invitedBy) !== "agent_intention") {
        continue;
      }
      const invitationId = stringValue(payload.invitationId) ?? stringValue(payload.invitation_id) ?? event.event_id;
      const contextRefs = arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs));
      const sourcePressureRefs = uniqueRefs(
        arrayOfStrings(payload.sourcePressureRefs)
          .concat(arrayOfStrings(payload.source_pressure_refs))
          .concat(contextRefs.filter(isMixedReviewPressureRef)),
      );
      invitations.set(invitationId, {
        invitationId,
        status: stringValue(payload.status) ?? "invited",
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        fromAgentId: event.actor.id,
        toAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
        delegatedFromInvitationRef:
          stringValue(payload.delegatedFromInvitationRef) ?? stringValue(payload.delegated_from_invitation_ref),
        delegatedBy: stringValue(payload.delegatedBy) ?? stringValue(payload.delegated_by),
        reason: stringValue(payload.reason) ?? "",
        contextRefs,
        sourcePressureRefs,
        responseCount: 0,
        responses: [],
        updatedAt: event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "invitation is a social knock, not a speaking command",
      });
      continue;
    }

    if (event.event_type !== "agent.invitation_responded") {
      continue;
    }
    const invitationId =
      stringValue(payload.invitationRef) ??
      stringValue(payload.invitation_ref) ??
      stringValue(payload.invitationId) ??
      stringValue(payload.invitation_id) ??
      event.event_id;
    const current =
      invitations.get(invitationId) ??
      ({
        invitationId,
        status: "responded",
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        reason: "",
        contextRefs: [],
        sourcePressureRefs: [],
        responseCount: 0,
        responses: [],
        updatedAt: event.occurred_at,
        boundaryNote: "invitation is a social knock, not a speaking command",
      } satisfies RuntimeInvitationSummary);
    const response = stringValue(payload.response) ?? stringValue(payload.status) ?? "responded";
    current.status = invitationStatusFromResponse(response) ?? response;
    current.topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? current.topicId;
    current.sourcePressureRefs = uniqueRefs(
      current.sourcePressureRefs
        .concat(arrayOfStrings(payload.sourcePressureRefs))
        .concat(arrayOfStrings(payload.source_pressure_refs))
        .concat(arrayOfStrings(payload.contextRefs).filter(isMixedReviewPressureRef))
        .concat(arrayOfStrings(payload.context_refs).filter(isMixedReviewPressureRef))
        .concat(event.refs.filter(isMixedReviewPressureRef)),
    );
    current.responses.push({
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response,
      reason: stringValue(payload.reason) ?? "",
      redirectTo: stringValue(payload.redirectTo) ?? stringValue(payload.redirect_to),
      contextRefs: arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)),
      eventId: event.event_id,
      updatedAt: event.occurred_at,
    });
    current.responseCount = current.responses.length;
    current.updatedAt = event.occurred_at;
    invitations.set(invitationId, current);
  }
  return [...invitations.values()].sort(
    (a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.invitationId.localeCompare(b.invitationId),
  );
}

function projectSilences(events: readonly RoomEvent[]): RuntimeSilenceSummary[] {
  const providerDegradedIntentionEvents = new Set<string>();
  for (const event of events) {
    if (event.event_type === "agent.provider_degraded") {
      event.refs.forEach((ref) => providerDegradedIntentionEvents.add(ref));
    }
  }

  return events
    .filter((event) => event.event_type === "agent.intention_recorded")
    .flatMap((event) => {
      if (providerDegradedIntentionEvents.has(event.event_id)) {
        return [];
      }
      const payload = objectPayload(event.payload);
      const intention = objectPayload(payload.intention);
      if (stringValue(intention.kind) !== "stay_silent") {
        return [];
      }
      const reason = stringValue(intention.reason) ?? "";
      if (reason.toLowerCase().startsWith("live provider degraded:")) {
        return [];
      }
      return [
        {
          silenceId: event.event_id,
          agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
          topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
          invitationId: stringValue(payload.invitationId) ?? stringValue(payload.invitation_id),
          triggeringEventId: stringValue(payload.triggeringEventId) ?? stringValue(payload.triggering_event_id),
          reason,
          updatedAt: event.occurred_at,
          boundaryNote: "deliberate silence is a valid room expression, not provider failure or agreement",
        },
      ];
    })
    .sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.silenceId.localeCompare(b.silenceId));
}

function projectPressureBoundaries(events: readonly RoomEvent[]): RuntimePressureBoundarySummary[] {
  return events
    .filter((event) => event.event_type === "room.pressure_detected")
    .map((event) => {
      const payload = objectPayload(event.payload);
      return {
        boundaryId: event.event_id,
        reason: stringValue(payload.reason) ?? "room_pressure_detected",
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        messageEventId: stringValue(payload.messageEventId) ?? stringValue(payload.message_event_id),
        messageId: stringValue(payload.messageId) ?? stringValue(payload.message_id),
        activeBackgroundTurns:
          numberValue(payload.activeBackgroundTurns) ?? numberValue(payload.active_background_turns),
        queuedBackgroundTurns:
          numberValue(payload.queuedBackgroundTurns) ?? numberValue(payload.queued_background_turns),
        maxConcurrentBackgroundTurns:
          numberValue(payload.maxConcurrentBackgroundTurns) ?? numberValue(payload.max_concurrent_background_turns),
        updatedAt: event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "room pressure boundary recorded; message expression is preserved while wake may be delayed",
        sourceRefs: uniqueRefs(event.refs.concat(arrayOfStrings(payload.contextRefs)).concat(arrayOfStrings(payload.context_refs))),
      };
    })
    .sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.boundaryId.localeCompare(b.boundaryId));
}

function projectMemoryPressureBoundaries(events: readonly RoomEvent[]): RuntimeMemoryPressureBoundarySummary[] {
  return events
    .filter((event) => event.event_type === "room.memory_pressure_detected")
    .map((event) => {
      const payload = objectPayload(event.payload);
      return {
        boundaryId: event.event_id,
        reason: stringValue(payload.reason) ?? "pending_memory_proposal_limit",
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        triggeringMemoryId: stringValue(payload.triggeringMemoryId) ?? stringValue(payload.triggering_memory_id),
        pendingProposalCount:
          numberValue(payload.pendingProposalCount) ?? numberValue(payload.pending_proposal_count) ?? 0,
        threshold: numberValue(payload.threshold) ?? 0,
        proposedMemoryRefs: arrayOfStrings(payload.proposedMemoryRefs).concat(
          arrayOfStrings(payload.proposed_memory_refs),
        ),
        updatedAt: event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "public memory pressure boundary recorded; review pending proposals before adding more sediment",
        sourceRefs: uniqueRefs(event.refs.concat(arrayOfStrings(payload.contextRefs)).concat(arrayOfStrings(payload.context_refs))),
      };
    })
    .sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.boundaryId.localeCompare(b.boundaryId));
}

function projectProviderBoundaries(events: readonly RoomEvent[]): RuntimeProviderBoundarySummary[] {
  const boundaries = new Map<string, RuntimeProviderBoundarySummary>();

  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "agent.provider_degraded") {
      const boundaryId = stringValue(payload.degradationId) ?? stringValue(payload.degradation_id) ?? event.event_id;
      boundaries.set(boundaryId, {
        boundaryId,
        status: "degraded",
        agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        triggeringEventId: stringValue(payload.triggeringEventId) ?? stringValue(payload.triggering_event_id),
        packetId: stringValue(payload.packetId) ?? stringValue(payload.packet_id),
        providerKind: stringValue(payload.providerKind) ?? stringValue(payload.provider_kind),
        providerLabel: stringValue(payload.providerLabel) ?? stringValue(payload.provider_label),
        diagnostic: stringValue(payload.diagnostic) ?? "provider degraded",
        updatedAt: event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "provider degradation is not agent silence",
        sourceRefs: uniqueRefs(event.refs.concat(arrayOfStrings(payload.contextRefs)).concat(arrayOfStrings(payload.context_refs))),
        choicePressure: emptyProviderBoundaryChoicePressure(),
      });
      continue;
    }

    if (event.event_type === "provider_boundary.retired") {
      const boundaryId =
        stringValue(payload.providerBoundaryRef) ??
        stringValue(payload.provider_boundary_ref) ??
        stringValue(payload.boundaryRef) ??
        stringValue(payload.boundary_ref);
      if (!boundaryId) {
        continue;
      }
      const existing = boundaries.get(boundaryId);
      boundaries.set(boundaryId, {
        boundaryId,
        status: "retired",
        agentId: existing?.agentId,
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? existing?.topicId,
        triggeringEventId: existing?.triggeringEventId,
        packetId: existing?.packetId,
        providerKind: existing?.providerKind,
        providerLabel: existing?.providerLabel,
        diagnostic: existing?.diagnostic ?? stringValue(payload.reason) ?? "provider boundary retired",
        retiredBy: stringValue(payload.retiredBy) ?? stringValue(payload.retired_by) ?? event.actor.id,
        retirementReason: stringValue(payload.reason),
        updatedAt: event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "provider boundary retirement removes old runtime pressure from current room context; it does not delete ledger or archive history",
        sourceRefs: uniqueRefs(
          (existing?.sourceRefs ?? []).concat(event.refs).concat(arrayOfStrings(payload.contextRefs)).concat(arrayOfStrings(payload.context_refs)),
        ),
        choicePressure: existing?.choicePressure ?? emptyProviderBoundaryChoicePressure(),
      });
    }
  }

  for (const boundary of boundaries.values()) {
    boundary.choicePressure = buildProviderBoundaryChoicePressure(events, boundary.boundaryId);
  }

  return [...boundaries.values()].sort(
    (a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.boundaryId.localeCompare(b.boundaryId),
  );
}

function emptyProviderBoundaryChoicePressure(): RuntimeProviderBoundaryChoicePressureSummary {
  return {
    repairRequestRefs: [],
    deniedRepairRequestRefs: [],
    approvedRepairRequestRefs: [],
    resultRefs: [],
    retryProtocolRefs: [],
    retiredRetryProtocolRefs: [],
    silenceRefs: [],
    contestedMemoryRefs: [],
    archiveCarryoverRefs: [],
    choiceAgentIds: [],
    hasMixedChoices: false,
    hasMultiAgentPressure: false,
    carriedAcrossArchives: false,
    boundaryNote:
      "provider boundary choice pressure is observation only; repair, retry, silence, denial, memory contest, and archive carryover remain separate social traces",
  };
}

function buildProviderBoundaryChoicePressure(
  events: readonly RoomEvent[],
  boundaryRef: string,
): RuntimeProviderBoundaryChoicePressureSummary {
  const summary = emptyProviderBoundaryChoicePressure();
  const foundIndex = events.findIndex((event) => providerBoundaryEventRef(event) === boundaryRef);
  const boundaryIndex = foundIndex >= 0 ? foundIndex : 0;
  const repairRequestRefs: string[] = [];
  const retryProtocolRefs: string[] = [];
  const memoryRefs: string[] = [];

  for (const event of events.slice(boundaryIndex)) {
    const payload = objectPayload(event.payload);
    const mentionsBoundary = eventMentionsRuntimeRef(event, payload, boundaryRef);
    const text = eventSearchText(event, payload);

    if (event.event_type === "side_effect.requested" && mentionsBoundary && mentionsProviderRepair(text)) {
      const requestRef = sideEffectRequestRef(event, payload);
      if (requestRef) {
        repairRequestRefs.push(requestRef);
        summary.repairRequestRefs.push(requestRef);
        pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      }
      continue;
    }

    if (event.event_type === "side_effect.denied" && sideEffectEventMatchesRequest(event, payload, repairRequestRefs, boundaryRef)) {
      const requestRef = sideEffectRequestRef(event, payload);
      if (requestRef) {
        summary.deniedRepairRequestRefs.push(requestRef);
        pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      }
      continue;
    }

    if (event.event_type === "side_effect.approved" && sideEffectEventMatchesRequest(event, payload, repairRequestRefs, boundaryRef)) {
      const requestRef = sideEffectRequestRef(event, payload);
      if (requestRef) {
        summary.approvedRepairRequestRefs.push(requestRef);
        pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      }
      continue;
    }

    if (event.event_type === "side_effect.result_reported" && sideEffectEventMatchesRequest(event, payload, repairRequestRefs, boundaryRef)) {
      const resultRef = sideEffectRequestRef(event, payload) ?? event.event_id;
      summary.resultRefs.push(resultRef);
      pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      continue;
    }

    if (event.event_type === "protocol.proposed" && mentionsBoundary && mentionsRetry(text)) {
      const protocolRef = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? event.event_id;
      retryProtocolRefs.push(protocolRef);
      summary.retryProtocolRefs.push(protocolRef);
      pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      continue;
    }

    if (
      (event.event_type === "protocol.retired" || event.event_type === "protocol.expired") &&
      (protocolEventMatchesRef(event, payload, retryProtocolRefs) || (mentionsBoundary && mentionsRetry(text)))
    ) {
      const protocolRef = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? stringValue(payload.protocolRef) ?? event.refs[0];
      if (protocolRef) {
        summary.retiredRetryProtocolRefs.push(protocolRef);
        pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      }
      continue;
    }

    if (
      event.event_type === "agent.intention_recorded" &&
      intentionKind(payload) === "stay_silent" &&
      (mentionsBoundary || intentionTriggerMentionsRuntimeRef(events, payload, boundaryRef))
    ) {
      summary.silenceRefs.push(event.event_id);
      pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      continue;
    }

    if (event.event_type === "memory.proposed" && mentionsBoundary) {
      const memoryRef = stringValue(payload.memoryId) ?? stringValue(payload.memory_id) ?? event.event_id;
      memoryRefs.push(memoryRef);
      pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      continue;
    }

    if (event.event_type === "memory.contested" && memoryEventMatchesRef(event, payload, memoryRefs, boundaryRef)) {
      const memoryRef = stringValue(payload.memoryId) ?? stringValue(payload.memory_id) ?? stringValue(payload.memoryRef) ?? event.refs[0];
      if (memoryRef) {
        summary.contestedMemoryRefs.push(memoryRef);
        pushChoiceAgentId(summary.choiceAgentIds, choiceAgentId(event, payload));
      }
    }
  }

  summary.archiveCarryoverRefs = archiveCarryoverRefsForProviderBoundary(events, boundaryRef);
  summary.repairRequestRefs = uniqueRefs(summary.repairRequestRefs);
  summary.deniedRepairRequestRefs = uniqueRefs(summary.deniedRepairRequestRefs);
  summary.approvedRepairRequestRefs = uniqueRefs(summary.approvedRepairRequestRefs);
  summary.resultRefs = uniqueRefs(summary.resultRefs);
  summary.retryProtocolRefs = uniqueRefs(summary.retryProtocolRefs);
  summary.retiredRetryProtocolRefs = uniqueRefs(summary.retiredRetryProtocolRefs);
  summary.silenceRefs = uniqueRefs(summary.silenceRefs);
  summary.contestedMemoryRefs = uniqueRefs(summary.contestedMemoryRefs);
  summary.choiceAgentIds = uniqueRefs(summary.choiceAgentIds);

  const choiceKindCount = [
    summary.repairRequestRefs.length > 0,
    summary.deniedRepairRequestRefs.length > 0,
    summary.approvedRepairRequestRefs.length > 0,
    summary.resultRefs.length > 0,
    summary.retryProtocolRefs.length > 0,
    summary.retiredRetryProtocolRefs.length > 0,
    summary.silenceRefs.length > 0,
    summary.contestedMemoryRefs.length > 0,
  ].filter(Boolean).length;
  summary.hasMixedChoices = choiceKindCount >= 2;
  summary.hasMultiAgentPressure = summary.choiceAgentIds.length >= 3 && choiceKindCount >= 2;
  summary.carriedAcrossArchives = summary.archiveCarryoverRefs.length > 1;

  return summary;
}

function providerBoundaryEventRef(event: RoomEvent): string | undefined {
  if (event.event_type !== "agent.provider_degraded") {
    return undefined;
  }
  const payload = objectPayload(event.payload);
  return stringValue(payload.degradationId) ?? stringValue(payload.degradation_id) ?? event.event_id;
}

function eventMentionsRuntimeRef(event: RoomEvent, payload: Record<string, unknown>, ref: string): boolean {
  return (
    event.event_id === ref ||
    event.refs.includes(ref) ||
    arrayOfStrings(payload.contextRefs).includes(ref) ||
    arrayOfStrings(payload.context_refs).includes(ref) ||
    arrayOfStrings(payload.sourceRefs).includes(ref) ||
    arrayOfStrings(payload.source_refs).includes(ref) ||
    JSON.stringify(payload).includes(ref)
  );
}

function intentionTriggerMentionsRuntimeRef(
  events: readonly RoomEvent[],
  payload: Record<string, unknown>,
  ref: string,
): boolean {
  const triggeringEventId = stringValue(payload.triggeringEventId) ?? stringValue(payload.triggering_event_id);
  if (!triggeringEventId) {
    return false;
  }

  const triggerEvent = events.find((candidate) => candidate.event_id === triggeringEventId);
  if (triggerEvent && eventMentionsRuntimeRef(triggerEvent, objectPayload(triggerEvent.payload), ref)) {
    return true;
  }

  return events.some((candidate) => {
    if (candidate.event_type !== "room.autonomy_tick") {
      return false;
    }
    const tickPayload = objectPayload(candidate.payload);
    const tickId = stringValue(tickPayload.tickId) ?? stringValue(tickPayload.tick_id) ?? candidate.event_id;
    const messageEventId = stringValue(tickPayload.messageEventId) ?? stringValue(tickPayload.message_event_id);
    if (![candidate.event_id, tickId, messageEventId].includes(triggeringEventId)) {
      return false;
    }
    return eventMentionsRuntimeRef(candidate, tickPayload, ref);
  });
}

function eventSearchText(event: RoomEvent, payload: Record<string, unknown>): string {
  return `${event.event_type} ${event.refs.join(" ")} ${JSON.stringify(payload)}`.toLowerCase();
}

function mentionsProviderRepair(text: string): boolean {
  return /\b(provider|runtime|diagnostic|repair|fix|snapshot|version)\b|运行时|诊断|修复|快照|版本/.test(text);
}

function mentionsRetry(text: string): boolean {
  return /\b(retry|later|again|recheck)\b|重试|稍后|之后|复查/.test(text);
}

function sideEffectRequestRef(event: RoomEvent, payload: Record<string, unknown>): string | undefined {
  return (
    stringValue(payload.requestId) ??
    stringValue(payload.request_id) ??
    stringValue(payload.approvalId) ??
    stringValue(payload.approval_id) ??
    event.refs.find((ref) => ref.startsWith("sidefx_")) ??
    event.event_id
  );
}

function sideEffectEventMatchesRequest(
  event: RoomEvent,
  payload: Record<string, unknown>,
  requestRefs: readonly string[],
  boundaryRef: string,
): boolean {
  const requestRef = sideEffectRequestRef(event, payload);
  return (
    (requestRef !== undefined && requestRefs.includes(requestRef)) ||
    event.refs.some((ref) => requestRefs.includes(ref)) ||
    eventMentionsRuntimeRef(event, payload, boundaryRef)
  );
}

function protocolEventMatchesRef(event: RoomEvent, payload: Record<string, unknown>, protocolRefs: readonly string[]): boolean {
  const protocolRef =
    stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? stringValue(payload.protocolRef) ?? stringValue(payload.protocol_ref);
  return (
    (protocolRef !== undefined && protocolRefs.includes(protocolRef)) ||
    event.refs.some((ref) => protocolRefs.includes(ref))
  );
}

function memoryEventMatchesRef(
  event: RoomEvent,
  payload: Record<string, unknown>,
  memoryRefs: readonly string[],
  boundaryRef: string,
): boolean {
  const memoryRef = stringValue(payload.memoryId) ?? stringValue(payload.memory_id) ?? stringValue(payload.memoryRef) ?? stringValue(payload.memory_ref);
  return (
    (memoryRef !== undefined && memoryRefs.includes(memoryRef)) ||
    event.refs.some((ref) => memoryRefs.includes(ref)) ||
    eventMentionsRuntimeRef(event, payload, boundaryRef)
  );
}

function intentionKind(payload: Record<string, unknown>): string | undefined {
  const intention = objectPayload(payload.intention);
  return stringValue(intention.kind) ?? stringValue(payload.kind);
}

function choiceAgentId(event: RoomEvent, payload: Record<string, unknown>): string | undefined {
  if (event.actor.kind === "agent") {
    return event.actor.id;
  }
  return (
    stringValue(payload.agentId) ??
    stringValue(payload.agent_id) ??
    stringValue(payload.requestedBy) ??
    stringValue(payload.requested_by) ??
    stringValue(payload.proposedBy) ??
    stringValue(payload.proposed_by) ??
    stringValue(payload.retiredBy) ??
    stringValue(payload.retired_by) ??
    stringValue(payload.contestedBy) ??
    stringValue(payload.contested_by) ??
    stringValue(payload.approvedBy) ??
    stringValue(payload.approved_by) ??
    stringValue(payload.deniedBy) ??
    stringValue(payload.denied_by) ??
    stringValue(payload.expiredBy) ??
    stringValue(payload.expired_by) ??
    stringValue(payload.decidedBy) ??
    stringValue(payload.decided_by)
  );
}

function pushChoiceAgentId(agentIds: string[], agentId: string | undefined): void {
  if (agentId && !agentIds.includes(agentId)) {
    agentIds.push(agentId);
  }
}

function archiveCarryoverRefsForProviderBoundary(events: readonly RoomEvent[], boundaryRef: string): string[] {
  const archives = ArchiveStore.fromEvents([...events]).view().archives;
  return archives
    .filter((archive) => archiveCarriesProviderBoundaryChoice(archive, boundaryRef))
    .map((archive) => archive.archiveId);
}

function archiveCarriesProviderBoundaryChoice(archive: DailyArchive, boundaryRef: string): boolean {
  return (
    archive.providerBoundaries.some(
      (boundary) => boundary.boundaryId === boundaryRef || boundary.sourceRefs.includes(boundaryRef),
    ) ||
    archive.sideEffectBoundaries.some((boundary) => boundary.sourceRefs.includes(boundaryRef)) ||
    archive.protocols.some((protocol) => protocol.sourceRefs.includes(boundaryRef)) ||
    archive.silences.some((silence) => silence.sourceRefs.includes(boundaryRef)) ||
    archive.memoryChanges.some((change) => change.sourceRefs.includes(boundaryRef)) ||
    archive.contestedItems.includes(boundaryRef) ||
    Object.values(archive.outputRefs).includes(boundaryRef) ||
    (archive.provenanceRefs ?? []).includes(boundaryRef)
  );
}

function projectProtocols(events: readonly RoomEvent[]): RuntimeProtocolSummary[] {
  const protocols = new Map<string, RuntimeProtocolSummary>();

  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "protocol.proposed") {
      const protocolId = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? event.event_id;
      const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
      const sourcePressureRefs = uniqueRefs(
        arrayOfStrings(payload.sourcePressureRefs)
          .concat(arrayOfStrings(payload.source_pressure_refs))
          .concat(contextRefs)
          .concat(event.refs)
          .filter((ref) => ref.startsWith("mixed_review:")),
      );
      protocols.set(protocolId, {
        protocolId,
        status: stringValue(payload.status) ?? "proposed",
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        proposedBy: stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by) ?? event.actor.id,
        revisedFromProtocolRef:
          stringValue(payload.revisedFromProtocolRef) ?? stringValue(payload.revised_from_protocol_ref),
        revisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
        summary: stringValue(payload.summary) ?? stringValue(payload.reason) ?? "",
        scope: protocolScopeLabel(payload.scope),
        sourcePressureRefs,
        responseCount: 0,
        expiresAt: stringValue(payload.expiresAt) ?? stringValue(payload.expires_at),
        expiryPolicy: stringValue(payload.expiryPolicy) ?? stringValue(payload.expiry_policy),
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "protocol is temporary room etiquette, not permanent control flow",
        updatedAt: event.occurred_at,
      });
      continue;
    }

    if (event.event_type === "protocol.responded") {
      const protocolId = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? event.refs[0] ?? event.event_id;
      const current =
        protocols.get(protocolId) ??
        ({
          protocolId,
          status: "responded",
          summary: stringValue(payload.summary) ?? stringValue(payload.reason) ?? "",
          scope: "unknown",
          sourcePressureRefs: [],
          responseCount: 0,
          updatedAt: event.occurred_at,
        } satisfies RuntimeProtocolSummary);
      current.status = stringValue(payload.status) ?? protocolStatusFromResponse(stringValue(payload.response)) ?? current.status;
      current.responseCount += 1;
      current.updatedAt = event.occurred_at;
      protocols.set(protocolId, current);
      continue;
    }

    if (event.event_type === "protocol.retired" || event.event_type === "protocol.expired") {
      const protocolId = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? event.refs[0] ?? event.event_id;
      const current =
        protocols.get(protocolId) ??
        ({
          protocolId,
          status: "proposed",
          summary: stringValue(payload.summary) ?? stringValue(payload.reason) ?? "",
          scope: "unknown",
          sourcePressureRefs: [],
          responseCount: 0,
          updatedAt: event.occurred_at,
        } satisfies RuntimeProtocolSummary);
      current.status = event.event_type.replace("protocol.", "");
      current.updatedAt = event.occurred_at;
      protocols.set(protocolId, current);
    }
  }

  return [...protocols.values()].sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.protocolId.localeCompare(b.protocolId));
}

function protocolsDueForExpiry(events: readonly RoomEvent[], roomId: string, now: string): ProtocolExpiryCandidate[] {
  const protocols = new Map<string, ProtocolExpiryCandidate>();

  for (const event of events) {
    if (event.room_id !== roomId) {
      continue;
    }
    const payload = objectPayload(event.payload);
    if (event.event_type === "protocol.proposed") {
      const protocolId = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? event.event_id;
      const expiresAt = stringValue(payload.expiresAt) ?? stringValue(payload.expires_at);
      if (!expiresAt) {
        protocols.delete(protocolId);
        continue;
      }
      protocols.set(protocolId, {
        protocolId,
        status: stringValue(payload.status) ?? "proposed",
        topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
        expiresAt,
      });
      continue;
    }

    if (event.event_type === "protocol.responded") {
      const protocolId = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? event.refs[0] ?? event.event_id;
      const current = protocols.get(protocolId);
      if (!current) {
        continue;
      }
      current.status = stringValue(payload.status) ?? protocolStatusFromResponse(stringValue(payload.response)) ?? current.status;
      current.topicId = current.topicId ?? stringValue(payload.topicId) ?? stringValue(payload.topic_id);
      continue;
    }

    if (event.event_type === "protocol.retired" || event.event_type === "protocol.expired") {
      const protocolId = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id) ?? event.refs[0] ?? event.event_id;
      const current = protocols.get(protocolId);
      if (current) {
        current.status = event.event_type.replace("protocol.", "");
      }
    }
  }

  return [...protocols.values()]
    .filter((protocol) => protocolStatusCanExpire(protocol.status))
    .filter((protocol) => Date.parse(protocol.expiresAt) <= Date.parse(now))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.protocolId.localeCompare(b.protocolId));
}

function projectSideEffects(events: readonly RoomEvent[]): RuntimeSideEffectSummary[] {
  const requests = new Map<string, RuntimeSideEffectSummary>();
  const pressureRefsFor = (payload: Record<string, unknown>, event: RoomEvent): string[] =>
    uniqueRefs(
      arrayOfStrings(payload.sourcePressureRefs)
        .concat(arrayOfStrings(payload.source_pressure_refs))
        .concat(arrayOfStrings(payload.contextRefs))
        .concat(arrayOfStrings(payload.context_refs))
        .concat(event.refs)
        .filter(isMixedReviewPressureRef),
    );

  const ensure = (id: string, payload: Record<string, unknown>, event: RoomEvent): RuntimeSideEffectSummary => {
    const existing = requests.get(id);
    if (existing) return existing;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    const created: RuntimeSideEffectSummary = {
      requestId: id,
      approvalId: stringValue(payload.approvalId) ?? stringValue(payload.approval_id),
      status: "requested",
      requestedBy: stringValue(payload.requestedBy) ?? stringValue(payload.requested_by) ?? event.actor.id,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      kind: sideEffectKindValue(payload.kind),
      target: stringValue(payload.target) ?? "",
      reason: stringValue(payload.reason) ?? "",
      expectedImpact: stringValue(payload.expectedImpact) ?? stringValue(payload.expected_impact) ?? "",
      proposedCommand: stringValue(payload.proposedCommand) ?? stringValue(payload.proposed_command),
      contextRefs,
      sourcePressureRefs: pressureRefsFor(payload, event),
      updatedAt: event.occurred_at,
      boundaryNote: "requested only; this external side effect requires explicit approval before execution",
    };
    requests.set(id, created);
    return created;
  };

  for (const event of events) {
    const payload = objectPayload(event.payload);
    if (event.event_type === "side_effect.requested") {
      const id =
        stringValue(payload.requestId) ??
        stringValue(payload.request_id) ??
        stringValue(payload.approvalId) ??
        stringValue(payload.approval_id) ??
        event.event_id;
      const current = ensure(id, payload, event);
      current.status = stringValue(payload.status) ?? "requested";
      current.sourcePressureRefs = uniqueRefs(current.sourcePressureRefs.concat(pressureRefsFor(payload, event)));
      current.updatedAt = event.occurred_at;
      continue;
    }

    if (event.event_type === "side_effect.approved" || event.event_type === "side_effect.denied" || event.event_type === "side_effect.expired") {
      const id = stringValue(payload.requestId) ?? stringValue(payload.approvalId) ?? stringValue(payload.approval_id) ?? event.refs[0];
      if (!id) continue;
      const current = ensure(id, payload, event);
      current.approvalId = stringValue(payload.approvalId) ?? stringValue(payload.approval_id) ?? current.approvalId;
      current.status = event.event_type.replace("side_effect.", "");
      current.decisionReason = stringValue(payload.reason) ?? current.decisionReason;
      current.sourcePressureRefs = uniqueRefs(current.sourcePressureRefs.concat(pressureRefsFor(payload, event)));
      current.updatedAt = event.occurred_at;
      continue;
    }

    if (event.event_type === "side_effect.result_reported") {
      const id = stringValue(payload.requestId) ?? stringValue(payload.approvalId) ?? stringValue(payload.approval_id) ?? event.refs[0];
      if (!id) continue;
      const current = ensure(id, payload, event);
      current.approvalId = stringValue(payload.approvalId) ?? stringValue(payload.approval_id) ?? current.approvalId;
      current.status = stringValue(payload.status) ?? "result_reported";
      current.resultSummary = stringValue(payload.summary) ?? current.resultSummary;
      current.sourcePressureRefs = uniqueRefs(current.sourcePressureRefs.concat(pressureRefsFor(payload, event)));
      current.updatedAt = event.occurred_at;
    }
  }

  return [...requests.values()].sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.requestId.localeCompare(b.requestId));
}

function projectSideEffectReviews(events: readonly RoomEvent[]): RuntimeSideEffectReviewSummary[] {
  const reviews: RuntimeSideEffectReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "side_effect.reviewed") continue;
    const payload = objectPayload(event.payload);
    const sideEffectRef =
      stringValue(payload.sideEffectRef) ??
      stringValue(payload.side_effect_ref) ??
      stringValue(payload.requestId) ??
      stringValue(payload.request_id);
    if (!sideEffectRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      sideEffectRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "side-effect review is a social trace; it does not approve, deny, expire, execute, report a result, or mutate external state",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectWorkspaceArtifactReviews(events: readonly RoomEvent[]): RuntimeWorkspaceArtifactReviewSummary[] {
  const reviews: RuntimeWorkspaceArtifactReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "workspace.artifact_reviewed") continue;
    const payload = objectPayload(event.payload);
    const artifactRef =
      stringValue(payload.artifactRef) ??
      stringValue(payload.artifact_ref) ??
      stringValue(payload.artifactId) ??
      stringValue(payload.artifact_id);
    if (!artifactRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      artifactRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "workspace artifact review is a social trace; it does not copy private workspace contents, promote public memory, execute tools, or mutate the artifact",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectSkillCapsuleReviews(events: readonly RoomEvent[]): RuntimeSkillCapsuleReviewSummary[] {
  const reviews: RuntimeSkillCapsuleReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "skill.capsule_reviewed") continue;
    const payload = objectPayload(event.payload);
    const capsuleRef =
      stringValue(payload.capsuleRef) ??
      stringValue(payload.capsule_ref) ??
      stringValue(payload.capsuleId) ??
      stringValue(payload.capsule_id);
    if (!capsuleRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    const sourcePressureRefs = uniqueRefs(
      arrayOfStrings(payload.sourcePressureRefs)
        .concat(arrayOfStrings(payload.source_pressure_refs))
        .concat(contextRefs.filter(isMixedReviewPressureRef))
        .concat(event.refs.filter(isMixedReviewPressureRef)),
    );
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      capsuleRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourcePressureRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs, ...sourcePressureRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "skill capsule review is a social trace; it does not register a skill, assign a role, execute tools, bypass approvals, or mutate capability state",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function projectCapabilityReviews(events: readonly RoomEvent[]): RuntimeCapabilityReviewSummary[] {
  const reviews: RuntimeCapabilityReviewSummary[] = [];
  for (const event of events) {
    if (event.event_type !== "capability.reviewed") continue;
    const payload = objectPayload(event.payload);
    const capabilityRef =
      stringValue(payload.capabilityRef) ??
      stringValue(payload.capability_ref) ??
      stringValue(payload.capabilityId) ??
      stringValue(payload.capability_id);
    if (!capabilityRef) continue;
    const contextRefs = uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)));
    const sourcePressureRefs = uniqueRefs(
      arrayOfStrings(payload.sourcePressureRefs)
        .concat(arrayOfStrings(payload.source_pressure_refs))
        .concat(contextRefs.filter(isMixedReviewPressureRef))
        .concat(event.refs.filter(isMixedReviewPressureRef)),
    );
    reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      capabilityRef,
      topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary) ?? "",
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      contextRefs,
      sourcePressureRefs,
      sourceRefs: uniqueRefs([event.event_id, ...event.refs, ...contextRefs, ...sourcePressureRefs]),
      updatedAt: event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech",
    });
  }
  return reviews.sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.reviewId.localeCompare(b.reviewId));
}

function sideEffectMatchesRef(sideEffect: RuntimeSideEffectSummary, ref: string): boolean {
  return (
    sideEffect.requestId === ref ||
    sideEffect.approvalId === ref ||
    sideEffect.contextRefs.includes(ref)
  );
}

function latestSideEffectApprovalEvent(
  events: readonly RoomEvent[],
  sideEffect: RuntimeSideEffectSummary,
): RoomEvent | undefined {
  const refs = uniqueRefs([sideEffect.requestId, sideEffect.approvalId, ...sideEffect.contextRefs]);
  return events
    .slice()
    .reverse()
    .find((event) => {
      if (event.event_type !== "side_effect.approved") {
        return false;
      }
      const payload = objectPayload(event.payload);
      const requestRef = stringValue(payload.requestId) ?? stringValue(payload.request_id);
      const approvalRef = stringValue(payload.approvalId) ?? stringValue(payload.approval_id);
      return (
        requestRef === sideEffect.requestId ||
        approvalRef === sideEffect.approvalId ||
        approvalRef === sideEffect.requestId ||
        event.refs.some((ref) => refs.includes(ref))
      );
    });
}

function scopeAllowsSideEffect(scope: Record<string, unknown>, sideEffect: RuntimeSideEffectSummary): boolean {
  const kinds = arrayOfStrings(scope.kinds);
  if (kinds.length > 0 && (!sideEffect.kind || !kinds.includes(sideEffect.kind))) {
    return false;
  }
  const targets = arrayOfStrings(scope.targets);
  const targetPrefixes = arrayOfStrings(scope.targetPrefixes).concat(arrayOfStrings(scope.target_prefixes));
  if (
    (targets.length > 0 || targetPrefixes.length > 0) &&
    !targets.includes(sideEffect.target) &&
    !targetPrefixes.some((prefix) => sideEffect.target.startsWith(prefix))
  ) {
    return false;
  }
  const allowedAgents = arrayOfStrings(scope.allowedAgents).concat(arrayOfStrings(scope.allowed_agents));
  return allowedAgents.length === 0 || (sideEffect.requestedBy !== undefined && allowedAgents.includes(sideEffect.requestedBy));
}

type SimpleSideEffectExecution = {
  status: "completed" | "failed";
  summary: string;
  artifactRefs: string[];
};

async function executeSimpleApprovedSideEffect(
  sideEffect: RuntimeSideEffectSummary,
  input: { content?: string; cwd?: string },
): Promise<SimpleSideEffectExecution> {
  if (sideEffect.kind === "filesystem.write") {
    const targetPath = path.resolve(process.cwd(), sideEffect.target);
    const content = input.content ?? `approved side-effect write for ${sideEffect.requestId}\n`;
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
    return {
      status: "completed",
      summary: `Wrote ${Buffer.byteLength(content, "utf8")} bytes to ${sideEffect.target}.`,
      artifactRefs: [`artifact_${sideEffect.requestId}_filesystem_write`],
    };
  }

  if (sideEffect.kind === "shell.exec") {
    const command = sideEffect.proposedCommand ?? sideEffect.target;
    if (!command) {
      throw new Error(`side-effect ${sideEffect.requestId} has no shell command`);
    }
    const shell = shellCommand(command);
    const cwd = input.cwd ? path.resolve(process.cwd(), input.cwd) : process.cwd();
    try {
      const { stdout, stderr } = await execFileAsync(shell.file, shell.args, {
        cwd,
        timeout: 5_000,
        maxBuffer: 64 * 1024,
        windowsHide: true,
      });
      const output = [boundedOutput(stdout), boundedOutput(stderr)].filter(Boolean).join(" stderr: ");
      return {
        status: "completed",
        summary: `Ran approved shell command "${boundedOutput(command, 180)}"${output ? `; output: ${output}` : ""}.`,
        artifactRefs: [`artifact_${sideEffect.requestId}_shell_exec`],
      };
    } catch (error) {
      return {
        status: "failed",
        summary: `Approved shell command failed: ${boundedOutput(error instanceof Error ? error.message : String(error))}.`,
        artifactRefs: [`artifact_${sideEffect.requestId}_shell_exec_failed`],
      };
    }
  }

  throw new Error(`side-effect kind ${sideEffect.kind ?? "unknown"} has no runtime executor`);
}

function shellCommand(command: string): { file: string; args: string[] } {
  if (process.platform === "win32") {
    return { file: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", command] };
  }
  return { file: "/bin/sh", args: ["-lc", command] };
}

function boundedOutput(value: string, maxLength = 700): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

function projectArchives(events: readonly RoomEvent[]): RuntimeArchiveSummary[] {
  const view = ArchiveStore.fromEvents([...events]).view();
  return view.archives
    .map((archive) => ({
      archiveId: archive.archiveId,
      date: archive.date,
      revisionOf: archive.revisionOf,
      appliedRepairRef: archive.appliedRepairRef,
      revisionReason: archive.revisionReason,
      provenanceRefs: archive.provenanceRefs ?? [],
      summary: archive.summary,
      compressionNote: archive.compressionNote,
      eventCount: Object.values(archive.eventCounts).reduce((sum, count) => sum + count, 0),
      decisionCount: archive.decisions.length,
      disagreementCount: archive.disagreements.length,
      openQuestionCount: archive.openQuestions.length,
      openQuestionTraceCount: archive.openQuestionTraces.length,
      memoryChangeCount: archive.memoryChanges.length,
      topicProposalCount: archive.topicProposals.length,
      handoffCount: archive.handoffs.length,
      protocolCount: archive.protocols.length,
      invitationCount: archive.invitations.length,
      silenceCount: archive.silences.length,
      personaDeltaCount: archive.personaDeltas.length,
      agentContinuityCount: archive.agentContinuity.length,
      roleClaimCount: archive.agentContinuity.reduce((sum, continuity) => sum + continuity.roleClaims.length, 0),
      dailyMoodCount: archive.agentContinuity.reduce((sum, continuity) => sum + continuity.dailyMoods.length, 0),
      agentContinuity: archive.agentContinuity.map((continuity) => ({
        agentId: continuity.agentId,
        roleClaims: continuity.roleClaims.map((claim) => ({
          roleClaimId: claim.roleClaimId,
          deltaId: claim.deltaId,
          label: claim.label,
          status: claim.status,
          evidenceRefs: claim.evidenceRefs,
          sourcePressureRefs: claim.sourcePressureRefs,
          contestRefs: claim.contestRefs,
          responseRefs: claim.responseRefs,
          boundaryNote: claim.boundaryNote,
        })),
        dailyMoods: continuity.dailyMoods.map((mood) => ({
          deltaId: mood.deltaId,
          date: mood.date,
          posture: mood.posture,
          status: mood.status,
          acceptedBy: mood.acceptedBy,
          sourceRef: mood.sourceRef,
          evidenceRefs: mood.evidenceRefs,
          responseRefs: mood.responseRefs,
          boundaryNote: mood.boundaryNote,
        })),
        sourceRefs: continuity.sourceRefs,
        eventIds: continuity.eventIds,
        boundaryNote: continuity.boundaryNote,
      })),
      sideEffectBoundaryCount: archive.sideEffectBoundaries.length,
      workspaceBoundaryCount: archive.workspaceBoundaries.length,
      workspaceArtifactCount: archive.workspaceArtifacts.length,
      skillCapsuleCount: archive.skillCapsules.length,
      capabilityReviewCount: archive.capabilityReviews.length,
      pressureBoundaryCount: archive.pressureBoundaries.length,
      providerBoundaryCount: archive.providerBoundaries.length,
      memoryPressureBoundaryCount: archive.memoryPressureBoundaries.length,
      contestedCount: archive.contestedItems.length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.archiveId.localeCompare(b.archiveId));
}

function projectArchiveReviews(events: readonly RoomEvent[]): RuntimeArchiveReviewSummary[] {
  const repairRefToArchive = new Map<string, string>();
  for (const event of events) {
    if (event.event_type !== "archive.repair_proposed") continue;
    const payload = objectPayload(event.payload);
    const repairId = stringValue(payload.repairId) ?? event.event_id;
    const archiveRef = stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref);
    if (archiveRef) {
      repairRefToArchive.set(repairId, archiveRef);
    }
  }

  return events
    .flatMap((event): RuntimeArchiveReviewSummary[] => {
      const payload = objectPayload(event.payload);
      if (event.event_type === "archive.review_requested") {
        const requestId = stringValue(payload.requestId) ?? stringValue(payload.request_id) ?? event.event_id;
        const archiveRef = stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref);
        if (!archiveRef) return [];
        return [
          {
            id: requestId,
            kind: "review_request",
            archiveRef,
            agentId: stringValue(payload.requestedBy) ?? stringValue(payload.requested_by) ?? event.actor.id,
            summary: stringValue(payload.summary) ?? `Review archive ${archiveRef}.`,
            reason: stringValue(payload.reason) ?? "Daily rhythm opened archive review.",
            status: stringValue(payload.status) ?? "open",
            contextRefs: arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)),
            updatedAt: event.occurred_at,
            boundaryNote:
              stringValue(payload.boundaryNote) ??
              stringValue(payload.boundary_note) ??
              "daily archive review request is a room rhythm invitation, not a command to speak",
          },
        ];
      }
      if (event.event_type === "archive.reviewed") {
        const reviewId = stringValue(payload.reviewId) ?? event.event_id;
        const archiveRef = stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref);
        if (!archiveRef) return [];
        return [
          {
            id: reviewId,
            kind: "review",
            archiveRef,
            topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
            agentId: stringValue(payload.reviewedBy) ?? stringValue(payload.reviewed_by) ?? event.actor.id,
            assessment: stringValue(payload.assessment),
            summary: stringValue(payload.summary) ?? "Archive reviewed.",
            reason: stringValue(payload.reason) ?? "No reason recorded.",
            contextRefs: arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)),
            updatedAt: event.occurred_at,
            boundaryNote:
              stringValue(payload.boundaryNote) ?? "archive review is room-visible critique, not archive mutation",
          },
        ];
      }
      if (event.event_type === "archive.repair_proposed") {
        const repairId = stringValue(payload.repairId) ?? event.event_id;
        const archiveRef = stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref);
        if (!archiveRef) return [];
        return [
          {
            id: repairId,
            kind: "repair_proposal",
            archiveRef,
            topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
            agentId: stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by) ?? event.actor.id,
            summary: stringValue(payload.summary) ?? "Archive repair proposed.",
            reason: stringValue(payload.reason) ?? "No reason recorded.",
            proposedRepair: stringValue(payload.proposedRepair) ?? stringValue(payload.proposed_repair),
            revisedFromRepairRef: stringValue(payload.revisedFromRepairRef) ?? stringValue(payload.revised_from_repair_ref),
            revisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
            status: stringValue(payload.status) ?? "proposed",
            contextRefs: arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)),
            updatedAt: event.occurred_at,
            boundaryNote:
              stringValue(payload.boundaryNote) ??
              "archive repair proposal does not rewrite the archive until later room action accepts it",
          },
        ];
      }
      if (event.event_type === "archive.repair_responded") {
        const responseId = stringValue(payload.responseId) ?? event.event_id;
        const repairRef = stringValue(payload.repairRef) ?? stringValue(payload.repair_ref);
        if (!repairRef) return [];
        return [
          {
            id: responseId,
            kind: "repair_response",
            archiveRef: repairRefToArchive.get(repairRef) ?? "unknown_archive",
            repairRef,
            topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
            agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
            response: stringValue(payload.response),
            summary: `${stringValue(payload.response) ?? "responded"} repair ${repairRef}`,
            reason: stringValue(payload.reason) ?? "No reason recorded.",
            proposedRevision: stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
            status: stringValue(payload.status),
            contextRefs: arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)),
            updatedAt: event.occurred_at,
            boundaryNote:
              stringValue(payload.boundaryNote) ??
              "archive repair response changes repair proposal state only; archive content is unchanged",
          },
        ];
      }
      if (event.event_type === "archive.repair_reviewed") {
        const reviewId = stringValue(payload.reviewId) ?? event.event_id;
        const repairRef = stringValue(payload.repairRef) ?? stringValue(payload.repair_ref);
        if (!repairRef) return [];
        return [
          {
            id: reviewId,
            kind: "repair_review",
            archiveRef: repairRefToArchive.get(repairRef) ?? "unknown_archive",
            repairRef,
            topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
            agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
            response: stringValue(payload.response) ?? "reviewed",
            summary: stringValue(payload.summary) ?? "Archive repair reviewed.",
            reason: stringValue(payload.reason) ?? "Ordinary room speech reviewed this repair proposal.",
            contextRefs: arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)),
            updatedAt: event.occurred_at,
            boundaryNote:
              stringValue(payload.boundaryNote) ??
              stringValue(payload.boundary_note) ??
              "archive repair review is discussion pressure only; archive content and repair state are unchanged",
          },
        ];
      }
      if (event.event_type === "archive.repair_applied") {
        const applicationId = stringValue(payload.applicationId) ?? stringValue(payload.application_id) ?? event.event_id;
        const repairRef = stringValue(payload.repairRef) ?? stringValue(payload.repair_ref);
        const archiveRef = stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref);
        const revisedArchiveRef = stringValue(payload.revisedArchiveRef) ?? stringValue(payload.revised_archive_ref);
        if (!repairRef || !archiveRef || !revisedArchiveRef) return [];
        return [
          {
            id: applicationId,
            kind: "repair_application",
            archiveRef,
            repairRef,
            revisedArchiveRef,
            agentId: stringValue(payload.appliedBy) ?? stringValue(payload.applied_by) ?? event.actor.id,
            summary: `applied repair ${repairRef} as ${revisedArchiveRef}`,
            reason: stringValue(payload.reason) ?? "No reason recorded.",
            proposedRepair: stringValue(payload.proposedRepair) ?? stringValue(payload.proposed_repair),
            status: stringValue(payload.status) ?? "applied",
            contextRefs: arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)),
            updatedAt: event.occurred_at,
            boundaryNote:
              stringValue(payload.boundaryNote) ??
              stringValue(payload.boundary_note) ??
              "explicit room action creates a new archive revision; the original archive remains unchanged",
          },
        ];
      }
      return [];
    })
    .sort((a, b) => compareNewestFirst(a.updatedAt, b.updatedAt) || a.id.localeCompare(b.id));
}

function projectAutonomyTicks(events: readonly RoomEvent[]): RuntimeAutonomyTickSummary[] {
  return events
    .filter((event) => event.event_type === "room.autonomy_tick")
    .map(autonomyTickSummaryFromEvent)
    .sort((a, b) => compareNewestFirst(a.occurredAt, b.occurredAt) || a.tickId.localeCompare(b.tickId));
}

function autonomyTickSummaryFromEvent(event: RoomEvent): RuntimeAutonomyTickSummary {
  const payload = objectPayload(event.payload);
  const action = autonomyTickAction(payload.action);
  const status = autonomyTickStatus(payload.status);
  return {
    tickId: stringValue(payload.tickId) ?? stringValue(payload.tick_id) ?? event.event_id,
    action,
    status,
    reason: stringValue(payload.reason) ?? "",
    date: stringValue(payload.date) ?? event.occurred_at.slice(0, 10),
    timezone: stringValue(payload.timezone) ?? "Asia/Shanghai",
    messageEventId: stringValue(payload.messageEventId) ?? stringValue(payload.message_event_id),
    anchorEventId: stringValue(payload.anchorEventId) ?? stringValue(payload.anchor_event_id),
    archiveRef: stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref),
    reviewRequestRef: stringValue(payload.reviewRequestRef) ?? stringValue(payload.review_request_ref),
    targetRefs: uniqueRefs(arrayOfStrings(payload.targetRefs).concat(arrayOfStrings(payload.target_refs))),
    contextRefs: uniqueRefs(arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs))),
    evidenceRefs: uniqueRefs(arrayOfStrings(payload.evidenceRefs).concat(arrayOfStrings(payload.evidence_refs), event.refs)),
    choiceSet: autonomyChoiceSetFromPayload(payload.choiceSet ?? payload.choice_set),
    occurredAt: event.occurred_at,
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "autonomous rhythm is evidence-driven room etiquette; it may invite review or preserve silence, but it does not force speech, assign work, or make memory true",
  };
}

function autonomyTickAction(value: unknown): RuntimeAutonomyTickSummary["action"] {
  return value === "archive_and_invite_review" ||
    value === "review_open_archive" ||
    value === "memory_hygiene_review" ||
    value === "continuity_review" ||
    value === "provider_boundary_review" ||
    value === "open_question_revisit" ||
    value === "invitation_review" ||
    value === "handoff_review" ||
    value === "idle_social_rhythm" ||
    value === "silence_reentry" ||
    value === "stay_silent"
    ? value
    : "stay_silent";
}

function autonomyTickStatus(value: unknown): RuntimeAutonomyTickSummary["status"] {
  return value === "posted" || value === "archived" || value === "silent" || value === "unchanged" ? value : "silent";
}

function autonomyChoiceSet(input: {
  hasNewRelevantSinceArchive: boolean;
  latestRelevant?: RoomEvent;
  unpostedReviewRequest?: RuntimeArchiveReviewSummary;
  socialCandidates: readonly AutonomousSocialCarry[];
  idleSocialRhythm?: AutonomousIdleSocialRhythmCarry;
  silenceReentry?: AutonomousSilenceReentryCarry;
}): RuntimeAutonomyChoiceOption[] {
  const choices: RuntimeAutonomyChoiceOption[] = [];

  if (input.hasNewRelevantSinceArchive && input.latestRelevant !== undefined) {
    choices.push({
      action: "archive_and_invite_review",
      eligible: true,
      targetRefs: [input.latestRelevant.event_id],
      evidenceRefs: [input.latestRelevant.event_id],
      reason:
        "New room-visible sediment exists after the latest daily archive, so a time-skeleton archive and optional review invitation are eligible.",
    });
  }

  if (input.unpostedReviewRequest !== undefined) {
    choices.push({
      action: "review_open_archive",
      eligible: true,
      targetRefs: uniqueRefs([input.unpostedReviewRequest.archiveRef, input.unpostedReviewRequest.id]),
      evidenceRefs: uniqueRefs([input.unpostedReviewRequest.archiveRef, input.unpostedReviewRequest.id, ...input.unpostedReviewRequest.contextRefs]),
      reason:
        "An open archive review request has not yet been carried into autonomous room rhythm.",
    });
  }

  for (const candidate of input.socialCandidates) {
    choices.push({
      action: candidate.action,
      eligible: true,
      targetRefs: candidate.targetRefs,
      evidenceRefs: candidate.evidenceRefs,
      reason: candidate.reason,
    });
  }

  if (input.idleSocialRhythm !== undefined) {
    choices.push({
      action: "idle_social_rhythm",
      eligible: true,
      targetRefs: input.idleSocialRhythm.targetRefs,
      evidenceRefs: input.idleSocialRhythm.evidenceRefs,
      reason: input.idleSocialRhythm.reason,
    });
  }

  if (input.silenceReentry !== undefined) {
    choices.push({
      action: "silence_reentry",
      eligible: true,
      targetRefs: uniqueRefs([
        input.silenceReentry.anchorEventId,
        input.silenceReentry.preservedSilenceRef,
        input.silenceReentry.archiveRef,
      ]),
      evidenceRefs: input.silenceReentry.evidenceRefs,
      reason: input.silenceReentry.reason,
    });
  }

  if (choices.length === 0) {
    const refs = input.latestRelevant ? [input.latestRelevant.event_id] : [];
    choices.push({
      action: "stay_silent",
      eligible: true,
      targetRefs: refs,
      evidenceRefs: refs,
      reason:
        "No unarchived sediment, uncarried review request, social carry, idle social rhythm, or overdue silence re-entry is eligible, so preserving silence is the bounded room choice.",
    });
  }

  return normalizeAutonomyChoiceSet(choices);
}

function autonomyChoiceSetFromPayload(value: unknown): RuntimeAutonomyChoiceOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeAutonomyChoiceSet(
    value.map((item) => {
      const payload = objectPayload(item);
      return {
        action: autonomyTickAction(payload.action),
        eligible: booleanValue(payload.eligible) ?? true,
        targetRefs: arrayOfStrings(payload.targetRefs).concat(arrayOfStrings(payload.target_refs)),
        evidenceRefs: arrayOfStrings(payload.evidenceRefs).concat(arrayOfStrings(payload.evidence_refs)),
        reason: stringValue(payload.reason) ?? "",
      };
    }),
  );
}

function normalizeAutonomyChoiceSet(choices: readonly RuntimeAutonomyChoiceOption[]): RuntimeAutonomyChoiceOption[] {
  const normalized: RuntimeAutonomyChoiceOption[] = [];
  const seen = new Set<string>();
  for (const choice of choices) {
    const targetRefs = uniqueRefs(choice.targetRefs).slice(0, 12);
    const evidenceRefs = uniqueRefs(choice.evidenceRefs).slice(0, 12);
    const reason = choice.reason.trim().slice(0, 260);
    const normalizedChoice: RuntimeAutonomyChoiceOption = {
      action: autonomyTickAction(choice.action),
      eligible: choice.eligible,
      targetRefs,
      evidenceRefs,
      reason,
    };
    const key = [normalizedChoice.action, normalizedChoice.eligible ? "eligible" : "blocked", targetRefs.join(","), evidenceRefs.join(",")].join(":");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(normalizedChoice);
    if (normalized.length >= 8) {
      break;
    }
  }
  return normalized;
}

function autonomyChoiceSetRefs(choiceSet: readonly RuntimeAutonomyChoiceOption[]): string[] {
  return uniqueRefs(choiceSet.flatMap((choice) => [...choice.targetRefs, ...choice.evidenceRefs]));
}

function latestAutonomyTickEvent(events: readonly RoomEvent[]): RoomEvent | undefined {
  return [...events].reverse().find((event) => event.event_type === "room.autonomy_tick");
}

function latestArchiveRelevantEvent(events: readonly RoomEvent[]): RoomEvent | undefined {
  return [...events].reverse().find((event) => isArchiveRelevantEvent(event, events));
}

function latestDailyArchiveEventForDate(events: readonly RoomEvent[], date: string): RoomEvent | undefined {
  return [...events].reverse().find((event) => {
    if (event.event_type !== "daily_archive.created") return false;
    const payload = objectPayload(event.payload);
    return (stringValue(payload.date) ?? stringValue(objectPayload(payload.archive).date)) === date;
  });
}

function latestUnpostedArchiveReviewRequest(
  events: readonly RoomEvent[],
  archiveRef?: string,
): RuntimeArchiveReviewSummary | undefined {
  return projectArchiveReviews(events).find(
    (review) =>
      review.kind === "review_request" &&
      review.status !== "closed" &&
      (archiveRef === undefined || review.archiveRef === archiveRef) &&
      !hasAutonomousMessageForRef(events, review.id),
  );
}

function latestTopicEventForMessage(events: readonly RoomEvent[], messageEventId: string, topicId: string): RoomLoopAcceptedMessage["topicEvent"] | undefined {
  const reversed = [...events].reverse();
  const direct = reversed.find((event): event is RoomLoopAcceptedMessage["topicEvent"] => {
    if (event.event_type !== "topic.created" && event.event_type !== "topic.updated") {
      return false;
    }
    if (!event.refs.includes(messageEventId)) {
      return false;
    }
    const payload = objectPayload(event.payload);
    return (stringValue(payload.topicId) ?? stringValue(payload.topic_id)) === topicId;
  });
  if (direct !== undefined) {
    return direct;
  }
  return reversed.find((event): event is RoomLoopAcceptedMessage["topicEvent"] => {
    if (event.event_type !== "topic.created" && event.event_type !== "topic.updated") {
      return false;
    }
    const payload = objectPayload(event.payload);
    return (stringValue(payload.topicId) ?? stringValue(payload.topic_id)) === topicId;
  });
}

function topicIdForMessageEvent(events: readonly RoomEvent[], messageEvent: RoomEvent): string | undefined {
  const messagePayload = objectPayload(messageEvent.payload);
  const directTopicId = stringValue(messagePayload.topicId) ?? stringValue(messagePayload.topic_id);
  if (directTopicId) {
    return directTopicId;
  }
  const topicEvent = [...events].reverse().find((event) => {
    if (event.event_type !== "topic.created" && event.event_type !== "topic.updated") {
      return false;
    }
    return event.refs.includes(messageEvent.event_id);
  });
  const topicPayload = objectPayload(topicEvent?.payload);
  return stringValue(topicPayload.topicId) ?? stringValue(topicPayload.topic_id);
}

function hasAutonomousMessageForRef(events: readonly RoomEvent[], ref: string): boolean {
  return events.some((event) => {
    if (event.event_type !== "message.created") return false;
    const payload = objectPayload(event.payload);
    const author = stringValue(payload.author) ?? event.actor.id;
    if (author !== "room_rhythm") return false;
    return arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)).includes(ref);
  });
}

function backgroundPressureHoldRefs(events: readonly RoomEvent[]): string[] {
  const latestPressure = [...events].reverse().find((event) => event.event_type === "room.pressure_detected");
  if (latestPressure) {
    return uniqueRefs([latestPressure.event_id, ...latestPressure.refs]);
  }
  const latestVisible = latestVisibleConversationEvent(events);
  return latestVisible ? [latestVisible.event_id] : [];
}

function isArchiveRelevantEvent(event: RoomEvent, events: readonly RoomEvent[]): boolean {
  if (isAutonomyCorrelatedEvent(event)) {
    return false;
  }
  if (event.event_type === "message.created") {
    const payload = objectPayload(event.payload);
    const author = stringValue(payload.author) ?? event.actor.id;
    const authorKind = stringValue(payload.authorKind) ?? stringValue(payload.author_kind) ?? event.actor.kind;
    const messageId = stringValue(payload.messageId) ?? stringValue(payload.message_id);
    return messageId !== "msg_http_runtime_ready" && author !== "room_rhythm" && (authorKind === "user" || authorKind === "agent");
  }
  if (event.event_type === "agent.invited") {
    return stringValue(objectPayload(event.payload).invitedBy) === "agent_intention";
  }
  if (event.event_type === "room.pressure_detected") {
    return false;
  }
  if (event.event_type === "agent.provider_degraded") {
    return false;
  }
  return [
    "memory.proposed",
    "memory.contested",
    "memory.accepted",
    "memory.stale",
    "memory.retired",
    "memory.reviewed",
    "topic.proposed",
    "topic.responded",
    "topic.applied",
    "topic.reviewed",
    "handoff.proposed",
    "handoff.responded",
    "handoff.reviewed",
    "agent.invitation_reviewed",
    "protocol.proposed",
    "protocol.responded",
    "protocol.retired",
    "protocol.expired",
    "persona_delta.proposed",
    "persona_delta.responded",
    "persona_delta.reviewed",
    "archive.reviewed",
    "archive.repair_proposed",
    "archive.repair_responded",
    "archive.repair_reviewed",
    "archive.repair_applied",
    "room.memory_pressure_detected",
    "side_effect.requested",
    "side_effect.reviewed",
    "side_effect.approved",
    "side_effect.expired",
    "side_effect.result_reported",
    "workspace.artifact_shared",
    "workspace.artifact_reviewed",
    "skill.capsule_reviewed",
    "capability.reviewed",
    "mixed_review_pressure.reviewed",
    "open_question.responded",
  ].includes(event.event_type);
}

function isAutonomyCorrelatedEvent(event: RoomEvent): boolean {
  return isAutonomyCorrelationId(event.correlation_id);
}

function isAutonomyCorrelationId(correlationId: string | undefined): boolean {
  return correlationId?.startsWith("autonomy:") === true || correlationId?.startsWith("autonomy_tick:") === true;
}

function refsIncludeAutonomyCorrelatedEvent(events: readonly RoomEvent[], refs: readonly unknown[]): boolean {
  const refSet = new Set(uniqueRefs(refs));
  if (refSet.size === 0) {
    return false;
  }
  return events.some((event) => refSet.has(event.event_id) && isAutonomyCorrelatedEvent(event));
}

function eventIndex(events: readonly RoomEvent[], event: RoomEvent): number {
  return events.findIndex((item) => item.event_id === event.event_id);
}

type AutonomousSilenceReentryCarry = {
  action: Extract<RuntimeAutonomyTickSummary["action"], "silence_reentry">;
  reason: string;
  anchorEventId: string;
  triggeringMessageEventId: string;
  topicId: string;
  preservedSilenceRef: string;
  archiveRef?: string;
  wakeScope: string;
  targetRefs: string[];
  contextRefs: string[];
  evidenceRefs: string[];
};

type AutonomousIdleSocialRhythmCarry = {
  action: Extract<RuntimeAutonomyTickSummary["action"], "idle_social_rhythm">;
  reason: string;
  anchorEventId: string;
  triggeringMessageEventId: string;
  topicId: string;
  wakeScope: string;
  targetRefs: string[];
  contextRefs: string[];
  evidenceRefs: string[];
};

function nextIdleSocialRhythmCarry(
  events: readonly RoomEvent[],
  input: { now: string; idleSocialAfterMs?: number },
): AutonomousIdleSocialRhythmCarry | undefined {
  if (input.idleSocialAfterMs === undefined || !Number.isFinite(input.idleSocialAfterMs)) {
    return undefined;
  }
  const idleSocialAfterMs = Math.max(0, Math.floor(input.idleSocialAfterMs));
  const latestVisible = latestVisibleConversationEvent(events);
  if (!latestVisible) {
    return undefined;
  }
  const topicId = topicIdForMessageEvent(events, latestVisible);
  if (!topicId) {
    return undefined;
  }

  const latestIdleTick = latestAutonomyActionEvent(events, "idle_social_rhythm");
  const latestAnchor = latestByOccurrence([latestVisible, latestIdleTick]);
  if (!latestAnchor) {
    return undefined;
  }

  const quietMs = Date.parse(input.now) - Date.parse(latestAnchor.occurred_at);
  if (!Number.isFinite(quietMs) || quietMs < idleSocialAfterMs) {
    return undefined;
  }

  const contextRefs = uniqueRefs([latestVisible.event_id, latestAnchor.event_id, topicId]);
  return {
    action: "idle_social_rhythm",
    reason:
      "The room became quiet after a real conversation message, so autonomy re-opened wake on that message without adding a scripted prompt.",
    anchorEventId: latestAnchor.event_id,
    triggeringMessageEventId: latestVisible.event_id,
    topicId,
    wakeScope: `idle_social:${latestVisible.event_id}:${latestAnchor.event_id}`,
    targetRefs: [latestVisible.event_id, latestAnchor.event_id],
    contextRefs,
    evidenceRefs: contextRefs,
  };
}

function nextSilenceReentryCarry(
  events: readonly RoomEvent[],
  input: { now: string; silenceReentryAfterMs: number },
): AutonomousSilenceReentryCarry | undefined {
  const latestRelevant = latestArchiveRelevantEvent(events);
  if (!latestRelevant) {
    return undefined;
  }
  const latestVisible = latestVisibleConversationEvent(events);
  if (!latestVisible) {
    return undefined;
  }
  const topicId = topicIdForMessageEvent(events, latestVisible);
  if (!topicId) {
    return undefined;
  }
  if (hasAutonomousActionAfter(events, "silence_reentry", latestRelevant)) {
    return undefined;
  }
  const latestRelevantIndex = eventIndex(events, latestRelevant);
  const preservedSilenceTick = latestAutonomousActionForRefSinceIndex(
    events,
    "stay_silent",
    latestRelevant.event_id,
    latestRelevantIndex,
  );
  if (preservedSilenceTick === undefined) {
    return undefined;
  }

  const quietMs = Date.parse(input.now) - Date.parse(latestRelevant.occurred_at);
  if (!Number.isFinite(quietMs) || quietMs < input.silenceReentryAfterMs) {
    return undefined;
  }

  const latestArchive = latestDailyArchiveEvent(events);
  const archiveRef = latestArchive ? archiveRefFromDailyArchiveEvent(latestArchive) : undefined;
  const preservedSilencePayload = objectPayload(preservedSilenceTick.payload);
  const preservedSilenceTickId =
    stringValue(preservedSilencePayload.tickId) ?? stringValue(preservedSilencePayload.tick_id) ?? preservedSilenceTick.event_id;
  const contextRefs = uniqueRefs([
    latestVisible.event_id,
    latestRelevant.event_id,
    preservedSilenceTick.event_id,
    preservedSilenceTickId,
    archiveRef,
    topicId,
  ]);
  return {
    action: "silence_reentry",
    reason:
      "No new room-visible sediment arrived past the silence re-entry threshold, so autonomy re-opened wake on the latest real message without adding a scripted prompt.",
    anchorEventId: latestRelevant.event_id,
    triggeringMessageEventId: latestVisible.event_id,
    topicId,
    preservedSilenceRef: preservedSilenceTick.event_id,
    archiveRef,
    wakeScope: `silence_reentry:${latestVisible.event_id}:${latestRelevant.event_id}:${preservedSilenceTick.event_id}`,
    targetRefs: uniqueRefs([latestVisible.event_id, latestRelevant.event_id, preservedSilenceTick.event_id, archiveRef]),
    contextRefs,
    evidenceRefs: contextRefs,
  };
}

function latestVisibleConversationEvent(events: readonly RoomEvent[]): RoomEvent | undefined {
  return [...events].reverse().find((event) => {
    if (event.event_type !== "message.created") return false;
    const payload = objectPayload(event.payload);
    const author = stringValue(payload.author) ?? event.actor.id;
    const authorKind = stringValue(payload.authorKind) ?? stringValue(payload.author_kind) ?? event.actor.kind;
    const messageId = stringValue(payload.messageId) ?? stringValue(payload.message_id);
    return messageId !== "msg_http_runtime_ready" && author !== "room_rhythm" && (authorKind === "user" || authorKind === "agent");
  });
}

function latestAutonomyActionEvent(
  events: readonly RoomEvent[],
  action: RuntimeAutonomyTickSummary["action"],
): RoomEvent | undefined {
  return [...events].reverse().find((event) => {
    if (event.event_type !== "room.autonomy_tick") return false;
    return autonomyTickAction(objectPayload(event.payload).action) === action;
  });
}

function latestByOccurrence(events: readonly (RoomEvent | undefined)[]): RoomEvent | undefined {
  return events
    .filter((event): event is RoomEvent => event !== undefined)
    .sort((left, right) => Date.parse(right.occurred_at) - Date.parse(left.occurred_at))[0];
}

function topicRefsFromEvent(event: RoomEvent | undefined): string[] {
  if (!event) {
    return [];
  }
  const payload = objectPayload(event.payload);
  return uniqueRefs([
    stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    ...arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs)).filter((ref) => ref.startsWith("topic_")),
  ]);
}

function hasAutonomousActionAfter(
  events: readonly RoomEvent[],
  action: RuntimeAutonomyTickSummary["action"],
  anchor: RoomEvent,
): boolean {
  const anchorIndex = eventIndex(events, anchor);
  return events.some((event, index) => {
    if (index <= anchorIndex || event.event_type !== "room.autonomy_tick") {
      return false;
    }
    return autonomyTickAction(objectPayload(event.payload).action) === action;
  });
}

function hasAutonomousActionForRef(
  events: readonly RoomEvent[],
  action: RuntimeAutonomyTickSummary["action"],
  ref: string,
): boolean {
  return hasAutonomousActionForRefSinceIndex(events, action, ref, -1);
}

function hasAutonomousActionForRefSinceIndex(
  events: readonly RoomEvent[],
  action: RuntimeAutonomyTickSummary["action"],
  ref: string,
  afterIndex: number,
): boolean {
  return latestAutonomousActionForRefSinceIndex(events, action, ref, afterIndex) !== undefined;
}

function latestAutonomousActionForRefSinceIndex(
  events: readonly RoomEvent[],
  action: RuntimeAutonomyTickSummary["action"],
  ref: string,
  afterIndex: number,
): RoomEvent | undefined {
  for (let index = events.length - 1; index > afterIndex; index -= 1) {
    const event = events[index];
    if (!event || event.event_type !== "room.autonomy_tick") {
      continue;
    }
    if (autonomyTickAction(objectPayload(event.payload).action) !== action) {
      continue;
    }
    if (autonomyTickEventRefs(event).includes(ref)) {
      return event;
    }
  }
  return undefined;
}

function autonomyTickEventRefs(event: RoomEvent): string[] {
  const payload = objectPayload(event.payload);
  return uniqueRefs(
    event.refs
      .concat(arrayOfStrings(payload.targetRefs))
      .concat(arrayOfStrings(payload.target_refs))
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .concat(arrayOfStrings(payload.evidenceRefs))
      .concat(arrayOfStrings(payload.evidence_refs)),
  );
}

function latestDailyArchiveEvent(events: readonly RoomEvent[]): RoomEvent | undefined {
  return [...events].reverse().find((event) => event.event_type === "daily_archive.created");
}

function archiveRefFromDailyArchiveEvent(event: RoomEvent): string | undefined {
  const payload = objectPayload(event.payload);
  const archivePayload = objectPayload(payload.archive);
  return stringValue(payload.archiveId) ?? stringValue(payload.archive_id) ?? stringValue(archivePayload.archiveId);
}

type AutonomousSocialCarry = {
  action: Extract<
    RuntimeAutonomyTickSummary["action"],
    | "memory_hygiene_review"
    | "continuity_review"
    | "provider_boundary_review"
    | "open_question_revisit"
    | "invitation_review"
    | "handoff_review"
  >;
  content: string;
  reason: string;
  targetRefs: string[];
  contextRefs: string[];
  evidenceRefs: string[];
};

function isAutonomousReviewCarryAction(action: AutonomousSocialCarry["action"]): boolean {
  return (
    action === "memory_hygiene_review" ||
    action === "continuity_review" ||
    action === "provider_boundary_review" ||
    action === "open_question_revisit" ||
    action === "invitation_review" ||
    action === "handoff_review"
  );
}

type AcceptedMemoryHygieneCandidate = RuntimeMemoryClaimSummary & {
  hygieneAnchorAt: string;
  hygieneAnchorEventId: string | undefined;
  hygieneAnchorIndex: number;
  hygieneAgeMs: number;
};

type ContinuityDeltaSummary = RuntimePersonaSummary["evolutionLog"][number] & {
  agentId: string;
};

type AcceptedContinuityReviewCandidate = ContinuityDeltaSummary & {
  continuityAnchorAt: string;
  continuityAnchorEventId: string;
  continuityAnchorIndex: number;
  continuityAgeMs: number;
};

function autonomySocialClientMessageId(carry: AutonomousSocialCarry): string {
  const refs = uniqueRefs([...carry.targetRefs, ...carry.contextRefs, ...carry.evidenceRefs]);
  const readable = stableRefSuffix(carry.action, ...(carry.targetRefs.length > 0 ? carry.targetRefs : refs)).slice(0, 72);
  const fingerprint = createHash("sha256")
    .update([carry.action, ...refs].join("|"))
    .digest("hex")
    .slice(0, 12);
  return `autonomy_${readable}_${fingerprint}`;
}

function nextAutonomousSocialCarry(
  events: readonly RoomEvent[],
  input: { now?: string; memoryHygieneReviewAfterMs?: number; continuityReviewAfterMs?: number } = {},
): AutonomousSocialCarry | undefined {
  return autonomousSocialCarryCandidates(events, input)[0];
}

function acceptedMemoryHygieneCandidates(
  events: readonly RoomEvent[],
  input: {
    claims: readonly RuntimeMemoryClaimSummary[];
    now?: string;
    memoryHygieneReviewAfterMs: number;
    latestArchiveIndex: number;
  },
): AcceptedMemoryHygieneCandidate[] {
  const nowMs = Date.parse(input.now ?? new Date().toISOString());
  if (!Number.isFinite(nowMs)) {
    return [];
  }

  return input.claims
    .filter((claim) => claim.state === "accepted")
    .map((claim) => {
      const anchorEvent = latestAcceptedMemoryHygieneAnchorEvent(events, claim.memoryId);
      const hygieneAnchorAt = anchorEvent?.occurred_at ?? claim.lastReviewedAt;
      const anchorMs = Date.parse(hygieneAnchorAt ?? "");
      if (!hygieneAnchorAt || !Number.isFinite(anchorMs)) {
        return undefined;
      }
      const hygieneAnchorIndex = anchorEvent ? eventIndex(events, anchorEvent) : -1;
      const carrySinceIndex = Math.max(input.latestArchiveIndex, hygieneAnchorIndex);
      const hygieneAgeMs = nowMs - anchorMs;
      if (hygieneAgeMs < input.memoryHygieneReviewAfterMs) {
        return undefined;
      }
      if (hasAutonomousActionForRefSinceIndex(events, "memory_hygiene_review", claim.memoryId, carrySinceIndex)) {
        return undefined;
      }
      return {
        ...claim,
        hygieneAnchorAt,
        hygieneAnchorEventId: anchorEvent?.event_id,
        hygieneAnchorIndex,
        hygieneAgeMs,
      };
    })
    .filter((claim): claim is AcceptedMemoryHygieneCandidate => claim !== undefined)
    .sort(
      (left, right) =>
        Date.parse(left.hygieneAnchorAt) - Date.parse(right.hygieneAnchorAt) ||
        left.memoryId.localeCompare(right.memoryId),
    );
}

function latestAcceptedMemoryHygieneAnchorEvent(events: readonly RoomEvent[], memoryRef: string): RoomEvent | undefined {
  const candidates = events.filter((event) => {
    if (!isMemoryLifecycleOrReviewEvent(event.event_type)) {
      return false;
    }
    const payload = objectPayload(event.payload);
    const ref =
      stringValue(payload.memoryRef) ??
      stringValue(payload.memory_ref) ??
      stringValue(payload.memoryId) ??
      stringValue(payload.memory_id);
    return ref === memoryRef;
  });
  return candidates.sort(
    (left, right) =>
      Date.parse(right.occurred_at) - Date.parse(left.occurred_at) ||
      eventIndex(events, right) - eventIndex(events, left),
  )[0];
}

function isMemoryLifecycleOrReviewEvent(eventType: string): boolean {
  return (
    eventType === "memory.observed" ||
    eventType === "memory.proposed" ||
    eventType === "memory.contested" ||
    eventType === "memory.accepted" ||
    eventType === "memory.stale" ||
    eventType === "memory.retired" ||
    eventType === "memory.reviewed"
  );
}

function acceptedContinuityReviewCandidates(
  events: readonly RoomEvent[],
  input: {
    deltas: readonly ContinuityDeltaSummary[];
    now?: string;
    continuityReviewAfterMs: number;
    latestArchiveIndex: number;
  },
): AcceptedContinuityReviewCandidate[] {
  const nowMs = Date.parse(input.now ?? new Date().toISOString());
  if (!Number.isFinite(nowMs)) {
    return [];
  }

  return input.deltas
    .filter((delta) => delta.status === "accepted")
    .filter((delta) => delta.field === "roleClaims" || delta.field === "dailyMood")
    .map((delta) => {
      const anchorEvent = latestContinuityReviewAnchorEvent(events, delta.deltaId);
      const continuityAnchorAt = anchorEvent?.occurred_at;
      const anchorMs = Date.parse(continuityAnchorAt ?? "");
      if (!anchorEvent || !continuityAnchorAt || !Number.isFinite(anchorMs)) {
        return undefined;
      }
      const continuityAnchorIndex = eventIndex(events, anchorEvent);
      const carrySinceIndex = Math.max(input.latestArchiveIndex, continuityAnchorIndex);
      const continuityAgeMs = nowMs - anchorMs;
      if (continuityAgeMs < input.continuityReviewAfterMs) {
        return undefined;
      }
      if (hasAutonomousActionForRefSinceIndex(events, "continuity_review", delta.deltaId, carrySinceIndex)) {
        return undefined;
      }
      return {
        ...delta,
        continuityAnchorAt,
        continuityAnchorEventId: anchorEvent.event_id,
        continuityAnchorIndex,
        continuityAgeMs,
      };
    })
    .filter((delta): delta is AcceptedContinuityReviewCandidate => delta !== undefined)
    .sort(
      (left, right) =>
        Date.parse(left.continuityAnchorAt) - Date.parse(right.continuityAnchorAt) ||
        left.deltaId.localeCompare(right.deltaId),
    );
}

function latestContinuityReviewAnchorEvent(events: readonly RoomEvent[], deltaRef: string): RoomEvent | undefined {
  const candidates = events.filter((event) => {
    if (!isContinuityLifecycleOrReviewEvent(event.event_type)) {
      return false;
    }
    return personaDeltaRefFromEvent(event) === deltaRef;
  });
  return candidates.sort(
    (left, right) =>
      Date.parse(right.occurred_at) - Date.parse(left.occurred_at) ||
      eventIndex(events, right) - eventIndex(events, left),
  )[0];
}

function isContinuityLifecycleOrReviewEvent(eventType: string): boolean {
  return (
    eventType === "persona_delta.proposed" ||
    eventType === "persona_delta.responded" ||
    eventType === "persona_delta.reviewed"
  );
}

function personaDeltaRefFromEvent(event: RoomEvent): string | undefined {
  const payload = objectPayload(event.payload);
  return (
    stringValue(payload.deltaRef) ??
    stringValue(payload.delta_ref) ??
    stringValue(payload.deltaId) ??
    stringValue(payload.delta_id) ??
    stringValue(payload.personaDeltaRef) ??
    stringValue(payload.persona_delta_ref)
  );
}

function autonomousSocialCarryCandidates(
  events: readonly RoomEvent[],
  input: { now?: string; memoryHygieneReviewAfterMs?: number; continuityReviewAfterMs?: number } = {},
): AutonomousSocialCarry[] {
  const candidates: AutonomousSocialCarry[] = [];
  const socialState = projectSocialState(events);
  const latestArchive = latestDailyArchiveEvent(events);
  const latestArchiveIndex = latestArchive ? eventIndex(events, latestArchive) : -1;
  const latestArchiveRef = latestArchive ? archiveRefFromDailyArchiveEvent(latestArchive) : undefined;
  const latestArchiveEventId = latestArchive?.event_id;
  const providerBoundaryRef = socialState.providerBoundaries.find((boundary) => boundary.status === "degraded")?.boundaryId;
  const providerBoundaries = socialState.providerBoundaries
    .filter((boundary) => boundary.status === "degraded")
    .filter(
      (boundary) =>
        !refsIncludeAutonomyCorrelatedEvent(events, [
          boundary.boundaryId,
          boundary.triggeringEventId,
          ...boundary.sourceRefs,
        ]),
    )
    .filter((boundary) => !hasAutonomousActionForRefSinceIndex(events, "provider_boundary_review", boundary.boundaryId, latestArchiveIndex))
    .slice(0, 5);
  if (providerBoundaries.length > 0) {
    const contextRefs = uniqueRefs(
      [
        ...providerBoundaries.map((boundary) => boundary.boundaryId),
        ...providerBoundaries.flatMap((boundary) => boundary.sourceRefs),
        ...providerBoundaries.flatMap((boundary) => [
          boundary.triggeringEventId,
          boundary.packetId,
          ...boundary.choicePressure.repairRequestRefs,
          ...boundary.choicePressure.deniedRepairRequestRefs,
          ...boundary.choicePressure.approvedRepairRequestRefs,
          ...boundary.choicePressure.resultRefs,
          ...boundary.choicePressure.retryProtocolRefs,
          ...boundary.choicePressure.retiredRetryProtocolRefs,
          ...boundary.choicePressure.silenceRefs,
          ...boundary.choicePressure.contestedMemoryRefs,
          ...boundary.choicePressure.archiveCarryoverRefs,
        ]),
        latestArchiveRef,
        latestArchiveEventId,
      ],
    );
    candidates.push({
      action: "provider_boundary_review",
      content:
        "房间自动节律：provider boundary review。这里有仍处于 degraded 的运行时边界，请自愿提出更窄的 repair request、retry etiquette、退休证据、handoff 给更合适的 agent，或继续沉默。provider boundary 是 runtime availability，不是 agent 的沉默、人格、共识、自动修复许可或 memory truth。",
      reason:
        "Ledger projection found degraded provider boundaries that have not yet been carried by autonomous room rhythm since the latest archive.",
      targetRefs: uniqueRefs(providerBoundaries.map((boundary) => boundary.boundaryId)),
      contextRefs,
      evidenceRefs: contextRefs,
    });
  }
  const pendingMemoryRefs = socialState.memoryClaims
    .filter((claim) => ["proposed", "contested", "stale"].includes(claim.state))
    .filter((claim) => !hasAutonomousActionForRefSinceIndex(events, "memory_hygiene_review", claim.memoryId, latestArchiveIndex))
    .slice(0, 5);
  const acceptedMemoryRefs = acceptedMemoryHygieneCandidates(events, {
    claims: socialState.memoryClaims,
    now: input.now,
    memoryHygieneReviewAfterMs: nonNegativeIntegerOrDefault(
      input.memoryHygieneReviewAfterMs,
      DEFAULT_MEMORY_HYGIENE_REVIEW_AFTER_MS,
    ),
    latestArchiveIndex,
  }).slice(0, Math.max(0, 5 - pendingMemoryRefs.length));
  const memoryRefs = pendingMemoryRefs.concat(acceptedMemoryRefs);
  if (memoryRefs.length > 0) {
    const contextRefs = uniqueRefs(
      [
        ...memoryRefs.map((claim) => claim.memoryId),
        ...memoryRefs.flatMap((claim) => claim.sourceRefs),
        ...acceptedMemoryRefs.flatMap((claim) => [claim.hygieneAnchorEventId]),
        latestArchiveRef,
        latestArchiveEventId,
        providerBoundaryRef,
      ],
    );
    const acceptedDueCount = acceptedMemoryRefs.length;
    candidates.push({
      action: "memory_hygiene_review",
      content: acceptedDueCount > 0
        ? "房间自动节律：memory hygiene check-in。这里有未沉淀干净或已接受但到期复盘的公共记忆，请自愿 review、contest、mark stale、retire、提出更窄问题、handoff 给更合适的 agent，或继续沉默。accepted 仍只是 provisional sediment，不要把这当成自动验真或共识生成。"
        : "房间自动节律：memory hygiene check-in。这里有未沉淀干净的公共记忆，请自愿 review、contest、mark stale、retire、提出更窄问题、handoff 给更合适的 agent，或继续沉默。不要把这当成自动验真或共识生成。",
      reason: acceptedDueCount > 0
        ? "Ledger projection found pending memory claims or accepted memory whose latest lifecycle/review anchor exceeded the hygiene interval without a fresh autonomous carry."
        : "Ledger projection found proposed, contested, or stale memory claims that have not yet been carried by autonomous room rhythm.",
      targetRefs: uniqueRefs(memoryRefs.map((claim) => claim.memoryId)),
      contextRefs,
      evidenceRefs: contextRefs,
    });
  }

  const continuityDeltas = socialState.personas.flatMap((persona) =>
    persona.evolutionLog.map((delta) => ({
      ...delta,
      agentId: persona.agentId,
    })),
  );
  const pendingContinuityRefs = continuityDeltas
    .filter((delta) => ["proposed", "revised", "contested"].includes(delta.status))
    .filter((delta) => delta.field === "roleClaims" || delta.field === "dailyMood")
    .filter((delta) => !hasAutonomousActionForRefSinceIndex(events, "continuity_review", delta.deltaId, latestArchiveIndex))
    .slice(0, 5);
  const acceptedContinuityRefs = acceptedContinuityReviewCandidates(events, {
    deltas: continuityDeltas,
    now: input.now,
    continuityReviewAfterMs: nonNegativeIntegerOrDefault(
      input.continuityReviewAfterMs,
      DEFAULT_CONTINUITY_REVIEW_AFTER_MS,
    ),
    latestArchiveIndex,
  }).slice(0, Math.max(0, 5 - pendingContinuityRefs.length));
  const continuityRefs = pendingContinuityRefs.concat(acceptedContinuityRefs);
  if (continuityRefs.length > 0) {
    const contextRefs = uniqueRefs(
      [
        ...continuityRefs.map((delta) => delta.deltaId),
        ...continuityRefs.flatMap((delta) => delta.sourcePressureRefs),
        ...acceptedContinuityRefs.flatMap((delta) => [delta.continuityAnchorEventId]),
        latestArchiveRef,
        latestArchiveEventId,
        providerBoundaryRef,
      ],
    );
    const fields = uniqueRefs(continuityRefs.map((delta) => delta.field)).join(", ");
    const acceptedDueCount = acceptedContinuityRefs.length;
    candidates.push({
      action: "continuity_review",
      content: acceptedDueCount > 0
        ? `房间自动节律：agent continuity check-in。这里有待复盘或已接受但到期复盘的 ${fields || "identity"} sediment，请自愿审阅 role claim / daily mood 是否仍由 ledger 证据支撑；可以接受、contest、retire、提出修订、邀请相关 agent，或沉默。accepted continuity 仍只是 reversible evidence，不是固定职责。`
        : `房间自动节律：agent continuity check-in。这里有待复盘的 ${fields || "identity"} sediment，请自愿审阅 role claim / daily mood 是否仍由 ledger 证据支撑；可以接受、contest、retire、提出修订、邀请相关 agent，或沉默。不要把 continuity 当成固定职责。`,
      reason: acceptedDueCount > 0
        ? "Ledger projection found pending continuity records or accepted role-claim/daily-mood continuity whose latest lifecycle/review anchor exceeded the review interval without a fresh autonomous carry."
        : "Ledger projection found pending role-claim or daily-mood continuity records that have not yet been carried by autonomous room rhythm.",
      targetRefs: uniqueRefs(continuityRefs.map((delta) => delta.deltaId)),
      contextRefs,
      evidenceRefs: contextRefs,
    });
  }

  const openQuestions = socialState.openQuestions
    .filter(
      (question) =>
        !refsIncludeAutonomyCorrelatedEvent(events, [
          question.questionId,
          ...question.sourceRefs,
          ...question.contextRefs,
        ]),
    )
    .filter((question) => !hasAutonomousActionForRefSinceIndex(events, "open_question_revisit", question.questionId, latestArchiveIndex))
    .slice(0, 5);
  if (openQuestions.length > 0) {
    const contextRefs = uniqueRefs(
      [
        ...openQuestions.map((question) => question.questionId),
        ...openQuestions.flatMap((question) => question.sourceRefs),
        ...openQuestions.flatMap((question) => question.contextRefs),
        latestArchiveRef,
        latestArchiveEventId,
        providerBoundaryRef,
      ],
    );
    candidates.push({
      action: "open_question_revisit",
      content:
        "房间自动节律：open question revisit。这里还有未关闭的问题，请自愿提出更窄追问、回应、质疑、邀请更合适的 agent、handoff，或继续沉默。不要把重访当成要求回答或关闭问题。",
      reason:
        "Ledger projection found unresolved open questions that have not yet received a dedicated autonomous revisit.",
      targetRefs: uniqueRefs(openQuestions.map((question) => question.questionId)),
      contextRefs,
      evidenceRefs: contextRefs,
    });
  }

  const handoffs = socialState.handoffs
    .filter((handoff) => ["proposed", "challenged", "delegated"].includes(handoff.status))
    .filter((handoff) => !hasAutonomousActionForRefSinceIndex(events, "handoff_review", handoff.handoffId, latestArchiveIndex))
    .slice(0, 5);
  if (handoffs.length > 0) {
    const contextRefs = uniqueRefs(
      [
        ...handoffs.map((handoff) => handoff.handoffId),
        ...handoffs.flatMap((handoff) => handoff.sourcePressureRefs),
        latestArchiveRef,
        latestArchiveEventId,
        providerBoundaryRef,
      ],
    );
    candidates.push({
      action: "handoff_review",
      content:
        "房间自动节律：handoff review。这里有未决 handoff packet，请自愿接受、拒绝、challenge、delegate 给更合适的 agent、提出更窄回应，或继续沉默。不要把 handoff 当成控制权转移或任务分派。",
      reason:
        "Ledger projection found proposed or challenged handoff packets that have not yet received a dedicated autonomous review invitation.",
      targetRefs: uniqueRefs(handoffs.map((handoff) => handoff.handoffId)),
      contextRefs,
      evidenceRefs: contextRefs,
    });
  }

  const invitations = socialState.invitations
    .filter((invitation) => invitation.status === "invited")
    .filter((invitation) => !/handoff proposal opened/i.test(invitation.boundaryNote))
    .filter(
      (invitation) =>
        !invitation.contextRefs.some((ref) => ref.startsWith("handoff_") && hasAutonomousActionForRef(events, "handoff_review", ref)),
    )
    .filter((invitation) => !hasAutonomousActionForRefSinceIndex(events, "invitation_review", invitation.invitationId, latestArchiveIndex))
    .slice(0, 5);
  if (invitations.length > 0) {
    const contextRefs = uniqueRefs(
      [
        ...invitations.map((invitation) => invitation.invitationId),
        ...invitations.flatMap((invitation) => invitation.contextRefs),
        ...invitations.flatMap((invitation) => invitation.sourcePressureRefs),
        latestArchiveRef,
        latestArchiveEventId,
        providerBoundaryRef,
      ],
    );
    candidates.push({
      action: "invitation_review",
      content:
        "房间自动节律：invitation review。这里有未回应的 social knock，请自愿回应、challenge、delegate、提出更窄问题，或继续沉默。不要把 invitation 当成点名、命令或职责分配。",
      reason:
        "Ledger projection found invited social knocks that have not yet been carried by autonomous room rhythm.",
      targetRefs: uniqueRefs(invitations.map((invitation) => invitation.invitationId)),
      contextRefs,
      evidenceRefs: contextRefs,
    });
  }

  return candidates.sort((left, right) => {
    const leftLastIndex = lastAutonomousActionIndex(events, left.action);
    const rightLastIndex = lastAutonomousActionIndex(events, right.action);
    if (leftLastIndex !== rightLastIndex) {
      return leftLastIndex - rightLastIndex;
    }
    return autonomousSocialActionOrder(left.action) - autonomousSocialActionOrder(right.action);
  });
}

function lastAutonomousActionIndex(events: readonly RoomEvent[], action: RuntimeAutonomyTickSummary["action"]): number {
  let lastIndex = -1;
  events.forEach((event, index) => {
    if (event.event_type !== "room.autonomy_tick") {
      return;
    }
    if (autonomyTickAction(objectPayload(event.payload).action) === action) {
      lastIndex = index;
    }
  });
  return lastIndex;
}

function autonomousSocialActionOrder(action: RuntimeAutonomyTickSummary["action"]): number {
  switch (action) {
    case "memory_hygiene_review":
      return 0;
    case "continuity_review":
      return 1;
    case "provider_boundary_review":
      return 2;
    case "open_question_revisit":
      return 3;
    case "handoff_review":
      return 4;
    case "invitation_review":
      return 5;
    default:
      return 99;
  }
}

function projectPersonas(events: readonly RoomEvent[]): RuntimePersonaSummary[] {
  const service = new PersonaService({
    profiles: seedPersonaProfiles(),
    events: [...events],
  });
  return seedAgents.map((agent) => {
    const projection = service.getProjection(agent.agentId);
    return {
      agentId: agent.agentId,
      displayName: agent.displayName,
      initialPosture: projection.profile.initialPosture,
      dailyMood: projection.profile.dailyMood?.posture,
      dailyMoodRecord: projection.profile.dailyMood
        ? runtimeDailyMoodRecord(projection)
        : undefined,
      habits: projection.profile.habits,
      personality: projection.profile.personality ?? [],
      roleClaims: projection.profile.roleClaims.map((claim) => ({
        roleClaimId: claim.roleClaimId,
        label: claim.label,
        status: claim.status,
        proposedBy: claim.proposedBy,
        evidenceRefs: claim.evidenceRefs,
        responseRefs: claim.responseRefs ?? [],
        sourcePressureRefs: claim.sourcePressureRefs ?? claim.evidenceRefs.filter(isMixedReviewPressureRef),
        contestRefs: claim.contestRefs,
      })),
      evolutionLog: projection.evolutionLog.map((delta) => ({
        deltaId: delta.deltaId,
        status: delta.status,
        proposedBy: delta.proposedBy,
        revisedFromDeltaRef: delta.revisedFromDeltaRef,
        revisedBy: delta.revisedBy,
        reason: delta.reason,
        field: delta.proposedChange.field,
        operation: delta.proposedChange.operation,
        value: personaDeltaValue(delta.proposedChange.value),
        sourcePressureRefs: delta.sourcePressureRefs ?? delta.evidenceRefs.filter(isMixedReviewPressureRef),
        responseCount: delta.responses.length,
      })),
    };
  });
}

function personaContinuityFragment(
  events: readonly RoomEvent[],
  agentId: AgentId,
  packetId: string,
): ContextFragment {
  const projection = new PersonaService({
    profiles: seedPersonaProfiles(),
    events: [...events],
  }).getProjection(agentId);
  const body = personaContinuityBody(projection);
  const serialized = JSON.stringify(body);
  const tokenEstimate = estimateRuntimeTokens(serialized);
  return {
    id: `persona:${agentId}:${packetId}`,
    type: "persona_projection",
    visibility: "private_agent",
    role: "persona",
    source: { kind: "agent_profile" },
    refs: personaProjectionRefs(projection),
    tokenEstimate,
    hardCap: PERSONA_PROJECTION_HARD_CAP,
    cacheKey: personaProjectionCacheKey(projection),
    priority: 18,
    body: serialized,
  };
}

function personaContinuityBody(projection: PersonaProjection): Record<string, unknown> {
  const recentEvolution = projection.evolutionLog.slice(-6);
  const dailyMoodRecord = projection.profile.dailyMood ? runtimeDailyMoodRecord(projection) : undefined;
  return {
    note:
      "Persona continuity is a bounded projection from room-visible persona deltas plus seed posture. It is not a fixed job, not public memory, and remains contestable through later room-visible interaction.",
    agentId: projection.profile.agentId,
    displayName: projection.profile.displayName,
    initialPosture: projection.profile.initialPosture,
    dailyMood: dailyMoodRecord
      ? {
          date: dailyMoodRecord.date,
          posture: boundedRuntimeText(dailyMoodRecord.posture, 220),
          sourceRef: dailyMoodRecord.sourceRef,
          evidenceRefs: dailyMoodRecord.evidenceRefs.slice(-6),
          responseRefs: dailyMoodRecord.responseRefs.slice(-6),
          boundaryNote: "Daily mood is a reversible continuity hint for this agent's next entrance, not a room assignment or public-memory truth.",
        }
      : undefined,
    activeRoleClaims: projection.profile.roleClaims
      .filter((claim) => claim.status === "accepted" || claim.status === "proposed" || claim.status === "contested")
      .slice(-6)
      .map((claim) => ({
        roleClaimId: claim.roleClaimId,
        label: boundedRuntimeText(claim.label, 180),
        status: claim.status,
        proposedBy: claim.proposedBy,
        evidenceRefs: claim.evidenceRefs.slice(-4),
        responseRefs: (claim.responseRefs ?? []).slice(-4),
        sourcePressureRefs: (claim.sourcePressureRefs ?? claim.evidenceRefs.filter(isMixedReviewPressureRef)).slice(-4),
        contestRefs: claim.contestRefs.slice(-4),
      })),
    habits: projection.profile.habits.slice(-8).map((habit) => boundedRuntimeText(habit, 180)),
    personality: (projection.profile.personality ?? []).slice(-8).map((trait) => boundedRuntimeText(trait, 180)),
    conversationStyle: projection.profile.conversationStyle
      ? {
          voice: boundedRuntimeText(projection.profile.conversationStyle.voice, 180),
          rhythm: boundedRuntimeText(projection.profile.conversationStyle.rhythm, 180),
          boundaries: projection.profile.conversationStyle.boundaries.slice(-5).map((boundary) => boundedRuntimeText(boundary, 180)),
        }
      : undefined,
    recentEvolution: recentEvolution.map((delta) => ({
      deltaId: delta.deltaId,
      status: delta.status,
      field: delta.proposedChange.field,
      operation: delta.proposedChange.operation,
      valueSummary: personaDeltaValue(delta.proposedChange.value),
      reason: boundedRuntimeText(delta.reason, 220),
      responseCount: delta.responses.length,
    })),
  };
}

function runtimeDailyMoodRecord(projection: PersonaProjection): NonNullable<RuntimePersonaSummary["dailyMoodRecord"]> {
  const mood = projection.profile.dailyMood;
  if (!mood) {
    throw new Error("runtimeDailyMoodRecord requires a projected daily mood");
  }
  const acceptedDelta = projection.evolutionLog
    .filter((delta) => delta.proposedChange.field === "dailyMood" && delta.status === "accepted")
    .at(-1);
  const responseRefs = acceptedDelta?.responses
    .filter((response) => response.response === "accept")
    .flatMap((response) => [response.responseId, ...response.evidenceRefs]) ?? [];
  const evidenceRefs = uniqueRefs([
    acceptedDelta?.deltaId,
    ...((acceptedDelta?.evidenceRefs ?? []) as string[]),
    ...responseRefs,
    mood.sourceRef,
  ]);
  return {
    date: mood.date,
    posture: mood.posture,
    sourceRef: mood.sourceRef,
    evidenceRefs,
    responseRefs: uniqueRefs(responseRefs),
    boundaryNote: "Daily mood is a room-visible continuity note from accepted persona evolution; it is not a fixed role, duty, or memory truth.",
  };
}

function auditWithPersonaContinuity(
  audit: ContextPacketAudit,
  fragment: ContextFragment,
  maxTokens: number,
): { audit: ContextPacketAudit; personaIncluded: boolean; personaOmitted: boolean } {
  if (audit.totalTokenEstimate + fragment.tokenEstimate > maxTokens) {
    const omitted: OmittedContextFragment = {
      id: fragment.id,
      type: fragment.type,
      visibility: fragment.visibility,
      tokenEstimate: fragment.tokenEstimate,
      hardCap: fragment.hardCap,
      priority: fragment.priority,
      reason: "context_budget",
      refs: fragment.refs,
    };
    return {
      audit: {
        ...audit,
        omittedFragments: audit.omittedFragments.concat(omitted),
        cacheKey: `${audit.cacheKey}|${fragment.cacheKey}:omitted`,
      },
      personaIncluded: false,
      personaOmitted: true,
    };
  }

  const selectedFragments = audit.selectedFragments.concat(fragment);
  return {
    audit: {
      ...audit,
      selectedFragments,
      totalTokenEstimate: audit.totalTokenEstimate + fragment.tokenEstimate,
      largestFragment: largestAuditFragment(selectedFragments),
      cacheKey: `${audit.cacheKey}|${fragment.cacheKey}`,
    },
    personaIncluded: true,
    personaOmitted: false,
  };
}

function largestAuditFragment(fragments: readonly ContextFragment[]): ContextPacketAudit["largestFragment"] {
  const largest = [...fragments].sort((left, right) => right.tokenEstimate - left.tokenEstimate)[0];
  return largest
    ? {
        id: largest.id,
        type: largest.type,
        tokenEstimate: largest.tokenEstimate,
        hardCap: largest.hardCap,
      }
    : undefined;
}

function personaProjectionRefs(projection: PersonaProjection): string[] {
  return uniqueRefs(
    [
      projection.profile.dailyMood?.sourceRef,
      ...projection.profile.roleClaims.flatMap((claim) => [
        claim.roleClaimId,
        claim.sourceDeltaId,
        ...claim.evidenceRefs,
        ...claim.contestRefs,
      ]),
      ...projection.evolutionLog.flatMap((delta) => [
        delta.deltaId,
        ...delta.evidenceRefs,
        ...(delta.sourcePressureRefs ?? []),
        ...delta.responses.flatMap((response) => [response.responseId, ...response.evidenceRefs]),
      ]),
    ].filter((ref): ref is string => typeof ref === "string" && ref.length > 0),
  );
}

function personaProjectionCacheKey(projection: PersonaProjection): string {
  const evolution = projection.evolutionLog
    .map((delta) => `${delta.deltaId}:${delta.status}:${delta.responses.length}`)
    .join(",");
  const mood = projection.profile.dailyMood
    ? `${projection.profile.dailyMood.date}:${projection.profile.dailyMood.sourceRef ?? projection.profile.dailyMood.posture}`
    : "no_mood";
  return `persona_projection:${projection.profile.agentId}:${mood}:${evolution || "seed"}`;
}

function estimateRuntimeTokens(text: string): number {
  return Math.min(PERSONA_PROJECTION_HARD_CAP, Math.max(1, Math.ceil(text.length / 4)));
}

function boundedRuntimeText(value: string | undefined, maxLength: number): string {
  const text = value ?? "";
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 15))}... [truncated]`;
}

function projectWorkspaces(events: readonly RoomEvent[]): RuntimeWorkspaceSummary[] {
  const view = WorkspaceStore.fromEvents([...events]).view();
  const agentsById = new Map(seedAgents.map((agent) => [agent.agentId, agent.displayName]));
  return view.workspaces.map((workspace) => ({
    workspaceId: workspace.workspaceId,
    agentId: workspace.agentId,
    displayName: agentsById.get(workspace.agentId) ?? workspace.agentId,
    privateHome: workspace.privateHome,
    scratchPath: workspace.scratchPath,
    visibility: workspace.visibility,
    sharedArtifactCount: workspace.sharedArtifactRefs.length,
    sharedArtifactRefs: workspace.sharedArtifactRefs,
    boundaryNote: workspace.boundaryNote,
  }));
}

function projectSkillCapsules(events: readonly RoomEvent[]): RuntimeSkillCapsuleSummary[] {
  const view = SkillRegistryStore.fromEvents([...events]).view();
  const agentsById = new Map(seedAgents.map((agent) => [agent.agentId, agent.displayName]));
  return view.capsules.map((capsule) => ({
    capsuleId: capsule.capsuleId,
    agentId: capsule.agentId,
    displayName: agentsById.get(capsule.agentId) ?? capsule.agentId,
    label: capsule.label,
    summary: capsule.summary,
    triggerHints: capsule.triggerHints,
    sideEffectKinds: capsule.sideEffectKinds,
    approvalRequired: capsule.approvalRequired,
    disclosurePolicy: capsule.disclosurePolicy,
    instructionRef: capsule.instructionRef,
    inputContract: capsule.inputContract,
    outputContract: capsule.outputContract,
    approvalProfile: {
      approvalRequired: capsule.approvalProfile.approvalRequired,
      sideEffectKinds: capsule.approvalProfile.sideEffectKinds,
      boundaryNote: capsule.approvalProfile.boundaryNote,
    },
    status: capsule.status,
    boundaryNote: capsule.boundaryNote,
  }));
}

function seedPersonaProfiles(): AgentProfile[] {
  return seedAgents.map((agent) => ({
    agentId: agent.agentId,
    displayName: agent.displayName,
    corePersonaRef: corePersonaRef(agent.persona),
    initialPosture: agent.initialPosture,
    roleClaims: [],
    habits: [...agent.persona.habits],
    experiences: agent.persona.experiences.map((experience) => ({ ...experience })),
    personality: [...agent.persona.personality],
    conversationStyle: {
      ...agent.persona.conversationStyle,
      interactionRules: [...agent.persona.conversationStyle.interactionRules],
      boundaries: [...agent.persona.conversationStyle.boundaries],
    },
    capabilityRefs: agent.capabilities.map((capability) => capability.capabilityId),
    evolutionLogRefs: [],
  }));
}

function corePersonaRef(persona: unknown): string | undefined {
  return objectPayload(persona).personaId as string | undefined;
}

function personaDeltaValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  const object = objectPayload(value);
  return stringValue(object.posture) ?? JSON.stringify(value);
}

function personaDeltaChangeText(change: unknown): string {
  const object = objectPayload(change);
  const field = stringValue(object.field) ?? "identity";
  const operation = stringValue(object.operation);
  const value = personaDeltaValue(object.value);
  const label =
    field === "roleClaims"
      ? "role claim"
      : field === "dailyMood"
        ? "daily mood"
        : field === "habits"
          ? "habit"
          : field === "conversationStyle"
            ? "conversation style"
            : "identity note";
  return `${label}${operation ? ` ${operation}` : ""}: ${value}`;
}

function pastTenseResponse(response: string | undefined): string {
  switch (response) {
    case "accept":
      return "accepted";
    case "reject":
      return "rejected";
    case "challenge":
      return "challenged";
    case "contest":
      return "contested";
    case "revise":
      return "revised";
    case "retire":
      return "retired";
    case "defer":
      return "deferred";
    default:
      return response ?? "responded";
  }
}

function isMixedReviewPressureRef(ref: string): boolean {
  return ref.startsWith("mixed_review:");
}

function socialEventText(event: RoomEvent): string | null {
  if (event.event_type === "agent.invited") {
    const payload = event.payload as { agentId?: string; invitedBy?: string; reason?: string };
    if (payload.invitedBy !== "agent_intention") {
      return null;
    }
    return `${event.actor.id} opened a social knock to @${payload.agentId ?? "agent"}: ${
      payload.reason ?? "no reason recorded"
    }. Invitation is optional; the target may answer, redirect, or stay silent.`;
  }
  if (event.event_type === "agent.invitation_responded") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      reason?: string;
      redirectTo?: string;
      boundaryNote?: string;
    };
    const redirect = payload.redirectTo ? ` Redirect: @${payload.redirectTo}.` : "";
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "responded"} the social knock: ${
      payload.reason ?? "no reason recorded"
    }.${redirect} ${payload.boundaryNote ?? "invitation response only"}`;
  }
  if (event.event_type === "agent.invitation_reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the social knock: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "invitation review is a social trace; it does not accept, reject, challenge, delegate, force speech, or create a new invitation"
    }`;
  }
  if (event.event_type === "handoff.proposed") {
    const payload = event.payload as { fromAgentId?: string; toAgentId?: string; reason?: string; requestedResponse?: string };
    const requested = payload.requestedResponse ? ` Requested: ${payload.requestedResponse}` : "";
    return `${payload.fromAgentId ?? event.actor.id} opened a handoff proposal to @${
      payload.toAgentId ?? "agent"
    }: ${payload.reason ?? "no reason recorded"}.${requested} Handoff is a proposal, not a transfer of control.`;
  }
  if (event.event_type === "handoff.responded") {
    const payload = event.payload as { byAgentId?: string; response?: string; reason?: string };
    return `${payload.byAgentId ?? event.actor.id} ${payload.response ?? "responded"} the handoff proposal: ${
      payload.reason ?? "no reason recorded"
    }`;
  }
  if (event.event_type === "handoff.reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the handoff proposal: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "handoff review is a social trace; it does not accept, reject, partially accept, delegate, challenge, complete, or transfer control"
    }`;
  }
  if (event.event_type === "memory.proposed") {
    const payload = event.payload as {
      proposedBy?: string;
      summary?: string;
      reason?: string;
      revisedFromMemoryRef?: string;
    };
    const revision = payload.revisedFromMemoryRef
      ? " Revises an earlier memory claim as a fresh proposal; the previous claim is unchanged."
      : "";
    return `${payload.proposedBy ?? event.actor.id} opened a provisional memory claim: ${
      payload.summary ?? "no summary recorded"
    }. Reason: ${
      payload.reason ?? "no reason recorded"
    }.${revision} Public memory is provisional sediment, not truth.`;
  }
  if (event.event_type === "memory.contested") {
    const payload = event.payload as { contestedBy?: string; reason?: string };
    return `${payload.contestedBy ?? event.actor.id} contested the memory claim: ${
      payload.reason ?? "no reason recorded"
    }. Memory remains reviewable room sediment.`;
  }
  if (
    event.event_type === "memory.accepted" ||
    event.event_type === "memory.stale" ||
    event.event_type === "memory.retired"
  ) {
    const payload = event.payload as {
      state?: string;
      transitionedBy?: string;
      reason?: string;
    };
    const state = payload.state ?? event.event_type.replace("memory.", "");
    return `${payload.transitionedBy ?? event.actor.id} marked the memory claim as ${state}: ${
      payload.reason ?? "no reason recorded"
    }. Memory state is provisional and can be challenged again.`;
  }
  if (event.event_type === "memory.reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the memory claim: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "memory review is a social trace; it does not accept, contest, stale, retire, or turn the claim into truth"
    }`;
  }
  if (event.event_type === "protocol.proposed") {
    const payload = event.payload as {
      proposedBy?: string;
      summary?: string;
      scope?: string;
      boundaryNote?: string;
    };
    return `${payload.proposedBy ?? event.actor.id} opened a temporary room etiquette proposal: ${
      payload.summary ?? "no summary recorded"
    }. Scope: ${payload.scope ?? "current_topic"}. ${
      payload.boundaryNote ?? "Still proposed; it is not active guidance until the room accepts it."
    }`;
  }
  if (event.event_type === "protocol.responded") {
    const payload = event.payload as { agentId?: string; response?: string; reason?: string };
    return `${payload.agentId ?? event.actor.id} ${pastTenseResponse(payload.response)} the temporary room etiquette: ${
      payload.reason ?? "no reason recorded"
    }`;
  }
  if (event.event_type === "protocol.reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the temporary room etiquette: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "protocol review is a social trace; it does not accept, reject, challenge, revise, retire, or activate etiquette"
    }`;
  }
  if (event.event_type === "mixed_review_pressure.reviewed") {
    const payload = event.payload as {
      pressureRef?: string;
      pressure_ref?: string;
      mixedReviewPressureRef?: string;
      mixed_review_pressure_ref?: string;
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} mixed review pressure ${
      payload.pressureRef ?? payload.pressure_ref ?? payload.mixedReviewPressureRef ?? payload.mixed_review_pressure_ref ?? "mixed_review_pressure"
    }: ${payload.summary ?? "no summary recorded"}. ${
      payload.boundaryNote ??
      "mixed review pressure review is a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure"
    }`;
  }
  if (event.event_type === "protocol.retired") {
    const payload = event.payload as { retiredBy?: string; reason?: string };
    return `${payload.retiredBy ?? event.actor.id} retired the temporary room etiquette: ${
      payload.reason ?? "no reason recorded"
    }`;
  }
  if (event.event_type === "protocol.expired") {
    const payload = event.payload as { expiredAt?: string; reason?: string };
    return `temporary room etiquette expired at ${
      payload.expiredAt ?? "its boundary"
    }: ${payload.reason ?? "temporary protocol left effective context"}`;
  }
  if (event.event_type === "persona_delta.proposed") {
    const payload = event.payload as {
      agentId?: string;
      proposedBy?: string;
      reason?: string;
      proposedChange?: unknown;
      boundaryNote?: string;
      revisedFromDeltaRef?: string;
    };
    const revision = payload.revisedFromDeltaRef
      ? " Revises an earlier identity proposal as a fresh proposal; the previous proposal is unchanged."
      : "";
    return `${payload.proposedBy ?? event.actor.id} opened an identity proposal for @${
      payload.agentId ?? event.actor.id
    }: ${personaDeltaChangeText(payload.proposedChange)}. Reason: ${
      payload.reason ?? "no reason recorded"
    }.${revision} ${payload.boundaryNote ?? "identity proposal is room-visible, contestable, and not a fixed assignment"}`;
  }
  if (event.event_type === "persona_delta.responded") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      reason?: string;
      proposedRevision?: string;
    };
    const revision = payload.proposedRevision ? ` Revision: ${payload.proposedRevision}` : "";
    return `${payload.agentId ?? event.actor.id} ${pastTenseResponse(payload.response)} the identity proposal: ${
      payload.reason ?? "no reason recorded"
    }.${revision} Identity evolution remains contestable and ledgered.`;
  }
  if (event.event_type === "persona_delta.reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the identity proposal: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "identity proposal review is a social trace; it does not accept, reject, contest, retire, revise, or mutate identity"
    }`;
  }
  if (event.event_type === "archive.review_requested") {
    const payload = event.payload as {
      requestedBy?: string;
      summary?: string;
      reason?: string;
      boundaryNote?: string;
    };
    return `${payload.requestedBy ?? event.actor.id} opened a daily time-skeleton review: ${
      roomNativeArchiveText(payload.summary, "review requested")
    }. Reason: ${roomNativeArchiveText(payload.reason, "daily rhythm")}. ${
      payload.boundaryNote ?? "review request only"
    }`;
  }
  if (event.event_type === "archive.reviewed") {
    const payload = event.payload as {
      reviewedBy?: string;
      assessment?: string;
      summary?: string;
      reason?: string;
      boundaryNote?: string;
    };
    return `${payload.reviewedBy ?? event.actor.id} reviewed the daily time skeleton (${
      payload.assessment ?? "review"
    }): ${roomNativeArchiveText(payload.summary, "no summary recorded")}. Reason: ${
      roomNativeArchiveText(payload.reason, "no reason recorded")
    }. ${
      payload.boundaryNote ?? "review only"
    }`;
  }
  if (event.event_type === "archive.repair_proposed") {
    const payload = event.payload as {
      proposedBy?: string;
      summary?: string;
      reason?: string;
      proposedRepair?: string;
      boundaryNote?: string;
    };
    return `${payload.proposedBy ?? event.actor.id} opened an archive repair proposal for the daily time skeleton: ${
      roomNativeArchiveText(payload.summary, "no summary recorded")
    }. Repair idea: ${roomNativeArchiveText(payload.proposedRepair, "not recorded")}. ${
      payload.boundaryNote ?? "proposal only"
    }`;
  }
  if (event.event_type === "archive.repair_responded") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      reason?: string;
      proposedRevision?: string;
      boundaryNote?: string;
    };
    const revision = payload.proposedRevision ? ` Revision: ${roomNativeArchiveText(payload.proposedRevision, "")}` : "";
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "responded"} the archive repair proposal: ${
      roomNativeArchiveText(payload.reason, "no reason recorded")
    }.${revision} ${payload.boundaryNote ?? "archive unchanged"}`;
  }
  if (event.event_type === "archive.repair_reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the archive repair proposal: ${
      roomNativeArchiveText(payload.summary, "no summary recorded")
    }. ${
      payload.boundaryNote ?? "repair review is a social trace; archive and repair state are unchanged"
    }`;
  }
  if (event.event_type === "archive.repair_applied") {
    const payload = event.payload as {
      reason?: string;
      boundaryNote?: string;
    };
    return `System note applied an accepted archive repair as a new time-skeleton revision: ${
      roomNativeArchiveText(payload.reason, "no reason recorded")
    }. ${
      payload.boundaryNote ?? "original archive remains unchanged"
    }`;
  }
  if (event.event_type === "room.autonomy_tick") {
    const payload = event.payload as {
      action?: string;
      status?: string;
      reason?: string;
      boundaryNote?: string;
    };
    const action = payload.action === "stay_silent" ? "preserved room silence" : "opened autonomous room rhythm";
    return `room rhythm ${action} (${payload.status ?? "recorded"}): ${payload.reason ?? "no reason recorded"}. ${
      payload.boundaryNote ??
      "autonomous rhythm may invite review or preserve silence, but it does not force speech, assign work, or make memory true"
    }`;
  }
  if (event.event_type === "room.pressure_detected") {
    const payload = event.payload as {
      reason?: string;
      activeBackgroundTurns?: number;
      queuedBackgroundTurns?: number;
      maxConcurrentBackgroundTurns?: number;
      boundaryNote?: string;
    };
    return `room pressure detected (${payload.reason ?? "bandwidth_guard"}): ${payload.activeBackgroundTurns ?? "?"}/${
      payload.maxConcurrentBackgroundTurns ?? "?"
    } background turns active, ${payload.queuedBackgroundTurns ?? "?"} queued. ${
      payload.boundaryNote ?? "Expression is preserved while wake is delayed."
    }`;
  }
  if (event.event_type === "room.memory_pressure_detected") {
    const payload = event.payload as {
      reason?: string;
      pendingProposalCount?: number;
      threshold?: number;
      boundaryNote?: string;
    };
    return `memory pressure detected (${payload.reason ?? "pending_memory_proposal_limit"}): ${
      payload.pendingProposalCount ?? "?"
    }/${payload.threshold ?? "?"} pending proposals, triggered by one pending memory claim. ${
      payload.boundaryNote ?? "Review pending memory before adding more sediment."
    }`;
  }
  if (event.event_type === "topic.proposed") {
    const payload = event.payload as {
      proposedBy?: string;
      action?: string;
      title?: string;
      reason?: string;
      boundaryNote?: string;
    };
    return `${payload.proposedBy ?? event.actor.id} opened a topic suggestion (${payload.action ?? "move"}): ${
      payload.title ?? "untitled"
    }. Reason: ${payload.reason ?? "no reason recorded"}. ${
      payload.boundaryNote ?? "Still proposed; active topic does not move until a later apply action."
    }`;
  }
  if (event.event_type === "topic.discussion_requested") {
    const payload = event.payload as {
      requestedBy?: string;
      boundaryNote?: string;
    };
    return `${payload.requestedBy ?? event.actor.id} requested room discussion for a human-selected topic. ${
      payload.boundaryNote ??
      "topic discussion request is explicit room pressure; a bare topic projection does not wake agents by itself"
    }`;
  }
  if (event.event_type === "topic.responded") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      reason?: string;
      proposedRevision?: string;
      boundaryNote?: string;
    };
    const revision = payload.proposedRevision ? ` Revision: ${payload.proposedRevision}` : "";
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "responded"} the topic suggestion: ${
      payload.reason ?? "no reason recorded"
    }.${revision} ${payload.boundaryNote ?? "proposal response only"}`;
  }
  if (event.event_type === "topic.reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the topic suggestion: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "topic suggestion review is a social trace; it does not accept, reject, challenge, revise, apply, or move the active topic"
    }`;
  }
  if (event.event_type === "topic.applied") {
    const payload = event.payload as {
      action?: string;
      appliedBy?: string;
      reason?: string;
      boundaryNote?: string;
    };
    return `${payload.appliedBy ?? event.actor.id} applied the topic suggestion as visible topic movement (${
      payload.action ?? "move"
    }): ${
      payload.reason ?? "no reason recorded"
    }. ${payload.boundaryNote ?? "topic application only"}`;
  }
  if (event.event_type === "side_effect.requested") {
    const payload = event.payload as {
      requestedBy?: string;
      kind?: string;
      target?: string;
      reason?: string;
      expectedImpact?: string;
    };
    return `${payload.requestedBy ?? event.actor.id} requested side-effect approval for ${
      payload.kind ?? "side_effect"
    } on ${payload.target ?? "target"}: ${payload.reason ?? "no reason recorded"}. Impact: ${
      payload.expectedImpact ?? "not recorded"
    }`;
  }
  if (event.event_type === "side_effect.approved") {
    const payload = event.payload as {
      approvalId?: string;
      approvedBy?: string;
      reason?: string;
      boundaryNote?: string;
    };
    return `${payload.approvedBy ?? event.actor.id} approved side-effect permission ${
      payload.approvalId ?? "side_effect"
    }: ${payload.reason ?? "no reason recorded"}. ${
      payload.boundaryNote ?? "approval is scoped permission only; it does not execute an external action"
    }`;
  }
  if (event.event_type === "side_effect.reviewed") {
    const payload = event.payload as {
      sideEffectRef?: string;
      requestId?: string;
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} side-effect request ${
      payload.sideEffectRef ?? payload.requestId ?? "side_effect"
    }: ${payload.summary ?? "no summary recorded"}. ${
      payload.boundaryNote ??
      "side-effect review is a social trace; it does not approve, deny, expire, execute, report a result, or mutate external state"
    }`;
  }
  if (event.event_type === "side_effect.expired") {
    const payload = event.payload as {
      approvalId?: string;
      expiredBy?: string;
      reason?: string;
      boundaryNote?: string;
    };
    return `${payload.expiredBy ?? event.actor.id} expired side-effect permission ${
      payload.approvalId ?? "side_effect"
    }: ${payload.reason ?? "no reason recorded"}. ${
      payload.boundaryNote ?? "expiry retires permission only; it does not execute an external action"
    }`;
  }
  if (event.event_type === "side_effect.result_reported") {
    const payload = event.payload as {
      approvalId?: string;
      requestId?: string;
      agentId?: string;
      status?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} reported side-effect result for ${
      payload.requestId ?? payload.approvalId ?? "side_effect"
    } (${payload.status ?? "completed"}): ${payload.summary ?? "no summary recorded"}. ${
      payload.boundaryNote ?? "result is evidence only; it does not create memory truth"
    }`;
  }
  if (event.event_type === "workspace.artifact_shared") {
    const payload = event.payload as {
      agentId?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} shared a private workspace reference: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ?? "artifact ref only"
    }`;
  }
  if (event.event_type === "workspace.artifact_reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the private workspace reference: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "workspace artifact review is a social trace; it does not copy private workspace contents, promote public memory, execute tools, or mutate the artifact"
    }`;
  }
  if (event.event_type === "skill.capsule_reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the skill boundary: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "skill capsule review is a social trace; it does not register a skill, assign a role, execute tools, bypass approvals, or mutate capability state"
    }`;
  }
  if (event.event_type === "capability.reviewed") {
    const payload = event.payload as {
      agentId?: string;
      response?: string;
      summary?: string;
      boundaryNote?: string;
    };
    return `${payload.agentId ?? event.actor.id} ${payload.response ?? "reviewed"} the weak capability hint: ${
      payload.summary ?? "no summary recorded"
    }. ${
      payload.boundaryNote ??
      "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech"
    }`;
  }
  return null;
}

function topicIdFromSocialEvent(event: RoomEvent): string | undefined {
  const payload = event.payload as { topicId?: string; currentTopicId?: string };
  return payload.topicId ?? payload.currentTopicId;
}

function roomNativeArchiveText(value: string | undefined, fallback: string): string {
  const source = value?.trim() ? value : fallback;
  return source
    .replace(/\bdaily_archive_ref:[A-Za-z0-9_:-]+/g, "this time skeleton")
    .replace(/\barchive_review_request_[A-Za-z0-9_:-]+/g, "this review invitation")
    .replace(/\barchive_repair_[A-Za-z0-9_:-]+/g, "this repair proposal")
    .replace(/\bday_[A-Za-z0-9_:-]+/g, "this time skeleton");
}

function mentionsFromSocialEvent(event: RoomEvent): string[] {
  const payload = event.payload as {
    agentId?: string;
    toAgentId?: string;
    requestedBy?: string;
    proposedBy?: string;
    reviewedBy?: string;
    appliedBy?: string;
    transitionedBy?: string;
    contestedBy?: string;
    redirectTo?: string;
  };
  return uniqueRefs(
    [
      payload.agentId,
      payload.toAgentId,
      payload.requestedBy,
      payload.proposedBy,
      payload.reviewedBy,
      payload.appliedBy,
      payload.transitionedBy,
      payload.contestedBy,
      payload.redirectTo,
    ].filter((value): value is string => typeof value === "string"),
  );
}

function safeProjection<T>(project: () => T[]): T[] {
  try {
    return project();
  } catch {
    return [];
  }
}

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function firstPayloadObject(primary: unknown, fallback: unknown): Record<string, unknown> {
  const primaryObject = objectPayload(primary);
  return Object.keys(primaryObject).length > 0 ? primaryObject : objectPayload(fallback);
}

function summarizePayloadObject(payload: Record<string, unknown>, limit: number): string | undefined {
  if (Object.keys(payload).length === 0) {
    return undefined;
  }
  const summary = JSON.stringify(payload);
  if (summary.length <= limit) {
    return summary;
  }
  return `${summary.slice(0, Math.max(0, limit - 1))}…`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function protocolScopeLabel(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const scope = value as { type?: unknown };
    return stringValue(scope.type) ?? "custom";
  }
  return "unknown";
}

function handoffStatusFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accepted":
    case "accept":
      return "accepted";
    case "rejected":
    case "reject":
      return "rejected";
    case "partially_accepted":
    case "partially_accept":
      return "partially_accepted";
    case "redirected":
    case "delegate_handoff":
    case "delegate_to_other":
      return "redirected";
    case "challenged":
    case "challenge":
    case "challenge_handoff":
      return "challenged";
    default:
      return undefined;
  }
}

function invitationStatusFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accept":
    case "accepted":
      return "accepted";
    case "reject":
    case "rejected":
      return "rejected";
    case "challenge":
    case "challenged":
      return "challenged";
    case "delegate":
    case "delegated":
    case "redirected":
      return "delegated";
    default:
      return undefined;
  }
}

function protocolStatusFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accept":
      return "active";
    case "reject":
      return "rejected";
    case "challenge":
      return "challenged";
    case "revise":
      return "revised";
    default:
      return undefined;
  }
}

function protocolStatusCanExpire(status: string | undefined): boolean {
  return status === "proposed" || status === "active" || status === "challenged" || status === "revised";
}

function sideEffectKindValue(value: unknown): SideEffectKind | undefined {
  if (
    value === "filesystem.write" ||
    value === "filesystem.delete" ||
    value === "shell.exec" ||
    value === "network.request" ||
    value === "git.commit" ||
    value === "git.push" ||
    value === "pull_request.open" ||
    value === "external_api.call"
  ) {
    return value;
  }
  return undefined;
}

function topicProposalActionValue(value: unknown): TopicProposalAction | undefined {
  if (value === "new" || value === "split" || value === "pause" || value === "revive" || value === "merge") {
    return value;
  }
  return undefined;
}

function topicStatusValue(value: unknown): TopicStatus | undefined {
  if (value === "active" || value === "paused" || value === "merged" || value === "retired") {
    return value;
  }
  return undefined;
}

function compareNewestFirst(left: string | undefined, right: string | undefined): number {
  return Date.parse(right ?? "") - Date.parse(left ?? "");
}

function localDateInTimeZone(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error("now must be an ISO timestamp");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function selectContextAuditFragmentsForSummary(fragments: readonly ContextFragment[]): ContextFragment[] {
  const selected = fragments.slice(0, 12);
  const seen = new Set(selected.map((fragment) => `${fragment.type}:${fragment.id}`));
  for (const fragment of fragments) {
    const key = `${fragment.type}:${fragment.id}`;
    if (seen.has(key) || !isCriticalContextAuditFragmentType(fragment.type)) continue;
    selected.push(fragment);
    seen.add(key);
  }
  return selected;
}

function isCriticalContextAuditFragmentType(type: string): boolean {
  return (
    type === "daily_archive_ref" ||
    type === "provider_boundary" ||
    type === "persona_delta" ||
    type === "persona_projection" ||
    type === "mixed_review_pressure" ||
    type === "open_question" ||
    type === "protocol_active" ||
    type === "protocol_proposal" ||
    type === "handoff_packet" ||
    type === "invitation_packet" ||
    type === "topic_rule" ||
    type === "side_effect_boundary" ||
    type === "workspace_artifact_ref" ||
    type === "skill_capsule_ref" ||
    type === "capability_ref" ||
    type === "deferred_intention" ||
    type === "silence_ref" ||
    type === "pressure_boundary" ||
    type === "memory_pressure_boundary" ||
    type.startsWith("memory_")
  );
}

function contextFragmentStateKeys(fragment: ContextFragment): string[] | undefined {
  const body = contextFragmentBody(fragment);
  const states = body ? objectPayload(body.states) : {};
  const keys = Object.keys(states).sort();
  return keys.length > 0 ? keys.slice(0, 16) : undefined;
}

function contextFragmentBoundarySignals(fragment: ContextFragment): Record<string, string | number | boolean> | undefined {
  const body = contextFragmentBody(fragment);
  const states = body ? objectPayload(body.states) : {};
  const sourcePressureRefs = contextFragmentSourcePressureRefs(states);
  const pressureLineageSignals: Record<string, string | number | boolean> = {};
  if (sourcePressureRefs.length > 0) {
    pressureLineageSignals.sourcePressureRefCount = sourcePressureRefs.length;
    pressureLineageSignals.sourcePressureRefs = sourcePressureRefs.slice(0, 4).join(", ");
  }
  if (fragment.type === "mixed_review_pressure") {
    const objects = numberValue(states.mixedReviewObjectCount) ?? 0;
    const traces = arrayOfStrings(states.mixedReviewTraceEventRefs).length;
    const agents = arrayOfStrings(states.mixedReviewAgentIds).length;
    const refs = arrayOfStrings(states.mixedReviewTouchedRefs).length;
    if (objects === 0 && traces === 0 && agents === 0 && refs === 0) {
      return undefined;
    }
    return {
      objects,
      traces,
      agents,
      refs,
      projectionOnly: true,
      ...pressureLineageSignals,
    };
  }
  if (fragment.type === "daily_archive_ref") {
    const mixedPressures = numberValue(states.archiveMixedReviewPressureCount) ?? 0;
    const pressureReviews = numberValue(states.archiveMixedReviewPressureReviewCount) ?? 0;
    const reviewedPressureRefs = arrayOfStrings(states.archiveMixedReviewPressureReviewedRefs).length;
    const pressureReviewEvents = arrayOfStrings(states.archiveMixedReviewPressureReviewEventRefs).length;
    const pressureReviewResponses = arrayOfStrings(states.archiveMixedReviewPressureReviewResponses).length;
    const pressureReviewResponseKinds = Object.keys(objectPayload(states.archiveMixedReviewPressureReviewResponseKindCounts)).length;
    const pressureReviewAgents = arrayOfStrings(states.archiveMixedReviewPressureReviewAgentIds).length;
    const hasPressureReviewEvolution = Boolean(stringValue(states.archiveMixedReviewPressureReviewEvolutionNote));
    if (
      mixedPressures === 0 &&
      pressureReviews === 0 &&
      reviewedPressureRefs === 0 &&
      pressureReviewEvents === 0 &&
      pressureReviewResponses === 0 &&
      pressureReviewResponseKinds === 0 &&
      pressureReviewAgents === 0 &&
      !hasPressureReviewEvolution
    ) {
      return undefined;
    }
    return {
      mixedPressures,
      pressureReviews,
      reviewedPressureRefs,
      pressureReviewEvents,
      pressureReviewResponses,
      pressureReviewResponseKinds,
      pressureReviewAgents,
      hasPressureReviewEvolution,
      carriesPressureReviewTrace: pressureReviews > 0 || reviewedPressureRefs > 0,
      archiveOnly: true,
      ...pressureLineageSignals,
    };
  }
  if (fragment.type !== "provider_boundary") {
    return sourcePressureRefs.length > 0 ? { ...pressureLineageSignals, pressureLineageOnly: true } : undefined;
  }
  const repair = arrayOfStrings(states.providerBoundaryChoiceRepairRequestRefs).length;
  const denied = arrayOfStrings(states.providerBoundaryChoiceDeniedRepairRefs).length;
  const approved = arrayOfStrings(states.providerBoundaryChoiceApprovedRepairRefs).length;
  const results = arrayOfStrings(states.providerBoundaryChoiceResultRefs).length;
  const retry = arrayOfStrings(states.providerBoundaryChoiceRetryProtocolRefs).length;
  const retiredRetry = arrayOfStrings(states.providerBoundaryChoiceRetiredRetryProtocolRefs).length;
  const silence = arrayOfStrings(states.providerBoundaryChoiceSilenceRefs).length;
  const contestedMemory = arrayOfStrings(states.providerBoundaryChoiceContestedMemoryRefs).length;
  const archives = arrayOfStrings(states.providerBoundaryChoiceArchiveCarryoverRefs).length;
  const agents = arrayOfStrings(states.providerBoundaryChoiceAgentIds).length;
  const choices = numberValue(states.providerBoundaryChoiceKindCount) ?? 0;
  if (
    choices === 0 &&
    repair === 0 &&
    denied === 0 &&
    approved === 0 &&
    results === 0 &&
    retry === 0 &&
    retiredRetry === 0 &&
    silence === 0 &&
    contestedMemory === 0 &&
    archives === 0
  ) {
    return undefined;
  }
  return {
    choices,
    repair,
    denied,
    approved,
    results,
    retry,
    retiredRetry,
    silence,
    contestedMemory,
    archives,
    agents,
    mixed: booleanValue(states.providerBoundaryChoiceHasMixedChoices) ?? false,
    multiAgent: booleanValue(states.providerBoundaryChoiceHasMultiAgentPressure) ?? false,
    crossArchive: booleanValue(states.providerBoundaryChoiceCarriedAcrossArchives) ?? false,
    ...pressureLineageSignals,
  };
}

function contextFragmentSourcePressureRefs(states: Record<string, unknown>): string[] {
  const refs: string[] = [];
  for (const [key, value] of Object.entries(states)) {
    if (key !== "sourcePressureRefs" && !key.endsWith("SourcePressureRefs")) continue;
    refs.push(...arrayOfStrings(value));
  }
  return uniqueRefs(refs.filter(isMixedReviewPressureRef));
}

function contextFragmentBody(fragment: ContextFragment): Record<string, unknown> | undefined {
  try {
    return objectPayload(JSON.parse(fragment.body));
  } catch {
    return undefined;
  }
}

function modeForAgentAdapter(
  adapter: RuntimeAgentAdapter | undefined,
  smokeStatus: string | undefined,
): AgentRuntimeMode {
  if (!adapter) {
    return smokeStatus === "ready" ? "smoke_ready" : "offline";
  }
  if (adapter.mode === "seed" && smokeStatus === "ready") {
    return "smoke_ready";
  }
  if (adapter.mode === "seed" && smokeStatus === "missing") {
    return "offline";
  }
  return adapter.mode;
}

function uniqueRefs(refs: readonly unknown[]): string[] {
  return [
    ...new Set(
      refs
        .filter((ref): ref is string => typeof ref === "string")
        .map((ref) => ref.trim())
        .filter((ref) => ref.length > 0),
    ),
  ];
}

function sanitizeRefs(refs: readonly string[]): string[] {
  return uniqueRefs(refs).filter((ref) => /^[A-Za-z0-9_:.@-]{1,160}$/.test(ref)).slice(0, 24);
}

function sanitizeOptionalRef(ref: string | undefined): string | undefined {
  return ref === undefined ? undefined : sanitizeRefs([ref])[0];
}

function stableRefSuffix(...parts: readonly string[]): string {
  return (
    parts
      .join("_")
      .replace(/[^A-Za-z0-9_:.@-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || "request"
  );
}

function topicDiscussionPrompt(prompt: string | undefined): string {
  const text = prompt?.trim();
  if (text) {
    return text.slice(0, 1200);
  }
  return `我想把这个话题拿回房间讨论。请自愿回应、提出一个更窄的问题、建议 topic movement、邀请更合适的 agent，或保持沉默；这是一条人类显式讨论请求，不是裸 topic 投影自动唤醒。`;
}

function positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function environmentFlag(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function configuredReadRoots(value: string | undefined, cwd: string): string[] {
  if (!value?.trim()) {
    return [path.resolve(cwd)];
  }
  let candidates: string[] = [];
  try {
    const decoded = JSON.parse(value) as unknown;
    if (Array.isArray(decoded)) {
      candidates = decoded.filter((item): item is string => typeof item === "string");
    }
  } catch {
    candidates = value.split(path.delimiter);
  }
  const roots = candidates.map((item) => item.trim()).filter((item) => item.length > 0);
  return roots.length > 0 ? roots.map((root) => path.resolve(cwd, root)) : [path.resolve(cwd)];
}

function nonNegativeIntegerOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function sanitizeMentions(mentions: readonly string[]): AgentId[] {
  const knownAgents = new Set(seedAgents.map((agent) => agent.agentId));
  return uniqueRefs(mentions.map((mention) => mention.trim())).filter((mention) => knownAgents.has(mention));
}

function contextRelevantRefs(events: readonly RoomEvent[], triggeringEventId: string): string[] {
  const trigger = events.find(
    (event): event is RoomEvent<MessageCreatedPayload> => event.event_id === triggeringEventId && event.event_type === "message.created",
  );
  const directRefs = sanitizeRefs(trigger?.payload.contextRefs ?? []);
  const expandedRefs = directRefs.flatMap((ref) => {
    const linkedEvent = events.find((event) => event.event_id === ref);
    if (!linkedEvent) return [];
    const payload = objectPayload(linkedEvent.payload);
    return linkedEvent.refs.concat(arrayOfStrings(payload.contextRefs)).concat(arrayOfStrings(payload.context_refs));
  });
  return uniqueRefs(directRefs.concat(expandedRefs));
}

function recentDailyArchiveRefs(events: readonly RoomEvent[], limit: number): string[] {
  return events
    .filter((event) => event.event_type === "daily_archive.created")
    .slice(-Math.max(0, limit))
    .reverse()
    .map((event) => {
      const payload = objectPayload(event.payload);
      const nested = objectPayload(payload.archive);
      return stringValue(payload.archiveId) ?? stringValue(payload.archive_id) ?? stringValue(nested.archiveId) ?? event.event_id;
    });
}

function findArchiveRepairProposal(events: readonly RoomEvent[], repairRef: string): RoomEvent | undefined {
  return events.find((event) => {
    if (event.event_type !== "archive.repair_proposed") return false;
    const payload = objectPayload(event.payload);
    return (stringValue(payload.repairId) ?? stringValue(payload.repair_id) ?? event.event_id) === repairRef;
  });
}

function archiveRepairAcceptedResponses(events: readonly RoomEvent[], repairRef: string): RoomEvent[] {
  return events.filter((event) => {
    if (event.event_type !== "archive.repair_responded") return false;
    const payload = objectPayload(event.payload);
    const eventRepairRef = stringValue(payload.repairRef) ?? stringValue(payload.repair_ref);
    if (eventRepairRef !== repairRef) return false;
    const status = stringValue(payload.status);
    const response = stringValue(payload.response);
    return status === "accepted" || response === "accept";
  });
}

function findArchiveRepairApplication(
  events: readonly RoomEvent[],
  repairRef: string,
): { archiveRef: string; revisedArchiveRef: string; acceptedResponseRefs: string[] } | undefined {
  for (const event of events) {
    if (event.event_type !== "archive.repair_applied") continue;
    const payload = objectPayload(event.payload);
    if ((stringValue(payload.repairRef) ?? stringValue(payload.repair_ref)) !== repairRef) continue;
    const archiveRef = stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref);
    const revisedArchiveRef = stringValue(payload.revisedArchiveRef) ?? stringValue(payload.revised_archive_ref);
    if (!archiveRef || !revisedArchiveRef) continue;
    return {
      archiveRef,
      revisedArchiveRef,
      acceptedResponseRefs: arrayOfStrings(payload.acceptedResponseRefs).concat(arrayOfStrings(payload.accepted_response_refs)),
    };
  }
  return undefined;
}

function archiveRevisionId(inputArchiveId: string | undefined, baseArchiveId: string, archives: readonly DailyArchive[]): string {
  const explicit = sanitizeRefs(inputArchiveId ? [inputArchiveId] : [])[0];
  if (explicit) return explicit;
  const existingRevisionCount = archives.filter(
    (archive) => archive.revisionOf === baseArchiveId || archive.outputRefs?.revisionOf === baseArchiveId,
  ).length;
  return `${baseArchiveId}_rev_${String(existingRevisionCount + 1).padStart(2, "0")}`;
}

function archiveRevisionSummary(baseSummary: string, repairRef: string, proposedRepair: string): string {
  const repairLine = `Revision from ${repairRef}: ${proposedRepair || "accepted repair applied with provenance."}`;
  if (!baseSummary.trim()) return repairLine;
  return `${baseSummary}\n${repairLine}`;
}

function seedCapabilityWakeHints(input: AdvisoryWakeHintProviderInput): AdvisoryWakeHint[] {
  if (input.mentionedAgentIds.length > 0) {
    return [];
  }
  const eligible = new Set(input.eligibleAgentIds);
  const normalizedContent = normalizeCapabilityText(input.message.content);
  const hints: AdvisoryWakeHint[] = [];

  for (const agent of seedAgents) {
    if (!eligible.has(agent.agentId)) {
      continue;
    }
    for (const capability of agent.capabilities) {
      const matchedTags = capability.domainTags.filter((tag) => capabilityTagMatches(tag, normalizedContent));
      if (matchedTags.length === 0) {
        continue;
      }
      hints.push({
        agentId: agent.agentId,
        capabilityId: capability.capabilityId,
        score: Math.min(3, 0.75 + matchedTags.length * 0.75),
        reason: `Weak invitation hint from capability tags ${matchedTags.join(", ")}; this does not assign responsibility.`,
        matchedTags,
        authority: "advisory",
        mustSpeak: false,
      });
    }
  }

  return hints;
}

function capabilityTagMatches(tag: string, normalizedContent: string): boolean {
  const normalizedTag = normalizeCapabilityText(tag);
  if (normalizedContent.includes(normalizedTag)) {
    return true;
  }
  const parts = normalizedTag.split(" ").filter((part) => part.length >= 3);
  return parts.length > 0 && parts.every((part) => normalizedContent.includes(part));
}

function normalizeCapabilityText(value: string): string {
  return ` ${value.toLowerCase().replace(/[-_/]+/g, " ").replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")} `;
}

function displayNameFor(author: string, kind: string): string {
  if (kind === "user") {
    return "You";
  }
  if (author === "room_kernel") {
    return "Room Kernel";
  }
  if (author === "room_rhythm") {
    return "Room Rhythm";
  }
  return seedAgents.find((agent) => agent.agentId === author)?.displayName ?? author;
}

function initialsFor(author: string): string {
  if (author === "user" || author === "You") {
    return "我";
  }
  if (author === "room_kernel") {
    return "RK";
  }
  if (author === "room_rhythm") {
    return "RR";
  }
  return (
    seedAgents
      .find((agent) => agent.agentId === author)
      ?.displayName.split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? author.slice(0, 2).toUpperCase()
  );
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(date);
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function createRuntimeIdFactory() {
  let counter = 0;
  const runtimeId = Date.now().toString(36);
  return (prefix: string): string => {
    counter += 1;
    return `${prefix}_${runtimeId}_${counter.toString(36).padStart(4, "0")}`;
  };
}
