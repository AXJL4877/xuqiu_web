import { NextResponse } from "next/server";

/**
 * 整篇流式生成已废弃，请使用分块管线：
 * - POST /api/ai/generate/skeleton  静态骨架
 * - POST /api/ai/generate/block     按板块流式正文
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "整篇 PRD 流式生成已下线。请使用 /api/ai/generate/skeleton 与 /api/ai/generate/block 分块渲染。",
      skeletonPath: "/api/ai/generate/skeleton",
      blockPath: "/api/ai/generate/block",
    },
    { status: 410 },
  );
}
