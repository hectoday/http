import DiagramLightbox from "#/components/DiagramLightbox";
import MermaidRenderer from "#/components/MermaidRenderer";
import { getDocPageData } from "#/docs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { seoHead } from "../seo";

export const Route = createFileRoute("/docs/$slug")({
  component: DocPage,
  loader: ({ params }) => getDocPageData(params.slug),
  head: ({ loaderData }) =>
    loaderData
      ? seoHead({
          title: loaderData.doc.title,
          description: loaderData.doc.description,
          path: `/docs/${loaderData.doc.slug}`,
          type: "article",
          markdownPath: `/docs/${loaderData.doc.slug}.md`,
        })
      : seoHead(),
});

function DocPage() {
  const { doc, prev, next } = Route.useLoaderData();
  const articleRef = useRef<HTMLElement>(null);
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        &larr; Home
      </Link>
      <article
        ref={articleRef}
        className="prose mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />
      <MermaidRenderer containerRef={articleRef} />
      <DiagramLightbox containerRef={articleRef} />
      <nav className="mt-16 flex items-center justify-between border-t pt-6 dark:border-neutral-800">
        {prev ? (
          <Link
            to="/docs/$slug"
            params={{ slug: prev.slug }}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            &larr; {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to="/docs/$slug"
            params={{ slug: next.slug }}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {next.title} &rarr;
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
