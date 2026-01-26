---
title: "The request lifecycle (fully explicit)"
description: "Understanding the complete path of every request"
order: 1
part: 3
draft: false
---

You've seen the pieces. Now see how they fit together.

Every request in Hectoday HTTP follows the same path. Every step is visible. Nothing happens automatically.

## The full path of a request

Here's the complete lifecycle:

```
1. Request arrives
       ↓
2. onRequest hook (optional)
   → Produces initial locals
       ↓
3. Route matching
   → Finds handler by method + path
   → 404 if no match
       ↓
4. Extract raw inputs
   → params from path
   → query from search string
   → body (if schema defined)
       ↓
5. Validate inputs (if schemas defined)
   → Run validator on params/query/body
   → Produce c.input (ok or not ok)
       ↓
6. Run guards (in order)
   → Each guard: allow or deny
   → First deny ends request
   → Each allow can add locals
       ↓
7. Run handler
   → Receives context with all data
   → Must return Response
       ↓
8. onResponse hook (optional)
   → Can modify response
       ↓
9. Send response to client
```

**Every request follows this path.** No exceptions. No shortcuts. No hidden branches.

### Read

The framework extracts raw data from the request:

```typescript
route.post("/orgs/:orgId/users", {
  resolve: (c) => {
    // Framework already extracted these
    c.raw.params.orgId        // From path: /orgs/:orgId/users
    c.raw.query.notify        // From search: ?notify=true
    c.raw.body                // From request body (if parsed)
    
    // Original request is always available
    c.request.method          // "POST"
    c.request.url             // Full URL
    c.request.headers         // All headers
  }
})
```

**What the framework does**:
- Parse URL path against route pattern → `c.raw.params`
- Parse URL search string → `c.raw.query`
- Parse body as JSON (if body schema defined) → `c.raw.body`

**What the framework doesn't do**:
- Validate the data
- Make decisions about it
- Return responses based on it

### Validate

If you defined schemas, the framework runs validation:

```typescript
route.post("/orgs/:orgId/users", {
  request: {
    params: z.object({
      orgId: z.string().uuid()
    }),
    query: z.object({
      notify: z.enum(["true", "false"]).transform(v => v === "true")
    }),
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  },
  resolve: (c) => {
    // Framework already ran validation
    c.input.ok // true or false
    
    if (!c.input.ok) {
      // Framework populated these
      c.input.failed   // ["params"] or ["query", "body"] etc.
      c.input.issues   // Array of validation issues
      c.input.received // Raw values that failed
      
      // YOU decide what this means
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // Framework populated validated, typed data
    c.input.params.orgId  // string (UUID format)
    c.input.query.notify  // boolean
    c.input.body.name     // string
    c.input.body.email    // string (valid email)
  }
})
```

**What the framework does**:
- Call your validator adapter with each schema
- Collect all issues across all parts
- Set `c.input.ok` to true or false
- Provide typed data if validation passed

**What the framework doesn't do**:
- Return 400 automatically
- Format error messages
- Stop the request
- Log validation failures

**You decide** what validation failures mean.

### Guard

Guards run in order. Each can allow or deny:

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
  
  return { allow: true, locals: { user } };
};

