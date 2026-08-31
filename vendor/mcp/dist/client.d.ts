export type McpJsonValue = null | boolean | number | string | readonly McpJsonValue[] | {
    readonly [key: string]: McpJsonValue;
};
export type McpClientTarget = {
    readonly transport: "stdio";
    readonly command: string;
    readonly args?: readonly string[];
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
} | {
    readonly transport: "http";
    readonly url: string;
    readonly authentication?: {
        readonly type: "none";
    } | {
        readonly type: "bearer";
        readonly token: string;
    } | {
        readonly type: "headers";
        readonly headers: Readonly<Record<string, string>>;
    };
};
export interface McpClientServerInfo {
    readonly name: string;
    readonly version: string;
    readonly protocolVersion: string;
    readonly instructions?: string;
    readonly capabilities: Readonly<Record<string, McpJsonValue>>;
}
export interface McpClientTool {
    readonly name: string;
    readonly title?: string;
    readonly description?: string;
    readonly inputSchema: Readonly<Record<string, McpJsonValue>>;
    readonly outputSchema?: Readonly<Record<string, McpJsonValue>>;
    readonly annotations?: Readonly<Record<string, McpJsonValue>>;
}
export interface McpClientToolPage {
    readonly tools: readonly McpClientTool[];
    readonly nextCursor?: string;
}
export interface McpClientToolResult {
    readonly response: Readonly<Record<string, McpJsonValue>>;
}
export interface McpClientOperationOptions {
    readonly signal?: AbortSignal;
}
export interface McpClientConnection {
    readonly server: McpClientServerInfo;
    listTools(cursor?: string, options?: McpClientOperationOptions): Promise<McpClientToolPage>;
    callTool(name: string, argumentsValue?: Readonly<Record<string, McpJsonValue>>, options?: McpClientOperationOptions): Promise<McpClientToolResult>;
    close(): Promise<void>;
}
export interface McpOAuthClientTarget {
    readonly transport: "http";
    readonly url: string;
    readonly authentication: {
        readonly type: "oauth";
    };
}
export interface McpOAuthAuthorizationOptions {
    readonly redirectUrl: string;
    readonly state: string;
    readonly signal?: AbortSignal;
}
export interface McpOAuthAuthorization {
    readonly authorizationUrl: string;
    finish(authorizationCode: string, options?: McpClientOperationOptions): Promise<McpClientConnection>;
    close(): Promise<void>;
}
export type McpOAuthStepName = "challenge" | "resource-metadata" | "authorization-server-metadata" | "registration";
export interface McpOAuthStep {
    readonly name: McpOAuthStepName;
    readonly outcome: "ok" | "failed" | "skipped";
    readonly summary: string;
    readonly hint?: string;
    readonly detail?: McpJsonValue;
}
export interface McpOAuthInspection {
    readonly steps: readonly McpOAuthStep[];
    readonly ready: boolean;
}
export type McpClientErrorCode = "INVALID_TARGET" | "SPAWN_FAILED" | "CONNECTION_FAILED" | "AUTHENTICATION_FAILED" | "PROTOCOL_ERROR" | "TIMEOUT" | "LIMIT_EXCEEDED" | "CANCELLED";
export declare class McpClientError extends Error {
    readonly code: McpClientErrorCode;
    readonly message: string;
    constructor(code: McpClientErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Whether the MCP client facade refuses a caller-supplied header name. The
 * devtools validates an external target's custom headers with this same
 * predicate so it never accepts a target the facade will refuse.
 */
export declare function isForbiddenMcpClientHeader(name: string): boolean;
export declare function connectMcpClient(target: McpClientTarget, options?: McpClientOperationOptions): Promise<McpClientConnection>;
export declare function beginMcpOAuthAuthorization(target: McpOAuthClientTarget, options: McpOAuthAuthorizationOptions): Promise<McpOAuthAuthorization>;
export declare function inspectMcpOAuth(target: McpOAuthClientTarget, options?: McpClientOperationOptions): Promise<McpOAuthInspection>;
//# sourceMappingURL=client.d.ts.map