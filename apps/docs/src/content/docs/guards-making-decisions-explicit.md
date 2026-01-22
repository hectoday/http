---
title: "Guards: Making Decisions Explicit"
description: "Using guards to control request flow explicitly"
order: 5
part: 2
draft: false
---

You've extracted facts. You've validated data. Now comes the critical question: **should this request be allowed to continue?**

Guards answer this question. They are the **only** place besides handlers where requests can end.

## What Is a Guard?

A guard is a function that makes an allow/deny decision:

```typescript
type GuardFn = (c: Context) => GuardResult | Promise<GuardResult>;

type GuardResult =
  | { allow: true; locals?: object }
  | { deny: Response };
```

That's it. A guard receives context, returns a decision.

### A Decision Boundary

Guards are **decision boundaries**—places where the request might end:

```typescript
const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    // REQUEST ENDS HERE
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  const user = verifyToken(token);
  
  if (!user) {
    // REQUEST ENDS HERE
    return { deny: Response.json({ error: "Invalid token" }, { status: 401 }) };
  }
  
  // Request continues, user data attached
  return { allow: true, locals: { user } };
};
```

If a guard returns `{ deny: Response }`, the request ends immediately. The handler never runs. The response is sent.

If a guard returns `{ allow: true }`, the request continues to the next guard (if any) or to the handler.

### The Moment Intent Becomes Outcome

Before the guard runs, the request is in limbo—it **might** be allowed:

```typescript
route.get("/admin", {
  guards: [requireAuth, requireAdmin],
  resolve: (c) => {
    // If we're here, both guards allowed
    return Response.json({ data: "secret" });
  }
})
```

The guards convert **intent** (headers, tokens, data) into **outcome** (allowed or denied).

```
Intent (headers, body, etc.)
    ↓
Guards evaluate
    ↓
Outcome (allow or deny)
```

This is different from validation:
- **Validation** asks: "Is this data well-formed?"
- **Guards** ask: "Should this request proceed?"

### Using Guards

Attach guards to routes:

```typescript
route.get("/profile", {
  guards: [requireAuth],
  resolve: (c) => {
    // Only runs if requireAuth allowed
    const user = c.locals.user;
    return Response.json({ user });
  }
})
```

Multiple guards run in order:

```typescript
route.delete("/users/:id", {
  guards: [requireAuth, requireAdmin, requireNotSelf],
  resolve: (c) => {
    // Only runs if all three guards allowed
    const id = c.raw.params.id;
    // Delete user...
    return new Response(null, { status: 204 });
  }
})
```

First denial wins. If any guard denies, the request ends.

## Allow vs Deny

Guards have exactly two outcomes. No exceptions, no implicit behavior.

### Allow

When a guard allows, it returns `{ allow: true }`:

```typescript
const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  const user = verifyToken(token);
  
  if (!user) {
    return { deny: Response.json({ error: "Invalid token" }, { status: 401 }) };
  }
  
  return { allow: true };
};
```

**The request continues.** The next guard runs, or if this was the last guard, the handler runs.

### Allow with Locals

Guards can attach data to the request:

```typescript
const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  const user = verifyToken(token);
  
  if (!user) {
    return { deny: Response.json({ error: "Invalid token" }, { status: 401 }) };
  }
  
  // Attach user to locals
  return { allow: true, locals: { user } };
};
```

The `locals` object is merged into `c.locals` for subsequent guards and the handler:

```typescript
route.get("/profile", {
  guards: [requireAuth],
  resolve: (c) => {
    // user was attached by requireAuth
    const user = c.locals.user;
    return Response.json({ user });
  }
})
```

This is how guards pass data forward without mutation:

```
Guard 1: { allow: true, locals: { user } }
    ↓
Guard 2 sees: c.locals = { user }
Guard 2: { allow: true, locals: { role: "admin" } }
    ↓
Handler sees: c.locals = { user, role: "admin" }
```

Each guard adds to locals. Nothing is mutated. Data only flows forward.

### Deny

When a guard denies, it returns `{ deny: Response }`:

```typescript
const requireAdmin: GuardFn = (c) => {
  const user = c.locals.user;
  
  if (!user || user.role !== "admin") {
    // REQUEST ENDS HERE
    return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  
  return { allow: true };
};
```

**The request ends immediately.** No subsequent guards run. The handler never runs. The `Response` is sent to the client.

The guard controls the exact response:

