import type { Context, Handler, RouteParams } from "./route.ts";
import type { SchemaLike, Validator } from "./validation-types.ts";
import {
  parseBody,
  parseQuery,
  validateInputs,
} from "./internal/validation.ts";

interface CompiledRoute {
  handler: Handler;
  pattern: URLPattern;
}

export interface RouteMatch {
  handler: Handler;
  params: RouteParams;
}

export interface RouterResponse {
  response: Response;
  context: Context;
}

export interface Router {
  match: (method: string, url: string) => RouteMatch | null;
  handle: (
    request: Request,
    initialLocals: Record<string, unknown>,
  ) => Promise<RouterResponse>;
}

export function createRouter(
  handlers: Handler[],
  validator?: Validator<SchemaLike>,
): Router {
  const routes: CompiledRoute[] = handlers.map((h) => ({
    handler: h,
    pattern: new URLPattern({ pathname: h.path }),
  }));

  const match = (method: string, url: string): RouteMatch | null => {
    for (const route of routes) {
      // Match if the route method is "*" (all methods) or exactly matches the request method
      if (route.handler.method !== "*" && route.handler.method !== method) {
        continue;
      }

      const result = route.pattern.exec(url);
      if (result) {
        const params: RouteParams = {};
        const groups = result.pathname.groups;
        for (const key in groups) {
          params[key] = groups[key];
        }
        return { handler: route.handler, params };
      }
    }
    return null;
  };

  return {
    match,
    handle: async (
      request: Request,
      initialLocals: Record<string, unknown>,
    ): Promise<RouterResponse> => {
      const matched = match(request.method, request.url);
      if (!matched) {
        // Create minimal context for 404 response
        const notFoundContext: Context = {
          request,
          raw: { params: {}, query: {}, body: undefined },
          input: { ok: true, params: {}, query: {}, body: undefined },
          locals: {},
        };
        return {
          response: new Response("Not Found", { status: 404 }),
          context: notFoundContext,
        };
      }

      // Extract raw query parameters
      const query = parseQuery(request.url);

      // Parse body if route defines a body schema (single-read guarantee)
      let bodyValue: unknown | undefined = undefined;
      let bodyParseError: SyntaxError | undefined = undefined;

      if (matched.handler.request?.body) {
        const result = await parseBody(request);
        bodyValue = result.parsed;
        bodyParseError = result.error;
      }

      // Perform validation using the validator adapter
      const input = validateInputs(
        validator,
        matched.handler.request,
        {
          params: matched.params,
          query,
          body: bodyValue,
        },
        bodyParseError,
      );

      // Create initial context with locals from onRequest hook
      let context: Context = {
        request,
        raw: {
          params: matched.params,
          query,
          body: bodyValue,
        },
        input,
        locals: { ...initialLocals },
      };

      // Execute guards in order
      // Each guard that adds locals creates a new context
      if (matched.handler.guards && matched.handler.guards.length > 0) {
        for (const guard of matched.handler.guards) {
          try {
            const guardResult = await guard(context);
            if ("deny" in guardResult) {
              // Guard denied the request, return the denial response
              return {
                response: guardResult.deny,
                context,
              };
            }
            // Guard allowed, merge any locals it provided
            // Create new context with accumulated locals
            if (guardResult.locals) {
              context = {
                ...context,
                locals: { ...context.locals, ...guardResult.locals },
              };
            }
          } catch (error) {
            // Attach context to error so onError can access it
            (error as any).context = context;
            throw error;
          }
        }
      }

      // All guards passed, execute the handler
      try {
        const response = await matched.handler.handler(context);
        return {
          response,
          context,
        };
      } catch (error) {
        // Attach context to error so onError can access it
        (error as any).context = context;
        throw error;
      }
    },
  };
}
