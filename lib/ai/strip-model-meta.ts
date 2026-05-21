/** 模型思考/推理标签（含常见变体） */
const THINKING_TAG_RE =
  /<\/?(?:think|thinking|reasoning|analysis|thought)[^>]*>/gi;

const THINKING_FENCE_RE = /```(?:think|thinking|reasoning)[^\n]*\n[\s\S]*?```/gi;

/** 元话术行（思考过程、复述指令等） */
const META_LINE_RE =
  /^(我们|用户|选中|需要|所以|请|只|【|待改写|项目创意|规则[：:]|输出必须从|禁止输出|根据用户|根据以上|接下来|首先|让我|我来|好的[，,]|嗯|分析|推理|思考过程|reasoning|thinking)/i;

const META_PHRASE_RE =
  /我们被问到|选中内容是|需要符合|所以直接|请解释下面|待改写的选中文本|根据以上内容|按照要求|我将|我会先|让我先|思考[：:]|推理[：:]|chain of thought/i;

const STREAMING_HEAD_META_RE =
  /^(好的[，,]|嗯[，,]|以下是|下面是我|修改如下|改写后[：:]|首先|让我|我来|根据|需要说明的是|分析)/;

/** 有效正文起始锚点 */
const CONTENT_ANCHOR_RE = /^(-\s|>\s|#{3,4}\s|```)/;

export function stripThinkingTags(text: string): string {
  return text
    .replace(THINKING_TAG_RE, "")
    .replace(THINKING_FENCE_RE, "");
}

export function isMetaLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (META_LINE_RE.test(t)) return true;
  if (META_PHRASE_RE.test(t)) return true;
  if (/^#{1,2}\s+/.test(t) && !t.startsWith("###")) return true;
  return false;
}

/** 流式阶段：头部仍是元话术时暂不展示 */
export function shouldHideStreamingBuffer(raw: string): boolean {
  const head = stripThinkingTags(raw).trim().slice(0, 400);
  if (!head) return false;
  if (CONTENT_ANCHOR_RE.test(head)) return false;
  if (STREAMING_HEAD_META_RE.test(head)) return true;
  if (META_PHRASE_RE.test(head)) return true;
  if (/^[^-\n>#`]{0,120}$/.test(head.replace(/\s/g, "")) && head.length < 80) {
    return /[。，：:]/.test(head);
  }
  return false;
}

export function findContentStartIndex(text: string): number {
  const stripped = stripThinkingTags(text);
  const anchor = stripped.match(/^(?:-\s|>\s|#{3,4}\s|```)/m);
  if (anchor?.index != null && anchor.index >= 0) return anchor.index;
  return 0;
}

export function filterMetaLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !isMetaLine(line))
    .join("\n");
}
