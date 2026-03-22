# Hectoday HTTP

A web framework that refuses to make decisions for you.

```ts
import { setup, route } from "@hectoday/http";

const app = setup({
  routes: [
    route.get("/hello", {
      resolve: () => Response.json({ message: "Hello World" }),
    }),
  ],
});

Deno.serve(app.fetch);
```

## Documentation

### Getting started

1. [Installation](./installation.md)
2. [Your first server](./your-first-server.md)

### Core concepts

3. [Routes](./routes.md)
4. [Validation](./validation.md)
5. [Auth](./auth.md)
6. [Hooks](./hooks.md)

### Practical

7. [Project structure](./project-structure.md)
8. [Testing](./testing.md)
9. [CORS](./cors.md)
10. [OpenAPI](./openapi.md)
11. [Client types](./client-types.md)
12. [Versioning](./versioning.md)
13. [Serving](./serving.md)

### Recipes

14. [Caching](./caching.md)

### Reference

15. [API reference](./api-reference.md)
16. [Diagrams](./diagrams.md)

## What this is

Hectoday HTTP describes what happened. You decide what it means.

The framework computes facts about requests — extracts params, validates input, parses bodies. It never decides what those facts mean as HTTP. Validation fails? The framework doesn't return 400. Auth header missing? The framework doesn't return 401. An error occurs? The framework doesn't return 500.

You make those decisions. In your handler. Explicitly.

## What this is not

Hectoday HTTP has no middleware, no guards, no built-in auth, no session management, no ORM, no template engine. It validates input, matches routes, runs handlers, runs hooks. Everything else is your code.

If you want batteries included, this isn't it. If you want to see every decision boundary in your code, keep reading.
