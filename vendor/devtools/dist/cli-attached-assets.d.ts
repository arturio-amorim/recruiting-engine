import type { ServerResponse } from "node:http";
/**
 * The workbench shell. `apiBase` tells the interface where its JSON API is
 * mounted, and `launched` tells it the peer workbench is reachable from the
 * same origin, so the chrome can offer the switch.
 */
export declare function attachedCliShellPage(apiBase: string, launched: boolean): string;
export declare function defaultAttachedCliUiRoot(): string;
export interface AttachedCliAssetServer {
    shell(response: ServerResponse, apiBase: string, launched: boolean): void;
    favicon(response: ServerResponse): void;
    serve(response: ServerResponse, segments: readonly string[]): Promise<void>;
}
export declare function createAttachedCliAssetServer(uiRoot: string): AttachedCliAssetServer;
//# sourceMappingURL=cli-attached-assets.d.ts.map