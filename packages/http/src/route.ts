import type { z } from "zod";
import type { RouteConfig, RouteDescriptor } from "./types";

function defineRoute<
  TParamsSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
>(
  method: string,
  path: string,
  config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
): RouteDescriptor {
  return { method: method.toUpperCase(), path, config: config as RouteConfig<any, any, any, any> };
}

export const route = {
  get: <
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TBodySchema extends z.ZodTypeAny | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("GET", path, config),

  post: <
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TBodySchema extends z.ZodTypeAny | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("POST", path, config),

  put: <
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TBodySchema extends z.ZodTypeAny | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("PUT", path, config),

  patch: <
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TBodySchema extends z.ZodTypeAny | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("PATCH", path, config),

  delete: <
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TBodySchema extends z.ZodTypeAny | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("DELETE", path, config),

  head: <
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TBodySchema extends z.ZodTypeAny | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("HEAD", path, config),

  options: <
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TBodySchema extends z.ZodTypeAny | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("OPTIONS", path, config),

  all: <
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TBodySchema extends z.ZodTypeAny | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("", path, config),
};
