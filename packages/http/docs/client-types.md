# Client Types

Your Zod schemas are the single source of truth. The OpenAPI spec is generated from them. Frontend types, API clients, and mock handlers are generated from the spec.

```
Zod schemas (backend)
  → OpenAPI spec (@hectoday/openapi)
    → TypeScript types (openapi-typescript)
      → Typed fetch client (openapi-fetch)
      → Typed MSW handlers
```

## Generate types

Install `openapi-typescript`:

```bash
npm install -D openapi-typescript
```

Add a script to your `package.json`:

```json
{
  "scripts": {
    "generate:types": "openapi-typescript http://localhost:3000/openapi.json -o src/api.d.ts"
  }
}
```

Start your server, then run:

```bash
npm run generate:types
```

This reads your `/openapi.json` endpoint and produces `src/api.d.ts` with types for every route, request body, and response.

## Typed fetch client

Install `openapi-fetch`:

```bash
npm install openapi-fetch
```

```ts
import createClient from "openapi-fetch";
import type { paths } from "./api";

const api = createClient<paths>({ baseUrl: "http://localhost:3000" });

// Fully typed — body, response, and errors
const { data, error } = await api.POST("/users", {
  body: { name: "Alice", email: "a@b.com" },
});
// data is typed as { id: string; name: string; email: string }
```

Request bodies are type-checked. Responses are typed per status code. Paths autocomplete in your editor.

## Typed MSW handlers

Use the generated types to keep your mock handlers in sync with the real API:

```ts
import { http, HttpResponse } from "msw";
import type { paths } from "./api";

type CreateUserBody = paths["/users"]["post"]["requestBody"]["content"]["application/json"];
type CreateUserResponse =
  paths["/users"]["post"]["responses"]["201"]["content"]["application/json"];

export const handlers = [
  http.post<never, CreateUserBody>("/users", async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json<CreateUserResponse>(
      {
        id: "mock-1",
        name: body.name,
        email: body.email,
      },
      { status: 201 },
    );
  }),
];
```

Change a Zod schema on the backend, regenerate types, and TypeScript catches every mismatched mock and fetch call.

## Workflow

1. Define Zod schemas in your backend route configs
2. `@hectoday/openapi` generates the OpenAPI spec at `/openapi.json`
3. Run `openapi-typescript` to generate `api.d.ts`
4. Frontend imports types for fetch clients and MSW handlers
5. TypeScript catches mismatches across the entire stack

Regenerate types whenever your API changes. Hook it into CI so types are always in sync.
