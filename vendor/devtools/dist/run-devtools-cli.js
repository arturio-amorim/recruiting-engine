import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { asRecord, describeThrownValue, programName, quote, readThrownValueInfo, renderLines, token, UsageError, } from "./diagnostics.js";
import { doctorReportToJson, inspectEngine } from "./doctor.js";
import { hasComposedCapabilitiesExport, loadEngineModule, } from "./load-engine.js";
import { startServe } from "./serve.js";
import { runMcpVerification } from "./verify-mcp.js";
import { startWorkbenchDevtoolsServer } from "./workbench-server.js";
export class VerifyEnvironmentError extends Error {
    code;
    constructor(code, message) {
        super(`${code}: ${message}`);
        this.name = "VerifyEnvironmentError";
        this.code = code;
    }
}
const defaultExportName = "engine";
const mcpManifestFileName = "senda.mcp.json";
const engineUsage = `Usage:
  senda-devtools doctor <esm-module> [--export <name>] [--json]
  senda-devtools serve <esm-module> [--export <name>] [--port <number>]
    [--engine-port <number>] [--watch --build <command>]
    [--watch-include <path>]... [--watch-ignore <pattern>]...
    [--trace-capacity <count>]

The module path is resolved against the current working directory and must
already be built to ESM. The selected export defaults to "engine" and must be
the value returned by createEngine.

serve preflights the engine with the doctor checks, hosts it with the MCP
HTTP adapter on loopback, and serves the development interface on
http://localhost:4100/ unless --port selects another loopback port. A port
already in use is reported and the next free one is taken.

--watch requires --build and runs the engine in a replaceable child process:
project changes run the explicit build command, and only a successful build
replaces the running engine host. Modules are never reloaded in process.
--watch-include and --watch-ignore narrow which project paths trigger a
rebuild; --trace-capacity bounds the retained invocation trace entries.

doctor --json prints the report as JSON to stdout instead of the human
summary.

Exit codes:
  0  the engine passed the doctor checks, or the dev server shut down cleanly
  1  the doctor reported findings, or the dev server could not start
  2  invalid usage, a module that failed to load, a missing export, or an
     export that is not an engine`;
