import type { GuardFn, Handler } from "./route.ts";

// Type for composable handler groups
export type HandlerGroup = Handler | Handler[] | HandlerGroup[];

export interface GroupOptions {
  handlers: HandlerGroup[];
  guards?: GuardFn[];
}

/**
 * Compose multiple handlers with shared guards.
 *
 * Guards are prepended to all handlers in the group. This allows you to apply
 * common authentication, authorization, or other middleware logic to multiple routes.
 *
 * @param options - Configuration object with handlers and optional guards
 * @returns A flat array of handlers with guards applied
 *
 * @example
 * ```ts
 * const protectedRoutes = group({
 *   guards: [requireAuth],
 *   handlers: [
 *     route.get("/profile", { resolve: getProfile }),
 *     route.post("/logout", { resolve: logout }),
 *   ],
 * });
 * ```
 */
export function group(options: GroupOptions): Handler[] {
  const { handlers, guards } = options;
  const result: Handler[] = [];

  for (const item of handlers) {
    if (Array.isArray(item)) {
      // Recursively flatten nested groups
      const nestedHandlers = group({ handlers: item });
      result.push(...nestedHandlers);
    } else {
      // Single handler
      result.push(item);
    }
  }

  // Apply guards to all handlers in this group
  if (guards && guards.length > 0) {
    return result.map((handler) => ({
      ...handler,
      guards: [...(guards || []), ...(handler.guards || [])],
    }));
  }

  return result;
}
