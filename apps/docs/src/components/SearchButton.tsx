export default function SearchButton() {
  const triggerSearch = () => {
    document.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  return (
    <button
      onClick={triggerSearch}
      className="inline-flex items-center gap-1.5 cursor-pointer hover:text-black transition-colors"
      aria-label="Open search"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <span>Search</span>
    </button>
  );
}
