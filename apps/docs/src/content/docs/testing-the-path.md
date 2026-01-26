---
title: "Testing the Path"
description: "Testing your handlers, business logic, and integrations"
order: 1
part: 5
draft: true
---

Testing with this framework means testing your code, not the framework.

You don't mock route matching, validation, or guard execution. Those are implementation details of the framework.

You test what matters: your handlers, business logic, and how they interact with your services.

## The testing Philosophy

**Test your application code:**
- Handler logic
- Business rules
- Service interactions
- Data transformations
- Error handling

**Don't test framework mechanics:**
- Route matching works
- Validation runs
- Guards execute in order
- Context gets created

The framework already works. Test your code instead.

## Testing handlers with dependencies

Real handlers depend on services, databases, and external APIs. Test them by injecting mock dependencies.

### Basic handler testing

```typescript
import { assertEquals } from "@std/assert";
import { route, setup } from "@hectoday/http";

// Your service interface
interface UserService {
  getById(id: string): Promise<{ id: string; name: string; email: string } | null>;
  create(data: { name: string; email: string }): Promise<{ id: string; name: string; email: string }>;
}

// Handler factory that accepts dependencies
function createUserHandlers(userService: UserService) {
  return [
    route.get("/users/:id", {
      resolve: async (c) => {
        const user = await userService.getById(c.raw.params.id);
        
        if (!user) {
          return Response.json({ error: "User not found" }, { status: 404 });
        }
        
        return Response.json(user);
      }
    }),
    
    route.post("/users", {
      resolve: async (c) => {
        const body = await c.request.json();
        const user = await userService.create(body);
        return Response.json(user, { status: 201 });
      }
    })
  ];
}

Deno.test("GET /users/:id returns user when found", async () => {
  // Mock service with test data
  const mockUserService: UserService = {
    getById: async (id) => {
      if (id === "123") {
        return { id: "123", name: "Alice", email: "alice@example.com" };
      }
      return null;
    },
    create: async () => { throw new Error("Not used in this test"); }
  };
  
  const app = setup({
    handlers: createUserHandlers(mockUserService)
  });
  
  const request = new Request("http://localhost/users/123");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    id: "123",
    name: "Alice",
    email: "alice@example.com"
  });
});

Deno.test("GET /users/:id returns 404 when not found", async () => {
  const mockUserService: UserService = {
    getById: async () => null,
    create: async () => { throw new Error("Not used in this test"); }
  };
  
  const app = setup({
    handlers: createUserHandlers(mockUserService)
  });
  
  const request = new Request("http://localhost/users/999");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 404);
  assertEquals(await response.json(), { error: "User not found" });
});
```

**Pattern: Dependency injection.** Handlers accept services, tests inject mocks.

## Testing business logic

Extract complex logic into testable functions. Test them independently.

### Testing domain logic

```typescript
// Domain logic - pure functions
interface Order {
  items: { price: number; quantity: number }[];
  discountCode?: string;
}

function calculateOrderTotal(order: Order): number {
  const subtotal = order.items.reduce(
    (sum, item) => sum + (item.price * item.quantity),
    0
  );
  
  let discount = 0;
  if (order.discountCode === "SAVE10") {
    discount = subtotal * 0.1;
  } else if (order.discountCode === "SAVE20") {
    discount = subtotal * 0.2;
  }
  
  return Math.max(0, subtotal - discount);
}

function canPlaceOrder(order: Order, userBalance: number): { allowed: boolean; reason?: string } {
  if (order.items.length === 0) {
    return { allowed: false, reason: "Order is empty" };
  }
  
  const total = calculateOrderTotal(order);
  if (total > userBalance) {
    return { allowed: false, reason: "Insufficient balance" };
  }
  
  return { allowed: true };
}

// Test domain logic directly
Deno.test("calculateOrderTotal applies discounts correctly", () => {
  const order: Order = {
    items: [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 1 }
    ],
    discountCode: "SAVE10"
  };
  
  assertEquals(calculateOrderTotal(order), 225); // (200 + 50) - 25
});

Deno.test("canPlaceOrder rejects empty orders", () => {
  const order: Order = { items: [] };
  const result = canPlaceOrder(order, 1000);
  
  assertEquals(result.allowed, false);
  assertEquals(result.reason, "Order is empty");
});

Deno.test("canPlaceOrder rejects when balance insufficient", () => {
  const order: Order = {
    items: [{ price: 100, quantity: 1 }]
  };
  const result = canPlaceOrder(order, 50);
  
  assertEquals(result.allowed, false);
  assertEquals(result.reason, "Insufficient balance");
});

// Handler uses tested logic
interface OrderService {
  createOrder(userId: string, order: Order): Promise<{ id: string }>;
}

interface AccountService {
  getBalance(userId: string): Promise<number>;
}

function createOrderHandlers(orderService: OrderService, accountService: AccountService) {
  return [
    route.post("/orders", {
      resolve: async (c) => {
        const userId = c.locals.userId as string;
        const order = await c.request.json() as Order;
        
        const balance = await accountService.getBalance(userId);
        const validation = canPlaceOrder(order, balance);
        
        if (!validation.allowed) {
          return Response.json(
            { error: validation.reason },
            { status: 400 }
          );
        }
        
        const created = await orderService.createOrder(userId, order);
        return Response.json(created, { status: 201 });
      }
    })
  ];
}
```

