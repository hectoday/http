---
title: "Zod Validator - Schema Validation Adapter"
description: "Validator adapter for using Zod schemas with Hectoday HTTP"
draft: true
---

A validator adapter that integrates Zod schemas with Hectoday HTTP's validation system.

## The Code

```typescript
import type { Validator } from "@hectoday/http";
import type { ZodSchema } from "zod";

export const zodValidator: Validator<ZodSchema> = {
  safeParse: (schema: ZodSchema, data: unknown) => {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }
    
    return {
      success: false,
      error: {
        issues: result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
    };
  },
};
```

## Installation

First, install Zod:

```bash
# Deno
deno add npm:zod

# Bun
bun add zod

# npm
npm install zod
```

## Usage

### Basic Setup

```typescript
import { setup, route } from "@hectoday/http";
import { z } from "zod";

// Copy the zodValidator code above here
// Or save it to helpers/zodValidator.ts

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
          return Response.json(
            { error: "Invalid input", issues: c.input.issues },
            { status: 400 }
          );
        }
        
        // c.input.body is typed as { name: string; email: string }
        const { name, email } = c.input.body;
        
        return Response.json({ id: 1, name, email }, { status: 201 });
      },
    }),
  ],
});
```

### With Params, Query, and Body

```typescript
route.post("/orgs/:orgId/users", {
  request: {
    params: z.object({
      orgId: z.string().uuid(),
    }),
    query: z.object({
      notify: z.enum(["email", "sms", "none"]).default("email"),
    }),
    body: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      role: z.enum(["admin", "member", "viewer"]),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json(
        { error: "Validation failed", issues: c.input.issues },
        { status: 400 }
      );
    }
    
    // All fully typed!
    const orgId = c.input.params.orgId;       // string (UUID)
    const notify = c.input.query.notify;      // "email" | "sms" | "none"
    const { name, email, role } = c.input.body;
    
    return Response.json({ 
      orgId, 
      notify, 
      user: { name, email, role } 
    });
  },
});
```

## Advanced Zod Features

### Transformations

```typescript
route.get("/users", {
  request: {
    query: z.object({
      page: z.string().transform(Number).pipe(z.number().int().positive()),
      limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // c.input.query.page is number (not string!)
    // c.input.query.limit is number (not string!)
    const { page, limit } = c.input.query;
    
    return Response.json({
      users: [],
      pagination: { page, limit, total: 0 },
    });
  },
});
```

### Refinements

```typescript
route.post("/register", {
  request: {
    body: z.object({
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string(),
    }).refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const { email, password } = c.input.body;
    
    return Response.json({ success: true });
  },
});
```

### Optional Fields

```typescript
route.patch("/users/:id", {
  request: {
    body: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      bio: z.string().max(500).optional(),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // c.input.body: { name?: string; email?: string; bio?: string }
    const updates = c.input.body;
    
    return Response.json({ updated: updates });
  },
});
```

### Default Values

```typescript
route.get("/search", {
  request: {
    query: z.object({
      q: z.string(),
      sort: z.enum(["relevance", "date", "popularity"]).default("relevance"),
      order: z.enum(["asc", "desc"]).default("desc"),
      limit: z.string().transform(Number).pipe(z.number().default(20)),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const { q, sort, order, limit } = c.input.query;
    // sort defaults to "relevance" if not provided
    // order defaults to "desc" if not provided
    // limit defaults to 20 if not provided
    
    return Response.json({ query: q, sort, order, limit, results: [] });
  },
});
```

## Reusable Schemas

Define schemas once, reuse everywhere:

```typescript
// schemas/user.ts
import { z } from "zod";

export const userIdSchema = z.string().uuid();

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

export const updateUserSchema = createUserSchema.partial();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
```

