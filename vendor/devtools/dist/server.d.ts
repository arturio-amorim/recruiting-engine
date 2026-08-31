import type { Server as NodeHttpServer } from "node:http";
import type { AdapterRunner } from "./adapter-runner.js";
import type { EntryTargetStore } from "./entry-target.js";
import type { HttpTargetStore } from "./http-target.js";
import type { PrincipalStore } from "./principal-store.js";
import type { TraceStore } from "./trace-store.js";
/**
 * The interactive OAuth authorization of an external MCP endpoint, chartered
 * by ADR 0023 and reused here by ADR 0029. The devtools server only starts the
 * flow and completes it from the loopback callback; every token, PKCE value,
 * and registration artifact stays inside the session.
 */
export interface OAuthSession {
    begin(url: string, options: {
        readonly redirectUrl: string;
        readonly state: string;
    }): Promise<{
        readonly authorizationUrl: string;
    }>;
    complete(state: string, authorizationCode: string): Promise<void>;
    reject(state: string): Promise<void>;
    disconnect(): Promise<void>;
}
export interface DevtoolsServerAddress {
    readonly host: string;
    readonly port: number;
}
/**
 * The interface server's window onto the running engine. In-process serving
 * reads the live engine; watch mode reads the snapshot the engine-host child
 * reported, so the parent never imports the watched module itself.
 */
export interface EngineView {
    readonly name: string;
    readonly version: string;
    /** The `describe` output of every capability, JSON-serializable. */
    readonly capabilities: ReadonlyArray<unknown>;
    /** The JSON-safe doctor report body. */
    readonly doctor: unknown;
}
export interface DevtoolsServerOptions {
    readonly engineView: () => EngineView;
    readonly principals: PrincipalStore;
    readonly trace: TraceStore;
    /** Runs one capability call through the adapter the caller selected. */
    readonly adapters: AdapterRunner;
    /** Where MCP HTTP sends a call, and how it authenticates. */
    readonly httpTarget: HttpTargetStore;
    /** Which composition root runs the CLI and MCP stdio emulations. */
    readonly entryTarget: EntryTargetStore;
    /** The directory a project entry point is resolved against. */
    readonly cwd: string;
    /** The served module, published so the interface can propose a sibling. */
    readonly module: {
        readonly specifier: string;
        readonly exportName: string;
    };
    /** Drives the interactive OAuth authorization of an external endpoint. */
    readonly oauth?: OAuthSession;
    /** The engine host's current MCP endpoint port on loopback. */
    readonly enginePort: () => number;
    /**
     * Defaults to 4100. Ignored when `server` is already bound: the caller
     * selects the port, because the engine host has to allow the interface
     * origin before this server accepts a request.
     */
    readonly port?: number;
    /**
     * An already-bound loopback server to serve on. `serve` binds the port
     * before it starts the engine host, so nothing can take the port between
     * publishing the allowed origin and answering on it.
     */
    readonly server?: NodeHttpServer;
    /** Directory holding the built interface bundle. Defaults to `dist/ui`. */
    readonly uiRoot?: string;
}
export interface DevtoolsServer {
    address(): DevtoolsServerAddress;
    close(): Promise<void>;
}
/**
 * The single-origin development interface server: static bundle, JSON API,
 * trace event stream, and the same-origin MCP proxy toward the engine host.
 * Binds loopback only and never emits an `Access-Control-*` header.
 */
export declare function startDevtoolsServer(options: DevtoolsServerOptions): Promise<DevtoolsServer>;
//# sourceMappingURL=server.d.ts.map