```typescript
const requireValidApiKey: GuardFn = (c) => {
  const apiKey = c.request.headers.get("x-api-key");
  
  if (!apiKey) {
    return {
      deny: Response.json(
        { error: "Missing API key", docs: "https://example.com/docs/auth" },
        { status: 401 }
      )
    };
  }
  
  if (!isValidApiKey(apiKey)) {
    return {
      deny: Response.json(
        { error: "Invalid API key" },
        { status: 401 }
      )
    };
  }
  
  return { allow: true, locals: { apiKeyId: apiKey.slice(0, 8) } };
};
```

You decide the status code, the body, the headers. Guards are explicit.

### Why There Is No "Throw"

Some frameworks let you throw to deny:

```typescript
// In other frameworks
function requireAuth(c) {
  const token = c.headers.get("authorization");
  
  if (!token) {
    throw new UnauthorizedError(); // Implicitly becomes 401
  }
  
  // Request continues?
}
```

**This hides control flow.** You can't tell from reading the code:
- What response is sent
- What status code is used
- Whether the request ends here

Hectoday HTTP makes it explicit:

```typescript
const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    // Explicit: request ends, 401 sent, this exact response
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  return { allow: true };
};
```

You see:
- Request ends here (return statement)
- Status is 401
- Body is `{ error: "Unauthorized" }`

**No magic. No hidden mappings. Just explicit returns.**

### Why Guards Must Be Explicit

Implicit guards create confusion:

```typescript
// In other frameworks
app.use(authMiddleware);
app.use(loggingMiddleware);
app.use(rateLimitMiddleware);

app.get("/users", handler);

// Which middleware runs?
// Which can deny the request?
// In what order?
// What responses do they return?
```

Hectoday HTTP guards are explicit:

```typescript
route.get("/users", {
  guards: [requireAuth, requireRateLimit],
  resolve: (c) => {
    // We know: auth checked, rate limit checked
    // We know: both allowed (or we wouldn't be here)
    return Response.json({ users: [] });
  }
})
```

Reading the route definition tells you:
1. What guards run
2. In what order
3. What must pass for the handler to run

**The code is the documentation.**

## Guard Ordering

Guards run in the order you specify. This order is **part of your API design**.

### Order Matters

```typescript
route.get("/admin/users", {
  guards: [requireAuth, requireAdmin],
  resolve: (c) => {
    return Response.json({ users: [] });
  }
})
```

This means:
1. Check authentication first
2. If auth passes, check admin role
3. If both pass, run handler

**Don't do this**:

```typescript
route.get("/admin/users", {
  guards: [requireAdmin, requireAuth], // Wrong order!
  resolve: (c) => {
    return Response.json({ users: [] });
  }
})
```

If `requireAdmin` checks `c.locals.user` but `requireAuth` hasn't run yet, `user` won't exist. The guard will fail incorrectly.

### Dependencies Between Guards

Guards can depend on previous guards' locals:

```typescript
const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  if (!token) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  const user = verifyToken(token);
  if (!user) {
    return { deny: Response.json({ error: "Invalid token" }, { status: 401 }) };
  }
  
  // Provides user
  return { allow: true, locals: { user } };
};

const requireAdmin: GuardFn = (c) => {
  // Depends on user from requireAuth
  const user = c.locals.user;
  
  if (!user || user.role !== "admin") {
    return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  
  return { allow: true };
};

const requireNotSelf: GuardFn = (c) => {
  // Depends on user from requireAuth
  const user = c.locals.user;
  const targetId = c.raw.params.id;
  
  if (user.id === targetId) {
    return { deny: Response.json({ error: "Cannot modify yourself" }, { status: 400 }) };
  }
  
  return { allow: true };
};

// Correct order: requireAuth must be first
route.delete("/users/:id", {
  guards: [requireAuth, requireAdmin, requireNotSelf],
  resolve: (c) => {
    // All checks passed
    return new Response(null, { status: 204 });
  }
})
```

**The order is explicit.** You can trace the data flow by reading the guard array.

### Short-Circuiting

The first guard to deny ends the request:

```typescript
route.get("/admin", {
  guards: [requireAuth, requireAdmin, requireEmailVerified],
  resolve: (c) => {
    return Response.json({ data: "secret" });
  }
})

// Request with no token
// → requireAuth denies with 401
// → requireAdmin never runs
// → requireEmailVerified never runs
// → handler never runs

// Request with valid token, but not admin
// → requireAuth allows
// → requireAdmin denies with 403
// → requireEmailVerified never runs
// → handler never runs

// Request with valid admin token, but unverified email
// → requireAuth allows
// → requireAdmin allows
// → requireEmailVerified denies with 403
// → handler never runs

// Request with valid admin token and verified email
// → requireAuth allows
// → requireAdmin allows
// → requireEmailVerified allows
// → handler runs
```

