import { EngineError, } from "@senda/core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { toMcpToolName } from "./tool-name.js";
const ENGINE_ERROR_CODES = new Set([
    "CAPABILITY_NOT_FOUND",
    "INPUT_INVALID",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "OUTPUT_INVALID",
    "CANCELLED",
    "EXECUTION_FAILED",
]);
const EXECUTION_FAILED_TEXT = JSON.stringify({
    code: "EXECUTION_FAILED",
    message: "Capability execution failed.",
});
function asObjectSchema(schema) {
    return schema;
}
function mapAnnotations(annotations) {
    if (annotations === undefined)
        return undefined;
    return {
        ...(annotations.readOnly === undefined
            ? {}
            : { readOnlyHint: annotations.readOnly }),
        ...(annotations.destructive === undefined
            ? {}
            : { destructiveHint: annotations.destructive }),
        ...(annotations.idempotent === undefined
            ? {}
            : { idempotentHint: annotations.idempotent }),
        ...(annotations.openWorld === undefined
            ? {}
            : { openWorldHint: annotations.openWorld }),
    };
}
function serializeEngineError(error) {
    try {
        if (!(error instanceof EngineError))
            return EXECUTION_FAILED_TEXT;
        const code = error.code;
        const message = error.message;
        const publicDetails = error.publicDetails;
        if (typeof code !== "string" ||
            !ENGINE_ERROR_CODES.has(code) ||
            typeof message !== "string") {
            return EXECUTION_FAILED_TEXT;
        }
        return JSON.stringify({
            code,
            message,
            ...(publicDetails === undefined ? {} : { publicDetails }),
        });
    }
    catch {
        return EXECUTION_FAILED_TEXT;
    }
}
function errorResult(error) {
    return {
        isError: true,
        content: [
            {
                type: "text",
                text: serializeEngineError(error),
            },
        ],
    };
}
export class McpToolNameCollisionError extends TypeError {
    toolName;
    code = "MCP_TOOL_NAME_COLLISION";
    capabilityIds;
    constructor(capabilityIds, toolName) {
        super(`Capabilities ${JSON.stringify(capabilityIds[0])} and ${JSON.stringify(capabilityIds[1])} resolve to duplicate MCP tool name ${JSON.stringify(toolName)}.`);
        this.toolName = toolName;
        this.name = "McpToolNameCollisionError";
        this.capabilityIds = Object.freeze([...capabilityIds]);
    }
}
export function createMcpToolCatalog(engine) {
    const capabilityIdByToolName = new Map();
    const tools = engine.list().map((summary) => {
        const capabilityId = summary.id;
        const toolName = toMcpToolName(capabilityId);
        const existingCapabilityId = capabilityIdByToolName.get(toolName);
        if (existingCapabilityId !== undefined) {
            const firstCapabilityId = existingCapabilityId < capabilityId
                ? existingCapabilityId
                : capabilityId;
            const secondCapabilityId = existingCapabilityId < capabilityId
                ? capabilityId
                : existingCapabilityId;
            throw new McpToolNameCollisionError([firstCapabilityId, secondCapabilityId], toolName);
        }
        capabilityIdByToolName.set(toolName, capabilityId);
        const description = engine.describe(capabilityId);
        const annotations = mapAnnotations(description.annotations);
        return Object.freeze({
            name: toolName,
            description: description.description,
            inputSchema: asObjectSchema(description.inputSchema),
            outputSchema: asObjectSchema(description.outputSchema),
            ...(description.title === undefined ? {} : { title: description.title }),
            ...(annotations === undefined ? {} : { annotations }),
        });
    });
    const frozenTools = Object.freeze(tools);
    return Object.freeze({
        tools: frozenTools,
        capabilityIdForToolName: (toolName) => capabilityIdByToolName.get(toolName),
    });
}
/** Validates the exact MCP tool catalog without starting an adapter. */
export function validateMcpToolCatalog(engine) {
    createMcpToolCatalog(engine);
}
export function createMcpServer(engine, options, catalog = createMcpToolCatalog(engine)) {
    const server = new Server({ name: engine.name, version: engine.version }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: Array.from(catalog.tools),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
        const capabilityId = catalog.capabilityIdForToolName(request.params.name);
        if (capabilityId === undefined) {
            throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
        }
        try {
            const result = await engine.invoke(capabilityId, (request.params.arguments ?? {}), {
                source: options.source,
                principal: options.principal,
                signal: options.requestSignal === undefined
                    ? extra.signal
                    : AbortSignal.any([extra.signal, options.requestSignal]),
            });
            const structuredContent = result;
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(structuredContent),
                    },
                ],
                structuredContent,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    return server;
}
//# sourceMappingURL=protocol-server.js.map