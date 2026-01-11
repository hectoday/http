import type {
  InferSchema,
  InputState,
  RequestSchemas,
  SchemaLike,
} from "./validation-types.ts";

/**
 * Path parameters extracted from the URL pattern.
 *
 * @example
 * For route `/users/:id`, RouteParams would be `{ id: "123" }`
 */
export type RouteParams = Record<string, string | undefined>;

/**
 * Raw, unvalidated values extracted from the request.
 *
 * These values are always available regardless of validation state.
 * Access validated values through `c.input` instead.
 */
export interface RawValues {
  /** Request's path parameters (strings from URLPattern) */
  readonly params: RouteParams;
  /** Request's query parameters (strings or string arrays) */
  readonly query: Record<string, string | string[]>;
  /** Parsed JSON body (only if body schema exists and parsing succeeded) */
  readonly body?: unknown;
}

/**
 * Request context passed to handlers and guards.
 *
 * Contains the native Request object, raw values, validation state, and shared locals.
 *
 * @typeParam TParams - Type of validated path parameters
 * @typeParam TQuery - Type of validated query parameters
 * @typeParam TBody - Type of validated request body
 */
export interface Context<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> {
  /** Native Request (source of truth) */
  readonly request: Request;
  /** Extracted, unvalidated values */
  readonly raw: RawValues;
  /** Validation gate */
  readonly input: InputState<TParams, TQuery, TBody>;
  /** Shared state across guards and handlers for the request */
  locals: Record<string, unknown>;
}

/**
 * Route handler function that returns an HTTP Response.
 *
 * Handlers must explicitly return a Response object. The framework never
 * auto-generates responses based on return values or thrown errors.
 *
 * @typeParam TParams - Type of validated path parameters
 * @typeParam TQuery - Type of validated query parameters
 * @typeParam TBody - Type of validated request body
 */
export type HandlerFn<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> = (
  c: Context<TParams, TQuery, TBody>,
) => Response | Promise<Response>;

/**
 * Result returned by a guard function.
 *
 * Guards either allow the request to proceed (optionally adding locals)
 * or deny it by returning a Response.
 */
export type GuardResult =
  | { allow: true; locals?: Record<string, unknown> }
  | { deny: Response };

/**
 * Guard function that controls access to routes.
 *
 * Guards run after validation but before the handler. They can deny requests
 * or add facts to the context via locals.
 *
 * @example
 * ```ts
 * const requireAuth: GuardFn = (c) => {
 *   const token = c.request.headers.get("authorization");
 *   if (!token) {
 *     return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
 *   }
 *   const user = verifyToken(token);
 *   return { allow: true, locals: { user } };
 * };
 * ```
 */
export type GuardFn = (
  c: Context,
) => GuardResult | Promise<GuardResult>;

/**
 * Configuration for a route handler.
 *
 * Defines the handler function, optional guards, and request schemas for validation.
 * Types are automatically inferred from the schemas.
 *
 * @typeParam TSchemas - Request validation schemas for params, query, and body
 */
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

/**
 * Internal handler descriptor that links an HTTP method, path pattern, and handler function.
 *
 * Created by route factory functions like `route.get()`, `route.post()`, etc.
 */
export type Handler = {
  method: string;
  path: string;
  handler: HandlerFn;
  guards?: GuardFn[];
  request?: RequestSchemas<SchemaLike>;
};

/**
 * Route factory functions for creating HTTP handlers.
 *
 * Each method creates a handler descriptor for a specific HTTP verb.
 * Supports automatic type inference from request schemas.
 *
 * @example
 * ```ts
 * route.get("/users/:id", {
 *   request: {
 *     params: z.object({ id: z.string() }),
 *   },
 *   resolve: (c) => {
 *     if (!c.input.ok) {
 *       return Response.json({ error: c.input.issues }, { status: 400 });
 *     }
 *     const { id } = c.input.params; // Type-safe!
 *     return Response.json({ id });
 *   },
 * })
 * ```
 */
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
