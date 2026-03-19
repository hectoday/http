import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "../components/spinner.tsx";
import { formatUptime, formatBytes } from "../helpers/format.ts";
import { useSession } from "../hooks/use-session.ts";
import { adminStatsOptions } from "../api/queries.ts";
import { cn, buttonVariant, btn, card } from "../styles.ts";

export function AdminPage() {
  const { token, user } = useSession();

  const statsQuery = useQuery({
    ...adminStatsOptions(token!),
    enabled: !!token && user?.role === "admin",
    refetchInterval: 5_000,
  });

  if (!user) return null;

  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 font-sans antialiased">
        <div className={cn(card, "flex flex-col items-center gap-3 py-12 text-center")}>
          <svg
            className="size-8 text-red-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
          <p className="text-sm font-medium text-zinc-900">Admin access required</p>
          <p className="text-xs text-zinc-400">You need the admin role to view this page.</p>
          <Link to="/" className={cn(btn, buttonVariant("default"), "mt-2")}>
            Back to bookmarks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10 font-sans antialiased">
      {/* Header */}
      <header className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-violet-600 shadow-sm shadow-violet-600/25">
            <svg
              className="size-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Admin</h1>
            <p className="text-[0.8rem] text-zinc-400">Server stats &amp; diagnostics</p>
          </div>
        </div>
        <Link to="/" className={cn(btn, buttonVariant("default"), "text-xs")}>
          Back to bookmarks
        </Link>
      </header>

      {/* Stats */}
      <section className={card}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Server Stats</h2>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-emerald-600 border border-emerald-200">
            Live — 5s refresh
          </span>
        </div>

        {statsQuery.isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-5 text-zinc-300" />
          </div>
        )}

        {statsQuery.error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {statsQuery.error.message}
          </div>
        )}

        {statsQuery.data && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
              <p className="text-[0.7rem] font-medium uppercase tracking-wider text-zinc-400">
                Uptime
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-zinc-900">
                {formatUptime(statsQuery.data.uptime)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
              <p className="text-[0.7rem] font-medium uppercase tracking-wider text-zinc-400">
                Memory (RSS)
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-zinc-900">
                {formatBytes(statsQuery.data.memory)}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
