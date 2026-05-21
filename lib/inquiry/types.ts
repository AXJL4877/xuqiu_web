import type { TemplateSectionItem } from "@/lib/template-types";

export type NotebookSourceType = "question" | "user_edit";

export type NotebookSource = {
  type: NotebookSourceType;
  /** 如 Q3 */
  ref?: string;
  at: string;
};

export type NotebookEntryFormat = "plain" | "structured";

export type NotebookEntry = {
  sectionId: string;
  sectionTitle: string;
  /** plain：自由文本；structured：由 items 派生的展示用 Markdown */
  content: string;
  format?: NotebookEntryFormat;
  /** Vibe Coding 模板：板块专属对象数组，为唯一事实源 */
  items?: Record<string, unknown>[];
  sources: NotebookSource[];
  updatedAt: string;
};

export type InquiryNotebook = {
  /** 2 = 结构化数组条目 */
  version?: number;
  format?: NotebookEntryFormat;
  entries: NotebookEntry[];
};

export type InquiryOption = {
  id: string;
  label: string;
  /** 选中后展示自定义输入框 */
  isCustom?: boolean;
};

export type InquiryQuestionKind = "single" | "multi" | "text";

export type InquiryQuestion = {
  id: string;
  sectionId: string;
  kind: InquiryQuestionKind;
  stem: string;
  whyAsk?: string;
  options?: InquiryOption[];
  questionIndex: number;
  estimatedRemaining: number;
};

export type InquiryAnswerPayload = {
  questionId: string;
  sectionId: string;
  selectedOptionIds?: string[];
  customText?: string;
  text?: string;
  /** 客户端根据选项拼好的答案摘要 */
  resolvedText?: string;
  skipped?: boolean;
};

export type InquiryNextAction =
  | "start"
  | "answer"
  | "skip"
  | "sync_notebook";

export type InquirySessionMeta = {
  sessionId: string;
  idea: string;
  sections: TemplateSectionItem[];
  questionCount: number;
  /** 各板块已问轮数，用于触发追问 */
  sectionAskCounts?: Record<string, number>;
  /** 各板块上一题题干摘要，避免重复追问 */
  sectionLastStems?: Record<string, string>;
  startedAt: string;
  updatedAt: string;
};

export type InquiryNextResponse = {
  done: boolean;
  question: InquiryQuestion | null;
  notebook: InquiryNotebook;
  session: InquirySessionMeta;
  mode: "demo" | "live";
  /** 命中服务端预生成缓存 */
  prefetched?: boolean;
};

export type CompletionStrategy = "conservative" | "standard" | "aggressive";

export type InquiryFact = {
  sectionId: string;
  sectionTitle: string;
  content: string;
};

/** 确认页「人类视图」：大白话，不含 interface/SQL 等术语 */
export type InquiryHumanFact = {
  sectionId: string;
  sectionTitle: string;
  summary: string;
  bullets: string[];
  footnote?: string;
};

export type InquiryGap = {
  sectionId: string;
  sectionTitle: string;
  reason: string;
};

export type InquiryAssumption = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  text: string;
};

export type InquiryFinishResponse = {
  /** 技术向摘要（机器管线用，确认页不展示） */
  facts: InquiryFact[];
  /** 大白话确认稿（给人看） */
  humanFacts: InquiryHumanFact[];
  gaps: InquiryGap[];
  assumptions: InquiryAssumption[];
  /** 经架构师自检后的笔记板（客户端静默同步，确认页不展示技术原文） */
  notebook: InquiryNotebook;
  mode: "demo" | "live";
};

export type InquiryGeneratePayload = {
  idea: string;
  notebook: InquiryNotebook;
  acceptedAssumptions: InquiryAssumption[];
  gaps: InquiryGap[];
  completionStrategy: CompletionStrategy;
  inquirySessionId?: string;
};
