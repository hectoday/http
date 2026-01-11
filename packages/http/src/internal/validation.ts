import type {
  InputErr,
  InputOk,
  InputState,
  RequestSchemas,
  SchemaLike,
  ValidationIssue,
  ValidationPart,
  Validator,
} from "../validation-types.ts";

// ==============================
// Raw extraction utilities
// ==============================

/**
 * Parse query string into object with array handling.
 * Multiple values for the same key become string[].
 */
export function parseQuery(url: string): Record<string, string | string[]> {
  const parsed = new URL(url);
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of parsed.searchParams) {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }

  return result;
}

/**
 * Parse JSON body with single-read guarantee.
 * Returns { parsed, error } where:
 * - parsed: the JSON value if successful, undefined otherwise
 * - error: the SyntaxError if JSON parsing failed, undefined otherwise
 *
 * Empty body is treated as undefined (not an error).
 */
export async function parseBody(
  request: Request,
): Promise<{ parsed: unknown | undefined; error?: SyntaxError }> {
  // Check if body exists
  if (!request.body) {
    return { parsed: undefined };
  }

  try {
    const text = await request.text();

    // Empty string body → undefined (not an error)
    if (text === "") {
      return { parsed: undefined };
    }

    // Parse JSON
    const parsed = JSON.parse(text);
    return { parsed };
  } catch (error) {
    // Invalid JSON → return error for validation to handle
    return {
      parsed: undefined,
      error: error instanceof SyntaxError
        ? error
        : new SyntaxError("Invalid JSON"),
    };
  }
}

// ==============================
// Validation execution
// ==============================

/**
 * Validate inputs using provided validator adapter.
 *
 * This function:
 * 1. Checks if a validator is required but missing (throws if so)
 * 2. For each schema present, calls validator.validate()
 * 3. Accumulates issues across all parts
 * 4. Returns InputOk if all pass, InputErr if any fail
 *
 * @param validator - Optional validator adapter (required if schemas exist)
 * @param schemas - Optional request schemas (params, query, body)
 * @param raw - Raw extracted values
 * @param bodyParseError - Optional JSON parse error for body
 */
export function validateInputs(
  validator: Validator<SchemaLike> | undefined,
  schemas: RequestSchemas<SchemaLike> | undefined,
  raw: {
    params: Record<string, unknown>;
    query: Record<string, unknown>;
    body?: unknown;
  },
  bodyParseError?: SyntaxError,
): InputState<unknown, unknown, unknown> {
  // If no schemas, always succeed with raw values
  if (!schemas) {
    return {
      ok: true,
      params: raw.params,
      query: raw.query,
      body: raw.body,
    };
  }

  // Schemas exist but no validator provided → developer error
  if (!validator) {
    throw new Error(
      "Validator is required when route defines request schemas. " +
        "Please provide a validator in setupHttp() configuration.",
    );
  }

  const failed: ValidationPart[] = [];
  const issues: ValidationIssue[] = [];
  const errors: Partial<Record<ValidationPart, unknown>> = {};

  let validatedParams: unknown = raw.params;
  let validatedQuery: unknown = raw.query;
  let validatedBody: unknown = raw.body;

  // Validate params
  if (schemas.params) {
    const result = validator.validate(schemas.params, raw.params, "params");
    if (result.ok) {
      validatedParams = result.value;
    } else {
      failed.push("params");
      issues.push(...result.issues);
      if (result.error !== undefined) {
        errors.params = result.error;
      }
    }
  }

  // Validate query
  if (schemas.query) {
    const result = validator.validate(schemas.query, raw.query, "query");
    if (result.ok) {
      validatedQuery = result.value;
    } else {
      failed.push("query");
      issues.push(...result.issues);
      if (result.error !== undefined) {
        errors.query = result.error;
      }
    }
  }

  // Validate body
  if (schemas.body) {
    // If JSON parsing failed, create an issue for it
    if (bodyParseError) {
      failed.push("body");
      issues.push({
        part: "body",
        path: [],
        message: "Invalid JSON",
      });
      errors.body = bodyParseError;
    } else {
      // JSON parsing succeeded (or no body), validate with schema
      const result = validator.validate(schemas.body, raw.body, "body");
      if (result.ok) {
        validatedBody = result.value;
      } else {
        failed.push("body");
        issues.push(...result.issues);
        if (result.error !== undefined) {
          errors.body = result.error;
        }
      }
    }
  }

  // If any validation failed, return failure state
  if (failed.length > 0) {
    const inputErr: InputErr = {
      ok: false,
      failed,
      issues,
      received: {
        params: raw.params,
        query: raw.query,
        body: raw.body,
      },
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };
    return inputErr;
  }

  // All validations passed, return success state
  const inputOk: InputOk<unknown, unknown, unknown> = {
    ok: true,
    params: validatedParams,
    query: validatedQuery,
    body: validatedBody,
  };
  return inputOk;
}
