import { type HttpTargetView } from "./api.js";
/**
 * Where MCP HTTP sends a call and how it authenticates, chartered by ADR 0029.
 * The devtools host authenticates with its own minted session tokens, so it
 * offers those two choices only; an external endpoint is the developer's own
 * server, so it offers what a real HTTP boundary accepts.
 *
 * The selection belongs to the dev server, not to one capability panel, so it
 * is held here and every panel follows it.
 */
export type HttpAuthChoice = "devtools-session-token" | "devtools-none" | "external";
export declare function getHttpTarget(): HttpTargetView;
/** Only for tests: forgets the cached selection and every registration. */
export declare function resetHttpTarget(): void;
export declare function loadHttpTarget(): Promise<void>;
export declare function describeHttpTarget(target: HttpTargetView): string;
export interface HttpAuthControl {
    readonly element: HTMLElement;
    setDisabled(disabled: boolean): void;
}
export declare function createHttpAuthControl(owner: string, onTargetChange?: () => void): HttpAuthControl;
//# sourceMappingURL=http-auth.d.ts.map