This is **sequential evaluation**. Not parallel, not all-at-once. One by one, in order.

### Why Order Is Part of Your API Design

The order affects:

**Performance**: Check cheap conditions first:

```typescript
route.get("/expensive", {
  guards: [
    checkRateLimit,     // Fast: just a counter check
    requireAuth,        // Medium: token verification
    requirePremium,     // Medium: database lookup
    checkResourceExists // Slow: database query
  ],
  resolve: (c) => {
    return Response.json({ data: "..." });
  }
})
```

If rate limit is exceeded, you never hit the database.

**Security**: Check authentication before authorization:

```typescript
route.get("/admin", {
  guards: [
    requireAuth,   // First: who are you?
    requireAdmin   // Second: are you allowed?
  ],
  resolve: (c) => {
    return Response.json({ data: "secret" });
  }
})
```

Never check permissions before identity. You need to know **who** before checking **what they can do**.

**Error messages**: Fail fast with specific errors:

```typescript
route.post("/transfer", {
  guards: [
    requireAuth,           // 401 if not authenticated
    requireValidTransfer,  // 400 if invalid transfer data
    requireSufficientFunds // 402 if insufficient funds
  ],
  resolve: (c) => {
    // Execute transfer
    return Response.json({ success: true });
  }
})
```

The client gets the **first** error they encounter. Order determines which error they see.

### Reusable Guards

Guards are just functions. Share them:

```typescript
// guards.ts
export const requireAuth: GuardFn = (c) => {
  // ...
};

export const requireAdmin: GuardFn = (c) => {
  // ...
};

export const requireEmailVerified: GuardFn = (c) => {
  // ...
};

// routes.ts
import { requireAuth, requireAdmin } from "./guards.ts";

route.get("/admin/users", {
  guards: [requireAuth, requireAdmin],
  resolve: (c) => {
    return Response.json({ users: [] });
  }
})

route.delete("/admin/users/:id", {
  guards: [requireAuth, requireAdmin],
  resolve: (c) => {
    return new Response(null, { status: 204 });
  }
})
```

Same guards, different routes. **Composition without hidden behavior.**

### Parameterized Guards

Guards can be factories:

```typescript
const requireRole = (role: string): GuardFn => {
  return (c) => {
    const user = c.locals.user;
    
    if (!user || user.role !== role) {
      return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
    }
    
    return { allow: true };
  };
};

// Use it
route.get("/admin", {
  guards: [requireAuth, requireRole("admin")],
  resolve: (c) => {
    return Response.json({ data: "secret" });
  }
})

route.get("/moderator", {
  guards: [requireAuth, requireRole("moderator")],
  resolve: (c) => {
    return Response.json({ data: "mod panel" });
  }
})
```

**Still explicit.** The factory creates a guard, you see it in the array.

### Guard Composition with `group()`

Apply guards to multiple routes at once:

```typescript
import { group } from "@hectoday/http";

const adminRoutes = group({
  guards: [requireAuth, requireAdmin],
  handlers: [
    route.get("/admin/users", {
      resolve: (c) => Response.json({ users: [] })
    }),
    route.delete("/admin/users/:id", {
      resolve: (c) => new Response(null, { status: 204 })
    }),
    route.post("/admin/settings", {
      resolve: (c) => Response.json({ updated: true })
    })
  ]
});

const app = setup({
  handlers: [...adminRoutes]
});
```

All routes in the group get the guards. **Still explicit—the group definition shows the guards.**

Routes can add their own guards:

```typescript
const adminRoutes = group({
  guards: [requireAuth, requireAdmin],
  handlers: [
    route.get("/admin/users", {
      resolve: (c) => Response.json({ users: [] })
    }),
    route.delete("/admin/users/:id", {
      guards: [requireNotSelf], // Additional guard
      resolve: (c) => new Response(null, { status: 204 })
    })
  ]
});

// For the DELETE route, guards run in order:
// 1. requireAuth (from group)
// 2. requireAdmin (from group)
// 3. requireNotSelf (from route)
```

**Layering, not hiding.** You see exactly what guards apply.

---

Next: [The Request Lifecycle (Fully Explicit)](./the-request-lifecycle-fully-explicit) — putting all the pieces together.
