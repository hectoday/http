# Hectoday HTTP — Framework Spec

> A web framework that refuses to make decisions for you.

Hectoday HTTP is built on Web Standards (Request/Response), uses Zod for validation, and rou3 for route matching. It runs on Deno, Bun, Node.js (via srvx), and Cloudflare Workers. Bring your own server.

---

## Philosophy

- **Facts before decisions.** The framework extracts and validates data. You decide what it means.
- **No hidden control flow.** Every decision boundary is visible. Only `return` statements end requests.
- **Web Standards.** Request in, Response out. No wrappers, no framework-specific abstractions.
- **Explicit over convenient.** Verbose is fine. Magic is not.

---

## Public API

```ts
import { setup, route, group, cors } from "@hectoday/http";
```

- `setup()` — creates the app
- `route` — defines routes (`.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options`, `.all`)
- `group()` — organizes routes into groups
- `cors()` — CORS helper

---

## Context

Every `resolve` function receives a context:

```ts
interface Context {
  readonly request: Request; // the web standard HTTP request
  readonly input: InputState; // validation results
  readonly locals: TLocals; // per-request data from onRequest
}
```

### `c.request`

The standard Fetch API `Request`. Untouched by the framework.

### `c.input`

Validation results. Discriminated union — check `c.input.ok` before accessing typed data.

When `c.input.ok` is `true`:

- `c.input.params` — validated params (typed from Zod schema, or `Record<string, string>` without schema)
- `c.input.query` — validated query (typed from Zod schema, or `Record<string, string | string[] | undefined>` without schema)
- `c.input.body` — validated body (typed from Zod schema, or `unknown` without schema)

When `c.input.ok` is `false`:

- `c.input.issues` — array of `ValidationIssue` across all parts
- `c.input.failed` — which parts failed: `("params" | "query" | "body")[]`
- `c.input.params`, `c.input.query`, `c.input.body` — all `undefined`

The framework never auto-returns on validation failure. You check `c.input.ok` and decide.

### `c.locals`

Per-request data produced by `onRequest`. In hooks (`onResponse`, `onError`, `onNotFound`), the type is inferred from `onRequest`'s return type. In handlers, the type is `Record<string, unknown>` — cast if needed (rarely needed since auth comes from plain functions, not locals).

---

## Routes

A route defines a method, a path, request/response schemas, and a resolve function.

```ts
route.get("/users/:id", {
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ include: z.enum(["posts", "comments"]).optional() }),
  },
  response: {
    200: UserSchema,
    400: ErrorSchema,
    404: ErrorSchema,
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }

    const user = await db.users.get(c.input.params.id);

    if (!user) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(user);
  },
});
```

### `request` (optional)

Declares expected request data using Zod schemas. Each field is optional:

- `params` — path parameters (e.g., `:id`)
- `query` — query string parameters
- `body` — JSON request body (auto-parsed when schema is present)

When a `body` schema is defined, the framework calls `request.json()` automatically. If JSON parsing fails, `c.input.ok` is `false` with an `invalid_json` issue.

Without a body schema, the body is not parsed. Use `c.request.json()` manually if needed.

### `response` (optional)

Declares possible response shapes keyed by status code. These are metadata for OpenAPI generation — the framework does not validate outgoing responses against them at runtime.

Maps directly to OpenAPI:

- `request.params` → OpenAPI path parameters
- `request.query` → OpenAPI query parameters
- `request.body` → OpenAPI requestBody
- `response[200]` → OpenAPI responses.200.content

### `resolve` (required)

The handler function. Receives context, must return a `Response`. Every `return` is a decision boundary — the request ends there.

---

## Groups

Groups organize routes. A group takes an array and returns an array. It exists as a named concept and future extension point.

```ts
import { route, group } from "@hectoday/http";

export const userRoutes = group([
  route.get("/users", { ... }),
  route.post("/users", { ... }),
  route.delete("/users/:id", { ... }),
]);
```

Groups are spread into `routes` in `setup()`:

```ts
routes: [
  route.get("/health", { resolve: () => Response.json({ status: "ok" }) }),
  ...userRoutes,
  ...adminRoutes,
],
```

Groups carry no behavior — no shared guards, no shared middleware, no prefix. They are a code organization pattern.

