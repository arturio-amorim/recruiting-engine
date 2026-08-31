import { parse, } from "@humanwhocodes/momoa";
import { InstallerError } from "./installer-error.js";
import { canonicalizeJcs } from "./jcs-fingerprint.js";
import { assertPostImageDefinition, assertServerName, assertTargetInspectionConsistency, decodeTargetSource, encodeTargetPostImage, finalizeInspectedMcpDefinition, freezeDefinition, freezeDetachedDefinition, frozenTargetInspection, inspectedJsonArray, inspectedJsonRecord, inspectedJsonScalar, inspectionPass, parsePass, patchPass, targetInspectionStateFor, unsupportedDefinition, } from "./target-adapter.js";
function invalid(cause) {
    throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
}
function range(node) {
    if (node.range === undefined)
        invalid();
    return node.range;
}
function scalarValue(node) {
    switch (node.type) {
        case "Null":
            return null;
        case "Boolean":
        case "String":
        case "Number":
            return node.value;
        default:
            return invalid();
    }
}
function memberName(member) {
    return member.name.type === "Identifier"
        ? member.name.name
        : member.name.value;
}
function samePath(left, right) {
    return (left.length === right.length &&
        left.every((segment, index) => segment === right[index]));
}
function selectedPath(path, serverPath) {
    return (path.length >= serverPath.length &&
        serverPath.every((segment, index) => segment === path[index]));
}
function serverPath(dialect, serverName) {
    return dialect === "opencode"
        ? ["mcp", "servers", serverName]
        : dialect === "vscode"
            ? ["servers", serverName]
            : ["mcpServers", serverName];
}
function inspectAst(document, serverName, dialect) {
    const members = new Map();
    const values = new Map();
    const selectedServerPath = serverPath(dialect, serverName);
    const stack = [
        {
            kind: "visit",
            node: document.body,
            depth: 1,
            path: [],
            assign: () => undefined,
        },
    ];
    while (stack.length > 0) {
        const task = stack.pop();
        if (task.kind === "finish-array") {
            const inspected = inspectedJsonArray(task.items, selectedPath(task.path, selectedServerPath));
            values.set(task.node, inspected);
            task.assign(inspected);
            continue;
        }
        if (task.kind === "finish-object") {
            const inspected = inspectedJsonRecord(task.fields, selectedPath(task.path, selectedServerPath), samePath(task.path, selectedServerPath));
            values.set(task.node, inspected);
            task.assign(inspected);
            continue;
        }
        const { node, depth, path, assign } = task;
        if (node.type === "Object") {
            if (depth > 100)
                invalid();
            const objectMembers = new Map();
            const fields = new Map();
            members.set(node, objectMembers);
            stack.push({ kind: "finish-object", node, path, fields, assign });
            for (let index = node.members.length - 1; index >= 0; index -= 1) {
                const member = node.members[index];
                const name = memberName(member);
                if (objectMembers.has(name))
                    invalid();
                objectMembers.set(name, member);
                const child = member.value;
                const normalizedName = samePath(path, [
                    ...selectedServerPath,
                    "headers",
                ])
                    ? name.toLowerCase()
                    : name;
                if (fields.has(normalizedName))
                    invalid();
                stack.push({
                    kind: "visit",
                    node: child,
                    depth: child.type === "Object" || child.type === "Array"
                        ? depth + 1
                        : depth,
                    path: [...path, name],
                    assign: (assigned) => {
                        if (fields.has(normalizedName))
                            invalid();
                        fields.set(normalizedName, assigned);
                    },
                });
            }
            continue;
        }
        if (node.type === "Array") {
            if (depth > 100)
                invalid();
            const items = new Array(node.elements.length);
            stack.push({ kind: "finish-array", node, path, items, assign });
            for (let index = node.elements.length - 1; index >= 0; index -= 1) {
                const child = node.elements[index]?.value;
                if (child === undefined)
                    invalid();
                stack.push({
                    kind: "visit",
                    node: child,
                    depth: child.type === "Object" || child.type === "Array"
                        ? depth + 1
                        : depth,
                    path,
                    assign: (assigned) => {
                        items[index] = assigned;
                    },
                });
            }
            continue;
        }
        const inspected = inspectedJsonScalar(scalarValue(node), selectedPath(path, selectedServerPath));
        values.set(node, inspected);
        assign(inspected);
    }
    return { members, values };
}
function objectMember(state, object, key) {
    return object === undefined ? undefined : state.members.get(object)?.get(key);
}
function objectValue(state, object, key) {
    return objectMember(state, object, key)?.value;
}
function objectNode(node) {
    if (node === undefined)
        return undefined;
    if (node.type !== "Object")
        invalid();
    return node;
}
function finalizationOptions(dialect, toggleStrategy) {
    if (dialect === "antigravity") {
        return {
            httpUrlField: "serverUrl",
            rawTransportPolicy: "reject",
            toggleStrategy,
            typePolicy: "none",
        };
    }
    if (dialect === "kimi") {
        return {
            httpBearerTokenField: "bearerTokenEnvVar",
            rawTransportPolicy: "reject",
            toggleStrategy,
            typePolicy: "none",
        };
    }
    if (dialect === "opencode") {
        return {
            stdioCommandKind: "array",
            stdioEnvironmentField: "environment",
            stdioEnvironmentKind: "object",
            httpHeadersField: "headers",
            rawTransportPolicy: "reject",
            toggleStrategy,
            typePolicy: "opencode",
        };
    }
    return {
        stdioEnvironmentField: "env",
        stdioEnvironmentKind: "object",
        httpHeadersField: "headers",
        rawTransportPolicy: "reject",
        toggleStrategy,
        typePolicy: dialect === "claude" || dialect === "vscode"
            ? "claude"
            : "none",
    };
}
function emptyState(source, serverName, dialect) {
    return Object.freeze({
        dialect,
        source,
        serverName,
        root: undefined,
        mcp: undefined,
        servers: undefined,
        serverMember: undefined,
        server: undefined,
        toggle: undefined,
        members: new Map(),
        tokens: Object.freeze([]),
    });
}
function parseAndInspect(sourceBytes, serverName, counters, phase, options, inspectionOwner) {
    assertServerName(serverName);
    const decodedSource = decodeTargetSource(sourceBytes, counters, phase);
    const source = options.dialect === "antigravity" &&
        sourceBytes !== undefined &&
        sourceBytes.byteLength === 0
        ? Object.freeze({ ...decodedSource, missing: true })
        : decodedSource;
    if (source.missing) {
        if (phase === "source")
            inspectionPass(counters);
        return frozenTargetInspection({ kind: "absent" }, emptyState(source, serverName, options.dialect), undefined, inspectionOwner);
    }
    parsePass(counters, phase);
    let document;
    let astInspection;
    try {
        document = parse(source.text, {
            mode: options.dialect === "opencode" || options.dialect === "vscode"
                ? "jsonc"
                : "json",
            ranges: true,
            tokens: true,
            ...(options.dialect === "opencode" || options.dialect === "vscode"
                ? { allowTrailingCommas: true }
                : {}),
        });
        astInspection = inspectAst(document, serverName, options.dialect);
    }
    catch (cause) {
        if (cause instanceof InstallerError)
            throw cause;
        return invalid(cause);
    }
    if (document.body.type !== "Object")
        invalid();
    const root = document.body;
    const memberState = { members: astInspection.members };
    const mcp = options.dialect === "opencode"
        ? objectNode(objectValue(memberState, root, "mcp"))
        : undefined;
    const servers = objectNode(objectValue(memberState, options.dialect === "opencode" ? mcp : root, options.dialect === "opencode" || options.dialect === "vscode"
        ? "servers"
        : "mcpServers"));
    const serverMember = objectMember(memberState, servers, serverName);
    const server = objectNode(serverMember?.value);
    const inspectedServer = server === undefined ? undefined : astInspection.values.get(server);
    if (server !== undefined && inspectedServer?.kind !== "record")
        invalid();
    const finalized = inspectedServer?.kind === "record"
        ? finalizeInspectedMcpDefinition(inspectedServer, finalizationOptions(options.dialect, options.toggleStrategy))
        : undefined;
    if (phase === "source")
        inspectionPass(counters);
    return frozenTargetInspection(finalized === undefined
        ? { kind: "absent" }
        : { kind: "present", definition: finalized.definition }, Object.freeze({
        dialect: options.dialect,
        source,
        serverName,
        root,
        mcp,
        servers,
        serverMember,
        server,
        toggle: objectValue(memberState, server, options.toggleStrategy === "native-disabled" ? "disabled" : "enabled"),
        members: astInspection.members,
        tokens: Object.freeze(document.tokens ?? []),
    }), finalized?.canonicals, inspectionOwner);
}
function lineIndent(text, offset) {
    const lineStart = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
    return /^[\t ]*/u.exec(text.slice(lineStart, offset))?.[0] ?? "";
}
function insertProperty(text, object, key, value, newline, tokens) {
    const [start, end] = range(object);
    const close = end - 1;
    const inside = text.slice(start + 1, close);
    const last = object.members.at(-1);
    if (last === undefined) {
        if (inside.includes("\n")) {
            const closeIndent = lineIndent(text, close);
            const insertionStart = close - closeIndent.length;
            return `${text.slice(0, insertionStart)}${closeIndent}  ${JSON.stringify(key)}: ${value}${newline}${text.slice(insertionStart)}`;
        }
        return `${text.slice(0, close)}${inside.trim() === "" ? "" : " "}${JSON.stringify(key)}: ${value}${inside.trim() === "" ? "" : " "}${text.slice(close)}`;
    }
    const [, lastEnd] = range(last.value);
    const hasTrailingComma = tokens.some((token) => {
        if (token.type !== "Comma")
            return false;
        const [start, end] = range(token);
        return start >= lastEnd && end <= close;
    });
    const withComma = hasTrailingComma
        ? text
        : `${text.slice(0, lastEnd)},${text.slice(lastEnd)}`;
    const adjustedClose = close + (hasTrailingComma ? 0 : 1);
    if (inside.includes("\n")) {
        const closeIndent = lineIndent(withComma, adjustedClose);
        const insertionStart = adjustedClose - closeIndent.length;
        return `${withComma.slice(0, insertionStart)}${closeIndent}  ${JSON.stringify(key)}: ${value}${newline}${withComma.slice(insertionStart)}`;
    }
    return `${withComma.slice(0, adjustedClose)} ${JSON.stringify(key)}: ${value}${withComma.slice(adjustedClose)}`;
}
function replaceRange(text, node, replacement) {
    const [start, end] = range(node);
    return `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}
function removeMember(text, state, object, member) {
    const index = object.members.indexOf(member);
    if (index < 0)
        invalid();
    const [memberStart, memberEnd] = range(member);
    if (object.members.length === 1) {
        return `${text.slice(0, memberStart)}${text.slice(memberEnd)}`;
    }
    if (index < object.members.length - 1) {
        const [nextStart] = range(object.members[index + 1]);
        return `${text.slice(0, memberStart)}${text.slice(nextStart)}`;
    }
    const previous = object.members[index - 1];
    const [, previousEnd] = range(previous);
    const comma = state.tokens.find((token) => {
        if (token.type !== "Comma")
            return false;
        const [start, end] = range(token);
        return start >= previousEnd && end <= memberStart;
    });
    if (comma === undefined)
        invalid();
    const [commaStart] = range(comma);
    return `${text.slice(0, commaStart)}${text.slice(memberEnd)}`;
}
function mappedConfigDefinition(definition, dialect) {
    const stdio = definition.transport === "stdio";
    const keys = dialect === "antigravity"
        ? stdio
            ? ["command", "args", "disabled"]
            : ["serverUrl", "disabled"]
        : dialect === "claude" || dialect === "vscode"
            ? stdio
                ? ["type", "command", "args", "env"]
                : ["type", "url", "headers"]
            : dialect === "cursor"
                ? stdio
                    ? ["command", "args", "env"]
                    : ["url", "headers"]
                : dialect === "kimi"
                    ? stdio
                        ? ["command", "args", "enabled"]
                        : ["url", "bearerTokenEnvVar", "enabled"]
                    : stdio
                        ? ["type", "command", "environment", "disabled"]
                        : ["type", "url", "oauth", "headers", "disabled"];
    const mapped = {};
    for (const key of keys) {
        if (Object.hasOwn(definition, key))
            mapped[key] = definition[key];
    }
    for (const optional of ["env", "environment", "headers"]) {
        const value = mapped[optional];
        if (typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            Object.keys(value).length === 0) {
            delete mapped[optional];
        }
    }
    if (typeof mapped.headers === "object" &&
        mapped.headers !== null &&
        !Array.isArray(mapped.headers)) {
        mapped.headers = Object.fromEntries(Object.entries(mapped.headers).map(([name, value]) => [
            name === "authorization" ? "Authorization" : name,
            value,
        ]));
    }
    return mapped;
}
function stringRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    return Object.values(value).every((entry) => typeof entry === "string");
}
const environmentNamePattern = /^[A-Z_][A-Z0-9_]{0,127}$/u;
const httpFieldNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
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
function validEnvironmentPlaceholders(value, dialect) {
    if (!stringRecord(value))
        return false;
    return Object.entries(value).every(([name, placeholder]) => environmentNamePattern.test(name) &&
        placeholder ===
            (dialect === "claude"
                ? `\${${name}}`
                : dialect === "cursor" || dialect === "vscode"
                    ? `\${env:${name}}`
                    : `{env:${name}}`));
}
function validHeaderPlaceholders(value, dialect) {
    if (!stringRecord(value))
        return false;
    const barePattern = dialect === "claude"
        ? /^\$\{[A-Z_][A-Z0-9_]{0,127}\}$/u
        : dialect === "cursor" || dialect === "vscode"
            ? /^\$\{env:[A-Z_][A-Z0-9_]{0,127}\}$/u
            : /^\{env:[A-Z_][A-Z0-9_]{0,127}\}$/u;
    const bearerPattern = dialect === "claude"
        ? /^Bearer \$\{[A-Z_][A-Z0-9_]{0,127}\}$/u
        : dialect === "cursor" || dialect === "vscode"
            ? /^Bearer \$\{env:[A-Z_][A-Z0-9_]{0,127}\}$/u
            : /^Bearer \{env:[A-Z_][A-Z0-9_]{0,127}\}$/u;
    return Object.entries(value).every(([name, placeholder]) => name === name.toLowerCase() &&
        httpFieldNamePattern.test(name) &&
        !reservedHeaderNames.has(name) &&
        (name === "authorization"
            ? barePattern.test(placeholder) || bearerPattern.test(placeholder)
            : barePattern.test(placeholder)));
}
function validateMappedDefinition(definition, dialect) {
    if (typeof definition !== "object" ||
        definition === null ||
        Array.isArray(definition)) {
        invalid();
    }
    canonicalDefinition(definition);
    const stdio = definition.transport === "stdio";
    const http = definition.transport === "streamable-http";
    if (!stdio && !http)
        invalid();
    const allowed = new Set(dialect === "antigravity"
        ? stdio
            ? ["transport", "command", "args", "disabled"]
            : ["transport", "serverUrl", "disabled"]
        : dialect === "claude" || dialect === "vscode"
            ? stdio
                ? ["transport", "type", "command", "args", "env"]
                : ["transport", "type", "url", "headers"]
            : dialect === "cursor"
                ? stdio
                    ? ["transport", "command", "args", "env"]
                    : ["transport", "url", "headers"]
                : dialect === "kimi"
                    ? stdio
                        ? ["transport", "command", "args", "enabled"]
                        : ["transport", "url", "bearerTokenEnvVar", "enabled"]
                    : stdio
                        ? ["transport", "type", "command", "environment", "disabled"]
                        : ["transport", "type", "url", "oauth", "headers", "disabled"]);
    if (Object.keys(definition).some((key) => !allowed.has(key)))
        invalid();
    if (stdio) {
        if (dialect === "opencode") {
            if (definition.type !== "local" ||
                !Array.isArray(definition.command) ||
                definition.command.length === 0 ||
                definition.command.some((argument) => typeof argument !== "string")) {
                invalid();
            }
        }
        else if (typeof definition.command !== "string" ||
            !Array.isArray(definition.args) ||
            definition.args.some((argument) => typeof argument !== "string")) {
            invalid();
        }
        if ((dialect === "claude" || dialect === "vscode") &&
            definition.type !== "stdio") {
            invalid();
        }
        if ((dialect === "claude" ||
            dialect === "vscode" ||
            dialect === "cursor" ||
            dialect === "opencode") &&
            !validEnvironmentPlaceholders(dialect === "opencode" ? definition.environment : definition.env, dialect)) {
            invalid();
        }
    }
    else {
        if (dialect === "antigravity"
            ? typeof definition.serverUrl !== "string"
            : typeof definition.url !== "string") {
            invalid();
        }
        if ((dialect === "claude" || dialect === "vscode") &&
            definition.type !== "http") {
            invalid();
        }
        if (dialect === "opencode" &&
            (definition.type !== "remote" || definition.oauth !== false)) {
            invalid();
        }
        if ((dialect === "claude" ||
            dialect === "vscode" ||
            dialect === "cursor" ||
            dialect === "opencode") &&
            !validHeaderPlaceholders(definition.headers, dialect)) {
            invalid();
        }
        if (dialect === "kimi" &&
            definition.bearerTokenEnvVar !== undefined &&
            (typeof definition.bearerTokenEnvVar !== "string" ||
                !environmentNamePattern.test(definition.bearerTokenEnvVar))) {
            invalid();
        }
    }
    if (dialect === "kimi" && typeof definition.enabled !== "boolean") {
        invalid();
    }
    if (dialect === "antigravity" && typeof definition.disabled !== "boolean") {
        invalid();
    }
    if (dialect === "opencode" && typeof definition.disabled !== "boolean") {
        invalid();
    }
}
function definitionJson(definition, dialect) {
    return JSON.stringify(mappedConfigDefinition(definition, dialect));
}
function canonicalDefinition(definition) {
    try {
        return canonicalizeJcs(definition);
    }
    catch (cause) {
        throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
    }
}
function constructPatch(request, options, inspectionOwner) {
    const sourceCanonicals = assertTargetInspectionConsistency(request.inspection);
    const state = targetInspectionStateFor(request.inspection, inspectionOwner);
    if (state.dialect !== options.dialect)
        invalid();
    let insertedDefinition;
    if (request.action === "install") {
        if (request.inspection.currentServer.kind === "present") {
            throw new InstallerError("CONFIG_CONFLICT");
        }
        validateMappedDefinition(request.definition, options.dialect);
        insertedDefinition = request.definition;
    }
    else if (request.action === "remove") {
        if (request.inspection.currentServer.kind !== "present" ||
            state.servers === undefined ||
            state.serverMember === undefined) {
            invalid();
        }
    }
    else if (options.toggleStrategy === "detached") {
        if (request.action === "disable") {
            if (request.inspection.currentServer.kind === "absent") {
                return { kind: "unchanged" };
            }
        }
        else {
            if (request.restoreDefinition === undefined)
                invalid();
            validateMappedDefinition(request.restoreDefinition, options.dialect);
            insertedDefinition = request.restoreDefinition;
            if (request.inspection.currentServer.kind === "present") {
                if (sourceCanonicals?.current ===
                    canonicalDefinition(request.restoreDefinition)) {
                    return { kind: "unchanged" };
                }
                throw new InstallerError("CONFIG_CONFLICT");
            }
        }
    }
    else {
        if (request.inspection.currentServer.kind !== "present" ||
            state.server === undefined) {
            invalid();
        }
        const desiredEnabled = request.action === "enable";
        const currentEnabled = options.toggleStrategy === "native-disabled"
            ? request.inspection.currentServer.definition.disabled === false
            : request.inspection.currentServer.definition.enabled === true;
        if (currentEnabled === desiredEnabled) {
            return { kind: "unchanged" };
        }
    }
    patchPass(request.counters);
    const { source } = state;
    let postText;
    if (insertedDefinition !== undefined) {
        const entry = definitionJson(insertedDefinition, options.dialect);
        if (source.missing) {
            postText = `${JSON.stringify(options.dialect === "opencode"
                ? {
                    mcp: {
                        servers: {
                            [state.serverName]: mappedConfigDefinition(insertedDefinition, options.dialect),
                        },
                    },
                }
                : {
                    [options.dialect === "vscode" ? "servers" : "mcpServers"]: {
                        [state.serverName]: mappedConfigDefinition(insertedDefinition, options.dialect),
                    },
                }, undefined, 2)}\n`;
        }
        else if (state.root === undefined)
            invalid();
        else if (options.dialect === "opencode" && state.mcp === undefined) {
            postText = insertProperty(source.text, state.root, "mcp", `{"servers":{${JSON.stringify(state.serverName)}:${entry}}}`, source.newline, state.tokens);
        }
        else if (state.servers === undefined) {
            postText = insertProperty(source.text, options.dialect === "opencode" ? state.mcp : state.root, options.dialect === "opencode" || options.dialect === "vscode"
                ? "servers"
                : "mcpServers", `{${JSON.stringify(state.serverName)}:${entry}}`, source.newline, state.tokens);
        }
        else {
            postText = insertProperty(source.text, state.servers, state.serverName, entry, source.newline, state.tokens);
        }
    }
    else if (request.action === "remove") {
        if (state.servers === undefined || state.serverMember === undefined) {
            invalid();
        }
        postText = removeMember(source.text, state, state.servers, state.serverMember);
    }
    else if (options.toggleStrategy === "detached") {
        if (state.servers === undefined ||
            state.serverMember === undefined ||
            request.action !== "disable") {
            invalid();
        }
        postText = removeMember(source.text, state, state.servers, state.serverMember);
    }
    else {
        const desiredEnabled = request.action === "enable";
        const toggleField = options.toggleStrategy === "native-disabled" ? "disabled" : "enabled";
        const desiredValue = options.toggleStrategy === "native-disabled"
            ? !desiredEnabled
            : desiredEnabled;
        postText =
            state.toggle === undefined
                ? insertProperty(source.text, state.server, toggleField, String(desiredValue), source.newline, state.tokens)
                : replaceRange(source.text, state.toggle, String(desiredValue));
    }
    const postImage = encodeTargetPostImage(postText, source.bom, request.counters);
    const postInspection = parseAndInspect(postImage, state.serverName, request.counters, "post-image", options, inspectionOwner);
    assertPostImageDefinition(request, postInspection, options.toggleStrategy);
    return { kind: "changed", postImage };
}
export function createJsonTargetAdapter(options) {
    const inspectionOwner = Object.freeze({});
    const parseOptions = Object.freeze({
        dialect: options.dialect,
        toggleStrategy: options.toggleStrategy,
    });
    return Object.freeze({
        metadata: Object.freeze({
            targetId: options.targetId,
            targetContractVersion: 1,
            format: options.dialect === "opencode" || options.dialect === "vscode"
                ? "jsonc"
                : "json",
            parentPath: Object.freeze(options.dialect === "opencode"
                ? ["mcp", "servers"]
                : options.dialect === "vscode"
                    ? ["servers"]
                    : ["mcpServers"]),
            toggleStrategy: options.toggleStrategy,
        }),
        compatibility: options.compatibility,
        descriptorToDefinition: options.descriptorToDefinition,
        definitionToSuspendedDescriptor: options.definitionToSuspendedDescriptor,
        suspendedDescriptorToDefinition: (descriptor) => {
            const fake = {
                id: "suspended",
                version: "0.0.0",
                title: "Suspended",
                description: "Suspended",
                capabilityIds: ["suspended.entry"],
                server: descriptor,
            };
            if (!options.compatibility(fake).supported)
                return unsupportedDefinition();
            return options.descriptorToDefinition(fake);
        },
        inspect: ({ source, serverName, counters }) => parseAndInspect(source, serverName, counters, "source", parseOptions, inspectionOwner),
        constructPatch: (request) => constructPatch(request, parseOptions, inspectionOwner),
    });
}
export function jsonDefinition(definition, toggleStrategy) {
    return toggleStrategy === "native-enabled"
        ? freezeDefinition(definition)
        : freezeDetachedDefinition(definition);
}
//# sourceMappingURL=json-target-adapter.js.map