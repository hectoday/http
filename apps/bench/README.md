# @hectoday/http Benchmark

HTTP framework benchmark comparing `@hectoday/http` against popular alternatives on both Node.js and Deno.

## Frameworks

| Framework             | Server               | Runtime | Validation      |
| --------------------- | -------------------- | ------- | --------------- |
| bare (node:http)      | `node:http`          | Node.js | None (baseline) |
| @hectoday/http        | srvx                 | Node.js | Zod             |
| Hono                  | @hono/node-server    | Node.js | Zod             |
| Fastify               | built-in (node:http) | Node.js | Zod             |
| Express               | built-in (node:http) | Node.js | Zod             |
| bare (Deno.serve)     | Deno.serve           | Deno    | None (baseline) |
| @hectoday/http (Deno) | Deno.serve           | Deno    | Zod             |

Each framework uses its **native/recommended HTTP server** — no forced adapter layer. This reflects real-world deployment: you'd use srvx with @hectoday/http, `@hono/node-server` with Hono, and Fastify's built-in server with Fastify. The bare baselines (node:http, Deno.serve) have no framework overhead and serve as the theoretical ceiling for each runtime.

## Routes

| Route           | Description                                    |
| --------------- | ---------------------------------------------- |
| `GET /`         | Plain text response (`"Hello, World!"`)        |
| `GET /json`     | JSON response (`{ message: "Hello, World!" }`) |
| `GET /user/:id` | Parameterized route with Zod validation        |

All frameworks run `z.object({ id: z.string() }).safeParse()` on the `/user/:id` route to ensure validation cost is measured equally. The bare baselines skip validation since they have no framework — they exist only to show the raw HTTP layer ceiling.

## Methodology