**Pattern: Extract and test.** Complex logic lives in pure functions, handlers orchestrate.

## Testing with in-memory state

For integration tests, use in-memory implementations instead of real databases.

### In-memory service implementation

```typescript
class InMemoryUserService implements UserService {
  private users = new Map<string, { id: string; name: string; email: string }>();
  private nextId = 1;
  
  async getById(id: string) {
    return this.users.get(id) || null;
  }
  
  async create(data: { name: string; email: string }) {
    const id = String(this.nextId++);
    const user = { id, ...data };
    this.users.set(id, user);
    return user;
  }
  
  async getByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }
  
  // Test helper
  clear() {
    this.users.clear();
    this.nextId = 1;
  }
}

Deno.test("POST /users creates user and returns it", async () => {
  const userService = new InMemoryUserService();
  
  const app = setup({
    handlers: createUserHandlers(userService)
  });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bob",
      email: "bob@example.com"
    })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 201);
  
  const created = await response.json();
  assertEquals(created.name, "Bob");
  assertEquals(created.email, "bob@example.com");
  
  // Verify it was actually stored
  const stored = await userService.getById(created.id);
  assertEquals(stored, created);
});

Deno.test("users are isolated between tests", async () => {
  const userService = new InMemoryUserService();
  
  // Create user in this test
  await userService.create({ name: "Test", email: "test@example.com" });
  
  // Next test won't see this user because we create fresh service
  const freshService = new InMemoryUserService();
  const user = await freshService.getById("1");
  assertEquals(user, null);
});
```

**Pattern: In-memory implementations.** Fast, isolated, no external dependencies.

## Testing authentication and authorization

Test your auth logic by mocking the authentication service.

### Testing protected routes

```typescript
interface AuthService {
  verifyToken(token: string): Promise<{ userId: string } | null>;
  hasRole(userId: string, role: string): Promise<boolean>;
}

function createAuthGuard(authService: AuthService) {
  return async (c: Context) => {
    const token = c.request.headers.get("authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    
    const user = await authService.verifyToken(token);
    if (!user) {
      return { deny: Response.json({ error: "Invalid token" }, { status: 401 }) };
    }
    
    return { allow: true, locals: { userId: user.userId } };
  };
}

function createAdminGuard(authService: AuthService) {
  return async (c: Context) => {
    const userId = c.locals.userId as string;
    const isAdmin = await authService.hasRole(userId, "admin");
    
    if (!isAdmin) {
      return { deny: Response.json({ error: "Forbidden" }, { status: 403 }) };
    }
    
    return { allow: true };
  };
}

Deno.test("protected route requires valid token", async () => {
  const mockAuthService: AuthService = {
    verifyToken: async (token) => {
      if (token === "valid-token") {
        return { userId: "user-123" };
      }
      return null;
    },
    hasRole: async () => false
  };
  
  const app = setup({
    handlers: [
      route.get("/profile", {
        guards: [createAuthGuard(mockAuthService)],
        resolve: (c) => {
          return Response.json({ userId: c.locals.userId });
        }
      })
    ]
  });
  
  // Without token
  const req1 = new Request("http://localhost/profile");
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 401);
  
  // With invalid token
  const req2 = new Request("http://localhost/profile", {
    headers: { "Authorization": "Bearer bad-token" }
  });
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 401);
  
  // With valid token
  const req3 = new Request("http://localhost/profile", {
    headers: { "Authorization": "Bearer valid-token" }
  });
  const res3 = await app.fetch(req3);
  assertEquals(res3.status, 200);
  assertEquals(await res3.json(), { userId: "user-123" });
});

Deno.test("admin route requires admin role", async () => {
  const mockAuthService: AuthService = {
    verifyToken: async (token) => {
      if (token === "user-token") return { userId: "user-123" };
      if (token === "admin-token") return { userId: "admin-456" };
      return null;
    },
    hasRole: async (userId, role) => {
      return userId === "admin-456" && role === "admin";
    }
  };
  
  const app = setup({
    handlers: [
      route.delete("/users/:id", {
        guards: [
          createAuthGuard(mockAuthService),
          createAdminGuard(mockAuthService)
        ],
        resolve: () => new Response(null, { status: 204 })
      })
    ]
  });
  
  // Regular user
  const req1 = new Request("http://localhost/users/999", {
    method: "DELETE",
    headers: { "Authorization": "Bearer user-token" }
  });
  const res1 = await app.fetch(req1);
  assertEquals(res1.status, 403);
  
  // Admin user
  const req2 = new Request("http://localhost/users/999", {
    method: "DELETE",
    headers: { "Authorization": "Bearer admin-token" }
  });
  const res2 = await app.fetch(req2);
  assertEquals(res2.status, 204);
});
```

