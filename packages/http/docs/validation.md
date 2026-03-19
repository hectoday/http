# Validation

Validation in Hectoday HTTP describes data. It never decides what happens next.

```ts
route.post("/users", {
  request: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  },
  resolve: (c) => {
    // Validation already ran. Check the result.
    if (!c.input.ok) {
      // FACT: data doesn't match the schema
      // DECISION: you choose what that means
      return Response.json({ error: c.input.issues }, { status: 400 });
    }

    // If you're here, validation passed.
    c.input.body.name; // string — typed and safe
    c.input.body.email; // string — typed and safe

    return Response.json({ created: true }, { status: 201 });
  },
});
```

The framework ran `safeParse` on your Zod schema and put the result on `c.input`. It didn't return 400. It didn't throw. It computed a fact and gave it to you.

## `c.input`

A discriminated union. Check `c.input.ok` first.

When validation passes (`c.input.ok === true`):

```ts
c.input.params; // typed from params schema, or Record<string, string>
c.input.query; // typed from query schema, or Record<string, string | string[] | undefined>
c.input.body; // typed from body schema, or unknown
c.input.issues; // [] (empty)
c.input.failed; // [] (empty)
```

When validation fails (`c.input.ok === false`):

```ts
c.input.params; // undefined
c.input.query; // undefined
c.input.body; // undefined
c.input.issues; // ValidationIssue[]
c.input.failed; // ("params" | "query" | "body")[]
```

TypeScript narrows the type after the `c.input.ok` check. Inside the `if (!c.input.ok)` block, you get the issues. After it, you get typed data.

## Validation issues

Each issue tells you what went wrong and where:

```ts
interface ValidationIssue {
  part: "params" | "query" | "body";
  path: readonly string[];
  message: string;
  code?: string;
}
```

For example, posting `{ name: "", email: "bad" }` against the schema above produces:

```json
[
  {
    "part": "body",
    "path": ["name"],
    "message": "String must contain at least 1 character(s)",
    "code": "too_small"
  },
  { "part": "body", "path": ["email"], "message": "Invalid email", "code": "invalid_string" }
]
```

`c.input.failed` tells you which parts failed: `["body"]` in this case.

## Validating params, query, and body independently

Each schema is optional. Define only what you need:

```ts
// Just params
route.get("/users/:id", {
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  resolve: (c) => { ... },
})

// Just query
route.get("/search", {
  request: {
    query: z.object({
      q: z.string(),
      page: z.coerce.number().default(1),
    }),
  },
  resolve: (c) => { ... },
})

// Just body
route.post("/users", {
  request: {
    body: z.object({ name: z.string() }),
  },
  resolve: (c) => { ... },
})

// All three
route.post("/orgs/:orgId/users", {
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    query: z.object({ notify: z.coerce.boolean().default(false) }),
    body: z.object({ name: z.string(), email: z.string().email() }),
  },
  resolve: (c) => { ... },
})

// None — c.input.ok is always true
route.get("/health", {
  resolve: (c) => { ... },
})
```

All schemas are validated in parallel. If both params and body fail, `c.input.issues` contains issues from both, and `c.input.failed` is `["params", "body"]`.

## Body parsing

When a `body` schema is defined, the framework calls `request.json()` automatically before validation. If the body isn't valid JSON, `c.input.ok` is `false` with a special issue:

```json
{ "part": "body", "path": [], "message": "Invalid JSON", "code": "invalid_json" }
```

Without a `body` schema, the body is not parsed. Use `c.request.json()` manually:

```ts
route.post("/webhook", {
  resolve: async (c) => {
    const payload = await c.request.json();
    // payload is unknown — no schema, no validation
    return Response.json({ received: true });
  },
});
```

Note: `c.request.json()` can only be called once. If you define a body schema, the framework already consumed the body stream.

## Zod transforms

Zod transforms work naturally:

```ts
route.get("/users", {
  request: {
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      active: z.coerce.boolean().default(true),
    }),
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }

    c.input.query.page; // number (coerced from string "3")
    c.input.query.limit; // number (coerced from string "50")
    c.input.query.active; // boolean (coerced from string "true")
  },
});
```

Query parameters arrive as strings. `z.coerce.number()` converts them. `z.default()` provides fallbacks. TypeScript sees the output types.

## The pattern

Every handler with schemas follows the same shape:

```ts
resolve: async (c) => {
  if (!c.input.ok) {
    return Response.json({ error: c.input.issues }, { status: 400 });
  }

  // Everything below here has typed, validated data
  // ...
};
```

Three lines of validation handling. Then your logic. The check is explicit, the error format is yours, and you can see exactly where the request might end.
