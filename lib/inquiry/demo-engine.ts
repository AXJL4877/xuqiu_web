import type {
  InquiryQuestion,
  InquiryOption,
} from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

export {
  allSectionsAdequate as allSectionsFilled,
  countRemainingGaps,
  pickNextGapSection,
} from "@/lib/inquiry/section-status";

type SectionBlueprint = {
  kind: "single" | "multi";
  stem: string;
  whyAsk: string;
  options: Omit<InquiryOption, "isCustom">[];
};

const BUILTIN_BLUEPRINTS: Record<string, SectionBlueprint> = {
  overview: {
    kind: "single",
    stem: "你的产品主要解决什么痛点或场景？",
    whyAsk: "用于撰写「项目概述」，避免泛泛而谈。",
    options: [
      { id: "efficiency", label: "提升某类工作效率" },
      { id: "cost", label: "降低使用/运营成本" },
      { id: "experience", label: "改善用户体验" },
      { id: "compliance", label: "满足合规或流程规范" },
    ],
  },
  users: {
    kind: "multi",
    stem: "谁是第一批核心用户？（可多选）",
    whyAsk: "明确目标用户，后续功能优先级才有着力点。",
    options: [
      { id: "pm", label: "产品经理 / 需求分析师" },
      { id: "dev", label: "独立开发者 / 技术负责人" },
      { id: "biz", label: "业务运营 / 市场人员" },
      { id: "enterprise", label: "企业内多角色协作团队" },
    ],
  },
  value: {
    kind: "multi",
    stem: "用户使用后最希望感受到的价值有哪些？（可多选）",
    whyAsk: "对应「核心价值」，与功能范围直接相关。",
    options: [
      { id: "speed", label: "更快产出文档" },
      { id: "quality", label: "更规范、更少遗漏" },
      { id: "collab", label: "团队协作更顺畅" },
      { id: "learn", label: "降低专业门槛" },
    ],
  },
  features: {
    kind: "multi",
    stem: "第一版必须上线的能力包括哪些？（可多选）",
    whyAsk: "划定 MVP 边界，防止首版范围失控。",
    options: [
      { id: "gen", label: "AI 生成与编辑" },
      { id: "template", label: "模板与结构化导出" },
      { id: "manage", label: "文档管理与检索" },
      { id: "integrate", label: "与现有工具集成" },
    ],
  },
  tech: {
    kind: "single",
    stem: "对技术栈或部署方式有硬性约束吗？",
    whyAsk: "写入「技术设计」，避免与团队现状冲突。",
    options: [
      { id: "web", label: "纯 Web，浏览器访问" },
      { id: "selfhost", label: "需支持私有化 / 自建部署" },
      { id: "mobile", label: "需兼顾移动端" },
      { id: "flex", label: "暂无硬性约束，可灵活选型" },
    ],
  },
  nfr: {
    kind: "single",
    stem: "非功能方面，当前最看重哪一点？",
    whyAsk: "影响架构与排期，如性能、安全、成本。",
    options: [
      { id: "perf", label: "响应速度与流式体验" },
      { id: "security", label: "数据安全与隐私" },
      { id: "cost", label: "AI 调用成本控制" },
      { id: "avail", label: "可用性与容灾" },
    ],
  },
  core_constraints: {
    kind: "multi",
    stem: "技术栈与工程约束上，哪些是必须遵守的？（可多选）",
    whyAsk: "写入「技术栈与全局规范」，供 AI 编码时直接引用。",
    options: [
      { id: "next", label: "Next.js App Router + TypeScript" },
      { id: "db", label: "PostgreSQL + ORM（如 Prisma）" },
      { id: "ui", label: "Tailwind + 组件库（如 shadcn/ui）" },
      { id: "selfhost", label: "需支持私有化 / Docker 部署" },
    ],
  },
  data_models: {
    kind: "single",
    stem: "核心业务实体大致有哪些？",
    whyAsk: "用于撰写 TypeScript 契约与数据模型，避免实现时反复猜字段。",
    options: [
      { id: "user_content", label: "用户 + 内容/文档类" },
      { id: "workflow", label: "流程/状态机驱动（订单、任务等）" },
      { id: "config", label: "配置/模板/元数据为主" },
      { id: "mixed", label: "多种实体混合，需分模块描述" },
    ],
  },
  state_transitions: {
    kind: "single",
    stem: "用户最常走的一条主流程是什么？",
    whyAsk: "划定状态机与交互流的主路径，便于分阶段实现。",
    options: [
      { id: "crud", label: "创建 → 编辑 → 保存/发布" },
      { id: "wizard", label: "多步向导（分步收集 → 确认 → 生成）" },
      { id: "async", label: "提交后异步处理（轮询/流式结果）" },
      { id: "collab", label: "多人协作与权限流转" },
    ],
  },
  edge_cases: {
    kind: "multi",
    stem: "必须优先覆盖的异常场景有哪些？（可多选）",
    whyAsk: "异常与断网处理决定上线质量，也影响 AI 生成测试清单。",
    options: [
      { id: "network", label: "断网 / 弱网 / 请求超时" },
      { id: "auth", label: "未登录 / 权限不足 / 会话过期" },
      { id: "conflict", label: "并发冲突 / 重复提交" },
      { id: "partial", label: "部分成功 / 流式中断" },
    ],
  },
  milestones: {
    kind: "single",
    stem: "第一版（MVP）希望多久内可演示？",
    whyAsk: "用于拆分阶段性开发指令与验收粒度。",
    options: [
      { id: "days", label: "约 1–3 天：极简可演示" },
      { id: "week", label: "约 1 周：核心路径可用" },
      { id: "twoweeks", label: "约 2 周：含主要异常处理" },
      { id: "flex", label: "暂无硬性排期，按模块拆分即可" },
    ],
  },
};

