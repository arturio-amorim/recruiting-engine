import type { AdapterId } from "./adapters.js";
export interface EngineInfo {
    readonly name: string;
    readonly version: string;
    readonly capabilityCount: number;
    readonly engineHost: {
        readonly host: string;
        readonly port: number;
    };
    readonly module?: {
        readonly specifier: string;
        readonly exportName: string;
    };
}
export interface CapabilityInfo {
    readonly id: string;
    readonly mcpToolName: string;
    readonly title?: string;
    readonly description: string;
    readonly annotations?: Readonly<Record<string, boolean>>;
    readonly inputSchema: Readonly<Record<string, unknown>>;
    readonly outputSchema: Readonly<Record<string, unknown>>;
    readonly timeoutMs?: number;
}
export interface DoctorInfo {
    readonly engineName: string;
    readonly engineVersion: string;
    readonly capabilityCount?: number;
    readonly findings: ReadonlyArray<Readonly<Record<string, unknown>>>;
    readonly notes: ReadonlyArray<Readonly<Record<string, unknown>>>;
}
export interface PrincipalInfo {
    readonly key: string;
    readonly principal: {
        readonly id: string;
        readonly attributes?: Readonly<Record<string, unknown>>;
    };
}
export interface IssuedPrincipal extends PrincipalInfo {
    readonly token: string;
}
/** Carries the server-reported error code alongside a readable message. */
export declare class ApiError extends Error {
    readonly code: string | undefined;
    constructor(message: string, code?: string);
}
/** One leg of the OAuth discovery chain, as `inspectMcpOAuth` reports it. */
export interface OAuthStep {
    readonly name: "challenge" | "resource-metadata" | "authorization-server-metadata" | "registration";
    readonly outcome: "ok" | "failed" | "skipped";
    readonly summary: string;
    readonly hint?: string;
    readonly detail?: unknown;
}
export interface OAuthInspection {
    readonly steps: readonly OAuthStep[];
    /** Whether an interactive authorization can be attempted. */
    readonly ready: boolean;
}
export interface HttpTargetView {
    readonly kind: "devtools" | "external";
    readonly url?: string;
    readonly authentication: {
        readonly type: "session-token" | "none" | "bearer" | "headers" | "oauth";
        readonly headerNames?: readonly string[];
        readonly environmentVariables?: readonly string[];
        readonly authorized?: boolean;
    };
}
export interface EntryPointSummary {
    readonly kind: "devtools" | "project";
    readonly path?: string;
}
export type EntryPointView = Readonly<{
    cli: EntryPointSummary;
    "mcp-stdio": EntryPointSummary;
}>;
export declare const api: {
    engine: () => Promise<EngineInfo>;
    httpTarget: () => Promise<HttpTargetView>;
    /**
     * Runs the read-only OAuth discovery check against the exact endpoint the
     * form is drafting. Nothing is authorized and no credential is sent.
     */
    checkHttpTarget: (url: string) => Promise<OAuthInspection>;
    entryPoints: () => Promise<Readonly<{
        cli: EntryPointSummary;
        "mcp-stdio": EntryPointSummary;
    }>>;
    /** Replaces which composition root runs one adapter's emulation. */
    setEntryPoint: (selection: unknown) => Promise<EntryPointView>;
    /**
     * Replaces where MCP HTTP sends a call. An OAuth target answers with the
     * authorization URL to continue in; every other target is ready at once.
     */
    setHttpTarget: (target: unknown) => Promise<{
        readonly target: HttpTargetView;
        readonly authorizationUrl?: string;
    }>;
    capabilities: () => Promise<readonly CapabilityInfo[]>;
    doctor: () => Promise<DoctorInfo>;
    principals: () => Promise<readonly PrincipalInfo[]>;
    createPrincipal: (principal: {
        readonly id: string;
        readonly attributes?: Readonly<Record<string, unknown>>;
    }) => Promise<IssuedPrincipal>;
    /** Replaces a test identity in place; its key and its token are kept. */
    updatePrincipal: (key: string, principal: {
        readonly id: string;
        readonly attributes?: Readonly<Record<string, unknown>>;
    }) => Promise<PrincipalInfo>;
    rotatePrincipal: (key: string) => Promise<IssuedPrincipal>;
    removePrincipal: (key: string) => Promise<void>;
};
export interface McpExchange {
    readonly status: number;
    readonly contentType: string | null;
    readonly requestBody: string;
    readonly responseBody: string;
}
export interface ToolCallRequest {
    readonly path: string;
    readonly method: "POST";
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
}
/**
 * Builds the exact request `callTool` sends so other surfaces (for example a
 * "Copy as curl" action) replay the same exchange byte for byte.
 */
export declare function toolCallRequest(toolName: string, args: unknown, token: string | null): ToolCallRequest;
export type AdapterOutcome = "success" | "capability-error" | "adapter-error";
export interface AdapterErrorInfo {
    readonly code: string;
    readonly message: string;
    readonly publicDetails?: unknown;
}
/**
 * What the selected adapter actually exchanged with the engine. This mirrors
 * the server's `AdapterExchange` in `adapter-runner.ts` field for field; the
 * two must not drift, or the exchange panes render the wrong record.
 */
export type AdapterExchange = {
    readonly kind: "http";
    readonly method: "POST";
    readonly url: string;
    readonly status: number;
    readonly requestBody: string;
    readonly responseBody: string;
} | {
    /** One call through the MCP client facade, which frames it for us. */
    readonly kind: "mcp";
    readonly transport: "stdio" | "http";
    /** The spawned server command, or the endpoint that was called. */
    readonly target: string;
    readonly request: string;
    readonly response: string;
} | {
    readonly kind: "process";
    readonly command: string;
    readonly argv: readonly string[];
    readonly exitCode: number | null;
    readonly signal: string | null;
    readonly stdout: string;
    readonly stderr: string;
};
export interface AdapterInvocationResult {
    readonly adapter: AdapterId;
    readonly capabilityId: string;
    readonly outcome: AdapterOutcome;
    readonly durationMs: number;
    readonly result?: unknown;
    readonly error?: AdapterErrorInfo;
    readonly exchange: AdapterExchange;
    /** Whether the selected devtools identity was presented to this call. */
    readonly identityApplied?: boolean;
}
export interface AdapterInvocationRequest {
    readonly adapter: AdapterId;
    readonly capabilityId: string;
    readonly arguments: unknown;
    readonly principalKey: string | null;
}
/**
 * Runs one capability call through the selected adapter. The dev server owns
 * the adapter, so the browser sends the same request whichever path carries
 * it and reads back one normalized outcome.
 */
export declare function invokeCapability(request: AdapterInvocationRequest, signal?: AbortSignal): Promise<AdapterInvocationResult>;
/** Sends one raw MCP `tools/call` through the same-origin proxy. */
export declare function callTool(toolName: string, args: unknown, token: string | null, signal?: AbortSignal): Promise<McpExchange>;
//# sourceMappingURL=api.d.ts.map