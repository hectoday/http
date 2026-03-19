# OpenAPI

Generate an OpenAPI 3.1 spec from your routes and serve interactive API docs with Scalar.

```bash
npm install @hectoday/openapi
```

## Setup

```ts
import { setup, route } from "@hectoday/http";
import { openapi } from "@hectoday/openapi";
import { userRoutes } from "./users";

// Collect your API routes
const apiRoutes = [...userRoutes];

// Generate spec + docs from those routes
const { spec, docs } = openapi(apiRoutes, {
  info: { title: "My API", version: "1.0.0" },
});

const app = setup({
  routes: [
    spec(route), // GET /openapi.json
    docs(route), // GET /docs (Scalar UI)
    ...apiRoutes,
  ],
});
```

Visit `/docs` to see the interactive API reference. Visit `/openapi.json` for the raw spec.

## What gets generated

The `request` and `response` schemas on your routes map directly to OpenAPI:

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
    401: z.object({ error: z.string() }),
  },
  resolve: async (c) => { ... },
})
```

This produces:

- `requestBody` with `application/json` schema from `request.body`
- Path parameters from `request.params`
- Query parameters from `request.query`
- Response schemas from `response[201]`, `response[400]`, `response[401]`

Routes without `request` or `response` schemas still appear in the spec with minimal documentation.

## Adding metadata

Use Zod's `.describe()` for descriptions:

```ts
const CreateUser = z.object({
  name: z.string().min(1).describe("The user's full name"),
  email: z.string().email().describe("A valid email address"),
});
```

For examples and other OpenAPI-specific metadata, use `.openapi()` from `zod-openapi`. Import the extension once in your app entry point:

```ts
// app.ts
import "zod-openapi/extend";
```

Then use `.openapi()` anywhere on your Zod schemas:

```ts
const StatsResponse = z.object({
  stats: z.object({
    uptime: z.number(),
    memory: z.number(),
  }),
}).openapi({
  example: {
    stats: { uptime: 86400, memory: 134217728 },
  },
});

route.get("/admin/stats", {
  response: { 200: StatsResponse },
  resolve: (c) => { ... },
})
```

Scalar renders the examples in the docs so users can see what responses look like before making requests.

## Configuration

```ts
const { spec, docs } = openapi(apiRoutes, {
  info: {
    title: "My API",
    version: "1.0.0",
    description: "A user management API",
    license: { name: "MIT" },
  },
  specPath: "/openapi.json", // default
  docsPath: "/docs", // default
  servers: [
    { url: "https://api.example.com", description: "Production" },
    { url: "http://localhost:3000", description: "Local" },
  ],
  tags: [{ name: "users", description: "User management" }],
  security: [{ bearerAuth: [] }],
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
    },
  },
});
```

## Authentication in docs

The `security` and `securitySchemes` fields map directly to OpenAPI's security definitions. Scalar picks them up and shows an auth UI where users can enter tokens and test endpoints.

Most APIs have one auth scheme across all routes. Set it once in the config:

```ts
// Bearer token
securitySchemes: {
  bearerAuth: { type: "http", scheme: "bearer" },
},
security: [{ bearerAuth: [] }],

// API key in header
securitySchemes: {
  apiKey: { type: "apiKey", name: "X-API-Key", in: "header" },
},
security: [{ apiKey: [] }],
```

This is metadata for the docs — it doesn't affect how auth works at runtime. Your `authenticate()` function is still what actually checks tokens.

## Custom spec and docs paths

```ts
const { spec, docs } = openapi(apiRoutes, {
  info: { title: "My API", version: "1.0.0" },
  specPath: "/api/spec.json",
  docsPath: "/api/reference",
});
```
