import type { TemplateSectionItem } from "@/lib/template-types";

export type ApiTemplate = {
  id: string;
  name: string;
  fileType: string;
  structure: { sections: TemplateSectionItem[] };
};
