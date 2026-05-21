import type {
  DataModelItem,
  EdgeCaseItem,
  MilestoneItem,
  StateTransitionItem,
} from "@/lib/inquiry/notebook-schema";
import {
  isStructuredSectionId,
  parseSectionItems,
} from "@/lib/inquiry/notebook-schema";
import type { InquiryNotebook, NotebookEntry } from "@/lib/inquiry/types";

function toPascalCase(name: string): string {
  const cleaned = name
    .replace(/表$/g, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, " ")
    .trim();
  if (!cleaned) return "Entity";
  if (/[\u4e00-\u9fa5]/.test(cleaned)) {
    const map: Record<string, string> = {
      用户: "User",
      订单: "Order",
      文档: "Document",
      模板: "Template",
      会话: "InquirySession",
      笔记: "NotebookEntry",
    };
    for (const [cn, en] of Object.entries(map)) {
      if (cleaned.includes(cn)) return en;
    }
    return "DomainEntity";
  }
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function toCamelCase(name: string): string {
  const p = toPascalCase(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function inferTsType(token: string): string {
  const lower = token.toLowerCase();
  if (/^(is|has|can|should|enabled|active)/.test(lower)) return "boolean";
  if (/(count|num|amount|points|score|price|total)/.test(lower)) return "number";
  if (/(at|time|date|created|updated)/.test(lower)) return "string";
  if (/(ids|list|items|array)/.test(lower)) return "string[]";
  return "string";
}

function fieldTokenToTsProp(token: string): string | null {
  const raw = token.trim();
  if (!raw) return null;

  const explicit = raw.match(/^([a-zA-Z_][\w$]*)\s*[:：]\s*([\w[\]|.?]+)/);
  if (explicit) {
    const name = explicit[1];
    let type = explicit[2].replace(/;$/g, "");
    if (!type.includes("string") && !type.includes("number")) {
      type = inferTsType(name);
    }
    const optional = raw.includes("?") ? "?" : "";
    return `  ${name}${optional}: ${type};`;
  }

  const nameMatch = raw.match(/^([a-zA-Z_][\w$]*)\??$/);
  if (nameMatch) {
    const name = nameMatch[1];
    const optional = raw.includes("?") ? "?" : "";
    return `  ${name}${optional}: ${inferTsType(name)};`;
  }

  const cn = raw.replace(/[?（）()]/g, "").trim();
  const camel = toCamelCase(cn);
  if (!camel || camel === "domainEntity") return null;
  return `  ${camel}?: string;`;
}

function compileDataModels(items: DataModelItem[]): string {
  const blocks = items.map((item) => {
    const iface = toPascalCase(item.entity);
    const props = parseFieldList(item.fields)
      .map(fieldTokenToTsProp)
      .filter((line): line is string => Boolean(line));
    const body =
      props.length > 0
        ? props.join("\n")
        : "  /** TODO: 根据业务补充字段 */\n  id: string;";
    const note = item.notes?.trim()
      ? `\n/** ${item.notes.trim()} */\n`
      : "";
    return `\`\`\`typescript${note}\nexport interface ${iface} {\n${body}\n}\n\`\`\``;
  });
  return blocks.join("\n\n");
}

function parseFieldList(fields: string): string[] {
  return fields
    .split(/[,，、;；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function compileStateTransitions(items: StateTransitionItem[]): string {
  return items
    .map(
      (i) =>
        `- \`${i.from}\` —[${i.event}]→ \`${i.to}\`${i.sideEffect ? ` · ${i.sideEffect}` : ""}`,
    )
    .join("\n");
}

function compileEdgeCases(items: EdgeCaseItem[]): string {
  return items
    .map((i) => `- **${i.scenario}**：${i.action}`)
    .join("\n");
}

function compileMilestones(items: MilestoneItem[]): string {
  return items
    .map(
      (i) =>
        `- **${i.phase}**\n  - 范围：${i.scope}\n  - 验收：${i.acceptance}`,
    )
    .join("\n");
}

function compileCoreConstraints(
  items: { constraint: string; scope: string }[],
): string {
  return items
    .map((i) => `- **${i.constraint}**（${i.scope}）`)
    .join("\n");
}

function compileSectionMachineBody(
  sectionId: string,
  items: unknown[],
  fallbackContent: string,
): string {
  if (!isStructuredSectionId(sectionId) || !items.length) {
    return fallbackContent;
  }
  const parsed = parseSectionItems(sectionId, items);
  if (parsed.length === 0) return fallbackContent;

  switch (sectionId) {
    case "data_models":
      return compileDataModels(parsed as DataModelItem[]);
    case "state_transitions":
      return compileStateTransitions(parsed as StateTransitionItem[]);
    case "edge_cases":
      return compileEdgeCases(parsed as EdgeCaseItem[]);
    case "milestones":
      return compileMilestones(parsed as MilestoneItem[]);
    case "core_constraints":
      return compileCoreConstraints(
        parsed as { constraint: string; scope: string }[],
      );
    default:
      return fallbackContent;
  }
}

function compileEntry(entry: NotebookEntry): NotebookEntry {
  if (entry.format !== "structured" || !entry.items?.length) {
    return { ...entry };
  }

  const machineContent = compileSectionMachineBody(
    entry.sectionId,
    entry.items,
    entry.content,
  );

  return {
    ...entry,
    content: machineContent,
  };
}

/**
 * 机器导出视图：保留 items 为 SSOT，将 content 编译为技术向 Markdown（供生成/导出/Cursor）。
 */
export function compileNotebookForMachine(
  notebook: InquiryNotebook,
): InquiryNotebook {
  return {
    ...notebook,
    entries: notebook.entries.map(compileEntry),
  };
}

/** 单板块机器视图（分块流式生成用） */
export function compileSectionForMachine(
  sectionId: string,
  entry: NotebookEntry | undefined,
): string {
  if (!entry) return "";
  if (entry.format === "structured" && entry.items?.length) {
    return compileSectionMachineBody(
      sectionId,
      entry.items,
      entry.content,
    );
  }
  return entry.content.trim();
}
