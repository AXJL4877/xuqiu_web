import { generateText } from "ai";
import { z } from "zod";

import type { ResolvedAiConfig } from "@/lib/ai/config";
import { createCompatibleOpenAI } from "@/lib/ai/openai-compatible";
import { GOLDEN_STACK_LABEL } from "@/lib/golden-stack";
import {
  isStructuredSectionId,
  notebookToStructuredJsonBlock,
  parseSectionItems,
  STRUCTURED_SECTION_IDS,
  validateSectionItems,
} from "@/lib/inquiry/notebook-schema";
import { syncEntryContentFromItems } from "@/lib/inquiry/notebook";
import type { InquiryNotebook, NotebookEntry } from "@/lib/inquiry/types";

const validatedPayloadSchema = z.object({
  entries: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

function extractJsonObject(raw: string): unknown {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(text);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("未找到 JSON");
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

function notebookHasStructuredItems(notebook: InquiryNotebook): boolean {
  return notebook.entries.some(
    (e) => e.format === "structured" && (e.items?.length ?? 0) > 0,
  );
}

function buildArchitectSystemPrompt(): string {
  return [
    "你是一位严苛的全栈架构师，负责在 PRD 进入确认页与代码生成之前做后台自检。",
    "输入是各板块的 JSON 数组（技术向结构化事实），输出必须是修正后的 JSON。",
    "",
    "【检查维度】",
    `1. 是否符合现代 Web 全栈最佳实践（默认 ${GOLDEN_STACK_LABEL}：Next.js App Router、TypeScript、服务端边界）。`,
    "2. 是否过度复杂：砍掉 MVP 不必要的微服务、消息队列、多数据库混用。",
    "3. 安全隐患：禁止密码明文存储/传输、禁止前端直连生产数据库、禁止在客户端暴露 service role key。",
    "4. 鉴权/数据：用户态数据须经 Supabase/Firebase Auth + 服务端 Route Handler，敏感写操作须校验 session。",
    "5. data_models：字段须可落地为 TypeScript；避免含糊的「各种信息」；关联关系须清晰。",
    "6. edge_cases：须覆盖断网、超时、鉴权失败等基础分支，且给出可实现的 UI/接口行为。",
    "",
    "【输出格式 — 仅 JSON，无 Markdown】",
    '{"entries":{"sectionId":[{...},...],"anotherSection":[...]}}',
    "- sectionId 必须来自输入，勿增删板块 key。",
    "- 每条数组元素保持原 schema 字段（如 data_models 用 entity/fields/notes，edge_cases 用 scenario/action）。",
    "- 可直接修改、合并、删减条目；禁止输出解释、changelog、思考过程。",
  ].join("\n");
}

function applyValidatedPayload(
  notebook: InquiryNotebook,
  payload: z.infer<typeof validatedPayloadSchema>,
): InquiryNotebook {
  const entries = notebook.entries.map((entry): NotebookEntry => {
    if (!isStructuredSectionId(entry.sectionId)) return entry;

    const rawItems = payload.entries[entry.sectionId];
    if (!rawItems?.length) return entry;

    const validated = validateSectionItems(entry.sectionId, rawItems);
    if (!validated.ok) return entry;

    const next = syncEntryContentFromItems({
      ...entry,
      format: "structured",
      items: validated.items as Record<string, unknown>[],
    });

    return next;
  });

  return { ...notebook, entries };
}

/** 无大模型时的规则兜底（演示模式） */
function ruleBasedArchitectFix(notebook: InquiryNotebook): InquiryNotebook {
  const entries = notebook.entries.map((entry) => {
    if (entry.format !== "structured" || !entry.items?.length) return entry;

    const items = parseSectionItems(entry.sectionId, entry.items);
    if (items.length === 0) return entry;

    const fixed = items.map((item) => {
      const row = { ...item } as Record<string, unknown>;

      if (entry.sectionId === "data_models") {
        const fields = String(row.fields ?? "");
        let f = fields;
        if (/明文.*密码|password.*plain|前端.*数据库|client.*直连.*db/i.test(f)) {
          f = f
            .replace(/明文.*密码/gi, "passwordHash（仅存服务端）")
            .replace(/前端.*(直连|连接).*数据库/gi, "经服务端 API 访问数据库");
        }
        if (!/password/i.test(f) && /密码/.test(f)) {
          f += "；passwordHash: string（bcrypt，仅存服务端）";
        }
        row.fields = f;
      }

      if (entry.sectionId === "core_constraints") {
        const c = String(row.constraint ?? "");
        if (/前端.*连.*数据库|浏览器.*直连/i.test(c)) {
          row.constraint = "数据访问须经 Next.js 服务端 Route Handler";
          row.scope = "安全边界";
        }
      }

      return row;
    });

    const validated = validateSectionItems(entry.sectionId, fixed);
    if (!validated.ok) return entry;

    return syncEntryContentFromItems({
      ...entry,
      items: validated.items as Record<string, unknown>[],
    });
  });

  return { ...notebook, entries };
}

async function validateWithAi(
  ai: ResolvedAiConfig,
  idea: string,
  notebook: InquiryNotebook,
): Promise<InquiryNotebook> {
  const jsonBlock = notebookToStructuredJsonBlock(notebook.entries);
  if (!jsonBlock) return notebook;

  const provider = createCompatibleOpenAI(ai, { disableThinking: true });

  const result = await generateText({
    model: provider.chat(ai.model),
    system: buildArchitectSystemPrompt(),
    prompt: [
      "【项目创意】",
      idea.trim(),
      "",
      "【待自检 JSON — entries 下为各 sectionId 的数组】",
      jsonBlock,
      "",
      "请直接返回修正后的 JSON（仅 entries 对象）。",
    ].join("\n"),
    maxOutputTokens: 2000,
  });

  const parsed = validatedPayloadSchema.safeParse(
    extractJsonObject(result.text),
  );
  if (!parsed.success) {
    console.warn(
      "[architect-validator] parse failed",
      parsed.error.flatten(),
    );
    return ruleBasedArchitectFix(notebook);
  }

  return applyValidatedPayload(notebook, parsed.data);
}

/**
 * 架构师自检器：后台修正结构化笔记板，对用户不可见。
 * 在确认页展示与 PRD 生成之前调用。
 */
export type ArchitectValidationOptions = {
  /** 为 false 时仅跑规则兜底（用于 PRD 分块生成，避免重复大模型调用） */
  enableAiValidation?: boolean;
};

export async function validateNotebookWithArchitect(
  notebook: InquiryNotebook,
  idea: string,
  ai: ResolvedAiConfig | null,
  options?: ArchitectValidationOptions,
): Promise<InquiryNotebook> {
  if (!notebookHasStructuredItems(notebook)) {
    return notebook;
  }

  const hasStructuredSections = notebook.entries.some((e) =>
    (STRUCTURED_SECTION_IDS as readonly string[]).includes(e.sectionId),
  );
  if (!hasStructuredSections) return notebook;

  const useAi = options?.enableAiValidation !== false && Boolean(ai);

  try {
    if (useAi && ai) {
      return await validateWithAi(ai, idea, notebook);
    }
    return ruleBasedArchitectFix(notebook);
  } catch (e) {
    console.warn("[architect-validator] failed, using rule fallback", e);
    return ruleBasedArchitectFix(notebook);
  }
}
