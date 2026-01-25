---
title: "Composition over configuration"
description: "Building larger APIs from small, reusable pieces"
order: 4
part: 3
draft: false
---

Small APIs are easy. One file, a few routes, done.

Large APIs need structure. But structure doesn't mean configuration files, decorators, or magic conventions.

In Hectoday HTTP, structure comes from **composition**, building larger pieces from smaller ones.

## Building Larger APIs

As your API grows, you need to organize routes, share guards, and reuse validation logic.

### Composing Handlers

Start simple:

```typescript
// routes/users.ts
import { route } from "@hectoday/http";

export const getUsers = route.get("/users", {
  resolve: async () => {
    const users = await db.users.getAll();
    return Response.json(users);
  }
});

export const getUser = route.get("/users/:id", {
  resolve: async (c) => {
    const user = await db.users.get(c.raw.params.id);
    if (!user) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(user);
  }
});

export const createUser = route.post("/users", {
  request: {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const user = await db.users.create(c.input.body);
    return Response.json(user, { status: 201 });
  }
});
```

Collect into an array:

```typescript
// routes/users.ts
export const userRoutes = [
  getUsers,
  getUser,
  createUser
];
```

Compose in main file:

```typescript
// main.ts
import { setup } from "@hectoday/http";
import { userRoutes } from "./routes/users.ts";
import { postRoutes } from "./routes/posts.ts";
import { commentRoutes } from "./routes/comments.ts";

const app = setup({
  handlers: [
    ...userRoutes,
    ...postRoutes,
    ...commentRoutes
  ]
});

Deno.serve(app.fetch);
```

**That's it.** Routes are just arrays. Composition is just spread operators. No magic.

### Grouping with Shared Guards

Use `group()` to apply guards to multiple routes:

```typescript
// routes/admin.ts
import { group, route } from "@hectoday/http";
import { requireAuth, requireAdmin } from "../guards.ts";

const adminUsers = route.get("/admin/users", {
  resolve: async () => {
    const users = await db.users.getAll();
    return Response.json(users);
  }
});

const deleteUser = route.delete("/admin/users/:id", {
  resolve: async (c) => {
    await db.users.delete(c.raw.params.id);
    return new Response(null, { status: 204 });
  }
});

const updateSettings = route.put("/admin/settings", {
  request: {
    body: settingsSchema
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    await db.settings.update(c.input.body);
    return Response.json({ updated: true });
  }
});

// Apply guards to all routes
export const adminRoutes = group({
  guards: [requireAuth, requireAdmin],
  handlers: [
    adminUsers,
    deleteUser,
    updateSettings
  ]
});
```

**What `group()` does**:

```typescript
// Each route in the group gets the guards prepended
adminUsers.guards = [requireAuth, requireAdmin, ...adminUsers.guards]
deleteUser.guards = [requireAuth, requireAdmin, ...deleteUser.guards]
updateSettings.guards = [requireAuth, requireAdmin, ...updateSettings.guards]
```

It's **build-time composition**. No runtime overhead. No hidden behavior.

### Nested Groups

Groups can contain groups:

```typescript
// routes/api.ts
import { group } from "@hectoday/http";
import { requireAuth } from "../guards.ts";
import { adminRoutes } from "./admin.ts";
import { userRoutes } from "./users.ts";

// All authenticated routes
export const apiRoutes = group({
  guards: [requireAuth],
  handlers: [
    ...userRoutes,    // Gets [requireAuth, ...userRoutes.guards]
    ...adminRoutes    // Gets [requireAuth, requireAdmin, ...adminRoutes.guards]
  ]
});
```

**Guard order**: Outer group guards run first, then inner group guards, then route-specific guards.

```typescript
// For a route in adminRoutes:
// 1. requireAuth (from apiRoutes)
// 2. requireAdmin (from adminRoutes)
// 3. Route-specific guards (if any)
```

### Reusing Guards

Guards are just functions. Export and reuse them:

```typescript
// guards/auth.ts
import type { GuardFn } from "@hectoday/http";

export const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  const user = verifyToken(token);
  
  if (!user) {
    return { deny: Response.json({ error: "Invalid token" }, { status: 401 }) };
  }
  
  return { allow: true, locals: { user } };
};

export const requireAdmin: GuardFn = (c) => {
  const user = c.locals.user;
  
  if (!user || user.role !== "admin") {
    return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  
  return { allow: true };
};

export const requireEmailVerified: GuardFn = (c) => {
  const user = c.locals.user;
  
  if (!user?.emailVerified) {
    return { deny: Response.json({ error: "Email not verified" }, { status: 403 }) };
  }
  
  return { allow: true };
};
```

Use across routes:

```typescript
// routes/profile.ts
import { requireAuth, requireEmailVerified } from "../guards/auth.ts";

export const profileRoutes = [
  route.get("/profile", {
    guards: [requireAuth],
    resolve: (c) => Response.json(c.locals.user)
  }),
  
  route.put("/profile", {
    guards: [requireAuth, requireEmailVerified],
    resolve: async (c) => {
      // Update profile
    }
  })
];
```

