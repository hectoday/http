import { motion } from "motion/react";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <motion.svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="50 20"
        opacity="0.8"
      />
    </motion.svg>
  );
}
