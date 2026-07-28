import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { maskSecret } from "../src/agents/providerConfig";
import { isTrustedProviderEndpoint, runAgentSmoke } from "../src/agents/smoke";
import { seedAgentDefinitions } from "../src/agents/definitions";
import { defaultPersonas, personaForAgent, seedAgents } from "../src";

const arkPlanModels = [
  "kimi-k2.6",
  "kimi-k2.7-code",
  "doubao-seed-2.0-pro",
  "glm-5.2",
  "minimax-m3",
  "deepseek-v4-pro",
];

test("seed agents define Ark Plan model providers without embedding secrets", () => {
  assert.equal(seedAgents.length, 6);
  assert.equal(seedAgents.every((agent) => agent.provider.kind === "volc_ark_openai"), true);
  assert.deepEqual(
    seedAgents.map((agent) => agent.provider.kind === "volc_ark_openai" ? agent.provider.model : ""),
    arkPlanModels,
  );
  assert.deepEqual(seedAgents.map((agent) => agent.displayName), arkPlanModels);

  const serialized = JSON.stringify(seedAgents);
  assert.doesNotMatch(serialized, /"api_key"\s*:/i);
  assert.doesNotMatch(serialized, /sk-[A-Za-z0-9]/);
  assert.doesNotMatch(serialized, /tp-[A-Za-z0-9]/);
  assert.doesNotMatch(serialized, /Tide|Red Path|Brick|Cinder|Swan|Thimble/);

  for (const agent of seedAgents) {
    assert.equal(agent.roleFormation.startsUnassigned, true);
    assert.equal(agent.roleFormation.source, "room_ledger_persona_delta_or_protocol");
    assert.equal(agent.initialPosture.length > 0, true);
    assert.equal(agent.behaviorContract.mayStaySilent, true);
    assert.equal(agent.behaviorContract.mayRejectHandoff, true);
    assert.equal(agent.behaviorContract.memoryIsContestable, true);
    assert.equal(agent.behaviorContract.sideEffectsRequireApproval, true);
    assert.equal(agent.workspace.publicContributionPolicy, "explicit_message_proposal_artifact_or_memory_delta");
    assert.match(agent.workspace.privateHome, new RegExp(`^agents/${agent.agentId}/$`));
    assert.match(agent.workspace.scratchPath, new RegExp(`^agents/${agent.agentId}/workspace/$`));
    assert.ok(agent.localContext.operatingContext.length >= 3);
    assert.match(agent.localContext.privateNotesPolicy, /agent-local/);
    assert.match(agent.localContext.publicMemoryPolicy, /message|proposal|artifact ref|memory delta/);
    assert.ok(agent.skillCapsules.length >= 1);
  }
});

test("seed agents are assembled from per-agent definition files", () => {
  const definitionDir = join(process.cwd(), "src", "agents", "definitions");

  for (const fileName of [
    "kimiTide.ts",
    "kimiRedPath.ts",
    "mimoBrick.ts",
    "mimoCinder.ts",
    "mimoSwan.ts",
    "mimoThimble.ts",
  ]) {
    assert.equal(existsSync(join(definitionDir, fileName)), true, `${fileName} should define one seed agent profile`);
  }

  const rebuilt = seedAgentDefinitions({
    arkProviders: {
      kimiK26: seedAgents[0].provider,
      kimiK27Code: seedAgents[1].provider,
      doubaoSeed20Pro: seedAgents[2].provider,
      glm52: seedAgents[3].provider,
      minimaxM3: seedAgents[4].provider,
      deepseekV4Pro: seedAgents[5].provider,
    },
    roleFormation: seedAgents[0].roleFormation,
    behaviorContract: seedAgents[0].behaviorContract,
  });

  assert.deepEqual(
    rebuilt.map((agent) => agent.agentId),
    seedAgents.map((agent) => agent.agentId),
  );
});

