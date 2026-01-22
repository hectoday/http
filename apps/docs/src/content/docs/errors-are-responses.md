---
title: "Errors Are Responses"
description: "Handling failures explicitly without exceptions"
order: 9
draft: true
---

Not all requests succeed. Some fail because of invalid input. Some fail because of authorization. Some fail because of bugs.

In Hectoday HTTP, **expected failures are responses**. Only unexpected failures are exceptions.

## Errors Are Not Exceptions

Most frameworks blur the line between expected and unexpected failures:

```typescript
// In many frameworks
app.post("/users", (req, res) => {
  // Is this expected or unexpected?
  if (!req.body.email) {
    throw new ValidationError("Email required"); // → 400
  }
  
  // Is this expected or unexpected?
  if (!req.user) {
    throw new UnauthorizedError(); // → 401
  }
  
  // Is this expected or unexpected?
  const user = await db.users.create(req.body); // Might throw → 500
});
```

When you throw, you're saying: "Something went wrong, framework figure it out."

The framework maps exceptions to status codes. `ValidationError` becomes 400. `UnauthorizedError` becomes 401. Database errors become 500.

**This is implicit.** You can't tell from reading the handler what status codes it returns.

### Hectoday HTTP's Model

In Hectoday HTTP, there are two types of failures:

**Expected failures**: Return a Response explicitly

```typescript
route.post("/users", {
  resolve: async (c) => {
    // Expected failure: invalid input
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // Expected failure: unauthorized
    if (!c.locals.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Expected failure: duplicate email
    const existing = await db.users.findByEmail(c.input.body.email);
    if (existing) {
      return Response.json({ error: "Email already exists" }, { status: 409 });
    }
    
    // Success
    const user = await db.users.create(c.input.body);
    return Response.json(user, { status: 201 });
  }
})
```

**Unexpected failures**: Throw (goes to onError)

```typescript
route.get("/users", {
  resolve: async (c) => {
    // If this throws, it's unexpected (bug, infrastructure failure)
    const users = await db.users.getAll();
    return Response.json(users);
  }
})
```

### The Distinction

**Expected failure**:
- You know it might happen
- It's part of normal operation
- The client can handle it
- Examples: validation errors, not found, unauthorized, conflict

**Unexpected failure**:
- You didn't expect it to happen
- It's a bug or infrastructure problem
- The client can't do much about it
- Examples: database connection lost, out of memory, null pointer

### Why Throwing Breaks the Mental Model

When you throw to indicate expected failures, you hide control flow:

```typescript
// Where does this request end?
function handler() {
  validateInput(data); // Might throw → 400
  checkAuth(token);    // Might throw → 401
  checkPermissions();  // Might throw → 403
  
  // Are we here? Or did we already return?
  const result = process();
  return Response.json(result);
}
```

You can't tell by reading this code:
- What status codes this handler returns
- Where the request might end
- What error responses look like

With explicit returns, everything is visible:

```typescript
route.post("/users", {
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
      // ↑ Request ends here, returns 400
    }
    
    if (!c.locals.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
      // ↑ Request ends here, returns 401
    }
    
    if (c.locals.user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
      // ↑ Request ends here, returns 403
    }
    
    // If we're here, all checks passed
    const result = await process(c.input.body);
    return Response.json(result, { status: 201 });
    // ↑ Request ends here, returns 201
  }
})
```

Every `return` is visible. You can trace the control flow. You can see exactly what responses this handler returns.

## Modeling Failure

Different types of failures need different responses.

### Invalid Input

When the client sends malformed or invalid data:

```typescript
route.post("/users", {
  request: {
    body: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      age: z.number().int().min(0).max(150)
    })
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        {
          error: "Validation failed",
          issues: c.input.issues
        },
        { status: 400 }
      );
    }
    
    // Input is valid
    const user = await db.users.create(c.input.body);
    return Response.json(user, { status: 201 });
  }
})
```

**Status code**: `400 Bad Request`

**Body**: Explains what's wrong with the input:

```json
{
  "error": "Validation failed",
  "issues": [
    {
      "part": "body",
      "path": ["email"],
      "message": "Invalid email address"
    },
    {
      "part": "body",
      "path": ["age"],
      "message": "Number must be less than or equal to 150"
    }
  ]
}
```

### Unauthorized Access

When the client isn't authenticated:

```typescript
const requireAuth: GuardFn = (c) => {
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
  
  return { allow: true, locals: { user } };
};
```

**Status code**: `401 Unauthorized`

**Body**: Explains why authentication failed:

```json
{
  "error": "Invalid or expired token"
}
```

You might also include helpful information:

