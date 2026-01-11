import { route, setupHttp } from "../packages/http/mod.ts";

// Simple routes for benchmarking
const root = route.get("/", {
  resolve: () => new Response("Hello, World!"),
});

const json = route.get("/json", {
  resolve: () => Response.json({ message: "Hello, World!" }),
});

const params = route.get("/users/:id", {
  resolve: (c) => {
    const id = c.raw.params.id;
    return Response.json({ id, name: "User" });
  },
});

// Setup app
const app = setupHttp({
  handlers: [root, json, params],
});

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`🚀 Benchmark server running on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