const requireAdmin: GuardFn = (c) => {
  const user = c.locals.user; // From requireAuth
  
  if (user.role !== "admin") {
    return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  
  return { allow: true };
};

route.delete("/users/:id", {
  guards: [requireAuth, requireAdmin],
  resolve: (c) => {
    // Only runs if both guards allowed
    const user = c.locals.user; // Available because requireAuth allowed
    return new Response(null, { status: 204 });
  }
})
```

**What the framework does**:
- Run guards in order
- Stop at first denial (send that response)
- Accumulate locals from each allow
- Call handler if all guards allowed

**What the framework doesn't do**:
- Decide what "allowed" means (you define guard logic)
- Automatically check authentication (you write requireAuth)
- Automatically check authorization (you write requireAdmin)
- Log denials
- Retry failed guards

**You decide** what must pass for a request to continue.

### Handle

The handler receives context and returns a Response:

```typescript
route.post("/users", {
  request: {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  },
  guards: [requireAuth],
  resolve: async (c) => {
    // All guards passed (or we wouldn't be here)
    // Validation passed (or c.input.ok would be false)
    
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // c.input.body is typed and validated
    const { name, email } = c.input.body;
    
    // Business logic
    const existingUser = await db.users.findByEmail(email);
    
    if (existingUser) {
      return Response.json(
        { error: "Email already exists" },
        { status: 409 } // Conflict
      );
    }
    
    const user = await db.users.create({ name, email });
    
    return Response.json(user, { status: 201 });
  }
})
```

**What the framework does**:
- Call your handler with context
- Pass the Response you return to the client

**What the framework doesn't do**:
- Catch errors (they go to onError if thrown)
- Validate the Response (any Response is valid)
- Add default headers
- Log the response
- Transform the response

**You decide** everything about the response.

### Respond

The response goes back to the client:

```typescript
route.get("/users/:id", {
  resolve: async (c) => {
    const id = c.raw.params.id;
    const user = await db.users.get(id);
    
    if (!user) {
      // This Response is sent
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    
    // This Response is sent
    return Response.json(user);
  }
})
```

**What the framework does**:
- Take the Response you returned
- Send it to the client

**What the framework doesn't do**:
- Add CORS headers (you add them)
- Add caching headers (you add them)
- Compress the response (runtime handles it)
- Log the response (you log it in onResponse)

The Response you return is the Response the client receives. **What you write is what they get.**

## Complete example: tracing a request

Let's trace a complete request through the system:

```typescript
import { route, setup } from "@hectoday/http";
import { z } from "zod";

// Guards
const requireAuth: GuardFn = (c) => {
  const token = c.request.headers.get("authorization");
  
  if (!token) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  const user = verifyToken(token);
  
  if (!user) {
    return { deny: Response.json({ error: "Invalid token" }, { status: 401 }) };
  }
  
  return { allow: true, locals: { user, userId: user.id } };
};

// Route
const createUserRoute = route.post("/orgs/:orgId/users", {
  request: {
    params: z.object({
      orgId: z.string().uuid()
    }),
    body: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email()
    })
  },
  guards: [requireAuth],
  resolve: async (c) => {
    // Check validation
    if (!c.input.ok) {
      return Response.json(
        { error: "Invalid input", issues: c.input.issues },
        { status: 400 }
      );
    }
    
    const { orgId } = c.input.params;
    const { name, email } = c.input.body;
    const userId = c.locals.userId;
    
    // Business logic
    const org = await db.orgs.get(orgId);
    
    if (!org) {
      return Response.json({ error: "Organization not found" }, { status: 404 });
    }
    
    const canCreate = await db.orgs.canUserCreateMembers(orgId, userId);
    
    if (!canCreate) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const existingUser = await db.users.findByEmail(email);
    
    if (existingUser) {
      return Response.json({ error: "Email already in use" }, { status: 409 });
    }
    
    const newUser = await db.users.create({
      orgId,
      name,
      email,
      createdBy: userId
    });
    
    return Response.json(newUser, { status: 201 });
  }
});

// Setup
const app = setup({
  handlers: [createUserRoute],
  
  onRequest: ({ request }) => {
    return { requestId: crypto.randomUUID(), startTime: Date.now() };
  },
  
  onResponse: ({ context, response }) => {
    const duration = Date.now() - (context.locals.startTime as number);
    console.log({
      requestId: context.locals.requestId,
      method: context.request.method,
      path: new URL(context.request.url).pathname,
      status: response.status,
      duration
    });
    
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", String(context.locals.requestId));
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  },
  
  onError: ({ error, context }) => {
    console.error("Unexpected error:", {
      requestId: context.locals.requestId,
      error,
      path: new URL(context.request.url).pathname
    });
    
    return Response.json(
      { error: "Internal server error", requestId: context.locals.requestId },
      { status: 500 }
    );
  }
});

Deno.serve(app.fetch);
```

### Successful request

```bash
POST /orgs/123e4567-e89b-12d3-a456-426614174000/users
Authorization: Bearer valid-token-here
Content-Type: application/json

{"name":"Alice","email":"alice@example.com"}
```

**The path**:

```
1. Request arrives
   → POST /orgs/123e4567-e89b-12d3-a456-426614174000/users
   
2. onRequest runs
   → Adds: { requestId: "abc-123", startTime: 1234567890 }
   
3. Route matches
   → POST /orgs/:orgId/users matched
   
4. Extract raw inputs
   → c.raw.params.orgId = "123e4567-e89b-12d3-a456-426614174000"
   → c.raw.body = { name: "Alice", email: "alice@example.com" }
   
5. Validate
   → params schema: ✓ valid UUID
   → body schema: ✓ valid name and email
   → c.input.ok = true
   
6. Guards
   → requireAuth runs
   → Token is valid
   → Returns: { allow: true, locals: { user, userId: "user-123" } }
   → c.locals = { requestId: "abc-123", startTime: 1234567890, user: {...}, userId: "user-123" }
   
7. Handler runs
   → c.input.ok is true ✓
   → Check org exists ✓
   → Check permissions ✓
   → Check email not in use ✓
   → Create user
   → Return: Response.json(newUser, { status: 201 })
   
8. onResponse runs
   → Logs request details
   → Adds X-Request-Id header
   → Returns modified Response
   
9. Client receives
   → 201 Created
   → X-Request-Id: abc-123
   → Body: { id: "...", name: "Alice", email: "alice@example.com" }
```

### Failed request (invalid input)

```bash
POST /orgs/not-a-uuid/users
Authorization: Bearer valid-token-here
Content-Type: application/json

{"name":"","email":"not-an-email"}
```

**The path**:

```
1-4. Same as above
   
5. Validate
   → params schema: ✗ "not-a-uuid" is not a valid UUID
   → body schema: ✗ name is too short, email is invalid
   → c.input.ok = false
   → c.input.issues = [
       { part: "params", path: ["orgId"], message: "Invalid UUID" },
       { part: "body", path: ["name"], message: "String must contain at least 1 character" },
       { part: "body", path: ["email"], message: "Invalid email" }
     ]
   
