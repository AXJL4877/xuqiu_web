import type {
  InquiryNotebook,
  NotebookEntry,
  NotebookEntryFormat,
  NotebookSource,
} from "@/lib/inquiry/types";
import {
  NOTEBOOK_SCHEMA_VERSION,
  formatItemsForDisplay,
  inferNotebookFormat,
  isStructuredSectionId,
  parseSectionItems,
  validateSectionItems,
  type NotebookSectionItem,
} from "@/lib/inquiry/notebook-schema";
import {
  goldenCoreConstraintsNotebookItems,
  resolveTechStackPolicy,
  usesGoldenStackSections,
} from "@/lib/golden-stack";
import type { TemplateSectionItem, TemplateStructure } from "@/lib/template-types";

const MIN_FILLED_LENGTH = 10;

function emptyEntry(
  s: TemplateSectionItem,
  format: NotebookEntryFormat,
): NotebookEntry {
  return {
    sectionId: s.id,
    sectionTitle: s.title,
    format,
    content: "",
    items: format === "structured" ? [] : undefined,
    sources: [],
    updatedAt: new Date().toISOString(),
  };
}

export function syncEntryContentFromItems(entry: NotebookEntry): NotebookEntry {
  if (entry.format !== "structured" || !isStructuredSectionId(entry.sectionId)) {
    return entry;
  }
  const content = formatItemsForDisplay(entry.sectionId, entry.items);
  return { ...entry, content };
}

export function createNotebookFromSections(
  sections: TemplateSectionItem[],
  structure?: TemplateStructure | null,
): InquiryNotebook {
  const format = inferNotebookFormat(sections, structure);
  const enabled = sections.filter((s) => s.enabled);
  const notebook: InquiryNotebook = {
    version: format === "structured" ? NOTEBOOK_SCHEMA_VERSION : 1,
    format,
    entries: enabled.map((s) => emptyEntry(s, format)),
  };
  return normalizeNotebook(notebook, sections);
}

/** 询问开始时注入黄金全栈到笔记板（技术独裁） */
export function seedGoldenStackNotebook(
  notebook: InquiryNotebook,
  idea: string,
  sections: TemplateSectionItem[],
): InquiryNotebook {
  if (!usesGoldenStackSections(sections)) return notebook;
  if (resolveTechStackPolicy(idea).mode !== "golden") return notebook;

  const items = goldenCoreConstraintsNotebookItems();
  return setEntryItems(notebook, "core_constraints", items, {
    type: "user_edit",
    ref: "golden-stack",
    at: new Date().toISOString(),
  });
}

export function normalizeNotebook(
  notebook: InquiryNotebook,
  sections: TemplateSectionItem[],
): InquiryNotebook {
  const format = inferNotebookFormat(sections);
  const enabled = sections.filter((s) => s.enabled);
  const byId = new Map(notebook.entries.map((e) => [e.sectionId, e]));

  const entries = enabled.map((s) => {
    const existing = byId.get(s.id);
    const entryFormat: NotebookEntryFormat =
      format === "structured" && isStructuredSectionId(s.id)
        ? "structured"
        : "plain";

    if (!existing) return emptyEntry(s, entryFormat);

    let items = existing.items;
    if (entryFormat === "structured") {
      const validated = validateSectionItems(s.id, items ?? []);
      items = validated.ok ? validated.items : [];
    } else {
      items = undefined;
    }

    const next: NotebookEntry = {
      ...existing,
      sectionTitle: s.title,
      format: entryFormat,
      items,
      content: existing.content ?? "",
    };
    return entryFormat === "structured"
      ? syncEntryContentFromItems(next)
      : next;
  });

  return {
    version: format === "structured" ? NOTEBOOK_SCHEMA_VERSION : notebook.version ?? 1,
    format,
    entries,
  };
}

export function isEntryFilled(entry: NotebookEntry): boolean {
  if (entry.format === "structured" && isStructuredSectionId(entry.sectionId)) {
    return (entry.items?.length ?? 0) > 0;
  }
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
  return normalizeNotebook(notebook, sections);
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

export function appendItemsToNotebook(
  notebook: InquiryNotebook,
  sectionId: string,
  newItems: NotebookSectionItem[],
  questionRef: string,
): InquiryNotebook {
  const entry = notebook.entries.find((e) => e.sectionId === sectionId);
  if (!entry || newItems.length === 0) return notebook;

  const existing = parseSectionItems(sectionId, entry.items ?? []);
  const merged = [...existing, ...newItems];
  const now = new Date().toISOString();

  const next: NotebookEntry = syncEntryContentFromItems({
    ...entry,
    format: "structured",
    items: merged as Record<string, unknown>[],
    sources: [
      ...entry.sources,
      { type: "question", ref: questionRef, at: now },
    ],
    updatedAt: now,
  });

  return {
    ...notebook,
    format: notebook.format ?? "structured",
    version: NOTEBOOK_SCHEMA_VERSION,
    entries: notebook.entries.map((e) =>
      e.sectionId === sectionId ? next : e,
    ),
  };
}

export function setEntryItems(
  notebook: InquiryNotebook,
  sectionId: string,
  items: NotebookSectionItem[],
  source?: NotebookSource,
): InquiryNotebook {
  const validated = validateSectionItems(sectionId, items);
  const safe = validated.ok ? validated.items : [];
  const now = new Date().toISOString();

  return {
    ...notebook,
    entries: notebook.entries.map((e) => {
      if (e.sectionId !== sectionId) return e;
      const sources = source ? [...e.sources, source] : e.sources;
      return syncEntryContentFromItems({
        ...e,
        format: "structured",
        items: safe as Record<string, unknown>[],
        sources,
        updatedAt: now,
      });
    }),
  };
}

export function appendAnswerToNotebook(
  notebook: InquiryNotebook,
  sectionId: string,
  answerText: string,
  questionRef: string,
): InquiryNotebook {
  const entry = notebook.entries.find((e) => e.sectionId === sectionId);
  if (!entry) return notebook;

  if (entry.format === "structured" && isStructuredSectionId(sectionId)) {
    const fromText = parseSectionItems(sectionId, [
      { scenario: answerText.trim(), action: "待补充" },
    ]);
    if (fromText.length > 0) {
      return appendItemsToNotebook(notebook, sectionId, fromText, questionRef);
    }
  }

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
