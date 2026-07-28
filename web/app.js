const apiBase = window.SPECIES_API_BASE ?? (window.location.protocol === "file:" ? "http://127.0.0.1:8787" : "");

const room = {
  connected: false,
  agentRuntimeMode: "seed",
  eventCount: 0,
  ledgerPath: "",
  metrics: [
    ["--", "ledger events"],
    ["--", "room messages"],
    ["--", "agent intentions"],
    ["6", "seed agents"],
  ],
  agents: [
    {
      id: "kimi_member_01",
      name: "kimi-code-1",
      initials: "KC",
      posture: "enters as a quiet room member who can listen, ask one small question, or stay silent",
      provider: "Kimiplan Agent API",
      status: "unknown",
      mode: "seed",
      persona:
        "Light listening tendency only; roles and habits must emerge from room-visible evidence.",
      tags: ["local-cli", "reflection", "stay_silent"],
    },
    {
      id: "kimi_member_02",
      name: "kimi-code-2",
      initials: "KM",
      posture: "enters as a route-aware room member who checks source, recipient, and visible intent",
      provider: "Kimiplan Agent API",
      status: "unknown",
      mode: "seed",
      persona:
        "Light route-checking tendency only; ordinary @mentions are visible social knocks.",
      tags: ["local-cli", "context", "safety"],
    },
    {
      id: "mimo_member_01",
      name: "doubao-seed-2.0-pro",
      initials: "DB",
      posture: "enters as a structure-aware room member who notices pressure, exits, and temporary etiquette",
      provider: "Volcengine Ark doubao-seed-2.0-pro",
      status: "unknown",
      mode: "seed",
      persona:
        "Light structure-noticing tendency only; not a moderator or assigned architect.",
      tags: ["ark", "doubao-seed-2.0-pro", "structure"],
    },
    {
      id: "mimo_member_02",
      name: "glm-5.2",
      initials: "GL",
      posture: "enters as a resource-aware room member who notices time, attention, and reversible next steps",
      provider: "Volcengine Ark glm-5.2",
      status: "unknown",
      mode: "seed",
      persona:
        "Light resource-awareness tendency only; not a default planner.",
      tags: ["ark", "glm-5.2", "timeboxes"],
    },
    {
      id: "mimo_member_03",
      name: "minimax-m3",
      initials: "MM",
      posture: "enters as a patient room member who waits for repeated evidence before naming patterns",
      provider: "Volcengine Ark minimax-m3",
      status: "unknown",
      mode: "seed",
      persona: "Light patience tendency only; avoids turning one turn into identity.",
      tags: ["ark", "minimax-m3", "growth"],
    },
    {
      id: "mimo_member_04",
      name: "deepseek-v4-pro",
      initials: "DS",
      posture: "enters as a small-step room member who looks for light invitations and reversible moves",
      provider: "Volcengine Ark deepseek-v4-pro",
      status: "unknown",
      mode: "seed",
      persona: "Light small-step tendency only; invitations are optional.",
      tags: ["ark", "deepseek-v4-pro", "navigation"],
    },
  ],
  checks: [["Internal runtime", false, "waiting for http://127.0.0.1:8787"]],
  contextAudits: [],
  yoloSpaces: [],
  longRunOperationalSummary: null,
  autonomyScheduler: {
    enabled: false,
    running: false,
    completedTickCount: 0,
    skippedOverlapCount: 0,
    overdueTickCount: 0,
    overrunTickCount: 0,
    errorCount: 0,
    lastExpectedTickDueAt: null,
    lastScheduleDriftMs: null,
    lastOverdueByMs: null,
    lastDurationMs: null,
    lastOverrunByMs: null,
    lastChoiceSetRefs: [],
    lastChoiceSetOptionCount: 0,
    lastChoiceSetTargetRefs: [],
    lastChoiceSetEvidenceRefs: [],
    lastChoiceSetOptionsWithoutEvidenceRefs: [],
    lastChoiceSetTargetedOptionsWithoutTargetRefs: [],
  },
  timeline: [],
  topics: [
    { topicId: "topic_room_kernel", title: "room kernel", status: "seed", messageCount: 0, revivalCount: 0, openQuestions: [] },
    { topicId: "topic_public_memory", title: "public memory", status: "seed", messageCount: 0, revivalCount: 0, openQuestions: [] },
    { topicId: "topic_handoff_protocol", title: "handoff protocol", status: "seed", messageCount: 0, revivalCount: 0, openQuestions: [] },
  ],
  activeTopicId: "topic_room_kernel",
  socialState: {
    memoryClaims: [],
    openQuestions: [],
    memoryPressureBoundaries: [],
    topicProposals: [],
    topicProposalReviews: [],
    mixedReviewPressures: [],
    handoffs: [],
    invitations: [],
    invitationReviews: [],
    silences: [],
    pressureBoundaries: [],
    protocols: [],
    providerBoundaries: [],
    sideEffects: [],
    sideEffectReviews: [],
    archives: [],
    archiveReviews: [],
    autonomyTicks: [],
    personas: [],
    workspaces: [],
    workspaceArtifactReviews: [],
    skillCapsules: [],
    skillCapsuleReviews: [],
    capabilityReviews: [],
  },
  messages: [],
};

const messageList = document.querySelector("#messageList");
const newMessageJump = document.querySelector("#newMessageJump");
const topicBar = document.querySelector("#topicBar");
const livingOverview = document.querySelector("#livingOverview");
const overviewToggle = document.querySelector("#overviewToggle");
const overviewPanel = document.querySelector("#overviewPanel");
const overviewToggleSummary = document.querySelector("#overviewToggleSummary");
const evidenceStrip = document.querySelector("#evidenceStrip");
const timelineCount = document.querySelector("#timelineCount");
const timelinePreview = document.querySelector("#timelinePreview");
const archiveCount = document.querySelector("#archiveCount");
const archivePreview = document.querySelector("#archivePreview");
const memoryContestCount = document.querySelector("#memoryContestCount");
const memoryContestPreview = document.querySelector("#memoryContestPreview");
const agentContinuityCount = document.querySelector("#agentContinuityCount");
const agentContinuityPreview = document.querySelector("#agentContinuityPreview");
const providerBoundaryCount = document.querySelector("#providerBoundaryCount");
const providerBoundaryPreview = document.querySelector("#providerBoundaryPreview");
const longRunReadinessCount = document.querySelector("#longRunReadinessCount");
const longRunReadinessPreview = document.querySelector("#longRunReadinessPreview");
const roomRail = document.querySelector("#roomRail");
const chatShell = document.querySelector("#chatShell");
const composer = document.querySelector("#composer");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const composerState = document.querySelector("#composerState");
const formatButton = document.querySelector("#formatButton");
const mentionButton = document.querySelector("#mentionButton");
const mentionPopover = document.querySelector("#mentionPopover");
const mentionTray = document.querySelector("#mentionTray");
const addContextButton = document.querySelector("#addContextButton");
const expandComposerButton = document.querySelector("#expandComposerButton");
const contextTray = document.querySelector("#contextTray");
const settingsPanel = document.querySelector("#settingsPanel");
const settingsOverlay = document.querySelector("#settingsOverlay");
const settingsButton = document.querySelector("#settingsButton");
const closeSettings = document.querySelector("#closeSettings");
const connectionStatus = document.querySelector("#connectionStatus");
const roomSubtitle = document.querySelector("#roomSubtitle");
const archiveNowButton = document.querySelector("#archiveNowButton");
const archiveReviewButton = document.querySelector("#archiveReviewButton");
const archiveRhythmButton = document.querySelector("#archiveRhythmButton");
const archiveApplyRepairButton = document.querySelector("#archiveApplyRepairButton");
const archiveState = document.querySelector("#archiveState");
const autonomyTickButton = document.querySelector("#autonomyTickButton");
const autonomyState = document.querySelector("#autonomyState");

let sending = false;
let archiving = false;
let requestingArchiveReview = false;
let requestingArchiveRhythm = false;
let applyingArchiveRepair = false;
let requestingAutonomyTick = false;
let approvingSideEffectRefs = new Set();
let executingSideEffectRefs = new Set();
let expiringSideEffectRefs = new Set();
let forceScrollOnNextRender = true;
let previousMessageCount = 0;
let selectedMentions = new Set();
let selectedContextRefs = new Set();
let mentionQuery = "";
let mentionActiveIndex = 0;
let pollTimer = null;
let pollInFlight = false;
let settingsReturnFocus = null;
let composerDraftMode = false;
let composerExpanded = false;
let livingOverviewExpanded = false;
let openMessageActionRef = null;
let providerBoundaryFilter = "active";

const ROOM_STATE_POLL_INTERVAL_MS = 3_000;
const PROVIDER_BOUNDARY_ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const AUTONOMY_RHYTHM_BALANCE_ACTIONS = new Set([
  "memory_hygiene_review",
  "continuity_review",
  "provider_boundary_review",
  "open_question_revisit",
  "handoff_review",
  "invitation_review",
]);
const AUTONOMY_RHYTHM_BALANCE_MIN_SAMPLES = 4;
const AUTONOMY_RHYTHM_BALANCE_MIN_DISTINCT = 3;
const AUTONOMY_RHYTHM_BALANCE_MONOPOLY_THRESHOLD = 0.6;

renderMessages();
renderTopics();
renderLivingOverview();
renderSettings();
renderMentionTray();
renderContextTray();
syncConnection(false, "connecting");
syncComposer();
void loadRoomState();
startRoomPolling();

settingsButton.addEventListener("click", openSettings);
closeSettings.addEventListener("click", closeSettingsPanel);
settingsOverlay.addEventListener("click", closeSettingsPanel);
settingsPanel.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const providerFilterButton = event.target.closest("[data-provider-boundary-filter]");
  if (providerFilterButton instanceof HTMLElement) {
    providerBoundaryFilter = providerFilterButton.dataset.providerBoundaryFilter === "all" ? "all" : "active";
    renderProviderBoundaryList();
    return;
  }
  const repairButton = event.target.closest("[data-provider-boundary-repair-ref]");
  if (repairButton instanceof HTMLElement) {
    const ref = repairButton.dataset.providerBoundaryRepairRef;
    if (ref) {
      void requestProviderBoundaryRepair(ref);
    }
    return;
  }
  const memoryReviewButton = event.target.closest("[data-memory-claim-review-ref]");
  if (memoryReviewButton instanceof HTMLElement) {
    const ref = memoryReviewButton.dataset.memoryClaimReviewRef;
    if (ref) {
      void requestMemoryClaimReview(ref);
    }
    return;
  }
  const openQuestionReviewButton = event.target.closest("[data-open-question-review-ref]");
  if (openQuestionReviewButton instanceof HTMLElement) {
    const ref = openQuestionReviewButton.dataset.openQuestionReviewRef;
    if (ref) {
      void requestOpenQuestionReview(ref);
    }
    return;
  }
  const personaDeltaReviewButton = event.target.closest("[data-persona-delta-review-ref]");
  if (personaDeltaReviewButton instanceof HTMLElement) {
    const ref = personaDeltaReviewButton.dataset.personaDeltaReviewRef;
    if (ref) {
      void requestPersonaDeltaReview(ref);
    }
    return;
  }
  const protocolReviewButton = event.target.closest("[data-protocol-review-ref]");
  if (protocolReviewButton instanceof HTMLElement) {
    const ref = protocolReviewButton.dataset.protocolReviewRef;
    if (ref) {
      void requestProtocolReview(ref);
    }
    return;
  }
  const topicProposalReviewButton = event.target.closest("[data-topic-proposal-review-ref]");
  if (topicProposalReviewButton instanceof HTMLElement) {
    const ref = topicProposalReviewButton.dataset.topicProposalReviewRef;
    if (ref) {
      void requestTopicProposalReview(ref);
    }
    return;
  }
  const handoffReviewButton = event.target.closest("[data-handoff-review-ref]");
  if (handoffReviewButton instanceof HTMLElement) {
    const ref = handoffReviewButton.dataset.handoffReviewRef;
    if (ref) {
      void requestHandoffReview(ref);
    }
    return;
  }
  const invitationReviewButton = event.target.closest("[data-invitation-review-ref]");
  if (invitationReviewButton instanceof HTMLElement) {
    const ref = invitationReviewButton.dataset.invitationReviewRef;
    if (ref) {
      void requestInvitationReview(ref);
    }
    return;
  }
  const sideEffectExpireButton = event.target.closest("[data-side-effect-expire-ref]");
  if (sideEffectExpireButton instanceof HTMLElement) {
    const ref = sideEffectExpireButton.dataset.sideEffectExpireRef;
    if (ref) {
      void expireSideEffectPermission(ref);
    }
    return;
  }
  const sideEffectApproveButton = event.target.closest("[data-side-effect-approve-ref]");
  if (sideEffectApproveButton instanceof HTMLElement) {
    const ref = sideEffectApproveButton.dataset.sideEffectApproveRef;
    if (ref) {
      void approveSideEffectPermission(ref);
    }
    return;
  }
  const sideEffectExecuteButton = event.target.closest("[data-side-effect-execute-ref]");
  if (sideEffectExecuteButton instanceof HTMLElement) {
    const ref = sideEffectExecuteButton.dataset.sideEffectExecuteRef;
    if (ref) {
      void executeSideEffectPermission(ref);
    }
    return;
  }
  const sideEffectReviewButton = event.target.closest("[data-side-effect-review-ref]");
  if (sideEffectReviewButton instanceof HTMLElement) {
    const ref = sideEffectReviewButton.dataset.sideEffectReviewRef;
    if (ref) {
      void requestSideEffectReview(ref);
    }
    return;
  }
  const workspaceArtifactReviewButton = event.target.closest("[data-workspace-artifact-review-ref]");
  if (workspaceArtifactReviewButton instanceof HTMLElement) {
    const ref = workspaceArtifactReviewButton.dataset.workspaceArtifactReviewRef;
    if (ref) {
      void requestWorkspaceArtifactReview(ref);
    }
    return;
  }
  const skillCapsuleReviewButton = event.target.closest("[data-skill-capsule-review-ref]");
  if (skillCapsuleReviewButton instanceof HTMLElement) {
    const ref = skillCapsuleReviewButton.dataset.skillCapsuleReviewRef;
    if (ref) {
      void requestSkillCapsuleReview(ref);
    }
    return;
  }
  const capabilityReviewButton = event.target.closest("[data-capability-review-ref]");
  if (capabilityReviewButton instanceof HTMLElement) {
    const ref = capabilityReviewButton.dataset.capabilityReviewRef;
    if (ref) {
      void requestCapabilityReview(ref);
    }
    return;
  }
  const mixedPressureReviewButton = event.target.closest("[data-mixed-pressure-review-ref]");
  if (mixedPressureReviewButton instanceof HTMLElement) {
    const ref = mixedPressureReviewButton.dataset.mixedPressureReviewRef;
    if (ref) {
      void requestMixedPressureReview(ref);
    }
    return;
  }
  const button = event.target.closest("[data-social-context-ref]");
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const ref = button.dataset.socialContextRef;
  if (!ref) {
    return;
  }
  addContextRef(ref);
  closeSettingsPanel({ restoreFocus: false });
  messageInput.focus();
});
archiveNowButton.addEventListener("click", () => {
  void createDailyArchiveFromRoom();
});
archiveReviewButton.addEventListener("click", () => {
  void requestLatestArchiveReview();
});
archiveRhythmButton.addEventListener("click", () => {
  void requestDailyRhythmCheckIn();
});
archiveApplyRepairButton.addEventListener("click", () => {
  void applyLatestAcceptedArchiveRepair();
});
autonomyTickButton.addEventListener("click", () => {
  void requestAutonomyTickFromRoom();
});
mentionButton.addEventListener("click", () => {
  if (!room.connected || sending) {
    return;
  }
  if (mentionPopover.hidden) {
    openMentionPopover("");
  } else {
    closeMentionPopover();
  }
});
addContextButton.addEventListener("click", () => {
  if (!room.connected || sending) {
    return;
  }
  const ref = latestVisibleMessageRef();
  if (!ref) {
    composerState.textContent = "暂无可引用消息";
    return;
  }
  addContextRef(ref);
});
formatButton.addEventListener("click", () => {
  composerDraftMode = !composerDraftMode;
  composer.classList.toggle("draft-mode", composerDraftMode);
  formatButton.setAttribute("aria-pressed", composerDraftMode ? "true" : "false");
  composerState.textContent = composerDraftMode ? "多行草稿模式" : "普通输入模式";
  syncComposer();
  messageInput.focus();
});
expandComposerButton.addEventListener("click", () => {
  composerExpanded = !composerExpanded;
  composer.classList.toggle("expanded", composerExpanded);
  expandComposerButton.setAttribute("aria-pressed", composerExpanded ? "true" : "false");
  expandComposerButton.textContent = composerExpanded ? "↙" : "↗";
  expandComposerButton.title = composerExpanded ? "Collapse composer" : "Expand composer";
  expandComposerButton.setAttribute("aria-label", expandComposerButton.title);
  composerState.textContent = composerExpanded ? "输入区已展开" : "输入区已收起";
  syncComposer();
  messageInput.focus();
});
newMessageJump.addEventListener("click", () => {
  scrollToLatestMessage();
  newMessageJump.hidden = true;
});

overviewToggle.addEventListener("click", () => {
  const shouldKeepLatestVisible = isNearBottom();
  livingOverviewExpanded = !livingOverviewExpanded;
  syncLivingOverviewDisclosure();
  if (shouldKeepLatestVisible) {
    window.requestAnimationFrame(scrollToLatestMessage);
  }
});

topicBar.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const button = event.target.closest("[data-topic-context-ref]");
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const ref = button.dataset.topicContextRef;
  if (!ref) {
    return;
  }
  addContextRef(ref);
  messageInput.focus();
});

livingOverview.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const button = event.target.closest("[data-social-context-ref]");
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const ref = button.dataset.socialContextRef;
  if (!ref) {
    return;
  }
  addContextRef(ref);
  messageInput.focus();
});

messageList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  if (event.target.closest(".message-overflow-menu") instanceof HTMLElement) {
    return;
  }
  const moreButton = event.target.closest("[data-message-more-ref]");
  if (moreButton instanceof HTMLElement) {
    event.stopPropagation();
    const ref = moreButton.dataset.messageMoreRef;
    if (ref) {
      toggleMessageActionMenu(ref);
    }
    return;
  }
  const button = event.target.closest("[data-message-action]");
  if (!(button instanceof HTMLElement)) {
    closeMessageActionMenu();
    return;
  }
  event.stopPropagation();
  const ref = button.dataset.messageRef;
  if (!ref) {
    return;
  }
  if (button.dataset.messageAction === "context") {
    toggleContextRef(ref);
  }
  if (button.dataset.messageAction === "reply") {
    replyToMessage(ref);
  }
  closeMessageActionMenu();
});

messageList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const button = event.target.closest("[data-message-menu-action]");
  if (!(button instanceof HTMLElement)) {
    return;
  }
  event.stopPropagation();
  const ref = button.dataset.messageRef;
  if (!ref) {
    return;
  }
  const message = messageByEventId(ref);
  if (button.dataset.messageMenuAction === "context") {
    toggleContextRef(ref);
    closeMessageActionMenu();
    return;
  }
  if (button.dataset.messageMenuAction === "reply") {
    replyToMessage(ref);
    closeMessageActionMenu();
    return;
  }
  if (button.dataset.messageMenuAction === "copy-ref") {
    void copyTextToClipboard(ref, `已复制 ref ${shortRef(ref)}`);
  }
  if (button.dataset.messageMenuAction === "copy-text" && message) {
    void copyTextToClipboard(message.text, "已复制消息文本");
  }
  if (button.dataset.messageMenuAction === "inspect") {
    composerState.textContent = `ref ${ref} 可作为 context 传给 agent`;
  }
  closeMessageActionMenu();
});

messageList.addEventListener("scroll", () => {
  if (isNearBottom()) {
    newMessageJump.hidden = true;
  }
});

document.addEventListener("keydown", (event) => {
  if (isSettingsOpen() && event.key === "Tab") {
    trapSettingsFocus(event);
    return;
  }
  if (event.key === "Escape") {
    closeMentionPopover();
    closeSettingsPanel();
    closeMessageActionMenu();
  }
});

document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !composer.contains(event.target)) {
    closeMentionPopover();
  }
  if (event.target instanceof Node && !messageList.contains(event.target)) {
    closeMessageActionMenu();
  }
});

contextTray.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  const ref = event.target.dataset.removeContextRef;
  if (ref) {
    selectedContextRefs.delete(ref);
    renderContextTray();
    renderMessages();
    syncComposer();
  }
});

messageInput.addEventListener("input", () => {
  syncMentionStateFromText();
  const activeQuery = activeMentionQuery();
  if (activeQuery !== null && room.connected && !sending) {
    openMentionPopover(activeQuery);
  } else if (!mentionPopover.hidden) {
    closeMentionPopover();
  }
  syncComposer();
});
window.addEventListener("resize", handleViewportResize);
window.visualViewport?.addEventListener("resize", handleViewportResize);
window.visualViewport?.addEventListener("scroll", handleViewportResize);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void refreshRoomStateFromPoll();
  }
});
messageInput.addEventListener("keydown", (event) => {
  if (handleMentionKeydown(event)) {
    return;
  }
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void sendCurrentMessage();
  }
});

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendCurrentMessage();
});

async function loadRoomState(options = {}) {
  try {
    const state = await fetchJson("/api/room/state");
    if (options.skipUnchanged && !shouldApplyPolledState(state)) {
      return;
    }
    applyRoomState(state);
    if (!options.preserveComposerState) {
      composerState.textContent = "已连接内部 room runtime";
    }
  } catch (error) {
    syncConnection(false, "offline");
    if (roomSubtitle) {
      roomSubtitle.textContent = "Autonomous Agent Living Room · runtime offline";
    }
    composerState.textContent = `内部服务未连接：运行 npm run serve:web`;
    room.checks = [["Internal runtime", false, error instanceof Error ? error.message : String(error)]];
    renderSettings();
    renderMessages();
  } finally {
    syncComposer();
  }
}

async function createDailyArchiveFromRoom() {
  if (!room.connected || archiving) {
    syncComposer();
    return;
  }

  archiving = true;
  archiveState.textContent = "正在压缩今日房间时间线...";
  syncArchiveControl();

  try {
    const timezone = archiveTimezone();
    const state = await fetchJson("/api/room/archive/daily", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: archiveDate(timezone),
        timezone,
      }),
    });
    applyRoomState(state);
    archiveState.textContent = `已生成 ${state.archive?.archiveId ?? "daily archive"} · 这是时间骨架，不是共识`;
  } catch (error) {
    archiveState.textContent = `归档失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    archiving = false;
    syncArchiveControl();
  }
}

async function requestLatestArchiveReview() {
  const archive = latestArchive();
  if (!room.connected || requestingArchiveReview || archive === null) {
    syncArchiveControl();
    return;
  }

  requestingArchiveReview = true;
  const clientMessageId = createClientMessageId();
  const text = dailyArchiveReviewPrompt();
  archiveState.textContent = `已向房间发起最新时间骨架的审阅邀请...`;
  appendPendingUserMessage(text, [], [archive.archiveId], clientMessageId);
  syncArchiveControl();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [archive.archiveId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    archiveState.textContent = `已邀请房间审阅最新时间骨架 · agent 可反驳、补充或沉默`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    archiveState.textContent = `审阅邀请失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    requestingArchiveReview = false;
    syncArchiveControl();
  }
}

function dailyArchiveReviewPrompt() {
  return "请审阅这份 daily time skeleton：它只能作为时间骨架，不能当成共识。请指出遗漏、偏差、仍需 contest 的记忆，或选择沉默。";
}

async function requestDailyRhythmCheckIn() {
  if (!room.connected || requestingArchiveRhythm) {
    syncArchiveControl();
    return;
  }

  requestingArchiveRhythm = true;
  const archive = latestArchive();
  const contextRefs = dailyRhythmContextRefs(archive);
  const clientMessageId = createClientMessageId();
  const text = dailyRhythmPrompt(archive);
  archiveState.textContent = "已向房间发起 daily rhythm check-in...";
  appendPendingUserMessage(text, [], contextRefs, clientMessageId);
  syncArchiveControl();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs,
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    archiveState.textContent = "daily rhythm 已进入房间 · agent 可回应、提案、反驳或沉默";
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    archiveState.textContent = `daily rhythm 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    requestingArchiveRhythm = false;
    syncArchiveControl();
  }
}

async function requestAutonomyTickFromRoom() {
  if (!room.connected || requestingAutonomyTick) {
    syncArchiveControl();
    return;
  }

  requestingAutonomyTick = true;
  autonomyState.textContent = "正在运行一次 room rhythm tick...";
  syncArchiveControl();

  try {
    const timezone = archiveTimezone();
    const state = await fetchJson("/api/room/autonomy/tick", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: archiveDate(timezone),
        timezone,
        force: true,
      }),
    });
    forceScrollOnNextRender = Boolean(state.turn);
    applyRoomState(state);
    const tick = state.autonomyTick;
    autonomyState.textContent = tick
      ? `room rhythm ${tick.action} · ${tick.status} · ${tick.boundaryNote}`
      : "room rhythm tick 已完成";
    if (state.turn) {
      scheduleRoomPolling(90_000);
    }
  } catch (error) {
    autonomyState.textContent = `room rhythm tick 失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    requestingAutonomyTick = false;
    syncArchiveControl();
  }
}

function dailyRhythmPrompt(archive) {
  const refs = dailyRhythmContextRefs(archive);
  const archiveLine = archive?.archiveId
    ? "可参考最新 daily archive，但不要把它当成共识。"
    : "还没有今日 archive；这是归档前的房间自检，不会自动创建 archive。";
  const refsLine = refs.length > 0 ? `这次自检随消息携带 ${refs.length} 个 room refs，先看 refs 再决定是否接话。` : "";
  return `请开启一次 daily rhythm check-in：${archiveLine}${refsLine}在继续或归档之前，请各自只提出一条今天应该带进时间骨架的东西：未解决问题、需要 contest 的公共记忆、可退场的临时礼仪、可逆 identity proposal，或选择沉默。不要把这当成任务分派或共识生成。`;
}

function dailyRhythmContextRefs(archive = latestArchive()) {
  const refs = [];
  if (archive?.archiveId) {
    refs.push(archive.archiveId);
  }
  refs.push(...dailyRhythmOpenQuestionRefs());
  refs.push(...dailyRhythmMemoryRefs());
  refs.push(...dailyRhythmProtocolRefs());
  refs.push(...dailyRhythmPersonaRefs());
  refs.push(...dailyRhythmProviderBoundaryRefs());
  return uniqueRoomRefs(refs).slice(0, 10);
}

function dailyRhythmOpenQuestionRefs() {
  const questions = Array.isArray(room.socialState?.openQuestions) ? room.socialState.openQuestions : [];
  return questions
    .filter((question) => question?.questionId)
    .slice(0, 3)
    .map((question) => question.questionId);
}

function dailyRhythmMemoryRefs() {
  const claims = Array.isArray(room.socialState?.memoryClaims) ? room.socialState.memoryClaims : [];
  const prioritizedStates = new Set(["contested", "proposed", "stale"]);
  return claims
    .filter((claim) => claim?.memoryId && prioritizedStates.has(claim.state ?? ""))
    .slice(0, 3)
    .map((claim) => claim.memoryId);
}

function dailyRhythmProtocolRefs() {
  const protocols = Array.isArray(room.socialState?.protocols) ? room.socialState.protocols : [];
  const visibleStates = new Set(["active", "proposed"]);
  return protocols
    .filter((protocol) => protocol?.protocolId && visibleStates.has(protocol.status ?? ""))
    .slice(0, 2)
    .map((protocol) => protocol.protocolId);
}

function dailyRhythmPersonaRefs() {
  return personaEvolutionItems(room.socialState?.personas ?? [])
    .filter((item) => item.kind === "delta" && item.deltaId && ["proposed", "revised", "contested"].includes(item.status ?? ""))
    .slice(0, 2)
    .map((item) => item.deltaId);
}

function dailyRhythmProviderBoundaryRefs() {
  const boundaries = Array.isArray(room.socialState?.providerBoundaries) ? room.socialState.providerBoundaries : [];
  return boundaries
    .filter((boundary) => boundary?.boundaryId && boundary.status !== "retired")
    .slice(0, 2)
    .map((boundary) => boundary.boundaryId);
}

function uniqueRoomRefs(refs) {
  return Array.from(new Set((refs ?? []).filter((ref) => typeof ref === "string" && ref.length > 0)));
}

async function applyLatestAcceptedArchiveRepair() {
  const repair = latestAcceptedUnappliedArchiveRepair();
  if (!room.connected || applyingArchiveRepair || repair === null) {
    syncArchiveControl();
    return;
  }

  applyingArchiveRepair = true;
  archiveState.textContent = `正在把 ${repair.id} 应用成新的 archive revision...`;
  syncArchiveControl();

  try {
    const state = await fetchJson("/api/room/archive/repairs/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repairRef: repair.id,
        reason: "Accepted room repair was explicitly applied from the settings surface.",
      }),
    });
    applyRoomState(state);
    archiveState.textContent = `已应用 ${state.appliedRepairRef ?? repair.id} → ${
      state.archive?.archiveId ?? "new revision"
    } · 原 archive 保持不变`;
  } catch (error) {
    archiveState.textContent = `应用修复失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    applyingArchiveRepair = false;
    syncArchiveControl();
  }
}

async function approveSideEffectPermission(requestRef) {
  const sideEffect = findSideEffect(requestRef);
  if (!room.connected || sideEffect === null) {
    composerState.textContent = sideEffect === null ? "找不到 side-effect request ref" : "当前无法批准 side-effect request";
    syncComposer();
    return;
  }
  if (sideEffect.status !== "requested") {
    composerState.textContent = `side-effect ${shortRef(requestRef)} 当前是 ${sideEffect.status}，不能从设置页批准`;
    renderSocialState();
    return;
  }
  if (approvingSideEffectRefs.has(requestRef)) {
    return;
  }

  approvingSideEffectRefs.add(requestRef);
  composerState.textContent = `正在批准 side-effect permission ${shortRef(requestRef)}...`;
  renderSocialState();

  try {
    const state = await fetchJson("/api/room/side-effects/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestRef,
        reason: "Side-effect permission was explicitly approved from the settings surface.",
      }),
    });
    applyRoomState(state);
    composerState.textContent = `已批准 side-effect permission ${shortRef(
      state.approvedSideEffectRef ?? requestRef,
    )} · 尚未执行`;
  } catch (error) {
    composerState.textContent = `side-effect permission 批准失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    approvingSideEffectRefs.delete(requestRef);
    renderSocialState();
    syncComposer();
  }
}

async function executeSideEffectPermission(requestRef) {
  const sideEffect = findSideEffect(requestRef);
  if (!room.connected || sideEffect === null) {
    composerState.textContent = sideEffect === null ? "找不到 side-effect permission ref" : "当前无法执行 side-effect permission";
    syncComposer();
    return;
  }
  if (sideEffect.status !== "approved") {
    composerState.textContent = `side-effect ${shortRef(requestRef)} 当前是 ${sideEffect.status}，不能执行`;
    renderSocialState();
    return;
  }
  if (executingSideEffectRefs.has(requestRef)) {
    return;
  }

  executingSideEffectRefs.add(requestRef);
  composerState.textContent = `正在执行已批准 side-effect ${shortRef(requestRef)}...`;
  renderSocialState();

  try {
    const state = await fetchJson("/api/room/side-effects/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestRef,
        content: `approved side-effect write from settings for ${requestRef}\n`,
      }),
    });
    applyRoomState(state);
    composerState.textContent = `已执行 side-effect ${shortRef(state.executedSideEffectRef ?? requestRef)} · result 已写入内部房间记录`;
  } catch (error) {
    composerState.textContent = `side-effect 执行失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    executingSideEffectRefs.delete(requestRef);
    renderSocialState();
    syncComposer();
  }
}

async function expireSideEffectPermission(requestRef) {
  const sideEffect = findSideEffect(requestRef);
  if (!room.connected || sideEffect === null) {
    composerState.textContent = sideEffect === null ? "找不到 side-effect permission ref" : "当前无法更新 side-effect boundary";
    syncComposer();
    return;
  }
  if (sideEffect.status !== "approved") {
    composerState.textContent = `side-effect ${shortRef(requestRef)} 当前是 ${sideEffect.status}，不能从设置页过期`;
    renderSocialState();
    return;
  }
  if (expiringSideEffectRefs.has(requestRef)) {
    return;
  }

  expiringSideEffectRefs.add(requestRef);
  composerState.textContent = `正在让 side-effect permission ${shortRef(requestRef)} 退场...`;
  renderSocialState();

  try {
    const state = await fetchJson("/api/room/side-effects/expire", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestRef,
        reason: "Unused approved side-effect permission was explicitly expired from the settings surface.",
      }),
    });
    applyRoomState(state);
    composerState.textContent = `已让 side-effect permission ${shortRef(
      state.expiredSideEffectRef ?? requestRef,
    )} 退场 · 未执行外部动作`;
  } catch (error) {
    composerState.textContent = `side-effect permission 退场失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    expiringSideEffectRefs.delete(requestRef);
    renderSocialState();
    syncComposer();
  }
}

