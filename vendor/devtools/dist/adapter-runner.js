import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connectMcpClient, McpClientError } from "@senda/mcp";
import { principalEnvironmentName } from "./adapters/child-context.js";
import { HttpTargetError } from "./http-target.js";
export const adapterIds = Object.freeze([
    "direct",
    "cli",
    "mcp-stdio",
    "mcp-http",
]);
export function isAdapterId(value) {
    return typeof value === "string" && adapterIds.includes(value);
}
export class AdapterBusyError extends Error {
    limit;
    constructor(limit) {
        super("Too many capability emulations are already running.");
        this.limit = limit;
        this.name = "AdapterBusyError";
    }
}
const defaultMaxConcurrent = 4;
const defaultTimeoutMs = 30_000;
const maximumTimeoutMs = 300_000;
const maximumCapturedStreamLength = 262_144;
/**
 * How much adapter output is decoded before the exchange record is truncated.
 * Matches the MCP client facade's 10 MiB message boundary, so a result the
 * MCP adapters accept is not misreported as a failure by the process ones.
 */
const maximumAdapterPayloadLength = 10 * 1024 * 1024;
/** Linux bounds one argument at 128 KiB; this stays clear of that ceiling. */
const maximumArgumentBytes = 98_304;
/** Windows bounds the whole command line at 32,767 UTF-16 characters. */
const maximumWindowsCommandLineChars = 30_000;
const killTimeoutMs = 3_000;
const environmentName = /^[A-Za-z_][A-Za-z0-9_]*$/;
function entryPath(name) {
    const sibling = fileURLToPath(new URL(`./adapters/${name}.js`, import.meta.url));
    if (existsSync(sibling))
        return sibling;
    // Running from TypeScript sources (tests): use the built package output.
    return fileURLToPath(new URL(`../dist/adapters/${name}.js`, import.meta.url));
}
/**
 * Wraps a value as a POSIX single-quoted shell word so the displayed command
 * stays copy-pasteable when an argument carries JSON or an apostrophe.
 */
