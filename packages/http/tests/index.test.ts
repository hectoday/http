import { describe, expect, test } from "vite-plus/test";
import * as z from "zod/v4";
import { setup, route, group, cors } from "../src/index.ts";

// ====================================================================
// Domain helpers
// ====================================================================

type User = { id: string; name: string; email: string; role: "admin" | "user" };

function verifyToken(token: string): User | null {
  if (token === "valid") return { id: "user-1", name: "Alice", email: "a@b.com", role: "admin" };
  if (token === "user") return { id: "user-2", name: "Bob", email: "b@b.com", role: "user" };
  return null;
}

function authenticate(request: Request): User | Response {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = verifyToken(header.slice(7));
  if (!user) return Response.json({ error: "Invalid token" }, { status: 401 });
  return user;
}

function requireAdmin(user: User): true | Response {
  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return true;
}

// ====================================================================
// Schemas
// ====================================================================

const IdParams = z.object({ id: z.string().uuid() });
const CreateUser = z.object({ name: z.string().min(1), email: z.string().email() });
const Pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ====================================================================
// Route groups
// ====================================================================

const userRoutes = group([
  route.get("/users", {
    request: { query: Pagination },
    resolve: async (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const page: number = c.input.query.page;
      const limit: number = c.input.query.limit;

      return Response.json({ users: [], page, limit });
    },
  }),

  route.get("/users/:id", {
    request: { params: IdParams },
    resolve: async (c) => {
      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const id: string = c.input.params.id;
      return Response.json({ id, name: "Alice", email: "a@b.com" });
    },
  }),

  route.post("/users", {
    request: { body: CreateUser },
    resolve: async (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const name: string = c.input.body.name;
      const email: string = c.input.body.email;

      return Response.json({ id: "new-1", name, email, createdBy: caller.id }, { status: 201 });
    },
  }),

  route.delete("/users/:id", {
    request: { params: IdParams },
    resolve: async (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      const admin = requireAdmin(caller);
      if (admin instanceof Response) return admin;

      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      if (c.input.params.id === caller.id) {
        return Response.json({ error: "Cannot delete yourself" }, { status: 400 });
      }

      return new Response(null, { status: 204 });
    },
  }),
]);

const adminRoutes = group([
  route.get("/admin/stats", {
    resolve: async (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      const admin = requireAdmin(caller);
      if (admin instanceof Response) return admin;

      return Response.json({ stats: { users: 42 } });
    },
  }),
]);

// ====================================================================
// CORS
// ====================================================================

const { preflight, headers: corsHeaders } = cors({
  origin: "https://myapp.com",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});

// ====================================================================
// App
// ====================================================================

