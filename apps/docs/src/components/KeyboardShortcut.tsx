export const KeyboardShortcut = (
  { items, onClick }: { items: string[]; onClick?: () => void },
) => {
  return (
    <kbd
      className="inline-flex items-baseline justify-center py-0.5 px-1 rounded-md bg-[#F3F3F3] text-[#1E1E1E] border border-b-3 border-[#CCCCCC] text-xs gap-[1ch] min-w-[3ch] cursor-pointer active:scale-95 select-none"
      onClick={onClick}
    >
      {items.map((item, index) => (
        <>
          <span key={index}>{item}</span>
          {index !== items.length - 1 &&
            (
              <span className="text-[#6B6B6B]">
                {"+"}
              </span>
            )}
        </>
      ))}
    </kbd>
  );
};
