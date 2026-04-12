import { setup, route, cors } from "@hectoday/http";
import { z } from "zod/v4";
import { serve } from "srvx";
import { createBookmark, findById, findAllByUser, deleteById } from "./data.js";
import { authenticate } from "./auth.js";
import { notFound, forbidden, badRequest } from "./responses.js";
import { openapi } from "@hectoday/openapi";

const CreateBookmark = z.object({
  url: z.url(),
  title: z.string().min(1).max(200),
  tags: z.array(z.string().min(1)).max(10).default([]),
});

const corsConfig = cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
});

const apiRoutes = [
  route.get("/bookmarks", {
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;
      return Response.json(findAllByUser(caller));
    },
  }),
  route.post("/bookmarks", {
    request: { body: CreateBookmark },
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;
      if (!c.input.ok) return badRequest("Invalid input");
      const body = c.input.body;
      const bookmark = createBookmark({ ...body, userId: caller });
      return Response.json(bookmark, { status: 201 });
    },
  }),
  route.put("/bookmarks/:id", {
    request: {
      params: z.object({ id: z.uuid() }),
      body: z.object({ url: z.url(), title: z.string() }),
    },
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;
      if (!c.input.ok) return badRequest("Invalid input");
      const { id } = c.input.params;
      const bookmark = findById(id);
      if (!bookmark) return notFound("Bookmark not found");
      if (bookmark.userId !== caller) return forbidden("Not your bookmark");
      bookmark.url = c.input.body.url;
      bookmark.title = c.input.body.title;
      return Response.json(bookmark);
    },
  }),
  route.get("/bookmarks/:id", {
    request: { params: z.object({ id: z.uuid() }) },
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;
      if (!c.input.ok) return badRequest("Invalid bookmark ID");
      const { id } = c.input.params;
      const bookmark = findById(id);
      if (!bookmark) return notFound("Bookmark not found");
      if (bookmark.userId !== caller) return forbidden("Not your bookmark");
      return Response.json(bookmark);
    },
  }),
  route.delete("/bookmarks/:id", {
    request: { params: z.object({ id: z.uuid() }) },
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;
      if (!c.input.ok) return badRequest("Invalid bookmark ID");
      const { id } = c.input.params;
      const bookmark = findById(id);
      if (!bookmark || bookmark.userId !== caller) return notFound("Bookmark not found");
      deleteById(id);
      return new Response(null, { status: 204 });
    },
  }),
];

const routes = [
  corsConfig.preflight(route),
  route.get("/health", {
    resolve: () => Response.json({ status: "ok" }),
  }),
  ...apiRoutes,
];

const api = openapi(routes, {
  info: {
    title: "Bookmarks API",
    version: "1.0.0",
    description: "Save and organize your bookmarks.",
  },
  servers: [{ url: "http://localhost:3000", description: "Development" }],
  securitySchemes: {
    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
  },
  security: [{ bearerAuth: [] }],
});

export const app = setup({
  onRequest: ({ request }) => {
    const requestId = crypto.randomUUID();
    console.log(`-> ${request.method} ${new URL(request.url).pathname}`);
    return { requestId, startTime: Date.now() };
  },
  onResponse: ({ request, response, locals }) => {
    const duration = Date.now() - locals.startTime;
    response.headers.set("X-Request-Id", locals.requestId);
    response.headers.set("X-Response-Time", `${duration}ms`);
    console.log(`<- ${response.status} in ${duration}ms`);
    return corsConfig.headers(request, response);
  },
  onError: ({ error, request, locals }) => {
    const url = new URL(request.url);
    console.error(`[${locals?.requestId}] ${request.method} ${url.pathname}:`, error.stack);
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  },
  onNotFound: ({ request }) => {
    const url = new URL(request.url);
    return Response.json(
      { error: { code: "NOT_FOUND", message: `No route for ${request.method} ${url.pathname}` } },
      { status: 404 },
    );
  },
  routes: [...routes, api.spec(route), api.docs(route)],
});

serve({ fetch: app.fetch, port: 3000 });
console.log("Running at http://localhost:3000");
