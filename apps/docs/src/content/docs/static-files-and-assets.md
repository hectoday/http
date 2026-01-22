---
title: "Static Files and Assets"
description: "Serving static files explicitly without magic conventions"
order: 2
part: 4
draft: true
---

Your API might need to serve static files: HTML pages, images, CSS, JavaScript bundles, or other assets.

In Hectoday HTTP, static files are just HTTP responses. Nothing special.

## Static Files Are Still HTTP

A static file response is identical to any other response:

```typescript
route.get("/index.html", {
  resolve: async () => {
    const file = await Deno.readFile("./public/index.html");
    
    return new Response(file, {
      headers: {
        "Content-Type": "text/html"
      }
    });
  }
})
```

**That's it.** Read the file, return a Response.

### Why They're Not Special

Many frameworks have "special" static file handling:

```typescript
// In many frameworks
app.static("/public", "./public");

// What does this do?
// - Maps URLs how?
// - Sets what headers?
// - Handles errors how?
// - Respects guards?
// Magic!
```

This is **implicit**. You don't control the mapping. You don't control the headers. You don't know what happens.

Hectoday HTTP has no special static file handling. Files are responses:

```typescript
route.get("/logo.png", {
  resolve: async () => {
    const file = await Deno.readFile("./assets/logo.png");
    
    return new Response(file, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000" // 1 year
      }
    });
  }
})
```

**Explicit mapping. Explicit headers. Just like any other route.**

### Files Are Just Bytes

A Response body can be:
- String
- ArrayBuffer
- Blob
- ReadableStream
- **File contents**

```typescript
// String
return new Response("Hello World");

// File contents
const fileBytes = await Deno.readFile("./file.txt");
return new Response(fileBytes);

// Same thing!
```

No special file handling. Just bytes in a Response.

## Serving Files Explicitly

Let's build file serving from first principles.

### Single File

Serve one specific file:

```typescript
route.get("/", {
  resolve: async () => {
    const html = await Deno.readTextFile("./public/index.html");
    
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  }
})
```

**Full control**: You chose the URL (`"/"`), the file path (`"./public/index.html"`), and the Content-Type.

### Multiple Files with Pattern Matching

Serve files from a directory:

```typescript
route.get("/assets/:filename", {
  resolve: async (c) => {
    const filename = c.raw.params.filename;
    
    // Security: validate filename
    if (!filename || filename.includes("..") || filename.includes("/")) {
      return Response.json({ error: "Invalid filename" }, { status: 400 });
    }
    
    const filePath = `./public/assets/${filename}`;
    
    try {
      const file = await Deno.readFile(filePath);
      
      // Determine content type
      const contentType = getContentType(filename);
      
      return new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600"
        }
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return Response.json({ error: "File not found" }, { status: 404 });
      }
      
      console.error("Error reading file:", error);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
})

function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  
  switch (ext) {
    case "html": return "text/html; charset=utf-8";
    case "css": return "text/css; charset=utf-8";
    case "js": return "application/javascript; charset=utf-8";
    case "json": return "application/json; charset=utf-8";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "svg": return "image/svg+xml";
    case "ico": return "image/x-icon";
    case "woff": return "font/woff";
    case "woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}
```

**What you control**:
- URL pattern (`"/assets/:filename"`)
- File path mapping (`"./public/assets/${filename}"`)
- Security validation (no `..` or `/`)
- Content-Type logic
- Cache headers
- Error responses

**No magic. Every decision is in your code.**

### Nested Paths

Serve files with directory structure:

```typescript
route.get("/static/*", {
  resolve: async (c) => {
    const url = new URL(c.request.url);
    
    // Extract path after "/static/"
    const requestPath = url.pathname.slice("/static/".length);
    
    // Security: validate path
    if (requestPath.includes("..")) {
      return Response.json({ error: "Invalid path" }, { status: 400 });
    }
    
    // Map to file system
    const filePath = `./public/${requestPath}`;
    
    try {
      const file = await Deno.readFile(filePath);
      const contentType = getContentType(requestPath);
      
      return new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600"
        }
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return Response.json({ error: "File not found" }, { status: 404 });
      }
      
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
})

// GET /static/css/main.css → ./public/css/main.css
// GET /static/js/app.js → ./public/js/app.js
// GET /static/images/logo.png → ./public/images/logo.png
```

**Wildcard matching** (`"*"`) captures the rest of the path.

### Security: Path Traversal Prevention

**Always validate file paths**:

