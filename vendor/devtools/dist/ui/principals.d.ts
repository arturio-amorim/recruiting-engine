import { type PrincipalInfo } from "./api.js";
export interface ActivePrincipalStatus {
    readonly key: string;
    readonly principalId: string;
    readonly hasSessionToken: boolean;
}
export declare function setActivePrincipal(key: string | null): void;
export declare function getActivePrincipalKey(): string | null;
export declare function getActiveToken(): string | null;
export declare function getActivePrincipalStatus(): ActivePrincipalStatus | null;
export declare function onPrincipalChange(listener: () => void): () => void;
/**
 * Reconciles browser-session state with the listed principals and selects a
 * valid principal. Initialization never issues, rotates, or revokes a token.
 */
/** The principals the interface has seen, for the invocation identity picker. */
export declare function listKnownPrincipals(): readonly PrincipalInfo[];
export declare function ensureActiveToken(): Promise<void>;
export declare function renderPrincipalsPanel(container: HTMLElement): () => void;
//# sourceMappingURL=principals.d.ts.map