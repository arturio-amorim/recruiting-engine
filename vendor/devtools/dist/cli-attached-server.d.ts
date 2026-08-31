import { type AttachedCliSessionController, type AttachedCliSessionState } from "./cli-attached-session.js";
import type { DevtoolsServerAddress } from "./server.js";
export type AttachedCliServerState = AttachedCliSessionState;
export type AttachedCliServerController = AttachedCliSessionController;
export interface StartAttachedCliDevtoolsServerOptions {
    readonly controller?: AttachedCliServerController;
    /** Defaults to 4100; a taken port walks to the next free one. */
    readonly port?: number;
    readonly uiRoot?: string;
    /** Called with each taken port before the next one is tried. */
    readonly onPortInUse?: (port: number) => void;
}
export interface AttachedCliDevtoolsServer {
    address(): DevtoolsServerAddress;
    close(): Promise<void>;
}
export declare function startAttachedCliDevtoolsServer(options?: StartAttachedCliDevtoolsServerOptions): Promise<AttachedCliDevtoolsServer>;
//# sourceMappingURL=cli-attached-server.d.ts.map