const app = setup({
  onRequest: () => ({
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
  }),

  routes: [
    preflight(route),
    route.get("/health", {
      resolve: () => Response.json({ status: "ok" }),
    }),
    route.get("/echo/:word", {
      request: { params: z.object({ word: z.string() }) },
      resolve: (c) => {
        if (!c.input.ok) return Response.json({ error: c.input.issues }, { status: 400 });
        return Response.json({ word: c.input.params.word });
      },
    }),
    ...userRoutes,
    ...adminRoutes,
  ],

  onResponse: ({ request, response, locals }) => {
    const duration = Date.now() - locals.startTime;
    const res = corsHeaders(request, response);
    const h = new Headers(res.headers);
    h.set("x-request-id", locals.requestId);
    h.set("x-response-time", `${duration}ms`);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  },

  onError: ({ error }) => {
    return Response.json({ error: String(error) }, { status: 500 });
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

// ====================================================================
// Tests
// ====================================================================

describe("Basic", () => {
  test("GET /health → 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("GET /echo/hello → params", async () => {
    const res = await app.request("/echo/hello");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.word).toBe("hello");
  });

  test("app.routes exposes descriptors", () => {
    expect(Array.isArray(app.routes)).toBe(true);
    expect(app.routes.length).toBeGreaterThan(0);
  });
});

describe("Validation", () => {
  test("GET /users/:uuid → 200", async () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const res = await app.request(`/users/${uuid}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(uuid);
  });

  test("GET /users/not-uuid → 400", async () => {
    const res = await app.request("/users/not-uuid");
    expect(res.status).toBe(400);
  });

  test("GET /users → defaults", async () => {
    const res = await app.request("/users", { headers: { authorization: "Bearer valid" } });
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  test("GET /users?page=3&limit=50 → coerced", async () => {
    const res = await app.request("/users", {
      query: { page: "3", limit: "50" },
      headers: { authorization: "Bearer valid" },
    });
    const body = await res.json();
    expect(body.page).toBe(3);
    expect(body.limit).toBe(50);
  });

  test("POST /users valid → 201", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "Alice", email: "a@b.com" },
      headers: { authorization: "Bearer valid" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Alice");
    expect(body.createdBy).toBe("user-1");
  });

  test("POST /users invalid → 400", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "", email: "bad" },
      headers: { authorization: "Bearer valid" },
    });
    expect(res.status).toBe(400);
  });

  test("POST /users malformed JSON → 400", async () => {
    const res = await app.fetch(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer valid" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.some((i: any) => i.code === "invalid_json")).toBe(true);
  });
});

describe("Auth", () => {
  test("no auth → 401", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "A", email: "a@b.com" },
    });
    expect(res.status).toBe(401);
  });

  test("bad token → 401", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "A", email: "a@b.com" },
      headers: { authorization: "Bearer invalid" },
    });
    expect(res.status).toBe(401);
  });

  test("non-admin DELETE → 403", async () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const res = await app.request(`/users/${uuid}`, {
      method: "DELETE",
      headers: { authorization: "Bearer user" },
    });
    expect(res.status).toBe(403);
  });

  test("admin DELETE → 204", async () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const res = await app.request(`/users/${uuid}`, {
      method: "DELETE",
      headers: { authorization: "Bearer valid" },
    });
    expect(res.status).toBe(204);
  });
});

describe("Hooks", () => {
  test("onResponse adds headers", async () => {
    const res = await app.request("/health");
    expect(res.headers.has("x-request-id")).toBe(true);
    expect(res.headers.has("x-response-time")).toBe(true);
  });

  test("onNotFound → 404 with requestId", async () => {
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.path).toBe("/nonexistent");
    expect(typeof body.requestId).toBe("string");
  });

  test("onError catches throws", async () => {
    const testApp = setup({
      routes: [
        route.get("/boom", {
          resolve: () => {
            throw new Error("kaboom");
          },
        }),
      ],
      onError: ({ error }) => Response.json({ error: String(error) }, { status: 500 }),
    });
    const res = await testApp.request("/boom");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("kaboom");
  });

  test("onRequest side-effect only", async () => {
    let logged = false;
    const testApp = setup({
      onRequest: () => {
        logged = true;
      },
      routes: [route.get("/test", { resolve: () => Response.json({ ok: true }) })],
    });
    await testApp.request("/test");
    expect(logged).toBe(true);
  });

  test("onResponse runs on 404", async () => {
    const res = await app.request("/nope");
    expect(res.headers.has("x-request-id")).toBe(true);
  });

  test("POST to GET route → 404", async () => {
    const res = await app.request("/health", { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("CORS", () => {
  test("OPTIONS → 204 with CORS headers", async () => {
    const res = await app.fetch(
      new Request("http://localhost/users", {
        method: "OPTIONS",
        headers: { origin: "https://myapp.com" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://myapp.com");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-max-age")).toBe("86400");
  });

  test("normal response has CORS header", async () => {
    const res = await app.fetch(
      new Request("http://localhost/health", {
        headers: { origin: "https://myapp.com" },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("https://myapp.com");
  });

  test("wrong origin → no CORS header", async () => {
    const res = await app.fetch(
      new Request("http://localhost/health", {
        headers: { origin: "https://evil.com" },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("app.request", () => {
  test("GET with path only", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });

  test("POST with body + headers", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "T", email: "t@t.com" },
      headers: { authorization: "Bearer valid" },
    });
    expect(res.status).toBe(201);
  });

  test("GET with query", async () => {
    const res = await app.request("/users", {
      query: { page: "2", limit: "10" },
      headers: { authorization: "Bearer valid" },
    });
    const body = await res.json();
    expect(body.page).toBe(2);
  });
});
