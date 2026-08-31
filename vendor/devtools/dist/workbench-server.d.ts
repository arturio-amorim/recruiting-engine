import type { AttachedServerController } from "./attached-server.js";
import type { AttachedCliServerController } from "./cli-attached-server.js";
import type { DevtoolsServerAddress } from "./server.js";
/** The workbenches the launcher mounts, and the path each answers on. */
export declare const workbenchPaths: Readonly<{
    mcp: "/mcp";
    cli: "/cli";
}>;
export type WorkbenchName = keyof typeof workbenchPaths;
export declare function isWorkbenchName(value: unknown): value is WorkbenchName;
export interface StartWorkbenchDevtoolsServerOptions {
    readonly mcpController?: AttachedServerController;
    readonly cliController?: AttachedCliServerController;
    /** Defaults to 4100; a taken port walks to the next free one. */
    readonly port?: number;
    /** Directory holding the built interface bundle. Defaults to `dist/ui`. */
    readonly uiRoot?: string;
    /** Called with each taken port before the next one is tried. */
    readonly onPortInUse?: (port: number) => void;
}
export interface WorkbenchDevtoolsServer {
    address(): DevtoolsServerAddress;
    /** The path a workbench answers on; the chooser answers on `/`. */
    path(workbench?: WorkbenchName): string;
    close(): Promise<void>;
}
/**
 * The launcher: one loopback origin that opens on the workbench chooser and
 * mounts both idle workbenches next to each other. Neither workbench loads a
 * workspace, spawns a target, or opens an outbound connection until the
 * developer selects Connect inside it.
 */
export declare function startWorkbenchDevtoolsServer(options?: StartWorkbenchDevtoolsServerOptions): Promise<WorkbenchDevtoolsServer>;
//# sourceMappingURL=workbench-server.d.ts.map