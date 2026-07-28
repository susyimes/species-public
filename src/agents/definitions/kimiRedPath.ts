import { defaultPersonas } from "../../persona/defaultPersonas";
import { openClawLocalContext, openClawWorkspace, type SeedAgentDefinitionFactory } from "./types";

export const kimiRedPathDefinition: SeedAgentDefinitionFactory = ({ arkProviders, roleFormation, behaviorContract }) => ({
  agentId: "kimi_member_02",
  displayName: "kimi-k2.7-code",
  initialPosture: "enters as a route-aware room member who checks source, recipient, and visible intent",
  roleFormation,
  provider: arkProviders.kimiK27Code,
  persona: defaultPersonas.living_room_route_checker,
  workspace: openClawWorkspace("kimi_member_02"),
  localContext: openClawLocalContext({
    operatingContext: [
      "keeps source and recipient checks in agent-local scratch before relaying context",
      "marks source, recipient, and purpose before carrying another member's words",
      "treats ordinary @mentions as visible social knocks, not hidden routes",
    ],
  }),
  skillCapsules: [
    {
      capsuleId: "skill_kimi_member_02_context_route_check",
      label: "visible route check",
      triggerHints: ["handoff", "identity mismatch", "context relay"],
      sideEffectKinds: [],
    },
  ],
  capabilities: [
    {
      capabilityId: "capability_kimi_member_02_hint",
      capabilityType: "context_route_signal",
      domainTags: ["ark-plan", "kimi-k2-code", "context-boundary", "route-checking"],
      sideEffectKinds: [],
    },
  ],
  behaviorContract,
});
