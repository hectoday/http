import { notFound } from "@tanstack/react-router";
import { allDocs } from "content-collections";

const orderedDocs = allDocs.filter((doc) => doc.order < 999).sort((a, b) => a.order - b.order);

export function getOrderedDocs() {
  return orderedDocs;
}

export function getDocPageData(slug: string) {
  const idx = orderedDocs.findIndex((doc) => doc.slug === slug);
  const doc = idx !== -1 ? orderedDocs[idx] : allDocs.find((entry) => entry.slug === slug);

  if (!doc) {
    throw notFound();
  }

  const prev = idx > 0 ? orderedDocs[idx - 1] : null;
  const next = idx !== -1 && idx < orderedDocs.length - 1 ? orderedDocs[idx + 1] : null;

  return { doc, prev, next };
}
