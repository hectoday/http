import { route, setupHttp } from "@hectoday/http";

// Basic routes
const health = route.get("/health", {
  resolve: () => {
    return Response.json({
      status: "healthy",
      runtime: "Bun",
      timestamp: new Date().toISOString(),
    });
  },
});

const hello = route.get("/hello/:name", {
  resolve: (c) => {
    const name = c.raw.params.name || "World";
    return Response.json({ message: `Hello, ${name}!` });
  },
});

const echo = route.post("/echo", {
  resolve: (c) => {
    const body = c.raw.body;
    return Response.json({ received: body });
  },
});

// Setup Hectoday HTTP app
const app = setupHttp({
  handlers: [health, hello, echo],
});

const port = 3000;

// Start Bun server
Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`🚀 Server running at http://localhost:${port}`);
