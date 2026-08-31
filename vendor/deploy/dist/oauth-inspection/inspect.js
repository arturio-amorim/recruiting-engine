import { probeInitializeBody } from "../probe/request.js";
import { sendOAuthInspectionRequest, } from "./request.js";
const tokenPattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
function failure(stage, reason) {
    return { ok: false, stage, reason };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
    return (Array.isArray(value) &&
        value.length > 0 &&
        value.every((entry) => typeof entry === "string" && entry.length > 0));
}
function splitChallengeSegments(value) {
    const segments = [];
    let start = 0;
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        const code = character?.charCodeAt(0) ?? 0;
        if ((code < 0x20 && character !== "\t") || code === 0x7f)
            return undefined;
        if (escaped) {
            escaped = false;
            continue;
        }
        if (quoted && character === "\\") {
            escaped = true;
            continue;
        }
        if (character === '"')
            quoted = !quoted;
        if (!quoted && character === ",") {
            segments.push(value.slice(start, index).trim());
            start = index + 1;
        }
    }
    if (quoted || escaped)
        return undefined;
    segments.push(value.slice(start).trim());
    return segments.every((segment) => segment.length > 0) ? segments : undefined;
}
function decodeParameter(value) {
    if (value.startsWith('"')) {
        if (!value.endsWith('"') || value.length < 2)
            return undefined;
        const inner = value.slice(1, -1);
        let decoded = "";
        for (let index = 0; index < inner.length; index += 1) {
            const character = inner[index];
            if (character === "\\") {
                index += 1;
                const escaped = inner[index];
                if (escaped === undefined)
                    return undefined;
                decoded += escaped;
            }
            else {
                decoded += character;
            }
        }
        return decoded;
    }
    return tokenPattern.test(value) ? value : undefined;
}
function parseParameter(segment) {
    const separator = segment.indexOf("=");
    if (separator <= 0)
        return undefined;
    const name = segment.slice(0, separator).trim().toLowerCase();
    const rawValue = segment.slice(separator + 1).trim();
    if (!tokenPattern.test(name))
        return undefined;
    const value = decodeParameter(rawValue);
    return value === undefined ? undefined : [name, value];
}
function parseScope(value) {
    if (value === undefined)
        return "not-advertised";
    if (value.length === 0 || value.length > 4_096)
        return undefined;
    const scopes = value.split(" ");
    if (scopes.some((scope) => scope.length === 0 ||
        ![...scope].every((character) => {
            const code = character.charCodeAt(0);
            return (code >= 0x21 &&
                code <= 0x7e &&
                character !== '"' &&
                character !== "\\");
        })) ||
        new Set(scopes).size !== scopes.length) {
        return undefined;
    }
    return scopes.join(" ");
}
function parseBearerChallenge(value) {
    if (value === undefined)
        return undefined;
    const segments = splitChallengeSegments(value);
    if (segments === undefined)
        return undefined;
    for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index] ?? "";
        const match = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+)(?:\s+(.*))?$/u.exec(segment);
        if (match?.[1]?.toLowerCase() !== "bearer")
            continue;
        const parameterSegments = [];
        if (match[2] !== undefined)
            parameterSegments.push(match[2]);
        for (let cursor = index + 1; cursor < segments.length; cursor += 1) {
            const next = segments[cursor] ?? "";
            if (!next.includes("="))
                break;
            parameterSegments.push(next);
        }
        const parameters = new Map();
        for (const parameterSegment of parameterSegments) {
            const parsed = parseParameter(parameterSegment);
            if (parsed === undefined || parameters.has(parsed[0]))
                return undefined;
            parameters.set(parsed[0], parsed[1]);
        }
        const scopes = parseScope(parameters.get("scope"));
        if (scopes === undefined)
            return undefined;
        return {
            resourceMetadata: parameters.get("resource_metadata"),
            scopes,
        };
    }
    return undefined;
}
function parseSafeUrl(value) {
    if (typeof value !== "string" || value.length === 0 || value.length > 2_048) {
        return undefined;
    }
    for (const character of value) {
        const code = character.codePointAt(0) ?? 0;
        if (code <= 0x20 || code === 0x7f)
            return undefined;
    }
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return undefined;
    }
    if (url.username !== "" || url.password !== "" || url.hash !== "") {
        return undefined;
    }
    return url;
}
function safeUrl(value, trustedOrigin) {
    const url = parseSafeUrl(value);
    if (url === undefined)
        return undefined;
    if (url.protocol === "https:")
        return url;
    return url.protocol === "http:" && url.origin === trustedOrigin
        ? url
        : undefined;
}
function isLiteralLoopback(hostname) {
    return hostname === "127.0.0.1" || hostname === "[::1]";
}
/**
 * An authorization-server URL: HTTPS anywhere, or literal-loopback HTTP when
 * the inspected resource is itself literal-loopback HTTP — a local identity
 * provider normally runs as its own process on its own port. Mirrors the MCP
 * package's `validateAuthorizationServerUrl`; a divergence between the two
 * inspectors is a defect (ADR 0031).
 */
