import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { McpToolNameCollisionError, validateMcpToolCatalog, } from "@senda/mcp";
const defaultExportName = "engine";
const usage = `Usage:
  senda check-mcp <esm-module> [--export <name>]

The module path is resolved against the current working directory and must
already be built to ESM. The selected export defaults to "engine" and must be
an Senda engine.

Exit codes:
  0  every capability publishes one unique portable MCP tool name
  1  the engine's MCP tool catalog is invalid
  2  invalid usage, a module that failed to load, a missing export, or an
     export that is not a usable Senda engine`;
class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = "UsageError";
    }
}
function quote(value) {
    return JSON.stringify(value);
}
function asRecord(value) {
    if (typeof value !== "object" || value === null)
        return undefined;
    return value;
}
function parseCommand(argv) {
    const [command, ...args] = argv;
    if (command === undefined)
        throw new UsageError("A command is required.");
    if (command !== "check-mcp") {
        throw new UsageError(`Unknown command ${quote(command)}.`);
    }
    let moduleSpecifier;
    let exportName;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--export") {
            if (exportName !== undefined) {
                throw new UsageError("The --export option must be provided at most once.");
            }
            const value = args[index + 1];
            if (value === undefined || value === "" || value.startsWith("-")) {
                throw new UsageError("The --export option requires a name.");
            }
            exportName = value;
            index += 1;
            continue;
        }
        if (argument.startsWith("-")) {
            throw new UsageError(`Unknown option ${quote(argument)}.`);
        }
        if (argument === "") {
            throw new UsageError("The module path must not be empty.");
        }
        if (moduleSpecifier !== undefined) {
            throw new UsageError("Exactly one module path is required.");
        }
        moduleSpecifier = argument;
    }
    if (moduleSpecifier === undefined) {
        throw new UsageError("A module path is required.");
    }
    return { moduleSpecifier, exportName: exportName ?? defaultExportName };
}
function renderLines(lines) {
    return `${lines.join("\n")}\n`;
}
function renderContext(command) {
    return [
        `module: ${quote(command.moduleSpecifier)}`,
        `export: ${quote(command.exportName)}`,
    ];
}
function renderUsageError(error) {
    return renderLines([`senda: ${error.message}`, "", usage]);
}
function renderCollision(command, error) {
    return renderLines([
        "senda: the MCP tool catalog is invalid.",
        ...renderContext(command),
        `issue: code=${quote(error.code)} toolName=${quote(error.toolName)} capabilityIds=${String(error.capabilityIds.length)}`,
        ...error.capabilityIds.map((id) => `  capability: id=${quote(id)}`),
    ]);
}
function renderLoadFailure(command) {
    return renderLines([
        "senda: the module could not be loaded.",
        ...renderContext(command),
    ]);
}
function renderMissingExport(command) {
    return renderLines([
        "senda: the module does not provide the requested export.",
        ...renderContext(command),
    ]);
}
function renderInvalidEngine(command) {
    return renderLines([
        "senda: the selected export is not a usable Senda engine.",
        ...renderContext(command),
        "reason: export the engine created by createEngine from a side-effect-free module.",
    ]);
}
function isUsableEngine(value) {
    const record = asRecord(value);
    return (typeof record?.name === "string" &&
        typeof record.version === "string" &&
        typeof record.list === "function" &&
        typeof record.describe === "function" &&
        typeof record.invoke === "function");
}
function readExport(namespace, exportName) {
    if (!Object.hasOwn(namespace, exportName)) {
        return { found: false, value: undefined };
    }
    return {
        found: true,
        value: namespace[exportName],
    };
}
function resolveIo(overrides) {
    return {
        writeStderr: overrides?.writeStderr ??
            ((text) => {
                process.stderr.write(text);
            }),
    };
}
async function writeStderr(io, text) {
    try {
        await io.writeStderr(text);
    }
    catch {
        // A diagnostic destination cannot change the command's numeric result.
    }
}
/** Validates the built engine's actual MCP tool catalog without starting it. */
export async function checkMcp(options = {}) {
    const io = resolveIo(options.io);
    let command;
    try {
        command = parseCommand(options.argv ?? process.argv.slice(2));
    }
    catch (error) {
        if (!(error instanceof UsageError))
            throw error;
        await writeStderr(io, renderUsageError(error));
        return 2;
    }
    const moduleUrl = pathToFileURL(resolve(options.cwd ?? process.cwd(), command.moduleSpecifier));
    let namespace;
    try {
        namespace = (await import(moduleUrl.href));
    }
    catch {
        await writeStderr(io, renderLoadFailure(command));
        return 2;
    }
    const selected = readExport(namespace, command.exportName);
    if (!selected.found) {
        await writeStderr(io, renderMissingExport(command));
        return 2;
    }
    if (!isUsableEngine(selected.value)) {
        await writeStderr(io, renderInvalidEngine(command));
        return 2;
    }
    try {
        validateMcpToolCatalog(selected.value);
    }
    catch (error) {
        if (error instanceof McpToolNameCollisionError) {
            await writeStderr(io, renderCollision(command, error));
            return 1;
        }
        await writeStderr(io, renderInvalidEngine(command));
        return 2;
    }
    return 0;
}
//# sourceMappingURL=check-mcp.js.map