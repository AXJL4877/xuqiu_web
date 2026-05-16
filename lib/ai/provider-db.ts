import { normalizeAiSettings, type AiSettings } from "@/lib/ai/settings";

export type AiProviderRecord = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export function rowToProvider(row: {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AiProviderRecord {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    model: row.model,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function providerToSettings(p: Pick<AiProviderRecord, "baseUrl" | "apiKey" | "model">): AiSettings {
  return normalizeAiSettings({
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    model: p.model,
  });
}
