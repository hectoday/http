import { createFileRoute, Link } from "@tanstack/react-router";
import { allDocs } from "content-collections";

const ordered = allDocs.filter((d) => d.order < 999).sort((a, b) => a.order - b.order);

export const Route = createFileRoute("/docs/$slug")({
  component: DocPage,
  loader: ({ params }) => {
    const idx = ordered.findIndex((d) => d.slug === params.slug);
    const doc = idx !== -1 ? ordered[idx] : allDocs.find((d) => d.slug === params.slug);
    if (!doc) throw new Error(`Doc not found: ${params.slug}`);
    const prev = idx > 0 ? ordered[idx - 1] : null;
    const next = idx !== -1 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
    return { doc, prev, next };
  },
});

function DocPage() {
  const { doc, prev, next } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        &larr; Home
      </Link>
      <article className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: doc.html }} />
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
