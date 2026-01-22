---
title: "Rate Limiting - Protect Your API"
description: "Limit request rates per client"
draft: true
---

Limit how many requests a client can make in a time window.

## The Code

```typescript
import type { GuardFn } from "@hectoday/http";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitRecord>();

function rateLimit(options: {
  maxRequests: number;
  windowMs: number;
  keyFn?: (c: Context) => string;
}): GuardFn {
  const { maxRequests, windowMs, keyFn = (c) => c.request.headers.get("x-forwarded-for") || "unknown" } = options;
  
  return (c) => {
    const key = keyFn(c);
    const now = Date.now();
    const record = rateLimits.get(key);
    
    if (!record || now > record.resetAt) {
      // First request or window expired
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return { allow: true };
    }
    
    if (record.count >= maxRequests) {
      return {
        deny: Response.json(
          {
            error: "Rate limit exceeded",
            limit: maxRequests,
            resetAt: new Date(record.resetAt).toISOString(),
          },
          {
            status: 429, // 429 Too Many Requests
            headers: {
              "Retry-After": Math.ceil((record.resetAt - now) / 1000).toString(),
            },
          }
        ),
      };
    }
    
    record.count++;
    return { allow: true };
  };
}
```

## Usage

### Basic Rate Limiting

```typescript
import { route } from "@hectoday/http";

// Copy the helper code above here

// 10 requests per minute
route.post("/api/data", {
  guards: [
    rateLimit({
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
    }),
  ],
  resolve: () => Response.json({ data: "value" }),
});
```

### By IP Address

```typescript
route.post("/api/submit", {
  guards: [
    rateLimit({
      maxRequests: 5,
      windowMs: 60 * 1000,
      keyFn: (c) => c.request.headers.get("x-forwarded-for") || c.request.headers.get("x-real-ip") || "unknown",
    }),
  ],
  resolve: () => Response.json({ success: true }),
});
```

### By User ID

```typescript
route.post("/api/action", {
  guards: [
    requireAuth, // Sets c.locals.userId
    rateLimit({
      maxRequests: 100,
      windowMs: 60 * 60 * 1000, // 1 hour
      keyFn: (c) => `user:${c.locals.userId}`,
    }),
  ],
  resolve: () => Response.json({ success: true }),
});
```

### By API Key

```typescript
route.get("/api/data", {
  guards: [
    rateLimit({
      maxRequests: 1000,
      windowMs: 60 * 60 * 1000, // 1 hour
      keyFn: (c) => {
        const apiKey = c.request.headers.get("x-api-key");
        return apiKey ? `key:${apiKey}` : "anonymous";
      },
    }),
  ],
  resolve: () => Response.json({ data: "value" }),
});
```

## Advanced Usage

### Different Limits Per Route

```typescript
const strictLimit = rateLimit({
  maxRequests: 5,
  windowMs: 60 * 1000,
});

const relaxedLimit = rateLimit({
  maxRequests: 100,
  windowMs: 60 * 1000,
});

const publicRoutes = [
  route.get("/public/data", {
    guards: [relaxedLimit],
    resolve: () => Response.json({ data: "public" }),
  }),
];

const authRoutes = [
  route.post("/auth/login", {
    guards: [strictLimit], // Stricter for auth endpoints
    resolve: () => Response.json({ token: "abc" }),
  }),
];
```

### Custom Error Response

```typescript
function customRateLimit(maxRequests: number, windowMs: number): GuardFn {
  return (c) => {
    const key = c.request.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    const record = rateLimits.get(key);
    
    if (!record || now > record.resetAt) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return { allow: true };
    }
    
    if (record.count >= maxRequests) {
      const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);
      
      return {
        deny: Response.json(
          {
            message: "Whoa there! Too many requests.",
            details: `You've hit your limit of ${maxRequests} requests. Try again in ${resetInSeconds} seconds.`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": resetInSeconds.toString(),
              "X-RateLimit-Limit": maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": Math.floor(record.resetAt / 1000).toString(),
            },
          }
        ),
      };
    }
    
    record.count++;
    
    // Add rate limit headers to successful responses too
    c.locals.rateLimitHeaders = {
      "X-RateLimit-Limit": maxRequests.toString(),
      "X-RateLimit-Remaining": (maxRequests - record.count).toString(),
      "X-RateLimit-Reset": Math.floor(record.resetAt / 1000).toString(),
    };
    
    return { allow: true };
  };
}

// Add headers in onResponse
const app = setup({
  handlers: [...],
  
  onResponse: ({ context, response }) => {
    const rateLimitHeaders = context.locals.rateLimitHeaders as Record<string, string> | undefined;
    
    if (rateLimitHeaders) {
      const headers = new Headers(response.headers);
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }
    
    return response;
  },
});
```

### Cleanup Old Entries

The in-memory Map grows over time. Add periodic cleanup:

```typescript
// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits.entries()) {
    if (now > record.resetAt) {
      rateLimits.delete(key);
    }
  }
}, 10 * 60 * 1000);
```

## Production Considerations

### Use Redis for Distributed Systems

The in-memory Map doesn't work across multiple servers. Use Redis:

```typescript
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

function redisRateLimit(options: {
  maxRequests: number;
  windowMs: number;
  keyFn?: (c: Context) => string;
}): GuardFn {
  const { maxRequests, windowMs, keyFn = (c) => c.request.headers.get("x-forwarded-for") || "unknown" } = options;
  
  return async (c) => {
    const key = `ratelimit:${keyFn(c)}`;
    const now = Date.now();
    
    const count = await redis.incr(key);
    
    if (count === 1) {
      // First request, set expiry
      await redis.pexpire(key, windowMs);
    }
    
    if (count > maxRequests) {
      const ttl = await redis.pttl(key);
      
      return {
        deny: Response.json(
          {
            error: "Rate limit exceeded",
            limit: maxRequests,
            resetInMs: ttl,
          },
          {
            status: 429,
            headers: {
              "Retry-After": Math.ceil(ttl / 1000).toString(),
            },
          }
        ),
      };
    }
    
    return { allow: true };
  };
}
```

### Use Cloudflare Rate Limiting

If running on Cloudflare Workers, use their built-in rate limiting:

```typescript
// Use Cloudflare's Durable Objects or KV for rate limiting
// See: https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
```

## Notes

- **In-memory storage** — Simple but doesn't scale across servers
- **Use Redis** — For production multi-server deployments
- **Use platform features** — Cloudflare, AWS, etc. have built-in rate limiting
- **Clean up expired entries** — Prevents memory leaks
- **Set `Retry-After` header** — Tells clients when to retry
- **Different keys** — Rate limit by IP, user, API key, etc.

## Why Not Built-In?

Rate limiting strategy varies:
- Some use in-memory, some use Redis
- Some limit by IP, some by user ID, some by API key
- Different limits for different routes
- Different time windows (per second, minute, hour, day)

Copy this helper and customize for your infrastructure and requirements.
