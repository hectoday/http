---
title: "Request ID - Tracking and Tracing"
description: "Generate and track request IDs across your application"
draft: true
---

Generate unique request IDs for tracing requests through logs and services.

## The Code

```typescript
function generateRequestId(): string {
  return crypto.randomUUID();
}

function addRequestIdHeader(info: {
  context: Context;
  response: Response;
}): Response {
  const { context, response } = info;
  const headers = new Headers(response.headers);
  
  headers.set("X-Request-ID", String(context.locals.requestId));
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

## Usage

### Basic Setup

```typescript
import { setup, route } from "@hectoday/http";

// Copy the helper code above here

const app = setup({
  handlers: [
    route.get("/api/data", {
      resolve: () => Response.json({ data: "value" }),
    }),
  ],
  
  onRequest: ({ request }) => {
    const requestId = generateRequestId();
    return { requestId };
  },
  
  onResponse: addRequestIdHeader,
});
```

Now every response includes `X-Request-ID` header.

### Accept Client Request IDs

Accept request IDs from clients (if provided):

```typescript
onRequest: ({ request }) => {
  const requestId = request.headers.get("X-Request-ID") || generateRequestId();
  return { requestId };
}
```

### Request Logging

Log requests with IDs:

```typescript
const app = setup({
  handlers: [...],
  
  onRequest: ({ request }) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    console.log(`[${requestId}] → ${request.method} ${request.url}`);
    
    return { requestId, startTime };
  },
  
  onResponse: ({ context, response }) => {
    const duration = Date.now() - (context.locals.startTime as number);
    
    console.log(
      `[${context.locals.requestId}] ← ${response.status} (${duration}ms)`
    );
    
    return addRequestIdHeader({ context, response });
  },
});
```

### Structured Logging

Use request IDs in structured logs:

```typescript
interface LogContext {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
}

function log(level: string, message: string, context: LogContext) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }));
}

const app = setup({
  handlers: [
    route.get("/users/:id", {
      resolve: (c) => {
        const logCtx = {
          requestId: String(c.locals.requestId),
          method: c.request.method,
          path: new URL(c.request.url).pathname,
          userId: c.raw.params.id,
        };
        
        log("info", "Fetching user", logCtx);
        
        const user = { id: c.raw.params.id, name: "Alice" };
        
        log("info", "User found", logCtx);
        
        return Response.json(user);
      },
    }),
  ],
  
  onRequest: ({ request }) => ({
    requestId: generateRequestId(),
  }),
  
  onResponse: addRequestIdHeader,
});
```

### Error Tracking

Include request IDs in error responses:

```typescript
const app = setup({
  handlers: [...],
  
  onRequest: ({ request }) => ({
    requestId: generateRequestId(),
  }),
  
  onResponse: addRequestIdHeader,
  
  onError: ({ error, context }) => {
    const requestId = context.locals.requestId as string;
    
    console.error(`[${requestId}] Error:`, error);
    
    return Response.json(
      {
        error: "Internal Server Error",
        requestId, // Include in response for user to report
      },
      {
        status: 500,
        headers: {
          "X-Request-ID": requestId,
        },
      }
    );
  },
});
```

### Distributed Tracing

Forward request IDs to external services:

```typescript
route.get("/data", {
  resolve: async (c) => {
    const requestId = c.locals.requestId as string;
    
    // Forward to downstream service
    const response = await fetch("https://api.example.com/data", {
      headers: {
        "X-Request-ID": requestId,
      },
    });
    
    const data = await response.json();
    return Response.json(data);
  },
});
```

## Custom ID Generation

### Short IDs

```typescript
function generateShortId(): string {
  return Math.random().toString(36).substring(2, 15);
}
```

### Timestamp-based IDs

```typescript
function generateTimestampId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
```

### Nano ID

```typescript
// Using nanoid library
import { nanoid } from "nanoid";

function generateNanoId(): string {
  return nanoid();
}
```

## Notes

- Use `crypto.randomUUID()` for universally unique IDs
- Store request ID in `context.locals` for handler access
- Include in response headers for client-side tracing
- Include in error responses for support debugging
- Forward to downstream services for distributed tracing
- Log with request IDs for correlating log entries

## Why Not Built-In?

Request ID generation is application-specific:
- Some accept client IDs, some generate server-side
- Different ID formats (UUID, short ID, timestamp, etc.)
- Different header names (`X-Request-ID`, `X-Trace-ID`, etc.)
- Different logging strategies

Copy this helper and customize for your observability needs.
