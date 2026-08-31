export type AttachedJsonValue = null | boolean | number | string | readonly AttachedJsonValue[] | {
    readonly [key: string]: AttachedJsonValue;
};
export type AttachedTarget = {
    readonly transport: "stdio";
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
} | {
    readonly transport: "http";
    readonly url: string;
    readonly authentication: {
        readonly type: "none";
    } | {
        readonly type: "bearer";
        readonly token: string;
    } | {
        readonly type: "oauth";
    } | {
        readonly type: "headers";
        readonly headers: Readonly<Record<string, string>>;
    };
};
export interface AttachedTool {
    readonly name: string;
    readonly title?: string;
    readonly description?: string;
    readonly inputSchema: Readonly<Record<string, AttachedJsonValue>>;
    readonly outputSchema?: Readonly<Record<string, AttachedJsonValue>>;
    readonly annotations?: Readonly<Record<string, AttachedJsonValue>>;
}
export interface AttachedServerInfo {
    readonly name: string;
    readonly version: string;
    readonly protocolVersion: string;
}
export interface AttachedConnectionSummary {
    readonly transport: "stdio" | "http";
    readonly server: AttachedServerInfo;
    readonly pageCount: number;
    readonly toolCount: number;
}
export type AttachedConnectionState = {
    readonly state: "idle";
    readonly validation?: {
        readonly status: "error";
        readonly error: {
            readonly code: string;
            readonly message: string;
        };
    };
    /**
     * Activity the server retained from the disconnected target. The name
     * matches the `activity` field of the `GET /api/session` idle state.
     */
    readonly activity?: readonly AttachedActivityRecord[];
} | {
    readonly state: "busy" | "connecting" | "closing";
} | {
    readonly state: "authorizing";
    readonly authorizationUrl?: string;
} | {
    readonly state: "connected";
    readonly connection?: AttachedConnectionSummary;
};
export type AttachedSession = AttachedConnectionState & {
    readonly csrfToken: string;
};
export interface AttachedActivityRecord {
    readonly sequence: number | string;
    readonly operation: "initialize" | "tools/list" | "tools/call" | "disconnect";
    readonly startedAt: string;
    readonly durationMs: number;
    readonly outcome: string;
    readonly errorCode?: string;
    readonly toolName?: string;
}
export interface AttachedApi {
    session(): Promise<AttachedSession>;
    connect(target: AttachedTarget): Promise<AttachedConnectionState>;
    disconnect(): Promise<AttachedConnectionState>;
    tools(): Promise<readonly AttachedTool[]>;
    callTool(name: string, argumentsValue: Readonly<Record<string, AttachedJsonValue>>): Promise<AttachedJsonValue>;
    activity(): Promise<readonly AttachedActivityRecord[]>;
}
export interface StdioTargetDraft {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly environment: readonly Readonly<{
        name: string;
        value: string;
    }>[];
}
export type HttpTargetDraft = {
    readonly url: string;
    readonly authentication: {
        readonly type: "none";
    } | {
        readonly type: "bearer";
        readonly token: string;
    } | {
        readonly type: "oauth";
    } | {
        readonly type: "headers";
        readonly headers: readonly Readonly<{
            name: string;
            value: string;
        }>[];
    };
};
export interface SecretControl {
    value: string;
    placeholder?: string;
}
export declare const attachedPrimaryTabs: readonly ["Tools", "Activity", "Connection"];
type Fetcher = typeof fetch;
type RovingOrientation = "horizontal" | "vertical" | "both";
export declare function nextRovingIndex(current: number, itemCount: number, key: string, orientation: RovingOrientation): number | undefined;
export declare function buildStdioTarget(draft: StdioTargetDraft): AttachedTarget;
export declare function buildHttpTarget(draft: HttpTargetDraft): AttachedTarget;
export declare function completeConnectionAttempt<Value>(attempt: Promise<Value>, secretControls: readonly SecretControl[]): Promise<Value>;
export declare function filterAttachedTools(tools: readonly AttachedTool[], query: string): readonly AttachedTool[];
export declare function parseToolArguments(source: string): Readonly<Record<string, AttachedJsonValue>>;
export declare class AttachedApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Adapts the ADR 0022 loopback routes while keeping the session CSRF token in
 * this closure. No target descriptor or credential is written to storage.
 */
export declare function createRouteAttachedApi(fetcher?: Fetcher, apiBase?: string): AttachedApi;
/**
 * A starter argument object drawn from the advertised input schema so the
 * editor opens on real field names. It is a seed, not a validated value; the
 * attached server remains the only authority on its own schema.
 */
export declare function seedArguments(schema: Readonly<Record<string, AttachedJsonValue>>): string;
/**
 * Reads the activity a server may retain from a disconnected target. The field
 * is optional, so the workbench degrades to showing nothing when the server
 * exposes no retained records.
 */
export declare function retainedActivityOf(state: AttachedConnectionState): readonly AttachedActivityRecord[];
export interface AttachedAppHandle {
    destroy(): void;
}
export declare function mountAttachedApp(root: HTMLElement, api?: AttachedApi): AttachedAppHandle;
export {};
//# sourceMappingURL=attached-app.d.ts.map