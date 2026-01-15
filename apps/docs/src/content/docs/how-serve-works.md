---
title: "How Deno.serve and Bun.serve Work"
description: "Understanding the internals of modern JavaScript HTTP servers"
order: 3
draft: true
---

Both Deno and Bun provide high-performance HTTP server APIs through their
respective `serve` functions. While they share similar interfaces, understanding
how they work internally helps you write better server code.

## The Common Interface

Both runtimes converge on a simple, modern API:

```typescript
// Deno
Deno.serve((req: Request) => {
  return new Response("Hello World");
});

// Bun
Bun.serve({
  fetch(req: Request) {
    return new Response("Hello World");
  },
});
```

The key insight: **handlers receive a standard `Request` and return a standard
`Response`**. This is the
[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) brought
to the server side.

## How Deno.serve Works

Deno's server implementation is built on top of **Hyper** (via Rust) and
**Tokio** for async I/O.

### The Request Flow

1. **TCP Connection**: Tokio accepts incoming TCP connections
2. **HTTP Parsing**: Hyper parses HTTP/1.1 or HTTP/2 frames
3. **Request Construction**: Deno constructs a Web-standard `Request` object
4. **Handler Execution**: Your JavaScript handler runs in V8
5. **Response Streaming**: The `Response` is streamed back through Hyper

### Key Implementation Details

**Connection Pooling**: Deno.serve automatically handles HTTP keep-alive and
connection reuse. Each connection can serve multiple requests sequentially.

**Async Execution**: When your handler returns a Promise, Deno suspends that
request's execution and can process other requests on the same thread. This is
powered by Tokio's work-stealing scheduler.

**Zero-copy Operations**: Deno tries to avoid copying data between Rust and
JavaScript. When you read `req.body`, it's often a direct reference to Hyper's
buffer.

```typescript
Deno.serve(async (req) => {
  // This body read is zero-copy when possible
  const data = await req.arrayBuffer();
  return new Response(data);
});
```

### HTTP/2 Support

Deno.serve automatically negotiates HTTP/2 via ALPN when using TLS:

```typescript
Deno.serve({
  cert: Deno.readTextFileSync("./cert.pem"),
  key: Deno.readTextFileSync("./key.pem"),
}, (req) => {
  // This handler works with both HTTP/1.1 and HTTP/2
  return new Response("Hello");
});
```

## How Bun.serve Works

Bun's server is built on **JavaScriptCore** (not V8) and uses **io_uring** on
Linux for async I/O.

### The Request Flow

1. **Socket Polling**: io_uring (Linux) or kqueue (macOS) monitors sockets
2. **HTTP Parsing**: Custom HTTP parser written in Zig
3. **Request Construction**: Bun creates a `Request` object in JavaScriptCore
4. **Handler Execution**: Your handler runs in JSC
5. **Response Writing**: Bun writes the response using zero-copy operations

### Key Implementation Details

**io_uring on Linux**: Bun uses io_uring for truly asynchronous I/O. Unlike
epoll/kqueue, io_uring allows submitting read/write operations that complete
without system call overhead.

**Zig-based Parser**: Bun's HTTP parser is written in Zig and is extremely fast.
It's optimized for the common case (simple headers, small payloads).

**Built-in WebSockets**: Unlike Deno, Bun.serve has first-class WebSocket
support:

```typescript
Bun.serve({
  fetch(req, server) {
    if (server.upgrade(req)) {
      return; // Connection upgraded to WebSocket
    }
    return new Response("HTTP response");
  },
  websocket: {
    open(ws) {
      ws.send("Welcome!");
    },
    message(ws, message) {
      ws.send(`Echo: ${message}`);
    },
  },
});
```

### Static File Optimization

Bun has a built-in optimization for serving static files:

```typescript
Bun.serve({
  fetch(req) {
    // Bun detects this pattern and uses sendfile()
    return new Response(Bun.file("./index.html"));
  },
});
```

When you return `Bun.file()`, Bun uses the `sendfile()` system call to send the
file directly from the kernel to the socket, bypassing userspace entirely.

## Performance Differences

### Deno's Advantages

- **Mature HTTP/2 support** via Hyper
- **Better standards compliance** (strictly follows Fetch API spec)
- **Cross-platform consistency** (same code path on all OSes)

### Bun's Advantages

- **io_uring on Linux** provides better throughput under high load
- **Integrated WebSockets** without additional libraries
- **Static file serving** is extremely fast with `sendfile()`
- **Lower memory usage** due to JavaScriptCore

## Request Lifecycle Example

Here's what happens when a request arrives:

```typescript
// 1. Connection arrives (TCP handshake)
// 2. HTTP parsing begins
// 3. Your handler is invoked

Deno.serve(async (req) => {
  // 4. Handler is running
  console.log(req.method, req.url);

  // 5. Async operation (handler is suspended)
  const data = await fetch("https://api.example.com");

  // 6. Handler resumes
  // 7. Response is constructed
  return new Response(data);

  // 8. Response is streamed to client
  // 9. Connection may be kept alive for next request
});
```

During step 5, the runtime can process other incoming requests. This is
**concurrency without threads**.

## Streaming Responses

Both runtimes support streaming responses through `ReadableStream`:

```typescript
Deno.serve((req) => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue("Hello ");
      setTimeout(() => {
        controller.enqueue("World");
        controller.close();
      }, 1000);
    },
  });

  return new Response(stream);
});
```

The runtime won't buffer the entire response. It sends chunks as they become
available, which is crucial for:

- Server-Sent Events (SSE)
- Large file downloads
- Real-time data feeds

## Error Handling

Both runtimes handle errors in your handler:

```typescript
Deno.serve((req) => {
  // If this throws, runtime returns 500 Internal Server Error
  throw new Error("Something went wrong");
});
```

For production, always catch errors explicitly:

```typescript
Deno.serve(async (req) => {
  try {
    const result = await handleRequest(req);
    return new Response(result);
  } catch (error) {
    console.error("Request failed:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
```

## Choosing Between Them

**Use Deno.serve when:**

- You need strict Web standards compliance
- You're building for multiple platforms
- You want TypeScript out of the box
- You need mature HTTP/2 support

**Use Bun.serve when:**

- You need maximum throughput (especially on Linux)
- You're building WebSocket-heavy applications
- You're serving lots of static files
- You want the fastest cold start times

## Conclusion

Both `Deno.serve` and `Bun.serve` represent the modern approach to server-side
JavaScript: embrace Web standards, optimize for performance, and keep the API
simple. Understanding their internals helps you make informed architectural
decisions and debug issues when they arise.

The future of JavaScript servers is converging on this pattern: a
standards-based `Request`/`Response` API backed by high-performance system-level
implementations.
