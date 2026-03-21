import { useEffect, type RefObject } from "react";

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const LANG_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  ts: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  bash: "Terminal",
  sh: "Terminal",
  shell: "Terminal",
  json: "JSON",
  html: "HTML",
  css: "CSS",
};

function getLang(pre: HTMLPreElement): string | null {
  const code = pre.querySelector("code");
  if (!code) return null;
  const cls = Array.from(code.classList).find((c) => c.startsWith("language-"));
  return cls ? cls.replace("language-", "") : null;
}

export default function CodeCopyButton({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const blocks = container.querySelectorAll<HTMLPreElement>("pre.shiki");
    const wrappers: HTMLDivElement[] = [];

    for (const pre of blocks) {
      if (pre.parentElement?.classList.contains("code-block")) continue;

      const lang = getLang(pre);
      const label = lang ? (LANG_LABELS[lang] ?? lang) : null;

      // Wrap pre in a container
      const wrapper = document.createElement("div");
      wrapper.className = "code-block";
      pre.parentNode!.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Header with language label and copy button
      const header = document.createElement("div");
      header.className = "code-block-header";

      const labelSpan = document.createElement("span");
      labelSpan.className = "code-block-lang";
      labelSpan.textContent = label ?? "";
      header.appendChild(labelSpan);

      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.setAttribute("aria-label", "Copy code");
      btn.innerHTML = COPY_ICON;

      btn.addEventListener("click", async () => {
        const code = pre.querySelector("code");
        const text = code?.textContent ?? pre.textContent ?? "";
        await navigator.clipboard.writeText(text);
        btn.innerHTML = CHECK_ICON;
        btn.classList.add("copied");
        setTimeout(() => {
          btn.innerHTML = COPY_ICON;
          btn.classList.remove("copied");
        }, 2000);
      });

      header.appendChild(btn);
      wrapper.insertBefore(header, pre);
      wrappers.push(wrapper);
    }

    return () => {
      for (const wrapper of wrappers) {
        const pre = wrapper.querySelector("pre");
        if (pre && wrapper.parentNode) {
          wrapper.parentNode.insertBefore(pre, wrapper);
          wrapper.remove();
        }
      }
    };
  }, [containerRef]);

  return null;
}