function blueprintForSection(section: TemplateSectionItem): SectionBlueprint {
  const built = BUILTIN_BLUEPRINTS[section.id];
  if (built) return built;
  return {
    kind: "single",
    stem: `关于「${section.title}」，你最想先明确的一点是什么？`,
    whyAsk: `补全模板板块「${section.title}」的关键信息。`,
    options: [
      { id: "scope", label: "范围与边界" },
      { id: "priority", label: "优先级与阶段划分" },
      { id: "constraint", label: "约束与依赖" },
      { id: "metric", label: "可衡量的目标" },
    ],
  };
}

function withCustomOption(options: Omit<InquiryOption, "isCustom">[]): InquiryOption[] {
  return [
    ...options,
    { id: "custom", label: "以上都不对，我来描述", isCustom: true },
  ];
}

const FOLLOW_UP_TEXT_STEMS = [
  "请用自己的话补充：典型使用场景是什么？怎样算做成了？",
  "还有哪些必须遵守的约束，或明确不做的范围？",
] as const;

export function buildDemoQuestion(
  section: TemplateSectionItem,
  questionIndex: number,
  estimatedRemaining: number,
): InquiryQuestion {
  const bp = blueprintForSection(section);
  return {
    id: `q-${section.id}-${questionIndex}`,
    sectionId: section.id,
    kind: bp.kind,
    stem: bp.stem,
    whyAsk: bp.whyAsk,
    options: withCustomOption(bp.options),
    questionIndex,
    estimatedRemaining,
  };
}

/** 追问用开放式填空，不用无意义的选择题 */
export function buildDemoFollowUpQuestion(
  section: TemplateSectionItem,
  questionIndex: number,
  estimatedRemaining: number,
  sectionAskCount: number,
): InquiryQuestion {
  const round = Math.max(0, sectionAskCount - 1);
  const stemBody =
    FOLLOW_UP_TEXT_STEMS[Math.min(round, FOLLOW_UP_TEXT_STEMS.length - 1)];

  return {
    id: `q-${section.id}-fu-${questionIndex}`,
    sectionId: section.id,
    kind: "text",
    stem: `关于「${section.title}」：${stemBody}`,
    whyAsk: "上一轮回答仍偏简略，用开放题补细节，比固定选项更准确。",
    options: undefined,
    questionIndex,
    estimatedRemaining,
  };
}
