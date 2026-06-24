import {
  httpRouter,
  httpActionGeneric,
  type GenericActionCtx,
  type GenericDataModel,
  type HttpRouter,
} from "convex/server";
import { createRoutes } from "@hectoday/http";
import type { App, RouteFactory } from "@hectoday/http";

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

/**
 * HTTP methods Convex is able to route. Convex serves `HEAD` through the `GET`
 * handler, so it is intentionally absent here.
 */
const ROUTABLE_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"] as const;

export type ConvexMethod = (typeof ROUTABLE_METHODS)[number];

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

/**
 * The Convex action context handed to every request, exposed to handlers as
 * `c.env`. This is the equivalent of `HonoWithConvex`'s `c.env` binding.
 *
 * ```ts
 * import { convexRoutes, type ConvexEnv } from "@hectoday/convex";
 * import type { DataModel } from "./_generated/dataModel";
 *
 * const route = convexRoutes<ConvexEnv<DataModel>>();
 * ```
 *
 * If you have generated server types you can pass your own `ActionCtx` directly:
 * `convexRoutes<ActionCtx>()`.
 */
export type ConvexEnv<DataModel extends GenericDataModel = GenericDataModel> =
  GenericActionCtx<DataModel>;

// ---------------------------------------------------------------------------
// Typed route factory
// ---------------------------------------------------------------------------

/**
 * Build route descriptors whose `c.env` is typed as the Convex action context.
 *
 * Pass your generated `ActionCtx` (or a {@link ConvexEnv} for a `DataModel`):
 *
 * ```ts
 * import { convexRoutes } from "@hectoday/convex";
 * import type { ActionCtx } from "./_generated/server";
 * import { api } from "./_generated/api";
 * import { z } from "zod/v4";
 *
 * const route = convexRoutes<ActionCtx>();
 *
 * export const messageRoutes = [
 *   route.get("/listMessages/:userId", {
 *     request: { params: z.object({ userId: z.string().regex(/^[0-9]+$/) }) },
 *     resolve: async (c) => {
 *       if (!c.input.ok) return Response.json(c.input.issues, { status: 400 });
 *       const messages = await c.env.runQuery(api.messages.getByAuthor, {
 *         authorNumber: c.input.params.userId,
 *       });
 *       return Response.json(messages);
 *     },
 *   }),
 * ];
 * ```
 */
export function convexRoutes<
  Ctx extends GenericActionCtx<GenericDataModel> = GenericActionCtx<GenericDataModel>,
>(): RouteFactory<Ctx> {
  return createRoutes<Ctx>();
}

// ---------------------------------------------------------------------------
// Router adapter
// ---------------------------------------------------------------------------

export interface ConvexRouterOptions {
  /**
   * HTTP methods to register the catch-all handler for. Defaults to every
   * method Convex can route (`GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`,
   * `PATCH`).
   */
  methods?: readonly ConvexMethod[];
}

/**
 * Mount a `@hectoday/http` app onto a Convex `HttpRouter`.
 *
 * Every incoming request is forwarded to `app.fetch(request, ctx)`, with the
 * Convex `ActionCtx` passed through as `c.env`. Routing, validation, and
 * lifecycle hooks are all handled by Hectoday — Convex only sees a catch-all
 * `pathPrefix: "/"` route per method.
 *
 * Use it as the default export of `convex/http.ts`:
 *
 * ```ts
 * // convex/http.ts
 * import { setup } from "@hectoday/http";
 * import { convexRouter } from "@hectoday/convex";
 * import { messageRoutes } from "./routes";
 *
 * const app = setup({ routes: messageRoutes });
 *
 * export default convexRouter(app);
 * ```
 *
 * @remarks Because all paths are served through a single prefix route, the
 * Convex dashboard lists one catch-all entry per method rather than each
 * individual Hectoday route.
 */
export function convexRouter(app: App<any>, options: ConvexRouterOptions = {}): HttpRouter {
  const http = httpRouter();
  const methods = options.methods ?? ROUTABLE_METHODS;

  const handler = httpActionGeneric(async (ctx, request) => {
    return app.fetch(request, ctx);
  });

  for (const method of methods) {
    http.route({ pathPrefix: "/", method, handler });
  }

  return http;
}
