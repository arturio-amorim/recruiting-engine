import process from "node:process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
export { beginMcpOAuthAuthorization, connectMcpClient, inspectMcpOAuth, isForbiddenMcpClientHeader, McpClientError, } from "./client.js";
export { serveMcpHttp, } from "./http.js";
export { toMcpToolName } from "./tool-name.js";
export { McpToolNameCollisionError, validateMcpToolCatalog, } from "./protocol-server.js";
import { createMcpServer } from "./protocol-server.js";
import { preserveFalsyRequestIds } from "./request-id-transport.js";
const DEFAULT_MAX_READ_BUFFER_BYTES = 10 * 1024 * 1024;
class CallbackStdioServerTransport extends StdioServerTransport {
    output;
    pendingSends = new Set();
    closing;
    constructor(output, maxReadBufferBytes) {
        super(process.stdin, output, { maxBufferSize: maxReadBufferBytes });
        this.output = output;
    }
    send(message) {
        if (this.closing !== undefined) {
            return Promise.reject(new Error("The MCP stdio transport is closed."));
        }
        const pending = new Promise((resolve, reject) => {
            this.output.write(serializeMessage(message), (error) => {
                if (error === undefined || error === null)
                    resolve();
                else
                    reject(error);
            });
        });
        this.pendingSends.add(pending);
        const forget = () => {
            this.pendingSends.delete(pending);
        };
        void pending.then(forget, forget);
        return pending;
    }
    close() {
        this.closing ??= this.closeOnce();
        return this.closing;
    }
    async closeOnce() {
        await super.close();
        if (!this.output.destroyed) {
            // Writable.destroy() does not interrupt an active libuv pipe write.
            const nativeHandle = this.pendingSends.size === 0
                ? undefined
                : this.output._handle;
            this.output.destroy();
            nativeHandle?.close();
        }
        while (this.pendingSends.size > 0) {
            await Promise.allSettled([...this.pendingSends]);
        }
    }
}
function isBrokenPipe(error) {
    return error.code === "EPIPE";
}
export async function serveMcpStdio(engine, options = {}) {
    const maxReadBufferBytes = options.maxReadBufferBytes ?? DEFAULT_MAX_READ_BUFFER_BYTES;
    if (!Number.isSafeInteger(maxReadBufferBytes) || maxReadBufferBytes <= 0) {
        throw new TypeError("maxReadBufferBytes must be a positive safe integer.");
    }
    const server = createMcpServer(engine, {
        principal: options.principal ?? null,
        source: "mcp-stdio",
    });
    const transport = new CallbackStdioServerTransport(process.stdout, maxReadBufferBytes);
    let resolveLifetime;
    const lifetime = new Promise((resolve) => {
        resolveLifetime = resolve;
    });
    let closing;
    let closeRequested = false;
    const cleanup = () => {
        process.stdin.off("end", closeFromInput);
        process.stdin.off("close", closeFromInput);
        process.stdout.off("error", closeFromOutput);
    };
    const requestClose = (failure) => {
        if (closeRequested)
            return;
        closeRequested = true;
        closing = (async () => {
            try {
                await server.close();
                resolveLifetime(failure === undefined || isBrokenPipe(failure) ? undefined : failure);
            }
            catch (cause) {
                resolveLifetime(cause instanceof Error
                    ? cause
                    : new Error("Failed to close the MCP stdio server."));
            }
            finally {
                cleanup();
            }
        })();
    };
    function closeFromInput() {
        requestClose();
    }
    function closeFromOutput(error) {
        requestClose(error);
    }
    let readBufferFailure;
    server.onerror = (error) => {
        if (error.message ===
            `ReadBuffer exceeded maximum size of ${maxReadBufferBytes} bytes`) {
            readBufferFailure = new Error(`The MCP stdio read buffer exceeded the configured limit of ${maxReadBufferBytes} bytes.`, { cause: error });
        }
    };
    server.onclose = () => {
        requestClose(readBufferFailure);
        if (readBufferFailure !== undefined && !process.stdin.destroyed) {
            process.stdin.destroy();
        }
    };
    process.stdin.once("end", closeFromInput);
    process.stdin.once("close", closeFromInput);
    process.stdout.on("error", closeFromOutput);
    try {
        await server.connect(preserveFalsyRequestIds(transport));
        if (process.stdin.readableEnded || process.stdin.destroyed)
            requestClose();
        const failure = await lifetime;
        if (failure !== undefined)
            throw failure;
    }
    catch (cause) {
        requestClose();
        await closing;
        throw cause;
    }
    finally {
        cleanup();
    }
}
//# sourceMappingURL=index.js.map