**Pattern: Mock auth service.** Control who's authenticated and what roles they have.

## Testing error handling

Test how your handlers deal with failures from dependencies.

### Testing service failures

```typescript
Deno.test("handler returns 500 when service throws", async () => {
  const failingService: UserService = {
    getById: async () => {
      throw new Error("Database connection failed");
    },
    create: async () => {
      throw new Error("Database connection failed");
    }
  };
  
  const app = setup({
    handlers: createUserHandlers(failingService),
    onError: ({ error }) => {
      console.error("Caught error:", error);
      return Response.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
  
  const request = new Request("http://localhost/users/123");
  const response = await app.fetch(request);
  
  assertEquals(response.status, 500);
  assertEquals(await response.json(), { error: "Internal server error" });
});

Deno.test("handler handles specific business errors", async () => {
  class UserAlreadyExistsError extends Error {
    constructor(email: string) {
      super(`User with email ${email} already exists`);
      this.name = "UserAlreadyExistsError";
    }
  }
  
  const serviceWithConflict: UserService = {
    getById: async () => null,
    create: async (data) => {
      const existing = await serviceWithConflict.getByEmail(data.email);
      if (existing) {
        throw new UserAlreadyExistsError(data.email);
      }
      return { id: "1", ...data };
    },
    getByEmail: async (email) => {
      if (email === "existing@example.com") {
        return { id: "1", name: "Existing", email };
      }
      return null;
    }
  };
  
  const handlers = [
    route.post("/users", {
      resolve: async (c) => {
        try {
          const body = await c.request.json();
          const user = await serviceWithConflict.create(body);
          return Response.json(user, { status: 201 });
        } catch (error) {
          if (error instanceof UserAlreadyExistsError) {
            return Response.json(
              { error: error.message },
              { status: 409 }
            );
          }
          throw error;
        }
      }
    })
  ];
  
  const app = setup({ handlers });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "New User",
      email: "existing@example.com"
    })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error, "User with email existing@example.com already exists");
});
```

**Pattern: Test failure paths.** Make services fail, verify handlers respond correctly.

## Testing with Validation

Test how your handlers respond to invalid input.

### Testing input validation

```typescript
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  age: z.number().int().min(18, "Must be 18 or older").optional()
});

function createValidatedUserHandlers(userService: UserService) {
  return [
    route.post("/users", {
      request: { body: createUserSchema },
      resolve: async (c) => {
        if (!c.input.ok) {
          return Response.json(
            { errors: c.input.issues },
            { status: 400 }
          );
        }
        
        const user = await userService.create(c.input.body);
        return Response.json(user, { status: 201 });
      }
    })
  ];
}

Deno.test("rejects invalid email", async () => {
  const mockService: UserService = {
    getById: async () => null,
    create: async (data) => ({ id: "1", ...data })
  };
  
  const app = setup({
    validator: zodValidator,
    handlers: createValidatedUserHandlers(mockService)
  });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Alice",
      email: "not-an-email"
    })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 400);
  
  const body = await response.json();
  assertEquals(Array.isArray(body.errors), true);
  const emailError = body.errors.find((e: any) => e.path.includes("email"));
  assertEquals(emailError.message, "Invalid email");
});

Deno.test("rejects underage users", async () => {
  const mockService: UserService = {
    getById: async () => null,
    create: async (data) => ({ id: "1", ...data })
  };
  
  const app = setup({
    validator: zodValidator,
    handlers: createValidatedUserHandlers(mockService)
  });
  
  const request = new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Young User",
      email: "young@example.com",
      age: 16
    })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 400);
  
  const body = await response.json();
  const ageError = body.errors.find((e: any) => e.path.includes("age"));
  assertEquals(ageError.message, "Must be 18 or older");
});
```

