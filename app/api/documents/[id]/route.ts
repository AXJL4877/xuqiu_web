import { NextResponse } from "next/server";

import { rowToDocument } from "@/lib/document-db";
import { suggestTitleFromMarkdown } from "@/lib/markdown";
import { getLocalUserId } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";
import { patchDocumentBodySchema } from "@/lib/schemas/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = await getLocalUserId();

  const row = await prisma.document.findFirst({
    where: { id, userId, isDeleted: false },
  });

  if (!row) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  return NextResponse.json({ document: rowToDocument(row) });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = patchDocumentBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = await getLocalUserId();
  const existing = await prisma.document.findFirst({
    where: { id, userId, isDeleted: false },
  });

  if (!existing) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  const data = parsed.data;
  const nextContent = data.content ?? existing.content;
  const nextTitle =
    data.title ??
    (data.content !== undefined && !existing.title.trim()
      ? suggestTitleFromMarkdown(nextContent)
      : existing.title);

  const updated = await prisma.document.update({
    where: { id },
    data: {
      ...(data.title !== undefined || data.content !== undefined
        ? { title: nextTitle }
        : {}),
      ...(data.content !== undefined ? { content: nextContent } : {}),
    },
  });

  return NextResponse.json({ document: rowToDocument(updated) });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = await getLocalUserId();

  const existing = await prisma.document.findFirst({
    where: { id, userId, isDeleted: false },
  });

  if (!existing) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  await prisma.document.update({
    where: { id },
    data: { isDeleted: true },
  });

  return NextResponse.json({ ok: true });
}
