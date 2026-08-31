import { ATTACHED_CLI_SESSION_LIMITS, attachedCliError, } from "./cli-attached-contract.js";
const annotationKeys = [
    "readOnly",
    "destructive",
    "idempotent",
    "openWorld",
];
function ownDataProperty(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor))
        return undefined;
    return descriptor.value;
}
function isPlainRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseAttachedCliJson(buffer) {
    let text;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    }
    catch {
        throw attachedCliError("PROTOCOL_ERROR");
    }
    try {
        return JSON.parse(text);
    }
    catch {
        throw attachedCliError("PROTOCOL_ERROR");
    }
}
function parseAnnotations(value) {
    if (value === undefined)
        return undefined;
    if (!isPlainRecord(value))
        throw attachedCliError("PROTOCOL_ERROR");
    const annotations = {};
    for (const key of annotationKeys) {
        const entry = ownDataProperty(value, key);
        if (entry === undefined)
            continue;
        if (typeof entry !== "boolean")
            throw attachedCliError("PROTOCOL_ERROR");
        annotations[key] = entry;
    }
    return Object.keys(annotations).length === 0
        ? {}
        : annotations;
}
function parseSummary(value) {
    if (!isPlainRecord(value))
        throw attachedCliError("PROTOCOL_ERROR");
    const id = ownDataProperty(value, "id");
    const description = ownDataProperty(value, "description");
    if (typeof id !== "string" || id === "") {
        throw attachedCliError("PROTOCOL_ERROR");
    }
    if (typeof description !== "string")
        throw attachedCliError("PROTOCOL_ERROR");
    const title = ownDataProperty(value, "title");
    if (title !== undefined && typeof title !== "string") {
        throw attachedCliError("PROTOCOL_ERROR");
    }
    const annotations = parseAnnotations(ownDataProperty(value, "annotations"));
    return {
        id,
        description,
        ...(title === undefined ? {} : { title }),
        ...(annotations === undefined ? {} : { annotations }),
    };
}
export function parseAttachedCliCatalog(buffer) {
    const document = parseAttachedCliJson(buffer);
    if (!Array.isArray(document))
        throw attachedCliError("PROTOCOL_ERROR");
    if (document.length > ATTACHED_CLI_SESSION_LIMITS.catalogSummaries) {
        throw attachedCliError("LIMIT_EXCEEDED");
    }
    return Object.freeze(document.map((entry) => parseSummary(entry)));
}
export function parseAttachedCliDescription(buffer) {
    const document = parseAttachedCliJson(buffer);
    if (!isPlainRecord(document))
        throw attachedCliError("PROTOCOL_ERROR");
    const summary = parseSummary(document);
    const inputSchema = ownDataProperty(document, "inputSchema");
    const outputSchema = ownDataProperty(document, "outputSchema");
    if (!isPlainRecord(inputSchema) ||
        !isPlainRecord(outputSchema) ||
        Array.isArray(inputSchema) ||
        Array.isArray(outputSchema)) {
        throw attachedCliError("PROTOCOL_ERROR");
    }
    const timeoutMs = ownDataProperty(document, "timeoutMs");
    if (timeoutMs !== undefined &&
        (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs))) {
        throw attachedCliError("PROTOCOL_ERROR");
    }
    return {
        ...summary,
        inputSchema,
        outputSchema,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
    };
}
export function encodeAttachedCliRunInput(input) {
    let encoded;
    try {
        encoded = JSON.stringify(input);
    }
    catch {
        throw attachedCliError("INVALID_TARGET");
    }
    if (typeof encoded !== "string")
        throw attachedCliError("INVALID_TARGET");
    if (Buffer.byteLength(encoded, "utf8") >
        ATTACHED_CLI_SESSION_LIMITS.inputArgumentBytes) {
        throw attachedCliError("LIMIT_EXCEEDED");
    }
    return encoded;
}
//# sourceMappingURL=cli-attached-protocol.js.map