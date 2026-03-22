import { createServer } from "node:http";

const port = Number(process.argv[2] || 3000);

createServer((req, res) => {
  const path = req.url ?? "/";

  if (path === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Hello, World!");
    return;
  }

  if (path === "/json") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Hello, World!" }));
    return;
  }

  if (path.startsWith("/user/")) {
    const id = path.slice(6);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id, name: "John Doe" }));
    return;
  }

  res.writeHead(404).end("Not Found");
}).listen(port, () => {
  console.log(`bare (node:http) listening on :${port}`);
});
