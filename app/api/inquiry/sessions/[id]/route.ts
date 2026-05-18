import { NextResponse } from "next/server";

import {
  deleteInquirySession,
  findInquirySessionById,
  markInquirySessionGenerated,
} from "@/lib/inquiry/inquiry-session-db";
import { getLocalUserId } from "@/lib/local-user";
import { inquirySessionPatchBodySchema } from "@/lib/schemas/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = await getLocalUserId();
    await deleteInquirySession(userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[inquiry/sessions/delete]", e);
    return NextResponse.json({ error: "删除会话失败" }, { status: 503 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = inquirySessionPatchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const userId = await getLocalUserId();
    const existing = await findInquirySessionById(userId, id);
    if (!existing) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const { documentId, status, assumptions } = parsed.data;
    if (status === "generated" || documentId) {
      await markInquirySessionGenerated(userId, id, documentId);
    }

    if (assumptions) {
      const { prisma } = await import("@/lib/prisma");
      await prisma.inquirySession.update({
        where: { id },
        data: { assumptions: assumptions as object },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[inquiry/sessions/patch]", e);
    return NextResponse.json({ error: "更新会话失败" }, { status: 503 });
  }
}
