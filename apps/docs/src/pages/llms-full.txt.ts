import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const PART_NAMES: Record<number, string> = {
  1: "PART 1: MENTAL MODELS",
  2: "PART 2: CORE CONCEPTS",
  3: "PART 3: COMPOSITION",
  4: "PART 4: REAL CONCERNS",
  5: "PART 5: REFERENCE",
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
    "# Hectoday HTTP - Complete Documentation",
    "",
    "> A web framework that refuses to make decisions for you.",
    "",
    "Hectoday HTTP is built on Web Standards (Request/Response) and runs on Deno, Bun, and Cloudflare Workers.",
    "",
    "---",
    "",
  ];

  // Output parts
  for (
    const [partNum, partDocs] of [...parts.entries()].sort(
      (a, b) => a[0] - b[0],
    )
  ) {
    lines.push(`# ${PART_NAMES[partNum] || `PART ${partNum}`}`);
    lines.push("");

    for (const doc of partDocs) {
      lines.push("=".repeat(80));
      lines.push(`## ${doc.data.title}`);
      if (doc.data.description) {
        lines.push(`> ${doc.data.description}`);
      }
      lines.push(`> Source: /docs/${doc.id}`);
      lines.push("=".repeat(80));
      lines.push("");

      // Get raw markdown content
      if (doc.body) {
        lines.push(doc.body.trim());
      }

      lines.push("");
      lines.push("");
    }
  }

  // Output helpers
  if (helpers.length > 0) {
    lines.push("# HELPERS (Copy-paste recipes)");
    lines.push("");

    for (const doc of helpers) {
      lines.push("=".repeat(80));
      lines.push(`## ${doc.data.title}`);
      if (doc.data.description) {
        lines.push(`> ${doc.data.description}`);
      }
      lines.push(`> Source: /docs/${doc.id}`);
      lines.push("=".repeat(80));
      lines.push("");

      if (doc.body) {
        lines.push(doc.body.trim());
      }

      lines.push("");
      lines.push("");
    }
  }

  // Summary
  lines.push("---");
  lines.push("");
  lines.push("# Summary");
  lines.push("");
  lines.push("Hectoday HTTP is built on these principles:");
  lines.push("");
  lines.push(
    "1. **Describes facts, you decide meaning**: Validation and guards describe what happened. You choose the HTTP response.",
  );
  lines.push("");
  lines.push(
    "2. **Explicit control flow**: Requests only end in guards (deny) or handlers (return). No hidden middleware.",
  );
  lines.push("");
  lines.push(
    "3. **Web Standards foundation**: Uses Request/Response from the Fetch API. Runs on any runtime.",
  );
  lines.push("");
  lines.push(
    "4. **Composition over configuration**: Build APIs by composing small pieces. No config files or decorators.",
  );
  lines.push("");
  lines.push(
    "5. **Security as visible code**: Guards make security explicit. Audit by reading route definitions.",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
