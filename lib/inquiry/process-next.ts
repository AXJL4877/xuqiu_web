import type { ResolvedAiConfig } from "@/lib/ai/config";
import { generateAiNextQuestion } from "@/lib/inquiry/ai-engine";
import {
  appendAnswerToNotebook,
  createNotebookFromSections,
  syncNotebookSections,
} from "@/lib/inquiry/notebook";
import {
  buildDemoFollowUpQuestion,
  buildDemoQuestion,
} from "@/lib/inquiry/demo-engine";
import {
  allSectionsAdequate,
  countRemainingGaps,
  pickNextGapSection,
} from "@/lib/inquiry/section-status";
import { createSessionMeta } from "@/lib/inquiry/session-storage";
import type {
  InquiryAnswerPayload,
  InquiryNextResponse,
  InquiryNotebook,
  InquiryQuestion,
  InquirySessionMeta,
} from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";
import {
  estimateRemainingQuestions,
  getSectionAskCount,
} from "@/lib/inquiry/section-status";

type ProcessInput = {
  action: "start" | "answer" | "skip" | "sync_notebook";
  idea: string;
  sections: TemplateSectionItem[];
  notebook: InquiryNotebook;
  session?: InquirySessionMeta | null;
  answer?: InquiryAnswerPayload;
  questionId?: string;
  pendingQuestion?: InquiryQuestion | null;
  pendingForQuestionId?: string | null;
};

function withQuestionStem(
  session: InquirySessionMeta,
  question: InquiryNextResponse["question"],
): InquirySessionMeta {
  if (!question) return session;
  return {
    ...session,
    sectionLastStems: {
      ...(session.sectionLastStems ?? {}),
      [question.sectionId]: question.stem.slice(0, 240),
    },
  };
}

function bumpSession(
  session: InquirySessionMeta,
  questionDelta = 0,
  answeredSectionId?: string,
): InquirySessionMeta {
  const sectionAskCounts = { ...(session.sectionAskCounts ?? {}) };
  if (answeredSectionId) {
    sectionAskCounts[answeredSectionId] =
      (sectionAskCounts[answeredSectionId] ?? 0) + 1;
  }
  return {
    ...session,
    questionCount: session.questionCount + questionDelta,
    sectionAskCounts,
    updatedAt: new Date().toISOString(),
  };
}

async function nextQuestionResponse(
  session: InquirySessionMeta,
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  idea: string,
  ai: ResolvedAiConfig | null,
): Promise<InquiryNextResponse> {
  const counts = session.sectionAskCounts ?? {};
  const remaining = countRemainingGaps(sections, notebook, counts);

  if (remaining === 0 || allSectionsAdequate(sections, notebook, counts)) {
    return {
      done: true,
      question: null,
      notebook,
      session,
      mode: ai ? "live" : "demo",
    };
  }

  if (ai) {
    try {
      const { done, question } = await generateAiNextQuestion(
        ai,
        idea,
        sections,
        notebook,
        session,
      );
      if (!done && question) {
        const nextSession = withQuestionStem(session, question);
        return {
          done: false,
          question,
          notebook,
          session: nextSession,
          mode: "live",
        };
      }
      if (done && remaining === 0) {
        return { done: true, question: null, notebook, session, mode: "live" };
      }
    } catch (e) {
      console.error("[inquiry/next] AI question failed", e);
    }
  }

  const section = pickNextGapSection(sections, notebook, counts);
  if (!section) {
    return {
      done: true,
      question: null,
      notebook,
      session,
      mode: "demo",
    };
  }

  const qIndex = session.questionCount + 1;
  const est = estimateRemainingQuestions(sections, notebook, counts);
  const askCount = getSectionAskCount(section.id, counts);
  const entry = notebook.entries.find((e) => e.sectionId === section.id);

  const question =
    entry?.content.trim() && askCount >= 1
      ? buildDemoFollowUpQuestion(section, qIndex, est, askCount)
      : buildDemoQuestion(section, qIndex, est);

  return {
    done: false,
    question,
    notebook,
    session: withQuestionStem(session, question),
    mode: ai ? "live" : "demo",
  };
}

export async function processInquiryNext(
  input: ProcessInput,
  ai: ResolvedAiConfig | null = null,
): Promise<InquiryNextResponse> {
  const { action, idea, sections } = input;
  let notebook = syncNotebookSections(
    input.notebook?.entries?.length
      ? input.notebook
      : createNotebookFromSections(sections),
    sections,
  );

  let session =
    input.session ??
    createSessionMeta(idea, sections);

  if (action === "sync_notebook") {
    return nextQuestionResponse(session, sections, notebook, idea, ai);
  }

  if (action === "start") {
    session = createSessionMeta(idea, sections);
    notebook = createNotebookFromSections(sections);
    return nextQuestionResponse(session, sections, notebook, idea, ai);
  }

  if (action === "skip") {
    const sectionId =
      input.answer?.sectionId ??
      pickNextGapSection(sections, notebook, session.sectionAskCounts)?.id;
    const qIndex = session.questionCount + 1;
    if (sectionId) {
      notebook = appendAnswerToNotebook(
        notebook,
        sectionId,
        "（用户跳过，待补充）",
        `Q${qIndex}`,
      );
    }
    session = bumpSession(session, 1, sectionId);
    return nextQuestionResponse(session, sections, notebook, idea, ai);
  }

  if (action === "answer" && input.answer) {
    const { answer } = input;
    const qIndex = session.questionCount + 1;
    const text =
      answer.resolvedText?.trim() ||
      answer.text?.trim() ||
      null;
    if (text && answer.sectionId) {
      notebook = appendAnswerToNotebook(
        notebook,
        answer.sectionId,
        text,
        `Q${qIndex}`,
      );
    }
    session = bumpSession(session, 1, answer.sectionId);

    if (
      input.pendingQuestion &&
      input.pendingForQuestionId === answer.questionId
    ) {
      const pending = {
        ...input.pendingQuestion,
        questionIndex: session.questionCount,
        estimatedRemaining: input.pendingQuestion.estimatedRemaining,
      };
      return {
        done: false,
        question: pending,
        notebook,
        session: withQuestionStem(session, pending),
        mode: ai ? "live" : "demo",
        prefetched: true,
      };
    }

    return nextQuestionResponse(session, sections, notebook, idea, ai);
  }

  return nextQuestionResponse(
    bumpSession(session),
    sections,
    notebook,
    idea,
    ai,
  );
}
