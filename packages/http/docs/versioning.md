# Versioning

No framework feature. Versioning is paths and file organization.

## Version in the path

Each route spells out its full path including the version:

```ts
// users-v1.ts
export const userRoutesV1 = group([
  route.get("/v1/users", { ... }),
  route.post("/v1/users", { ... }),
]);

// users-v2.ts
export const userRoutesV2 = group([
  route.get("/v2/users", { ... }),
  route.post("/v2/users", { ... }),
]);
```

Spread them into setup:

```ts
const app = setup({
  routes: [...userRoutesV1, ...userRoutesV2],
});
```

Both versions run in the same app. Each route is explicit about which version it belongs to.

## Separate OpenAPI specs per version

Generate a spec for each version with its own docs page:

```ts
import { openapi } from "@hectoday/openapi";

const v1Routes = [...userRoutesV1, ...adminRoutesV1];
const v2Routes = [...userRoutesV2, ...adminRoutesV2];

const { spec: specV1, docs: docsV1 } = openapi(v1Routes, {
  info: { title: "My API", version: "1.0.0" },
  specPath: "/v1/openapi.json",
  docsPath: "/v1/docs",
});

const { spec: specV2, docs: docsV2 } = openapi(v2Routes, {
  info: { title: "My API", version: "2.0.0" },
  specPath: "/v2/openapi.json",
  docsPath: "/v2/docs",
});

const app = setup({
  routes: [specV1(route), docsV1(route), specV2(route), docsV2(route), ...v1Routes, ...v2Routes],
});
```

Each version gets its own Scalar UI at `/v1/docs` and `/v2/docs`.

## Sharing logic between versions

V2 handlers can import and reuse V1 logic:

```ts
// users-v2.ts
import { authenticate } from "./auth";

export const userRoutesV2 = group([
  route.get("/v2/users", {
    request: {
      query: z.object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(20),
        sort: z.enum(["name", "created"]).default("created"), // new in v2
      }),
    },
    resolve: async (c) => {
      const caller = authenticate(c.request);
      if (caller instanceof Response) return caller;

      if (!c.input.ok) {
        return Response.json({ error: c.input.issues }, { status: 400 });
      }

      const users = await db.users.list(c.input.query);
      return Response.json({ users });
    },
  }),
]);
```

No framework abstraction for version inheritance. Import what you need, write the handler.
