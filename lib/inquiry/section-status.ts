import type { InquiryNotebook, NotebookEntry } from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

/** 每板块至少可问轮数（含首次） */
export const MAX_QUESTIONS_PER_SECTION = 3;

const MIN_ADEQUATE_CHARS = 120;
const MIN_BULLETS_ADEQUATE = 2;

export type SectionCollectStatus = "empty" | "shallow" | "adequate";

function countBullets(content: string): number {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"));
  if (lines.length > 1) return lines.length;

  const single = lines[0]?.replace(/^-\s*/, "").trim() ?? "";
  if (!single) return 0;

  const parts = single
    .split(/[、；;]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4);
  return Math.max(1, parts.length);
}

function countQuestionSources(entry: NotebookEntry): number {
  return entry.sources.filter((s) => s.type === "question").length;
}

export function getSectionStatus(
  entry: NotebookEntry | undefined,
  askCount = 0,
): SectionCollectStatus {
  if (!entry || !entry.content.trim()) return "empty";

  const content = entry.content.trim();
  const bullets = countBullets(content);

  if (askCount >= MAX_QUESTIONS_PER_SECTION) return "adequate";

  if (content.length >= MIN_ADEQUATE_CHARS && bullets >= MIN_BULLETS_ADEQUATE) {
    return "adequate";
  }

  if (askCount >= 2 && content.length >= 72) return "adequate";

  if (bullets <= 1 && content.length < MIN_ADEQUATE_CHARS) return "shallow";
  if (content.length < 48) return "shallow";

  if (bullets >= MIN_BULLETS_ADEQUATE || content.length >= MIN_ADEQUATE_CHARS) {
    return "adequate";
  }

  return "shallow";
}

export function getSectionAskCount(
  sectionId: string,
  counts: Record<string, number> | undefined,
): number {
  return counts?.[sectionId] ?? 0;
}

export function pickNextGapSection(
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  sectionAskCounts?: Record<string, number>,
): TemplateSectionItem | null {
  const enabled = sections.filter((s) => s.enabled);
  const empty: TemplateSectionItem[] = [];
  const shallow: { section: TemplateSectionItem; askCount: number }[] = [];

  for (const s of enabled) {
    const entry = notebook.entries.find((e) => e.sectionId === s.id);
    const askCount = getSectionAskCount(s.id, sectionAskCounts);
    const status = getSectionStatus(entry, askCount);
    if (status === "empty") empty.push(s);
    else if (status === "shallow") shallow.push({ section: s, askCount });
  }

  if (empty.length > 0) return empty[0];
  if (shallow.length === 0) return null;

  shallow.sort((a, b) => a.askCount - b.askCount);
  return shallow[0].section;
}

export function countRemainingGaps(
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  sectionAskCounts?: Record<string, number>,
): number {
  const enabled = sections.filter((s) => s.enabled);
  return enabled.filter((s) => {
    const entry = notebook.entries.find((e) => e.sectionId === s.id);
    const askCount = getSectionAskCount(s.id, sectionAskCounts);
    const status = getSectionStatus(entry, askCount);
    return status === "empty" || status === "shallow";
  }).length;
}

export function allSectionsAdequate(
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  sectionAskCounts?: Record<string, number>,
): boolean {
  return countRemainingGaps(sections, notebook, sectionAskCounts) === 0;
}

export function estimateRemainingQuestions(
  sections: TemplateSectionItem[],
  notebook: InquiryNotebook,
  sectionAskCounts?: Record<string, number>,
): number {
  const enabled = sections.filter((s) => s.enabled);
  let total = 0;
  for (const s of enabled) {
    const entry = notebook.entries.find((e) => e.sectionId === s.id);
    const askCount = getSectionAskCount(s.id, sectionAskCounts);
    const status = getSectionStatus(entry, askCount);
    if (status === "empty") {
      total += Math.min(2, MAX_QUESTIONS_PER_SECTION - askCount);
    } else if (status === "shallow") {
      total += Math.min(2, MAX_QUESTIONS_PER_SECTION - askCount);
    }
  }
  return Math.max(1, Math.min(total, 12));
}

/** @deprecated 用于 UI 展示「是否有内容」 */
export function isEntryFilled(entry: NotebookEntry): boolean {
  return entry.content.trim().length >= 10;
}

export function isEntryAdequate(
  entry: NotebookEntry | undefined,
  askCount = 0,
): boolean {
  return getSectionStatus(entry, askCount) === "adequate";
}
