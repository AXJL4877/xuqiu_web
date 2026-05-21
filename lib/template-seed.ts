import {
  PRESET_FULLSTACK_CURSOR_ID,
  PRESET_FULLSTACK_CURSOR_NAME,
  fullstackCursorStructure,
} from "@/lib/preset-templates";
import { prisma } from "@/lib/prisma";
import {
  parseTemplateStructure,
  type TemplateStructure,
} from "@/lib/template-types";

async function upsertPresetTemplate(
  userId: string,
  name: string,
  structure: TemplateStructure,
): Promise<void> {
  const rows = await prisma.template.findMany({ where: { userId } });
  const byPreset = rows.find(
    (r) =>
      parseTemplateStructure(r.structure).presetId === structure.presetId,
  );
  const byName = rows.find((r) => r.name === name);

  const target = byPreset ?? byName;

  if (target) {
    await prisma.template.update({
      where: { id: target.id },
      data: {
        name,
        structure,
        fileType: "md",
      },
    });
    return;
  }

  await prisma.template.create({
    data: {
      userId,
      name,
      structure,
      fileType: "md",
    },
  });
}

/** 确保本地用户下存在系统预置模板（可重复调用以同步板块定义） */
export async function ensurePresetTemplates(userId: string): Promise<void> {
  await upsertPresetTemplate(
    userId,
    PRESET_FULLSTACK_CURSOR_NAME,
    fullstackCursorStructure(),
  );
}

export { PRESET_FULLSTACK_CURSOR_ID };
