import type { SetupWorker } from "msw/browser";

let worker: SetupWorker | null = null;
let active = false;

/**
 * Initialise MSW when the VITE_MSW env flag is set.
 *
 * 1. Start the service worker with the hand-written handlers.
 * 2. Layer OpenAPI-generated handlers on top (admin/stats).
 *    If the backend is unreachable the hand-written fallback stays active.
 */
export async function initMsw(): Promise<void> {
  if (!import.meta.env.VITE_MSW) return;

  // 1 — static handlers (auth, bookmarks, health)
  const { worker: browserWorker } = await import("./browser.ts");
  worker = browserWorker;
  await worker.start({ onUnhandledRequest: "bypass" });

  // 2 — OpenAPI-sourced handler for admin/stats
  try {
    const { adminOpenApiHandlers } = await import("./handlers/admin.ts");
    const handlers = await adminOpenApiHandlers();
    worker.use(...handlers);
  } catch {
    // Backend not reachable — hand-written handler stays active
  }

  active = true;
}

export function isMswActive(): boolean {
  return active;
}

export function getWorker(): SetupWorker | null {
  return worker;
}
