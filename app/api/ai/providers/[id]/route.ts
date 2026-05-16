import { NextResponse } from "next/server";

import { rowToProvider } from "@/lib/ai/provider-db";
import { getLocalUserId } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";
import { patchAiProviderBodySchema } from "@/lib/schemas/api";
import { normalizeAiSettings } from "@/lib/ai/settings";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = patchAiProviderBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = await getLocalUserId();
  const existing = await prisma.aiProvider.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "配置不存在" }, { status: 404 });
  }

  const data = parsed.data;
  const nextSettings = normalizeAiSettings({
    baseUrl: data.baseUrl ?? existing.baseUrl,
    apiKey: data.apiKey ?? existing.apiKey,
    model: data.model ?? existing.model,
  });

  if (data.setDefault) {
    await prisma.aiProvider.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.aiProvider.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      baseUrl: nextSettings.baseUrl,
      apiKey: nextSettings.apiKey,
      model: nextSettings.model,
      ...(data.setDefault ? { isDefault: true } : {}),
    },
  });

  return NextResponse.json({ provider: rowToProvider(updated) });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = await getLocalUserId();
  const existing = await prisma.aiProvider.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "配置不存在" }, { status: 404 });
  }

  await prisma.aiProvider.delete({ where: { id } });

  if (existing.isDefault) {
    const next = await prisma.aiProvider.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    if (next) {
      await prisma.aiProvider.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
