/** 页面缓入动画共用曲线 */
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

export const drawerPanelTransition = {
  duration: 0.36,
  ease: EASE_OUT,
} as const;

/** 子元素依次缓入的 delay（秒） */
export const fadeUpDelay = (index: number) => `${0.06 + index * 0.09}s`;
