# @hectoday/http

**An explicit, standards-first HTTP framework built for learning.**

`@hectoday/http` is a minimal web framework that exposes the real mechanics of
HTTP. Nothing is hidden. No magic. Every step is visible and intentional.

It is designed first and foremost as a **teaching tool**, but it is fully usable
for real applications.

---

## Why this exists

Most frameworks abstract HTTP away.

`@hectoday/http` does the opposite.

You work directly with:

- `Request`
- `Response`
- headers
- status codes
- routing
- guards

So you actually learn **how the web works** — not just how to use a framework.

---

## Design principles

- **Web standards first** Built on the Fetch API and platform primitives.

- **Explicit control flow** You always decide what happens. No implicit
  behavior. No hidden responses.

- **Minimal surface area** Small API. Easy to reason about.

- **Education-first** Clarity > convenience Understanding > shortcuts

---

## Example

```ts
import { route, setup } from "@hectoday/http";

const app = setup([
  route.get("/", {
    resolve: () => {
      return new Response("Hello HTTP");
    },
  }),
]);

Deno.serve(app.fetch);
```

No wrappers. No custom response objects. Just HTTP.

---

## What this is great for

- Learning HTTP properly
- Teaching web fundamentals
- Understanding request lifecycles
- Building APIs
- Experimenting with protocol-level behavior

---

## What this is _not_

- A batteries-included framework
- A "magic" DX-first abstraction

This project values **clarity over convenience**.

---

## Documentation

Full docs: 👉 **[https://docs.hectoday.com](https://docs.hectoday.com)**

Docs live in the repository and accept community contributions.

---

## Contributing

Contributions are welcome ❤️

- Code improvements
- Documentation fixes
- Examples
- Typos

See `CONTRIBUTING.md`.

---

## License

- **Code:** MIT
- **Documentation:** CC BY 4.0

---

## Philosophy

> Learn the protocol. Then build the abstractions.