```typescript
// routes/users.ts
import { route } from "@hectoday/http";
import { createUserSchema, updateUserSchema, userIdSchema } from "../schemas/user.ts";

const createUserRoute = route.post("/users", {
  request: {
    body: createUserSchema,
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const user = c.input.body;
    return Response.json({ id: "123", ...user }, { status: 201 });
  },
});

const updateUserRoute = route.patch("/users/:id", {
  request: {
    params: z.object({ id: userIdSchema }),
    body: updateUserSchema,
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const { id } = c.input.params;
    const updates = c.input.body;
    
    return Response.json({ id, ...updates });
  },
});
```

## Error Messages

Zod provides detailed error messages:

```typescript
// Request: POST /users
// Body: { name: "", email: "invalid" }

// Response:
{
  "error": "Validation failed",
  "issues": [
    {
      "path": ["name"],
      "message": "String must contain at least 1 character(s)"
    },
    {
      "path": ["email"],
      "message": "Invalid email"
    }
  ]
}
```

## Custom Error Messages

```typescript
route.post("/users", {
  request: {
    body: z.object({
      name: z.string().min(1, "Name is required").max(100, "Name too long"),
      email: z.string().email("Invalid email address"),
      age: z.number().int("Age must be a whole number").min(18, "Must be 18 or older"),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    return Response.json({ success: true });
  },
});
```

## Type Inference

TypeScript automatically infers types from Zod schemas:

```typescript
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().positive(),
  role: z.enum(["admin", "user"]),
});

route.post("/users", {
  request: { body: userSchema },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // TypeScript knows the exact type:
    // c.input.body: {
    //   name: string;
    //   email: string;
    //   age: number;
    //   role: "admin" | "user";
    // }
    const { name, email, age, role } = c.input.body;
  },
});
```

## Adapter Interface

The validator adapter implements the `Validator` interface:

```typescript
interface Validator<TSchema> {
  safeParse: (
    schema: TSchema,
    data: unknown
  ) => SafeParseResult;
}

type SafeParseResult =
  | { success: true; data: unknown }
  | { success: false; error: { issues: ValidationIssue[] } };

interface ValidationIssue {
  path: (string | number)[];
  message: string;
}
```

## Other Schema Libraries

You can create adapters for other validation libraries:

### Valibot

```typescript
import type { Validator } from "@hectoday/http";
import * as v from "valibot";

export const valibotValidator: Validator<v.BaseSchema> = {
  safeParse: (schema, data) => {
    const result = v.safeParse(schema, data);
    
    if (result.success) {
      return {
        success: true,
        data: result.output,
      };
    }
    
    return {
      success: false,
      error: {
        issues: result.issues.map((issue) => ({
          path: issue.path?.map((p) => p.key) ?? [],
          message: issue.message,
        })),
      },
    };
  },
};
```

### Yup

```typescript
import type { Validator } from "@hectoday/http";
import type { AnySchema } from "yup";

export const yupValidator: Validator<AnySchema> = {
  safeParse: async (schema, data) => {
    try {
      const validated = await schema.validate(data, { abortEarly: false });
      return {
        success: true,
        data: validated,
      };
    } catch (error) {
      if (error.name === "ValidationError") {
        return {
          success: false,
          error: {
            issues: error.inner.map((err) => ({
              path: err.path?.split(".") ?? [],
              message: err.message,
            })),
          },
        };
      }
      throw error;
    }
  },
};
```

## Notes

- Validator is **set once** in `setup()` and used for all routes
- Schemas are defined **per route** in the `request` field
- Validation happens **before guards** run
- Use `c.input.ok` to check if validation passed
- `c.input.issues` contains detailed error information
- `c.raw` always contains unvalidated data
- Type inference works automatically with Zod

## Why Not Built-In?

Hectoday HTTP is validator-agnostic. Different projects use different schema libraries:
- Some use Zod
- Some use Valibot
- Some use Yup
- Some use custom validators
- Some don't validate at all

The adapter pattern lets you plug in any validator you want. Copy this adapter and modify for your validation library of choice.
