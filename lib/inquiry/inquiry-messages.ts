export type InquiryMessageRole = "assistant" | "user";

export type InquiryMessage = {
  id: string;
  role: InquiryMessageRole;
  at: string;
  questionId?: string;
  sectionId?: string;
  /** 题干或用户回答摘要 */
  text: string;
  skipped?: boolean;
};

export function appendInquiryMessage(
  messages: InquiryMessage[],
  msg: Omit<InquiryMessage, "id" | "at"> & { at?: string },
): InquiryMessage[] {
  const entry: InquiryMessage = {
    id: `msg-${Date.now()}-${messages.length}`,
    at: msg.at ?? new Date().toISOString(),
    role: msg.role,
    questionId: msg.questionId,
    sectionId: msg.sectionId,
    text: msg.text,
    skipped: msg.skipped,
  };
  return [...messages, entry].slice(-80);
}

export function parseInquiryMessages(raw: unknown): InquiryMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is InquiryMessage =>
      m != null &&
      typeof m === "object" &&
      typeof (m as InquiryMessage).role === "string" &&
      typeof (m as InquiryMessage).text === "string",
  );
}
