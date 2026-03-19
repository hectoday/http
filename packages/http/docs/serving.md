# Serving

Hectoday HTTP returns a `fetch` function. Pass it to your runtime.

## Deno

```ts
import { app } from "./app";

Deno.serve(app.fetch);
```

With options:

```ts
Deno.serve({ port: 3000, hostname: "0.0.0.0" }, app.fetch);
```

## Bun

```ts
import { app } from "./app";

Bun.serve({ fetch: app.fetch });
```

With options:

```ts
Bun.serve({ fetch: app.fetch, port: 3000 });
```

## Cloudflare Workers

```ts
import { app } from "./app";

export default { fetch: app.fetch };
```

## Node.js

Node.js doesn't have a native web-standard server. Use [srvx](https://github.com/h3js/srvx) to bridge the gap:

```bash
npm install srvx
```

```ts
import { serve } from "srvx";
import { app } from "./app";

serve({ fetch: app.fetch });
```

srvx handles the `node:http` → `Request`/`Response` conversion with near-native performance.

## Why bring your own server

The framework creates a `fetch` function — `(Request) => Response`. That's the web standard server signature. Every modern runtime supports it.

How you listen for connections, what port you bind, TLS configuration, graceful shutdown — those are runtime concerns. The framework doesn't touch them.
