import type * as z from "zod/v4";
import type { RouteConfig, RouteDescriptor } from "./types";

function defineRoute<
  TParamsSchema extends z.ZodType | undefined = undefined,
  TQuerySchema extends z.ZodType | undefined = undefined,
  TBodySchema extends z.ZodType | undefined = undefined,
>(
  method: string,
  path: string,
  config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
): RouteDescriptor {
  return { method: method.toUpperCase(), path, config: config as RouteConfig<any, any, any, any> };
}

export const route = {
  get: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("GET", path, config),

  post: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("POST", path, config),

  put: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("PUT", path, config),

  patch: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("PATCH", path, config),

  delete: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("DELETE", path, config),

  head: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("HEAD", path, config),

  options: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("OPTIONS", path, config),

  all: <
    TParamsSchema extends z.ZodType | undefined = undefined,
    TQuerySchema extends z.ZodType | undefined = undefined,
    TBodySchema extends z.ZodType | undefined = undefined,
  >(
    path: string,
    config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
  ) => defineRoute("", path, config),
};
