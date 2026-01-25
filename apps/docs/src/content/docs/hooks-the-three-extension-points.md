---
title: "Hooks: the three extension points"
description: "Understanding onRequest, onResponse, and onError hooks"
order: 2
part: 3
draft: false
---

Hectoday HTTP has exactly three hooks. Not middleware chains. Not plugins. Three specific extension points with clear jobs.

This chapter explains what each hook does, when it runs, what it can and cannot do, and how to use them effectively.

## The Three Hooks

```typescript
setup({
  handlers: [...],
  
  onRequest: ({ request }) => {
    // Runs BEFORE routing
    // Returns: locals to merge into context
  },
  
  onResponse: ({ context, response }) => {
    // Runs AFTER handler succeeds
    // Returns: modified (or original) Response
  },
  
  onError: ({ error, context }) => {
    // Runs when handler THROWS
    // Returns: error Response to send
  }
});
```

**Key insight**: These three points cover the entire request lifecycle. Nothing happens outside them.

## onRequest: Before Routing

`onRequest` runs **before routing begins**. It receives the raw `Request` and returns locals.

### When It Runs

```
1. Request arrives
2. onRequest runs ← YOU ARE HERE
3. Route matching
4. Guards run
5. Handler runs
6. Response returns
```

It runs **once per request**, before any routing logic.

### What It Receives

```typescript
onRequest: (info) => {
  const { request } = info;
  
  // request: The standard Web Request object
  request.method    // "GET", "POST", etc.
  request.url       // Full URL
  request.headers   // Headers object
  request.body      // ReadableStream | null
}
```

**That's all.** No route params (routing hasn't happened). No context (not built yet). Just the raw request.

### What It Returns

Either `void` or `Record<string, unknown>` (or Promise of either):

```typescript
// No locals
onRequest: ({ request }) => {
  console.log(`${request.method} ${request.url}`);
  // Returns void implicitly
}

// Add locals
onRequest: ({ request }) => {
  return {
    requestId: crypto.randomUUID(),
    timestamp: Date.now()
  };
}

// Async
onRequest: async ({ request }) => {
  const session = await getSession(request);
  return { session };
}
```

**These locals merge into every handler's context:**

```typescript
route.get("/test", {
  resolve: (c) => {
    c.locals.requestId // Available!
    c.locals.timestamp // Available!
    c.locals.session   // Available!
  }
})
```

### What It Cannot Do

- **Cannot deny requests** - no way to return Response
- **Cannot short-circuit** - always runs fully
- **Cannot access route params** - routing hasn't happened yet

If you need to deny requests, use a **guard** instead:

```typescript
// ❌ Wrong: trying to deny in onRequest
onRequest: ({ request }) => {
  if (!request.headers.get("x-api-key")) {
    // Can't return Response here
  }
}

// ✓ Right: deny in a guard
const requireApiKey: GuardFn = (c) => {
  if (!c.request.headers.get("x-api-key")) {
    return {
      deny: Response.json({ error: "Missing API key" }, { status: 401 })
    };
  }
  return { allow: true };
};
```

### Common Patterns

**Request ID tracking:**

```typescript
onRequest: ({ request }) => {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  return { requestId };
}
```

**Request logging:**

```typescript
onRequest: ({ request }) => {
  const start = performance.now();
  console.log(`→ ${request.method} ${request.url}`);
  return { start };
}
```

**Session loading:**

```typescript
onRequest: async ({ request }) => {
  const sessionId = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];
  if (!sessionId) return {};
  
  const session = await loadSession(sessionId);
  return { session };
}
```

**Environment injection:**

```typescript
// Cloudflare Workers
export default {
  fetch: (request, env, ctx) => {
    return setup({
      onRequest: () => ({ env, ctx }),
      handlers: [...]
    }).fetch(request);
  }
};
```

## onResponse: After Handler

`onResponse` runs **after the handler succeeds**. It receives the context and response, returns a (possibly modified) response.

### When It Runs

```
1. Request arrives
2. onRequest runs
3. Route matching
4. Guards run
5. Handler runs
6. onResponse runs ← YOU ARE HERE
7. Response sent
```

It runs **once per request**, after handler returns successfully.

### What It Receives

```typescript
onResponse: (info) => {
  const { context, response } = info;
  
  // context: Full request context from the handler
  context.request  // Original Request
  context.locals   // All accumulated locals
  context.raw      // Raw params, query, body
  context.input    // Validation results
  
  // response: The Response from the handler
  response.status  // Status code
  response.headers // Headers
  response.body    // Body stream
}
```

**Full context.** Everything the handler had access to.

### What It Returns

A `Response` (or Promise of Response):

```typescript
// Return the response unmodified
onResponse: ({ response }) => response

// Add headers
onResponse: ({ context, response }) => {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", context.locals.requestId);
  
  return new Response(response.body, {
    status: response.status,
    headers
  });
}

// Async processing
onResponse: async ({ context, response }) => {
  await logResponse(context, response);
  return response;
}
```

### What It Cannot Do

**Cannot run if handler throws:**

