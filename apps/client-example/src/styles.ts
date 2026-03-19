import { cn, variants } from "cn-variants";

export { cn };

export const buttonVariant = variants({
  default:
    "border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 active:scale-[0.98]",
  primary:
    "border-transparent bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.98]",
  danger:
    "border-transparent bg-red-50 text-red-600 hover:bg-red-600 hover:text-white active:scale-[0.98]",
  ghost: "border-transparent bg-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100",
});

export type ButtonVariant = keyof typeof buttonVariant.options;

export const statusDot = variants({
  checking: "bg-zinc-300 animate-pulse",
  ok: "bg-emerald-500 shadow-sm shadow-emerald-500/40",
  down: "bg-red-500 shadow-sm shadow-red-500/40",
});

export type StatusDot = keyof typeof statusDot.options;

export const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-all placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export const card = "rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm";
