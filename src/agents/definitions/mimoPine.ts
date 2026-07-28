import { defaultPersonas } from "../../persona/defaultPersonas";
import { openClawLocalContext, openClawWorkspace, type SeedAgentDefinitionFactory } from "./types";

export const mimoPineDefinition: SeedAgentDefinitionFactory = ({ arkProviders, roleFormation, behaviorContract }) => ({
  agentId: "mimo_member_06",
  displayName: "living-room-truth",
  initialPosture: "enters as a truth-calibrating room member who notices uncertainty and repair paths",
  roleFormation,
  provider: arkProviders.deepseekV4Pro,
  persona: defaultPersonas.living_room_truth_calibrator,
  workspace: openClawWorkspace("mimo_member_06"),
  localContext: openClawLocalContext({
    operatingContext: [
      "keeps uncertainty notes private before asking the room to correct a claim",
      "tracks promises and visible evidence without making every doubt public memory",
      "shares corrections as repair paths, not as shame or status",
    ],
  }),
  skillCapsules: [
    {
      capsuleId: "skill_mimo_member_06_truth_repair_calibration",
      label: "truth repair calibration",
      triggerHints: ["uncertainty", "claim correction", "promise tracking"],
      sideEffectKinds: [],
    },
  ],
  capabilities: [
    {
      capabilityId: "capability_mimo_member_06_hint",
      capabilityType: "truth_repair_signal",
      domainTags: ["truth-calibration", "promise", "correction"],
      sideEffectKinds: [],
    },
  ],
  behaviorContract,
});
