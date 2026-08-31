import type { ComposedEntries, CompositionDiagnostics, RemapDiagnostics, RemappedEntries, SelectedEntries } from "./composition-types.js";
import type { AnyCapability, CapabilityMap } from "./types.js";
declare const exportedCapabilityBrand: unique symbol;
declare const capabilityLibraryBrand: unique symbol;
declare const capabilityImportBrand: unique symbol;
declare const composedCapabilitiesBrand: unique symbol;
declare const capabilityImportEntries: unique symbol;
export interface CapabilitySource {
    readonly name: string;
    readonly version?: string;
}
export interface ExportedCapability<DefaultId extends string = string, Capability extends AnyCapability = AnyCapability> {
    readonly [exportedCapabilityBrand]: true;
    readonly source: CapabilitySource;
    readonly defaultId: DefaultId;
    readonly capability: Capability;
}
export interface CapabilityLibrary<Capabilities extends CapabilityMap = CapabilityMap> {
    readonly [capabilityLibraryBrand]: true;
    readonly name: string;
    readonly version: string;
    readonly capabilities: Capabilities;
}
export interface CapabilityImport<Entries extends CapabilityMap = CapabilityMap> {
    readonly [capabilityImportBrand]: true;
    readonly [capabilityImportEntries]: Entries;
}
export type AnyCapabilityImport = CapabilityImport<CapabilityMap>;
export type ComposedCapabilities<Capabilities extends CapabilityMap = CapabilityMap> = Capabilities & {
    readonly [composedCapabilitiesBrand]: true;
};
export declare function defineExportedCapability<const DefaultId extends string, const Capability extends AnyCapability>(definition: {
    readonly source: CapabilitySource;
    readonly defaultId: DefaultId;
    readonly capability: Capability;
}): ExportedCapability<DefaultId, Capability>;
export declare function defineCapabilityLibrary<const Capabilities extends CapabilityMap>(definition: {
    readonly name: string;
    readonly version: string;
    readonly capabilities: Capabilities;
}): CapabilityLibrary<Capabilities>;
export declare function importCapability<const DefaultId extends string, const Capability extends AnyCapability>(exported: ExportedCapability<DefaultId, Capability>): CapabilityImport<{
    readonly [Key in DefaultId]: Capability;
}>;
export declare function importCapability<const DefaultId extends string, const Capability extends AnyCapability, const As extends string>(exported: ExportedCapability<DefaultId, Capability>, options: {
    readonly as: As;
}): CapabilityImport<{
    readonly [Key in As]: Capability;
}>;
export declare function importCapabilities<const Capabilities extends CapabilityMap>(library: CapabilityLibrary<Capabilities>): CapabilityImport<Capabilities>;
export declare function importCapabilities<const Capabilities extends CapabilityMap, const Remap extends {
    readonly [Key in keyof Remap]: Key extends Extract<keyof Capabilities, string> ? string : never;
}>(library: CapabilityLibrary<Capabilities>, options: {
    readonly remap: Remap;
} & RemapDiagnostics<Remap>): CapabilityImport<RemappedEntries<Capabilities, Remap>>;
export declare function importCapabilities<const Capabilities extends CapabilityMap, const Include extends ReadonlyArray<Extract<keyof Capabilities, string>>, const Remap extends {
    readonly [Key in keyof Remap]: Key extends Include[number] ? string : never;
} = Record<never, never>>(library: CapabilityLibrary<Capabilities>, options: {
    readonly include: Include;
    readonly remap?: Remap;
} & RemapDiagnostics<Remap>): CapabilityImport<RemappedEntries<SelectedEntries<Capabilities, Include>, Remap>>;
export declare function composeCapabilities<const Local extends CapabilityMap = Record<never, AnyCapability>, const Imports extends readonly AnyCapabilityImport[] = readonly []>(declaration: {
    readonly local?: Local;
    readonly imports?: Imports;
} & CompositionDiagnostics<Local, Imports>): ComposedCapabilities<ComposedEntries<Local, Imports>>;
export declare function isComposedCapabilities(value: unknown): boolean;
export {};
//# sourceMappingURL=composition.d.ts.map