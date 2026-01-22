---
title: "Security as a First-Class Concept"
description: "Designing secure APIs with explicit security controls"
order: 11
draft: true
---

Security isn't an afterthought. It's not middleware you add later. It's a core part of your API design.

In Hectoday HTTP, security is **explicit decisions** visible in your code.

## Security Is a Decision, Not Middleware

Most frameworks treat security as middleware:

```typescript
// In many frameworks
app.use(helmet());
app.use(rateLimiter());
app.use(validateContentType());
app.use(checkOrigin());

app.post("/api/users", handler);

// Which security checks apply?
// In what order?
// Can they be bypassed?
// What happens if they fail?
```

This creates **security through obscurity**. You don't see the checks when reading routes. You don't know the order. You don't know what responses they return.

### Why Security Belongs in Guards

Guards make security decisions **explicit**:

```typescript
route.post("/api/users", {
  guards: [
    requireAuth,
    validateContentType(["application/json"]),
    maxBodyBytes(1 * MB),
    rateLimit(100, 60_000)
  ],
  request: {
    body: createUserSchema
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const user = await db.users.create(c.input.body);
    return Response.json(user, { status: 201 });
  }
})
```

**Reading this route tells you**:
1. User must be authenticated (`requireAuth`)
2. Content-Type must be JSON (`validateContentType`)
3. Body must be under 1MB (`maxBodyBytes`)
4. Rate limited to 100 req/min (`rateLimit`)
5. Body validated against schema
6. If all pass, user is created

**Security is visible.** You can audit it by reading the route definition.

### The Difference

**Middleware approach** (implicit):
```typescript
// Somewhere in middleware setup
app.use(requireAuth);

// Later, in a route file
app.post("/users", handler);

// Does this route require auth?
// You have to check middleware config.
```

**Guard approach** (explicit):
```typescript
route.post("/users", {
  guards: [requireAuth],
  resolve: handler
})

// Does this route require auth?
// Yes. It's right there.
```

**Security decisions are part of the route definition.** Not global config. Not hidden middleware.

## Common Security Guards

Let's build security guards for common threats.

### Authentication

We've seen this before, but it's fundamental:

```typescript
import type { GuardFn } from "@hectoday/http";

export const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    return {
      deny: Response.json(
        { error: "Missing authentication token" },
        { status: 401 }
      )
    };
  }
  
  const user = verifyToken(token);
  
  if (!user) {
    return {
      deny: Response.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      )
    };
  }
  
  return { allow: true, locals: { user, userId: user.id } };
};
```

**Applies to**: Any route that requires authentication

**Protects against**: Unauthorized access

### Content-Type Validation

Prevent attacks that exploit content type confusion:

```typescript
import type { GuardFn } from "@hectoday/http";

export const validateContentType = (allowed: string[]): GuardFn => {
  return (c) => {
    const contentType = c.request.headers.get("content-type");
    
    if (!contentType) {
      return {
        deny: Response.json(
          { error: "Content-Type header required" },
          { status: 400 }
        )
      };
    }
    
    // Parse content type (ignore charset, etc.)
    const mediaType = contentType.split(";")[0].trim().toLowerCase();
    
    if (!allowed.includes(mediaType)) {
      return {
        deny: Response.json(
          {
            error: "Unsupported Content-Type",
            allowed,
            received: mediaType
          },
          { status: 415 } // Unsupported Media Type
        )
      };
    }
    
    return { allow: true };
  };
};
```

**Usage**:

```typescript
route.post("/api/users", {
  guards: [
    requireAuth,
    validateContentType(["application/json"])
  ],
  resolve: async (c) => {
    // Content-Type is guaranteed to be application/json
    const data = await c.request.json();
    return Response.json(data);
  }
})
```

**Applies to**: Routes that expect specific content types

**Protects against**: Content type confusion attacks, unexpected data formats

### Body Size Limits

Prevent denial-of-service through large payloads:

```typescript
import type { GuardFn } from "@hectoday/http";

export const SIZES = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024
};

export const maxBodyBytes = (limit: number): GuardFn => {
  return (c) => {
    const contentLength = c.request.headers.get("content-length");
    
    if (!contentLength) {
      // No Content-Length header - body might be too large
      // You can choose to reject or allow (streaming)
      return { allow: true };
    }
    
    const size = parseInt(contentLength, 10);
    
    if (isNaN(size) || size < 0) {
      return {
        deny: Response.json(
          { error: "Invalid Content-Length" },
          { status: 400 }
        )
      };
    }
    
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

**Usage**:

```typescript
route.post("/api/upload", {
  guards: [
    requireAuth,
    maxBodyBytes(10 * SIZES.MB) // 10MB limit
  ],
  resolve: async (c) => {
    const data = await c.request.arrayBuffer();
    // Process upload...
    return Response.json({ size: data.byteLength });
  }
})
```

**Applies to**: Routes that accept request bodies

**Protects against**: DoS attacks via large payloads, resource exhaustion

### Rate Limiting

Prevent abuse through excessive requests:

```typescript
import type { GuardFn } from "@hectoday/http";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitRecord>();

