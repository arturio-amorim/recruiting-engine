import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { types as nodeUtilTypes } from "node:util";
import { EngineError } from "./error.js";
import { readJsonSchema, snapshotLosslessJson, validateSchema, } from "./schema.js";
const ignoreLog = () => undefined;
const noOpLogger = Object.freeze({
    debug: ignoreLog,
    info: ignoreLog,
    warn: ignoreLog,
    error: ignoreLog,
});
const maximumTimeoutMs = 2_147_483_647;
const abortSignalAbortedGetter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
const abortSignalReasonGetter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "reason")?.get;
const abortSignalAddEventListener = AbortSignal.prototype.addEventListener;
const abortSignalRemoveEventListener = AbortSignal.prototype.removeEventListener;
const isProxy = nodeUtilTypes.isProxy;
const engineErrorCodes = new Set([
    "CAPABILITY_NOT_FOUND",
    "INPUT_INVALID",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "OUTPUT_INVALID",
    "CANCELLED",
    "EXECUTION_FAILED",
]);
function readSignalAborted(signal) {
    if (abortSignalAbortedGetter === undefined) {
        throw new TypeError("AbortSignal is not supported by this runtime.");
    }
    return Reflect.apply(abortSignalAbortedGetter, signal, []);
}
function readSignalReason(signal) {
    if (abortSignalReasonGetter === undefined) {
        throw new TypeError("AbortSignal is not supported by this runtime.");
    }
    return Reflect.apply(abortSignalReasonGetter, signal, []);
}
function addAbortListener(signal, listener) {
    Reflect.apply(abortSignalAddEventListener, signal, [
        "abort",
        listener,
        { once: true },
    ]);
}
function removeAbortListener(signal, listener) {
    Reflect.apply(abortSignalRemoveEventListener, signal, ["abort", listener]);
}
function assertPlatformAbortSignal(signal) {
    if (isProxy(signal)) {
        throw new TypeError("AbortSignal proxies are not supported.");
    }
    readSignalAborted(signal);
}
function validateTimeoutMs(capabilityId, timeoutMs) {
    if (timeoutMs !== undefined &&
        (!Number.isInteger(timeoutMs) ||
            timeoutMs < 1 ||
            timeoutMs > maximumTimeoutMs)) {
        throw new TypeError(`Capability ${capabilityId} timeoutMs must be an integer from 1 through ${maximumTimeoutMs}.`);
    }
}
function describeCapability(capabilityId, capability) {
    let inputSchema;
    let outputSchema;
    try {
        inputSchema = readJsonSchema(capability.input, "input");
        outputSchema = readJsonSchema(capability.output, "output");
    }
    catch (cause) {
        throw new TypeError(`Capability ${capabilityId} could not produce its JSON Schemas.`, { cause });
    }
    if (typeof inputSchema !== "object" ||
        inputSchema === null ||
        Array.isArray(inputSchema) ||
        inputSchema.type !== "object") {
        throw new TypeError(`Capability ${capabilityId} input schema must have an object root.`);
    }
    if (typeof outputSchema !== "object" ||
        outputSchema === null ||
        Array.isArray(outputSchema) ||
        outputSchema.type !== "object") {
        throw new TypeError(`Capability ${capabilityId} output schema must have an object root.`);
    }
    return snapshotLosslessJson({
        id: capabilityId,
        description: capability.description,
        ...(capability.title === undefined ? {} : { title: capability.title }),
        ...(capability.annotations === undefined
            ? {}
            : { annotations: capability.annotations }),
        ...(capability.timeoutMs === undefined
            ? {}
            : { timeoutMs: capability.timeoutMs }),
        inputSchema,
        outputSchema,
    });
}
function toSummary(description) {
    return snapshotLosslessJson({
        id: description.id,
        description: description.description,
        ...(description.title === undefined ? {} : { title: description.title }),
        ...(description.annotations === undefined
            ? {}
            : { annotations: description.annotations }),
    });
}
function snapshotCapability(capabilityId, capability) {
    const description = capability.description;
    const title = capability.title;
    const input = capability.input;
    const output = capability.output;
    const access = capability.access;
    const timeoutMs = capability.timeoutMs;
    const annotations = capability.annotations;
    const run = capability.run;
    validateTimeoutMs(capabilityId, timeoutMs);
    return Object.freeze({
        description,
        ...(title === undefined ? {} : { title }),
        input,
        output,
        access,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
        ...(annotations === undefined
            ? {}
            : { annotations: snapshotLosslessJson(annotations) }),
        run,
    });
}
const callerSignalFailureCauses = new WeakMap();
function createSignal(received, timeoutMs, forceWrapper = false) {
    if (received !== undefined)
        assertPlatformAbortSignal(received);
    if (timeoutMs === undefined && !forceWrapper) {
        return {
            signal: received ?? new AbortController().signal,
            cleanup: () => undefined,
        };
    }
    const controller = new AbortController();
    let listening = false;
    let cleaned = false;
    let timer;
    const abortFromReceived = () => {
        if (received === undefined)
            return;
        try {
            controller.abort(readSignalReason(received));
        }
        catch (cause) {
            callerSignalFailureCauses.set(controller.signal, cause);
            controller.abort();
        }
    };
    const cleanup = () => {
        if (cleaned)
            return;
        cleaned = true;
        if (listening && received !== undefined) {
            try {
                removeAbortListener(received, abortFromReceived);
            }
            catch {
                // Teardown cannot replace the invocation's result or original failure.
            }
        }
        if (timer !== undefined)
            clearTimeout(timer);
    };
    try {
        if (received !== undefined) {
            if (readSignalAborted(received))
                abortFromReceived();
            else {
                listening = true;
                addAbortListener(received, abortFromReceived);
            }
        }
        if (timeoutMs !== undefined) {
            timer = setTimeout(() => controller.abort(new Error("Capability invocation timed out.")), timeoutMs);
        }
    }
    catch (cause) {
        cleanup();
        throw cause;
    }
    return {
        signal: controller.signal,
        cleanup,
    };
}
function cancelled(cause) {
    return new EngineError({
        code: "CANCELLED",
        message: "Capability invocation was cancelled.",
        cause,
    });
}
function unauthenticated(cause) {
    return new EngineError({
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
        ...(cause === undefined ? {} : { cause }),
    });
}
function isRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function snapshotPrincipal(value) {
    if (value === null)
        return null;
    try {
        const snapshot = structuredClone(value);
        if (!isRecord(snapshot))
            throw new TypeError("Principal must be a record.");
        if (typeof snapshot.id !== "string" || snapshot.id.length === 0) {
            throw new TypeError("Principal id must be a non-empty string.");
        }
        if (snapshot.attributes !== undefined && !isRecord(snapshot.attributes)) {
            throw new TypeError("Principal attributes must be a record.");
        }
        return {
            id: snapshot.id,
            ...(snapshot.attributes === undefined
                ? {}
                : { attributes: snapshot.attributes }),
        };
    }
    catch (cause) {
        throw unauthenticated(cause);
    }
}
function clonePrincipal(snapshot) {
    return snapshot === null ? null : structuredClone(snapshot);
}
async function raceWithCancellation(work, signal) {
    if (readSignalAborted(signal))
        throw abortedSignalError(signal);
    let rejectOnAbort;
    const cancellation = new Promise((_resolve, reject) => {
        rejectOnAbort = reject;
    });
    const onAbort = () => rejectOnAbort?.(abortedSignalError(signal));
    addAbortListener(signal, onAbort);
    try {
        return await Promise.race([work, cancellation]);
    }
    finally {
        try {
            removeAbortListener(signal, onAbort);
        }
        catch {
            // Cancellation teardown cannot replace the settled work outcome.
        }
    }
}
function isStableEngineError(error) {
    try {
        if (isProxy(error) || !(error instanceof EngineError)) {
            return false;
        }
        const code = Object.getOwnPropertyDescriptor(error, "code");
        const message = Object.getOwnPropertyDescriptor(error, "message");
        return (code !== undefined &&
            "value" in code &&
            engineErrorCodes.has(code.value) &&
            message !== undefined &&
            "value" in message &&
            typeof message.value === "string");
    }
    catch {
        return false;
    }
}
function executionFailed(cause) {
    return new EngineError({
        code: "EXECUTION_FAILED",
        message: "Capability execution failed.",
        cause,
    });
}
function abortedSignalError(signal) {
    return callerSignalFailureCauses.has(signal)
        ? executionFailed(callerSignalFailureCauses.get(signal))
        : cancelled(readSignalReason(signal));
}
function normalizeError(error, signal) {
    if (isStableEngineError(error))
        return error;
    try {
        if (signal !== undefined && readSignalAborted(signal)) {
            return callerSignalFailureCauses.has(signal)
                ? executionFailed(callerSignalFailureCauses.get(signal))
                : cancelled(error ?? readSignalReason(signal));
        }
    }
    catch {
        // A malformed cancellation signal cannot escape the normalized boundary.
    }
    return executionFailed(error);
}
async function enforceAccess(capabilityId, capability, input, context) {
    if (capability.access === "public")
        return;
    if (capability.access === "authenticated") {
        if (context.principal === null) {
            throw unauthenticated();
        }
        return;
    }
    const access = capability.access;
    if ((await access({
        principal: context.principal,
        input,
        context,
        capabilityId,
    })) === true) {
        return;
    }
    throw new EngineError({
        code: context.principal === null ? "UNAUTHENTICATED" : "FORBIDDEN",
        message: context.principal === null
            ? "Authentication is required."
            : "Capability access is forbidden.",
    });
}
export function createEngine(definition) {
    const logger = definition.logger ?? noOpLogger;
    const onEvent = definition.onEvent;
    const capabilities = new Map();
    const descriptions = new Map();
    for (const capabilityId of Object.keys(definition.capabilities)) {
        const capability = definition.capabilities[capabilityId];
        if (capability !== undefined) {
            const snapshot = snapshotCapability(capabilityId, capability);
            capabilities.set(capabilityId, snapshot);
            descriptions.set(capabilityId, describeCapability(capabilityId, snapshot));
        }
    }
    const summaries = snapshotLosslessJson(Array.from(descriptions.values(), toSummary));
    const reportEventHookFailure = (event) => {
        try {
            const diagnosticResult = logger.error("Engine event hook failed.", {
                eventType: event.type,
                requestId: event.requestId,
            });
            void Promise.resolve(diagnosticResult).catch(() => undefined);
        }
        catch {
            // Observability hooks must not change invocation behavior.
        }
    };
    const emit = (event) => {
        if (onEvent === undefined)
            return;
        try {
            const delivery = onEvent(event);
            void Promise.resolve(delivery).catch(() => reportEventHookFailure(event));
        }
        catch {
            reportEventHookFailure(event);
        }
    };
    return {
        name: definition.name,
        version: definition.version,
        list: () => snapshotLosslessJson(summaries),
        describe(capabilityId) {
            const description = descriptions.get(capabilityId);
            if (description === undefined) {
                throw new EngineError({
                    code: "CAPABILITY_NOT_FOUND",
                    message: "Capability not found.",
                    publicDetails: { capabilityId },
                });
            }
            return snapshotLosslessJson(description);
        },
        async invoke(capabilityId, rawInput, options) {
            let requestId = randomUUID();
            let source = "direct";
            let optionsError;
            try {
                const configuredRequestId = options?.requestId;
                const configuredSource = options?.source;
                requestId = configuredRequestId ?? requestId;
                source = configuredSource ?? source;
            }
            catch (cause) {
                optionsError = executionFailed(cause);
            }
            let principal = null;
            let principalError;
            if (optionsError === undefined) {
                try {
                    principal = snapshotPrincipal(options?.principal ?? null);
                }
                catch (cause) {
                    principalError = unauthenticated(cause);
                }
            }
            const started = performance.now();
            emit({
                type: "invocation.started",
                requestId,
                capabilityId,
                source,
                ...(principal === null ? {} : { principalId: principal.id }),
                startedAt: new Date().toISOString(),
            });
            if (optionsError !== undefined) {
                emit({
                    type: "invocation.failed",
                    requestId,
                    capabilityId,
                    durationMs: performance.now() - started,
                    code: optionsError.code,
                });
                throw optionsError;
            }
            let signalState;
            try {
                const capability = capabilities.get(capabilityId);
                if (capability === undefined) {
                    throw new EngineError({
                        code: "CAPABILITY_NOT_FOUND",
                        message: "Capability not found.",
                        publicDetails: { capabilityId },
                    });
                }
                const validatedInput = await validateSchema(capability.input, rawInput, {
                    code: "INPUT_INVALID",
                    message: "Capability input validation failed.",
                });
                const input = structuredClone(validatedInput);
                if (principalError !== undefined)
                    throw principalError;
                let callerSignal;
                try {
                    callerSignal = options?.signal ?? new AbortController().signal;
                }
                catch (cause) {
                    throw executionFailed(cause);
                }
                const accessPrincipal = clonePrincipal(principal);
                let accessSignalState;
                if (typeof capability.access === "function") {
                    try {
                        accessSignalState = createSignal(callerSignal, undefined, true);
                    }
                    catch (cause) {
                        throw executionFailed(cause);
                    }
                }
                if (accessSignalState !== undefined &&
                    callerSignalFailureCauses.has(accessSignalState.signal)) {
                    accessSignalState.cleanup();
                    throw executionFailed(callerSignalFailureCauses.get(accessSignalState.signal));
                }
                const accessContext = Object.freeze({
                    requestId,
                    source,
                    principal: accessPrincipal,
                    signal: accessSignalState?.signal ?? callerSignal,
                    logger,
                });
                let accessFailed = false;
                let accessFailure;
                try {
                    await enforceAccess(capabilityId, capability, structuredClone(input), accessContext);
                }
                catch (cause) {
                    accessFailed = true;
                    accessFailure = cause;
                }
                finally {
                    accessSignalState?.cleanup();
                }
                if (accessSignalState !== undefined &&
                    callerSignalFailureCauses.has(accessSignalState.signal)) {
                    throw executionFailed(callerSignalFailureCauses.get(accessSignalState.signal));
                }
                if (accessFailed)
                    throw accessFailure;
                try {
                    signalState = createSignal(callerSignal, capability.timeoutMs);
                }
                catch (cause) {
                    throw executionFailed(cause);
                }
                const context = Object.freeze({
                    requestId,
                    source,
                    principal,
                    signal: signalState.signal,
                    logger,
                });
                if (readSignalAborted(context.signal)) {
                    throw abortedSignalError(context.signal);
                }
                const run = capability.run;
                const rawOutput = await raceWithCancellation(Promise.resolve().then(() => run({ input, context })), context.signal);
                const output = await raceWithCancellation(validateSchema(capability.output, rawOutput, {
                    code: "OUTPUT_INVALID",
                    message: "Capability output validation failed.",
                }), context.signal);
                signalState.cleanup();
                signalState = undefined;
                emit({
                    type: "invocation.completed",
                    requestId,
                    capabilityId,
                    durationMs: performance.now() - started,
                });
                return output;
            }
            catch (cause) {
                const error = normalizeError(cause, signalState?.signal);
                signalState?.cleanup();
                signalState = undefined;
                emit({
                    type: "invocation.failed",
                    requestId,
                    capabilityId,
                    durationMs: performance.now() - started,
                    code: error.code,
                });
                throw error;
            }
            finally {
                signalState?.cleanup();
            }
        },
    };
}
//# sourceMappingURL=engine.js.map