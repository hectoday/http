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
        flowchart: {
          nodeSpacing: 30,
          rankSpacing: 40,
          defaultRenderer: "elk",
          htmlLabels: true,
        },
        themeVariables: isDark
          ? {
              // Dark mode — black & white with gray shades
              background: "#111827",
              primaryColor: "#374151",
              primaryTextColor: "#f3f4f6",
              primaryBorderColor: "#6b7280",
              secondaryColor: "#1f2937",
              secondaryTextColor: "#e5e7eb",
              secondaryBorderColor: "#4b5563",
              tertiaryColor: "#1f2937",
              tertiaryTextColor: "#e5e7eb",
              tertiaryBorderColor: "#4b5563",
              lineColor: "#9ca3af",
              textColor: "#f3f4f6",
              mainBkg: "#374151",
              nodeBorder: "#6b7280",
              clusterBkg: "#1f2937",
              clusterBorder: "#4b5563",
              edgeLabelBackground: "#1f2937",
              nodeTextColor: "#f3f4f6",
            }
          : {
              // Light mode — black & white with gray shades
              background: "#ffffff",
              primaryColor: "#f3f4f6",
              primaryTextColor: "#111827",
              primaryBorderColor: "#d1d5db",
              secondaryColor: "#f9fafb",
              secondaryTextColor: "#1f2937",
              secondaryBorderColor: "#e5e7eb",
              tertiaryColor: "#f9fafb",
              tertiaryTextColor: "#1f2937",
              tertiaryBorderColor: "#e5e7eb",
              lineColor: "#9ca3af",
              textColor: "#111827",
              mainBkg: "#f3f4f6",
              nodeBorder: "#d1d5db",
              clusterBkg: "#f9fafb",
              clusterBorder: "#e5e7eb",
              edgeLabelBackground: "#ffffff",
              nodeTextColor: "#111827",
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