6. Guards
   → requireAuth runs (validation doesn't stop guards)
   → Token is valid
   → Returns: { allow: true, locals: { user, userId: "user-123" } }
   
7. Handler runs
   → c.input.ok is false ✗
   → Returns: Response.json({ error: "Invalid input", issues: [...] }, { status: 400 })
   → Handler returns early (business logic never runs)
   
8. onResponse runs
   → Logs request details
   → Adds X-Request-Id header
   
9. Client receives
   → 400 Bad Request
   → X-Request-Id: abc-123
   → Body: { error: "Invalid input", issues: [...] }
```

### Failed request (no auth)

```bash
POST /orgs/123e4567-e89b-12d3-a456-426614174000/users
Content-Type: application/json

{"name":"Alice","email":"alice@example.com"}
```

**The path**:

```
1-5. Same as successful request
   → Validation passes
   
6. Guards
   → requireAuth runs
   → No Authorization header
   → Returns: { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) }
   → REQUEST ENDS HERE
   
7. Handler NEVER RUNS
   
8. onResponse runs
   → Logs request details
   → Adds X-Request-Id header
   
9. Client receives
   → 401 Unauthorized
   → X-Request-Id: abc-123
   → Body: { error: "Unauthorized" }
```

**Notice**: The handler never ran. The guard denied, request ended.

## Nothing happens automatically

This is the key principle: **the framework does nothing you didn't ask for**.

### No fallback behavior

**No automatic 400 on validation failure**:

```typescript
route.post("/users", {
  request: { body: schema },
  resolve: (c) => {
    // Framework did NOT return 400 automatically
    // YOU must check and decide
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // Continue...
  }
})
```

**No automatic 401 on missing auth**:

```typescript
route.get("/protected", {
  resolve: (c) => {
    const token = c.request.headers.get("authorization");
    
    // Framework did NOT check auth
    // Framework did NOT return 401
    // YOU must check and decide
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Continue...
  }
})
```

Use guards for this:

```typescript
route.get("/protected", {
  guards: [requireAuth], // Explicit
  resolve: (c) => {
    // Auth was checked (or we wouldn't be here)
  }
})
```

**No automatic 500 on errors**:

Errors that escape handlers go to `onError` (if defined) or default error handler:

```typescript
route.get("/users", {
  resolve: async (c) => {
    // If this throws, goes to onError
    const users = await db.users.getAll();
    return Response.json(users);
  }
})
```

But for expected errors, **return explicitly**:

```typescript
route.get("/users/:id", {
  resolve: async (c) => {
    const user = await db.users.get(c.raw.params.id);
    
    // Don't throw - return
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    
    return Response.json(user);
  }
})
```

### No hidden defaults

**No default headers**:

```typescript
// Framework does NOT add:
// - CORS headers
// - Cache-Control headers
// - Content-Security-Policy headers
// - Any other headers

// YOU add what you need:
return new Response(JSON.stringify(data), {
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=3600",
    "Access-Control-Allow-Origin": "*"
  }
});
```

**No default error format**:

```typescript
// Framework does NOT enforce error format
// YOU choose:

// Option 1: Simple
{ error: "Not found" }

// Option 2: Detailed
{ error: { message: "Not found", code: "USER_NOT_FOUND" } }

// Option 3: JSON:API
{ errors: [{ status: "404", title: "Not found", detail: "..." }] }

// Option 4: Problem Details (RFC 7807)
{ type: "...", title: "...", status: 404, detail: "..." }
```

**No default content negotiation**:

```typescript
// Framework does NOT check Accept header
// YOU check if you care:

route.get("/users/:id", {
  resolve: async (c) => {
    const user = await db.users.get(c.raw.params.id);
    
    if (!user) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    
    const accept = c.request.headers.get("accept");
    
    if (accept === "application/xml") {
      return new Response(toXML(user), {
        headers: { "Content-Type": "application/xml" }
      });
    }
    
    return Response.json(user);
  }
})
```

**No default logging**:

```typescript
// Framework does NOT log:
// - Request arrivals
// - Response statuses
// - Errors
// - Durations

// YOU log in hooks:
const app = setup({
  handlers: [...],
  
  onRequest: ({ request }) => {
    console.log(`→ ${request.method} ${new URL(request.url).pathname}`);
    return { startTime: Date.now() };
  },
  
  onResponse: ({ context, response }) => {
    const duration = Date.now() - (context.locals.startTime as number);
    console.log(`← ${response.status} (${duration}ms)`);
    return response;
  },
  
  onError: ({ error, context }) => {
    console.error(`✗ ${error}`);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
});
```

### What this means

**You can trace every request by reading code**:

1. Look at route definition → see guards, schemas, handler
2. Read guards → see exactly what might deny
3. Read handler → see exactly what responses can return
4. Read hooks → see what side effects happen

**No magic. No hidden behavior. Just explicit code.**

---

Next: [Hooks: the three extension points](./hooks-the-three-extension-points) - understanding onRequest, onResponse, and onError in depth.
