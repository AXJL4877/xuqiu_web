import type { InquiryNotebook, InquirySessionMeta } from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

const STORAGE_KEY = "xuqiu-inquiry-session-v1";

export type PersistedInquirySession = {
  version: 1;
  session: InquirySessionMeta;
  notebook: InquiryNotebook;
  /** collecting | confirming */
  phase: "collecting" | "confirming";
  /** 刷新后是否自动回到询问界面 */
  inquiryOpen: boolean;
  /** 服务端 InquirySession.id（与 session.sessionId 一致） */
  dbId?: string;
  /** 服务端最后更新时间，用于与 localStorage 合并 */
  serverUpdatedAt?: string;
};

export function loadInquirySession(): PersistedInquirySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedInquirySession;
    if (parsed?.version !== 1) return null;
    if (parsed.inquiryOpen === undefined) {
      parsed.inquiryOpen = true;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveInquirySession(data: PersistedInquirySession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

const CLEARED_FLAG_KEY = "xuqiu-inquiry-cleared-v1";

export function clearInquirySession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(CLEARED_FLAG_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** 用户主动清除后，阻止 generate 页 mount 时自动恢复旧会话 */
export function wasInquiryExplicitlyCleared(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CLEARED_FLAG_KEY) != null;
  } catch {
    return false;
  }
}

export function clearInquiryClearedFlag(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CLEARED_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

export function createSessionMeta(
  idea: string,
  sections: TemplateSectionItem[],
): InquirySessionMeta {
  const now = new Date().toISOString();
  const sessionId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}`;
  return {
    sessionId,
    idea,
    sections,
    questionCount: 0,
    sectionAskCounts: {},
    sectionLastStems: {},
    startedAt: now,
    updatedAt: now,
  };
}
