import type { ThrownValueInfo } from "./diagnostics.js";
import type { DoctorReport } from "./doctor.js";
import type { LoadedEngine } from "./load-engine.js";
import type { DevtoolsServerAddress } from "./server.js";
interface ServeCommonOptions {
    readonly cwd: string;
    /** Defaults to 4100. */
    readonly port?: number;
    /** Defaults to an ephemeral loopback port. */
    readonly enginePort?: number;
    /** Directory holding the built interface bundle; defaults to the shipped one. */
    readonly uiRoot?: string;
    /** Oldest trace entries are dropped beyond this bound. Defaults to 500. */
    readonly traceCapacity?: number;
    /** Receives child and build diagnostics in watch mode. */
    readonly onDiagnostic?: (text: string) => void;
    /** Called with each taken interface port before the next one is tried. */
    readonly onPortInUse?: (port: number) => void;
}
export interface ServeEngineOptions extends ServeCommonOptions {
    readonly engine: LoadedEngine;
    /**
     * The module the engine was loaded from. Adapter emulation spawns children
     * that import it themselves, so the path is required even though the parent
     * already holds the engine.
     */
    readonly module: {
        readonly specifier: string;
        readonly exportName: string;
    };
    /** Whether the module also exposes a tracked composed `capabilities` export. */
    readonly composedCapabilitiesExport: boolean;
}
export interface ServeWatchOptions extends ServeCommonOptions {
    readonly watch: {
        readonly moduleSpecifier: string;
        readonly exportName: string;
        readonly buildCommand: string;
        /** Watch roots relative to the cwd; defaults to the cwd itself. */
        readonly include?: string[];
        /** Extra ignored path segments or suffix globs (for example "*.log"). */
        readonly ignore?: string[];
    };
}
export type StartServeOptions = ServeEngineOptions | ServeWatchOptions;
export interface ServeHandles {
    readonly devtoolsAddress: DevtoolsServerAddress;
    readonly engineAddress: DevtoolsServerAddress;
    close(): Promise<void>;
}
export type StartServeResult = {
    readonly kind: "started";
    readonly handles: ServeHandles;
} | {
    readonly kind: "refused";
    readonly report: DoctorReport;
} | {
    readonly kind: "load-error";
    readonly stage: "load-failed" | "export-missing" | "not-an-engine";
    readonly error?: ThrownValueInfo;
};
/**
 * Starts the two-server development surface: the engine host (the unmodified
 * MCP HTTP adapter around the observing delegate) and the single-origin
 * devtools interface server that proxies `/mcp` to it. The engine is
 * preflighted with the doctor checks and refused on any finding. In watch
 * mode the engine host runs in a replaceable child process instead.
 */
export declare function startServe(options: StartServeOptions): Promise<StartServeResult>;
export {};
//# sourceMappingURL=serve.d.ts.map