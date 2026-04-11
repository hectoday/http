export function authenticate(request: Request): string | Response {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Bearer token required" } },
      { status: 401 },
    );
  }

  const token = auth.replace("Bearer ", "").trim();
  if (token.length === 0) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Token is empty" } },
      { status: 401 },
    );
  }

  // In a real app, you would verify a JWT or look up a session here.
  // For this guide, we treat the token itself as the user ID.
  return token;
}
