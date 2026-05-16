import { providerToSettings, rowToProvider } from "@/lib/ai/provider-db";
import type { AiSettings } from "@/lib/ai/settings";
import {
  isAiSettingsConfigured,
  normalizeAiSettings,
} from "@/lib/ai/settings";
import { getLocalUserId } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";

export type ResolvedAiConfig = AiSettings & { configured: true };

/** 从请求体解析 AI 配置；未配置完整三要素时返回 null（走演示流） */
export function resolveAiConfig(
  input: AiSettings | null | undefined,
): ResolvedAiConfig | null {
  if (!input || !isAiSettingsConfigured(input)) return null;
  const normalized = normalizeAiSettings(input);
  return { ...normalized, configured: true };
}

/** 从数据库读取当前用户的默认（或指定）已保存模型配置 */
export async function loadSavedAiConfig(
  providerId?: string | null,
): Promise<ResolvedAiConfig | null> {
  try {
    const userId = await getLocalUserId();

    if (providerId) {
      const byId = await prisma.aiProvider.findFirst({
        where: { id: providerId, userId },
      });
      if (byId) {
        return resolveAiConfig(providerToSettings(rowToProvider(byId)));
      }
    }

    const row =
      (await prisma.aiProvider.findFirst({
        where: { userId, isDefault: true },
      })) ??
      (await prisma.aiProvider.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      }));

    if (!row) return null;
    return resolveAiConfig(providerToSettings(rowToProvider(row)));
  } catch (error) {
    console.error("[loadSavedAiConfig]", error);
    return null;
  }
}

/**
 * 解析 AI 配置：优先请求体，其次服务端已保存的 DeepSeek 等配置。
 */
export async function resolveAiConfigForRequest(
  input?: AiSettings | null,
  providerId?: string | null,
): Promise<ResolvedAiConfig | null> {
  return resolveAiConfig(input) ?? (await loadSavedAiConfig(providerId));
}

/** 供前端展示的配置摘要（不含 apiKey） */
export function getAiPublicSummary(settings: AiSettings) {
  const configured = isAiSettingsConfigured(settings);
  return {
    configured,
    model: settings.model || "—",
    baseUrl: settings.baseUrl || "—",
  };
}
