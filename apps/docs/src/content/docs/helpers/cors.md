---
title: "CORS - Cross-origin resource sharing"
description: "Add CORS headers to responses"
draft: true
---

Add CORS headers to responses using the `onResponse` hook.

## The Code

```typescript
interface CorsOptions {
  origin?: string;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

function corsHeaders(options: CorsOptions = {}): (info: {
  context: Context;
  response: Response;
}) => Response {
  const {
    origin = "*",
    methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400, // 24 hours
  } = options;

  return ({ response }) => {
    const headers = new Headers(response.headers);
    
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", methods.join(", "));
    headers.set("Access-Control-Allow-Headers", allowedHeaders.join(", "));
    
    if (exposedHeaders.length > 0) {
      headers.set("Access-Control-Expose-Headers", exposedHeaders.join(", "));
    }
    
    if (credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }
    
    headers.set("Access-Control-Max-Age", maxAge.toString());
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
```

## Usage

### Basic CORS (Allow All)

```typescript
import { setup, route } from "@hectoday/http";

// Copy the helper code above here

const app = setup({
  handlers: [
    route.get("/api/data", {
      resolve: () => Response.json({ data: "value" }),
    }),
  ],
  
  onResponse: corsHeaders(), // Defaults to allow all origins
});
```

### Specific Origin

```typescript
const app = setup({
  handlers: [...],
  
  onResponse: corsHeaders({
    origin: "https://example.com",
  }),
});
```

### Custom Methods and Headers

```typescript
const app = setup({
  handlers: [...],
  
  onResponse: corsHeaders({
    origin: "https://app.example.com",
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Custom-Header"],
    exposedHeaders: ["X-Request-ID"],
  }),
});
```

### With Credentials

```typescript
const app = setup({
  handlers: [...],
  
  onResponse: corsHeaders({
    origin: "https://app.example.com", // Must be specific, not "*"
    credentials: true,
  }),
});
```

### Handle OPTIONS Preflight

Add an OPTIONS handler for preflight requests:

```typescript
const app = setup({
  handlers: [
    // Preflight handler
    route.options("/*", {
      resolve: () => new Response(null, { status: 204 }),
    }),
    
    // Your actual routes
    route.get("/api/data", {
      resolve: () => Response.json({ data: "value" }),
    }),
  ],
  
  onResponse: corsHeaders({
    origin: "https://app.example.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
});
```

## Dynamic Origins

For multiple allowed origins:

```typescript
const allowedOrigins = [
  "https://app.example.com",
  "https://app.staging.example.com",
  "http://localhost:3000",
];

function dynamicCors(): (info: { context: Context; response: Response }) => Response {
  return ({ context, response }) => {
    const origin = context.request.headers.get("origin");
    const headers = new Headers(response.headers);
    
    if (origin && allowedOrigins.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      headers.set("Access-Control-Allow-Credentials", "true");
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

const app = setup({
  handlers: [...],
  onResponse: dynamicCors(),
});
```

## Per-Route CORS

Use different CORS policies for different route groups:

```typescript
function addCorsHeaders(headers: Headers, origin: string) {
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
}

const app = setup({
  handlers: [...],
  
  onResponse: ({ context, response }) => {
    const headers = new Headers(response.headers);
    
    // Public API: allow all
    if (context.request.url.includes("/public/")) {
      addCorsHeaders(headers, "*");
    }
    
    // Private API: specific origin only
    else if (context.request.url.includes("/api/")) {
      addCorsHeaders(headers, "https://app.example.com");
    }
    
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
});
```

## Notes

- CORS headers are **server policy**, not security
- Browsers enforce CORS, but direct API calls (curl, Postman) ignore it
- For credentials, origin must be specific (not `"*"`)
- OPTIONS requests return 204 No Content
- Set CORS in `onResponse` so all responses get headers

## Why Not Built-In?

CORS configuration varies widely:
- Public APIs allow all origins
- Private APIs allow specific origins
- Some need credentials, some don't
- Some expose custom headers

Copy this helper and customize for your security requirements.
