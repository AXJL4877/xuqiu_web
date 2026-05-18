import { NextResponse } from "next/server";

import { upsertInquirySessionFromClient } from "@/lib/inquiry/inquiry-session-db";
import { getLocalUserId } from "@/lib/local-user";
import { inquirySessionSyncBodySchema } from "@/lib/schemas/api";

export async function PUT(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = inquirySessionSyncBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const userId = await getLocalUserId();
    const data = parsed.data;
    const row = await upsertInquirySessionFromClient(userId, data, {
      status: data.phase === "confirming" ? "confirming" : "collecting",
    });
    return NextResponse.json({
      ok: true,
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("[inquiry/sessions/sync]", e);
    return NextResponse.json({ error: "同步会话失败" }, { status: 503 });
  }
}
