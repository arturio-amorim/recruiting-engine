import type { CapabilityMap, Engine, Principal } from "@senda/core";
export interface McpHttpHeaderView {
    readonly get: (name: string) => string | null;
    readonly has: (name: string) => boolean;
}
export interface McpHttpAuthenticationRequest {
    readonly path: string;
    readonly method: string;
    readonly headers: McpHttpHeaderView;
    readonly signal: AbortSignal;
}
export interface McpHttpProtectedResourceMetadata {
    readonly resource: string;
    readonly authorizationServers: readonly [string, ...string[]];
    readonly scopesSupported?: ReadonlyArray<string>;
}
interface RequiredMcpHttpAuth {
    readonly mode: "required";
    readonly authenticate: (request: McpHttpAuthenticationRequest) => Principal | null | Promise<Principal | null>;
    readonly challengeScopes?: ReadonlyArray<string>;
    readonly resourceMetadata?: McpHttpProtectedResourceMetadata;
}
interface DangerouslyDisabledMcpHttpAuth {
    readonly mode: "dangerously-disabled-for-development";
}
export type McpHttpAuthOptions = RequiredMcpHttpAuth | DangerouslyDisabledMcpHttpAuth;
export interface ServeMcpHttpOptions {
    readonly host?: string;
    readonly port?: number;
    readonly allowedHosts?: ReadonlyArray<string>;
    readonly allowedOrigins?: ReadonlyArray<string>;
    readonly maxRequestBodyBytes?: number;
    readonly auth: McpHttpAuthOptions;
}
export interface McpHttpServerAddress {
    readonly host: string;
    readonly port: number;
}
export interface McpHttpServerHandle {
    address(): McpHttpServerAddress;
    close(): Promise<void>;
}
export declare function serveMcpHttp<Capabilities extends CapabilityMap>(engine: Engine<Capabilities>, options: ServeMcpHttpOptions): Promise<McpHttpServerHandle>;
export {};
//# sourceMappingURL=http.d.ts.map