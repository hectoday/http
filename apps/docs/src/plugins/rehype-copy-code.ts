import type { Element, ElementContent, Root } from "hast";
import { visit } from "unist-util-visit";

function createSvgElement(
  className: string,
  children: ElementContent[],
): Element {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      className: [className],
      xmlns: "http://www.w3.org/2000/svg",
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    children,
  };
}

function createCopyIcon(): Element {
  return createSvgElement("copy-icon", [
    {
      type: "element",
      tagName: "rect",
      properties: {
        x: "9",
        y: "9",
        width: "13",
        height: "13",
        rx: "2",
        ry: "2",
      },
      children: [],
    },
    {
      type: "element",
      tagName: "path",
      properties: {
        d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
      },
      children: [],
    },
  ]);
}

function createCheckIcon(): Element {
  return createSvgElement("check-icon", [
    {
      type: "element",
      tagName: "polyline",
      properties: { points: "20 6 9 17 4 12" },
      children: [],
    },
  ]);
}

export function rehypeCopyCode() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre") return;

      // Skip if already wrapped
      if (
        parent &&
        (parent as Element).properties?.className?.toString().includes(
          "code-block-wrapper",
        )
      ) {
        return;
      }

      // Find the code element inside pre
      const codeElement = node.children.find(
        (child): child is Element =>
          child.type === "element" && child.tagName === "code",
      );

      if (!codeElement) return;

      // Create the copy button
      const copyButton: Element = {
        type: "element",
        tagName: "button",
        properties: {
          className: ["copy-code-button"],
          ariaLabel: "Copy code",
          dataCopyCode: "true",
        },
        children: [createCopyIcon(), createCheckIcon()],
      };

      // Create wrapper div
      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: {
          className: ["code-block-wrapper"],
        },
        children: [{ ...node }, copyButton],
      };

      // Replace the pre with the wrapper
      if (parent && typeof index === "number") {
        (parent as Element).children[index] = wrapper;
      }
    });
  };
}
