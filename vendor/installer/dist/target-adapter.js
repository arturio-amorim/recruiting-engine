import { InstallerError } from "./installer-error.js";
import { canonicalizeJcs, registerCanonicalJcs, } from "./jcs-fingerprint.js";
export const targetConfigByteLimit = 4_194_304;
export function createTargetAdapterCounters() {
    return {
        sourceDecodePasses: 0,
        sourceParsePasses: 0,
        inspectionPasses: 0,
        patchConstructionPasses: 0,
        postImageEncodePasses: 0,
        postImageDecodePasses: 0,
        postImageParsePasses: 0,
    };
}
export const targetInspectionState = Symbol("targetInspectionState");
export const targetDefinitionCanonicals = Symbol("targetDefinitionCanonicals");
const opaqueTargetInspectionState = Object.freeze(Object.create(null));
const targetInspectionStates = new WeakMap();
export function frozenTargetInspection(currentServer, state, canonicals, owner) {
    const inspection = {
        currentServer: Object.freeze(currentServer),
    };
    Object.defineProperties(inspection, {
        [targetDefinitionCanonicals]: {
            configurable: false,
            enumerable: false,
            value: canonicals,
            writable: false,
        },
        [targetInspectionState]: {
            configurable: false,
            enumerable: false,
            value: opaqueTargetInspectionState,
            writable: false,
        },
    });
    targetInspectionStates.set(inspection, { owner, state });
    return Object.freeze(inspection);
}
export function targetInspectionStateFor(inspection, owner) {
    const registered = targetInspectionStates.get(inspection);
    if (registered === undefined || registered.owner !== owner) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    return registered.state;
}
const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf]);
function hasLeadingBom(bytes) {
    return (bytes.byteLength >= 3 &&
        bytes[0] === utf8Bom[0] &&
        bytes[1] === utf8Bom[1] &&
        bytes[2] === utf8Bom[2]);
}
export function decodeTargetSource(bytes, counters, phase) {
    if (bytes === undefined) {
        return {
            bytes,
            text: "",
            bom: false,
            newline: "\n",
            trailingNewline: true,
            missing: true,
        };
    }
    if (bytes.byteLength > targetConfigByteLimit) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const bom = hasLeadingBom(bytes);
    const payload = bom ? bytes.subarray(3) : bytes;
    if (phase === "source") {
        if (counters !== undefined)
            counters.sourceDecodePasses += 1;
    }
    else if (counters !== undefined) {
        counters.postImageDecodePasses += 1;
    }
    let text;
    try {
        text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(payload);
    }
    catch (cause) {
        throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
    }
    if (text.includes("\ufeff")) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    return {
        bytes,
        text,
        bom,
        newline: text.includes("\r\n") ? "\r\n" : "\n",
        trailingNewline: text.endsWith("\n"),
        missing: false,
    };
}
export function encodeTargetPostImage(text, bom, counters) {
    if (counters !== undefined)
        counters.postImageEncodePasses += 1;
    const payload = new TextEncoder().encode(text);
    const length = payload.byteLength + (bom ? utf8Bom.byteLength : 0);
    if (length > targetConfigByteLimit) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    if (!bom)
        return payload;
    const bytes = new Uint8Array(length);
    bytes.set(utf8Bom);
    bytes.set(payload, utf8Bom.byteLength);
    return bytes;
}
export function parsePass(counters, phase) {
    if (counters === undefined)
        return;
    if (phase === "source")
        counters.sourceParsePasses += 1;
    else
        counters.postImageParsePasses += 1;
}
export function inspectionPass(counters) {
    if (counters !== undefined)
        counters.inspectionPasses += 1;
}
export function patchPass(counters) {
    if (counters !== undefined)
        counters.patchConstructionPasses += 1;
}
function invalidInspectedJson(cause) {
    throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
}
function serializeInspectedString(value) {
    for (let index = 0; index < value.length; index += 1) {
        const unit = value.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const following = value.charCodeAt(index + 1);
            if (!(following >= 0xdc00 && following <= 0xdfff)) {
                invalidInspectedJson();
            }
            index += 1;
        }
        else if (unit >= 0xdc00 && unit <= 0xdfff) {
            invalidInspectedJson();
        }
    }
    return JSON.stringify(value);
}
export function inspectedJsonScalar(value, selected) {
    if (!selected)
        return { kind: "scalar", value, canonical: undefined };
    let canonical;
    if (value === null)
        canonical = "null";
    else if (typeof value === "boolean")
        canonical = String(value);
    else if (typeof value === "string")
        canonical = serializeInspectedString(value);
    else if (typeof value === "number" && Number.isFinite(value)) {
        canonical = JSON.stringify(value);
    }
    else
        invalidInspectedJson();
    return { kind: "scalar", value, canonical };
}
export function inspectedJsonArray(items, selected) {
    const value = new Array(items.length);
    const canonicalItems = selected ? new Array(items.length) : undefined;
    let allStrings = true;
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        value[index] = item.value;
        if (typeof item.value !== "string")
            allStrings = false;
        if (selected) {
            if (item.canonical === undefined)
                invalidInspectedJson();
            canonicalItems[index] = item.canonical;
        }
    }
    return {
        kind: "array",
        value: selected ? Object.freeze(value) : value,
        items,
        allStrings,
        canonical: selected
            ? `[${canonicalItems.join(",")}]`
            : undefined,
    };
}
export function inspectedJsonRecord(fields, selected, mutable = false) {
    const value = Object.create(null);
    let allStringValues = true;
    const keys = selected ? [...fields.keys()].sort() : [...fields.keys()];
    const canonicalParts = [];
    for (const key of keys) {
        const field = fields.get(key) ?? invalidInspectedJson();
        if (typeof field.value !== "string")
            allStringValues = false;
        Object.defineProperty(value, key, {
            configurable: mutable,
            enumerable: true,
            value: field.value,
            writable: mutable,
        });
        if (selected) {
            if (field.canonical === undefined)
                invalidInspectedJson();
            canonicalParts.push(`${serializeInspectedString(key)}:${field.canonical}`);
        }
    }
    if (selected && !mutable)
        Object.freeze(value);
    return {
        kind: "record",
        value,
        fields,
        allStringValues,
        canonical: selected ? `{${canonicalParts.join(",")}}` : undefined,
    };
}
function canonicalRootVariants(fields, toggleStrategy) {
    const current = [];
    const enabled = [];
    const disabled = [];
    const withoutToggle = [];
    const toggleField = toggleStrategy === "native-enabled"
        ? "enabled"
        : toggleStrategy === "native-disabled"
            ? "disabled"
            : undefined;
    for (const key of [...fields.keys()].sort()) {
        const field = fields.get(key) ?? invalidInspectedJson();
        if (field.canonical === undefined)
            invalidInspectedJson();
        const prefix = `${serializeInspectedString(key)}:`;
        current.push(`${prefix}${field.canonical}`);
        if (key === toggleField) {
            enabled.push(`${prefix}${toggleStrategy === "native-enabled" ? "true" : "false"}`);
            disabled.push(`${prefix}${toggleStrategy === "native-enabled" ? "false" : "true"}`);
        }
        else if (toggleField !== undefined) {
            enabled.push(`${prefix}${field.canonical}`);
            disabled.push(`${prefix}${field.canonical}`);
            withoutToggle.push(`${prefix}${field.canonical}`);
        }
    }
    return Object.freeze({
        current: `{${current.join(",")}}`,
        ...(toggleField !== undefined
            ? {
                enabled: `{${enabled.join(",")}}`,
                disabled: `{${disabled.join(",")}}`,
                ...(toggleStrategy === "native-enabled"
                    ? { withoutEnabled: `{${withoutToggle.join(",")}}` }
                    : { withoutDisabled: `{${withoutToggle.join(",")}}` }),
            }
            : {}),
    });
}
function setInspectedField(root, key, field) {
    Object.defineProperty(root.value, key, {
        configurable: true,
        enumerable: true,
        value: field.value,
        writable: true,
    });
    root.fields.set(key, field);
}
export function finalizeInspectedMcpDefinition(root, options) {
    const commandField = root.fields.get("command");
    const command = commandField?.value;
    const httpUrlField = options.httpUrlField ?? "url";
    const url = root.fields.get(httpUrlField)?.value;
    const type = root.fields.get("type")?.value;
    const openCodeCommand = commandField?.kind === "array" &&
        commandField.allStrings &&
        commandField.items.length > 0;
    const isStdio = options.typePolicy === "opencode"
        ? type === "local" && openCodeCommand && url === undefined
        : typeof command === "string" && url === undefined;
    const isHttp = options.typePolicy === "opencode"
        ? type === "remote" && typeof url === "string" && command === undefined
        : typeof url === "string" && command === undefined;
    if (!isStdio && !isHttp)
        invalidInspectedJson();
    const transport = isStdio ? "stdio" : "streamable-http";
    const existingTransport = root.fields.get("transport");
    if (existingTransport !== undefined &&
        (options.rawTransportPolicy === "reject" ||
            !isHttp ||
            existingTransport.value !== "streamable-http")) {
        invalidInspectedJson();
    }
    setInspectedField(root, "transport", inspectedJsonScalar(transport, true));
    if (options.typePolicy === "claude") {
        const type = root.fields.get("type");
        const accepted = isStdio
            ? type === undefined || type.value === "stdio"
            : type !== undefined &&
                (type.value === "http" || type.value === "streamable-http");
        if (!accepted)
            invalidInspectedJson();
        setInspectedField(root, "type", inspectedJsonScalar(isStdio ? "stdio" : "http", true));
    }
    else if (options.typePolicy === "opencode") {
        if (type !== (isStdio ? "local" : "remote"))
            invalidInspectedJson();
        const oauth = root.fields.get("oauth");
        if (oauth !== undefined &&
            typeof oauth.value !== "boolean" &&
            oauth.kind !== "record") {
            invalidInspectedJson();
        }
    }
    const toggleStrategy = options.toggleStrategy ?? "native-enabled";
    const toggleField = toggleStrategy === "native-enabled"
        ? "enabled"
        : toggleStrategy === "native-disabled"
            ? "disabled"
            : undefined;
    if (toggleField !== undefined) {
        const toggle = root.fields.get(toggleField);
        if (toggle === undefined) {
            setInspectedField(root, toggleField, inspectedJsonScalar(toggleStrategy === "native-enabled", true));
        }
        else if (typeof toggle.value !== "boolean")
            invalidInspectedJson();
    }
    if (isStdio) {
        if (options.stdioCommandKind !== "array") {
            const args = root.fields.get("args");
            if (args === undefined) {
                setInspectedField(root, "args", inspectedJsonArray([], true));
            }
            else if (args.kind !== "array" || !args.allStrings) {
                invalidInspectedJson();
            }
        }
        if (options.stdioEnvironmentField !== undefined) {
            const environment = root.fields.get(options.stdioEnvironmentField);
            if (environment === undefined) {
                setInspectedField(root, options.stdioEnvironmentField, options.stdioEnvironmentKind === "array"
                    ? inspectedJsonArray([], true)
                    : inspectedJsonRecord(new Map(), true));
            }
            else if (options.stdioEnvironmentKind === "array"
                ? environment.kind !== "array" || !environment.allStrings
                : environment.kind !== "record" || !environment.allStringValues) {
                invalidInspectedJson();
            }
        }
    }
    else {
        if (options.httpHeadersField !== undefined) {
            const headers = root.fields.get(options.httpHeadersField);
            if (headers === undefined) {
                setInspectedField(root, options.httpHeadersField, inspectedJsonRecord(new Map(), true));
            }
            else if (headers.kind !== "record" || !headers.allStringValues) {
                invalidInspectedJson();
            }
        }
        if (options.httpBearerTokenField !== undefined) {
            const bearerToken = root.fields.get(options.httpBearerTokenField);
            if (bearerToken !== undefined && typeof bearerToken.value !== "string") {
                invalidInspectedJson();
            }
        }
    }
    Object.freeze(root.value);
    const variants = canonicalRootVariants(root.fields, toggleStrategy);
    const canonicals = Object.freeze({
        current: variants.current,
        ...(variants.enabled === undefined ? {} : { enabled: variants.enabled }),
        ...(variants.disabled === undefined ? {} : { disabled: variants.disabled }),
    });
    registerCanonicalJcs(root.value, {
        full: canonicals.current,
        ...(variants.withoutEnabled === undefined
            ? {}
            : { withoutEnabled: variants.withoutEnabled }),
        ...(variants.withoutDisabled === undefined
            ? {}
            : { withoutDisabled: variants.withoutDisabled }),
    });
    return { definition: root.value, canonicals };
}
export function assertTargetInspectionConsistency(inspection) {
    if (!targetInspectionStates.has(inspection)) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const currentServer = inspection.currentServer;
    const canonicals = inspection[targetDefinitionCanonicals];
    if (currentServer.kind === "absent") {
        if (canonicals !== undefined) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        return undefined;
    }
    if (currentServer.kind !== "present" || canonicals === undefined) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    try {
        if (canonicalizeJcs(currentServer.definition) !== canonicals.current) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
    }
    catch (cause) {
        if (cause instanceof InstallerError)
            throw cause;
        throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
    }
    return canonicals;
}
export function assertPostImageDefinition(request, postInspection, toggleStrategy = "native-enabled") {
    const postCanonicals = assertTargetInspectionConsistency(postInspection);
    if (request.action === "remove" ||
        (toggleStrategy === "detached" && request.action === "disable")) {
        if (postInspection.currentServer.kind !== "absent" ||
            postCanonicals !== undefined) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        return;
    }
    if (postInspection.currentServer.kind !== "present" ||
        postCanonicals === undefined) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const postCanonical = postCanonicals.current;
    let expectedCanonical;
    if (request.action === "install") {
        try {
            expectedCanonical = canonicalizeJcs(request.definition);
        }
        catch (cause) {
            throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
        }
    }
    else if (toggleStrategy === "detached") {
        if (request.action !== "enable" ||
            request.restoreDefinition === undefined) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        try {
            expectedCanonical = canonicalizeJcs(request.restoreDefinition);
        }
        catch (cause) {
            throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
        }
    }
    else {
        if (request.inspection.currentServer.kind !== "present") {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        const sourceCanonicals = assertTargetInspectionConsistency(request.inspection);
        if (sourceCanonicals === undefined) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        const variant = request.action === "enable"
            ? sourceCanonicals.enabled
            : sourceCanonicals.disabled;
        if (variant === undefined) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        expectedCanonical = variant;
    }
    if (postCanonical !== expectedCanonical) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
}
export function assertServerName(serverName) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/u.test(serverName)) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
}
function cloneJson(value, depth) {
    if (depth > 100)
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    if (value === null ||
        typeof value === "string" ||
        typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        return value;
    }
    if (Array.isArray(value)) {
        return Object.freeze(value.map((item) => cloneJson(item, depth + 1)));
    }
    if (typeof value !== "object" || value === undefined) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    if (Object.getOwnPropertySymbols(value).some((symbol) => Object.getOwnPropertyDescriptor(value, symbol)?.enumerable)) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const result = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
        if (!descriptor.enumerable)
            continue;
        if (!("value" in descriptor)) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        Object.defineProperty(result, key, {
            configurable: false,
            enumerable: true,
            value: cloneJson(descriptor.value, depth + 1),
            writable: false,
        });
    }
    return Object.freeze(result);
}
export function normalizedCurrentDefinition(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const cloned = cloneJson(raw, 1);
    const enabledDescriptor = Object.getOwnPropertyDescriptor(cloned, "enabled");
    if (enabledDescriptor !== undefined &&
        (!("value" in enabledDescriptor) ||
            typeof enabledDescriptor.value !== "boolean")) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const normalized = enabledDescriptor === undefined
        ? Object.freeze({ ...cloned, enabled: true })
        : cloned;
    try {
        const canonical = canonicalizeJcs(normalized);
        registerCanonicalJcs(normalized, { full: canonical });
    }
    catch (cause) {
        throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
    }
    return normalized;
}
export function normalizedDetachedDefinition(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const normalized = cloneJson(raw, 1);
    try {
        const canonical = canonicalizeJcs(normalized);
        registerCanonicalJcs(normalized, { full: canonical });
    }
    catch (cause) {
        throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
    }
    return normalized;
}
export function normalizedMcpDefinition(raw, options) {
    const definition = normalizedCurrentDefinition(raw);
    const isStdio = typeof definition.command === "string" && definition.url === undefined;
    const isHttp = typeof definition.url === "string" && definition.command === undefined;
    if (!isStdio && !isHttp) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const transport = isStdio ? "stdio" : "streamable-http";
    if (Object.hasOwn(definition, "transport") &&
        (options.rawTransportPolicy === "reject" ||
            !isHttp ||
            definition.transport !== "streamable-http")) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const normalized = {
        ...definition,
        transport,
    };
    if (isStdio) {
        if (normalized.args === undefined)
            normalized.args = [];
        if (!Array.isArray(normalized.args) ||
            normalized.args.some((argument) => typeof argument !== "string")) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        const environment = normalized[options.stdioEnvironmentField];
        if (environment === undefined) {
            normalized[options.stdioEnvironmentField] =
                options.stdioEnvironmentKind === "array" ? [] : {};
        }
        else if (options.stdioEnvironmentKind === "array"
            ? !Array.isArray(environment) ||
                environment.some((name) => typeof name !== "string")
            : typeof environment !== "object" ||
                environment === null ||
                Array.isArray(environment) ||
                Object.values(environment).some((value) => typeof value !== "string")) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        return freezeDefinition(normalized);
    }
    const value = definition[options.httpHeadersField];
    if (value === undefined) {
        normalized[options.httpHeadersField] = {};
        return freezeDefinition(normalized);
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const normalizedKeys = new Set();
    const fields = {};
    for (const [name, fieldValue] of Object.entries(value)) {
        if (typeof fieldValue !== "string") {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        const normalizedName = name.toLowerCase();
        if (normalizedKeys.has(normalizedName)) {
            throw new InstallerError("HARNESS_CONFIG_INVALID");
        }
        normalizedKeys.add(normalizedName);
        fields[normalizedName] = fieldValue;
    }
    normalized[options.httpHeadersField] = fields;
    return freezeDefinition(normalized);
}
export function freezeDefinition(definition) {
    return normalizedCurrentDefinition(definition);
}
export function freezeDetachedDefinition(definition) {
    return normalizedDetachedDefinition(definition);
}
export function readOwn(value, key) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor
        ? descriptor.value
        : undefined;
}
export function requireRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new InstallerError("HARNESS_CONFIG_INVALID");
    }
    return value;
}
export function unsupportedDefinition() {
    throw new InstallerError("TARGET_UNSUPPORTED");
}
//# sourceMappingURL=target-adapter.js.map