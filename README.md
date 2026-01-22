# @hectoday/http

**An explicit, standards-first HTTP framework built for learning.**

`@hectoday/http` is a minimal web framework that exposes the real mechanics of HTTP. Nothing is hidden. No magic. Every step is visible and intentional.

It is designed first and foremost as a **teaching tool**, but it is fully usable for real applications.

---

## Why this exists

Most frameworks abstract HTTP away.

`@hectoday/http` does the opposite.

You work directly with:

- `Request` and `Response` (Web Standards)
- Headers, status codes, and URLs
- Explicit routing and validation
- Pure guard functions

So you actually learn **how the web works** — not just how to use a framework.

---

## Quick Example

```ts
import { route, setup } from "@hectoday/http";
import { z } from "zod";

const app = setup({
  handlers: [
    route.get("/", {
      resolve: () => new Response("Hello HTTP"),
    }),
    
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
        return Response.json({ name, email }, { status: 201 });
      },
    }),
  ],
});

Deno.serve(app.fetch);
```

No wrappers. No custom response objects. Just HTTP.

---

## Design Principles

- **Web standards first**  
  Built on the Fetch API and platform primitives.

- **Explicit control flow**  
  You always decide what happens. No implicit behavior. No hidden responses.

- **Minimal surface area**  
  Small API. Easy to reason about.

- **Education-first**  
  Clarity > convenience. Understanding > shortcuts.

---

## What Makes It Different

### 1. Nothing is Hidden

```ts
// Other frameworks
app.get("/user", (req, res) => {
  res.json({ user }); // What status? What headers? Where's the Response?
});

// Hectoday HTTP
route.get("/user", {
  resolve: () => {
    return Response.json({ user }); // Explicit Web Standard Response
  }
});
```

### 2. You Control All Decisions

```ts
// Validation describes facts, YOU decide what it means
if (!c.input.ok) {
  // Your choice: 400? 422? Custom format?
  return Response.json({ error: c.input.issues }, { status: 400 });
}

// Guards describe authorization, YOU decide the response
const requireAuth: GuardFn = (c) => {
  if (!isAuthorized(c)) {
    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { allow: true };
};
```

### 3. Request Lifecycle is Explicit

```
Request → onRequest → Route Match → Validate → Guards → Handler → onResponse → Response
```

Every step is visible. No magic middleware chains.

---

## What This Is Great For

- **Learning HTTP properly**  
  Understand requests, responses, headers, status codes

- **Teaching web fundamentals**  
  Show students how the web actually works

- **Understanding request lifecycles**  
  See every step from request to response

- **Building APIs**  
  Production-ready for Deno, Bun, Cloudflare Workers

- **Experimenting with HTTP**  
  Protocol-level control for research and prototyping

---

## What This Is Not

- A batteries-included framework
- A "magic" DX-first abstraction
- A framework that makes decisions for you

This project values **clarity over convenience**.

---

## Documentation

📚 **Full documentation:** [https://hectoday.com/docs](https://hectoday.com/docs)

**Start here:**
- [How to Read These Docs](https://hectoday.com/docs/how-to-read-these-docs)
- [A Mental Model of HTTP](https://hectoday.com/docs/a-mental-model-of-http)
- [Your First Server](https://hectoday.com/docs/your-first-server)

**Core concepts:**
- [The Web Standard Foundation](https://hectoday.com/docs/the-web-standard-foundation)
- [Validation Without Control Flow](https://hectoday.com/docs/validation-without-control-flow)
- [Guards: Making Decisions Explicit](https://hectoday.com/docs/guards-making-decisions-explicit)
- [Hooks: The Three Extension Points](https://hectoday.com/docs/hooks-the-three-extension-points)

**Helpers (copy-paste recipes):**
- [helpers](https://hectoday.com/docs/helpers)

---

## Installation

```bash
# Deno
deno add jsr:@hectoday/http

# Bun
bunx jsr add @hectoday/http

# npm
npx jsr add @hectoday/http
```

---

## Examples

See working examples in [`example/`](https://github.com/hectoday/http/tree/main/example):
- [Deno example](https://github.com/hectoday/http/tree/main/example/deno) - Full-featured API with auth, validation, guards
- [Bun example](https://github.com/hectoday/http/tree/main/example/bun) - Basic Bun setup

---

## Contributing

Contributions are welcome ❤️

- Code improvements
- Documentation fixes and clarifications
- More examples
- Typos and formatting

See [CONTRIBUTING.md](https://github.com/hectoday/http/blob/main/CONTRIBUTING.md).

---

## License

- **Code:** MIT
- **Documentation:** CC BY 4.0 (see [`apps/docs/LICENSE`](https://github.com/hectoday/http/blob/main/apps/docs/LICENSE))

---

## Philosophy

> **Learn the protocol. Then build the abstractions.**

Hectoday HTTP teaches you HTTP by exposing it, not hiding it. Once you understand how HTTP works at the protocol level, you can build any abstraction you need.

---

## Monorepo Structure

This repository contains:

- [`packages/http/`](https://github.com/hectoday/http/tree/main/packages/http) - Core framework
- [`apps/docs/`](https://github.com/hectoday/http/tree/main/apps/docs) - Documentation site
- [`example/`](https://github.com/hectoday/http/tree/main/example) - Example applications
- [`benchmarks/`](https://github.com/hectoday/http/tree/main/benchmarks) - Performance benchmarks

---

## Community

- **Issues:** [GitHub Issues](https://github.com/hectoday/http/issues)
- **Discussions:** [GitHub Discussions](https://github.com/hectoday/http/discussions)

---

**Built with clarity in mind. No magic. Just HTTP.**
