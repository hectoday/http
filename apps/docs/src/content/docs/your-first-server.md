---
title: "Your first server"
description: "Building your first Hectoday HTTP server"
order: 2
part: 2
draft: false
---

You understand the mental model. You know the Web standards. Now let's build a server.

## A server is just a function

At its core, every Hectoday HTTP server is a function: `Request → Response`.

Here's the smallest possible server:

```typescript
import { route, setup } from "@hectoday/http";

const app = setup({
  handlers: [
    route.get("/", {
      resolve: () => new Response("Hello World")
    })
  ]
});

Deno.serve(app.fetch);
```

Let's break this down:

### The setup

```typescript
const app = setup({
  handlers: [/* routes go here */]
});
```

`setup()` takes a configuration and returns an object with a `fetch` method. That `fetch` method is your server function: `Request → Response`.

### The route

```typescript
route.get("/", {
  resolve: () => new Response("Hello World")
})
```

`route.get()` creates a route descriptor:
- **Path**: `"/"` matches requests to the root
- **Method**: `.get` matches only GET requests
- **Handler**: `resolve` is the function that returns the Response

### The server

```typescript
Deno.serve(app.fetch);
```

Pass the `fetch` function to your runtime's server. It works with:
- `Deno.serve(app.fetch)`
- `Bun.serve({ fetch: app.fetch })`
- Cloudflare Workers: `export default { fetch: app.fetch }`

**That's it.** Every Hectoday HTTP server follows this pattern:
1. Define routes
2. Pass them to `setup()`
3. Pass `app.fetch` to your runtime

## The handler signature

Every handler receives **context** and returns a **Response**.

### What you receive: Context

```typescript
route.get("/users/:id", {
  resolve: (c) => {
    // c is the context
    // What's inside?
  }
})
```

The context object (`c`) contains:

```typescript
interface Context {
  request: Request;           // The original Web standard Request
  raw: RawValues;            // Extracted inputs (params, query, body)
  input: InputState;         // Validation results (ok or not ok)
  locals: Record<string, unknown>;  // Request-scoped data
}
```

### `c.request` - The original request

```typescript
route.get("/hello", {
  resolve: (c) => {
    console.log(c.request.method);  // "GET"
    console.log(c.request.url);     // "https://example.com/hello"
    console.log(c.request.headers.get("user-agent")); // Browser info
    
    return new Response("Hello");
  }
})
```

This is the standard Fetch API `Request`. No wrapper. Use it directly.

### `c.raw` - Extracted inputs

Hectoday HTTP extracts common values for you:

```typescript
route.get("/users/:id", {
  resolve: (c) => {
    const id = c.raw.params.id;  // Path parameter
    return Response.json({ id });
  }
})
```

```typescript
route.get("/search", {
  resolve: (c) => {
    const query = c.raw.query.q;     // Query parameter
    const page = c.raw.query.page;   // Another query parameter
    return Response.json({ query, page });
  }
})
```

```typescript
route.post("/users", {
  resolve: async (c) => {
    const body = c.raw.body;  // Parsed body (if you define body schema)
    return Response.json({ received: body });
  }
})
```

**Important**: `c.raw` values are **not validated**. They're just extracted. Use them carefully or validate them first.

### `c.input` - Validation results

When you define schemas, `c.input` tells you if validation passed:

```typescript
route.post("/users", {
  request: {
    body: z.object({ name: z.string() })
  },
  resolve: (c) => {
    if (!c.input.ok) {
      // Validation failed
      return Response.json(
        { error: c.input.issues },
        { status: 400 }
      );
    }
    
    // Validation passed - c.input.body is typed!
    const name = c.input.body.name; // string
    return Response.json({ name });
  }
})
```

We'll cover validation in detail later. For now, know: **validation never auto-responds**. You check `c.input.ok` and decide what to do.

### `c.locals` - Request-scoped data

Guards and hooks can attach data to `c.locals`:

```typescript
// From a guard or onRequest
{ userId: "123", role: "admin" }

// In your handler
route.get("/profile", {
  resolve: (c) => {
    const userId = c.locals.userId;
    return Response.json({ userId });
  }
})
```

More on this in the Guards chapter.

## Returning a Response

Every handler **must return a Response**. Not a string. Not an object. A `Response`.

### Simple text

```typescript
route.get("/hello", {
  resolve: () => new Response("Hello World")
})
```

### JSON

```typescript
route.get("/user", {
  resolve: () => Response.json({ id: 1, name: "Alice" })
})
```

### With status Code

