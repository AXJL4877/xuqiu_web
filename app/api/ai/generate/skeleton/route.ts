import { NextResponse } from "next/server";

import { buildPrdSkeleton } from "@/lib/ai/prd-skeleton";
import { PRESET_FULLSTACK_CURSOR_ID } from "@/lib/preset-templates";
import { generateBodySchema } from "@/lib/schemas/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = generateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { idea, sections } = parsed.data;
  const enabled = sections.filter((s) => s.enabled);
  if (enabled.length === 0) {
    return NextResponse.json({ error: "至少启用一个文档板块" }, { status: 400 });
  }

  const usesFullstack = enabled.every((s) =>
    [
      "core_constraints",
      "data_models",
      "state_transitions",
      "edge_cases",
      "milestones",
    ].includes(s.id),
  );

  const skeleton = buildPrdSkeleton(idea, sections, {
    presetId: usesFullstack ? PRESET_FULLSTACK_CURSOR_ID : undefined,
    sections: enabled,
  });

  return NextResponse.json({
    skeleton,
    renderMode: "blocked" as const,
    techStackPolicy: skeleton.techStackPolicy,
  });
}
