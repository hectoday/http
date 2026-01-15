import { useState } from "react";

export default function DocsList({ docs, isDev }) {
  const [showDrafts, setShowDrafts] = useState(isDev);

  const visibleDocs = showDrafts ? docs : docs.filter((doc) => !doc.data.draft);

  return (
    <div className="prose">
      <div className="flex items-center justify-between mb-6">
        <h1 className="mb-0">Documentation</h1>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={showDrafts}
            onChange={(e) => setShowDrafts(e.target.checked)}
            className="cursor-pointer"
          />
          <span>Show drafts</span>
        </label>
      </div>

      {visibleDocs.length === 0
        ? (
          <div className="mt-8 p-6 border-2 border-black bg-gray-50">
            <p className="text-lg font-semibold mb-2">
              Documentation is currently being worked on
            </p>
            <p className="mb-0">
              Check back soon for comprehensive documentation.
            </p>
          </div>
        )
        : (
          <ul className="list-none pl-0 space-y-6 mt-8">
            {visibleDocs.map((doc) => (
              <li key={doc.id}>
                <a
                  href={`/docs/${doc.id}`}
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
        )}
    </div>
  );
}
