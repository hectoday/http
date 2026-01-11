import type {
  InferInput,
  InferSchema,
  InputState,
  RequestSchemas,
  SchemaLike,
} from "./validation-types.ts";

// Path parameters extracted from URL (e.g., { id: "123" })
export type RouteParams = Record<string, string | undefined>;

// Raw, unvalidated values extracted from the request
export interface RawValues {
  /** Request's path parameters (strings from URLPattern) */
  readonly params: RouteParams;
  /** Request's query parameters (strings or string arrays) */
  readonly query: Record<string, string | string[]>;
  /** Parsed JSON body (only if body schema exists and parsing succeeded) */
  readonly body?: unknown;
}

// Context object passed to handlers and guards
export interface Context<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> {
  /** Native Request (source of truth) */
  readonly req: Request;
  /** Extracted, unvalidated values */
  readonly raw: RawValues;
  /** Validation gate */
  readonly input: InputState<TParams, TQuery, TBody>;
  /** Shared state across guards and handlers for the request */
  locals: Record<string, unknown>;
}

// Function signature for route handlers
export type HandlerFn<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> = (
  c: Context<TParams, TQuery, TBody>,
) => Response | Promise<Response>;

// Guard result types
export type GuardResult =
  | { allow: true; locals?: Record<string, unknown> }
  | { deny: Response };

// Guard function that returns a structured result
export type GuardFn = (
  c: Context,
) => GuardResult | Promise<GuardResult>;

// Route configuration object with type inference from schemas
export interface RouteConfig<
  TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
> {
  resolve: HandlerFn<
    TSchemas extends { params: infer S }
      ? (S extends SchemaLike ? InferSchema<S> : unknown)
      : unknown,
    TSchemas extends { query: infer S }
      ? (S extends SchemaLike ? InferSchema<S> : unknown)
      : unknown,
    TSchemas extends { body: infer S }
      ? (S extends SchemaLike ? InferSchema<S> : unknown)
      : unknown
  >;
  guards?: GuardFn[];
  request?: TSchemas;
}

// Descriptor linking HTTP method + path + handler function
export type Handler = {
  method: string;
  path: string;
  handler: HandlerFn;
  guards?: GuardFn[];
  request?: RequestSchemas<SchemaLike>;
};

// Factory methods to create Handler descriptors for each HTTP verb
export const route = {
  get: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method: "GET",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
  head: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method: "HEAD",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
  post: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method: "POST",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
  put: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method: "PUT",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
  patch: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method: "PATCH",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
  delete: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method: "DELETE",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
  options: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method: "OPTIONS",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
  all: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method: "*",
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
  on: <
    TSchemas extends RequestSchemas<SchemaLike> = RequestSchemas<SchemaLike>,
  >(
    method: string,
    path: string,
    config: RouteConfig<TSchemas>,
  ): Handler => ({
    method,
    path,
    handler: config.resolve as HandlerFn,
    guards: config.guards,
    request: config.request,
  }),
};
