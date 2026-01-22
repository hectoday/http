---
title: "The Web Standard Foundation"
description: "How Web Standards provide the primitives for HTTP servers"
order: 3
draft: true
---

The mental model from Chapter 1 needs concrete primitives. Fortunately, they already exist: the **Fetch API**.

Originally designed for browsers, the Fetch API has become the universal standard for HTTP on both client and server.

## The Fetch API (On the Server)

The Fetch API defines three core primitives: `Request`, `Response`, and `Headers`. Understanding these is understanding HTTP itself.

### Request

Every HTTP request is represented by the `Request` object:

```typescript
const request = new Request("https://example.com/users/123", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer token123"
  },
  body: JSON.stringify({ name: "Alice" })
});
```

**On the server, you receive these**, you don't create them:

```typescript
// Deno.serve, Bun.serve, Workers - all pass you a Request
Deno.serve((request: Request) => {
  // request.method → "GET", "POST", etc.
  // request.url → "https://example.com/path?query=value"
  // request.headers → Headers object
  // request.body → ReadableStream | null
});
```

#### The Properties

**`request.method`** — HTTP method as a string

```typescript
request.method // "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | ...
```

No magic enums. Just strings. Handle any method:

```typescript
if (request.method === "GET") {
  // ...
} else if (request.method === "POST") {
  // ...
} else if (request.method === "PROPFIND") {
  // WebDAV works too
}
```

**`request.url`** — Full URL as a string

```typescript
request.url // "https://example.com/users/123?include=posts"
```

Parse it to extract parts:

```typescript
const url = new URL(request.url);
url.pathname // "/users/123"
url.searchParams.get("include") // "posts"
url.hostname // "example.com"
```

**`request.headers`** — Headers object

```typescript
request.headers.get("content-type") // "application/json" | null
request.headers.get("authorization") // "Bearer token" | null
```

Headers are case-insensitive:

```typescript
request.headers.get("Content-Type") // same as "content-type"
request.headers.get("CONTENT-TYPE") // same as "content-type"
```

**`request.body`** — ReadableStream or null

```typescript
// For JSON
const data = await request.json();

// For text
const text = await request.text();

// For form data
const form = await request.formData();

// For binary
const buffer = await request.arrayBuffer();
```

**Important**: The body can only be read once. After `request.json()`, calling `request.text()` will throw.

### Response

Every HTTP response is represented by the `Response` object:

```typescript
const response = new Response(
  JSON.stringify({ id: 1, name: "Alice" }),
  {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    }
  }
);
```

**On the server, you create these** to send back to clients:

```typescript
Deno.serve((request: Request) => {
  // You return a Response
  return new Response("Hello World");
});
```

#### Common Response Patterns

**Plain text**:

```typescript
return new Response("Hello World");
```

**JSON** (using the helper):

```typescript
return Response.json({ message: "Hello World" });

// Equivalent to:
return new Response(
  JSON.stringify({ message: "Hello World" }),
  { headers: { "Content-Type": "application/json" } }
);
```

**With status**:

```typescript
return Response.json({ error: "Not Found" }, { status: 404 });
```

**With headers**:

```typescript
return new Response("Hello", {
  headers: {
    "Content-Type": "text/plain",
    "X-Custom-Header": "value"
  }
});
```

**Streaming**:

```typescript
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue("chunk 1\n");
    controller.enqueue("chunk 2\n");
    controller.close();
  }
});

return new Response(stream);
```

**Empty (no body)**:

```typescript
return new Response(null, { status: 204 }); // 204 No Content
```

### Headers, Body, Method, URL — The Complete Picture

```typescript
Deno.serve(async (request: Request) => {
  // Method: what action?
  console.log(request.method); // "POST"
  
  // URL: what resource?
  const url = new URL(request.url);
  console.log(url.pathname); // "/users"
  console.log(url.searchParams.get("filter")); // "active"
  
  // Headers: metadata about the request
  console.log(request.headers.get("content-type")); // "application/json"
  console.log(request.headers.get("authorization")); // "Bearer token"
  
  // Body: the payload
  const data = await request.json(); // { name: "Alice" }
  
  // Return a Response with status, headers, body
  return Response.json(
    { id: 1, name: data.name },
    { 
      status: 201,
      headers: { "X-Request-Id": "abc123" }
    }
  );
});
```

This is **standard JavaScript**. No framework concepts. Just Web APIs.

## Why Web Standards Matter

Using Web standards instead of framework-specific APIs has profound implications.

### Portability Across Deno, Bun, Workers

The same code runs everywhere:

