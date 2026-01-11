/**
 * @hectoday/http-helpers
 *
 * A collection of common validators and guards for @hectoday/http.
 *
 * This package is designed to be tree-shakable - import only what you need:
 *
 * @example
 * ```ts
 * // Import Zod validator
 * import { zodValidator } from "@hectoday/http-helpers/zod";
 *
 * // Import specific guards
 * import { maxBodyBytes } from "@hectoday/http-helpers/guards/max-body-bytes";
 *
 * // Or import all guards at once
 * import { maxBodyBytes } from "@hectoday/http-helpers/guards";
 * ```
 */

// Re-export validators
export { zodValidator } from "./src/validators/zod.ts";

// Re-export guards
export { maxBodyBytes, SIZES } from "./src/guards/max-body-bytes.ts";
