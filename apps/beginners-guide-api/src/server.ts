import { setup, route } from "@hectoday/http";
import { serve } from "srvx";
import { findAllByUser, createBookmark, findById, deleteById } from "./data.js";
import { z } from "zod/v4";

const CreateBookmark = z.object({
  url: z.url(),
  title: z.string().min(1).max(200),
  tags: z.array(z.string().min(1)).max(10).default([]),
});

const BookmarkQuery = z.object({
  tag: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["title", "createdAt"]).default("createdAt"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const app = setup({
  onRequest: ({ request }) => {
    const requestId = crypto.randomUUID();
    console.log(`-> ${request.method} ${new URL(request.url).pathname}`);
    return { requestId, startTime: Date.now() };
  },
  routes: [
    route.get("/bookmarks", {
      request: { query: BookmarkQuery },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: c.input.issues }, { status: 400 });
        }

        const { tag, search, sort, page, limit } = c.input.query;
        // For now, we ignore the query params and return all bookmarks.
        // In a real app, you would filter and paginate here.
        const bookmarks = findAllByUser("anonymous");
        return Response.json(bookmarks);
      },
    }),
    route.post("/bookmarks", {
      request: { body: CreateBookmark },
      resolve: async (c) => {
        if (!c.input.ok) {
          return Response.json({ error: c.input.issues }, { status: 400 });
        }

        const body = c.input.body;
        const bookmark = createBookmark({
          ...body,
          userId: "anonymous",
        });
        return Response.json(bookmark, { status: 201 });
      },
    }),
    route.get("/bookmarks/:id", {
      request: { params: z.object({ id: z.uuid() }) },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: "Invalid bookmark ID" }, { status: 400 });
        }
        const { id } = c.input.params;
        const bookmark = findById(id);
        if (!bookmark) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        return Response.json(bookmark);
      },
    }),
    route.put("/bookmarks/:id", {
      request: {
        params: z.object({ id: z.uuid() }),
        body: z.object({ url: z.url(), title: z.string() }),
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: c.input.issues }, { status: 400 });
        }
        const { id } = c.input.params;
        const { url, title } = c.input.body;

        const bookmark = findById(id);
        if (!bookmark) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }

        bookmark.url = url;
        bookmark.title = title;
        return Response.json(bookmark);
      },
    }),
    route.delete("/bookmarks/:id", {
      request: { params: z.object({ id: z.uuid() }) },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: "Invalid bookmark ID" }, { status: 400 });
        }
        deleteById(c.input.params.id);
        return new Response(null, { status: 204 });
      },
    }),
  ],
  onResponse: ({ response, locals }) => {
    const duration = Date.now() - locals.startTime;
    response.headers.set("X-Request-Id", locals.requestId);
    response.headers.set("X-Response-Time", `${duration}ms`);
    console.log(`<- ${response.status} in ${duration}ms`);
    return response;
  },
  onError: ({ error, request, locals }) => {
    const url = new URL(request.url);
    console.error(`[${locals?.requestId}] ${request.method} ${url.pathname}:`, error.stack);

    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 },
    );
  },
  onNotFound: ({ request }) => {
    const url = new URL(request.url);
    return Response.json(
      {
        error: {
          code: "NOT_FOUND",
          message: `No route for ${request.method} ${url.pathname}`,
        },
      },
      { status: 404 },
    );
  },
});

serve({ fetch: app.fetch, port: 3000 });
console.log("Running at http://localhost:3000");
