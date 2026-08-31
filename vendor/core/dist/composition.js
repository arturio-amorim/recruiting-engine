import { types as nodeUtilTypes } from "node:util";
import { CapabilityCompositionError, } from "./composition-error.js";
const exportedCapabilityBrand = Symbol.for("@senda/core.exportedCapability");
const capabilityLibraryBrand = Symbol.for("@senda/core.capabilityLibrary");
const capabilityImportBrand = Symbol.for("@senda/core.capabilityImport");
const composedCapabilitiesBrand = Symbol.for("@senda/core.composedCapabilities");
function rejectProxy(value, description) {
    if (nodeUtilTypes.isProxy(value)) {
        throw new TypeError(`${description} must not be a proxy.`);
    }
}
/**
 * Composition inputs are user-supplied objects, so every property is read once
 * into a local: a getter re-invoked later could report a different ID than the
 * one that was validated.
 */
function readOnce(target, key) {
    let current = target;
    while (current !== null) {
        rejectProxy(current, "A composition descriptor");
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (descriptor !== undefined) {
            if ("value" in descriptor)
                return descriptor.value;
            const getter = descriptor.get;
            return getter === undefined
                ? undefined
                : Reflect.apply(getter, target, []);
        }
        current = Object.getPrototypeOf(current);
    }
    return undefined;
}
function readRecord(value, description) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError(`${description} must be an object.`);
    }
    rejectProxy(value, description);
    return value;
}
function readNonEmptyString(value, description) {
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError(`${description} must be a non-empty string.`);
    }
    return value;
}
function hasBrand(value, brand) {
    if (typeof value !== "object" || value === null)
        return false;
    if (nodeUtilTypes.isProxy(value))
        return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, brand);
    return descriptor !== undefined && descriptor.value === true;
}
function brand(value, key) {
    Object.defineProperty(value, key, {
        value: true,
        enumerable: false,
        writable: false,
        configurable: false,
    });
    return value;
}
function snapshotCapabilityMap(value, description) {
    const source = readRecord(value, description);
    const ids = [];
    const capabilities = {};
    for (const id of Object.keys(source)) {
        const capability = readOnce(source, id);
        if (capability === undefined)
            continue;
        ids.push(id);
        capabilities[id] = capability;
    }
    return {
        ids: Object.freeze(ids),
        capabilities: Object.freeze(capabilities),
    };
}
export function defineExportedCapability(definition) {
    const target = readRecord(definition, "An exported capability definition");
    const source = readRecord(readOnce(target, "source"), "Exported capability source metadata");
    const name = readNonEmptyString(readOnce(source, "name"), "An exported capability source name");
    const version = readOnce(source, "version");
    if (version !== undefined) {
        readNonEmptyString(version, "An exported capability source version");
    }
    const defaultId = readNonEmptyString(readOnce(target, "defaultId"), "An exported capability default ID");
    const capability = readOnce(target, "capability");
    if (typeof capability !== "object" || capability === null) {
        throw new TypeError("An exported capability must be an object.");
    }
    const descriptor = {
        source: Object.freeze(version === undefined ? { name } : { name, version: version }),
        defaultId,
        capability,
    };
    return Object.freeze(brand(descriptor, exportedCapabilityBrand));
}
export function defineCapabilityLibrary(definition) {
    const target = readRecord(definition, "A capability library definition");
    const name = readNonEmptyString(readOnce(target, "name"), "A capability library name");
    const version = readNonEmptyString(readOnce(target, "version"), "A capability library version");
    const snapshot = snapshotCapabilityMap(readOnce(target, "capabilities"), "A capability library capability map");
    const descriptor = {
        name,
        version,
        capabilities: snapshot.capabilities,
        defaultIds: snapshot.ids,
    };
    return Object.freeze(brand(descriptor, capabilityLibraryBrand));
}
function createImportRecord(record) {
    return Object.freeze(brand(record, capabilityImportBrand));
}
export function importCapability(exported, options) {
    let effectiveId;
    if (options !== undefined) {
        const target = readRecord(options, "Atomic import options");
        effectiveId = readNonEmptyString(readOnce(target, "as"), "An atomic import effective ID");
    }
    if (!hasBrand(exported, exportedCapabilityBrand)) {
        return createImportRecord({
            kind: "atomic",
            valid: false,
        });
    }
    const descriptor = exported;
    const source = readRecord(readOnce(descriptor, "source"), "Exported capability source metadata");
    const sourceName = readNonEmptyString(readOnce(source, "name"), "An exported capability source name");
    const sourceVersion = readOnce(source, "version");
    const defaultId = readNonEmptyString(readOnce(descriptor, "defaultId"), "An exported capability default ID");
    const capability = readOnce(descriptor, "capability");
    return createImportRecord({
        kind: "atomic",
        valid: true,
        effectiveId: effectiveId ?? defaultId,
        capability,
        provenance: Object.freeze({
            kind: "atomic",
            sourceName,
            ...(sourceVersion === undefined
                ? {}
                : {
                    sourceVersion: readNonEmptyString(sourceVersion, "An exported capability source version"),
                }),
            defaultId,
        }),
    });
}
function readIncludeList(value) {
    if (!Array.isArray(value)) {
        throw new TypeError("A library import include list must be an array.");
    }
    rejectProxy(value, "A library import include list");
    const include = [];
    for (let index = 0; index < value.length; index += 1) {
        include.push(readNonEmptyString(value[index], "A library import include entry"));
    }
    return Object.freeze(include);
}
function readRemapTable(value) {
    const source = readRecord(value, "A library import remap table");
    const remap = {};
    for (const defaultId of Object.keys(source)) {
        const target = readOnce(source, defaultId);
        if (target === undefined)
            continue;
        remap[defaultId] = readNonEmptyString(target, "A library import remap target");
    }
    return Object.freeze(remap);
}
export function importCapabilities(library, options) {
    if (!hasBrand(library, capabilityLibraryBrand)) {
        throw new TypeError("A library import requires a defineCapabilityLibrary descriptor.");
    }
    const descriptor = library;
    const libraryName = readNonEmptyString(readOnce(descriptor, "name"), "A capability library name");
    const libraryVersion = readNonEmptyString(readOnce(descriptor, "version"), "A capability library version");
    const snapshot = snapshotCapabilityMap(readOnce(descriptor, "capabilities"), "A capability library capability map");
    let include;
    let remap;
    if (options !== undefined) {
        const target = readRecord(options, "Library import options");
        const rawInclude = readOnce(target, "include");
        if (rawInclude !== undefined)
            include = readIncludeList(rawInclude);
        const rawRemap = readOnce(target, "remap");
        if (rawRemap !== undefined)
            remap = readRemapTable(rawRemap);
    }
    return createImportRecord({
        kind: "library",
        libraryName,
        libraryVersion,
        defaultIds: snapshot.ids,
        capabilities: snapshot.capabilities,
        ...(include === undefined ? {} : { include }),
        ...(remap === undefined ? {} : { remap }),
    });
}
function compareCodeUnits(left, right) {
    if (left === right)
        return 0;
    return left < right ? -1 : 1;
}
function collectLocalDeclarations(local, effectiveIds, declarations) {
    if (local === undefined)
        return;
    const source = readRecord(local, "A local capability map");
    for (const localId of Object.keys(source)) {
        const capability = readOnce(source, localId);
        if (capability === undefined)
            continue;
        pushDeclaration(effectiveIds, declarations, localId, {
            capability: capability,
            provenance: { kind: "local", localId },
        });
    }
}
function pushDeclaration(effectiveIds, declarations, effectiveId, declaration) {
    const existing = declarations.get(effectiveId);
    if (existing === undefined) {
        effectiveIds.push(effectiveId);
        declarations.set(effectiveId, [declaration]);
        return;
    }
    existing.push(declaration);
}
function collectLibraryDeclarations(record, effectiveIds, declarations, issues) {
    const defaultIds = record.defaultIds;
    const known = new Set(defaultIds);
    const include = record.include;
    const selected = include === undefined ? undefined : new Set();
    if (include !== undefined && selected !== undefined) {
        for (let index = 0; index < include.length; index += 1) {
            const defaultId = include[index];
            if (known.has(defaultId))
                selected.add(defaultId);
            else {
                issues.push({
                    code: "CAPABILITY_IMPORT_ID_NOT_FOUND",
                    libraryName: record.libraryName,
                    defaultId,
                });
            }
        }
    }
    const remap = record.remap;
    if (remap !== undefined) {
        for (const defaultId of Object.keys(remap)) {
            if (!known.has(defaultId)) {
                issues.push({
                    code: "CAPABILITY_IMPORT_ID_NOT_FOUND",
                    libraryName: record.libraryName,
                    defaultId,
                });
            }
            else if (selected !== undefined && !selected.has(defaultId)) {
                issues.push({
                    code: "CAPABILITY_REMAP_NOT_SELECTED",
                    libraryName: record.libraryName,
                    defaultId,
                });
            }
        }
    }
    for (let index = 0; index < defaultIds.length; index += 1) {
        const defaultId = defaultIds[index];
        if (selected !== undefined && !selected.has(defaultId))
            continue;
        const capability = record.capabilities[defaultId];
        if (capability === undefined)
            continue;
        pushDeclaration(effectiveIds, declarations, remap?.[defaultId] ?? defaultId, {
            capability,
            provenance: {
                kind: "library",
                libraryName: record.libraryName,
                libraryVersion: record.libraryVersion,
                defaultId,
            },
        });
    }
}
function collectImportDeclarations(imports, effectiveIds, declarations, issues) {
    if (imports === undefined)
        return;
    if (!Array.isArray(imports)) {
        throw new TypeError("Composition imports must be an array.");
    }
    rejectProxy(imports, "Composition imports");
    for (let index = 0; index < imports.length; index += 1) {
        const entry = imports[index];
        if (!hasBrand(entry, capabilityImportBrand)) {
            throw new TypeError("Every composition import must be created by importCapability or importCapabilities.");
        }
        const record = entry;
        if (record.kind === "atomic") {
            if (!record.valid) {
                issues.push({
                    code: "CAPABILITY_IMPORT_INVALID",
                    importKind: "atomic",
                    reason: "EXPORTED_CAPABILITY_REQUIRED",
                });
                continue;
            }
            pushDeclaration(effectiveIds, declarations, record.effectiveId, {
                capability: record.capability,
                provenance: record.provenance,
            });
            continue;
        }
        collectLibraryDeclarations(record, effectiveIds, declarations, issues);
    }
}
export function composeCapabilities(declaration) {
    const target = readRecord(declaration, "A capability composition");
    const effectiveIds = [];
    const declarations = new Map();
    const issues = [];
    collectLocalDeclarations(readOnce(target, "local"), effectiveIds, declarations);
    collectImportDeclarations(readOnce(target, "imports"), effectiveIds, declarations, issues);
    const collided = [];
    for (let index = 0; index < effectiveIds.length; index += 1) {
        const effectiveId = effectiveIds[index];
        if ((declarations.get(effectiveId)?.length ?? 0) > 1) {
            collided.push(effectiveId);
        }
    }
    if (collided.length > 0 || issues.length > 0) {
        collided.sort(compareCodeUnits);
        const collisions = collided.map((effectiveId) => ({
            code: "CAPABILITY_ID_COLLISION",
            effectiveId,
            declarations: declarations.get(effectiveId).map((entry) => entry.provenance),
        }));
        throw new CapabilityCompositionError([...collisions, ...issues]);
    }
    const composed = {};
    for (let index = 0; index < effectiveIds.length; index += 1) {
        const effectiveId = effectiveIds[index];
        const group = declarations.get(effectiveId);
        if (group === undefined)
            continue;
        composed[effectiveId] = group[0].capability;
    }
    return Object.freeze(brand(composed, composedCapabilitiesBrand));
}
export function isComposedCapabilities(value) {
    return hasBrand(value, composedCapabilitiesBrand);
}
//# sourceMappingURL=composition.js.map