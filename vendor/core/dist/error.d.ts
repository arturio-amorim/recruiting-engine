export type EngineErrorCode = "CAPABILITY_NOT_FOUND" | "INPUT_INVALID" | "UNAUTHENTICATED" | "FORBIDDEN" | "OUTPUT_INVALID" | "CANCELLED" | "EXECUTION_FAILED";
export declare class EngineError extends Error {
    readonly code: EngineErrorCode;
    readonly publicDetails?: unknown;
    readonly cause?: unknown;
    constructor(options: {
        code: EngineErrorCode;
        message: string;
        publicDetails?: unknown;
        cause?: unknown;
    });
}
//# sourceMappingURL=error.d.ts.map