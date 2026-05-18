"use client";

import { AnimatePresence, motion } from "framer-motion";

import {
  inquiryDialogTransition,
  inquiryDialogVariants,
} from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

type InquiryDialogMotionProps = {
  /** 切换时触发退出/进入动画的唯一键 */
  motionKey: string;
  className?: string;
  children: React.ReactNode;
};

/** 询问/确认弹窗容器：状态切换时缓入缓出 */
export function InquiryDialogMotion({
  motionKey,
  className,
  children,
}: InquiryDialogMotionProps) {
  return (
    <div className={cn("w-full max-w-lg", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={motionKey}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={inquiryDialogVariants}
          transition={inquiryDialogTransition}
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
