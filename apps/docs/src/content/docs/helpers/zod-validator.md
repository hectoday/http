---
title: "Zod Validator: Schema Validation Adapter"
description: "Validator adapter for using Zod schemas with Hectoday HTTP"
draft: false
---

A validator adapter that integrates Zod schemas with Hectoday HTTP's validation system.

## The Code

```typescript
import type {
  InferSchema,
  InferSchemaError,
  ValidateResult,
  ValidationIssue,
  ValidationPart,
  Validator,
} from "@hectoday/http";
import type { ZodType } from "zod";

export const zodValidator: Validator<ZodType> = {
  validate<S extends ZodType>(
    schema: S,
    input: unknown,
    part: ValidationPart,
  ): ValidateResult<InferSchema<S>, InferSchemaError<S>> {
    const result = schema.safeParse(input);

    if (result.success) {
      return { ok: true, value: result.data as InferSchema<S> };
    }

    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      part,
      path: issue.path.map(String),
      message: issue.message,
      code: issue.code,
    }));

    return {
      ok: false,
      issues,
      error: result.error as InferSchemaError<S>,
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
  validate<S extends TSchema>(
    schema: S,
    input: unknown,
    part: ValidationPart,
  ): ValidateResult<InferSchema<S>, InferSchemaError<S>>;
}

type ValidationPart = "params" | "query" | "body";

type ValidateResult<T, TRawErr = unknown> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly ValidationIssue[]; error?: TRawErr };

interface ValidationIssue {
  part: ValidationPart;
  path: readonly string[];
  message: string;
  code?: string;
}
```

## Other Schema Libraries

You can create adapters for other validation libraries:

### Valibot

```typescript
import type { ValidationPart, Validator } from "@hectoday/http";
import * as v from "valibot";

export const valibotValidator: Validator<v.BaseSchema> = {
  validate<S extends v.BaseSchema>(schema: S, input: unknown, part: ValidationPart) {
    const result = v.safeParse(schema, input);

    if (result.success) {
      return { ok: true as const, value: result.output };
    }

    return {
      ok: false as const,
      issues: result.issues.map((issue) => ({
        part,
        path: issue.path?.map((p) => String(p.key)) ?? [],
        message: issue.message,
      })),
      error: result.issues,
    };
  },
};
```

### Yup

```typescript
import type { ValidationPart, Validator } from "@hectoday/http";
import type { AnySchema, ValidationError } from "yup";

export const yupValidator: Validator<AnySchema> = {
  validate<S extends AnySchema>(schema: S, input: unknown, part: ValidationPart) {
    try {
      const validated = schema.validateSync(input, { abortEarly: false });
      return { ok: true as const, value: validated };
    } catch (error) {
      if ((error as ValidationError).name === "ValidationError") {
        const validationError = error as ValidationError;
        return {
          ok: false as const,
          issues: validationError.inner.map((err) => ({
            part,
            path: err.path?.split(".") ?? [],
            message: err.message,
          })),
          error: validationError,
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
