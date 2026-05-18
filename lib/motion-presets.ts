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

/** 生成配置抽屉内容缓入 delay（秒），略晚于面板滑入起点 */
export const drawerContentDelay = (index: number) =>
  `${0.12 + index * 0.06}s`;

/** 询问/确认主弹窗：缓入缓出 */
export const inquiryDialogVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
};

export const inquiryDialogTransition: Transition = {
  type: "tween",
  duration: 0.34,
  ease: EASE_OUT,
};

/** 划词工具条、名词解释浮层 */
export const inquiryPopoverVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.97 },
};

export const inquiryPopoverTransition: Transition = {
  type: "tween",
  duration: 0.24,
  ease: EASE_OUT,
};
