import { describe, expect, test } from "vite-plus/test";
import * as z from "zod/v4";
import { setup } from "../src/setup.ts";
import { route } from "../src/route.ts";

// ---------------------------------------------------------------------------
// Minimal app factory
// ---------------------------------------------------------------------------

function createApp(options: Parameters<typeof setup>[0] = { routes: [] }) {
  return setup(options);
}

// ---------------------------------------------------------------------------
// Basic routing
// ---------------------------------------------------------------------------

describe("setup - routing", () => {
  test("matches GET route", async () => {
    const app = createApp({
      routes: [route.get("/hello", { resolve: () => Response.json({ msg: "hi" }) })],
    });
    const res = await app.request("/hello");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ msg: "hi" });
  });

  test("matches POST route", async () => {
    const app = createApp({
      routes: [
        route.post("/data", {
          resolve: () => new Response(null, { status: 201 }),
        }),
      ],
    });
    const res = await app.request("/data", { method: "POST" });
    expect(res.status).toBe(201);
  });

  test("returns default 404 for unmatched route", async () => {
    const app = createApp({ routes: [] });
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not Found");
  });

  test("method mismatch returns 404", async () => {
    const app = createApp({
      routes: [route.get("/only-get", { resolve: () => Response.json({ ok: true }) })],
    });
    const res = await app.request("/only-get", { method: "POST" });
    expect(res.status).toBe(404);
  });

  test("route with path params", async () => {
    const app = createApp({
      routes: [
        route.get("/items/:id", {
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ error: "bad" }, { status: 400 });
            return Response.json({ id: c.input.params.id });
          },
        }),
      ],
    });
    const res = await app.request("/items/abc");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "abc" });
  });

  test("route.all matches any method", async () => {
    const app = createApp({
      routes: [route.all("/any", { resolve: () => Response.json({ matched: true }) })],
    });
    for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
      const res = await app.request("/any", { method });
      expect(res.status).toBe(200);
    }
  });

  test("app.routes exposes descriptors", () => {
    const routes = [
      route.get("/a", { resolve: () => new Response("a") }),
      route.post("/b", { resolve: () => new Response("b") }),
    ];
    const app = createApp({ routes });
    expect(app.routes).toBe(routes);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("setup - validation", () => {
  test("validates params with Zod schema", async () => {
    const app = createApp({
      routes: [
        route.get("/users/:id", {
          request: { params: z.object({ id: z.string().uuid() }) },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({ id: c.input.params.id });
          },
        }),
      ],
    });

    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const ok = await app.request(`/users/${uuid}`);
    expect(ok.status).toBe(200);
    expect((await ok.json()).id).toBe(uuid);

    const bad = await app.request("/users/not-uuid");
    expect(bad.status).toBe(400);
  });

  test("validates query with Zod schema and coercion", async () => {
    const app = createApp({
      routes: [
        route.get("/search", {
          request: {
            query: z.object({
              page: z.coerce.number().int().min(1).default(1),
              q: z.string().optional(),
            }),
          },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({
              page: c.input.query.page,
              q: c.input.query.q,
            });
          },
        }),
      ],
    });

    const res = await app.request("/search", {
      query: { page: "3", q: "hello" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(3);
    expect(body.q).toBe("hello");
  });

  test("applies query schema defaults when no query params provided", async () => {
    const app = createApp({
      routes: [
        route.get("/items", {
          request: {
            query: z.object({
              cursor: z.string().optional(),
              limit: z.coerce.number().int().min(1).max(100).default(20),
            }),
          },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({
              cursor: c.input.query.cursor,
              limit: c.input.query.limit,
            });
          },
        }),
      ],
    });

    // No query params at all — defaults should apply
    const res = await app.request("/items");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(20);
    expect(body.cursor).toBeUndefined();
  });

  test("applies query defaults via app.fetch with bare URL", async () => {
    const app = createApp({
      routes: [
        route.get("/items", {
          request: {
            query: z.object({
              page: z.coerce.number().int().min(1).default(1),
              limit: z.coerce.number().int().min(1).max(100).default(20),
            }),
          },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({ page: c.input.query.page, limit: c.input.query.limit });
          },
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/items"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  test("applies query defaults when only some params provided", async () => {
    const app = createApp({
      routes: [
        route.get("/items", {
          request: {
            query: z.object({
              cursor: z.string().optional(),
              limit: z.coerce.number().int().min(1).max(100).default(20),
            }),
          },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({
              cursor: c.input.query.cursor,
              limit: c.input.query.limit,
            });
          },
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/items?cursor=abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cursor).toBe("abc");
    expect(body.limit).toBe(20);
  });

  test("validates body with Zod schema", async () => {
    const app = createApp({
      routes: [
        route.post("/items", {
          request: { body: z.object({ name: z.string().min(1) }) },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({ name: c.input.body.name }, { status: 201 });
          },
        }),
      ],
    });

    const ok = await app.request("/items", {
      method: "POST",
      body: { name: "Widget" },
    });
    expect(ok.status).toBe(201);
    expect((await ok.json()).name).toBe("Widget");

    const bad = await app.request("/items", {
      method: "POST",
      body: { name: "" },
    });
    expect(bad.status).toBe(400);
  });

  test("malformed JSON body produces invalid_json issue", async () => {
    const app = createApp({
      routes: [
        route.post("/data", {
          request: { body: z.object({ x: z.number() }) },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({ x: c.input.body.x });
          },
        }),
      ],
    });

    const res = await app.fetch(
      new Request("http://localhost/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.some((i: any) => i.code === "invalid_json")).toBe(true);
  });

  test("whitespace-only JSON body produces invalid_json issue", async () => {
    const app = createApp({
      routes: [
        route.post("/data", {
          request: { body: z.object({ x: z.number() }) },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({ x: c.input.body.x });
          },
        }),
      ],
    });

    const res = await app.fetch(
      new Request("http://localhost/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "   ",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.some((i: any) => i.code === "invalid_json")).toBe(true);
  });

  test("optional body schema accepts missing body", async () => {
    const app = createApp({
      routes: [
        route.post("/optional", {
          request: { body: z.object({ x: z.string() }).optional() },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({ body: c.input.body ?? null });
          },
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/optional", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ body: null });
  });

  test("z.null body schema preserves a parsed null body", async () => {
    const app = createApp({
      routes: [
        route.post("/nullable", {
          request: { body: z.null() },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({ body: c.input.body });
          },
        }),
      ],
    });

    const res = await app.fetch(
      new Request("http://localhost/nullable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "null",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ body: null });
  });

  test("optional body schema treats an empty request body as missing", async () => {
    const app = createApp({
      routes: [
        route.post("/optional", {
          request: { body: z.object({ x: z.string() }).optional() },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({ issues: c.input.issues }, { status: 400 });
            return Response.json({ body: c.input.body ?? null });
          },
        }),
      ],
    });

    const res = await app.fetch(
      new Request("http://localhost/optional", {
        method: "POST",
        body: "",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ body: null });
  });

  test("no body schema means body is not parsed", async () => {
    const app = createApp({
      routes: [
        route.post("/raw", {
          resolve: (c) => {
            return Response.json({
              ok: c.input.ok,
              body: c.input.ok ? c.input.body : null,
            });
          },
        }),
      ],
    });
    const res = await app.request("/raw", {
      method: "POST",
      body: { test: true },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // body is undefined because no body schema was defined
    expect(body.body).toBeUndefined();
  });

  test("app.request supports repeated query keys", async () => {
    const app = createApp({
      routes: [
        route.get("/tags", {
          resolve: (c) => Response.json({ tag: c.input.ok ? c.input.query.tag : undefined }),
        }),
      ],
    });

    const res = await app.request("/tags", { query: { tag: ["a", "b"] } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tag: ["a", "b"] });
  });

  test("validation failure sets failed array", async () => {
    const app = createApp({
      routes: [
        route.get("/check/:id", {
          request: {
            params: z.object({ id: z.string().uuid() }),
            query: z.object({ page: z.coerce.number().min(1) }),
          },
          resolve: (c) => {
            if (!c.input.ok) {
              return Response.json(
                { failed: c.input.failed, issues: c.input.issues },
                { status: 400 },
              );
            }
            return Response.json({ ok: true });
          },
        }),
      ],
    });

    const res = await app.request("/check/not-uuid", { query: { page: "0" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.failed).toContain("params");
    expect(body.failed).toContain("query");
  });

  test("params without schema returns raw params", async () => {
    const app = createApp({
      routes: [
        route.get("/echo/:word", {
          resolve: (c) => {
            if (!c.input.ok) return Response.json({}, { status: 400 });
            return Response.json({ word: c.input.params.word });
          },
        }),
      ],
    });
    const res = await app.request("/echo/test");
    expect(res.status).toBe(200);
    expect((await res.json()).word).toBe("test");
  });
});

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

describe("setup - hooks", () => {
  test("onRequest produces locals", async () => {
    const app = createApp({
      onRequest: () => ({ rid: "abc-123" }),
      routes: [
        route.get("/test", {
          resolve: (c) => Response.json({ rid: c.locals.rid }),
        }),
      ],
      onResponse: ({ response, locals }) => {
        const h = new Headers(response.headers);
        h.set("x-rid", locals.rid as string);
        return new Response(response.body, {
          status: response.status,
          headers: h,
        });
      },
    });
    const res = await app.request("/test");
    expect(res.headers.get("x-rid")).toBe("abc-123");
  });

  test("onRequest side-effect only (returns void)", async () => {
    let called = false;
    const app = createApp({
      onRequest: () => {
        called = true;
      },
      routes: [route.get("/x", { resolve: () => Response.json({ ok: true }) })],
    });
    await app.request("/x");
    expect(called).toBe(true);
  });

  test("onResponse modifies response", async () => {
    const app = createApp({
      routes: [route.get("/test", { resolve: () => Response.json({ ok: true }) })],
      onResponse: ({ response }) => {
        const h = new Headers(response.headers);
        h.set("x-custom", "value");
        return new Response(response.body, {
          status: response.status,
          headers: h,
        });
      },
    });
    const res = await app.request("/test");
    expect(res.headers.get("x-custom")).toBe("value");
  });

  test("onResponse runs on 404", async () => {
    const app = createApp({
      routes: [],
      onResponse: ({ response }) => {
        const h = new Headers(response.headers);
        h.set("x-always", "true");
        return new Response(response.body, {
          status: response.status,
          headers: h,
        });
      },
    });
    const res = await app.request("/missing");
    expect(res.status).toBe(404);
    expect(res.headers.get("x-always")).toBe("true");
  });

  test("onError catches handler throws", async () => {
    const app = createApp({
      routes: [
        route.get("/boom", {
          resolve: () => {
            throw new Error("kaboom");
          },
        }),
      ],
      onError: ({ error }) => Response.json({ error: String(error) }, { status: 500 }),
    });
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("kaboom");
  });

  test("default error handler returns 500 when no onError", async () => {
    const app = createApp({
      routes: [
        route.get("/boom", {
          resolve: () => {
            throw new Error("fail");
          },
        }),
      ],
    });
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal Server Error");
  });

  test("custom onNotFound", async () => {
    const app = createApp({
      routes: [],
      onNotFound: ({ request }) =>
        Response.json({ error: "missing", path: new URL(request.url).pathname }, { status: 404 }),
    });
    const res = await app.request("/nowhere");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.path).toBe("/nowhere");
  });

  test("onResponse runs after onError", async () => {
    const app = createApp({
      routes: [
        route.get("/err", {
          resolve: () => {
            throw new Error("oops");
          },
        }),
      ],
      onError: () => Response.json({ error: "handled" }, { status: 500 }),
      onResponse: ({ response }) => {
        const h = new Headers(response.headers);
        h.set("x-after-error", "true");
        return new Response(response.body, {
          status: response.status,
          headers: h,
        });
      },
    });
    const res = await app.request("/err");
    expect(res.status).toBe(500);
    expect(res.headers.get("x-after-error")).toBe("true");
  });

  test("onRequest error triggers onError", async () => {
    const app = createApp({
      onRequest: () => {
        throw new Error("init fail");
      },
      routes: [route.get("/test", { resolve: () => Response.json({ ok: true }) })],
      onError: ({ error }) => Response.json({ error: String(error) }, { status: 500 }),
    });
    const res = await app.request("/test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("init fail");
  });

  test("onResponse runs after onRequest errors", async () => {
    const app = createApp({
      onRequest: () => {
        throw new Error("init fail");
      },
      routes: [route.get("/test", { resolve: () => Response.json({ ok: true }) })],
      onError: ({ error }) => Response.json({ error: String(error) }, { status: 500 }),
      onResponse: ({ response }) => {
        const headers = new Headers(response.headers);
        headers.set("x-after-error", "true");
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      },
    });

    const res = await app.request("/test");
    expect(res.status).toBe(500);
    expect(res.headers.get("x-after-error")).toBe("true");
  });

  test("onNotFound error triggers onError", async () => {
    const app = createApp({
      routes: [],
      onNotFound: () => {
        throw new Error("not found error");
      },
      onError: ({ error }) => Response.json({ error: String(error) }, { status: 500 }),
    });
    const res = await app.request("/test");
    expect(res.status).toBe(500);
  });

  test("onResponse runs after onNotFound errors", async () => {
    const app = createApp({
      routes: [],
      onNotFound: () => {
        throw new Error("not found error");
      },
      onError: ({ error }) => Response.json({ error: String(error) }, { status: 500 }),
      onResponse: ({ response }) => {
        const headers = new Headers(response.headers);
        headers.set("x-after-not-found-error", "true");
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      },
    });

    const res = await app.request("/test");
    expect(res.status).toBe(500);
    expect(res.headers.get("x-after-not-found-error")).toBe("true");
  });

  test("onResponse error is swallowed, original response returned", async () => {
    const app = createApp({
      routes: [route.get("/test", { resolve: () => Response.json({ ok: true }) })],
      onResponse: () => {
        throw new Error("response hook fail");
      },
    });
    const res = await app.request("/test");
    // When onResponse throws, original response is returned
    expect(res.status).toBe(200);
  });

  test("onError itself throwing returns default 500", async () => {
    const app = createApp({
      routes: [
        route.get("/boom", {
          resolve: () => {
            throw new Error("handler");
          },
        }),
      ],
      onError: () => {
        throw new Error("error handler also broke");
      },
    });
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal Server Error");
  });
});

// ---------------------------------------------------------------------------
// app.request convenience
// ---------------------------------------------------------------------------

describe("setup - app.request", () => {
  test("defaults to GET", async () => {
    const app = createApp({
      routes: [route.get("/test", { resolve: () => Response.json({ method: "GET" }) })],
    });
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  test("serializes body as JSON", async () => {
    const app = createApp({
      routes: [
        route.post("/echo", {
          request: { body: z.object({ x: z.number() }) },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({}, { status: 400 });
            return Response.json({ x: c.input.body.x });
          },
        }),
      ],
    });
    const res = await app.request("/echo", { method: "POST", body: { x: 42 } });
    expect(res.status).toBe(200);
    expect((await res.json()).x).toBe(42);
  });

  test("preserves explicit content-type when serializing a body", async () => {
    const app = createApp({
      routes: [
        route.post("/content-type", {
          resolve: (c) =>
            Response.json({
              contentType: c.request.headers.get("content-type"),
            }),
        }),
      ],
    });

    const res = await app.request("/content-type", {
      method: "POST",
      headers: { "content-type": "application/merge-patch+json" },
      body: { x: 42 },
    });

    expect(res.status).toBe(200);
    expect((await res.json()).contentType).toBe("application/merge-patch+json");
  });

  test("sets custom headers", async () => {
    const app = createApp({
      routes: [
        route.get("/headers", {
          resolve: (c) => Response.json({ auth: c.request.headers.get("authorization") }),
        }),
      ],
    });
    const res = await app.request("/headers", {
      headers: { authorization: "Bearer token123" },
    });
    expect((await res.json()).auth).toBe("Bearer token123");
  });

  test("appends query params to URL", async () => {
    const app = createApp({
      routes: [
        route.get("/search", {
          request: { query: z.object({ q: z.string() }) },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({}, { status: 400 });
            return Response.json({ q: c.input.query.q });
          },
        }),
      ],
    });
    const res = await app.request("/search", { query: { q: "test" } });
    expect(res.status).toBe(200);
    expect((await res.json()).q).toBe("test");
  });

  test("merges options.query with query params already present in the path", async () => {
    const app = createApp({
      routes: [
        route.get("/search", {
          request: { query: z.object({ existing: z.string(), q: z.string() }) },
          resolve: (c) => {
            if (!c.input.ok) return Response.json({}, { status: 400 });
            return Response.json({
              existing: c.input.query.existing,
              q: c.input.query.q,
            });
          },
        }),
      ],
    });

    const res = await app.request("/search?existing=1", {
      query: { q: "test" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ existing: "1", q: "test" });
  });

  test("malformed percent-encoding in query does not crash request handling", async () => {
    const app = createApp({
      routes: [
        route.get("/search", {
          resolve: (c) => Response.json({ q: c.input.ok ? c.input.query.q : undefined }),
        }),
      ],
    });

    const res = await app.fetch(new Request("http://localhost/search?q=%E0%A4%A"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ q: "%E0%A4%A" });
  });
});

// ---------------------------------------------------------------------------
// Async handlers
// ---------------------------------------------------------------------------

describe("setup - async", () => {
  test("async resolve handler", async () => {
    const app = createApp({
      routes: [
        route.get("/async", {
          resolve: async () => {
            await new Promise((r) => setTimeout(r, 1));
            return Response.json({ done: true });
          },
        }),
      ],
    });
    const res = await app.request("/async");
    expect(res.status).toBe(200);
    expect((await res.json()).done).toBe(true);
  });

  test("async onRequest hook", async () => {
    const app = createApp({
      onRequest: async () => {
        await new Promise((r) => setTimeout(r, 1));
        return { ts: 1 };
      },
      routes: [
        route.get("/test", {
          resolve: (c) => Response.json({ ts: c.locals.ts }),
        }),
      ],
    });
    const res = await app.request("/test");
    expect((await res.json()).ts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Error handling during extraction/validation
// ---------------------------------------------------------------------------

describe("setup - extraction/validation error handling", () => {
  test("errors during validation route through onError", async () => {
    const app = createApp({
      routes: [
        route.get("/test", {
          request: {
            // Use a custom Zod schema that throws during safeParse
            query: {
              safeParse: () => {
                throw new Error("unexpected validation error");
              },
            } as unknown as z.ZodType,
          },
          resolve: () => Response.json({ reached: true }),
        }),
      ],
      onError: ({ error }) =>
        Response.json({ caught: true, message: String(error) }, { status: 500 }),
    });

    const res = await app.request("/test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.caught).toBe(true);
    expect(body.message).toContain("unexpected validation error");
  });

  test("errors during validation return 500 without onError", async () => {
    const app = createApp({
      routes: [
        route.get("/test", {
          request: {
            query: {
              safeParse: () => {
                throw new Error("boom");
              },
            } as unknown as z.ZodType,
          },
          resolve: () => Response.json({ reached: true }),
        }),
      ],
    });

    const res = await app.request("/test");
    expect(res.status).toBe(500);
  });
});