function shellQuote(value) {
    return /^[A-Za-z0-9_./:@-]+$/.test(value) && value !== ""
        ? value
        : `'${value.replaceAll("'", `'\\''`)}'`;
}
function renderCommand(argv) {
    return argv.map(shellQuote).join(" ");
}
function cap(text) {
    return text.length > maximumCapturedStreamLength
        ? text.slice(0, maximumCapturedStreamLength)
        : text;
}
function resolveTimeout(requested, fallback) {
    if (requested === undefined ||
        !Number.isFinite(requested) ||
        requested <= 0) {
        return fallback;
    }
    return Math.min(Math.trunc(requested), maximumTimeoutMs);
}
/**
 * The environment an adapter child runs with: the dev server's own environment
 * plus the selected development principal, so an engine that reads a
 * credential from the environment behaves as it does in a terminal.
 */
function childEnvironment(identity) {
    const environment = {};
    for (const [name, value] of Object.entries(process.env)) {
        if (typeof value !== "string" || value === "")
            continue;
        if (!environmentName.test(name))
            continue;
        environment[name] = value;
    }
    if (identity == null) {
        delete environment[principalEnvironmentName];
        return environment;
    }
    environment[principalEnvironmentName] = JSON.stringify(identity.principal);
    return environment;
}
function killChild(child) {
    if (child.exitCode !== null || child.signalCode !== null)
        return;
    child.kill("SIGTERM");
    const timeout = setTimeout(() => {
        child.kill("SIGKILL");
    }, killTimeoutMs);
    timeout.unref?.();
    child.once("exit", () => {
        clearTimeout(timeout);
    });
}
async function runChildProcess(argv, options) {
    const [command, ...args] = argv;
    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let failure;
        let failureMessage;
        let settled = false;
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const timeout = setTimeout(() => {
            failure = "timeout";
            killChild(child);
        }, options.timeoutMs);
        const onAbort = () => {
            failure ??= "aborted";
            killChild(child);
        };
        options.signal?.addEventListener("abort", onAbort, { once: true });
        const settle = (outcome) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            options.signal?.removeEventListener("abort", onAbort);
            resolve(outcome);
        };
        // The full stream is retained up to the shared adapter payload boundary
        // so the result can be decoded whole; only the recorded exchange is
        // truncated to the capture length.
        let stdoutOverflowed = false;
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            if (stdout.length + chunk.length <= maximumAdapterPayloadLength) {
                stdout += chunk;
                return;
            }
            stdout += chunk.slice(0, maximumAdapterPayloadLength - stdout.length);
            stdoutOverflowed = true;
        });
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
            if (stderr.length < maximumAdapterPayloadLength)
                stderr += chunk;
        });
        child.once("error", (error) => {
            failure = "spawn-failed";
            failureMessage = error.message;
            settle({
                exitCode: null,
                signal: null,
                stdout,
                stderr,
                stdoutOverflowed,
                failure,
                ...(failureMessage === undefined ? {} : { failureMessage }),
            });
        });
        child.once("close", (code, signal) => {
            settle({
                exitCode: code,
                signal,
                stdout,
                stderr,
                stdoutOverflowed,
                ...(failure === undefined ? {} : { failure }),
                ...(failureMessage === undefined ? {} : { failureMessage }),
            });
        });
    });
}
function parseJson(text) {
    try {
        return { value: JSON.parse(text) };
    }
    catch {
        return {};
    }
}
function asRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return undefined;
    }
    return value;
}
/**
 * Reads the structured engine error both child adapters serialize: the CLI
 * wraps it in `error`, and the MCP adapters publish the bare record as tool
 * result text.
 */
function readEngineError(value) {
    const record = asRecord(value);
    if (record === undefined)
        return undefined;
    const wrapped = asRecord(record.error);
    const source = wrapped ?? record;
    if (typeof source.code !== "string" || typeof source.message !== "string") {
        return undefined;
    }
    return {
        code: source.code,
        message: source.message,
        ...(source.publicDetails === undefined
            ? {}
            : { publicDetails: source.publicDetails }),
    };
}
function processFailureError(outcome, adapterLabel) {
    if (outcome.failure === "timeout") {
        return {
            code: "TIMEOUT",
            message: `The ${adapterLabel} adapter did not answer before the deadline.`,
        };
    }
    if (outcome.failure === "aborted") {
        return {
            code: "CANCELLED",
            message: `The ${adapterLabel} emulation was cancelled.`,
        };
    }
    if (outcome.failure === "spawn-failed") {
        return {
            code: "SPAWN_FAILED",
            message: outcome.failureMessage ??
                `The ${adapterLabel} adapter process could not start.`,
        };
    }
    return undefined;
}
/**
 * Maps the settled child process of a stdout-reporting adapter — the CLI and
 * the direct call — onto the normalized outcome. A structured engine error on
 * stderr is the capability's own failure; anything else failed the emulation.
 */
function readProcessOutcome(outcome, adapterLabel) {
    const failure = processFailureError(outcome, adapterLabel);
    if (failure !== undefined) {
        return { outcome: "adapter-error", error: failure };
    }
    if (outcome.stdoutOverflowed) {
        // The MCP adapters refuse the same size through the facade's message
        // boundary, so the four paths stay equivalent for oversized results.
        return {
            outcome: "adapter-error",
            error: {
                code: "LIMIT_EXCEEDED",
                message: `The ${adapterLabel} adapter answered with more output than the ${String(maximumAdapterPayloadLength)}-character adapter boundary.`,
            },
        };
    }
    if (outcome.exitCode === 0) {
        const parsed = parseJson(outcome.stdout.trim());
        if (parsed.value === undefined && outcome.stdout.trim() !== "") {
            return {
                outcome: "adapter-error",
                error: {
                    code: "ADAPTER_FAILED",
                    message: `The ${adapterLabel} adapter wrote output that is not JSON.`,
                },
            };
        }
        return { outcome: "success", result: parsed.value };
    }
    const engineError = readEngineError(parseJson(outcome.stderr.trim()).value);
    if (engineError === undefined) {
        return {
            outcome: "adapter-error",
            error: {
                code: "ADAPTER_FAILED",
                message: outcome.stderr.trim() === ""
                    ? `The ${adapterLabel} adapter exited with code ${String(outcome.exitCode)}.`
                    : outcome.stderr.trim(),
            },
        };
    }
    // INVALID_USAGE is the adapter refusing the request, not the capability
    // failing; every other code came out of the invocation pipeline.
    return engineError.code === "INVALID_USAGE"
        ? { outcome: "adapter-error", error: engineError }
        : { outcome: "capability-error", error: engineError };
}
function readToolResultText(result) {
    if (!Array.isArray(result.content))
        return undefined;
    const first = asRecord(result.content[0]);
    return typeof first?.text === "string" ? first.text : undefined;
}
/** Maps a `tools/call` result onto the normalized outcome. */
function readMcpToolResult(result) {
    if (result.isError === true) {
        const text = readToolResultText(result);
        const engineError = text === undefined ? undefined : readEngineError(parseJson(text).value);
        return {
            outcome: "capability-error",
            error: engineError ?? {
                code: "EXECUTION_FAILED",
                message: text ?? "The capability failed.",
            },
        };
    }
    if (result.structuredContent !== undefined) {
        return { outcome: "success", result: result.structuredContent };
    }
    const text = readToolResultText(result);
    if (text === undefined)
        return { outcome: "success", result };
    // `parseJson` omits `value` when parsing failed, which is distinct from the
    // text being the valid JSON document `null`.
    const parsed = parseJson(text);
    return {
        outcome: "success",
        result: "value" in parsed ? parsed.value : text,
    };
}
function toolCallRequestBody(toolName, input) {
    return JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: input },
    }, null, 2);
}
/**
 * Parses an MCP Streamable HTTP response body. The engine host answers with
 * plain JSON, and the transport contract also permits SSE framing, so the last
 * `data:` payload is read when the body is an event stream.
 */
function readHttpMessage(contentType, body) {
    if (contentType?.includes("text/event-stream") === true) {
        let lastData;
        for (const line of body.split(/\r?\n/)) {
            if (line.startsWith("data:"))
                lastData = line.slice(5).trim();
        }
        return lastData === undefined ? undefined : parseJson(lastData).value;
    }
    return parseJson(body).value;
}
export function createAdapterRunner(options) {
    const maxConcurrent = options.maxConcurrent ?? defaultMaxConcurrent;
    const fallbackTimeoutMs = options.defaultTimeoutMs ?? defaultTimeoutMs;
    let active = 0;
    const childArguments = (entry, rest) => [
        process.execPath,
        entryPath(entry),
        options.module.specifier,
        options.module.exportName,
        ...rest,
    ];
    const selectedEntry = (adapter) => options.entryPoint?.(adapter) ?? { kind: "devtools" };
    /**
     * The command that runs one emulated call. The devtools child imports the
     * built module and supplies the selected identity; the engine's own entry
     * point is spawned as it is, so its composition root decides the principal.
     */
    const commandFor = (adapter, devtoolsEntryName, rest) => {
        const entry = selectedEntry(adapter);
        return entry.kind === "project"
            ? {
                argv: [process.execPath, entry.resolvedPath, ...rest],
                identityApplies: false,
            }
            : {
                argv: childArguments(devtoolsEntryName, rest),
                identityApplies: true,
            };
    };
    const runProcessAdapter = async (invocation, argv, rest, identityApplies, adapterLabel) => {
        // A command-line adapter carries its arguments in the argument vector,
        // which Linux bounds per argument and Windows bounds as one command line.
        // Refusing here names the real constraint instead of surfacing a spawn
        // failure.
        const oversized = rest.find((value) => Buffer.byteLength(value, "utf8") > maximumArgumentBytes);
        const commandLine = renderCommand(argv);
        const overWindowsLimit = process.platform === "win32" &&
            commandLine.length > maximumWindowsCommandLineChars;
        if (oversized !== undefined || overWindowsLimit) {
            return {
                adapter: invocation.adapter,
                capabilityId: invocation.capabilityId,
                outcome: "adapter-error",
                identityApplied: false,
                error: {
                    code: "ARGUMENTS_TOO_LARGE",
                    message: oversized !== undefined
                        ? `The ${adapterLabel} adapter passes arguments on the command line, which this system bounds at ${String(maximumArgumentBytes)} bytes per argument. Use an MCP adapter for a payload this size.`
                        : `The ${adapterLabel} adapter passes arguments on the command line, which Windows bounds at ${String(maximumWindowsCommandLineChars)} characters in total. Use an MCP adapter for a payload this size.`,
                },
                exchange: {
                    kind: "process",
                    command: commandLine,
                    argv,
                    exitCode: null,
                    signal: null,
                    stdout: "",
                    stderr: "",
                },
            };
        }
        const outcome = await runChildProcess(argv, {
            cwd: options.cwd,
            // A project entry point is its own composition root, so it is spawned
            // without the devtools principal: only its own root decides identity.
            env: childEnvironment(identityApplies ? invocation.identity : null),
            timeoutMs: resolveTimeout(invocation.timeoutMs, fallbackTimeoutMs),
            ...(invocation.signal === undefined ? {} : { signal: invocation.signal }),
        });
        const mapped = readProcessOutcome(outcome, adapterLabel);
        return {
            adapter: invocation.adapter,
            capabilityId: invocation.capabilityId,
            outcome: mapped.outcome,
            identityApplied: identityApplies && invocation.identity != null,
            ...(mapped.result === undefined ? {} : { result: mapped.result }),
            ...(mapped.error === undefined ? {} : { error: mapped.error }),
            exchange: {
                kind: "process",
                command: commandLine,
                argv,
                exitCode: outcome.exitCode,
                signal: outcome.signal,
                stdout: cap(outcome.stdout),
                stderr: cap(outcome.stderr),
            },
        };
    };
    const runStdioAdapter = (invocation) => {
        const { argv, identityApplies } = commandFor("mcp-stdio", "stdio-entry", []);
        const [command, ...args] = argv;
        return runFacadeCall(invocation, "stdio", renderCommand(argv), "MCP stdio", identityApplies && invocation.identity != null, async (signal) => {
            const connection = await connectMcpClient({
                transport: "stdio",
                command: command,
                args,
                cwd: options.cwd,
                env: childEnvironment(identityApplies ? invocation.identity : null),
            }, { signal });
            return {
                call: (callSignal) => connection.callTool(invocation.mcpToolName, invocation.input, { signal: callSignal }),
                close: () => connection.close(),
            };
        });
    };
    /**
     * One MCP call through the client facade — a spawned stdio server or an
     * external endpoint. The facade owns the framing, so the exchange records the
     * `tools/call` request we asked for and the result it returned.
     */
    const runFacadeCall = async (invocation, transport, target, adapterLabel, identityApplied, open) => {
        const request = toolCallRequestBody(invocation.mcpToolName, invocation.input);
        const exchange = (response) => ({
            kind: "mcp",
            transport,
            target,
            request,
            response: typeof response === "string"
                ? response
                : JSON.stringify(response, null, 2),
        });
        const deadline = AbortSignal.timeout(resolveTimeout(invocation.timeoutMs, fallbackTimeoutMs));
        const signal = invocation.signal === undefined
            ? deadline
            : AbortSignal.any([deadline, invocation.signal]);
        let close;
        try {
            const session = await open(signal);
            close = session.close;
            const called = await session.call(signal);
            const mapped = readMcpToolResult(called.response);
            return {
                adapter: invocation.adapter,
                capabilityId: invocation.capabilityId,
                outcome: mapped.outcome,
                identityApplied,
                ...(mapped.result === undefined ? {} : { result: mapped.result }),
                ...(mapped.error === undefined ? {} : { error: mapped.error }),
                exchange: exchange(called.response),
            };
        }
        catch (error) {
            const clientCode = error instanceof McpClientError ? error.code : "ADAPTER_FAILED";
            // The facade reports a deadline the same way it reports a cancellation,
            // so the timer decides which of the two the developer is told about.
            const timedOut = clientCode === "CANCELLED" && deadline.aborted;
            const code = timedOut ? "TIMEOUT" : clientCode;
            const message = timedOut
                ? `The ${adapterLabel} adapter did not answer before the deadline.`
                : error instanceof McpClientError
                    ? error.message
                    : `The ${adapterLabel} adapter failed.`;
            return {
                adapter: invocation.adapter,
                capabilityId: invocation.capabilityId,
                outcome: "adapter-error",
                identityApplied,
                error: { code, message },
                exchange: exchange({ error: { code, message } }),
            };
        }
        finally {
            await close?.().catch(() => undefined);
        }
    };
    const runExternalHttpAdapter = (invocation, resolution) => runFacadeCall(invocation, "http", resolution.url, "MCP HTTP", false, async (signal) => {
        const connection = await connectMcpClient({
            transport: "http",
            url: resolution.url,
            authentication: resolution.authentication,
        }, { signal });
        return {
            call: (callSignal) => connection.callTool(invocation.mcpToolName, invocation.input, { signal: callSignal }),
            close: () => connection.close(),
        };
    });
    const runOAuthHttpAdapter = (invocation, url) => runFacadeCall(invocation, "http", url, "MCP HTTP", false, async () => {
        const oauthCall = options.oauthCall;
        if (oauthCall === undefined) {
            throw new McpClientError("AUTHENTICATION_FAILED", "Authorize the endpoint before invoking it.");
        }
        return {
            call: (callSignal) => oauthCall(invocation.mcpToolName, invocation.input, callSignal),
            close: () => Promise.resolve(),
        };
    });
    const runDevtoolsHostAdapter = async (invocation, useSessionToken) => {
        const endpoint = options.mcpEndpoint();
        const requestBody = toolCallRequestBody(invocation.mcpToolName, invocation.input);
        const identity = useSessionToken ? invocation.identity : null;
        const identityApplied = identity != null;
        const timeoutMs = resolveTimeout(invocation.timeoutMs, fallbackTimeoutMs);
        const deadline = AbortSignal.timeout(timeoutMs);
        const signal = invocation.signal === undefined
            ? deadline
            : AbortSignal.any([deadline, invocation.signal]);
        let response;
        try {
            response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json, text/event-stream",
                    ...(identity == null
                        ? {}
                        : { authorization: `Bearer ${identity.token}` }),
                },
                body: requestBody,
                signal,
            });
        }
        catch {
            const failed = deadline.aborted
                ? {
                    code: "TIMEOUT",
                    message: "The engine host did not answer before the deadline.",
                }
                : invocation.signal?.aborted === true
                    ? {
                        code: "CANCELLED",
                        message: "The MCP HTTP emulation was cancelled.",
                    }
                    : {
                        code: "ENGINE_HOST_UNREACHABLE",
                        message: "The engine host did not accept the request.",
                    };
            return {
                adapter: invocation.adapter,
                capabilityId: invocation.capabilityId,
                outcome: "adapter-error",
                identityApplied,
                error: failed,
                exchange: {
                    kind: "http",
                    method: "POST",
                    url: endpoint,
                    status: 0,
                    requestBody,
                    responseBody: "",
                },
            };
        }
        // The complete body is decoded up to the shared adapter payload boundary;
        // only the recorded exchange is truncated to the capture length.
        const responseText = await response.text();
        const responseBody = cap(responseText);
        const exchange = {
            kind: "http",
            method: "POST",
            url: endpoint,
            status: response.status,
            requestBody,
            responseBody,
        };
        const base = {
            adapter: invocation.adapter,
            capabilityId: invocation.capabilityId,
            identityApplied,
            exchange,
        };
        if (responseText.length > maximumAdapterPayloadLength) {
            return {
                ...base,
                outcome: "adapter-error",
                error: {
                    code: "LIMIT_EXCEEDED",
                    message: `The engine host answered with more than the ${String(maximumAdapterPayloadLength)}-character adapter boundary.`,
                },
            };
        }
        if (!response.ok) {
            return {
                ...base,
                outcome: "adapter-error",
                error: {
                    code: response.status === 401 ? "UNAUTHENTICATED" : "HTTP_ERROR",
                    message: response.status === 401
                        ? useSessionToken
                            ? "The engine host rejected the session token."
                            : "The engine host requires a credential; no Authorization header was sent."
                        : `The engine host answered HTTP ${String(response.status)}.`,
                },
            };
        }
        const message = asRecord(readHttpMessage(response.headers.get("content-type"), responseText));
        const result = asRecord(message?.result);
        if (result === undefined) {
            const protocolError = asRecord(message?.error);
            return {
                ...base,
                outcome: "adapter-error",
                error: {
                    code: "PROTOCOL_ERROR",
                    message: typeof protocolError?.message === "string"
                        ? protocolError.message
                        : "The engine host answered with an unreadable MCP message.",
                },
            };
        }
        const mapped = readMcpToolResult(result);
        return {
            ...base,
            outcome: mapped.outcome,
            ...(mapped.result === undefined ? {} : { result: mapped.result }),
            ...(mapped.error === undefined ? {} : { error: mapped.error }),
        };
    };
    /**
     * Sends the call wherever the selected HTTP target points. The devtools host
     * is the default; an external endpoint is the developer's own server, whose
     * authentication is whatever that server implements.
     */
    const runHttpAdapter = async (invocation) => {
        let resolution;
        try {
            resolution = options.httpTarget?.() ?? {
                kind: "devtools",
                useSessionToken: true,
            };
        }
        catch (error) {
            // A named environment variable that is unset must not silently become an
            // anonymous call, which would misreport what the endpoint accepts.
            const failure = error instanceof HttpTargetError
                ? { code: error.code, message: error.message }
                : {
                    code: "ADAPTER_FAILED",
                    message: "The HTTP target could not be resolved.",
                };
            return {
                adapter: invocation.adapter,
                capabilityId: invocation.capabilityId,
                outcome: "adapter-error",
                identityApplied: false,
                error: failure,
                exchange: {
                    kind: "mcp",
                    transport: "http",
                    target: "",
                    request: toolCallRequestBody(invocation.mcpToolName, invocation.input),
                    response: JSON.stringify({ error: failure }, null, 2),
                },
            };
        }
        if (resolution.kind === "devtools") {
            return runDevtoolsHostAdapter(invocation, resolution.useSessionToken);
        }
        if (resolution.kind === "external-oauth") {
            return runOAuthHttpAdapter(invocation, resolution.url);
        }
        return runExternalHttpAdapter(invocation, resolution);
    };
    return {
        maxConcurrent,
        active: () => active,
        async run(invocation) {
            if (active >= maxConcurrent)
                throw new AdapterBusyError(maxConcurrent);
            active += 1;
            const startedAtMs = performance.now();
            try {
                const encodedInput = JSON.stringify(invocation.input ?? null);
                let settled;
                switch (invocation.adapter) {
                    case "cli": {
                        const rest = [
                            "run",
                            invocation.capabilityId,
                            "--input",
                            encodedInput,
                        ];
                        const command = commandFor("cli", "cli-entry", rest);
                        settled = await runProcessAdapter(invocation, command.argv, rest, command.identityApplies, "CLI");
                        break;
                    }
                    case "direct": {
                        // A direct entry point has no invocation contract to reuse, so the
                        // direct emulation is always the devtools child.
                        const rest = [invocation.capabilityId, encodedInput];
                        settled = await runProcessAdapter(invocation, childArguments("direct-entry", rest), rest, true, "direct");
                        break;
                    }
                    case "mcp-stdio":
                        settled = await runStdioAdapter(invocation);
                        break;
                    default:
                        settled = await runHttpAdapter(invocation);
                        break;
                }
                return {
                    ...settled,
                    durationMs: Math.max(0, performance.now() - startedAtMs),
                };
            }
            catch (error) {
                return {
                    adapter: invocation.adapter,
                    capabilityId: invocation.capabilityId,
                    outcome: "adapter-error",
                    identityApplied: false,
                    error: {
                        code: "ADAPTER_FAILED",
                        message: error instanceof Error
                            ? error.message
                            : "The adapter emulation failed.",
                    },
                    durationMs: Math.max(0, performance.now() - startedAtMs),
                    exchange: {
                        kind: "process",
                        command: "",
                        argv: [],
                        exitCode: null,
                        signal: null,
                        stdout: "",
                        stderr: "",
                    },
                };
            }
            finally {
                active -= 1;
            }
        },
    };
}
//# sourceMappingURL=adapter-runner.js.map