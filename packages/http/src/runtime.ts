// runtime.ts

import type { Context, Handler } from "./route.ts";
import type { SchemaLike, Validator } from "./validation-types.ts";
import { createRouter } from "./router.ts";

// onError handler that processes unexpected exceptions
export type OnErrorHandler = (
  error: unknown,
  c: Context,
) => Response | Promise<Response>;

// onRequest hook that runs before routing begins
// Receives minimal input (just the request), returns a locals patch
export type OnRequestHandler = (
  request: Request,
) => void | Record<string, unknown> | Promise<void | Record<string, unknown>>;

// onResponse hook that runs after handler execution, before returning response
export type OnResponseHandler = (
  c: Context,
  response: Response,
) => Response | Promise<Response>;

// Default onError implementation: logs the error and returns a sanitized 500 response
const defaultOnError: OnErrorHandler = (error, _c) => {
  // Log the unexpected error
  console.error("Unexpected error during request handling:", error);

  // Return a sanitized 500 response - don't leak error details to clients
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
};

// Configuration options for setupHttp
export interface Config {
  /** Route handlers to register */
  handlers: Handler[];
  /** Validator adapter for request validation (required if any route uses request schemas) */
  validator?: Validator<SchemaLike>;
  /** Custom error handler for unexpected exceptions (optional) */
  onError?: OnErrorHandler;
  /** Hook that runs before routing begins (optional) */
  onRequest?: OnRequestHandler;
  /** Hook that runs after handler execution, before returning response (optional) */
  onResponse?: OnResponseHandler;
}

/**
 * Bootstrap the Hectoday HTTP framework.
 *
 * Creates a fetch handler compatible with Deno.serve, Bun.serve, and Cloudflare Workers.
 *
 * @param config - Configuration object with handlers, validator, and lifecycle hooks, or an array of handlers
 * @returns An object with a `fetch` function that processes incoming requests
 *
 * @example
 * ```ts
 * const app = setupHttp({
 *   handlers: [
 *     route.get("/hello", {
 *       resolve: () => new Response("Hello world"),
 *     }),
 *   ],
 * });
 *
 * Deno.serve(app.fetch);
 * ```
 */
export function setupHttp(config: Handler[] | Config): {
  fetch: (req: Request) => Promise<Response>;
} {
  // Support both array of handlers (legacy) and config object
  const handlers = Array.isArray(config) ? config : config.handlers;
  const validator = Array.isArray(config) ? undefined : config.validator;
  const onError = Array.isArray(config)
    ? defaultOnError
    : (config.onError ?? defaultOnError);
  const onRequest = Array.isArray(config) ? undefined : config.onRequest;
  const onResponse = Array.isArray(config) ? undefined : config.onResponse;

  const router = createRouter(handlers, validator);

  return {
    // Standard fetch signature compatible with Deno.serve / Bun.serve
    fetch: async (request: Request): Promise<Response> => {
      try {
        // Run onRequest hook BEFORE routing to get initial locals
        const initialLocals = onRequest ? await onRequest(request) : {};

        // Normal request processing - guards and handlers use explicit returns
        const response = await router.handle(request, initialLocals || {});

        // Run onResponse hook after handler execution
        // Note: onResponse receives the full context from the route handler
        if (onResponse && response.context) {
          const updatedResponse = await onResponse(
            response.context,
            response.response,
          );
          return updatedResponse;
        }

        return response.response;
      } catch (error) {
        // Exception caught = unexpected failure (bug, crash, infrastructure problem)
        // We need to build a minimal context for onError
        // If we have context from the error, use it; otherwise create a minimal one
        const context = (error as { context?: Context }).context || {
          request,
          raw: { params: {}, query: {}, body: undefined },
          input: { ok: true, params: {}, query: {}, body: undefined },
          locals: {},
        };

        return await onError(error, context);
      }
    },
  };
}
