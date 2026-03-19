import type { RouteDescriptor } from "@hectoday/http";
import { z } from "zod";
import { createDocument, extendZodWithOpenApi } from "zod-openapi";
import type { ZodOpenApiOperationObject } from "zod-openapi";

let extended = false;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OpenApiConfig {
  info: {
    title: string;
    version: string;
    description?: string;
    license?: { name: string; url?: string };
  };
  specPath?: string;
  docsPath?: string;
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  security?: Array<Record<string, string[]>>;
  securitySchemes?: Record<string, SecurityScheme>;
}

export interface SecurityScheme {
  type: "http" | "apiKey" | "oauth2" | "openIdConnect";
  scheme?: string;
  bearerFormat?: string;
  name?: string;
  in?: "query" | "header" | "cookie";
  description?: string;
}

export interface OpenApiResult {
  /** Creates a GET route that serves the OpenAPI JSON document. */
  spec: (route: { get: (path: string, config: any) => RouteDescriptor }) => RouteDescriptor;
  /** Creates a GET route that serves the Scalar API reference UI. */
  docs: (route: { get: (path: string, config: any) => RouteDescriptor }) => RouteDescriptor;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toOpenApiPath(path: string): string {
  return path.replace(/:(\w+)/g, "{$1}");
}

const STATUS_TEXT: Record<number, string> = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  208: "Already Reported",
  226: "IM Used",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Content Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a Teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  510: "Not Extended",
  511: "Network Authentication Required",
};

function scalarHtml(specUrl: string): string {
  return `<!doctype html>
<html>
<head>
  <title>API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="${specUrl}"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export function openapi(routes: RouteDescriptor[], config: OpenApiConfig): OpenApiResult {
  if (!extended) {
    extendZodWithOpenApi(z);
    extended = true;
  }

  const paths: Record<string, Record<string, ZodOpenApiOperationObject>> = {};

  for (const descriptor of routes) {
    const { method, path, config: routeConfig } = descriptor;

    // Skip catch-all handlers (route.all) and wildcard paths
    if (!method || path === "/**") continue;

    const openApiPath = toOpenApiPath(path);
    if (!paths[openApiPath]) paths[openApiPath] = {};

    const operation: ZodOpenApiOperationObject = {
      responses: {},
    };

    // --- request params & query (must be z.object() schemas) ---
    const requestParams: Record<string, z.ZodTypeAny> = {};

    if (routeConfig.request?.params) {
      if (!(routeConfig.request.params instanceof z.ZodObject)) {
        throw new Error(`params schema for ${method} ${path} must be a z.object()`);
      }
      requestParams.path = routeConfig.request.params;
    }

    if (routeConfig.request?.query) {
      if (!(routeConfig.request.query instanceof z.ZodObject)) {
        throw new Error(`query schema for ${method} ${path} must be a z.object()`);
      }
      requestParams.query = routeConfig.request.query;
    }

    if (Object.keys(requestParams).length > 0) {
      operation.requestParams = requestParams;
    }

    // --- request body ---
    if (routeConfig.request?.body) {
      operation.requestBody = {
        content: {
          "application/json": {
            schema: routeConfig.request.body,
          },
        },
      };
    }

    // --- responses ---
    if (routeConfig.response && Object.keys(routeConfig.response).length > 0) {
      for (const [status, schema] of Object.entries(routeConfig.response)) {
        const code = Number(status);
        const entry: Record<string, unknown> = {
          description: STATUS_TEXT[code] ?? "Response",
        };

        // No content for responses that have no body (e.g. 204)
        if (code !== 204) {
          entry.content = {
            "application/json": { schema: schema as z.ZodTypeAny },
          };
        }

        (operation.responses as Record<string, unknown>)[status] = entry;
      }
    } else {
      operation.responses = {
        200: { description: "OK" },
      };
    }

    paths[openApiPath][method.toLowerCase()] = operation;
  }

  const specPath = config.specPath ?? "/openapi.json";
  const docsPath = config.docsPath ?? "/docs";

  const document = createDocument({
    openapi: "3.1.0",
    info: config.info,
    servers: config.servers,
    tags: config.tags,
    security: config.security,
    components: config.securitySchemes
      ? { securitySchemes: config.securitySchemes as any }
      : undefined,
    paths,
  });

  return {
    spec: (route) =>
      route.get(specPath, {
        resolve: () => Response.json(document),
      }),
    docs: (route) =>
      route.get(docsPath, {
        resolve: () =>
          new Response(scalarHtml(specPath), {
            headers: { "content-type": "text/html" },
          }),
      }),
  };
}
