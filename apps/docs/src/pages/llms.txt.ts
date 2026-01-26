import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const PART_NAMES: Record<number, string> = {
  1: "Part 1: Mental Models",
  2: "Part 2: Core Concepts",
  3: "Part 3: Composition",
  4: "Part 4: Real Concerns",
  5: "Part 5: Reference",
};

export const GET: APIRoute = async () => {
  const docs = await getCollection("docs", ({ data }) => !data.draft);

  // Group by part
  const parts = new Map<number, typeof docs>();
  const helpers: typeof docs = [];

  for (const doc of docs) {
    if (doc.id.startsWith("helpers/")) {
      helpers.push(doc);
    } else if (doc.data.part) {
      if (!parts.has(doc.data.part)) parts.set(doc.data.part, []);
      parts.get(doc.data.part)!.push(doc);
    }
  }

  // Sort within parts
  for (const [, partDocs] of parts) {
    partDocs.sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99));
  }

  helpers.sort((a, b) => a.data.title.localeCompare(b.data.title));

  const lines: string[] = [
    "# Hectoday HTTP",
    "",
    "> A web framework that refuses to make decisions for you.",
    "",
    "Hectoday HTTP is built on Web Standards (Request/Response) and runs on Deno, Bun, and Cloudflare Workers. It describes facts about requests and lets you decide what they mean as HTTP responses.",
    "",
    "## Core Philosophy",
    "",
    "- **No magic**: Every decision boundary is visible in your code",
    "- **Facts before decisions**: Validation describes data, doesn't control flow",
    "- **Explicit control flow**: Guards and handlers are the only places requests can end",
    "- **Web Standards**: Uses Fetch API (Request/Response) everywhere",
    "- **Runtime independence**: Same code runs on Deno, Bun, and Workers",
    "",
    "## Quick Start",
    "",
    "```typescript",
    'import { route, setup } from "@hectoday/http";',
    "",
    "const app = setup({",
    "  handlers: [",
    '    route.get("/", {',
    '      resolve: () => new Response("Hello World")',
    "    })",
    "  ]",
    "});",
    "",
    "Deno.serve(app.fetch);",
    "```",
    "",
    "## Documentation",
    "",
  ];

  // Output parts
  for (
    const [partNum, partDocs] of [...parts.entries()].sort(
      (a, b) => a[0] - b[0],
    )
  ) {
    lines.push(`### ${PART_NAMES[partNum] || `Part ${partNum}`}`);
    for (const doc of partDocs) {
      const desc = doc.data.description ? ` - ${doc.data.description}` : "";
      lines.push(`- /docs/${doc.id}${desc}`);
    }
    lines.push("");
  }

  // Output helpers
  if (helpers.length > 0) {
    lines.push("### Helpers (Copy-paste recipes)");
    for (const doc of helpers) {
      const desc = doc.data.description ? ` - ${doc.data.description}` : "";
      lines.push(`- /docs/${doc.id}${desc}`);
    }
    lines.push("");
  }

  lines.push(
    "## Key Concepts",
    "",
    "### Context (c)",
    "The context object passed to guards and handlers:",
    "- `c.request` - The original Web Standard Request",
    "- `c.raw` - Extracted but unvalidated inputs (params, query, body)",
    "- `c.input` - Validation results (ok: true/false)",
    "- `c.locals` - Request-scoped data from hooks and guards",
    "",
    "### Guards",
    "Functions that make allow/deny decisions:",
    "```typescript",
    "const requireAuth: GuardFn = (c) => {",
    '  const token = c.request.headers.get("authorization");',
    "  if (!token) {",
    '    return { deny: Response.json({ error: "Unauthorized" }, { status: 401 }) };',
    "  }",
    '  return { allow: true, locals: { userId: "123" } };',
    "};",
    "```",
    "",
    "### Validation",
    "Validation describes data but never controls flow:",
    "```typescript",
    'route.post("/users", {',
    "  request: {",
    "    body: z.object({ name: z.string(), email: z.string().email() })",
    "  },",
    "  resolve: (c) => {",
    "    if (!c.input.ok) {",
    "      return Response.json({ error: c.input.issues }, { status: 400 });",
    "    }",
    "    return Response.json(c.input.body, { status: 201 });",
    "  }",
    "})",
    "```",
    "",
    "### Hooks",
    "Three extension points:",
    "- `onRequest` - Runs before routing, adds to locals",
    "- `onResponse` - Runs after handler, can modify response",
    "- `onError` - Handles unexpected errors (throws)",
    "",
    "## Full Documentation",
    "",
    "For complete documentation with all content: /llms-full.txt",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
