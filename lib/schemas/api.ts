import { z } from "zod";

import { aiSettingsSchema } from "@/lib/ai/settings";
import {
  fileTypeSchema,
  templateStructureSchema,
  templateSectionItemSchema,
} from "@/lib/template-types";

const notebookSourceSchema = z.object({
  type: z.enum(["question", "user_edit"]),
  ref: z.string().max(32).optional(),
  at: z.string(),
});

const notebookEntryBaseSchema = z.object({
  sectionId: z.string(),
  sectionTitle: z.string(),
  content: z.string().max(50_000),
  format: z.enum(["plain", "structured"]).optional(),
  items: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
  sources: z.array(notebookSourceSchema),
  updatedAt: z.string(),
});

const notebookEntrySchema = notebookEntryBaseSchema.superRefine((entry, ctx) => {
  if (entry.format !== "structured") return;
  if (entry.items !== undefined && !Array.isArray(entry.items)) {
    ctx.addIssue({
      code: "custom",
      message: `${entry.sectionId} 的 items 须为数组`,
      path: ["items"],
    });
  }
});

export const inquiryNotebookSchema = z
  .object({
    version: z.number().int().min(1).max(2).optional(),
    format: z.enum(["plain", "structured"]).optional(),
    entries: z.array(notebookEntrySchema),
  })
  .superRefine((nb, ctx) => {
    if (nb.format !== "structured") return;
    for (let i = 0; i < nb.entries.length; i++) {
      const e = nb.entries[i];
      if (e.format === "structured" && (!e.items || !Array.isArray(e.items))) {
        ctx.addIssue({
          code: "custom",
          message: "结构化笔记板条目缺少 items 数组",
          path: ["entries", i, "items"],
        });
      }
    }
  });

const inquiryAnswerSchema = z.object({
  questionId: z.string().min(1).max(120),
  sectionId: z.string().min(1).max(120),
  selectedOptionIds: z.array(z.string().max(64)).optional(),
  customText: z.string().max(4000).optional(),
  text: z.string().max(4000).optional(),
  resolvedText: z.string().max(4000).optional(),
  skipped: z.boolean().optional(),
});

const inquirySessionMetaSchema = z.object({
  sessionId: z.string().max(80),
  idea: z.string().max(8000),
  sections: z.array(templateSectionItemSchema),
  questionCount: z.number().int().min(0),
  sectionAskCounts: z.record(z.string(), z.number().int().min(0)).optional(),
  sectionLastStems: z.record(z.string(), z.string().max(300)).optional(),
  startedAt: z.string(),
  updatedAt: z.string(),
});

export const inquiryNextBodySchema = z.object({
  action: z.enum(["start", "answer", "skip", "sync_notebook"]),
  sessionId: z.string().max(80).optional(),
  idea: z.string().min(1).max(8000),
  sections: z.array(templateSectionItemSchema).min(1),
  notebook: inquiryNotebookSchema,
  session: inquirySessionMetaSchema.optional(),
  answer: inquiryAnswerSchema.optional(),
  questionId: z.string().max(120).optional(),
  providerId: z.string().min(1).max(64).optional(),
  ai: aiSettingsSchema.optional(),
});

export const selectionActionSchema = z.enum([
  "professional",
  "expand",
  "shorten",
  "to_ts_interface",
  "add_edge_branches",
  "to_gherkin",
  "ask",
  "custom",
]);

export const selectionBodySchema = z
  .object({
    text: z.string().min(1).max(12000),
    action: selectionActionSchema,
    customPrompt: z.string().max(2000).optional(),
    question: z.string().max(2000).optional(),
    context: z.string().max(50000).optional(),
    providerId: z.string().min(1).max(64).optional(),
    ai: aiSettingsSchema.optional(),
  })
  .refine(
    (data) =>
      data.action !== "custom" || Boolean(data.customPrompt?.trim()),
    { message: "自定义修改须填写指令", path: ["customPrompt"] },
  )

const inquiryAssumptionSchema = z.object({
  id: z.string().min(1).max(80),
  sectionId: z.string().min(1).max(120),
  sectionTitle: z.string().max(100),
  text: z.string().min(1).max(2000),
});

const inquiryGapSchema = z.object({
  sectionId: z.string().min(1).max(120),
  sectionTitle: z.string().max(100),
  reason: z.string().max(500),
});

export const inquirySessionSyncBodySchema = z.object({
  version: z.literal(1),
  session: inquirySessionMetaSchema,
  notebook: inquiryNotebookSchema,
  phase: z.enum(["collecting", "confirming"]),
  inquiryOpen: z.boolean(),
});

export const inquirySessionPatchBodySchema = z.object({
  documentId: z.string().min(1).max(80).optional(),
  status: z.enum(["collecting", "confirming", "generated", "abandoned"]).optional(),
  assumptions: z.array(inquiryAssumptionSchema).optional(),
});

export const inquiryExplainBodySchema = z.object({
  term: z.string().min(1).max(200),
  idea: z.string().max(8000).optional(),
  questionStem: z.string().max(2000).optional(),
  questionWhy: z.string().max(1000).optional(),
  sectionTitle: z.string().max(100).optional(),
  options: z.array(z.string().max(500)).max(20).optional(),
  providerId: z.string().min(1).max(64).optional(),
  ai: aiSettingsSchema.optional(),
});

export const inquiryFinishBodySchema = z.object({
  idea: z.string().min(1).max(8000),
  sections: z.array(templateSectionItemSchema).min(1),
  notebook: inquiryNotebookSchema,
  session: inquirySessionMetaSchema.optional(),
  providerId: z.string().min(1).max(64).optional(),
  ai: aiSettingsSchema.optional(),
});

export const completionStrategySchema = z.enum([
  "conservative",
  "standard",
  "aggressive",
]);

export const generateBodySchema = z.object({
  idea: z.string().min(1).max(8000),
  sections: z.array(templateSectionItemSchema).min(1),
  inquirySessionId: z.string().min(1).max(80).optional(),
  notebook: inquiryNotebookSchema.optional(),
  acceptedAssumptions: z.array(inquiryAssumptionSchema).optional(),
  gaps: z.array(inquiryGapSchema).optional(),
  completionStrategy: completionStrategySchema.optional(),
  providerId: z.string().min(1).max(64).optional(),
  ai: aiSettingsSchema.optional(),
});

/** 单板块流式生成（不输出 ## 标题） */
export const generateBlockBodySchema = generateBodySchema.extend({
  sectionId: z.string().min(1).max(120),
});

export const createTemplateBodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  structure: templateStructureSchema,
  fileType: fileTypeSchema,
});

export const patchTemplateBodySchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  structure: templateStructureSchema.optional(),
  fileType: fileTypeSchema.optional(),
});

export const createAiProviderBodySchema = z.object({
  name: z.string().min(1).max(80).trim(),
  baseUrl: z.string().min(1).max(500),
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(200),
  setDefault: z.boolean().optional(),
});

export const createDocumentBodySchema = z.object({
  title: z.string().max(200).trim().optional(),
  content: z.string().max(500_000).optional(),
});

export const patchDocumentBodySchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  content: z.string().max(500_000).optional(),
});

export const patchAiProviderBodySchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  baseUrl: z.string().min(1).max(500).optional(),
  apiKey: z.string().min(1).max(500).optional(),
  model: z.string().min(1).max(200).optional(),
  setDefault: z.boolean().optional(),
});
