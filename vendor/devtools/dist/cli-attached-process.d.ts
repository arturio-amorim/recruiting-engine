import { type AttachedCliChildResult, type AttachedCliSessionClock, type AttachedCliSpawn, type ParsedCliTarget } from "./cli-attached-contract.js";
export declare const attachedCliDeadlineReason: Readonly<{
    type: "attached-cli-deadline";
}>;
export declare function collectAttachedCliChild(spawn: AttachedCliSpawn, target: ParsedCliTarget, verbArgs: readonly string[], env: Record<string, string>, clock: AttachedCliSessionClock, killGraceMs: number, signal: AbortSignal): Promise<AttachedCliChildResult>;
export declare function runAttachedCliWithDeadline<Value>(clock: AttachedCliSessionClock, timeoutMs: number, controller: AbortController, operation: (signal: AbortSignal) => Promise<Value>): Promise<Value>;
//# sourceMappingURL=cli-attached-process.d.ts.map