const usage = engineUsage.replace("Usage:\n", `Usage:
  senda-devtools [--mcp | --cli] [--port <number>]
  senda-devtools open [--mcp | --cli] [--port <number>]
  senda-devtools verify --stdio <executable> [--arg <value>]...
    [--cwd <directory>] [--env <child-name>=<source-environment-name>]...
    [--timeout-ms <ms>] [--max-tools <count>] [--json]
  senda-devtools verify --http <url> [--auth <none|bearer|headers>]
    [--bearer-env <environment-name>]
    [--header-env <header-name>=<environment-name>]...
    [--timeout-ms <ms>] [--max-tools <count>] [--json]
  senda-devtools --help
  senda-devtools --version

open serves both idle workbenches on one loopback origin and lands on the
chooser. --mcp and --cli land on that workbench instead; either one is still
reachable from the other. --timeout-ms bounds the initialization and catalog
deadlines,
--max-tools bounds the accepted tool count, and --json prints the verification
result as JSON (success to stdout, failure to stderr).
`);
function parseModuleArguments(args) {
    let moduleSpecifier;
    let exportName;
    let json = false;
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
        if (argument === "--json") {
            if (json) {
                throw new UsageError("The --json option must be provided at most once.");
            }
            json = true;
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
    return {
        moduleSpecifier,
        exportName: exportName ?? defaultExportName,
        ...(json ? { json: true } : {}),
    };
}
function parsePort(option, value) {
    if (value === undefined || value === "" || value.startsWith("-")) {
        throw new UsageError(`The ${option} option requires a port number.`);
    }
    const port = Number(value);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
        throw new UsageError(`The ${option} option requires a port between 1 and 65535.`);
    }
    return port;
}
function parsePositiveIntegerOption(option, value) {
    if (value === undefined || value === "" || value.startsWith("-")) {
        throw new UsageError(`The ${option} option requires a positive integer.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new UsageError(`The ${option} option requires a positive integer.`);
    }
    return parsed;
}
function parseOpenArguments(args) {
    let port;
    let workbench;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--port") {
            if (port !== undefined) {
                throw new UsageError("The --port option must be provided at most once.");
            }
            port = parsePort("--port", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === "--cli" || argument === "--mcp") {
            const selected = argument === "--cli" ? "cli" : "mcp";
            if (workbench === selected) {
                throw new UsageError(`The ${argument} option must be provided at most once.`);
            }
            if (workbench !== undefined) {
                throw new UsageError("The --cli and --mcp options select one workbench each.");
            }
            workbench = selected;
            continue;
        }
        if (argument.startsWith("-")) {
            throw new UsageError(`Unknown option ${quote(argument)}.`);
        }
        throw new UsageError("The open command does not accept positional arguments.");
    }
    return {
        ...(port === undefined ? {} : { port }),
        ...(workbench === undefined ? {} : { workbench }),
    };
}
const environmentNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const headerNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const transportOwnedHeaderNames = new Set([
    "accept",
    "connection",
    "content-length",
    "content-type",
    "cookie",
    "host",
    "last-event-id",
    "mcp-protocol-version",
    "mcp-session-id",
    "origin",
    "set-cookie",
    "transfer-encoding",
    "upgrade",
]);
function requiredOptionValue(option, value) {
    if (value === undefined || value === "" || value.startsWith("-")) {
        throw new UsageError(`The ${option} option requires a value.`);
    }
    return value;
}
function parseEnvironmentPair(option, value) {
    if (value === undefined || value === "") {
        const shape = option === "--env" ? "CHILD=SOURCE" : "HEADER=SOURCE";
        throw new UsageError(`The ${option} option requires ${shape}.`);
    }
    const separator = value.indexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
        const shape = option === "--env" ? "CHILD=SOURCE" : "HEADER=SOURCE";
        throw new UsageError(`The ${option} option requires ${shape}.`);
    }
    return [value.slice(0, separator), value.slice(separator + 1)];
}
function assertEnvironmentName(name, option) {
    if (!environmentNamePattern.test(name)) {
        throw new UsageError(`The ${option} option requires valid environment variable names.`);
    }
}
function assertHttpUrl(value) {
    if (value !== value.trim() ||
        (!value.startsWith("https://") && !value.startsWith("http://"))) {
        throw new UsageError("The --http option requires an absolute HTTP URL.");
    }
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new UsageError("The --http option requires an absolute HTTP URL.");
    }
    if (url.username !== "" || url.password !== "") {
        throw new UsageError("The --http URL must not contain credentials.");
    }
    if (value.includes("?")) {
        throw new UsageError("The --http URL must not contain a query.");
    }
    if (value.includes("#")) {
        throw new UsageError("The --http URL must not contain a fragment.");
    }
    if (url.hostname === "") {
        throw new UsageError("The --http option requires an absolute HTTP URL.");
    }
    if (url.protocol !== "https:" &&
        !(url.protocol === "http:" &&
            (url.hostname === "127.0.0.1" || url.hostname === "[::1]"))) {
        throw new UsageError("The --http URL requires HTTPS except for a literal loopback address.");
    }
    if (url.href !== value && url.href !== `${value}/`) {
        throw new UsageError("The --http option requires a canonical absolute HTTP URL.");
    }
}
function assertHeaderName(name) {
    if (!headerNamePattern.test(name)) {
        throw new UsageError("The --header-env option requires a valid HTTP field name.");
    }
    const normalized = name.toLowerCase();
    if (transportOwnedHeaderNames.has(normalized) ||
        normalized.startsWith("proxy-") ||
        normalized.startsWith("sec-")) {
        throw new UsageError("The --header-env option cannot set a transport-owned header.");
    }
}
function parseVerifyArguments(args) {
    let stdioCommand;
    let httpUrl;
    let stdioProvided = false;
    let httpProvided = false;
    const stdioArgs = [];
    let cwd;
    const environment = [];
    const environmentChildNames = new Set();
    let auth;
    let bearerSourceName;
    const headerEnvironment = [];
    const normalizedHeaderNames = new Set();
    let timeoutMs;
    let maxTools;
    let json = false;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--stdio") {
            if (stdioProvided) {
                throw new UsageError("The --stdio option must be provided at most once.");
            }
            stdioProvided = true;
            stdioCommand = requiredOptionValue("--stdio", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === "--http") {
            if (httpProvided) {
                throw new UsageError("The --http option must be provided at most once.");
            }
            httpProvided = true;
            httpUrl = requiredOptionValue("--http", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === "--arg") {
            const value = args[index + 1];
            if (value === undefined) {
                throw new UsageError("The --arg option requires a value.");
            }
            stdioArgs.push(value);
            index += 1;
            continue;
        }
        if (argument === "--cwd") {
            if (cwd !== undefined) {
                throw new UsageError("The --cwd option must be provided at most once.");
            }
            cwd = requiredOptionValue("--cwd", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === "--env") {
            const [childName, sourceName] = parseEnvironmentPair("--env", args[index + 1]);
            assertEnvironmentName(childName, "--env");
            assertEnvironmentName(sourceName, "--env");
            if (environmentChildNames.has(childName)) {
                throw new UsageError("The --env option must provide each child name at most once.");
            }
            environmentChildNames.add(childName);
            environment.push({ childName, sourceName });
            index += 1;
            continue;
        }
        if (argument === "--auth") {
            if (auth !== undefined) {
                throw new UsageError("The --auth option must be provided at most once.");
            }
            const value = requiredOptionValue("--auth", args[index + 1]);
            if (value !== "none" && value !== "bearer" && value !== "headers") {
                throw new UsageError("The --auth option must be none, bearer, or headers.");
            }
            auth = value;
            index += 1;
            continue;
        }
        if (argument === "--bearer-env") {
            if (bearerSourceName !== undefined) {
                throw new UsageError("The --bearer-env option must be provided at most once.");
            }
            bearerSourceName = requiredOptionValue("--bearer-env", args[index + 1]);
            assertEnvironmentName(bearerSourceName, "--bearer-env");
            index += 1;
            continue;
        }
        if (argument === "--header-env") {
            const [headerName, sourceName] = parseEnvironmentPair("--header-env", args[index + 1]);
            assertHeaderName(headerName);
            assertEnvironmentName(sourceName, "--header-env");
            const normalizedName = headerName.toLowerCase();
            if (normalizedHeaderNames.has(normalizedName)) {
                throw new UsageError("The --header-env names must be case-insensitively unique.");
            }
            normalizedHeaderNames.add(normalizedName);
            headerEnvironment.push({ headerName, sourceName });
            index += 1;
            continue;
        }
        if (argument === "--timeout-ms") {
            if (timeoutMs !== undefined) {
                throw new UsageError("The --timeout-ms option must be provided at most once.");
            }
            timeoutMs = parsePositiveIntegerOption("--timeout-ms", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === "--max-tools") {
            if (maxTools !== undefined) {
                throw new UsageError("The --max-tools option must be provided at most once.");
            }
            maxTools = parsePositiveIntegerOption("--max-tools", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === "--json") {
            if (json) {
                throw new UsageError("The --json option must be provided at most once.");
            }
            json = true;
            continue;
        }
        if (argument.startsWith("-")) {
            throw new UsageError(`Unknown option ${quote(argument)}.`);
        }
        throw new UsageError("The verify command does not accept positional arguments.");
    }
    const verificationOptions = {
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
        ...(maxTools === undefined ? {} : { maxTools }),
        ...(json ? { json: true } : {}),
    };
    if (stdioProvided === httpProvided) {
        throw new UsageError("The verify command requires exactly one of --stdio and --http.");
    }
    if (stdioProvided) {
        if (auth !== undefined ||
            bearerSourceName !== undefined ||
            headerEnvironment.length > 0) {
            throw new UsageError("The --auth, --bearer-env, and --header-env options are valid only with --http.");
        }
        return {
            command: "verify",
            ...verificationOptions,
            target: {
                transport: "stdio",
                command: stdioCommand,
                args: stdioArgs,
                ...(cwd === undefined ? {} : { cwd }),
                environment,
            },
        };
    }
    if (stdioArgs.length > 0 || cwd !== undefined || environment.length > 0) {
        throw new UsageError("The --arg, --cwd, and --env options are valid only with --stdio.");
    }
    assertHttpUrl(httpUrl);
    const authentication = auth ?? "none";
    if (authentication === "none") {
        if (bearerSourceName !== undefined) {
            throw new UsageError("Authentication none forbids --bearer-env.");
        }
        if (headerEnvironment.length > 0) {
            throw new UsageError("Authentication none forbids --header-env.");
        }
        return {
            command: "verify",
            ...verificationOptions,
            target: {
                transport: "http",
                url: httpUrl,
                authentication: { type: "none" },
            },
        };
    }
    if (authentication === "bearer") {
        if (bearerSourceName === undefined) {
            throw new UsageError("Authentication bearer requires --bearer-env.");
        }
        if (headerEnvironment.length > 0) {
            throw new UsageError("Authentication bearer forbids --header-env.");
        }
        return {
            command: "verify",
            ...verificationOptions,
            target: {
                transport: "http",
                url: httpUrl,
                authentication: { type: "bearer", sourceName: bearerSourceName },
            },
        };
    }
    if (bearerSourceName !== undefined) {
        throw new UsageError("Authentication headers forbids --bearer-env.");
    }
    if (headerEnvironment.length === 0) {
        throw new UsageError("Authentication headers requires at least one --header-env.");
    }
    return {
        command: "verify",
        ...verificationOptions,
        target: {
            transport: "http",
            url: httpUrl,
            authentication: { type: "headers", headers: headerEnvironment },
        },
    };
}
function parseServeArguments(args) {
    const positional = [];
    let exportName;
    let port;
    let enginePort;
    let watch = false;
    let buildCommand;
    const watchInclude = [];
    const watchIgnore = [];
    let traceCapacity;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--watch") {
            if (watch) {
                throw new UsageError("The --watch option must be provided at most once.");
            }
            watch = true;
            continue;
        }
        if (argument === "--build") {
            if (buildCommand !== undefined) {
                throw new UsageError("The --build option must be provided at most once.");
            }
            const value = args[index + 1];
            if (value === undefined || value === "" || value.startsWith("-")) {
                throw new UsageError("The --build option requires a command.");
            }
            buildCommand = value;
            index += 1;
            continue;
        }
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
        if (argument === "--port") {
            if (port !== undefined) {
                throw new UsageError("The --port option must be provided at most once.");
            }
            port = parsePort("--port", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === "--engine-port") {
            if (enginePort !== undefined) {
                throw new UsageError("The --engine-port option must be provided at most once.");
            }
            enginePort = parsePort("--engine-port", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === "--watch-include") {
            watchInclude.push(requiredOptionValue("--watch-include", args[index + 1]));
            index += 1;
            continue;
        }
        if (argument === "--watch-ignore") {
            watchIgnore.push(requiredOptionValue("--watch-ignore", args[index + 1]));
            index += 1;
            continue;
        }
        if (argument === "--trace-capacity") {
            if (traceCapacity !== undefined) {
                throw new UsageError("The --trace-capacity option must be provided at most once.");
            }
            traceCapacity = parsePositiveIntegerOption("--trace-capacity", args[index + 1]);
            index += 1;
            continue;
        }
        if (argument.startsWith("-")) {
            throw new UsageError(`Unknown option ${quote(argument)}.`);
        }
        if (argument === "") {
            throw new UsageError("The module path must not be empty.");
        }
        positional.push(argument);
    }
    if (positional.length === 0) {
        throw new UsageError("A module path is required.");
    }
    if (positional.length > 1) {
        throw new UsageError("Exactly one module path is required.");
    }
    if (watch !== (buildCommand !== undefined)) {
        throw new UsageError("The --watch and --build options must be provided together.");
    }
    if (!watch && (watchInclude.length > 0 || watchIgnore.length > 0)) {
        throw new UsageError("The --watch-include and --watch-ignore options require --watch.");
    }
    return {
        moduleSpecifier: positional[0],
        exportName: exportName ?? defaultExportName,
        ...(port === undefined ? {} : { port }),
        ...(enginePort === undefined ? {} : { enginePort }),
        ...(buildCommand === undefined ? {} : { buildCommand }),
        ...(watchInclude.length === 0 ? {} : { watchInclude }),
        ...(watchIgnore.length === 0 ? {} : { watchIgnore }),
        ...(traceCapacity === undefined ? {} : { traceCapacity }),
    };
}
/**
 * Parses the complete command line without reading the process environment or
 * performing module, filesystem, process, or network work.
 */
export function parseDevtoolsCommand(argv) {
    const [command, ...args] = argv;
    if (command === undefined)
        return { command: "open" };
    if (command === "--help" || command === "-h") {
        return { command: "help" };
    }
    if (command === "--version" || command === "-v") {
        return { command: "version" };
    }
    if (command.startsWith("-")) {
        return { command: "open", ...parseOpenArguments(argv) };
    }
    if (command === "open") {
        return { command: "open", ...parseOpenArguments(args) };
    }
    if (command === "verify") {
        return parseVerifyArguments(args);
    }
    if (command === "doctor") {
        return { command: "doctor", ...parseModuleArguments(args) };
    }
    if (command === "serve") {
        return { command: "serve", ...parseServeArguments(args) };
    }
    throw new UsageError(`Unknown command ${quote(command)}.`);
}
/**
 * Resolves already-validated environment references into a plain MCP target.
 * Callers must parse the entire argv first; this function never receives argv
 * and cannot make an invalid option combination trigger a credential lookup.
 */
export function resolveVerifyTargetEnvironment(command, readEnvironmentValue) {
    if (command.command !== "verify") {
        throw new TypeError("A parsed verify command is required.");
    }
    if (command.target.transport === "stdio") {
        const entries = command.target.environment.map(({ childName, sourceName }) => {
            const value = readEnvironmentValue(sourceName);
            if (value === undefined || value === "") {
                throw new VerifyEnvironmentError("ENVIRONMENT_VALUE_MISSING", `${quote(sourceName)} is not set.`);
            }
            return [childName, value];
        });
        return {
            transport: "stdio",
            command: command.target.command,
            args: [...command.target.args],
            ...(command.target.cwd === undefined ? {} : { cwd: command.target.cwd }),
            ...(entries.length === 0 ? {} : { env: Object.fromEntries(entries) }),
        };
    }
    if (command.target.authentication.type === "none") {
        return {
            transport: "http",
            url: command.target.url,
            authentication: { type: "none" },
        };
    }
    if (command.target.authentication.type === "bearer") {
        const tokenValue = readEnvironmentValue(command.target.authentication.sourceName);
        if (tokenValue === undefined || tokenValue === "") {
            throw new VerifyEnvironmentError("ENVIRONMENT_VALUE_MISSING", `${quote(command.target.authentication.sourceName)} is not set.`);
        }
        if (tokenValue.startsWith(" ") ||
            tokenValue.startsWith("\t") ||
            tokenValue.endsWith(" ") ||
            tokenValue.endsWith("\t") ||
            tokenValue.includes("\r") ||
            tokenValue.includes("\n")) {
            throw new VerifyEnvironmentError("INVALID_TARGET", "The bearer environment value is not a valid header value.");
        }
        return {
            transport: "http",
            url: command.target.url,
            authentication: { type: "bearer", token: tokenValue },
        };
    }
    const headerEntries = command.target.authentication.headers.map(({ headerName, sourceName }) => {
        const value = readEnvironmentValue(sourceName);
        if (value === undefined) {
            throw new VerifyEnvironmentError("ENVIRONMENT_VALUE_MISSING", `${quote(sourceName)} is not set.`);
        }
        if (value.includes("\r") || value.includes("\n")) {
            throw new VerifyEnvironmentError("INVALID_TARGET", "A custom header environment value is not valid.");
        }
        return [headerName, value];
    });
    return {
        transport: "http",
        url: command.target.url,
        authentication: {
            type: "headers",
            headers: Object.fromEntries(headerEntries),
        },
    };
}
function renderContext(command) {
    return [
        `module: ${quote(command.moduleSpecifier)}`,
        `export: ${quote(command.exportName)}`,
    ];
}
function renderUsageError(error, selectedUsage = usage) {
    return renderLines([`${programName}: ${error.message}`, "", selectedUsage]);
}
function renderVerifyFailure(code, message) {
    return `${programName} verify: ${code}: ${message}\n`;
}
function renderLoadFailure(command, error, cwd) {
    const hint = readThrownValueInfo(error).code === "ERR_MODULE_NOT_FOUND" ||
        !existsSync(resolve(cwd, command.moduleSpecifier))
        ? [
            "reason: build the engine module first (the path must point to built ESM output).",
        ]
        : [];
    return renderLines([
        `${programName}: the module could not be loaded.`,
        ...renderContext(command),
        describeThrownValue(error),
        ...hint,
    ]);
}
function renderMissingExport(command) {
    return renderLines([
        `${programName}: the module does not provide the requested export.`,
        ...renderContext(command),
        "reason: build the engine module and export the value returned by createEngine.",
    ]);
}
function renderNotAnEngine(command) {
    return renderLines([
        `${programName}: the selected export is not an engine.`,
        ...renderContext(command),
        "reason: an engine provides name, version, invoke, list, and describe.",
    ]);
}
function renderHint(owner) {
    return owner.hint === undefined ? "" : ` hint: ${owner.hint}`;
}
function renderFinding(finding) {
    if (finding.code === "LIST_UNREADABLE") {
        const suffix = finding.error === undefined
            ? ""
            : ` ${describeThrownValue(finding.error)}`;
        return `finding: code="LIST_UNREADABLE"${suffix}${renderHint(finding)}`;
    }
    if (finding.code === "DESCRIBE_FAILED") {
        const suffix = finding.error === undefined
            ? ""
            : ` ${describeThrownValue(finding.error)}`;
        return `finding: code="DESCRIBE_FAILED" capabilityId=${quote(finding.capabilityId)}${suffix}${renderHint(finding)}`;
    }
    return `finding: code="SCHEMA_UNREADABLE" capabilityId=${quote(finding.capabilityId)} schema=${quote(finding.schema)}${renderHint(finding)}`;
}
function renderNote(note) {
    const parts = [`note: code=${quote(note.code)}`];
    if ("capabilityId" in note) {
        parts.push(`capabilityId=${quote(note.capabilityId)}`);
    }
    if ("schema" in note) {
        parts.push(`schema=${quote(note.schema)}`);
    }
    if (note.code === "COMPOSITION_CHECK_AVAILABLE") {
        parts.push(`reason: run "senda check-capabilities" against the composed export.`);
    }
    return `${parts.join(" ")}${renderHint(note)}`;
}
function renderReport(command, report) {
    const passed = report.findings.length === 0;
    const capabilityCount = report.capabilityCount === undefined
        ? '"<unreadable>"'
        : String(report.capabilityCount);
    const lines = [
        passed
            ? `${programName}: the engine passed the doctor checks.`
            : `${programName}: the engine failed the doctor checks.`,
        ...renderContext(command),
        `engine: name=${token(report.engineName)} version=${token(report.engineVersion)} capabilities=${capabilityCount}`,
    ];
    if (report.findings.length > 0) {
        lines.push(`findings: ${String(report.findings.length)}`);
        lines.push(...report.findings.map(renderFinding));
    }
    lines.push(`notes: ${String(report.notes.length)}`);
    lines.push(...report.notes.map(renderNote));
    return renderLines(lines);
}
function resolveIo(overrides) {
    return {
        writeStdout: overrides?.writeStdout ??
            ((text) => {
                process.stdout.write(text);
            }),
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
async function runDoctor(command, cwd, io) {
    const loaded = await loadEngineModule({
        moduleSpecifier: command.moduleSpecifier,
        exportName: command.exportName,
        cwd,
    });
    if (loaded.kind === "load-failed") {
        await writeStderr(io, renderLoadFailure(command, loaded.error, cwd));
        return 2;
    }
    if (loaded.kind === "export-missing") {
        await writeStderr(io, renderMissingExport(command));
        return 2;
    }
    if (loaded.kind === "not-an-engine") {
        await writeStderr(io, renderNotAnEngine(command));
        return 2;
    }
    const report = inspectEngine(loaded.engine, {
        mcpManifestPresent: existsSync(resolve(cwd, mcpManifestFileName)),
        composedCapabilitiesExport: hasComposedCapabilitiesExport(loaded.namespace),
    });
    if (command.json === true) {
        try {
            await io.writeStdout(`${JSON.stringify(doctorReportToJson(report), null, 2)}\n`);
        }
        catch {
            // A gone stdout cannot change the doctor result.
        }
    }
    else {
        await writeStderr(io, renderReport(command, report));
    }
    return report.findings.length === 0 ? 0 : 1;
}
/**
 * Summarizes the loaded engine for the serve startup block. A listing
 * failure only drops the summary line; it never blocks the server start.
 */
function renderServeEngineSummary(engine) {
    try {
        return `engine: name=${token(engine.name)} version=${token(engine.version)} capabilities=${String(engine.list().length)}`;
    }
    catch {
        return undefined;
    }
}
/**
 * A taken port is a routine development condition, not a failure: the server
 * walks to the next free one and the terminal says which port answered.
 */
function renderPortInUse(requested, selected) {
    return `port: ${String(requested)} is in use, using ${String(selected)} instead\n`;
}
function renderServeFailure(command, error) {
    return renderLines([
        `${programName}: the dev server could not start.`,
        ...renderContext(command),
        describeThrownValue(error),
    ]);
}
function waitForShutdownSignal() {
    return new Promise((resolvePromise) => {
        const stop = () => {
            process.removeListener("SIGINT", stop);
            process.removeListener("SIGTERM", stop);
            resolvePromise();
        };
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
    });
}
async function runServe(command, cwd, io) {
    let serveOptions;
    let engineSummary;
    let requestedPort;
    const onPortInUse = (port) => {
        requestedPort ??= port;
    };
    if (command.buildCommand !== undefined) {
        // In watch mode the module belongs to the child host; the parent never
        // imports it, so a rebuild can only ever apply by process replacement.
        serveOptions = {
            cwd,
            watch: {
                moduleSpecifier: command.moduleSpecifier,
                exportName: command.exportName,
                buildCommand: command.buildCommand,
                ...(command.watchInclude === undefined
                    ? {}
                    : { include: [...command.watchInclude] }),
                ...(command.watchIgnore === undefined
                    ? {}
                    : { ignore: [...command.watchIgnore] }),
            },
            onDiagnostic: (text) => {
                void writeStderr(io, text);
            },
            onPortInUse,
            ...(command.port === undefined ? {} : { port: command.port }),
            ...(command.enginePort === undefined
                ? {}
                : { enginePort: command.enginePort }),
            ...(command.traceCapacity === undefined
                ? {}
                : { traceCapacity: command.traceCapacity }),
        };
    }
    else {
        const loaded = await loadEngineModule({
            moduleSpecifier: command.moduleSpecifier,
            exportName: command.exportName,
            cwd,
        });
        if (loaded.kind === "load-failed") {
            await writeStderr(io, renderLoadFailure(command, loaded.error, cwd));
            return 2;
        }
        if (loaded.kind === "export-missing") {
            await writeStderr(io, renderMissingExport(command));
            return 2;
        }
        if (loaded.kind === "not-an-engine") {
            await writeStderr(io, renderNotAnEngine(command));
            return 2;
        }
        engineSummary = renderServeEngineSummary(loaded.engine);
        serveOptions = {
            engine: loaded.engine,
            cwd,
            module: {
                specifier: command.moduleSpecifier,
                exportName: command.exportName,
            },
            composedCapabilitiesExport: hasComposedCapabilitiesExport(loaded.namespace),
            onPortInUse,
            ...(command.port === undefined ? {} : { port: command.port }),
            ...(command.enginePort === undefined
                ? {}
                : { enginePort: command.enginePort }),
            ...(command.traceCapacity === undefined
                ? {}
                : { traceCapacity: command.traceCapacity }),
        };
    }
    let result;
    try {
        result = await startServe(serveOptions);
    }
    catch (error) {
        await writeStderr(io, renderServeFailure(command, error));
        return 1;
    }
    if (result.kind === "load-error") {
        if (result.stage === "load-failed") {
            await writeStderr(io, renderLoadFailure(command, result.error, cwd));
        }
        else if (result.stage === "export-missing") {
            await writeStderr(io, renderMissingExport(command));
        }
        else {
            await writeStderr(io, renderNotAnEngine(command));
        }
        return 2;
    }
    if (result.kind === "refused") {
        await writeStderr(io, renderReport(command, result.report));
        return 1;
    }
    const address = result.handles.devtoolsAddress;
    // ADR 0021 pins stdout to exactly this ready line, and `open` prints the
    // same one; the extra startup context is a diagnostic and goes to stderr.
    if (requestedPort !== undefined) {
        await writeStderr(io, renderPortInUse(requestedPort, address.port));
    }
    await writeStderr(io, renderLines([
        ...(engineSummary === undefined ? [] : [engineSummary]),
        command.buildCommand === undefined
            ? "watch: off"
            : `watch: on build=${quote(command.buildCommand)}`,
        "Ctrl+C to stop",
    ]));
    try {
        await io.writeStdout(`Senda devtools listening on http://${address.host}:${String(address.port)}/\n`);
    }
    catch {
        // A gone stdout must not abort a running dev server.
    }
    await waitForShutdownSignal();
    await result.handles.close();
    return 0;
}
async function runOpen(command, io) {
    let requestedPort;
    const onPortInUse = (port) => {
        requestedPort ??= port;
    };
    let server;
    try {
        server = await startWorkbenchDevtoolsServer({
            onPortInUse,
            ...(command.port === undefined ? {} : { port: command.port }),
        });
    }
    catch (error) {
        const hint = readThrownValueInfo(error).code === "EADDRINUSE"
            ? ["hint: pass --port <number> to select another loopback port."]
            : [];
        await writeStderr(io, renderLines([
            `${programName}: the workbenches could not start.`,
            describeThrownValue(error),
            ...hint,
        ]));
        return 1;
    }
    const address = server.address();
    await writeStderr(io, command.workbench === undefined
        ? "workbenches: MCP and CLI\n"
        : `${command.workbench === "cli" ? "CLI" : "MCP"} workbench\n`);
    if (requestedPort !== undefined) {
        await writeStderr(io, renderPortInUse(requestedPort, address.port));
    }
    try {
        // ADR 0021 pins stdout to exactly one ready line; the selected workbench
        // is the path inside it.
        await io.writeStdout(`Senda devtools listening on http://${address.host}:${String(address.port)}${server.path(command.workbench)}\n`);
    }
    catch {
        // A gone stdout must not abort a running workbench.
    }
    await waitForShutdownSignal();
    try {
        await server.close();
        return 0;
    }
    catch {
        await writeStderr(io, `${programName}: the workbenches could not close cleanly.\n`);
        return 1;
    }
}
/**
 * Reads the package version from the manifest. The built output sits in
 * dist/ next to package.json; the TypeScript sources sit one level deeper.
 */
function packageVersion() {
    for (const candidate of ["../package.json", "../../package.json"]) {
        try {
            const manifest = JSON.parse(readFileSync(fileURLToPath(new URL(candidate, import.meta.url)), "utf8"));
            const record = asRecord(manifest);
            if (record !== undefined && typeof record.version === "string") {
                return record.version;
            }
        }
        catch {
            // Try the next layout candidate.
        }
    }
    return "<unknown>";
}
function verifyEnvironmentErrorDetail(error) {
    const prefix = `${error.code}: `;
    return error.message.startsWith(prefix)
        ? error.message.slice(prefix.length)
        : error.message;
}
/**
 * Runs the MCP verification and renders the structured result. Human output
 * keeps the `CODE: message` convention on stderr; --json prints the full
 * result (success to stdout, failure to stderr).
 */
async function runVerify(command, target, io) {
    const result = await runMcpVerification({
        target,
        ...(command.timeoutMs === undefined
            ? {}
            : {
                initializationDeadlineMs: command.timeoutMs,
                catalogDeadlineMs: command.timeoutMs,
            }),
        ...(command.maxTools === undefined ? {} : { maxTools: command.maxTools }),
    });
    if (result.ok) {
        try {
            // Human output keeps the legacy success line byte-identical (no `ok`
            // discriminant); --json prints the full structured result.
            const { ok: _ok, ...legacy } = result;
            await io.writeStdout(command.json === true
                ? `${JSON.stringify(result, null, 2)}\n`
                : `${JSON.stringify(legacy)}\n`);
        }
        catch {
            // A gone stdout cannot change the verification result.
        }
        return 0;
    }
    if (command.json === true) {
        await writeStderr(io, `${JSON.stringify(result, null, 2)}\n`);
    }
    else {
        await writeStderr(io, `${programName} verify: ${result.code}: ${result.message}\n`);
    }
    return result.code === "INVALID_TARGET" ? 2 : 1;
}
/**
 * Runs `senda-devtools` and resolves with its exit code. Diagnostics are
 * written only to `stderr`; `open` and `serve` write their ready output,
 * `doctor --json` and verify results write JSON, and `--help`/`--version`
 * write the usage and the version to `stdout`.
 */
export async function runDevtoolsCli(options = {}) {
    const io = resolveIo(options.io);
    const argv = options.argv ?? process.argv.slice(2);
    let command;
    try {
        command = parseDevtoolsCommand(argv);
    }
    catch (error) {
        if (!(error instanceof UsageError))
            throw error;
        await writeStderr(io, argv[0] === "verify"
            ? renderVerifyFailure("INVALID_TARGET", error.message)
            : renderUsageError(error, argv[0] === "doctor" || argv[0] === "serve" ? engineUsage : usage));
        return 2;
    }
    if (command.command === "help") {
        try {
            await io.writeStdout(`${usage}\n`);
        }
        catch {
            // A gone stdout cannot change the command's numeric result.
        }
        return 0;
    }
    if (command.command === "version") {
        try {
            await io.writeStdout(`${programName} ${packageVersion()}\n`);
        }
        catch {
            // A gone stdout cannot change the command's numeric result.
        }
        return 0;
    }
    const cwd = options.cwd ?? process.cwd();
    if (command.command === "serve") {
        return runServe(command, cwd, io);
    }
    if (command.command === "doctor") {
        return runDoctor(command, cwd, io);
    }
    if (command.command === "open") {
        return runOpen(command, io);
    }
    let target;
    try {
        target = resolveVerifyTargetEnvironment(command, (name) => process.env[name]);
    }
    catch (error) {
        if (!(error instanceof VerifyEnvironmentError))
            throw error;
        await writeStderr(io, renderVerifyFailure(error.code, verifyEnvironmentErrorDetail(error)));
        return 2;
    }
    return runVerify(command, target, io);
}
//# sourceMappingURL=run-devtools-cli.js.map