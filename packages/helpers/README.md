# @hectoday/http-helpers

A collection of common validators and guards for
[@hectoday/http](https://github.com/hectoday/http), similar to
[convex-helpers](https://github.com/get-convex/convex-helpers).

## Features

- **Tree-shakable**: Import only what you need
- **Type-safe**: Full TypeScript support with type inference
- **Modular**: Each helper can be imported individually

## Installation

```bash
deno add @hectoday/http-helpers
```

## Validators

### Zod Validator

Integrate [Zod](https://zod.dev/) schemas with @hectoday/http for runtime
validation.

```ts
import { z } from "zod";
import { zodValidator } from "@hectoday/http-helpers/zod";
import { route, setup@hectoday/http } from "@hectoday/http";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

export const createUser = route.post("/users", {
  request: {
    body: userSchema,
  },
  resolve: (c) => {
    if (!c.input.ok) {
      return Response.json({ errors: c.input.issues }, { status: 400 });
    }
    
    const { name, email, age } = c.input.body;
    // name, email, and age are fully typed!
    
    return Response.json({ id: "123", name, email, age });
  },
});

// Setup @hectoday/http with the Zod validator
setup@hectoday/http({
  handlers: [createUser],
  validator: zodValidator,
});
```

## Guards

### maxBodyBytes

Enforce a maximum request body size to prevent oversized payloads.

```ts
import {
  maxBodyBytes,
  SIZES,
} from "@hectoday/http-helpers/guards/max-body-bytes";
import { route } from "@hectoday/http";

// Limit to 1MB
export const uploadFile = route.post("/upload", {
  guards: [maxBodyBytes(1024 * 1024)],
  resolve: (c) => {
    // Body is guaranteed to be <= 1MB
    return Response.json({ success: true });
  },
});

// Using size constants
export const uploadImage = route.post("/upload/image", {
  guards: [maxBodyBytes(10 * SIZES.MB)],
  resolve: (c) => {
    return Response.json({ success: true });
  },
});
```

**Size constants available:**

- `SIZES.KB` = 1,024 bytes
- `SIZES.MB` = 1,048,576 bytes
- `SIZES.GB` = 1,073,741,824 bytes

## Tree-shaking

This package is designed to be tree-shakable. Import only what you need:

```ts
// Import specific validator
import { zodValidator } from "@hectoday/http-helpers/zod";

// Import specific guard
import { maxBodyBytes } from "@hectoday/http-helpers/guards/max-body-bytes";

// Or import all guards
import { maxBodyBytes } from "@hectoday/http-helpers/guards";

// Or import everything (not recommended, but possible)
import { maxBodyBytes, zodValidator } from "@hectoday/http-helpers";
```

## License

MIT
