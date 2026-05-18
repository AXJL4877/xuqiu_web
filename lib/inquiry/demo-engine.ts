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
