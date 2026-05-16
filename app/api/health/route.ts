import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "xuqiu-api",
    ai: {
      source: "client",
      hint: "在首页或智能生成页配置 base_url、api_key、model",
    },
  });
}
