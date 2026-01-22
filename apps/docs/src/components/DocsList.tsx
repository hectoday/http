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
  helpers: Doc[];
  isDev: boolean;
}

export default function DocsList({ docs, helpers, isDev }: DocsListProps) {
  const showDrafts = isDev ||
    (typeof window !== "undefined" &&
      new URLSearchParams(globalThis.location.search).has("drafts"));

  const visibleDocs = showDrafts ? docs : docs.filter((doc) => !doc.data.draft);
  const visibleHelpers = showDrafts
    ? helpers
    : helpers.filter((doc) => !doc.data.draft);

  const draftsParam = showDrafts && !isDev ? "?drafts" : "";

  const renderDocList = (docList: Doc[]) => (
    <ul className="list-none pl-0 space-y-6">
      {docList.map((doc) => (
        <li key={doc.id}>
          <a
            href={`/docs/${doc.id}${draftsParam}`}
            className="text-lg font-semibold"
          >
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
  );

  const hasNoDocs = visibleDocs.length === 0 && visibleHelpers.length === 0;

  return (
    <div className="prose">
      <h1>Documentation</h1>

      {hasNoDocs
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
          <>
            {visibleDocs.length > 0 && (
              <div className="mt-8">
                {renderDocList(visibleDocs)}
              </div>
            )}

            {visibleHelpers.length > 0 && (
              <div className="mt-12">
                <h2>Helpers</h2>
                <p className="text-gray-700">
                  Copy-paste patterns for common tasks. Not built-in—customize
                  for your needs.
                </p>
                {renderDocList(visibleHelpers)}
              </div>
            )}
          </>
        )}
    </div>
  );
}