export const rateLimit = (
  maxRequests: number,
  windowMs: number,
  keyFn: (c: Context) => string = (c) => {
    // Default: use IP address
    return c.request.headers.get("x-forwarded-for") ||
           c.request.headers.get("x-real-ip") ||
           "unknown";
  }
): GuardFn => {
  return (c) => {
    const key = keyFn(c);
    const now = Date.now();
    const record = rateLimits.get(key);
    
    // No record or window expired - create new
    if (!record || now > record.resetAt) {
      rateLimits.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return { allow: true };
    }
    
    // Limit exceeded
    if (record.count >= maxRequests) {
      const resetIn = Math.ceil((record.resetAt - now) / 1000);
      
      return {
        deny: new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            limit: maxRequests,
            remaining: 0,
            resetIn
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(resetIn),
              "X-RateLimit-Limit": String(maxRequests),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.ceil(record.resetAt / 1000))
            }
          }
        )
      };
    }
    
    // Increment and allow
    record.count++;
    
    return {
      allow: true,
      locals: {
        rateLimit: {
          limit: maxRequests,
          remaining: maxRequests - record.count,
          resetAt: record.resetAt
        }
      }
    };
  };
};
```

**Usage**:

```typescript
// Global rate limit for all API routes
const apiRoutes = group({
  guards: [
    rateLimit(1000, 60_000) // 1000 requests per minute
  ],
  handlers: [/* routes */]
});

// Stricter limit for expensive operations
route.post("/api/ai/generate", {
  guards: [
    requireAuth,
    rateLimit(10, 60_000, (c) => c.locals.userId) // 10 req/min per user
  ],
  resolve: async (c) => {
    // Generate AI content...
  }
})
```

**Applies to**: All routes, especially expensive operations

**Protects against**: Brute force attacks, API abuse, resource exhaustion

### Origin Validation

Prevent cross-origin attacks:

```typescript
import type { GuardFn } from "@hectoday/http";

export const requireOrigin = (allowed: string[]): GuardFn => {
  return (c) => {
    const origin = c.request.headers.get("origin");
    
    if (!origin) {
      // No Origin header - might be same-origin or server-to-server
      // Decide based on your security requirements
      return { allow: true };
    }
    
    if (!allowed.includes(origin)) {
      return {
        deny: Response.json(
          {
            error: "Origin not allowed",
            origin,
            allowedOrigins: allowed
          },
          { status: 403 }
        )
      };
    }
    
    return { allow: true };
  };
};
```

**Usage**:

```typescript
route.post("/api/webhooks/payment", {
  guards: [
    requireOrigin(["https://payment-provider.com"])
  ],
  resolve: async (c) => {
    // Process webhook...
  }
})
```

**Applies to**: Webhooks, server-to-server APIs

**Protects against**: Cross-origin attacks, unauthorized webhook sources

### CSRF Protection

Prevent cross-site request forgery:

```typescript
import type { GuardFn } from "@hectoday/http";

export const requireCsrfToken: GuardFn = (c) => {
  // Only check for state-changing methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(c.request.method)) {
    return { allow: true };
  }
  
  const tokenFromHeader = c.request.headers.get("x-csrf-token");
  const tokenFromCookie = getCookie(c.request, "csrf-token");
  
  if (!tokenFromHeader || !tokenFromCookie) {
    return {
      deny: Response.json(
        { error: "Missing CSRF token" },
        { status: 403 }
      )
    };
  }
  
  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(tokenFromHeader, tokenFromCookie)) {
    return {
      deny: Response.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      )
    };
  }
  
  return { allow: true };
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
```

**Usage**:

```typescript
route.post("/api/users", {
  guards: [
    requireAuth,
    requireCsrfToken
  ],
  resolve: async (c) => {
    // CSRF token validated
  }
})
```

**Applies to**: Routes that modify state (POST, PUT, PATCH, DELETE)

**Protects against**: Cross-site request forgery attacks

### API Key Validation

For machine-to-machine authentication:

```typescript
import type { GuardFn } from "@hectoday/http";

