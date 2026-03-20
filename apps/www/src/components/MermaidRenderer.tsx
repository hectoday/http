import { useEffect } from "react";

/**
 * Finds all `<pre class="mermaid">` elements inside a container and renders
 * them with the mermaid library. Re-renders when the theme changes so diagrams
 * match the current dark/light mode.
 */
export default function MermaidRenderer({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pres = container.querySelectorAll<HTMLPreElement>("pre.mermaid");
    if (pres.length === 0) return;

    // Stash original diagram source so we can re-render on theme change.
    for (const pre of pres) {
      if (!pre.dataset.mermaidSource) {
        pre.dataset.mermaidSource = pre.textContent ?? "";
      }
    }

    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;
      const isDark = document.documentElement.classList.contains("dark");

      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        fontFamily: "inherit",
      });

      for (const pre of pres) {
        if (cancelled) return;
        const source = pre.dataset.mermaidSource;
        if (!source) continue;
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        try {
          const { svg } = await mermaid.render(id, source);
          pre.innerHTML = svg;
        } catch {
          // On error, restore the source text so the user can see the raw diagram.
          pre.textContent = source;
        }
      }
    }

    render();

    // Re-render when the theme class changes on <html>.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "class") {
          render();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [containerRef]);

  return null;
}
