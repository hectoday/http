interface DocData {
  title: string;
  description?: string;
  draft?: boolean;
}

interface Doc {
  id: string;
  data: DocData;
}

interface DocsListProps {
  docs: Doc[];
  isDev: boolean;
}

export default function DocsList({ docs, isDev }: DocsListProps) {
  const showDrafts = isDev ||
    (typeof window !== "undefined" &&
      new URLSearchParams(globalThis.location.search).has("drafts"));

  const visibleDocs = showDrafts ? docs : docs.filter((doc) => !doc.data.draft);

  return (
    <div className="prose">
      <h1>Documentation</h1>

      {visibleDocs.length === 0
        ? (
          <div className="mt-8 p-6 border-2 border-black bg-gray-50">
            <p className="text-lg font-semibold mb-1!">
              Documentation is currently being worked on
            </p>
            <p className="mb-0!">
              Check back soon for comprehensive documentation.
            </p>
          </div>
        )
        : (
          <ul className="list-none pl-0 space-y-6 mt-8">
            {visibleDocs.map((doc) => (
              <li key={doc.id}>
                <a href={`/docs/${doc.id}`} className="text-lg font-semibold">
                  {doc.data.title}
                  {doc.data.draft && (
                    <span className="ml-2 text-xs font-bold text-black border-2 border-black px-2 py-1">
                      DRAFT
                    </span>
                  )}
                </a>
                {doc.data.description && (
                  <p className="mt-1 mb-0 text-gray-700">
                    {doc.data.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