test("default personas provide neutral living-room tendencies for agent creation", () => {
  const personas = Object.values(defaultPersonas);

  assert.equal(personas.length, 8);
  assert.deepEqual(
    personas.map((persona) => persona.personaId),
    [
      "living_room_quiet_listener",
      "living_room_route_checker",
      "living_room_structure_observer",
      "living_room_resource_noticer",
      "living_room_patient_witness",
      "living_room_small_stepper",
      "living_room_boundary_keeper",
      "living_room_truth_calibrator",
    ],
  );

  for (const persona of personas) {
    const serialized = JSON.stringify(persona);

    assert.equal(persona.sourceStory, "living_room_seed");
    assert.match(persona.core, /room member/);
    assert.match(persona.core, /not a fixed/);
    assert.doesNotMatch(serialized, /《.+》|海的女儿|三只小猪|小红帽|灰姑娘|丑小鸭|拇指姑娘|白雪公主|木偶奇遇记/);
    assert.ok(persona.experiences.length >= 3);
    assert.ok(persona.experiences.every((experience) => experience.summary.length > 0 && experience.influence.length > 0));
    assert.ok(persona.personality.length >= 3);
    assert.ok(persona.habits.length >= 4);
    assert.ok(persona.conversationStyle.interactionRules.length >= 3);
    assert.ok(persona.conversationStyle.boundaries.length >= 3);
  }

  const serialized = JSON.stringify(defaultPersonas);
  assert.doesNotMatch(serialized, /little_mermaid|three_little|red_riding|cinderella|ugly_duckling|thumbelina|snow_white|pinocchio/);
});

test("seed agents include experiential persona defaults for agent creation", () => {
  for (const agent of seedAgents) {
    const persona = personaForAgent(agent.agentId);

    assert.ok(persona, `${agent.agentId} should have a default persona`);
    assert.equal(agent.persona, persona);
    assert.ok(agent.persona.experiences.length >= 3);
    assert.ok(agent.persona.personality.length >= 3);
    assert.ok(agent.persona.habits.length >= 4);
    assert.ok(agent.persona.conversationStyle.interactionRules.length >= 3);
    assert.ok(agent.persona.conversationStyle.boundaries.length >= 3);
  }
});

test("maskSecret never returns a full key-shaped secret", () => {
  assert.equal(maskSecret(undefined), "missing");
  assert.equal(maskSecret("short"), "present");
  assert.equal(maskSecret("fake-secret-value-1234"), "fake...1234");
});

test("agent smoke checks Ark Plan model readiness", async () => {
  const report = await runAgentSmoke();

  assert.equal(report.agents.length, 6);
  const arkAgents = report.agents.filter((agent) => agent.providerKind === "volc_ark_openai");

  assert.equal(arkAgents.length, 6);
  assert.equal(arkAgents.every((agent) => agent.checks.some((check) => check.name === "Ark API key")), true);
  assert.deepEqual(
    arkAgents.map((agent) => agent.config?.model),
    arkPlanModels,
  );

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /sk-[A-Za-z0-9]{12,}/);
  assert.doesNotMatch(serialized, /tp-[A-Za-z0-9]{12,}/);
});

test("provider endpoint smoke checks validate URL structure and host boundaries", () => {
  assert.equal(isTrustedProviderEndpoint("https://api.kimi.com/coding/v1", "api.kimi.com", "/coding"), true);
  assert.equal(
    isTrustedProviderEndpoint("https://ark.cn-beijing.volces.com/api/plan/v3", "ark.cn-beijing.volces.com", "/api/plan/v3"),
    true,
  );
  assert.equal(isTrustedProviderEndpoint("https://api.xiaomimimo.com/v1", "xiaomimimo.com", undefined, true), true);
  assert.equal(isTrustedProviderEndpoint("https://xiaomimimo.com.evil.test/v1", "xiaomimimo.com", undefined, true), false);
  assert.equal(isTrustedProviderEndpoint("https://api.kimi.com.evil.test/coding", "api.kimi.com", "/coding"), false);
  assert.equal(isTrustedProviderEndpoint("https://user@api.kimi.com/coding", "api.kimi.com", "/coding"), false);
  assert.equal(isTrustedProviderEndpoint("http://api.kimi.com/coding", "api.kimi.com", "/coding"), false);
  assert.equal(isTrustedProviderEndpoint("https://api.kimi.com/not-coding", "api.kimi.com", "/coding"), false);
});

test("seed agents start unassigned so role claims can emerge from ledger history", () => {
  const serialized = JSON.stringify(seedAgents);

  assert.doesNotMatch(serialized, /roomRole/);
  for (const agent of seedAgents) {
    assert.equal(agent.roleFormation.startsUnassigned, true);
    assert.match(agent.roleFormation.instruction, /no fixed room job/);
    assert.match(agent.roleFormation.instruction, /durable roles must emerge/);
  }
});
