import { parseTOML } from "toml-eslint-parser";
import { InstallerError } from "./installer-error.js";
import { assertPostImageDefinition, assertServerName, assertTargetInspectionConsistency, decodeTargetSource, encodeTargetPostImage, finalizeInspectedMcpDefinition, freezeDefinition, frozenTargetInspection, inspectedJsonArray, inspectedJsonRecord, inspectedJsonScalar, inspectionPass, parsePass, patchPass, targetInspectionStateFor, unsupportedDefinition, } from "./target-adapter.js";
function invalid(cause) {
    throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
}
function keySegments(key) {
    return key.keys.map((part) => part.type === "TOMLBare" ? part.name : part.value);
}
function samePath(left, right) {
    return (left.length === right.length &&
        left.every((segment, index) => segment === right[index]));
}
function startsWithPath(path, prefix) {
    return (path.length >= prefix.length &&
        prefix.every((segment, index) => segment === path[index]));
}
function bareTomlKey(value) {
    return /^[A-Za-z0-9_-]+$/u.test(value) ? value : JSON.stringify(value);
}
function checkedDepth(depth) {
    if (depth > 100)
        invalid();
    return depth;
}
function recordDraft(path, postorder) {
    const draft = { kind: "draft", path, fields: new Map() };
    postorder.push(draft);
    return draft;
}
function normalizedDraftKey(draft, key, selectedPath, httpHeadersField) {
    return samePath(draft.path, [...selectedPath, httpHeadersField])
        ? key.toLowerCase()
        : key;
}
function prepareDraftPath(root, path, selectedPath, httpHeadersField, postorder) {
    if (path.length === 0)
        invalid();
    let current = root;
    for (const rawSegment of path.slice(0, -1)) {
        const segment = normalizedDraftKey(current, rawSegment, selectedPath, httpHeadersField);
        const existing = current.fields.get(segment);
        if (existing === undefined) {
            const child = recordDraft([...current.path, rawSegment], postorder);
            checkedDepth(child.path.length + 1);
            current.fields.set(segment, child);
            current = child;
        }
        else if (existing.kind === "draft")
            current = existing;
        else
            invalid();
    }
    const rawKey = path.at(-1);
    const key = normalizedDraftKey(current, rawKey, selectedPath, httpHeadersField);
    if (current.fields.has(key))
        invalid();
    const pending = { kind: "pending" };
    current.fields.set(key, pending);
    return (value) => {
        if (pending.value !== undefined)
            invalid();
        pending.value = value;
    };
}
function aggregateDraftsPostorder(postorder, selectedPath) {
    for (let index = postorder.length - 1; index >= 0; index -= 1) {
        const draft = postorder[index];
        const fields = new Map();
        for (const [key, field] of draft.fields) {
            fields.set(key, field.kind === "draft"
                ? (field.completed ?? invalid())
                : (field.value ?? invalid()));
        }
        draft.completed = inspectedJsonRecord(fields, startsWithPath(draft.path, selectedPath), samePath(draft.path, selectedPath));
    }
    return postorder[0]?.completed ?? invalid();
}
function decodeTomlValue(rootNode, collectionDepth, absolutePath, inspectPair, selectedPath, httpHeadersField, captureSelectedServer) {
    let result;
    const stack = [
        {
            kind: "visit",
            node: rootNode,
            depth: collectionDepth,
            path: absolutePath,
            assign: (value) => {
                result = value;
            },
        },
    ];
    while (stack.length > 0) {
        const task = stack.pop();
        if (task.kind === "finish-array") {
            task.assign(inspectedJsonArray(task.items, startsWithPath(task.path, selectedPath)));
            continue;
        }
        if (task.kind === "finish-table") {
            const inspected = aggregateDraftsPostorder(task.postorder, selectedPath);
            if (samePath(task.path, selectedPath))
                captureSelectedServer(inspected);
            task.assign(inspected);
            continue;
        }
        const { node, depth, path, assign } = task;
        if (node.type === "TOMLValue") {
            let scalar = node.kind === "integer" ? node.bigint : node.value;
            if (typeof scalar === "bigint" && startsWithPath(path, selectedPath)) {
                if (scalar > BigInt(Number.MAX_SAFE_INTEGER) ||
                    scalar < BigInt(Number.MIN_SAFE_INTEGER)) {
                    invalid();
                }
                scalar = Number(scalar);
            }
            assign(inspectedJsonScalar(scalar, startsWithPath(path, selectedPath)));
            continue;
        }
        checkedDepth(depth);
        if (node.type === "TOMLArray") {
            const items = new Array(node.elements.length);
            stack.push({ kind: "finish-array", path, items, assign });
            for (let index = node.elements.length - 1; index >= 0; index -= 1) {
                const child = node.elements[index];
                stack.push({
                    kind: "visit",
                    node: child,
                    depth: child.type === "TOMLArray" || child.type === "TOMLInlineTable"
                        ? depth + 1
                        : depth,
                    path,
                    assign: (value) => {
                        items[index] = value;
                    },
                });
            }
            continue;
        }
        const postorder = [];
        const draft = recordDraft(path, postorder);
        stack.push({ kind: "finish-table", path, postorder, assign });
        for (let index = node.body.length - 1; index >= 0; index -= 1) {
            const pair = node.body[index];
            const relativePath = keySegments(pair.key);
            checkedDepth(depth + relativePath.length - 1);
            const childPath = [...path, ...relativePath];
            inspectPair(pair, childPath, false);
            const child = pair.value;
            const assignChild = prepareDraftPath(draft, relativePath, selectedPath, httpHeadersField, postorder);
            stack.push({
                kind: "visit",
                node: child,
                depth: child.type === "TOMLArray" || child.type === "TOMLInlineTable"
                    ? checkedDepth(depth + relativePath.length)
                    : depth,
                path: childPath,
                assign: assignChild,
            });
        }
    }
    return result ?? invalid();
}
function inspectTomlAst(ast, serverName, dialect) {
    const selectedPath = ["mcp_servers", serverName];
    const httpHeadersField = dialect === "codex" ? "env_http_headers" : "headers";
    const serverPostorder = [];
    const serverDraft = recordDraft(selectedPath, serverPostorder);
    let serverValue;
    let serverPresent = false;
    let parentInline;
    let serverInline;
    let serverTable;
    let dottedInsertion;
    let enabledValue;
    let serverRemovalRange;
    const inspectPair = (pair, absolutePath, topLevelPair) => {
        if (samePath(absolutePath, ["mcp_servers"])) {
            if (pair.value.type !== "TOMLInlineTable")
                invalid();
            parentInline = pair.value;
        }
        if (samePath(absolutePath, selectedPath)) {
            if (pair.value.type !== "TOMLInlineTable")
                invalid();
            serverInline = pair.value;
            serverPresent = true;
        }
        if (samePath(absolutePath, [...selectedPath, "enabled"])) {
            enabledValue = pair.value;
        }
        if (topLevelPair &&
            startsWithPath(absolutePath, selectedPath) &&
            absolutePath.length > selectedPath.length) {
            const tablePath = pair.parent.type === "TOMLTable"
                ? pair.parent.resolvedKey.map(String)
                : [];
            const selectedRelative = selectedPath.slice(tablePath.length);
            if (selectedRelative.length > 0) {
                dottedInsertion = {
                    pair,
                    enabledKey: [...selectedRelative, "enabled"]
                        .map(bareTomlKey)
                        .join("."),
                };
            }
        }
        if (startsWithPath(absolutePath, selectedPath) &&
            absolutePath.length > selectedPath.length) {
            serverPresent = true;
        }
    };
    const captureSelectedServer = (value) => {
        if (serverValue !== undefined)
            invalid();
        serverValue = value;
        serverPresent = true;
    };
    for (const [itemIndex, item] of ast.body[0].body.entries()) {
        if (item.type === "TOMLTable") {
            const tablePath = item.resolvedKey.map(String);
            checkedDepth(1 + tablePath.length);
            if ((samePath(tablePath, ["mcp_servers"]) ||
                startsWithPath(tablePath, selectedPath)) &&
                item.kind !== "standard") {
                invalid();
            }
            if (samePath(tablePath, selectedPath)) {
                serverTable = item;
                serverPresent = true;
                const following = ast.body[0].body[itemIndex + 1];
                serverRemovalRange = [
                    item.range[0],
                    following?.range[0] ?? Number.POSITIVE_INFINITY,
                ];
            }
            else if (startsWithPath(tablePath, selectedPath)) {
                serverPresent = true;
            }
            for (const pair of item.body) {
                const relativePath = keySegments(pair.key);
                const absolutePath = [...tablePath, ...relativePath];
                checkedDepth(absolutePath.length);
                inspectPair(pair, absolutePath, true);
                const child = decodeTomlValue(pair.value, 1 + absolutePath.length, absolutePath, inspectPair, selectedPath, httpHeadersField, captureSelectedServer);
                if (startsWithPath(absolutePath, selectedPath) &&
                    absolutePath.length > selectedPath.length) {
                    const assignChild = prepareDraftPath(serverDraft, absolutePath.slice(selectedPath.length), selectedPath, httpHeadersField, serverPostorder);
                    assignChild(child);
                }
            }
        }
        else {
            const relativePath = keySegments(item.key);
            checkedDepth(relativePath.length);
            inspectPair(item, relativePath, true);
            const child = decodeTomlValue(item.value, 1 + relativePath.length, relativePath, inspectPair, selectedPath, httpHeadersField, captureSelectedServer);
            if (startsWithPath(relativePath, selectedPath) &&
                relativePath.length > selectedPath.length) {
                const assignChild = prepareDraftPath(serverDraft, relativePath.slice(selectedPath.length), selectedPath, httpHeadersField, serverPostorder);
                assignChild(child);
            }
        }
    }
    if (serverPresent && serverValue === undefined) {
        serverValue = aggregateDraftsPostorder(serverPostorder, selectedPath);
    }
    return {
        serverValue,
        parentInline,
        serverInline,
        serverTable,
        dottedInsertion,
        enabledValue,
        serverRemovalRange,
    };
}
function parseAndInspect(sourceBytes, serverName, counters, phase, dialect, inspectionOwner) {
    assertServerName(serverName);
    const source = decodeTargetSource(sourceBytes, counters, phase);
    if (source.missing) {
        if (phase === "source")
            inspectionPass(counters);
        return frozenTargetInspection({ kind: "absent" }, {
            dialect,
            source,
            serverName,
            parentInline: undefined,
            serverInline: undefined,
            serverTable: undefined,
            dottedInsertion: undefined,
            enabledValue: undefined,
            serverRemovalRange: undefined,
        }, undefined, inspectionOwner);
    }
    parsePass(counters, phase);
    let ast;
    let astInspection;
    try {
        ast = parseTOML(source.text, { tomlVersion: "1.0.0" });
        astInspection = inspectTomlAst(ast, serverName, dialect);
    }
    catch (cause) {
        if (cause instanceof InstallerError)
            throw cause;
        return invalid(cause);
    }
    const finalized = astInspection.serverValue === undefined
        ? undefined
        : finalizeInspectedMcpDefinition(astInspection.serverValue, {
            stdioEnvironmentField: dialect === "codex" ? "env_vars" : "env",
            stdioEnvironmentKind: dialect === "codex" ? "array" : "object",
            httpHeadersField: dialect === "codex" ? "env_http_headers" : "headers",
            rawTransportPolicy: "reject",
        });
    if (phase === "source")
        inspectionPass(counters);
    return frozenTargetInspection(finalized === undefined
        ? { kind: "absent" }
        : { kind: "present", definition: finalized.definition }, {
        dialect,
        source,
        serverName,
        ...astInspection,
    }, finalized?.canonicals, inspectionOwner);
}
function tomlString(value) {
    return JSON.stringify(value);
}
function renderTomlArray(values) {
    if (values.some((value) => typeof value !== "string"))
        invalid();
    return `[${values.map((value) => tomlString(value)).join(", ")}]`;
}
function renderTomlStringRecord(value, capitalizeAuthorization = false) {
    if (typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        Object.values(value).some((entry) => typeof entry !== "string")) {
        invalid();
    }
    const fields = Object.entries(value).map(([name, fieldValue]) => {
        const renderedName = capitalizeAuthorization && name === "authorization"
            ? "Authorization"
            : name;
        return `${tomlString(renderedName)} = ${tomlString(fieldValue)}`;
    });
    return `{ ${fields.join(", ")} }`;
}
function configFields(definition, dialect) {
    const fields = [];
    if (definition.transport === "stdio" &&
        typeof definition.command === "string" &&
        Array.isArray(definition.args)) {
        fields.push(["command", tomlString(definition.command)]);
        fields.push(["args", renderTomlArray(definition.args)]);
        if (dialect === "codex") {
            if (Array.isArray(definition.env_vars) &&
                definition.env_vars.length > 0) {
                fields.push(["env_vars", renderTomlArray(definition.env_vars)]);
            }
        }
        else if (typeof definition.env === "object" &&
            definition.env !== null &&
            !Array.isArray(definition.env) &&
            Object.keys(definition.env).length > 0) {
            fields.push(["env", renderTomlStringRecord(definition.env)]);
        }
    }
    else if (definition.transport === "streamable-http" &&
        typeof definition.url === "string") {
        fields.push(["url", tomlString(definition.url)]);
        if (dialect === "codex" &&
            typeof definition.bearer_token_env_var === "string") {
            fields.push([
                "bearer_token_env_var",
                tomlString(definition.bearer_token_env_var),
            ]);
        }
        if (dialect === "codex" &&
            typeof definition.env_http_headers === "object" &&
            definition.env_http_headers !== null &&
            !Array.isArray(definition.env_http_headers) &&
            Object.keys(definition.env_http_headers).length > 0) {
            const headers = Object.entries(definition.env_http_headers)
                .map(([name, environment]) => `${tomlString(name)} = ${tomlString(environment)}`)
                .join(", ");
            fields.push(["env_http_headers", `{ ${headers} }`]);
        }
        else if (dialect === "grok" &&
            typeof definition.headers === "object" &&
            definition.headers !== null &&
            !Array.isArray(definition.headers) &&
            Object.keys(definition.headers).length > 0) {
            fields.push([
                "headers",
                renderTomlStringRecord(definition.headers, true),
            ]);
        }
    }
    else
        invalid();
    fields.push(["enabled", String(definition.enabled)]);
    return fields;
}
function renderDefinition(serverName, definition, newline, dialect) {
    return [
        `[mcp_servers.${bareTomlKey(serverName)}]`,
        ...configFields(definition, dialect).map(([name, value]) => `${name} = ${value}`),
    ].join(newline);
}
function renderInlineDefinition(definition, dialect) {
    return `{ ${configFields(definition, dialect)
        .map(([name, value]) => `${name} = ${value}`)
        .join(", ")} }`;
}
function appendSection(source, section) {
    if (source.missing || source.text.length === 0)
        return `${section}\n`;
    const withoutTrailing = source.text.replace(/(?:\r?\n)+$/u, "");
    const result = `${withoutTrailing}${source.newline}${source.newline}${section}`;
    return source.trailingNewline ? `${result}${source.newline}` : result;
}
function insertInlinePair(text, table, key, value) {
    const close = table.range[1] - 1;
    if (text[close] !== "}")
        invalid();
    const separator = table.body.length === 0 ? " " : ", ";
    const suffix = table.body.length === 0 ? " " : "";
    return `${text.slice(0, close)}${separator}${bareTomlKey(key)} = ${value}${suffix}${text.slice(close)}`;
}
function insertAfterLine(source, offset, line) {
    const newlineOffset = source.text.indexOf("\n", offset);
    if (newlineOffset < 0) {
        return `${source.text}${source.newline}${line}`;
    }
    const insertion = newlineOffset + 1;
    return `${source.text.slice(0, insertion)}${line}${source.newline}${source.text.slice(insertion)}`;
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
function validateGrokDefinition(definition) {
    const stdio = definition.transport === "stdio";
    const http = definition.transport === "streamable-http";
    if (!stdio && !http)
        invalid();
    const allowed = new Set(stdio
        ? ["transport", "command", "args", "env", "enabled"]
        : ["transport", "url", "headers", "enabled"]);
    if (Object.keys(definition).some((key) => !allowed.has(key)) ||
        typeof definition.enabled !== "boolean") {
        invalid();
    }
    if (stdio) {
        if (typeof definition.command !== "string" ||
            !Array.isArray(definition.args) ||
            definition.args.some((argument) => typeof argument !== "string") ||
            typeof definition.env !== "object" ||
            definition.env === null ||
            Array.isArray(definition.env) ||
            !Object.entries(definition.env).every(([name, placeholder]) => environmentNamePattern.test(name) && placeholder === `\${${name}}`)) {
            invalid();
        }
        return;
    }
    if (typeof definition.url !== "string" ||
        typeof definition.headers !== "object" ||
        definition.headers === null ||
        Array.isArray(definition.headers) ||
        !Object.entries(definition.headers).every(([name, placeholder]) => {
            if (name !== name.toLowerCase() ||
                !httpFieldNamePattern.test(name) ||
                reservedHeaderNames.has(name) ||
                typeof placeholder !== "string") {
                return false;
            }
            return name === "authorization"
                ? /^(?:Bearer )?\$\{[A-Z_][A-Z0-9_]{0,127}\}$/u.test(placeholder)
                : /^\$\{[A-Z_][A-Z0-9_]{0,127}\}$/u.test(placeholder);
        })) {
        invalid();
    }
}
function constructPatch(request, dialect, inspectionOwner) {
    assertTargetInspectionConsistency(request.inspection);
    const state = targetInspectionStateFor(request.inspection, inspectionOwner);
    if (state.dialect !== dialect)
        invalid();
    if (request.action === "install") {
        if (request.inspection.currentServer.kind === "present") {
            throw new InstallerError("CONFIG_CONFLICT");
        }
        if (dialect === "grok")
            validateGrokDefinition(request.definition);
    }
    else if (request.action === "remove") {
        if (request.inspection.currentServer.kind !== "present" ||
            state.serverRemovalRange === undefined) {
            invalid();
        }
    }
    else {
        if (request.inspection.currentServer.kind !== "present")
            invalid();
        const desired = request.action === "enable";
        if (request.inspection.currentServer.definition.enabled === desired) {
            return { kind: "unchanged" };
        }
    }
    patchPass(request.counters);
    let postText;
    if (request.action === "install") {
        if (state.parentInline !== undefined) {
            postText = insertInlinePair(state.source.text, state.parentInline, state.serverName, renderInlineDefinition(request.definition, dialect));
        }
        else {
            postText = appendSection(state.source, renderDefinition(state.serverName, request.definition, state.source.newline, dialect));
        }
    }
    else if (request.action === "remove") {
        if (state.serverRemovalRange === undefined)
            invalid();
        const [start, rawEnd] = state.serverRemovalRange;
        const lineStart = state.source.text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const end = Math.min(rawEnd, state.source.text.length);
        postText = `${state.source.text.slice(0, lineStart)}${state.source.text.slice(end)}`;
    }
    else {
        const desired = request.action === "enable";
        if (state.enabledValue !== undefined) {
            postText = `${state.source.text.slice(0, state.enabledValue.range[0])}${String(desired)}${state.source.text.slice(state.enabledValue.range[1])}`;
        }
        else if (state.serverInline !== undefined) {
            postText = insertInlinePair(state.source.text, state.serverInline, "enabled", String(desired));
        }
        else if (state.serverTable !== undefined) {
            const anchor = state.serverTable.body.at(-1) ?? state.serverTable;
            postText = insertAfterLine(state.source, anchor.range[1], `enabled = ${String(desired)}`);
        }
        else if (state.dottedInsertion !== undefined) {
            postText = insertAfterLine(state.source, state.dottedInsertion.pair.range[1], `${state.dottedInsertion.enabledKey} = ${String(desired)}`);
        }
        else
            invalid();
    }
    const postImage = encodeTargetPostImage(postText, state.source.bom, request.counters);
    const postInspection = parseAndInspect(postImage, state.serverName, request.counters, "post-image", dialect, inspectionOwner);
    assertPostImageDefinition(request, postInspection);
    return { kind: "changed", postImage };
}
export function createTomlTargetAdapter(options) {
    const inspectionOwner = Object.freeze({});
    return Object.freeze({
        metadata: Object.freeze({
            targetId: options.targetId,
            targetContractVersion: 1,
            format: "toml",
            parentPath: Object.freeze(["mcp_servers"]),
            toggleStrategy: "native-enabled",
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
        inspect: ({ source, serverName, counters }) => parseAndInspect(source, serverName, counters, "source", options.dialect, inspectionOwner),
        constructPatch: (request) => constructPatch(request, options.dialect, inspectionOwner),
    });
}
export function tomlDefinition(definition) {
    return freezeDefinition(definition);
}
//# sourceMappingURL=toml-target-adapter.js.map