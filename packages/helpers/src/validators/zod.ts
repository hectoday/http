import type {
  InferSchema,
  InferSchemaError,
  SafeParseResult,
  ValidateResult,
  ValidationIssue,
  ValidationPart,
  Validator,
} from "@hectoday/http";
import type { ZodError, ZodIssue, ZodSchema } from "zod";

/**
 * Zod validator adapter for @hectoday/http.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { zodValidator } from "@hectoday/http-helpers/zod";
 * import { route } from "@hectoday/http";
 *
 * const userSchema = z.object({
 *   name: z.string(),
 *   email: z.string().email(),
 * });
 *
 * export const createUser = route.post("/users", {
 *   request: {
 *     body: userSchema,
 *   },
 *   resolve: (c) => {
 *     if (!c.input.ok) {
 *       return Response.json({ errors: c.input.issues }, { status: 400 });
 *     }
 *     const { name, email } = c.input.body;
 *     // ...
 *   },
 * });
 * ```
 */
export const zodValidator: Validator<ZodSchema> = {
  validate<S extends ZodSchema>(
    schema: S,
    input: unknown,
    part: ValidationPart,
  ): ValidateResult<InferSchema<S>, InferSchemaError<S>> {
    const result = schema.safeParse(input) as SafeParseResult<
      InferSchema<S>,
      ZodError
    >;

    if (result.success) {
      return { ok: true, value: result.data };
    }

    const issues: ValidationIssue[] = result.error.issues.map(
      (issue: ZodIssue) => ({
        part,
        path: issue.path.map(String),
        message: issue.message,
        code: issue.code,
      }),
    );

    return {
      ok: false,
      issues,
      error: result.error as InferSchemaError<S>,
    };
  },
};
