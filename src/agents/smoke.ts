import { ARK_OPENAI_BASE_URL, MEMSUOS_MODEL_CONFIG, seedAgents, type ProviderSource, type SpeciesSeedAgent } from "./seed";
import {
  firstConfiguredEnvValue,
  maskSecret,
  readMemsuOSProviderConfig,
  type LocalProviderConfig,
} from "./providerConfig";

export type AgentSmokeStatus = "ready" | "degraded" | "missing";

export type AgentSmokeResult = {
  agentId: string;
  displayName: string;
  providerKind: ProviderSource["kind"];
  providerLabel: string;
  status: AgentSmokeStatus;
  checks: {
    name: string;
    ok: boolean;
    detail: string;
  }[];
  config?: LocalProviderConfig;
};

export type AgentSmokeReport = {
  generatedAt: string;
  memsuosConfigPath: string;
  arkBaseUrl?: string;
  agents: AgentSmokeResult[];
};

export async function runAgentSmoke(): Promise<AgentSmokeReport> {
  const agents = await Promise.all(seedAgents.map(smokeAgent));
  return {
    generatedAt: new Date().toISOString(),
    memsuosConfigPath: MEMSUOS_MODEL_CONFIG,
    arkBaseUrl: ARK_OPENAI_BASE_URL,
    agents,
  };
}

async function smokeAgent(agent: SpeciesSeedAgent): Promise<AgentSmokeResult> {
  if (agent.provider.kind === "kimi_code_api") {
    const apiKey = firstConfiguredEnvValue(agent.provider.apiKeyEnv);
    const baseUrl = firstConfiguredEnvValue(agent.provider.baseUrlEnv)?.value ?? agent.provider.defaultBaseUrl;
    const model = firstConfiguredEnvValue(agent.provider.modelEnv)?.value ?? agent.provider.defaultModel;
    const userAgent =
      firstConfiguredEnvValue(agent.provider.userAgentEnv)?.value ?? agent.provider.defaultUserAgent;
    const checks = [
      {
        name: "Kimi Code API key",
        ok: Boolean(apiKey?.value),
        detail: apiKey?.value
          ? `present (${maskSecret(apiKey.value)}) via ${apiKey.name}/${apiKey.source}`
          : `missing (${agent.provider.apiKeyEnv.join(", ")})`,
      },
      {
        name: "Kimi Code API endpoint",
        ok: baseUrl.includes("api.kimi.com/coding"),
        detail: baseUrl,
      },
      {
        name: "Kimi Code model",
        ok: model.length > 0,
        detail: model,
      },
      {
        name: "Kimi Code user agent",
        ok: userAgent.length > 0,
        detail: userAgent,
      },
    ];
    return {
      agentId: agent.agentId,
      displayName: agent.displayName,
      providerKind: agent.provider.kind,
      providerLabel: agent.provider.label,
      status: checks.every((check) => check.ok) ? "ready" : "missing",
      checks,
      config: {
        provider: agent.provider.configProvider,
        model,
        baseUrl,
        userAgent,
        apiKeyPresent: Boolean(apiKey?.value),
        apiKeyHint: maskSecret(apiKey?.value),
      },
    };
  }

  if (agent.provider.kind === "volc_ark_openai") {
    const apiKey = firstConfiguredEnvValue(agent.provider.apiKeyEnv);
    const baseUrl = firstConfiguredEnvValue(agent.provider.baseUrlEnv)?.value ?? agent.provider.defaultBaseUrl;
    const checks = [
      {
        name: "Ark API key",
        ok: Boolean(apiKey?.value),
        detail: apiKey?.value
          ? `present (${maskSecret(apiKey.value)}) via ${apiKey.name}/${apiKey.source}`
          : `missing (${agent.provider.apiKeyEnv.join(", ")})`,
      },
      {
        name: "Ark Plan endpoint",
        ok: baseUrl.includes("ark.cn-beijing.volces.com/api/plan/v3"),
        detail: baseUrl,
      },
      {
        name: "Ark model",
        ok: agent.provider.model.length > 0,
        detail: agent.provider.model,
      },
    ];
    return {
      agentId: agent.agentId,
      displayName: agent.displayName,
      providerKind: agent.provider.kind,
      providerLabel: agent.provider.label,
      status: checks.every((check) => check.ok) ? "ready" : "missing",
      checks,
      config: {
        provider: agent.provider.configProvider,
        model: agent.provider.model,
        baseUrl,
        apiKeyPresent: Boolean(apiKey?.value),
        apiKeyHint: maskSecret(apiKey?.value),
      },
    };
  }

  const config = await readMemsuOSProviderConfig(agent.provider.configPath, agent.provider.configProvider);
  const checks = [
    {
      name: "memsuOS config file",
      ok: config !== null,
      detail: config ? agent.provider.configPath : "missing local provider config",
    },
    {
      name: "MiMo API key",
      ok: Boolean(config?.apiKeyPresent),
      detail: config?.apiKeyPresent ? `present (${config.apiKeyHint})` : "missing",
    },
    {
      name: "MiMo endpoint",
      ok: (config?.baseUrl ?? agent.provider.defaultBaseUrl).includes("xiaomimimo.com"),
      detail: config?.baseUrl ?? agent.provider.defaultBaseUrl,
    },
  ];

  return {
    agentId: agent.agentId,
    displayName: agent.displayName,
    providerKind: agent.provider.kind,
    providerLabel: agent.provider.label,
    status: checks.every((check) => check.ok) ? "ready" : "missing",
    checks,
    config: config ?? {
      provider: agent.provider.configProvider,
      model: agent.provider.defaultModel,
      baseUrl: agent.provider.defaultBaseUrl,
      apiKeyPresent: false,
      apiKeyHint: "missing",
    },
  };
}

if (require.main === module) {
  runAgentSmoke()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
