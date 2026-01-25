---
title: "Describing Facts"
description: "Extracting request data without making decisions"
order: 3
part: 2
draft: false
---

The request has arrived. The route matched. Now you need to read its data.

But **reading is not deciding**. This chapter is about observation: extracting facts from requests without committing to outcomes.

## What Is a "Fact"?

A fact is something you've **observed** but haven't **acted upon**.

### The Difference

```typescript
// Observing (fact)
const authHeader = c.request.headers.get("authorization");
// We know: header exists or doesn't exist
// We haven't decided: what that means

// Deciding (action)
if (!authHeader) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
// We decided: missing header means 401
```

Facts are passive. Decisions are active. **Separate them.**

### Reading the Request Without Deciding

When you read request data, you're gathering information:

```typescript
route.get("/users/:id", {
  resolve: (c) => {
    // Gathering facts
    const id = c.raw.params.id;              // What ID was requested?
    const includeParam = c.raw.query.include; // What should be included?
    const acceptHeader = c.request.headers.get("accept"); // What format?
    
    // These are observations. Nothing has happened yet.
    // The request hasn't ended. No response has been sent.
    
    // Now you can decide what these facts mean...
  }
})
```

You're not validating. You're not authorizing. You're not processing. You're just **reading what exists**.

### Extracting Data Safely

HTTP requests are hostile. Clients can send anything:

```typescript
// These are all possible
c.raw.params.id   // undefined | "123" | "999999999999" | "../../../etc/passwd" | "💩"
c.raw.query.page  // undefined | "1" | "-1" | "not-a-number" | ["1", "2", "3"]
c.raw.body        // undefined | { valid: "json" } | "not json" | null | []
```

**Never trust raw data.** Observe it, then validate it (next chapter).

Hectoday HTTP extracts data into `c.raw` without interpreting it:

```typescript
interface RawValues {
  params: Record<string, string | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}
```

Everything in `c.raw` is **unvalidated**. Use it carefully.

## Reading the URL

URLs contain two types of data: **path parameters** and **query parameters**.

### Path Parameters

Path parameters come from the URL pattern:

```typescript
route.get("/users/:id", {
  resolve: (c) => {
    const id = c.raw.params.id;
    // id is string | undefined
    
    return Response.json({ id });
  }
})

// GET /users/123 → id = "123"
// GET /users/abc → id = "abc"
// GET /users/    → route doesn't match
```

Multiple parameters:

```typescript
route.get("/orgs/:orgId/repos/:repoId", {
  resolve: (c) => {
    const orgId = c.raw.params.orgId;   // string | undefined
    const repoId = c.raw.params.repoId; // string | undefined
    
    return Response.json({ orgId, repoId });
  }
})

// GET /orgs/acme/repos/http
// → orgId = "acme", repoId = "http"
```

**Important**: Path params are always strings (if they exist). Even if the URL is `/users/123`, `c.raw.params.id` is the **string** `"123"`, not the number `123`.

To use as a number:

```typescript
route.get("/users/:id", {
  resolve: (c) => {
    const idStr = c.raw.params.id;
    
    // Validate it's a number
    if (!idStr || !/^\d+$/.test(idStr)) {
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    }
    
    // Now safe to parse
    const id = parseInt(idStr, 10);
    return Response.json({ id });
  }
})
```

Or use validation (next chapter):

```typescript
route.get("/users/:id", {
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/).transform(Number)
    })
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    const id = c.input.params.id; // number (typed and validated)
    return Response.json({ id });
  }
})
```

### Query Parameters

Query parameters come from the URL search string:

```typescript
route.get("/search", {
  resolve: (c) => {
    const query = c.raw.query.q;
    const page = c.raw.query.page;
    
    return Response.json({ query, page });
  }
})

// GET /search?q=hello&page=2
// → query = "hello", page = "2"
```

**Query params are also strings**:

```typescript
// GET /search?page=2
c.raw.query.page // "2" (string), not 2 (number)
```

### Query Parameter Arrays

