export type CliJsonValue = null | boolean | number | string | readonly CliJsonValue[] | {
    readonly [key: string]: CliJsonValue;
};
export interface CliTarget {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
}
export interface CliCapabilitySummary {
    readonly id: string;
    readonly description: string;
    readonly title?: string;
    readonly annotations?: Readonly<Record<string, CliJsonValue>>;
}
export interface CliCapabilityDescription extends CliCapabilitySummary {
    readonly inputSchema: Readonly<Record<string, CliJsonValue>>;
    readonly outputSchema: Readonly<Record<string, CliJsonValue>>;
    readonly timeoutMs?: number;
}
export interface CliConnectionSummary {
    readonly command: string;
    readonly capabilityCount: number;
}
export type CliConnectionState = {
    readonly state: "idle";
    readonly validation?: {
        readonly status: "error";
        readonly error: {
            readonly code: string;
            readonly message: string;
        };
    };
    readonly activity?: readonly CliActivityRecord[];
} | {
    readonly state: "busy" | "connecting" | "closing";
} | {
    readonly state: "connected";
    readonly connection?: CliConnectionSummary;
};
export type CliSession = CliConnectionState & {
    readonly csrfToken: string;
};
export interface CliActivityRecord {
    readonly sequence: number | string;
    readonly operation: "list" | "describe" | "run" | "disconnect";
    readonly startedAt: string;
    readonly durationMs: number;
    readonly outcome: string;
    readonly errorCode?: string;
    readonly capabilityId?: string;
    readonly exitCode?: number | null;
}
export interface CliApi {
    session(): Promise<CliSession>;
    connect(target: CliTarget): Promise<CliConnectionState>;
    disconnect(): Promise<CliConnectionState>;
    refresh(): Promise<CliConnectionState>;
    catalog(): Promise<readonly CliCapabilitySummary[]>;
    describe(id: string): Promise<CliCapabilityDescription>;
    run(id: string, input: CliJsonValue): Promise<CliJsonValue>;
    activity(): Promise<readonly CliActivityRecord[]>;
}
export interface CliTargetDraft {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly environment: readonly Readonly<{
        name: string;
        value: string;
    }>[];
}
export interface SecretControl {
    value: string;
    placeholder?: string;
}
export type RovingOrientation = "horizontal" | "vertical" | "both";
export type TargetDraftField = "command" | "environment-name" | "environment-value";
export declare class TargetDraftValidationError extends Error {
    readonly field: TargetDraftField;
    readonly index: number | undefined;
    constructor(field: TargetDraftField, message: string, index?: number);
}
export declare function nextRovingIndex(current: number, itemCount: number, key: string, orientation: RovingOrientation): number | undefined;
export declare function buildCliTarget(draft: CliTargetDraft): CliTarget;
export declare function clearCliSecrets(controls: readonly SecretControl[]): void;
export declare function completeConnectionAttempt<Value>(attempt: Promise<Value>, secretControls: readonly SecretControl[]): Promise<Value>;
export declare function seedCliInput(schema: Readonly<Record<string, CliJsonValue>>): string;
export declare function parseRunInput(source: string): Readonly<Record<string, CliJsonValue>>;
export declare function retainedActivityOf(state: CliConnectionState): readonly CliActivityRecord[];
/** Refresh is another `list`. Any list failure except busy disconnects. */
export declare function refreshFailureIsDisconnect(code: string | undefined): boolean;
/**
 * Runs tasks one after another. The attached CLI accepts one verb at a time,
 * so overlapping requests would answer the newest one with TARGET_BUSY and
 * let an older answer land after it. A rejected task does not stall the rest.
 */
export declare function createVerbQueue(): (task: () => Promise<void>) => Promise<void>;
//# sourceMappingURL=cli-contract.d.ts.map