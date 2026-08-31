import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { toMcpToolName } from "@senda/mcp";
import { createAdapterRunner } from "./adapter-runner.js";
import { doctorReportToJson, inspectEngine } from "./doctor.js";
import { startEngineHost } from "./engine-host.js";
import { createEntryTargetStore } from "./entry-target.js";
import { createHttpTargetStore } from "./http-target.js";
import { createPlaygroundOAuth } from "./playground-oauth.js";
import { createPrincipalStore } from "./principal-store.js";
import { literalLoopbackHost, literalLoopbackOrigin, listenOnLoopback, loopbackOrigins, } from "./loopback.js";
import { startDevtoolsServer } from "./server.js";
import { createTraceStore } from "./trace-store.js";
import { startWatchMode } from "./watch.js";
const mcpManifestFileName = "senda.mcp.json";
/**
 * Binds the interface port before anything else starts. The engine host has
 * to allow the interface origin up front, so the port is held from the moment
 * that origin is decided rather than probed and released.
 */
async function reserveDevtoolsServer(options) {
    const server = createServer();
    const port = await listenOnLoopback(server, {
        ...(options.port === undefined ? {} : { port: options.port }),
        ...(options.onPortInUse === undefined
            ? {}
            : { onPortInUse: options.onPortInUse }),
    });
    return {
        server,
        port,
        release: () => new Promise((resolve) => {
            server.close(() => {
                resolve();
            });
            server.closeAllConnections();
        }),
    };
}
async function startWithEngine(options) {
    const doctor = () => inspectEngine(options.engine, {
        mcpManifestPresent: existsSync(resolve(options.cwd, mcpManifestFileName)),
        composedCapabilitiesExport: options.composedCapabilitiesExport,
    });
    const preflight = doctor();
    if (preflight.findings.length > 0) {
        return { kind: "refused", report: preflight };
    }
    const principals = createPrincipalStore();
    const trace = createTraceStore(options.traceCapacity === undefined
        ? {}
        : { capacity: options.traceCapacity });
    const reserved = await reserveDevtoolsServer(options);
    const allowedOrigins = loopbackOrigins(reserved.port);
    let engineHost;
    try {
        engineHost = await startEngineHost({
            engine: options.engine,
            ...(options.enginePort === undefined ? {} : { port: options.enginePort }),
            allowedOrigins,
            authenticate: principals.authenticate,
            onRecord: (record) => {
                trace.appendInvocation(record);
            },
        });
    }
    catch (error) {
        await reserved.release();
        throw error;
    }
    // The in-process engine never changes, so the doctor report and the
    // capability descriptions are computed once instead of on every view
    // request. Watch mode rebuilds its own snapshot per child restart, so no
    // invalidation is needed here.
    let cachedView;
    const engineView = () => {
        if (cachedView !== undefined)
            return cachedView;
        let capabilities = [];
        try {
            capabilities = options.engine.list().map(({ id }) => ({
                ...options.engine.describe(id),
                mcpToolName: toMcpToolName(id),
            }));
        }
        catch {
            capabilities = [];
        }
        cachedView = {
            name: options.engine.name,
            version: options.engine.version,
            capabilities,
            doctor: doctorReportToJson(preflight),
        };
        return cachedView;
    };
    const httpTarget = createHttpTargetStore();
    const entryTarget = createEntryTargetStore();
    const oauth = createPlaygroundOAuth();
    const adapters = createAdapterRunner({
        module: options.module,
        cwd: options.cwd,
        mcpEndpoint: () => `${literalLoopbackOrigin(engineHost.address().port)}/mcp`,
        httpTarget: () => httpTarget.resolve(),
        oauthCall: oauth.call,
        entryPoint: (adapter) => entryTarget.for(adapter),
    });
    let devtools;
    try {
        devtools = await startDevtoolsServer({
            engineView,
            principals,
            trace,
            adapters,
            httpTarget,
            entryTarget,
            oauth,
            cwd: options.cwd,
            module: options.module,
            enginePort: () => engineHost.address().port,
            server: reserved.server,
            ...(options.uiRoot === undefined ? {} : { uiRoot: options.uiRoot }),
        });
    }
    catch (error) {
        // Start-up failure releases the same resources shutdown does.
        await oauth.close().catch(() => undefined);
        await engineHost.close();
        await reserved.release();
        throw error;
    }
    return {
        kind: "started",
        handles: {
            devtoolsAddress: devtools.address(),
            engineAddress: engineHost.address(),
            close: async () => {
                await devtools.close();
                await oauth.close();
                await engineHost.close();
            },
        },
    };
}
async function startWithWatch(options) {
    const principals = createPrincipalStore();
    const trace = createTraceStore(options.traceCapacity === undefined
        ? {}
        : { capacity: options.traceCapacity });
    const reserved = await reserveDevtoolsServer(options);
    const allowedOrigins = loopbackOrigins(reserved.port);
    const watch = await startWatchMode({
        moduleSpecifier: options.watch.moduleSpecifier,
        exportName: options.watch.exportName,
        cwd: options.cwd,
        buildCommand: options.watch.buildCommand,
        allowedOrigins,
        ...(options.enginePort === undefined
            ? {}
            : { enginePort: options.enginePort }),
        ...(options.watch.include === undefined
            ? {}
            : { include: options.watch.include }),
        ...(options.watch.ignore === undefined
            ? {}
            : { ignore: options.watch.ignore }),
        principals,
        trace,
        ...(options.onDiagnostic === undefined
            ? {}
            : { onDiagnostic: options.onDiagnostic }),
    });
    if (watch.kind === "load-error") {
        await reserved.release();
        return watch;
    }
    if (watch.kind === "refused") {
        await reserved.release();
        // The child reports the JSON-safe body, which is shape-compatible with
        // the report: thrown values are already reduced to name/code/message.
        return { kind: "refused", report: watch.doctor };
    }
    const httpTarget = createHttpTargetStore();
    const entryTarget = createEntryTargetStore();
    const oauth = createPlaygroundOAuth();
    const adapters = createAdapterRunner({
        module: {
            specifier: options.watch.moduleSpecifier,
            exportName: options.watch.exportName,
        },
        cwd: options.cwd,
        mcpEndpoint: () => `${literalLoopbackOrigin(watch.handles.enginePort())}/mcp`,
        httpTarget: () => httpTarget.resolve(),
        oauthCall: oauth.call,
        entryPoint: (adapter) => entryTarget.for(adapter),
    });
    let devtools;
    try {
        devtools = await startDevtoolsServer({
            engineView: watch.handles.engineView,
            principals,
            trace,
            adapters,
            httpTarget,
            entryTarget,
            oauth,
            cwd: options.cwd,
            module: {
                specifier: options.watch.moduleSpecifier,
                exportName: options.watch.exportName,
            },
            enginePort: watch.handles.enginePort,
            server: reserved.server,
            ...(options.uiRoot === undefined ? {} : { uiRoot: options.uiRoot }),
        });
    }
    catch (error) {
        // Start-up failure releases the same resources shutdown does.
        await oauth.close().catch(() => undefined);
        await watch.handles.close();
        await reserved.release();
        throw error;
    }
    return {
        kind: "started",
        handles: {
            devtoolsAddress: devtools.address(),
            engineAddress: {
                host: literalLoopbackHost,
                port: watch.handles.enginePort(),
            },
            close: async () => {
                await devtools.close();
                await oauth.close();
                await watch.handles.close();
            },
        },
    };
}
/**
 * Starts the two-server development surface: the engine host (the unmodified
 * MCP HTTP adapter around the observing delegate) and the single-origin
 * devtools interface server that proxies `/mcp` to it. The engine is
 * preflighted with the doctor checks and refused on any finding. In watch
 * mode the engine host runs in a replaceable child process instead.
 */
export async function startServe(options) {
    if ("watch" in options) {
        return startWithWatch(options);
    }
    return startWithEngine(options);
}
//# sourceMappingURL=serve.js.map