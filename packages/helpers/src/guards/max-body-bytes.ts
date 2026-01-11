import type { GuardFn } from "@hectoday/http";

/**
 * Creates a guard that enforces a maximum request body size.
 *
 * This guard checks the Content-Length header and rejects requests
 * that exceed the specified size limit with a 413 Payload Too Large response.
 *
 * @param maxBytes - Maximum allowed body size in bytes
 * @returns Guard function that checks request body size
 *
 * @example
 * ```ts
 * import { maxBodyBytes } from "@hectoday/http-helpers/guards/max-body-bytes";
 * import { route } from "@hectoday/http";
 *
 * // Limit request body to 1MB
 * export const uploadFile = route.post("/upload", {
 *   guards: [maxBodyBytes(1024 * 1024)],
 *   resolve: (c) => {
 *     // Body is guaranteed to be <= 1MB
 *     return Response.json({ success: true });
 *   },
 * });
 *
 * // Using common size constants
 * const ONE_MB = 1024 * 1024;
 * const TEN_MB = 10 * ONE_MB;
 *
 * export const uploadImage = route.post("/upload/image", {
 *   guards: [maxBodyBytes(TEN_MB)],
 *   resolve: (c) => {
 *     // ...
 *   },
 * });
 * ```
 */
export function maxBodyBytes(maxBytes: number): GuardFn {
  return (c) => {
    const contentLength = c.request.headers.get("content-length");

    if (contentLength === null) {
      // No Content-Length header - could allow or deny based on your policy
      // For now, we'll allow it (body parsing will fail if too large anyway)
      return { allow: true };
    }

    const length = parseInt(contentLength, 10);

    if (isNaN(length)) {
      return {
        deny: new Response("Invalid Content-Length header", { status: 400 }),
      };
    }

    if (length > maxBytes) {
      return {
        deny: new Response(
          `Request body too large. Maximum size is ${maxBytes} bytes, received ${length} bytes.`,
          { status: 413 },
        ),
      };
    }

    return { allow: true };
  };
}

/**
 * Common size constants for convenience
 */
export const SIZES = {
  /** 1 KB = 1,024 bytes */
  KB: 1024,
  /** 1 MB = 1,048,576 bytes */
  MB: 1024 * 1024,
  /** 1 GB = 1,073,741,824 bytes */
  GB: 1024 * 1024 * 1024,
} as const;
