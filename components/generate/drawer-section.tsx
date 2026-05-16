import type { ReactNode } from "react";

import { drawerSectionDelay } from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

type DrawerSectionProps = {
  children: ReactNode;
  className?: string;
  /** 抽屉内区块缓入顺序（0 起） */
  index?: number;
};

export function DrawerSection({
  children,
  className,
  index = 0,
}: DrawerSectionProps) {
  return (
    <section
      className={cn("drawer-section-in", className)}
      style={{ animationDelay: drawerSectionDelay(index) }}
    >
      {children}
    </section>
  );
}
