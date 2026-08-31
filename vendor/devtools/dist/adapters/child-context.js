import { describeThrownValue } from "../diagnostics.js";
import { loadEngineModule } from "../load-engine.js";
/**
 * Shared setup for the adapter child processes. Each child imports the same
 * explicitly named built module the developer passed to `serve` and then calls
 * one published adapter, so the emulated call is the adapter's own behavior
 * rather than a reimplementation of it.
 */
/** Carries the selected development principal into the child process. */
export const principalEnvironmentName = "SENDA_DEVTOOLS_PRINCIPAL";
/** Exit code for an unusable invocation request or an unloadable module. */
export const childUsageExitCode = 2;
/**
 * Reads the development principal the parent selected. An absent or malformed
 * value means an anonymous call, which is what an adapter sees when a
 * composition root supplies no principal.
 */
export function readChildPrincipal() {
    const encoded = process.env[principalEnvironmentName];
    if (encoded === undefined || encoded === "")
        return null;
    try {
        const parsed = JSON.parse(encoded);
        if (typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)) {
            return null;
        }
        const record = parsed;
        if (typeof record.id !== "string" || record.id === "")
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
/**
 * Presents the dynamically loaded engine as the nominal `Engine` type the
 * published adapters accept. The module surface is verified structurally by
 * `loadEngineModule`; the concrete capability map is unavailable to a dynamic
 * import, so the invocation types are widened rather than narrowed.
 */
export function toEngine(loaded) {
    return {
        name: loaded.name,
        version: loaded.version,
        list: () => loaded.list(),
        describe: (capabilityId) => loaded.describe(capabilityId),
        invoke: (capabilityId, input, options) => loaded.invoke(capabilityId, input, options),
    };
}
export function readChildEngineArguments(argv) {
    const [moduleSpecifier, exportName, ...rest] = argv;
    if (moduleSpecifier === undefined ||
        moduleSpecifier === "" ||
        exportName === undefined ||
        exportName === "") {
        return undefined;
    }
    return { moduleSpecifier, exportName, rest };
}
/**
 * Loads the engine for a child adapter. A failure is reported on stderr in the
 * same stack-free shape the doctor uses and terminates the child, because an
 * adapter cannot report a load failure through its own protocol.
 */
export async function loadChildEngine(args) {
    const loaded = await loadEngineModule({
        moduleSpecifier: args.moduleSpecifier,
        exportName: args.exportName,
        cwd: process.cwd(),
    });
    if (loaded.kind === "loaded")
        return toEngine(loaded.engine);
    if (loaded.kind === "load-failed") {
        process.stderr.write(`The engine module could not be loaded. ${describeThrownValue(loaded.error)}\n`);
    }
    else if (loaded.kind === "export-missing") {
        process.stderr.write(`The export ${args.exportName} is missing from the engine module.\n`);
    }
    else {
        process.stderr.write(`The export ${args.exportName} is not an engine.\n`);
    }
    process.exit(childUsageExitCode);
}
//# sourceMappingURL=child-context.js.map