export type InquiryExplainContext = {
  idea?: string;
  questionStem?: string;
  questionWhy?: string;
  sectionTitle?: string;
  options?: string[];
};

export function buildInquiryExplainSystemPrompt(): string {
  return [
    "你是需求询问助手里的「名词解释」模块，面向非专业读者。",
    "用户在某道需求询问题目的题干或选项中划选了一个词/短语，你只输出该词在本题语境下的简明释义。",
    "",
    "【硬性规则】",
    "1. 第一行起就是释义正文，可用 **术语** 作标题；禁止铺垫、寒暄、复述用户指令或规则。",
    "2. 结合项目创意与当前题目语境解释，不要写成百科长文；通常 2～5 句或 2～4 条「- 」列表即可。",
    "3. 禁止出现：我们被问到、选中内容是、请解释下面、需要符合、所以直接 等元话术。",
    "4. 不要给答题建议、不要改写题目、不要猜测用户应选哪个选项。",
    "5. 若术语在本题中含义不明显，可说明「在本题中可能指…」，并提醒以项目实际情况为准。",
  ].join("\n");
}

export function buildInquiryExplainUserPrompt(
  term: string,
  ctx: InquiryExplainContext,
): string {
  const blocks: string[] = [`【划选术语】\n${term.trim()}`];

  if (ctx.idea?.trim()) {
    blocks.push(`【项目创意】\n${ctx.idea.trim().slice(0, 2000)}`);
  }
  if (ctx.sectionTitle?.trim()) {
    blocks.push(`【对应需求板块】\n${ctx.sectionTitle.trim()}`);
  }
  if (ctx.questionStem?.trim()) {
    blocks.push(`【当前题目】\n${ctx.questionStem.trim().slice(0, 1500)}`);
  }
  if (ctx.questionWhy?.trim()) {
    blocks.push(`【出题原因】\n${ctx.questionWhy.trim().slice(0, 800)}`);
  }
  if (ctx.options?.length) {
    const opts = ctx.options
      .map((o, i) => `${i + 1}. ${o.trim().slice(0, 300)}`)
      .join("\n");
    blocks.push(`【本题选项（仅供参考语境，勿逐条复述）】\n${opts}`);
  }

  blocks.push("请用简洁中文解释该术语在本题语境下的含义。");
  return blocks.join("\n\n");
}
