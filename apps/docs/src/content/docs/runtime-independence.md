---
title: "Runtime independence"
description: "Running the same code across Deno, Bun, and Cloudflare Workers"
order: 3
part: 4
draft: false
---

One codebase. Multiple runtimes.

Because Hectoday HTTP is built on Web Standards, your handlers work everywhere. The only thing that changes is how you start the server.

## Running on Deno

Deno has first-class TypeScript support and built-in Web Standards.

### Installation

```bash
deno add jsr:@hectoday/http
```

### Basic server

```typescript
// main.ts
import { route, setup } from "@hectoday/http";

const app = setup({
  handlers: [
    route.get("/", {
      resolve: () => new Response("Hello from Deno!")
    })
  ]
});

// Deno's native server
Deno.serve(app.fetch);
```

Run it:

```bash
deno run --allow-net main.ts
```

**That's it.** No build step. No bundler. Just run.

### With options

```typescript
Deno.serve({
  port: 8000,
  hostname: "0.0.0.0",
  onListen: ({ port, hostname }) => {
    console.log(`Server running at http://${hostname}:${port}`);
  }
}, app.fetch);
```

### With TLS

```typescript
Deno.serve({
  port: 443,
  cert: Deno.readTextFileSync("./cert.pem"),
  key: Deno.readTextFileSync("./key.pem")
}, app.fetch);
```

**Deno handles HTTP/2 automatically** when using TLS.

### Deno-specific features

**File system access**:

```typescript
route.get("/files/:filename", {
  resolve: async (c) => {
    const filename = c.raw.params.filename;
    
    // Validate filename...
    
    try {
      // Deno's file API
      const file = await Deno.open(`./files/${filename}`);
      
      return new Response(file.readable, {
        headers: { "Content-Type": "application/octet-stream" }
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      throw error;
    }
  }
})
```

**Environment variables**:

```typescript
const app = setup({
  handlers: [...],
  
  onRequest: ({ request }) => {
    const dbUrl = Deno.env.get("DATABASE_URL");
    const debug = Deno.env.get("DEBUG") === "true";
    
    return { dbUrl, debug };
  }
});
```

**Permissions model**:

```bash
# Explicit permissions
deno run \
  --allow-net \
  --allow-read=./files \
  --allow-env=DATABASE_URL \
  main.ts
```

Deno's permission system prevents accidental access to sensitive resources.

## Running on Bun

Bun is a fast JavaScript runtime with built-in bundler and package manager.

### Installation

```bash
bunx jsr add @hectoday/http
```

Or with npm:

```bash
npm install @hectoday/http
```

### Basic server

```typescript
// server.ts
import { route, setup } from "@hectoday/http";

const app = setup({
  handlers: [
    route.get("/", {
      resolve: () => new Response("Hello from Bun!")
    })
  ]
});

// Bun's native server
Bun.serve({
  fetch: app.fetch,
  port: 3000
});

console.log("Server running at http://localhost:3000");
```

Run it:

```bash
bun run server.ts
```

**Fast startup.** Bun optimizes for speed.

### With options

```typescript
Bun.serve({
  fetch: app.fetch,
  port: 3000,
  hostname: "0.0.0.0",
  
  // Bun-specific options
  development: process.env.NODE_ENV !== "production",
  
  error(error) {
    console.error("Server error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
```

### With TLS

```typescript
Bun.serve({
  fetch: app.fetch,
  port: 443,
  tls: {
    cert: Bun.file("./cert.pem"),
    key: Bun.file("./key.pem")
  }
});
```

### Bun-specific features

**Optimized file serving**:

```typescript
route.get("/assets/:filename", {
  resolve: (c) => {
    const filename = c.raw.params.filename;
    
    // Validate filename...
    
    // Bun.file() uses zero-copy sendfile() when possible
    const file = Bun.file(`./public/${filename}`);
    
    return new Response(file, {
      headers: { "Content-Type": "application/octet-stream" }
    });
  }
})
```

**Bun's file API is optimized** for serving static files.

**Built-in WebSockets**:

```typescript
Bun.serve({
  fetch: app.fetch,
  
  websocket: {
    open(ws) {
      console.log("WebSocket opened");
    },
    
    message(ws, message) {
      ws.send(`Echo: ${message}`);
    },
    
    close(ws) {
      console.log("WebSocket closed");
    }
  }
});
```

Bun has first-class WebSocket support (separate from HTTP routes).

**Environment variables**:

```typescript
const app = setup({
  handlers: [...],
  
  onRequest: ({ request }) => {
    const dbUrl = process.env.DATABASE_URL;
    const debug = process.env.DEBUG === "true";
    
    return { dbUrl, debug };
  }
});
```

## Running on Workers

Cloudflare Workers run on the edge, close to users globally.

### Installation

Workers use npm packages:

```bash
npm install @hectoday/http
```

### Basic worker

```typescript
// src/index.ts
import { route, setup } from "@hectoday/http";

const app = setup({
  handlers: [
    route.get("/", {
      resolve: () => new Response("Hello from Workers!")
    })
  ]
});

// Workers export default with fetch
export default {
  fetch: app.fetch
};
```

### wrangler.toml

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm install"
```

Deploy:

```bash
npx wrangler deploy
```

### With environment variables

Workers use `env` bindings:

```typescript
interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  API_KEY: string;
}

const app = setup({
  handlers: [
    route.get("/data", {
      resolve: async (c) => {
        // Access env through context
        const env = c.locals.env as Env;
        
        const data = await env.DB.prepare(
          "SELECT * FROM users"
        ).all();
        
        return Response.json(data.results);
      }
    })
  ]
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Attach env to locals via onRequest
    const appWithEnv = setup({
      handlers: app.handlers,
      onRequest: ({ request }) => ({ env })
    });
    
    return appWithEnv.fetch(request);
  }
};
```

### Workers-specific features

**No file system**:

Workers don't have a traditional file system. Use KV or R2:

```typescript
route.get("/assets/:key", {
  resolve: async (c) => {
    const env = c.locals.env as Env;
    const key = c.raw.params.key;
    
    // Fetch from R2 bucket
    const object = await env.ASSETS.get(key);
    
    if (!object) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "ETag": object.httpEtag
      }
    });
  }
})
```

**KV for caching**:

```typescript
route.get("/cached-data", {
  resolve: async (c) => {
    const env = c.locals.env as Env;
    
    // Try cache first
    const cached = await env.KV.get("data", "json");
    if (cached) {
      return Response.json(cached);
    }
    
    // Fetch and cache
    const data = await fetchExpensiveData();
    await env.KV.put("data", JSON.stringify(data), {
      expirationTtl: 3600 // 1 hour
    });
    
    return Response.json(data);
  }
})
```

**Scheduled events** (cron):

```typescript
export default {
  fetch: app.fetch,
  
  scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      // Run background task
      cleanupExpiredData(env)
    );
  }
};
```

**Edge runtime limitations**:
- No native Node.js APIs
- Limited execution time (CPU time limits)
- No long-running processes
- No WebSockets (use Durable Objects instead)

## What changes (and what doesn't)

The beauty of Web Standards: **your handler code doesn't change**.

### What stays the same

**Your routes**:

```typescript
// Works on Deno, Bun, and Workers
route.post("/users", {
  request: {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  },
  guards: [requireAuth],
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const user = await db.users.create(c.input.body);
    return Response.json(user, { status: 201 });
  }
})
```

**This exact code** runs on all three runtimes.

**Your guards**:

```typescript
// Works everywhere
const requireAuth: GuardFn = (c) => {
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
```

**Your validators**:

```typescript
// Works everywhere
const userSchema = z.object({
  name: z.string(),
  email: z.string().email()
});
```

**Your setup**:

```typescript
// Works everywhere (except server initialization)
const app = setup({
  handlers: [...],
  validator: zodValidator,
  onRequest: ({ request }) => ({ requestId: crypto.randomUUID() }),
  onResponse: ({ context, response }) => addHeaders(response),
  onError: ({ error, context }) => handleError(error)
});
```

**99% of your code is portable.** Only server initialization changes.

### What changes

**Server initialization**:

```typescript
// Deno
Deno.serve(app.fetch);

// Bun
Bun.serve({ fetch: app.fetch });

// Workers
export default { fetch: app.fetch };
```

**Three different ways to start the server.** Same `app.fetch` function.

**File system access**:

```typescript
// Deno
const content = await Deno.readTextFile("./file.txt");

// Bun
const content = await Bun.file("./file.txt").text();

// Workers
// No file system - use KV/R2
const content = await env.KV.get("file");
```

**Environment variables**:

```typescript
// Deno
const value = Deno.env.get("KEY");

// Bun/Node
const value = process.env.KEY;

// Workers
const value = env.KEY; // From bindings
```

**External services**:

```typescript
// Deno/Bun - direct database access
const users = await db.users.getAll();

// Workers - use D1, KV, R2, or external APIs
const users = await env.DB.prepare("SELECT * FROM users").all();
```

### Abstracting runtime differences

Create runtime adapters:

```typescript
// lib/runtime.ts
export interface RuntimeAdapter {
  readFile(path: string): Promise<string>;
  getEnv(key: string): string | undefined;
}

// Deno adapter
export const denoAdapter: RuntimeAdapter = {
  readFile: (path) => Deno.readTextFile(path),
  getEnv: (key) => Deno.env.get(key)
};

// Bun adapter
export const bunAdapter: RuntimeAdapter = {
  readFile: async (path) => await Bun.file(path).text(),
  getEnv: (key) => process.env[key]
};

// Workers adapter (no file system)
export const workersAdapter: RuntimeAdapter = {
  readFile: async (path) => {
    throw new Error("File system not available in Workers");
  },
  getEnv: (key) => {
    // Access from context
    return undefined;
  }
};
```

Use in handlers:

```typescript
// Pass adapter through locals
const app = setup({
  handlers: [...],
  
  onRequest: ({ request }) => ({
    runtime: denoAdapter // or bunAdapter, or workersAdapter
  })
});

route.get("/config", {
  resolve: async (c) => {
    const runtime = c.locals.runtime as RuntimeAdapter;
    
    const config = await runtime.readFile("./config.json");
    return new Response(config, {
      headers: { "Content-Type": "application/json" }
    });
  }
})
```

## Environment ≠ API

The runtime environment changes. The API doesn't.

### The separation

```
Your Handlers (portable)
    ↓
Web Standards (Request/Response)
    ↓
Runtime (Deno/Bun/Workers)
```

**Handlers talk to Web Standards, not runtimes.**

This means:
- Write once, run anywhere
- Test in one runtime, deploy to another
- Switch runtimes without rewriting code
- No vendor lock-in

### Testing across runtimes

Your tests work everywhere:

```typescript
// test.ts
import { assertEquals } from "@std/assert";
import { route, setup } from "@hectoday/http";

Deno.test("GET /health returns 200", async () => {
  const app = setup({
    handlers: [
      route.get("/health", {
        resolve: () => Response.json({ status: "ok" })
      })
    ]
  });
  
  const request = new Request("http://localhost/health");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: "ok" });
});
```

**This test runs on Deno, Bun, or any runtime with a test runner.**

### Development vs production

Develop on one runtime, deploy to another:

```typescript
// Same code
const app = setup({
  handlers: [
    route.get("/", {
      resolve: () => new Response("Hello!")
    })
  ]
});

// Different initialization
if (import.meta.env?.DENO) {
  // Development: Deno
  Deno.serve(app.fetch);
} else if (typeof Bun !== "undefined") {
  // Development: Bun
  Bun.serve({ fetch: app.fetch });
} else {
  // Production: Workers
  export default { fetch: app.fetch };
}
```

**Or keep them separate**:

```typescript
// handlers.ts - portable
export const handlers = [
  route.get("/", {
    resolve: () => new Response("Hello!")
  })
];

// deno.ts - Deno-specific
import { setup } from "@hectoday/http";
import { handlers } from "./handlers.ts";

const app = setup({ handlers });
Deno.serve(app.fetch);

// bun.ts - Bun-specific
import { setup } from "@hectoday/http";
import { handlers } from "./handlers.ts";

const app = setup({ handlers });
Bun.serve({ fetch: app.fetch });

// worker.ts - Workers-specific
import { setup } from "@hectoday/http";
import { handlers } from "./handlers.ts";

const app = setup({ handlers });
export default { fetch: app.fetch };
```

**Handlers are pure.** Server setup is runtime-specific.

### The promise of web standards

When you build on Web Standards:

**Your code survives runtime churn**:
- New runtimes emerge → your code still works
- Old runtimes die → migrate easily
- Runtime A is better for feature X → switch without rewriting

**Your skills transfer**:
- Learn Fetch API once → use everywhere
- Know Request/Response → know all runtimes
- Understand Web Standards → understand any platform

**Your dependencies simplify**:
- No runtime-specific HTTP framework
- No adapter layers
- No compatibility shims
- Just Web Standards

### The portability guarantee

```typescript
// This code is a contract
const app = setup({
  handlers: [
    route.get("/", {
      resolve: () => new Response("Hello World")
    })
  ]
});

// As long as the runtime supports:
// 1. Request (Web Standard)
// 2. Response (Web Standard)
// 3. fetch function signature (Web Standard)

// This code will work.
```

**Hectoday HTTP makes one promise: if your runtime implements Web Standards, your handlers will work.**

That's why it's called "runtime independence."

---

Next: [Testing the path](./testing-the-path) - verifying your handlers work correctly.
