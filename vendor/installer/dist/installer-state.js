import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { InstallerError } from "./installer-error.js";
import { validOwnershipIdentity, } from "./ownership-identity.js";
import { configurationTargetIds, } from "./registry.js";
const stateByteLimit = 16_777_216;
const installationLimit = 11_000;
const stringLimit = 4_096;
const idPattern = /^[a-z][a-z0-9-]{0,127}$/u;
const serverNamePattern = /^[a-z][a-z0-9_-]{0,63}$/u;
const digestPattern = /^[0-9a-f]{64}$/u;
const environmentNamePattern = /^[A-Z_][A-Z0-9_]{0,127}$/u;
const httpFieldNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/u;
const rootKeys = new Set(["schemaVersion", "installations"]);
const installationKeys = new Set([
    "entryId",
    "registryVersion",
    "targetId",
    "configPath",
    "serverName",
    "definitionSha256",
    "targetContractVersion",
    "toggleStrategy",
    "launchDescriptor",
    "suspendedDescriptor",
    "adopted",
    "installedAt",
    "updatedAt",
]);
const suspendedKeys = new Set(["name", "transport"]);
const stdioKeys = new Set(["type", "command", "args", "forwardEnv"]);
const httpKeys = new Set(["type", "url", "authentication", "headersFromEnv"]);
const authenticationNoneKeys = new Set(["type"]);
const authenticationBearerKeys = new Set(["type", "variable"]);
const reservedHeaderNames = new Set([
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
]);
class StateValidationFailure extends Error {
    issues;
    constructor(issues) {
        super("The installer state failed internal validation.");
        this.name = "StateValidationFailure";
        this.issues = issues;
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function escapePointer(segment) {
    return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
function childPointer(parent, segment) {
    return `${parent}/${escapePointer(segment)}`;
}
function addIssue(issues, pointer, code) {
    issues.push({ pointer, code });
}
function orderedIssues(issues) {
    const unique = new Map();
    for (const issue of issues) {
        unique.set(`${issue.pointer}\0${issue.code}`, issue);
    }
    return Object.freeze([...unique.values()]
        .sort((left, right) => left.pointer === right.pointer
        ? left.code < right.code
            ? -1
            : left.code === right.code
                ? 0
                : 1
        : left.pointer < right.pointer
            ? -1
            : 1)
        .map((issue) => Object.freeze({ ...issue })));
}
function invalid(issues) {
    return { ok: false, issues: orderedIssues(issues) };
}
function hasValidUnicode(value, maximumScalars = stringLimit) {
    let scalarCount = 0;
    for (let index = 0; index < value.length; index += 1) {
        const unit = value.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const following = value.charCodeAt(index + 1);
            if (!(following >= 0xdc00 && following <= 0xdfff))
                return false;
            index += 1;
        }
        else if (unit >= 0xdc00 && unit <= 0xdfff) {
            return false;
        }
        scalarCount += 1;
        if (scalarCount > maximumScalars)
            return false;
    }
    return true;
}
function validateString(value, pointer, issues, options = {}) {
    if (typeof value !== "string") {
        addIssue(issues, pointer, "INVALID_TYPE");
        return false;
    }
    if (!hasValidUnicode(value))
        addIssue(issues, pointer, "INVALID_STRING");
    if (options.nonempty === true && value.trim() === "") {
        addIssue(issues, pointer, "EMPTY_STRING");
    }
    return true;
}
function validateShape(value, pointer, allowed, required, issues) {
    if (!isRecord(value)) {
        addIssue(issues, pointer, "INVALID_TYPE");
        return false;
    }
    for (const key of Object.keys(value)) {
        if (!hasValidUnicode(key)) {
            addIssue(issues, childPointer(pointer, key), "INVALID_STRING");
        }
        if (!allowed.has(key)) {
            addIssue(issues, childPointer(pointer, key), "UNKNOWN_KEY");
        }
    }
    for (const key of required) {
        if (!Object.hasOwn(value, key)) {
            addIssue(issues, childPointer(pointer, key), "MISSING_KEY");
        }
    }
    return true;
}
function validateStringArray(value, pointer, maximum, environmentNames, issues) {
    if (value === undefined)
        return true;
    if (!Array.isArray(value) || value.length > maximum) {
        addIssue(issues, pointer, "INVALID_TYPE");
        return false;
    }
    const seen = new Set();
    for (let index = 0; index < value.length; index += 1) {
        const itemPointer = childPointer(pointer, String(index));
        const item = value[index];
        if (!validateString(item, itemPointer, issues))
            continue;
        if (environmentNames && seen.has(item)) {
            addIssue(issues, itemPointer, "DUPLICATE_VALUE");
        }
        seen.add(item);
        if (environmentNames && !environmentNamePattern.test(item)) {
            addIssue(issues, itemPointer, "INVALID_ENV_NAME");
        }
    }
    return true;
}
function validateUrl(value) {
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        return false;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return false;
    if (parsed.username !== "" || parsed.password !== "")
        return false;
    const schemeSeparator = value.indexOf("://");
    if (schemeSeparator <= 0)
        return false;
    const authorityTail = value.slice(schemeSeparator + 3);
    const authorityEnd = authorityTail.search(/[/?#]/u);
    const authority = authorityTail.slice(0, authorityEnd === -1 ? undefined : authorityEnd);
    const rawTarget = authorityEnd === -1 ? "" : authorityTail.slice(authorityEnd);
    const queryOrFragment = rawTarget.search(/[?#]/u);
    const rawPath = rawTarget.slice(0, queryOrFragment === -1 ? undefined : queryOrFragment);
    const rawHost = authority.startsWith("[")
        ? authority.slice(0, authority.indexOf("]") + 1)
        : authority.split(":", 1)[0];
    if (authority === "" ||
        authority.includes("@") ||
        parsed.hostname === "" ||
        rawPath !== "/mcp" ||
        parsed.pathname !== "/mcp" ||
        value.includes("?") ||
        value.includes("#")) {
        return false;
    }
    if (parsed.protocol === "http:" &&
        rawHost !== "127.0.0.1" &&
        rawHost !== "[::1]") {
        return false;
    }
    return true;
}
function validateAuthentication(value, pointer, issues) {
    if (value === undefined)
        return "none";
    if (!isRecord(value)) {
        addIssue(issues, pointer, "INVALID_TYPE");
        return undefined;
    }
    if (value.type === "none") {
        validateShape(value, pointer, authenticationNoneKeys, ["type"], issues);
        return "none";
    }
    if (value.type === "bearer-env") {
        validateShape(value, pointer, authenticationBearerKeys, ["type", "variable"], issues);
        const variablePointer = childPointer(pointer, "variable");
        if (validateString(value.variable, variablePointer, issues) &&
            !environmentNamePattern.test(value.variable)) {
            addIssue(issues, variablePointer, "INVALID_ENV_NAME");
        }
        return "bearer-env";
    }
    validateShape(value, pointer, authenticationNoneKeys, ["type"], issues);
    addIssue(issues, childPointer(pointer, "type"), "INVALID_TRANSPORT");
    return undefined;
}
function validateHeaders(value, pointer, authentication, issues) {
    if (value === undefined)
        return true;
    if (!isRecord(value) || Object.keys(value).length > 64) {
        addIssue(issues, pointer, "INVALID_TYPE");
        return false;
    }
    const seen = new Set();
    for (const name of Object.keys(value)) {
        const headerPointer = childPointer(pointer, name);
        const normalized = name.toLowerCase();
        validateString(name, headerPointer, issues);
        if (!httpFieldNamePattern.test(name)) {
            addIssue(issues, headerPointer, "INVALID_HEADER_NAME");
        }
        if (seen.has(normalized)) {
            addIssue(issues, headerPointer, "DUPLICATE_VALUE");
        }
        seen.add(normalized);
        if (reservedHeaderNames.has(normalized) ||
            (authentication === "bearer-env" && normalized === "authorization")) {
            addIssue(issues, headerPointer, "RESERVED_HEADER");
        }
        const environmentName = value[name];
        if (validateString(environmentName, headerPointer, issues) &&
            !environmentNamePattern.test(environmentName)) {
            addIssue(issues, headerPointer, "INVALID_ENV_NAME");
        }
    }
    return true;
}
function validateTransport(value, pointer, issues) {
    if (!isRecord(value)) {
        addIssue(issues, pointer, "INVALID_TYPE");
        return false;
    }
    if (value.type === "stdio") {
        validateShape(value, pointer, stdioKeys, ["type", "command"], issues);
        const commandPointer = childPointer(pointer, "command");
        if (validateString(value.command, commandPointer, issues)) {
            if (value.command === "")
                addIssue(issues, commandPointer, "EMPTY_STRING");
            if (value.command.includes("\0")) {
                addIssue(issues, commandPointer, "INVALID_STRING");
            }
        }
        validateStringArray(value.args, childPointer(pointer, "args"), 128, false, issues);
        validateStringArray(value.forwardEnv, childPointer(pointer, "forwardEnv"), 64, true, issues);
        return true;
    }
    if (value.type === "streamable-http") {
        validateShape(value, pointer, httpKeys, ["type", "url"], issues);
        const urlPointer = childPointer(pointer, "url");
        if (validateString(value.url, urlPointer, issues) &&
            !validateUrl(value.url)) {
            addIssue(issues, urlPointer, "INVALID_URL");
        }
        const authentication = validateAuthentication(value.authentication, childPointer(pointer, "authentication"), issues);
        validateHeaders(value.headersFromEnv, childPointer(pointer, "headersFromEnv"), authentication, issues);
        return true;
    }
    validateShape(value, pointer, new Set(["type"]), ["type"], issues);
    addIssue(issues, childPointer(pointer, "type"), "INVALID_TRANSPORT");
    return false;
}
function parseTimestamp(value) {
    const match = timestampPattern.exec(value);
    if (match === null)
        return undefined;
    const fields = match.slice(1, 7).map(Number);
    const [year, month, day, hour, minute, second] = fields;
    if (year === undefined ||
        month === undefined ||
        day === undefined ||
        hour === undefined ||
        minute === undefined ||
        second === undefined ||
        month < 1 ||
        month > 12 ||
        hour > 23 ||
        minute > 59 ||
        second > 59) {
        return undefined;
    }
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthLengths = [
        31,
        leap ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if (day < 1 || day > monthLengths[month - 1])
        return undefined;
    return { fields, fraction: match[7] ?? "" };
}
function compareTimestamps(left, right) {
    for (let index = 0; index < left.fields.length; index += 1) {
        const difference = left.fields[index] - right.fields[index];
        if (difference !== 0)
            return difference;
    }
    const length = Math.max(left.fraction.length, right.fraction.length);
    const leftFraction = left.fraction.padEnd(length, "0");
    const rightFraction = right.fraction.padEnd(length, "0");
    return leftFraction < rightFraction
        ? -1
        : leftFraction === rightFraction
            ? 0
            : 1;
}
export function isInstallerTimestampAfter(candidate, previous) {
    const candidateTimestamp = parseTimestamp(candidate);
    const previousTimestamp = parseTimestamp(previous);
    return (candidateTimestamp !== undefined &&
        previousTimestamp !== undefined &&
        compareTimestamps(candidateTimestamp, previousTimestamp) > 0);
}
function normalizeTransport(value) {
    if (value.type === "stdio") {
        return Object.freeze({
            type: "stdio",
            command: value.command,
            args: Object.freeze([...(value.args ?? [])]),
            forwardEnv: Object.freeze([
                ...(value.forwardEnv ?? []),
            ]),
        });
    }
    const rawAuthentication = value.authentication;
    const authentication = rawAuthentication?.type === "bearer-env"
        ? Object.freeze({
            type: "bearer-env",
            variable: rawAuthentication.variable,
        })
        : Object.freeze({ type: "none" });
    const headers = {};
    for (const [name, environmentName] of Object.entries(value.headersFromEnv ?? {}).sort(([left], [right]) => (left < right ? -1 : left === right ? 0 : 1))) {
        headers[name.toLowerCase()] = environmentName;
    }
    return Object.freeze({
        type: "streamable-http",
        url: new URL(value.url).href,
        authentication,
        headersFromEnv: Object.freeze(headers),
    });
}
function normalizeInstallation(value) {
    const rawLaunch = value.launchDescriptor;
    const launchDescriptor = rawLaunch === undefined
        ? undefined
        : Object.freeze({
            name: rawLaunch.name,
            transport: normalizeTransport(rawLaunch.transport),
        });
    const rawSuspended = value.suspendedDescriptor;
    const suspendedDescriptor = rawSuspended === undefined
        ? undefined
        : Object.freeze({
            name: rawSuspended.name,
            transport: normalizeTransport(rawSuspended.transport),
        });
    return Object.freeze({
        entryId: value.entryId,
        registryVersion: value.registryVersion,
        targetId: value.targetId,
        configPath: value.configPath,
        serverName: value.serverName,
        definitionSha256: value.definitionSha256,
        targetContractVersion: 1,
        toggleStrategy: value.toggleStrategy,
        ...(launchDescriptor === undefined ? {} : { launchDescriptor }),
        ...(suspendedDescriptor === undefined ? {} : { suspendedDescriptor }),
        adopted: value.adopted,
        installedAt: value.installedAt,
        updatedAt: value.updatedAt,
    });
}
function validateSuspendedDescriptor(value, pointer, serverName, issues) {
    if (!validateShape(value, pointer, suspendedKeys, ["name", "transport"], issues)) {
        return;
    }
    const namePointer = childPointer(pointer, "name");
    if (validateString(value.name, namePointer, issues)) {
        if (!serverNamePattern.test(value.name)) {
            addIssue(issues, namePointer, "INVALID_SERVER_NAME");
        }
        if (typeof serverName === "string" && value.name !== serverName) {
            addIssue(issues, namePointer, "SUSPENDED_DESCRIPTOR_MISMATCH");
        }
    }
    validateTransport(value.transport, childPointer(pointer, "transport"), issues);
}
function validateInstallation(key, value, pointer, targetContracts, allowUnavailableTargetContracts, seenPairs, issues) {
    if (!validateShape(value, pointer, installationKeys, [
        "entryId",
        "registryVersion",
        "targetId",
        "configPath",
        "serverName",
        "definitionSha256",
        "targetContractVersion",
        "toggleStrategy",
        "adopted",
        "installedAt",
        "updatedAt",
    ], issues)) {
        return false;
    }
    if (validateString(value.entryId, childPointer(pointer, "entryId"), issues) &&
        !idPattern.test(value.entryId)) {
        addIssue(issues, childPointer(pointer, "entryId"), "INVALID_ID");
    }
    validateString(value.registryVersion, childPointer(pointer, "registryVersion"), issues, { nonempty: true });
    const validTargetId = typeof value.targetId === "string" &&
        configurationTargetIds.includes(value.targetId);
    if (!validTargetId) {
        addIssue(issues, childPointer(pointer, "targetId"), "INVALID_ID");
    }
    const configPath = value.configPath;
    const configPathValid = validateString(configPath, childPointer(pointer, "configPath"), issues);
    if (configPathValid &&
        (!isAbsolute(configPath) || configPath.includes("\0"))) {
        addIssue(issues, childPointer(pointer, "configPath"), "INVALID_STRING");
    }
    if (validateString(value.serverName, childPointer(pointer, "serverName"), issues) &&
        !serverNamePattern.test(value.serverName)) {
        addIssue(issues, childPointer(pointer, "serverName"), "INVALID_SERVER_NAME");
    }
    if (validateString(value.definitionSha256, childPointer(pointer, "definitionSha256"), issues) &&
        !digestPattern.test(value.definitionSha256)) {
        addIssue(issues, childPointer(pointer, "definitionSha256"), "INVALID_DIGEST");
    }
    if (value.targetContractVersion !== 1) {
        addIssue(issues, childPointer(pointer, "targetContractVersion"), "INVALID_TARGET_CONTRACT_VERSION");
    }
    const validToggleStrategy = value.toggleStrategy === "native-enabled" ||
        value.toggleStrategy === "native-disabled" ||
        value.toggleStrategy === "detached";
    if (!validToggleStrategy) {
        addIssue(issues, childPointer(pointer, "toggleStrategy"), "INVALID_TOGGLE_STRATEGY");
    }
    if (typeof value.adopted !== "boolean") {
        addIssue(issues, childPointer(pointer, "adopted"), "INVALID_TYPE");
    }
    const installedAt = typeof value.installedAt === "string"
        ? parseTimestamp(value.installedAt)
        : undefined;
    const updatedAt = typeof value.updatedAt === "string"
        ? parseTimestamp(value.updatedAt)
        : undefined;
    if (installedAt === undefined) {
        addIssue(issues, childPointer(pointer, "installedAt"), "INVALID_TIMESTAMP");
    }
    if (updatedAt === undefined) {
        addIssue(issues, childPointer(pointer, "updatedAt"), "INVALID_TIMESTAMP");
    }
    if (installedAt !== undefined &&
        updatedAt !== undefined &&
        compareTimestamps(updatedAt, installedAt) < 0) {
        addIssue(issues, childPointer(pointer, "updatedAt"), "TIMESTAMP_ORDER");
    }
    if (typeof value.entryId === "string" &&
        typeof value.targetId === "string" &&
        typeof value.configPath === "string") {
        if (key !==
            installationKey(value.entryId, value.targetId, value.configPath)) {
            addIssue(issues, pointer, "KEY_MISMATCH");
        }
        const pair = `${value.entryId}\0${value.targetId}`;
        if (seenPairs.has(pair))
            addIssue(issues, pointer, "DUPLICATE_INSTALLATION");
        seenPairs.add(pair);
    }
    if (validTargetId) {
        const contract = targetContracts[value.targetId];
        if (contract === undefined && allowUnavailableTargetContracts) {
            // Status still validates intrinsic state when a target cannot be detected.
        }
        else if (!isRecord(contract) || contract.targetContractVersion !== 1) {
            addIssue(issues, childPointer(pointer, "targetId"), "INVALID_TARGET_CONTRACT_VERSION");
        }
        else if (!isAbsolute(contract.configPath) ||
            contract.configPath.includes("\0") ||
            resolve(contract.configPath) !== contract.configPath) {
            addIssue(issues, childPointer(pointer, "configPath"), "CONFIG_PATH_RELOCATED");
        }
        else {
            if (value.configPath !== contract.configPath &&
                !allowUnavailableTargetContracts) {
                addIssue(issues, childPointer(pointer, "configPath"), "CONFIG_PATH_RELOCATED");
            }
            if (value.toggleStrategy !== contract.toggleStrategy) {
                addIssue(issues, childPointer(pointer, "toggleStrategy"), "TOGGLE_STRATEGY_MISMATCH");
            }
        }
    }
    if (value.suspendedDescriptor !== undefined) {
        if (value.toggleStrategy !== "detached") {
            addIssue(issues, childPointer(pointer, "suspendedDescriptor"), "SUSPENDED_DESCRIPTOR_FORBIDDEN");
        }
        validateSuspendedDescriptor(value.suspendedDescriptor, childPointer(pointer, "suspendedDescriptor"), value.serverName, issues);
    }
    if (value.launchDescriptor !== undefined) {
        validateSuspendedDescriptor(value.launchDescriptor, childPointer(pointer, "launchDescriptor"), value.serverName, issues);
    }
    return true;
}
function nextJsonToken(text, start) {
    let index = start;
    while (/\s/u.test(text[index] ?? ""))
        index += 1;
    if (index >= text.length)
        return undefined;
    const character = text[index];
    if (character === '"') {
        let end = index + 1;
        while (end < text.length) {
            if (text[end] === "\\")
                end += 2;
            else if (text[end++] === '"')
                break;
        }
        return {
            kind: "string",
            value: JSON.parse(text.slice(index, end)),
            end,
        };
    }
    if ("{}[]:,".includes(character)) {
        return { kind: "punctuation", value: character, end: index + 1 };
    }
    let end = index + 1;
    while (end < text.length &&
        !(/\s/u.test(text[end]) || "{}[],:".includes(text[end]))) {
        end += 1;
    }
    return { kind: "scalar", end };
}
function duplicateKeyIssues(text) {
    const issues = [];
    const stack = [];
    let offset = 0;
    let rootConsumed = false;
    const consumeValue = (token, pointer) => {
        const parent = stack.at(-1);
        if (parent === undefined)
            rootConsumed = true;
        else if (parent.kind === "object") {
            parent.state = "comma";
            delete parent.key;
        }
        else {
            parent.state = "comma";
            parent.index += 1;
        }
        if (token.kind !== "punctuation")
            return;
        if (token.value === "{") {
            stack.push({ kind: "object", pointer, keys: new Set(), state: "key" });
        }
        else if (token.value === "[") {
            stack.push({ kind: "array", pointer, state: "value", index: 0 });
        }
    };
    while (true) {
        const token = nextJsonToken(text, offset);
        if (token === undefined)
            break;
        offset = token.end;
        const frame = stack.at(-1);
        if (frame === undefined) {
            if (!rootConsumed)
                consumeValue(token, "");
            continue;
        }
        if (frame.kind === "object") {
            if (frame.state === "key") {
                if (token.kind === "punctuation" && token.value === "}")
                    stack.pop();
                else if (token.kind === "string") {
                    const key = token.value;
                    if (frame.keys.has(key)) {
                        addIssue(issues, childPointer(frame.pointer, key), "DUPLICATE_KEY");
                    }
                    frame.keys.add(key);
                    frame.key = key;
                    frame.state = "colon";
                }
            }
            else if (frame.state === "colon")
                frame.state = "value";
            else if (frame.state === "value") {
                consumeValue(token, childPointer(frame.pointer, frame.key));
            }
            else if (token.kind === "punctuation" && token.value === ",") {
                frame.state = "key";
            }
            else if (token.kind === "punctuation" && token.value === "}")
                stack.pop();
        }
        else if (frame.state === "value") {
            if (token.kind === "punctuation" && token.value === "]")
                stack.pop();
            else
                consumeValue(token, childPointer(frame.pointer, String(frame.index)));
        }
        else if (token.kind === "punctuation" && token.value === ",") {
            frame.state = "value";
        }
        else if (token.kind === "punctuation" && token.value === "]")
            stack.pop();
    }
    return issues;
}
export function installationKey(entryId, targetId, configPath) {
    return `${entryId}\0${targetId}\0${configPath}`;
}
export function createEmptyInstallerState() {
    return Object.freeze({
        schemaVersion: 1,
        installations: Object.freeze({}),
    });
}
export function validateInstallerStateBytes(bytes, targetContracts, options = {}) {
    if (bytes.byteLength > stateByteLimit) {
        return invalid([{ pointer: "", code: "STATE_TOO_LARGE" }]);
    }
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        return invalid([{ pointer: "", code: "BOM_FORBIDDEN" }]);
    }
    let text;
    try {
        text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    }
    catch {
        return invalid([{ pointer: "", code: "INVALID_UTF8" }]);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        return invalid([{ pointer: "", code: "INVALID_JSON" }]);
    }
    const issues = duplicateKeyIssues(text);
    if (!validateShape(parsed, "", rootKeys, ["schemaVersion", "installations"], issues)) {
        return invalid(issues);
    }
    if (parsed.schemaVersion !== 1) {
        addIssue(issues, "/schemaVersion", "INVALID_SCHEMA_VERSION");
    }
    if (!isRecord(parsed.installations)) {
        addIssue(issues, "/installations", "INVALID_TYPE");
        return invalid(issues);
    }
    const entries = Object.entries(parsed.installations);
    if (entries.length > installationLimit) {
        addIssue(issues, "/installations", "INSTALLATIONS_TOO_LARGE");
    }
    const seenPairs = new Set();
    const validInstallations = [];
    const installationsPointer = "/installations";
    for (const [key, value] of entries) {
        const recordPointer = childPointer(installationsPointer, key);
        if (!hasValidUnicode(key, Number.POSITIVE_INFINITY))
            addIssue(issues, recordPointer, "INVALID_STRING");
        if (validateInstallation(key, value, recordPointer, targetContracts, options.allowUnavailableTargetContracts === true, seenPairs, issues)) {
            validInstallations.push([key, value]);
        }
    }
    if (issues.length > 0)
        return invalid(issues);
    const installations = {};
    for (const [key, value] of validInstallations) {
        Object.defineProperty(installations, key, {
            configurable: false,
            enumerable: true,
            value: normalizeInstallation(value),
            writable: false,
        });
    }
    return {
        ok: true,
        state: Object.freeze({
            schemaVersion: 1,
            installations: Object.freeze(installations),
        }),
    };
}
async function inspectStatePath(fileSystem, reportedOwnerId, basePath, statePath, requireExactBaseRealPath) {
    const difference = relative(basePath, statePath);
    const components = [basePath];
    let componentPath = basePath;
    for (const component of difference.split(sep)) {
        componentPath = join(componentPath, component);
        components.push(componentPath);
    }
    let previousRealPath;
    for (const [index, path] of components.entries()) {
        let inspection;
        try {
            inspection = await fileSystem.inspectPath(path);
        }
        catch (cause) {
            throw new InstallerError("STATE_READ_FAILED", cause);
        }
        if (inspection.kind === "missing")
            return "missing";
        if (inspection.ownerId !== reportedOwnerId ||
            inspection.kind === "symbolic-link" ||
            inspection.kind === "other") {
            throw new InstallerError("STATE_INVALID");
        }
        const isTarget = index === components.length - 1;
        if (inspection.kind !== (isTarget ? "regular-file" : "directory")) {
            throw new InstallerError("STATE_INVALID");
        }
        if (!isAbsolute(inspection.realPath) ||
            inspection.realPath.includes("\0")) {
            throw new InstallerError("STATE_INVALID");
        }
        const realPath = resolve(inspection.realPath);
        if (index === 0) {
            if (requireExactBaseRealPath && realPath !== basePath) {
                throw new InstallerError("STATE_INVALID");
            }
        }
        else if (previousRealPath === undefined ||
            dirname(realPath) !== previousRealPath) {
            throw new InstallerError("STATE_INVALID");
        }
        previousRealPath = realPath;
    }
    return "present";
}
export async function loadInstallerState(options) {
    if (options.ownership === undefined ||
        !validOwnershipIdentity(options.ownership) ||
        !isAbsolute(options.homeDirectory) ||
        options.homeDirectory.includes("\0")) {
        throw new InstallerError("STATE_INVALID");
    }
    let xdgStateHome;
    try {
        xdgStateHome = options.environment.get("XDG_STATE_HOME");
    }
    catch (cause) {
        throw new InstallerError("STATE_INVALID", cause);
    }
    const usesXdg = xdgStateHome !== undefined;
    if (usesXdg &&
        (typeof xdgStateHome !== "string" ||
            xdgStateHome.trim() === "" ||
            xdgStateHome.includes("\0") ||
            !isAbsolute(xdgStateHome))) {
        throw new InstallerError("STATE_INVALID");
    }
    const basePath = resolve(usesXdg
        ? xdgStateHome
        : join(options.homeDirectory, ".local", "state"));
    const inspectionBase = usesXdg ? basePath : resolve(options.homeDirectory);
    const path = join(basePath, "senda", "installer.json");
    const inspection = await inspectStatePath(options.fileSystem, options.ownership.reportedOwnerId, inspectionBase, path, usesXdg);
    if (inspection === "missing") {
        return Object.freeze({ path, state: createEmptyInstallerState() });
    }
    let bytes;
    try {
        bytes = await options.fileSystem.readFile(pathToFileURL(path));
    }
    catch (cause) {
        throw new InstallerError("STATE_READ_FAILED", cause);
    }
    const result = validateInstallerStateBytes(bytes, options.targetContracts, {
        allowUnavailableTargetContracts: options.allowUnavailableTargetContracts === true,
    });
    if (!result.ok) {
        throw new InstallerError("STATE_INVALID", new StateValidationFailure(result.issues));
    }
    return Object.freeze({ path, state: result.state });
}
//# sourceMappingURL=installer-state.js.map