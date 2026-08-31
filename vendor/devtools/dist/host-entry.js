#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { toMcpToolName } from "@senda/mcp";
import { readThrownValueInfo } from "./diagnostics.js";
import { doctorReportToJson, inspectEngine } from "./doctor.js";
import { startEngineHost } from "./engine-host.js";
import { hasComposedCapabilitiesExport, loadEngineModule, } from "./load-engine.js";
/**
 * The watch-mode engine host child. It loads the built module once, hosts it
 * over the MCP HTTP adapter, and speaks a line protocol with the devtools
 * parent: protocol messages go to stderr as single JSON lines prefixed with
 * `@senda-devtools `, and the parent mirrors the principal token table in
 * through stdin. Applying a rebuild means replacing this whole process —
 * the child never reloads a module.
 */
const protocolPrefix = "@senda-devtools ";
function emit(message) {
    process.stderr.write(`${protocolPrefix}${JSON.stringify(message)}\n`);
}
async function main() {
    const [moduleSpecifier, exportName, allowedOriginList, portArgument] = process.argv.slice(2);
    if (moduleSpecifier === undefined ||
        exportName === undefined ||
        allowedOriginList === undefined ||
        allowedOriginList === "") {
        emit({ type: "fatal", reason: "invalid-arguments" });
        return 2;
    }
    const loaded = await loadEngineModule({
        moduleSpecifier,
        exportName,
        cwd: process.cwd(),
    });
    if (loaded.kind !== "loaded") {
        emit({
            type: "load-error",
            stage: loaded.kind,
            ...(loaded.kind === "load-failed"
                ? { error: readThrownValueInfo(loaded.error) }
                : {}),
        });
        return 2;
    }
    const report = inspectEngine(loaded.engine, {
        mcpManifestPresent: existsSync(resolve(process.cwd(), "senda.mcp.json")),
        composedCapabilitiesExport: hasComposedCapabilitiesExport(loaded.namespace),
    });
    if (report.findings.length > 0) {
        emit({ type: "doctor-findings", doctor: doctorReportToJson(report) });
        return 1;
    }
    let tokens = [];
    const stdinLines = createInterface({ input: process.stdin });
    stdinLines.on("line", (line) => {
        try {
            const message = JSON.parse(line);
            if (message.type === "principals" && Array.isArray(message.records)) {
                tokens = message.records;
            }
        }
        catch {
            // A malformed control line is ignored; the previous table stays active.
        }
    });
    const host = await startEngineHost({
        engine: loaded.engine,
        ...(portArgument === undefined || portArgument === "0"
            ? {}
            : { port: Number(portArgument) }),
        allowedOrigins: allowedOriginList.split(","),
        authenticate: (request) => {
            const header = request.headers.get("authorization");
            if (header === null)
                return null;
            const match = /^[ \t]*bearer[ \t]+(\S+)[ \t]*$/i.exec(header);
            const presented = match?.[1];
            if (presented === undefined)
                return null;
            return (tokens.find((entry) => entry.token === presented)?.principal ?? null);
        },
        onRecord: (record) => {
            emit({ type: "record", record });
        },
    });
    let describedCapabilities = [];
    try {
        describedCapabilities = loaded.engine.list().map(({ id }) => ({
            ...loaded.engine.describe(id),
            mcpToolName: toMcpToolName(id),
        }));
    }
    catch {
        describedCapabilities = [];
    }
    emit({
        type: "ready",
        port: host.address().port,
        engine: { name: loaded.engine.name, version: loaded.engine.version },
        capabilities: describedCapabilities,
        doctor: doctorReportToJson(report),
    });
    await new Promise((resolvePromise) => {
        const stop = () => {
            resolvePromise();
        };
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        process.stdin.once("end", stop);
    });
    // The readline interface holds a referenced stdin handle that the parent
    // never closes. Releasing it lets the event loop drain once the host is
    // closed; otherwise the process outlives SIGTERM and the watcher waits out
    // its whole SIGKILL timeout before starting the rebuilt engine.
    stdinLines.close();
    process.stdin.pause();
    await host.close();
    return 0;
}
process.exitCode = await main();
//# sourceMappingURL=host-entry.js.map