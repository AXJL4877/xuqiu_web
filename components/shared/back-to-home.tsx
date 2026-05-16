import Link from "next/link";
import { Home } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackToHomeProps = {
  className?: string;
  size?: "sm" | "default";
};

export function BackToHome({ className, size = "sm" }: BackToHomeProps) {
  return (
    <Link
      href="/"
      className={cn(
        buttonVariants({ variant: "ghost", size }),
        "gap-1.5 text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Home className="size-4" aria-hidden />
      返回首页
    </Link>
  );
}
