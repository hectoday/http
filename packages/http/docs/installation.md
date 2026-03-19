# Installation

## Install the package

```bash
npm install @hectoday/http zod
```

`@hectoday/http` is the framework. `zod` is used for request validation and is a peer dependency.

## Runtime support

Hectoday HTTP runs on any runtime that supports the Fetch API:

- **Deno** — native support
- **Bun** — native support
- **Node.js** — via [srvx](https://github.com/h3js/srvx)
- **Cloudflare Workers** — native support

The framework uses only Web Standards (`Request`, `Response`, `Headers`, `URL`). No Node-specific APIs.

## Verify it works

Create `server.ts`:

```ts
import { setup, route } from "@hectoday/http";

const app = setup({
  routes: [
    route.get("/", {
      resolve: () => Response.json({ hello: "world" }),
    }),
  ],
});

Deno.serve(app.fetch);
```

Run it:

```bash
deno run --allow-net server.ts
```

Visit `http://localhost:8000`. You should see `{"hello":"world"}`.
