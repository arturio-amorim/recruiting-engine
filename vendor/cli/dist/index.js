import { EngineError, } from "@senda/core";
import { InvalidUtf8Error, readUtf8 } from "./stdin.js";
const usage = `Usage:
  engine list
  engine describe <capability-id>
  engine run <capability-id> --input '<json>'
  engine run <capability-id> --stdin`;
class CliUsageError extends Error {
    showUsage;
    constructor(message, showUsage = true) {
        super(message);
        this.name = "CliUsageError";
        this.showUsage = showUsage;
    }
}
class CliStdoutError extends Error {
    constructor(cause) {
        super("CLI stdout write failed.", { cause });
        this.name = "CliStdoutError";
    }
}
function parseCommand(argv) {
    const [command, ...args] = argv;
    if (command === "list" && args.length === 0)
        return { name: "list" };
    if (command === "describe" && args.length === 1 && args[0] !== "") {
        return { name: "describe", capabilityId: args[0] };
    }
    if (command !== "run" || args.length < 2 || args[0] === "") {
        throw new CliUsageError("Invalid command or arguments.");
    }
    const capabilityId = args[0];
    const runArguments = args.slice(1);
    if (runArguments.length === 1 && runArguments[0] === "--stdin") {
        return { name: "run", capabilityId, input: { source: "stdin" } };
    }
    if (runArguments.length === 2 &&
        runArguments[0] === "--input" &&
        runArguments[1] !== undefined) {
        return {
            name: "run",
            capabilityId,
            input: { source: "argument", value: runArguments[1] },
        };
    }
    throw new CliUsageError("Invalid command or arguments.");
}
async function readProcessStdin() {
    return readUtf8(process.stdin);
}
const defaultIo = {
    readStdin: readProcessStdin,
    writeStdout: (text) => {
        process.stdout.write(text);
    },
    writeStderr: (text) => {
        process.stderr.write(text);
    },
};
function resolveIo(overrides) {
    return {
        readStdin: overrides?.readStdin ?? defaultIo.readStdin,
        writeStdout: overrides?.writeStdout ?? defaultIo.writeStdout,
        writeStderr: overrides?.writeStderr ?? defaultIo.writeStderr,
    };
}
function parseInput(input) {
    try {
        return JSON.parse(input);
    }
    catch {
        throw new CliUsageError("Input must be valid JSON.", false);
    }
}
function serialize(value, format = "json") {
    return `${JSON.stringify(value, null, format === "human" ? 2 : undefined)}\n`;
}
const genericExecutionError = '{"error":{"code":"EXECUTION_FAILED","message":"CLI execution failed."}}\n';
function renderEngineError(error) {
    let code;
    let message;
    try {
        code = error.code;
        message = error.message;
    }
    catch {
        return genericExecutionError;
    }
    if (typeof code !== "string" || typeof message !== "string") {
        return genericExecutionError;
    }
    const safeError = { code, message };
    let publicDetails;
    try {
        publicDetails = error.publicDetails;
    }
    catch {
        return serialize({ error: safeError });
    }
    try {
        return serialize({
            error: {
                ...safeError,
                ...(publicDetails === undefined ? {} : { publicDetails }),
            },
        });
    }
    catch {
        return serialize({ error: safeError });
    }
}
function renderUsageError(error) {
    return serialize({
        error: {
            code: "INVALID_USAGE",
            message: error.showUsage ? `${error.message}\n\n${usage}` : error.message,
        },
    });
}
async function writeStdout(io, text) {
    try {
        await io.writeStdout(text);
    }
    catch (cause) {
        throw new CliStdoutError(cause);
    }
}
async function writeStderr(io, text) {
    try {
        await io.writeStderr(text);
    }
    catch {
        // A diagnostic destination cannot change the command's numeric result.
    }
}
async function execute(engine, command, options, io) {
    if (command.name === "list") {
        await writeStdout(io, serialize(engine.list(), options.format));
        return;
    }
    const capabilityId = command.capabilityId;
    if (command.name === "describe") {
        await writeStdout(io, serialize(engine.describe(capabilityId), options.format));
        return;
    }
    const encodedInput = command.input.source === "stdin"
        ? await io.readStdin()
        : command.input.value;
    const input = parseInput(encodedInput);
    const result = await engine.invoke(capabilityId, input, {
        source: "cli",
        principal: options.principal,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    await writeStdout(io, serialize(result, options.format));
}
export async function runCli(engine, options) {
    const io = resolveIo(options.io);
    let exitCode;
    try {
        if (!Object.hasOwn(options, "principal")) {
            throw new CliUsageError("The trusted principal option is required.", false);
        }
        const command = parseCommand(options.argv ?? process.argv.slice(2));
        await execute(engine, command, options, io);
        exitCode = 0;
    }
    catch (error) {
        if (error instanceof CliUsageError) {
            await writeStderr(io, renderUsageError(error));
            exitCode = 2;
        }
        else if (error instanceof InvalidUtf8Error) {
            await writeStderr(io, renderUsageError(new CliUsageError(error.message, false)));
            exitCode = 2;
        }
        else if (error instanceof EngineError) {
            await writeStderr(io, renderEngineError(error));
            exitCode = 1;
        }
        else {
            await writeStderr(io, serialize({
                error: {
                    code: "EXECUTION_FAILED",
                    message: "CLI execution failed.",
                },
            }));
            exitCode = 1;
        }
    }
    return exitCode;
}
//# sourceMappingURL=index.js.map