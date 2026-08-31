import type { Principal } from "@senda/core";
import type { McpClientToolResult } from "@senda/mcp";
import type { EntryAdapter, EntryPoint } from "./entry-target.js";
import type { HttpTargetResolution } from "./http-target.js";
/**
 * Emulates one capability call through a caller-selected adapter, chartered by
 * ADR 0028. MCP HTTP reuses the running engine host; the other three adapters
 * run in a devtools-owned child process that imports the same built module and
 * calls the published adapter. A child never outlives the call that spawned it.
 */
export type AdapterId = "direct" | "cli" | "mcp-stdio" | "mcp-http";
export declare const adapterIds: readonly AdapterId[];
export declare function isAdapterId(value: unknown): value is AdapterId;
export interface AdapterIdentity {
    readonly principal: Principal;
    /** The minted bearer token, used by the per-request MCP HTTP adapter. */
    readonly token: string;
}
export interface AdapterInvocation {
    readonly adapter: AdapterId;
    readonly capabilityId: string;
    /** The portable tool name the MCP adapters publish for this capability. */
    readonly mcpToolName: string;
    readonly input: unknown;
    readonly identity?: AdapterIdentity | null;
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
}
export interface AdapterError {
    readonly code: string;
    readonly message: string;
    readonly publicDetails?: unknown;
}
/** The record of what the selected adapter actually exchanged. */
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
export type AdapterOutcome = "success" | "capability-error" | "adapter-error";
export interface AdapterInvocationResult {
    readonly adapter: AdapterId;
    readonly capabilityId: string;
    readonly outcome: AdapterOutcome;
    readonly durationMs: number;
    readonly result?: unknown;
    readonly error?: AdapterError;
    readonly exchange: AdapterExchange;
    /**
     * Whether the selected devtools identity was actually presented to this
     * call. A project entry point, an external endpoint, and the devtools host
     * without a credential all establish the principal themselves, so a call
     * through them must not be attributed to the selected identity.
     */
    readonly identityApplied: boolean;
}
export interface AdapterRunnerModule {
    readonly specifier: string;
    readonly exportName: string;
}
/** Calls the tool over an interactively authorized OAuth session. */
export type OAuthToolCall = (toolName: string, input: unknown, signal: AbortSignal) => Promise<McpClientToolResult>;
export interface CreateAdapterRunnerOptions {
    readonly module: AdapterRunnerModule;
    readonly cwd: string;
    /** The running engine host endpoint, re-read per call because watch mode moves it. */
    readonly mcpEndpoint: () => string;
    /**
     * Where MCP HTTP sends the call and how it authenticates. Defaults to the
     * devtools host with the selected identity's session token.
     */
    readonly httpTarget?: () => HttpTargetResolution;
    /** Required only when a target selects interactive OAuth. */
    readonly oauthCall?: OAuthToolCall;
    /**
     * Which composition root runs the CLI and MCP stdio emulations. Defaults to
     * the devtools child, which supplies the selected identity.
     */
    readonly entryPoint?: (adapter: EntryAdapter) => EntryPoint;
    /** Concurrent emulations allowed at once. Defaults to 4. */
    readonly maxConcurrent?: number;
    /** Deadline applied when the caller supplies none. Defaults to 30000. */
    readonly defaultTimeoutMs?: number;
}
export interface AdapterRunner {
    run(invocation: AdapterInvocation): Promise<AdapterInvocationResult>;
    /** Emulations currently in flight; the interface reports the cap from it. */
    active(): number;
    readonly maxConcurrent: number;
}
export declare class AdapterBusyError extends Error {
    readonly limit: number;
    constructor(limit: number);
}
export declare function createAdapterRunner(options: CreateAdapterRunnerOptions): AdapterRunner;
//# sourceMappingURL=adapter-runner.d.ts.map