```typescript
route.get("/fail", {
  resolve: () => {
    throw new Error("Something broke");
  }
})

// onResponse DOES NOT RUN
// Error goes to onError instead
```

If the handler throws, `onResponse` is skipped and `onError` runs.

**Cannot run if guard denies:**

```typescript
route.get("/protected", {
  guards: [(c) => ({ deny: new Response("No", { status: 403 }) })],
  resolve: () => new Response("Yes")
})

// onResponse DOES NOT RUN
// Guard denial is returned directly
```

`onResponse` only runs when **handler succeeds**.

### Common Patterns

**Add response headers:**

```typescript
onResponse: ({ context, response }) => {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", context.locals.requestId);
  headers.set("x-response-time", `${Date.now() - context.locals.start}ms`);
  
  return new Response(response.body, {
    status: response.status,
    headers
  });
}
```

**CORS headers:**

```typescript
onResponse: ({ response }) => {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, PUT, DELETE");
  
  return new Response(response.body, {
    status: response.status,
    headers
  });
}
```

**Response logging:**

```typescript
onResponse: ({ context, response }) => {
  const duration = Date.now() - context.locals.start;
  console.log(`← ${context.request.method} ${context.request.url} ${response.status} (${duration}ms)`);
  return response;
}
```

**Content transformation:**

```typescript
onResponse: async ({ response }) => {
  if (response.headers.get("content-type")?.includes("application/json")) {
    const data = await response.json();
    const wrapped = { success: true, data };
    return Response.json(wrapped, { status: response.status });
  }
  return response;
}
```

## onError: When Handler Throws

`onError` runs **when a handler throws an exception**. It receives the error and context, returns an error response.

### When It Runs

```
1. Request arrives
2. onRequest runs
3. Route matching
4. Guards run (one throws)
5. Handler runs (or throws)
6. onError runs ← YOU ARE HERE
7. Error response sent
```

It runs **only when something throws**. Not for explicit error responses.

### What It Receives

```typescript
onError: (info) => {
  const { error, context } = info;
  
  // error: The thrown value (unknown type)
  error // Could be Error, string, object, anything
  
  // context: Minimal context (may be incomplete)
  context.request  // Always available
  context.locals   // May be partial
  context.raw      // May be missing
  context.input    // May be missing
}
```

**The error is `unknown`**, could be anything. The context **may be incomplete** if error happened early.

### What It Returns

A `Response` (or Promise of Response):

```typescript
// Simple error response
onError: ({ error }) => {
  console.error("Unexpected error:", error);
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}

// Typed error handling
onError: ({ error, context }) => {
  if (error instanceof ValidationError) {
    return Response.json(
      { error: error.message, issues: error.issues },
      { status: 400 }
    );
  }
  
  if (error instanceof AuthError) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  // Unknown error
  console.error("Unexpected error:", error);
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}

// With context
onError: ({ error, context }) => {
  console.error("Error:", {
    error,
    method: context.request.method,
    url: context.request.url,
    userId: context.locals.userId
  });
  
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}
```

### What Throws Are Caught

**Handlers:**

```typescript
route.get("/test", {
  resolve: () => {
    throw new Error("Handler error"); // → onError
  }
})
```

**Guards:**

```typescript
route.get("/test", {
  guards: [(c) => {
    throw new Error("Guard error"); // → onError
  }],
  resolve: () => new Response("OK")
})
```

**Async errors:**

```typescript
route.get("/test", {
  resolve: async () => {
    await fetch("https://broken.com"); // Throws → onError
  }
})
```

### What Doesn't Throw

**Explicit Response returns:**

```typescript
route.get("/test", {
  resolve: () => {
    // This is NOT an error, onError doesn't run
    return Response.json({ error: "Not found" }, { status: 404 });
  }
})
```

**Guard denials:**

```typescript
route.get("/test", {
  guards: [(c) => ({
    // This is NOT an error, onError doesn't run
    deny: Response.json({ error: "Forbidden" }, { status: 403 })
  })],
  resolve: () => new Response("OK")
})
```

`onError` only catches **exceptions**, not explicit error responses.

### Common Patterns

**Centralized error logging:**

```typescript
onError: ({ error, context }) => {
  // Log to monitoring service
  await logError({
    error,
    method: context.request.method,
    url: context.request.url,
    userId: context.locals.userId,
    timestamp: Date.now()
  });
  
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}
```

**Custom error types:**

```typescript
class AppError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

onError: ({ error }) => {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message },
      { status: error.status }
    );
  }
  
  console.error("Unexpected error:", error);
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}
```

**Development vs production:**

```typescript
onError: ({ error }) => {
  const isDev = Deno.env.get("ENV") === "development";
  
  if (isDev) {
    // Expose full error in dev
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
  
  // Hide details in production
  console.error("Production error:", error);
  return Response.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}
```

## Parameter Styles: Two Ways to Write Hooks

All hooks receive a single `info` object. You can use it two ways:

### Destructured (Concise)

Most examples use destructuring for brevity:

