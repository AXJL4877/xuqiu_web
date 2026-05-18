import { resolveAiConfigForRequest } from "@/lib/ai/config";
import {
  clearPendingQuestion,
  findInquirySessionById,
  loadPendingQuestion,
  persistInquiryNextResult,
} from "@/lib/inquiry/inquiry-session-db";
import { schedulePrefetchNextQuestion } from "@/lib/inquiry/prefetch-question";
import { processInquiryNext } from "@/lib/inquiry/process-next";
import { getLocalUserId } from "@/lib/local-user";
import { inquiryNextBodySchema } from "@/lib/schemas/api";

export const maxDuration = 60;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = inquiryNextBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    action,
    idea,
    sections,
    notebook,
    session,
    answer,
    questionId,
    ai: aiInput,
    providerId,
  } = parsed.data;
  const enabled = sections.filter((s) => s.enabled);
  if (enabled.length === 0) {
    return Response.json({ error: "至少启用一个文档板块" }, { status: 400 });
  }

  const ai = await resolveAiConfigForRequest(aiInput, providerId);

  let pendingQuestion = null;
  let pendingForQuestionId: string | null = null;
  const sessionId = session?.sessionId;

  if (sessionId && action === "answer" && answer?.questionId) {
    try {
      pendingQuestion = await loadPendingQuestion(
        sessionId,
        answer.questionId,
      );
      if (pendingQuestion) {
        pendingForQuestionId = answer.questionId;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const result = await processInquiryNext(
      {
        action,
        idea,
        sections,
        notebook,
        answer: answer
          ? {
              questionId: answer.questionId,
              sectionId: answer.sectionId,
              selectedOptionIds: answer.selectedOptionIds,
              customText: answer.customText,
              text: answer.text,
              resolvedText: answer.resolvedText,
              skipped: answer.skipped,
            }
          : undefined,
        questionId,
        session: session ?? null,
        pendingQuestion,
        pendingForQuestionId,
      },
      ai,
    );

    const phase = result.done ? "confirming" : "collecting";
    const extraMessages = [];

    if (action === "answer" && answer) {
      extraMessages.push({
        role: "user" as const,
        questionId: answer.questionId,
        sectionId: answer.sectionId,
        text:
          answer.resolvedText?.trim() ||
          answer.text?.trim() ||
          "（已回答）",
        skipped: answer.skipped,
      });
    } else if (action === "skip") {
      extraMessages.push({
        role: "user" as const,
        questionId: questionId ?? answer?.questionId,
        sectionId: answer?.sectionId,
        text: "（跳过）",
        skipped: true,
      });
    }

    if (result.question) {
      extraMessages.push({
        role: "assistant" as const,
        questionId: result.question.id,
        sectionId: result.question.sectionId,
        text: result.question.stem,
      });
    }

    if (sessionId) {
      try {
        const userId = await getLocalUserId();
        if (result.prefetched) {
          await clearPendingQuestion(sessionId);
        }
        await persistInquiryNextResult(userId, result, phase, extraMessages);

        if (!result.done && result.question) {
          void schedulePrefetchNextQuestion(
            userId,
            idea,
            sections,
            result.notebook,
            result.session,
            result.question,
            ai,
          );
        } else if (result.done) {
          await clearPendingQuestion(sessionId);
        }
      } catch (e) {
        console.warn("[inquiry/next] persist/prefetch skipped", e);
      }
    }

    return Response.json(result, {
      headers: {
        "X-Xuqiu-Mode": result.mode,
        ...(result.prefetched ? { "X-Xuqiu-Prefetched": "1" } : {}),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成问题失败";
    console.error("[ai/inquiry/next]", e);
    return Response.json({ error: message }, { status: 502 });
  }
}
