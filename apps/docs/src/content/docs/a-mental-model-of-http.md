---
title: "A Mental Model of HTTP"
description: "Understanding HTTP from first principles"
order: 3
part: 1
draft: false
---

Before you write a single line of code, you need a way to think about HTTP servers.

This chapter builds that mental model. No framework concepts yet. Just HTTP itself.

## Every Request Has a Path

When a request arrives at your server, it has already traveled:

```
Browser → DNS → Network → Your Server
```

But once it arrives, it travels again **inside your application**:

```
Socket → Parser → Router → Handler → Response
```

This internal path is what you control as a developer.

### What a Request Is

A request is data sent from a client:

```typescript
interface Request {
  method: string;      // "GET", "POST", etc.
  url: string;         // "https://example.com/users/123?include=posts"
  headers: Headers;    // Key-value pairs
  body: ReadableStream | null;  // Optional payload
}
```

That's it. Nothing more, nothing less.

The request doesn't "know" if it's authorized. It doesn't "know" if its data is valid. It's just bytes that need interpretation.

### What a Response Is

A response is data sent back to the client:

```typescript
interface Response {
  status: number;      // 200, 404, 500, etc.
  statusText: string;  // "OK", "Not Found", etc.
  headers: Headers;    // Key-value pairs
  body: ReadableStream | null;  // Optional payload
}
```

Every request must produce exactly one response. Not zero. Not two. One.

### Why Servers Are Just Functions Over Time

At the lowest level, a server is:

```typescript
function server(request: Request): Response {
  // Do something
  return response;
}
```

But in reality, servers handle many requests over time:

```typescript
// Request 1 arrives
server(request1) // → response1

// Request 2 arrives (before request1 finishes)
server(request2) // → response2

// Request 1 completes
// → response1 sent

// Request 2 completes
// → response2 sent
```

Each request is independent. They might interleave. But each one follows its own path from arrival to response.

**This is the fundamental model**: requests come in, responses go out, and each request has its own isolated path through your code.

## Inbound Request → Outbound Response

Direction matters in HTTP. Understanding the flow from input to output is essential.

### The Directionality of HTTP

```
CLIENT                          SERVER
   |                               |
   |  --- Request (inbound) --->   |
   |                               |
   |                          [processing]
   |                               |
   |  <-- Response (outbound) ---  |
   |                               |
```

**Inbound**: Client to server. You receive this. You don't control its contents.

**Outbound**: Server to client. You create this. You control every byte.

### Why This Perspective Matters

When a request arrives, you're in **reactive mode**:

```typescript
// You didn't choose this method
request.method // "POST"

// You didn't choose this URL
request.url // "https://example.com/users/999999999"

// You didn't choose these headers
request.headers.get("content-type") // "application/xml"

// You didn't choose this body
request.body // ???
```

Everything about the request is **given to you**. You must:
1. Read what exists
2. Interpret what it means
3. Decide what to do
4. Construct a response

You're not calling APIs. You're not fetching data. You're **receiving** input and **producing** output.

### The Asymmetry

```typescript
// Inbound: you must handle anything
request.url // Could be "/users/1" or "/🚀/💥" or "/../../../etc/passwd"
request.headers.get("content-type") // Could be missing, malformed, or lies

// Outbound: you control everything
return new Response(
  JSON.stringify({ id: 1, name: "Alice" }),
  {
    status: 200,
    headers: { "Content-Type": "application/json" }
  }
);
```

**Inbound is hostile.** You must validate everything. Assume nothing.

**Outbound is safe.** You construct exactly what you want to send.

### Why Naming This Changes Design

Most frameworks blur this boundary. They make inbound data feel safe:

```typescript
// Does this exist? Is it valid? Who knows?
const userId = ctx.params.id;

// What happens if this fails? Where does it return?
const user = await db.users.get(userId);
```

When you think in terms of **inbound → processing → outbound**, you see the phases:

