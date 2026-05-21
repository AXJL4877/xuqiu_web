import type { CoreConstraintItem } from "@/lib/inquiry/notebook-schema";
import { PRESET_FULLSTACK_CURSOR_ID } from "@/lib/preset-templates";
import type {
  TemplateSectionItem,
  TemplateStructure,
} from "@/lib/template-types";

export type TechStackMode = "golden" | "override";

export type TechStackPolicy = {
  mode: TechStackMode;
  /** 触发 override 的命中信号（展示给用户） */
  matchedSignals: string[];
};

/** 当前 Vibe Coding 默认「黄金全栈」 */
export const GOLDEN_STACK_LABEL = "黄金全栈（Golden Stack）";

const SPECIAL_STACK_RULES: { signal: string; pattern: RegExp }[] = [
  { signal: "Python", pattern: /\bpython\b|爬虫|scrapy|django|flask|fastapi|pandas/i },
  {
    signal: "微信小程序",
    pattern: /微信小程序|微信\s*小程序|wechat\s*mini|mina\s*program/i,
  },
  { signal: "跨端小程序", pattern: /uni-app|taro\s|支付宝小程序|抖音小程序/i },
  { signal: "Rust", pattern: /\brust\b|actix|tokio\s*web/i },
  { signal: "Go 后端", pattern: /\bgolang\b|\bgo\s*语言|gin\s*框架|fiber\s*框架/i },
  { signal: "PHP", pattern: /\bphp\b|laravel|wordpress|thinkphp/i },
  { signal: "Java 传统栈", pattern: /\bjava\b(?!script)|spring\s*boot|mybatis/i },
  {
    signal: "移动原生",
    pattern: /原生\s*(android|ios)|\bswift\b\s*ui|\bkotlin\b.*(compose|android)/i,
  },
  { signal: ".NET", pattern: /\bc#\b|\.net|blazor|asp\.net/i },
];

/**
 * 检测用户创意是否「极其特殊」，允许偏离黄金全栈。
 * 默认返回 golden（技术独裁）。
 */
export function resolveTechStackPolicy(idea: string): TechStackPolicy {
  const text = idea.trim();
  const matchedSignals: string[] = [];

  for (const rule of SPECIAL_STACK_RULES) {
    if (rule.pattern.test(text)) {
      matchedSignals.push(rule.signal);
    }
  }

  return {
    mode: matchedSignals.length > 0 ? "override" : "golden",
    matchedSignals,
  };
}

const GOLDEN_SECTION_IDS = [
  "core_constraints",
  "data_models",
  "state_transitions",
  "edge_cases",
  "milestones",
] as const;

export function usesGoldenStackSections(
  sections: TemplateSectionItem[],
): boolean {
  const enabled = sections.filter((s) => s.enabled);
  if (enabled.length === 0) return false;
  return enabled.every((s) =>
    (GOLDEN_SECTION_IDS as readonly string[]).includes(s.id),
  );
}

export function usesGoldenStackForStructure(
  structure?: TemplateStructure | null,
): boolean {
  if (structure?.presetId === PRESET_FULLSTACK_CURSOR_ID) return true;
  return false;
}

export function inferFullstackStructure(
  sections: TemplateSectionItem[],
): TemplateStructure | null {
  if (!usesGoldenStackSections(sections)) return null;
  return {
    presetId: PRESET_FULLSTACK_CURSOR_ID,
    sections: sections.filter((s) => s.enabled),
  };
}

/** 写入 PRD 文档头部（# 标题之后） */
export function buildGoldenStackDocumentHeader(): string {
  return [
    "> **技术独裁 · 黄金全栈（默认强制）**",
    "> 本文档 **默认且必须** 采用下列技术组合实现。编程 Agent（Cursor / Claude）**不得** 擅自替换为主栈（如 Vue、Angular、Python 后端、自建 Spring 等），除非「技术栈与全局规范」章节中明确记载用户书面指定的例外。",
    "",
    "- **前端框架**：Next.js（App Router）+ TypeScript",
    "- **UI**：Tailwind CSS + shadcn/ui",
    "- **BaaS / 数据**：Supabase（默认）；若 PRD 写明 Firebase 且与创意一致，可改用 Firebase",
    "- **部署**：Vercel（Preview + Production）",
    "- **鉴权**：优先 Supabase Auth / Firebase Auth，与 BaaS 一致",
    "- **禁止**：在未获用户明确例外时引入第二套主栈或 ORM 混用",
  ].join("\n");
}

export function buildOverrideStackDocumentHeader(
  matchedSignals: string[],
): string {
  return [
    "> **技术栈策略：用户指定例外**",
    `> 检测到需求含特殊技术指向：${matchedSignals.join("、")}。允许偏离黄金全栈，**以「技术栈与全局规范」章节为准**。`,
    "> 若该章节未明确选型，编程 Agent 应优先澄清，而非默认套用黄金全栈。",
  ].join("\n");
}

export function buildDocumentHeader(
  idea: string,
  structure?: TemplateStructure | null,
): string | null {
  if (!usesGoldenStackForStructure(structure)) return null;

  const policy = resolveTechStackPolicy(idea);
  if (policy.mode === "override") {
    return buildOverrideStackDocumentHeader(policy.matchedSignals);
  }
  return buildGoldenStackDocumentHeader();
}

/** 黄金组合下的「技术栈与全局规范」静态正文（不经 AI 生成） */
export function buildGoldenCoreConstraintsMarkdown(): string {
  return [
    "### 锁定主栈（不可由 Agent 自行替换）",
    "- **应用框架**：Next.js App Router + TypeScript（`strict: true`）",
    "- **样式与组件**：Tailwind CSS v4 + shadcn/ui，禁止引入第二套 CSS 框架",
    "- **数据与鉴权**：Supabase（PostgreSQL + Auth + Storage）；仅当用户书面要求时使用 Firebase",
    "- **部署与域名**：Vercel；环境变量区分 Preview / Production",
    "",
    "### 目录与代码规范",
    "- 路由与页面：`app/`（App Router）；可复用逻辑：`lib/`；UI：`components/`",
    "- 命名：组件 PascalCase；文件 kebab-case；类型/接口放 `lib/types/` 或同域 `types.ts`",
    "- API：`app/api/**/route.ts`；服务端优先 Server Actions / Route Handlers，避免重复造轮子",
    "- 禁止：`any` 滥用、跳级标题、未在 PRD 出现的额外主栈依赖",
    "",
    "### 环境变量（约定键名，实现时须落地）",
    "- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（或 Firebase 等价项）",
    "- 服务端密钥仅出现在服务器环境，禁止打入客户端 bundle",
    "",
    "### Agent 执行指令",
    "- 从本 PRD 生成代码时，必须先按本节搭建目录与全局类型，再实现业务模块",
    "- 网络异常处理须对齐「异常与断网处理」章节，不得省略基础 Toast/重试/登录失效流程",
  ].join("\n");
}

export function goldenCoreConstraintsNotebookItems(): CoreConstraintItem[] {
  return [
    {
      constraint: "Next.js App Router + TypeScript（strict）",
      scope: "应用主栈",
    },
    {
      constraint: "Tailwind CSS + shadcn/ui",
      scope: "UI 层",
    },
    {
      constraint: "Supabase（默认）或用户书面指定的 Firebase",
      scope: "数据、鉴权、存储",
    },
    {
      constraint: "Vercel 部署与环境分离",
      scope: "交付与运维",
    },
    {
      constraint: "app/ · lib/ · components/ 目录约定",
      scope: "工程结构",
    },
    {
      constraint: "禁止擅自引入第二主栈",
      scope: "技术独裁",
    },
  ];
}

/** 全栈模板 + 黄金模式：该板块由系统预置，不走模型 */
export function shouldLockCoreConstraintsBlock(
  idea: string,
  structure?: TemplateStructure | null,
): boolean {
  if (!usesGoldenStackForStructure(structure)) return false;
  return resolveTechStackPolicy(idea).mode === "golden";
}

export function buildStaticBlocksForGenerate(
  idea: string,
  structure?: TemplateStructure | null,
): Record<string, string> {
  if (!shouldLockCoreConstraintsBlock(idea, structure)) {
    return {};
  }
  return {
    core_constraints: buildGoldenCoreConstraintsMarkdown(),
  };
}
