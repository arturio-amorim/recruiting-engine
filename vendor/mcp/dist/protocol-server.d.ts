import { type CapabilityAnnotations, type CapabilityMap, type Engine, type ExecutionSource, type Principal } from "@senda/core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
interface McpServerOptions {
    readonly principal: Principal | null;
    readonly source: Extract<ExecutionSource, "mcp-stdio" | "mcp-http">;
    readonly requestSignal?: AbortSignal;
}
interface McpObjectSchema extends Readonly<Record<string, unknown>> {
    readonly type: "object";
}
declare function mapAnnotations(annotations: CapabilityAnnotations | undefined): {
    readonly readOnlyHint?: boolean;
    readonly destructiveHint?: boolean;
    readonly idempotentHint?: boolean;
    readonly openWorldHint?: boolean;
} | undefined;
interface McpToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: McpObjectSchema;
    readonly outputSchema: McpObjectSchema;
    readonly title?: string;
    readonly annotations?: ReturnType<typeof mapAnnotations>;
}
export interface McpToolCatalog<Capabilities extends CapabilityMap> {
    readonly tools: ReadonlyArray<McpToolDefinition>;
    capabilityIdForToolName(toolName: string): Extract<keyof Capabilities, string> | undefined;
}
export declare class McpToolNameCollisionError extends TypeError {
    readonly toolName: string;
    readonly code: "MCP_TOOL_NAME_COLLISION";
    readonly capabilityIds: readonly [string, string];
    constructor(capabilityIds: readonly [string, string], toolName: string);
}
export declare function createMcpToolCatalog<Capabilities extends CapabilityMap>(engine: Engine<Capabilities>): McpToolCatalog<Capabilities>;
/** Validates the exact MCP tool catalog without starting an adapter. */
export declare function validateMcpToolCatalog<Capabilities extends CapabilityMap>(engine: Engine<Capabilities>): void;
export declare function createMcpServer<Capabilities extends CapabilityMap>(engine: Engine<Capabilities>, options: McpServerOptions, catalog?: McpToolCatalog<Capabilities>): Server;
export {};
//# sourceMappingURL=protocol-server.d.ts.map