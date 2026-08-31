import { types as nodeTypes } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { buildDiscoveryUrls, extractResourceMetadataUrl, UnauthorizedError, } from "@modelcontextprotocol/sdk/client/auth.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { OAuthMetadataSchema, OAuthProtectedResourceMetadataSchema, } from "@modelcontextprotocol/sdk/shared/auth.js";
import { ErrorCode, LATEST_PROTOCOL_VERSION, McpError, } from "@modelcontextprotocol/sdk/types.js";
export class McpClientError extends Error {
    constructor(code, message, options) {
        super();
        Object.defineProperties(this, {
            code: {
                configurable: false,
                enumerable: true,
                value: code,
                writable: false,
            },
            message: {
                configurable: false,
                enumerable: true,
                value: message,
                writable: false,
            },
            ...(options?.cause === undefined
                ? {}
                : {
                    cause: {
                        configurable: false,
                        enumerable: false,
                        value: options.cause,
                        writable: false,
                    },
                }),
        });
    }
}
const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;
const CLIENT_NAME = "senda-mcp-client";
const CLIENT_VERSION = "0.7.0";
const HTTP_HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HTTP_WHITESPACE_AT_START_OR_END = /^(?:[\t ])|(?:[\t ])$/;
const OAUTH_STATE = /^[A-Za-z0-9_-]{43}$/;
const OAUTH_CALLBACK_PATH = "/oauth/callback";
const MAX_OAUTH_AUTHORIZATION_URL_BYTES = 8_192;
const MAX_OAUTH_CODE_POINTS = 4_096;
const textEncoder = new TextEncoder();
const ERROR_MESSAGES = {
    INVALID_TARGET: "The MCP client target is invalid.",
    SPAWN_FAILED: "The MCP server process could not be started.",
    CONNECTION_FAILED: "The MCP client connection failed.",
    AUTHENTICATION_FAILED: "The MCP target rejected the supplied credentials.",
    PROTOCOL_ERROR: "The MCP peer returned an invalid protocol exchange.",
    TIMEOUT: "The MCP client operation timed out.",
    LIMIT_EXCEEDED: "The MCP client message limit was exceeded.",
    CANCELLED: "The MCP client operation was cancelled.",
};
class ClientBoundaryFailure extends Error {
    code;
    constructor(code) {
        super();
        this.code = code;
    }
}
function clientError(code, cause) {
    return new McpClientError(code, ERROR_MESSAGES[code], cause === undefined ? undefined : { cause });
}
function isPlainRecord(value) {
    if (typeof value !== "object" || value === null || nodeTypes.isProxy(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function createDataRecord() {
    return Object.create(null);
}
function defineDataProperty(record, key, value) {
    Object.defineProperty(record, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
    });
}
function dataProperties(value) {
    if (!isPlainRecord(value))
        return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot = createDataRecord();
    for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== "string")
            return undefined;
        const descriptor = descriptors[key];
        if (descriptor === undefined ||
            !descriptor.enumerable ||
            !("value" in descriptor)) {
            return undefined;
        }
        defineDataProperty(snapshot, key, descriptor.value);
    }
    return snapshot;
}
function hasExactlyKeys(record, required, optional = []) {
    const keys = Object.keys(record);
    const allowed = new Set([...required, ...optional]);
    return (required.every((key) => Object.hasOwn(record, key)) &&
        keys.every((key) => allowed.has(key)));
}
function snapshotStringArray(value) {
    if (!Array.isArray(value) || nodeTypes.isProxy(value))
        return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        typeof lengthDescriptor.value !== "number") {
        return undefined;
    }
    const length = lengthDescriptor.value;
    const snapshot = [];
    for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined ||
            !descriptor.enumerable ||
            !("value" in descriptor) ||
            typeof descriptor.value !== "string") {
            return undefined;
        }
        snapshot.push(descriptor.value);
    }
    const expectedKeys = new Set([
        "length",
        ...snapshot.map((_, index) => String(index)),
    ]);
    if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string" || !expectedKeys.has(key))) {
        return undefined;
    }
    return snapshot;
}
function snapshotStringRecord(value, validateName, validateValue) {
    const record = dataProperties(value);
    if (record === undefined)
        return undefined;
    const snapshot = createDataRecord();
    for (const [key, entry] of Object.entries(record)) {
        if (!validateName(key) ||
            typeof entry !== "string" ||
            !validateValue(entry)) {
            return undefined;
        }
        defineDataProperty(snapshot, key, entry);
    }
    return snapshot;
}
function parseCanonicalHttpUrl(value) {
    if (typeof value !== "string" ||
        value.length === 0 ||
        value.includes("?") ||
        value.includes("#")) {
        return undefined;
    }
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return undefined;
    }
    if (url.username !== "" ||
        url.password !== "" ||
        url.search !== "" ||
        url.hash !== "" ||
        url.hostname === "") {
        return undefined;
    }
    if (url.protocol !== "https:" &&
        !(url.protocol === "http:" &&
            (url.hostname === "127.0.0.1" || url.hostname === "[::1]"))) {
        return undefined;
    }
    const serialized = url.href;
    if (serialized !== value && serialized !== `${value}/`)
        return undefined;
    return url;
}
function isLoopbackHttpUrl(url) {
    return (url.protocol === "http:" &&
        (url.hostname === "127.0.0.1" || url.hostname === "[::1]"));
}
function isSecureOrLoopbackUrl(url) {
    return url.protocol === "https:" || isLoopbackHttpUrl(url);
}
class OAuthEndpointTrust {
    resourceUrl;
    advertisedOrigins = new Set();
    constructor(resourceUrl) {
        this.resourceUrl = resourceUrl;
    }
    allowsResourceMetadata(candidate) {
        return (isSecureOrLoopbackUrl(candidate) &&
            candidate.origin === this.resourceUrl.origin);
    }
    /**
     * RFC 8414 issuer identifiers carry no query or fragment, so an advertised
     * authorization server is the delegated-endpoint hygiene plus that rule.
     */
    allowsAdvertisedServer(candidate) {
        return this.allowsDelegatedEndpoint(candidate) && candidate.search === "";
    }
    /**
     * An OAuth endpoint the validated authorization-server metadata publishes.
     * It may sit on its own origin — hosted providers commonly split the issuer
     * from the endpoints — but it must be HTTPS (or loopback HTTP behind a
     * loopback resource) and carry no credentials and no fragment.
     */
    allowsDelegatedEndpoint(candidate) {
        return (isSecureOrLoopbackUrl(candidate) &&
            (!isLoopbackHttpUrl(candidate) || isLoopbackHttpUrl(this.resourceUrl)) &&
            candidate.username === "" &&
            candidate.password === "" &&
            candidate.hash === "");
    }
    trustAdvertisedServer(candidate) {
        this.advertisedOrigins.add(candidate.origin);
    }
    allowsEndpoint(candidate) {
        return (candidate.username === "" &&
            candidate.password === "" &&
            candidate.hash === "" &&
            (this.allowsResourceMetadata(candidate) ||
                (isSecureOrLoopbackUrl(candidate) &&
                    this.advertisedOrigins.has(candidate.origin))));
    }
    clear() {
        this.advertisedOrigins.clear();
    }
}
function resourceMetadataUrls(resourceUrl) {
    const resourcePath = resourceUrl.pathname.endsWith("/")
        ? resourceUrl.pathname.slice(0, -1)
        : resourceUrl.pathname;
    return {
        pathAware: new URL(`/.well-known/oauth-protected-resource${resourcePath}`, resourceUrl.origin),
        root: new URL("/.well-known/oauth-protected-resource", resourceUrl.origin),
    };
}
function parseOAuthCallbackUrl(value) {
    if (typeof value !== "string" || value.length === 0)
        return undefined;
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return undefined;
    }
    if (url.protocol !== "http:" ||
        (url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") ||
        url.username !== "" ||
        url.password !== "" ||
        url.pathname !== OAUTH_CALLBACK_PATH ||
        url.search !== "" ||
        url.hash !== "" ||
        url.href !== value) {
        return undefined;
    }
    return url;
}
function snapshotOAuthTarget(target) {
    try {
        const record = dataProperties(target);
        if (record === undefined ||
            !hasExactlyKeys(record, ["transport", "url", "authentication"]) ||
            record.transport !== "http") {
            throw new ClientBoundaryFailure("INVALID_TARGET");
        }
        const authentication = dataProperties(record.authentication);
        const url = parseCanonicalHttpUrl(record.url);
        if (authentication === undefined ||
            !hasExactlyKeys(authentication, ["type"]) ||
            authentication.type !== "oauth" ||
            url === undefined) {
            throw new ClientBoundaryFailure("INVALID_TARGET");
        }
        return { transport: "http", url, credentials: createDataRecord() };
    }
    catch (cause) {
        if (cause instanceof ClientBoundaryFailure) {
            throw clientError(cause.code, cause);
        }
        throw clientError("INVALID_TARGET", cause);
    }
}
function snapshotOAuthAuthorizationOptions(options) {
    try {
        const record = dataProperties(options);
        if (record === undefined ||
            !hasExactlyKeys(record, ["redirectUrl", "state"], ["signal"]) ||
            typeof record.state !== "string" ||
            !OAUTH_STATE.test(record.state)) {
            throw new ClientBoundaryFailure("INVALID_TARGET");
        }
        const redirectUrl = parseOAuthCallbackUrl(record.redirectUrl);
        if (redirectUrl === undefined) {
            throw new ClientBoundaryFailure("INVALID_TARGET");
        }
        const signal = snapshotAbortSignal(record.signal === undefined
            ? undefined
            : { signal: record.signal }, "INVALID_TARGET");
        return {
            redirectUrl,
            state: record.state,
            ...(signal === undefined ? {} : { signal }),
        };
    }
    catch (cause) {
        if (cause instanceof McpClientError)
            throw cause;
        if (cause instanceof ClientBoundaryFailure) {
            throw clientError(cause.code, cause);
        }
        throw clientError("INVALID_TARGET", cause);
    }
}
function snapshotAuthorizationCode(value) {
    if (typeof value !== "string" || value.length === 0) {
        throw clientError("AUTHENTICATION_FAILED");
    }
    let codePoints = 0;
    for (const _codePoint of value) {
        codePoints += 1;
        if (codePoints > MAX_OAUTH_CODE_POINTS) {
            throw clientError("AUTHENTICATION_FAILED");
        }
    }
    return value;
}
function serializeAuthorizationUrl(value, expectedState, trust) {
    if (!trust.allowsEndpoint(value) ||
        value.username !== "" ||
        value.password !== "" ||
        value.hash !== "" ||
        value.searchParams.getAll("state").length !== 1 ||
        value.searchParams.get("state") !== expectedState) {
        throw new ClientBoundaryFailure("PROTOCOL_ERROR");
    }
    const serialized = value.href;
    if (textEncoder.encode(serialized).byteLength >
        MAX_OAUTH_AUTHORIZATION_URL_BYTES) {
        throw new ClientBoundaryFailure("LIMIT_EXCEEDED");
    }
    return serialized;
}
/**
 * Whether the MCP client facade refuses a caller-supplied header name. The
 * devtools validates an external target's custom headers with this same
 * predicate so it never accepts a target the facade will refuse.
 */
