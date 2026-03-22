import express from "express";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string() });

const port = Number(process.argv[2] || 3000);
const app = express();

app.get("/", (_req, res) => {
  res.send("Hello, World!");
});

app.get("/json", (_req, res) => {
  res.json({ message: "Hello, World!" });
});

app.get("/user/:id", (req, res) => {
  const result = paramsSchema.safeParse(req.params);
  if (!result.success) return res.status(400).json({ error: "Invalid" });
  res.json({ id: result.data.id, name: "John Doe" });
});

app.listen(port, () => {
  console.log(`express listening on :${port}`);
});
