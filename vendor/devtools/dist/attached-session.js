import { timingSafeEqual } from "node:crypto";
import { types as nodeTypes } from "node:util";
import { beginMcpOAuthAuthorization, connectMcpClient, } from "@senda/mcp";
export const ATTACHED_SESSION_LIMITS = Object.freeze({
    initializationTimeoutMs: 15_000,
    catalogTimeoutMs: 15_000,
    callTimeoutMs: 60_000,
    catalogBytes: 10 * 1024 * 1024,
    catalogPages: 100,
    catalogTools: 2_000,
    activityRecords: 500,
    retainedActivityRecords: 50,
    oauthAuthorizationTimeoutMs: 300_000,
});
const errorMessages = {
    INVALID_TARGET: "The MCP target descriptor is invalid.",
    SPAWN_FAILED: "The MCP server process could not be started.",
    CONNECTION_FAILED: "The MCP connection failed.",
    AUTHENTICATION_FAILED: "The MCP target rejected the supplied credentials.",
    PROTOCOL_ERROR: "The MCP peer returned an invalid protocol response.",
    TIMEOUT: "The MCP operation timed out.",
    LIMIT_EXCEEDED: "The MCP operation exceeded a configured limit.",
    CANCELLED: "The MCP operation was cancelled.",
    TARGET_BUSY: "Another target or tool operation is already active.",
    NOT_CONNECTED: "No MCP target is connected.",
    ENVIRONMENT_VALUE_MISSING: "A required environment value is missing.",
};
const attachedErrorCodes = new Set(Object.keys(errorMessages));
/** A stack-free serialization boundary for attached workbench failures. */
export class AttachedSessionError extends Error {
    constructor(code, options) {
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
                value: errorMessages[code],
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
const deadlineReason = Object.freeze({ type: "attached-deadline" });
const disconnectReason = Object.freeze({ type: "attached-disconnect" });
const maxActivityToolNameCodePoints = 256;
const defaultClock = {
    now: () => Date.now(),
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
    cancel: (handle) => clearTimeout(handle),
};
function createActivityStore() {
    const records = [];
    let nextSequence = 0;
    return {
        append: (record) => {
            nextSequence += 1;
            const stored = Object.freeze({ sequence: nextSequence, ...record });
            records.push(stored);
            if (records.length > ATTACHED_SESSION_LIMITS.activityRecords) {
                records.shift();
            }
            return stored;
        },
        entries: () => Object.freeze([...records]),
        clear: () => {
            records.length = 0;
        },
    };
}
function attachedError(code, cause) {
    return new AttachedSessionError(code, cause === undefined ? undefined : { cause });
}
/**
 * Reduces a transient operational error to the only fields retained while the
 * workbench is idle. In particular, the upstream cause is never retained.
 */
export function retainValidationFailure(owner, failure) {
    return Object.freeze({
        owner,
        code: failure.code,
        message: failure.message,
    });
}
function ownDataProperty(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor))
        return undefined;
    return descriptor.value;
}
function normalizeFailure(cause, fallback, signal) {
    if (cause instanceof AttachedSessionError)
        return cause;
    if (signal?.aborted === true) {
        return attachedError(signal.reason === deadlineReason ? "TIMEOUT" : "CANCELLED", cause);
    }
    if (typeof cause === "object" &&
        cause !== null &&
        !nodeTypes.isProxy(cause)) {
        const code = ownDataProperty(cause, "code");
        if (typeof code === "string" && attachedErrorCodes.has(code)) {
            return attachedError(code, cause);
        }
    }
    return attachedError(fallback, cause);
}
function duration(clock, started) {
    return Math.max(0, clock.now() - started);
}
function startedAt(started) {
    try {
        return new Date(started).toISOString();
    }
    catch {
        return new Date(0).toISOString();
    }
}
function appendActivity(slot, clock, operation, started, outcome, options = {}) {
    const errorCode = options.errorCode;
    const toolName = options.toolName;
    slot.activity.append({
        operation,
        startedAt: startedAt(started),
        durationMs: duration(clock, started),
        outcome,
        ...(errorCode === undefined ? {} : { errorCode }),
        ...(toolName === undefined ? {} : { toolName }),
    });
}
function targetTransport(target) {
    if (typeof target !== "object" ||
        target === null ||
        nodeTypes.isProxy(target) ||
        Array.isArray(target)) {
        throw attachedError("INVALID_TARGET");
    }
    const transport = ownDataProperty(target, "transport");
    if (transport !== "stdio" && transport !== "http") {
        throw attachedError("INVALID_TARGET");
    }
    return transport;
}
function hasInheritedToJson(prototype) {
    let current = prototype;
    while (current !== null) {
        const descriptor = Object.getOwnPropertyDescriptor(current, "toJSON");
        if (descriptor !== undefined) {
            return !("value" in descriptor) || typeof descriptor.value === "function";
        }
        current = Object.getPrototypeOf(current);
    }
    return false;
}
function cloneLosslessJson(value, ancestors = new Set()) {
    if (value === null ||
        typeof value === "string" ||
        typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value) || Object.is(value, -0)) {
            throw attachedError("PROTOCOL_ERROR");
        }
        return value;
    }
    if (typeof value !== "object" ||
        nodeTypes.isProxy(value) ||
        ancestors.has(value)) {
        throw attachedError("PROTOCOL_ERROR");
    }
    const isArray = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (isArray
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null) {
        throw attachedError("PROTOCOL_ERROR");
    }
    if (Object.getOwnPropertySymbols(value).length > 0 ||
        hasInheritedToJson(prototype)) {
        throw attachedError("PROTOCOL_ERROR");
    }
    const keys = Object.keys(value);
    const propertyNames = Object.getOwnPropertyNames(value);
    if (isArray) {
        if (keys.length !== value.length ||
            propertyNames.length !== keys.length + 1 ||
            !propertyNames.includes("length")) {
            throw attachedError("PROTOCOL_ERROR");
        }
        for (let index = 0; index < keys.length; index += 1) {
            if (keys[index] !== String(index))
                throw attachedError("PROTOCOL_ERROR");
        }
    }
    else if (propertyNames.length !== keys.length) {
        throw attachedError("PROTOCOL_ERROR");
    }
    ancestors.add(value);
    try {
        if (isArray) {
            const clone = [];
            for (const key of keys) {
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if (descriptor === undefined || !("value" in descriptor)) {
                    throw attachedError("PROTOCOL_ERROR");
                }
                clone.push(cloneLosslessJson(descriptor.value, ancestors));
            }
            return Object.freeze(clone);
        }
        const clone = {};
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (descriptor === undefined || !("value" in descriptor)) {
                throw attachedError("PROTOCOL_ERROR");
            }
            Object.defineProperty(clone, key, {
                configurable: true,
                enumerable: true,
                value: cloneLosslessJson(descriptor.value, ancestors),
                writable: true,
            });
        }
        return Object.freeze(clone);
    }
    finally {
        ancestors.delete(value);
    }
}
function isJsonRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function snapshotServerInfo(value) {
    const snapshot = cloneLosslessJson(value);
    if (!isJsonRecord(snapshot) ||
        typeof snapshot.name !== "string" ||
        typeof snapshot.version !== "string" ||
        typeof snapshot.protocolVersion !== "string" ||
        !isJsonRecord(snapshot.capabilities) ||
        (snapshot.instructions !== undefined &&
            typeof snapshot.instructions !== "string")) {
        throw attachedError("PROTOCOL_ERROR");
    }
    return snapshot;
}
function snapshotToolPage(value) {
    const snapshot = cloneLosslessJson(value);
    if (!isJsonRecord(snapshot) ||
        !Array.isArray(snapshot.tools) ||
        (snapshot.nextCursor !== undefined &&
            typeof snapshot.nextCursor !== "string")) {
        throw attachedError("PROTOCOL_ERROR");
    }
    for (const candidate of snapshot.tools) {
        if (!isJsonRecord(candidate) ||
            typeof candidate.name !== "string" ||
            candidate.name.length === 0 ||
            !isJsonRecord(candidate.inputSchema) ||
            (candidate.title !== undefined && typeof candidate.title !== "string") ||
            (candidate.description !== undefined &&
                typeof candidate.description !== "string") ||
            (candidate.outputSchema !== undefined &&
                !isJsonRecord(candidate.outputSchema)) ||
            (candidate.annotations !== undefined &&
                !isJsonRecord(candidate.annotations))) {
            throw attachedError("PROTOCOL_ERROR");
        }
    }
    return snapshot;
}
function snapshotArguments(value) {
    const snapshot = cloneLosslessJson(value);
    if (!isJsonRecord(snapshot))
        throw attachedError("PROTOCOL_ERROR");
    return snapshot;
}
function snapshotToolResult(value) {
    const snapshot = cloneLosslessJson(value);
    if (!isJsonRecord(snapshot) || !isJsonRecord(snapshot.response)) {
        throw attachedError("PROTOCOL_ERROR");
    }
    return snapshot;
}
function boundedToolName(name) {
    return Array.from(name).slice(0, maxActivityToolNameCodePoints).join("");
}
function runWithDeadline(clock, timeoutMs, controller, operation, onLateValue) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let handle;
        const cleanup = () => {
            clock.cancel(handle);
            controller.signal.removeEventListener("abort", onAbort);
        };
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        };
        const onAbort = () => {
            fail(attachedError(controller.signal.reason === deadlineReason ? "TIMEOUT" : "CANCELLED"));
        };
        controller.signal.addEventListener("abort", onAbort, { once: true });
        handle = clock.schedule(() => {
            if (settled)
                return;
            const timeout = attachedError("TIMEOUT");
            settled = true;
            cleanup();
            controller.abort(deadlineReason);
            reject(timeout);
        }, timeoutMs);
        let pending;
        try {
            pending = operation(controller.signal);
        }
        catch (cause) {
            fail(normalizeFailure(cause, "CONNECTION_FAILED", controller.signal));
            return;
        }
        void pending.then((value) => {
            if (settled) {
                try {
                    onLateValue?.(value);
                }
                catch {
                    // Late cleanup is best-effort after the bounded operation settled.
                }
                return;
            }
            settled = true;
            cleanup();
            resolve(value);
        }, (cause) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(cause);
        });
    });
}
function closeLateConnection(connection) {
    void connection.close().catch(() => undefined);
}
function closeLateAuthorization(authorization) {
    void authorization.close().catch(() => undefined);
}
function equalOAuthState(actual, expected) {
    const actualBytes = Buffer.from(actual, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");
    return (actualBytes.length === expectedBytes.length &&
        timingSafeEqual(actualBytes, expectedBytes));
}
export function createAttachedSessionController(options = {}) {
    const connectClient = options.connectClient ?? connectMcpClient;
    const beginOAuthAuthorization = options.beginOAuthAuthorization ?? beginMcpOAuthAuthorization;
    const clock = options.clock ?? defaultClock;
    let active;
    let lastValidationFailure;
    let retainedActivity;
    const closeClientOnce = (slot) => {
        slot.closeClientPromise ??= (async () => {
            const connection = slot.connection;
            const authorization = slot.oauthAuthorization;
            slot.connection = undefined;
            slot.oauthAuthorization = undefined;
            const results = await Promise.allSettled([
                connection?.close() ?? Promise.resolve(),
                authorization?.close() ?? Promise.resolve(),
            ]);
            const failure = results.find((result) => result.status === "rejected");
            if (failure !== undefined)
                throw failure.reason;
        })();
        return slot.closeClientPromise;
    };
    const clearSlot = (slot) => {
        if (slot.oauthExpiry !== undefined)
            clock.cancel(slot.oauthExpiry);
        // The newest records survive the slot so the idle state can still show
        // what happened before a disconnect or a failure.
        const records = slot.activity
            .entries()
            .slice(-ATTACHED_SESSION_LIMITS.retainedActivityRecords);
        retainedActivity =
            records.length === 0 ? undefined : { owner: slot.owner, records };
        slot.catalog = Object.freeze([]);
        slot.toolNames = new Set();
        slot.connectionSummary = undefined;
        slot.activity.clear();
        slot.operationAbort = undefined;
        slot.callAbort = undefined;
        slot.callActive = false;
        slot.oauthState = undefined;
        slot.oauthExpiry = undefined;
        if (active === slot)
            active = undefined;
    };
    const beginClose = (slot) => {
        if (slot.closingPromise !== undefined)
            return slot.closingPromise;
        slot.state = "closing";
        slot.operationAbort?.abort(disconnectReason);
        slot.callAbort?.abort(disconnectReason);
        const started = clock.now();
        slot.closingPromise = (async () => {
            let failure;
            try {
                await closeClientOnce(slot);
                appendActivity(slot, clock, "disconnect", started, "success");
            }
            catch (cause) {
                failure = normalizeFailure(cause, "CONNECTION_FAILED");
                appendActivity(slot, clock, "disconnect", started, "error", {
                    errorCode: failure.code,
                });
            }
            finally {
                clearSlot(slot);
                lastValidationFailure = undefined;
            }
            if (failure !== undefined)
                throw failure;
        })();
        return slot.closingPromise;
    };
    const collectCatalog = async (slot, signal) => {
        const connection = slot.connection;
        if (connection === undefined)
            throw attachedError("NOT_CONNECTED");
        const tools = [];
        const names = new Set();
        const cursors = new Set();
        let pageCount = 0;
        let cursor;
        let catalogBytes = 2;
        while (true) {
            if (pageCount >= ATTACHED_SESSION_LIMITS.catalogPages) {
                throw attachedError("LIMIT_EXCEEDED");
            }
            const listStarted = clock.now();
            let page;
            try {
                page = snapshotToolPage(await connection.listTools(cursor, { signal }));
                appendActivity(slot, clock, "tools/list", listStarted, "success");
            }
            catch (cause) {
                const failure = normalizeFailure(cause, "PROTOCOL_ERROR", signal);
                appendActivity(slot, clock, "tools/list", listStarted, "error", {
                    errorCode: failure.code,
                });
                throw failure;
            }
            pageCount += 1;
            if (tools.length + page.tools.length >
                ATTACHED_SESSION_LIMITS.catalogTools) {
                throw attachedError("LIMIT_EXCEEDED");
            }
            for (const candidate of page.tools) {
                if (names.has(candidate.name))
                    throw attachedError("PROTOCOL_ERROR");
                const encoded = JSON.stringify(candidate);
                const candidateBytes = Buffer.byteLength(encoded);
                const separatorBytes = tools.length === 0 ? 0 : 1;
                if (catalogBytes + separatorBytes + candidateBytes >
                    ATTACHED_SESSION_LIMITS.catalogBytes) {
                    throw attachedError("LIMIT_EXCEEDED");
                }
                catalogBytes += separatorBytes + candidateBytes;
                names.add(candidate.name);
                tools.push(candidate);
            }
            if (page.nextCursor === undefined)
                break;
            if (cursors.has(page.nextCursor)) {
                throw attachedError("PROTOCOL_ERROR");
            }
            cursors.add(page.nextCursor);
            cursor = page.nextCursor;
        }
        slot.toolNames = names;
        return { tools: Object.freeze(tools), pageCount };
    };
    const failConnection = async (slot, failure) => {
        try {
            await closeClientOnce(slot);
        }
        catch {
            // The original bounded validation failure remains the public result.
        }
        if (active === slot && slot.state !== "closing") {
            clearSlot(slot);
            lastValidationFailure = retainValidationFailure(slot.owner, failure);
        }
    };
    const beginOAuth = async (owner, target, oauthOptions) => {
        if (active !== undefined)
            throw attachedError("TARGET_BUSY");
        if (targetTransport(target) !== "http") {
            throw attachedError("INVALID_TARGET");
        }
        lastValidationFailure = undefined;
        retainedActivity = undefined;
        const slot = {
            owner,
            transport: "http",
            activity: createActivityStore(),
            state: "connecting",
            connection: undefined,
            oauthAuthorization: undefined,
            oauthState: undefined,
            oauthExpiry: undefined,
            connectionSummary: undefined,
            catalog: Object.freeze([]),
            toolNames: new Set(),
            operationAbort: undefined,
            callAbort: undefined,
            callActive: false,
        };
        active = slot;
        const controller = new AbortController();
        slot.operationAbort = controller;
        try {
            const authorization = await runWithDeadline(clock, ATTACHED_SESSION_LIMITS.initializationTimeoutMs, controller, (signal) => beginOAuthAuthorization(target, { ...oauthOptions, signal }), closeLateAuthorization);
            if (active !== slot || slot.state !== "connecting") {
                closeLateAuthorization(authorization);
                throw attachedError("CANCELLED");
            }
            slot.oauthAuthorization = authorization;
            slot.oauthState = oauthOptions.state;
            slot.operationAbort = undefined;
            slot.state = "authorizing";
            slot.oauthExpiry = clock.schedule(() => {
                if (active !== slot || slot.state !== "authorizing")
                    return;
                const failure = attachedError("TIMEOUT");
                slot.state = "closing";
                slot.oauthState = undefined;
                void closeClientOnce(slot)
                    .catch(() => undefined)
                    .finally(() => {
                    clearSlot(slot);
                    lastValidationFailure = retainValidationFailure(owner, failure);
                });
            }, ATTACHED_SESSION_LIMITS.oauthAuthorizationTimeoutMs);
            return Object.freeze({
                authorizationUrl: authorization.authorizationUrl,
            });
        }
        catch (cause) {
            const failure = normalizeFailure(cause, "AUTHENTICATION_FAILED", controller.signal);
            await failConnection(slot, failure);
            throw failure;
        }
    };
    const completeOAuth = async (state, authorizationCode) => {
        const slot = active;
        if (slot === undefined || slot.state !== "authorizing") {
            throw attachedError("NOT_CONNECTED");
        }
        if (typeof state !== "string" ||
            slot.oauthState === undefined ||
            !equalOAuthState(state, slot.oauthState)) {
            throw attachedError("AUTHENTICATION_FAILED");
        }
        const authorization = slot.oauthAuthorization;
        if (authorization === undefined)
            throw attachedError("NOT_CONNECTED");
        slot.oauthState = undefined;
        if (slot.oauthExpiry !== undefined)
            clock.cancel(slot.oauthExpiry);
        slot.oauthExpiry = undefined;
        const initializeStarted = clock.now();
        const initializeAbort = new AbortController();
        slot.operationAbort = initializeAbort;
        let initializeRecorded = false;
        try {
            const connection = await runWithDeadline(clock, ATTACHED_SESSION_LIMITS.initializationTimeoutMs, initializeAbort, (signal) => authorization.finish(authorizationCode, { signal }), closeLateConnection);
            if (active !== slot || slot.state !== "authorizing") {
                closeLateConnection(connection);
                throw attachedError("CANCELLED");
            }
            slot.connection = connection;
            const serverInfo = snapshotServerInfo(connection.server);
            appendActivity(slot, clock, "initialize", initializeStarted, "success");
            initializeRecorded = true;
            const catalogAbort = new AbortController();
            slot.operationAbort = catalogAbort;
            const catalog = await runWithDeadline(clock, ATTACHED_SESSION_LIMITS.catalogTimeoutMs, catalogAbort, (signal) => collectCatalog(slot, signal));
            if (active !== slot || slot.state !== "authorizing") {
                throw attachedError("CANCELLED");
            }
            slot.operationAbort = undefined;
            slot.catalog = catalog.tools;
            const summary = Object.freeze({
                transport: "http",
                server: Object.freeze({
                    name: serverInfo.name,
                    version: serverInfo.version,
                    protocolVersion: serverInfo.protocolVersion,
                }),
                validation: Object.freeze({ status: "ok" }),
                pageCount: catalog.pageCount,
                toolCount: catalog.tools.length,
            });
            slot.connectionSummary = summary;
            slot.state = "connected";
            return summary;
        }
        catch (cause) {
            const failure = normalizeFailure(cause, slot.connection === undefined
                ? "AUTHENTICATION_FAILED"
                : "PROTOCOL_ERROR", slot.operationAbort?.signal);
            if (!initializeRecorded) {
                appendActivity(slot, clock, "initialize", initializeStarted, "error", {
                    errorCode: failure.code,
                });
            }
            await failConnection(slot, failure);
            throw failure;
        }
    };
    const rejectOAuth = async (state) => {
        const slot = active;
        if (slot === undefined || slot.state !== "authorizing") {
            throw attachedError("NOT_CONNECTED");
        }
        if (typeof state !== "string" ||
            slot.oauthState === undefined ||
            !equalOAuthState(state, slot.oauthState)) {
            throw attachedError("AUTHENTICATION_FAILED");
        }
        const failure = attachedError("AUTHENTICATION_FAILED");
        slot.oauthState = undefined;
        if (slot.oauthExpiry !== undefined)
            clock.cancel(slot.oauthExpiry);
        slot.oauthExpiry = undefined;
        slot.state = "closing";
        try {
            await closeClientOnce(slot);
        }
        catch {
            // The provider rejection remains the public result.
        }
        clearSlot(slot);
        lastValidationFailure = retainValidationFailure(slot.owner, failure);
    };
    const connect = async (owner, target) => {
        if (active !== undefined)
            throw attachedError("TARGET_BUSY");
        const transport = targetTransport(target);
        lastValidationFailure = undefined;
        retainedActivity = undefined;
        const slot = {
            owner,
            transport,
            activity: createActivityStore(),
            state: "connecting",
            connection: undefined,
            oauthAuthorization: undefined,
            oauthState: undefined,
            oauthExpiry: undefined,
            connectionSummary: undefined,
            catalog: Object.freeze([]),
            toolNames: new Set(),
            operationAbort: undefined,
            callAbort: undefined,
            callActive: false,
        };
        active = slot;
        const initializeStarted = clock.now();
        const initializeAbort = new AbortController();
        slot.operationAbort = initializeAbort;
        let initializeRecorded = false;
        let connection;
        try {
            connection = await runWithDeadline(clock, ATTACHED_SESSION_LIMITS.initializationTimeoutMs, initializeAbort, (signal) => connectClient(target, {
                signal,
            }), closeLateConnection);
            if (active !== slot || slot.state !== "connecting") {
                closeLateConnection(connection);
                throw attachedError("CANCELLED");
            }
            slot.connection = connection;
            const serverInfo = snapshotServerInfo(connection.server);
            appendActivity(slot, clock, "initialize", initializeStarted, "success");
            initializeRecorded = true;
            const catalogAbort = new AbortController();
            slot.operationAbort = catalogAbort;
            const catalog = await runWithDeadline(clock, ATTACHED_SESSION_LIMITS.catalogTimeoutMs, catalogAbort, (signal) => collectCatalog(slot, signal));
            if (active !== slot || slot.state !== "connecting") {
                throw attachedError("CANCELLED");
            }
            slot.operationAbort = undefined;
            slot.catalog = catalog.tools;
            const summary = Object.freeze({
                transport,
                server: Object.freeze({
                    name: serverInfo.name,
                    version: serverInfo.version,
                    protocolVersion: serverInfo.protocolVersion,
                }),
                validation: Object.freeze({ status: "ok" }),
                pageCount: catalog.pageCount,
                toolCount: catalog.tools.length,
            });
            slot.connectionSummary = summary;
            slot.state = "connected";
            return summary;
        }
        catch (cause) {
            const failure = normalizeFailure(cause, slot.connection === undefined ? "CONNECTION_FAILED" : "PROTOCOL_ERROR", slot.operationAbort?.signal);
            if (!initializeRecorded) {
                appendActivity(slot, clock, "initialize", initializeStarted, "error", {
                    errorCode: failure.code,
                });
            }
            await failConnection(slot, failure);
            throw failure;
        }
    };
    const ownedConnectedSlot = (owner) => {
        const slot = active;
        if (slot === undefined)
            throw attachedError("NOT_CONNECTED");
        if (slot.owner !== owner)
            throw attachedError("TARGET_BUSY");
        if (slot.state !== "connected")
            throw attachedError("NOT_CONNECTED");
        return slot;
    };
    const call = async (owner, name, argumentsValue) => {
        const slot = ownedConnectedSlot(owner);
        if (slot.callActive)
            throw attachedError("TARGET_BUSY");
        if (typeof name !== "string" || !slot.toolNames.has(name)) {
            throw attachedError("PROTOCOL_ERROR");
        }
        const argumentsSnapshot = snapshotArguments(argumentsValue);
        const connection = slot.connection;
        if (connection === undefined)
            throw attachedError("NOT_CONNECTED");
        slot.callActive = true;
        const controller = new AbortController();
        slot.callAbort = controller;
        const callStarted = clock.now();
        const activityToolName = boundedToolName(name);
        try {
            const result = await runWithDeadline(clock, ATTACHED_SESSION_LIMITS.callTimeoutMs, controller, (signal) => connection.callTool(name, argumentsSnapshot, {
                signal,
            }));
            if (active !== slot || slot.state !== "connected") {
                throw attachedError("CANCELLED");
            }
            const snapshot = snapshotToolResult(result);
            appendActivity(slot, clock, "tools/call", callStarted, "success", {
                toolName: activityToolName,
            });
            return snapshot;
        }
        catch (cause) {
            const failure = normalizeFailure(cause, "CONNECTION_FAILED", controller.signal);
            appendActivity(slot, clock, "tools/call", callStarted, "error", {
                errorCode: failure.code,
                toolName: activityToolName,
            });
            if (active === slot && slot.state === "connected") {
                slot.state = "closing";
                try {
                    await closeClientOnce(slot);
                }
                catch {
                    // The call failure remains the public result.
                }
                clearSlot(slot);
            }
            throw failure;
        }
        finally {
            slot.callActive = false;
            slot.callAbort = undefined;
        }
    };
    return {
        connect,
        beginOAuth,
        completeOAuth,
        rejectOAuth,
        state: (owner) => {
            const slot = active;
            if (slot === undefined) {
                const validation = lastValidationFailure?.owner === owner
                    ? Object.freeze({
                        status: "error",
                        error: Object.freeze({
                            code: lastValidationFailure.code,
                            message: lastValidationFailure.message,
                        }),
                    })
                    : undefined;
                const activity = retainedActivity?.owner === owner
                    ? retainedActivity.records
                    : undefined;
                return Object.freeze({
                    state: "idle",
                    ...(validation === undefined ? {} : { validation }),
                    ...(activity === undefined ? {} : { activity }),
                });
            }
            if (slot.owner !== owner)
                return Object.freeze({ state: "busy" });
            if (slot.state === "connecting") {
                return Object.freeze({
                    state: "connecting",
                    transport: slot.transport,
                });
            }
            if (slot.state === "authorizing") {
                return Object.freeze({
                    state: "authorizing",
                    transport: "http",
                });
            }
            if (slot.state === "closing") {
                return Object.freeze({
                    state: "closing",
                    transport: slot.transport,
                });
            }
            const connection = slot.connectionSummary;
            if (connection === undefined)
                return Object.freeze({
                    state: "closing",
                    transport: slot.transport,
                });
            return Object.freeze({ state: "connected", connection });
        },
        tools: (owner) => Object.freeze([...ownedConnectedSlot(owner).catalog]),
        call,
        activity: (owner) => {
            const slot = active;
            if (slot === undefined) {
                if (retainedActivity?.owner === owner)
                    return retainedActivity.records;
                return Object.freeze([]);
            }
            if (slot.owner !== owner)
                throw attachedError("TARGET_BUSY");
            return slot.activity.entries();
        },
        disconnect: async (owner) => {
            const slot = active;
            if (slot === undefined)
                throw attachedError("NOT_CONNECTED");
            if (slot.owner !== owner)
                throw attachedError("TARGET_BUSY");
            await beginClose(slot);
        },
        close: async () => {
            const slot = active;
            if (slot === undefined) {
                lastValidationFailure = undefined;
                retainedActivity = undefined;
                return;
            }
            await beginClose(slot);
            // Controller shutdown drops the retained snapshot with the slot.
            retainedActivity = undefined;
        },
    };
}
//# sourceMappingURL=attached-session.js.map