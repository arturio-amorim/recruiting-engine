/**
 * Where the MCP HTTP adapter sends an emulated call, and how it authenticates,
 * chartered by ADR 0029. The devtools host is the default and authenticates
 * with its own minted session tokens; an external endpoint is a server the
 * developer runs, whose authentication is whatever that server implements.
 *
 * A credential lives here in process memory for the life of the selection. It
 * is never persisted, never written to the developer's project, and never
 * echoed back: reading the target yields its kind, URL, authentication type,
 * and header or variable names only.
 */
export type HttpAuthenticationType = "session-token" | "none" | "bearer" | "headers" | "oauth";
/** A credential value, either literal or named as an environment variable. */
export type CredentialSource = {
    readonly kind: "literal";
    readonly value: string;
} | {
    readonly kind: "environment";
    readonly name: string;
};
export type HttpTargetAuthentication = 
/** The devtools host resolves the selected identity's minted bearer token. */
{
    readonly type: "session-token";
} | {
    readonly type: "none";
} | {
    readonly type: "bearer";
    readonly token: CredentialSource;
} | {
    readonly type: "headers";
    readonly headers: ReadonlyArray<{
        readonly name: string;
        readonly value: CredentialSource;
    }>;
} | {
    readonly type: "oauth";
};
export type HttpTarget = {
    readonly kind: "devtools";
    readonly authentication: {
        readonly type: "session-token";
    } | {
        readonly type: "none";
    };
} | {
    readonly kind: "external";
    readonly url: string;
    readonly authentication: HttpTargetAuthentication;
};
/** The target as the interface reads it back: no credential value survives. */
export interface HttpTargetView {
    readonly kind: HttpTarget["kind"];
    readonly url?: string;
    readonly authentication: {
        readonly type: HttpAuthenticationType;
        /** Header names only, when the type is `headers`. */
        readonly headerNames?: readonly string[];
        /** Environment variable names the values are read from, when named. */
        readonly environmentVariables?: readonly string[];
        /** Whether an OAuth authorization has completed for this target. */
        readonly authorized?: boolean;
    };
}
/** The authentication shape the MCP client facade accepts, fully resolved. */
export type ResolvedHttpAuthentication = {
    readonly type: "none";
} | {
    readonly type: "bearer";
    readonly token: string;
} | {
    readonly type: "headers";
    readonly headers: Readonly<Record<string, string>>;
};
export type HttpTargetResolution = {
    readonly kind: "devtools";
    /** Whether the selected identity's minted token is presented. */
    readonly useSessionToken: boolean;
} | {
    readonly kind: "external";
    readonly url: string;
    readonly authentication: ResolvedHttpAuthentication;
} | {
    readonly kind: "external-oauth";
    readonly url: string;
};
export declare class HttpTargetError extends Error {
    readonly code: "INVALID_TARGET" | "INVALID_AUTHENTICATION" | "ENVIRONMENT_VALUE_MISSING";
    constructor(code: "INVALID_TARGET" | "INVALID_AUTHENTICATION" | "ENVIRONMENT_VALUE_MISSING", message: string);
}
export interface HttpTargetStore {
    current(): HttpTarget;
    view(): HttpTargetView;
    set(target: HttpTarget): void;
    /** Returns to the devtools host and drops every credential held for it. */
    reset(): void;
    /** Records that an interactive authorization completed for this target. */
    markAuthorized(authorized: boolean): void;
    /**
     * Resolves the target into what one call needs. Throws when a named
     * environment variable is unset, because a silent anonymous call would
     * misreport what the endpoint accepts.
     */
    resolve(): HttpTargetResolution;
    subscribe(listener: () => void): () => void;
}
/**
 * Validates a target descriptor received from the interface. The URL itself is
 * left to the MCP client facade, which already refuses anything that is not
 * HTTPS or literal loopback, carries credentials, or has a query or fragment.
 */
export declare function parseHttpTarget(value: unknown): HttpTarget;
export declare function createHttpTargetStore(): HttpTargetStore;
//# sourceMappingURL=http-target.d.ts.map