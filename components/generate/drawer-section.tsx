import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DrawerSectionProps = {
  children: ReactNode;
  className?: string;
};

/** 配置抽屉内区块：不做独立缓入，避免与侧栏动画叠加导致卡顿 */
export function DrawerSection({ children, className }: DrawerSectionProps) {
  return <section className={cn(className)}>{children}</section>;
}
