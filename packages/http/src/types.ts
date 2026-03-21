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
> {
  readonly request: Request;
  readonly input: InputState<TParams, TQuery, TBody>;
  readonly locals: TLocals;
}

// ---------------------------------------------------------------------------
// Route config
// ---------------------------------------------------------------------------

export interface RouteConfig<
  TLocals extends Record<string, unknown> = Record<string, unknown>,
  TParamsSchema extends z.ZodType | undefined = undefined,
  TQuerySchema extends z.ZodType | undefined = undefined,
  TBodySchema extends z.ZodType | undefined = undefined,
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
    c: Context<
      TParamsSchema extends z.ZodType ? z.output<TParamsSchema> : Record<string, string>,
      TQuerySchema extends z.ZodType
        ? z.output<TQuerySchema>
        : Record<string, string | string[] | undefined>,
      TBodySchema extends z.ZodType ? z.output<TBodySchema> : unknown,
      TLocals
    >,
  ): Response | Promise<Response>;
}

// ---------------------------------------------------------------------------
// Route descriptor
// ---------------------------------------------------------------------------

export interface RouteDescriptor {
  method: string;
  path: string;
  config: RouteConfig<any, any, any, any>;
}

// ---------------------------------------------------------------------------
// Setup config
// ---------------------------------------------------------------------------

export interface SetupConfig<TLocals extends Record<string, unknown> = Record<string, unknown>> {
  routes: RouteDescriptor[];
  onRequest?: (args: { request: Request }) => TLocals | Promise<TLocals> | void | Promise<void>;
  onResponse?: (args: {
    request: Request;
    response: Response;
    locals: TLocals;
  }) => Response | Promise<Response>;
  onError?: (args: {
    error: unknown;
    request: Request;
    locals: Partial<TLocals>;
  }) => Response | Promise<Response>;
  onNotFound?: (args: { request: Request; locals: TLocals }) => Response | Promise<Response>;
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

export interface App {
  fetch: (request: Request) => Response | Promise<Response>;
  request: (path: string, options?: RequestOptions) => Promise<Response>;
  routes: RouteDescriptor[];
}
