import { generateText } from "ai";
import { z } from "zod";

import type { ResolvedAiConfig } from "@/lib/ai/config";
import { createCompatibleOpenAI } from "@/lib/ai/openai-compatible";
import {
  buildDemoFollowUpQuestion,
  buildDemoQuestion,
} from "@/lib/inquiry/demo-engine";
import {
  buildInquirySystemPrompt,
  buildInquiryUserPrompt,
  resolveFocusSection,
} from "@/lib/inquiry/inquiry-prompt";
import {
  countRemainingGaps,
  estimateRemainingQuestions,
  getSectionAskCount,
  pickNextGapSection,
} from "@/lib/inquiry/section-status";
import type {
  InquiryNotebook,
  InquiryQuestion,
  InquirySessionMeta,
} from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

const aiOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
});

const aiQuestionSchema = z
  .object({
    sectionId: z.string().min(1).max(120),
    kind: z.enum(["single", "multi", "text"]),
    stem: z.string().min(4).max(500),
    whyAsk: z.string().min(4).max(300),
    options: z.array(aiOptionSchema).max(5).optional(),
  })
  .superRefine((q, ctx) => {
    if (q.kind === "text") return;
    if (!q.options || q.options.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "single/multi 须含 options",
        path: ["options"],
      });
    }
  });

const aiResponseSchema = z.object({
  done: z.boolean(),
  estimatedRemaining: z.number().int().min(0).max(16).optional(),
  question: aiQuestionSchema.nullable().optional(),
});

function extractJsonObject(raw: string): unknown {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(text);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("未找到 JSON");
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

function withCustomOption(
  options: z.infer<typeof aiOptionSchema>[],
): InquiryQuestion["options"] {
  return [
    ...options.map((o) => ({ id: o.id, label: o.label })),
    { id: "custom", label: "以上都不对，我来描述", isCustom: true },
  ];
}

function toInquiryQuestion(
  parsed: z.infer<typeof aiQuestionSchema>,
  questionIndex: number,
  estimatedRemaining: number,
  sections: TemplateSectionItem[],
  forceSectionId: string,
  forceTextFollowUp: boolean,
): InquiryQuestion {
  const section =
    sections.find((s) => s.id === parsed.sectionId) ??
    sections.find((s) => s.id === forceSectionId);
  const sectionId = section?.id ?? forceSectionId;
  const kind =
    forceTextFollowUp || parsed.kind === "text" ? "text" : parsed.kind;

  return {
    id: `q-ai-${sectionId}-${questionIndex}`,
    sectionId,
    kind,
    stem: parsed.stem.trim(),
    whyAsk: parsed.whyAsk.trim(),
    options:
      kind === "text"
        ? undefined
        : withCustomOption(parsed.options ?? []),
    questionIndex,
    estimatedRemaining,
  };
}

function isDuplicateStem(
  sectionId: string,
  stem: string,
  session: InquirySessionMeta,
): boolean {
  const prev = session.sectionLastStems?.[sectionId]?.trim();
  if (!prev) return false;
  const a = prev.slice(0, 80);
  const b = stem.trim().slice(0, 80);
  return a === b || (a.length > 20 && b.includes(a.slice(0, 24)));
}

export async function generateAiNextQuestion(
  ai: ResolvedAiConfig,
  idea: string,
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  session: InquirySessionMeta,
): Promise<{ done: boolean; question: InquiryQuestion | null }> {
  const counts = session.sectionAskCounts ?? {};
  const questionIndex = session.questionCount + 1;
  const gaps = countRemainingGaps(sections, notebook, counts);

  if (gaps === 0) {
    return { done: true, question: null };
  }

  const focus = resolveFocusSection(sections, notebook, counts);
  if (!focus) {
    return { done: true, question: null };
  }

  const { section, isFollowUp } = focus;
  const fallbackRemaining = estimateRemainingQuestions(
    sections,
    notebook,
    counts,
  );

  const provider = createCompatibleOpenAI(ai, { disableThinking: true });

  const result = await generateText({
    model: provider.chat(ai.model),
    system: buildInquirySystemPrompt(sections),
    prompt: buildInquiryUserPrompt(
      idea,
      sections,
      notebook,
      questionIndex,
      section.id,
      isFollowUp,
      counts,
    ),
    maxOutputTokens: 480,
  });

  const json = extractJsonObject(result.text);
  const parsed = aiResponseSchema.safeParse(json);

  if (!parsed.success) {
    console.warn("[inquiry/ai] parse failed", parsed.error.flatten());
    return fallbackQuestion(
      sections,
      notebook,
      session,
      questionIndex,
      section,
      isFollowUp,
    );
  }

  let { done, estimatedRemaining, question } = parsed.data;

  if (done && gaps > 0) {
    done = false;
    question = question ?? null;
  }

  if (done || !question) {
    if (gaps > 0) {
      return fallbackQuestion(
        sections,
        notebook,
        session,
        questionIndex,
        section,
        isFollowUp,
      );
    }
    return { done: true, question: null };
  }

  if (question.sectionId !== section.id) {
    question = { ...question, sectionId: section.id };
  }

  const remaining = estimatedRemaining ?? fallbackRemaining;
  let built = toInquiryQuestion(
    question,
    questionIndex,
    remaining,
    sections,
    section.id,
    isFollowUp,
  );

  if (isDuplicateStem(section.id, built.stem, session)) {
    return fallbackQuestion(
      sections,
      notebook,
      session,
      questionIndex,
      section,
      true,
    );
  }

  return { done: false, question: built };
}

function fallbackQuestion(
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  session: InquirySessionMeta,
  questionIndex: number,
  section: TemplateSectionItem,
  isFollowUp: boolean,
): { done: boolean; question: InquiryQuestion | null } {
  const counts = session.sectionAskCounts ?? {};
  const remaining = countRemainingGaps(sections, notebook, counts);
  if (remaining === 0) return { done: true, question: null };

  const target =
    pickNextGapSection(sections, notebook, counts) ?? section;
  const askCount = getSectionAskCount(target.id, counts);
  const entry = notebook.entries.find((e) => e.sectionId === target.id);
  const useFollowUp = isFollowUp && Boolean(entry?.content.trim());

  const question = useFollowUp
    ? buildDemoFollowUpQuestion(
        target,
        questionIndex,
        remaining,
        askCount,
      )
    : buildDemoQuestion(target, questionIndex, remaining);

  if (isDuplicateStem(target.id, question.stem, session) && useFollowUp) {
    return {
      done: false,
      question: buildDemoFollowUpQuestion(
        target,
        questionIndex,
        remaining,
        askCount + 1,
      ),
    };
  }

  return { done: false, question };
}
