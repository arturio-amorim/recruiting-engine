export type UnknownRecord = Readonly<Record<string, unknown>>;
export declare const programName = "senda-devtools";
export declare class UsageError extends Error {
    constructor(message: string);
}
/**
 * Every value in a diagnostic is emitted as a JSON string literal. Engine
 * names, capability IDs, and error messages are author-controlled, so quoting
 * keeps a crafted value from forging an additional diagnostic line and keeps
 * the output byte-stable for grepping.
 */
export declare function quote(value: string): string;
export declare function asRecord(value: unknown): UnknownRecord | undefined;
export declare function token(value: unknown): string;
export declare function renderLines(lines: readonly string[]): string;
export interface ThrownValueInfo {
    readonly name?: string;
    readonly code?: string;
    readonly message?: string;
}
/**
 * Extracts the safe, serializable facts of a thrown value: name, code, and
 * message only — never a stack, cause, or payload.
 */
export declare function readThrownValueInfo(error: unknown): ThrownValueInfo;
/**
 * Describes a thrown value without echoing a stack, cause, or payload. Only
 * the error name, code, and message are actionable at this boundary.
 */
export declare function describeThrownValue(error: unknown): string;
//# sourceMappingURL=diagnostics.d.ts.map