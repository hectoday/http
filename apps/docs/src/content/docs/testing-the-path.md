---
title: "Testing the Path"
description: "Writing tests for explicit, predictable request handling"
order: 14
draft: true
---

When everything is explicit, testing becomes straightforward.

You don't mock the framework. You don't stub internal state. You just call functions and check outputs.

## Testing Facts

Facts are data extracted from requests. Test them by creating requests and checking what gets extracted.

### Testing Route Matching

```typescript
import { assertEquals } from "@std/assert";
import { route, setup } from "@hectoday/http";

Deno.test("route matches path parameter", async () => {
  const app = setup({
    handlers: [
      route.get("/users/:id", {
        resolve: (c) => {
          return Response.json({ id: c.raw.params.id });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/users/123");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { id: "123" });
});

Deno.test("route returns 404 for non-matching path", async () => {
  const app = setup({
    handlers: [
      route.get("/users/:id", {
        resolve: () => new Response("ok")
      })
    ]
  });
  
  const request = new Request("http://localhost/posts/123");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 404);
});
```

**No mocking.** Just create a Request, call `app.fetch()`, check the Response.

### Testing Query Parameters

```typescript
Deno.test("extracts query parameters", async () => {
  const app = setup({
    handlers: [
      route.get("/search", {
        resolve: (c) => {
          return Response.json({
            query: c.raw.query.q,
            page: c.raw.query.page
          });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/search?q=test&page=2");
  const response = await app.fetch(request);
  
  assertEquals(await response.json(), {
    query: "test",
    page: "2"
  });
});

Deno.test("handles missing query parameters", async () => {
  const app = setup({
    handlers: [
      route.get("/search", {
        resolve: (c) => {
          return Response.json({
            query: c.raw.query.q || null
          });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/search");
  const response = await app.fetch(request);
  
  assertEquals(await response.json(), { query: null });
});

Deno.test("handles array query parameters", async () => {
  const app = setup({
    handlers: [
      route.get("/filter", {
        resolve: (c) => {
          const tags = c.raw.query.tag;
          const normalized = tags === undefined
            ? []
            : Array.isArray(tags)
            ? tags
            : [tags];
          
          return Response.json({ tags: normalized });
        }
      })
    ]
  });
  
  // Single value
  const req1 = new Request("http://localhost/filter?tag=js");
  const res1 = await app.fetch(req1);
  assertEquals(await res1.json(), { tags: ["js"] });
  
  // Multiple values
  const req2 = new Request("http://localhost/filter?tag=js&tag=ts");
  const res2 = await app.fetch(req2);
  assertEquals(await res2.json(), { tags: ["js", "ts"] });
  
  // No values
  const req3 = new Request("http://localhost/filter");
  const res3 = await app.fetch(req3);
  assertEquals(await res3.json(), { tags: [] });
});
```

**Testing edge cases is easy** because you control the Request.

### Testing Validation

```typescript
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

Deno.test("validation passes with valid input", async () => {
  const app = setup({
    validator: zodValidator,
    handlers: [
      route.post("/users", {
        request: { body: userSchema },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json({ error: c.input.issues }, { status: 400 });
          }
          
          return Response.json(c.input.body, { status: 201 });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Alice",
      email: "alice@example.com"
    })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 201);
  assertEquals(await response.json(), {
    name: "Alice",
    email: "alice@example.com"
  });
});

Deno.test("validation fails with invalid input", async () => {
  const app = setup({
    validator: zodValidator,
    handlers: [
      route.post("/users", {
        request: { body: userSchema },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json({ error: c.input.issues }, { status: 400 });
          }
          
          return Response.json(c.input.body, { status: 201 });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "",
      email: "not-an-email"
    })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 400);
  
  const body = await response.json();
  assertEquals(body.error.length, 2); // Two validation errors
});

Deno.test("validation fails with invalid JSON", async () => {
  const app = setup({
    validator: zodValidator,
    handlers: [
      route.post("/users", {
        request: { body: userSchema },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json({ error: c.input.issues }, { status: 400 });
          }
          
          return Response.json(c.input.body, { status: 201 });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not valid json"
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 400);
  
  const body = await response.json();
  // Should have "Invalid JSON" issue
  assertEquals(
    body.error.some((issue: any) => issue.message === "Invalid JSON"),
    true
  );
});
```

**Validation is deterministic.** Same input always produces same output.

## Testing Guards

Guards are pure functions: `Context → GuardResult`. Test them in isolation or integration.

### Testing Guards in Isolation

