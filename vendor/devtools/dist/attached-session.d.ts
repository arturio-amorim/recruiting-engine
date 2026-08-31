import { beginMcpOAuthAuthorization, connectMcpClient, type McpClientErrorCode, type McpClientTool, type McpClientToolResult, type McpJsonValue, type McpOAuthAuthorizationOptions, type McpOAuthClientTarget } from "@senda/mcp";
export declare const ATTACHED_SESSION_LIMITS: Readonly<{
    initializationTimeoutMs: 15000;
    catalogTimeoutMs: 15000;
    callTimeoutMs: 60000;
    catalogBytes: number;
    catalogPages: 100;
    catalogTools: 2000;
    activityRecords: 500;
    retainedActivityRecords: 50;
    oauthAuthorizationTimeoutMs: 300000;
}>;
export type AttachedSessionErrorCode = McpClientErrorCode | "TARGET_BUSY" | "NOT_CONNECTED" | "ENVIRONMENT_VALUE_MISSING";
/** A stack-free serialization boundary for attached workbench failures. */
export declare class AttachedSessionError extends Error {
    readonly code: AttachedSessionErrorCode;
    readonly message: string;
    constructor(code: AttachedSessionErrorCode, options?: ErrorOptions);
}
export interface AttachedActivityRecord {
    readonly sequence: number;
    readonly operation: "initialize" | "tools/list" | "tools/call" | "disconnect";
    readonly startedAt: string;
    readonly durationMs: number;
    readonly outcome: "success" | "error";
    readonly errorCode?: AttachedSessionErrorCode;
    readonly toolName?: string;
}
export interface AttachedConnectionSummary {
    readonly transport: "stdio" | "http";
    readonly server: {
        readonly name: string;
        readonly version: string;
        readonly protocolVersion: string;
    };
    readonly validation: {
        readonly status: "ok";
    };
    readonly pageCount: number;
    readonly toolCount: number;
}
export type AttachedSessionState = {
    readonly state: "idle";
    readonly validation?: {
        readonly status: "error";
        readonly error: {
            readonly code: AttachedSessionErrorCode;
            readonly message: string;
        };
    };
    /**
     * The newest activity records of the last disconnected slot, retained
     * so the interface can show what happened before a failure.
     */
    readonly activity?: readonly AttachedActivityRecord[];
} | {
    readonly state: "busy";
} | {
    readonly state: "connecting";
    readonly transport: "stdio" | "http";
} | {
    readonly state: "authorizing";
    readonly transport: "http";
} | {
    readonly state: "connected";
    readonly connection: AttachedConnectionSummary;
} | {
    readonly state: "closing";
    readonly transport: "stdio" | "http";
};
export interface AttachedSessionClock {
    now(): number;
    schedule(callback: () => void, delayMs: number): unknown;
    cancel(handle: unknown): void;
}
type ConnectClient = typeof connectMcpClient;
type BeginOAuthAuthorization = typeof beginMcpOAuthAuthorization;
export interface CreateAttachedSessionControllerOptions {
    readonly connectClient?: ConnectClient;
    readonly beginOAuthAuthorization?: BeginOAuthAuthorization;
    readonly clock?: AttachedSessionClock;
}
export interface AttachedSessionController {
    connect(owner: string, target: unknown): Promise<AttachedConnectionSummary>;
    beginOAuth(owner: string, target: McpOAuthClientTarget, options: Omit<McpOAuthAuthorizationOptions, "signal">): Promise<{
        readonly authorizationUrl: string;
    }>;
    completeOAuth(state: string, authorizationCode: string): Promise<AttachedConnectionSummary>;
    rejectOAuth(state: string): Promise<void>;
    state(owner: string): AttachedSessionState;
    tools(owner: string): readonly McpClientTool[];
    call(owner: string, name: string, argumentsValue: Readonly<Record<string, McpJsonValue>>): Promise<McpClientToolResult>;
    activity(owner: string): readonly AttachedActivityRecord[];
    disconnect(owner: string): Promise<void>;
    close(): Promise<void>;
}
interface LastValidationFailure {
    readonly owner: string;
    readonly code: AttachedSessionErrorCode;
    readonly message: string;
}
/**
 * Reduces a transient operational error to the only fields retained while the
 * workbench is idle. In particular, the upstream cause is never retained.
 */
export declare function retainValidationFailure(owner: string, failure: AttachedSessionError): Readonly<LastValidationFailure>;
export declare function createAttachedSessionController(options?: CreateAttachedSessionControllerOptions): AttachedSessionController;
export {};
//# sourceMappingURL=attached-session.d.ts.map