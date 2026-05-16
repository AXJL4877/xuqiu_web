"use client";

import Link from "next/link";

import { AiSettingsPanel } from "@/components/shared/ai-settings-panel";
import { buttonVariants } from "@/components/ui/button";
import { fadeUpDelay } from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "一句话出稿",
    desc: "输入项目想法，AI 流式生成结构化需求文档初稿。",
  },
  {
    title: "模板复用",
    desc: "保存常用文档板块组合，一键套用生成配置。",
  },
  {
    title: "Markdown 导出",
    desc: "预览可即时编辑，随时保存并下载 .md 文件。",
  },
];

export function HomeLanding() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 animate-fade-in"
      >
        <div className="absolute top-[-20%] left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-10%] h-[360px] w-[360px] rounded-full bg-muted/60 blur-3xl" />
      </div>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center sm:gap-12 sm:py-24">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10 sm:gap-12">
          <div className="space-y-5">
            <p
              className="text-muted-foreground animate-fade-up text-xs font-medium tracking-[0.2em] uppercase"
              style={{ animationDelay: fadeUpDelay(0) }}
            >
              AI 辅助需求文档
            </p>
            <h1
              className="text-foreground animate-fade-up text-4xl font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.15]"
              style={{ animationDelay: fadeUpDelay(1) }}
            >
              把创意写成
              <span className="text-primary/90"> 可落地的 PRD</span>
            </h1>
            <p
              className="text-muted-foreground animate-fade-up mx-auto max-w-lg text-base leading-relaxed text-pretty sm:text-lg"
              style={{ animationDelay: fadeUpDelay(2) }}
            >
              降低起草门槛，统一文档结构。从想法到结构化初稿，再到预览微调与导出，一站完成。
            </p>
          </div>

          <div
            className="animate-fade-up flex flex-wrap items-center justify-center gap-3"
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
            className="animate-fade-up grid w-full max-w-2xl gap-4 text-left sm:grid-cols-3"
            style={{ animationDelay: fadeUpDelay(4) }}
          >
            {features.map((f) => (
              <li
                key={f.title}
                className="bg-card/80 rounded-xl border border-border/80 p-4 backdrop-blur-sm"
              >
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                  {f.desc}
                </p>
              </li>
            ))}
          </ul>

          <div
            className="animate-fade-up w-full max-w-2xl"
            style={{ animationDelay: fadeUpDelay(5) }}
          >
            <AiSettingsPanel className="max-w-2xl" variant="full" />
          </div>
        </div>
      </section>
    </main>
  );
}
