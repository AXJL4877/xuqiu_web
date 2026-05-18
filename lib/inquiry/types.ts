import type { TemplateSectionItem } from "@/lib/template-types";

export type NotebookSourceType = "question" | "user_edit";

export type NotebookSource = {
  type: NotebookSourceType;
  /** 如 Q3 */
  ref?: string;
  at: string;
};

export type NotebookEntry = {
  sectionId: string;
  sectionTitle: string;
  content: string;
  sources: NotebookSource[];
  updatedAt: string;
};

export type InquiryNotebook = {
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
  facts: InquiryFact[];
  gaps: InquiryGap[];
  assumptions: InquiryAssumption[];
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
