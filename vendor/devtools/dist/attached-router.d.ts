import type { IncomingMessage, ServerResponse } from "node:http";
import type { AttachedSessionController } from "./attached-session.js";
export interface AttachedRouterOptions {
    readonly controller: AttachedSessionController;
    readonly uiRoot: string;
    /** Where the JSON API is mounted. Defaults to `/api`. */
    readonly apiPrefix?: string;
    /** Every authority the bound port answers on. */
    allowedAuthorities(): ReadonlySet<string>;
    /** The canonical origin the request target is resolved against. */
    origin(): string;
    /** The literal-loopback redirect URL an OAuth provider calls back on. */
    oauthRedirectUrl(): string;
}
export interface AttachedRouter {
    handle(request: IncomingMessage, response: ServerResponse): Promise<void>;
    /** The workbench shell, served by the router at `/` and by the launcher. */
    shell(response: ServerResponse, apiBase: string, launched: boolean): void;
    clearBrowserSessions(): void;
}
export declare function defaultAttachedUiRoot(): string;
/**
 * The workbench shell. `apiBase` tells the interface where its JSON API is
 * mounted, and `launched` tells it the peer workbench is reachable from the
 * same origin, so the chrome can offer the switch.
 */
export declare function attachedShellPage(apiBase: string, launched: boolean): string;
export declare function sendAttachedError(response: ServerResponse, status: number, code: string, message: string): void;
export declare function createAttachedRouter(options: AttachedRouterOptions): AttachedRouter;
//# sourceMappingURL=attached-router.d.ts.map