export function isForbiddenMcpClientHeader(name) {
    const normalized = name.toLowerCase();
    return (normalized === "host" ||
        normalized === "origin" ||
        normalized === "accept" ||
        normalized === "content-type" ||
        normalized === "content-length" ||
        normalized === "transfer-encoding" ||
        normalized === "connection" ||
        normalized === "upgrade" ||
        normalized === "cookie" ||
        normalized === "set-cookie" ||
        normalized === "mcp-session-id" ||
        normalized === "mcp-protocol-version" ||
        normalized === "last-event-id" ||
        normalized.startsWith("sec-") ||
        normalized.startsWith("proxy-"));
}
function snapshotAuthentication(value) {
    if (value === undefined)
        return {};
    const authentication = dataProperties(value);
    if (authentication === undefined || typeof authentication.type !== "string") {
        return undefined;
    }
    if (authentication.type === "none") {
        return hasExactlyKeys(authentication, ["type"]) ? {} : undefined;
    }
    if (authentication.type === "bearer") {
        if (!hasExactlyKeys(authentication, ["type", "token"]) ||
            typeof authentication.token !== "string" ||
            authentication.token.length === 0 ||
            HTTP_WHITESPACE_AT_START_OR_END.test(authentication.token) ||
            authentication.token.includes("\r") ||
            authentication.token.includes("\n")) {
            return undefined;
        }
        return { authorization: `Bearer ${authentication.token}` };
    }
    if (authentication.type !== "headers" ||
        !hasExactlyKeys(authentication, ["type", "headers"])) {
        return undefined;
    }
    const headers = snapshotStringRecord(authentication.headers, (name) => HTTP_HEADER_NAME.test(name) && !isForbiddenMcpClientHeader(name), (headerValue) => !headerValue.includes("\r") && !headerValue.includes("\n"));
    if (headers === undefined || Object.keys(headers).length === 0)
        return undefined;
    const uniqueNames = new Set();
    for (const name of Object.keys(headers)) {
        const normalized = name.toLowerCase();
        if (uniqueNames.has(normalized))
            return undefined;
        uniqueNames.add(normalized);
    }
    return headers;
}
function snapshotTarget(target) {
    try {
        const record = dataProperties(target);
        if (record === undefined || typeof record.transport !== "string") {
            throw new ClientBoundaryFailure("INVALID_TARGET");
        }
        if (record.transport === "stdio") {
            if (!hasExactlyKeys(record, ["transport", "command"], ["args", "cwd", "env"]) ||
                typeof record.command !== "string" ||
                record.command.length === 0) {
                throw new ClientBoundaryFailure("INVALID_TARGET");
            }
            const args = record.args === undefined ? [] : snapshotStringArray(record.args);
            const env = record.env === undefined
                ? {}
                : snapshotStringRecord(record.env, (name) => ENVIRONMENT_NAME.test(name), (entry) => entry.length > 0);
            if (args === undefined ||
                env === undefined ||
                (record.cwd !== undefined &&
                    (typeof record.cwd !== "string" || record.cwd.length === 0))) {
                throw new ClientBoundaryFailure("INVALID_TARGET");
            }
            return {
                transport: "stdio",
                command: record.command,
                args,
                ...(record.cwd === undefined ? {} : { cwd: record.cwd }),
                env,
            };
        }
        if (record.transport === "http") {
            if (!hasExactlyKeys(record, ["transport", "url"], ["authentication"])) {
                throw new ClientBoundaryFailure("INVALID_TARGET");
            }
            const url = parseCanonicalHttpUrl(record.url);
            const credentials = snapshotAuthentication(record.authentication);
            if (url === undefined || credentials === undefined) {
                throw new ClientBoundaryFailure("INVALID_TARGET");
            }
            return { transport: "http", url, credentials };
        }
        throw new ClientBoundaryFailure("INVALID_TARGET");
    }
    catch (cause) {
        if (cause instanceof ClientBoundaryFailure)
            throw clientError(cause.code, cause);
        throw clientError("INVALID_TARGET", cause);
    }
}
function snapshotAbortSignal(options, invalidCode) {
    try {
        if (options === undefined)
            return undefined;
        const record = dataProperties(options);
        if (record === undefined || !hasExactlyKeys(record, [], ["signal"])) {
            throw new ClientBoundaryFailure(invalidCode);
        }
        if (record.signal === undefined)
            return undefined;
        if (typeof record.signal !== "object" ||
            record.signal === null ||
            nodeTypes.isProxy(record.signal)) {
            throw new ClientBoundaryFailure(invalidCode);
        }
        Reflect.apply(AbortSignal.prototype.throwIfAborted, record.signal, []);
        return record.signal;
    }
    catch (cause) {
        if (cause instanceof ClientBoundaryFailure)
            throw clientError(cause.code, cause);
        if (isAbortedSignal(options))
            throw clientError("CANCELLED", cause);
        throw clientError(invalidCode, cause);
    }
}
function isAbortedSignal(options) {
    try {
        const descriptor = options === undefined
            ? undefined
            : Object.getOwnPropertyDescriptor(options, "signal");
        if (descriptor === undefined || !("value" in descriptor))
            return false;
        const signal = descriptor.value;
        if (typeof signal !== "object" ||
            signal === null ||
            nodeTypes.isProxy(signal)) {
            return false;
        }
        Reflect.apply(AbortSignal.prototype.throwIfAborted, signal, []);
        return false;
    }
    catch {
        return true;
    }
}
function snapshotJson(value) {
    const active = new Set();
    const visit = (entry) => {
        if (entry === null ||
            typeof entry === "string" ||
            typeof entry === "boolean") {
            return entry;
        }
        if (typeof entry === "number") {
            if (!Number.isFinite(entry) || Object.is(entry, -0)) {
                throw new ClientBoundaryFailure("PROTOCOL_ERROR");
            }
            return entry;
        }
        if (typeof entry !== "object" || nodeTypes.isProxy(entry)) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        if (active.has(entry))
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        active.add(entry);
        try {
            if (Array.isArray(entry)) {
                const descriptors = Object.getOwnPropertyDescriptors(entry);
                const lengthDescriptor = Reflect.getOwnPropertyDescriptor(entry, "length");
                const length = lengthDescriptor !== undefined && "value" in lengthDescriptor
                    ? lengthDescriptor.value
                    : undefined;
                if (typeof length !== "number") {
                    throw new ClientBoundaryFailure("PROTOCOL_ERROR");
                }
                const snapshot = [];
                for (let index = 0; index < length; index += 1) {
                    const descriptor = descriptors[String(index)];
                    if (descriptor === undefined ||
                        !descriptor.enumerable ||
                        !("value" in descriptor)) {
                        throw new ClientBoundaryFailure("PROTOCOL_ERROR");
                    }
                    snapshot.push(visit(descriptor.value));
                }
                const expected = new Set([
                    "length",
                    ...snapshot.map((_, index) => String(index)),
                ]);
                if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string" || !expected.has(key))) {
                    throw new ClientBoundaryFailure("PROTOCOL_ERROR");
                }
                return snapshot;
            }
            const record = dataProperties(entry);
            if (record === undefined)
                throw new ClientBoundaryFailure("PROTOCOL_ERROR");
            const snapshot = createDataRecord();
            for (const [key, child] of Object.entries(record)) {
                defineDataProperty(snapshot, key, visit(child));
            }
            return snapshot;
        }
        finally {
            active.delete(entry);
        }
    };
    const snapshot = visit(value);
    JSON.stringify(snapshot);
    return snapshot;
}
function snapshotJsonRecord(value) {
    const snapshot = snapshotJson(value);
    if (Array.isArray(snapshot) ||
        snapshot === null ||
        typeof snapshot !== "object") {
        throw new ClientBoundaryFailure("PROTOCOL_ERROR");
    }
    return snapshot;
}
function encodedBytes(value, stdio) {
    const serialized = JSON.stringify(value);
    return textEncoder.encode(stdio ? `${serialized}\n` : serialized).byteLength;
}
function checkMessageSize(value, stdio) {
    if (encodedBytes(value, stdio) > MAX_MESSAGE_BYTES) {
        throw new ClientBoundaryFailure("LIMIT_EXCEEDED");
    }
}
function boundedResponseBody(response, onFailure) {
    const fail = (code) => {
        const failure = new ClientBoundaryFailure(code);
        onFailure?.(failure);
        return failure;
    };
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null &&
        /^\d+$/.test(declaredLength) &&
        Number(declaredLength) > MAX_MESSAGE_BYTES) {
        void response.body?.cancel();
        throw fail("LIMIT_EXCEEDED");
    }
    if (response.body === null)
        return response;
    let received = 0;
    const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
    const bounded = response.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
            received += chunk.byteLength;
            if (received > MAX_MESSAGE_BYTES) {
                controller.error(fail("LIMIT_EXCEEDED"));
                return;
            }
            try {
                utf8Decoder.decode(chunk, { stream: true });
            }
            catch {
                controller.error(fail("PROTOCOL_ERROR"));
                return;
            }
            controller.enqueue(chunk);
        },
        flush() {
            try {
                utf8Decoder.decode();
            }
            catch {
                throw fail("PROTOCOL_ERROR");
            }
        },
    }));
    return new Response(bounded, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
    });
}
class EphemeralOAuthProvider {
    callbackUrl;
    resourceUrl;
    lifecycleSignal;
    metadata;
    trust;
    defaultResourceMetadataUrls;
    pathAwareResourceMetadataUrl;
    rootResourceMetadataUrl;
    advertisedResourceMetadataUrl;
    client;
    tokenSet;
    verifier;
    discovery;
    authorizationUrl;
    terminalFailure;
    retainedState;
    writable = true;
    constructor(callbackUrl, resourceUrl, lifecycleSignal, state) {
        this.callbackUrl = callbackUrl;
        this.resourceUrl = resourceUrl;
        this.lifecycleSignal = lifecycleSignal;
        this.retainedState = state;
        this.trust = new OAuthEndpointTrust(resourceUrl);
        const { pathAware, root } = resourceMetadataUrls(resourceUrl);
        this.pathAwareResourceMetadataUrl = pathAware.href;
        this.rootResourceMetadataUrl = root.href;
        this.defaultResourceMetadataUrls = new Set([
            this.pathAwareResourceMetadataUrl,
            this.rootResourceMetadataUrl,
        ]);
        this.metadata = Object.freeze({
            redirect_uris: [callbackUrl.href],
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code"],
            response_types: ["code"],
            client_name: "Senda devtools",
            software_id: "senda-devtools",
            software_version: CLIENT_VERSION,
        });
    }
    get redirectUrl() {
        return this.callbackUrl.href;
    }
    get clientMetadata() {
        return this.metadata;
    }
    state() {
        this.assertWritable();
        return this.retainedState;
    }
    clientInformation() {
        this.assertWritable();
        return this.client;
    }
    saveClientInformation(value) {
        this.assertWritable();
        if (typeof value.client_id !== "string" || value.client_id.length === 0) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        this.client = Object.freeze({ client_id: value.client_id });
    }
    tokens() {
        this.assertWritable();
        return this.tokenSet;
    }
    saveTokens(value) {
        this.assertWritable();
        if (typeof value.access_token !== "string" ||
            value.access_token.length === 0 ||
            typeof value.token_type !== "string" ||
            value.token_type.length === 0) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        this.tokenSet = Object.freeze({
            access_token: value.access_token,
            token_type: value.token_type,
            ...(typeof value.expires_in === "number"
                ? { expires_in: value.expires_in }
                : {}),
            ...(typeof value.scope === "string" ? { scope: value.scope } : {}),
        });
    }
    redirectToAuthorization(value) {
        this.assertWritable();
        this.authorizationUrl = new URL(value.href);
    }
    saveCodeVerifier(value) {
        this.assertWritable();
        if (typeof value !== "string" || value.length === 0) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        this.verifier = value;
    }
    codeVerifier() {
        this.assertWritable();
        if (this.verifier === undefined) {
            throw new ClientBoundaryFailure("AUTHENTICATION_FAILED");
        }
        return this.verifier;
    }
    saveDiscoveryState(value) {
        this.assertWritable();
        let authorizationServerUrl;
        try {
            authorizationServerUrl = new URL(value.authorizationServerUrl);
        }
        catch {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        if (value.resourceMetadata === undefined ||
            !this.trust.allowsEndpoint(authorizationServerUrl) ||
            authorizationServerUrl.username !== "" ||
            authorizationServerUrl.password !== "" ||
            authorizationServerUrl.hash !== "" ||
            (value.authorizationServerMetadata !== undefined &&
                value.authorizationServerMetadata.issuer !==
                    value.authorizationServerUrl)) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        // The issuer has been matched to an advertised authorization server, so
        // the endpoints its validated metadata publishes are that server's own
        // delegation — hosted providers commonly place them on another origin.
        if (value.authorizationServerMetadata !== undefined) {
            const metadata = value.authorizationServerMetadata;
            for (const endpoint of [
                metadata.authorization_endpoint,
                metadata.token_endpoint,
                metadata.registration_endpoint,
            ]) {
                if (endpoint === undefined)
                    continue;
                let endpointUrl;
                try {
                    endpointUrl = new URL(endpoint);
                }
                catch {
                    throw new ClientBoundaryFailure("PROTOCOL_ERROR");
                }
                if (!this.trust.allowsDelegatedEndpoint(endpointUrl)) {
                    throw new ClientBoundaryFailure("PROTOCOL_ERROR");
                }
                this.trust.trustAdvertisedServer(endpointUrl);
            }
        }
        this.discovery = structuredClone(value);
    }
    discoveryState() {
        this.assertWritable();
        return this.discovery === undefined
            ? undefined
            : structuredClone(this.discovery);
    }
    hasTokens() {
        return this.tokenSet !== undefined;
    }
    rememberResourceMetadataUrl(response) {
        const url = extractResourceMetadataUrl(response);
        if (url !== undefined && !this.trust.allowsResourceMetadata(url)) {
            return false;
        }
        this.advertisedResourceMetadataUrl = url?.href;
        return true;
    }
    isResourceMetadataUrl(url) {
        return (url.href === this.advertisedResourceMetadataUrl ||
            this.defaultResourceMetadataUrls.has(url.href));
    }
    allowsResourceMetadataNotFound(url) {
        return (this.advertisedResourceMetadataUrl === undefined &&
            this.pathAwareResourceMetadataUrl !== this.rootResourceMetadataUrl &&
            url.href === this.pathAwareResourceMetadataUrl);
    }
    validateResourceMetadata(value) {
        const parsed = OAuthProtectedResourceMetadataSchema.safeParse(value);
        if (!parsed.success || parsed.data.resource !== this.resourceUrl.href) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        const advertised = [];
        for (const entry of parsed.data.authorization_servers ?? []) {
            let authorizationServerUrl;
            try {
                authorizationServerUrl = new URL(entry);
            }
            catch {
                throw new ClientBoundaryFailure("PROTOCOL_ERROR");
            }
            if (!this.trust.allowsAdvertisedServer(authorizationServerUrl)) {
                throw new ClientBoundaryFailure("PROTOCOL_ERROR");
            }
            advertised.push(authorizationServerUrl);
        }
        if (advertised.length === 0) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        for (const authorizationServerUrl of advertised) {
            this.trust.trustAdvertisedServer(authorizationServerUrl);
        }
    }
    latchTerminalFailure(failure) {
        this.terminalFailure ??= failure;
    }
    getTerminalFailure() {
        return this.terminalFailure;
    }
    throwIfTerminalFailure() {
        if (this.terminalFailure !== undefined)
            throw this.terminalFailure;
    }
    takeAuthorizationUrl() {
        this.assertWritable();
        const value = this.authorizationUrl;
        this.authorizationUrl = undefined;
        return value;
    }
    clear() {
        this.writable = false;
        this.trust.clear();
        this.client = undefined;
        this.tokenSet = undefined;
        this.verifier = undefined;
        this.discovery = undefined;
        this.authorizationUrl = undefined;
        this.advertisedResourceMetadataUrl = undefined;
        this.retainedState = "";
    }
    invalidateCredentials() {
        this.clear();
        throw new ClientBoundaryFailure("AUTHENTICATION_FAILED");
    }
    assertWritable() {
        if (!this.writable || this.lifecycleSignal.aborted) {
            throw new ClientBoundaryFailure("CANCELLED");
        }
    }
}
function createSecureFetch(credentials) {
    return async (url, init = {}) => {
        try {
            if (init.method === "GET") {
                return new Response(null, {
                    status: 405,
                    statusText: "Method Not Allowed",
                });
            }
            if (init.body !== undefined && init.body !== null) {
                if (typeof init.body !== "string") {
                    throw new ClientBoundaryFailure("PROTOCOL_ERROR");
                }
                if (textEncoder.encode(init.body).byteLength > MAX_MESSAGE_BYTES) {
                    throw new ClientBoundaryFailure("LIMIT_EXCEEDED");
                }
            }
            const headers = new Headers(init.headers);
            for (const [name, value] of Object.entries(credentials))
                headers.set(name, value);
            const response = await fetch(url, {
                ...init,
                headers,
                redirect: "manual",
            });
            if (response.status === 401 || response.status === 403) {
                await response.body?.cancel();
                throw new ClientBoundaryFailure("AUTHENTICATION_FAILED");
            }
            if (response.status >= 300 && response.status < 400) {
                await response.body?.cancel();
                throw new ClientBoundaryFailure("CONNECTION_FAILED");
            }
            return boundedResponseBody(response);
        }
        catch (cause) {
            if (cause instanceof ClientBoundaryFailure)
                throw cause;
            throw new ClientBoundaryFailure("CONNECTION_FAILED");
        }
    };
}
function createSecureOAuthFetch(resourceUrl, provider) {
    return async (value, init = {}) => {
        let effectiveSignal;
        try {
            provider.throwIfTerminalFailure();
            const url = new URL(value);
            if (!provider.trust.allowsEndpoint(url) ||
                url.username !== "" ||
                url.password !== "" ||
                url.hash !== "") {
                throw new ClientBoundaryFailure("CONNECTION_FAILED");
            }
            const method = init.method ?? "GET";
            if (method === "GET" && url.href === resourceUrl.href) {
                return new Response(null, {
                    status: 405,
                    statusText: "Method Not Allowed",
                });
            }
            if (method !== "GET" && method !== "POST" && method !== "DELETE") {
                throw new ClientBoundaryFailure("CONNECTION_FAILED");
            }
            if (init.body !== undefined && init.body !== null) {
                const body = typeof init.body === "string"
                    ? init.body
                    : init.body instanceof URLSearchParams
                        ? init.body.toString()
                        : undefined;
                if (body === undefined ||
                    textEncoder.encode(body).byteLength > MAX_MESSAGE_BYTES) {
                    throw new ClientBoundaryFailure(body === undefined ? "PROTOCOL_ERROR" : "LIMIT_EXCEEDED");
                }
            }
            const suppliedSignal = init.signal ?? undefined;
            effectiveSignal =
                suppliedSignal === undefined
                    ? provider.lifecycleSignal
                    : AbortSignal.any([suppliedSignal, provider.lifecycleSignal]);
            if (effectiveSignal.aborted)
                throw new ClientBoundaryFailure("CANCELLED");
            const response = await fetch(url, {
                ...init,
                signal: effectiveSignal,
                redirect: "manual",
            });
            if (method === "POST" &&
                url.href === resourceUrl.href &&
                response.status === 401 &&
                !provider.hasTokens() &&
                !provider.rememberResourceMetadataUrl(response)) {
                await response.body?.cancel();
                throw new ClientBoundaryFailure("PROTOCOL_ERROR");
            }
            if (response.status >= 300 && response.status < 400) {
                await response.body?.cancel();
                throw new ClientBoundaryFailure("CONNECTION_FAILED");
            }
            if (method === "GET" &&
                provider.isResourceMetadataUrl(url) &&
                !response.ok &&
                !(response.status === 404 &&
                    provider.allowsResourceMetadataNotFound(url))) {
                await response.body?.cancel();
                throw new ClientBoundaryFailure(response.status === 401 || response.status === 403
                    ? "AUTHENTICATION_FAILED"
                    : "CONNECTION_FAILED");
            }
            if ((response.status === 401 || response.status === 403) &&
                provider.hasTokens()) {
                await response.body?.cancel();
                throw new ClientBoundaryFailure("AUTHENTICATION_FAILED");
            }
            if (response.status === 403) {
                await response.body?.cancel();
                throw new ClientBoundaryFailure("AUTHENTICATION_FAILED");
            }
            if (response.status >= 500 ||
                (method === "GET" &&
                    (response.status === 401 || response.status === 403))) {
                await response.body?.cancel();
                throw new ClientBoundaryFailure(response.status === 401 || response.status === 403
                    ? "AUTHENTICATION_FAILED"
                    : "CONNECTION_FAILED");
            }
            const bounded = boundedResponseBody(response, (failure) => {
                provider.latchTerminalFailure(failure);
            });
            if (method === "GET" &&
                response.ok &&
                provider.isResourceMetadataUrl(url)) {
                const body = await bounded.text();
                let metadata;
                try {
                    metadata = JSON.parse(body);
                }
                catch {
                    throw new ClientBoundaryFailure("PROTOCOL_ERROR");
                }
                provider.validateResourceMetadata(metadata);
                return new Response(body, {
                    headers: bounded.headers,
                    status: bounded.status,
                    statusText: bounded.statusText,
                });
            }
            return bounded;
        }
        catch (cause) {
            const failure = cause instanceof ClientBoundaryFailure
                ? cause
                : new ClientBoundaryFailure(effectiveSignal?.aborted === true
                    ? "CANCELLED"
                    : "CONNECTION_FAILED");
            provider.latchTerminalFailure(failure);
            throw failure;
        }
    };
}
function recordConnectionFailure(state, failure) {
    if (state.failure === undefined ||
        failure.code === "LIMIT_EXCEEDED" ||
        state.failure.code === "PROTOCOL_ERROR") {
        state.failure = failure;
    }
}
class FacadeTransport {
    inner;
    stdio;
    state;
    onclose;
    onerror;
    onmessage;
    initializeRequestId;
    protocolVersion;
    constructor(inner, stdio, state) {
        this.inner = inner;
        this.stdio = stdio;
        this.state = state;
        inner.onclose = () => this.onclose?.();
        inner.onerror = (error) => {
            this.onerror?.(error);
            if (!this.state.connected)
                return;
            recordConnectionFailure(this.state, error instanceof ClientBoundaryFailure
                ? error
                : new ClientBoundaryFailure(error.message.startsWith("ReadBuffer exceeded maximum size of ")
                    ? "LIMIT_EXCEEDED"
                    : "PROTOCOL_ERROR"));
            void this.inner.close();
        };
        inner.onmessage = (message, extra) => {
            try {
                checkMessageSize(message, this.stdio);
                if (this.initializeRequestId !== undefined &&
                    "id" in message &&
                    message.id === this.initializeRequestId &&
                    "result" in message &&
                    isPlainRecord(message.result) &&
                    typeof message.result.protocolVersion === "string") {
                    this.protocolVersion = message.result.protocolVersion;
                }
                this.onmessage?.(message, extra);
            }
            catch (cause) {
                recordConnectionFailure(this.state, cause instanceof ClientBoundaryFailure
                    ? cause
                    : new ClientBoundaryFailure("PROTOCOL_ERROR"));
                void this.inner.close();
            }
        };
    }
    setProtocolVersion(version) {
        this.inner.setProtocolVersion?.(version);
    }
    async start() {
        await this.inner.start();
        this.state.connected = true;
    }
    async send(message, options) {
        checkMessageSize(message, this.stdio);
        if ("method" in message &&
            message.method === "initialize" &&
            "id" in message &&
            (typeof message.id === "string" || typeof message.id === "number")) {
            this.initializeRequestId = message.id;
        }
        await this.inner.send(message, options);
    }
    close() {
        return this.inner.close();
    }
}
function normalizeFailure(cause, state, signal, connectingStdio) {
    if (cause instanceof McpClientError)
        return cause;
    if (signal?.aborted)
        return clientError("CANCELLED", cause);
    if (cause instanceof UnauthorizedError) {
        return clientError("AUTHENTICATION_FAILED", cause);
    }
    if (state.failure !== undefined)
        return clientError(state.failure.code, cause);
    if (cause instanceof ClientBoundaryFailure)
        return clientError(cause.code, cause);
    if (cause instanceof McpError && cause.code === ErrorCode.RequestTimeout) {
        return clientError("TIMEOUT", cause);
    }
    if (state.closing)
        return clientError("CANCELLED", cause);
    if (connectingStdio && !state.connected)
        return clientError("SPAWN_FAILED", cause);
    if (cause instanceof McpError && cause.code === ErrorCode.ConnectionClosed) {
        return clientError("CONNECTION_FAILED", cause);
    }
    return clientError(state.connected ? "PROTOCOL_ERROR" : "CONNECTION_FAILED", cause);
}
function clearRecord(record) {
    for (const key of Object.keys(record))
        delete record[key];
}
function mapTool(value) {
    const tool = snapshotJsonRecord(value);
    if (typeof tool.name !== "string" ||
        tool.name.length === 0 ||
        typeof tool.inputSchema !== "object" ||
        tool.inputSchema === null ||
        Array.isArray(tool.inputSchema) ||
        (tool.title !== undefined && typeof tool.title !== "string") ||
        (tool.description !== undefined && typeof tool.description !== "string") ||
        (tool.outputSchema !== undefined &&
            (typeof tool.outputSchema !== "object" ||
                tool.outputSchema === null ||
                Array.isArray(tool.outputSchema))) ||
        (tool.annotations !== undefined &&
            (typeof tool.annotations !== "object" ||
                tool.annotations === null ||
                Array.isArray(tool.annotations)))) {
        throw new ClientBoundaryFailure("PROTOCOL_ERROR");
    }
    return {
        name: tool.name,
        ...(tool.title === undefined ? {} : { title: tool.title }),
        ...(tool.description === undefined
            ? {}
            : { description: tool.description }),
        inputSchema: tool.inputSchema,
        ...(tool.outputSchema === undefined
            ? {}
            : { outputSchema: tool.outputSchema }),
        ...(tool.annotations === undefined
            ? {}
            : { annotations: tool.annotations }),
    };
}
async function connectSnapshot(snapshot, signal, oauthProvider, onClose) {
    const state = { closing: false, connected: false };
    const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION }, { capabilities: {}, enforceStrictCapabilities: true });
    const inner = snapshot.transport === "stdio"
        ? new StdioClientTransport({
            command: snapshot.command,
            args: snapshot.args,
            env: snapshot.env,
            ...(snapshot.cwd === undefined ? {} : { cwd: snapshot.cwd }),
            stderr: "pipe",
            maxBufferSize: MAX_MESSAGE_BYTES,
        })
        : new StreamableHTTPClientTransport(snapshot.url, {
            fetch: oauthProvider === undefined
                ? createSecureFetch(snapshot.credentials)
                : createSecureOAuthFetch(snapshot.url, oauthProvider),
            ...(oauthProvider === undefined
                ? {}
                : { authProvider: oauthProvider }),
            reconnectionOptions: {
                initialReconnectionDelay: 1,
                maxReconnectionDelay: 1,
                reconnectionDelayGrowFactor: 1,
                maxRetries: 0,
            },
        });
    if (inner instanceof StdioClientTransport) {
        inner.stderr?.on("data", () => undefined);
    }
    const transport = new FacadeTransport(inner, snapshot.transport === "stdio", state);
    let closePromise;
    const close = () => {
        closePromise ??= (async () => {
            state.closing = true;
            try {
                await client.close();
            }
            catch (cause) {
                throw cause instanceof ClientBoundaryFailure
                    ? clientError(cause.code, cause)
                    : clientError("CONNECTION_FAILED", cause);
            }
            finally {
                clearRecord(snapshot.transport === "stdio" ? snapshot.env : snapshot.credentials);
                onClose?.();
            }
        })();
        return closePromise;
    };
    try {
        await client.connect(transport, signal === undefined ? undefined : { signal });
        oauthProvider?.throwIfTerminalFailure();
        const version = client.getServerVersion();
        const protocolVersion = transport.protocolVersion;
        const capabilities = snapshotJsonRecord(client.getServerCapabilities() ?? {});
        const instructions = client.getInstructions();
        if (version === undefined ||
            typeof version.name !== "string" ||
            typeof version.version !== "string" ||
            typeof protocolVersion !== "string" ||
            (instructions !== undefined && typeof instructions !== "string")) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        const server = {
            name: version.name,
            version: version.version,
            protocolVersion,
            ...(instructions === undefined ? {} : { instructions }),
            capabilities,
        };
        const runOperation = async (operationOptions, operation) => {
            const operationSignal = snapshotAbortSignal(operationOptions, "PROTOCOL_ERROR");
            if (state.closing)
                throw clientError("CANCELLED");
            try {
                const result = await operation(operationSignal);
                oauthProvider?.throwIfTerminalFailure();
                return result;
            }
            catch (cause) {
                const failure = normalizeFailure(oauthProvider?.getTerminalFailure() ?? cause, state, operationSignal, false);
                if (failure.code === "LIMIT_EXCEEDED" ||
                    failure.code === "AUTHENTICATION_FAILED") {
                    await close().catch(() => undefined);
                }
                throw failure;
            }
        };
        return {
            server,
            async listTools(cursor, operationOptions) {
                if (cursor !== undefined && typeof cursor !== "string") {
                    throw clientError("PROTOCOL_ERROR");
                }
                return runOperation(operationOptions, async (operationSignal) => {
                    const result = await client.listTools(cursor === undefined ? undefined : { cursor }, operationSignal === undefined
                        ? undefined
                        : { signal: operationSignal });
                    const tools = result.tools.map(mapTool);
                    if (result.nextCursor !== undefined &&
                        typeof result.nextCursor !== "string") {
                        throw new ClientBoundaryFailure("PROTOCOL_ERROR");
                    }
                    return {
                        tools,
                        ...(result.nextCursor === undefined
                            ? {}
                            : { nextCursor: result.nextCursor }),
                    };
                });
            },
            async callTool(name, argumentsValue, operationOptions) {
                if (typeof name !== "string" || name.length === 0) {
                    throw clientError("PROTOCOL_ERROR");
                }
                let argumentsSnapshot;
                try {
                    argumentsSnapshot =
                        argumentsValue === undefined
                            ? undefined
                            : snapshotJsonRecord(argumentsValue);
                }
                catch (cause) {
                    throw clientError("PROTOCOL_ERROR", cause);
                }
                return runOperation(operationOptions, async (operationSignal) => {
                    const result = await client.callTool({
                        name,
                        ...(argumentsSnapshot === undefined
                            ? {}
                            : { arguments: argumentsSnapshot }),
                    }, undefined, operationSignal === undefined
                        ? undefined
                        : { signal: operationSignal });
                    return { response: snapshotJsonRecord(result) };
                });
            },
            close,
        };
    }
    catch (cause) {
        const failure = normalizeFailure(oauthProvider?.getTerminalFailure() ?? cause, state, signal, snapshot.transport === "stdio");
        await close().catch(() => undefined);
        throw failure;
    }
}
export async function connectMcpClient(target, options) {
    const snapshot = snapshotTarget(target);
    const signal = snapshotAbortSignal(options, "INVALID_TARGET");
    return connectSnapshot(snapshot, signal);
}
async function awaitWithSignal(pending, signal, cancel) {
    if (signal === undefined)
        return pending;
    if (signal.aborted) {
        cancel();
        throw clientError("CANCELLED");
    }
    let rejectCancelled;
    const cancelled = new Promise((_resolve, reject) => {
        rejectCancelled = reject;
    });
    const onAbort = () => {
        cancel();
        rejectCancelled(clientError("CANCELLED"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
        return await Promise.race([pending, cancelled]);
    }
    finally {
        signal.removeEventListener("abort", onAbort);
    }
}
export async function beginMcpOAuthAuthorization(target, options) {
    const snapshot = snapshotOAuthTarget(target);
    const authorizationOptions = snapshotOAuthAuthorizationOptions(options);
    const lifecycleAbort = new AbortController();
    const abortLifecycle = () => {
        if (!lifecycleAbort.signal.aborted) {
            lifecycleAbort.abort(new ClientBoundaryFailure("CANCELLED"));
        }
    };
    const provider = new EphemeralOAuthProvider(authorizationOptions.redirectUrl, snapshot.url, lifecycleAbort.signal, authorizationOptions.state);
    const bootstrapState = {
        closing: false,
        connected: false,
    };
    const bootstrapClient = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION }, { capabilities: {}, enforceStrictCapabilities: true });
    const bootstrapInner = new StreamableHTTPClientTransport(snapshot.url, {
        authProvider: provider,
        fetch: createSecureOAuthFetch(snapshot.url, provider),
        reconnectionOptions: {
            initialReconnectionDelay: 1,
            maxReconnectionDelay: 1,
            reconnectionDelayGrowFactor: 1,
            maxRetries: 0,
        },
    });
    let bootstrapClosePromise;
    const closeBootstrap = () => {
        bootstrapClosePromise ??= bootstrapClient.close().catch(() => undefined);
        return bootstrapClosePromise;
    };
    try {
        await awaitWithSignal(bootstrapClient.connect(bootstrapInner, authorizationOptions.signal === undefined
            ? undefined
            : { signal: authorizationOptions.signal }), authorizationOptions.signal, () => {
            abortLifecycle();
            void closeBootstrap();
        });
        provider.throwIfTerminalFailure();
        await closeBootstrap();
        provider.clear();
        throw clientError("AUTHENTICATION_FAILED");
    }
    catch (cause) {
        const terminalFailure = provider.getTerminalFailure();
        if (!(cause instanceof UnauthorizedError) ||
            terminalFailure !== undefined) {
            await closeBootstrap();
            provider.clear();
            if (terminalFailure !== undefined) {
                throw clientError(terminalFailure.code, terminalFailure);
            }
            if (cause instanceof McpClientError)
                throw cause;
            throw normalizeFailure(cause, bootstrapState, authorizationOptions.signal, false);
        }
    }
    let authorizationUrl;
    try {
        provider.throwIfTerminalFailure();
        const captured = provider.takeAuthorizationUrl();
        if (captured === undefined) {
            throw new ClientBoundaryFailure("PROTOCOL_ERROR");
        }
        authorizationUrl = serializeAuthorizationUrl(captured, authorizationOptions.state, provider.trust);
    }
    catch (cause) {
        await closeBootstrap();
        provider.clear();
        if (cause instanceof ClientBoundaryFailure) {
            throw clientError(cause.code, cause);
        }
        throw clientError("PROTOCOL_ERROR", cause);
    }
    let consumed = false;
    let closed = false;
    let completedConnection;
    let finishPromise;
    let closePromise;
    const close = () => {
        closePromise ??= (async () => {
            closed = true;
            abortLifecycle();
            await Promise.allSettled([closeBootstrap(), finishPromise]);
            await completedConnection?.close().catch(() => undefined);
            provider.clear();
        })();
        return closePromise;
    };
    return Object.freeze({
        authorizationUrl,
        finish(authorizationCode, finishOptions) {
            if (closed || consumed) {
                return Promise.reject(clientError("AUTHENTICATION_FAILED"));
            }
            consumed = true;
            finishPromise = (async () => {
                try {
                    const code = snapshotAuthorizationCode(authorizationCode);
                    const signal = snapshotAbortSignal(finishOptions, "INVALID_TARGET");
                    await awaitWithSignal(bootstrapInner.finishAuth(code), signal, () => {
                        abortLifecycle();
                        void closeBootstrap();
                    });
                    provider.throwIfTerminalFailure();
                    await closeBootstrap();
                    if (!provider.hasTokens()) {
                        throw new ClientBoundaryFailure("AUTHENTICATION_FAILED");
                    }
                    const connection = await connectSnapshot(snapshot, signal, provider, () => provider.clear());
                    if (closed || lifecycleAbort.signal.aborted) {
                        await connection.close().catch(() => undefined);
                        throw new ClientBoundaryFailure("CANCELLED");
                    }
                    completedConnection = connection;
                    return connection;
                }
                catch (cause) {
                    abortLifecycle();
                    await Promise.allSettled([
                        closeBootstrap(),
                        completedConnection?.close(),
                    ]);
                    provider.clear();
                    if (cause instanceof McpClientError)
                        throw cause;
                    if (cause instanceof ClientBoundaryFailure) {
                        throw clientError(cause.code, cause);
                    }
                    throw clientError("AUTHENTICATION_FAILED", cause);
                }
            })();
            return finishPromise;
        },
        close,
    });
}
const INSPECTION_GET = {
    method: "GET",
    headers: { accept: "application/json" },
};
const INSPECTION_POST = {
    method: "POST",
    headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
    },
    body: JSON.stringify({
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
        },
    }),
};
function okStep(name, summary, detail) {
    return Object.freeze({
        name,
        outcome: "ok",
        summary,
        ...(detail === undefined ? {} : { detail }),
    });
}
function failedStep(name, summary, hint, detail) {
    return Object.freeze({
        name,
        outcome: "failed",
        summary,
        hint,
        ...(detail === undefined ? {} : { detail }),
    });
}
function skippedStep(name, summary) {
    return Object.freeze({ name, outcome: "skipped", summary });
}
async function tryInspectionRequest(context, url, init) {
    try {
        const response = await fetch(url, {
            ...init,
            redirect: "manual",
            ...(context.signal === undefined ? {} : { signal: context.signal }),
        });
        const body = await boundedResponseBody(response).text();
        return { response, status: response.status, body };
    }
    catch (cause) {
        if (context.signal?.aborted === true)
            throw clientError("CANCELLED", cause);
        return undefined;
    }
}
function parseInspectionDocument(body) {
    let value;
    try {
        value = JSON.parse(body);
    }
    catch {
        return undefined;
    }
    try {
        return snapshotJson(value);
    }
    catch {
        return undefined;
    }
}
async function inspectOAuthChallenge(context) {
    const result = await tryInspectionRequest(context, context.resourceUrl, INSPECTION_POST);
    if (result === undefined) {
        return {
            step: failedStep("challenge", `The MCP endpoint ${context.resourceUrl.href} could not be reached.`, "Confirm the URL, that the host resolves, and that the engine serves Streamable HTTP there."),
        };
    }
    if (result.status !== 401) {
        return {
            step: failedStep("challenge", `The MCP endpoint answered ${String(result.status)} instead of 401.`, "OAuth discovery starts from an unauthenticated 401. Serve the engine with required HTTP authentication so it challenges anonymous requests."),
        };
    }
    const advertised = extractResourceMetadataUrl(result.response);
    if (advertised === undefined) {
        return {
            step: okStep("challenge", "The MCP endpoint answered 401 without a resource_metadata challenge parameter."),
        };
    }
    if (!context.trust.allowsResourceMetadata(advertised)) {
        return {
            step: failedStep("challenge", `The 401 challenge advertised resource metadata at ${advertised.href}.`, `RFC 9728 derives that URL from the resource identifier, so it must use ${context.resourceUrl.origin} over HTTPS or loopback HTTP.`),
        };
    }
    return {
        step: okStep("challenge", `The MCP endpoint answered 401 and advertised resource metadata at ${advertised.href}.`),
        resourceMetadataUrl: advertised,
    };
}
async function inspectOAuthResourceMetadata(context, advertised) {
    const { pathAware, root } = resourceMetadataUrls(context.resourceUrl);
    let url = advertised ?? pathAware;
    let result = await tryInspectionRequest(context, url, INSPECTION_GET);
    if (result?.status === 404 &&
        advertised === undefined &&
        pathAware.href !== root.href) {
        url = root;
        result = await tryInspectionRequest(context, url, INSPECTION_GET);
    }
    if (result === undefined) {
        return {
            step: failedStep("resource-metadata", `The protected resource metadata at ${url.href} could not be read.`, "Confirm the URL is reachable, answers without a redirect, and stays within the 10 MiB response boundary."),
        };
    }
    if (result.status !== 200) {
        return {
            step: failedStep("resource-metadata", `The protected resource metadata at ${url.href} answered ${String(result.status)}.`, `Publish the RFC 9728 document at ${pathAware.href}; serveMcpHttp publishes it when auth.resourceMetadata is configured.`),
        };
    }
    const document = parseInspectionDocument(result.body);
    if (document === undefined) {
        return {
            step: failedStep("resource-metadata", `The protected resource metadata at ${url.href} is not a JSON document.`, "Serve the RFC 9728 document as application/json with a finite JSON body."),
        };
    }
    const parsed = OAuthProtectedResourceMetadataSchema.safeParse(document);
    if (!parsed.success) {
        return {
            step: failedStep("resource-metadata", `The protected resource metadata at ${url.href} does not match RFC 9728.`, "The document needs a resource identifier and an authorization_servers array of absolute URLs.", document),
        };
    }
    if (parsed.data.resource !== context.resourceUrl.href) {
        return {
            step: failedStep("resource-metadata", `The protected resource metadata declares the resource ${parsed.data.resource}.`, `It must be exactly ${context.resourceUrl.href}.`, document),
        };
    }
    const advertisedServers = [];
    for (const entry of parsed.data.authorization_servers ?? []) {
        let authorizationServer;
        try {
            authorizationServer = new URL(entry);
        }
        catch {
            authorizationServer = undefined;
        }
        if (authorizationServer === undefined ||
            !context.trust.allowsAdvertisedServer(authorizationServer)) {
            return {
                step: failedStep("resource-metadata", `The protected resource metadata advertises the authorization server ${entry}.`, "An advertised authorization server must be an absolute HTTPS URL with no credentials and no fragment; loopback HTTP is accepted only when the MCP resource is itself loopback HTTP.", document),
            };
        }
        advertisedServers.push(authorizationServer);
    }
    const [authorizationServer] = parsed.data.authorization_servers ?? [];
    if (authorizationServer === undefined) {
        return {
            step: failedStep("resource-metadata", `The protected resource metadata at ${url.href} advertises no authorization server.`, "Add an authorization_servers array naming the issuer that mints tokens for this resource.", document),
        };
    }
    for (const server of advertisedServers) {
        context.trust.trustAdvertisedServer(server);
    }
    return {
        step: okStep("resource-metadata", `The protected resource metadata at ${url.href} names ${authorizationServer} as its first authorization server.`, document),
        authorizationServer,
    };
}
async function inspectOAuthServerMetadata(context, authorizationServer) {
    const candidates = buildDiscoveryUrls(authorizationServer);
    let url = candidates[0]?.url ?? context.resourceUrl;
    let result;
    for (const candidate of candidates) {
        const attempt = await tryInspectionRequest(context, candidate.url, INSPECTION_GET);
        // An unreachable later candidate must not erase an earlier answer, so a
        // failed attempt keeps the last response — and the URL that produced it.
        if (attempt !== undefined) {
            result = attempt;
            url = candidate.url;
        }
        if (attempt !== undefined && attempt.status !== 404)
            break;
    }
    if (result === undefined) {
        return {
            step: failedStep("authorization-server-metadata", `The authorization server metadata at ${url.href} could not be read.`, "Confirm the authorization server resolves, answers without a redirect, and stays within the 10 MiB response boundary."),
        };
    }
    if (result.status !== 200) {
        return {
            step: failedStep("authorization-server-metadata", `The authorization server metadata at ${url.href} answered ${String(result.status)}.`, `Publish the RFC 8414 document for ${authorizationServer}, or advertise the issuer that publishes it.`),
        };
    }
    const document = parseInspectionDocument(result.body);
    if (document === undefined) {
        return {
            step: failedStep("authorization-server-metadata", `The authorization server metadata at ${url.href} is not a JSON document.`, "Serve the RFC 8414 document as application/json with a finite JSON body."),
        };
    }
    const parsed = OAuthMetadataSchema.safeParse(document);
    if (!parsed.success) {
        return {
            step: failedStep("authorization-server-metadata", `The authorization server metadata at ${url.href} does not match RFC 8414.`, "The document needs issuer, authorization_endpoint, token_endpoint, and response_types_supported.", document),
        };
    }
    if (parsed.data.issuer !== authorizationServer) {
        return {
            step: failedStep("authorization-server-metadata", `The authorization server metadata declares the issuer ${parsed.data.issuer}.`, `It must exactly match the advertised authorization server ${authorizationServer}, including any trailing slash.`, document),
        };
    }
    for (const [name, endpoint] of [
        ["authorization_endpoint", parsed.data.authorization_endpoint],
        ["token_endpoint", parsed.data.token_endpoint],
    ]) {
        let endpointUrl;
        try {
            endpointUrl = new URL(endpoint);
        }
        catch {
            endpointUrl = undefined;
        }
        if (endpointUrl === undefined ||
            !context.trust.allowsDelegatedEndpoint(endpointUrl)) {
            return {
                step: failedStep("authorization-server-metadata", `The authorization server metadata places ${name} at ${endpoint}.`, "Every OAuth endpoint must be an absolute HTTPS URL — or loopback HTTP behind a loopback resource — with no credentials and no fragment.", document),
            };
        }
        context.trust.trustAdvertisedServer(endpointUrl);
    }
    if (!parsed.data.response_types_supported.includes("code")) {
        return {
            step: failedStep("authorization-server-metadata", "The authorization server does not support the code response type.", "Authorization Code with PKCE is the only grant this client performs.", document),
        };
    }
    // `senda-deploy inspect-oauth` rejects both of these, so accepting them
    // here would make the two inspectors disagree about the same endpoint.
    const grantTypes = parsed.data.grant_types_supported;
    if (grantTypes === undefined || !grantTypes.includes("authorization_code")) {
        return {
            step: failedStep("authorization-server-metadata", "The authorization server does not advertise the authorization_code grant type.", "Advertise grant_types_supported including authorization_code; it is the only grant this client performs.", document),
        };
    }
    const challengeMethods = parsed.data.code_challenge_methods_supported;
    if (challengeMethods === undefined || !challengeMethods.includes("S256")) {
        return {
            step: failedStep("authorization-server-metadata", "The authorization server does not advertise the S256 code challenge method.", "This client always sends a PKCE challenge with S256, so advertise code_challenge_methods_supported including S256.", document),
        };
    }
    return {
        step: okStep("authorization-server-metadata", `The authorization server published RFC 8414 metadata at ${url.href}.`, document),
        ...(parsed.data.registration_endpoint === undefined
            ? {}
            : { registrationEndpoint: parsed.data.registration_endpoint }),
    };
}
function inspectOAuthRegistration(context, registrationEndpoint) {
    if (registrationEndpoint === undefined) {
        return failedStep("registration", "The authorization server metadata does not advertise registration_endpoint.", "This client holds no client ID and registers a public client for each attempt, so the authorization server must support RFC 7591 dynamic client registration.");
    }
    let url;
    try {
        url = new URL(registrationEndpoint);
    }
    catch {
        url = undefined;
    }
    if (url === undefined || !context.trust.allowsDelegatedEndpoint(url)) {
        return failedStep("registration", `The authorization server advertises dynamic client registration at ${registrationEndpoint}.`, "The registration endpoint must be an absolute HTTPS URL — or loopback HTTP behind a loopback resource — with no credentials and no fragment.");
    }
    return okStep("registration", `The authorization server advertises dynamic client registration at ${url.href}.`);
}
export async function inspectMcpOAuth(target, options) {
    const snapshot = snapshotOAuthTarget(target);
    const context = {
        resourceUrl: snapshot.url,
        trust: new OAuthEndpointTrust(snapshot.url),
        signal: snapshotAbortSignal(options, "INVALID_TARGET"),
    };
    const challenge = await inspectOAuthChallenge(context);
    const steps = [challenge.step];
    const resourceMetadata = await inspectOAuthResourceMetadata(context, challenge.resourceMetadataUrl);
    steps.push(resourceMetadata.step);
    if (resourceMetadata.authorizationServer === undefined) {
        steps.push(skippedStep("authorization-server-metadata", "Skipped because the protected resource metadata did not name an authorization server."), skippedStep("registration", "Skipped because the authorization server metadata was not read."));
        return Object.freeze({ steps: Object.freeze(steps), ready: false });
    }
    const serverMetadata = await inspectOAuthServerMetadata(context, resourceMetadata.authorizationServer);
    steps.push(serverMetadata.step);
    if (serverMetadata.step.outcome !== "ok") {
        steps.push(skippedStep("registration", "Skipped because the authorization server metadata was not read."));
        return Object.freeze({ steps: Object.freeze(steps), ready: false });
    }
    steps.push(inspectOAuthRegistration(context, serverMetadata.registrationEndpoint));
    return Object.freeze({
        steps: Object.freeze(steps),
        ready: steps.every((step) => step.outcome === "ok"),
    });
}
//# sourceMappingURL=client.js.map