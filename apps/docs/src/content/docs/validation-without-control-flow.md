---
title: "Validation without control flow"
description: "Using validation to describe data, not control requests"
order: 4
part: 2
draft: false
---

You've extracted facts from the request. Now you need to know: **does this data match what you expect?**

Validation answers that question. But in Hectoday HTTP, validation **never decides what happens next**. It only describes whether data is valid.

## Validation as Description

Most frameworks make validation a decision boundary:

```typescript
// In many frameworks, this line might return 400
validate(body, schema);

// Are we still here? Did it throw? Did it return? Who knows?
```

Hectoday HTTP treats validation as **observation**:

```typescript
// This never returns, never throws (to you)
const result = validator.validate(schema, body, "body");

// You're definitely still here
// Now you decide what the result means
if (!result.ok) {
  return Response.json({ error: result.issues }, { status: 400 });
}
```

### The Distinction

**Validation** answers: "Does this data match the schema?"

**Decision** answers: "What should I do about it?"

These are separate concerns:

```typescript
route.post("/users", {
  request: {
    body: z.object({
      name: z.string(),
      age: z.number().min(0)
    })
  },
  resolve: (c) => {
    // Validation describes the data
    if (!c.input.ok) {
      // ↑ FACT: data doesn't match schema
      
      // ↓ DECISION: what does that mean?
      return Response.json(
        { error: "Invalid user data", issues: c.input.issues },
        { status: 400 }
      );
    }
    
    // If we're here, validation passed
    const { name, age } = c.input.body;
    return Response.json({ name, age });
  }
})
```

Validation computed a fact: `c.input.ok = false`. You decided what it means: return 400.

### Why This Matters

When validation and control flow are separate, you can:

**Use validation results multiple ways**:

```typescript
if (!c.input.ok) {
  // Different routes, different responses
  if (c.request.headers.get("accept") === "application/json") {
    return Response.json({ errors: c.input.issues }, { status: 400 });
  } else {
    return new Response(
      `Validation failed: ${c.input.issues.map(i => i.message).join(", ")}`,
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }
}
```

**Log before responding**:

```typescript
if (!c.input.ok) {
  console.warn("Validation failed:", {
    path: c.request.url,
    issues: c.input.issues,
    received: c.input.received
  });
  
  return Response.json({ error: c.input.issues }, { status: 400 });
}
```

**Transform validation errors**:

```typescript
if (!c.input.ok) {
  // Custom error format
  const errors = c.input.issues.reduce((acc, issue) => {
    const key = issue.path.join(".");
    acc[key] = issue.message;
    return acc;
  }, {} as Record<string, string>);
  
  return Response.json({ errors }, { status: 400 });
}
```

If validation auto-returned, you couldn't do any of this.

## Valid vs Invalid ≠ Allowed vs Denied

This is crucial: **validation and authorization are different concerns**.

### Valid Data Can Be Denied

```typescript
route.post("/admin/users", {
  guards: [requireAdmin],
  request: {
    body: z.object({ name: z.string() })
  },
  resolve: (c) => {
    // Data is valid (or we'd see c.input.ok = false)
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // Data is valid, but...
    if (c.input.body.name === "root") {
      // Business rule: can't create user named "root"
      return Response.json(
        { error: "Reserved username" },
        { status: 422 } // Unprocessable Entity
      );
    }
    
    return Response.json({ created: c.input.body.name });
  }
})
```

The data **is** valid JSON matching the schema. But it's still rejected because of a business rule.

### Invalid Data Might Not Mean 400

```typescript
route.post("/users", {
  request: {
    body: z.object({ name: z.string() })
  },
  resolve: (c) => {
    if (!c.input.ok) {
      // Maybe log and return 500 for unexpected formats
      if (c.input.issues.some(i => i.message === "Invalid JSON")) {
        console.error("Client sent malformed JSON");
        return Response.json(
          { error: "Request format error" },
          { status: 500 } // Not their fault, maybe
        );
      }
      
      // Normal validation errors
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    return Response.json({ name: c.input.body.name });
  }
})
```

You control the semantics. Validation just describes the data.

### The Layers

```
Request arrives
    ↓
Extract raw data (facts)
    ↓
Validate (facts about validity)
    ↓
Authorize (decision: allowed?)
    ↓
Business rules (decision: acceptable?)
    ↓
Process (action)
```

Each layer has a different job. **Validation is just one fact-gathering step.**

## Validators Return Information

When Hectoday HTTP runs validation, it calls your validator adapter:

```typescript
interface Validator<TSchema> {
  validate<S extends TSchema>(
    schema: S,
    input: unknown,
    part: "params" | "query" | "body"
  ): ValidateResult<InferSchema<S>, InferSchemaError<S>>;
}

type ValidateResult<T, TErr> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[]; error?: TErr };
```

Validators **return data**, they don't control flow.

### Success

When data is valid:

```typescript
{
  ok: true,
  value: { name: "Alice", age: 30 }
}
```

The `value` is the validated, typed data. Use it safely:

```typescript
if (c.input.ok) {
  const name = c.input.body.name; // Type-safe: string
  const age = c.input.body.age;   // Type-safe: number
}
```

### Failure

When data is invalid:

```typescript
{
  ok: false,
  issues: [
    {
      part: "body",
      path: ["age"],
      message: "Expected number, received string",
      code: "invalid_type"
    }
  ],
  error: /* original error from validator library */
}
```

The `issues` array contains normalized errors:

```typescript
interface ValidationIssue {
  part: "params" | "query" | "body";
  path: readonly string[];
  message: string;
  code?: string;
}
```

### Metadata

The validator can include the original error object:

```typescript
{
  ok: false,
  issues: [/* normalized */],
  error: zodError // The original Zod error object
}
```

