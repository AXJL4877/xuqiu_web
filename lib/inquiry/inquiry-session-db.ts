import { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { PersistedInquirySession } from "@/lib/inquiry/session-storage";
import type {
  InquiryAssumption,
  InquiryNextResponse,
  InquiryNotebook,
  InquiryQuestion,
  InquirySessionMeta,
} from "@/lib/inquiry/types";
import {
  appendInquiryMessage,
  parseInquiryMessages,
  type InquiryMessage,
} from "@/lib/inquiry/inquiry-messages";
import type { TemplateSectionItem } from "@/lib/template-types";

export type DbInquirySessionRow = {
  id: string;
  idea: string;
  sections: unknown;
  notebook: unknown;
  messages: unknown;
  phase: string;
  status: string;
  sessionMeta: unknown;
  assumptions: unknown;
  pendingQuestion: unknown;
  pendingForQuestionId: string | null;
  documentId: string | null;
  updatedAt: Date;
};

export function rowToPersistedSession(
  row: DbInquirySessionRow,
): PersistedInquirySession & { dbId: string; updatedAt: string } {
  const meta = row.sessionMeta as InquirySessionMeta;
  return {
    version: 1,
    dbId: row.id,
    updatedAt: row.updatedAt.toISOString(),
    session: {
      ...meta,
      sessionId: row.id,
      idea: row.idea,
      sections: row.sections as TemplateSectionItem[],
    },
    notebook: row.notebook as InquiryNotebook,
    phase: row.phase === "confirming" ? "confirming" : "collecting",
    inquiryOpen: row.status !== "generated" && row.status !== "abandoned",
  };
}

export async function findActiveInquirySession(userId: string) {
  const row = await prisma.inquirySession.findFirst({
    where: {
      userId,
      status: { in: ["collecting", "confirming"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  return row;
}

export async function findInquirySessionById(userId: string, id: string) {
  return prisma.inquirySession.findFirst({
    where: { id, userId },
  });
}

export async function upsertInquirySessionFromClient(
  userId: string,
  data: PersistedInquirySession,
  options?: {
    messages?: InquiryMessage[];
    assumptions?: InquiryAssumption[] | null;
    documentId?: string | null;
    status?: string;
  },
) {
  const sessionId = data.session.sessionId;
  const status =
    options?.status ??
    (data.phase === "confirming" ? "confirming" : "collecting");

  const payload = {
    idea: data.session.idea,
    sections: data.session.sections as object,
    notebook: data.notebook as object,
    messages: (options?.messages ?? []) as object,
    phase: data.phase,
    status,
    sessionMeta: {
      ...data.session,
      sessionId,
    } as object,
    assumptions: options?.assumptions
      ? (options.assumptions as object)
      : undefined,
    documentId: options?.documentId ?? undefined,
  };

  return prisma.inquirySession.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      userId,
      ...payload,
    },
    update: payload,
  });
}

export async function deleteInquirySession(userId: string, id: string) {
  await prisma.inquirySession.deleteMany({
    where: { id, userId },
  });
}

export async function markInquirySessionGenerated(
  userId: string,
  id: string,
  documentId?: string,
) {
  await prisma.inquirySession.updateMany({
    where: { id, userId },
    data: {
      status: "generated",
      phase: "confirming",
      documentId: documentId ?? undefined,
    },
  });
}

export async function savePendingQuestion(
  sessionId: string,
  sourceQuestionId: string,
  question: InquiryQuestion,
) {
  await prisma.inquirySession.update({
    where: { id: sessionId },
    data: {
      pendingQuestion: question as object,
      pendingForQuestionId: sourceQuestionId,
    },
  });
}

export async function clearPendingQuestion(sessionId: string) {
  await prisma.inquirySession.updateMany({
    where: { id: sessionId },
    data: {
      pendingQuestion: Prisma.JsonNull,
      pendingForQuestionId: null,
    },
  });
}

export async function loadPendingQuestion(
  sessionId: string,
  forQuestionId: string,
): Promise<InquiryQuestion | null> {
  const row = await prisma.inquirySession.findUnique({
    where: { id: sessionId },
    select: { pendingQuestion: true, pendingForQuestionId: true },
  });
  if (!row?.pendingQuestion || row.pendingForQuestionId !== forQuestionId) {
    return null;
  }
  return row.pendingQuestion as InquiryQuestion;
}

export async function appendSessionMessages(
  sessionId: string,
  newMessages: InquiryMessage[],
) {
  const row = await prisma.inquirySession.findUnique({
    where: { id: sessionId },
    select: { messages: true },
  });
  const existing = parseInquiryMessages(row?.messages);
  let merged = existing;
  for (const m of newMessages) {
    merged = appendInquiryMessage(merged, m);
  }
  await prisma.inquirySession.update({
    where: { id: sessionId },
    data: { messages: merged as object },
  });
}

export async function persistInquiryNextResult(
  userId: string,
  result: InquiryNextResponse,
  phase: "collecting" | "confirming",
  extraMessages: Omit<InquiryMessage, "id" | "at">[] = [],
) {
  const existing = await findInquirySessionById(userId, result.session.sessionId);
  const messages = parseInquiryMessages(existing?.messages);
  let merged = messages;
  for (const m of extraMessages) {
    merged = appendInquiryMessage(merged, m);
  }

  await upsertInquirySessionFromClient(
    userId,
    {
      version: 1,
      session: result.session,
      notebook: result.notebook,
      phase: result.done ? "confirming" : phase,
      inquiryOpen: true,
    },
    {
      messages: merged,
      status: result.done ? "confirming" : "collecting",
    },
  );
}
