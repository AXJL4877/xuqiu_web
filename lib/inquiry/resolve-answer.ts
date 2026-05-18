import type { InquiryQuestion } from "@/lib/inquiry/types";

export function resolveAnswerText(
  question: InquiryQuestion,
  selectedOptionIds: string[] | undefined,
  customText: string | undefined,
): string | null {
  const ids = selectedOptionIds ?? [];
  if (ids.includes("custom")) {
    const t = customText?.trim();
    return t || null;
  }

  if (!question.options?.length) {
    return customText?.trim() || null;
  }

  const labels = question.options
    .filter((o) => ids.includes(o.id) && !o.isCustom)
    .map((o) => o.label);
  if (labels.length === 0) return null;
  return labels.join("、");
}
