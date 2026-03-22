import { setup, route } from "@hectoday/http";
import { z } from "zod/v4";
import { serve } from "srvx";

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
      resolve: (c) => {
        if (!c.input.ok) return Response.json({ error: "Invalid" }, { status: 400 });
        const { id } = c.input.params as { id: string };
        return Response.json({ id, name: "John Doe" });
      },
    }),
  ],
});

const port = Number(process.argv[2] || 3000);
serve({ port, fetch: app.fetch });
console.log(`@hectoday/http listening on :${port}`);
