export interface ParsedMcpResponse {
    readonly message?: unknown;
    readonly raw: string;
}
/**
 * Parses an MCP Streamable HTTP response body. The engine host answers with
 * plain JSON, but the transport contract also permits SSE-framed bodies, so
 * both shapes are accepted: for an event stream, the last `data:` payload is
 * the response message.
 */
export declare function parseMcpResponse(contentType: string | null, body: string): ParsedMcpResponse;
//# sourceMappingURL=mcp-response.d.ts.map