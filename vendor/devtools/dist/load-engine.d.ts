import type { CapabilityDescription, CapabilitySummary, InvokeOptions } from "@senda/core";
/**
 * The structural engine surface the devtools operates on. Loading is dynamic,
 * so the concrete `Engine<Capabilities>` type parameter is unavailable; the
 * public method surface is the contract.
 */
export interface LoadedEngine {
    readonly name: string;
    readonly version: string;
    invoke(capabilityId: string, input: unknown, options?: InvokeOptions): Promise<unknown>;
    list(): ReadonlyArray<CapabilitySummary>;
    describe(capabilityId: string): CapabilityDescription;
}
export type LoadEngineResult = {
    readonly kind: "loaded";
    readonly engine: LoadedEngine;
    readonly namespace: object;
} | {
    readonly kind: "load-failed";
    readonly error: unknown;
} | {
    readonly kind: "export-missing";
} | {
    readonly kind: "not-an-engine";
};
export interface LoadEngineOptions {
    readonly moduleSpecifier: string;
    readonly exportName: string;
    readonly cwd: string;
}
/** Whether the module also exposes a tracked composed `capabilities` export. */
export declare function hasComposedCapabilitiesExport(namespace: object): boolean;
export declare function loadEngineModule(options: LoadEngineOptions): Promise<LoadEngineResult>;
//# sourceMappingURL=load-engine.d.ts.map