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
              // Dark mode — black with thick borders
              background: "#0a0a0a",
              primaryColor: "#1a1a1a",
              primaryTextColor: "#ffffff",
              primaryBorderColor: "#ffffff",
              secondaryColor: "#111111",
              secondaryTextColor: "#e5e5e5",
              secondaryBorderColor: "#d4d4d4",
              tertiaryColor: "#111111",
              tertiaryTextColor: "#e5e5e5",
              tertiaryBorderColor: "#d4d4d4",
              lineColor: "#ffffff",
              textColor: "#ffffff",
              mainBkg: "#1a1a1a",
              nodeBorder: "#ffffff",
              clusterBkg: "#111111",
              clusterBorder: "#d4d4d4",
              edgeLabelBackground: "#0a0a0a",
              nodeTextColor: "#ffffff",
            }
          : {
              // Light mode — black & white with thick borders
              background: "#ffffff",
              primaryColor: "#f5f5f5",
              primaryTextColor: "#000000",
              primaryBorderColor: "#000000",
              secondaryColor: "#fafafa",
              secondaryTextColor: "#000000",
              secondaryBorderColor: "#404040",
              tertiaryColor: "#fafafa",
              tertiaryTextColor: "#000000",
              tertiaryBorderColor: "#404040",
              lineColor: "#000000",
              textColor: "#000000",
              mainBkg: "#f5f5f5",
              nodeBorder: "#000000",
              clusterBkg: "#fafafa",
              clusterBorder: "#404040",
              edgeLabelBackground: "#ffffff",
              nodeTextColor: "#000000",
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

    void render();

    // Re-render when the theme class changes on <html>.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "class") {
          void render();
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
