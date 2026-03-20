import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { createHighlighter } from "shiki";
import { z } from "zod";

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
  themes: ["github-light", "github-dark"],
  langs: ["typescript", "bash", "json"],
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
        [
          rehypeShikiFromHighlighter,
          highlighter,
          { themes: { light: "github-light", dark: "github-dark" } },
        ],
      ],
    });
    const titleMatch = doc.content.match(/^#\s+(.+)$/m);
    // Rewrite relative markdown links to /docs/ routes
    const rewrittenHtml = html.replace(/href="\.\/([^"]+)\.md"/g, 'href="/docs/$1"');
    const slug = doc._meta.path;
    const order = DOC_ORDER.indexOf(slug);
    return {
      title: titleMatch?.[1] ?? doc._meta.fileName.replace(/\.md$/, ""),
      slug,
      order: order === -1 ? 999 : order,
      html: rewrittenHtml,
    };
  },
});

export default defineConfig({
  content: [docs],
});
