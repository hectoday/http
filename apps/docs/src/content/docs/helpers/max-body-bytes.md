---
title: "maxBodyBytes: Limit Request Body Size"
description: "Guard helper to limit request body size"
draft: false
---

A guard helper that limits request body size, protecting against large payloads.

## The Code

```typescript
const SIZES = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

function maxBodyBytes(max: number): GuardFn {
  return (c) => {
    const contentLength = c.request.headers.get("content-length");
    
    // If no Content-Length header, allow (body will be read up to limit)
    if (!contentLength) {
      return { allow: true };
    }
    
    const size = parseInt(contentLength, 10);
    
    if (size > max) {
      return {
        deny: Response.json(
          {
            error: "Request body too large",
            maxBytes: max,
            receivedBytes: size,
          },
          { status: 413 } // 413 Payload Too Large
        ),
      };
    }
    
    return { allow: true };
  };
}
```

## Usage

```typescript
import { route, type GuardFn } from "@hectoday/http";

// Copy the helper code above here

// Limit to 1MB
route.post("/upload", {
  guards: [maxBodyBytes(1 * SIZES.MB)],
  resolve: async (c) => {
    const data = await c.request.json();
    return Response.json({ received: data });
  },
});

// Limit to 10MB for file uploads
route.post("/files", {
  guards: [maxBodyBytes(10 * SIZES.MB)],
  resolve: async (c) => {
    const formData = await c.request.formData();
    return Response.json({ success: true });
  },
});

// Limit to 100KB for small payloads
route.post("/webhook", {
  guards: [maxBodyBytes(100 * SIZES.KB)],
  resolve: async (c) => {
    const data = await c.request.json();
    return Response.json({ processed: true });
  },
});
```

## Customization

### Custom Error Response

```typescript
function maxBodyBytes(max: number, errorFn?: (size: number, max: number) => Response): GuardFn {
  return (c) => {
    const contentLength = c.request.headers.get("content-length");
    if (!contentLength) return { allow: true };
    
    const size = parseInt(contentLength, 10);
    
    if (size > max) {
      const errorResponse = errorFn 
        ? errorFn(size, max)
        : Response.json({ error: "Payload too large" }, { status: 413 });
      
      return { deny: errorResponse };
    }
    
    return { allow: true };
  };
}

// Usage with custom error
route.post("/api", {
  guards: [
    maxBodyBytes(1 * SIZES.MB, (size, max) =>
      Response.json(
        {
          message: "File too big!",
          yourSize: `${(size / SIZES.MB).toFixed(2)}MB`,
          maxSize: `${(max / SIZES.MB).toFixed(2)}MB`,
        },
        { status: 413 }
      )
    ),
  ],
  resolve: async (c) => {
    const data = await c.request.json();
    return Response.json(data);
  },
});
```

## How It Works

1. **Checks `Content-Length` header** — Most clients send this
2. **Compares to max** — Rejects if over limit
3. **Returns 413** — Standard "Payload Too Large" status
4. **Allows if no header** — Runtime will enforce limits when reading body

## Notes

- This checks the **declared size**, not actual bytes read
- If client omits `Content-Length`, the check passes
- Runtime limits (Deno/Bun/Workers) still apply when reading body
- Use this for early rejection before parsing large payloads
- Combine with request validation for body structure checks

## Why Not Built-In?

This is a policy decision (how big is too big?), not a framework primitive. Different routes have different limits:

- Webhooks: 10KB-100KB
- JSON APIs: 1MB-10MB
- File uploads: 10MB-100MB+

Copy this helper and adjust `SIZES` or `max` values for your needs.
