import { describe, expect, it } from "vite-plus/test";
import { allDocs } from "../../.content-collections/generated/index.js";

describe("content-collections: docs", () => {
  it("should load all 16 documents", () => {
    expect(allDocs.length).toBe(16);
  });

  it("each doc should have the required shape", () => {
    for (const doc of allDocs) {
      expect(doc).toHaveProperty("title");
      expect(doc).toHaveProperty("slug");
      expect(doc).toHaveProperty("order");
      expect(doc).toHaveProperty("html");
      expect(typeof doc.title).toBe("string");
      expect(typeof doc.slug).toBe("string");
      expect(typeof doc.order).toBe("number");
      expect(typeof doc.html).toBe("string");
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.html.length).toBeGreaterThan(0);
    }
  });

  it("should include all expected documentation slugs", () => {
    const slugs = allDocs.map((doc) => doc.slug).sort();
    const expected = [
      "api-reference",
      "auth",
      "client-types",
      "cors",
      "diagrams",
      "hooks",
      "index",
      "installation",
      "openapi",
      "project-structure",
      "routes",
      "serving",
      "testing",
      "validation",
      "versioning",
      "your-first-server",
    ];
    expect(slugs).toEqual(expected);
  });

  it("should assign correct order from DOC_ORDER", () => {
    const bySlug = Object.fromEntries(allDocs.map((d) => [d.slug, d]));
    expect(bySlug["installation"]!.order).toBe(0);
    expect(bySlug["your-first-server"]!.order).toBe(1);
    expect(bySlug["routes"]!.order).toBe(2);
    expect(bySlug["diagrams"]!.order).toBe(14);
    // index.md is not in DOC_ORDER, so it gets 999
    expect(bySlug["index"]!.order).toBe(999);
  });

  it("should extract titles from markdown headings", () => {
    const bySlug = Object.fromEntries(allDocs.map((d) => [d.slug, d]));
    expect(bySlug["installation"]!.title).toBe("Installation");
    expect(bySlug["routes"]!.title).toBe("Routes");
  });

  it("should produce valid HTML", () => {
    for (const doc of allDocs) {
      expect(doc.html).toContain("<");
      expect(doc.html).toContain(">");
    }
  });

  it("should rewrite relative markdown links to /docs/ routes", () => {
    // index.md and your-first-server.md contain relative .md links
    const bySlug = Object.fromEntries(allDocs.map((d) => [d.slug, d]));

    // Should not contain any href="./something.md" patterns
    for (const doc of allDocs) {
      expect(doc.html).not.toMatch(/href="\.\/[^"]+\.md"/);
    }

    // index.md links to all other docs — verify rewritten links
    const indexHtml = bySlug["index"]!.html;
    expect(indexHtml).toContain('href="/docs/installation"');
    expect(indexHtml).toContain('href="/docs/routes"');
  });

  it("should apply syntax highlighting to code blocks", () => {
    // installation.md has a bash code block, so it should have Shiki output
    const bySlug = Object.fromEntries(allDocs.map((d) => [d.slug, d]));
    const installHtml = bySlug["installation"]!.html;
    // Shiki wraps highlighted code in <pre> with a class or data attribute
    expect(installHtml).toContain("<pre");
    expect(installHtml).toContain("<code");
  });
});
