export function notFound(message: string): Response {
  return Response.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });
}

export function forbidden(message: string): Response {
  return Response.json({ error: { code: "FORBIDDEN", message } }, { status: 403 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: { code: "VALIDATION_ERROR", message } }, { status: 400 });
}
