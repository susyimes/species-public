import type { AgentAdapter, AgentContextPacket, AgentId, AgentIntention } from "../types";

export type ScriptedAgentStep =
  | AgentIntention
  | ((
      packet: AgentContextPacket,
      history: readonly AgentContextPacket[],
    ) => AgentIntention | Promise<AgentIntention>);

export class ScriptedAgentAdapter implements AgentAdapter {
  public readonly receivedPackets: AgentContextPacket[] = [];

  private cursor = 0;

  public constructor(
    public readonly agentId: AgentId,
    private readonly script: readonly ScriptedAgentStep[],
  ) {}

  public async requestIntention(packet: AgentContextPacket): Promise<AgentIntention> {
    this.receivedPackets.push(packet);

    const step = this.script[this.cursor];
    if (this.cursor < this.script.length) {
      this.cursor += 1;
    }

    if (step === undefined) {
      return { kind: "stay_silent", reason: "script exhausted" };
    }

    if (typeof step === "function") {
      return step(packet, this.receivedPackets);
    }

    return step;
  }
}

export function scriptedAgent(
  agentId: AgentId,
  script: readonly ScriptedAgentStep[],
): ScriptedAgentAdapter {
  return new ScriptedAgentAdapter(agentId, script);
}

export function createAgentRegistry(adapters: readonly AgentAdapter[]): Map<AgentId, AgentAdapter> {
  const registry = new Map<AgentId, AgentAdapter>();
  for (const adapter of adapters) {
    registry.set(adapter.agentId, adapter);
  }
  return registry;
}
