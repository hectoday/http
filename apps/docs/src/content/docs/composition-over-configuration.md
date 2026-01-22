---
title: "Composition Over Configuration"
description: "Building larger APIs from small, reusable pieces"
order: 10
draft: true
---

Small APIs are easy. One file, a few routes, done.

Large APIs need structure. But structure doesn't mean configuration files, decorators, or magic conventions.

In Hectoday HTTP, structure comes from **composition**—building larger pieces from smaller ones.

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

## Helpers as Recipes

Hectoday HTTP has a minimal core. Everything else is helpers—optional, composable utilities.

### Why Helpers Live Outside the Core

**Core framework**:
- Route matching
- Validation integration
- Guard composition
- Context threading

**That's it.** ~500 lines of code.

**Everything else is helpers**:
- Error response builders
- Body size limits
- Rate limiting
- CORS headers
- Request ID generation
- Logging utilities

These are **recipes, not features**. They're patterns you can use, modify, or ignore.

### Example: maxBodyBytes Helper

```typescript
// @hectoday/http-helpers/maxBodyBytes.ts
import type { GuardFn } from "@hectoday/http";

export const SIZES = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024
};

export const maxBodyBytes = (limit: number): GuardFn => {
  return async (c) => {
    const contentLength = c.request.headers.get("content-length");
    
    if (!contentLength) {
      return { allow: true };
    }
    
    const size = parseInt(contentLength, 10);
    
    if (size > limit) {
      return {
        deny: Response.json(
          {
            error: "Request body too large",
            limit,
            received: size
          },
          { status: 413 } // Payload Too Large
        )
      };
    }
    
    return { allow: true };
  };
};
```

**This is just a guard factory.** Nothing special. You could write this yourself.

Use it:

```typescript
import { maxBodyBytes, SIZES } from "@hectoday/http-helpers";

route.post("/upload", {
  guards: [maxBodyBytes(10 * SIZES.MB)],
  resolve: async (c) => {
    const data = await c.request.arrayBuffer();
    // Process upload...
    return Response.json({ size: data.byteLength });
  }
});
```

**Or modify it**:

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

### Example: CORS Helper

```typescript
// @hectoday/http-helpers/cors.ts
export interface CorsOptions {
  origin: string | string[] | "*";
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function corsHeaders(options: CorsOptions): Headers {
  const headers = new Headers();
  
  // Origin
  if (typeof options.origin === "string") {
    headers.set("Access-Control-Allow-Origin", options.origin);
  } else if (Array.isArray(options.origin)) {
    headers.set("Access-Control-Allow-Origin", options.origin.join(", "));
  }
  
  // Methods
  if (options.methods) {
    headers.set("Access-Control-Allow-Methods", options.methods.join(", "));
  }
  
  // Headers
  if (options.allowedHeaders) {
    headers.set("Access-Control-Allow-Headers", options.allowedHeaders.join(", "));
  }
  
  if (options.exposedHeaders) {
    headers.set("Access-Control-Expose-Headers", options.exposedHeaders.join(", "));
  }
  
  // Credentials
  if (options.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  
  // Max age
  if (options.maxAge) {
    headers.set("Access-Control-Max-Age", String(options.maxAge));
  }
  
  return headers;
}
```

Use in `onResponse`:

```typescript
const app = setup({
  handlers: [...],
  
  onResponse: (c, response) => {
    const cors = corsHeaders({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"]
    });
    
    // Merge CORS headers into response
    const headers = new Headers(response.headers);
    for (const [key, value] of cors.entries()) {
      headers.set(key, value);
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
});
```

**It's just a function that returns headers.** You control where and how to use them.

### Example: Request ID Helper

```typescript
// @hectoday/http-helpers/requestId.ts
export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function addRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

Use in hooks:

```typescript
const app = setup({
  handlers: [...],
  
  onRequest: (request) => {
    const requestId = request.headers.get("x-request-id") || generateRequestId();
    return { requestId };
  },
  
  onResponse: (c, response) => {
    return addRequestId(response, c.locals.requestId as string);
  }
});
```

**Helpers are recipes.** Copy them, modify them, or write your own.

### Tree-Shakable Utilities

Because helpers are separate modules, bundlers can tree-shake unused code:

```typescript
// You import only what you use
import { maxBodyBytes, SIZES } from "@hectoday/http-helpers";

// maxBodyBytes is included in bundle
// corsHeaders is NOT included (you didn't import it)
// generateRequestId is NOT included (you didn't import it)
```

**No bloat.** Only pay for what you use.

Compare to monolithic frameworks:

```typescript
// Framework includes everything
import { Framework } from "big-framework";

// Bundle includes:
// - CORS middleware (you don't use)
// - Session middleware (you don't use)
// - Cookie parser (you don't use)
// - Static file server (you don't use)
// - Template engine (you don't use)
// - 50 other things you don't use
```

Hectoday HTTP: **core is ~500 lines, helpers are opt-in**.

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

**It's just a guard.** Nothing special about helpers—they use the same primitives you use.

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

Next: [Security as a First-Class Concept](./security-as-a-first-class-concept) — designing secure APIs with explicit controls.