```typescript
import type { Context, GuardFn } from "@hectoday/http";

const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  if (token !== "Bearer valid-token") {
    return { deny: Response.json({ error: "Invalid token" }, { status: 401 }) };
  }
  
  return { allow: true, locals: { userId: "user-123" } };
};

Deno.test("requireAuth denies when no token", async () => {
  const context: Context = {
    request: new Request("http://localhost/test"),
    raw: { params: {}, query: {}, body: undefined },
    input: { ok: true, params: {}, query: {}, body: undefined },
    locals: {}
  };
  
  const result = requireAuth(context);
  
  assertEquals(result.deny !== undefined, true);
  
  if (result.deny) {
    assertEquals(result.deny.status, 401);
    assertEquals(await result.deny.json(), { error: "Unauthorized" });
  }
});

Deno.test("requireAuth denies with invalid token", async () => {
  const context: Context = {
    request: new Request("http://localhost/test", {
      headers: { "Authorization": "Bearer wrong-token" }
    }),
    raw: { params: {}, query: {}, body: undefined },
    input: { ok: true, params: {}, query: {}, body: undefined },
    locals: {}
  };
  
  const result = requireAuth(context);
  
  assertEquals(result.deny !== undefined, true);
  
  if (result.deny) {
    assertEquals(result.deny.status, 401);
    assertEquals(await result.deny.json(), { error: "Invalid token" });
  }
});

Deno.test("requireAuth allows with valid token", () => {
  const context: Context = {
    request: new Request("http://localhost/test", {
      headers: { "Authorization": "Bearer valid-token" }
    }),
    raw: { params: {}, query: {}, body: undefined },
    input: { ok: true, params: {}, query: {}, body: undefined },
    locals: {}
  };
  
  const result = requireAuth(context);
  
  assertEquals(result.allow, true);
  assertEquals(result.locals?.userId, "user-123");
});
```

**Guards are just functions.** Create a Context object, call the guard, check the result.

### Testing Guards in Integration

```typescript
Deno.test("protected route requires authentication", async () => {
  const app = setup({
    handlers: [
      route.get("/protected", {
        guards: [requireAuth],
        resolve: (c) => {
          return Response.json({ userId: c.locals.userId });
        }
      })
    ]
  });
  
  // Without token
  const req1 = new Request("http://localhost/protected");
  const res1 = await app.fetch(req1);
  
  assertEquals(res1.status, 401);
  assertEquals(await res1.json(), { error: "Unauthorized" });
  
  // With valid token
  const req2 = new Request("http://localhost/protected", {
    headers: { "Authorization": "Bearer valid-token" }
  });
  const res2 = await app.fetch(req2);
  
  assertEquals(res2.status, 200);
  assertEquals(await res2.json(), { userId: "user-123" });
});

Deno.test("multiple guards run in order", async () => {
  const requireAdmin: GuardFn = (c) => {
    const userId = c.locals.userId;
    
    if (userId !== "admin-123") {
      return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
    }
    
    return { allow: true };
  };
  
  const app = setup({
    handlers: [
      route.get("/admin", {
        guards: [requireAuth, requireAdmin],
        resolve: () => Response.json({ data: "secret" })
      })
    ]
  });
  
  // No token - requireAuth denies
  const req1 = new Request("http://localhost/admin");
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 401);
  
  // Valid token but not admin - requireAdmin denies
  const req2 = new Request("http://localhost/admin", {
    headers: { "Authorization": "Bearer valid-token" }
  });
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 403);
  
  // Valid admin token - both allow
  // (Would need to modify requireAuth to check for admin token)
});
```

**Integration tests verify the complete flow** from request to response.

### Testing Guard Composition

```typescript
import { group } from "@hectoday/http";

Deno.test("group applies guards to all routes", async () => {
  const adminRoutes = group({
    guards: [requireAuth],
    handlers: [
      route.get("/admin/users", {
        resolve: () => Response.json({ users: [] })
      }),
      route.get("/admin/settings", {
        resolve: () => Response.json({ settings: {} })
      })
    ]
  });
  
  const app = setup({ handlers: adminRoutes });
  
  // Both routes require auth
  const req1 = new Request("http://localhost/admin/users");
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 401);
  
  const req2 = new Request("http://localhost/admin/settings");
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 401);
  
  // With auth, both work
  const req3 = new Request("http://localhost/admin/users", {
    headers: { "Authorization": "Bearer valid-token" }
  });
  const res3 = await app.fetch(req3);
  assertEquals(res3.status, 200);
});
```

