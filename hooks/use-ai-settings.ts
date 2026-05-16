"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type AiSettings,
  DEFAULT_AI_SETTINGS,
  isAiSettingsConfigured,
  loadAiSettingsFromStorage,
  saveAiSettingsToStorage,
} from "@/lib/ai/settings";

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setSettings(loadAiSettingsFromStorage());
    setHydrated(true);
  }, []);

  const save = useCallback((next: AiSettings) => {
    saveAiSettingsToStorage(next);
    setSettings(next);
    setSavedAt(Date.now());
  }, []);

  const configured = hydrated && isAiSettingsConfigured(settings);

  return {
    settings,
    setSettings,
    save,
    configured,
    hydrated,
    savedAt,
  };
}
