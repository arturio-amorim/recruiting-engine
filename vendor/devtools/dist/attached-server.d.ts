import type { AttachedSessionController, AttachedSessionState } from "./attached-session.js";
import type { DevtoolsServerAddress } from "./server.js";
export type { AttachedConnectionSummary } from "./attached-session.js";
export type AttachedServerState = AttachedSessionState;
export type AttachedServerController = AttachedSessionController;
export interface StartAttachedDevtoolsServerOptions {
    readonly controller?: AttachedServerController;
    /** Defaults to 4100; a taken port walks to the next free one. */
    readonly port?: number;
    /** Directory holding the built interface bundle. Defaults to `dist/ui`. */
    readonly uiRoot?: string;
    /** Called with each taken port before the next one is tried. */
    readonly onPortInUse?: (port: number) => void;
}
export interface AttachedDevtoolsServer {
    address(): DevtoolsServerAddress;
    close(): Promise<void>;
}
/**
 * The single-workbench MCP server: one loopback origin serving the workbench
 * shell, its JSON API under `/api`, and the OAuth callback. The launcher
 * mounts the same router next to the CLI one instead.
 */
export declare function startAttachedDevtoolsServer(options: StartAttachedDevtoolsServerOptions): Promise<AttachedDevtoolsServer>;
//# sourceMappingURL=attached-server.d.ts.map