**Groups are composable.** Test the composed result.

## Testing Responses

Responses are the output of handlers. Test them by calling handlers and checking what they return.

### Testing Success Responses

```typescript
Deno.test("GET /users returns user list", async () => {
  const app = setup({
    handlers: [
      route.get("/users", {
        resolve: async () => {
          // Mock database for testing
          const users = [
            { id: "1", name: "Alice" },
            { id: "2", name: "Bob" }
          ];
          
          return Response.json(users);
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/users");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "application/json");
  
  const body = await response.json();
  assertEquals(body.length, 2);
  assertEquals(body[0].name, "Alice");
});

Deno.test("POST /users creates user", async () => {
  const app = setup({
    handlers: [
      route.post("/users", {
        resolve: async (c) => {
          const body = await c.request.json();
          
          // Mock database insert
          const user = {
            id: "123",
            ...body,
            createdAt: new Date().toISOString()
          };
          
          return Response.json(user, { status: 201 });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Charlie", email: "charlie@example.com" })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 201);
  
  const body = await response.json();
  assertEquals(body.name, "Charlie");
  assertEquals(body.email, "charlie@example.com");
  assertExists(body.id);
  assertExists(body.createdAt);
});
```

**Test the happy path first.** Verify successful operations work correctly.

### Testing Error Responses

```typescript
Deno.test("GET /users/:id returns 404 for missing user", async () => {
  const app = setup({
    handlers: [
      route.get("/users/:id", {
        resolve: async (c) => {
          const id = c.raw.params.id;
          
          // Mock database lookup
          const user = null; // User not found
          
          if (!user) {
            return Response.json(
              { error: "User not found" },
              { status: 404 }
            );
          }
          
          return Response.json(user);
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/users/999");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 404);
  assertEquals(await response.json(), { error: "User not found" });
});

Deno.test("POST /users returns 400 with invalid data", async () => {
  const app = setup({
    validator: zodValidator,
    handlers: [
      route.post("/users", {
        request: {
          body: z.object({
            name: z.string().min(1),
            email: z.string().email()
          })
        },
        resolve: (c) => {
          if (!c.input.ok) {
            return Response.json(
              { error: c.input.issues },
              { status: 400 }
            );
          }
          
          return Response.json(c.input.body, { status: 201 });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "", email: "invalid" })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 400);
  
  const body = await response.json();
  assertExists(body.error);
  assertEquals(Array.isArray(body.error), true);
});
```

**Test error paths too.** Verify failures are handled correctly.

### Testing Headers

```typescript
Deno.test("response includes security headers", async () => {
  const app = setup({
    handlers: [
      route.get("/", {
        resolve: () => {
          return new Response("Hello", {
            headers: {
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "DENY"
            }
          });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/");
  const response = await app.fetch(request);
  
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
  assertEquals(response.headers.get("x-frame-options"), "DENY");
});

Deno.test("response includes cache headers", async () => {
  const app = setup({
    handlers: [
      route.get("/static/logo.png", {
        resolve: () => {
          return new Response(new Uint8Array(), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=31536000"
            }
          });
        }
      })
    ]
  });
  
  const request = new Request("http://localhost/static/logo.png");
  const response = await app.fetch(request);
  
  assertEquals(response.headers.get("cache-control"), "public, max-age=31536000");
});
```

**Headers are part of the contract.** Test them explicitly.

### Testing Hooks

```typescript
Deno.test("onRequest adds request ID", async () => {
  const app = setup({
    handlers: [
      route.get("/", {
        resolve: (c) => {
          return Response.json({ requestId: c.locals.requestId });
        }
      })
    ],
    onRequest: () => {
      return { requestId: "test-123" };
    }
  });
  
  const request = new Request("http://localhost/");
  const response = await app.fetch(request);
  
  assertEquals(await response.json(), { requestId: "test-123" });
});

Deno.test("onResponse adds custom header", async () => {
  const app = setup({
    handlers: [
      route.get("/", {
        resolve: () => new Response("Hello")
      })
    ],
    onResponse: (c, response) => {
      const headers = new Headers(response.headers);
      headers.set("X-Custom", "value");
      
      return new Response(response.body, {
        status: response.status,
        headers
      });
    }
  });
  
  const request = new Request("http://localhost/");
  const response = await app.fetch(request);
  
  assertEquals(response.headers.get("x-custom"), "value");
});

Deno.test("onError handles exceptions", async () => {
  const app = setup({
    handlers: [
      route.get("/error", {
        resolve: () => {
          throw new Error("Something went wrong");
        }
      })
    ],
    onError: (error) => {
      return Response.json(
        { error: "Internal error" },
        { status: 500 }
      );
    }
  });
  
  const request = new Request("http://localhost/error");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 500);
  assertEquals(await response.json(), { error: "Internal error" });
});
```

