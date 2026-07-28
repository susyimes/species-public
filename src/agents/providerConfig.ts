import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";

export type LocalProviderConfig = {
  provider: string;
  model?: string;
  baseUrl?: string;
  apiKeyPresent: boolean;
  apiKeyHint: string;
  userAgent?: string;
  promptCacheKey?: string;
  workingDirectory?: string;
  extraArgs?: string[];
};

export type LocalProviderRuntimeConfig = LocalProviderConfig & {
  apiKey?: string;
};

export type ConfiguredEnvValue = {
  name: string;
  value: string;
  source: "process" | "user" | "machine";
};

export async function readMemsuOSProviderConfig(
  configPath: string,
  provider: string,
): Promise<LocalProviderConfig | null> {
  const config = await readMemsuOSProviderRuntimeConfig(configPath, provider);
  if (!config) {
    return null;
  }
  const { apiKey: _apiKey, ...publicConfig } = config;
  return publicConfig;
}

export async function readMemsuOSProviderRuntimeConfig(
  configPath: string,
  provider: string,
): Promise<LocalProviderRuntimeConfig | null> {
  try {
    await access(configPath);
  } catch {
    return null;
  }

  const decoded = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  const providers = asRecord(decoded.providers) ?? decoded;
  const config = asRecord(providers[provider]);
  if (!config) {
    return null;
  }

  const apiKey = stringValue(config.api_key);
  return {
    provider,
    model: stringValue(config.model),
    baseUrl: stringValue(config.base_url),
    apiKey,
    apiKeyPresent: Boolean(apiKey),
    apiKeyHint: maskSecret(apiKey),
    promptCacheKey: stringValue(config.prompt_cache_key),
    workingDirectory: stringValue(config.working_directory),
    extraArgs: stringArray(config.extra_args),
  };
}

export function maskSecret(secret: string | undefined): string {
  if (!secret) {
    return "missing";
  }
  if (secret.length <= 8) {
    return "present";
  }
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export function firstConfiguredEnvValue(names: readonly string[]): ConfiguredEnvValue | undefined {
  for (const name of names) {
    const processValue = process.env[name];
    if (isNonEmptyString(processValue)) {
      return { name, value: processValue.trim(), source: "process" };
    }

    const userValue = windowsRegistryEnvValue("HKCU\\Environment", name);
    if (isNonEmptyString(userValue)) {
      return { name, value: userValue.trim(), source: "user" };
    }

    const machineValue = windowsRegistryEnvValue(
      "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
      name,
    );
    if (isNonEmptyString(machineValue)) {
      return { name, value: machineValue.trim(), source: "machine" };
    }
  }
  return undefined;
}

function windowsRegistryEnvValue(keyPath: string, name: string): string | undefined {
  if (process.platform !== "win32") {
    return undefined;
  }
  try {
    const output = execFileSync("reg.exe", ["query", keyPath, "/v", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2_000,
      windowsHide: true,
    });
    const escapedName = escapeRegExp(name);
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(new RegExp(`^\\s*${escapedName}\\s+REG_\\w+\\s+(.+?)\\s*$`, "i"));
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}