```typescript
route.post("/users", {
  resolve: () => Response.json(
    { id: 1, name: "Alice" },
    { status: 201 }  // Created
  )
})
```

### With headers

```typescript
route.get("/data", {
  resolve: () => new Response(
    JSON.stringify({ data: "value" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "max-age=3600"
      }
    }
  )
})
```

### Error responses

```typescript
route.get("/admin", {
  resolve: (c) => {
    if (!c.locals.isAdmin) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }
    
    return Response.json({ secret: "data" });
  }
})
```

### Empty response

```typescript
route.delete("/users/:id", {
  resolve: (c) => {
    const id = c.raw.params.id;
    // Delete user...
    
    return new Response(null, { status: 204 }); // No Content
  }
})
```

### Async handlers

Most real handlers are async:

```typescript
route.get("/users/:id", {
  resolve: async (c) => {
    const id = c.raw.params.id;
    const user = await db.users.get(id);
    
    if (!user) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    return Response.json(user);
  }
})
```

### Multiple returns

You can return from multiple places:

```typescript
route.get("/users/:id", {
  resolve: async (c) => {
    const id = c.raw.params.id;
    
    // Early return for invalid input
    if (!id || !/^\d+$/.test(id)) {
      return Response.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }
    
    const user = await db.users.get(id);
    
    // Early return for not found
    if (!user) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Success case
    return Response.json(user);
  }
})
```

Each `return` is a decision boundary. The request ends there.

## When a request ends

This is the most important concept in Hectoday HTTP: **knowing when requests end**.

### Only two ways a request can end

In Hectoday HTTP, requests end in exactly two places:

#### 1. A guard denies

```typescript
const requireAuth = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    // REQUEST ENDS HERE
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  return { allow: true };
};

route.get("/protected", {
  guards: [requireAuth],
  resolve: (c) => {
    // Only runs if guard allowed
    return Response.json({ data: "secret" });
  }
})
```

If a guard returns `{ deny: Response }`, the request ends. The handler never runs.

#### 2. A handler returns

```typescript
route.get("/users/:id", {
  resolve: (c) => {
    const id = c.raw.params.id;
    
    if (!id) {
      // REQUEST ENDS HERE
      return Response.json({ error: "Missing ID" }, { status: 400 });
    }
    
    // REQUEST ENDS HERE
    return Response.json({ id });
  }
})
```

When the handler returns a `Response`, the request ends.

### What CANNOT end requests

These do **not** end requests:

#### Validation failures

```typescript
route.post("/users", {
  request: { body: schema },
  resolve: (c) => {
    // Validation failed - but request continues!
    if (!c.input.ok) {
      // You must explicitly return
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // If you didn't return, you're still here
    return Response.json({ success: true });
  }
})
```

Validation sets `c.input.ok = false`. **It doesn't return.** You decide what that means.

#### Throwing errors

```typescript
route.get("/users", {
  resolve: async (c) => {
    // This throws - goes to onError, not a normal response
    const users = await db.users.getAll(); // Might throw
    
    return Response.json(users);
  }
})
```

If you `throw`, the error goes to the global `onError` handler (if defined). This is for **unexpected** errors, not normal control flow.

For expected failures, **return explicitly**:

```typescript
route.get("/users/:id", {
  resolve: async (c) => {
    const id = c.raw.params.id;
    const user = await db.users.get(id);
    
    // Don't throw - return
    if (!user) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    
    return Response.json(user);
  }
})
```

### Why this matters for correctness

When you know **exactly** where requests can end, you can reason about your code:

```typescript
route.post("/users", {
  guards: [requireAuth],
  resolve: async (c) => {
    // If we're here, auth passed (or guard would have denied)
    
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
      // ↑ Request ends here
    }
    
    // If we're here, validation passed (or we would have returned)
    
    const user = await createUser(c.input.body);
    
    if (!user) {
      return Response.json({ error: "Creation failed" }, { status: 500 });
      // ↑ Request ends here
    }
    
    // If we're here, creation succeeded
    
    return Response.json(user, { status: 201 });
    // ↑ Request ends here
  }
})
```

At any point in the handler, you can trace backward:
- "Am I here? Then auth passed."
- "Am I here? Then validation passed."
- "Am I here? Then creation succeeded."

**No hidden branching. No magic returns. Just explicit control flow.**

### The complete picture

```
Request arrives
    ↓
Framework routes to handler
    ↓
Guards run (might deny → request ends)
    ↓
Handler runs (must return → request ends)
    ↓
Response sent
```

Two decision points. Two ways to end. Everything else is just computation.

---

Next: [Describing facts](./describing-facts) - how to safely extract and work with request data.