**Pattern: Test validation rules.** Send invalid data, verify proper error responses.

## Testing external API calls

Mock external APIs to test integration logic.

### Testing third-party services

```typescript
interface PaymentProvider {
  charge(amount: number, token: string): Promise<{ transactionId: string; success: boolean }>;
}

interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

function createPaymentHandlers(
  paymentProvider: PaymentProvider,
  emailService: EmailService,
  orderService: OrderService
) {
  return [
    route.post("/checkout", {
      resolve: async (c) => {
        const { amount, paymentToken, userEmail } = await c.request.json();
        
        // Charge payment
        const payment = await paymentProvider.charge(amount, paymentToken);
        
        if (!payment.success) {
          return Response.json(
            { error: "Payment failed" },
            { status: 402 }
          );
        }
        
        // Create order
        const order = await orderService.createOrder(
          c.locals.userId as string,
          { items: [], transactionId: payment.transactionId }
        );
        
        // Send confirmation email (don't await - fire and forget)
        emailService.send(
          userEmail,
          "Order Confirmation",
          `Your order ${order.id} has been confirmed.`
        ).catch(err => console.error("Failed to send email:", err));
        
        return Response.json(order, { status: 201 });
      }
    })
  ];
}

Deno.test("checkout succeeds with valid payment", async () => {
  const mockPayment: PaymentProvider = {
    charge: async (amount, token) => {
      if (token === "valid-token") {
        return { transactionId: "txn-123", success: true };
      }
      return { transactionId: "", success: false };
    }
  };
  
  const mockEmail: EmailService = {
    send: async () => { /* no-op in tests */ }
  };
  
  const mockOrderService: OrderService = {
    createOrder: async (userId, order) => ({
      id: "order-123",
      userId,
      ...order
    })
  };
  
  const app = setup({
    handlers: createPaymentHandlers(mockPayment, mockEmail, mockOrderService)
  });
  
  const request = new Request("http://localhost/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 100,
      paymentToken: "valid-token",
      userEmail: "user@example.com"
    })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 201);
  const order = await response.json();
  assertEquals(order.id, "order-123");
});

Deno.test("checkout fails with invalid payment token", async () => {
  const mockPayment: PaymentProvider = {
    charge: async () => ({ transactionId: "", success: false })
  };
  
  const mockEmail: EmailService = {
    send: async () => {}
  };
  
  const mockOrderService: OrderService = {
    createOrder: async () => { throw new Error("Should not be called"); }
  };
  
  const app = setup({
    handlers: createPaymentHandlers(mockPayment, mockEmail, mockOrderService)
  });
  
  const request = new Request("http://localhost/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 100,
      paymentToken: "bad-token",
      userEmail: "user@example.com"
    })
  });
  
  const response = await app.fetch(request);
  
  assertEquals(response.status, 402);
  assertEquals(await response.json(), { error: "Payment failed" });
});
```

**Pattern: Mock external services.** Control their behavior, test your error handling.

## Testing hooks

Test lifecycle hooks that add cross-cutting concerns.

### Testing request/response hooks

```typescript
Deno.test("onRequest adds request ID to context", async () => {
  let requestIdCounter = 0;
  
  const app = setup({
    handlers: [
      route.get("/test", {
        resolve: (c) => {
          return Response.json({ requestId: c.locals.requestId });
        }
      })
    ],
    onRequest: () => {
      return { requestId: `req-${++requestIdCounter}` };
    }
  });
  
  const res1 = await app.fetch(new Request("http://localhost/test"));
  assertEquals(await res1.json(), { requestId: "req-1" });
  
  const res2 = await app.fetch(new Request("http://localhost/test"));
  assertEquals(await res2.json(), { requestId: "req-2" });
});

Deno.test("onResponse adds security headers", async () => {
  const app = setup({
    handlers: [
      route.get("/", {
        resolve: () => new Response("OK")
      })
    ],
    onResponse: ({ response }) => {
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      
      return new Response(response.body, {
        status: response.status,
        headers
      });
    }
  });
  
  const response = await app.fetch(new Request("http://localhost/"));
  
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
  assertEquals(response.headers.get("x-frame-options"), "DENY");
});

Deno.test("onError logs and sanitizes errors", async () => {
  const errors: unknown[] = [];
  
  const app = setup({
    handlers: [
      route.get("/crash", {
        resolve: () => {
          throw new Error("Database connection failed");
        }
      })
    ],
    onError: ({ error }) => {
      errors.push(error);
      return Response.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }
  });
  
  const response = await app.fetch(new Request("http://localhost/crash"));
  
  assertEquals(response.status, 500);
  assertEquals(await response.json(), { error: "Something went wrong" });
  assertEquals(errors.length, 1);
  assertEquals((errors[0] as Error).message, "Database connection failed");
});
```

