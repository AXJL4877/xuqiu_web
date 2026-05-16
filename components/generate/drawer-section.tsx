"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type DrawerSectionProps = {
  children: ReactNode;
  index: number;
  className?: string;
};

export function DrawerSection({ children, index, className }: DrawerSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.04 * index,
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.section>
  );
}
