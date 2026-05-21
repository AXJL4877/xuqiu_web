import { assemblePrdMarkdown, type PrdSkeleton } from "@/lib/ai/prd-skeleton";
import { sanitizeBlockMarkdown } from "@/lib/ai/sanitize-block";
import type { AiSettings } from "@/lib/ai/settings";
import type { InquiryGeneratePayload } from "@/lib/inquiry/types";
import type { TemplateSectionItem } from "@/lib/template-types";

export type BlockedGenerateOptions = {
  idea: string;
  sections: TemplateSectionItem[];
  inquiryPayload?: InquiryGeneratePayload;
  providerId?: string | null;
  ai?: AiSettings;
  onSkeleton: (markdown: string, skeleton: PrdSkeleton) => void;
  onBlockStart: (sectionId: string, title: string) => void;
  onBlockChunk: (sectionId: string, assembledMarkdown: string) => void;
  onBlockDone: (sectionId: string) => void;
  onMode?: (mode: "demo" | "live") => void;
};

function buildBaseBody(
  idea: string,
  sections: TemplateSectionItem[],
  inquiryPayload?: InquiryGeneratePayload,
  providerId?: string | null,
  ai?: AiSettings,
): Record<string, unknown> {
  const body: Record<string, unknown> = { idea, sections };
  if (inquiryPayload) {
    body.notebook = inquiryPayload.notebook;
    body.acceptedAssumptions = inquiryPayload.acceptedAssumptions;
    body.gaps = inquiryPayload.gaps;
    body.completionStrategy = inquiryPayload.completionStrategy;
    if (inquiryPayload.inquirySessionId) {
      body.inquirySessionId = inquiryPayload.inquirySessionId;
    }
  }
  if (providerId) body.providerId = providerId;
  if (ai) body.ai = ai;
  return body;
}

/**
 * 插值渲染 + 分块流式：先静态骨架，再按板块逐个注入内容。
 */
export async function runBlockedGenerate(
  opts: BlockedGenerateOptions,
): Promise<{ markdown: string; mode: "demo" | "live" }> {
  const baseBody = buildBaseBody(
    opts.idea,
    opts.sections,
    opts.inquiryPayload,
    opts.providerId,
    opts.ai,
  );

  const skRes = await fetch("/api/ai/generate/skeleton", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(baseBody),
  });

  if (!skRes.ok) {
    const err = (await skRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `骨架请求失败 (${skRes.status})`);
  }

  const skData = (await skRes.json()) as { skeleton: PrdSkeleton };
  const skeleton = skData.skeleton;
  const blockContents: Record<string, string> = {};

  for (const b of skeleton.blocks) {
    blockContents[b.sectionId] =
      skeleton.staticBlocks[b.sectionId] ?? b.placeholder;
  }

  opts.onSkeleton(skeleton.markdown, skeleton);

  let detectedMode: "demo" | "live" = "demo";

  for (const block of skeleton.blocks) {
    opts.onBlockStart(block.sectionId, block.title);

    const presetBody = skeleton.staticBlocks[block.sectionId];
    if (presetBody) {
      blockContents[block.sectionId] = presetBody;
      opts.onBlockChunk(
        block.sectionId,
        assemblePrdMarkdown(skeleton, blockContents),
      );
      opts.onBlockDone(block.sectionId);
      continue;
    }

    blockContents[block.sectionId] = "";

    const section = opts.sections.find((s) => s.id === block.sectionId);
    if (!section) continue;

    let buf = "";
    const res = await fetch("/api/ai/generate/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...baseBody, sectionId: block.sectionId }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        err.error ?? `板块「${block.title}」请求失败 (${res.status})`,
      );
    }

    if (res.headers.get("X-Xuqiu-Mode") === "live") {
      detectedMode = "live";
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("无法读取板块流");

    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      if (buf.startsWith("【生成失败】")) continue;

      const cleaned = sanitizeBlockMarkdown(buf, block.title, true);
      blockContents[block.sectionId] = cleaned;
      opts.onBlockChunk(
        block.sectionId,
        assemblePrdMarkdown(skeleton, blockContents),
      );
    }

    if (buf.startsWith("【生成失败】")) {
      throw new Error(
        buf.replace(/^【生成失败】/, "").split("\n")[0] ?? "生成失败",
      );
    }

    blockContents[block.sectionId] = sanitizeBlockMarkdown(
      buf,
      block.title,
      false,
    );
    opts.onBlockDone(block.sectionId);
    opts.onBlockChunk(
      block.sectionId,
      assemblePrdMarkdown(skeleton, blockContents),
    );
  }

  opts.onMode?.(detectedMode);
  return {
    markdown: assemblePrdMarkdown(skeleton, blockContents),
    mode: detectedMode,
  };
}
