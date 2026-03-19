import { setup, route, cors } from "@hectoday/http";
import { openapi } from "@hectoday/openapi";
import { authRoutes } from "./routes/auth.ts";
import { bookmarkRoutes } from "./routes/bookmarks.ts";
import { adminRoutes } from "./routes/admin.ts";
import { log } from "./logger.ts";

const apiRoutes = [...authRoutes, ...bookmarkRoutes, ...adminRoutes];

const { spec, docs } = openapi(apiRoutes, {
  info: { title: "Hectoday Bookmarks API", version: "1.0.0" },
  security: [{ bearerAuth: [] }],
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
    },
  },
});

const { preflight, headers: corsHeaders } = cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});

export const app = setup({
  onRequest: () => ({
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
  }),

  routes: [
    preflight(route),
    spec(route),
    docs(route),

    route.get("/", {
      resolve: () => Response.redirect("/docs"),
    }),

    route.get("/health", {
      resolve: () => Response.json({ status: "ok" }),
    }),

    ...apiRoutes,
  ],

  onResponse: ({ request, response, locals }) => {
    const duration = Date.now() - locals.startTime;
    const res = corsHeaders(request, response);
    const h = new Headers(res.headers);
    h.set("x-request-id", locals.requestId);
    h.set("x-response-time", `${duration}ms`);

    log.info({
      requestId: locals.requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      status: res.status,
      duration,
    });

    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  },

  onError: ({ error, request, locals }) => {
    log.error({
      requestId: locals.requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      error: String(error),
    });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  },

  onNotFound: ({ request, locals }) =>
    Response.json(
      {
        error: "Not found",
        path: new URL(request.url).pathname,
        requestId: locals.requestId,
      },
      { status: 404 },
    ),
});
