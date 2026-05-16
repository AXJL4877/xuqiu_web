import { NextResponse } from "next/server";

import { getLocalUserId } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";
import { patchTemplateBodySchema } from "@/lib/schemas/api";
import { parseTemplateStructure } from "@/lib/template-types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = await getLocalUserId();

  const row = await prisma.template.findFirst({
    where: { id, userId },
  });

  if (!row) {
    return NextResponse.json({ error: "未找到模板" }, { status: 404 });
  }

  return NextResponse.json({
    template: {
      id: row.id,
      name: row.name,
      fileType: row.fileType,
      structure: parseTemplateStructure(row.structure),
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = patchTemplateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = await getLocalUserId();
  const existing = await prisma.template.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "未找到模板" }, { status: 404 });
  }

  const data = parsed.data;
  if (!data.name && !data.structure && !data.fileType) {
    return NextResponse.json({ error: "无更新字段" }, { status: 400 });
  }

  const updated = await prisma.template.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.structure !== undefined ? { structure: data.structure } : {}),
      ...(data.fileType !== undefined ? { fileType: data.fileType } : {}),
    },
  });

  return NextResponse.json({
    template: {
      id: updated.id,
      name: updated.name,
      fileType: updated.fileType,
      structure: parseTemplateStructure(updated.structure),
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = await getLocalUserId();

  const existing = await prisma.template.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "未找到模板" }, { status: 404 });
  }

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