```typescript
onRequest: ({ request }) => {
  return { requestId: crypto.randomUUID() };
}

onResponse: ({ context, response }) => {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", context.locals.requestId);
  return new Response(response.body, { status: response.status, headers });
}

onError: ({ error, context }) => {
  console.error("Error:", error);
  return Response.json({ error: "Internal Error" }, { status: 500 });
}
```

**When to use:** You want concise code and only need specific properties.

### Named Parameter (Explicit)

You can also use the named parameter directly:

```typescript
onRequest: (info) => {
  const { request } = info;
  console.log("Processing request:", request.url);
  return { requestId: crypto.randomUUID() };
}

onResponse: (info) => {
  const { context, response } = info;
  console.log(`Response ${response.status} for ${context.request.url}`);
  return response;
}

onError: (info) => {
  const { error, context } = info;
  console.error(`Error processing ${context.request.url}:`, error);
  return Response.json({ error: "Internal Error" }, { status: 500 });
}
```

**When to use:** You want explicit parameter names or need autocomplete to discover what's available.

### Partial Destructuring

Only destructure what you need:

```typescript
// Only need response
onResponse: ({ response }) => {
  const headers = new Headers(response.headers);
  headers.set("x-powered-by", "hectoday");
  return new Response(response.body, { status: response.status, headers });
}

// Only need error
onError: ({ error }) => {
  console.error(error);
  return Response.json({ error: "Internal Error" }, { status: 500 });
}
```

**Both styles work identically.** Choose what feels clearest for your code.

## Hook Execution Order

Hooks run in a specific order:

### Happy Path (No Errors)

```
Request
  ↓
onRequest
  ↓
Route Matching
  ↓
Guards
  ↓
Handler
  ↓
onResponse ← Always runs if handler succeeds
  ↓
Response
```

### Error Path (Handler Throws)

```
Request
  ↓
onRequest
  ↓
Route Matching
  ↓
Guards
  ↓
Handler (throws)
  ↓
onError ← Runs instead of onResponse
  ↓
Error Response
```

### Guard Denial Path

```
Request
  ↓
onRequest
  ↓
Route Matching
  ↓
Guards (deny)
  ↓
Response ← Guard response returned directly, no onResponse
```

**Key rule:** `onResponse` and `onError` are mutually exclusive. One or the other, never both.

## Hooks Are Optional

All three hooks are optional:

```typescript
// No hooks at all
setup({
  handlers: [...]
});

// Just onRequest
setup({
  handlers: [...],
  onRequest: ({ request }) => ({ requestId: crypto.randomUUID() })
});

// Just onError (use default for others)
setup({
  handlers: [...],
  onError: ({ error }) => {
    console.error(error);
    return Response.json({ error: "Internal Error" }, { status: 500 });
  }
});

// All three
setup({
  handlers: [...],
  onRequest: ({ request }) => ({ requestId: crypto.randomUUID() }),
  onResponse: ({ context, response }) => addHeaders(context, response),
  onError: ({ error, context }) => handleError(error, context)
});
```

If you don't provide a hook, default behavior applies:
- `onRequest`: No locals added
- `onResponse`: Response returned unmodified
- `onError`: Logs error, returns 500

## Hooks vs Guards vs Handlers

**When to use each:**

### Use onRequest for:
- Request ID generation
- Session loading
- Request logging
- Environment setup
- Anything **every request** needs before routing

### Use Guards for:
- Authentication checks
- Authorization decisions
- Request validation that can deny
- Anything that decides if a **specific route** should run

### Use onResponse for:
- Adding response headers
- Response logging
- Response transformation
- Anything that modifies **successful responses**

### Use onError for:
- Centralized error logging
- Error response formatting
- Development vs production error handling
- Anything that handles **unexpected exceptions**

### Use Handlers for:
- Business logic
- Explicit error responses (not throws)
- Anything that's **route-specific logic**

## Why Three Hooks, Not Middleware Chains?

Middleware chains are implicit and unpredictable:

```typescript
// Middleware: What order? What runs when?
app.use(logger);
app.use(auth);
app.use(cors);
app.get("/test", handler);
// Which middleware can short-circuit?
// Which run on success vs error?
// How do they compose?
```

Hooks are explicit and predictable:

```typescript
setup({
  onRequest: logger,        // Always runs first
  handlers: [               // Then routing
    route.get("/test", {
      guards: [auth],        // Then guards
      resolve: handler       // Then handler
    })
  ],
  onResponse: cors,          // Then onResponse (if success)
  onError: errorHandler      // Or onError (if throw)
});
```

**Every step is visible. Every path is clear. No magic.**

## Summary

Three hooks:

1. **onRequest** - Before routing, add locals
2. **onResponse** - After handler, modify response
3. **onError** - When throw, return error response

Three rules:

1. Hooks are optional
2. onResponse XOR onError (never both)
3. Everything is explicit

Three questions:

1. Does every request need it? → `onRequest`
2. Does every response need it? → `onResponse`
3. Does every error need it? → `onError`

---

Next: [Errors are responses](./errors-are-responses) - how to handle errors explicitly without throwing.
