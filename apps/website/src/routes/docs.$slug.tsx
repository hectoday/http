import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { allDocs } from "content-collections";

export const Route = createFileRoute("/docs/$slug")({
  loader: ({ params: { slug } }) => {
    const doc = allDocs.find((d) => d.slug === slug);
    if (!doc) throw notFound();
    return doc;
  },
  component: DocPage,
});

function DocPage() {
  const doc = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Link
        to="/"
        className="mb-8 inline-block text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        &larr; Back
      </Link>
      <article className="prose" dangerouslySetInnerHTML={{ __html: doc.html }} />
    </main>
  );
}
