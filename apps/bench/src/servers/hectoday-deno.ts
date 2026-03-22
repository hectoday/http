// @ts-nocheck — runs under Deno, not the project tsconfig
import { setup, route } from "../../../../packages/http/src/index.ts";
import { z } from "npm:zod@^3.25.0";

const app = setup({
  routes: [
    route.get("/", {
      resolve: () => new Response("Hello, World!"),
    }),

    route.get("/json", {
      resolve: () => Response.json({ message: "Hello, World!" }),
    }),

    route.get("/user/:id", {
      request: {
        params: z.object({ id: z.string() }),
      },
      resolve: ({ input }) => {
        if (!input.ok) return Response.json({ error: "Invalid" }, { status: 400 });
        return Response.json({ id: input.params.id, name: "John Doe" });
      },
    }),
  ],
});

const port = Number(Deno.args[0] || 3000);

Deno.serve(
  { port, onListen: () => console.log(`@hectoday/http (Deno) listening on :${port}`) },
  app.fetch,
);
