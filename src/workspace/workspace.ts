import { Projection, RefId, RoomEvent, RoomId } from "../types";

export type WorkspaceVisibility = "private";

export type WorkspaceRecord = {
  workspaceId: string;
  roomId: RoomId;
  agentId: string;
  privateHome: string;
  scratchPath: string;
  visibility: WorkspaceVisibility;
  retentionPolicy: "keep_until_archived_or_retired";
  publicContributionPolicy: "explicit_message_proposal_artifact_or_memory_delta";
  sharedArtifactRefs: RefId[];
  createdAt: string;
  boundaryNote: string;
};

export type WorkspaceArtifactRef = {
  artifactId: string;
  workspaceId: string;
  agentId: string;
  pathRef: string;
  summary: string;
  contextRefs: RefId[];
  sourcePressureRefs: RefId[];
  status: "shared";
  createdAt: string;
  boundaryNote: string;
};

export type WorkspaceView = {
  workspaces: WorkspaceRecord[];
  sharedArtifacts: WorkspaceArtifactRef[];
};

export type WorkspaceProvisionedPayload = {
  workspaceId: string;
  agentId: string;
  privateHome: string;
  scratchPath: string;
  visibility: WorkspaceVisibility;
  retentionPolicy: "keep_until_archived_or_retired";
  publicContributionPolicy: "explicit_message_proposal_artifact_or_memory_delta";
  boundaryNote: string;
};

export type WorkspaceArtifactSharedPayload = {
  artifactId: string;
  workspaceId: string;
  agentId: string;
  pathRef: string;
  summary: string;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  status: "shared";
  boundaryNote: string;
};

export class WorkspaceStore implements Projection<WorkspaceView> {
  private readonly workspaces = new Map<string, WorkspaceRecord>();
  private readonly sharedArtifacts = new Map<string, WorkspaceArtifactRef>();

  static fromEvents(events: RoomEvent[]): WorkspaceStore {
    const store = new WorkspaceStore();
    for (const event of events) store.apply(event);
    return store;
  }

  apply(event: RoomEvent): void {
    if (event.event_type === "workspace.provisioned") {
      const payload = objectPayload(event.payload);
      const workspaceId = stringValue(payload.workspaceId) ?? stringValue(payload.workspace_id);
      const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id);
      const privateHome = stringValue(payload.privateHome) ?? stringValue(payload.private_home);
      const scratchPath = stringValue(payload.scratchPath) ?? stringValue(payload.scratch_path);
      if (!workspaceId || !agentId || !privateHome || !scratchPath) return;
      this.workspaces.set(workspaceId, {
        workspaceId,
        roomId: event.room_id,
        agentId,
        privateHome,
        scratchPath,
        visibility: "private",
        retentionPolicy: "keep_until_archived_or_retired",
        publicContributionPolicy: "explicit_message_proposal_artifact_or_memory_delta",
        sharedArtifactRefs: [],
        createdAt: stringValue(payload.createdAt) ?? stringValue(payload.created_at) ?? event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "private workspace metadata only; private files do not enter public memory automatically",
      });
      return;
    }

    if (event.event_type === "workspace.artifact_shared") {
      const payload = objectPayload(event.payload);
      const artifactId = stringValue(payload.artifactId) ?? stringValue(payload.artifact_id);
      const workspaceId = stringValue(payload.workspaceId) ?? stringValue(payload.workspace_id);
      const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id);
      const pathRef = stringValue(payload.pathRef) ?? stringValue(payload.path_ref);
      if (!artifactId || !workspaceId || !agentId || !pathRef) return;
      const artifact: WorkspaceArtifactRef = {
        artifactId,
        workspaceId,
        agentId,
        pathRef,
        summary: stringValue(payload.summary) ?? "Shared workspace artifact ref.",
        contextRefs: refsFromPayload(payload, event.refs),
        sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
        status: "shared",
        createdAt: stringValue(payload.createdAt) ?? stringValue(payload.created_at) ?? event.occurred_at,
        boundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "artifact ref is room-visible; private workspace contents are not copied into memory",
      };
      this.sharedArtifacts.set(artifactId, artifact);
      const workspace = this.workspaces.get(workspaceId);
      if (workspace) {
        workspace.sharedArtifactRefs = uniqueRefs([...workspace.sharedArtifactRefs, artifactId]);
      }
    }
  }

  getWorkspace(workspaceId: string): WorkspaceRecord | undefined {
    const workspace = this.workspaces.get(workspaceId);
    return workspace ? cloneWorkspace(workspace) : undefined;
  }

  view(): WorkspaceView {
    return {
      workspaces: [...this.workspaces.values()].map(cloneWorkspace).sort((a, b) => a.workspaceId.localeCompare(b.workspaceId)),
      sharedArtifacts: [...this.sharedArtifacts.values()]
        .map(cloneArtifact)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.artifactId.localeCompare(b.artifactId)),
    };
  }
}

export function workspaceIdForAgent(agentId: string): string {
  return `workspace_${agentId}`;
}

export function workspaceProvisionedPayload(input: {
  agentId: string;
  privateHome: string;
  scratchPath: string;
}): WorkspaceProvisionedPayload {
  return {
    workspaceId: workspaceIdForAgent(input.agentId),
    agentId: input.agentId,
    privateHome: input.privateHome,
    scratchPath: input.scratchPath,
    visibility: "private",
    retentionPolicy: "keep_until_archived_or_retired",
    publicContributionPolicy: "explicit_message_proposal_artifact_or_memory_delta",
    boundaryNote: "private workspace metadata only; private files do not enter public memory automatically",
  };
}

function cloneWorkspace(workspace: WorkspaceRecord): WorkspaceRecord {
  return {
    ...workspace,
    sharedArtifactRefs: [...workspace.sharedArtifactRefs],
  };
}

function cloneArtifact(artifact: WorkspaceArtifactRef): WorkspaceArtifactRef {
  return {
    ...artifact,
    contextRefs: [...artifact.contextRefs],
    sourcePressureRefs: [...artifact.sourcePressureRefs],
  };
}

function refsFromPayload(payload: Record<string, unknown>, envelopeRefs: RefId[]): RefId[] {
  return uniqueRefs(
    envelopeRefs
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .concat(arrayOfStrings(payload.sourceRefs))
      .concat(arrayOfStrings(payload.source_refs))
      .concat(arrayOfStrings(payload.sourcePressureRefs))
      .concat(arrayOfStrings(payload.source_pressure_refs)),
  );
}

function pressureRefsFromPayload(payload: Record<string, unknown>, envelopeRefs: RefId[]): RefId[] {
  return refsFromPayload(payload, envelopeRefs).filter((ref) => ref.startsWith("mixed_review:"));
}

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uniqueRefs(values: RefId[]): RefId[] {
  return [...new Set(values)];
}
