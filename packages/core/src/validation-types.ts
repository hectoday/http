// ==============================
// Validation core types
// ==============================

export type ValidationPart = "params" | "query" | "body";

export type ValidationIssue = Readonly<{
  part: ValidationPart;
  path: readonly string[];
  message: string;
  code?: string;
}>;

// ------------------------------
// Standard-schema-like safeParse
// ------------------------------

export type SafeParseSuccess<T> = Readonly<{
  success: true;
  data: T;
}>;

export type SafeParseFailure<E = unknown> = Readonly<{
  success: false;
  error: E;
}>;

export type SafeParseResult<T, E = unknown> =
  | SafeParseSuccess<T>
  | SafeParseFailure<E>;

export type SchemaLike<TOut = unknown, TErr = unknown> = Readonly<{
  safeParse(input: unknown): SafeParseResult<TOut, TErr>;
}>;

export type InferSchema<S> = S extends {
  safeParse(input: unknown): SafeParseResult<infer TOut, any>;
}
  ? TOut
  : never;

export type InferSchemaError<S> = S extends {
  safeParse(input: unknown): SafeParseResult<any, infer TErr>;
}
  ? TErr
  : unknown;

// ------------------------------
// Validator adapter
// ------------------------------

export type ValidateOk<T> = Readonly<{ ok: true; value: T }>;

export type ValidateErr<TRawErr = unknown> = Readonly<{
  ok: false;
  issues: readonly ValidationIssue[];
  error?: TRawErr; // raw schema error (library-specific)
}>;

export type ValidateResult<T, TRawErr = unknown> =
  | ValidateOk<T>
  | ValidateErr<TRawErr>;

export interface Validator<TSchema> {
  validate<S extends TSchema>(
    schema: S,
    input: unknown,
    part: ValidationPart,
  ): ValidateResult<InferSchema<S>, InferSchemaError<S>>;
}

// ------------------------------
// Route request schemas + input
// ------------------------------

export type RequestSchemas<TSchema> = Readonly<{
  params?: TSchema;
  query?: TSchema;
  body?: TSchema;
}>;

export type InputOk<P, Q, B> = Readonly<{
  ok: true;
  params: P;
  query: Q;
  body: B;
}>;

export type InputErr = Readonly<{
  ok: false;

  // which parts failed
  failed: readonly ValidationPart[];

  // normalized issues across all parts
  issues: readonly ValidationIssue[];

  // raw extracted values that were validated (useful for logging / inspection)
  received: Readonly<{
    params?: unknown;
    query?: unknown;
    body?: unknown;
  }>;

  // raw per-part validator errors (library-specific), for logging only
  errors?: Readonly<Partial<Record<ValidationPart, unknown>>>;
}>;

export type InputState<P, Q, B> = InputOk<P, Q, B> | InputErr;

export type InferInput<
  TSchema,
  R extends RequestSchemas<TSchema> | undefined,
> = InputState<
  R extends { params: infer S } ? InferSchema<S> : unknown,
  R extends { query: infer S } ? InferSchema<S> : unknown,
  R extends { body: infer S } ? InferSchema<S> : unknown
>;
