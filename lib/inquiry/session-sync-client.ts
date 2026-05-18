import type { PersistedInquirySession } from "@/lib/inquiry/session-storage";

export async function fetchActiveInquirySession(): Promise<
  (PersistedInquirySession & { serverUpdatedAt: string }) | null
> {
  try {
    const res = await fetch("/api/inquiry/sessions/active", {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as {
      session: PersistedInquirySession & { serverUpdatedAt: string };
    };
    return data.session ?? null;
  } catch {
    return null;
  }
}

export async function syncInquirySessionToServer(
  data: PersistedInquirySession,
): Promise<boolean> {
  try {
    const res = await fetch("/api/inquiry/sessions/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteInquirySessionOnServer(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/inquiry/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  } catch {
    /* ignore */
  }
}

export async function linkInquirySessionDocument(
  sessionId: string,
  documentId: string,
): Promise<void> {
  try {
    await fetch(`/api/inquiry/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, status: "generated" }),
    });
  } catch {
    /* ignore */
  }
}
