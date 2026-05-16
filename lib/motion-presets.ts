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

/** 生成配置抽屉：面板与遮罩共用时长与曲线，避免与内容缓入错位 */
export const drawerPanelTransition = {
  type: "tween",
  duration: 0.3,
  ease: [0.32, 0.72, 0, 1],
} as const;

export const drawerBackdropTransition = drawerPanelTransition;

/** 首页子元素依次缓入的 delay（秒） */
export const fadeUpDelay = (index: number) => `${0.05 + index * 0.07}s`;
