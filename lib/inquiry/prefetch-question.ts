import type { ResolvedAiConfig } from "@/lib/ai/config";
import { appendAnswerToNotebook } from "@/lib/inquiry/notebook";
import { processInquiryNext } from "@/lib/inquiry/process-next";
import {
  clearPendingQuestion,
  savePendingQuestion,
} from "@/lib/inquiry/inquiry-session-db";
import type {
  InquiryQuestion,
  InquiryNotebook,
  InquirySessionMeta,
} from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

const PREFETCH_PLACEHOLDER = "（预生成占位，提交后将替换为真实回答）";

/** 在展示当前题后，模拟作答并预生成下一题写入 DB */
export async function schedulePrefetchNextQuestion(
  userId: string,
  idea: string,
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  session: InquirySessionMeta,
  currentQuestion: InquiryQuestion,
  ai: ResolvedAiConfig | null,
): Promise<void> {
  if (!session.sessionId) return;

  try {
    const qIndex = session.questionCount + 1;
    const simNotebook = appendAnswerToNotebook(
      notebook,
      currentQuestion.sectionId,
      PREFETCH_PLACEHOLDER,
      `Q${qIndex}`,
    );

    const simResult = await processInquiryNext(
      {
        action: "answer",
        idea,
        sections,
        notebook: simNotebook,
        session,
        answer: {
          questionId: currentQuestion.id,
          sectionId: currentQuestion.sectionId,
          resolvedText: PREFETCH_PLACEHOLDER,
        },
      },
      ai,
    );

    if (!simResult.done && simResult.question) {
      await savePendingQuestion(
        session.sessionId,
        currentQuestion.id,
        simResult.question,
      );
    } else {
      await clearPendingQuestion(session.sessionId);
    }
  } catch (e) {
    console.warn("[inquiry/prefetch] failed", e);
    await clearPendingQuestion(session.sessionId).catch(() => {});
  }
}