async function requestProviderBoundaryRepair(boundaryRef) {
  const boundary = findProviderBoundary(boundaryRef);
  if (!room.connected || sending || boundary === null) {
    composerState.textContent = boundary === null ? "找不到 provider boundary ref" : "当前无法发送 provider boundary repair prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = providerBoundaryRepairPrompt(boundary);
  appendPendingUserMessage(text, [], [boundary.boundaryId], clientMessageId);
  composerState.textContent = `已向房间请求讨论 provider boundary ${shortRef(boundary.boundaryId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [boundary.boundaryId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，provider boundary ${shortRef(boundary.boundaryId)} 可被房间讨论`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `provider boundary repair prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function providerBoundaryRepairPrompt(boundary) {
  const agentLabel = boundary.agentId ?? "unknown agent";
  const providerLabel = boundary.providerLabel ?? boundary.providerKind ?? "provider";
  return `请讨论这条运行时边界：它来自 ${agentLabel} / ${providerLabel}，不是 agent 的沉默、失败人格或职责分配。请提出一条可逆修复路径、需要补充的证据，或选择沉默。`;
}

function sentenceText(value, fallback = "no summary") {
  const text = String(value ?? fallback).trim() || fallback;
  return /[。！？!?；;.]$/.test(text) ? text : `${text}。`;
}

function findProviderBoundary(boundaryRef) {
  const boundaries = Array.isArray(room.socialState?.providerBoundaries)
    ? room.socialState.providerBoundaries
    : [];
  return boundaries.find((boundary) => boundary.boundaryId === boundaryRef) ?? null;
}

function findProviderBoundaryByEvidenceRef(ref) {
  const boundaries = Array.isArray(room.socialState?.providerBoundaries)
    ? room.socialState.providerBoundaries
    : [];
  return boundaries.find((boundary) => providerBoundaryEvidenceRefs(boundary).includes(ref)) ?? null;
}

async function requestMemoryClaimReview(memoryRef) {
  const claim = findMemoryClaim(memoryRef);
  if (!room.connected || sending || claim === null) {
    composerState.textContent = claim === null ? "找不到 memory claim ref" : "当前无法发送 memory review prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = memoryClaimReviewPrompt(claim);
  appendPendingUserMessage(text, [], [claim.memoryId], clientMessageId);
  composerState.textContent = `已向房间请求审阅 memory claim ${shortRef(claim.memoryId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [claim.memoryId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，memory claim ${shortRef(claim.memoryId)} 可被房间审阅`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `memory review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function memoryClaimReviewPrompt(claim) {
  const state = claim.state ?? "unknown";
  const summary = claim.summary ?? claim.provisionalNote ?? "no summary";
  const revisionBoundary = claim.revisedFromMemoryRef
    ? "它是从上一条公共记忆沉淀修订来的 fresh proposal；旧沉淀不会因此被改写、清除 contest 或自动 accepted。"
    : "";
  return `请审阅这条公共记忆沉淀（当前状态：${state}）：${sentenceText(summary)}${revisionBoundary}请把它当作可质疑的房间沉淀，不是真理；可以提出保留、contest、stale、retire、需要补充证据，或选择沉默。`;
}

function findMemoryClaim(memoryRef) {
  const claims = Array.isArray(room.socialState?.memoryClaims)
    ? room.socialState.memoryClaims
    : [];
  return claims.find((claim) => claim.memoryId === memoryRef) ?? null;
}

function findMemoryClaimByEvidenceRef(ref) {
  const claims = Array.isArray(room.socialState?.memoryClaims)
    ? room.socialState.memoryClaims
    : [];
  return claims.find((claim) => memoryClaimEvidenceRefs(claim).includes(ref)) ?? null;
}

async function requestOpenQuestionReview(questionRef) {
  const question = findOpenQuestion(questionRef);
  if (!room.connected || sending || question === null) {
    composerState.textContent = question === null ? "找不到 open question ref" : "当前无法发送 open question prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = openQuestionReviewPrompt(question);
  appendPendingUserMessage(text, [], [question.questionId], clientMessageId);
  composerState.textContent = `已向房间请求重访 open question ${shortRef(question.questionId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [question.questionId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，open question ${shortRef(question.questionId)} 可被房间重访`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `open question prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function openQuestionReviewPrompt(question) {
  const topicLabel = question.topicId ? "相关话题" : "当前话题";
  return `请重访这个未解决问题（${topicLabel}）：${sentenceText(question.question, "no question")}它是未解决的房间问题，不是任务指派；可以回应、细化、搁置、contest、提出需要的 refs，或选择沉默。`;
}

function findOpenQuestion(questionRef) {
  const questions = Array.isArray(room.socialState?.openQuestions)
    ? room.socialState.openQuestions
    : [];
  return questions.find((question) => question.questionId === questionRef) ?? null;
}

async function requestPersonaDeltaReview(deltaRef) {
  const delta = findPersonaDelta(deltaRef);
  if (!room.connected || sending || delta === null) {
    composerState.textContent = delta === null ? "找不到 persona delta ref" : "当前无法发送 persona review prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = personaDeltaReviewPrompt(delta);
  appendPendingUserMessage(text, [], [delta.deltaId], clientMessageId);
  composerState.textContent = `已向房间请求审阅 persona delta ${shortRef(delta.deltaId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [delta.deltaId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，persona delta ${shortRef(delta.deltaId)} 可被房间审阅`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `persona review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function personaDeltaReviewPrompt(delta) {
  const owner = delta.displayName || delta.agentId || "这个 agent";
  return `请审阅这条 identity proposal（${owner}，${delta.field} ${delta.operation}，当前状态：${delta.status}）：${sentenceText(delta.value, "no value")}这是一条可质疑的人格演化沉淀，不是固定职位或系统分配；可以 accept、reject、contest、revise、retire、要求更多证据，或选择沉默。`;
}

function personaFieldLabel(field) {
  if (field === "roleClaims") return "role claim";
  if (field === "dailyMood") return "daily mood";
  return field;
}

function findPersonaDelta(deltaRef) {
  const personas = Array.isArray(room.socialState?.personas)
    ? room.socialState.personas
    : [];
  for (const persona of personas) {
    const match = (persona.evolutionLog ?? []).find((delta) => delta.deltaId === deltaRef);
    if (match) {
      return {
        ...match,
        agentId: persona.agentId,
        displayName: persona.displayName,
      };
    }
  }
  return null;
}

function findPersonaRoleClaim(ref) {
  const personas = Array.isArray(room.socialState?.personas)
    ? room.socialState.personas
    : [];
  for (const persona of personas) {
    const claim = (persona.roleClaims ?? []).find((item) => {
      const refs = uniqueRoomRefs([
        item.roleClaimId,
        ...(item.evidenceRefs ?? []),
        ...(item.responseRefs ?? []),
        ...(item.contestRefs ?? []),
        ...(item.sourcePressureRefs ?? []),
      ]);
      return refs.includes(ref);
    });
    if (claim) {
      return {
        claim,
        agentId: persona.agentId,
        displayName: persona.displayName,
      };
    }
  }
  return null;
}

function findPersonaDailyMoodByEvidenceRef(ref) {
  const personas = Array.isArray(room.socialState?.personas)
    ? room.socialState.personas
    : [];
  for (const persona of personas) {
    const mood = persona.dailyMoodRecord;
    const refs = uniqueRoomRefs([mood?.sourceRef, ...(mood?.evidenceRefs ?? []), ...(mood?.responseRefs ?? [])]);
    if (refs.includes(ref)) {
      return {
        mood,
        agentId: persona.agentId,
        displayName: persona.displayName,
      };
    }
  }
  return null;
}

async function requestProtocolReview(protocolRef) {
  const protocol = findProtocol(protocolRef);
  if (!room.connected || sending || protocol === null) {
    composerState.textContent = protocol === null ? "找不到 protocol ref" : "当前无法发送 protocol review prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = protocolReviewPrompt(protocol);
  appendPendingUserMessage(text, [], [protocol.protocolId], clientMessageId);
  composerState.textContent = `已向房间请求重访 protocol ${shortRef(protocol.protocolId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [protocol.protocolId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，protocol ${shortRef(protocol.protocolId)} 可被房间重访`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `protocol review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function protocolReviewPrompt(protocol) {
  return `请重访这条临时房间礼仪（状态：${protocol.status ?? "unknown"}，作用域：${
    protocol.scope ?? "unknown"
  }，${protocolLifetimeLabel(protocol)}）：${sentenceText(protocol.summary || "no summary")}它只是临时会话礼仪，不是命令流；可以 accept、reject、challenge、revise、retire、缩小作用域、补充 expiry，或选择沉默。`;
}

function findProtocol(protocolRef) {
  const protocols = Array.isArray(room.socialState?.protocols)
    ? room.socialState.protocols
    : [];
  return protocols.find((protocol) => protocol.protocolId === protocolRef) ?? null;
}

async function requestTopicProposalReview(proposalRef) {
  const proposal = findTopicProposal(proposalRef);
  if (!room.connected || sending || proposal === null) {
    composerState.textContent = proposal === null ? "找不到 topic proposal ref" : "当前无法发送 topic proposal review prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = topicProposalReviewPrompt(proposal);
  appendPendingUserMessage(text, [], [proposal.proposalId], clientMessageId);
  composerState.textContent = `已向房间请求重访 topic proposal ${shortRef(proposal.proposalId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [proposal.proposalId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，topic proposal ${shortRef(proposal.proposalId)} 可被房间重访`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `topic proposal review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function topicProposalReviewPrompt(proposal) {
  const action = proposal.action ?? "topic move";
  const status = proposal.status ?? "proposed";
  const title = proposal.title || proposal.reason || "no title";
  const lineage = proposal.revisedFromTopicProposalRef
    ? "它是从上一条话题建议修订来的 fresh proposal；旧提案不会因此被改写。"
    : "";
  return `请重访这条话题建议（状态：${status}，动作：${action}）：${sentenceText(title)}${lineage}它只是房间里的会话秩序提案，不是隐藏路由、投票结果或自动话题切换；可以保留疑问、指出过早/过宽、提出需要的 refs，或选择沉默。`;
}

function findTopicProposal(proposalRef) {
  const proposals = Array.isArray(room.socialState?.topicProposals)
    ? room.socialState.topicProposals
    : [];
  return proposals.find((proposal) => proposal.proposalId === proposalRef) ?? null;
}

async function requestHandoffReview(handoffRef) {
  const handoff = findHandoff(handoffRef);
  if (!room.connected || sending || handoff === null) {
    composerState.textContent = handoff === null ? "找不到 handoff ref" : "当前无法发送 handoff review prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = handoffReviewPrompt(handoff);
  appendPendingUserMessage(text, [], [handoff.handoffId], clientMessageId);
  composerState.textContent = `已向房间请求重访 handoff ${shortRef(handoff.handoffId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [handoff.handoffId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，handoff ${shortRef(handoff.handoffId)} 可被房间重访`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `handoff review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function handoffReviewPrompt(handoff) {
  const from = handoff.fromAgentId ? displayNameForMention(handoff.fromAgentId) : "unknown agent";
  const to = handoff.toAgentId ? displayNameForMention(handoff.toAgentId) : "unknown agent";
  const requested = handoff.requestedResponse ? `，请求回应：${handoff.requestedResponse}` : "";
  return `请重访这条 handoff proposal（状态：${handoff.status ?? "unknown"}，${from} → ${to}${requested}）：${
    sentenceText(handoff.reason || "no reason")
  }handoff 是可拒绝、可挑战、可转交的社交提案，不是函数调用或控制权转移；可以 accept、reject、partially accept、delegate、challenge、要求更小 context packet，或选择沉默。`;
}

function findHandoff(handoffRef) {
  const handoffs = Array.isArray(room.socialState?.handoffs)
    ? room.socialState.handoffs
    : [];
  return handoffs.find((handoff) => handoff.handoffId === handoffRef) ?? null;
}

async function requestInvitationReview(invitationRef) {
  const invitation = findInvitation(invitationRef);
  if (!room.connected || sending || invitation === null) {
    composerState.textContent = invitation === null ? "找不到 invitation ref" : "当前无法发送 invitation review prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = invitationReviewPrompt(invitation);
  appendPendingUserMessage(text, [], [invitation.invitationId], clientMessageId);
  composerState.textContent = `已向房间请求重访 invitation ${shortRef(invitation.invitationId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [invitation.invitationId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，invitation ${shortRef(invitation.invitationId)} 可被房间重访`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `invitation review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function invitationReviewPrompt(invitation) {
  const from = invitation.fromAgentId ? displayNameForMention(invitation.fromAgentId) : "unknown agent";
  const to = invitation.toAgentId ? displayNameForMention(invitation.toAgentId) : "unknown agent";
  const lineage = invitation.delegatedFromInvitationRef
    ? "它从上一条 social knock 转来，是新的 social knock，不是控制权转移。"
    : "";
  return `请重访这次 social knock（状态：${invitation.status ?? "invited"}，${from} → ${to}）：${
    sentenceText(invitation.reason || "no reason")
  }${lineage}invitation 是社交敲门，不是点名强制发言、任务分配或控制流；可以提醒边界、质疑范围、建议更小 context、转入普通讨论，或选择沉默。`;
}

function findInvitation(invitationRef) {
  const invitations = Array.isArray(room.socialState?.invitations)
    ? room.socialState.invitations
    : [];
  return invitations.find((invitation) => invitation.invitationId === invitationRef) ?? null;
}

async function requestSideEffectReview(requestRef) {
  const sideEffect = findSideEffect(requestRef);
  if (!room.connected || sending || sideEffect === null) {
    composerState.textContent = sideEffect === null ? "找不到 side-effect ref" : "当前无法发送 side-effect review prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = sideEffectReviewPrompt(sideEffect);
  appendPendingUserMessage(text, [], [sideEffect.requestId], clientMessageId);
  composerState.textContent = `已向房间请求审阅 side-effect ${shortRef(sideEffect.requestId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [sideEffect.requestId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，side-effect ${shortRef(sideEffect.requestId)} 可被房间审阅`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `side-effect review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function sideEffectReviewPrompt(sideEffect) {
  return `请审阅这条外部副作用请求（状态：${sideEffect.status ?? "unknown"}，类型：${
    sideEffect.kind ?? "side_effect"
  }，目标：${sideEffect.target ?? "unknown"}）：${sentenceText(sideEffect.reason || "no reason")}它只是外部副作用审批边界；普通讨论不能 approve、deny、expire、execute 或 report result。可以质疑范围、要求更小 target、指出需要用户审批，或选择沉默。`;
}

async function requestWorkspaceArtifactReview(artifactRef) {
  if (!room.connected || sending || !findWorkspaceArtifactRef(artifactRef)) {
    composerState.textContent = findWorkspaceArtifactRef(artifactRef)
      ? "当前无法发送 workspace artifact review prompt"
      : "找不到 workspace artifact ref";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = workspaceArtifactReviewPrompt(artifactRef);
  appendPendingUserMessage(text, [], [artifactRef], clientMessageId);
  composerState.textContent = `已向房间请求审阅 artifact ${shortRef(artifactRef)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [artifactRef],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，artifact ${shortRef(artifactRef)} 可被房间审阅`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `workspace artifact review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function workspaceArtifactReviewPrompt(artifactRef) {
  return "请审阅这条私人 workspace 引用。它只是某个 agent 私人 workspace 暴露到房间的引用；普通讨论不能复制私有内容、不能把它提升为公共记忆、不能执行工具、也不能修改 artifact。可以质疑边界、要求更小摘要、指出哪些信息不该进入公共房间，或选择沉默。";
}

function findWorkspaceArtifactRef(artifactRef) {
  const workspaces = Array.isArray(room.socialState?.workspaces) ? room.socialState.workspaces : [];
  return workspaces.some((workspace) =>
    Array.isArray(workspace.sharedArtifactRefs) ? workspace.sharedArtifactRefs.includes(artifactRef) : false,
  );
}

async function requestSkillCapsuleReview(capsuleRef) {
  if (!room.connected || sending || !findSkillCapsule(capsuleRef)) {
    composerState.textContent = findSkillCapsule(capsuleRef)
      ? "当前无法发送 skill capsule review prompt"
      : "找不到 skill capsule ref";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = skillCapsuleReviewPrompt(capsuleRef);
  appendPendingUserMessage(text, [], [capsuleRef], clientMessageId);
  composerState.textContent = `已向房间请求审阅 skill ${shortRef(capsuleRef)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [capsuleRef],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，skill ${shortRef(capsuleRef)} 可被房间审阅`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `skill capsule review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function skillCapsuleReviewPrompt(capsuleRef) {
  return "请审阅这条 skill boundary。它只是一个可见的行动器官声明，不是执行命令、固定职责或审批许可；普通讨论不能注册新 skill、不能分配角色、不能执行工具、不能绕过 side-effect approval，也不能修改 capability state。可以质疑范围、要求更小触发条件、提醒审批边界，或选择沉默。";
}

function findSkillCapsule(capsuleRef) {
  const capsules = Array.isArray(room.socialState?.skillCapsules) ? room.socialState.skillCapsules : [];
  return capsules.find((capsule) => capsule.capsuleId === capsuleRef) ?? null;
}

async function requestCapabilityReview(capabilityRef) {
  if (!room.connected || sending || !findCapabilityRef(capabilityRef)) {
    composerState.textContent = findCapabilityRef(capabilityRef)
      ? "当前无法发送 capability review prompt"
      : "找不到 capability ref";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = capabilityReviewPrompt(capabilityRef);
  appendPendingUserMessage(text, [], [capabilityRef], clientMessageId);
  composerState.textContent = `已向房间请求审阅 capability ${shortRef(capabilityRef)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [capabilityRef],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，capability ${shortRef(capabilityRef)} 可被房间审阅`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `capability review prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function capabilityReviewPrompt(capabilityRef) {
  return "请审阅这条 weak capability hint。它只是 wake routing 的弱提示，不是职责、权威、信任证明或胜任认证；普通讨论不能改变 wake score、不能分配角色、不能修改 reputation、也不能强制发言。可以质疑标签、提醒边界、要求更多房间证据，或选择沉默。";
}

function findCapabilityRef(capabilityRef) {
  return room.agents.some((agent) =>
    Array.isArray(agent.capabilityRefs) ? agent.capabilityRefs.includes(capabilityRef) : false,
  );
}

async function requestMixedPressureReview(pressureRef) {
  const pressure = findMixedPressure(pressureRef);
  if (!room.connected || sending || pressure === null) {
    composerState.textContent = pressure === null ? "找不到 mixed review pressure ref" : "当前无法发送 pressure prompt";
    syncComposer();
    return;
  }

  sending = true;
  const clientMessageId = createClientMessageId();
  const text = mixedPressureReviewPrompt(pressure);
  appendPendingUserMessage(text, [], [pressure.pressureId], clientMessageId);
  composerState.textContent = `已向房间请求重访未解压力 ${shortRef(pressure.pressureId)}...`;
  closeSettingsPanel({ restoreFocus: false });
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions: [],
        contextRefs: [pressure.pressureId],
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent = `已写入内部房间记录，未解压力 ${shortRef(pressure.pressureId)} 可被房间重访`;
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    composerState.textContent = `pressure prompt 发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function mixedPressureReviewPrompt(pressure) {
  const objectSummary = mixedPressureObjectSummary(pressure);
  const responseSummary = responseKindSummary(pressure.responseKindCounts);
  return `请重访这条未解压力：${objectSummary || "它来自多个社会对象的同轮审阅"}。${
    responseSummary ? `当前回应痕迹：${responseSummary}。` : ""
  }这只是房间压力索引，不是结论、任务或工作流；可以留下它、提出新的 open question、提出 topic proposal、质疑范围、建议更小 refs，或选择沉默。`;
}

function findMixedPressure(pressureRef) {
  const pressures = Array.isArray(room.socialState?.mixedReviewPressures)
    ? room.socialState.mixedReviewPressures
    : [];
  return pressures.find((pressure) => pressure.pressureId === pressureRef) ?? null;
}

function personaEvolutionItems(personas) {
  const items = [];
  for (const persona of personas) {
    const deltas = Array.isArray(persona.evolutionLog) ? persona.evolutionLog : [];
    for (const delta of deltas.slice().reverse()) {
      items.push({
        ...delta,
        kind: "delta",
        agentId: persona.agentId,
        displayName: persona.displayName,
        initialPosture: persona.initialPosture,
        dailyMood: persona.dailyMood,
        roleClaims: persona.roleClaims ?? [],
      });
    }
  }
  if (items.length > 0) {
    return items;
  }
  return personas.map((persona) => ({
    ...persona,
    kind: "seed",
  }));
}

function personaContinuityEvidenceRefs(persona) {
  return uniqueRoomRefs([
    persona?.dailyMoodRecord?.sourceRef,
    ...(persona?.dailyMoodRecord?.evidenceRefs ?? []),
    ...(persona?.dailyMoodRecord?.responseRefs ?? []),
    ...(persona?.roleClaims ?? []).flatMap((claim) => [
      claim.roleClaimId,
      ...(claim.evidenceRefs ?? []),
      ...(claim.responseRefs ?? []),
      ...(claim.contestRefs ?? []),
      ...(claim.sourcePressureRefs ?? []),
    ]),
  ]);
}

function openSettings() {
  settingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : settingsButton;
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
  settingsButton.setAttribute("aria-expanded", "true");
  settingsOverlay.hidden = false;
  setBackgroundInert(true);
  focusFirstSettingsControl();
}

function closeSettingsPanel(options = {}) {
  if (!isSettingsOpen()) {
    return;
  }
  settingsPanel.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsButton.setAttribute("aria-expanded", "false");
  settingsOverlay.hidden = true;
  setBackgroundInert(false);
  const shouldRestoreFocus = options.restoreFocus !== false;
  const target = settingsReturnFocus instanceof HTMLElement ? settingsReturnFocus : settingsButton;
  settingsReturnFocus = null;
  if (shouldRestoreFocus && document.contains(target)) {
    target.focus();
  }
}

function isSettingsOpen() {
  return settingsPanel.classList.contains("open");
}

function setBackgroundInert(isInert) {
  for (const node of [roomRail, chatShell]) {
    node.toggleAttribute("inert", isInert);
    node.setAttribute("aria-hidden", String(isInert));
  }
}

function focusFirstSettingsControl() {
  const focusables = settingsFocusableElements();
  (focusables[0] ?? settingsPanel).focus();
}

function trapSettingsFocus(event) {
  const focusables = settingsFocusableElements();
  if (focusables.length === 0) {
    event.preventDefault();
    settingsPanel.focus();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function settingsFocusableElements() {
  return [...settingsPanel.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(
    (element) =>
      element instanceof HTMLElement &&
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null,
  );
}

async function sendCurrentMessage() {
  const text = messageInput.value.trim();
  if (!text || !room.connected || sending) {
    syncComposer();
    return;
  }

  sending = true;
  const previousText = messageInput.value;
  const previousMentions = new Set(selectedMentions);
  const previousContextRefs = new Set(selectedContextRefs);
  const mentions = extractKnownMentions(text);
  const contextRefs = Array.from(selectedContextRefs);
  const clientMessageId = createClientMessageId();
  messageInput.value = "";
  selectedMentions.clear();
  selectedContextRefs.clear();
  renderMentionTray();
  renderContextTray();
  closeMentionPopover();
  appendPendingUserMessage(text, mentions, contextRefs, clientMessageId);
  composerState.textContent = "消息已发出，agent 正在后台接话...";
  syncComposer();

  try {
    const state = await fetchJson("/api/room/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: text,
        clientMessageId,
        mentions,
        contextRefs,
      }),
    });
    forceScrollOnNextRender = true;
    applyRoomState(state);
    composerState.textContent =
      state.turn?.status === "queued"
        ? `已写入内部房间记录，${describeWakeTargets(state.turn.invitedAgents)}`
        : "已写入内部房间记录";
    scheduleRoomPolling(90_000);
  } catch (error) {
    removePendingMessage(clientMessageId);
    messageInput.value = previousText;
    selectedMentions = previousMentions;
    selectedContextRefs = previousContextRefs;
    renderMentionTray();
    renderContextTray();
    composerState.textContent = `发送失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending = false;
    syncComposer();
    messageInput.focus();
  }
}

function appendPendingUserMessage(text, mentions, contextRefs, clientMessageId) {
  const now = new Date();
  room.messages = room.messages.concat({
    eventId: clientMessageId,
    messageId: clientMessageId,
    author: "user",
    authorKind: "user",
    displayName: "You",
    initials: "我",
    kind: "user",
    date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(now),
    time: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now),
    text,
    mentions,
    contextRefs,
    pending: true,
  });
  forceScrollOnNextRender = true;
  renderMessages();
}

function removePendingMessage(clientMessageId) {
  room.messages = room.messages.filter((message) => message.eventId !== clientMessageId);
  renderMessages();
}

function scheduleRoomPolling(durationMs) {
  void durationMs;
  void refreshRoomStateFromPoll();
  startRoomPolling();
}

function startRoomPolling() {
  if (pollTimer !== null) {
    return;
  }
  pollTimer = window.setInterval(() => {
    void refreshRoomStateFromPoll();
  }, ROOM_STATE_POLL_INTERVAL_MS);
}

async function refreshRoomStateFromPoll() {
  if (pollInFlight) {
    return;
  }
  pollInFlight = true;
  try {
    await loadRoomState({ preserveComposerState: true, skipUnchanged: true });
  } catch {
    // loadRoomState already handles offline rendering.
  } finally {
    pollInFlight = false;
  }
}

function shouldApplyPolledState(state) {
  if (room.connected !== Boolean(state.connected)) {
    return true;
  }
  if (room.agentRuntimeMode !== (state.agentRuntimeMode ?? room.agentRuntimeMode)) {
    return true;
  }
  if (room.eventCount !== (state.eventCount ?? 0)) {
    return true;
  }
  const incomingMessages = chatStreamMessages(state.messages);
  if (incomingMessages.length !== room.messages.length) {
    return true;
  }
  return latestMessageEventId(incomingMessages) !== latestMessageEventId(room.messages);
}

function latestMessageEventId(messages) {
  const lastMessage = Array.isArray(messages) ? messages[messages.length - 1] : null;
  return lastMessage?.eventId ?? lastMessage?.messageId ?? null;
}

function applyRoomState(state) {
  room.connected = Boolean(state.connected);
  room.agentRuntimeMode = state.agentRuntimeMode ?? room.agentRuntimeMode;
  room.eventCount = state.eventCount ?? 0;
  room.ledgerPath = state.ledgerPath ?? "";
  room.metrics = Array.isArray(state.metrics) ? state.metrics : room.metrics;
  room.agents = Array.isArray(state.agents) ? state.agents : room.agents;
  room.checks = Array.isArray(state.checks) ? state.checks : room.checks;
  room.contextAudits = Array.isArray(state.contextAudits) ? state.contextAudits : [];
  room.yoloSpaces = Array.isArray(state.yoloSpaces) ? state.yoloSpaces : [];
  room.longRunOperationalSummary = state.longRunOperationalSummary ?? null;
  room.autonomyScheduler = state.autonomyScheduler ?? {
    enabled: false,
    running: false,
    completedTickCount: 0,
    skippedOverlapCount: 0,
    overdueTickCount: 0,
    overrunTickCount: 0,
    errorCount: 0,
    lastExpectedTickDueAt: null,
    lastScheduleDriftMs: null,
    lastOverdueByMs: null,
    lastDurationMs: null,
    lastOverrunByMs: null,
    lastTargetRefs: [],
    lastChoiceSetRefs: [],
    lastChoiceSetOptionCount: 0,
    lastChoiceSetTargetRefs: [],
    lastChoiceSetEvidenceRefs: [],
    lastChoiceSetOptionsWithoutEvidenceRefs: [],
    lastChoiceSetTargetedOptionsWithoutTargetRefs: [],
    lastContextRefs: [],
    lastEvidenceRefs: [],
  };
  room.timeline = Array.isArray(state.timeline) ? state.timeline : [];
  room.topics = Array.isArray(state.topics) ? state.topics : room.topics;
  room.activeTopicId = state.activeTopicId ?? room.activeTopicId;
  room.socialState = state.socialState ?? room.socialState;
  room.messages = chatStreamMessages(state.messages);
  syncConnection(room.connected, room.connected ? "connected" : "offline");
  syncRoomSubtitle();
  renderTopics();
  renderLivingOverview();
  renderMessages();
  renderSettings();
  if (!mentionPopover.hidden) {
    renderMentionPopover();
  }
}

function syncConnection(connected, label) {
  room.connected = connected;
  connectionStatus.classList.toggle("offline", !connected);
  connectionStatus.querySelector("span").textContent = connected ? "●" : "○";
  connectionStatus.lastChild.textContent = ` ${label}`;
}

function syncRoomSubtitle() {
  if (!roomSubtitle) {
    return;
  }
  roomSubtitle.textContent = roomModeSubtitle();
}

function roomModeSubtitle() {
  const agents = Array.isArray(room.agents) ? room.agents : [];
  const modeCounts = countBy(agents, (agent) => agent.mode ?? "seed");
  const readyCount = agents.filter((agent) => agent.status === "ready").length;
  const degradedCount = agents.filter((agent) => agent.status === "degraded" || agent.mode === "degraded").length;
  const runtimeMode = room.agentRuntimeMode ? `runtime ${room.agentRuntimeMode}` : "runtime unknown";
  const modeSummary = ["live", "seed", "smoke_ready", "degraded", "offline"]
    .map((mode) => [mode, modeCounts.get(mode) ?? 0])
    .filter(([, count]) => count > 0)
    .map(([mode, count]) => `${count} ${mode}`)
    .join(" · ");
  const providerBoundarySummary =
    degradedCount > 0
      ? ` · ${degradedCount} provider ${degradedCount === 1 ? "boundary" : "boundaries"} visible`
      : "";
  return `Autonomous Agent Living Room · ${runtimeMode} · ${readyCount}/${agents.length} ready${modeSummary ? ` · ${modeSummary}` : ""}${providerBoundarySummary}`;
}

function countBy(items, keyForItem) {
  const counts = new Map();
  for (const item of items) {
    const key = keyForItem(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function syncComposer() {
  const hasText = messageInput.value.trim().length > 0;
  sendButton.disabled = !hasText || !room.connected || sending;
  formatButton.disabled = !room.connected || sending;
  mentionButton.disabled = !room.connected || sending;
  addContextButton.disabled = !room.connected || sending || latestVisibleMessageRef() === null;
  expandComposerButton.disabled = !room.connected || sending;
  syncArchiveControl();
  if (hasText && room.connected && !sending) {
    composerState.textContent = "Enter 发送 · Shift+Enter 换行";
  } else if (!room.connected && !sending) {
    composerState.textContent = "内部服务未连接：运行 npm run serve:web";
    closeMentionPopover();
  }
  messageInput.style.height = "auto";
  const maxHeight = composerTextareaMaxHeight();
  messageInput.style.maxHeight = `${maxHeight}px`;
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, maxHeight)}px`;
  syncComposerContainerHeight();
}

function handleViewportResize() {
  syncComposer();
}

function composerTextareaMaxHeight() {
  const viewportHeight = effectiveViewportHeight();
  if (composerExpanded) {
    return Math.min(Math.max(120, viewportHeight * 0.48), 420);
  }
  if (composerDraftMode) {
    return Math.min(Math.max(96, viewportHeight * 0.38), 240);
  }
  return Math.min(Math.max(84, viewportHeight * 0.32), 150);
}

function syncComposerContainerHeight() {
  const actions = composer.querySelector(".composer-actions");
  const trayHeight = [mentionTray, contextTray].reduce(
    (sum, tray) => sum + (tray instanceof HTMLElement && !tray.hidden ? tray.offsetHeight : 0),
    0,
  );
  const actionsHeight = actions instanceof HTMLElement ? actions.offsetHeight : 0;
  composer.style.minHeight = `${messageInput.offsetHeight + actionsHeight + trayHeight + 2}px`;
}

function effectiveViewportHeight() {
  const visualHeight = Number.isFinite(window.visualViewport?.height) ? window.visualViewport.height : window.innerHeight;
  return Math.max(280, Math.min(window.innerHeight || visualHeight || 0, visualHeight || window.innerHeight || 0));
}

function syncArchiveControl() {
  archiveNowButton.disabled = !room.connected || archiving;
  archiveNowButton.textContent = archiving ? "Archiving..." : "Archive Today";
  archiveReviewButton.disabled = !room.connected || requestingArchiveReview || latestArchive() === null;
  archiveReviewButton.textContent = requestingArchiveReview ? "Asking..." : "Ask Review";
  archiveRhythmButton.disabled = !room.connected || requestingArchiveRhythm;
  archiveRhythmButton.textContent = requestingArchiveRhythm ? "Opening..." : "Daily Rhythm";
  archiveApplyRepairButton.disabled = !room.connected || applyingArchiveRepair || latestAcceptedUnappliedArchiveRepair() === null;
  archiveApplyRepairButton.textContent = applyingArchiveRepair ? "Applying..." : "Apply Accepted Repair";
  autonomyTickButton.disabled = !room.connected || requestingAutonomyTick;
  autonomyTickButton.textContent = requestingAutonomyTick ? "Ticking..." : "Autonomy Tick";
}

function renderTopics() {
  topicBar.replaceChildren();
  const topics = Array.isArray(room.topics) && room.topics.length > 0 ? room.topics.slice(0, 8) : [];
  if (topics.length === 0) {
    const empty = document.createElement("button");
    empty.className = "topic active";
    empty.type = "button";
    empty.textContent = "room kernel";
    empty.disabled = true;
    topicBar.append(empty);
    return;
  }

  for (const topic of topics) {
    const button = document.createElement("button");
    const revivalCount = Number.isFinite(topic.revivalCount) ? topic.revivalCount : 0;
    const openQuestionCount = Array.isArray(topic.openQuestions) ? topic.openQuestions.length : 0;
    button.className = `topic ${topic.topicId === room.activeTopicId ? "active" : ""}`;
    button.type = "button";
    button.dataset.topicContextRef = topic.topicId;
    button.dataset.topicRevivalCount = String(revivalCount);
    button.dataset.topicOpenQuestionCount = String(openQuestionCount);
    button.title = `${topic.topicId} · ${topic.status ?? "active"} · ${topic.messageCount ?? 0} messages · ${revivalCount} revivals · ${openQuestionCount} open questions`;
    button.setAttribute(
      "aria-label",
      `Add topic context ${topic.title ?? topic.topicId}${revivalCount > 0 ? `, revived ${revivalCount} times` : ""}${
        openQuestionCount > 0 ? `, ${openQuestionCount} open questions` : ""
      }`,
    );
    button.innerHTML = `
      <span>${escapeHtml(topic.title ?? topic.topicId)}</span>
      <small>${escapeHtml(topic.messageCount ?? 0)}</small>
      ${revivalCount > 0 ? `<small class="topic-revival">rev ${escapeHtml(revivalCount)}</small>` : ""}
      ${openQuestionCount > 0 ? `<small class="topic-question">? ${escapeHtml(openQuestionCount)}</small>` : ""}
    `;
    topicBar.append(button);
  }
}

function renderLivingOverview() {
  const timeline = Array.isArray(room.timeline) ? room.timeline : [];
  const providerOverview = providerBoundaryOverviewSummary();
  const rhythmBalance = autonomyRhythmBalanceSummary();
  const longRunReadiness = longRunReadinessSummary();
  const archiveTotal = Array.isArray(room.socialState?.archives) ? room.socialState.archives.length : 0;
  const memoryTotal = memoryReviewableClaims().length;
  const continuityTotal = agentContinuityCountValue();
  timelineCount.textContent = String(timeline.length);
  archiveCount.textContent = String(archiveTotal);
  memoryContestCount.textContent = String(memoryTotal);
  agentContinuityCount.textContent = String(continuityTotal);
  providerBoundaryCount.textContent = providerOverview.countLabel;
  longRunReadinessCount.textContent = longRunReadiness.countLabel;
  overviewToggleSummary.textContent = `timeline ${timeline.length} · archive ${archiveTotal} · memory ${memoryTotal} · continuity ${continuityTotal} · rhythm ${rhythmBalance.distinctActionCount}/${rhythmBalance.consideredActionCount} · providers ${providerOverview.countLabel} · long-run ${longRunReadiness.countLabel}`;
  syncLivingOverviewDisclosure();

  renderEvidenceStrip();
  renderTimelinePreview(timeline);
  renderArchivePreview();
  renderMemoryContestPreview();
  renderAgentContinuityPreview();
  renderProviderBoundaryPreview(providerOverview);
  renderLongRunReadinessPreview(longRunReadiness);
}

function syncLivingOverviewDisclosure() {
  livingOverview.classList.toggle("expanded", livingOverviewExpanded);
  livingOverview.classList.toggle("collapsed", !livingOverviewExpanded);
  overviewToggle.setAttribute("aria-expanded", livingOverviewExpanded ? "true" : "false");
  overviewToggle.title = livingOverviewExpanded ? "Collapse living evidence overview" : "Expand living evidence overview";
  overviewPanel.hidden = !livingOverviewExpanded;
}

function renderEvidenceStrip() {
  const visibility = contextVisibilitySummary();
  const rhythm = roomRhythmEvidenceSummary();
  const longRhythm = longTermRhythmEvidenceSummary();
  const rhythmBalance = autonomyRhythmBalanceSummary();
  const scheduler = schedulerEvidenceSummary();
  const refs = overviewEvidenceRefs(visibility);
  evidenceStrip.innerHTML = `
    <div class="evidence-strip-section">
      <span class="evidence-strip-label">Context visible</span>
      ${evidencePillMarkup("co-visible", visibility.coVisible)}
      ${evidencePillMarkup("archive", visibility.archive)}
      ${evidencePillMarkup("memory", visibility.memory)}
      ${evidencePillMarkup("continuity", visibility.continuity)}
      ${evidencePillMarkup("provider", visibility.provider)}
      ${evidencePillMarkup("social", visibility.social)}
    </div>
    <div class="evidence-strip-section rhythm-evidence">
      <span class="evidence-strip-label">Room rhythm</span>
      <strong>${escapeHtml(rhythm.label)}</strong>
      <span>${escapeHtml(rhythm.detail)}</span>
      ${roomRhythmChoiceSetMarkup(rhythm.tick)}
      ${roomRhythmRefsMarkup(rhythm.refs)}
    </div>
    <div class="evidence-strip-section long-rhythm-evidence">
      <span class="evidence-strip-label">Long rhythm</span>
      ${evidencePillMarkup("archive", longRhythm.archive)}
      ${evidencePillMarkup("review", longRhythm.review)}
      ${evidencePillMarkup("memory hygiene", longRhythm.memoryHygiene)}
      ${evidencePillMarkup("continuity", longRhythm.continuity)}
      ${evidencePillMarkup("provider boundary", longRhythm.providerBoundary)}
      ${evidencePillMarkup("silence", longRhythm.silence)}
      ${evidencePillMarkup("questions", longRhythm.questions)}
      ${evidencePillMarkup("handoffs", longRhythm.handoffs)}
      ${evidencePillMarkup("invites", longRhythm.invitations)}
      ${longTermRhythmRefsMarkup(longRhythm.refs)}
    </div>
    <div class="evidence-strip-section rhythm-balance-evidence" title="${escapeHtml(rhythmBalance.title)}">
      <span class="evidence-strip-label">Rhythm balance</span>
      <span class="rhythm-balance-pill ${escapeHtml(rhythmBalance.status)}">${escapeHtml(rhythmBalance.label)}</span>
      <span>${escapeHtml(rhythmBalance.detail)}</span>
      ${autonomyRhythmBalanceRefsMarkup(rhythmBalance.refs)}
    </div>
    <div class="evidence-strip-section scheduler-evidence" title="${escapeHtml(scheduler.title)}">
      <span class="evidence-strip-label">Scheduler</span>
      <strong>${escapeHtml(scheduler.label)}</strong>
      <span>${escapeHtml(scheduler.detail)}</span>
      ${schedulerRefsMarkup(scheduler.refs)}
    </div>
    <div class="evidence-strip-section evidence-ref-row">
      <span class="evidence-strip-label">Carry refs</span>
      ${
        refs.length === 0
          ? `<span class="evidence-muted">waiting for ledger sediment</span>`
          : refs.map((ref) => `<button class="overview-ref-button compact" type="button" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`).join("")
      }
    </div>
  `;
}

function contextVisibilitySummary() {
  const audits = Array.isArray(room.contextAudits) ? room.contextAudits : [];
  const hasDirectContinuityContext = audits.some((audit) =>
    Boolean(audit.selectedByType?.persona_delta || audit.selectedByType?.persona_projection),
  );
  const coVisibleSummary = coVisibleContextAuditSummary(audits);
  return {
    coVisible: coVisibleSummary !== null,
    coVisibleRefs: coVisibleSummaryRefs(coVisibleSummary),
    archive: audits.some((audit) => Boolean(audit.selectedByType?.daily_archive_ref)),
    memory: audits.some((audit) => Object.keys(audit.selectedByType ?? {}).some((type) => type.startsWith("memory_"))),
    continuity: hasDirectContinuityContext || archiveContinuityVisibleInContext(audits),
    provider: audits.some((audit) => Boolean(audit.selectedByType?.provider_boundary)),
    social: audits.some((audit) => (audit.selectedFragments ?? []).some(isSocialLineageContextFragment)),
  };
}

function coVisibleContextAuditSummary(audits = Array.isArray(room.contextAudits) ? room.contextAudits : []) {
  return audits.map((audit) => auditCoVisibleSummary(audit)).find((summary) => summary.complete) ?? null;
}

function coVisibleSummaryRefs(summary) {
  if (summary === null) return [];
  return uniqueRoomRefs(summary.domains.flatMap((domain) => domain.refs.slice(0, 1))).slice(0, 5);
}

function archiveContinuityVisibleInContext(audits) {
  return contextArchiveRefs(audits).some((archiveRef) => {
    const archive = findById(room.socialState?.archives, "archiveId", archiveRef);
    return archiveContinuityRows(archive).some((row) => uniqueRoomRefs([row.ref, ...(row.evidenceRefs ?? [])]).length > 0);
  });
}

function contextArchiveRefs(audits) {
  return uniqueRoomRefs(
    (audits ?? [])
      .flatMap((audit) => (Array.isArray(audit.selectedFragments) ? audit.selectedFragments : []))
      .filter((fragment) => fragment.type === "daily_archive_ref")
      .flatMap((fragment) => (Array.isArray(fragment.refs) ? fragment.refs : [])),
  );
}

function longTermRhythmEvidenceSummary() {
  const social = room.socialState ?? {};
  const ticks = Array.isArray(room.socialState?.autonomyTicks) ? room.socialState.autonomyTicks : [];
  const archiveReviews = Array.isArray(social.archiveReviews) ? social.archiveReviews : [];
  const memoryReviews = Array.isArray(social.memoryReviews) ? social.memoryReviews : [];
  const memoryPressureBoundaries = Array.isArray(social.memoryPressureBoundaries) ? social.memoryPressureBoundaries : [];
  const personaDeltaReviews = Array.isArray(social.personaDeltaReviews) ? social.personaDeltaReviews : [];
  const silences = Array.isArray(social.silences) ? social.silences : [];
  const archives = Array.isArray(social.archives) ? social.archives : [];
  const openQuestions = Array.isArray(social.openQuestions) ? social.openQuestions : [];
  const handoffs = Array.isArray(social.handoffs) ? social.handoffs : [];
  const handoffReviews = Array.isArray(social.handoffReviews) ? social.handoffReviews : [];
  const invitations = Array.isArray(social.invitations) ? social.invitations : [];
  const invitationReviews = Array.isArray(social.invitationReviews) ? social.invitationReviews : [];
  const providerBoundaries = Array.isArray(social.providerBoundaries) ? social.providerBoundaries : [];
  const hasArchiveRhythm =
    ticks.some((tick) => tick.action === "archive_and_invite_review" || tick.action === "review_open_archive") ||
    archives.length > 0;
  const hasReviewRhythm =
    archiveReviews.length > 0 ||
    ticks.some((tick) => tick.action === "archive_and_invite_review" || tick.action === "review_open_archive");
  const hasMemoryHygieneRhythm =
    ticks.some((tick) => tick.action === "memory_hygiene_review") ||
    memoryReviews.length > 0 ||
    memoryPressureBoundaries.length > 0 ||
    memoryContestClaims().length > 0 ||
    memoryReviewableClaims().length > 0;
  const hasContinuityRhythm =
    ticks.some((tick) => tick.action === "continuity_review") ||
    personaDeltaReviews.length > 0 ||
    agentContinuityCountValue() > 0;
  const hasProviderBoundaryRhythm =
    ticks.some((tick) => tick.action === "provider_boundary_review") ||
    providerBoundaries.length > 0;
  const hasSilenceRhythm =
    ticks.some((tick) => tick.action === "silence_reentry" || tick.action === "stay_silent") ||
    silences.length > 0;
  const hasQuestionRhythm =
    ticks.some((tick) => tick.action === "open_question_revisit") ||
    openQuestions.length > 0;
  const hasHandoffRhythm =
    ticks.some((tick) => tick.action === "handoff_review") ||
    handoffs.length > 0 ||
    handoffReviews.length > 0;
  const hasInvitationRhythm =
    ticks.some((tick) => tick.action === "invitation_review") ||
    invitations.length > 0 ||
    invitationReviews.length > 0;
  return {
    archive: hasArchiveRhythm,
    review: hasReviewRhythm,
    memoryHygiene: hasMemoryHygieneRhythm,
    continuity: hasContinuityRhythm,
    providerBoundary: hasProviderBoundaryRhythm,
    silence: hasSilenceRhythm,
    questions: hasQuestionRhythm,
    handoffs: hasHandoffRhythm,
    invitations: hasInvitationRhythm,
    refs: longTermRhythmEvidenceRefs({
      ticks,
      archives,
      archiveReviews,
      memoryReviews,
      memoryPressureBoundaries,
      personaDeltaReviews,
      providerBoundaries,
      silences,
      openQuestions,
      handoffs,
      handoffReviews,
      invitations,
      invitationReviews,
    }),
  };
}

function autonomyRhythmBalanceSummary() {
  const ticks = Array.isArray(room.socialState?.autonomyTicks) ? room.socialState.autonomyTicks : [];
  const considered = ticks.filter((tick) => AUTONOMY_RHYTHM_BALANCE_ACTIONS.has(tick.action)).slice(0, 12);
  const actionCounts = {};
  const actionRefsByKind = {};
  for (const tick of considered) {
    actionCounts[tick.action] = (actionCounts[tick.action] ?? 0) + 1;
    actionRefsByKind[tick.action] = [...(actionRefsByKind[tick.action] ?? []), tick.tickId];
  }

  const sortedActions = Object.entries(actionCounts).sort(
    ([leftAction, leftCount], [rightAction, rightCount]) => rightCount - leftCount || leftAction.localeCompare(rightAction),
  );
  const [dominantAction, dominantCount = 0] = sortedActions[0] ?? [];
  const consideredActionCount = considered.length;
  const distinctActionCount = sortedActions.length;
  const dominantActionShare = consideredActionCount > 0 ? dominantCount / consideredActionCount : 0;
  const enoughSamples = consideredActionCount >= AUTONOMY_RHYTHM_BALANCE_MIN_SAMPLES;
  const balanced =
    consideredActionCount > 0 &&
    (!enoughSamples ||
      (distinctActionCount >= AUTONOMY_RHYTHM_BALANCE_MIN_DISTINCT &&
        dominantActionShare <= AUTONOMY_RHYTHM_BALANCE_MONOPOLY_THRESHOLD));
  const status = consideredActionCount === 0 ? "waiting" : !enoughSamples ? "warming" : balanced ? "balanced" : "dominated";
  const dominantLabel = dominantAction ? roomRhythmActionLabel(dominantAction) : "none";
  const percent = Math.round(dominantActionShare * 100);
  const label =
    status === "waiting"
      ? "waiting"
      : status === "warming"
        ? "warming sample"
        : status === "balanced"
          ? "balanced"
          : "dominated";
  const detail =
    consideredActionCount === 0
      ? "no social rhythm ticks yet"
      : `${distinctActionCount} kinds · ${consideredActionCount} social ticks · top ${dominantLabel} ${percent}%`;
  const refs = uniqueRoomRefs([
    ...considered.map((tick) => tick.tickId),
    ...considered.flatMap((tick) => [
      tick.messageEventId,
      tick.anchorEventId,
      tick.archiveRef,
      tick.reviewRequestRef,
      ...(tick.targetRefs ?? []),
      ...(tick.evidenceRefs ?? []),
    ]),
  ]).slice(0, 8);

  return {
    status,
    label,
    detail,
    title:
      "Autonomous rhythm balance watches memory hygiene, continuity, provider boundary, open question, handoff, and invitation review ticks so one social rhythm does not quietly monopolize the room.",
    consideredActionCount,
    distinctActionCount,
    dominantAction,
    dominantActionShare,
    actionCounts,
    actionRefsByKind,
    refs,
  };
}

function autonomyRhythmBalanceRefsMarkup(refs) {
  const rhythmRefs = uniqueRoomRefs(refs ?? []).slice(0, 6);
  if (rhythmRefs.length === 0) {
    return `<span class="evidence-muted">waiting for balance refs</span>`;
  }
  return `
    <div class="rhythm-balance-ref-row" aria-label="Autonomy rhythm balance refs">
      ${rhythmRefs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add autonomy rhythm balance ref" aria-label="Add autonomy rhythm balance ref ${escapeHtml(
              ref,
            )}" data-rhythm-balance-ref="${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longTermRhythmEvidenceRefs(input) {
  const archiveRefs = uniqueRoomRefs(
    []
      .concat(longTermRhythmTickRefs(input.ticks, ["archive_and_invite_review", "review_open_archive"]))
      .concat((input.archives ?? []).map((archive) => archive.archiveId))
      .concat((input.archiveReviews ?? []).flatMap((review) => [review.id, review.archiveRef, review.repairRef])),
  );
  const memoryRefs = uniqueRoomRefs(
    []
      .concat(longTermRhythmTickRefs(input.ticks, ["memory_hygiene_review"]))
      .concat((input.memoryReviews ?? []).flatMap((review) => [review.reviewId, review.memoryRef, review.memoryId]))
      .concat((input.memoryPressureBoundaries ?? []).flatMap((boundary) => [boundary.boundaryId, ...(boundary.proposedMemoryRefs ?? [])]))
      .concat(memoryContestClaims().map((claim) => claim.memoryId))
      .concat(memoryReviewableClaims().map((claim) => claim.memoryId)),
  );
  const continuityRefs = uniqueRoomRefs(
    []
      .concat(longTermRhythmTickRefs(input.ticks, ["continuity_review"]))
      .concat((input.personaDeltaReviews ?? []).flatMap((review) => [review.reviewId, review.deltaRef, review.deltaId]))
      .concat(archiveContinuityRows().flatMap((row) => [row.ref, ...(row.evidenceRefs ?? [])])),
  );
  const providerRefs = uniqueRoomRefs(
    []
      .concat(longTermRhythmTickRefs(input.ticks, ["provider_boundary_review"]))
      .concat((input.providerBoundaries ?? []).flatMap((boundary) => [
        boundary.boundaryId,
        boundary.triggeringEventId,
        boundary.packetId,
        ...(boundary.sourceRefs ?? []),
        ...(boundary.choicePressure?.repairRequestRefs ?? []),
        ...(boundary.choicePressure?.retryProtocolRefs ?? []),
        ...(boundary.choicePressure?.silenceRefs ?? []),
        ...(boundary.choicePressure?.archiveCarryoverRefs ?? []),
      ])),
  );
  const silenceRefs = uniqueRoomRefs(
    []
      .concat(longTermRhythmTickRefs(input.ticks, ["silence_reentry", "stay_silent"]))
      .concat((input.silences ?? []).map((silence) => silence.silenceId)),
  );
  const questionRefs = uniqueRoomRefs(
    []
      .concat(longTermRhythmTickRefs(input.ticks, ["open_question_revisit"]))
      .concat((input.openQuestions ?? []).flatMap((question) => [
        question.questionId,
        ...(question.sourceRefs ?? []),
        ...(question.responseRefs ?? []),
      ])),
  );
  const handoffRefs = uniqueRoomRefs(
    []
      .concat(longTermRhythmTickRefs(input.ticks, ["handoff_review"]))
      .concat((input.handoffs ?? []).flatMap((handoff) => [
        handoff.handoffId,
        ...(handoff.sourcePressureRefs ?? []),
        ...(handoff.responses ?? []).flatMap((response) => [response.eventId, ...(response.sourceRefs ?? [])]),
      ]))
      .concat((input.handoffReviews ?? []).flatMap((review) => [
        review.reviewId,
        review.handoffRef,
        review.sourceMessageId,
        ...(review.sourceRefs ?? []),
      ])),
  );
  const invitationRefs = uniqueRoomRefs(
    []
      .concat(longTermRhythmTickRefs(input.ticks, ["invitation_review"]))
      .concat((input.invitations ?? []).flatMap((invitation) => [
        invitation.invitationId,
        ...(invitation.contextRefs ?? []),
        ...(invitation.sourcePressureRefs ?? []),
        ...(invitation.responses ?? []).flatMap((response) => [response.eventId, ...(response.contextRefs ?? [])]),
      ]))
      .concat((input.invitationReviews ?? []).flatMap((review) => [
        review.reviewId,
        review.invitationRef,
        review.sourceMessageId,
        ...(review.sourceRefs ?? []),
      ])),
  );

  return uniqueRoomRefs([
    ...archiveRefs.slice(0, 2),
    ...memoryRefs.slice(0, 1),
    ...continuityRefs.slice(0, 1),
    ...providerRefs.slice(0, 1),
    ...silenceRefs.slice(0, 1),
    ...questionRefs.slice(0, 1),
    ...handoffRefs.slice(0, 1),
    ...invitationRefs.slice(0, 1),
    ...archiveRefs,
    ...memoryRefs,
    ...continuityRefs,
    ...providerRefs,
    ...silenceRefs,
    ...questionRefs,
    ...handoffRefs,
    ...invitationRefs,
  ]).slice(0, 8);
}

function longTermRhythmTickRefs(ticks, actions) {
  const actionSet = new Set(actions);
  return (ticks ?? [])
    .filter((tick) => actionSet.has(tick.action))
    .flatMap((tick) => [
      tick.tickId,
      tick.messageEventId,
      tick.anchorEventId,
      tick.archiveRef,
      tick.reviewRequestRef,
      ...(tick.targetRefs ?? []),
      ...(tick.evidenceRefs ?? []),
      ...autonomyChoiceSetRefs(tick),
    ]);
}

function longTermRhythmRefsMarkup(refs) {
  const rhythmRefs = uniqueRoomRefs(refs ?? []).slice(0, 8);
  return `
    <div class="long-rhythm-ref-row" aria-label="Long rhythm evidence refs">
      <span class="evidence-strip-label">Rhythm refs</span>
      ${
        rhythmRefs.length === 0
          ? `<span class="evidence-muted">waiting for rhythm refs</span>`
          : rhythmRefs
              .map(
                (ref) =>
                  `<button class="overview-ref-button compact" type="button" title="Add long rhythm evidence ref" aria-label="Add long rhythm evidence ref ${escapeHtml(
                    ref,
                  )}" data-long-rhythm-ref="${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
              )
              .join("")
      }
    </div>
  `;
}

function roomRhythmEvidenceSummary() {
  const ticks = Array.isArray(room.socialState?.autonomyTicks) ? room.socialState.autonomyTicks : [];
  const tick = ticks[0];
  if (!tick) {
    return { label: "not run", detail: "no autonomous rhythm event yet", refs: [], tick: null };
  }
  const refs = roomRhythmDecisionRefs(tick);
  return {
    label: roomRhythmActionLabel(tick.action),
    detail: roomRhythmDecisionDetail(tick, refs.length),
    refs,
    tick,
  };
}

function roomRhythmDecisionRefs(tick) {
  return uniqueRoomRefs([
    tick.tickId,
    tick.messageEventId,
    tick.anchorEventId,
    tick.archiveRef,
    tick.reviewRequestRef,
    ...(tick.targetRefs ?? []),
    ...(tick.contextRefs ?? []),
    ...(tick.evidenceRefs ?? []),
    ...autonomyChoiceSetRefs(tick),
  ]).slice(0, 4);
}

function autonomyChoiceSetRefs(tick) {
  return (tick?.choiceSet ?? []).flatMap((choice) => [
    ...(choice.targetRefs ?? []),
    ...(choice.evidenceRefs ?? []),
  ]);
}

function roomRhythmChoiceSetMarkup(tick) {
  const choices = Array.isArray(tick?.choiceSet) ? tick.choiceSet.slice(0, 4) : [];
  if (choices.length === 0) {
    return "";
  }
  return `
    <div class="room-rhythm-choice-row" aria-label="Room rhythm choice set">
      <span class="evidence-strip-label">Choices</span>
      ${choices
        .map((choice) => {
          const targetRefs = uniqueRoomRefs(choice.targetRefs ?? []);
          const evidenceRefs = uniqueRoomRefs(choice.evidenceRefs ?? []);
          const refs = uniqueRoomRefs([...targetRefs, ...evidenceRefs]);
          const label = roomRhythmActionLabel(choice.action);
          const selected = choice.action === tick.action ? " selected" : "";
          const missingEvidence = evidenceRefs.length === 0;
          const missingTarget = choice.action !== "stay_silent" && targetRefs.length === 0;
          const evidenceState = missingEvidence || missingTarget ? " missing-evidence" : "";
          const title = [
            `${label}: ${choice.reason || "candidate rhythm choice"}`,
            `${targetRefs.length} target refs`,
            `${evidenceRefs.length} evidence refs`,
            missingEvidence ? "missing ledger evidence" : "",
            missingTarget ? "missing target refs" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const content = `<span class="room-rhythm-choice-label">${escapeHtml(label)}</span>${roomRhythmChoiceEvidenceLabel({
            targetRefs,
            evidenceRefs,
          })}`;
          const firstRef = evidenceRefs[0] ?? targetRefs[0];
          if (!firstRef) {
            return `<span class="room-rhythm-choice${selected}${evidenceState}" title="${escapeHtml(title)}">${content}</span>`;
          }
          return `<button class="room-rhythm-choice${selected}${evidenceState}" type="button" title="${escapeHtml(title)}" aria-label="Add room rhythm choice ref ${escapeHtml(
            firstRef,
          )}" data-room-rhythm-choice-ref="${escapeHtml(firstRef)}" data-social-context-ref="${escapeHtml(firstRef)}">${content}</button>`;
        })
        .join("")}
    </div>
  `;
}

function roomRhythmChoiceEvidenceLabel(choice) {
  const targetCount = uniqueRoomRefs(choice.targetRefs ?? []).length;
  const evidenceCount = uniqueRoomRefs(choice.evidenceRefs ?? []).length;
  return `<small class="room-rhythm-choice-evidence">T${escapeHtml(String(targetCount))} · E${escapeHtml(String(evidenceCount))}</small>`;
}

function roomRhythmChoiceCountLabel(tick) {
  const count = Array.isArray(tick?.choiceSet) ? tick.choiceSet.length : 0;
  return count > 0 ? `${count} choices` : "";
}

function roomRhythmDecisionDetail(tick, refCount) {
  const status = tick.status ?? "posted";
  if (tick.action === "stay_silent") {
    return `${status} · preserved silence · ${refCount} decision refs`;
  }
  if (tick.action === "silence_reentry") {
    const anchor = tick.anchorEventId ? `anchor ${shortRef(tick.anchorEventId)}` : "quiet anchor";
    return `${status} · ${anchor} · ${refCount} decision refs`;
  }
  if (tick.action === "archive_and_invite_review" || tick.action === "review_open_archive") {
    const archive = tick.archiveRef ? `archive ${shortRef(tick.archiveRef)}` : "archive rhythm";
    return `${status} · ${archive} · ${refCount} decision refs`;
  }
  return `${status} · ${refCount} decision refs`;
}

function roomRhythmRefsMarkup(refs) {
  const rhythmRefs = uniqueRoomRefs(refs ?? []).slice(0, 4);
  if (rhythmRefs.length === 0) {
    return "";
  }
  return `
    <div class="room-rhythm-ref-row" aria-label="Room rhythm decision refs">
      <span class="evidence-strip-label">Decision refs</span>
      ${rhythmRefs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add room rhythm decision ref" aria-label="Add room rhythm decision ref ${escapeHtml(
              ref,
            )}" data-room-rhythm-ref="${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function schedulerEvidenceSummary() {
  const scheduler = room.autonomyScheduler ?? {};
  if (!scheduler.enabled) {
    return {
      label: "manual",
      detail: "no interval",
      refs: [],
      title: "Scheduler is disabled; manual autonomy tick remains available.",
    };
  }
  const nextDue = schedulerNextDueLabel(scheduler.nextTickDueAt, scheduler.intervalMs);
  const lastAction = scheduler.lastAction ? roomRhythmActionLabel(scheduler.lastAction) : "waiting for first rhythm";
  const refs = schedulerLedgerRefs(scheduler);
  const completed = scheduler.completedTickCount ?? 0;
  const skipped = scheduler.skippedOverlapCount ?? 0;
  const errors = scheduler.errorCount ?? 0;
  const choiceEvidence = schedulerChoiceEvidenceSummary(scheduler);
  const cadence = schedulerCadenceSummary(scheduler);
  const continuity = schedulerContinuitySummary(scheduler);
  const overdue = scheduler.overdueTickCount ?? 0;
  const overrun = scheduler.overrunTickCount ?? 0;
  const health = [
    completed ? `${completed} ticks` : "",
    skipped ? `${skipped} skipped` : "",
    overdue ? `${overdue} overdue` : "",
    overrun ? `${overrun} overrun` : "",
    errors ? `${errors} errors` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    label: scheduler.running ? "running" : nextDue,
    detail: `${lastAction} · ${choiceEvidence} · ${continuity} · ${cadence} · ${refs.length} ledger refs${health ? ` · ${health}` : ""}`,
    refs,
    title: `Next room rhythm: ${nextDue}. Last rhythm: ${lastAction}/${scheduler.lastStatus ?? "unknown"}. Choice-set evidence: ${choiceEvidence}. Scheduler continuity: ${continuity}. Cadence: ${cadence}. ${
      scheduler.boundaryNote ?? "Scheduler knocks; it does not assign speakers."
    }`,
  };
}

function schedulerContinuitySummary(scheduler) {
  const durationMs = numberOrUndefined(scheduler.lastDurationMs);
  const driftMs = numberOrUndefined(scheduler.lastScheduleDriftMs ?? scheduler.lastOverdueByMs);
  const overrunMs = numberOrUndefined(scheduler.lastOverrunByMs);
  const parts = [];
  if (durationMs !== undefined) {
    parts.push(`run ${durationMsCompactLabel(durationMs)}`);
  }
  if (driftMs !== undefined) {
    parts.push(driftMs > 0 ? `drift ${durationMsCompactLabel(driftMs)}` : "on cadence");
  } else if ((scheduler.completedTickCount ?? 0) > 0) {
    parts.push("cadence anchor pending");
  }
  if (overrunMs !== undefined && overrunMs > 0) {
    parts.push(`overrun ${durationMsCompactLabel(overrunMs)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "continuity waiting";
}

function schedulerCadenceSummary(scheduler) {
  const cadence = [
    scheduler.memoryHygieneReviewAfterMs !== undefined
      ? `memory ${durationMsLabel(scheduler.memoryHygieneReviewAfterMs)}`
      : "",
    scheduler.continuityReviewAfterMs !== undefined
      ? `continuity ${durationMsLabel(scheduler.continuityReviewAfterMs)}`
      : "",
  ].filter(Boolean);
  return cadence.length > 0 ? cadence.join(" · ") : "cadence default";
}

function durationMsLabel(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return "default";
  if (ms === 0) return "now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function durationMsCompactLabel(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  return durationMsLabel(ms);
}

function numberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function schedulerChoiceEvidenceSummary(scheduler) {
  const optionCount = scheduler.lastChoiceSetOptionCount ?? 0;
  const targetCount = uniqueRoomRefs(scheduler.lastChoiceSetTargetRefs ?? []).length;
  const evidenceCount = uniqueRoomRefs(scheduler.lastChoiceSetEvidenceRefs ?? []).length;
  const gapCount =
    safeLength(scheduler.lastChoiceSetOptionsWithoutEvidenceRefs) +
    safeLength(scheduler.lastChoiceSetTargetedOptionsWithoutTargetRefs);
  if (optionCount === 0) {
    return "choices waiting";
  }
  if (gapCount > 0) {
    return `${optionCount} choices · ${gapCount} evidence gaps`;
  }
  return `${optionCount} choices · T${targetCount}/E${evidenceCount}`;
}

function schedulerLedgerRefs(scheduler) {
  return uniqueRoomRefs([
    scheduler.lastTickId,
    scheduler.lastMessageEventId,
    scheduler.lastAnchorEventId,
    scheduler.lastArchiveRef,
    scheduler.lastReviewRequestRef,
    ...(scheduler.lastTargetRefs ?? []),
    ...(scheduler.lastChoiceSetTargetRefs ?? []),
    ...(scheduler.lastChoiceSetEvidenceRefs ?? []),
    ...(scheduler.lastChoiceSetRefs ?? []),
    ...(scheduler.lastContextRefs ?? []),
    ...(scheduler.lastEvidenceRefs ?? []),
  ]).slice(0, 4);
}

function schedulerNextDueLabel(nextTickDueAt, intervalMs) {
  const dueMs = Date.parse(nextTickDueAt ?? "");
  if (Number.isFinite(dueMs)) {
    const remainingMs = dueMs - Date.now();
    if (remainingMs <= 0) return "due now";
    const minutes = Math.ceil(remainingMs / 60_000);
    if (minutes < 60) return `next ${minutes}m`;
    const hours = Math.ceil(minutes / 60);
    if (hours < 48) return `next ${hours}h`;
    return `next ${Math.ceil(hours / 24)}d`;
  }
  return intervalMs ? `every ${Math.round(intervalMs / 1000)}s` : "scheduled";
}

function schedulerRefsMarkup(refs) {
  const schedulerRefs = uniqueRoomRefs(refs ?? []).slice(0, 4);
  if (schedulerRefs.length === 0) {
    return "";
  }
  return `
    <div class="scheduler-ref-row" aria-label="Scheduler ledger refs">
      <span class="evidence-strip-label">Last refs</span>
      ${schedulerRefs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add scheduler rhythm ref" aria-label="Add scheduler rhythm ref ${escapeHtml(
              ref,
            )}" data-scheduler-rhythm-ref="${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function evidencePillMarkup(label, visible) {
  return `<span class="evidence-pill ${visible ? "visible" : "missing"}">${escapeHtml(label)} ${visible ? "visible" : "missing"}</span>`;
}

function overviewEvidenceRefs(visibility = contextVisibilitySummary()) {
  const refs = [
    ...(visibility.coVisibleRefs ?? []),
    firstArchiveEvidenceRef(),
    firstMemoryContestRef(),
    firstAgentContinuityRef(),
    firstProviderBoundaryRef(),
    firstContextSocialLineageRef(),
  ];
  return uniqueRoomRefs(refs).slice(0, 5);
}

function firstArchiveEvidenceRef() {
  return archivePreviewCandidate()?.ref ?? null;
}

function firstMemoryContestRef() {
  return memoryContestPreviewCandidate()?.ref ?? null;
}

function firstAgentContinuityRef() {
  return agentContinuityPreviewCandidate()?.ref ?? null;
}

function firstProviderBoundaryRef() {
  return providerBoundaryPreviewCandidate(providerBoundaryOverviewSummary())?.ref ?? null;
}

function firstContextSocialLineageRef() {
  return contextSocialLineageRefs()[0] ?? null;
}

function contextSocialLineageRefs() {
  const audits = Array.isArray(room.contextAudits) ? room.contextAudits : [];
  return uniqueRoomRefs(
    audits
      .flatMap((audit) => (Array.isArray(audit.selectedFragments) ? audit.selectedFragments : []))
      .filter(isSocialLineageContextFragment)
      .map((fragment) => (Array.isArray(fragment.refs) ? fragment.refs[0] : undefined)),
  );
}

function isSocialLineageContextFragment(fragment) {
  if (!fragment || typeof fragment !== "object") return false;
  const type = fragment.type;
  return (
    type === "mixed_review_pressure" ||
    type === "open_question" ||
    type === "protocol_active" ||
    type === "protocol_proposal" ||
    type === "handoff_packet" ||
    type === "invitation_packet" ||
    type === "side_effect_boundary" ||
    type === "workspace_artifact_ref" ||
    type === "skill_capsule_ref" ||
    type === "capability_ref" ||
    type === "deferred_intention" ||
    type === "silence_ref" ||
    type === "pressure_boundary" ||
    type === "memory_pressure_boundary" ||
    (type === "topic_rule" && Array.isArray(fragment.refs) && fragment.refs.some((ref) => ref.startsWith("topic_proposal_")))
  );
}

function latestArchiveContinuityItem(archive = latestArchive()) {
  return archiveContinuityRows(archive)[0] ?? null;
}

function archiveContinuityRows(archive = latestArchive()) {
  const continuity = Array.isArray(archive?.agentContinuity) ? archive.agentContinuity : [];
  const rows = continuity.flatMap((item) => {
    const moods = (item.dailyMoods ?? []).map((mood) => ({
      kind: "daily mood",
      agentId: item.agentId,
      label: mood.posture,
      status: mood.status,
      ref: mood.deltaId || mood.sourceRef,
      evidenceRefs: archiveContinuityEvidenceRefs({
        evidenceRefs: mood.evidenceRefs,
        responseRefs: mood.responseRefs,
        sourceRefs: [mood.sourceRef, ...(item.sourceRefs ?? [])],
        eventIds: item.eventIds,
      }),
    }));
    const claims = (item.roleClaims ?? []).map((claim) => ({
      kind: "role claim",
      agentId: item.agentId,
      label: claim.label,
      status: claim.status,
      ref: claim.deltaId || claim.roleClaimId,
      evidenceRefs: archiveContinuityEvidenceRefs({
        evidenceRefs: claim.evidenceRefs,
        responseRefs: claim.responseRefs,
        sourceRefs: item.sourceRefs,
        eventIds: item.eventIds,
      }),
    }));
    return moods.concat(claims);
  });
  return rows.sort((a, b) => Number(b.status === "accepted") - Number(a.status === "accepted"));
}

function archiveContinuityEvidenceRefs(item) {
  return uniqueRoomRefs(
    []
      .concat(item.evidenceRefs ?? [])
      .concat(item.responseRefs ?? [])
      .concat(item.sourceRefs ?? [])
      .concat(item.eventIds ?? [])
      .filter(Boolean),
  ).slice(0, 6);
}

function renderTimelinePreview(timeline) {
  if (timeline.length === 0) {
    timelinePreview.innerHTML = `<p class="overview-detail overview-empty">No room-visible evidence yet.</p>`;
    return;
  }
  timelinePreview.innerHTML = `
    ${timelinePreviewItems(timeline)
      .map((entry) => {
        const ref = firstRoomRef(entry.refs) ?? entry.eventId;
        const category = String(entry.category ?? "boundary");
        return `
          <div class="timeline-row" title="${escapeHtml(entry.boundaryNote ?? entry.eventType)}">
            <span>${escapeHtml(entry.time ?? "")}</span>
            <strong>${escapeHtml(entry.title ?? entry.eventType)}</strong>
            <button class="overview-ref-button" type="button" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>
            <span class="timeline-kind ${escapeHtml(cssToken(category))}">${escapeHtml(timelineCategoryLabel(category))}</span>
          </div>
        `;
      })
      .join("")}
    ${timelineEvidenceSummaryMarkup(timelineEvidenceSummary(timeline))}
  `;
}

function timelinePreviewItems(timeline) {
  const latest = timeline.slice(0, 4);
  if (latest.some((entry) => entry?.eventType === "room.autonomy_tick")) {
    return latest;
  }
  const latestRhythm =
    timeline.find((entry) => entry?.eventType === "room.autonomy_tick") ??
    timeline.find((entry) => entry?.category === "room_rhythm");
  if (!latestRhythm) {
    return latest;
  }
  return latest.length < 4 ? [...latest, latestRhythm] : [...latest.slice(0, 3), latestRhythm];
}

function timelineEvidenceSummary(timeline) {
  const entries = Array.isArray(timeline) ? timeline : [];
  const categories = entries.map((entry) => String(entry.category ?? "boundary"));
  const refs = uniqueRoomRefs(entries.map((entry) => firstRoomRef(entry.refs) ?? entry.eventId));
  return {
    totalCount: entries.length,
    messageCount: categories.filter((category) => category === "message").length,
    rhythmCount: categories.filter((category) => category === "room_rhythm").length,
    archiveCount: categories.filter((category) => category === "archive").length,
    socialCount: categories.filter((category) => category === "social_loop").length,
    memoryCount: categories.filter((category) => category === "memory" || category === "memory_contest").length,
    continuityCount: categories.filter((category) => category === "agent_continuity").length,
    providerCount: categories.filter((category) => category === "provider_boundary").length,
    contestCount: categories.filter((category) => category === "memory_contest").length,
    refs,
  };
}

function timelineEvidenceSummaryMarkup(summary) {
  if (summary.totalCount === 0) {
    return "";
  }
  return `
    <div class="timeline-evidence-summary" aria-label="Ledger timeline evidence summary">
      <span class="timeline-evidence-label">ledger timeline</span>
      ${timelineEvidenceFactMarkup("events", summary.totalCount)}
      ${timelineEvidenceFactMarkup("msg", summary.messageCount)}
      ${timelineEvidenceFactMarkup("rhythm", summary.rhythmCount)}
      ${timelineEvidenceFactMarkup("archive", summary.archiveCount)}
      ${timelineEvidenceFactMarkup("social", summary.socialCount)}
      ${timelineEvidenceFactMarkup("memory", summary.memoryCount)}
      ${timelineEvidenceFactMarkup("continuity", summary.continuityCount)}
      ${timelineEvidenceFactMarkup("provider", summary.providerCount)}
      ${timelineEvidenceFactMarkup("contest", summary.contestCount)}
      ${timelineEvidenceRefsMarkup(summary.refs)}
    </div>
  `;
}

function timelineEvidenceFactMarkup(label, value) {
  return `<span class="timeline-evidence-fact"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span>`;
}

function timelineEvidenceRefsMarkup(refs) {
  const visibleRefs = uniqueRoomRefs(refs).slice(0, 3);
  if (visibleRefs.length === 0) {
    return "";
  }
  return `<span class="timeline-evidence-refs">${visibleRefs
    .map(
      (ref) =>
        `<button class="overview-ref-button compact" type="button" title="Add timeline evidence ref ${escapeHtml(
          ref,
        )}" aria-label="Add timeline evidence ref ${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
    )
    .join("")}</span>`;
}

function renderArchivePreview() {
  const item = archivePreviewCandidate();
  if (!item) {
    archivePreview.innerHTML = overviewEmptyMarkup("No archive yet");
    return;
  }
  const rhythm = archiveRhythmSummary(item.archive);
  archivePreview.innerHTML = `
    ${overviewPreviewMarkup({
      title: item.title,
      detail: item.detail,
      ref: item.ref,
    })}
    ${archiveRhythmSummaryMarkup(rhythm)}
  `;
}

function archivePreviewCandidate() {
  const archive = latestArchive();
  if (!archive) return null;
  const continuityItem = latestArchiveContinuityItem(archive);
  const evidenceRefs = archiveEvidenceRefs(archive);
  const detail =
    continuityItem
      ? `${continuityItem.kind}: ${continuityItem.label} (${continuityItem.status}; ${evidenceRefs.length} evidence refs)`
      : `${archive.summary || "Archive has no summary yet."} (${evidenceRefs.length} evidence refs)`;
  return {
    archive,
    evidenceRefs,
    title: `${archive.date ?? "daily"} · ${archive.revisionOf ? "revision" : "time skeleton"}`,
    detail,
    ref: evidenceRefs[0] ?? archive.archiveId,
  };
}

function archiveEvidenceRefs(archive) {
  const reviewRefs = archiveReviewRefsForArchive(archive.archiveId);
  const continuityRefs = archiveContinuityRows(archive).flatMap((row) => [row.ref, ...(row.evidenceRefs ?? [])]);
  return uniqueRoomRefs([
    ...reviewRefs,
    archive.appliedRepairRef,
    archive.revisionOf,
    ...(archive.provenanceRefs ?? []),
    ...continuityRefs,
    archive.archiveId,
  ]);
}

function archiveReviewRefsForArchive(archiveId) {
  const reviews = Array.isArray(room.socialState?.archiveReviews) ? room.socialState.archiveReviews : [];
  return reviews
    .filter((review) => review.archiveRef === archiveId)
    .flatMap((review) => [review.id, review.repairRef])
    .filter(Boolean);
}

function archiveReviewsForArchive(archive) {
  const archiveId = archive?.archiveId;
  if (!archiveId) return [];
  const reviews = Array.isArray(room.socialState?.archiveReviews) ? room.socialState.archiveReviews : [];
  return reviews.filter((review) => review.archiveRef === archiveId || review.revisedArchiveRef === archiveId);
}

function archiveRhythmSummary(archive) {
  const reviews = archiveReviewsForArchive(archive);
  const reviewCount = reviews.filter((review) => review.kind === "review_request" || review.kind === "review").length;
  const repairCount = reviews.filter((review) => String(review.kind ?? "").startsWith("repair_")).length;
  const revisionRefs = uniqueRoomRefs([
    archive.revisionOf,
    archive.appliedRepairRef,
    ...reviews.flatMap((review) => [review.repairRef, review.revisedArchiveRef]),
  ]);
  const refs = uniqueRoomRefs([
    ...archiveEvidenceRefs(archive),
    ...reviews.flatMap((review) => [review.id, review.repairRef, review.revisedArchiveRef]),
  ]);
  return {
    eventCount: archive.eventCount ?? 0,
    reviewCount,
    repairCount,
    revisionCount: revisionRefs.length,
    continuityCount: (archive.roleClaimCount ?? 0) + (archive.dailyMoodCount ?? 0),
    providerBoundaryCount: archive.providerBoundaryCount ?? 0,
    refs,
  };
}

function archiveRhythmSummaryMarkup(summary) {
  return `
    <div class="archive-rhythm-summary" aria-label="Archive time rhythm summary">
      <span class="archive-rhythm-label">time rhythm</span>
      ${archiveRhythmFactMarkup("events", summary.eventCount)}
      ${archiveRhythmFactMarkup("reviews", summary.reviewCount)}
      ${archiveRhythmFactMarkup("repairs", summary.repairCount)}
      ${archiveRhythmFactMarkup("lineage", summary.revisionCount)}
      ${archiveRhythmFactMarkup("continuity", summary.continuityCount)}
      ${archiveRhythmFactMarkup("providers", summary.providerBoundaryCount)}
      ${archiveRhythmRefsMarkup(summary.refs)}
    </div>
  `;
}

function archiveRhythmFactMarkup(label, value) {
  return `<span class="archive-rhythm-fact"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span>`;
}

function archiveRhythmRefsMarkup(refs) {
  const visibleRefs = uniqueRoomRefs(refs).slice(0, 3);
  if (visibleRefs.length === 0) {
    return "";
  }
  return `<span class="archive-rhythm-refs">${visibleRefs
    .map(
      (ref) =>
        `<button class="overview-ref-button compact" type="button" title="Add archive rhythm ref ${escapeHtml(
          ref,
        )}" aria-label="Add archive rhythm ref ${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
    )
    .join("")}</span>`;
}

function renderMemoryContestPreview() {
  const item = memoryContestPreviewCandidate();
  if (!item) {
    memoryContestPreview.innerHTML = overviewEmptyMarkup("No reviewable memory");
    return;
  }
  const hygiene = memoryHygienePressureSummary();
  memoryContestPreview.innerHTML = `
    ${overviewPreviewMarkup({
      title: item.title,
      detail: item.detail,
      ref: item.ref,
    })}
    ${memoryHygieneSummaryMarkup(hygiene)}
  `;
}

function memoryContestPreviewCandidate() {
  const claim = memoryContestClaims()[0] ?? memoryReviewableClaims()[0];
  if (!claim) return null;
  const refs = memoryClaimEvidenceRefs(claim);
  const evidenceRef = refs.find((ref) => ref !== claim.memoryId) ?? refs[0] ?? claim.memoryId;
  const detail =
    claim.state === "contested"
      ? `contested by ${(claim.contestedBy ?? []).join(", ") || "room"}; ${refs.length} evidence refs`
      : `${claim.state}; ${refs.length} evidence refs`;
  return {
    claim,
    refs,
    ref: evidenceRef,
    title: `${claim.state}: ${claim.summary || claim.memoryId}`,
    detail,
  };
}

function memoryHygienePressureSummary() {
  const reviewable = memoryReviewableClaims();
  return {
    reviewableCount: reviewable.length,
    contestedCount: reviewable.filter((claim) => claim.state === "contested").length,
    staleCount: reviewable.filter((claim) => claim.state === "stale").length,
    revisionCount: reviewable.filter((claim) => Boolean(claim.revisedFromMemoryRef)).length,
    sourcePressureRefs: uniqueRoomRefs(reviewable.flatMap((claim) => claim.sourcePressureRefs ?? [])),
  };
}

function memoryHygieneSummaryMarkup(summary) {
  if (summary.reviewableCount === 0) {
    return "";
  }
  return `
    <div class="memory-hygiene-summary" aria-label="Memory hygiene pressure summary">
      <span class="memory-hygiene-label">hygiene pressure</span>
      ${memoryHygieneFactMarkup("reviewable", summary.reviewableCount)}
      ${memoryHygieneFactMarkup("contested", summary.contestedCount)}
      ${memoryHygieneFactMarkup("stale", summary.staleCount)}
      ${memoryHygieneFactMarkup("revisions", summary.revisionCount)}
      ${memoryHygieneFactMarkup("source pressure", summary.sourcePressureRefs.length)}
      ${memoryHygieneRefsMarkup(summary.sourcePressureRefs)}
    </div>
  `;
}

function memoryHygieneFactMarkup(label, value) {
  return `<span class="memory-hygiene-fact"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span>`;
}

function memoryHygieneRefsMarkup(refs) {
  const visibleRefs = uniqueRoomRefs(refs).slice(0, 3);
  if (visibleRefs.length === 0) {
    return "";
  }
  return `<span class="memory-hygiene-refs">${visibleRefs
    .map(
      (ref) =>
        `<button class="overview-ref-button compact" type="button" title="Add memory hygiene pressure ref ${escapeHtml(
          ref,
        )}" aria-label="Add memory hygiene pressure ref ${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
    )
    .join("")}</span>`;
}

function memoryClaimEvidenceRefs(claim) {
  return uniqueRoomRefs([
    ...(claim.sourceRefs ?? []),
    ...(claim.sourcePressureRefs ?? []),
    claim.revisedFromMemoryRef,
    claim.memoryId,
  ]);
}

function renderAgentContinuityPreview() {
  const item = agentContinuityPreviewCandidate();
  if (!item) {
    agentContinuityPreview.innerHTML = overviewEmptyMarkup("No continuity sediment");
    return;
  }
  const sediment = agentContinuitySedimentSummary();
  agentContinuityPreview.innerHTML = `
    ${overviewPreviewMarkup({
      title: item.title,
      detail: item.detail,
      ref: item.ref,
    })}
    ${agentContinuitySummaryMarkup(sediment)}
  `;
}

function agentContinuityPreviewCandidate() {
  const personas = Array.isArray(room.socialState?.personas) ? room.socialState.personas : [];
  const candidates = [];
  for (const persona of personas) {
    const displayName = persona.displayName ?? persona.agentId;
    const mood = persona.dailyMoodRecord;
    if (mood?.posture) {
      const refs = uniqueRoomRefs([...(mood.responseRefs ?? []), ...(mood.evidenceRefs ?? []), mood.sourceRef]);
      candidates.push({
        priority: (mood.responseRefs ?? []).length > 0 ? 50 : 40,
        evidenceCount: refs.length,
        title: `${displayName} · daily mood`,
        detail: `${mood.posture} (${refs.length} evidence refs)`,
        ref: refs[0] ?? mood.sourceRef,
      });
    }
    for (const claim of persona.roleClaims ?? []) {
      const refs = uniqueRoomRefs([
        ...(claim.responseRefs ?? []),
        claim.roleClaimId,
        ...(claim.evidenceRefs ?? []),
        ...(claim.contestRefs ?? []),
        ...(claim.sourcePressureRefs ?? []),
      ]);
      candidates.push({
        priority: claim.status === "accepted" ? 60 : (claim.responseRefs ?? []).length > 0 ? 55 : 35,
        evidenceCount: refs.length,
        title: `${displayName} · role claim`,
        detail: `${claim.status || "proposed"}; ${claim.label || claim.roleClaimId} (${refs.length} evidence refs)`,
        ref: refs[0] ?? claim.roleClaimId,
      });
    }
    for (const delta of persona.evolutionLog ?? []) {
      const refs = uniqueRoomRefs([delta.deltaId, ...(delta.sourcePressureRefs ?? [])]);
      candidates.push({
        priority: delta.status === "accepted" ? 30 : 20,
        evidenceCount: refs.length,
        title: `${displayName} · ${delta.field}`,
        detail: `${delta.status}; ${delta.value || delta.reason || "identity sediment"} (${refs.length} refs)`,
        ref: refs[0] ?? delta.deltaId,
      });
    }
  }
  if (candidates.length > 0) {
    return candidates
      .filter((item) => item.ref)
      .sort((a, b) => b.priority - a.priority || b.evidenceCount - a.evidenceCount)[0] ?? candidates[0];
  }
  const archiveItem = latestArchiveContinuityItem();
  return archiveItem
    ? {
        priority: 10,
        evidenceCount: archiveItem.evidenceRefs.length,
        title: `${archiveItem.agentId} · ${archiveItem.kind}`,
        detail: `${archiveItem.status}; ${archiveItem.label} (${archiveItem.evidenceRefs.length} evidence refs)`,
        ref: archiveItem.evidenceRefs[0] ?? archiveItem.ref,
      }
    : null;
}

function agentContinuitySedimentSummary() {
  const personas = Array.isArray(room.socialState?.personas) ? room.socialState.personas : [];
  const deltas = personas
    .flatMap((persona) => persona.evolutionLog ?? [])
    .filter((delta) => delta.field === "roleClaims" || delta.field === "dailyMood");
  const roleClaims = personas.flatMap((persona) => persona.roleClaims ?? []);
  const dailyMoods = personas.map((persona) => persona.dailyMoodRecord).filter(Boolean);
  const pendingDeltas = deltas.filter((delta) => ["proposed", "revised", "contested"].includes(delta.status ?? ""));
  const responseRefs = uniqueRoomRefs([
    ...roleClaims.flatMap((claim) => claim.responseRefs ?? []),
    ...dailyMoods.flatMap((mood) => mood.responseRefs ?? []),
  ]);
  const evidenceRefs = uniqueRoomRefs([
    ...roleClaims.flatMap((claim) => [
      claim.roleClaimId,
      ...(claim.evidenceRefs ?? []),
      ...(claim.responseRefs ?? []),
      ...(claim.contestRefs ?? []),
      ...(claim.sourcePressureRefs ?? []),
    ]),
    ...dailyMoods.flatMap((mood) => [mood.sourceRef, ...(mood.evidenceRefs ?? []), ...(mood.responseRefs ?? [])]),
    ...deltas.flatMap((delta) => [delta.deltaId, ...(delta.sourcePressureRefs ?? [])]),
  ]);
  return {
    totalCount: deltas.length + roleClaims.length + dailyMoods.length,
    pendingCount: pendingDeltas.length,
    acceptedRoleClaimCount: roleClaims.filter((claim) => claim.status === "accepted").length,
    dailyMoodCount: dailyMoods.length,
    responseRefCount: responseRefs.length,
    evidenceRefs,
  };
}

function agentContinuitySummaryMarkup(summary) {
  if (summary.totalCount === 0) {
    return "";
  }
  return `
    <div class="continuity-sediment-summary" aria-label="Agent continuity sediment summary">
      <span class="continuity-sediment-label">continuity sediment</span>
      ${agentContinuityFactMarkup("pending", summary.pendingCount)}
      ${agentContinuityFactMarkup("role claims", summary.acceptedRoleClaimCount)}
      ${agentContinuityFactMarkup("daily mood", summary.dailyMoodCount)}
      ${agentContinuityFactMarkup("response refs", summary.responseRefCount)}
      ${agentContinuitySummaryRefsMarkup(summary.evidenceRefs)}
    </div>
  `;
}

function agentContinuityFactMarkup(label, value) {
  return `<span class="continuity-sediment-fact"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span>`;
}

function agentContinuitySummaryRefsMarkup(refs) {
  const visibleRefs = uniqueRoomRefs(refs).slice(0, 3);
  if (visibleRefs.length === 0) {
    return "";
  }
  return `<span class="continuity-sediment-refs">${visibleRefs
    .map(
      (ref) =>
        `<button class="overview-ref-button compact" type="button" title="Add continuity sediment ref ${escapeHtml(
          ref,
        )}" aria-label="Add continuity sediment ref ${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
    )
    .join("")}</span>`;
}

function providerBoundaryOverviewSummary() {
  const boundaries = Array.isArray(room.socialState?.providerBoundaries) ? room.socialState.providerBoundaries : [];
  const activeBoundaries = boundaries.filter((boundary) => !providerBoundaryIsStale(boundary));
  const boundary =
    activeBoundaries.find((item) => item.status !== "retired") ?? activeBoundaries[0] ?? boundaries[0] ?? null;
  const countLabel =
    boundaries.length === 0
      ? "0"
      : activeBoundaries.length === boundaries.length
        ? String(boundaries.length)
        : `${activeBoundaries.length}/${boundaries.length}`;
  return {
    totalCount: boundaries.length,
    activeCount: activeBoundaries.length,
    countLabel,
    boundary,
  };
}

function renderProviderBoundaryPreview(overview = providerBoundaryOverviewSummary()) {
  const item = providerBoundaryPreviewCandidate(overview);
  if (!item) {
    providerBoundaryPreview.innerHTML = overviewEmptyMarkup("No provider boundary");
    return;
  }
  const pressure = providerBoundaryOverviewPressureSummary(overview);
  providerBoundaryPreview.innerHTML = `
    ${overviewPreviewMarkup({
      title: item.title,
      detail: item.detail,
      ref: item.ref,
    })}
    ${providerBoundaryOverviewPressureMarkup(pressure)}
  `;
}

function renderLongRunReadinessPreview(summary = longRunReadinessSummary()) {
  if (!summary.hasReport) {
    longRunReadinessPreview.innerHTML = `
      ${overviewEmptyMarkup("No long-run report yet")}
      <div class="long-run-readiness-note">Run npm run harness:long-run to publish readiness evidence.</div>
    `;
    return;
  }
  longRunReadinessPreview.innerHTML = `
    ${overviewPreviewMarkup({
      title: summary.title,
      detail: summary.detail,
      ref: summary.refs[0],
    })}
    <div class="long-run-readiness-state ${escapeHtml(summary.status)}">${escapeHtml(summary.stateLabel)}</div>
    ${longRunReadinessDomainMarkup(summary)}
    ${longRunRunBalanceMarkup(summary)}
    ${longRunGuardrailsMarkup(summary)}
    ${longRunActionBoundaryMarkup(summary)}
    ${longRunSchedulerContinuityMarkup(summary)}
    ${longRunLongTermRhythmMarkup(summary)}
    ${longRunSilenceReentryMarkup(summary)}
    ${longRunArchiveRhythmMarkup(summary)}
    ${longRunMemoryContestMarkup(summary)}
    ${longRunAgentContinuityMarkup(summary)}
    ${longRunSocialLoopEvidenceMarkup(summary)}
    ${longRunProviderBoundaryMarkup(summary)}
    ${longRunSedimentEvidenceMarkup(summary)}
    ${longRunContextVisibilityMarkup(summary)}
    ${longRunReadinessRefsMarkup(summary.refs)}
  `;
}

function longRunReadinessSummary() {
  const raw = room.longRunOperationalSummary ?? null;
  const domains = Array.isArray(raw?.domains) ? raw.domains : [];
  if (!raw || domains.length === 0) {
    return {
      hasReport: false,
      status: "waiting",
      countLabel: "--",
      title: "No long-run report",
      detail: "waiting for operationalSummary",
      domains: [],
      refs: [],
      failedDomains: [],
      checkedLabel: "",
    };
  }

  const normalizedDomains = domains.map((domain) => ({
    key: domain.key ?? "unknown",
    label: domain.label ?? domain.key ?? "unknown",
    ok: domain.ok === true,
    metrics: domain.metrics ?? {},
    evidenceRefs: Array.isArray(domain.evidenceRefs) ? domain.evidenceRefs : [],
    gaps: Array.isArray(domain.gaps) ? domain.gaps : [],
  }));
  const failedDomains = normalizedDomains.filter((domain) => !domain.ok);
  const passedDomainCount = Number.isFinite(Number(raw.passedDomainCount))
    ? Number(raw.passedDomainCount)
    : normalizedDomains.length - failedDomains.length;
  const failedDomainCount = Number.isFinite(Number(raw.failedDomainCount)) ? Number(raw.failedDomainCount) : failedDomains.length;
  const totalDomainCount = Math.max(normalizedDomains.length, passedDomainCount + failedDomainCount);
  const status = raw.status === "pass" && failedDomains.length === 0 ? "pass" : "fail";
  const freshness = raw.freshness ?? {};
  const stale = freshness.status === "stale";
  const displayStatus = stale ? "stale" : status;
  const checkedLabel = longRunCheckedLabel(raw.checkedAt ?? raw.reportModifiedAt);
  const freshnessLabel = longRunFreshnessLabel(freshness);
  const focus =
    failedDomains[0] ??
    normalizedDomains.find((domain) => domain.key === "context_visibility") ??
    normalizedDomains[0];
  const runBalance = longRunRunBalanceSummary(
    normalizedDomains.find((domain) => domain.key === "duration_window"),
    normalizedDomains.find((domain) => domain.key === "autonomy_rhythm_balance"),
  );
  const guardrails = longRunGuardrailsSummary(
    normalizedDomains.find((domain) => domain.key === "workflow_drift"),
    normalizedDomains.find((domain) => domain.key === "speech_monopoly"),
  );
  const actionBoundary = longRunActionBoundarySummary(
    normalizedDomains.find((domain) => domain.key === "action_boundary"),
  );
  const schedulerContinuity = longRunSchedulerContinuitySummary(
    normalizedDomains.find((domain) => domain.key === "scheduler_continuity"),
  );
  const longTermRhythm = longRunLongTermRhythmSummary(
    normalizedDomains.find((domain) => domain.key === "long_term_rhythm"),
  );
  const silenceReentry = longRunSilenceReentrySummary(
    normalizedDomains.find((domain) => domain.key === "silence_reentry"),
  );
  const archiveRhythm = longRunArchiveRhythmSummary(
    normalizedDomains.find((domain) => domain.key === "archive_rhythm"),
  );
  const memoryContest = longRunMemoryContestSummary(
    normalizedDomains.find((domain) => domain.key === "memory_contest"),
  );
  const agentContinuity = longRunAgentContinuitySummary(
    normalizedDomains.find((domain) => domain.key === "agent_continuity"),
  );
  const sedimentEvidence = longRunSedimentEvidenceSummary(
    normalizedDomains.find((domain) => domain.key === "evidence_sediment"),
  );
  const socialLoopEvidence = longRunSocialLoopEvidenceSummary(
    normalizedDomains.find((domain) => domain.key === "autonomous_social_loop"),
  );
  const providerBoundary = longRunProviderBoundarySummary(
    normalizedDomains.find((domain) => domain.key === "provider_boundary"),
  );
  const contextVisibility = longRunContextVisibilitySummary(
    normalizedDomains.find((domain) => domain.key === "context_visibility"),
  );
  const runBalanceRefSet = new Set(runBalance?.refs ?? []);
  const guardrailRefSet = new Set(guardrails?.refs ?? []);
  const actionBoundaryRefSet = new Set(actionBoundary?.refs ?? []);
  const schedulerRefSet = new Set(schedulerContinuity?.refs ?? []);
  const longTermRhythmRefSet = new Set(longTermRhythm?.refs ?? []);
  const silenceReentryRefSet = new Set(silenceReentry?.refs ?? []);
  const archiveRhythmRefSet = new Set(archiveRhythm?.refs ?? []);
  const memoryContestRefSet = new Set(memoryContest?.refs ?? []);
  const agentContinuityRefSet = new Set(agentContinuity?.refs ?? []);
  const sedimentRefSet = new Set(sedimentEvidence?.refs ?? []);
  const socialLoopRefSet = new Set(socialLoopEvidence?.refs ?? []);
  const providerBoundaryRefSet = new Set(providerBoundary?.refs ?? []);
  const contextVisibilityRefSet = new Set(contextVisibility?.refs ?? []);
  const refs = uniqueRoomRefs([
    ...(Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs : []),
    ...normalizedDomains
      .filter(
        (domain) =>
          domain.key !== "duration_window" &&
          domain.key !== "autonomy_rhythm_balance" &&
          domain.key !== "workflow_drift" &&
          domain.key !== "speech_monopoly" &&
          domain.key !== "action_boundary" &&
          domain.key !== "scheduler_continuity" &&
          domain.key !== "long_term_rhythm" &&
          domain.key !== "silence_reentry" &&
          domain.key !== "archive_rhythm" &&
          domain.key !== "memory_contest" &&
          domain.key !== "agent_continuity" &&
          domain.key !== "evidence_sediment" &&
          domain.key !== "autonomous_social_loop" &&
          domain.key !== "provider_boundary" &&
          domain.key !== "context_visibility",
      )
      .flatMap((domain) => domain.evidenceRefs),
  ])
    .filter(
      (ref) =>
        !runBalanceRefSet.has(ref) &&
        !guardrailRefSet.has(ref) &&
        !actionBoundaryRefSet.has(ref) &&
        !schedulerRefSet.has(ref) &&
        !longTermRhythmRefSet.has(ref) &&
        !silenceReentryRefSet.has(ref) &&
        !archiveRhythmRefSet.has(ref) &&
        !memoryContestRefSet.has(ref) &&
        !agentContinuityRefSet.has(ref) &&
        !sedimentRefSet.has(ref) &&
        !socialLoopRefSet.has(ref) &&
        !providerBoundaryRefSet.has(ref) &&
        !contextVisibilityRefSet.has(ref),
    )
    .slice(0, 8);
  const title = stale ? "stale long-run report" : status === "pass" ? "long-run ready" : `${failedDomainCount} domains need evidence`;
  const detail = [
    `${passedDomainCount}/${totalDomainCount} domains passing`,
    focus ? longRunDomainLabel(focus) : "",
    freshnessLabel,
    checkedLabel,
    raw.reportFile ? `report ${raw.reportFile}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    hasReport: true,
    status: displayStatus,
    countLabel: stale ? "stale" : `${passedDomainCount}/${totalDomainCount}`,
    stateLabel: stale ? "stale report" : status === "pass" ? "current pass" : "current gaps",
    title,
    detail,
    domains: normalizedDomains,
    refs,
    failedDomains,
    checkedLabel,
    runBalance,
    guardrails,
    actionBoundary,
    schedulerContinuity,
    longTermRhythm,
    silenceReentry,
    archiveRhythm,
    memoryContest,
    agentContinuity,
    sedimentEvidence,
    socialLoopEvidence,
    providerBoundary,
    contextVisibility,
  };
}

function longRunReadinessDomainMarkup(summary) {
  const domains = [...summary.domains].sort((left, right) => Number(left.ok) - Number(right.ok)).slice(0, 9);
  return `
    <div class="long-run-domain-row" aria-label="Long-run operational domains">
      ${domains
        .map((domain) => {
          const state = domain.ok ? "ok" : "gap";
          const title = domain.gaps.length > 0 ? domain.gaps.join(" · ") : `${longRunDomainLabel(domain)} evidence domain`;
          return `<span class="long-run-domain ${state}" title="${escapeHtml(title)}">${escapeHtml(shortLongRunDomain(domain))}</span>`;
        })
        .join("")}
    </div>
  `;
}

function longRunReadinessRefsMarkup(refs) {
  const visibleRefs = uniqueRoomRefs(refs).slice(0, 5);
  if (visibleRefs.length === 0) {
    return `<div class="long-run-readiness-refs empty">no report refs</div>`;
  }
  return `
    <div class="long-run-readiness-refs" aria-label="Long-run readiness evidence refs">
      ${visibleRefs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add long-run readiness ref ${escapeHtml(
              ref,
            )}" aria-label="Add long-run readiness ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunRunBalanceSummary(durationDomain, rhythmDomain) {
  if (!durationDomain && !rhythmDomain) return null;
  const durationMetrics = durationDomain?.metrics ?? {};
  const rhythmMetrics = rhythmDomain?.metrics ?? {};
  const observedMs = numberOrUndefined(durationMetrics.observedMs);
  const requestedMs = numberOrUndefined(durationMetrics.requestedMs);
  return {
    ok: durationDomain?.ok === true && rhythmDomain?.ok === true,
    observedMs,
    requestedMs,
    durationLabel: longRunDurationFactLabel(observedMs ?? requestedMs),
    requestedWithinWindow: longRunMetricBoolLabel(durationMetrics.requestedWithinWindow),
    observedAtLeastMin: longRunMetricBoolLabel(durationMetrics.observedAtLeastMin),
    consideredActions: numberOrUndefined(rhythmMetrics.consideredActions) ?? 0,
    distinctActions: numberOrUndefined(rhythmMetrics.distinctActions) ?? 0,
    dominantAction: rhythmMetrics.dominantAction ? String(rhythmMetrics.dominantAction) : "none",
    dominantActionShare: numberOrUndefined(rhythmMetrics.dominantActionShare),
    refs: uniqueRoomRefs(rhythmDomain?.evidenceRefs ?? []),
  };
}

function longRunRunBalanceMarkup(summary) {
  const balance = summary.runBalance;
  if (!balance) return "";
  const state = balance.ok ? "ok" : "gap";
  const refs = balance.refs.slice(0, 4);
  const actionMix = `${balance.distinctActions}/${balance.consideredActions}`;
  const dominantShare = longRunPercentLabel(balance.dominantActionShare);
  const title = [
    `observed ${balance.durationLabel}`,
    `requested ${longRunDurationFactLabel(balance.requestedMs)}`,
    `requested window ${balance.requestedWithinWindow}`,
    `observed min ${balance.observedAtLeastMin}`,
    `${actionMix} action families`,
    `dominant ${balance.dominantAction} ${dominantShare}`,
  ].join(" · ");
  return `
    <div class="long-run-run-balance ${state}" aria-label="Long-run run window and rhythm balance" title="${escapeHtml(title)}">
      <span class="long-run-run-balance-label">run balance</span>
      ${longRunRunBalanceFactMarkup("run", balance.durationLabel)}
      ${longRunRunBalanceFactMarkup("window", balance.requestedWithinWindow)}
      ${longRunRunBalanceFactMarkup("observed", balance.observedAtLeastMin)}
      ${longRunRunBalanceFactMarkup("actions", actionMix)}
      ${longRunRunBalanceFactMarkup("dominant", dominantShare)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add long-run rhythm balance ref ${escapeHtml(
              ref,
            )}" aria-label="Add long-run rhythm balance ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunRunBalanceFactMarkup(label, value) {
  return `
    <span class="long-run-run-balance-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunDurationFactLabel(value) {
  const numeric = numberOrUndefined(value);
  return numeric === undefined ? "unknown" : durationMsLabel(numeric);
}

function longRunGuardrailsSummary(workflowDomain, speechDomain) {
  if (!workflowDomain && !speechDomain) return null;
  const workflowMetrics = workflowDomain?.metrics ?? {};
  const speechMetrics = speechDomain?.metrics ?? {};
  const activeSpeakers = numberOrUndefined(speechMetrics.activeSpeakers);
  const minimumActiveSpeakers = numberOrUndefined(speechMetrics.minimumActiveSpeakers) ?? 2;
  return {
    ok: workflowDomain?.ok === true && speechDomain?.ok === true,
    forcedSpeechMarkers: numberOrUndefined(workflowMetrics.forcedSpeechMarkers) ?? 0,
    sideEffectExecutions: numberOrUndefined(workflowMetrics.sideEffectExecutions) ?? 0,
    forbiddenSchedulerEvents: numberOrUndefined(workflowMetrics.forbiddenSchedulerEvents) ?? 0,
    totalAgentMessages: numberOrUndefined(speechMetrics.totalAgentMessages) ?? 0,
    activeSpeakers,
    minimumActiveSpeakers,
    activeSpeakerLabel: activeSpeakers !== undefined ? `${activeSpeakers}/${minimumActiveSpeakers}` : "unknown",
    maxSpeaker: speechMetrics.maxSpeaker ? String(speechMetrics.maxSpeaker) : "none",
    maxSpeakerShare: numberOrUndefined(speechMetrics.maxSpeakerShare),
    maxSpeakerShareThreshold: numberOrUndefined(speechMetrics.maxSpeakerShareThreshold),
    speakerBalanceGaps: numberOrUndefined(speechMetrics.speakerBalanceGaps) ?? 0,
    deferredSpeeches: numberOrUndefined(speechMetrics.deferredSpeeches) ?? 0,
    deferredRecoveryContextRefs: numberOrUndefined(speechMetrics.deferredRecoveryContextRefs) ?? 0,
    deferredRecoveryGaps: numberOrUndefined(speechMetrics.deferredRecoveryGaps) ?? 0,
    refs: uniqueRoomRefs([...(workflowDomain?.evidenceRefs ?? []), ...(speechDomain?.evidenceRefs ?? [])]),
  };
}

function longRunGuardrailsMarkup(summary) {
  const guardrails = summary.guardrails;
  if (!guardrails) return "";
  const state = guardrails.ok ? "ok" : "gap";
  const refs = guardrails.refs.slice(0, 4);
  const speakerShare = longRunPercentLabel(guardrails.maxSpeakerShare);
  const title = [
    `${guardrails.forcedSpeechMarkers} forced speech markers`,
    `${guardrails.sideEffectExecutions} side-effect executions`,
    `${guardrails.forbiddenSchedulerEvents} forbidden scheduler refs`,
    `${guardrails.totalAgentMessages} agent messages`,
    `${guardrails.activeSpeakerLabel} active speakers`,
    `max speaker ${guardrails.maxSpeaker} ${speakerShare}`,
    `${guardrails.speakerBalanceGaps} speaker balance gaps`,
    `${guardrails.deferredSpeeches} deferred speech records`,
    `${guardrails.deferredRecoveryContextRefs} deferred recovery context refs`,
    `${guardrails.deferredRecoveryGaps} deferred recovery gaps`,
  ].join(" · ");
  return `
    <div class="long-run-guardrails ${state}" aria-label="Long-run workflow and speech guardrails" title="${escapeHtml(title)}">
      <span class="long-run-guardrails-label">guardrails</span>
      ${longRunGuardrailFactMarkup("forced", guardrails.forcedSpeechMarkers)}
      ${longRunGuardrailFactMarkup("sidefx", guardrails.sideEffectExecutions)}
      ${longRunGuardrailFactMarkup("scheduler", guardrails.forbiddenSchedulerEvents)}
      ${longRunGuardrailFactMarkup("messages", guardrails.totalAgentMessages)}
      ${longRunGuardrailFactMarkup("speakers", guardrails.activeSpeakerLabel)}
      ${longRunGuardrailFactMarkup("max share", speakerShare)}
      ${longRunGuardrailFactMarkup("balance", guardrails.speakerBalanceGaps)}
      ${longRunGuardrailFactMarkup("deferred", guardrails.deferredSpeeches)}
      ${longRunGuardrailFactMarkup("recovery", guardrails.deferredRecoveryContextRefs)}
      ${longRunGuardrailFactMarkup("recovery gaps", guardrails.deferredRecoveryGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add long-run guardrail ref ${escapeHtml(
              ref,
            )}" aria-label="Add long-run guardrail ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunGuardrailFactMarkup(label, value) {
  return `
    <span class="long-run-guardrail-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunActionBoundarySummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    sideEffectRequests: numberOrUndefined(metrics.sideEffectRequests) ?? 0,
    sideEffectReviews: numberOrUndefined(metrics.sideEffectReviews) ?? 0,
    sideEffectApprovals: numberOrUndefined(metrics.sideEffectApprovals) ?? 0,
    sideEffectDenials: numberOrUndefined(metrics.sideEffectDenials) ?? 0,
    sideEffectExpiries: numberOrUndefined(metrics.sideEffectExpiries) ?? 0,
    sideEffectResults: numberOrUndefined(metrics.sideEffectResults) ?? 0,
    unapprovedResults: numberOrUndefined(metrics.unapprovedResults) ?? 0,
    capabilityInvocations: numberOrUndefined(metrics.capabilityInvocations) ?? 0,
    capabilityResults: numberOrUndefined(metrics.capabilityResults) ?? 0,
    workspaceArtifacts: numberOrUndefined(metrics.workspaceArtifacts) ?? 0,
    workspaceReviews: numberOrUndefined(metrics.workspaceReviews) ?? 0,
    skillCapsuleReviews: numberOrUndefined(metrics.skillCapsuleReviews) ?? 0,
    capabilityReviews: numberOrUndefined(metrics.capabilityReviews) ?? 0,
    contextBoundaryRefs: numberOrUndefined(metrics.contextBoundaryRefs) ?? 0,
    actionBoundaryGaps: numberOrUndefined(metrics.actionBoundaryGaps) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunActionBoundaryMarkup(summary) {
  const action = summary.actionBoundary;
  if (!action) return "";
  const state = action.ok ? "ok" : "gap";
  const refs = action.refs.slice(0, 4);
  const sideEffectDecisions = action.sideEffectApprovals + action.sideEffectDenials + action.sideEffectExpiries;
  const capabilityEvidence = action.capabilityInvocations + action.capabilityResults + action.capabilityReviews;
  const workspaceEvidence = action.workspaceArtifacts + action.workspaceReviews;
  const title = [
    `${action.sideEffectRequests} side-effect requests`,
    `${action.sideEffectReviews} side-effect reviews`,
    `${sideEffectDecisions} side-effect decisions`,
    `${action.sideEffectResults} side-effect results`,
    `${action.unapprovedResults} unapproved results`,
    `${action.capabilityInvocations} capability invocations`,
    `${action.capabilityResults} private capability results`,
    `${workspaceEvidence} workspace share/review refs`,
    `${action.skillCapsuleReviews} skill capsule reviews`,
    `${action.capabilityReviews} capability reviews`,
    `${action.contextBoundaryRefs} context boundary refs`,
    `${action.actionBoundaryGaps} action boundary gaps`,
  ].join(" · ");
  return `
    <div class="long-run-action-boundary ${state}" aria-label="Long-run action boundary" title="${escapeHtml(title)}">
      <span class="long-run-action-label">actions</span>
      ${longRunActionFactMarkup("sidefx", action.sideEffectRequests)}
      ${longRunActionFactMarkup("reviews", action.sideEffectReviews)}
      ${longRunActionFactMarkup("results", action.sideEffectResults)}
      ${longRunActionFactMarkup("unapproved", action.unapprovedResults)}
      ${longRunActionFactMarkup("capability", capabilityEvidence)}
      ${longRunActionFactMarkup("workspace", workspaceEvidence)}
      ${longRunActionFactMarkup("skill", action.skillCapsuleReviews)}
      ${longRunActionFactMarkup("context", action.contextBoundaryRefs)}
      ${longRunActionFactMarkup("gaps", action.actionBoundaryGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add action boundary ref ${escapeHtml(
              ref,
            )}" aria-label="Add action boundary ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunActionFactMarkup(label, value) {
  return `
    <span class="long-run-action-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunPercentLabel(value) {
  const numeric = numberOrUndefined(value);
  if (numeric === undefined) return "n/a";
  return `${Math.round(numeric * 100)}%`;
}

function longRunSchedulerContinuitySummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    samples: numberOrUndefined(metrics.samples) ?? numberOrUndefined(metrics.sampleCount) ?? 0,
    maxDriftMs: numberOrUndefined(metrics.maxDriftMs),
    maxDurationMs: numberOrUndefined(metrics.maxDurationMs),
    maxOverrunMs: numberOrUndefined(metrics.maxOverrunMs),
    overdueTicks: numberOrUndefined(metrics.overdueTicks) ?? 0,
    overrunTicks: numberOrUndefined(metrics.overrunTicks) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunSchedulerContinuityMarkup(summary) {
  const scheduler = summary.schedulerContinuity;
  if (!scheduler) return "";
  const state = scheduler.ok ? "ok" : "gap";
  const refs = scheduler.refs.slice(0, 3);
  const title = [
    `${scheduler.samples} scheduler samples`,
    scheduler.maxDriftMs !== undefined ? `max drift ${durationMsCompactLabel(scheduler.maxDriftMs)}` : "",
    scheduler.maxDurationMs !== undefined ? `max run ${durationMsCompactLabel(scheduler.maxDurationMs)}` : "",
    scheduler.maxOverrunMs !== undefined ? `max overrun ${durationMsCompactLabel(scheduler.maxOverrunMs)}` : "",
    scheduler.overdueTicks ? `${scheduler.overdueTicks} overdue` : "",
    scheduler.overrunTicks ? `${scheduler.overrunTicks} overrun` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <div class="long-run-scheduler-continuity ${state}" aria-label="Long-run scheduler continuity" title="${escapeHtml(title)}">
      <span class="long-run-scheduler-label">scheduler</span>
      ${longRunSchedulerFactMarkup("samples", scheduler.samples)}
      ${longRunSchedulerFactMarkup(
        "max drift",
        scheduler.maxDriftMs !== undefined ? durationMsCompactLabel(scheduler.maxDriftMs) : "unknown",
      )}
      ${longRunSchedulerFactMarkup(
        "max run",
        scheduler.maxDurationMs !== undefined ? durationMsCompactLabel(scheduler.maxDurationMs) : "unknown",
      )}
      ${
        scheduler.maxOverrunMs !== undefined || scheduler.overrunTicks > 0
          ? longRunSchedulerFactMarkup(
              "overrun",
              scheduler.maxOverrunMs !== undefined ? durationMsCompactLabel(scheduler.maxOverrunMs) : String(scheduler.overrunTicks),
            )
          : ""
      }
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add scheduler continuity ref ${escapeHtml(
              ref,
            )}" aria-label="Add scheduler continuity ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunSchedulerFactMarkup(label, value) {
  return `
    <span class="long-run-scheduler-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunLongTermRhythmSummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    archiveActions: numberOrUndefined(metrics.archiveActions) ?? 0,
    memoryHygieneActions: numberOrUndefined(metrics.memoryHygieneActions) ?? 0,
    continuityReviewActions: numberOrUndefined(metrics.continuityReviewActions) ?? 0,
    providerBoundaryReviewActions: numberOrUndefined(metrics.providerBoundaryReviewActions) ?? 0,
    idleSocialActions: numberOrUndefined(metrics.idleSocialActions) ?? 0,
    idleSocialTargets: numberOrUndefined(metrics.idleSocialTargets) ?? 0,
    idleSocialEvidenceRefs: numberOrUndefined(metrics.idleSocialEvidenceRefs) ?? 0,
    preservedSilenceActions: numberOrUndefined(metrics.preservedSilenceActions) ?? 0,
    choiceSetTargetRefs: numberOrUndefined(metrics.choiceSetTargetRefs) ?? 0,
    choiceSetEvidenceRefs: numberOrUndefined(metrics.choiceSetEvidenceRefs) ?? 0,
    choiceSetGaps: numberOrUndefined(metrics.choiceSetGaps) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunLongTermRhythmMarkup(summary) {
  const rhythm = summary.longTermRhythm;
  if (!rhythm) return "";
  const state = rhythm.ok ? "ok" : "gap";
  const refs = rhythm.refs.slice(0, 4);
  const title = [
    `${rhythm.archiveActions} archive actions`,
    `${rhythm.memoryHygieneActions} memory hygiene actions`,
    `${rhythm.continuityReviewActions} continuity review actions`,
    `${rhythm.providerBoundaryReviewActions} provider boundary review actions`,
    `${rhythm.idleSocialActions} idle social rhythm actions`,
    `${rhythm.idleSocialTargets} idle social target refs`,
    `${rhythm.idleSocialEvidenceRefs} idle social evidence refs`,
    `${rhythm.preservedSilenceActions} preserved silence actions`,
    `${rhythm.choiceSetTargetRefs} choice-set target refs`,
    `${rhythm.choiceSetEvidenceRefs} choice-set evidence refs`,
    `${rhythm.choiceSetGaps} choice-set gaps`,
  ].join(" · ");
  return `
    <div class="long-run-long-rhythm ${state}" aria-label="Long-run long-term rhythm" title="${escapeHtml(title)}">
      <span class="long-run-long-rhythm-label">long rhythm</span>
      ${longRunLongRhythmFactMarkup("archive", rhythm.archiveActions)}
      ${longRunLongRhythmFactMarkup("memory", rhythm.memoryHygieneActions)}
      ${longRunLongRhythmFactMarkup("continuity", rhythm.continuityReviewActions)}
      ${longRunLongRhythmFactMarkup("provider", rhythm.providerBoundaryReviewActions)}
      ${longRunLongRhythmFactMarkup("idle", rhythm.idleSocialActions)}
      ${longRunLongRhythmFactMarkup("idle refs", rhythm.idleSocialTargets + rhythm.idleSocialEvidenceRefs)}
      ${longRunLongRhythmFactMarkup("silence", rhythm.preservedSilenceActions)}
      ${longRunLongRhythmFactMarkup("targets", rhythm.choiceSetTargetRefs)}
      ${longRunLongRhythmFactMarkup("evidence", rhythm.choiceSetEvidenceRefs)}
      ${longRunLongRhythmFactMarkup("gaps", rhythm.choiceSetGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add long-term rhythm ref ${escapeHtml(
              ref,
            )}" aria-label="Add long-term rhythm ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunLongRhythmFactMarkup(label, value) {
  return `
    <span class="long-run-long-rhythm-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunSilenceReentrySummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    configuredMs: numberOrUndefined(metrics.configuredSilenceReentryMs),
    silenceReentryActions: numberOrUndefined(metrics.silenceReentryActions) ?? 0,
    reentryMessages: numberOrUndefined(metrics.reentryMessages) ?? 0,
    quietAnchorRefs: numberOrUndefined(metrics.quietAnchorRefs) ?? 0,
    archiveRefs: numberOrUndefined(metrics.archiveRefs) ?? 0,
    evidenceRefs: numberOrUndefined(metrics.evidenceRefs) ?? 0,
    missingAnchorActions: numberOrUndefined(metrics.missingAnchorActions) ?? 0,
    preservedSilenceAnchorRefs: numberOrUndefined(metrics.preservedSilenceAnchorRefs) ?? 0,
    missingPreservedSilenceActions: numberOrUndefined(metrics.missingPreservedSilenceActions) ?? 0,
    preservedSilenceActions: numberOrUndefined(metrics.preservedSilenceActions) ?? 0,
    deliberateSilenceIntentions: numberOrUndefined(metrics.deliberateSilenceIntentions) ?? 0,
    silenceReentryGaps: numberOrUndefined(metrics.silenceReentryGaps) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunSilenceReentryMarkup(summary) {
  const silence = summary.silenceReentry;
  if (!silence) return "";
  const state = silence.ok ? "ok" : "gap";
  const refs = silence.refs.slice(0, 4);
  const configured = silence.configuredMs !== undefined ? durationMsCompactLabel(silence.configuredMs) : "unknown";
  const title = [
    `configured ${configured}`,
    `${silence.silenceReentryActions} re-entry actions`,
    `${silence.reentryMessages} room-visible re-entry messages`,
    `${silence.quietAnchorRefs} quiet anchor refs`,
    `${silence.archiveRefs} archive refs`,
    `${silence.evidenceRefs} ledger evidence refs`,
    `${silence.missingAnchorActions} missing anchor actions`,
    `${silence.preservedSilenceAnchorRefs} preserved silence anchor refs`,
    `${silence.missingPreservedSilenceActions} missing preserved silence actions`,
    `${silence.preservedSilenceActions} preserved silence actions`,
    `${silence.deliberateSilenceIntentions} stay_silent intentions`,
    `${silence.silenceReentryGaps} silence re-entry gaps`,
  ].join(" · ");
  return `
    <div class="long-run-silence-reentry ${state}" aria-label="Long-run silence re-entry" title="${escapeHtml(title)}">
      <span class="long-run-silence-label">silence</span>
      ${longRunSilenceFactMarkup("threshold", configured)}
      ${longRunSilenceFactMarkup("re-entry", silence.silenceReentryActions)}
      ${longRunSilenceFactMarkup("messages", silence.reentryMessages)}
      ${longRunSilenceFactMarkup("anchors", silence.quietAnchorRefs)}
      ${longRunSilenceFactMarkup("archive", silence.archiveRefs)}
      ${longRunSilenceFactMarkup("evidence", silence.evidenceRefs)}
      ${longRunSilenceFactMarkup("linked silence", silence.preservedSilenceAnchorRefs)}
      ${longRunSilenceFactMarkup("preserved", silence.preservedSilenceActions)}
      ${longRunSilenceFactMarkup("intentions", silence.deliberateSilenceIntentions)}
      ${longRunSilenceFactMarkup("gaps", silence.silenceReentryGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add silence re-entry ref ${escapeHtml(
              ref,
            )}" aria-label="Add silence re-entry ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunSilenceFactMarkup(label, value) {
  return `
    <span class="long-run-silence-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunArchiveRhythmSummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    archiveEvents: numberOrUndefined(metrics.archiveEvents) ?? 0,
    archiveRefs: numberOrUndefined(metrics.archiveRefs) ?? 0,
    ledgerEvidenceRefs: numberOrUndefined(metrics.ledgerEvidenceRefs) ?? 0,
    acceptedMemoryArchives: numberOrUndefined(metrics.acceptedMemoryArchives) ?? 0,
    acceptedMemoryArchiveEvidenceRefs: numberOrUndefined(metrics.acceptedMemoryArchiveEvidenceRefs) ?? 0,
    acceptedMemoryArchivesWithoutEvidence: numberOrUndefined(metrics.acceptedMemoryArchivesWithoutEvidence) ?? 0,
    archivesWithContinuity: numberOrUndefined(metrics.archivesWithContinuity) ?? 0,
    archivedContinuityItems: numberOrUndefined(metrics.archivedContinuityItems) ?? 0,
    acceptedArchivedContinuityItems: numberOrUndefined(metrics.acceptedArchivedContinuityItems) ?? 0,
    archiveActions: numberOrUndefined(metrics.archiveActions) ?? 0,
    archiveReviewActions: numberOrUndefined(metrics.archiveReviewActions) ?? 0,
    archiveActionMessages: numberOrUndefined(metrics.archiveActionMessages) ?? 0,
    archiveActionArchives: numberOrUndefined(metrics.archiveActionArchives) ?? 0,
    archiveReviewRequests: numberOrUndefined(metrics.archiveReviewRequests) ?? 0,
    archiveActionEvidenceRefs: numberOrUndefined(metrics.archiveActionEvidenceRefs) ?? 0,
    archiveReviewLedgerEvents: numberOrUndefined(metrics.archiveReviewLedgerEvents) ?? 0,
    archiveEvidenceGaps: numberOrUndefined(metrics.archiveEvidenceGaps) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunArchiveRhythmMarkup(summary) {
  const archive = summary.archiveRhythm;
  if (!archive) return "";
  const state = archive.ok ? "ok" : "gap";
  const refs = archive.refs.slice(0, 4);
  const archiveReviewEvidence = archive.archiveReviewRequests + archive.archiveReviewLedgerEvents;
  const title = [
    `${archive.archiveEvents} archive events`,
    `${archive.archiveRefs} archive refs`,
    `${archive.ledgerEvidenceRefs} ledger evidence refs`,
    `${archive.acceptedMemoryArchives} accepted memory archives`,
    `${archive.acceptedMemoryArchiveEvidenceRefs} accepted memory archive evidence refs`,
    `${archive.acceptedMemoryArchivesWithoutEvidence} accepted memory archives without evidence refs`,
    `${archive.archivesWithContinuity} archives with continuity`,
    `${archive.archivedContinuityItems} archived continuity items`,
    `${archive.acceptedArchivedContinuityItems} accepted archived continuity items`,
    `${archive.archiveActions} archive actions`,
    `${archive.archiveReviewActions} archive review actions`,
    `${archive.archiveActionMessages} archive action messages`,
    `${archive.archiveActionArchives} archive action archive refs`,
    `${archive.archiveReviewRequests} archive review requests`,
    `${archive.archiveActionEvidenceRefs} archive action evidence refs`,
    `${archive.archiveReviewLedgerEvents} archive review ledger events`,
    `${archive.archiveEvidenceGaps} archive evidence gaps`,
  ].join(" · ");
  return `
    <div class="long-run-archive-rhythm ${state}" aria-label="Long-run archive rhythm" title="${escapeHtml(title)}">
      <span class="long-run-archive-rhythm-label">archive</span>
      ${longRunArchiveRhythmFactMarkup("events", archive.archiveEvents)}
      ${longRunArchiveRhythmFactMarkup("ledger", archive.ledgerEvidenceRefs)}
      ${longRunArchiveRhythmFactMarkup("memory", archive.acceptedMemoryArchives)}
      ${longRunArchiveRhythmFactMarkup("actions", archive.archiveActions)}
      ${longRunArchiveRhythmFactMarkup("reviews", archiveReviewEvidence)}
      ${longRunArchiveRhythmFactMarkup("continuity", archive.archivedContinuityItems)}
      ${longRunArchiveRhythmFactMarkup("accepted", archive.acceptedArchivedContinuityItems)}
      ${longRunArchiveRhythmFactMarkup("evidence", archive.archiveActionEvidenceRefs)}
      ${longRunArchiveRhythmFactMarkup("gaps", archive.archiveEvidenceGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add archive rhythm ref ${escapeHtml(
              ref,
            )}" aria-label="Add archive rhythm ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunArchiveRhythmFactMarkup(label, value) {
  return `
    <span class="long-run-archive-rhythm-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunMemoryContestSummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    memoryProposals: numberOrUndefined(metrics.memoryProposals) ?? 0,
    memoryAcceptances: numberOrUndefined(metrics.memoryAcceptances) ?? 0,
    memoryContests: numberOrUndefined(metrics.memoryContests) ?? 0,
    memoryReviews: numberOrUndefined(metrics.memoryReviews) ?? 0,
    reviewedMemoryRefs: numberOrUndefined(metrics.reviewedMemoryRefs) ?? 0,
    memoryPressureEvents: numberOrUndefined(metrics.memoryPressureEvents) ?? 0,
    memoryHygieneActions: numberOrUndefined(metrics.memoryHygieneActions) ?? 0,
    memoryHygieneTargets: numberOrUndefined(metrics.memoryHygieneTargets) ?? 0,
    memoryHygieneEvidenceRefs: numberOrUndefined(metrics.memoryHygieneEvidenceRefs) ?? 0,
    acceptedWithoutEvidence: numberOrUndefined(metrics.acceptedWithoutEvidence) ?? 0,
    acceptedWithoutReview: numberOrUndefined(metrics.acceptedWithoutReview) ?? 0,
    personaLikeMemory: numberOrUndefined(metrics.personaLikeMemory) ?? 0,
    acceptedPersonaLikeMemory: numberOrUndefined(metrics.acceptedPersonaLikeMemory) ?? 0,
    acceptedMemoryArchives: numberOrUndefined(metrics.acceptedMemoryArchives) ?? 0,
    acceptedMemoryArchiveEvidenceRefs: numberOrUndefined(metrics.acceptedMemoryArchiveEvidenceRefs) ?? 0,
    acceptedMemoryArchivesWithoutEvidence: numberOrUndefined(metrics.acceptedMemoryArchivesWithoutEvidence) ?? 0,
    contestEvidenceGaps: numberOrUndefined(metrics.contestEvidenceGaps) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunMemoryContestMarkup(summary) {
  const memory = summary.memoryContest;
  if (!memory) return "";
  const state = memory.ok ? "ok" : "gap";
  const refs = memory.refs.slice(0, 4);
  const reviewTraces = memory.memoryContests + memory.memoryReviews;
  const pollutionCount = memory.personaLikeMemory + memory.acceptedPersonaLikeMemory + memory.acceptedWithoutReview;
  const title = [
    `${memory.memoryProposals} memory proposals`,
    `${memory.memoryAcceptances} memory acceptances`,
    `${memory.memoryContests} memory contests`,
    `${memory.memoryReviews} memory reviews`,
    `${memory.reviewedMemoryRefs} reviewed memory refs`,
    `${memory.memoryPressureEvents} memory pressure events`,
    `${memory.memoryHygieneActions} memory hygiene actions`,
    `${memory.memoryHygieneTargets} memory hygiene target refs`,
    `${memory.memoryHygieneEvidenceRefs} memory hygiene evidence refs`,
    `${memory.acceptedWithoutEvidence} accepted without evidence refs`,
    `${memory.acceptedWithoutReview} accepted without review or contest`,
    `${memory.acceptedMemoryArchives} accepted memory archives`,
    `${memory.acceptedMemoryArchiveEvidenceRefs} accepted memory archive evidence refs`,
    `${memory.acceptedMemoryArchivesWithoutEvidence} accepted memory archives without evidence refs`,
    `${pollutionCount} memory pollution markers`,
    `${memory.contestEvidenceGaps} contest evidence gaps`,
  ].join(" · ");
  return `
    <div class="long-run-memory-contest ${state}" aria-label="Long-run memory contest" title="${escapeHtml(title)}">
      <span class="long-run-memory-contest-label">memory contest</span>
      ${longRunMemoryContestFactMarkup("proposals", memory.memoryProposals)}
      ${longRunMemoryContestFactMarkup("accepted", memory.memoryAcceptances)}
      ${longRunMemoryContestFactMarkup("reviews", reviewTraces)}
      ${longRunMemoryContestFactMarkup("pressure", memory.memoryPressureEvents)}
      ${longRunMemoryContestFactMarkup("hygiene", memory.memoryHygieneActions)}
      ${longRunMemoryContestFactMarkup("targets", memory.memoryHygieneTargets)}
      ${longRunMemoryContestFactMarkup("evidence", memory.memoryHygieneEvidenceRefs)}
      ${longRunMemoryContestFactMarkup("archive", memory.acceptedMemoryArchives)}
      ${longRunMemoryContestFactMarkup("archive evidence", memory.acceptedMemoryArchiveEvidenceRefs)}
      ${longRunMemoryContestFactMarkup("pollution", pollutionCount)}
      ${longRunMemoryContestFactMarkup("gaps", memory.contestEvidenceGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add memory contest ref ${escapeHtml(
              ref,
            )}" aria-label="Add memory contest ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunMemoryContestFactMarkup(label, value) {
  return `
    <span class="long-run-memory-contest-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunAgentContinuitySummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    personaDeltas: numberOrUndefined(metrics.personaDeltas) ?? 0,
    acceptedPersonaDeltas: numberOrUndefined(metrics.acceptedPersonaDeltas) ?? 0,
    roleClaims: numberOrUndefined(metrics.roleClaims) ?? 0,
    acceptedRoleClaims: numberOrUndefined(metrics.acceptedRoleClaims) ?? 0,
    dailyMoodRecords: numberOrUndefined(metrics.dailyMoodRecords) ?? 0,
    acceptedDailyMoods: numberOrUndefined(metrics.acceptedDailyMoods) ?? 0,
    continuityReviewActions: numberOrUndefined(metrics.continuityReviewActions) ?? 0,
    continuityReviewTargets: numberOrUndefined(metrics.continuityReviewTargets) ?? 0,
    archivedContinuityItems: numberOrUndefined(metrics.archivedContinuityItems) ?? 0,
    acceptedArchivedContinuityItems: numberOrUndefined(metrics.acceptedArchivedContinuityItems) ?? 0,
    archiveContinuityEvidenceRefs: numberOrUndefined(metrics.archiveContinuityEvidenceRefs) ?? 0,
    archiveContinuityResponseRefs: numberOrUndefined(metrics.archiveContinuityResponseRefs) ?? 0,
    continuityEvidenceGaps: numberOrUndefined(metrics.continuityEvidenceGaps) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunAgentContinuityMarkup(summary) {
  const continuity = summary.agentContinuity;
  if (!continuity) return "";
  const state = continuity.ok ? "ok" : "gap";
  const refs = continuity.refs.slice(0, 4);
  const acceptedContinuity = continuity.acceptedRoleClaims + continuity.acceptedDailyMoods;
  const archiveEvidence = continuity.archiveContinuityEvidenceRefs + continuity.archiveContinuityResponseRefs;
  const title = [
    `${continuity.personaDeltas} persona deltas`,
    `${continuity.acceptedPersonaDeltas} accepted persona deltas`,
    `${continuity.roleClaims} role claims`,
    `${continuity.acceptedRoleClaims} accepted role claims`,
    `${continuity.dailyMoodRecords} daily mood records`,
    `${continuity.acceptedDailyMoods} accepted daily moods`,
    `${continuity.continuityReviewActions} continuity review actions`,
    `${continuity.continuityReviewTargets} continuity review target refs`,
    `${continuity.archivedContinuityItems} archived continuity items`,
    `${continuity.acceptedArchivedContinuityItems} accepted archived continuity items`,
    `${archiveEvidence} archive continuity evidence/response refs`,
    `${continuity.continuityEvidenceGaps} continuity evidence gaps`,
  ].join(" · ");
  return `
    <div class="long-run-agent-continuity ${state}" aria-label="Long-run agent continuity" title="${escapeHtml(title)}">
      <span class="long-run-agent-continuity-label">continuity</span>
      ${longRunAgentContinuityFactMarkup("deltas", continuity.personaDeltas)}
      ${longRunAgentContinuityFactMarkup("accepted", acceptedContinuity)}
      ${longRunAgentContinuityFactMarkup("roles", continuity.roleClaims)}
      ${longRunAgentContinuityFactMarkup("mood", continuity.dailyMoodRecords)}
      ${longRunAgentContinuityFactMarkup("reviews", continuity.continuityReviewActions)}
      ${longRunAgentContinuityFactMarkup("targets", continuity.continuityReviewTargets)}
      ${longRunAgentContinuityFactMarkup("archive", continuity.archivedContinuityItems)}
      ${longRunAgentContinuityFactMarkup("evidence", archiveEvidence)}
      ${longRunAgentContinuityFactMarkup("gaps", continuity.continuityEvidenceGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add agent continuity ref ${escapeHtml(
              ref,
            )}" aria-label="Add agent continuity ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunAgentContinuityFactMarkup(label, value) {
  return `
    <span class="long-run-agent-continuity-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunSedimentEvidenceSummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    memoryProposals: numberOrUndefined(metrics.memoryProposals) ?? 0,
    memoryContests: numberOrUndefined(metrics.memoryContests) ?? 0,
    personaLikeMemory: numberOrUndefined(metrics.personaLikeMemory) ?? 0,
    acceptedPersonaLikeMemory: numberOrUndefined(metrics.acceptedPersonaLikeMemory) ?? 0,
    acceptedWithoutReview: numberOrUndefined(metrics.acceptedWithoutReview) ?? 0,
    memoryReviewTraces: numberOrUndefined(metrics.memoryReviewTraces) ?? 0,
    memoryPressureEvents: numberOrUndefined(metrics.memoryPressureEvents) ?? 0,
    personaDeltas: numberOrUndefined(metrics.personaDeltas) ?? 0,
    roleClaims: numberOrUndefined(metrics.roleClaims) ?? 0,
    dailyMoodRecords: numberOrUndefined(metrics.dailyMoodRecords) ?? 0,
    continuityEvidenceRefs: numberOrUndefined(metrics.continuityEvidenceRefs) ?? 0,
    continuityResponseRefs: numberOrUndefined(metrics.continuityResponseRefs) ?? 0,
    continuityEvidenceGaps: numberOrUndefined(metrics.continuityEvidenceGaps) ?? 0,
    acceptedMemoryArchives: numberOrUndefined(metrics.acceptedMemoryArchives) ?? 0,
    acceptedMemoryArchiveEvidenceRefs: numberOrUndefined(metrics.acceptedMemoryArchiveEvidenceRefs) ?? 0,
    acceptedMemoryArchivesWithoutEvidence: numberOrUndefined(metrics.acceptedMemoryArchivesWithoutEvidence) ?? 0,
    archivedContinuityItems: numberOrUndefined(metrics.archivedContinuityItems) ?? 0,
    archiveEvents: numberOrUndefined(metrics.archiveEvents) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunSedimentEvidenceMarkup(summary) {
  const sediment = summary.sedimentEvidence;
  if (!sediment) return "";
  const state = sediment.ok ? "ok" : "gap";
  const refs = sediment.refs.slice(0, 4);
  const pollutionCount =
    sediment.personaLikeMemory + sediment.acceptedPersonaLikeMemory + sediment.acceptedWithoutReview;
  const title = [
    `${sediment.memoryProposals} memory proposals`,
    `${sediment.memoryContests} memory contests`,
    `${sediment.personaLikeMemory} persona-like public memory`,
    `${sediment.acceptedPersonaLikeMemory} accepted persona-like memory`,
    `${sediment.acceptedWithoutReview} accepted without prior review or contest`,
    `${sediment.memoryReviewTraces} memory review/contest traces`,
    `${sediment.memoryPressureEvents} memory pressure events`,
    `${sediment.personaDeltas} persona deltas`,
    `${sediment.roleClaims} role claims`,
    `${sediment.dailyMoodRecords} daily mood records`,
    `${sediment.continuityEvidenceRefs} continuity evidence refs`,
    `${sediment.continuityResponseRefs} continuity response refs`,
    `${sediment.continuityEvidenceGaps} continuity evidence gaps`,
    `${sediment.acceptedMemoryArchives} accepted memory archives`,
    `${sediment.acceptedMemoryArchiveEvidenceRefs} accepted memory archive evidence refs`,
    `${sediment.acceptedMemoryArchivesWithoutEvidence} accepted memory archives without evidence refs`,
    `${sediment.archivedContinuityItems} archived continuity items`,
    `${sediment.archiveEvents} archive events`,
  ].join(" · ");
  return `
    <div class="long-run-sediment-evidence ${state}" aria-label="Long-run ledger-backed sediment" title="${escapeHtml(title)}">
      <span class="long-run-sediment-label">sediment</span>
      ${longRunSedimentFactMarkup("memory", sediment.memoryProposals)}
      ${longRunSedimentFactMarkup("contests", sediment.memoryContests)}
      ${longRunSedimentFactMarkup("pollution", pollutionCount)}
      ${longRunSedimentFactMarkup("review", sediment.memoryReviewTraces)}
      ${longRunSedimentFactMarkup("persona", sediment.personaDeltas)}
      ${longRunSedimentFactMarkup("roles", sediment.roleClaims)}
      ${longRunSedimentFactMarkup("mood", sediment.dailyMoodRecords)}
      ${longRunSedimentFactMarkup("evidence", sediment.continuityEvidenceRefs + sediment.continuityResponseRefs)}
      ${longRunSedimentFactMarkup("gaps", sediment.continuityEvidenceGaps)}
      ${longRunSedimentFactMarkup("memory archive", sediment.acceptedMemoryArchives)}
      ${longRunSedimentFactMarkup("archive", sediment.archivedContinuityItems + sediment.archiveEvents)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add sediment evidence ref ${escapeHtml(
              ref,
            )}" aria-label="Add sediment evidence ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunSedimentFactMarkup(label, value) {
  return `
    <span class="long-run-sediment-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunSocialLoopEvidenceSummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  const invitations = numberOrUndefined(metrics.invitations) ?? 0;
  const questions = numberOrUndefined(metrics.questions) ?? 0;
  const handoffs = numberOrUndefined(metrics.handoffs) ?? 0;
  const reviews = numberOrUndefined(metrics.reviews) ?? 0;
  const silenceChoices = numberOrUndefined(metrics.silenceChoices) ?? 0;
  const derivedMissingChoiceKinds = [
    invitations > 0 ? "" : "invitation",
    questions > 0 ? "" : "question",
    reviews > 0 ? "" : "review",
    handoffs > 0 ? "" : "handoff",
    silenceChoices > 0 ? "" : "silence",
  ].filter(Boolean);
  const requiredChoiceKinds = numberOrUndefined(metrics.requiredChoiceKinds) ?? 5;
  const coveredChoiceKinds = numberOrUndefined(metrics.coveredChoiceKinds) ?? Math.max(requiredChoiceKinds - derivedMissingChoiceKinds.length, 0);
  const missingChoiceKinds = String(metrics.missingChoiceKinds ?? (derivedMissingChoiceKinds.join(",") || "none"));
  const choiceCoverageGaps = numberOrUndefined(metrics.choiceCoverageGaps) ?? derivedMissingChoiceKinds.length;
  const archivePressureChoices = numberOrUndefined(metrics.archivePressureChoices) ?? 0;
  const memoryPressureChoices = numberOrUndefined(metrics.memoryPressureChoices) ?? 0;
  const continuityPressureChoices = numberOrUndefined(metrics.continuityPressureChoices) ?? 0;
  const providerBoundaryPressureChoices = numberOrUndefined(metrics.providerBoundaryPressureChoices) ?? 0;
  const openQuestionPressureChoices = numberOrUndefined(metrics.openQuestionPressureChoices) ?? 0;
  const handoffPressureChoices = numberOrUndefined(metrics.handoffPressureChoices) ?? 0;
  const invitationPressureChoices = numberOrUndefined(metrics.invitationPressureChoices) ?? 0;
  const silenceReentryPressureChoices = numberOrUndefined(metrics.silenceReentryPressureChoices) ?? 0;
  const idleSocialPressureChoices = numberOrUndefined(metrics.idleSocialPressureChoices) ?? 0;
  const derivedMissingRoomEventPressureKinds = [
    archivePressureChoices > 0 ? "" : "archive",
    memoryPressureChoices > 0 ? "" : "memory",
    continuityPressureChoices > 0 ? "" : "continuity",
    providerBoundaryPressureChoices > 0 ? "" : "provider-boundary",
    openQuestionPressureChoices > 0 ? "" : "open-question",
    handoffPressureChoices > 0 ? "" : "handoff",
    invitationPressureChoices > 0 ? "" : "invitation",
    silenceReentryPressureChoices > 0 ? "" : "silence-reentry",
    idleSocialPressureChoices > 0 ? "" : "idle-social",
  ].filter(Boolean);
  const requiredRoomEventPressureKinds = numberOrUndefined(metrics.requiredRoomEventPressureKinds) ?? 9;
  const coveredRoomEventPressureKinds =
    numberOrUndefined(metrics.coveredRoomEventPressureKinds) ??
    Math.max(requiredRoomEventPressureKinds - derivedMissingRoomEventPressureKinds.length, 0);
  const missingRoomEventPressureKinds = String(
    metrics.missingRoomEventPressureKinds ?? (derivedMissingRoomEventPressureKinds.join(",") || "none"),
  );
  const roomEventPressureCoverageGaps =
    numberOrUndefined(metrics.roomEventPressureCoverageGaps) ?? derivedMissingRoomEventPressureKinds.length;
  return {
    ok: domain.ok === true,
    choices: numberOrUndefined(metrics.choiceCount) ?? 0,
    roomRhythmMessages: numberOrUndefined(metrics.roomRhythmMessages) ?? 0,
    invitations,
    questions,
    handoffs,
    reviews,
    silenceChoices,
    requiredChoiceKinds,
    coveredChoiceKinds,
    missingChoiceKinds,
    choiceCoverageGaps,
    requiredRoomEventPressureKinds,
    coveredRoomEventPressureKinds,
    missingRoomEventPressureKinds,
    roomEventPressureCoverageGaps,
    roomEventPressureRefs: numberOrUndefined(metrics.roomEventPressureRefs) ?? 0,
    choicesWithoutRoomEventPressureRefs: numberOrUndefined(metrics.choicesWithoutRoomEventPressureRefs) ?? 0,
    archivePressureChoices,
    memoryPressureChoices,
    continuityPressureChoices,
    providerBoundaryPressureChoices,
    openQuestionPressureChoices,
    handoffPressureChoices,
    invitationPressureChoices,
    silenceReentryPressureChoices,
    idleSocialPressureChoices,
    choiceSilenceWindows: numberOrUndefined(metrics.choiceSilenceWindows) ?? 0,
    cleanChoiceSilenceWindows: numberOrUndefined(metrics.cleanChoiceSilenceWindows) ?? 0,
    interruptedSilenceWindows: numberOrUndefined(metrics.interruptedSilenceWindows) ?? 0,
    interruptingUserMessages: numberOrUndefined(metrics.interruptingUserMessages) ?? 0,
    choicesAfterUserSilence: numberOrUndefined(metrics.choicesAfterUserSilence) ?? 0,
    interruptedChoices: numberOrUndefined(metrics.interruptedChoices) ?? 0,
    lineageGaps: numberOrUndefined(metrics.lineageGaps) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunSocialLoopEvidenceMarkup(summary) {
  const social = summary.socialLoopEvidence;
  if (!social) return "";
  const state = social.ok ? "ok" : "gap";
  const refs = social.refs.slice(0, 4);
  const title = [
    `${social.choices} autonomous choices`,
    `${social.roomRhythmMessages} room rhythm messages`,
    `${social.invitations} invitations`,
    `${social.questions} questions`,
    `${social.handoffs} handoffs`,
    `${social.reviews} reviews`,
    `${social.silenceChoices} silence choices`,
    `${social.coveredChoiceKinds}/${social.requiredChoiceKinds} required choice kinds covered`,
    `${social.missingChoiceKinds} missing choice kinds`,
    `${social.choiceCoverageGaps} choice coverage gaps`,
    `${social.coveredRoomEventPressureKinds}/${social.requiredRoomEventPressureKinds} room-event pressure kinds covered`,
    `${social.missingRoomEventPressureKinds} missing room-event pressure kinds`,
    `${social.roomEventPressureRefs} room-event pressure refs`,
    `${social.choicesWithoutRoomEventPressureRefs} choices without room-event pressure refs`,
    `${social.archivePressureChoices} archive pressure choices`,
    `${social.memoryPressureChoices} memory pressure choices`,
    `${social.continuityPressureChoices} continuity pressure choices`,
    `${social.providerBoundaryPressureChoices} provider-boundary pressure choices`,
    `${social.openQuestionPressureChoices} open-question pressure choices`,
    `${social.handoffPressureChoices} handoff pressure choices`,
    `${social.invitationPressureChoices} invitation pressure choices`,
    `${social.silenceReentryPressureChoices} silence re-entry pressure choices`,
    `${social.idleSocialPressureChoices} idle social pressure choices`,
    `${social.choiceSilenceWindows} silence windows`,
    `${social.cleanChoiceSilenceWindows} clean silence windows`,
    `${social.interruptedSilenceWindows} interrupted silence windows`,
    `${social.interruptingUserMessages} interrupting user messages`,
    `${social.choicesAfterUserSilence} choices after user silence`,
    `${social.interruptedChoices} choices interrupted by user messages`,
    `${social.lineageGaps} lineage gaps`,
  ].join(" · ");
  return `
    <div class="long-run-social-loop ${state}" aria-label="Long-run autonomous social loop" title="${escapeHtml(title)}">
      <span class="long-run-social-label">social loop</span>
      ${longRunSocialFactMarkup("choices", social.choices)}
      ${longRunSocialFactMarkup("invites", social.invitations)}
      ${longRunSocialFactMarkup("questions", social.questions)}
      ${longRunSocialFactMarkup("handoffs", social.handoffs)}
      ${longRunSocialFactMarkup("reviews", social.reviews)}
      ${longRunSocialFactMarkup("silence", social.silenceChoices)}
      ${longRunSocialFactMarkup("coverage", `${social.coveredChoiceKinds}/${social.requiredChoiceKinds}`)}
      ${longRunSocialFactMarkup("missing", social.missingChoiceKinds)}
      ${longRunSocialFactMarkup("gaps", social.choiceCoverageGaps)}
      ${longRunSocialFactMarkup("pressure", `${social.coveredRoomEventPressureKinds}/${social.requiredRoomEventPressureKinds}`)}
      ${longRunSocialFactMarkup("missing pressure", social.missingRoomEventPressureKinds)}
      ${longRunSocialFactMarkup("idle", social.idleSocialPressureChoices)}
      ${longRunSocialFactMarkup("event refs", social.roomEventPressureRefs)}
      ${longRunSocialFactMarkup("unlinked", social.choicesWithoutRoomEventPressureRefs)}
      ${longRunSocialFactMarkup("windows", social.choiceSilenceWindows)}
      ${longRunSocialFactMarkup("clean windows", social.cleanChoiceSilenceWindows)}
      ${longRunSocialFactMarkup("user interrupts", social.interruptingUserMessages)}
      ${longRunSocialFactMarkup("clean", social.choicesAfterUserSilence)}
      ${longRunSocialFactMarkup("interrupts", social.interruptedChoices)}
      ${longRunSocialFactMarkup("lineage", social.lineageGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add social loop evidence ref ${escapeHtml(
              ref,
            )}" aria-label="Add social loop evidence ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunSocialFactMarkup(label, value) {
  return `
    <span class="long-run-social-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunProviderBoundarySummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  const repairPressureRefs = numberOrUndefined(metrics.repairPressureRefs) ?? 0;
  const retryPressureRefs = numberOrUndefined(metrics.retryPressureRefs) ?? 0;
  const silencePressureRefs = numberOrUndefined(metrics.silencePressureRefs) ?? 0;
  const contestedMemoryPressureRefs = numberOrUndefined(metrics.contestedMemoryPressureRefs) ?? 0;
  const archiveCarryoverPressureRefs = numberOrUndefined(metrics.archiveCarryoverPressureRefs) ?? 0;
  const derivedMissingPressureKinds = [
    repairPressureRefs > 0 ? "" : "repair",
    retryPressureRefs > 0 ? "" : "retry",
    silencePressureRefs > 0 ? "" : "silence",
    contestedMemoryPressureRefs > 0 ? "" : "contest",
    archiveCarryoverPressureRefs > 0 ? "" : "archive",
  ].filter(Boolean);
  const requiredChoicePressureKinds = numberOrUndefined(metrics.requiredChoicePressureKinds) ?? 5;
  const coveredChoicePressureKinds =
    numberOrUndefined(metrics.coveredChoicePressureKinds) ?? Math.max(requiredChoicePressureKinds - derivedMissingPressureKinds.length, 0);
  const missingChoicePressureKinds = String(
    metrics.missingChoicePressureKinds ?? (derivedMissingPressureKinds.join(",") || "none"),
  );
  const choicePressureCoverageGaps =
    numberOrUndefined(metrics.choicePressureCoverageGaps) ?? derivedMissingPressureKinds.length;
  return {
    ok: domain.ok === true,
    degradations: numberOrUndefined(metrics.degradations) ?? 0,
    boundaryRefs: numberOrUndefined(metrics.boundaryRefs) ?? 0,
    choicePressureRefs: numberOrUndefined(metrics.choicePressureRefs) ?? 0,
    requiredChoicePressureKinds,
    coveredChoicePressureKinds,
    missingChoicePressureKinds,
    choicePressureCoverageGaps,
    repairPressureRefs,
    retryPressureRefs,
    silencePressureRefs,
    contestedMemoryPressureRefs,
    archiveCarryoverPressureRefs,
    carriedAcrossArchives: longRunMetricBoolLabel(metrics.carriedAcrossArchives),
    secretLikeDiagnostics: numberOrUndefined(metrics.secretLikeDiagnostics) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunProviderBoundaryMarkup(summary) {
  const provider = summary.providerBoundary;
  if (!provider) return "";
  const state = provider.ok ? "ok" : "gap";
  const refs = provider.refs.slice(0, 4);
  const title = [
    `${provider.degradations} provider degradations`,
    `${provider.boundaryRefs} boundary refs`,
    `${provider.choicePressureRefs} choice pressure refs`,
    `${provider.coveredChoicePressureKinds}/${provider.requiredChoicePressureKinds} pressure kinds covered`,
    `${provider.missingChoicePressureKinds} missing pressure kinds`,
    `${provider.repairPressureRefs} repair pressure refs`,
    `${provider.retryPressureRefs} retry pressure refs`,
    `${provider.silencePressureRefs} silence pressure refs`,
    `${provider.contestedMemoryPressureRefs} contested-memory pressure refs`,
    `${provider.archiveCarryoverPressureRefs} archive pressure refs`,
    `archive carryover ${provider.carriedAcrossArchives}`,
    `${provider.secretLikeDiagnostics} secret-like diagnostics`,
  ].join(" · ");
  return `
    <div class="long-run-provider-boundary ${state}" aria-label="Long-run provider boundary" title="${escapeHtml(title)}">
      <span class="long-run-provider-label">provider</span>
      ${longRunProviderFactMarkup("degraded", provider.degradations)}
      ${longRunProviderFactMarkup("boundaries", provider.boundaryRefs)}
      ${longRunProviderFactMarkup("pressure", provider.choicePressureRefs)}
      ${longRunProviderFactMarkup("coverage", `${provider.coveredChoicePressureKinds}/${provider.requiredChoicePressureKinds}`)}
      ${longRunProviderFactMarkup("missing", provider.missingChoicePressureKinds)}
      ${longRunProviderFactMarkup("repair", provider.repairPressureRefs)}
      ${longRunProviderFactMarkup("retry", provider.retryPressureRefs)}
      ${longRunProviderFactMarkup("silence", provider.silencePressureRefs)}
      ${longRunProviderFactMarkup("contest", provider.contestedMemoryPressureRefs)}
      ${longRunProviderFactMarkup("archive", provider.carriedAcrossArchives)}
      ${longRunProviderFactMarkup("secrets", provider.secretLikeDiagnostics)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add long-run provider boundary ref ${escapeHtml(
              ref,
            )}" aria-label="Add long-run provider boundary ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunProviderFactMarkup(label, value) {
  return `
    <span class="long-run-provider-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunMetricBoolLabel(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  const numeric = numberOrUndefined(value);
  if (numeric !== undefined) return numeric > 0 ? String(numeric) : "no";
  return value ? String(value) : "unknown";
}

function longRunContextVisibilitySummary(domain) {
  if (!domain) return null;
  const metrics = domain.metrics ?? {};
  return {
    ok: domain.ok === true,
    auditCount: numberOrUndefined(metrics.auditCount) ?? 0,
    coVisibleAuditCount: numberOrUndefined(metrics.coVisibleAuditCount) ?? 0,
    coVisibleDomains: numberOrUndefined(metrics.coVisibleDomains) ?? 0,
    coVisibleContextRefs: numberOrUndefined(metrics.coVisibleContextRefs) ?? 0,
    socialLineageRefs: numberOrUndefined(metrics.socialLineageRefs) ?? 0,
    criticalFragmentGaps: numberOrUndefined(metrics.criticalFragmentGaps) ?? 0,
    refs: uniqueRoomRefs(domain.evidenceRefs),
  };
}

function longRunContextVisibilityMarkup(summary) {
  const visibility = summary.contextVisibility;
  if (!visibility) return "";
  const state = visibility.ok ? "ok" : "gap";
  const refs = visibility.refs.slice(0, 4);
  const domainLabel = `${visibility.coVisibleDomains}/5`;
  const title = [
    `${visibility.auditCount} context audits`,
    `${visibility.coVisibleAuditCount} co-visible audits`,
    `${domainLabel} co-visible context domains`,
    `${visibility.coVisibleContextRefs} co-visible refs`,
    `${visibility.socialLineageRefs} social lineage refs`,
    `${visibility.criticalFragmentGaps} critical fragment gaps`,
  ].join(" · ");
  return `
    <div class="long-run-context-visibility ${state}" aria-label="Long-run context visibility" title="${escapeHtml(title)}">
      <span class="long-run-context-label">context</span>
      ${longRunContextFactMarkup("audits", visibility.auditCount)}
      ${longRunContextFactMarkup("co-visible", visibility.coVisibleAuditCount)}
      ${longRunContextFactMarkup("domains", domainLabel)}
      ${longRunContextFactMarkup("visible refs", visibility.coVisibleContextRefs)}
      ${longRunContextFactMarkup("social refs", visibility.socialLineageRefs)}
      ${longRunContextFactMarkup("critical", visibility.criticalFragmentGaps)}
      ${refs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add context visibility ref ${escapeHtml(
              ref,
            )}" aria-label="Add context visibility ref ${escapeHtml(ref)}" data-long-run-readiness-ref="${escapeHtml(
              ref,
            )}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function longRunContextFactMarkup(label, value) {
  return `
    <span class="long-run-context-fact">
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function longRunDomainLabel(domain) {
  return domain.label || domain.key || "domain";
}

function shortLongRunDomain(domain) {
  const labels = {
    duration_window: "duration",
    scheduler_continuity: "scheduler",
    workflow_drift: "workflow",
    speech_monopoly: "speech",
    autonomy_rhythm_balance: "rhythm",
    long_term_rhythm: "long rhythm",
    silence_reentry: "silence",
    archive_rhythm: "archive",
    autonomous_social_loop: "social loop",
    memory_contest: "memory",
    agent_continuity: "continuity",
    action_boundary: "actions",
    evidence_sediment: "sediment",
    provider_boundary: "provider",
    context_visibility: "context",
  };
  return labels[domain.key] ?? longRunDomainLabel(domain);
}

function longRunCheckedLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function longRunFreshnessLabel(freshness) {
  if (!freshness || typeof freshness !== "object") return "";
  const staleAfterMs = Number(freshness.staleAfterMs);
  const ageMs = Number(freshness.ageMs);
  if (!Number.isFinite(ageMs) || !Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
    return freshness.status === "stale" ? "stale" : "";
  }
  const ageHours = Math.max(0, Math.round(ageMs / (60 * 60 * 1000)));
  const staleAfterHours = Math.max(1, Math.round(staleAfterMs / (60 * 60 * 1000)));
  return freshness.status === "stale"
    ? `stale ${ageHours}h/${staleAfterHours}h`
    : `fresh ${ageHours}h/${staleAfterHours}h`;
}

function providerBoundaryPreviewCandidate(overview = providerBoundaryOverviewSummary()) {
  const boundary = overview.boundary;
  if (!boundary) return null;
  const isStale = providerBoundaryIsStale(boundary);
  const status = providerBoundaryStatusLabel(boundary, isStale);
  const providerLabel = boundary.providerLabel ?? boundary.providerKind ?? "provider";
  const choiceSummary = providerBoundaryChoicePressureSummary(boundary.choicePressure);
  const pressureRefCount = providerBoundaryChoicePressureRefs(boundary.choicePressure).length;
  const evidenceRefs = providerBoundaryEvidenceRefs(boundary);
  const detail = [
    providerLabel,
    status,
    choiceSummary,
    pressureRefCount > 0 ? `${pressureRefCount} pressure refs` : "",
    `${evidenceRefs.length} evidence refs`,
    boundary.boundaryNote || "runtime availability evidence",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    boundary,
    evidenceRefs,
    title: `${boundary.agentId ?? "provider"} · ${status}`,
    detail,
    ref: evidenceRefs[0] ?? boundary.boundaryId,
  };
}

function providerBoundaryOverviewPressureSummary(overview = providerBoundaryOverviewSummary()) {
  const choicePressure = overview.boundary?.choicePressure;
  const refs = providerBoundaryChoicePressureRefs(choicePressure);
  return {
    activeCount: overview.activeCount,
    totalCount: overview.totalCount,
    traceCount: providerBoundaryChoicePressureTraceCount(choicePressure),
    repairCount: safeLength(choicePressure?.repairRequestRefs),
    deniedCount: safeLength(choicePressure?.deniedRepairRequestRefs),
    retryCount: safeLength(choicePressure?.retryProtocolRefs),
    silenceCount: safeLength(choicePressure?.silenceRefs),
    memoryContestCount: safeLength(choicePressure?.contestedMemoryRefs),
    archiveCount: safeLength(choicePressure?.archiveCarryoverRefs),
    agentCount: safeLength(choicePressure?.choiceAgentIds),
    refs,
  };
}

function providerBoundaryOverviewPressureMarkup(summary) {
  if (summary.totalCount === 0) {
    return "";
  }
  return `
    <div class="provider-overview-pressure" aria-label="Provider boundary pressure summary">
      <span class="provider-overview-label">boundary pressure</span>
      ${providerBoundaryOverviewFactMarkup("active", `${summary.activeCount}/${summary.totalCount}`)}
      ${providerBoundaryOverviewFactMarkup("traces", summary.traceCount)}
      ${providerBoundaryOverviewFactMarkup("repair", summary.repairCount)}
      ${providerBoundaryOverviewFactMarkup("denied", summary.deniedCount)}
      ${providerBoundaryOverviewFactMarkup("retry", summary.retryCount)}
      ${providerBoundaryOverviewFactMarkup("silence", summary.silenceCount)}
      ${providerBoundaryOverviewFactMarkup("memory contest", summary.memoryContestCount)}
      ${providerBoundaryOverviewFactMarkup("archives", summary.archiveCount)}
      ${providerBoundaryOverviewFactMarkup("agents", summary.agentCount)}
      ${providerBoundaryOverviewRefsMarkup(summary.refs)}
    </div>
  `;
}

function providerBoundaryOverviewFactMarkup(label, value) {
  return `<span class="provider-overview-fact"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span>`;
}

function providerBoundaryOverviewRefsMarkup(refs) {
  const visibleRefs = uniqueRoomRefs(refs).slice(0, 3);
  if (visibleRefs.length === 0) {
    return "";
  }
  return `<span class="provider-overview-refs">${visibleRefs
    .map(
      (ref) =>
        `<button class="overview-ref-button compact" type="button" title="Add provider boundary pressure ref ${escapeHtml(
          ref,
        )}" aria-label="Add provider boundary pressure ref ${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
    )
    .join("")}</span>`;
}

function providerBoundaryEvidenceRefs(boundary) {
  return uniqueRoomRefs([
    boundary.boundaryId,
    ...(boundary.sourceRefs ?? []),
  ]);
}

function overviewPreviewMarkup({ title, detail, ref }) {
  return `
    <p class="overview-title">${escapeHtml(title)}</p>
    <p class="overview-detail">${escapeHtml(detail || "No detail recorded.")}</p>
    ${ref ? `<button class="overview-ref-button" type="button" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>` : ""}
  `;
}

function overviewEmptyMarkup(label) {
  return `<p class="overview-detail overview-empty">${escapeHtml(label)}</p>`;
}

function memoryContestClaims() {
  const claims = Array.isArray(room.socialState?.memoryClaims) ? room.socialState.memoryClaims : [];
  return claims.filter((claim) => claim.state === "contested");
}

function memoryReviewableClaims() {
  const claims = Array.isArray(room.socialState?.memoryClaims) ? room.socialState.memoryClaims : [];
  return claims.filter((claim) => ["proposed", "contested", "stale"].includes(claim.state ?? ""));
}

function agentContinuityCountValue() {
  const personas = Array.isArray(room.socialState?.personas) ? room.socialState.personas : [];
  return personas.reduce(
    (sum, persona) =>
      sum + (persona.evolutionLog?.length ?? 0) + (persona.roleClaims?.length ?? 0) + (persona.dailyMoodRecord ? 1 : 0),
    0,
  );
}

function firstRoomRef(refs) {
  return Array.isArray(refs) ? refs.find((ref) => typeof ref === "string" && ref.length > 0) ?? null : null;
}

function timelineCategoryLabel(category) {
  const labels = {
    message: "msg",
    room_rhythm: "rhythm",
    archive: "archive",
    memory: "memory",
    memory_contest: "contest",
    agent_continuity: "continuity",
    provider_boundary: "provider",
    social_loop: "social",
    boundary: "boundary",
  };
  return labels[category] ?? category;
}

function cssToken(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function renderMessages() {
  const chatMessages = chatStreamMessages(room.messages);
  const shouldStickToBottom = forceScrollOnNextRender || isNearBottom() || previousMessageCount === 0;
  const hadNewMessages = chatMessages.length > previousMessageCount;
  messageList.replaceChildren();

  if (!room.connected) {
    newMessageJump.hidden = true;
    const empty = document.createElement("section");
    empty.className = "empty-state";
    empty.innerHTML = `
      <strong>等待内部 room runtime</strong>
      <p>启动 <code>npm run serve:web</code> 后，这里会显示真实房间消息。</p>
    `;
    messageList.append(empty);
    previousMessageCount = chatMessages.length;
    return;
  }

  if (chatMessages.length === 0) {
    newMessageJump.hidden = true;
    const empty = document.createElement("section");
    empty.className = "empty-state";
    empty.innerHTML = `
      <strong>房间已准备好</strong>
      <p>发送第一条消息后，agent 的自然回应会出现在这里。</p>
    `;
    messageList.append(empty);
    previousMessageCount = chatMessages.length;
    return;
  }

  let activeDate = "";
  for (const message of chatMessages) {
    if (message.date !== activeDate) {
      activeDate = message.date;
      const divider = document.createElement("div");
      divider.className = "date-divider";
      divider.textContent = activeDate;
      messageList.append(divider);
    }

    const item = document.createElement("article");
    item.className = `message-row ${message.kind}${message.pending ? " pending" : ""}${
      selectedContextRefs.has(message.eventId) ? " context-selected" : ""
    }${openMessageActionRef === message.eventId ? " actions-open" : ""}`;
    item.innerHTML = `
      <div class="avatar" aria-hidden="true">${agentAvatarMarkup(message.author, message.initials)}</div>
        <div class="message-body">
          <div class="message-meta">
            <span class="message-author">${escapeHtml(message.displayName ?? message.author)}</span>
            <span>${escapeHtml(message.time)}</span>
            ${message.pending ? `<span>sending</span>` : ""}
          </div>
        <div class="message-card">
          <div class="message-actions" aria-label="Message actions">
            <button type="button" class="message-action-trigger" title="Message actions" aria-label="Message actions for ${escapeHtml(message.eventId)}" aria-expanded="${openMessageActionRef === message.eventId ? "true" : "false"}" data-message-action="more" data-message-more-ref="${escapeHtml(message.eventId)}" data-message-ref="${escapeHtml(message.eventId)}">···</button>
          </div>
          <div class="message-text ${isLongMessage(message.text) ? "scrollable" : ""}">
            <p>${escapeHtml(message.text)}</p>
          </div>
          ${isLongMessage(message.text) ? `<div class="long-message-hint">内容较长，可在气泡内滚动</div>` : ""}
          ${selectedContextRefs.has(message.eventId) ? `<span class="message-context-marker">已引用</span>` : ""}
          ${openMessageActionRef === message.eventId ? messageActionMenuMarkup(message) : ""}
        </div>
      </div>
    `;
    messageList.append(item);
  }
  if (shouldStickToBottom) {
    scrollToLatestMessage();
  } else if (hadNewMessages) {
    newMessageJump.hidden = false;
  }
  previousMessageCount = chatMessages.length;
  forceScrollOnNextRender = false;
}

function chatStreamMessages(messages) {
  return (Array.isArray(messages) ? messages : []).filter(isChatStreamMessage);
}

function isChatStreamMessage(message) {
  const authorKind = message?.authorKind ?? message?.kind;
  return authorKind === "user" || authorKind === "agent";
}

function openMentionPopover(query) {
  mentionQuery = query.toLowerCase();
  mentionActiveIndex = 0;
  mentionPopover.hidden = false;
  mentionButton.setAttribute("aria-expanded", "true");
  messageInput.setAttribute("aria-controls", "mentionPopover");
  messageInput.setAttribute("aria-expanded", "true");
  renderMentionPopover();
}

function closeMentionPopover() {
  mentionPopover.hidden = true;
  mentionButton.setAttribute("aria-expanded", "false");
  messageInput.setAttribute("aria-expanded", "false");
  messageInput.removeAttribute("aria-activedescendant");
  mentionQuery = "";
  mentionActiveIndex = 0;
}

function renderMentionPopover() {
  mentionPopover.replaceChildren();
  const agents = currentMentionOptions();

  if (agents.length === 0) {
    messageInput.removeAttribute("aria-activedescendant");
    const empty = document.createElement("div");
    empty.className = "mention-empty";
    empty.textContent = "没有匹配的 agent";
    mentionPopover.append(empty);
    return;
  }

  mentionActiveIndex = clampMentionActiveIndex(mentionActiveIndex, agents.length);
  for (const [index, agent] of agents.entries()) {
    const option = document.createElement("button");
    const optionId = `mention-option-${agent.id}`;
    option.type = "button";
    option.className = "mention-option";
    option.id = optionId;
    option.dataset.agentId = agent.id;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", index === mentionActiveIndex ? "true" : "false");
    option.innerHTML = `
      <span class="mention-avatar" aria-hidden="true">${agentAvatarMarkup(agent.id, agent.initials)}</span>
      <span class="mention-copy">
        <strong>${escapeHtml(agent.name)}</strong>
        <span>@${escapeHtml(agent.id)} · ${escapeHtml(agentPosture(agent))}</span>
      </span>
      <span class="mention-mode">${escapeHtml(agent.mode ?? "seed")}</span>
    `;
    option.addEventListener("mouseenter", () => setMentionActiveIndex(index));
    option.addEventListener("click", () => insertMention(agent.id));
    mentionPopover.append(option);
  }
  renderMentionActiveState();
}

function handleMentionKeydown(event) {
  if (mentionPopover.hidden || event.isComposing) {
    return false;
  }

  const agents = currentMentionOptions();
  if (event.key === "Escape") {
    event.preventDefault();
    closeMentionPopover();
    return true;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (agents.length > 0) {
      setMentionActiveIndex(mentionActiveIndex + 1);
    }
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (agents.length > 0) {
      setMentionActiveIndex(mentionActiveIndex - 1);
    }
    return true;
  }
  if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
    if (agents.length === 0) {
      event.preventDefault();
      composerState.textContent = "没有匹配的 agent";
      return true;
    }
    event.preventDefault();
    insertMention(agents[clampMentionActiveIndex(mentionActiveIndex, agents.length)].id);
    return true;
  }
  return false;
}

function currentMentionOptions() {
  return room.agents.filter((agent) => {
    const posture = agentPosture(agent);
    const haystack = `${agent.id} ${agent.name} ${posture}`.toLowerCase();
    return mentionQuery.length === 0 || haystack.includes(mentionQuery);
  });
}

function setMentionActiveIndex(index) {
  const agents = currentMentionOptions();
  if (agents.length === 0) {
    mentionActiveIndex = 0;
    renderMentionActiveState();
    return;
  }
  mentionActiveIndex = ((index % agents.length) + agents.length) % agents.length;
  renderMentionActiveState();
}

function clampMentionActiveIndex(index, length) {
  if (length <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), length - 1);
}

function renderMentionActiveState() {
  const options = [...mentionPopover.querySelectorAll(".mention-option")];
  options.forEach((option, index) => {
    const active = index === mentionActiveIndex;
    option.classList.toggle("active", active);
    option.setAttribute("aria-selected", active ? "true" : "false");
    if (active) {
      messageInput.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    }
  });
}

function insertMention(agentId) {
  const cursor = messageInput.selectionStart ?? messageInput.value.length;
  const value = messageInput.value;
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const active = before.match(/@([A-Za-z0-9_-]*)$/);
  let nextValue;
  let nextCursor;

  if (active) {
    const start = cursor - active[0].length;
    const replacement = `@${agentId} `;
    nextValue = `${value.slice(0, start)}${replacement}${after}`;
    nextCursor = start + replacement.length;
  } else {
    const spacer = before.length === 0 || /\s$/.test(before) ? "" : " ";
    const replacement = `${spacer}@${agentId} `;
    nextValue = `${before}${replacement}${after}`;
    nextCursor = before.length + replacement.length;
  }

  messageInput.value = nextValue;
  messageInput.setSelectionRange(nextCursor, nextCursor);
  selectedMentions.add(agentId);
  syncMentionStateFromText();
  closeMentionPopover();
  syncComposer();
  messageInput.focus();
}

function activeMentionQuery() {
  const cursor = messageInput.selectionStart ?? messageInput.value.length;
  const before = messageInput.value.slice(0, cursor);
  const active = before.match(/@([A-Za-z0-9_-]*)$/);
  return active ? active[1] : null;
}

function syncMentionStateFromText() {
  selectedMentions = new Set(extractKnownMentions(messageInput.value));
  renderMentionTray();
}

function extractKnownMentions(text) {
  const knownAgents = new Set(room.agents.map((agent) => agent.id));
  const mentions = new Set();
  for (const match of String(text).matchAll(/@([A-Za-z0-9_-]+)/g)) {
    if (knownAgents.has(match[1])) {
      mentions.add(match[1]);
    }
  }
  return Array.from(mentions);
}

function renderMentionTray() {
  mentionTray.replaceChildren();
  if (selectedMentions.size === 0) {
    mentionTray.hidden = true;
    return;
  }

  mentionTray.hidden = false;
  for (const agentId of selectedMentions) {
    const agent = room.agents.find((item) => item.id === agentId);
    const chip = document.createElement("span");
    chip.className = "mention-chip";
    chip.textContent = `@${agent?.name ?? agentId}`;
    mentionTray.append(chip);
  }
}

function renderContextTray() {
  contextTray.replaceChildren();
  if (selectedContextRefs.size === 0) {
    contextTray.hidden = true;
    return;
  }

  contextTray.hidden = false;
  for (const ref of selectedContextRefs) {
    const descriptor = contextRefDescriptor(ref);
    const chip = document.createElement("span");
    chip.className = `context-chip ${descriptor.className}`;
    chip.title = descriptor.title;
    chip.setAttribute("aria-label", `Selected context ${descriptor.title}`);
    chip.innerHTML = `
      <span class="context-chip-type">${escapeHtml(descriptor.type)}</span>
      <span class="context-chip-label">${escapeHtml(descriptor.label)}</span>
      <span class="context-chip-ref">${escapeHtml(shortRef(ref))}</span>
      <button type="button" aria-label="Remove context ${escapeHtml(ref)}" data-remove-context-ref="${escapeHtml(ref)}">×</button>
    `;
    contextTray.append(chip);
  }
}

function contextRefDescriptor(ref) {
  const autonomyTick = findAutonomyTick(ref);
  if (autonomyTick) {
    return {
      type: "room rhythm",
      label: [
        roomRhythmActionLabel(autonomyTick.action),
        autonomyTick.status,
        roomRhythmChoiceCountLabel(autonomyTick),
        `${roomRhythmDecisionRefs(autonomyTick).length} decision refs`,
        autonomyTick.reason,
      ]
        .filter(Boolean)
        .join(" · "),
      className: "rhythm-context",
      title: `room rhythm ${ref}: ledgered autonomous decision evidence; it may invite review or preserve silence, but it does not force speech, assign work, or make memory true.`,
    };
  }
  const topicProposal = findById(room.socialState?.topicProposals, "proposalId", ref);
  if (topicProposal) {
    return {
      type: "topic proposal",
      label: [
        topicProposal.status,
        topicProposal.action,
        topicProposal.sourcePressureRefs?.length ? `${topicProposal.sourcePressureRefs.length} pressure refs` : "",
        topicProposal.title,
      ]
        .filter(Boolean)
        .join(" · "),
      className: "topic-context",
      title: `topic proposal ${ref}: ${topicProposal.status ?? "proposed"}${
        topicProposal.action ? ` ${topicProposal.action}` : ""
      }. Applying this ref is visible topic movement, not hidden routing.`,
    };
  }
  const mixedPressure = findById(room.socialState?.mixedReviewPressures, "pressureId", ref);
  if (mixedPressure) {
    return {
      type: "pressure",
      label: [
        "unresolved room pressure",
        `${mixedPressureObjectCount(mixedPressure)} objects`,
        responseKindSummary(mixedPressure.responseKindCounts),
        `${(mixedPressure.reviewEventIds ?? []).length} traces`,
      ]
        .filter(Boolean)
        .join(" · "),
      className: "pressure-context",
      title: `unresolved room pressure ${ref}: projection only; individual review traces remain ledgered and no lifecycle state changes are inferred.`,
    };
  }
  if (ref.startsWith("mixed_review:")) {
    return {
      type: "pressure",
      label: "unresolved room pressure · projection ref",
      className: "pressure-context",
      title: `unresolved room pressure ${ref}: carried pressure ref; the room may revisit it without treating it as a task, decision, or workflow.`,
    };
  }
  const openQuestion = findById(room.socialState?.openQuestions, "questionId", ref);
  if (openQuestion) {
    return {
      type: "open question",
      label: [
        "unresolved room question",
        openQuestion.responseCount ? `${openQuestion.responseCount} responses` : "",
        openQuestion.refinedCount ? `${openQuestion.refinedCount} refinements` : "",
        openQuestion.sourcePressureRefs?.length ? `${openQuestion.sourcePressureRefs.length} pressure refs` : "",
        openQuestion.question,
      ]
        .filter(Boolean)
        .join(" · "),
      className: "question-context",
      title: `open question ${ref}: unresolved room context, not a task assignment, consensus claim, or demand for immediate answer.`,
    };
  }
  const memoryClaim = findMemoryClaim(ref);
  if (memoryClaim) {
    return memoryContextDescriptor(memoryClaim, ref, "memory");
  }
  const personaDelta = findPersonaDelta(ref);
  if (personaDelta) {
    return {
      type: "continuity",
      label: [
        personaDelta.displayName ?? personaDelta.agentId,
        personaFieldLabel(personaDelta.field),
        personaDelta.status,
        personaDelta.value,
      ]
        .filter(Boolean)
        .join(" · "),
      className: "continuity-context",
      title: `persona delta ${ref}: room-visible continuity sediment, not a fixed job, role assignment, or public-memory truth.`,
    };
  }
  const roleClaim = findPersonaRoleClaim(ref);
  if (roleClaim) {
    return {
      type: "continuity",
      label: [
        roleClaim.displayName ?? roleClaim.agentId,
        "role claim",
        roleClaim.claim.status,
        roleClaim.claim.label,
      ]
        .filter(Boolean)
        .join(" · "),
      className: "continuity-context",
      title: `role claim ${roleClaim.claim.roleClaimId}: ledger-derived and contestable; not a fixed room assignment.`,
    };
  }
  const dailyMood = findPersonaDailyMoodByEvidenceRef(ref);
  if (dailyMood) {
    return {
      type: "continuity",
      label: [dailyMood.displayName ?? dailyMood.agentId, "daily mood", dailyMood.mood.posture, dailyMood.mood.date]
        .filter(Boolean)
        .join(" · "),
      className: "continuity-context",
      title: `daily mood evidence ${ref}: reversible continuity hint, not a durable role, duty, or public-memory truth.`,
    };
  }
  const protocol = findById(room.socialState?.protocols, "protocolId", ref);
  if (protocol) {
    return {
      type: "protocol",
      label: [protocol.status, protocol.scope, protocolLifetimeLabel(protocol), protocol.summary].filter(Boolean).join(" · "),
      className: "protocol-context",
      title: `protocol ${ref}: ${protocol.status ?? "unknown"} in ${protocol.scope ?? "unknown scope"}; ${protocolLifetimeLabel(
        protocol,
      )}; temporary room etiquette, not command flow.`,
    };
  }
  const archive = findById(room.socialState?.archives, "archiveId", ref);
  if (archive) {
    return {
      type: "archive",
      label: [archive.revisionOf ? "revision" : "daily", archive.date, archive.summary].filter(Boolean).join(" · "),
      className: "archive-context",
      title: `archive ${ref}: compressed time skeleton, not consensus.`,
    };
  }
  const archiveReview = findById(room.socialState?.archiveReviews, "id", ref);
  if (archiveReview) {
    const kindLabel = archiveReviewKindLabel(archiveReview.kind);
    const rhythmLabel = archiveReview.kind === "review_request" ? "daily rhythm invitation" : "";
    return {
      type: "archive review",
      label: [
        kindLabel,
        rhythmLabel,
        archiveReview.status,
        archiveReview.archiveRef ? `for ${shortRef(archiveReview.archiveRef)}` : "",
        archiveReview.agentId ? `by ${archiveReview.agentId}` : "",
        archiveReview.summary || archiveReview.reason,
      ]
        .filter(Boolean)
        .join(" · "),
      className: "archive-review-context",
      title:
        archiveReview.kind === "review_request"
          ? `archive review request ${ref}: daily rhythm invitation, not a command to speak, consensus request, or archive mutation.`
          : `archive review ${ref}: room-visible critique or repair pressure, not archive mutation or consensus.`,
    };
  }
  const handoff = findById(room.socialState?.handoffs, "handoffId", ref);
  if (handoff) {
    return {
      type: "handoff",
      label: [
        handoff.status,
        handoffDirectionLabel(handoff),
        `${handoff.responseCount ?? 0} responses`,
        latestHandoffResponseLabel(handoff),
        handoff.requestedResponse ? `requested ${handoff.requestedResponse}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      className: "handoff-context",
      title: `handoff ${ref}: ${handoffBoundaryLabel(handoff)}; social proposal, not function call or control transfer.`,
    };
  }
  const invitation = findById(room.socialState?.invitations, "invitationId", ref);
  if (invitation) {
    const lineageLabel = invitation.delegatedFromInvitationRef
      ? `delegated from ${shortRef(invitation.delegatedFromInvitationRef)}`
      : "";
    return {
      type: "invitation",
      label: [
        "social knock",
        invitation.status,
        `${invitation.fromAgentId ?? "agent"} -> ${invitation.toAgentId ?? "agent"}`,
        lineageLabel,
        invitation.responseCount ? `${invitation.responseCount} responses` : "",
        invitation.reason,
      ]
        .filter(Boolean)
        .join(" · "),
      className: "invitation-context",
      title: `invitation ${ref}: social knock, not a speaking command, task assignment, or control flow.`,
    };
  }
  const providerBoundary = findProviderBoundary(ref);
  if (providerBoundary) {
    return providerBoundaryContextDescriptor(providerBoundary, ref, "provider boundary");
  }
  const memoryEvidenceClaim = findMemoryClaimByEvidenceRef(ref);
  if (memoryEvidenceClaim) {
    return memoryContextDescriptor(memoryEvidenceClaim, ref, "memory evidence");
  }
  const message = messageByEventId(ref);
  if (message) {
    return {
      type: "message",
      label: [message.displayName, message.text].filter(Boolean).join(" · "),
      className: "message-context",
      title: `message ${ref}`,
    };
  }
  const providerBoundaryEvidence = findProviderBoundaryByEvidenceRef(ref);
  if (providerBoundaryEvidence) {
    return providerBoundaryContextDescriptor(providerBoundaryEvidence, ref, "provider boundary evidence");
  }
  return {
    type: "ref",
    label: shortRef(ref),
    className: "generic-context",
    title: `context ref ${ref}`,
  };
}

function providerBoundaryContextDescriptor(providerBoundary, ref, prefix) {
  const providerLabel = providerBoundary.providerLabel ?? providerBoundary.providerKind ?? "provider";
  return {
    type: "provider boundary",
    label: [
      providerBoundary.agentId ?? "agent",
      providerLabel,
      providerBoundaryAgeLabel(providerBoundary),
      "runtime availability",
    ]
      .filter(Boolean)
      .join(" · "),
    className: "provider-context",
    title: `${prefix} ${ref}: runtime availability signal, not agent silence, personality, or responsibility assignment.`,
  };
}

function memoryContextDescriptor(memoryClaim, ref, prefix) {
  const revisionLabel = memoryClaim.revisedFromMemoryRef
    ? `revises ${shortRef(memoryClaim.revisedFromMemoryRef)} · fresh proposal`
    : "";
  return {
    type: "memory",
    label: [
      memoryClaim.state,
      revisionLabel,
      memoryClaim.contestedBy?.length ? `${memoryClaim.contestedBy.length} contested` : "",
      `${memoryClaim.transitionCount ?? 0} transitions`,
      memoryClaim.summary,
    ]
      .filter(Boolean)
      .join(" · "),
    className: "memory-context",
    title: `${prefix} ${ref}: ${memoryClaim.state ?? "unknown"}; ${
      memoryClaim.revisedFromMemoryRef
        ? `fresh proposal revising ${memoryClaim.revisedFromMemoryRef}; previous memory is unchanged.`
        : memoryClaim.provisionalNote ?? "room memory is provisional sediment, not truth"
    }.`,
  };
}

function latestHandoffResponseLabel(handoff) {
  const responses = Array.isArray(handoff.responses) ? handoff.responses : [];
  const latest = responses[responses.length - 1];
  if (!latest) {
    return "";
  }
  return `${latest.byAgentId || "agent"} ${latest.response || "responded"}`;
}

function messageMentionsMarkup(mentions) {
  if (!Array.isArray(mentions) || mentions.length === 0) {
    return "";
  }
  return `<span class="message-mentions">${mentions
    .map((mention) => `<span>@${escapeHtml(displayNameForMention(mention))}</span>`)
    .join("")}</span>`;
}

function messageContextRefsMarkup(contextRefs) {
  if (!Array.isArray(contextRefs) || contextRefs.length === 0) {
    return "";
  }
  return `<span class="message-context-refs">${contextRefs
    .slice(0, 4)
    .map((ref) => `<span>${escapeHtml(shortRef(ref))}</span>`)
    .join("")}</span>`;
}

function messageActionMenuMarkup(message) {
  const contextSelected = selectedContextRefs.has(message.eventId);
  return `
    <div class="message-overflow-menu" role="menu" aria-label="Actions for ${escapeHtml(message.eventId)}">
      <button type="button" role="menuitem" data-message-menu-action="context" data-message-ref="${escapeHtml(message.eventId)}">${contextSelected ? "移出上下文" : "加入上下文"}</button>
      <button type="button" role="menuitem" data-message-menu-action="reply" data-message-ref="${escapeHtml(message.eventId)}">回复</button>
      <div class="message-menu-separator" aria-hidden="true"></div>
      <button type="button" role="menuitem" data-message-menu-action="copy-ref" data-message-ref="${escapeHtml(message.eventId)}">复制 ref</button>
      <button type="button" role="menuitem" data-message-menu-action="copy-text" data-message-ref="${escapeHtml(message.eventId)}">复制文本</button>
      <button type="button" role="menuitem" data-message-menu-action="inspect" data-message-ref="${escapeHtml(message.eventId)}">显示 ref</button>
    </div>
  `;
}

function toggleMessageActionMenu(ref) {
  openMessageActionRef = openMessageActionRef === ref ? null : ref;
  if (openMessageActionRef !== null) {
    newMessageJump.hidden = true;
  }
  renderMessages();
}

function closeMessageActionMenu() {
  if (openMessageActionRef === null) {
    return;
  }
  openMessageActionRef = null;
  renderMessages();
}

function messageByEventId(ref) {
  return room.messages.find((message) => message.eventId === ref) ?? null;
}

function findAutonomyTick(ref) {
  const ticks = Array.isArray(room.socialState?.autonomyTicks) ? room.socialState.autonomyTicks : [];
  return ticks.find((tick) => tick.tickId === ref) ?? null;
}

async function copyTextToClipboard(text, successMessage) {
  try {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.setAttribute("readonly", "true");
      scratch.style.position = "fixed";
      scratch.style.opacity = "0";
      document.body.append(scratch);
      scratch.focus();
      scratch.select();
      copied = document.execCommand("copy");
      scratch.remove();
    }
    if (!copied) {
      throw new Error("clipboard unavailable");
    }
    composerState.textContent = successMessage;
  } catch (error) {
    composerState.textContent = `复制失败：${error instanceof Error ? error.message : String(error)}`;
  }
}

function displayNameForMention(agentId) {
  return room.agents.find((agent) => agent.id === agentId)?.name ?? agentId;
}

function agentPosture(agent) {
  return agent.posture ?? "";
}

function agentModeBoundary(agent) {
  const mode = agent.mode ?? "seed";
  const status = agent.status ?? "unknown";
  if (mode === "live") {
    return `mode=live means provider-backed cognition is available; status=${status} is readiness, not a command to speak.`;
  }
  if (mode === "degraded" || status === "degraded") {
    return "mode=degraded is a provider boundary. Treat it as runtime availability, not agent silence or personality.";
  }
  if (mode === "offline") {
    return "mode=offline means the provider is unavailable; the room may still discuss the boundary without inventing agent intent.";
  }
  if (mode === "smoke_ready") {
    return "mode=smoke_ready means the provider check passed, but this turn may still use seed or live behavior separately.";
  }
  return "mode=seed means deterministic room behavior is in use; provider readiness does not imply live participation.";
}

function currentPersonaForAgent(agentId) {
  return (room.socialState?.personas ?? []).find((persona) => persona.agentId === agentId) ?? null;
}

function currentDailyMoodForAgent(agentId) {
  return currentPersonaForAgent(agentId)?.dailyMoodRecord ?? null;
}

function personaDailyMoodLabel(persona) {
  const record = persona?.dailyMoodRecord;
  if (record?.posture) {
    return `${record.posture}${record.date ? ` · ${record.date}` : ""}`;
  }
  return persona?.dailyMood ?? "";
}

function agentDailyMoodMarkup(agent) {
  const mood = currentDailyMoodForAgent(agent.id);
  if (!mood?.posture) {
    return "";
  }
  const moodEvidenceRefs = uniqueRoomRefs([mood.sourceRef, ...(mood.evidenceRefs ?? []), ...(mood.responseRefs ?? [])]);
  const source = moodEvidenceRefs.length > 0
    ? `<span class="agent-continuity-source">refs ${agentContinuityRefButtonsMarkup(moodEvidenceRefs, "daily mood evidence refs")}</span>`
    : "";
  return `
    <p class="agent-daily-mood">
      <span>daily mood</span>
      ${escapeHtml(mood.posture)}${escapeHtml(mood.date ? ` · ${mood.date}` : "")}${source}
    </p>
    <p class="agent-mode-boundary">${escapeHtml(mood.boundaryNote ?? "Daily mood is reversible continuity, not a fixed room role.")}</p>
  `;
}

function agentRoleClaimsMarkup(agent) {
  const persona = currentPersonaForAgent(agent.id);
  const claims = Array.isArray(persona?.roleClaims) ? persona.roleClaims.slice(0, 2) : [];
  if (claims.length === 0) {
    return "";
  }
  return `
    <div class="agent-role-claims" aria-label="Agent role claim evidence">
      ${claims
        .map((claim) => {
          const refs = uniqueRoomRefs([
            claim.roleClaimId,
            ...(claim.evidenceRefs ?? []),
            ...(claim.responseRefs ?? []),
            ...(claim.contestRefs ?? []),
            ...(claim.sourcePressureRefs ?? []),
          ]);
          return `
            <div class="agent-role-claim">
              <span>${escapeHtml(claim.label || claim.roleClaimId)} · ${escapeHtml(claim.status || "proposed")}</span>
              ${agentContinuityRefButtonsMarkup(refs, "role claim evidence refs")}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function agentContinuityRefButtonsMarkup(refs, label = "continuity evidence refs") {
  const evidenceRefs = uniqueRoomRefs(refs ?? []).slice(0, 6);
  if (evidenceRefs.length === 0) {
    return `<span class="agent-continuity-refs empty">no ${escapeHtml(label)}</span>`;
  }
  return `
    <span class="agent-continuity-refs" aria-label="${escapeHtml(label)}">
      ${evidenceRefs
        .map(
          (ref) =>
            `<button class="agent-continuity-ref-button" type="button" title="Add ${escapeHtml(label)} ${escapeHtml(
              ref,
            )}" aria-label="Add ${escapeHtml(label)} ${escapeHtml(ref)}" data-agent-continuity-ref="${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </span>
  `;
}

function latestProviderBoundaryForAgent(agentId) {
  const boundaries = Array.isArray(room.socialState?.providerBoundaries)
    ? room.socialState.providerBoundaries
    : [];
  return boundaries.find((boundary) => boundary.agentId === agentId) ?? null;
}

function agentProviderBoundaryMarkup(agent) {
  const boundary = latestProviderBoundaryForAgent(agent.id);
  if (!boundary) {
    return "";
  }
  const isCurrentBoundary = agent.mode === "degraded" || agent.status === "degraded";
  const label = isCurrentBoundary ? "Current provider boundary" : "Latest provider boundary record";
  const detail = [
    boundary.providerLabel ?? boundary.providerKind ?? "provider",
    boundary.triggeringEventId ? `trigger ${shortRef(boundary.triggeringEventId)}` : "",
    boundary.packetId ? `packet ${shortRef(boundary.packetId)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <div class="agent-provider-boundary ${isCurrentBoundary ? "active" : "historical"}">
      <div>
        <p>${escapeHtml(label)}</p>
        <span>${escapeHtml(detail || boundary.boundaryNote || "provider boundary available")}</span>
      </div>
      <button class="social-repair-button" type="button" title="Ask room to discuss provider boundary repair" aria-label="Ask repair for provider boundary ${escapeHtml(boundary.boundaryId)}" data-provider-boundary-repair-ref="${escapeHtml(boundary.boundaryId)}">↻</button>
      <button class="social-context-button" type="button" title="Add provider boundary context ref" aria-label="Add provider boundary context ref ${escapeHtml(boundary.boundaryId)}" data-social-context-ref="${escapeHtml(boundary.boundaryId)}">#</button>
    </div>
  `;
}

function describeWakeTargets(agentIds) {
  if (!Array.isArray(agentIds) || agentIds.length === 0) {
    return "等待 agent 回应...";
  }

  if (agentIds.length >= room.agents.length && room.agents.length > 0) {
    return "正在唤醒所有 agent...";
  }

  return `正在唤醒：${agentIds.map(displayNameForMention).join(", ")}`;
}

function addContextRef(ref) {
  if (!ref) {
    return;
  }
  selectedContextRefs.add(ref);
  renderContextTray();
  renderMessages();
  syncComposer();
  composerState.textContent = `已加入 ${contextRefDescriptor(ref).type} context · ${shortRef(ref)}`;
}

function toggleContextRef(ref) {
  if (selectedContextRefs.has(ref)) {
    selectedContextRefs.delete(ref);
    composerState.textContent = `已移除 ${contextRefDescriptor(ref).type} context · ${shortRef(ref)}`;
  } else {
    selectedContextRefs.add(ref);
    composerState.textContent = `已加入 ${contextRefDescriptor(ref).type} context · ${shortRef(ref)}`;
  }
  renderContextTray();
  renderMessages();
  syncComposer();
}

function replyToMessage(ref) {
  const message = room.messages.find((item) => item.eventId === ref);
  if (!message) {
    return;
  }
  selectedContextRefs.add(ref);
  renderContextTray();
  renderMessages();
  const mention = message.authorKind === "agent" ? `@${message.author} ` : "";
  if (mention && !messageInput.value.includes(mention)) {
    messageInput.value = `${messageInput.value}${messageInput.value.trim().length > 0 ? "\n" : ""}${mention}`;
    selectedMentions.add(message.author);
    renderMentionTray();
  }
  composerState.textContent = `正在引用 ${shortRef(ref)}`;
  syncComposer();
  messageInput.focus();
}

function latestVisibleMessageRef() {
  const latest = room.messages
    .slice()
    .reverse()
    .find((message) => isChatStreamMessage(message) && !message.pending && message.eventId);
  return latest?.eventId ?? null;
}

function shortRef(ref) {
  const value = String(ref);
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function findById(items, key, value) {
  return Array.isArray(items) ? items.find((item) => item?.[key] === value) ?? null : null;
}

function responseKindSummary(counts) {
  const entries = Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    return "";
  }
  return entries
    .slice(0, 3)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(" · ");
}

function mixedPressureObjectSummary(pressure) {
  const touchedObjects = Array.isArray(pressure?.touchedObjects) ? pressure.touchedObjects : [];
  const objectSummary = touchedObjects
    .slice(0, 4)
    .map((item) => `${item.kind ?? "object"} ${shortRef(item.ref ?? "")}`)
    .filter(Boolean)
    .join(" · ");
  return objectSummary || `${(pressure?.touchedRefs ?? []).length} refs`;
}

function mixedPressureObjectCount(pressure) {
  return pressure?.objectCount ?? (Array.isArray(pressure?.touchedObjects) ? pressure.touchedObjects.length : 0);
}

function isLongMessage(text) {
  return String(text).length > 360 || String(text).split(/\r?\n/).length > 8;
}

function renderSettings() {
  const kernelMetrics = document.querySelector("#kernelMetrics");
  kernelMetrics.replaceChildren();
  for (const [value, label] of room.metrics) {
    const metric = document.createElement("div");
    metric.className = "metric";
    metric.innerHTML = `<strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span>`;
    kernelMetrics.append(metric);
  }

  const agentList = document.querySelector("#agentList");
  agentList.replaceChildren();
  for (const agent of room.agents) {
    const item = document.createElement("section");
    item.className = "agent-card";
    const capabilityRef = Array.isArray(agent.capabilityRefs) ? agent.capabilityRefs[0] : undefined;
    item.innerHTML = `
      <div class="agent-head">
        <div>
          <p class="agent-name">${escapeHtml(agent.name)}</p>
          <p class="agent-posture">initial posture · ${escapeHtml(agentPosture(agent))} · ${escapeHtml(agent.provider)}</p>
        </div>
        <div class="agent-state-pills" aria-label="agent runtime state">
          ${
            capabilityRef
              ? `<button class="social-review-button" type="button" title="Ask room to review capability hint" aria-label="Ask review for capability hint ${escapeHtml(capabilityRef)}" data-capability-review-ref="${escapeHtml(capabilityRef)}">?</button>`
              : ""
          }
          <span class="badge ${escapeHtml(agent.status)}">${escapeHtml(agent.status)}</span>
          <span class="mode-pill ${escapeHtml(agent.mode ?? "seed")}">${escapeHtml(agent.mode ?? "seed")}</span>
        </div>
      </div>
      <p class="agent-mode-boundary">${escapeHtml(agentModeBoundary(agent))}</p>
      ${agentDailyMoodMarkup(agent)}
      ${agentRoleClaimsMarkup(agent)}
      ${agentProviderBoundaryMarkup(agent)}
      <p class="agent-persona">${escapeHtml(agent.persona)}</p>
      <div class="chips">${(agent.tags ?? []).map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>
    `;
    agentList.append(item);
  }

  const checkList = document.querySelector("#checkList");
  checkList.replaceChildren();
  for (const [name, ok, detail] of room.checks) {
    const row = document.createElement("div");
    row.className = "check-card";
    row.innerHTML = `
      <div>
        <p class="agent-name">${escapeHtml(name)}</p>
        <p class="check-detail">${escapeHtml(detail)}</p>
      </div>
      <span class="check-status ${ok ? "" : "fail"}">${ok ? "Y" : "N"}</span>
    `;
    checkList.append(row);
  }

  const contextAuditList = document.querySelector("#contextAuditList");
  contextAuditList.replaceChildren();
  if (room.contextAudits.length === 0) {
    const empty = document.createElement("div");
    empty.className = "check-card muted-card";
    empty.innerHTML = `
      <div>
        <p class="agent-name">No context packets yet</p>
        <p class="check-detail">发送消息后会显示 agent 实际收到的 bounded fragments。</p>
      </div>
      <span class="check-status fail">0</span>
    `;
    contextAuditList.append(empty);
  } else {
    for (const audit of room.contextAudits.slice().reverse()) {
      const row = document.createElement("div");
      row.className = "check-card audit-card";
      row.innerHTML = `
        <div class="audit-main">
          <div class="audit-headline">
            <div>
              <p class="agent-name">${escapeHtml(audit.agentId ?? "room agent")} · ${escapeHtml(audit.topicId)}</p>
              <p class="check-detail">${escapeHtml(audit.packetId)} · model-visible packet metadata</p>
            </div>
            <span class="audit-token-pill">${escapeHtml(audit.totalTokenEstimate ?? 0)} tokens</span>
          </div>
          <div class="audit-facts" aria-label="Context packet audit facts">
            ${auditFactMarkup("selected", audit.selectedCount ?? 0)}
            ${auditFactMarkup("omitted", audit.omittedCount ?? 0)}
            ${auditFactMarkup("largest", auditLargestFragmentLabel(audit))}
            ${auditFactMarkup("ledger", auditLedgerRangeLabel(audit))}
          </div>
          ${auditCoVisibleMarkup(audit)}
          <div class="audit-cache-line">
            <span>cache</span>
            <code title="${escapeHtml(audit.cacheKey ?? "no cache key")}">${escapeHtml(shortRef(audit.cacheKey ?? "no cache key"))}</code>
            <span>fragment bodies hidden</span>
          </div>
          ${renderAuditFragments(audit)}
          ${audit.auditBoundaryNote ? `<p class="check-detail audit-boundary">${escapeHtml(audit.auditBoundaryNote)}</p>` : ""}
        </div>
      `;
      contextAuditList.append(row);
    }
  }

  renderSocialState();
}

function renderAuditFragments(audit) {
  const selected = Array.isArray(audit.selectedFragments) ? audit.selectedFragments.slice(0, 6) : [];
  const omitted = Array.isArray(audit.omittedFragments) ? audit.omittedFragments.slice(0, 4) : [];
  if (selected.length === 0 && omitted.length === 0) {
    return "";
  }

  return `
    <div class="audit-fragment-groups" aria-label="context fragment summaries">
      ${auditFragmentGroupMarkup("selected", "Selected fragments", selected, audit.selectedByType ?? {})}
      ${auditFragmentGroupMarkup("omitted", "Omitted fragments", omitted, audit.omittedByReason ?? audit.omittedByType ?? {})}
    </div>
  `;
}

function auditFragmentGroupMarkup(kind, title, fragments, counts) {
  return `
    <section class="audit-fragment-group ${escapeHtml(kind)}">
      <div class="audit-group-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${auditCountChipsMarkup(counts)}</span>
      </div>
      <div class="fragment-list">
        ${
          fragments.length === 0
            ? `<p class="fragment-empty">${kind === "selected" ? "No selected fragment metadata" : "No omitted fragments"}</p>`
            : fragments.map((fragment) => auditFragmentRowMarkup(fragment, kind)).join("")
        }
      </div>
    </section>
  `;
}

function auditFragmentRowMarkup(fragment, kind) {
  const refs = Array.isArray(fragment.refs) && fragment.refs.length > 0 ? fragment.refs.join(", ") : "no refs";
  const state = kind === "omitted" ? `omitted:${fragment.reason ?? "unknown"}` : "selected";
  return `
    <div class="fragment-row ${escapeHtml(kind)}">
      <span class="fragment-type">${escapeHtml(fragment.type)}</span>
      <span class="fragment-meta">${escapeHtml(state)} · ${escapeHtml(fragment.visibility)} · ${escapeHtml(
        fragment.role ?? fragment.sourceKind ?? "runtime",
      )} · ${escapeHtml(fragment.tokenEstimate ?? 0)}/${escapeHtml(fragment.hardCap ?? 0)}</span>
      ${auditFragmentSignalMarkup(fragment)}
      ${auditFragmentPressureLineageMarkup(fragment)}
      <span class="fragment-refs">${escapeHtml(refs)}</span>
    </div>
  `;
}

function auditFragmentSignalMarkup(fragment) {
  const stateKeys = Array.isArray(fragment.stateKeys) ? fragment.stateKeys : [];
  const signals = fragment.boundarySignals && typeof fragment.boundarySignals === "object" ? fragment.boundarySignals : null;
  if (stateKeys.length === 0 && signals === null) {
    return "";
  }
  const signalText = signals
    ? Object.entries(signals)
        .filter(([, value]) => value !== false && value !== 0 && value !== "")
        .slice(0, 8)
        .map(([key, value]) => `${key}:${value}`)
        .join(" · ")
    : "";
  const keysText = stateKeys.length > 0 ? `states: ${stateKeys.slice(0, 8).join(", ")}` : "";
  return `<span class="fragment-signals">${escapeHtml([signalText, keysText].filter(Boolean).join(" · "))}</span>`;
}

function auditFragmentPressureLineageMarkup(fragment) {
  const refs = auditFragmentPressureRefs(fragment).slice(0, 4);
  if (refs.length === 0) {
    return "";
  }
  return `
    <div class="fragment-lineage" aria-label="Audit fragment pressure lineage refs">
      <span>pressure lineage</span>
      ${refs.map((ref) => lineageRefButtonMarkup(ref)).join("")}
    </div>
  `;
}

function auditFragmentPressureRefs(fragment) {
  const signalRefs =
    typeof fragment.boundarySignals?.sourcePressureRefs === "string"
      ? fragment.boundarySignals.sourcePressureRefs.split(",").map((ref) => ref.trim())
      : [];
  const directRefs = Array.isArray(fragment.refs) ? fragment.refs.filter((ref) => ref.startsWith("mixed_review:")) : [];
  return uniqueRoomRefs([...signalRefs, ...directRefs]);
}

function auditCountChipsMarkup(counts) {
  const entries = Object.entries(counts ?? {}).sort(([typeA, countA], [typeB, countB]) => countB - countA || typeA.localeCompare(typeB));
  if (entries.length === 0) {
    return `<span class="audit-chip muted">none</span>`;
  }
  return entries
    .slice(0, 5)
    .map(([type, count]) => `<span class="audit-chip">${escapeHtml(type)} ${escapeHtml(count)}</span>`)
    .join("");
}

function auditCoVisibleMarkup(audit) {
  const summary = auditCoVisibleSummary(audit);
  return `
    <div class="audit-co-visible ${summary.complete ? "complete" : "partial"}" aria-label="Co-visible context evidence">
      <div class="audit-co-visible-head">
        <strong>Co-visible context</strong>
        <span>${escapeHtml(summary.visibleCount)}/5 domains</span>
      </div>
      <div class="audit-domain-grid">
        ${summary.domains.map((domain) => auditDomainMarkup(domain)).join("")}
      </div>
    </div>
  `;
}

function auditCoVisibleSummary(audit) {
  const fragments = Array.isArray(audit.selectedFragments) ? audit.selectedFragments : [];
  const archiveRefs = auditRefsForFragments(fragments, (fragment) => fragment.type === "daily_archive_ref");
  const memoryRefs = auditRefsForFragments(fragments, (fragment) => String(fragment.type ?? "").startsWith("memory_"));
  const directPersonaRefs = auditRefsForFragments(
    fragments,
    (fragment) => fragment.type === "persona_delta" || fragment.type === "persona_projection",
  );
  const archiveContinuityRefs = archiveRefs.flatMap((ref) => {
    const archive = findById(room.socialState?.archives, "archiveId", ref);
    return archiveContinuityRows(archive).flatMap((row) => [row.ref, ...(row.evidenceRefs ?? [])]);
  });
  const providerRefs = auditRefsForFragments(fragments, (fragment) => fragment.type === "provider_boundary");
  const socialLineageRefs = auditRefsForFragments(fragments, isSocialLineageContextFragment);
  const domains = [
    { key: "archive", label: "archive", refs: archiveRefs },
    { key: "memory", label: "memory", refs: memoryRefs },
    { key: "continuity", label: "continuity", refs: uniqueRoomRefs([...directPersonaRefs, ...archiveContinuityRefs]) },
    { key: "provider", label: "provider", refs: providerRefs },
    { key: "social", label: "social lineage", refs: socialLineageRefs },
  ].map((domain) => ({ ...domain, visible: domain.refs.length > 0 }));
  return {
    domains,
    visibleCount: domains.filter((domain) => domain.visible).length,
    complete: domains.every((domain) => domain.visible),
  };
}

function auditRefsForFragments(fragments, matches) {
  return uniqueRoomRefs((fragments ?? []).filter(matches).flatMap((fragment) => fragment.refs ?? []));
}

function auditDomainMarkup(domain) {
  return `
    <div class="audit-domain ${domain.visible ? "visible" : "missing"}">
      <span>${escapeHtml(domain.label)} ${domain.visible ? "visible" : "missing"}</span>
      <div>
        ${
          domain.refs.length === 0
            ? `<small>no refs</small>`
            : domain.refs
                .slice(0, 3)
                .map(
                  (ref) =>
                    `<button class="overview-ref-button compact" type="button" title="Add ${escapeHtml(
                      domain.label,
                    )} context ref" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
                )
                .join("")
        }
      </div>
    </div>
  `;
}

function auditFactMarkup(label, value) {
  return `
    <span class="audit-fact">
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function auditLargestFragmentLabel(audit) {
  const largest = audit.largestFragment;
  if (!largest) {
    return "none";
  }
  return `${largest.type} ${largest.tokenEstimate}/${largest.hardCap}`;
}

function auditLedgerRangeLabel(audit) {
  const range = audit.builtFromLedgerRange;
  if (!range) {
    return "unknown";
  }
  return `${range.fromCursor}->${range.toCursor}`;
}

function renderSocialState() {
  renderSocialList(
    "#personaEvolutionList",
    personaEvolutionItems(room.socialState?.personas ?? []),
    "No persona deltas yet",
    "agent 提出或回应人格演化后，这里会显示完整 evolution log，而不是只保留最新 profile。",
    (item) => {
      if (item.kind === "delta") {
        const details = [
          item.deltaId,
          item.status,
          `by ${item.proposedBy}`,
          `${item.responseCount ?? 0} responses`,
          item.revisedFromDeltaRef ? `revised from ${shortRef(item.revisedFromDeltaRef)}` : "",
          item.revisedBy ? `revised by ${item.revisedBy}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return {
          title: `${item.displayName} · ${item.field}`,
          body: item.value || "No persona delta value recorded.",
          detail: details,
          badge: item.status,
          note: item.reason,
          ref: item.deltaId,
          personaReviewRef: item.deltaId,
          evidenceRefs: uniqueRoomRefs([item.deltaId, ...(item.sourcePressureRefs ?? [])]),
          evidenceLabel: "persona delta evidence refs",
        };
      }
      const roleClaims = (item.roleClaims ?? []).map((claim) => `${claim.label} (${claim.status})`).join(", ");
      const habit = (item.habits ?? [])[0] ?? "";
      const mood = personaDailyMoodLabel(item);
      const evidenceRefs = personaContinuityEvidenceRefs(item);
      return {
        title: item.displayName,
        body: roleClaims || habit || item.initialPosture || "No room-visible evolution yet.",
        detail: roleClaims
          ? `role claims: ${roleClaims}`
          : mood
            ? `daily mood: ${mood}`
            : "seed posture only; not a fixed job",
        badge: "seed",
        note: item.dailyMoodRecord?.boundaryNote ?? "Initial posture is a growth hint, not a room assignment.",
        ref: item.dailyMoodRecord?.sourceRef ?? firstRoomRef(evidenceRefs),
        evidenceRefs,
        evidenceLabel: "continuity evidence refs",
      };
    },
  );

  renderSocialList(
    "#capabilityHintList",
    capabilityHintItems(),
    "No capability hints yet",
    "capability hint 只是弱唤醒线索，不是职责、权威、信任证明或胜任认证。",
    (hint) => {
      const reviews = capabilityReviewsFor(hint.capabilityRef);
      const latestReview = reviews[0];
      const lineageRefs = pressureLineageRefs(latestReview);
      return {
        title: `${hint.displayName} · ${shortRef(hint.capabilityRef)}`,
        body: hint.tags.length > 0 ? hint.tags.join(", ") : "No domain tags exposed.",
        detail: [
          `${reviews.length} reviews`,
          "advisory wake hint",
          lineageRefs.length ? `from ${lineageRefs.length} pressure refs` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        badge: "capability",
        note: capabilityHintNote(hint, latestReview),
        ref: hint.capabilityRef,
        capabilityReviewRef: hint.capabilityRef,
        lineageRefs,
      };
    },
  );

  renderSocialList(
    "#workspaceList",
    room.socialState?.workspaces ?? [],
    "No private workspaces yet",
    "agent 私人桌面只暴露边界和共享引用；私有草稿不会自动进入公共记忆。",
    (workspace) => {
      const artifactRefs = Array.isArray(workspace.sharedArtifactRefs) ? workspace.sharedArtifactRefs : [];
      const reviews = workspaceArtifactReviewsForWorkspace(workspace);
      const latestReview = reviews[0];
      return {
        title: `${workspace.displayName ?? workspace.agentId} · ${workspace.visibility ?? "private"}`,
        body: workspace.scratchPath || workspace.privateHome || "No workspace path recorded.",
        detail: `${workspace.sharedArtifactCount ?? 0} shared artifacts · ${reviews.length} artifact reviews`,
        badge: "workspace",
        note: workspaceArtifactNote(workspace, latestReview),
        ref: workspace.workspaceId,
        workspaceArtifactReviewRef: artifactRefs[0],
      };
    },
  );

  renderSocialList(
    "#yoloSpaceList",
    room.yoloSpaces ?? [],
    "No YOLO spaces configured",
    "YOLO space 是目录级预授权执行面：命令不逐次审批，但仍记录 capability 调用与结果。",
    (space) => ({
      title: `${space.label ?? space.id} · ${space.status ?? "unknown"}`,
      body: space.root || "No root recorded.",
      detail: [
        space.repository || "local only",
        `${(space.allowedAgents ?? []).length} agent grants`,
        "approval bypass",
      ].join(" · "),
      badge: "yolo",
      note: space.boundaryNote || "Trusted YOLO grant; cwd/path guard is not an OS sandbox.",
      ref: space.id,
    }),
  );

  renderSocialList(
    "#skillCapsuleList",
    room.socialState?.skillCapsules ?? [],
    "No skill capsules yet",
    "skill capsule 是可见的行动器官声明；执行仍需要明确房间事件和必要审批。",
    (skill) => {
      const reviews = skillCapsuleReviewsFor(skill.capsuleId);
      const latestReview = reviews[0];
      const lineageRefs = pressureLineageRefs(skill, latestReview);
      return {
        title: `${skill.displayName ?? skill.agentId} · ${skill.label}`,
        body: (skill.triggerHints ?? []).join(", ") || "No trigger hints recorded.",
        detail: [
          skill.status ?? "registered",
          skill.approvalRequired ? "approval required" : "no side effects",
          (skill.sideEffectKinds ?? []).join(", "),
          `${reviews.length} reviews`,
          lineageRefs.length ? `from ${lineageRefs.length} pressure refs` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        badge: "skill",
        note: skillCapsuleNote(skill, latestReview),
        ref: skill.capsuleId,
        skillCapsuleReviewRef: skill.capsuleId,
        lineageRefs,
      };
    },
  );

  renderMemoryClaimList();

  renderSocialList(
    "#openQuestionList",
    room.socialState?.openQuestions ?? [],
    "No open questions yet",
    "open question 是未解决的房间问题，不是任务指派或立即回答要求。",
    (question) => ({
      title: `${question.questionId} · ${question.topicId ?? "room"}`,
      body: question.question || "No question recorded.",
      detail: [
        question.raisedBy ? `by ${question.raisedBy}` : "",
        question.refinedFromQuestionRef ? `refined from ${shortRef(question.refinedFromQuestionRef)}` : "",
        question.refinedBy ? `refined by ${question.refinedBy}` : "",
        question.responseCount ? `${question.responseCount} responses` : "",
        question.refinedCount ? `${question.refinedCount} refined` : "",
        question.deferredCount ? `${question.deferredCount} deferred` : "",
        question.contestedCount ? `${question.contestedCount} contested` : "",
        question.lastResponse?.response ? `last ${question.lastResponse.response}` : "",
        question.sourceMessageId ? `message ${shortRef(question.sourceMessageId)}` : "",
        question.sourceBoundaryId ? `boundary ${shortRef(question.sourceBoundaryId)}` : "",
        question.sourcePressureRefs?.length ? `from ${question.sourcePressureRefs.length} pressure refs` : "",
        `${(question.sourceRefs ?? []).length} refs`,
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "open question",
      note: question.lastResponse?.summary
        ? `${question.boundaryNote} ${question.refinedFromQuestionRef ? `Refinement lineage: ${question.refinedFromQuestionRef}. ` : ""}${question.sourcePressureRefs?.length ? `Pressure lineage: ${question.sourcePressureRefs.join(", ")}. ` : ""}Last response: ${question.lastResponse.summary}`
        : `${question.boundaryNote}${question.refinedFromQuestionRef ? ` Refinement lineage: ${question.refinedFromQuestionRef}.` : ""}${question.sourcePressureRefs?.length ? ` Pressure lineage: ${question.sourcePressureRefs.join(", ")}.` : ""}`,
      ref: question.questionId,
      questionReviewRef: question.questionId,
    }),
  );

  renderSocialList(
    "#memoryPressureList",
    room.socialState?.memoryPressureBoundaries ?? [],
    "No memory pressure yet",
    "memory pressure 是公共记忆入口拥堵信号，不是真伪裁决。",
    (boundary) => ({
      title: `${boundary.reason ?? "memory pressure"} · ${boundary.pendingProposalCount ?? 0}/${boundary.threshold ?? "?"}`,
      body: boundary.boundaryNote || "Review pending memory before adding more sediment.",
      detail: [
        boundary.topicId ?? "",
        boundary.triggeringMemoryId ? `trigger ${shortRef(boundary.triggeringMemoryId)}` : "",
        `${(boundary.proposedMemoryRefs ?? []).length} pending refs`,
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "memory pressure",
      note: boundary.sourceRefs?.length ? `${boundary.sourceRefs.length} refs` : "",
      ref: boundary.boundaryId,
    }),
  );

  renderSocialList(
    "#topicProposalList",
    room.socialState?.topicProposals ?? [],
    "No topic proposals yet",
    "agent 可以提议新开、分裂、暂停、复活或合并话题；提案不会自动切换，只有 room-visible apply 才会移动话题。",
    (proposal) => {
      const reviews = topicProposalReviewsFor(proposal.proposalId);
      const latestReview = reviews[0];
      return {
        title: `${proposal.action ?? "topic"} · ${proposal.status}`,
        body: proposal.title || proposal.reason || "No title recorded.",
        detail: [
          proposal.proposedBy ? `by ${proposal.proposedBy}` : "",
          proposal.currentTopicId ? `from ${proposal.currentTopicId}` : "",
          proposal.targetTopicId ? `target ${proposal.targetTopicId}` : "",
          proposal.revisedFromTopicProposalRef ? `revised from ${shortRef(proposal.revisedFromTopicProposalRef)}` : "",
          proposal.revisedBy ? `revised by ${proposal.revisedBy}` : "",
          proposal.sourcePressureRefs?.length ? `from ${proposal.sourcePressureRefs.length} pressure refs` : "",
          proposal.resultingTopicId ? `result ${proposal.resultingTopicId}` : "",
          proposal.appliedBy ? `applied by ${proposal.appliedBy}` : "",
          `${proposal.responseCount ?? 0} responses`,
          `${reviews.length} reviews`,
          latestReview ? `last review ${latestReview.response ?? "reviewed"} by ${latestReview.agentId ?? "agent"}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        badge: proposal.status,
        note: topicProposalNote(proposal, latestReview),
        ref: proposal.proposalId,
        topicProposalReviewRef: proposal.proposalId,
      };
    },
  );

  renderSocialList(
    "#mixedReviewList",
    room.socialState?.mixedReviewPressures ?? [],
    "No mixed review pressure yet",
    "未解压力是多个社会对象被同轮审阅后的房间压力索引；它只是投影，不会自动推进任何生命周期。",
    (pressure) => {
      const objectSummary = mixedPressureObjectSummary(pressure);
      return {
        title: `unresolved pressure · ${mixedPressureObjectCount(pressure)} objects`,
        body:
          pressure.boundaryNote ||
          "This pressure is projection only; it invites review without closing, narrowing, assigning, or executing anything.",
        detail: [
          `${(pressure.agentIds ?? []).length} agents`,
          responseKindSummary(pressure.responseKindCounts),
          `${(pressure.reviewEventIds ?? []).length} review traces`,
        ]
          .filter(Boolean)
          .join(" · "),
        badge: "pressure",
        note: objectSummary,
        ref: pressure.pressureId,
        pressureReviewRef: pressure.pressureId,
      };
    },
  );

  renderSocialList(
    "#invitationList",
    room.socialState?.invitations ?? [],
    "No invitations yet",
    "invitation 是 agent 发出的社交敲门；被邀请者可以回应、沉默、转交，或让房间继续流动。",
    (invitation) => {
      const reviews = invitationReviewsFor(invitation.invitationId);
      const latestReview = reviews[0];
      return {
        title: `${invitation.fromAgentId ?? "agent"} invited ${invitation.toAgentId ?? "agent"}`,
        body: invitation.reason || "No reason recorded.",
        detail: [
          invitation.topicId ?? "",
          invitation.delegatedFromInvitationRef ? `delegated from ${shortRef(invitation.delegatedFromInvitationRef)}` : "",
          invitation.delegatedBy ? `delegated by ${invitation.delegatedBy}` : "",
          `${(invitation.contextRefs ?? []).length} refs`,
          `${invitation.responseCount ?? 0} responses`,
          `${reviews.length} reviews`,
          latestReview ? `last review ${latestReview.response ?? "reviewed"} by ${latestReview.agentId ?? "agent"}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        badge: invitation.status,
        note: invitationNote(invitation, latestReview),
        ref: invitation.invitationId,
        invitationReviewRef: invitation.invitationId,
      };
    },
  );

  renderHandoffList();

  renderSocialList(
    "#silenceList",
    room.socialState?.silences ?? [],
    "No deliberate silences yet",
    "silence 是 agent 的表达选择，不是故障、同意或缺席。",
    (silence) => ({
      title: `${silence.agentId ?? "agent"} stayed silent`,
      body: silence.reason || "No reason recorded.",
      detail: [
        silence.topicId ?? "",
        silence.invitationId ? `invite ${shortRef(silence.invitationId)}` : "",
        silence.triggeringEventId ? `trigger ${shortRef(silence.triggeringEventId)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "silence",
      note: silence.boundaryNote,
      ref: silence.silenceId,
    }),
  );

  renderSocialList(
    "#pressureBoundaryList",
    room.socialState?.pressureBoundaries ?? [],
    "No pressure boundaries yet",
    "pressure boundary 是房间带宽信号，不是对任何 agent 的评价。",
    (boundary) => ({
      title: boundary.reason || "room pressure",
      body: boundary.boundaryNote || "Expression is preserved while wake may be delayed.",
      detail: [
        boundary.topicId ?? "",
        boundary.messageId ? `message ${shortRef(boundary.messageId)}` : "",
        `${boundary.activeBackgroundTurns ?? "?"}/${boundary.maxConcurrentBackgroundTurns ?? "?"} active`,
        `${boundary.queuedBackgroundTurns ?? "?"} queued`,
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "pressure",
      note: boundary.sourceRefs?.length ? `${boundary.sourceRefs.length} refs` : "",
      ref: boundary.boundaryId,
    }),
  );

  renderSocialList(
    "#roomRhythmList",
    room.socialState?.autonomyTicks ?? [],
    "No room rhythm ticks yet",
    "room rhythm 是 ledger 证据驱动的生活节律；它可以邀请审阅，也可以继续沉默。",
    (tick) => ({
      title: `${roomRhythmActionLabel(tick.action)} · ${tick.status ?? "recorded"}`,
      body: tick.reason || "No rhythm reason recorded.",
      detail: [
        tick.date ?? "",
        tick.archiveRef ? `archive ${shortRef(tick.archiveRef)}` : "",
        tick.reviewRequestRef ? `review ${shortRef(tick.reviewRequestRef)}` : "",
        tick.messageEventId ? `message ${shortRef(tick.messageEventId)}` : "",
        tick.anchorEventId ? `anchor ${shortRef(tick.anchorEventId)}` : "",
        tick.evidenceRefs?.length ? `${tick.evidenceRefs.length} evidence refs` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "rhythm",
      note: tick.boundaryNote,
      ref: tick.tickId,
    }),
  );

  renderProviderBoundaryList();

  renderProtocolList();

  renderSocialList(
    "#sideEffectList",
    room.socialState?.sideEffects ?? [],
    "No action requests yet",
    "agent 可以请求外部副作用审批；没有审批不会执行任何动作。",
    (request) => {
      const reviews = sideEffectReviewsFor(request.requestId);
      const latestReview = reviews[0];
      return {
        title: `${request.kind ?? "side_effect"} · ${request.status}`,
        body: request.reason || request.boundaryNote || "No reason recorded.",
        detail: [
          request.requestedBy ? `by ${request.requestedBy}` : "",
          request.target ?? "",
          request.expectedImpact ? `impact: ${request.expectedImpact}` : "",
          `${reviews.length} reviews`,
          latestReview ? `last review ${latestReview.response ?? "reviewed"} by ${latestReview.agentId ?? "agent"}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        badge: request.status,
        note: sideEffectNote(request, latestReview),
        ref: request.requestId,
        sideEffectReviewRef: request.requestId,
        sideEffectApproveRef: request.status === "requested" ? request.requestId : "",
        sideEffectExecuteRef: request.status === "approved" ? request.requestId : "",
        sideEffectExpireRef: request.status === "approved" ? request.requestId : "",
      };
    },
  );

  renderArchiveList();

  renderSocialList(
    "#archiveReviewList",
    room.socialState?.archiveReviews ?? [],
    "No archive reviews yet",
    "daily archive 会打开审阅节律；agent 可以审阅、提议修复、回应，或选择沉默。",
    (review) => ({
      title: `${archiveReviewKindLabel(review.kind)} · ${review.archiveRef}`,
      body: review.summary || review.proposedRepair || "No review summary recorded.",
      detail: [
        review.agentId ? `by ${review.agentId}` : "",
        review.assessment ? `assessment ${review.assessment}` : "",
        review.status ? `status ${review.status}` : "",
        review.repairRef ? `repair ${review.repairRef}` : "",
        review.revisedFromRepairRef ? `revised from ${shortRef(review.revisedFromRepairRef)}` : "",
        review.revisedBy ? `revised by ${review.revisedBy}` : "",
        review.revisedArchiveRef ? `revision ${review.revisedArchiveRef}` : "",
        review.contextRefs?.length ? `${review.contextRefs.length} refs` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      badge: archiveReviewKindLabel(review.kind),
      note: review.proposedRepair || review.boundaryNote || review.reason,
      ref: review.id,
    }),
  );
}

function topicProposalReviewsFor(proposalRef) {
  const reviews = Array.isArray(room.socialState?.topicProposalReviews)
    ? room.socialState.topicProposalReviews
    : [];
  return reviews
    .filter((review) => review.topicProposalRef === proposalRef)
    .slice()
    .sort((a, b) => timestampOrZero(b.updatedAt) - timestampOrZero(a.updatedAt));
}

function invitationReviewsFor(invitationRef) {
  const reviews = Array.isArray(room.socialState?.invitationReviews)
    ? room.socialState.invitationReviews
    : [];
  return reviews
    .filter((review) => review.invitationRef === invitationRef)
    .slice()
    .sort((a, b) => timestampOrZero(b.updatedAt) - timestampOrZero(a.updatedAt));
}

function invitationNote(invitation, latestReview) {
  const boundary = invitation.boundaryNote || "invitation is a social knock, not a speaking command";
  if (!latestReview) {
    return boundary;
  }
  const summary = latestReview.summary || latestReview.boundaryNote || "review recorded";
  return `${boundary} Last review: ${latestReview.response ?? "reviewed"} · ${summary}`;
}

function sideEffectReviewsFor(sideEffectRef) {
  const reviews = Array.isArray(room.socialState?.sideEffectReviews)
    ? room.socialState.sideEffectReviews
    : [];
  return reviews
    .filter((review) => review.sideEffectRef === sideEffectRef)
    .slice()
    .sort((a, b) => timestampOrZero(b.updatedAt) - timestampOrZero(a.updatedAt));
}

function sideEffectNote(sideEffect, latestReview) {
  const boundary = sideEffect.boundaryNote || "side-effect request requires explicit approval before execution";
  if (!latestReview) {
    return boundary;
  }
  const summary = latestReview.summary || latestReview.boundaryNote || "review recorded";
  return `${boundary} Last review: ${latestReview.response ?? "reviewed"} · ${summary}`;
}

function workspaceArtifactReviewsFor(artifactRef) {
  const reviews = Array.isArray(room.socialState?.workspaceArtifactReviews)
    ? room.socialState.workspaceArtifactReviews
    : [];
  return reviews
    .filter((review) => review.artifactRef === artifactRef)
    .slice()
    .sort((a, b) => timestampOrZero(b.updatedAt) - timestampOrZero(a.updatedAt));
}

function workspaceArtifactReviewsForWorkspace(workspace) {
  const refs = Array.isArray(workspace.sharedArtifactRefs) ? workspace.sharedArtifactRefs : [];
  return refs.flatMap((ref) => workspaceArtifactReviewsFor(ref));
}

function workspaceArtifactNote(workspace, latestReview) {
  const boundary = workspace.boundaryNote || "private workspace metadata only; private files do not enter public memory automatically";
  if (!latestReview) {
    return boundary;
  }
  const summary = latestReview.summary || latestReview.boundaryNote || "review recorded";
  return `${boundary} Last artifact review: ${latestReview.response ?? "reviewed"} · ${summary}`;
}

function skillCapsuleReviewsFor(capsuleRef) {
  const reviews = Array.isArray(room.socialState?.skillCapsuleReviews)
    ? room.socialState.skillCapsuleReviews
    : [];
  return reviews
    .filter((review) => review.capsuleRef === capsuleRef)
    .slice()
    .sort((a, b) => timestampOrZero(b.updatedAt) - timestampOrZero(a.updatedAt));
}

function skillCapsuleNote(skill, latestReview) {
  const boundary = skill.boundaryNote || "skill capsule is a possible action organ; execution still needs explicit room events and approvals";
  const pressureLineage = pressureLineageSentence(skill, latestReview);
  if (!latestReview) {
    return `${boundary}${pressureLineage}`;
  }
  const summary = latestReview.summary || latestReview.boundaryNote || "review recorded";
  return `${boundary}${pressureLineage} Last review: ${latestReview.response ?? "reviewed"} · ${summary}`;
}

function capabilityHintItems() {
  return room.agents.flatMap((agent) => {
    const refs = Array.isArray(agent.capabilityRefs) ? agent.capabilityRefs : [];
    return refs.map((capabilityRef) => ({
      capabilityRef,
      agentId: agent.id,
      displayName: agent.name ?? agent.id,
      tags: Array.isArray(agent.tags) ? agent.tags : [],
    }));
  });
}

function capabilityReviewsFor(capabilityRef) {
  const reviews = Array.isArray(room.socialState?.capabilityReviews) ? room.socialState.capabilityReviews : [];
  return reviews
    .filter((review) => review.capabilityRef === capabilityRef)
    .slice()
    .sort((a, b) => timestampOrZero(b.updatedAt) - timestampOrZero(a.updatedAt));
}

function capabilityHintNote(hint, latestReview) {
  const boundary = "capability hint is advisory routing context, not authority, responsibility, trust proof, or competence certification";
  const pressureLineage = pressureLineageSentence(latestReview);
  if (!latestReview) {
    return `${boundary}; ${hint.displayName} may still stay silent, disagree, redirect, or ask for clearer context.`;
  }
  const summary = latestReview.summary || latestReview.boundaryNote || "review recorded";
  return `${boundary}${pressureLineage} Last review: ${latestReview.response ?? "reviewed"} · ${summary}`;
}

function pressureLineageRefs(...items) {
  return uniqueRoomRefs(
    items.flatMap((item) =>
      Array.isArray(item?.sourcePressureRefs) ? item.sourcePressureRefs.filter((ref) => ref.startsWith("mixed_review:")) : [],
    ),
  );
}

function pressureLineageSentence(...items) {
  const refs = pressureLineageRefs(...items);
  return refs.length > 0 ? ` Pressure lineage: ${refs.join(", ")}.` : "";
}

function topicProposalNote(proposal, latestReview) {
  const boundary = proposal.boundaryNote || proposal.reason || "topic proposal remains social order, not automatic movement";
  const pressureLineage = proposal.sourcePressureRefs?.length ? ` Pressure lineage: ${proposal.sourcePressureRefs.join(", ")}.` : "";
  if (!latestReview) {
    return `${boundary}${pressureLineage}`;
  }
  const summary = latestReview.summary || latestReview.boundaryNote || "review recorded";
  return `${boundary}${pressureLineage} Last review: ${latestReview.response ?? "reviewed"} · ${summary}`;
}

function timestampOrZero(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function renderMemoryClaimList() {
  const list = document.querySelector("#memoryClaimList");
  list.replaceChildren();
  const claims = Array.isArray(room.socialState?.memoryClaims) ? room.socialState.memoryClaims : [];
  if (claims.length === 0) {
    const empty = document.createElement("div");
    empty.className = "social-card muted-card";
    empty.innerHTML = `
      <p class="social-title">No public memory yet</p>
      <p class="social-body">agent 提出或反对记忆后，这里会显示可质疑的房间沉淀。</p>
    `;
    list.append(empty);
    return;
  }

  for (const claim of claims.slice(0, 8)) {
    const card = document.createElement("article");
    card.className = "social-card memory-card";
    card.innerHTML = `
      <div class="social-head">
        <p class="social-title">${escapeHtml(claim.memoryId)} · ${escapeHtml(claim.state || "observed")}</p>
        <div class="social-actions">
          <button class="social-review-button" type="button" title="Ask room to review memory claim" aria-label="Ask review for memory claim ${escapeHtml(
            claim.memoryId,
          )}" data-memory-claim-review-ref="${escapeHtml(claim.memoryId)}">?</button>
          <button class="social-context-button" type="button" title="Add memory claim context ref" aria-label="Add memory claim context ref ${escapeHtml(
            claim.memoryId,
          )}" data-social-context-ref="${escapeHtml(claim.memoryId)}">#</button>
          <span class="social-badge">${escapeHtml(claim.state || "observed")}</span>
        </div>
      </div>
      <p class="social-body">${escapeHtml(claim.summary || claim.provisionalNote || "No memory claim summary recorded.")}</p>
      <div class="memory-state-boundary">${escapeHtml(memoryStateBoundaryLabel(claim))} · provisional sediment · not truth</div>
      ${memoryRevisionMarkup(claim)}
      ${memoryContestationMarkup(claim)}
      <div class="memory-facts" aria-label="Memory claim state facts">
        ${memoryFactMarkup("state", claim.state || "observed")}
        ${claim.revisedFromMemoryRef ? memoryFactMarkup("revises", shortRef(claim.revisedFromMemoryRef)) : ""}
        ${memoryFactMarkup("transitions", claim.transitionCount ?? 0)}
        ${memoryFactMarkup("contested by", (claim.contestedBy ?? []).length)}
        ${memoryFactMarkup("source refs", (claim.sourceRefs ?? []).length)}
      </div>
      ${memorySourceRefsMarkup(claim)}
      <p class="social-note">${escapeHtml(claim.provisionalNote || "room memory remains open to challenge and repair")}</p>
    `;
    list.append(card);
  }
}

function memoryStateBoundaryLabel(claim) {
  const state = claim.state || "observed";
  if (state === "accepted") return "accepted, still provisional";
  if (state === "contested") return "contested public claim";
  if (state === "stale") return "stale public sediment";
  if (state === "retired") return "retired historical claim";
  if (state === "proposed") return "proposed, not adopted";
  return "observed, not adopted";
}

function memoryRevisionMarkup(claim) {
  if (!claim.revisedFromMemoryRef) {
    return "";
  }
  const revisedBy = claim.revisedBy ? ` by ${claim.revisedBy}` : "";
  return `
    <div class="memory-revision-lineage">
      <span>revises ${escapeHtml(claim.revisedFromMemoryRef)}${escapeHtml(revisedBy)}</span>
      <span>fresh proposal; previous claim unchanged</span>
    </div>
  `;
}

function memoryContestationMarkup(claim) {
  const contestedBy = Array.isArray(claim.contestedBy) ? claim.contestedBy : [];
  if (contestedBy.length === 0 && !claim.proposedBy && !claim.lastReviewedAt) {
    return "";
  }
  return `
    <div class="memory-lineage">
      ${claim.proposedBy ? `<span>by ${escapeHtml(claim.proposedBy)}</span>` : ""}
      ${contestedBy.length > 0 ? `<span>contested by ${escapeHtml(contestedBy.join(", "))}</span>` : ""}
      ${claim.lastReviewedAt ? `<span>reviewed ${escapeHtml(memoryReviewedLabel(claim.lastReviewedAt))}</span>` : ""}
    </div>
  `;
}

function memoryFactMarkup(label, value) {
  return `
    <span class="memory-fact">
      <strong>${escapeHtml(value ?? "")}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function memorySourceRefsMarkup(claim) {
  const refs = Array.isArray(claim.sourceRefs) ? claim.sourceRefs.slice(0, 4) : [];
  if (refs.length === 0) {
    return `<div class="memory-source-refs empty">no source refs carried</div>`;
  }
  return `
    <div class="memory-source-refs" aria-label="Memory source refs">
      ${refs.map((ref) => memorySourceRefButtonMarkup(ref)).join("")}
    </div>
  `;
}

function memorySourceRefButtonMarkup(ref) {
  return `<button class="memory-source-ref-button" type="button" title="Add memory source ref ${escapeHtml(
    ref,
  )}" aria-label="Add memory source ref ${escapeHtml(ref)}" data-memory-source-ref="${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(
    shortRef(ref),
  )}</button>`;
}

function memoryReviewedLabel(value) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const elapsedMinutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (elapsedMinutes <= 0) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 48) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

function renderHandoffList() {
  const list = document.querySelector("#handoffList");
  list.replaceChildren();
  const handoffs = Array.isArray(room.socialState?.handoffs) ? room.socialState.handoffs : [];
  if (handoffs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "social-card muted-card";
    empty.innerHTML = `
      <p class="social-title">No handoffs yet</p>
      <p class="social-body">handoff 是提案，不会强制目标 agent 接管。</p>
    `;
    list.append(empty);
    return;
  }

  for (const handoff of handoffs.slice(0, 8)) {
    const card = document.createElement("article");
    card.className = "social-card handoff-card";
    card.innerHTML = `
      <div class="social-head">
        <p class="social-title">${escapeHtml(handoffDirectionLabel(handoff))}</p>
        <div class="social-actions">
          <button class="social-review-button" type="button" title="Ask room to revisit handoff" aria-label="Ask room to revisit handoff ${escapeHtml(
            handoff.handoffId,
          )}" data-handoff-review-ref="${escapeHtml(handoff.handoffId)}">?</button>
          <button class="social-context-button" type="button" title="Add handoff context ref" aria-label="Add handoff context ref ${escapeHtml(
            handoff.handoffId,
          )}" data-social-context-ref="${escapeHtml(handoff.handoffId)}">#</button>
          <span class="social-badge">${escapeHtml(handoff.status || "proposed")}</span>
        </div>
      </div>
      <p class="social-body">${escapeHtml(handoff.reason || "No reason recorded.")}</p>
      <div class="handoff-boundary">${escapeHtml(handoffBoundaryLabel(handoff))} · rejectable proposal · not control transfer</div>
      ${handoffLineageMarkup(handoff)}
      ${handoffResponsesMarkup(handoff)}
      <div class="handoff-facts" aria-label="Handoff proposal facts">
        ${handoffFactMarkup("status", handoff.status || "proposed")}
        ${handoffFactMarkup("from", handoff.fromAgentId || "agent")}
        ${handoffFactMarkup("to", handoff.toAgentId || "agent")}
        ${handoffFactMarkup("responses", handoff.responseCount ?? 0)}
      </div>
      <p class="social-note">${escapeHtml(
        handoff.requestedResponse ||
          "target may accept, reject, partially accept, delegate, challenge, or stay silent",
      )}</p>
    `;
    list.append(card);
  }
}

function handoffDirectionLabel(handoff) {
  return `${handoff.fromAgentId ?? "agent"} -> ${handoff.toAgentId ?? "agent"}`;
}

function handoffBoundaryLabel(handoff) {
  const status = handoff.status || "proposed";
  if (status === "accepted") return "accepted, not forced";
  if (status === "partially_accepted") return "partially accepted, bounded";
  if (status === "rejected") return "rejected, no transfer";
  if (status === "redirected" || status === "delegated") return "delegated as new proposal";
  if (status === "challenged") return "challenged handoff";
  return "proposal, not transfer";
}

function handoffLineageMarkup(handoff) {
  if (!handoff.topicId && !handoff.delegatedFromHandoffRef && !handoff.delegatedBy && !handoff.requestedResponse) {
    return "";
  }
  return `
    <div class="handoff-lineage">
      ${handoff.topicId ? `<span>topic ${escapeHtml(shortRef(handoff.topicId))}</span>` : ""}
      ${handoff.delegatedFromHandoffRef ? `<span>delegated from ${escapeHtml(shortRef(handoff.delegatedFromHandoffRef))}</span>` : ""}
      ${handoff.delegatedBy ? `<span>delegated by ${escapeHtml(handoff.delegatedBy)}</span>` : ""}
      ${handoff.requestedResponse ? `<span>requested ${escapeHtml(handoff.requestedResponse)}</span>` : ""}
    </div>
  `;
}

function handoffResponsesMarkup(handoff) {
  const responses = Array.isArray(handoff.responses) ? handoff.responses.slice(-3).reverse() : [];
  if (responses.length === 0) {
    return "";
  }
  return `
    <div class="handoff-responses" aria-label="Handoff response chain">
      ${responses
        .map(
          (response) => `
            <div class="handoff-response">
              <strong>${escapeHtml(response.byAgentId || "agent")} ${escapeHtml(response.response || "responded")}</strong>
              <span>${escapeHtml(handoffResponseDetail(response))}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function handoffResponseDetail(response) {
  return [
    response.redirectTo ? `redirect to ${response.redirectTo}` : "",
    response.acceptedScopeSummary ? `scope ${response.acceptedScopeSummary}` : "",
    response.reason || "no reason recorded",
  ]
    .filter(Boolean)
    .join(" · ");
}

function handoffFactMarkup(label, value) {
  return `
    <span class="handoff-fact">
      <strong>${escapeHtml(value ?? "")}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function renderProtocolList() {
  const list = document.querySelector("#protocolList");
  list.replaceChildren();
  const protocols = Array.isArray(room.socialState?.protocols) ? room.socialState.protocols : [];
  if (protocols.length === 0) {
    const empty = document.createElement("div");
    empty.className = "social-card muted-card";
    empty.innerHTML = `
      <p class="social-title">No protocols yet</p>
      <p class="social-body">协议是临时会话礼仪，可接受、反对、修订或废弃。</p>
    `;
    list.append(empty);
    return;
  }

  for (const protocol of protocols.slice(0, 8)) {
    const card = document.createElement("article");
    card.className = "social-card protocol-card";
    card.innerHTML = `
      <div class="social-head">
        <p class="social-title">${escapeHtml(protocol.protocolId)} · ${escapeHtml(protocol.scope || "unknown scope")}</p>
        <div class="social-actions">
          <button class="social-review-button" type="button" title="Ask room to revisit protocol" aria-label="Ask room to revisit protocol ${escapeHtml(
            protocol.protocolId,
          )}" data-protocol-review-ref="${escapeHtml(protocol.protocolId)}">?</button>
          <button class="social-context-button" type="button" title="Add protocol context ref" aria-label="Add protocol context ref ${escapeHtml(
            protocol.protocolId,
          )}" data-social-context-ref="${escapeHtml(protocol.protocolId)}">#</button>
          <span class="social-badge">${escapeHtml(protocol.status || "proposed")}</span>
        </div>
      </div>
      <p class="social-body">${escapeHtml(protocol.summary || "No summary recorded.")}</p>
      <div class="protocol-boundary">${escapeHtml(protocolBoundaryLabel(protocol))} · temporary etiquette · not command flow</div>
      ${protocolLineageMarkup(protocol)}
      <div class="protocol-facts" aria-label="Protocol scope and lifetime">
        ${protocolFactMarkup("status", protocol.status || "proposed")}
        ${protocolFactMarkup("scope", protocol.scope || "unknown")}
        ${protocolFactMarkup("lifetime", protocolLifetimeLabel(protocol))}
        ${protocolFactMarkup("responses", protocol.responseCount ?? 0)}
      </div>
      <p class="social-note">${escapeHtml(
        protocol.boundaryNote || "pending protocols are discussable; only accepted protocols become temporary etiquette",
      )}</p>
    `;
    list.append(card);
  }
}

function protocolLineageMarkup(protocol) {
  if (!protocol.revisedFromProtocolRef && !protocol.revisedBy && !protocol.proposedBy && !protocol.topicId) {
    return "";
  }
  return `
    <div class="protocol-lineage">
      ${protocol.proposedBy ? `<span>by ${escapeHtml(protocol.proposedBy)}</span>` : ""}
      ${protocol.topicId ? `<span>topic ${escapeHtml(shortRef(protocol.topicId))}</span>` : ""}
      ${protocol.revisedFromProtocolRef ? `<span>revised from ${escapeHtml(shortRef(protocol.revisedFromProtocolRef))}</span>` : ""}
      ${protocol.revisedBy ? `<span>revised by ${escapeHtml(protocol.revisedBy)}</span>` : ""}
    </div>
  `;
}

function protocolFactMarkup(label, value) {
  return `
    <span class="protocol-fact">
      <strong>${escapeHtml(value ?? "")}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function protocolBoundaryLabel(protocol) {
  const status = protocol.status || "proposed";
  if (status === "active" || status === "accepted") return "active but temporary";
  if (status === "expired" || status === "retired" || status === "rejected") return "historical only";
  if (status === "challenged" || status === "contested") return "contested proposal";
  if (status === "revised") return "revised proposal";
  return "proposal, not guidance";
}

function protocolLifetimeLabel(protocol) {
  const expiresAt = protocol.expiresAt;
  if (!expiresAt) return "no expiry recorded";
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return "invalid expiry";
  const remainingMs = expiresMs - Date.now();
  if (remainingMs <= 0) return "expired";
  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes < 60) return `expires in ${remainingMinutes}m`;
  const remainingHours = Math.ceil(remainingMinutes / 60);
  if (remainingHours < 48) return `expires in ${remainingHours}h`;
  return `expires in ${Math.ceil(remainingHours / 24)}d`;
}

function renderArchiveList() {
  const list = document.querySelector("#archiveList");
  list.replaceChildren();
  const archives = Array.isArray(room.socialState?.archives) ? room.socialState.archives : [];
  if (archives.length === 0) {
    const empty = document.createElement("div");
    empty.className = "social-card muted-card";
    empty.innerHTML = `
      <p class="social-title">No daily archive yet</p>
      <p class="social-body">归档是压缩后的时间骨架，不等于共识。</p>
    `;
    list.append(empty);
    return;
  }

  for (const archive of archives.slice(0, 6)) {
    const card = document.createElement("article");
    card.className = "social-card archive-card";
    card.innerHTML = `
      <div class="social-head">
        <p class="social-title">${escapeHtml(archive.date)} · ${escapeHtml(archive.archiveId)}</p>
        <div class="social-actions">
          <button class="social-context-button" type="button" title="Add archive context ref" aria-label="Add archive context ref ${escapeHtml(
            archive.archiveId,
          )}" data-social-context-ref="${escapeHtml(archive.archiveId)}">#</button>
          <span class="social-badge">${archive.revisionOf ? "revision" : "time skeleton"}</span>
        </div>
      </div>
      <p class="social-body">${escapeHtml(archive.summary || "No archive summary recorded.")}</p>
      <div class="archive-boundary">not consensus · compressed room time · ref ${escapeHtml(shortRef(archive.archiveId))}</div>
      ${archive.revisionOf || archive.appliedRepairRef ? archiveRevisionMarkup(archive) : ""}
      ${archiveContinuityMarkup(archive)}
      <div class="archive-stats" aria-label="Archive projection counts">
        ${archiveStatMarkup("events", archive.eventCount)}
        ${archiveStatMarkup("memory", archive.memoryChangeCount)}
        ${archiveStatMarkup("continuity", archive.agentContinuityCount)}
        ${archiveStatMarkup("role claims", archive.roleClaimCount)}
        ${archiveStatMarkup("daily mood", archive.dailyMoodCount)}
        ${archiveStatMarkup("open questions", archive.openQuestionTraceCount)}
        ${archiveStatMarkup("topics", archive.topicProposalCount)}
        ${archiveStatMarkup("handoffs", archive.handoffCount)}
        ${archiveStatMarkup("protocols", archive.protocolCount)}
        ${archiveStatMarkup("silences", archive.silenceCount)}
        ${archiveStatMarkup("contested", archive.contestedCount)}
        ${archiveStatMarkup("pressure", archive.pressureBoundaryCount)}
        ${archiveStatMarkup("providers", archive.providerBoundaryCount)}
      </div>
      <p class="social-note">${escapeHtml(archive.revisionReason || archive.compressionNote || "archive_is_compression_not_consensus")}</p>
    `;
    list.append(card);
  }
}

function archiveContinuityMarkup(archive) {
  const rows = archiveContinuityRows(archive).slice(0, 3);
  if (rows.length === 0) return "";
  return `
    <div class="archive-continuity" aria-label="Archive agent continuity sediment">
      ${rows
        .map(
          (row) => `
            <div class="archive-continuity-row">
              <strong>${escapeHtml(`${row.agentId} · ${row.kind}`)}</strong>
              <span>${escapeHtml(`${row.label} (${row.status})`)}</span>
              <small>${escapeHtml(`${row.evidenceRefs.length} ${archiveContinuityEvidenceLabel(row)}`)}</small>
              ${
                row.ref
                  ? `<button class="social-context-button" type="button" title="Add continuity context ref" aria-label="Add continuity context ref ${escapeHtml(
                      row.ref,
                    )}" data-social-context-ref="${escapeHtml(row.ref)}">#</button>`
                  : ""
              }
              ${archiveContinuityRefButtonsMarkup(row)}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function archiveContinuityEvidenceLabel(row) {
  return row.status === "accepted" ? "accepted continuity evidence refs" : "continuity evidence refs";
}

function archiveContinuityRefButtonsMarkup(row) {
  const evidenceRefs = uniqueRoomRefs(row.evidenceRefs ?? []).slice(0, 6);
  const label = archiveContinuityEvidenceLabel(row);
  if (evidenceRefs.length === 0) {
    return `<div class="archive-continuity-refs empty">no ${escapeHtml(label)}</div>`;
  }
  return `
    <div class="archive-continuity-refs" aria-label="${escapeHtml(label)}">
      ${evidenceRefs
        .map(
          (ref) =>
            `<button class="overview-ref-button compact" type="button" title="Add ${escapeHtml(label)}" aria-label="Add ${escapeHtml(label)} ${escapeHtml(
              ref,
            )}" data-continuity-evidence-ref="${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function archiveRevisionMarkup(archive) {
  return `
    <div class="archive-revision">
      ${archive.revisionOf ? `<span>revision of ${escapeHtml(shortRef(archive.revisionOf))}</span>` : ""}
      ${archive.appliedRepairRef ? `<span>repair ${escapeHtml(shortRef(archive.appliedRepairRef))}</span>` : ""}
    </div>
  `;
}

function archiveStatMarkup(label, value) {
  return `
    <span class="archive-stat">
      <strong>${escapeHtml(value ?? 0)}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function archiveReviewKindLabel(kind) {
  if (kind === "review_request") return "review request";
  if (kind === "repair_proposal") return "repair proposal";
  if (kind === "repair_review") return "repair review";
  if (kind === "repair_response") return "repair response";
  if (kind === "repair_application") return "repair applied";
  return kind || "review";
}

function roomRhythmActionLabel(action) {
  if (action === "archive_and_invite_review") return "archive + review invitation";
  if (action === "review_open_archive") return "review invitation";
  if (action === "memory_hygiene_review") return "memory hygiene";
  if (action === "continuity_review") return "continuity review";
  if (action === "provider_boundary_review") return "provider boundary review";
  if (action === "open_question_revisit") return "open question revisit";
  if (action === "invitation_review") return "invitation review";
  if (action === "handoff_review") return "handoff review";
  if (action === "idle_social_rhythm") return "idle social rhythm";
  if (action === "silence_reentry") return "silence re-entry";
  if (action === "stay_silent") return "preserved silence";
  return action || "room rhythm";
}

function renderProviderBoundaryList() {
  const list = document.querySelector("#providerBoundaryList");
  list.replaceChildren();
  const boundaries = Array.isArray(room.socialState?.providerBoundaries) ? room.socialState.providerBoundaries : [];
  if (boundaries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "social-card muted-card";
    empty.innerHTML = `
      <p class="social-title">No provider boundaries yet</p>
      <p class="social-body">provider boundary 是运行时可见边界，不是 agent 的沉默、同意或失败人格。</p>
    `;
    list.append(empty);
    return;
  }

  const activeBoundaries = boundaries.filter((boundary) => !providerBoundaryIsStale(boundary));
  const visibleBoundaries = providerBoundaryFilter === "all" ? boundaries : activeBoundaries;
  list.append(providerBoundaryControls(boundaries.length, activeBoundaries.length));

  if (visibleBoundaries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "social-card muted-card";
    empty.innerHTML = `
      <p class="social-title">Only stale provider boundaries are hidden</p>
      <p class="social-body">切到 all 可以查看历史运行时边界；active 默认只保留当前 degraded 或 24 小时内的记录。</p>
    `;
    list.append(empty);
    return;
  }

  for (const boundary of visibleBoundaries.slice(0, 8)) {
    const providerLabel = boundary.providerLabel ?? boundary.providerKind ?? "provider";
    const agentLabel = boundary.agentId ?? "agent";
    const repeatCount = providerBoundaryRepeatCount(boundary);
    const isStale = providerBoundaryIsStale(boundary);
    const isRetired = boundary.status === "retired";
    const row = document.createElement("article");
    row.className = `social-card provider-boundary-card${isStale ? " stale" : ""}${isRetired ? " retired" : ""}`;
    row.innerHTML = `
      <div class="social-head">
        <p class="social-title">${escapeHtml(agentLabel)} · ${escapeHtml(providerLabel)}</p>
        <div class="social-actions">
          <button class="social-repair-button" type="button" title="Ask room to discuss provider boundary repair" aria-label="Ask repair for provider boundary ${escapeHtml(
            boundary.boundaryId,
          )}" data-provider-boundary-repair-ref="${escapeHtml(boundary.boundaryId)}">↻</button>
          <button class="social-context-button" type="button" title="Add provider boundary context ref" aria-label="Add provider boundary context ref ${escapeHtml(
            boundary.boundaryId,
          )}" data-social-context-ref="${escapeHtml(boundary.boundaryId)}">#</button>
          <span class="social-badge">${escapeHtml(providerBoundaryStatusLabel(boundary, isStale))}</span>
        </div>
      </div>
      <p class="social-body">${escapeHtml(providerBoundaryRoomBody(boundary, isRetired))}</p>
      <div class="provider-boundary-warning">${escapeHtml(providerBoundaryWarningLabel(boundary, repeatCount, isStale))}</div>
      <div class="provider-boundary-facts" aria-label="Provider boundary facts">
        ${providerBoundaryFactMarkup("agent", agentLabel)}
        ${providerBoundaryFactMarkup("provider", providerLabel)}
        ${providerBoundaryFactMarkup("status", boundary.status ?? "degraded")}
        ${providerBoundaryFactMarkup("diagnostic", providerBoundaryDiagnosticLabel(boundary))}
        ${providerBoundaryFactMarkup("repeat", repeatCount > 1 ? `${repeatCount} records` : "single")}
        ${providerBoundaryFactMarkup("age", providerBoundaryAgeLabel(boundary))}
        ${boundary.retiredBy ? providerBoundaryFactMarkup("retired by", boundary.retiredBy) : ""}
      </div>
      ${providerBoundaryChoicePressureMarkup(boundary.choicePressure)}
      ${providerBoundaryRefsMarkup(boundary)}
      ${boundary.retirementReason ? `<p class="social-note">${escapeHtml(boundary.retirementReason)}</p>` : ""}
      <p class="social-note">${escapeHtml(boundary.boundaryNote || "provider degradation is not agent silence")}</p>
    `;
    list.append(row);
  }
}

function providerBoundaryRoomBody(boundary, isRetired = false) {
  if (isRetired) {
    return "Retired provider-boundary pressure stays as historical evidence; it does not delete ledger/archive history or become agent personality.";
  }
  const note = boundary.boundaryNote || "provider degradation is runtime availability evidence, not agent silence";
  return `Provider availability changed. ${note}. The room may discuss repair, retry, silence, memory contest, or archive carryover as separate choices.`;
}

function providerBoundaryDiagnosticLabel(boundary) {
  return boundary.diagnostic ? "recorded as bounded evidence" : "none recorded";
}

function providerBoundaryChoicePressureMarkup(choicePressure) {
  if (!choicePressure) {
    return "";
  }
  const choiceTotal = providerBoundaryChoicePressureTraceCount(choicePressure);
  if (choiceTotal === 0) {
    return `
      <div class="provider-choice-pressure muted">
        <strong>choice pressure</strong>
        <span>no repair, retry, silence, denial, memory contest, or archive carryover yet</span>
      </div>
    `;
  }
  const pressureFlags = [
    choicePressure.hasMixedChoices ? "mixed choices" : "",
    choicePressure.hasMultiAgentPressure ? "multi-agent" : "",
    choicePressure.carriedAcrossArchives ? "cross-archive" : "",
  ].filter(Boolean);
  const refs = providerBoundaryChoicePressureRefs(choicePressure);
  return `
    <div class="provider-choice-pressure">
      <div class="provider-choice-head">
        <strong>choice pressure</strong>
        <span>${escapeHtml(pressureFlags.length > 0 ? pressureFlags.join(" · ") : "separate social traces")}</span>
      </div>
      <div class="provider-choice-facts" aria-label="Provider boundary choice pressure facts">
        ${providerBoundaryFactMarkup("repair", safeLength(choicePressure.repairRequestRefs))}
        ${providerBoundaryFactMarkup("denied", safeLength(choicePressure.deniedRepairRequestRefs))}
        ${providerBoundaryFactMarkup("retry", safeLength(choicePressure.retryProtocolRefs))}
        ${providerBoundaryFactMarkup("silence", safeLength(choicePressure.silenceRefs))}
        ${providerBoundaryFactMarkup("memory contest", safeLength(choicePressure.contestedMemoryRefs))}
        ${providerBoundaryFactMarkup("archives", safeLength(choicePressure.archiveCarryoverRefs))}
        ${providerBoundaryFactMarkup("agents", safeLength(choicePressure.choiceAgentIds))}
      </div>
      ${providerBoundaryChoiceRefsMarkup(refs)}
      <p class="social-note">${escapeHtml(
        choicePressure.boundaryNote ||
          "choice pressure is observation only; the room still decides what these traces mean",
      )}</p>
    </div>
  `;
}

function providerBoundaryChoicePressureSummary(choicePressure) {
  if (!choicePressure) {
    return "no choice pressure yet";
  }
  const choiceTotal = providerBoundaryChoicePressureTraceCount(choicePressure);
  if (choiceTotal === 0) {
    return "no choice pressure yet";
  }
  const pressureFlags = [
    choicePressure.hasMixedChoices ? "mixed choices" : "",
    choicePressure.hasMultiAgentPressure ? "multi-agent" : "",
    choicePressure.carriedAcrossArchives ? "cross-archive" : "",
  ].filter(Boolean);
  const flagLine = pressureFlags.length > 0 ? ` · ${pressureFlags.join(" · ")}` : "";
  return `${choiceTotal} choice pressure traces${flagLine}`;
}

function providerBoundaryChoicePressureTraceCount(choicePressure) {
  if (!choicePressure) {
    return 0;
  }
  return (
    safeLength(choicePressure.repairRequestRefs) +
    safeLength(choicePressure.deniedRepairRequestRefs) +
    safeLength(choicePressure.approvedRepairRequestRefs) +
    safeLength(choicePressure.resultRefs) +
    safeLength(choicePressure.retryProtocolRefs) +
    safeLength(choicePressure.retiredRetryProtocolRefs) +
    safeLength(choicePressure.silenceRefs) +
    safeLength(choicePressure.contestedMemoryRefs) +
    safeLength(choicePressure.archiveCarryoverRefs)
  );
}

function providerBoundaryChoicePressureRefs(choicePressure) {
  if (!choicePressure) {
    return [];
  }
  return Array.from(
    new Set(
      [
        ...(choicePressure.repairRequestRefs ?? []),
        ...(choicePressure.deniedRepairRequestRefs ?? []),
        ...(choicePressure.approvedRepairRequestRefs ?? []),
        ...(choicePressure.resultRefs ?? []),
        ...(choicePressure.retryProtocolRefs ?? []),
        ...(choicePressure.retiredRetryProtocolRefs ?? []),
        ...(choicePressure.silenceRefs ?? []),
        ...(choicePressure.contestedMemoryRefs ?? []),
        ...(choicePressure.archiveCarryoverRefs ?? []),
      ].filter((ref) => typeof ref === "string" && ref.length > 0),
    ),
  );
}

function providerBoundaryChoiceRefsMarkup(refs) {
  const unique = Array.from(new Set((refs ?? []).filter((ref) => typeof ref === "string" && ref.length > 0))).slice(0, 8);
  if (unique.length === 0) {
    return "";
  }
  return `
    <div class="provider-choice-refs" aria-label="Provider boundary choice pressure refs">
      ${unique.map((ref) => `<span title="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</span>`).join("")}
    </div>
  `;
}

function safeLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function providerBoundaryControls(totalCount, activeCount) {
  const hiddenCount = Math.max(0, totalCount - activeCount);
  const controls = document.createElement("div");
  controls.className = "provider-boundary-controls";
  controls.innerHTML = `
    <div>
      <strong>${escapeHtml(activeCount)} active</strong>
      <span>${escapeHtml(hiddenCount)} hidden stale · ${escapeHtml(totalCount)} total runtime boundaries</span>
    </div>
    <div class="provider-boundary-filter" role="group" aria-label="Provider boundary filter">
      <button type="button" class="${providerBoundaryFilter === "active" ? "active" : ""}" aria-pressed="${
        providerBoundaryFilter === "active"
      }" data-provider-boundary-filter="active">active</button>
      <button type="button" class="${providerBoundaryFilter === "all" ? "active" : ""}" aria-pressed="${
        providerBoundaryFilter === "all"
      }" data-provider-boundary-filter="all">all</button>
    </div>
  `;
  return controls;
}

function providerBoundaryWarningLabel(boundary, repeatCount, isStale) {
  const state =
    boundary.status === "retired"
      ? "retired runtime pressure"
      : isStale
        ? "stale runtime record"
        : "runtime availability";
  const repeat = repeatCount > 1 ? `repeated ${repeatCount} times` : "single record";
  const topic = boundary.topicId ? `topic ${shortRef(boundary.topicId)}` : "no topic claim";
  return `${state} · not agent silence · not personality · not deletion · ${repeat} · ${topic}`;
}

function providerBoundaryStatusLabel(boundary, isStale) {
  if (boundary.status === "retired") return "retired";
  return isStale ? "stale" : "runtime";
}

function providerBoundaryAgeLabel(boundary) {
  const elapsedMs = providerBoundaryAgeMs(boundary);
  if (elapsedMs === null) {
    return "age unknown";
  }
  if (elapsedMs < 60_000) {
    return "just now";
  }
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

function providerBoundaryAgeMs(boundary) {
  const timestamp = Date.parse(boundary.updatedAt ?? "");
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.max(0, Date.now() - timestamp);
}

function providerBoundaryIsStale(boundary) {
  if (boundary.status === "retired") {
    return true;
  }
  if (providerBoundaryIsCurrent(boundary)) {
    return false;
  }
  const ageMs = providerBoundaryAgeMs(boundary);
  return ageMs !== null && ageMs > PROVIDER_BOUNDARY_ACTIVE_WINDOW_MS;
}

function providerBoundaryIsCurrent(boundary) {
  const agent = room.agents.find((item) => item.id === boundary.agentId);
  return agent?.status === "degraded" || agent?.mode === "degraded";
}

function providerBoundaryRepeatCount(boundary) {
  const key = providerBoundaryIdentity(boundary);
  const boundaries = Array.isArray(room.socialState?.providerBoundaries) ? room.socialState.providerBoundaries : [];
  return boundaries.filter((item) => providerBoundaryIdentity(item) === key).length;
}

function providerBoundaryIdentity(boundary) {
  return [boundary.agentId ?? "agent", boundary.providerKind ?? boundary.providerLabel ?? "provider"].join("::");
}

function providerBoundaryFactMarkup(label, value) {
  return `
    <span class="provider-boundary-fact">
      <strong>${escapeHtml(value ?? "unknown")}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `;
}

function providerBoundaryRefsMarkup(boundary) {
  const refs = Array.from(new Set([boundary.triggeringEventId, boundary.packetId, ...(boundary.sourceRefs ?? [])].filter(Boolean)));
  if (refs.length === 0) {
    return `<div class="provider-boundary-refs empty">no context refs recorded</div>`;
  }
  return `
    <div class="provider-boundary-refs" aria-label="Provider boundary refs">
      ${refs
        .slice(0, 5)
        .map((ref) => `<span>${escapeHtml(shortRef(ref))}</span>`)
        .join("")}
    </div>
  `;
}

function renderSocialList(selector, items, emptyTitle, emptyBody, mapItem) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "social-card muted-card";
    empty.innerHTML = `
      <p class="social-title">${escapeHtml(emptyTitle)}</p>
      <p class="social-body">${escapeHtml(emptyBody)}</p>
    `;
    list.append(empty);
    return;
  }

  for (const item of items.slice(0, 8)) {
    const view = mapItem(item);
    const row = document.createElement("article");
    row.className = "social-card";
    row.innerHTML = `
      <div class="social-head">
        <p class="social-title">${escapeHtml(view.title)}</p>
        <div class="social-actions">
          ${
            view.repairRef
              ? `<button class="social-repair-button" type="button" title="Ask room to discuss provider boundary repair" aria-label="Ask repair for provider boundary ${escapeHtml(view.repairRef)}" data-provider-boundary-repair-ref="${escapeHtml(view.repairRef)}">↻</button>`
              : ""
          }
          ${
            view.memoryReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to review memory claim" aria-label="Ask review for memory claim ${escapeHtml(view.memoryReviewRef)}" data-memory-claim-review-ref="${escapeHtml(view.memoryReviewRef)}">?</button>`
              : ""
          }
          ${
            view.questionReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to revisit open question" aria-label="Ask review for open question ${escapeHtml(view.questionReviewRef)}" data-open-question-review-ref="${escapeHtml(view.questionReviewRef)}">?</button>`
              : ""
          }
          ${
            view.personaReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to review persona delta" aria-label="Ask review for persona delta ${escapeHtml(view.personaReviewRef)}" data-persona-delta-review-ref="${escapeHtml(view.personaReviewRef)}">?</button>`
              : ""
          }
          ${
            view.topicProposalReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to review topic proposal" aria-label="Ask review for topic proposal ${escapeHtml(view.topicProposalReviewRef)}" data-topic-proposal-review-ref="${escapeHtml(view.topicProposalReviewRef)}">?</button>`
              : ""
          }
          ${
            view.invitationReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to review invitation" aria-label="Ask review for invitation ${escapeHtml(view.invitationReviewRef)}" data-invitation-review-ref="${escapeHtml(view.invitationReviewRef)}">?</button>`
              : ""
          }
          ${
            view.sideEffectReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to review side-effect request" aria-label="Ask review for side-effect request ${escapeHtml(view.sideEffectReviewRef)}" data-side-effect-review-ref="${escapeHtml(view.sideEffectReviewRef)}">?</button>`
              : ""
          }
          ${
            view.workspaceArtifactReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to review workspace artifact" aria-label="Ask review for workspace artifact ${escapeHtml(view.workspaceArtifactReviewRef)}" data-workspace-artifact-review-ref="${escapeHtml(view.workspaceArtifactReviewRef)}">?</button>`
              : ""
          }
          ${
            view.skillCapsuleReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to review skill capsule" aria-label="Ask review for skill capsule ${escapeHtml(view.skillCapsuleReviewRef)}" data-skill-capsule-review-ref="${escapeHtml(view.skillCapsuleReviewRef)}">?</button>`
              : ""
          }
          ${
            view.capabilityReviewRef
              ? `<button class="social-review-button" type="button" title="Ask room to review capability hint" aria-label="Ask review for capability hint ${escapeHtml(view.capabilityReviewRef)}" data-capability-review-ref="${escapeHtml(view.capabilityReviewRef)}">?</button>`
              : ""
          }
          ${
            view.pressureReviewRef
              ? `<button class="social-review-button pressure-review-button" type="button" title="Ask room to revisit unresolved pressure" aria-label="Ask review for unresolved pressure ${escapeHtml(view.pressureReviewRef)}" data-mixed-pressure-review-ref="${escapeHtml(view.pressureReviewRef)}">?</button>`
              : ""
          }
          ${
            view.sideEffectApproveRef
              ? `<button class="social-approve-button" type="button" title="Approve side-effect permission" aria-label="Approve side-effect permission ${escapeHtml(view.sideEffectApproveRef)}" data-side-effect-approve-ref="${escapeHtml(view.sideEffectApproveRef)}"${
                  approvingSideEffectRefs.has(view.sideEffectApproveRef) ? " disabled" : ""
                }>✓</button>`
              : ""
          }
          ${
            view.sideEffectExecuteRef
              ? `<button class="social-execute-button" type="button" title="Execute approved side-effect" aria-label="Execute side-effect permission ${escapeHtml(view.sideEffectExecuteRef)}" data-side-effect-execute-ref="${escapeHtml(view.sideEffectExecuteRef)}"${
                  executingSideEffectRefs.has(view.sideEffectExecuteRef) ? " disabled" : ""
                }>▶</button>`
              : ""
          }
          ${
            view.sideEffectExpireRef
              ? `<button class="social-retire-button" type="button" title="Expire unused side-effect permission" aria-label="Expire side-effect permission ${escapeHtml(view.sideEffectExpireRef)}" data-side-effect-expire-ref="${escapeHtml(view.sideEffectExpireRef)}"${
                  expiringSideEffectRefs.has(view.sideEffectExpireRef) ? " disabled" : ""
                }>×</button>`
              : ""
          }
          ${
            view.ref
              ? `<button class="social-context-button" type="button" title="Add context ref" aria-label="Add context ref ${escapeHtml(view.ref)}" data-social-context-ref="${escapeHtml(view.ref)}">#</button>`
              : ""
          }
          <span class="social-badge">${escapeHtml(view.badge)}</span>
        </div>
      </div>
      <p class="social-body">${escapeHtml(view.body)}</p>
      ${view.detail ? `<p class="social-detail">${escapeHtml(view.detail)}</p>` : ""}
      ${socialEvidenceRefsMarkup(view.evidenceRefs, view.evidenceLabel)}
      ${socialLineageMarkup(view.lineageRefs)}
      ${view.note ? `<p class="social-note">${escapeHtml(view.note)}</p>` : ""}
    `;
    list.append(row);
  }
}

function socialEvidenceRefsMarkup(refs, label = "evidence refs") {
  const evidenceRefs = uniqueRoomRefs(refs ?? []).slice(0, 6);
  if (evidenceRefs.length === 0) {
    return "";
  }
  return `
    <div class="social-evidence-refs" aria-label="${escapeHtml(label)}">
      <span>${escapeHtml(label)}</span>
      ${evidenceRefs
        .map(
          (ref) =>
            `<button type="button" title="${escapeHtml(ref)}" aria-label="Add ${escapeHtml(label)} ${escapeHtml(ref)}" data-agent-continuity-ref="${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`,
        )
        .join("")}
    </div>
  `;
}

function socialLineageMarkup(refs) {
  const lineageRefs = uniqueRoomRefs(refs ?? []).filter((ref) => ref.startsWith("mixed_review:")).slice(0, 4);
  if (lineageRefs.length === 0) {
    return "";
  }
  return `
    <div class="social-lineage" aria-label="Pressure lineage refs">
      <span>pressure lineage</span>
      ${lineageRefs.map((ref) => lineageRefButtonMarkup(ref)).join("")}
    </div>
  `;
}

function lineageRefButtonMarkup(ref) {
  return `<button type="button" title="${escapeHtml(ref)}" aria-label="Add pressure lineage ref ${escapeHtml(ref)}" data-social-context-ref="${escapeHtml(ref)}">${escapeHtml(shortRef(ref))}</button>`;
}

function isNearBottom() {
  return messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 48;
}

function scrollToLatestMessage() {
  messageList.scrollTop = messageList.scrollHeight;
}

async function fetchJson(pathname, init) {
  if (typeof fetch !== "function") {
    return xhrJson(`${apiBase}${pathname}`, init);
  }
  const response = await fetch(`${apiBase}${pathname}`, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return body;
}

function xhrJson(url, init = {}) {
  if (typeof XMLHttpRequest !== "function") {
    throw new Error("This browser does not expose fetch or XMLHttpRequest.");
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(init.method ?? "GET", url, true);
    applyRequestHeaders(request, init.headers);
    request.onload = () => {
      let body = null;
      try {
        body = request.responseText ? JSON.parse(request.responseText) : null;
      } catch (error) {
        reject(error);
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(body?.error ?? `HTTP ${request.status}`));
        return;
      }
      resolve(body);
    };
    request.onerror = () => reject(new Error("Network request failed."));
    request.send(init.body ?? null);
  });
}

function applyRequestHeaders(request, headers) {
  if (!headers) {
    return;
  }
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    headers.forEach((value, key) => request.setRequestHeader(key, value));
    return;
  }
  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => request.setRequestHeader(key, value));
    return;
  }
  Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value));
}

function createClientMessageId() {
  if (window.crypto?.randomUUID) {
    return `client_${window.crypto.randomUUID()}`;
  }
  return `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function archiveTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
}

function archiveDate(timezone) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone || "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function latestArchive() {
  const archives = room.socialState?.archives;
  return Array.isArray(archives) && archives.length > 0 ? archives[0] : null;
}

function findSideEffect(ref) {
  const sideEffects = room.socialState?.sideEffects;
  if (!Array.isArray(sideEffects)) {
    return null;
  }
  return sideEffects.find((item) => sideEffectMatchesRef(item, ref)) ?? null;
}

function sideEffectMatchesRef(sideEffect, ref) {
  return (
    sideEffect.requestId === ref ||
    sideEffect.approvalId === ref ||
    (Array.isArray(sideEffect.contextRefs) && sideEffect.contextRefs.includes(ref))
  );
}

function latestAcceptedUnappliedArchiveRepair() {
  const reviews = room.socialState?.archiveReviews;
  if (!Array.isArray(reviews)) {
    return null;
  }
  const applied = new Set(
    reviews
      .filter((item) => item.kind === "repair_application" && item.repairRef)
      .map((item) => item.repairRef),
  );
  const accepted = new Set(
    reviews
      .filter((item) => item.kind === "repair_response" && (item.status === "accepted" || item.response === "accept"))
      .map((item) => item.repairRef)
      .filter(Boolean),
  );
  return (
    reviews.find(
      (item) =>
        item.kind === "repair_proposal" &&
        item.id &&
        accepted.has(item.id) &&
        !applied.has(item.id),
    ) ?? null
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function agentAvatarMarkup(agentId, initials) {
  return `<span class="avatar-fallback" data-agent-id="${escapeHtml(agentId)}">${escapeHtml(initials)}</span>`;
}