```typescript
import { route, setup } from "@hectoday/http";

const app = setup({
  handlers: [
    route.get("/hello", {
      resolve: () => new Response("Hello World")
    })
  ]
});

// Deno
Deno.serve(app.fetch);

// Bun
Bun.serve({ fetch: app.fetch });

// Cloudflare Workers
export default { fetch: app.fetch };

// Node.js (with fetch support)
import { serve } from "@hono/node-server";
serve({ fetch: app.fetch });
```

**The handler code doesn't change.** Only the server setup changes.

Compare this to framework-specific APIs:

```typescript
// Framework A
app.get("/hello", (req, res) => {
  res.send("Hello World");
});

// Framework B
app.get("/hello", (ctx) => {
  return ctx.text("Hello World");
});

// Framework C
app.get("/hello", (request, h) => {
  return h.response("Hello World");
});
```

Each framework invents its own abstraction. Switching runtimes means rewriting code.

### No Framework-Shaped Abstractions

Frameworks often wrap Web standards with their own APIs:

```typescript
// Framework wrapper
ctx.json({ data: "value" });
ctx.status(201);
ctx.header("X-Custom", "value");

// vs Web standard
return Response.json(
  { data: "value" },
  { 
    status: 201,
    headers: { "X-Custom": "value" }
  }
);
```

The framework version seems convenient, but:

1. **It's one more thing to learn** — `ctx.json()` instead of `Response.json()`
2. **It's one more thing that can break** — framework updates can change the API
3. **It's not portable** — switching frameworks means relearning
4. **It's not documented universally** — you need framework-specific docs

Web standards are:
- **Already learned** — if you know Fetch API, you know this
- **Stable** — standards don't break on minor updates
- **Portable** — works everywhere the Web platform exists
- **Universally documented** — MDN, specs, endless tutorials

### Future-Proof

When new runtimes emerge, they implement Web standards first:

```typescript
// This code will work on runtimes that don't exist yet
// Because they'll implement Request/Response
return new Response("Hello World");
```

Framework-specific code has no such guarantee.

## What Hectoday HTTP Adds (and What It Refuses To)

Hectoday HTTP is not "just" the Fetch API. It adds structure without adding abstraction.

### What It Adds

**Route matching**:

```typescript
route.get("/users/:id", {
  resolve: (c) => {
    const id = c.raw.params.id; // Extracted from path
    return Response.json({ id });
  }
})
```

You could parse URLs yourself with URLPattern, but Hectoday HTTP does this for you.

**Validation results**:

```typescript
route.post("/users", {
  request: { body: schema },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    // c.input.body is validated and typed
  }
})
```

You could call validators yourself, but Hectoday HTTP structures the result consistently.

**Guard composition**:

```typescript
route.get("/admin", {
  guards: [requireAuth, requireAdmin],
  resolve: (c) => {
    // Only runs if both guards allow
    return Response.json({ data: "secret" });
  }
})
```

You could check auth manually, but Hectoday HTTP gives you a pattern.

**Context accumulation**:

```typescript
// onRequest adds locals
// Guards add more locals
// Handler sees all locals
resolve: (c) => {
  const userId = c.locals.userId; // From auth guard
  const requestId = c.locals.requestId; // From onRequest
  return Response.json({ userId, requestId });
}
```

You could pass data around manually, but Hectoday HTTP threads it through automatically.

### What It Refuses To Add

**No implicit routing**:

```typescript
// Hectoday HTTP: NEVER
// Routes don't auto-respond based on file structure
// Routes don't auto-generate from decorators
// Routes are explicit data structures

route.get("/users/:id", config); // You write this
```

**No magic errors**:

```typescript
// Hectoday HTTP: NEVER
// throw AuthError() → auto 401
// throw ValidationError() → auto 400
// throw NotFoundError() → auto 404

// Instead: explicit returns
if (!authorized) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

**No implicit middleware chains**:

```typescript
// Hectoday HTTP: NEVER
// app.use(middleware1);
// app.use(middleware2);
// // What order? What runs when? What can short-circuit?

// Instead: explicit hooks with clear jobs
setup({
  onRequest: ({ request }) => ({ requestId: crypto.randomUUID() }), // Before routing
  handlers: [...],
  onResponse: ({ context, response }) => addHeaders(response), // After handler
  onError: ({ error, context }) => handleError(error) // On throw
});
```

Middleware chains have implicit ordering and unclear control flow. Hectoday HTTP makes every step explicit.

### The Line

Hectoday HTTP adds structure where manual work is repetitive:
- Parsing URL patterns
- Running validators
- Composing guards
- Threading context

Hectoday HTTP **refuses** to add magic where explicitness matters:
- Deciding what responses mean
- Controlling when requests end
- Hiding where decisions happen

**The Web standards provide the primitives. Hectoday HTTP provides the structure. You provide the decisions.**

---

Next: [Your First Server](./your-first-server) — building a complete handler with what we've learned.