**Pattern: Test hooks directly.** Verify they modify context, responses, or handle errors correctly.

## Test organization patterns

Structure your tests to match your application architecture.

### Test file structure

```typescript
// tests/users/create-user.test.ts
import { createUserHandlers } from "../../src/handlers/users.ts";
import { InMemoryUserService } from "../../src/services/user-service.test.ts";

Deno.test("create user - success", async () => {
  // Test implementation
});

Deno.test("create user - duplicate email", async () => {
  // Test implementation
});

// tests/users/get-user.test.ts
Deno.test("get user - found", async () => {
  // Test implementation
});

Deno.test("get user - not found", async () => {
  // Test implementation
});

// tests/integration/user-workflow.test.ts
Deno.test("complete user registration flow", async () => {
  // Create user -> Verify email -> Login -> Access protected resource
});
```

### Test fixtures and helpers

```typescript
// tests/fixtures/users.ts
export const testUsers = {
  alice: {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com"
  },
  bob: {
    id: "user-2",
    name: "Bob",
    email: "bob@example.com"
  }
};

// tests/helpers/setup.ts
export function createTestApp(services: {
  userService?: UserService;
  authService?: AuthService;
  // ... other services
}) {
  const userService = services.userService ?? new InMemoryUserService();
  const authService = services.authService ?? createMockAuthService();
  
  return setup({
    handlers: [
      ...createUserHandlers(userService),
      ...createAuthHandlers(authService)
    ]
  });
}

// tests/mocks/auth-service.ts
export function createMockAuthService(options: {
  validToken?: string;
  adminUserId?: string;
} = {}): AuthService {
  return {
    verifyToken: async (token) => {
      if (token === (options.validToken ?? "valid-token")) {
        return { userId: "user-123" };
      }
      return null;
    },
    hasRole: async (userId, role) => {
      return userId === options.adminUserId && role === "admin";
    }
  };
}

// Use in tests
Deno.test("example with helpers", async () => {
  const app = createTestApp({
    authService: createMockAuthService({ validToken: "custom-token" })
  });
  
  const response = await app.fetch(
    new Request("http://localhost/profile", {
      headers: { "Authorization": "Bearer custom-token" }
    })
  );
  
  assertEquals(response.status, 200);
});
```

## Why this testing approach works

**Tests are about your code:**
- You test handlers, business logic, service integrations
- Framework behavior is taken for granted
- Focus on what can actually break in production

**Tests are maintainable:**
- Mocking is explicit and controlled
- Dependencies are injected, not hidden
- Test setup mirrors application architecture

**Tests are fast:**
- No database connections
- No network calls
- Pure in-memory operations

**Tests are reliable:**
- Deterministic mock behavior
- No external dependencies
- Isolated test execution

**Tests document your API:**
- Reading tests shows how endpoints work
- Examples of success and error cases
- Clear contracts between layers

## The testing template

Every handler test follows this pattern:

```typescript
Deno.test("description of scenario", async () => {
  // 1. Setup: Create mock services
  const mockService = {
    method: async () => { /* controlled behavior */ }
  };
  
  // 2. Build: Create app with mocked dependencies
  const app = setup({
    handlers: createHandlers(mockService)
  });
  
  // 3. Act: Make request
  const request = new Request("http://localhost/path", {
    method: "POST",
    headers: { /* if needed */ },
    body: /* if needed */
  });
  
  const response = await app.fetch(request);
  
  // 4. Assert: Check response
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { expected: "result" });
  
  // 5. Verify: Check service calls if needed
  // (or use spy/mock libraries for this)
});
```

**Copy this template.** Adjust mocks and assertions. That's it.

---

Next: [Reference](./reference) - Complete API documentation for when you need details.
