import type { ReactNode } from "react";

import { drawerContentDelay } from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

type DrawerSectionProps = {
  children: ReactNode;
  className?: string;
  /** 打开抽屉时内容依次缓入的顺序（0 起） */
  index?: number;
};

export function DrawerSection({
  children,
  className,
  index = 0,
}: DrawerSectionProps) {
  return (
    <section
      className={cn("generate-drawer-content", className)}
      style={{ animationDelay: drawerContentDelay(index) }}
    >
      {children}
    </section>
  );
}
