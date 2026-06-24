import { createRouter, addRoute, findRoute } from "rou3";
import { parseQuery } from "./query";
import type {
  App,
  Context,
  InputState,
  InputStateFailed,
  InputStateOk,
  RequestOptions,
  RouteDescriptor,
  SetupConfig,
  ValidationIssue,
} from "./types";
import type * as z from "zod/v4";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inputOk(params?: unknown, query?: unknown, body?: unknown): InputStateOk {
  return {
    ok: true,
    params,
    query,
    body,
    issues: [],
    failed: [],
  };
}

function inputFailed(
  issues: ValidationIssue[],
  failed: ("params" | "query" | "body")[],
): InputStateFailed {
  return {
    ok: false,
    params: undefined,
    query: undefined,
    body: undefined,
    issues,
    failed,
  };
}

function makeContext(
  request: Request,
  input: InputState,
  locals: Record<string, unknown>,
  env: unknown,
): Context {
  return Object.freeze({ request, input, locals, env });
}

function defaultNotFound(): Response {
  return Response.json({ error: "Not Found" }, { status: 404 });
}

function defaultError(): Response {
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}

type ParsedJsonBody =
  | { state: "missing"; value: undefined }
  | { state: "parsed"; value: unknown }
  | { state: "invalid"; value: undefined };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validatePart(
  schema: z.ZodType,
  input: unknown,
  part: "params" | "query" | "body",
): { ok: true; value: unknown } | { ok: false; issues: ValidationIssue[] } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      part,
      path: i.path.map(String),
      message: i.message,
      code: i.code,
    })),
  };
}

function runValidation(
  schemas: { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType },
  rawParams: Record<string, string | undefined>,
  rawQuery: Record<string, string | string[] | undefined>,
  rawBody: unknown,
  bodyState: ParsedJsonBody["state"],
): InputState {
  const issues: ValidationIssue[] = [];
  const failed: ("params" | "query" | "body")[] = [];

  let params: unknown = rawParams;
  let query: unknown = rawQuery;
  let body: unknown = rawBody;

  if (bodyState === "invalid") {
    issues.push({
      part: "body",
      path: [],
      message: "Invalid JSON",
      code: "invalid_json",
    });
    failed.push("body");
  }

  const parts: {
    key: "params" | "query" | "body";
    schema?: z.ZodType;
    input: unknown;
  }[] = [
    { key: "params", schema: schemas.params, input: rawParams },
    { key: "query", schema: schemas.query, input: rawQuery },
  ];

  if (schemas.body && bodyState !== "invalid") {
    parts.push({ key: "body", schema: schemas.body, input: rawBody });
  }

  for (const { key, schema, input } of parts) {
    if (!schema) continue;
    const result = validatePart(schema, input, key);
    if (result.ok) {
      if (key === "params") params = result.value;
      else if (key === "query") query = result.value;
      else if (key === "body") body = result.value;
    } else {
      issues.push(...result.issues);
      failed.push(key);
    }
  }

  if (issues.length > 0) return inputFailed(issues, failed);
  return inputOk(params, query, body);
}

// ---------------------------------------------------------------------------
// app.request helper
// ---------------------------------------------------------------------------

function buildRequest(path: string, options: RequestOptions = {}): Request {
  const method = (options.method ?? "GET").toUpperCase();

  const url = new URL(path, "http://localhost");

  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          url.searchParams.append(k, item);
        }
        continue;
      }
      url.searchParams.set(k, v);
    }
  }

  const headers = new Headers(options.headers);

  const init: RequestInit = { method, headers };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  return new Request(url, init);
}

// ---------------------------------------------------------------------------
// setup()
// ---------------------------------------------------------------------------

export function setup<
  TLocals extends Record<string, unknown> = Record<string, unknown>,
  TEnv = unknown,