**Hooks are testable** because they're just functions.

## Why Tests Become Boring (In a Good Way)

When everything is explicit, tests follow a pattern:

1. Create a Request
2. Call `app.fetch(request)`
3. Check the Response

**That's it.** Every test is the same structure.

### No Magic, No Surprises

```typescript
Deno.test("example test", async () => {
  // 1. Setup
  const app = setup({ handlers: [...] });
  
  // 2. Create request
  const request = new Request("http://localhost/path");
  
  // 3. Get response
  const response = await app.fetch(request);
  
  // 4. Assert
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { expected: "value" });
});
```

**This pattern never changes.** Every test follows it.

### No Mocking Framework Internals

You never mock:
- Route matching
- Validation
- Guard execution
- Context creation

**The framework just works.** You test your code, not the framework.

### Tests Are Documentation

Because tests are explicit, they document behavior:

```typescript
Deno.test("DELETE /users/:id requires authentication and admin role", async () => {
  const app = setup({
    handlers: [
      route.delete("/users/:id", {
        guards: [requireAuth, requireAdmin],
        resolve: () => new Response(null, { status: 204 })
      })
    ]
  });
  
  // Test 1: No auth -> 401
  const req1 = new Request("http://localhost/users/123", { method: "DELETE" });
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 401);
  
  // Test 2: Auth but not admin -> 403
  const req2 = new Request("http://localhost/users/123", {
    method: "DELETE",
    headers: { "Authorization": "Bearer user-token" }
  });
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 403);
  
  // Test 3: Auth + admin -> 204
  const req3 = new Request("http://localhost/users/123", {
    method: "DELETE",
    headers: { "Authorization": "Bearer admin-token" }
  });
  const res3 = await app.fetch(req3);
  assertEquals(res3.status, 204);
});
```

**Reading this test tells you everything** about how the endpoint works.

### Tests Are Fast

No mocking overhead. No framework setup. Just pure functions:

```typescript
// This runs in milliseconds
Deno.test("fast test", async () => {
  const app = setup({
    handlers: [
      route.get("/", {
        resolve: () => new Response("ok")
      })
    ]
  });
  
  const response = await app.fetch(new Request("http://localhost/"));
  assertEquals(response.status, 200);
});
```

**Fast tests mean fast feedback.**

### Tests Are Isolated

Each test creates its own app:

```typescript
Deno.test("test 1", async () => {
  const app = setup({ handlers: [...] });
  // Test with this app
});

Deno.test("test 2", async () => {
  const app = setup({ handlers: [...] });
  // Test with this app
});
```

**No shared state.** Tests don't affect each other.

### Tests Are Predictable

Same input = same output:

```typescript
Deno.test("always returns same result", async () => {
  const app = setup({
    handlers: [
      route.get("/", {
        resolve: () => Response.json({ value: 42 })
      })
    ]
  });
  
  for (let i = 0; i < 100; i++) {
    const response = await app.fetch(new Request("http://localhost/"));
    assertEquals(await response.json(), { value: 42 });
  }
});
```

**No flaky tests.** Deterministic behavior.

### The Boring Test Template

Every test looks like this:

```typescript
Deno.test("description of what's being tested", async () => {
  // Given: setup
  const app = setup({
    handlers: [/* routes */],
    validator: /* if needed */,
    onRequest: /* if needed */,
    onResponse: /* if needed */,
    onError: /* if needed */
  });
  
  // When: create request and get response
  const request = new Request("http://localhost/path", {
    method: "GET",
    headers: {/* if needed */},
    body: /* if needed */
  });
  
  const response = await app.fetch(request);
  
  // Then: assert expectations
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { expected: "value" });
});
```

**Copy, paste, modify.** That's the entire test writing process.

### Why Boring Is Good

Boring tests mean:
- **Predictable** — You know exactly how to write them
- **Maintainable** — Anyone can read and update them
- **Reliable** — They don't break randomly
- **Fast to write** — Follow the template
- **Easy to review** — All tests look the same

**When tests are boring, you spend more time building features and less time fighting tests.**

That's the point.

---

Next: [Reference](./reference) — Complete API documentation for when you need details.
