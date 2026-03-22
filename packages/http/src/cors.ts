import type { RouteDescriptor } from "./types";

export interface CorsOptions {
  origin: string | string[];
  methods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface CorsResult {
  /** Registers an OPTIONS /** catch-all preflight handler */
  preflight: (route: {
    options: (path: string, config: any) => RouteDescriptor;
  }) => RouteDescriptor;
  /** Adds CORS headers to a response. Use inside onResponse. */
  headers: (request: Request, response: Response) => Response;
}

const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"];

function appendVary(h: Headers, value: string): void {
  const existing = h.get("vary");
  if (!existing) {
    h.set("vary", value);
    return;
  }

  const values = existing
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (values.some((part) => part.toLowerCase() === value.toLowerCase())) return;

  values.push(value);
  h.set("vary", values.join(", "));
}

export function cors(options: CorsOptions): CorsResult {
  const origins = Array.isArray(options.origin) ? options.origin : [options.origin];
  const methods = options.methods ?? DEFAULT_METHODS;
  const allowHeaders = options.allowHeaders ?? [];
  const exposeHeaders = options.exposeHeaders ?? [];
  const credentials = options.credentials ?? false;
  const maxAge = options.maxAge;
  const allowAnyOrigin = origins.includes("*");

  function applyOrigin(h: Headers, requestOrigin: string | null): void {
    // When the response varies by origin, always signal that to caches,
    // even when the origin is disallowed or absent.
    if (!(allowAnyOrigin && !credentials)) {
      appendVary(h, "Origin");
    }

    if (!requestOrigin) return;

    if (allowAnyOrigin && !credentials) {
      h.set("access-control-allow-origin", "*");
    } else if (allowAnyOrigin || origins.includes(requestOrigin)) {
      h.set("access-control-allow-origin", requestOrigin);
    }

    if (credentials && h.has("access-control-allow-origin")) {
      h.set("access-control-allow-credentials", "true");
    }
  }

  function applyPreflight(h: Headers, request: Request): void {
    h.set("access-control-allow-methods", methods.join(", "));
    if (allowHeaders.length > 0) {
      h.set("access-control-allow-headers", allowHeaders.join(", "));
    } else {
      const requestedHeaders = request.headers.get("access-control-request-headers");
      if (requestedHeaders) {
        h.set("access-control-allow-headers", requestedHeaders);
        appendVary(h, "Access-Control-Request-Headers");
      }
    }
    if (maxAge !== undefined) {
      h.set("access-control-max-age", String(maxAge));
    }
  }

  return {
    preflight: (route) =>
      route.options("/**", {
        resolve: (c: { request: Request }) => {
          const h = new Headers();
          applyOrigin(h, c.request.headers.get("origin"));
          if (h.has("access-control-allow-origin")) {
            applyPreflight(h, c.request);
          }
          return new Response(null, { status: 204, headers: h });
        },
      }),

    headers: (request, response) => {
      const h = new Headers(response.headers);
      applyOrigin(h, request.headers.get("origin"));
      if (exposeHeaders.length > 0 && h.has("access-control-allow-origin")) {
        h.set("access-control-expose-headers", exposeHeaders.join(", "));
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: h,
      });
    },
  };
}
