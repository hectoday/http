import * as z from "zod/v4";
import { eq } from "drizzle-orm";
import { route, group } from "@hectoday/http";
import { db, nextId } from "../db.ts";
import * as schema from "../schema.ts";
import { authenticate } from "../auth.ts";

const CreateBookmark = z.object({
  url: z.url(),
  title: z.string().min(1).max(300),
  tags: z.array(z.string().min(1)).default([]),
});

const BookmarkParams = z.object({
  id: z.string(),
});

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  tag: z.string().optional(),
});

const BookmarkObject = z.object({
  id: z.string(),
  url: z.url(),
  title: z.string(),
  tags: z.array(z.string()),
  createdBy: z.string(),
  createdAt: z.string(),
});

const ErrorResponse = z.object({
  error: z.union([z.string(), z.array(z.any())]),
});

export const bookmarkRoutes = group([
  route.get("/bookmarks", {
    request: { query: ListQuery },
    response: {
      200: z.object({
        bookmarks: z.array(BookmarkObject),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
      }),
      400: ErrorResponse,
    },
    resolve: (c) => {
      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const { page, limit, tag } = c.input.query;

      const allRows = db.select().from(schema.bookmarks).all();
      const filtered = tag ? allRows.filter((b) => (b.tags as string[]).includes(tag)) : allRows;
      const total = filtered.length;
      const start = (page - 1) * limit;
      const slice = filtered.slice(start, start + limit);

      return Response.json({ bookmarks: slice, total, page, limit });
    },
  }),

  route.get("/bookmarks/:id", {
    request: { params: BookmarkParams },
    response: {
      200: BookmarkObject,
      400: ErrorResponse,
      404: ErrorResponse,
    },
    resolve: (c) => {
      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const bookmark = db
        .select()
        .from(schema.bookmarks)
        .where(eq(schema.bookmarks.id, c.input.params.id))
        .get();

      if (!bookmark) {
        return Response.json({ error: "Bookmark not found" }, { status: 404 });
      }

      return Response.json(bookmark);
    },
  }),

  route.post("/bookmarks", {
    request: { body: CreateBookmark },
    response: {
      201: BookmarkObject,
      400: ErrorResponse,
      401: ErrorResponse,
    },
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const id = nextId("bookmark_id");
      const bookmark = {
        id,
        url: c.input.body.url,
        title: c.input.body.title,
        tags: c.input.body.tags,
        createdBy: caller.id,
        createdAt: new Date().toISOString(),
      };

      db.insert(schema.bookmarks).values(bookmark).run();
      return Response.json(bookmark, { status: 201 });
    },
  }),

  route.delete("/bookmarks/:id", {
    request: { params: BookmarkParams },
    response: {
      204: z.never(),
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    resolve: (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const bookmark = db
        .select()
        .from(schema.bookmarks)
        .where(eq(schema.bookmarks.id, c.input.params.id))
        .get();

      if (!bookmark) {
        return Response.json({ error: "Bookmark not found" }, { status: 404 });
      }

      if (bookmark.createdBy !== caller.id && caller.role !== "admin") {
        return Response.json({ error: "You can only delete your own bookmarks" }, { status: 403 });
      }

      db.delete(schema.bookmarks).where(eq(schema.bookmarks.id, c.input.params.id)).run();
      return new Response(null, { status: 204 });
    },
  }),

  route.get("/tags", {
    response: {
      200: z.object({ tags: z.record(z.string(), z.number()) }),
    },
    resolve: () => {
      const rows = db.select({ tags: schema.bookmarks.tags }).from(schema.bookmarks).all();

      const tagCounts: Record<string, number> = {};
      for (const row of rows) {
        for (const t of row.tags as string[]) {
          tagCounts[t] = (tagCounts[t] ?? 0) + 1;
        }
      }

      return Response.json({ tags: tagCounts });
    },
  }),
]);
