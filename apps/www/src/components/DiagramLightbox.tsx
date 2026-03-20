import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Attaches click handlers to all `<pre class="mermaid">` elements inside a
 * container. Clicking a diagram opens a full-screen lightbox overlay showing
 * the diagram SVG scaled to fit the viewport. Pressing Escape, clicking the
 * backdrop, or clicking the close button dismisses it.
 */
export default function DiagramLightbox({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Attach click listeners to mermaid diagrams.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onClick(e: Event) {
      const pre = (e.currentTarget as HTMLElement);
      const svg = pre.querySelector("svg");
      if (!svg) return;
      setHtml(svg.outerHTML);
    }

    // Use MutationObserver to attach listeners after mermaid renders.
    function attach() {
      const pres = container!.querySelectorAll<HTMLPreElement>("pre.mermaid");
      for (const pre of pres) {
        pre.addEventListener("click", onClick);
      }
    }

    attach();

    const observer = new MutationObserver(attach);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      const pres = container.querySelectorAll<HTMLPreElement>("pre.mermaid");
      for (const pre of pres) {
        pre.removeEventListener("click", onClick);
      }
    };
  }, [containerRef]);

  // Show/hide dialog when html changes.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (html) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [html]);

  const close = useCallback(() => setHtml(null), []);

  if (!html) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      onClick={(e) => {
        // Close when clicking the backdrop (the dialog element itself).
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        maxWidth: "100vw",
        maxHeight: "100vh",
        margin: 0,
        padding: 0,
        border: "none",
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        cursor: "zoom-out",
      }}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          background: "none",
          border: "none",
          color: "#fff",
          fontSize: "2rem",
          cursor: "pointer",
          lineHeight: 1,
          padding: "0.5rem",
        }}
      >
        &times;
      </button>
      <div
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(e) => e.stopPropagation()}
      />
      <style>{`
        dialog::backdrop { background: transparent; }
        dialog div svg {
          max-width: 90vw;
          max-height: 85vh;
          width: auto;
          height: auto;
        }
      `}</style>
    </dialog>
  );
}
