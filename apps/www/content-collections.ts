import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import type { Root } from "hast";
import { createHighlighter } from "shiki";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { z } from "zod";
import { hectodayLight } from "./src/shiki-theme";

/**
 * Rehype plugin that converts fenced mermaid code blocks into
 * `<pre class="mermaid">…</pre>` so the client-side mermaid library
 * can pick them up. Runs before Shiki so they aren't syntax-highlighted.
 */
const rehypeMermaid: Plugin<[], Root> = () => (tree) => {
  visit(tree, "element", (node, index, parent) => {
    if (node.tagName !== "pre" || index == null || !parent || !("children" in parent)) return;
    const code = node.children[0];
    if (
      !code ||
      code.type !== "element" ||
      code.tagName !== "code" ||
      !Array.isArray(code.properties?.className) ||
      !code.properties.className.includes("language-mermaid")
    )
      return;

    // Replace <pre><code class="language-mermaid">…</code></pre>
    // with <pre class="mermaid">…text…</pre>
    node.properties = { className: ["mermaid"] };
    node.children = code.children;
  });
};

// Order matches the documentation table of contents in index.md
const DOC_ORDER = [
  "installation",
  "your-first-server",
  "routes",
  "validation",
  "auth",
  "hooks",
  "project-structure",
  "testing",
  "cors",
  "openapi",
  "client-types",
  "versioning",
  "serving",
  "api-reference",
  "diagrams",
];

// Create highlighter once to avoid re-initialization on every transform
const highlighter = await createHighlighter({
  themes: [hectodayLight],
  langs: ["typescript", "bash", "json"],
});

const changelog = defineCollection({
  name: "changelog",
  directory: "../../packages/http",
  include: "CHANGELOG.md",
  schema: z.object({
    content: z.string(),
  }),
  transform: async (doc, ctx) => {
    const html = await compileMarkdown(ctx, doc, {
      rehypePlugins: [[rehypeShikiFromHighlighter, highlighter, { theme: "hectoday-light" }]],
    });
    return { content: doc.content, html };
  },
});

const docs = defineCollection({
  name: "docs",
  directory: "../../packages/http/docs",
  include: "**/*.md",
  schema: z.object({
    content: z.string(),
  }),
  transform: async (doc, ctx) => {
    const html = await compileMarkdown(ctx, doc, {
      rehypePlugins: [
        rehypeMermaid,
        [rehypeShikiFromHighlighter, highlighter, { theme: "hectoday-light" }],
      ],
    });
    const titleMatch = doc.content.match(/^#\s+(.+)$/m);
    // Extract first paragraph after the heading as description
    const descMatch = doc.content.match(/^#[^\n]+\n+([^#`\n][^\n]{20,})/m);
    const description = descMatch ? descMatch[1].slice(0, 160).trim() : "";
    // Rewrite relative markdown links to /docs/ routes
    const rewrittenHtml = html.replace(/href="\.\/([^"]+)\.md"/g, 'href="/docs/$1"');
    const slug = doc._meta.path;
    const order = DOC_ORDER.indexOf(slug);
    return {
      title: titleMatch?.[1] ?? doc._meta.fileName.replace(/\.md$/, ""),
      slug,
      order: order === -1 ? 999 : order,
      description,
      content: doc.content,
      html: rewrittenHtml,
    };
  },
});

export default defineConfig({
  content: [changelog, docs],
});
