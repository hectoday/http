import { motion } from "motion/react";
import { cn } from "../styles.ts";

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={cn("rounded-lg bg-zinc-200/70", className)}
      style={style}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function BookmarkSkeleton() {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Shimmer className="size-6 shrink-0 rounded-lg" />
          <Shimmer className="h-4 w-48 rounded-md" />
        </div>
        <Shimmer className="ml-8 h-3 w-64 rounded-md" />
        <div className="ml-8 flex gap-1.5">
          <Shimmer className="h-4 w-12 rounded-md" />
          <Shimmer className="h-4 w-16 rounded-md" />
          <Shimmer className="h-4 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function TagsSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[20, 16, 24, 14, 18].map((w, i) => (
        <Shimmer key={i} className="h-7 rounded-full" style={{ width: `${w * 4}px` }} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10 font-sans antialiased">
      {/* Header skeleton */}
      <header className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <Shimmer className="size-9 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Shimmer className="h-5 w-28 rounded-md" />
            <Shimmer className="h-3 w-36 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1.5">
            <Shimmer className="h-4 w-16 rounded-md" />
            <Shimmer className="h-3 w-10 rounded-md" />
          </div>
          <Shimmer className="size-8 rounded-lg" />
        </div>
      </header>

      {/* Form skeleton */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Shimmer className="size-4 rounded" />
          <Shimmer className="h-4 w-24 rounded-md" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Shimmer className="h-10 flex-[2] rounded-xl" />
            <Shimmer className="h-10 flex-[1] rounded-xl" />
          </div>
          <div className="flex gap-3">
            <Shimmer className="h-10 flex-1 rounded-xl" />
            <Shimmer className="h-10 w-20 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tags skeleton */}
      <TagsSkeleton />

      {/* Bookmarks skeleton */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shimmer className="size-4 rounded" />
            <Shimmer className="h-4 w-24 rounded-md" />
            <Shimmer className="h-5 w-8 rounded-full" />
          </div>
          <Shimmer className="h-8 w-16 rounded-xl" />
        </div>
        <div className="flex flex-col divide-y divide-zinc-100">
          <BookmarkSkeleton />
          <BookmarkSkeleton />
          <BookmarkSkeleton />
        </div>
      </div>
    </div>
  );
}
