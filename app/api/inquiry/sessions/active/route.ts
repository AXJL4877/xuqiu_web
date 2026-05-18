import { NextResponse } from "next/server";

import {
  findActiveInquirySession,
  rowToPersistedSession,
} from "@/lib/inquiry/inquiry-session-db";
import { getLocalUserId } from "@/lib/local-user";

export async function GET() {
  try {
    const userId = await getLocalUserId();
    const row = await findActiveInquirySession(userId);
    if (!row) {
      return NextResponse.json({ error: "无进行中的询问会话" }, { status: 404 });
    }
    const session = rowToPersistedSession(row);
    return NextResponse.json({ session });
  } catch (e) {
    console.error("[inquiry/sessions/active]", e);
    return NextResponse.json({ error: "读取会话失败" }, { status: 503 });
  }
}