```json
{
  "error": "Missing authentication token",
  "hint": "Include an Authorization header with a valid token",
  "docs": "https://example.com/docs/authentication"
}
```

### Forbidden Access

When the client is authenticated but not authorized:

```typescript
const requireAdmin: GuardFn = (c) => {
  const user = c.locals.user;
  
  if (!user || user.role !== "admin") {
    return {
      deny: Response.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    };
  }
  
  return { allow: true };
};
```

**Status code**: `403 Forbidden`

**Body**: Explains what permission is required:

```json
{
  "error": "Admin access required"
}
```

### Not Found

When the requested resource doesn't exist:

```typescript
route.get("/users/:id", {
  resolve: async (c) => {
    const id = c.raw.params.id;
    const user = await db.users.get(id);
    
    if (!user) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    return Response.json(user);
  }
})
```

**Status code**: `404 Not Found`

**Body**: Explains what wasn't found:

```json
{
  "error": "User not found"
}
```

You might include the ID that wasn't found:

```json
{
  "error": "User not found",
  "userId": "123"
}
```

### Conflict

When the request conflicts with current state:

```typescript
route.post("/users", {
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const { email } = c.input.body;
    const existing = await db.users.findByEmail(email);
    
    if (existing) {
      return Response.json(
        {
          error: "Email already exists",
          field: "email",
          value: email
        },
        { status: 409 }
      );
    }
    
    const user = await db.users.create(c.input.body);
    return Response.json(user, { status: 201 });
  }
})
```

**Status code**: `409 Conflict`

**Body**: Explains the conflict:

```json
{
  "error": "Email already exists",
  "field": "email",
  "value": "alice@example.com"
}
```

### Unprocessable Entity

When the input is valid but semantically incorrect:

```typescript
route.post("/transfers", {
  request: {
    body: z.object({
      fromAccount: z.string(),
      toAccount: z.string(),
      amount: z.number().positive()
    })
  },
  resolve: async (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const { fromAccount, toAccount, amount } = c.input.body;
    
    // Input is valid, but business rules say this is wrong
    if (fromAccount === toAccount) {
      return Response.json(
        { error: "Cannot transfer to the same account" },
        { status: 422 }
      );
    }
    
    const balance = await db.accounts.getBalance(fromAccount);
    
    if (balance < amount) {
      return Response.json(
        {
          error: "Insufficient funds",
          available: balance,
          requested: amount
        },
        { status: 422 }
      );
    }
    
    const transfer = await db.transfers.create({ fromAccount, toAccount, amount });
    return Response.json(transfer, { status: 201 });
  }
})
```

**Status code**: `422 Unprocessable Entity`

**Body**: Explains why the business logic rejected it:

```json
{
  "error": "Insufficient funds",
  "available": 100.50,
  "requested": 200.00
}
```

### Internal Errors

When something unexpected happens (bugs, infrastructure failures):

```typescript
route.get("/users", {
  resolve: async (c) => {
    try {
      const users = await db.users.getAll();
      return Response.json(users);
    } catch (error) {
      // Log the error
      console.error("Failed to fetch users:", error);
      
      // Return generic error to client
      return Response.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
  }
})
```

**Or let it throw and handle in onError**:

```typescript
const app = setup({
  handlers: [...],
  
  onError: (error, c) => {
    // Log with context
    console.error("Unexpected error:", {
      error,
      method: c.request.method,
      url: c.request.url,
      user: c.locals.user?.id
    });
    
    // Return sanitized error to client
    return Response.json(
      {
        error: "Internal server error",
        requestId: c.locals.requestId
      },
      { status: 500 }
    );
  }
});
```

**Status code**: `500 Internal Server Error`

