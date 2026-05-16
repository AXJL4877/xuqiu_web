import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DrawerSectionProps = {
  children: ReactNode;
  className?: string;
};

/** 生成配置抽屉内区块容器（与面板同轨滑入，不再单独缓入） */
export function DrawerSection({ children, className }: DrawerSectionProps) {
  return <section className={cn(className)}>{children}</section>;
}