Query parameters can appear multiple times:

```typescript
route.get("/filter", {
  resolve: (c) => {
    const tags = c.raw.query.tag;
    // tags is string | string[] | undefined
    
    return Response.json({ tags });
  }
})

// GET /filter?tag=javascript
// → tags = "javascript"

// GET /filter?tag=javascript&tag=typescript
// → tags = ["javascript", "typescript"]
```

Handle both cases:

```typescript
route.get("/filter", {
  resolve: (c) => {
    const tagsRaw = c.raw.query.tag;
    
    // Normalize to array
    const tags = tagsRaw === undefined
      ? []
      : Array.isArray(tagsRaw)
      ? tagsRaw
      : [tagsRaw];
    
    return Response.json({ tags });
  }
})
```

### Missing Query Parameters

```typescript
route.get("/search", {
  resolve: (c) => {
    const query = c.raw.query.q;
    
    if (!query) {
      return Response.json(
        { error: "Missing query parameter 'q'" },
        { status: 400 }
      );
    }
    
    return Response.json({ query });
  }
})

// GET /search
// → query = undefined → returns 400
```

### Search Params vs Internal Naming

The URL uses `?key=value` syntax. Internally, you access via object properties:

```typescript
// URL: /search?q=hello&max_results=10&include-draft=true

route.get("/search", {
  resolve: (c) => {
    const q = c.raw.query.q;                    // "hello"
    const maxResults = c.raw.query.max_results; // "10"
    const includeDraft = c.raw.query["include-draft"]; // "true"
    
    // Note: hyphens and underscores are preserved
    return Response.json({ q, maxResults, includeDraft });
  }
})
```

JavaScript property access rules apply:
- `c.raw.query.max_results` works (valid identifier)
- `c.raw.query["include-draft"]` needed (hyphen not valid in dot notation)

### The Full URL

If you need more than params and query, use `c.request.url`:

```typescript
route.get("/example", {
  resolve: (c) => {
    const url = new URL(c.request.url);
    
    url.protocol   // "https:"
    url.hostname   // "example.com"
    url.port       // "443"
    url.pathname   // "/example"
    url.search     // "?key=value"
    url.hash       // "#section" (rarely used on server)
    
    return Response.json({ url: url.href });
  }
})
```

## Reading the Body

Request bodies are more complex than URLs. They're optional, can be large, and come in various formats.

### When a Body Exists

Not all requests have bodies:

```typescript
// These typically have NO body
GET /users
HEAD /users
DELETE /users/123

// These typically HAVE a body
POST /users
PUT /users/123
PATCH /users/123
```

But HTTP doesn't enforce this. A GET request **can** have a body (though it's rare and discouraged).

Check if a body exists:

```typescript
route.post("/users", {
  resolve: async (c) => {
    if (!c.request.body) {
      return Response.json(
        { error: "Missing request body" },
        { status: 400 }
      );
    }
    
    // Body exists, read it
    const data = await c.request.json();
    return Response.json(data);
  }
})
```

### Reading the Body Manually

The Fetch API provides several methods:

```typescript
// JSON
const data = await c.request.json();

// Text
const text = await c.request.text();

// Form data
const form = await c.request.formData();

// Binary
const buffer = await c.request.arrayBuffer();
```

**Warning**: You can only read the body **once**:

```typescript
route.post("/echo", {
  resolve: async (c) => {
    const text1 = await c.request.text();
    const text2 = await c.request.text(); // ❌ Throws! Body already consumed
    
    return new Response(text1);
  }
})
```

### JSON as a Fact, Not a Guarantee

When you call `c.request.json()`, you're asking: "Parse this body as JSON."

But the body might not be JSON:

```typescript
route.post("/users", {
  resolve: async (c) => {
    try {
      const data = await c.request.json();
      // Data is unknown - could be anything
      return Response.json({ received: data });
    } catch (error) {
      // Body wasn't valid JSON
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }
  }
})
```