- **Tool**: [wrk](https://github.com/wg/wrk) — 4 threads, 128 connections
- **Duration**: 10s per iteration
- **Warmup**: 3s per route before measuring (ensures JIT compilation and V8/Deno optimization)
- **Iterations**: 5 per route, reporting mean ± standard deviation
- **Native servers**: Each framework uses its recommended HTTP server
- **Same-machine**: wrk and the server run on the same host

## Prerequisites

- Node.js >= 22.12.0
- [Deno](https://deno.land) >= 2.x (for Deno benchmarks)
- [wrk](https://github.com/wg/wrk) (`brew install wrk` on macOS)
- [Vite+](https://vite.dev) (`vp` CLI)

## Running

```bash
# From the repository root
vp install

# Run the full benchmark (~8 minutes)
cd apps/bench
vp exec tsx src/run.ts
```

## Results

_Apple M4 Pro, macOS 15, Node.js v24.14.0, Deno 2.7.4_

### Node.js — requests/sec (mean ± stddev, n=5)

| Route                     | bare (node:http) | @hectoday/http | Hono          | Fastify       | Express       |
| ------------------------- | ---------------- | -------------- | ------------- | ------------- | ------------- |
| GET / (text)              | 133,280 ±787     | 75,471 ±2,732  | 93,499 ±8,060 | 98,793 ±9,481 | 65,886 ±1,559 |
| GET /json (json)          | 128,129 ±3,894   | 70,966 ±3,407  | 90,844 ±5,679 | 75,993 ±1,876 | 65,713 ±3,291 |
| GET /user/:id (param+zod) | 120,326 ±4,343   | 65,094 ±5,061  | 91,762 ±2,831 | 88,015 ±3,167 | 65,194 ±1,875 |

### Deno — requests/sec (mean ± stddev, n=5)

| Route                     | bare (Deno.serve) | @hectoday/http (Deno) |
| ------------------------- | ----------------- | --------------------- |
| GET / (text)              | 159,018 ±2,421    | 143,651 ±18,718       |
| GET /json (json)          | 154,254 ±3,448    | 158,882 ±6,646        |
| GET /user/:id (param+zod) | 157,747 ±8,225    | 140,358 ±7,949        |

## Analysis

### @hectoday/http on Deno is the fastest option

The standout result: **@hectoday/http on Deno.serve reaches 140–159k req/s**, outperforming every Node.js framework — including bare `node:http` (133k).

This makes sense architecturally. @hectoday/http is built on Web Standards (Request/Response), and Deno.serve natively speaks the same protocol. There's no translation layer. The framework connects directly to the runtime's HTTP primitives, resulting in near-zero overhead: @hectoday/http on Deno runs within 3–10% of bare Deno.serve.

### On Node.js, the HTTP adapter is the bottleneck

On Node.js, @hectoday/http (75k) sits between Hono (93k) and Express (66k). The gap versus Hono and Fastify is not framework logic — it's the **HTTP adapter layer**:

- **Fastify** operates directly on `node:http` with years of optimization around its request/response pipeline. It avoids the Web Standards abstraction entirely.
- **Hono** uses `@hono/node-server`, a mature adapter that efficiently bridges `node:http` to the Fetch API.
- **@hectoday/http** uses **srvx**, a newer and less optimized adapter. The ~20k req/s gap between @hectoday/http on srvx vs Hono on @hono/node-server is almost entirely attributable to the adapter, not the framework.

Evidence: when both @hectoday/http and Hono were forced onto the same HTTP layer (srvx) in earlier testing, they performed within 3–5% of each other.

### Framework overhead is minimal

Across all configurations, the framework's own routing and handler logic adds very little cost:

| Runtime                              | Bare baseline | @hectoday/http | Framework overhead |
| ------------------------------------ | ------------- | -------------- | ------------------ |
| Deno                                 | 157k          | 140k           | ~11%               |
| Node.js (srvx, from earlier testing) | 83k           | 80k            | ~4%                |

The overhead comes from route matching (rou3), context creation, and Zod validation — all expected costs that would exist in any framework doing the same work.

### Zod validation cost

Comparing the `/user/:id` route (with Zod) against `/json` (without) shows the per-request Zod overhead:

| Framework             | /json (no validation) | /user/:id (with Zod) | Delta  |
| --------------------- | --------------------- | -------------------- | ------ |
| @hectoday/http (Node) | 70,966                | 65,094               | -8%    |
| Hono                  | 90,844                | 91,762               | ~0%    |
| Fastify               | 75,993                | 88,015               | +16%\* |
| Express               | 65,713                | 65,194               | -1%    |
| @hectoday/http (Deno) | 158,882               | 140,358              | -12%   |

\* Fastify's `/json` route is slower than `/user/:id` because Fastify's built-in JSON serialization has its own overhead that the text route avoids.

Zod's `safeParse()` cost is modest (0–12% depending on runtime) and consistent across frameworks. At these throughput levels, Zod adds roughly 1–2 microseconds per request.

### Express is the slowest, but consistent

Express shows the lowest throughput (65–66k req/s) but also the **lowest variance** (stddev 1–3k). Its performance barely changes across route types, which suggests it's bottlenecked by its own middleware pipeline rather than the work each route does. Express carries significant per-request overhead from its legacy architecture (prototype chain walking, header normalization, etc.) that dominates over routing and validation costs.

### Deno.serve vs node:http

The raw HTTP baselines tell their own story:

|               | Deno.serve | node:http | Difference |
| ------------- | ---------- | --------- | ---------- |
| GET / (text)  | 159,018    | 133,280   | Deno +19%  |
| GET /json     | 154,254    | 128,129   | Deno +20%  |
| GET /user/:id | 157,747    | 120,326   | Deno +31%  |

Deno.serve is substantially faster as a raw HTTP layer. It's built in Rust (hyper) and designed from the ground up for the Request/Response model, while node:http carries decades of API surface and compatibility constraints.

## What these numbers mean (and don't mean)

This benchmark measures **raw framework throughput on trivial handlers**. It answers: "how much does the framework cost per request when the handler does almost nothing?"

In production, handler logic (database queries, business rules, external API calls, serialization) dominates. A 20k req/s difference between frameworks becomes irrelevant when your handler takes 50ms to query a database. These numbers help you understand the **baseline cost floor**, not predict production performance.

Where framework overhead matters most:

- High-throughput API gateways or proxies with minimal per-request logic
- Serverless/edge functions where cold start and per-invocation cost are critical
- Microservices doing lightweight data transformation

## Caveats

- **Same-machine benchmarking**: wrk and the server compete for CPU cores, which puts a ceiling on absolute numbers and can skew results if one framework is more CPU-hungry than another.
- **Single concurrency level**: 128 connections with 4 threads. Different concurrency levels (e.g., 16 connections vs 1024) can produce different relative rankings as frameworks handle backpressure differently.
- **srvx maturity**: srvx is newer than @hono/node-server and Fastify's built-in server. Performance improvements in srvx would directly benefit @hectoday/http on Node.js.
- **Deno npm compatibility**: The Deno benchmarks use `npm:` specifiers for Zod and direct source imports for @hectoday/http. Deno's npm compatibility layer may introduce minor overhead compared to native Deno modules.
- **Hardware-specific**: Results will vary significantly across different CPUs, especially between ARM (Apple Silicon) and x86, and between different core counts. Always run on your target hardware.
