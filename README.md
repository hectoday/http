# @hectoday/http

A lightweight HTTP framework built on web standards. Type-safe routing with Zod validation, lifecycle hooks, CORS, and automatic OpenAPI 3.1 generation.

Works on **Node.js**, **Deno**, **Bun**, and **Cloudflare Workers**.

## Install

```bash
npm install @hectoday/http
```

## Quick start

```ts
import { setup, route } from "@hectoday/http";
import { z } from "zod/v4";
import { serve } from "srvx";

const app = setup({
  routes: [
    route.get("/hello/:name", {
      request: {
        params: z.object({ name: z.string() }),
      },
      resolve: (c) => {
        if (!c.input.ok) return Response.json(c.input.issues, { status: 400 });
        return Response.json({ message: `Hello, ${c.input.params.name}!` });
      },
    }),
  ],
});

serve({ fetch: app.fetch, port: 3000 });
```

Handlers receive a `Context` and return a standard `Response`. No custom abstractions.

## Validation

Define `request` schemas for params, query, and body. The framework validates automatically and exposes results through `c.input`:

```ts
route.post("/bookmarks", {
  request: {
    body: z.object({
      url: z.url(),
      title: z.string().min(1).max(200),
      tags: z.array(z.string()).max(10).default([]),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ issues: c.input.issues }, { status: 400 });
    }
    // c.input.body is fully typed
    return Response.json(createBookmark(c.input.body), { status: 201 });
  },
});
```

`c.input.ok` is a type guard -- when `true`, validated fields (`params`, `query`, `body`) are typed. When `false`, `c.input.issues` contains the validation errors.

## Lifecycle hooks

```ts
const app = setup({
  onRequest: ({ request }) => {
    // Runs before route matching. Return value becomes `c.locals`.
    return { startTime: Date.now() };
  },
  onResponse: ({ request, response, locals }) => {
    // Modify every response (add headers, logging, CORS, etc.)
    response.headers.set("X-Response-Time", `${Date.now() - locals.startTime}ms`);
    return response;
  },
  onError: ({ error, request }) => {
    return Response.json({ error: "Internal error" }, { status: 500 });
  },
  onNotFound: ({ request }) => {
    return Response.json({ error: "Not found" }, { status: 404 });
  },
  routes: [
    /* ... */
  ],
});
```

## Route groups

Organize routes with `group()`:

```ts
import { group, route } from "@hectoday/http";

const adminRoutes = group("/admin", [
  route.get("/users", { resolve: (c) => Response.json(getUsers()) }),
  route.delete("/users/:id", {
    resolve: (c) => {
      /* ... */
    },
  }),
]);
```

## CORS

```ts
import { cors, route } from "@hectoday/http";

const { preflight, headers } = cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
});

const app = setup({
  onResponse: ({ request, response }) => headers(request, response),
  routes: [
    preflight(route),
    // ... your routes
  ],
});
```

## OpenAPI

The `@hectoday/openapi` package generates an OpenAPI 3.1 spec from your route definitions and serves interactive docs via Scalar:

```bash
npm install @hectoday/openapi
```

```ts
import { openapi } from "@hectoday/openapi";

const api = openapi(routes, {
  info: { title: "My API", version: "1.0.0" },
  securitySchemes: {
    bearerAuth: { type: "http", scheme: "bearer" },
  },
});

const app = setup({
  routes: [...routes, api.spec(route), api.docs(route)],
});
// GET /openapi.json  -> OpenAPI spec
// GET /docs          -> Scalar API reference
```

Response schemas are also picked up when defined:

```ts
route.get("/health", {
  response: {
    200: z.object({ status: z.string() }),
  },
  resolve: () => Response.json({ status: "ok" }),
});
```

## Testing

The app exposes a `request()` helper for testing without a running server:

```ts
import { expect, test } from "vitest";

test("GET /health returns 200", async () => {
  const res = await app.request("/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("POST /bookmarks validates body", async () => {
  const res = await app.request("/bookmarks", {
    method: "POST",
    headers: { authorization: "Bearer token" },
    body: { url: "https://example.com", title: "Example" },
  });
  expect(res.status).toBe(201);
});
```

## Packages

| Package                                   | Description                                        |
| ----------------------------------------- | -------------------------------------------------- |
| [`@hectoday/http`](./packages/http)       | Core framework -- routing, validation, hooks, CORS |
| [`@hectoday/openapi`](./packages/openapi) | OpenAPI 3.1 spec generation and Scalar docs        |

## Examples

| App                                                 | Description                                                |
| --------------------------------------------------- | ---------------------------------------------------------- |
| [`beginners-guide-api`](./apps/beginners-guide-api) | Simple bookmarks API -- good starting point                |
| [`api-example`](./apps/api-example)                 | Full-featured API with Drizzle ORM, auth, and admin routes |
| [`client-example`](./apps/client-example)           | React frontend consuming the API                           |
| [`bench`](./apps/bench)                             | Performance benchmarks vs Hono, Fastify, Express           |

## Development

```bash
# Install dependencies
vp install

# Run dev server
vp run dev

# Run tests
vp test

# Lint, format, and typecheck
vp check

# Build all packages
vp run build -r
```

## License

[MIT](./LICENSE)
