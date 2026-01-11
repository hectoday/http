# @hectoday/http Bun/Bun Example

Minimal example of using @hectoday/http with Node.js and Bun runtimes.

## Run with Node.js

Requires Node.js 18+ with native fetch API.

```bash
npm install
npm run dev
```

runtime

## Run

````bash
bun install
bun run dev:bun```

## Test

```bash
# Health check
curl http://localhost:3000/health

# Hello endpoint
curl http://localhost:3000/hello/Alice

# Echo endpoint
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
````
