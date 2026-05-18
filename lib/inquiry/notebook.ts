import type {
  InquiryNotebook,
  NotebookEntry,
  NotebookSource,
} from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

const MIN_FILLED_LENGTH = 10;

export function createNotebookFromSections(
  sections: TemplateSectionItem[],
): InquiryNotebook {
  const enabled = sections.filter((s) => s.enabled);
  return {
    entries: enabled.map((s) => ({
      sectionId: s.id,
      sectionTitle: s.title,
      content: "",
      sources: [],
      updatedAt: new Date().toISOString(),
    })),
  };
}

export function isEntryFilled(entry: NotebookEntry): boolean {
  return entry.content.trim().length >= MIN_FILLED_LENGTH;
}

export function getFilledSectionIds(notebook: InquiryNotebook): Set<string> {
  return new Set(
    notebook.entries.filter(isEntryFilled).map((e) => e.sectionId),
  );
}

export function syncNotebookSections(
  notebook: InquiryNotebook,
  sections: TemplateSectionItem[],
): InquiryNotebook {
  const enabled = sections.filter((s) => s.enabled);
  const byId = new Map(notebook.entries.map((e) => [e.sectionId, e]));
  const entries: NotebookEntry[] = enabled.map((s) => {
    const existing = byId.get(s.id);
    if (existing) {
      return { ...existing, sectionTitle: s.title };
    }
    return {
      sectionId: s.id,
      sectionTitle: s.title,
      content: "",
      sources: [],
      updatedAt: new Date().toISOString(),
    };
  });
  return { entries };
}

/** 仅更新正文，默认不追加来源（避免编辑时 sources 膨胀） */
export function setEntryContent(
  notebook: InquiryNotebook,
  sectionId: string,
  content: string,
  source?: NotebookSource,
): InquiryNotebook {
  const now = new Date().toISOString();
  return {
    entries: notebook.entries.map((e) => {
      if (e.sectionId !== sectionId) return e;
      const sources = source ? [...e.sources, source] : e.sources;
      return { ...e, content, sources, updatedAt: now };
    }),
  };
}

export function updateEntryContent(
  notebook: InquiryNotebook,
  sectionId: string,
  content: string,
  source: NotebookSource,
): InquiryNotebook {
  return setEntryContent(notebook, sectionId, content, source);
}

export function appendAnswerToNotebook(
  notebook: InquiryNotebook,
  sectionId: string,
  answerText: string,
  questionRef: string,
): InquiryNotebook {
  const entry = notebook.entries.find((e) => e.sectionId === sectionId);
  if (!entry) return notebook;

  const line = `- ${answerText.trim()}`;
  const merged = entry.content.trim()
    ? `${entry.content.trim()}\n${line}`
    : line;

  return setEntryContent(notebook, sectionId, merged, {
    type: "question",
    ref: questionRef,
    at: new Date().toISOString(),
  });
}

export function notebookToPlainText(notebook: InquiryNotebook): string {
  return notebook.entries
    .filter((e) => e.content.trim())
    .map((e) => `## ${e.sectionTitle}\n${e.content.trim()}`)
    .join("\n\n");
}
