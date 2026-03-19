import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import { isMswActive } from "../msw/index.ts";
import { cn, statusDot, type StatusDot } from "../styles.ts";

export function EnvBar() {
  const msw = isMswActive();

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await api.health();
      if (!res.ok) throw new Error("API down");
      return true;
    },
    retry: false,
    refetchInterval: 30_000,
  });

  const healthy = healthQuery.isSuccess ? true : healthQuery.isError ? false : null;
  const healthStatus: StatusDot = healthy === null ? "checking" : healthy ? "ok" : "down";

  return (
    <div className="flex items-center justify-center gap-4 border-b border-zinc-200/60 bg-white/80 px-4 py-1.5 font-sans backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[0.7rem] text-zinc-500">
        <span className={cn("size-1.5 rounded-full", statusDot(healthStatus))} />
        API {healthy === null ? "checking..." : healthy ? "connected" : "unreachable"}
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider",
          msw
            ? "bg-amber-50 text-amber-600 border border-amber-200"
            : "bg-emerald-50 text-emerald-600 border border-emerald-200",
        )}
      >
        {msw ? "MSW" : "Live"}
      </span>
    </div>
  );
}
