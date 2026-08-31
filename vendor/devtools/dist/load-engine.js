import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isComposedCapabilities } from "@senda/core";
import { asRecord } from "./diagnostics.js";
function readExport(namespace, exportName) {
    try {
        if (!Object.hasOwn(namespace, exportName)) {
            return { found: false, value: undefined };
        }
        return {
            found: true,
            value: namespace[exportName],
        };
    }
    catch {
        // An uninitialized binding is indistinguishable from an absent one here,
        // and both are an unusable build input.
        return { found: false, value: undefined };
    }
}
function isEngineLike(value) {
    try {
        const record = asRecord(value);
        if (record === undefined)
            return false;
        return (typeof record.name === "string" &&
            typeof record.version === "string" &&
            typeof record.invoke === "function" &&
            typeof record.list === "function" &&
            typeof record.describe === "function");
    }
    catch {
        return false;
    }
}
/** Whether the module also exposes a tracked composed `capabilities` export. */
export function hasComposedCapabilitiesExport(namespace) {
    try {
        if (!Object.hasOwn(namespace, "capabilities"))
            return false;
        return isComposedCapabilities(namespace.capabilities);
    }
    catch {
        return false;
    }
}
export async function loadEngineModule(options) {
    // A bare relative specifier would resolve against this package rather than
    // the application being inspected, so it becomes an explicit file URL first.
    const moduleUrl = pathToFileURL(resolve(options.cwd, options.moduleSpecifier));
    let namespace;
    try {
        namespace = (await import(moduleUrl.href));
    }
    catch (error) {
        return { kind: "load-failed", error };
    }
    const selected = readExport(namespace, options.exportName);
    if (!selected.found)
        return { kind: "export-missing" };
    if (!isEngineLike(selected.value))
        return { kind: "not-an-engine" };
    return { kind: "loaded", engine: selected.value, namespace };
}
//# sourceMappingURL=load-engine.js.map