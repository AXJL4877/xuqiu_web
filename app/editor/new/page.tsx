"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NewEditorPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "" }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) setError(err.error ?? "创建失败");
          return;
        }
        const data = (await res.json()) as { document: { id: string } };
        if (!cancelled) router.replace(`/editor/${data.document.id}`);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "创建失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-12 text-center">
        <p className="text-destructive text-sm">{error}</p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
          返回工作台
        </Link>
      </div>
    );
  }

  return (
    <p className="text-muted-foreground flex flex-1 items-center justify-center p-12 text-sm">
      正在创建文档…
    </p>
  );
}
