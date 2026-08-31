import type { CapabilityMap, Engine, Principal } from "@senda/core";
export { beginMcpOAuthAuthorization, connectMcpClient, inspectMcpOAuth, isForbiddenMcpClientHeader, type McpClientConnection, McpClientError, type McpClientErrorCode, type McpClientOperationOptions, type McpClientServerInfo, type McpClientTarget, type McpClientTool, type McpClientToolPage, type McpClientToolResult, type McpJsonValue, type McpOAuthAuthorization, type McpOAuthAuthorizationOptions, type McpOAuthClientTarget, type McpOAuthInspection, type McpOAuthStep, type McpOAuthStepName, } from "./client.js";
export { type McpHttpAuthenticationRequest, type McpHttpAuthOptions, type McpHttpHeaderView, type McpHttpProtectedResourceMetadata, type McpHttpServerAddress, type McpHttpServerHandle, type ServeMcpHttpOptions, serveMcpHttp, } from "./http.js";
export { toMcpToolName } from "./tool-name.js";
export { McpToolNameCollisionError, validateMcpToolCatalog, } from "./protocol-server.js";
export interface ServeMcpStdioOptions {
    readonly principal?: Principal | null;
    readonly maxReadBufferBytes?: number;
}
export declare function serveMcpStdio<Capabilities extends CapabilityMap>(engine: Engine<Capabilities>, options?: ServeMcpStdioOptions): Promise<void>;
//# sourceMappingURL=index.d.ts.map