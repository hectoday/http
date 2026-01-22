# @hectoday/http

> **A minimal, explicit web framework built on Web Standards.**

Hectoday HTTP is designed around one core idea:

> **The framework describes facts. You decide what HTTP means.**

No hidden control flow. No magic responses. No implicit error handling.

---

## Quick Start

### Installation

```bash
# Deno
deno add jsr:@hectoday/http

# Bun
bunx jsr add @hectoday/http

# npm
npx jsr add @hectoday/http
```

### Basic Example

```ts
import { route, setup } from "@hectoday/http";

const app = setup({
  handlers: [
    route.get("/hello", {
      resolve: () => new Response("Hello world"),
    }),
  ],
});

Deno.serve(app.fetch);
```

### With Validation

```ts
import { route, setup } from "@hectoday/http";
import { z } from "zod";
import { zodValidator } from "./helpers/zodValidator.ts"; // Copy from docs

const app = setup({
  validator: zodValidator,
  handlers: [
    route.post("/users", {
      request: {
        body: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      },
      resolve: (c) => {
        if (!c.input.ok) {
          return Response.json({ error: c.input.issues }, { status: 400 });
        }
        
        const { name, email } = c.input.body; // Fully typed!
        return Response.json({ id: 1, name, email }, { status: 201 });
      },
    }),
  ],
});
```

### With Guards

```ts
import { route, type GuardFn } from "@hectoday/http";

const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    return {
      deny: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  
  const user = verifyToken(token);
  return { allow: true, locals: { user } };
};

route.get("/profile", {
  guards: [requireAuth],
  resolve: (c) => {
    const user = c.locals.user;
    return Response.json({ user });
  },
});
```

---

## Core Concepts

### Request Lifecycle

```
Request
   ↓
onRequest (add locals)
   ↓
Route matching
   ↓
Validation (if schemas defined)
   ↓
Guards (allow / deny)
   ↓
Handler (returns Response)
   ↓
onResponse (transform response)
   ↓
Response sent
```

### Context (`c`)

Every handler and guard receives a context object:

```ts
interface Context {
  request: Request;      // Standard Web Request
  raw: RawValues;        // Extracted but unvalidated inputs
  input: InputState;     // Validation results
  locals: object;        // Request-scoped data
}
```

**Important:** Use `c.request` for standard HTTP primitives:
- `c.request.headers`
- `c.request.method`
- `new URL(c.request.url)`

### Hooks

Three extension points for cross-cutting concerns:

```ts
setup({
  handlers: [...],
  
  // Runs before routing
  onRequest: ({ request }) => ({
    requestId: crypto.randomUUID(),
  }),
  
  // Runs after handler succeeds
  onResponse: ({ context, response }) => {
    const headers = new Headers(response.headers);
    headers.set("x-request-id", context.locals.requestId);
    return new Response(response.body, { status: response.status, headers });
  },
  
  // Runs when handler throws
  onError: ({ error, context }) => {
    console.error("Error:", error);
    return Response.json({ error: "Internal Error" }, { status: 500 });
  },
});
```

---

## Documentation

📚 **Full documentation:** [https://hectoday.com/docs](https://hectoday.com/docs)

- [Getting Started](https://hectoday.com/docs/your-first-server)
- [Validation](https://hectoday.com/docs/validation-without-control-flow)
- [Guards](https://hectoday.com/docs/guards-making-decisions-explicit)
- [Hooks](https://hectoday.com/docs/hooks-the-three-extension-points)
- [API Reference](https://hectoday.com/docs/reference)

### Helper Recipes

Copy-paste helpers (no dependencies needed):
- [helpers](https://hectoday.com/docs/helpers)

---

## Philosophy

### Design Laws

1. **One decision boundary**  
   Only handlers and guards can end a request.

2. **No hidden branching**  
   Nothing auto-returns 400/401/403 for you.

3. **Facts before decisions**  
   The framework computes raw inputs, validation results, and guard outcomes.  
   You decide what they mean.

4. **Errors are responses**  
   Expected failures are returned explicitly.

5. **Unexpected failures throw**  
   Bugs go to one error boundary (`onError`).

### What Hectoday HTTP Decides

- Returns 404 if no route matches
- Returns 500 on uncaught throw
- Computes validation results (`c.input.ok`)

### What YOU Decide

- 400 for validation errors
- 401/403 for auth failures
- 409 for conflicts
- 200/201 for success
- **All HTTP semantics**

---

## Core API

### `route`

```ts
route.get(path, config): Handler
route.post(path, config): Handler
route.put(path, config): Handler
route.patch(path, config): Handler
route.delete(path, config): Handler
route.head(path, config): Handler
route.options(path, config): Handler
route.all(path, config): Handler  // Any method
route.on(method, path, config): Handler
```

### `setup`

```ts
setup({
  handlers: Handler[];
  validator?: Validator<TSchema>;
  onRequest?: (info: { request: Request }) => void | object;
  onResponse?: (info: { context: Context; response: Response }) => Response;
  onError?: (info: { error: unknown; context: Context }) => Response;
}): { fetch: (req: Request) => Promise<Response> }
```

### `group`

```ts
group({
  guards: GuardFn[];
  handlers: Handler[];
}): Handler[]
```

Prepends guards to all handlers in the group.

---

## Runtime Compatibility

Works everywhere Web Standards work:

- ✅ Deno
- ✅ Bun
- ✅ Cloudflare Workers
- ✅ Node.js (with Fetch support)

```ts
// Deno
Deno.serve(app.fetch);

// Bun
Bun.serve({ fetch: app.fetch });

// Cloudflare Workers
export default { fetch: app.fetch };
```

---

## Examples

See [`example/deno/src/main.ts`](https://github.com/hectoday/http/blob/main/example/deno/src/main.ts) for a complete working example.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](https://github.com/hectoday/http/blob/main/CONTRIBUTING.md)

---

## License

- Code: MIT
- Documentation: CC BY 4.0

---

> **Learn the protocol. Then build the abstractions.**
