import { NextResponse } from "next/server";

import { rowToProvider } from "@/lib/ai/provider-db";
import { getLocalUserId } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";
import { createAiProviderBodySchema } from "@/lib/schemas/api";
import { normalizeAiSettings } from "@/lib/ai/settings";

export async function GET() {
  const userId = await getLocalUserId();
  const rows = await prisma.aiProvider.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  const providers = rows.map(rowToProvider);
  const activeId = providers.find((p) => p.isDefault)?.id ?? providers[0]?.id ?? null;

  return NextResponse.json({ providers, activeId });
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const parsed = createAiProviderBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = await getLocalUserId();
  const { name, setDefault } = parsed.data;
  const normalized = normalizeAiSettings({
    baseUrl: parsed.data.baseUrl,
    apiKey: parsed.data.apiKey,
    model: parsed.data.model,
  });

  const makeDefault = setDefault ?? false;

  if (makeDefault) {
    await prisma.aiProvider.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  const count = await prisma.aiProvider.count({ where: { userId } });

  const created = await prisma.aiProvider.create({
    data: {
      name,
      baseUrl: normalized.baseUrl,
      apiKey: normalized.apiKey,
      model: normalized.model,
      isDefault: makeDefault || count === 0,
      userId,
    },
  });

  if (created.isDefault) {
    await prisma.aiProvider.updateMany({
      where: { userId, id: { not: created.id } },
      data: { isDefault: false },
    });
  }

  return NextResponse.json({ provider: rowToProvider(created) });
}
