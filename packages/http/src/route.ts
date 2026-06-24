import type * as z from "zod/v4";
import type { RouteConfig, RouteDescriptor } from "./types";

function defineRoute<
  TParamsSchema extends z.ZodType | undefined = undefined,
  TQuerySchema extends z.ZodType | undefined = undefined,
  TBodySchema extends z.ZodType | undefined = undefined,
  TEnv = unknown,
>(
  method: string,
  path: string,
  config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
): RouteDescriptor {
  return { method: method.toUpperCase(), path, config: config as RouteConfig<any, any, any, any> };
}

/**
 * A method-keyed set of route builders. Identical to the top-level {@link route}
 * object, but every handler's `c.env` is typed as `TEnv`.
 */
export interface RouteFactory<TEnv> {
  get: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
  ) => RouteDescriptor;
  post: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
  ) => RouteDescriptor;
  put: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
  ) => RouteDescriptor;
  patch: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
  ) => RouteDescriptor;
  delete: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
  ) => RouteDescriptor;
  head: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
  ) => RouteDescriptor;
  options: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
  ) => RouteDescriptor;
  all: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema, TEnv>,
  ) => RouteDescriptor;
}

/**
 * Create a set of route builders whose handlers receive a typed `c.env`.
 *
 * Use this when the app is served through a hosting adapter that supplies a
 * runtime binding — for example Convex, where `c.env` is the `ActionCtx`:
 *
 * ```ts
 * import { createRoutes } from "@hectoday/http";
 * import type { ActionCtx } from "./_generated/server";
 *
 * const route = createRoutes<ActionCtx>();
 *
 * route.get("/messages", {
 *   resolve: async (c) => Response.json(await c.env.runQuery(api.messages.list)),
 * });
 * ```
 *
 * The default {@link route} export is `createRoutes<unknown>()`.
 */
export function createRoutes<TEnv = unknown>(): RouteFactory<TEnv> {
  return {
    get: (path, config) => defineRoute("GET", path, config),
    post: (path, config) => defineRoute("POST", path, config),
    put: (path, config) => defineRoute("PUT", path, config),
    patch: (path, config) => defineRoute("PATCH", path, config),
    delete: (path, config) => defineRoute("DELETE", path, config),
    head: (path, config) => defineRoute("HEAD", path, config),
    options: (path, config) => defineRoute("OPTIONS", path, config),
    all: (path, config) => defineRoute("", path, config),
  };
}

export const route: RouteFactory<unknown> = createRoutes();
