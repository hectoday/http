import type * as z from "zod/v4";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  part: "params" | "query" | "body";
  path: readonly string[];
  message: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Input state
// ---------------------------------------------------------------------------

export type InputStateOk<TParams = unknown, TQuery = unknown, TBody = unknown> = {
  ok: true;
  params: TParams;
  query: TQuery;
  body: TBody;
  issues: [];
  failed: [];
};

export type InputStateFailed = {
  ok: false;
  params: undefined;
  query: undefined;
  body: undefined;
  issues: ValidationIssue[];
  failed: ("params" | "query" | "body")[];
};

export type InputState<TParams = unknown, TQuery = unknown, TBody = unknown> =
  | InputStateOk<TParams, TQuery, TBody>
  | InputStateFailed;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface Context<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
  TLocals extends Record<string, unknown> = Record<string, unknown>,
  TEnv = unknown,
> {
  readonly request: Request;
  readonly input: InputState<TParams, TQuery, TBody>;
  readonly locals: TLocals;
  /**
   * Runtime binding passed as the second argument to `app.fetch(request, env)`.
   *
   * Empty (`undefined`) when the app is served directly. Hosting adapters use
   * this to expose their platform context — e.g. the Convex `ActionCtx`, so
   * handlers can call `c.env.runQuery(...)` / `c.env.runMutation(...)`.
   */
  readonly env: TEnv;
}

// ---------------------------------------------------------------------------
// Resolve context – omits input when no schemas are defined
// ---------------------------------------------------------------------------

type InferParams<T> = T extends z.ZodType ? z.output<T> : Record<string, string>;
type InferQuery<T> = T extends z.ZodType
  ? z.output<T>
  : Record<string, string | string[] | undefined>;
type InferBody<T> = T extends z.ZodType ? z.output<T> : unknown;

type HasSchema<P, Q, B> = P extends z.ZodType
  ? true
  : Q extends z.ZodType
    ? true
    : B extends z.ZodType
      ? true
      : false;

type ResolveContext<
  TParamsSchema,
  TQuerySchema,
  TBodySchema,
  TLocals extends Record<string, unknown>,
  TEnv,
> =
  HasSchema<TParamsSchema, TQuerySchema, TBodySchema> extends true
    ? {
        readonly request: Request;
        readonly input: InputState<
          InferParams<TParamsSchema>,
          InferQuery<TQuerySchema>,
          InferBody<TBodySchema>
        >;
        readonly locals: TLocals;
        readonly env: TEnv;
      }
    : {
        readonly request: Request;
        readonly locals: TLocals;
        readonly env: TEnv;
      };

// ---------------------------------------------------------------------------
// Route config
// ---------------------------------------------------------------------------

export interface RouteConfig<
  TLocals extends Record<string, unknown> = Record<string, unknown>,
  TParamsSchema extends z.ZodType | undefined = undefined,
  TQuerySchema extends z.ZodType | undefined = undefined,
  TBodySchema extends z.ZodType | undefined = undefined,
  TEnv = unknown,
> {
  request?: {
    params?: TParamsSchema;
    query?: TQuerySchema;
    body?: TBodySchema;
  };
  response?: Record<number, z.ZodType>;
  /**
   * Handle the request and return a Response.
   *
   * Method syntax enables bivariant parameter checking — this allows
   * annotating `c` with a wider locals type if needed.
   */
  resolve(
    c: ResolveContext<TParamsSchema, TQuerySchema, TBodySchema, TLocals, TEnv>,
  ): Response | Promise<Response>;
}

// ---------------------------------------------------------------------------
// Route descriptor
// ---------------------------------------------------------------------------

export interface RouteDescriptor {
  method: string;
  path: string;
  config: {
    request?: { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType };
    response?: Record<number, z.ZodType>;
    resolve(c: Context): Response | Promise<Response>;
  };
}

// ---------------------------------------------------------------------------
// Setup config
// ---------------------------------------------------------------------------

export interface SetupConfig<
  TLocals extends Record<string, unknown> = Record<string, unknown>,
  TEnv = unknown,
> {
  routes: RouteDescriptor[];
  onRequest?: (args: {
    request: Request;
    env: TEnv;
  }) => TLocals | Promise<TLocals> | void | Promise<void>;
  onResponse?: (args: {
    request: Request;
    response: Response;
    locals: TLocals;
    env: TEnv;
  }) => Response | Promise<Response>;
  onError?: (args: {
    error: Error;
    request: Request;
    locals: Partial<TLocals>;
    env: TEnv;
  }) => Response | Promise<Response>;
  onNotFound?: (args: {
    request: Request;
    locals: TLocals;
    env: TEnv;
  }) => Response | Promise<Response>;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | string[]>;
}

export interface App<TEnv = unknown> {
  /**
   * Web-standard fetch handler.
   *
   * The optional second argument is exposed to handlers as `c.env`. Hosting
   * adapters pass their platform context here — e.g. Convex calls
   * `app.fetch(request, ctx)`.
   */
  fetch: (request: Request, env?: TEnv) => Response | Promise<Response>;
  request: (path: string, options?: RequestOptions) => Promise<Response>;
  routes: RouteDescriptor[];
}
