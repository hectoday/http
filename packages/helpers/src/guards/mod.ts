/**
 * Common guards for Hectoday HTTP routes.
 *
 * Guards are reusable middleware-like functions that run before route handlers
 * to perform checks like authentication, authorization, rate limiting, etc.
 */

export { maxBodyBytes, SIZES } from "./max-body-bytes.ts";
