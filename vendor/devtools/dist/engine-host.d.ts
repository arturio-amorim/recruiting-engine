import type { Principal } from "@senda/core";
import type { McpHttpAuthenticationRequest, McpHttpServerHandle } from "@senda/mcp";
import type { LoadedEngine } from "./load-engine.js";
export interface InvocationRecord {
    readonly sequence: number;
    readonly capabilityId: string;
    readonly startedAt: string;
    readonly durationMs: number;
    readonly outcome: "completed" | "failed";
    readonly errorCode?: string;
}
export interface StartEngineHostOptions {
    readonly engine: LoadedEngine;
    /** Defaults to an ephemeral loopback port. */
    readonly port?: number;
    /** The devtools interface origins, the only origins the host accepts. */
    readonly allowedOrigins: ReadonlyArray<string>;
    readonly authenticate: (request: McpHttpAuthenticationRequest) => Principal | null | Promise<Principal | null>;
    readonly onRecord?: (record: InvocationRecord) => void;
}
/**
 * Starts the engine host: the unmodified `serveMcpHttp` adapter bound to
 * loopback, serving the observing delegate with required bearer
 * authentication. Every capability execution reaches the engine through
 * `engine.invoke` with source `mcp-http`.
 */
export declare function startEngineHost(options: StartEngineHostOptions): Promise<McpHttpServerHandle>;
//# sourceMappingURL=engine-host.d.ts.map