import { type McpClientConnection, type McpClientErrorCode, type McpClientOperationOptions, type McpClientTarget } from "@senda/mcp";
/** The verification stage a failure is attributed to, if any. */
export type VerifyFailureStage = "initialize" | "catalog" | null;
/**
 * Machine-readable failure context. It never carries secrets, environment
 * values, or protocol payloads — only user-supplied identifiers and the
 * configured limits.
 */
export type VerifyFailureDetails = Readonly<Record<string, string | number>>;
export interface VerifyFailure {
    readonly ok: false;
    readonly code: McpClientErrorCode;
    readonly stage: VerifyFailureStage;
    readonly message: string;
    readonly details?: VerifyFailureDetails;
}
export interface VerifySuccess {
    readonly ok: true;
    readonly status: "ok";
    readonly transport: "stdio" | "http";
    readonly server: {
        readonly name: string;
        readonly version: string;
        readonly protocolVersion: string;
    };
    readonly pageCount: number;
    readonly toolCount: number;
}
export type VerifyRunResult = VerifySuccess | VerifyFailure;
export type McpClientConnector = (target: McpClientTarget, options?: McpClientOperationOptions) => Promise<McpClientConnection>;
export interface RunMcpVerificationOptions {
    readonly target: McpClientTarget;
    /** Test and embedding seam. Defaults to the public `@senda/mcp` facade. */
    readonly connect?: McpClientConnector;
    readonly signal?: AbortSignal;
    readonly initializationDeadlineMs?: number;
    readonly catalogDeadlineMs?: number;
    readonly maxCatalogPages?: number;
    readonly maxTools?: number;
    readonly maxCatalogBytes?: number;
}
/**
 * Initializes one explicit MCP target and validates its complete tool catalog.
 * The runner never calls a tool, closes an obtained connection before it
 * returns a successful result, and never writes to stdout or stderr — the
 * caller renders the returned result.
 */
export declare function runMcpVerification(options: RunMcpVerificationOptions): Promise<VerifyRunResult>;
export interface RenderedMcpVerification {
    readonly exitCode: 0 | 1 | 2;
    readonly stdout?: string;
    readonly stderr?: string;
}
/**
 * Renders a verification result for a terminal: the legacy success JSON line
 * on stdout (without the `ok` discriminant, so existing stdout consumers keep
 * working) or a single diagnostic line on stderr, plus the exit code the CLI
 * should use.
 */
export declare function renderMcpVerificationResult(result: VerifyRunResult): RenderedMcpVerification;
//# sourceMappingURL=verify-mcp.d.ts.map