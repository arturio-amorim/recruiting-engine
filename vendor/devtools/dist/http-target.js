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
import { isForbiddenMcpClientHeader } from "@senda/mcp";
export class HttpTargetError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "HttpTargetError";
    }
}
const defaultTarget = Object.freeze({
    kind: "devtools",
    authentication: Object.freeze({ type: "session-token" }),
});
const headerName = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;
const environmentName = /^[A-Za-z_][A-Za-z0-9_]*$/;
const maximumHeaders = 8;
function readEnvironment(name) {
    const value = process.env[name];
    if (value === undefined || value === "") {
        throw new HttpTargetError("ENVIRONMENT_VALUE_MISSING", `The environment variable ${name} is not set in the dev server's environment.`);
    }
    return value;
}
function readCredential(source) {
    return source.kind === "literal"
        ? source.value
        : readEnvironment(source.name);
}
function credentialNames(authentication) {
    if (authentication.type === "bearer") {
        return authentication.token.kind === "environment"
            ? [authentication.token.name]
            : [];
    }
    if (authentication.type === "headers") {
        return authentication.headers
            .filter((entry) => entry.value.kind === "environment")
            .map((entry) => entry.value.name);
    }
    return [];
}
function assertCredentialSource(value) {
    if (typeof value !== "object" || value === null) {
        throw new HttpTargetError("INVALID_AUTHENTICATION", "A credential must be a literal value or an environment variable name.");
    }
    const record = value;
    if (record.kind === "literal") {
        if (typeof record.value !== "string" || record.value === "") {
            throw new HttpTargetError("INVALID_AUTHENTICATION", "The credential value is required.");
        }
        return { kind: "literal", value: record.value };
    }
    if (record.kind === "environment") {
        if (typeof record.name !== "string" || !environmentName.test(record.name)) {
            throw new HttpTargetError("INVALID_AUTHENTICATION", "The environment variable name is invalid.");
        }
        return { kind: "environment", name: record.name };
    }
    throw new HttpTargetError("INVALID_AUTHENTICATION", "A credential must be a literal value or an environment variable name.");
}
/**
 * Validates a target descriptor received from the interface. The URL itself is
 * left to the MCP client facade, which already refuses anything that is not
 * HTTPS or literal loopback, carries credentials, or has a query or fragment.
 */
export function parseHttpTarget(value) {
    if (typeof value !== "object" || value === null) {
        throw new HttpTargetError("INVALID_TARGET", "The target is invalid.");
    }
    const record = value;
    const authentication = typeof record.authentication === "object" && record.authentication !== null
        ? record.authentication
        : undefined;
    const type = authentication?.type;
    if (record.kind === "devtools") {
        if (type !== "session-token" && type !== "none") {
            throw new HttpTargetError("INVALID_AUTHENTICATION", "The devtools host accepts its own session token or no credential.");
        }
        return { kind: "devtools", authentication: { type } };
    }
    if (record.kind !== "external") {
        throw new HttpTargetError("INVALID_TARGET", "The target kind is unknown.");
    }
    if (typeof record.url !== "string" || record.url === "") {
        throw new HttpTargetError("INVALID_TARGET", "An external endpoint requires an absolute MCP URL.");
    }
    const url = record.url;
    if (type === "none" || type === "oauth") {
        return { kind: "external", url, authentication: { type } };
    }
    if (type === "bearer") {
        const token = assertCredentialSource(authentication.token);
        return { kind: "external", url, authentication: { type, token } };
    }
    if (type === "headers") {
        const raw = authentication.headers;
        if (!Array.isArray(raw) || raw.length === 0) {
            throw new HttpTargetError("INVALID_AUTHENTICATION", "Custom header authentication requires at least one header.");
        }
        if (raw.length > maximumHeaders) {
            throw new HttpTargetError("INVALID_AUTHENTICATION", `At most ${String(maximumHeaders)} headers are accepted.`);
        }
        const headers = raw.map((entry) => {
            const candidate = entry;
            if (typeof candidate.name !== "string" ||
                !headerName.test(candidate.name)) {
                throw new HttpTargetError("INVALID_AUTHENTICATION", "A header name is invalid.");
            }
            // The MCP client facade refuses these outright, so accepting the
            // target here would only defer the same refusal to every invocation.
            if (isForbiddenMcpClientHeader(candidate.name)) {
                throw new HttpTargetError("INVALID_AUTHENTICATION", `The ${candidate.name} header is reserved by the MCP client and cannot carry a credential.`);
            }
            return {
                name: candidate.name,
                value: assertCredentialSource(candidate.value),
            };
        });
        return { kind: "external", url, authentication: { type, headers } };
    }
    throw new HttpTargetError("INVALID_AUTHENTICATION", "The authentication type is unknown.");
}
export function createHttpTargetStore() {
    let target = defaultTarget;
    let authorized = false;
    const listeners = new Set();
    const notify = () => {
        for (const listener of listeners) {
            try {
                listener();
            }
            catch {
                // A consumer failure must not affect the stored selection.
            }
        }
    };
    return {
        current: () => target,
        view: () => {
            const names = credentialNames(target.authentication);
            return {
                kind: target.kind,
                ...(target.kind === "external" ? { url: target.url } : {}),
                authentication: {
                    type: target.authentication.type,
                    ...(target.authentication.type === "headers"
                        ? {
                            headerNames: target.authentication.headers.map((entry) => entry.name),
                        }
                        : {}),
                    ...(names.length === 0 ? {} : { environmentVariables: names }),
                    ...(target.authentication.type === "oauth" ? { authorized } : {}),
                },
            };
        },
        set: (next) => {
            target = next;
            authorized = false;
            notify();
        },
        reset: () => {
            target = defaultTarget;
            authorized = false;
            notify();
        },
        markAuthorized: (value) => {
            authorized = value;
            notify();
        },
        resolve: () => {
            if (target.kind === "devtools") {
                return {
                    kind: "devtools",
                    useSessionToken: target.authentication.type === "session-token",
                };
            }
            if (target.authentication.type === "oauth") {
                return { kind: "external-oauth", url: target.url };
            }
            if (target.authentication.type === "bearer") {
                return {
                    kind: "external",
                    url: target.url,
                    authentication: {
                        type: "bearer",
                        token: readCredential(target.authentication.token),
                    },
                };
            }
            if (target.authentication.type === "headers") {
                const headers = {};
                for (const entry of target.authentication.headers) {
                    headers[entry.name] = readCredential(entry.value);
                }
                return {
                    kind: "external",
                    url: target.url,
                    authentication: { type: "headers", headers },
                };
            }
            return {
                kind: "external",
                url: target.url,
                authentication: { type: "none" },
            };
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
//# sourceMappingURL=http-target.js.map