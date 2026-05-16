import type { Transition } from "framer-motion";

/** 页面缓入动画共用曲线（cubic-bezier） */
export const EASE_OUT = [0.25, 0.1, 0.25, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

export const staggerContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
};

/** 生成配置抽屉：面板滑入/遮罩淡入共用缓动 */
export const drawerPanelTransition: Transition = {
  type: "tween",
  duration: 0.36,
  ease: EASE_OUT,
};

export const drawerBackdropTransition: Transition = {
  type: "tween",
  duration: 0.28,
  ease: EASE_OUT,
};

/** 首页子元素依次缓入的 delay（秒） */
export const fadeUpDelay = (index: number) => `${0.05 + index * 0.07}s`;