---

## Setup

`setup()` creates the app. It takes routes and hooks.

```ts
const app = setup({
  onRequest: ({ request }) => ({
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
  }),

  routes: [
    route.get("/health", {
      resolve: () => Response.json({ status: "ok" }),
    }),
    ...userRoutes,
  ],

  onResponse: ({ response, locals }) => {
    const headers = new Headers(response.headers);
    headers.set("x-request-id", locals.requestId);
    return new Response(response.body, { status: response.status, headers });
  },

  onError: ({ error, locals }) => {
    console.error({ error, requestId: locals.requestId });
    return Response.json({ error: "Internal error" }, { status: 500 });
  },

  onNotFound: ({ request, locals }) => Response.json({ error: "Not found" }, { status: 404 }),
});
```

### Returns

```ts
app.fetch; // (request: Request) => Response | Promise<Response>
app.request; // (path: string, options?) => Promise<Response>
app.routes; // RouteDescriptor[] — for OpenAPI generation
```

`app.fetch` is the server handler — pass it to your runtime. `app.request` is a convenience that builds a `Request` and calls `app.fetch` — used in tests. `app.routes` exposes route descriptors for OpenAPI generation.

---

## Hooks

Four hooks, four jobs. No middleware.

### `onRequest`

Runs before routing. Can return per-request locals or nothing.

If it returns an object, that becomes `c.locals` — the return type flows into all hooks. If it returns nothing, it's a side-effect-only hook.

With locals:

```ts
onRequest: ({ request }) => ({
  requestId: crypto.randomUUID(),
  startTime: Date.now(),
});
```

Side-effect only:

```ts
onRequest: ({ request }) => {
  console.log(`→ ${request.method} ${new URL(request.url).pathname}`);
};
```

### `onResponse`

Runs after every response (handler success, 404, error). Can modify the response.

```ts
onResponse: ({ request, response, locals }) => {
  // Add headers, log, etc.
  return response;
};
```

### `onError`

Runs when a handler throws an unexpected error. Returns an error response.

```ts
onError: ({ error, request, locals }) => {
  return Response.json({ error: "Internal error" }, { status: 500 });
};
```

`locals` is `Partial<TLocals>` since `onRequest` itself may have thrown.

### `onNotFound`

Runs when no route matches. Returns a 404 response.

```ts
onNotFound: ({ request, locals }) => {
  return Response.json({ error: "Not found" }, { status: 404 });
};
```

---

## Request Lifecycle

```
1. Request arrives
2. onRequest → produces locals (or side-effect only)
3. Route matching (method + path via rou3)
   → No match: onNotFound → onResponse → send
4. Extract raw inputs (params from route, query from URL, body if schema)
5. Validate inputs (Zod safeParse on each part with a schema)
6. resolve (handler runs, receives context)
   → Throws: onError → onResponse → send
7. onResponse → send
```

---

## Auth Pattern

No guards, no middleware. Auth is plain functions returning `T | Response`.

```ts
function authenticate(request: Request): User | Response {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = verifyToken(header.slice(7));
  if (!user) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
  return user;
}

function requireAdmin(user: User): true | Response {
  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return true;
}
```

Used in handlers with `instanceof Response` narrowing:

```ts
resolve: async (c) => {
  const caller = authenticate(c.request);
  if (caller instanceof Response) return caller;
  // caller is User

  const admin = requireAdmin(caller);
  if (admin instanceof Response) return admin;
  // authorized

  // ... handler logic
};
```

Compose reusable checks:

```ts
function authenticatedAdmin(request: Request): User | Response {
  const user = authenticate(request);
  if (user instanceof Response) return user;

  const admin = requireAdmin(user);
  if (admin instanceof Response) return admin;

  return user;
}
```

Two lines per check. Every decision boundary visible. Full type safety via narrowing.

---

## Type Safety

### Zod schema inference

`c.input.params`, `c.input.query`, `c.input.body` are typed from the Zod schemas on the route's `request` config. No annotations needed.

### Locals inference

`c.locals` is typed from `onRequest`'s return type in hooks (`onResponse`, `onError`, `onNotFound`). In route handlers, locals are `Record<string, unknown>` — cast if needed. In practice this rarely matters since auth data comes from plain function returns, not locals.

