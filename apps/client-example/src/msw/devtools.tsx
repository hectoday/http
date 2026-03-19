import { useState, useCallback, useRef } from "react";
import { http, HttpResponse, delay, passthrough, bypass } from "msw";
import { fromOpenApi } from "@msw/source/open-api";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { getWorker } from "./index.ts";
import { cn } from "../styles.ts";

type ScenarioColor = "amber" | "red" | "blue" | "zinc";

interface Scenario {
  id: string;
  label: string;
  description: string;
  color: ScenarioColor;
  apply: () => void;
}

const colors: Record<ScenarioColor, { active: string; badge: string; ring: string }> = {
  amber: {
    active: "bg-amber-50 border-amber-200 text-amber-800",
    badge: "bg-amber-100 text-amber-700",
    ring: "ring-amber-300/50",
  },
  red: {
    active: "bg-red-50 border-red-200 text-red-800",
    badge: "bg-red-100 text-red-700",
    ring: "ring-red-300/50",
  },
  blue: {
    active: "bg-blue-50 border-blue-200 text-blue-800",
    badge: "bg-blue-100 text-blue-700",
    ring: "ring-blue-300/50",
  },
  zinc: {
    active: "bg-zinc-100 border-zinc-300 text-zinc-800",
    badge: "bg-zinc-200 text-zinc-700",
    ring: "ring-zinc-300/50",
  },
};

function getScenarios(worker: ReturnType<typeof getWorker>): Scenario[] {
  return [
    {
      id: "slow-auth",
      label: "Slow Auth",
      description: "5s delay on auth, then passthrough to real server",
      color: "amber",
      apply: () => {
        worker!.use(
          http.post("/api/auth/login", async () => {
            await delay(5000);
            return passthrough();
          }),
          http.post("/api/auth/signup", async () => {
            await delay(5000);
            return passthrough();
          }),
          http.get("/api/auth/me", async () => {
            await delay(5000);
            return passthrough();
          }),
        );
      },
    },
    {
      id: "slow-bookmarks",
      label: "Slow Bookmarks",
      description: "3s delay before returning bookmark data",
      color: "amber",
      apply: () => {
        worker!.use(
          http.get("/api/bookmarks", async ({ request }) => {
            await delay(3000);
            const original = await fetch(bypass(request));
            const data = await original.json();
            return HttpResponse.json(data);
          }),
        );
      },
    },
    {
      id: "fail-bookmarks",
      label: "500 Error",
      description: "Server error on bookmark list",
      color: "red",
      apply: () => {
        worker!.use(
          http.get("/api/bookmarks", () => {
            return HttpResponse.json({ error: "Internal Server Error" }, { status: 500 });
          }),
        );
      },
    },
    {
      id: "fail-create",
      label: "Fail Create",
      description: "403 when creating a bookmark",
      color: "red",
      apply: () => {
        worker!.use(
          http.post("/api/bookmarks", () => {
            return HttpResponse.json(
              { error: "You do not have permission to create bookmarks" },
              { status: 403 },
            );
          }),
        );
      },
    },
    {
      id: "network-error",
      label: "Network Error",
      description: "Simulates offline at network level",
      color: "red",
      apply: () => {
        worker!.use(
          http.get("/api/bookmarks", () => HttpResponse.error()),
          http.post("/api/bookmarks", () => HttpResponse.error()),
        );
      },
    },
    {
      id: "patch-response",
      label: "Patch Response",
      description: "Passthrough, then inject a fake bookmark into real data",
      color: "blue",
      apply: () => {
        worker!.use(
          http.get("/api/bookmarks", async ({ request }) => {
            const original = await fetch(bypass(request));
            const data = (await original.json()) as {
              bookmarks: unknown[];
              total: number;
              page: number;
              limit: number;
            };
            data.bookmarks.unshift({
              id: "bm-injected",
              url: "https://mswjs.io",
              title: "[Injected by MSW] Mock Service Worker",
              tags: ["msw", "injected"],
              createdBy: "msw",
              createdAt: new Date().toISOString(),
            });
            data.total += 1;
            return HttpResponse.json(data);
          }),
        );
      },
    },
    {
      id: "empty-state",
      label: "Empty State",
      description: "Zero bookmarks and tags",
      color: "zinc",
      apply: () => {
        worker!.use(
          http.get("/api/bookmarks", () =>
            HttpResponse.json({ bookmarks: [], total: 0, page: 1, limit: 20 }),
          ),
          http.get("/api/tags", () => HttpResponse.json({ tags: {} })),
        );
      },
    },
    {
      id: "openapi-source",
      label: "OpenAPI Source",
      description: "Mock /admin/stats from the OpenAPI spec via @msw/source",
      color: "blue",
      apply: () => {
        void fetch("/api/openapi.json")
          .then((res) => res.json())
          .then((spec) => {
            spec.servers = [{ url: "/api" }];
            spec.paths = { "/admin/stats": { get: spec.paths["/admin/stats"].get } };
            return fromOpenApi(spec);
          })
          .then((handlers) => {
            worker!.use(...handlers);
          });
      },
    },
  ];
}

