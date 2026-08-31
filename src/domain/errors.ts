import { EngineError } from "@senda/core";

export function domainFailure(
  message: string,
  publicDetails?: Readonly<Record<string, unknown>>,
): EngineError {
  return new EngineError({
    code: "EXECUTION_FAILED",
    message,
    ...(publicDetails === undefined ? {} : { publicDetails }),
  });
}

export function requirePrincipal(
  principal: { readonly id: string } | null,
): asserts principal is { readonly id: string } {
  if (principal === null) {
    throw new EngineError({
      code: "UNAUTHENTICATED",
      message: "An authenticated principal is required.",
    });
  }
}
