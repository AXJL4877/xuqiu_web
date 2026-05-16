"use client";

import type { ReactNode } from "react";

import { AiProvidersProvider } from "@/components/providers/ai-providers-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <AiProvidersProvider>{children}</AiProvidersProvider>;
}
