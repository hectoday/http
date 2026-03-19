# Routes

A route has a method, a path, and a handler. Optionally, it describes the expected request and response with Zod schemas.

```ts
route.post("/users", {
  request: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  },
  response: {
    201: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    400: z.object({ error: z.unknown() }),
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }

    const user = await db.users.create({
      name: c.input.body.name, // string — typed from Zod
      email: c.input.body.email, // string — typed from Zod
    });

    return Response.json(user, { status: 201 });
  },
});
```

Read this out loud: "Route: POST /users. Request has a body with name and email. Response is 201 with a user, or 400 with an error. Resolve by validating, creating the user, returning the result."

## Methods

```ts
route.get("/path", { ... })
route.post("/path", { ... })
route.put("/path", { ... })
route.patch("/path", { ... })
route.delete("/path", { ... })
route.head("/path", { ... })
route.options("/path", { ... })
route.all("/path", { ... })       // matches any method
```

For uncommon methods like `PROPFIND`, use `route.all` and check the method:

```ts
route.all("/resource", {
  resolve: (c) => {
    if (c.request.method === "PROPFIND") {
      return new Response(xml, {
        headers: { "content-type": "application/xml" },
      });
    }
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },
});
```

## Path parameters

Use `:name` for dynamic segments:

```ts
route.get("/users/:id", {
  resolve: (c) => {
    // Without a schema, params are Record<string, string>
    if (!c.input.ok) return Response.json({ error: c.input.issues }, { status: 400 });
    const id = c.input.params.id; // string
    return Response.json({ id });
  },
});

route.get("/orgs/:orgId/repos/:repoId", {
  resolve: (c) => {
    if (!c.input.ok) return Response.json({ error: c.input.issues }, { status: 400 });
    const orgId = c.input.params.orgId;
    const repoId = c.input.params.repoId;
    return Response.json({ orgId, repoId });
  },
});
```

Use `**` for wildcard segments:

```ts
route.get("/files/**", {
  resolve: (c) => {
    // matches /files/a, /files/a/b/c, etc.
    return new Response("file handler");
  },
});
```

## `request`

Declares the expected request data using Zod schemas. Every field is optional.

```ts
route.post("/orgs/:orgId/users", {
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    query: z.object({ notify: z.coerce.boolean().default(false) }),
    body: z.object({ name: z.string(), email: z.string().email() }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }

    c.input.params.orgId; // string (UUID)
    c.input.query.notify; // boolean
    c.input.body.name; // string
    c.input.body.email; // string
  },
});
```

When you define a `body` schema, the framework parses the request body as JSON automatically. If JSON parsing fails, `c.input.ok` is `false` with an `invalid_json` issue. Without a `body` schema, the body is not parsed — use `c.request.json()` manually.

TypeScript infers the types from your Zod schemas. No annotations needed.

## `response`

Declares possible response shapes keyed by status code. These are metadata — the framework does not validate outgoing responses at runtime.

```ts
route.get("/users/:id", {
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  response: {
    200: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    400: z.object({ error: z.unknown() }),
    404: z.object({ error: z.string() }),
  },
  resolve: async (c) => {
    // ...
  },
});
```

Response schemas exist for OpenAPI generation. They map directly:

- `request.params` → OpenAPI path parameters
- `request.query` → OpenAPI query parameters
- `request.body` → OpenAPI requestBody
- `response[200]` → OpenAPI responses.200.content
- `response[404]` → OpenAPI responses.404.content

`app.routes` exposes all route descriptors including these schemas for tooling to consume.

## `resolve`

The handler. Receives context, returns a `Response`. Every `return` is a decision boundary — the request ends there.

```ts
resolve: async (c) => {
  // Early return on validation failure
  if (!c.input.ok) {
    return Response.json({ error: c.input.issues }, { status: 400 });
  }

  // Early return on not found
  const user = await db.users.get(c.input.params.id);
  if (!user) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Success
  return Response.json(user);
};
```

You can read top-to-bottom and see every place the request might end.

## Groups

Organize routes with `group()`:

```ts
import { route, group } from "@hectoday/http";

export const userRoutes = group([
  route.get("/users", { ... }),
  route.post("/users", { ... }),
  route.delete("/users/:id", { ... }),
]);
```

Spread them into setup:

```ts
const app = setup({
  routes: [
    route.get("/health", { resolve: () => Response.json({ status: "ok" }) }),
    ...userRoutes,
    ...adminRoutes,
  ],
});
```

Groups are just arrays. They carry no behavior — no shared config, no prefix, no middleware. They're a code organization pattern.