export const requireApiKey: GuardFn = async (c) => {
  const apiKey = c.request.headers.get("x-api-key");
  
  if (!apiKey) {
    return {
      deny: Response.json(
        { error: "Missing API key" },
        { status: 401 }
      )
    };
  }
  
  // Verify API key (check database, cache, etc.)
  const keyData = await db.apiKeys.verify(apiKey);
  
  if (!keyData) {
    return {
      deny: Response.json(
        { error: "Invalid API key" },
        { status: 401 }
      )
    };
  }
  
  if (keyData.expiresAt < Date.now()) {
    return {
      deny: Response.json(
        { error: "API key expired" },
        { status: 401 }
      )
    };
  }
  
  // Check permissions
  return {
    allow: true,
    locals: {
      apiKeyId: keyData.id,
      apiKeyOwner: keyData.ownerId,
      apiKeyPermissions: keyData.permissions
    }
  };
};

export const requireApiKeyPermission = (permission: string): GuardFn => {
  return (c) => {
    const permissions = c.locals.apiKeyPermissions as string[] | undefined;
    
    if (!permissions?.includes(permission)) {
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
```

**Usage**:

```typescript
route.post("/api/data", {
  guards: [
    requireApiKey,
    requireApiKeyPermission("data:write")
  ],
  resolve: async (c) => {
    // API key validated and has write permission
  }
})
```

**Applies to**: Machine-to-machine APIs, third-party integrations

**Protects against**: Unauthorized API access

### Request IDs

Not a security control per se, but critical for security auditing:

```typescript
import type { GuardFn } from "@hectoday/http";

export const attachRequestId: GuardFn = (c) => {
  // Check if client provided request ID
  const requestId = c.request.headers.get("x-request-id") ||
                    crypto.randomUUID();
  
  return {
    allow: true,
    locals: { requestId }
  };
};
```

**Or use in `onRequest` hook**:

```typescript
const app = setup({
  handlers: [...],
  
  onRequest: (request) => {
    const requestId = request.headers.get("x-request-id") ||
                      crypto.randomUUID();
    return { requestId, startTime: Date.now() };
  },
  
  onResponse: (c, response) => {
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", String(c.locals.requestId));
    
    // Log for audit trail
    console.log({
      requestId: c.locals.requestId,
      method: c.request.method,
      path: new URL(c.request.url).pathname,
      status: response.status,
      duration: Date.now() - (c.locals.startTime as number),
      userId: c.locals.user?.id
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
});
```

**Applies to**: All routes

**Enables**: Request tracing, security auditing, debugging

### Input Sanitization

Prevent injection attacks:

```typescript
import type { GuardFn } from "@hectoday/http";

export const sanitizeInput: GuardFn = async (c) => {
  // This is tricky - body is a stream and can only be read once
  // Better to do sanitization in validation schemas or handlers
  
  // But for query params, you can sanitize:
  const suspiciousPattern = /<script|javascript:|onerror=/i;
  
  for (const [key, value] of Object.entries(c.raw.query)) {
    const strValue = Array.isArray(value) ? value.join(" ") : value;
    
    if (suspiciousPattern.test(strValue || "")) {
      return {
        deny: Response.json(
          { error: "Potentially malicious input detected" },
          { status: 400 }
        )
      };
    }
  }
  
  return { allow: true };
};
```

**Better approach**: Use validation schemas that reject malicious patterns:

```typescript
import { z } from "zod";

const safeStringSchema = z.string()
  .max(1000)
  .refine(
    (val) => !/<script|javascript:|onerror=/i.test(val),
    "Input contains potentially malicious content"
  );

route.post("/api/comments", {
  request: {
    body: z.object({
      text: safeStringSchema
    })
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // Input is validated and sanitized
    const comment = await db.comments.create(c.input.body);
    return Response.json(comment, { status: 201 });
  }
})
```

**Applies to**: Routes accepting user input

**Protects against**: XSS, SQL injection (when combined with parameterized queries)

## Auditing the Request Path

The most important security feature of Hectoday HTTP isn't a guard—it's **visibility**.

### Why Explicit Flow Is Easier to Reason About

When security is explicit, auditing is straightforward:

```typescript
route.delete("/admin/users/:id", {
  guards: [
    requireAuth,           // 1. Must be authenticated
    requireAdmin,          // 2. Must be admin
    requireEmailVerified,  // 3. Email must be verified
    requireNotSelf         // 4. Can't delete yourself
  ],
  resolve: async (c) => {
    // If we're here, all four checks passed
    const id = c.raw.params.id;
    await db.users.delete(id);
    return new Response(null, { status: 204 });
  }
})
```

**Security audit questions**:

Q: Can unauthenticated users delete users?  
A: No. `requireAuth` denies them.

Q: Can regular users delete users?  
A: No. `requireAdmin` denies them.

Q: Can admins delete users with unverified emails?  
A: No. `requireEmailVerified` denies them.

Q: Can admins delete themselves?  
A: No. `requireNotSelf` denies them.

**All answers are in the route definition.** No hidden middleware. No global config. Just explicit guards.

### Tracing Security Decisions

For any request, you can trace exactly what happened:

```typescript
const app = setup({
  handlers: [...],
  
  onRequest: (request) => {
    return {
      requestId: crypto.randomUUID(),
      securityLog: []
    };
  },
  
  // Wrap guards to log decisions
  handlers: handlers.map(handler => ({
    ...handler,
    guards: handler.guards?.map(guard => {
      return (c: Context) => {
        const result = guard(c);
        
        if (result.deny) {
          (c.locals.securityLog as string[]).push(
            `Guard denied: ${guard.name || "anonymous"}`
          );
        } else {
          (c.locals.securityLog as string[]).push(
            `Guard allowed: ${guard.name || "anonymous"}`
          );
        }
        
        return result;
      };
    })
  })),
  
  onResponse: (c, response) => {
    console.log({
      requestId: c.locals.requestId,
      path: new URL(c.request.url).pathname,
      status: response.status,
      securityLog: c.locals.securityLog
    });
    
    return response;
  }
});
```

**Log output**:

```
{
  requestId: "abc-123",
  path: "/admin/users/456",
  status: 403,
  securityLog: [
    "Guard allowed: requireAuth",
    "Guard denied: requireAdmin"
  ]
}
```

You can see **exactly** which guard denied the request.

### Security Reviews

When reviewing code for security issues, you read route definitions:

```typescript
// Is this route secure?
route.post("/api/transfer", {
  guards: [
    requireAuth,
    validateContentType(["application/json"]),
    maxBodyBytes(1 * KB),
    rateLimit(10, 60_000)
  ],
  request: {
    body: transferSchema
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const { fromAccount, toAccount, amount } = c.input.body;
    
    // Check ownership
    if (fromAccount !== c.locals.user.accountId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Check balance
    const balance = await db.accounts.getBalance(fromAccount);
    if (balance < amount) {
      return Response.json({ error: "Insufficient funds" }, { status: 422 });
    }
    
    // Execute transfer
    const transfer = await db.transfers.create({
      fromAccount,
      toAccount,
      amount,
      initiatedBy: c.locals.userId
    });
    
    return Response.json(transfer, { status: 201 });
  }
})
```

**Review checklist**:
- ✓ Requires authentication
- ✓ Validates content type
- ✓ Limits body size
- ✓ Rate limited
- ✓ Input validated (transferSchema)
- ✓ Checks account ownership
- ✓ Checks sufficient balance
- ✓ Logs who initiated transfer

**Everything is visible.** No hidden middleware to check. No global config to audit.

### No Hidden Bypasses

Common middleware problem:

```typescript
// In middleware config
app.use("/api/*", requireAuth);

// Later, someone adds a route
app.get("/api/public-data", handler);

// Oops! This route requires auth when it shouldn't
// Or: middleware order changes, auth gets skipped
```

With explicit guards, bypasses are impossible:

```typescript
route.get("/api/public-data", {
  // No guards - publicly accessible (intentionally)
  resolve: async () => {
    const data = await db.getPublicData();
    return Response.json(data);
  }
})

route.get("/api/private-data", {
  guards: [requireAuth], // Explicitly protected
  resolve: async (c) => {
    const data = await db.getPrivateData(c.locals.userId);
    return Response.json(data);
  }
})
```

**Each route declares its own security.** No route can accidentally inherit or skip security checks.

### Defense in Depth

Layer security controls:

```typescript
// Layer 1: Global guards via group
const apiRoutes = group({
  guards: [
    rateLimit(1000, 60_000),
    attachRequestId
  ],
  handlers: [
    // Layer 2: Feature-specific guards
    group({
      guards: [requireAuth],
      handlers: [
        // Layer 3: Route-specific guards
        route.delete("/users/:id", {
          guards: [requireAdmin, requireNotSelf],
          resolve: async (c) => {
            // Layers 1, 2, and 3 all passed
            await db.users.delete(c.raw.params.id);
            return new Response(null, { status: 204 });
          }
        })
      ]
    })
  ]
});
```

**Security layers**:
1. Rate limiting (all routes)
2. Authentication (feature-specific)
3. Authorization (route-specific)

**All explicit. All visible. All auditable.**

---

Next: [Static Files and Assets](./static-files-and-assets) — serving files while maintaining explicit control.
