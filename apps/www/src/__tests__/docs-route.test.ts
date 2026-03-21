import { describe, expect, it } from "vite-plus/test";
import { isNotFound } from "@tanstack/react-router";
import { getDocPageData } from "../docs";

describe("docs route loader", () => {
  it("returns the requested doc with neighboring navigation links", () => {
    const { doc, prev, next } = getDocPageData("routes");

    expect(doc.slug).toBe("routes");
    expect(prev?.slug).toBe("your-first-server");
    expect(next?.slug).toBe("validation");
  });

  it("throws a TanStack not-found error for unknown docs", () => {
    try {
      getDocPageData("missing-doc");
      throw new Error("expected loader to throw");
    } catch (error) {
      expect(isNotFound(error)).toBe(true);
    }
  });
});