The client might send:
- Valid JSON: `{ "name": "Alice" }`
- Invalid JSON: `{ name: Alice }` (missing quotes)
- Not JSON at all: `<xml>data</xml>`
- Empty body: (nothing)

**Never assume the body is what you expect.** Validate it.

### Hectoday HTTP's Body Parsing

When you define a `body` schema, Hectoday HTTP automatically parses the body **as JSON**:

```typescript
route.post("/users", {
  request: {
    body: z.object({ name: z.string() })
  },
  resolve: (c) => {
    // Hectoday HTTP already parsed c.request.json()
    // Result is in c.raw.body
    
    if (!c.input.ok) {
      // Either JSON parsing failed OR validation failed
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    // Body is valid JSON AND passed schema validation
    const name = c.input.body.name;
    return Response.json({ name });
  }
})
```

**How it works**:

1. Framework sees you defined `request.body` schema
2. Framework calls `c.request.json()` automatically
3. If JSON parsing fails → `c.input.ok = false`, issue: "Invalid JSON"
4. If JSON parsing succeeds → validate against schema
5. If validation fails → `c.input.ok = false`, issues from validator
6. If validation passes → `c.input.ok = true`, typed data in `c.input.body`

**Important limitations**:

- Only JSON is auto-parsed (not form data, not XML, not multipart)
- Body is only parsed when you define a `body` schema
- If you need non-JSON bodies, parse manually:

```typescript
route.post("/upload", {
  resolve: async (c) => {
    const formData = await c.request.formData();
    const file = formData.get("file");
    
    if (!file || typeof file === "string") {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    
    // file is a File object
    const bytes = await file.arrayBuffer();
    return Response.json({ size: bytes.byteLength });
  }
})
```

### Empty Bodies

An empty body is not an error, it's a fact:

```typescript
route.post("/ping", {
  resolve: async (c) => {
    const body = c.raw.body; // undefined (if no schema defined)
    
    // Or with schema:
    // const text = await c.request.text(); // "" (empty string)
    
    return Response.json({ received: body === undefined });
  }
})
```

If your endpoint requires a body, **you** must check:

```typescript
route.post("/users", {
  resolve: async (c) => {
    if (!c.request.body) {
      return Response.json(
        { error: "Request body required" },
        { status: 400 }
      );
    }
    
    const data = await c.request.json();
    return Response.json(data);
  }
})
```

Or define a schema (which will fail validation if body is empty):

```typescript
route.post("/users", {
  request: {
    body: z.object({ name: z.string() }) // Empty body will fail
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ error: c.input.issues }, { status: 400 });
    }
    
    return Response.json(c.input.body);
  }
})
```

### Content-Type Header

The `Content-Type` header tells you what format the body is:

```typescript
route.post("/data", {
  resolve: async (c) => {
    const contentType = c.request.headers.get("content-type");
    
    if (contentType === "application/json") {
      const data = await c.request.json();
      return Response.json(data);
    } else if (contentType === "text/plain") {
      const text = await c.request.text();
      return new Response(text);
    } else {
      return Response.json(
        { error: `Unsupported content type: ${contentType}` },
        { status: 415 } // Unsupported Media Type
      );
    }
  }
})
```

**But don't trust it**. Clients can lie:

```typescript
// Client sends:
// Content-Type: application/json
// Body: <xml>not json</xml>

const data = await c.request.json(); // Throws!
```

Always wrap parsing in try/catch or use validation.

### Facts About the Body

To summarize:

**Facts**:
- Body exists or doesn't exist: `c.request.body !== null`
- Content-Type header says something: `c.request.headers.get("content-type")`
- Body can be read as text/JSON/form/binary: `await c.request.json()`

**Not facts**:
- Body is valid JSON (must try parsing)
- Body matches your schema (must validate)
- Body is the right format (must check and handle errors)

**Observation**: "The body claims to be JSON and when parsed contains `{ name: 123 }`"

**Decision**: "A name must be a string, so this request is invalid → return 400"

---

Next: [Validation without control flow](./validation-without-control-flow) - turning raw facts into validated data.