### Auth function narrowing

`authenticate` returns `User | Response`. After `instanceof Response` check, TypeScript narrows to `User`. No casts, no generics, no framework types.

---

## Project Structure

Separate the app from the server.

```ts
// app.ts
import { setup, route, group } from "@hectoday/http";
import { userRoutes } from "./users";

export const app = setup({
  onRequest: ({ request }) => ({
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
  }),

  routes: [
    route.get("/health", {
      resolve: () => Response.json({ status: "ok" }),
    }),
    ...userRoutes,
  ],

  onResponse: ({ response, locals }) => {
    const headers = new Headers(response.headers);
    headers.set("x-request-id", locals.requestId);
    return new Response(response.body, { status: response.status, headers });
  },

  onError: ({ error, locals }) => {
    console.error({ error, requestId: locals.requestId });
    return Response.json({ error: "Internal error" }, { status: 500 });
  },
});
```

```ts
// users.ts
import { z } from "zod";
import { route, group } from "@hectoday/http";

export const userRoutes = group([
  route.get("/users", { ... }),
  route.post("/users", { ... }),
  route.delete("/users/:id", { ... }),
]);
```

```ts
// server.ts
import { app } from "./app";

Deno.serve(app.fetch);
```

Tests import the app, never the server. No server starts during tests.

---

## Testing

No test framework, no test utilities, no separate package. The app has a `request` method that builds a `Request` and calls `fetch` directly. Same code path as production, just no TCP.

```ts
// users.test.ts
import { describe, it, expect } from "vitest";
import { app } from "./app";

describe("POST /users", () => {
  it("creates a user", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "Alice", email: "a@b.com" },
      headers: { authorization: "Bearer valid" },
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe("Alice");
  });

  it("rejects invalid body", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "", email: "bad" },
      headers: { authorization: "Bearer valid" },
    });

    expect(res.status).toBe(400);
  });

  it("rejects missing auth", async () => {
    const res = await app.request("/users", {
      method: "POST",
      body: { name: "Alice", email: "a@b.com" },
    });

    expect(res.status).toBe(401);
  });
});
```

### `app.request`

Convenience method. Builds a `Request`, serializes body as JSON, sets content-type, calls `app.fetch`. Returns a standard `Response`.

```ts
app.request(path: string, options?: {
  method?: string;           // defaults to "GET"
  body?: unknown;            // JSON-serialized automatically
  headers?: Record<string, string>;
  query?: Record<string, string>;
}): Promise<Response>
```

The full request lifecycle runs — `onRequest`, routing, validation, `resolve`, `onResponse`.

### Test runner

Bring your own. Vitest, Jest, Deno.test — anything works.

---

## CORS

A `cors()` helper that returns two pieces: a preflight route handler and a response header function.

```ts
import { cors } from "@hectoday/http";

const { preflight, headers } = cors({
  origin: "https://myapp.com",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});
```

### Usage

```ts
const app = setup({
  routes: [
    preflight(route), // registers OPTIONS /** handler
    ...userRoutes,
  ],

  onResponse: ({ request, response }) => headers(request, response),
});
```

`preflight(route)` registers a catch-all `OPTIONS` route that responds with `204` and the configured CORS headers. `headers(request, response)` adds CORS headers to any response — used in `onResponse` so every response gets them.

### Configuration

```ts
cors({
  origin: string | string[];       // allowed origins
  methods?: string[];              // allowed methods, defaults to GET, HEAD, PUT, PATCH, POST, DELETE
  allowHeaders?: string[];         // allowed request headers
  exposeHeaders?: string[];        // headers the browser can read
  credentials?: boolean;           // allow credentials, defaults to false
  maxAge?: number;                 // preflight cache duration in seconds
})
```

### Why two pieces

CORS is two things: preflight handling (OPTIONS requests) and response headers (every request). The helper makes both visible.

---

## Serving

Bring your own server.

```ts
// Deno
Deno.serve(app.fetch);

// Bun
Bun.serve({ fetch: app.fetch });

// Cloudflare Workers
export default { fetch: app.fetch };

// Node.js (via srvx)
import { serve } from "srvx";
serve({ fetch: app.fetch });
```

