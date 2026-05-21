import { validateNotebookWithArchitect } from "@/lib/inquiry/architect-validator";
import { findInquirySessionById } from "@/lib/inquiry/inquiry-session-db";
import type { InquiryNotebook } from "@/lib/inquiry/types";
import { getLocalUserId } from "@/lib/local-user";
import type { z } from "zod";

import type { generateBodySchema } from "@/lib/schemas/api";

export type GenerateRequestPayload = z.infer<typeof generateBodySchema>;

export async function resolveNotebookForGenerate(
  payload: GenerateRequestPayload,
): Promise<InquiryNotebook | undefined> {
  let notebook = payload.notebook;
  const { inquirySessionId } = payload;

  if (inquirySessionId && (!notebook || notebook.entries.length === 0)) {
    try {
      const userId = await getLocalUserId();
      const row = await findInquirySessionById(userId, inquirySessionId);
      if (row?.notebook) {
        notebook = row.notebook as InquiryNotebook;
      }
    } catch (e) {
      console.warn("[ai/generate] load session notebook failed", e);
    }
  }

  if (!notebook) return undefined;

  return validateNotebookWithArchitect(notebook, payload.idea, null, {
    enableAiValidation: false,
  });
}