function safeAuthorizationUrl(value, resource) {
    const url = parseSafeUrl(value);
    if (url === undefined)
        return undefined;
    if (url.protocol === "https:")
        return url;
    return url.protocol === "http:" &&
        isLiteralLoopback(url.hostname) &&
        resource.protocol === "http:" &&
        isLiteralLoopback(resource.hostname)
        ? url
        : undefined;
}
function classifyExchange(exchange) {
    if (exchange.outcome === "deadline") {
        return { ok: false, reason: "DEADLINE_EXCEEDED" };
    }
    if (exchange.outcome === "connection-failure") {
        return { ok: false, reason: "CONNECTION_FAILED" };
    }
    if (exchange.outcome === "response-too-large") {
        return { ok: false, reason: "RESPONSE_TOO_LARGE" };
    }
    if (exchange.outcome === "invalid-utf8") {
        return { ok: false, reason: "INVALID_UTF8" };
    }
    return undefined;
}
function parseJsonResponse(exchange) {
    const exchangeFailure = classifyExchange(exchange);
    if (exchangeFailure !== undefined)
        return exchangeFailure;
    const response = exchange;
    if (response.status >= 300 && response.status < 400) {
        return { ok: false, reason: "REDIRECT_NOT_ALLOWED" };
    }
    if (response.status !== 200) {
        return { ok: false, reason: "UNEXPECTED_STATUS" };
    }
    const mediaType = response.contentType
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();
    if (mediaType !== "application/json" &&
        (mediaType === undefined || !mediaType.endsWith("+json"))) {
        return { ok: false, reason: "INVALID_CONTENT_TYPE" };
    }
    let value;
    try {
        value = JSON.parse(response.body);
    }
    catch {
        return { ok: false, reason: "INVALID_JSON" };
    }
    return isRecord(value)
        ? { ok: true, value }
        : { ok: false, reason: "INVALID_JSON" };
}
function buildDiscoveryUrls(issuer) {
    if (issuer.pathname === "/") {
        return [
            new URL("/.well-known/oauth-authorization-server", issuer.origin),
            new URL("/.well-known/openid-configuration", issuer.origin),
        ];
    }
    const pathname = issuer.pathname.endsWith("/")
        ? issuer.pathname.slice(0, -1)
        : issuer.pathname;
    return [
        new URL(`/.well-known/oauth-authorization-server${pathname}`, issuer.origin),
        new URL(`/.well-known/openid-configuration${pathname}`, issuer.origin),
        new URL(`${pathname}/.well-known/openid-configuration`, issuer.origin),
    ];
}
async function discoverAuthorizationServer(issuer, deadline) {
    for (const url of buildDiscoveryUrls(issuer)) {
        const exchange = await sendOAuthInspectionRequest({
            url,
            method: "GET",
            deadline,
        });
        const transportFailure = classifyExchange(exchange);
        if (transportFailure !== undefined)
            return transportFailure;
        const response = exchange;
        if (response.status >= 400 && response.status < 500)
            continue;
        return parseJsonResponse(response);
    }
    return { ok: false, reason: "METADATA_NOT_FOUND" };
}
function registrationReadiness(metadata) {
    const cimd = metadata.client_id_metadata_document_supported === true;
    const dcr = typeof metadata.registration_endpoint === "string";
    if (cimd && dcr)
        return "cimd,dcr";
    if (cimd)
        return "cimd";
    if (dcr)
        return "dcr";
    return "pre-registration-required";
}
export async function inspectOAuthDiscovery(options) {
    const deadline = Date.now() + options.timeoutMs;
    const challengeExchange = await sendOAuthInspectionRequest({
        url: options.url,
        method: "POST",
        body: probeInitializeBody,
        deadline,
    });
    const challengeFailure = classifyExchange(challengeExchange);
    if (challengeFailure !== undefined) {
        return failure("CHALLENGE", challengeFailure.reason);
    }
    const challengeResponse = challengeExchange;
    if (challengeResponse.status >= 300 && challengeResponse.status < 400) {
        return failure("CHALLENGE", "REDIRECT_NOT_ALLOWED");
    }
    if (challengeResponse.status !== 401) {
        return failure("CHALLENGE", "UNEXPECTED_STATUS");
    }
    const challenge = parseBearerChallenge(challengeResponse.challenge);
    if (challenge === undefined) {
        return failure("CHALLENGE", "INVALID_BEARER_CHALLENGE");
    }
    if (challenge.resourceMetadata === undefined) {
        return failure("CHALLENGE", "RESOURCE_METADATA_NOT_ADVERTISED");
    }
    const resourceMetadataUrl = safeUrl(challenge.resourceMetadata, options.url.origin);
    if (resourceMetadataUrl === undefined || resourceMetadataUrl.search !== "") {
        return failure("CHALLENGE", "UNSAFE_URL");
    }
    const resourceExchange = await sendOAuthInspectionRequest({
        url: resourceMetadataUrl,
        method: "GET",
        deadline,
    });
    const resourceResult = parseJsonResponse(resourceExchange);
    if (!resourceResult.ok) {
        return failure("RESOURCE_METADATA", resourceResult.reason);
    }
    if (resourceResult.value.resource !== options.url.href) {
        return failure("RESOURCE_METADATA", "RESOURCE_MISMATCH");
    }
    const authorizationServers = resourceResult.value.authorization_servers;
    if (!isStringArray(authorizationServers)) {
        return failure("RESOURCE_METADATA", "AUTHORIZATION_SERVER_NOT_ADVERTISED");
    }
    const issuerText = authorizationServers[0];
    if (issuerText === undefined) {
        return failure("RESOURCE_METADATA", "AUTHORIZATION_SERVER_NOT_ADVERTISED");
    }
    const issuer = safeAuthorizationUrl(issuerText, options.url);
    if (issuer === undefined || issuer.search !== "") {
        return failure("RESOURCE_METADATA", "UNSAFE_URL");
    }
    const metadataResult = await discoverAuthorizationServer(issuer, deadline);
    if (!metadataResult.ok) {
        return failure("AUTHORIZATION_SERVER_METADATA", metadataResult.reason);
    }
    const metadata = metadataResult.value;
    if (metadata.issuer !== issuerText) {
        return failure("AUTHORIZATION_SERVER_METADATA", "ISSUER_MISMATCH");
    }
    for (const field of ["authorization_endpoint", "token_endpoint"]) {
        if (safeAuthorizationUrl(metadata[field], options.url) === undefined) {
            return failure("AUTHORIZATION_SERVER_METADATA", "INVALID_ENDPOINT");
        }
    }
    if (!isStringArray(metadata.response_types_supported) ||
        !metadata.response_types_supported.includes("code") ||
        !isStringArray(metadata.grant_types_supported) ||
        !metadata.grant_types_supported.includes("authorization_code")) {
        return failure("AUTHORIZATION_SERVER_CAPABILITIES", "AUTHORIZATION_CODE_NOT_ADVERTISED");
    }
    if (!isStringArray(metadata.code_challenge_methods_supported) ||
        !metadata.code_challenge_methods_supported.includes("S256")) {
        return failure("AUTHORIZATION_SERVER_CAPABILITIES", "S256_NOT_ADVERTISED");
    }
    if (metadata.registration_endpoint !== undefined &&
        safeAuthorizationUrl(metadata.registration_endpoint, options.url) ===
            undefined) {
        return failure("AUTHORIZATION_SERVER_METADATA", "INVALID_ENDPOINT");
    }
    let jwks = "not-advertised";
    if (metadata.jwks_uri !== undefined) {
        const jwksUrl = safeAuthorizationUrl(metadata.jwks_uri, options.url);
        if (jwksUrl === undefined || jwksUrl.search !== "") {
            return failure("JWKS", "UNSAFE_URL");
        }
        const jwksResult = parseJsonResponse(await sendOAuthInspectionRequest({
            url: jwksUrl,
            method: "GET",
            deadline,
        }));
        if (!jwksResult.ok)
            return failure("JWKS", jwksResult.reason);
        if (!Array.isArray(jwksResult.value.keys) ||
            jwksResult.value.keys.length === 0 ||
            !jwksResult.value.keys.every(isRecord)) {
            return failure("JWKS", "INVALID_JWKS");
        }
        jwks = "valid";
    }
    return {
        ok: true,
        resource: options.url.href,
        issuer: issuerText,
        challengeScopes: challenge.scopes,
        registration: registrationReadiness(metadata),
        jwks,
    };
}
//# sourceMappingURL=inspect.js.map