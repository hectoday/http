import type { RouteDescriptor } from "./types";

/**
 * Group routes together. Currently returns the array as-is.
 * Exists as a named concept and future extension point.
 *
 * ```ts
 * export const userRoutes = group([
 *   route.get("/users", { ... }),
 *   route.post("/users", { ... }),
 * ]);
 * ```
 */
export function group(routes: RouteDescriptor[]): RouteDescriptor[] {
  return routes;
}
