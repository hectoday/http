import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string() });

const app = new Hono();

app.get("/", (c) => c.text("Hello, World!"));

app.get("/json", (c) => c.json({ message: "Hello, World!" }));

app.get("/user/:id", (c) => {
  const result = paramsSchema.safeParse({ id: c.req.param("id") });
  if (!result.success) return c.json({ error: "Invalid" }, 400);
  return c.json({ id: result.data.id, name: "John Doe" });
});

const port = Number(process.argv[2] || 3000);
serve({ port, fetch: app.fetch }, () => {
  console.log(`hono listening on :${port}`);
});
