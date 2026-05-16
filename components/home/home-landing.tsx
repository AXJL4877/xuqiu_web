"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AiSettingsPanel } from "@/components/shared/ai-settings-panel";
import { buttonVariants } from "@/components/ui/button";
import { fadeUp, staggerContainer } from "@/lib/motion-presets";
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
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const motionProps =
    reduceMotion || !ready
      ? { initial: false as const }
      : { initial: "hidden" as const, animate: "visible" as const };

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <motion.div
          className="absolute top-[-20%] left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.04] blur-3xl"
          animate={
            reduceMotion
              ? undefined
              : { scale: [1, 1.04, 1], opacity: [0.45, 0.65, 0.45] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 12, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <motion.div
          className="absolute right-[-10%] bottom-[-10%] h-[360px] w-[360px] rounded-full bg-muted/60 blur-3xl"
          animate={
            reduceMotion ? undefined : { x: [0, -8, 0], y: [0, 6, 0] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 14, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </motion.div>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center sm:gap-12 sm:py-24">
        <motion.div
          className="flex w-full max-w-3xl flex-col items-center gap-10 sm:gap-12"
          variants={staggerContainer}
          {...motionProps}
        >
          <div className="space-y-5">
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase"
            >
              AI 辅助需求文档
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.15]"
            >
              把创意写成
              <span className="text-primary/90"> 可落地的 PRD</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mx-auto max-w-lg text-base leading-relaxed text-pretty sm:text-lg"
            >
              降低起草门槛，统一文档结构。从想法到结构化初稿，再到预览微调与导出，一站完成。
            </motion.p>
          </div>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center justify-center gap-3"
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
          </motion.div>

          <motion.ul
            variants={fadeUp}
            className="grid w-full max-w-2xl gap-4 text-left sm:grid-cols-3"
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
          </motion.ul>

          <motion.div variants={fadeUp} className="w-full max-w-2xl">
            <AiSettingsPanel className="max-w-2xl" variant="full" />
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