This lets you access library-specific details:

```typescript
if (!c.input.ok && c.input.errors?.body) {
  // c.input.errors.body is the original validator error
  const zodError = c.input.errors.body as z.ZodError;
  
  // Use Zod-specific features
  const formatted = zodError.format();
  return Response.json({ errors: formatted }, { status: 400 });
}
```

But the normalized `issues` array is always available for generic handling.

### What Gets Validated

Hectoday HTTP validates three parts independently:

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
    if (!c.input.ok) {
      // c.input.failed tells you which parts failed
      console.log("Failed parts:", c.input.failed); // ["params"] or ["query", "body"]
      
      // c.input.issues contains all issues across all parts
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // All parts validated successfully
    const orgId = c.input.params.orgId;   // string (UUID)
    const notify = c.input.query.notify;  // boolean
    const { name, email } = c.input.body; // { name: string, email: string }
    
    return Response.json({ orgId, notify, name, email });
  }
})
```

Each schema is optional. Validate only what you need:

```typescript
// Just params
route.get("/users/:id", {
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const id = c.input.params.id;
    return Response.json({ id });
  }
})

// Just body
route.post("/users", {
  request: {
    body: z.object({ name: z.string() })
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const name = c.input.body.name;
    return Response.json({ name });
  }
})

// No validation
route.get("/health", {
  resolve: () => Response.json({ status: "ok" })
  // c.input.ok is always true when no schemas defined
})
```

## Composing Validators

Validation schemas compose **at the data level**, not the control flow level.

### Layering Without Branching

Build complex schemas from simple ones:

```typescript
// Reusable schemas
const NameSchema = z.string().min(1).max(100);
const EmailSchema = z.string().email();
const AgeSchema = z.number().int().min(0).max(150);

// Compose them
const UserSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  age: AgeSchema
});

const AdminUserSchema = UserSchema.extend({
  permissions: z.array(z.string())
});

// Use in routes
route.post("/users", {
  request: { body: UserSchema },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    return Response.json(c.input.body);
  }
})

route.post("/admin/users", {
  request: { body: AdminUserSchema },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    return Response.json(c.input.body);
  }
})
```

**No branching**. Each route independently declares its schema. Validation runs once. You decide what to do with the result.

### Conditional Validation

Sometimes validation depends on context:

```typescript
route.patch("/users/:id", {
  resolve: async (c) => {
    const id = c.raw.params.id;
    const updates = c.raw.body as Record<string, unknown>;
    
    // Different schemas for different update types
    if (updates.type === "email") {
      const schema = z.object({
        type: z.literal("email"),
        email: z.string().email()
      });
      
      const result = schema.safeParse(updates);
      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      
      await updateEmail(id, result.data.email);
      return Response.json({ updated: "email" });
    }
    
    if (updates.type === "password") {
      const schema = z.object({
        type: z.literal("password"),
        password: z.string().min(8)
      });
      
      const result = schema.safeParse(updates);
      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      
      await updatePassword(id, result.data.password);
      return Response.json({ updated: "password" });
    }
    
    return Response.json({ error: "Unknown update type" }, { status: 400 });
  }
})
```

You can validate manually when needed. Hectoday HTTP doesn't force you into one pattern.

### Validator Adapters

Hectoday HTTP is validator-agnostic. Bring your own:

**For a complete, copy-paste ready Zod validator adapter**, see the [Zod Validator helper documentation](./helpers/zod-validator).

**Zod** (simplified example):

```typescript
import { z } from "zod";

const validator = {
  validate(schema: z.ZodType, input: unknown, part: string) {
    const result = schema.safeParse(input);
    if (result.success) {
      return { ok: true, value: result.data };
    }
    
    return {
      ok: false,
      issues: result.error.issues.map(issue => ({
        part,
        path: issue.path.map(String),
        message: issue.message,
        code: issue.code
      })),
      error: result.error
    };
  }
};
```

**Valibot**:

```typescript
import * as v from "valibot";

const validator = {
  validate(schema: v.BaseSchema, input: unknown, part: string) {
    const result = v.safeParse(schema, input);
    if (result.success) {
      return { ok: true, value: result.output };
    }
    
    return {
      ok: false,
      issues: result.issues.map(issue => ({
        part,
        path: issue.path?.map(p => String(p.key)) ?? [],
        message: issue.message,
        code: issue.type
      })),
      error: result.issues
    };
  }
};
```

**ArkType**:

```typescript
import type { Type } from "arktype";

const validator = {
  validate(schema: Type, input: unknown, part: string) {
    const result = schema(input);
    if (result instanceof type.errors) {
      return {
        ok: false,
        issues: result.map(err => ({
          part,
          path: err.path,
          message: err.message,
          code: err.code
        })),
        error: result
      };
    }
    
    return { ok: true, value: result };
  }
};
```

All adapt the same interface. Your handlers don't change when you switch validators.

### No Validator Required

If you don't define schemas, you don't need a validator:

```typescript
const app = setup({
  handlers: [
    route.get("/health", {
      resolve: () => Response.json({ status: "ok" })
    })
  ]
  // No validator needed
});
```

Validation is opt-in. Use it when you need type safety and structured error handling. Skip it when you don't.

### The Pattern

```
Request arrives
    ↓
Extract raw data (unsafe)
    ↓
Validate (produce fact: valid or invalid)
    ↓
Check c.input.ok (you decide what it means)
    ↓
If invalid → return error response (you choose format and status)
    ↓
If valid → use c.input.* (type-safe, validated data)
```

Validation produces facts. You make decisions. **No hidden control flow.**

---

Next: [Guards: making decisions explicit](./guards-making-decisions-explicit) - the other half of request control.
