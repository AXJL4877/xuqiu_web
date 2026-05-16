import { getLocalUserId } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";
import { parseTemplateStructure } from "@/lib/template-types";

import { Suspense } from "react";

import { GenerateView } from "./generate-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "智能生成 · xuqiu",
  description: "AI 极速生成 PRD 初稿与模板管理",
};

export default async function GeneratePage() {
  const userId = await getLocalUserId();
  const rows = await prisma.template.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });

  const initialTemplates = rows.map((t) => ({
    id: t.id,
    name: t.name,
    fileType: t.fileType,
    structure: parseTemplateStructure(t.structure),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <p className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
            加载中…
          </p>
        }
      >
        <GenerateView initialTemplates={initialTemplates} />
      </Suspense>
    </div>
  );
}
