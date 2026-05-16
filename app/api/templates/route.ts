import { NextResponse } from "next/server";

import { getLocalUserId } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";
import { createTemplateBodySchema } from "@/lib/schemas/api";
import { parseTemplateStructure } from "@/lib/template-types";

export async function GET() {
  const userId = await getLocalUserId();
  const rows = await prisma.template.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });

  const templates = rows.map((t) => ({
    id: t.id,
    name: t.name,
    fileType: t.fileType,
    structure: parseTemplateStructure(t.structure),
  }));

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = createTemplateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = await getLocalUserId();
  const { name, structure, fileType } = parsed.data;

  const created = await prisma.template.create({
    data: {
      name,
      structure,
      fileType,
      userId,
    },
  });

  return NextResponse.json({
    template: {
      id: created.id,
      name: created.name,
      fileType: created.fileType,
      structure: parseTemplateStructure(created.structure),
    },
  });
}
