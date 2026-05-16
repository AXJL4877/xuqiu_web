/** 页面缓入动画共用曲线（短、稳，避免 spring 回弹导致卡顿感） */
export const EASE_OUT = [0.25, 0.1, 0.25, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE_OUT },
  },
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

export const drawerPanelTransition = {
  duration: 0.32,
  ease: EASE_OUT,
} as const;
