import { z } from "zod";

/** 兼容 OpenAI 协议的通用 AI 配置（三要素） */
export type AiSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export const aiSettingsSchema = z.object({
  baseUrl: z.string().min(1).max(500),
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(200),
});

export const AI_SETTINGS_STORAGE_KEY = "xuqiu-ai-settings";

/** 本地配置已迁移至服务端后标记，避免删除后再次自动导入 */
export const AI_PROVIDERS_MIGRATED_KEY = "xuqiu-ai-providers-migrated";

export function markAiProvidersMigrated(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_PROVIDERS_MIGRATED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasAiProvidersMigrated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AI_PROVIDERS_MIGRATED_KEY) === "1";
  } catch {
    return false;
  }
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

/**
 * 规范 Base URL：仅去除首尾空白与末尾斜杠。
 * DeepSeek 官方为 https://api.deepseek.com（勿自动补 /v1）；
 * OpenAI 官方为 https://api.openai.com/v1，由用户按文档填写。
 */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** 常见 DeepSeek 模型名拼写纠错（保存/请求时自动修正） */
const MODEL_CORRECTIONS: Record<string, string> = {
  "deepseek-v4-falsh": "deepseek-v4-flash",
  "deepseek-v4-flsh": "deepseek-v4-flash",
  "deepseek-v4-flahs": "deepseek-v4-flash",
  "deepseek-v4-flashs": "deepseek-v4-flash",
};

export function normalizeModelName(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return trimmed;
  return MODEL_CORRECTIONS[trimmed.toLowerCase()] ?? trimmed;
}

export function normalizeAiSettings(raw: AiSettings): AiSettings {
  return {
    baseUrl: normalizeBaseUrl(raw.baseUrl),
    apiKey: raw.apiKey.trim(),
    model: normalizeModelName(raw.model),
  };
}

export function isAiSettingsConfigured(settings: AiSettings): boolean {
  return Boolean(
    settings.baseUrl.trim() &&
      settings.apiKey.trim() &&
      settings.model.trim(),
  );
}

export function parseStoredAiSettings(raw: string | null): AiSettings {
  if (!raw) return { ...DEFAULT_AI_SETTINGS };
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = z
      .object({
        baseUrl: z.string().optional(),
        apiKey: z.string().optional(),
        model: z.string().optional(),
      })
      .safeParse(json);
    if (!parsed.success) return { ...DEFAULT_AI_SETTINGS };
    return normalizeAiSettings({
      baseUrl: parsed.data.baseUrl ?? DEFAULT_AI_SETTINGS.baseUrl,
      apiKey: parsed.data.apiKey ?? "",
      model: parsed.data.model ?? DEFAULT_AI_SETTINGS.model,
    });
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function loadAiSettingsFromStorage(): AiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AI_SETTINGS };
  try {
    return parseStoredAiSettings(
      localStorage.getItem(AI_SETTINGS_STORAGE_KEY),
    );
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettingsToStorage(settings: AiSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    AI_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeAiSettings(settings)),
  );
}
