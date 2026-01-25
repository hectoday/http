---
title: "What this is"
description: "Understanding Hectoday HTTP's purpose and philosophy"
order: 1
part: 1
draft: false
---

Hectoday HTTP is a web framework that refuses to make decisions for you.

Most frameworks decide what your HTTP responses mean. They see validation failures and return 400. They see missing auth tokens and return 401. They catch errors and return 500.

Hectoday HTTP does none of this.

Instead, it **describes facts** and lets **you commit reality**.

## The Core Idea

```typescript
// Hectoday HTTP gives you facts
if (!c.input.ok) {
  // What does this mean? You decide.
  // 400? 422? 200 with error object? Your call.
  return Response.json({ error: c.input.issues }, { status: 400 });
}

// If you didn't return, you're still here
// The framework never returns for you
```

Hectoday HTTP computes:
- Raw inputs (params, query, body)
- Validation results (ok or not ok)
- Guard outcomes (allow or deny)

**You decide what these facts mean as HTTP.**

## What Problems It Solves

### Hidden Control Flow

Most frameworks have invisible branching:

```typescript
// In many frameworks, this line might end the request
validateBody(schema);

// Did we return? Are we still here? Who knows?
```

With Hectoday HTTP, nothing happens unless you cause it:

```typescript
// This never returns
const result = validator.validate(schema, input);

// You're definitely still here
if (!result.ok) {
  return Response.json({ error: result.issues }, { status: 400 });
}
```

### Implicit Meaning

Frameworks often assign meaning to code patterns:

```typescript
// Does this return 401? 403? Is there a guard running?
requireAuth();

// What actually happens here?
```

Hectoday HTTP makes decisions explicit:

```typescript
// A guard returns a result
const guard = (c) => {
  if (!c.request.headers.get("authorization")) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { allow: true };
};

// You see exactly when and how requests end
```

### Framework Lock-In

Most frameworks wrap Web standards:

```typescript
// Framework-specific
ctx.header("X-Custom", "value");
ctx.body({ data: "..." });
ctx.status(201);
```

Hectoday HTTP uses Fetch API everywhere:

```typescript
// Web standard (works in Deno, Bun, Workers, browsers)
return new Response(JSON.stringify({ data: "..." }), {
  status: 201,
  headers: { "X-Custom": "value" },
});
```

## What It Intentionally Does Not Solve

### Convenience Over Clarity

Hectoday HTTP will never auto-return 400 on validation failure. That would be convenient, but it would hide the decision.

### Magic Error Handling

Hectoday HTTP will never catch handler errors and return 500. You handle errors explicitly or they go to `onError`.

### Opinionated Responses

Hectoday HTTP will never format error objects for you. JSON:API? Problem Details? Your schema? You choose.

### Middleware Chains

Hectoday HTTP has no middleware. Instead, it has:
- `onRequest` - gathers facts before routing
- Guards - make allow/deny decisions
- Handlers - return responses

Each step has exactly one job.

## Who This Is For

### You Want Explicit Control

You want to **see** every decision boundary in your code. You don't want the framework guessing what you meant.

### You Value Web Standards

You want to write code that works across Deno, Bun, Cloudflare Workers, and future runtimes. You don't want to rewrite when platforms change.

### You Think in Facts and Decisions

You separate **observing reality** from **committing to outcomes**. You want your framework to match this mental model.

### You're Building Something That Lasts

You want code that's still readable in 3 years. You want new team members to understand the request flow by reading handlers, not docs.

## Who This Is Not For

### You Want Rapid Prototyping

If you need to ship fast and don't care about explicitness, use something with more magic. Hectoday HTTP optimizes for clarity over speed of development.

### You Want Batteries Included

Hectoday HTTP has no built-in ORM, no template engine, no session middleware. It's a request handler, nothing more.

### You Want Convention Over Configuration

Hectoday HTTP has almost no conventions. You write explicit code for every case. If you prefer "it just works" magic, this isn't it.

## The Philosophy in One Sentence

**Hectoday HTTP describes what happened. You decide what it means.**

---

The framework never makes HTTP decisions. It computes facts about requests. Guards make allow/deny decisions. Handlers commit responses.

Everything else is your job. And that's the point.