**Body**: Generic message (don't leak implementation details):

```json
{
  "error": "Internal server error",
  "requestId": "abc-123"
}
```

**Never** expose stack traces or internal details to clients in production.

## Returning Errors Explicitly

Errors are just Responses. Return them like any other response.

### Status Codes as Facts

Status codes communicate **what kind of failure** occurred:

| Code | Meaning | When to Use |
|------|---------|-------------|
| `400` | Bad Request | Client sent invalid/malformed data |
| `401` | Unauthorized | Client needs to authenticate |
| `403` | Forbidden | Client is authenticated but not authorized |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Request conflicts with current state |
| `422` | Unprocessable Entity | Valid input, but business rules reject it |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server failure |
| `503` | Service Unavailable | Server temporarily can't handle request |

Use the right status code for the situation:

```typescript
route.post("/users", {
  resolve: async (c) => {
    // 400: Invalid input structure
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // 401: Not authenticated
    if (!c.locals.user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    
    // 403: Authenticated but not authorized
    if (c.locals.user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    
    // 409: Duplicate resource
    const existing = await db.users.findByEmail(c.input.body.email);
    if (existing) {
      return Response.json({ error: "Email already exists" }, { status: 409 });
    }
    
    // 201: Successfully created
    const user = await db.users.create(c.input.body);
    return Response.json(user, { status: 201 });
  }
})
```

**Each status code tells a different story.** Choose the one that best describes what happened.

### Bodies as Explanations

The response body explains **what went wrong** and **what to do about it**.

**Minimal**:

```typescript
return Response.json(
  { error: "Not found" },
  { status: 404 }
);
```

**Detailed**:

```typescript
return Response.json(
  {
    error: "User not found",
    userId: id,
    message: "No user exists with the specified ID"
  },
  { status: 404 }
);
```

**With suggestions**:

```typescript
return Response.json(
  {
    error: "Invalid email format",
    field: "email",
    received: "not-an-email",
    hint: "Email must be in format: user@example.com"
  },
  { status: 400 }
);
```

**With error codes**:

```typescript
return Response.json(
  {
    error: "Insufficient funds",
    code: "INSUFFICIENT_FUNDS",
    available: 100.50,
    requested: 200.00,
    hint: "Deposit more funds or reduce the transfer amount"
  },
  { status: 422 }
);
```

**With links**:

```typescript
return Response.json(
  {
    error: "Rate limit exceeded",
    code: "RATE_LIMIT_EXCEEDED",
    limit: 100,
    remaining: 0,
    resetAt: "2024-01-01T00:00:00Z",
    docs: "https://example.com/docs/rate-limits"
  },
  { status: 429 }
);
```

### Consistent Error Format

Choose a format and stick to it across your API:

**Simple format**:

```typescript
interface ErrorResponse {
  error: string;
  details?: unknown;
}

// Usage
return Response.json(
  { error: "User not found", details: { userId: id } },
  { status: 404 }
);
```

**Detailed format**:

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    hint?: string;
  };
}

// Usage
return Response.json(
  {
    error: {
      code: "USER_NOT_FOUND",
      message: "No user exists with the specified ID",
      details: { userId: id },
      hint: "Check that the user ID is correct"
    }
  },
  { status: 404 }
);
```

**JSON:API format** (if you're following that spec):

```typescript
return Response.json(
  {
    errors: [
      {
        status: "404",
        code: "USER_NOT_FOUND",
        title: "User not found",
        detail: "No user exists with the specified ID",
        meta: { userId: id }
      }
    ]
  },
  { status: 404 }
);
```

**Problem Details (RFC 7807)**:

```typescript
return new Response(
  JSON.stringify({
    type: "https://example.com/problems/user-not-found",
    title: "User Not Found",
    status: 404,
    detail: "No user exists with the specified ID",
    instance: `/users/${id}`,
    userId: id
  }),
  {
    status: 404,
    headers: { "Content-Type": "application/problem+json" }
  }
);
```

**Hectoday HTTP doesn't enforce a format.** Choose what works for your API and use it consistently.

### Helper Functions

Reduce repetition with error helpers:

```typescript
// helpers/errors.ts
export function badRequest(message: string, details?: unknown) {
  return Response.json(
    { error: message, details },
    { status: 400 }
  );
}

export function unauthorized(message: string = "Unauthorized") {
  return Response.json(
    { error: message },
    { status: 401 }
  );
}

export function forbidden(message: string = "Forbidden") {
  return Response.json(
    { error: message },
    { status: 403 }
  );
}

export function notFound(message: string, details?: unknown) {
  return Response.json(
    { error: message, details },
    { status: 404 }
  );
}

export function conflict(message: string, details?: unknown) {
  return Response.json(
    { error: message, details },
    { status: 409 }
  );
}

// Usage
route.get("/users/:id", {
  resolve: async (c) => {
    const id = c.raw.params.id;
    
    if (!id) {
      return badRequest("Missing user ID");
    }
    
    const user = await db.users.get(id);
    
    if (!user) {
      return notFound("User not found", { userId: id });
    }
    
    return Response.json(user);
  }
})
```

**These are just helpers—not framework magic.** They're pure functions that return Responses.

### The Pattern

```
Something fails
    ↓
Determine the type of failure
    ↓
Choose appropriate status code
    ↓
Construct helpful response body
    ↓
Return Response explicitly
```

**No throwing. No exception mapping. Just explicit returns.**

Every error response is visible in the handler. You control exactly what clients see.

---

Next: [Composition Over Configuration](./composition-over-configuration) — building larger APIs from small pieces.
