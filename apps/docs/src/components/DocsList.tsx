interface DocData {
  title: string;
  description?: string;
  draft?: boolean;
  part?: number;
}

interface Doc {
  id: string;
  data: DocData;
}

interface DocsListProps {
  docs: Doc[];
  helpers: Doc[];
  isDev: boolean;
}

const PARTS: Record<number, { title: string; description: string }> = {
  1: {
    title: "Mental Models",
    description: "Before you write code, you need a way to think about HTTP.",
  },
  2: {
    title: "Core Concepts",
    description: "The framework's primitives: handlers, facts, and guards.",
  },
  3: {
    title: "Composition",
    description: "How the pieces fit together to build larger APIs.",
  },
  4: {
    title: "Real Concerns",
    description: "Security, static files, and runtime differences.",
  },
  5: {
    title: "Reference",
    description: "Testing, API reference, and philosophy.",
  },
};

export default function DocsList({ docs, helpers, isDev }: DocsListProps) {
  const showDrafts = isDev ||
    (typeof window !== "undefined" &&
      new URLSearchParams(globalThis.location.search).has("drafts"));

  const visibleDocs = showDrafts ? docs : docs.filter((doc) => !doc.data.draft);
  const visibleHelpers = showDrafts
    ? helpers
    : helpers.filter((doc) => !doc.data.draft);

  const draftsParam = showDrafts && !isDev ? "?drafts" : "";

  // Group docs by part
  const docsByPart = visibleDocs.reduce((acc, doc) => {
    const part = doc.data.part || 0;
    if (!acc[part]) acc[part] = [];
    acc[part].push(doc);
    return acc;
  }, {} as Record<number, Doc[]>);

  const renderDocList = (docList: Doc[]) => (
    <ul className="list-none pl-0 space-y-4" role="list">
      {docList.map((doc) => (
        <li key={doc.id}>
          <a
            href={`/docs/${doc.id}${draftsParam}`}
            className="text-lg font-semibold"
            aria-describedby={doc.data.description
              ? `desc-${doc.id.replace(/\//g, "-")}`
              : undefined}
          >
            {doc.data.title}
            {doc.data.draft && (
              <span
                className="ml-2 text-xs font-bold text-black border-2 border-black px-2 py-1"
                aria-label="Draft document"
              >
                DRAFT
              </span>
            )}
          </a>
          {doc.data.description && (
            <p
              id={`desc-${doc.id.replace(/\//g, "-")}`}
              className="mt-1 mb-0 text-gray-700"
            >
              {doc.data.description}
            </p>
          )}
        </li>
      ))}
    </ul>
  );

  const hasNoDocs = visibleDocs.length === 0 && visibleHelpers.length === 0;

  const partNumbers = Object.keys(docsByPart)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <article className="prose">
      <h1>Documentation</h1>

      {hasNoDocs
        ? (
          <section
            aria-label="Empty state"
            className="mt-8 p-6 border-2 border-black bg-gray-50"
          >
            <p className="text-lg font-semibold mb-1!">
              Documentation is currently being worked on
            </p>
            <p className="mb-0!">
              Check back soon for comprehensive documentation.
            </p>
          </section>
        )
        : (
          <>
            {partNumbers.map((partNum) => {
              const partDocs = docsByPart[partNum];
              const partInfo = PARTS[partNum];

              if (!partDocs || partDocs.length === 0) return null;

              return (
                <section
                  key={partNum}
                  aria-labelledby={`part-${partNum}-heading`}
                  className="mt-10 first:mt-8"
                >
                  {partInfo
                    ? (
                      <>
                        <h2 id={`part-${partNum}-heading`} className="mb-1">
                          Part {partNum}: {partInfo.title}
                        </h2>
                        <p className="mt-0 mb-4 text-gray-600">
                          {partInfo.description}
                        </p>
                      </>
                    )
                    : (
                      <h2 id={`part-${partNum}-heading`} className="mb-4">
                        Other
                      </h2>
                    )}
                  {renderDocList(partDocs)}
                </section>
              );
            })}

            {visibleHelpers.length > 0 && (
              <section aria-labelledby="helpers-heading" className="mt-12">
                <h2 id="helpers-heading">Helpers</h2>
                <p className="text-gray-700">
                  Copy-paste patterns for common tasks. Not built-in—customize
                  for your needs.
                </p>
                {renderDocList(visibleHelpers)}
              </section>
            )}
          </>
        )}
    </article>
  );
}
