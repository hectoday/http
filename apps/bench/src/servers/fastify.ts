import Fastify from "fastify";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string() });

const port = Number(process.argv[2] || 3000);
const fastify = Fastify();

fastify.get("/", () => "Hello, World!");

fastify.get("/json", () => ({ message: "Hello, World!" }));

fastify.get("/user/:id", (req) => {
  const result = paramsSchema.safeParse(req.params);
  if (!result.success) return { error: "Invalid" };
  return { id: result.data.id, name: "John Doe" };
});

await fastify.listen({ port });
console.log(`fastify listening on :${port}`);