```typescript
// routes/admin.ts
import { requireAuth, requireAdmin } from "../guards/auth.ts";

export const adminRoutes = group({
  guards: [requireAuth, requireAdmin],
  handlers: [/* admin routes */]
});
```

**Same guards, different contexts.** Pure functions, no magic.

### Parameterized Guards

Create guard factories for flexible reuse:

```typescript
// guards/permissions.ts
import type { GuardFn } from "@hectoday/http";

export const requireRole = (role: string): GuardFn => {
  return (c) => {
    const user = c.locals.user;
    
    if (!user || user.role !== role) {
      return {
        deny: Response.json(
          { error: `${role} role required` },
          { status: 403 }
        )
      };
    }
    
    return { allow: true };
  };
};

export const requirePermission = (permission: string): GuardFn => {
  return (c) => {
    const user = c.locals.user;
    
    if (!user?.permissions?.includes(permission)) {
      return {
        deny: Response.json(
          { error: `Missing permission: ${permission}` },
          { status: 403 }
        )
      };
    }
    
    return { allow: true };
  };
};

export const requireOwnership = (
  resourceGetter: (c: Context) => Promise<{ ownerId: string } | null>
): GuardFn => {
  return async (c) => {
    const user = c.locals.user;
    const resource = await resourceGetter(c);
    
    if (!resource) {
      return { deny: Response.json({ error: "Not found" }, { status: 404 }) };
    }
    
    if (resource.ownerId !== user.id) {
      return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
    }
    
    return { allow: true, locals: { resource } };
  };
};
```

Use with different parameters:

```typescript
route.get("/admin", {
  guards: [requireAuth, requireRole("admin")],
  resolve: (c) => Response.json({ data: "admin data" })
});

route.get("/moderator", {
  guards: [requireAuth, requireRole("moderator")],
  resolve: (c) => Response.json({ data: "mod data" })
});

route.delete("/posts/:id", {
  guards: [
    requireAuth,
    requirePermission("posts:delete"),
    requireOwnership(async (c) => {
      return await db.posts.get(c.raw.params.id);
    })
  ],
  resolve: async (c) => {
    await db.posts.delete(c.raw.params.id);
    return new Response(null, { status: 204 });
  }
});
```

**Still explicit.** You see the parameters in the route definition.

### Reusing Validators

Validators are just schemas. Share them:

```typescript
// schemas/user.ts
import { z } from "zod";

export const nameSchema = z.string().min(1).max(100);
export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8).max(100);

export const userIdSchema = z.string().uuid();

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema
});

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});
```

Use across routes:

```typescript
// routes/users.ts
import { createUserSchema, updateUserSchema } from "../schemas/user.ts";

export const userRoutes = [
  route.post("/users", {
    request: { body: createUserSchema },
    resolve: async (c) => {
      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }
      
      const user = await db.users.create(c.input.body);
      return Response.json(user, { status: 201 });
    }
  }),
  
  route.patch("/users/:id", {
    request: { body: updateUserSchema },
    resolve: async (c) => {
      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }
      
      const user = await db.users.update(c.raw.params.id, c.input.body);
      return Response.json(user);
    }
  })
];
```

```typescript
// routes/auth.ts
import { loginSchema } from "../schemas/user.ts";

export const authRoutes = [
  route.post("/login", {
    request: { body: loginSchema },
    resolve: async (c) => {
      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }
      
      const token = await authenticate(c.input.body);
      return Response.json({ token });
    }
  })
];
```

**Same schemas, different routes.** Data structures, not configuration.

### Composition Patterns

**By feature**:

```
src/
  features/
    users/
      routes.ts
      guards.ts
      schemas.ts
    posts/
      routes.ts
      guards.ts
      schemas.ts
    comments/
      routes.ts
      schemas.ts
  main.ts
```

**By layer**:

```
src/
  routes/
    users.ts
    posts.ts
    comments.ts
  guards/
    auth.ts
    permissions.ts
  schemas/
    user.ts
    post.ts
  main.ts
```

**Hybrid**:

```
src/
  api/
    users/
      routes.ts
      schemas.ts
    posts/
      routes.ts
      schemas.ts
  guards/
    auth.ts      # Shared across features
    permissions.ts
  main.ts
```

**Choose what works for your team.** Hectoday HTTP doesn't enforce structure.

## Helpers as Copy-Paste Recipes

Hectoday HTTP has a minimal core. Everything else is helpers, copy-paste recipes you can use, modify, or ignore.

### Why Helpers Are Documentation, Not Dependencies

**Core framework**:
- Route matching
- Validation integration
- Guard composition
- Context threading

**That's it.** ~500 lines of code.

**Everything else is in the docs as recipes**:
- [Zod Validator](./helpers/zod-validator) - Validator adapter for Zod schemas
- [Body size limits](./helpers/max-body-bytes) - `maxBodyBytes` guard
- [CORS headers](./helpers/cors) - `corsHeaders` response helper
- [Request ID tracking](./helpers/request-id) - Request ID generation and headers
- [Rate limiting](./helpers/rate-limit) - Rate limit guards

These are **recipes, not packages**. Copy the code, paste it into your project, modify it for your needs.

