import { z } from "zod";

import { aiSettingsSchema } from "@/lib/ai/settings";
import {
  fileTypeSchema,
  templateStructureSchema,
  templateSectionItemSchema,
} from "@/lib/template-types";

export const selectionActionSchema = z.enum([
  "professional",
  "expand",
  "shorten",
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

export const generateBodySchema = z.object({
  idea: z.string().min(1).max(8000),
  sections: z.array(templateSectionItemSchema).min(1),
  ai: aiSettingsSchema.optional(),
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
