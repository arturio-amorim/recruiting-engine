import type { Principal } from "@senda/core";
import type { McpHttpAuthenticationRequest } from "@senda/mcp";
export interface DevPrincipal {
    /** Stable management key; safe to list and reference from the interface. */
    readonly key: string;
    /**
     * Opaque bearer credential. `issue` and `rotate` return it only when it is
     * minted; `list` also carries it so the in-process watch-mode mirror can
     * forward the token table to the engine-host child. The HTTP interface
     * strips it from list responses.
     */
    readonly token: string;
    readonly principal: Principal;
}
export interface PrincipalStore {
    issue(principal: Principal): DevPrincipal;
    /** Replaces an existing principal, keeping its key and its token. */
    update(key: string, principal: Principal): DevPrincipal | null;
    /** Mints a replacement token for an existing principal, revoking the old one. */
    rotate(key: string): DevPrincipal | null;
    remove(key: string): boolean;
    list(): ReadonlyArray<DevPrincipal>;
    resolve(token: string): Principal | null;
    authenticate(request: McpHttpAuthenticationRequest): Principal | null;
    /** Notifies after every mutation; used to mirror tokens into a child host. */
    subscribe(listener: () => void): () => void;
}
export declare const defaultPrincipalId = "local-dev";
/**
 * An in-memory map from minted opaque bearer tokens to development
 * principals. Tokens exist only in process memory; the store performs no
 * persistence and no network activity. The store always starts with one
 * default principal so a fresh dev server is immediately invocable.
 */
export declare function createPrincipalStore(): PrincipalStore;
//# sourceMappingURL=principal-store.d.ts.map