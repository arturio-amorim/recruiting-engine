import type { Engine, Principal } from "@senda/core";
import type { LoadedEngine } from "../load-engine.js";
/**
 * Shared setup for the adapter child processes. Each child imports the same
 * explicitly named built module the developer passed to `serve` and then calls
 * one published adapter, so the emulated call is the adapter's own behavior
 * rather than a reimplementation of it.
 */
/** Carries the selected development principal into the child process. */
export declare const principalEnvironmentName = "SENDA_DEVTOOLS_PRINCIPAL";
/** Exit code for an unusable invocation request or an unloadable module. */
export declare const childUsageExitCode = 2;
/**
 * Reads the development principal the parent selected. An absent or malformed
 * value means an anonymous call, which is what an adapter sees when a
 * composition root supplies no principal.
 */
export declare function readChildPrincipal(): Principal | null;
/**
 * Presents the dynamically loaded engine as the nominal `Engine` type the
 * published adapters accept. The module surface is verified structurally by
 * `loadEngineModule`; the concrete capability map is unavailable to a dynamic
 * import, so the invocation types are widened rather than narrowed.
 */
export declare function toEngine(loaded: LoadedEngine): Engine;
export interface ChildEngineArguments {
    readonly moduleSpecifier: string;
    readonly exportName: string;
    readonly rest: readonly string[];
}
export declare function readChildEngineArguments(argv: readonly string[]): ChildEngineArguments | undefined;
/**
 * Loads the engine for a child adapter. A failure is reported on stderr in the
 * same stack-free shape the doctor uses and terminates the child, because an
 * adapter cannot report a load failure through its own protocol.
 */
export declare function loadChildEngine(args: ChildEngineArguments): Promise<Engine>;
//# sourceMappingURL=child-context.d.ts.map