**Why not a package?**
- No dependency to maintain
- No version conflicts
- No "tree-shaking" concerns
- You own the code
- Modify without forking
- Copy only what you need

### Example: maxBodyBytes Helper

See the [full documentation](./helpers/max-body-bytes) for the complete code.

**Quick version:**

```typescript
// helpers/maxBodyBytes.ts - copied from docs
import type { GuardFn } from "@hectoday/http";

const SIZES = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024
};

function maxBodyBytes(limit: number): GuardFn {
  return (c) => {
    const contentLength = c.request.headers.get("content-length");
    if (!contentLength) return { allow: true };
    
    const size = parseInt(contentLength, 10);
    if (size > limit) {
      return {
        deny: Response.json(
          { error: "Request body too large", limit, received: size },
          { status: 413 }
        )
      };
    }
    return { allow: true };
  };
}
```

**Use it:**

```typescript
// Import from YOUR project (you copied it)
import { maxBodyBytes, SIZES } from "./helpers/maxBodyBytes.ts";

route.post("/upload", {
  guards: [maxBodyBytes(10 * SIZES.MB)],
  resolve: async (c) => {
    const data = await c.request.arrayBuffer();
    return Response.json({ size: data.byteLength });
  }
});
```

**Modify it for your needs:**

```typescript
// Your custom version
const maxBodyBytesCustom = (limit: number): GuardFn => {
  return async (c) => {
    const contentLength = c.request.headers.get("content-length");
    
    if (!contentLength) {
      // Different behavior: reject missing Content-Length
      return {
        deny: Response.json(
          { error: "Content-Length header required" },
          { status: 411 }
        )
      };
    }
    
    const size = parseInt(contentLength, 10);
    
    if (size > limit) {
      // Different error format
      return {
        deny: new Response("Body too large", { status: 413 })
      };
    }
    
    return { allow: true };
  };
};
```

**Or don't use it at all**. It's optional.

### More Helper Examples

**CORS Headers** - See [full docs](./helpers/cors)

```typescript
// Copy from docs, use in onResponse
onResponse: ({ response }) => {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  return new Response(response.body, { status: response.status, headers });
}
```

**Request ID Tracking** - See [full docs](./helpers/request-id)

```typescript
// Copy from docs, use in onRequest + onResponse
onRequest: ({ request }) => ({
  requestId: crypto.randomUUID()
}),

onResponse: ({ context, response }) => {
  const headers = new Headers(response.headers);
  headers.set("X-Request-ID", context.locals.requestId);
  return new Response(response.body, { status: response.status, headers });
}
```

**Rate Limiting** - See [full docs](./helpers/rate-limit)

```typescript
// Copy from docs, use as guard
guards: [rateLimit({ maxRequests: 100, windowMs: 60_000 })]
```

### Why Copy-Paste?

**No dependency bloat:**

```typescript
// Your project
import { maxBodyBytes } from "./helpers/maxBodyBytes.ts";

// You copied only what you need
// No external dependencies
// No version conflicts
// No tree-shaking concerns
```

**Compare to monolithic frameworks:**

```typescript
import { Framework } from "big-framework";

// Bundle includes:
// - CORS middleware (you don't use)
// - Session middleware (you don't use)
// - Cookie parser (you don't use)
// - Static file server (you don't use)
// - 50 other things you don't use
```

**With copy-paste helpers:**
- You own the code
- Modify without forking
- No dependency updates to track
- No breaking changes from maintainers
- Copy only what you need

Hectoday HTTP: **core is ~500 lines, helpers are documentation**.

### Writing Your Own Helpers

Helpers are just functions. Write your own:

```typescript
// helpers/rateLimit.ts
import type { GuardFn } from "@hectoday/http";

const rateLimits = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (
  maxRequests: number,
  windowMs: number,
  keyFn: (c: Context) => string = (c) => c.request.headers.get("x-forwarded-for") || "unknown"
): GuardFn => {
  return (c) => {
    const key = keyFn(c);
    const now = Date.now();
    const record = rateLimits.get(key);
    
    if (!record || now > record.resetAt) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return { allow: true };
    }
    
    if (record.count >= maxRequests) {
      return {
        deny: Response.json(
          {
            error: "Rate limit exceeded",
            limit: maxRequests,
            resetAt: new Date(record.resetAt).toISOString()
          },
          { status: 429 }
        )
      };
    }
    
    record.count++;
    return { allow: true };
  };
};
```

Use it:

```typescript
route.post("/api/search", {
  guards: [
    rateLimit(100, 60_000) // 100 requests per minute
  ],
  resolve: async (c) => {
    // Handle search
  }
});
```

**It's just a guard.** Nothing special about helpers, they use the same primitives you use.

### The Philosophy

**Core**: Minimal, stable, never changes

**Helpers**: Optional, composable, evolve based on needs

**Your code**: Builds on both, owns the decisions

```
Your API
    ↓
Helpers (optional recipes)
    ↓
Core (minimal primitives)
    ↓
Web Standards (Request/Response)
```

**Small core, infinite flexibility.**

---

Next: [Security as a first-class concept](./security-as-a-first-class-concept) - designing secure APIs with explicit controls.