export function MswDevtools() {
  const worker = getWorker();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Set<string>>(new Set());
  const scenariosRef = useRef<Scenario[]>(worker ? getScenarios(worker) : []);

  const toggle = useCallback(
    (scenario: Scenario) => {
      if (!worker) return;

      setActive((prev) => {
        const next = new Set(prev);
        if (next.has(scenario.id)) {
          next.delete(scenario.id);
        } else {
          next.add(scenario.id);
        }

        // Reset all handlers, then re-apply active ones
        worker.resetHandlers();
        for (const s of scenariosRef.current) {
          if (next.has(s.id)) s.apply();
        }

        return next;
      });

      // Small delay to let MSW process the handler changes
      setTimeout(() => {
        void queryClient.invalidateQueries();
      }, 50);
    },
    [worker, queryClient],
  );

  const resetAll = useCallback(() => {
    if (!worker) return;
    worker.resetHandlers();
    setActive(new Set());
    setTimeout(() => {
      void queryClient.invalidateQueries();
    }, 50);
  }, [worker, queryClient]);

  if (!worker) return null;

  const scenarios = scenariosRef.current;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end font-sans antialiased">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="mb-3 w-72 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-900/15"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-5 items-center justify-center rounded-md bg-amber-100">
                  <svg
                    className="size-3 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                    />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-zinc-700">MSW Devtools</span>
              </div>
              {active.size > 0 && (
                <button
                  onClick={resetAll}
                  className="rounded-md px-2 py-0.5 text-[0.65rem] font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
                >
                  Reset all
                </button>
              )}
            </div>

            {/* Scenarios */}
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto p-2">
              {scenarios.map((s) => {
                const isActive = active.has(s.id);
                const c = colors[s.color];
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 cursor-pointer",
                      isActive
                        ? cn(c.active, "ring-1", c.ring)
                        : "border-transparent text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    {/* Toggle indicator */}
                    <div
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        isActive ? "border-current bg-current" : "border-zinc-300",
                      )}
                    >
                      {isActive && (
                        <svg
                          className="size-2.5 text-white"
                          viewBox="0 0 12 12"
                          fill="currentColor"
                        >
                          <path
                            d="M10 3L4.5 8.5L2 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[0.7rem] font-semibold leading-tight">{s.label}</span>
                      <span className="text-[0.6rem] leading-snug opacity-60">{s.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold shadow-lg transition-colors cursor-pointer",
          open
            ? "bg-amber-500 text-white shadow-amber-500/30"
            : active.size > 0
              ? "bg-amber-500 text-white shadow-amber-500/30"
              : "bg-white text-amber-600 shadow-zinc-900/10 border border-zinc-200/80 hover:border-amber-200 hover:bg-amber-50",
        )}
      >
        <svg
          className="size-3.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
          />
        </svg>
        MSW
        {active.size > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-white/25 text-[0.6rem] font-bold">
            {active.size}
          </span>
        )}
      </motion.button>
    </div>
  );
}