```typescript
// Phase 1: Inbound (receive)
const userIdRaw = c.raw.params.id; // string | undefined

// Phase 2: Validate (interpret)
if (!userIdRaw || !/^\d+$/.test(userIdRaw)) {
  // Phase 3: Outbound (respond)
  return Response.json({ error: "Invalid user ID" }, { status: 400 });
}

// Phase 2: Process (decide)
const userId = parseInt(userIdRaw);
const user = await db.users.get(userId);

if (!user) {
  // Phase 3: Outbound (respond)
  return Response.json({ error: "User not found" }, { status: 404 });
}

// Phase 3: Outbound (respond)
return Response.json(user);
```

Each phase is explicit. You see exactly when you're receiving, deciding, and responding.

## Facts Before Decisions

The most important principle in Hectoday HTTP: **separate observation from action**.

### What Is a Fact?

A fact is something you've **observed** but not **acted upon**:

```typescript
// Facts
const method = request.method;                    // Observed: method is "POST"
const authHeader = request.headers.get("authorization"); // Observed: header is missing
const body = await request.json();                // Observed: body is { name: 123 }
```

These are observations. Nothing has happened yet. The request hasn't ended.

### What Is a Decision?

A decision is when you **commit to an outcome**:

```typescript
// Decision
if (!authHeader) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
// If we're here, the request continues

// Decision
if (typeof body.name !== "string") {
  return Response.json({ error: "Invalid name" }, { status: 400 });
}
// If we're here, the request continues

// Decision (success case)
return Response.json({ id: 1, name: body.name }, { status: 201 });
// Request ends here
```

Each `return` is a decision boundary. The request ends.

### Why Separate Them?

Most frameworks mix facts and decisions:

```typescript
// Does this observe or decide? Both?
authenticate(request); // Might return 401, might throw, might continue

// Does this observe or decide? Both?
validate(body, schema); // Might return 400, might throw, might continue
```

When observation and action are mixed, you can't reason about control flow. You don't know where requests end.

### The Hectoday HTTP Way

```typescript
// Phase 1: Gather ALL facts
const raw = {
  params: c.raw.params,
  query: c.raw.query,
  body: c.raw.body,
};

const validation = validator.validate(schema, raw.body);
const authToken = c.request.headers.get("authorization");

// Phase 2: Make ALL decisions
if (!authToken) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

if (!validation.ok) {
  return Response.json({ error: validation.issues }, { status: 400 });
}

// Phase 3: Process with certainty
// If you're here, auth passed and validation passed
const user = await createUser(validation.data);
return Response.json(user, { status: 201 });
```

**Facts are computed once. Decisions are made explicitly. Processing happens only after decisions pass.**

### Why This Matters for Code Structure

When you separate facts from decisions, your code has a shape:

```typescript
function handler(c) {
  // Top of function: facts
  const fact1 = ...;
  const fact2 = ...;
  const fact3 = ...;

  // Middle: decisions (guards)
  if (factX means "not allowed") {
    return Response (deny);
  }

  if (factY means "invalid") {
    return Response (error);
  }

  // Bottom: processing (if all decisions passed)
  const result = process(facts);
  return Response.json(result);
}
```

You can read top-to-bottom and see:
1. What facts exist
2. What might cause denial
3. What happens if everything passes

No hidden branching. No mysterious returns. Just facts, decisions, code.

### The Mental Model Complete

```
Request arrives (inbound)
    ↓
Extract facts (observe)
    ↓
Make decisions (guards)
    ↓
Process (if allowed)
    ↓
Return response (outbound)
```

Every request follows this path. Every handler has this shape.

When you think this way, HTTP becomes predictable. You know where control flow happens. You know where requests end. You know what code runs when.

**This is the mental model Hectoday HTTP is built on.**

---

Next: [The Web Standard Foundation](./the-web-standard-foundation) — how Web APIs provide the primitives for this model.
