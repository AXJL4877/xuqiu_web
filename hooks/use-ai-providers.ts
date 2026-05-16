"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type AiProviderRecord,
  providerToSettings,
} from "@/lib/ai/provider-db";
import {
  type AiSettings,
  DEFAULT_AI_SETTINGS,
  hasAiProvidersMigrated,
  isAiSettingsConfigured,
  loadAiSettingsFromStorage,
  markAiProvidersMigrated,
} from "@/lib/ai/settings";

export function useAiProviders() {
  const [providers, setProviders] = useState<AiProviderRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeProvider =
    providers.find((p) => p.id === activeId) ??
    providers.find((p) => p.isDefault) ??
    providers[0] ??
    null;

  const settings: AiSettings = activeProvider
    ? providerToSettings(activeProvider)
    : DEFAULT_AI_SETTINGS;

  const configured =
    hydrated && activeProvider != null && isAiSettingsConfigured(settings);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/providers");
      if (!res.ok) return;
      const data = (await res.json()) as {
        providers: AiProviderRecord[];
        activeId: string | null;
      };
      let list = data.providers ?? [];

      if (list.length === 0 && !hasAiProvidersMigrated()) {
        const local = loadAiSettingsFromStorage();
        if (isAiSettingsConfigured(local)) {
          const mig = await fetch("/api/ai/providers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${local.model}（已迁移）`,
              baseUrl: local.baseUrl,
              apiKey: local.apiKey,
              model: local.model,
              setDefault: true,
            }),
          });
          if (mig.ok) {
            markAiProvidersMigrated();
            const created = (await mig.json()) as { provider: AiProviderRecord };
            list = [created.provider];
            setActiveId(created.provider.id);
            setProviders(list);
            return;
          }
        }
      }

      if (list.length > 0) {
        markAiProvidersMigrated();
      }
      setProviders(list);
      setActiveId(data.activeId ?? list[0]?.id ?? null);
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectProvider = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/ai/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setDefault: true }),
      });
      if (!res.ok) return false;
      setActiveId(id);
      setProviders((prev) =>
        prev.map((p) => ({ ...p, isDefault: p.id === id })),
      );
      return true;
    },
    [],
  );

  const saveProvider = useCallback(
    async (
      input: AiSettings & { name: string },
      options?: { id?: string },
    ) => {
      const payload = {
        name: input.name.trim(),
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        model: input.model,
        setDefault: true,
      };

      const res = options?.id
        ? await fetch(`/api/ai/providers/${options.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/ai/providers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) return false;
      markAiProvidersMigrated();
      const data = (await res.json()) as { provider: AiProviderRecord };
      await load();
      setActiveId(data.provider.id);
      return true;
    },
    [load],
  );

  const deleteProvider = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/ai/providers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "删除失败");
      }
      markAiProvidersMigrated();
      await load();
      return true;
    },
    [load],
  );

  return {
    providers,
    activeId,
    activeProvider,
    settings,
    configured,
    hydrated,
    loading,
    load,
    selectProvider,
    saveProvider,
    deleteProvider,
  };
}
