import { NextResponse } from "next/server";

import { rowToDocument, rowToListItem } from "@/lib/document-db";
import { suggestTitleFromMarkdown } from "@/lib/markdown";
import { getLocalUserId } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";
import { createDocumentBodySchema } from "@/lib/schemas/api";

export async function GET(req: Request) {
  const userId = await getLocalUserId();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const rows = await prisma.document.findMany({
    where: {
      userId,
      isDeleted: false,
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { content: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    documents: rows.map(rowToListItem),
  });
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = createDocumentBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = await getLocalUserId();
  const content = parsed.data.content ?? "";
  const title =
    parsed.data.title?.trim() ||
    suggestTitleFromMarkdown(content);

  const created = await prisma.document.create({
    data: {
      title,
      content,
      userId,
    },
  });

  return NextResponse.json({ document: rowToDocument(created) });
}