---

## Dependencies

- **rou3** — route matching (sole runtime dependency)
- **zod** — validation (peer dependency)

No other dependencies. No Node-specific APIs. Web Standards only.

---

## What the framework does NOT do

- Auto-return on validation failure
- Auto-return on missing auth
- Catch errors and return 500 (goes to `onError` if defined)
- Add default headers
- Enforce error formats
- Parse non-JSON bodies
- Validate outgoing responses
- Provide middleware or guards
- Provide session management, rate limiting, or other batteries
- Serve static files
- Parse multipart form data
- Manage WebSocket connections (except on Deno where upgrade returns a Response)

Everything the framework doesn't do is your code in your handler. That's the point.

---

## Custom Methods

For uncommon HTTP methods, use `route.all` and check `c.request.method`:

```ts
route.all("/resource", {
  resolve: (c) => {
    if (c.request.method === "PROPFIND") {
      return new Response(xml, { headers: { "content-type": "application/xml" } });
    }
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },
});
```

No `route.custom()`. `route.all` covers it.

---

## Type Fix: `defineRoute` Locals Parameter

Use `Record<string, unknown>` instead of `any` for the locals type parameter in `defineRoute` and the `route` object methods. This prevents ts7044 (`c` implicitly has `any` type):

```ts
function defineRoute<
  TParamsSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
>(
  method: string,
  path: string,
  config: RouteConfig<Record<string, unknown>, TParamsSchema, TQuerySchema, TBodySchema>,
): RouteDescriptor {
  return { method: method.toUpperCase(), path, config: config as RouteConfig<any, any, any, any> };
}
```

---

## Companion Package: `@hectoday/openapi`

Generates an OpenAPI 3.1 spec from `app.routes` and serves Scalar API docs.

### Dependencies

- `zod-openapi` — Zod → OpenAPI schema conversion
- Peer: `@hectoday/http`, `zod`

### Usage

```ts
import { openapi } from "@hectoday/openapi";

const apiRoutes = [...userRoutes, ...adminRoutes];

const { spec, docs } = openapi(apiRoutes, {
  info: { title: "My API", version: "1.0.0" },
  security: [{ bearerAuth: [] }],
  securitySchemes: {
    bearerAuth: { type: "http", scheme: "bearer" },
  },
});

const app = setup({
  routes: [
    spec(route), // GET /openapi.json
    docs(route), // GET /docs (Scalar UI)
    ...apiRoutes,
  ],
});
```

### Design decisions

- `openapi()` takes the routes array, not the app — avoids circular reference with `setup()`
- `spec()` and `docs()` take `route` from the user — the openapi package never imports `@hectoday/http`
- Same pattern as `cors()`: helper returns functions, user wires them into routes explicitly
- `extendZodWithOpenApi(z)` runs lazily inside `openapi()`, not at module level
- Security schemes are global config, not per-route — covers the common case without coupling route configs to OpenAPI concepts
- Schema examples use `zod-openapi`'s `.openapi({ example })` — import `"zod-openapi/extend"` once in app entry point

### What was rejected

- Per-route tags — would leak OpenAPI concepts into core framework
- Per-route security overrides — auth is plain functions, framework can't infer what scheme a handler uses
- Custom type generator — `openapi-typescript` and `openapi-fetch` already exist
- Eden Treaty-style typed client — requires `App` to carry full route types, causes slow TypeScript compilation. Use OpenAPI codegen instead.

---

## Versioning

No framework feature. Versioning is paths and file organization:

```ts
const v1Routes = [...userRoutesV1];
const v2Routes = [...userRoutesV2];

const app = setup({
  routes: [...v1Routes, ...v2Routes],
});
```

Separate OpenAPI specs per version by calling `openapi()` multiple times with different `specPath`/`docsPath`.

---

## Patterns the Framework Enables (Not Builds)

These are userland patterns, not framework features:

- **Rate limiting** — plain function returning `true | Response`, same as auth
- **Logging** — `onRequest` + `onResponse` hooks with pino or any logger
- **RPC** — `route.post("/rpc/procedureName", { ... })` with a thin `rpc()` wrapper
- **Client types** — OpenAPI spec → `openapi-typescript` → typed fetch client + typed MSW handlers
