export const KeyboardShortcut = (
  { items }: { items: string[] },
) => {
  return (
    <kbd className="inline-flex items-center justify-center py-1 px-1 rounded-md bg-[#F3F3F3] text-[#1E1E1E] border border-b-3 border-[#CCCCCC] text-xs gap-[1ch]">
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
