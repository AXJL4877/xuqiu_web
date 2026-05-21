import type { TemplateSectionItem, TemplateStructure } from "@/lib/template-types";

export type ApiTemplate = {
  id: string;
  name: string;
  fileType: string;
  structure: TemplateStructure;
};
