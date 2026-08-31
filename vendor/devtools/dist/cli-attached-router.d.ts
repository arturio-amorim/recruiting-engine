import type { IncomingMessage, ServerResponse } from "node:http";
import type { AttachedCliSessionController } from "./cli-attached-session.js";
export interface AttachedCliRouterOptions {
    readonly controller: AttachedCliSessionController;
    readonly uiRoot: string;
    /** Where the JSON API is mounted. Defaults to `/api`. */
    readonly apiPrefix?: string;
    /** Every authority the bound port answers on. */
    allowedAuthorities(): ReadonlySet<string>;
    /** The canonical origin the request target is resolved against. */
    origin(): string;
}
export interface AttachedCliRouter {
    handle(request: IncomingMessage, response: ServerResponse): Promise<void>;
    /** The workbench shell, served by the router at `/` and by the launcher. */
    shell(response: ServerResponse, apiBase: string, launched: boolean): void;
    clearBrowserSessions(): void;
}
export declare function createAttachedCliRouter(options: AttachedCliRouterOptions): AttachedCliRouter;
//# sourceMappingURL=cli-attached-router.d.ts.map