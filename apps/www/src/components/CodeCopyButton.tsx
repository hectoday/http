import { useEffect, useState, type RefObject } from "react";

export default function CodeCopyButton({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const blocks = container.querySelectorAll<HTMLPreElement>("pre.shiki");
    const buttons: HTMLButtonElement[] = [];

    for (const block of blocks) {
      if (block.querySelector("[data-copy-btn]")) continue;

      // Make pre relative for button positioning
      block.style.position = "relative";

      const btn = document.createElement("button");
      btn.setAttribute("data-copy-btn", "");
      btn.className = "copy-btn";
      btn.setAttribute("aria-label", "Copy code");
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

      btn.addEventListener("click", async () => {
        const code = block.querySelector("code");
        const text = code?.textContent ?? block.textContent ?? "";
        await navigator.clipboard.writeText(text);
        const id = Math.random().toString(36).slice(2);
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        btn.classList.add("copied");
        setCopiedId(id);
        setTimeout(() => {
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
          btn.classList.remove("copied");
          setCopiedId(null);
        }, 2000);
      });

      block.appendChild(btn);
      buttons.push(btn);
    }

    return () => {
      for (const btn of buttons) btn.remove();
    };
  }, [containerRef, copiedId]);

  return null;
}
