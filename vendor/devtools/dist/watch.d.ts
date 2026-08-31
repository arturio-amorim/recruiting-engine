import type { ThrownValueInfo } from "./diagnostics.js";
import type { PrincipalStore } from "./principal-store.js";
import type { EngineView } from "./server.js";
import type { TraceStore } from "./trace-store.js";
export interface StartWatchOptions {
    readonly moduleSpecifier: string;
    readonly exportName: string;
    readonly cwd: string;
    readonly buildCommand: string;
    readonly allowedOrigins: ReadonlyArray<string>;
    readonly enginePort?: number;
    readonly principals: PrincipalStore;
    readonly trace: TraceStore;
    /** Paths to watch, resolved against `cwd`. Defaults to `cwd` itself. */
    readonly include?: string[];
    /**
     * Extra ignore patterns: an entry matches a whole path segment, or a
     * simple suffix glob such as `*.log`. `dist`, `.data`, and `*.log` are
     * always ignored on top of node_modules, dotfiles, and the built module.
     */
    readonly ignore?: string[];
    /** Receives non-protocol child stderr and build diagnostics. */
    readonly onDiagnostic?: (text: string) => void;
}
export interface WatchHandles {
    engineView(): EngineView;
    enginePort(): number;
    close(): Promise<void>;
}
export type StartWatchResult = {
    readonly kind: "started";
    readonly handles: WatchHandles;
} | {
    readonly kind: "load-error";
    readonly stage: "load-failed" | "export-missing" | "not-an-engine";
    readonly error?: ThrownValueInfo;
} | {
    readonly kind: "refused";
    readonly doctor: unknown;
};
/**
 * Watch mode: the engine runs in a replaceable child process. Source changes
 * run the developer's explicit build command, and only a successful build
 * replaces the child — the previous host keeps serving through a failed
 * build, and no module is ever reloaded in process.
 */
export declare function startWatchMode(options: StartWatchOptions): Promise<StartWatchResult>;
//# sourceMappingURL=watch.d.ts.map