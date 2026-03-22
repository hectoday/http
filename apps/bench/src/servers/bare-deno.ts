// @ts-nocheck — runs under Deno, not the project tsconfig
const port = Number(Deno.args[0] || 3000);

Deno.serve(
  { port, onListen: () => console.log(`bare (Deno.serve) listening on :${port}`) },
  (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/") {
      return new Response("Hello, World!");
    }

    if (path === "/json") {
      return Response.json({ message: "Hello, World!" });
    }

    if (path.startsWith("/user/")) {
      const id = path.slice(6);
      return Response.json({ id, name: "John Doe" });
    }

    return new Response("Not Found", { status: 404 });
  },
);
