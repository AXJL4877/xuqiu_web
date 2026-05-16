"use client";

import Link from "next/link";

import { AiSettingsPanel } from "@/components/shared/ai-settings-panel";
import { buttonVariants } from "@/components/ui/button";
import { fadeUpDelay } from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "一句话出稿",
    desc: "输入想法，AI 流式生成 PRD 初稿。",
  },
  {
    title: "模板复用",
    desc: "保存常用板块，一键套用。",
  },
  {
    title: "Markdown 导出",
    desc: "预览可编辑，随时下载 .md。",
  },
];

export function HomeLanding() {
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 animate-fade-in overflow-hidden"
      >
        <div className="absolute top-[-15%] left-1/2 h-[420px] w-[600px] -translate-x-1/2 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute right-[-8%] bottom-[-8%] h-[280px] w-[280px] rounded-full bg-muted/50 blur-3xl" />
      </div>

      <section className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex min-h-0 flex-col items-center gap-5 sm:gap-6">
          <div className="shrink-0 space-y-3 text-center sm:space-y-4">
            <p
              className="text-muted-foreground animate-fade-up text-xs font-medium tracking-[0.2em] uppercase"
              style={{ animationDelay: fadeUpDelay(0) }}
            >
              AI 辅助需求文档
            </p>
            <h1
              className="text-foreground animate-fade-up text-3xl font-semibold tracking-tight text-balance sm:text-4xl sm:leading-tight"
              style={{ animationDelay: fadeUpDelay(1) }}
            >
              把创意写成
              <span className="text-primary/90"> 可落地的 PRD</span>
            </h1>
            <p
              className="text-muted-foreground animate-fade-up mx-auto max-w-md text-sm leading-relaxed text-pretty sm:text-base"
              style={{ animationDelay: fadeUpDelay(2) }}
            >
              从想法到结构化初稿，再到预览微调与导出，一站完成。
            </p>
          </div>

          <div
            className="animate-fade-up flex shrink-0 flex-wrap items-center justify-center gap-2 sm:gap-3"
            style={{ animationDelay: fadeUpDelay(3) }}
          >
            <Link
              href="/generate?fresh=1"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              开始智能生成
            </Link>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              工作台
            </Link>
            <Link
              href="/editor/new"
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
            >
              新建文档
            </Link>
          </div>

          <ul
            className="animate-fade-up grid w-full max-w-2xl shrink-0 grid-cols-3 gap-2 sm:gap-3"
            style={{ animationDelay: fadeUpDelay(4) }}
          >
            {features.map((f) => (
              <li
                key={f.title}
                className="bg-card/80 rounded-lg border border-border/80 p-2.5 backdrop-blur-sm sm:p-3"
              >
                <p className="text-xs font-medium sm:text-sm">{f.title}</p>
                <p className="text-muted-foreground mt-1 text-[10px] leading-snug sm:text-xs">
                  {f.desc}
                </p>
              </li>
            ))}
          </ul>

          <div
            className="animate-fade-up w-full max-w-2xl shrink-0"
            style={{ animationDelay: fadeUpDelay(5) }}
          >
            <AiSettingsPanel className="max-w-2xl" variant="compact" />
          </div>
        </div>
      </section>
    </main>
  );
}