>(config: SetupConfig<TLocals, TEnv>): App<TEnv> {
  const { routes: handlers, onRequest, onResponse, onError, onNotFound } = config;

  // Build rou3 router
  const router = createRouter<RouteDescriptor>();
  for (const d of handlers) {
    addRoute(router, d.method || undefined, d.path, d);
  }

  // Safe hook runners
  async function safeOnResponse(
    request: Request,
    response: Response,
    locals: TLocals,
    env: TEnv,
  ): Promise<Response> {
    if (!onResponse) return response;
    const fallback = response.clone();
    try {
      return await onResponse({ request, response, locals, env });
    } catch {
      return fallback;
    }
  }

  async function safeOnError(
    error: unknown,
    request: Request,
    locals: Partial<TLocals>,
    env: TEnv,
  ): Promise<Response> {
    if (!onError) return defaultError();
    try {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error), { cause: error });
      return await onError({ error: normalizedError, request, locals, env });
    } catch {
      return defaultError();
    }
  }

  async function respondWithError(
    error: unknown,
    request: Request,
    locals: TLocals,
    env: TEnv,
  ): Promise<Response> {
    const response = await safeOnError(error, request, locals, env);
    return safeOnResponse(request, response, locals, env);
  }

  // The core request handler
  const handle = async (request: Request, env?: TEnv): Promise<Response> => {
    const boundEnv = env as TEnv;

    // 1. onRequest → locals (optional return)
    let locals = {} as TLocals;

    if (onRequest) {
      try {
        const result = await onRequest({ request, env: boundEnv });
        if (result !== undefined && result !== null) {
          locals = result as TLocals;
        }
      } catch (err) {
        return respondWithError(err, request, locals, boundEnv);
      }
    }

    // 2. Route matching
    const url = new URL(request.url);
    // A HEAD request falls back to its GET route (web-standard behavior); the
    // body is stripped from the response by the `fetch` wrapper below.
    const matched =
      findRoute(router, request.method, url.pathname) ??
      (request.method === "HEAD" ? findRoute(router, "GET", url.pathname) : undefined);

    if (!matched) {
      let res: Response;
      if (onNotFound) {
        try {
          res = await onNotFound({ request, locals, env: boundEnv });
        } catch (err) {
          return respondWithError(err, request, locals, boundEnv);
        }
      } else {
        res = defaultNotFound();
      }
      return safeOnResponse(request, res, locals, boundEnv);
    }

    const { config: routeConfig } = matched.data;

    try {
      // 3. Extract raw inputs
      const rawParams = (matched.params as Record<string, string | undefined>) ?? {};
      const rawQuery = parseQuery(url.search);
      let rawBody: unknown = undefined;
      const hasBodySchema = routeConfig.request?.body !== undefined;
      let bodyState: ParsedJsonBody["state"] = "missing";

      if (hasBodySchema) {
        const contentLength = request.headers.get("content-length");
        const transferEncoding = request.headers.get("transfer-encoding");

        if (request.body === null || (contentLength === "0" && !transferEncoding)) {
          bodyState = "missing";
        } else {
          try {
            const text = await request.text();

            if (text === "") {
              bodyState = "missing";
            } else {
              rawBody = JSON.parse(text);
              bodyState = "parsed";
            }
          } catch {
            bodyState = "invalid";
          }
        }
      }

      // 4. Validate
      let input: InputState;
      const hasSchemas =
        routeConfig.request &&
        (routeConfig.request.params || routeConfig.request.query || routeConfig.request.body);

      if (hasSchemas) {
        input = runValidation(routeConfig.request!, rawParams, rawQuery, rawBody, bodyState);
      } else {
        input = inputOk(rawParams, rawQuery, rawBody);
      }

      // 5. Handler
      const context = makeContext(request, input, locals, boundEnv);
      const response = await routeConfig.resolve(context);
      return safeOnResponse(request, response, locals, boundEnv);
    } catch (err) {
      if (err instanceof Response) {
        return safeOnResponse(request, err, locals, boundEnv);
      }
      return respondWithError(err, request, locals, boundEnv);
    }
  };

  // The fetch handler. A HEAD response must never carry a body, so strip it
  // after the (GET) handler runs while keeping status and headers intact.
  const fetch = async (request: Request, env?: TEnv): Promise<Response> => {
    const response = await handle(request, env);
    if (request.method === "HEAD" && response.body !== null) {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
  };

  // app.request convenience
  const request = (path: string, options?: RequestOptions): Promise<Response> => {
    return fetch(buildRequest(path, options));
  };

  return { fetch, request, routes: handlers };
}
