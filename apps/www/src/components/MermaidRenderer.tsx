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
        theme: "base",
        fontFamily: "inherit",
        themeVariables: isDark
          ? {
              // Dark mode palette
              background: "#111827",
              primaryColor: "#1e3a5f",
              primaryTextColor: "#e5e7eb",
              primaryBorderColor: "#374151",
              secondaryColor: "#1e293b",
              secondaryTextColor: "#d1d5db",
              secondaryBorderColor: "#374151",
              tertiaryColor: "#172033",
              tertiaryTextColor: "#d1d5db",
              tertiaryBorderColor: "#374151",
              lineColor: "#6b7280",
              textColor: "#e5e7eb",
              mainBkg: "#1e3a5f",
              nodeBorder: "#4b7bb5",
              clusterBkg: "#1e293b",
              clusterBorder: "#374151",
              edgeLabelBackground: "#1f2937",
              nodeTextColor: "#e5e7eb",
            }
          : {
              // Light mode palette
              background: "#ffffff",
              primaryColor: "#dbeafe",
              primaryTextColor: "#1e3a5f",
              primaryBorderColor: "#93c5fd",
              secondaryColor: "#f0f9ff",
              secondaryTextColor: "#334155",
              secondaryBorderColor: "#bfdbfe",
              tertiaryColor: "#f8fafc",
              tertiaryTextColor: "#334155",
              tertiaryBorderColor: "#cbd5e1",
              lineColor: "#94a3b8",
              textColor: "#1e293b",
              mainBkg: "#dbeafe",
              nodeBorder: "#93c5fd",
              clusterBkg: "#f0f9ff",
              clusterBorder: "#bfdbfe",
              edgeLabelBackground: "#ffffff",
              nodeTextColor: "#1e3a5f",
            },
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
