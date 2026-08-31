import type { McpClientToolResult } from "@senda/mcp";
import type { OAuthSession } from "./server.js";
export interface PlaygroundOAuth extends OAuthSession {
    /** Calls a tool over the authorized session. */
    call(toolName: string, input: unknown, signal: AbortSignal): Promise<McpClientToolResult>;
    close(): Promise<void>;
}
export declare function createPlaygroundOAuth(): PlaygroundOAuth;
//# sourceMappingURL=playground-oauth.d.ts.map