```typescript
route.get("/files/*", {
  resolve: async (c) => {
    const url = new URL(c.request.url);
    const requestPath = url.pathname.slice("/files/".length);
    
    // ❌ NEVER DO THIS (path traversal vulnerability)
    // const filePath = `./data/${requestPath}`;
    // GET /files/../../../etc/passwd → ./data/../../../etc/passwd
    
    // ✅ Validate path
    if (
      !requestPath ||
      requestPath.includes("..") ||
      requestPath.startsWith("/") ||
      requestPath.includes("\0")
    ) {
      return Response.json({ error: "Invalid path" }, { status: 400 });
    }
    
    // Additional check: resolve to absolute path and verify it's in allowed directory
    const basePath = new URL("./data", import.meta.url).pathname;
    const filePath = new URL(requestPath, `file://${basePath}/`).pathname;
    
    if (!filePath.startsWith(basePath)) {
      return Response.json({ error: "Path not allowed" }, { status: 403 });
    }
    
    // Now safe to read
    try {
      const file = await Deno.readFile(filePath);
      return new Response(file);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
})
```

**Path traversal is a serious vulnerability.** Always validate and sanitize file paths.

### Runtime-Specific Optimizations

Different runtimes have optimized file serving:

#### Deno

```typescript
route.get("/files/:filename", {
  resolve: async (c) => {
    const filename = c.raw.params.filename;
    
    // Validate filename...
    
    try {
      // Use Deno's optimized file reading
      const file = await Deno.open(`./public/${filename}`, { read: true });
      
      return new Response(file.readable, {
        headers: {
          "Content-Type": getContentType(filename)
        }
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      throw error;
    }
  }
})
```

**`file.readable`** is a `ReadableStream` that streams the file without loading it entirely into memory.

#### Bun

```typescript
route.get("/files/:filename", {
  resolve: async (c) => {
    const filename = c.raw.params.filename;
    
    // Validate filename...
    
    // Bun.file() is highly optimized
    const file = Bun.file(`./public/${filename}`);
    
    if (!(await file.exists())) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    
    // Bun automatically uses sendfile() syscall when returning Bun.file()
    return new Response(file, {
      headers: {
        "Content-Type": getContentType(filename)
      }
    });
  }
})
```

**Bun's `file()`** uses zero-copy file serving when possible.

#### Cloudflare Workers

Workers don't have file systems. Serve from KV or R2:

```typescript
route.get("/assets/:filename", {
  resolve: async (c, env) => {
    const filename = c.raw.params.filename;
    
    // Fetch from R2 bucket
    const object = await env.ASSETS.get(filename);
    
    if (!object) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    
    return new Response(object.body, {
      headers: {
        "Content-Type": getContentType(filename),
        "Cache-Control": "public, max-age=31536000",
        "ETag": object.httpEtag
      }
    });
  }
})
```

**Each runtime has its own optimizations.** Use them when appropriate.

## Mapping URLs to Files

You control the URL-to-file mapping explicitly.

### Direct Mapping

```typescript
// URL: /index.html → File: ./public/index.html
route.get("/index.html", {
  resolve: async () => {
    const file = await Deno.readFile("./public/index.html");
    return new Response(file, {
      headers: { "Content-Type": "text/html" }
    });
  }
})
```

### Strip Prefix

```typescript
// URL: /static/logo.png → File: ./public/logo.png
route.get("/static/:filename", {
  resolve: async (c) => {
    const filename = c.raw.params.filename;
    const file = await Deno.readFile(`./public/${filename}`);
    return new Response(file);
  }
})
```

### Add Prefix

```typescript
// URL: /logo.png → File: ./assets/images/logo.png
route.get("/:filename", {
  resolve: async (c) => {
    const filename = c.raw.params.filename;
    const file = await Deno.readFile(`./assets/images/${filename}`);
    return new Response(file);
  }
})
```

### Custom Logic

```typescript
// URL: /v2/api.js → File: ./dist/api.v2.js
route.get("/:version/:filename", {
  resolve: async (c) => {
    const { version, filename } = c.raw.params;
    
    // Custom mapping logic
    const filePath = `./dist/${filename}.${version}.js`;
    
    const file = await Deno.readFile(filePath);
    return new Response(file, {
      headers: { "Content-Type": "application/javascript" }
    });
  }
})
```

**You write the mapping logic.** No conventions. No magic.

## Controlling Headers

Headers determine how browsers cache and handle files.

### Content-Type

Always set Content-Type:

```typescript
return new Response(file, {
  headers: {
    "Content-Type": "image/png"
  }
});
```

Without it, browsers might misinterpret the file.

### Cache-Control

Control browser and CDN caching:

```typescript
// Immutable assets (with content hash in filename)
return new Response(file, {
  headers: {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=31536000, immutable"
  }
});

// HTML (don't cache)
return new Response(html, {
  headers: {
    "Content-Type": "text/html",
    "Cache-Control": "no-cache"
  }
});

// Images (cache for 1 hour)
return new Response(image, {
  headers: {
    "Content-Type": "image/jpeg",
    "Cache-Control": "public, max-age=3600"
  }
});
```

**Cache-Control values**:
- `public` — Can be cached by browsers and CDNs
- `private` — Only browser can cache (not CDNs)
- `no-cache` — Must revalidate before using cached version
- `no-store` — Don't cache at all
- `max-age=N` — Cache for N seconds
- `immutable` — File will never change (safe to cache forever)

### ETag

Support conditional requests:

```typescript
route.get("/api.js", {
  resolve: async (c) => {
    const file = await Deno.readFile("./dist/api.js");
    
    // Generate ETag (hash of file contents)
    const hash = await crypto.subtle.digest("SHA-256", file);
    const etag = btoa(String.fromCharCode(...new Uint8Array(hash)));
    
    // Check If-None-Match header
    const ifNoneMatch = c.request.headers.get("if-none-match");
    
    if (ifNoneMatch === etag) {
      // File hasn't changed
      return new Response(null, { status: 304 }); // Not Modified
    }
    
    // File changed or first request
    return new Response(file, {
      headers: {
        "Content-Type": "application/javascript",
        "ETag": etag,
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
})
```

**ETags enable efficient revalidation.** Browser only downloads if ETag changed.

### Content-Encoding

For pre-compressed files:

```typescript
route.get("/app.js", {
  resolve: async (c) => {
    const acceptEncoding = c.request.headers.get("accept-encoding") || "";
    
    // Check if client accepts gzip
    if (acceptEncoding.includes("gzip")) {
      try {
        const compressed = await Deno.readFile("./dist/app.js.gz");
        
        return new Response(compressed, {
          headers: {
            "Content-Type": "application/javascript",
            "Content-Encoding": "gzip",
            "Cache-Control": "public, max-age=31536000"
          }
        });
      } catch {
        // Fall through to uncompressed
      }
    }
    
    // Serve uncompressed
    const file = await Deno.readFile("./dist/app.js");
    
    return new Response(file, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=31536000"
      }
    });
  }
})
```

**Pre-compression** is more efficient than runtime compression.

### Security Headers

For HTML files, add security headers:

```typescript
route.get("/", {
  resolve: async () => {
    const html = await Deno.readTextFile("./public/index.html");
    
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        
        // Security headers
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    });
  }
})
```

**Security headers protect against common attacks.**

### CORS Headers

For assets used cross-origin:

```typescript
route.get("/fonts/:filename", {
  resolve: async (c) => {
    const filename = c.raw.params.filename;
    const file = await Deno.readFile(`./public/fonts/${filename}`);
    
    return new Response(file, {
      headers: {
        "Content-Type": "font/woff2",
        "Cache-Control": "public, max-age=31536000",
        
        // CORS for web fonts
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
})
```

**Web fonts require CORS** to load cross-origin.

### Content-Disposition

Force download instead of display:

```typescript
route.get("/download/:filename", {
  resolve: async (c) => {
    const filename = c.raw.params.filename;
    const file = await Deno.readFile(`./downloads/${filename}`);
    
    return new Response(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  }
})
```

**Content-Disposition: attachment** triggers download dialog.

## Complete Example: Static File Server

Putting it all together:

```typescript
import { route, setup } from "@hectoday/http";

// Helper: validate file path
function isValidPath(path: string): boolean {
  return (
    path &&
    !path.includes("..") &&
    !path.startsWith("/") &&
    !path.includes("\0")
  );
}

// Helper: get content type
function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
  };
  
  return types[ext || ""] || "application/octet-stream";
}

// Helper: get cache control
function getCacheControl(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  
  // HTML: no cache
  if (ext === "html") {
    return "no-cache";
  }
  
  // Assets with hash in filename: cache forever
  if (filename.match(/\.[a-f0-9]{8,}\./)) {
    return "public, max-age=31536000, immutable";
  }
  
  // Other assets: cache for 1 hour
  return "public, max-age=3600";
}

// Serve index.html at root
const indexRoute = route.get("/", {
  resolve: async () => {
    const html = await Deno.readTextFile("./public/index.html");
    
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
});

// Serve static assets
const staticRoute = route.get("/static/*", {
  resolve: async (c) => {
    const url = new URL(c.request.url);
    const requestPath = url.pathname.slice("/static/".length);
    
    // Validate path
    if (!isValidPath(requestPath)) {
      return Response.json({ error: "Invalid path" }, { status: 400 });
    }
    
    const filePath = `./public/${requestPath}`;
    
    try {
      const file = await Deno.readFile(filePath);
      
      return new Response(file, {
        headers: {
          "Content-Type": getContentType(requestPath),
          "Cache-Control": getCacheControl(requestPath)
        }
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      
      console.error("Error serving file:", error);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
});

// Setup
const app = setup({
  handlers: [indexRoute, staticRoute]
});

Deno.serve(app.fetch);
```

**This is a complete static file server.** ~100 lines. Full control over everything.

---

Next: [Runtime Independence](./runtime-independence) — running the same code on Deno, Bun, and Workers.
