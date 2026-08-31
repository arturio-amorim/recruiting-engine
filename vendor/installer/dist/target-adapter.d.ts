import type { SuspendedDescriptor } from "./installer-state.js";
import { type ToggleStrategy } from "./jcs-fingerprint.js";
import type { CapabilityInstallDescriptor, ConfigurationTargetId, RegistryCompatibility } from "./registry.js";
export declare const targetConfigByteLimit = 4194304;
export interface TargetAdapterCounters {
    sourceDecodePasses: number;
    sourceParsePasses: number;
    inspectionPasses: number;
    patchConstructionPasses: number;
    postImageEncodePasses: number;
    postImageDecodePasses: number;
    postImageParsePasses: number;
}
export declare function createTargetAdapterCounters(): TargetAdapterCounters;
export interface TargetAdapterMetadata {
    readonly targetId: ConfigurationTargetId;
    readonly targetContractVersion: 1;
    readonly format: "json" | "json5" | "jsonc" | "toml" | "yaml";
    readonly parentPath: readonly string[];
    readonly toggleStrategy: ToggleStrategy;
}
export type CurrentTargetServer = {
    readonly kind: "absent";
} | {
    readonly kind: "present";
    readonly definition: Readonly<Record<string, unknown>>;
};
export declare const targetInspectionState: unique symbol;
export declare const targetDefinitionCanonicals: unique symbol;
export interface TargetDefinitionCanonicals {
    readonly current: string;
    readonly enabled?: string;
    readonly disabled?: string;
}
export interface TargetConfigInspection {
    readonly currentServer: CurrentTargetServer;
    readonly [targetInspectionState]: unknown;
    readonly [targetDefinitionCanonicals]: TargetDefinitionCanonicals | undefined;
}
export declare function frozenTargetInspection(currentServer: CurrentTargetServer, state: unknown, canonicals: TargetDefinitionCanonicals | undefined, owner: object): TargetConfigInspection;
export declare function targetInspectionStateFor<State>(inspection: TargetConfigInspection, owner: object): State;
export type TargetPatchRequest = {
    readonly action: "install";
    readonly definition: Readonly<Record<string, unknown>>;
    readonly inspection: TargetConfigInspection;
    readonly counters?: TargetAdapterCounters;
} | {
    readonly action: "enable";
    readonly restoreDefinition?: Readonly<Record<string, unknown>>;
    readonly inspection: TargetConfigInspection;
    readonly counters?: TargetAdapterCounters;
} | {
    readonly action: "disable";
    readonly inspection: TargetConfigInspection;
    readonly counters?: TargetAdapterCounters;
} | {
    readonly action: "remove";
    readonly inspection: TargetConfigInspection;
    readonly counters?: TargetAdapterCounters;
};
export type TargetPatch = {
    readonly kind: "unchanged";
} | {
    readonly kind: "changed";
    readonly postImage: Uint8Array;
};
export interface TargetAdapter {
    readonly metadata: TargetAdapterMetadata;
    readonly compatibility: (descriptor: CapabilityInstallDescriptor) => RegistryCompatibility;
    readonly descriptorToDefinition: (descriptor: CapabilityInstallDescriptor) => Readonly<Record<string, unknown>>;
    readonly suspendedDescriptorToDefinition: (descriptor: SuspendedDescriptor) => Readonly<Record<string, unknown>>;
    readonly definitionToSuspendedDescriptor: (serverName: string, definition: Readonly<Record<string, unknown>>) => SuspendedDescriptor;
    readonly inspect: (input: {
        readonly source: Uint8Array | undefined;
        readonly serverName: string;
        readonly counters?: TargetAdapterCounters;
    }) => TargetConfigInspection;
    readonly constructPatch: (request: TargetPatchRequest) => TargetPatch;
}
export interface DecodedTargetSource {
    readonly bytes: Uint8Array | undefined;
    readonly text: string;
    readonly bom: boolean;
    readonly newline: "\n" | "\r\n";
    readonly trailingNewline: boolean;
    readonly missing: boolean;
}
export declare function decodeTargetSource(bytes: Uint8Array | undefined, counters: TargetAdapterCounters | undefined, phase: "source" | "post-image"): DecodedTargetSource;
export declare function encodeTargetPostImage(text: string, bom: boolean, counters: TargetAdapterCounters | undefined): Uint8Array;
export declare function parsePass(counters: TargetAdapterCounters | undefined, phase: "source" | "post-image"): void;
export declare function inspectionPass(counters: TargetAdapterCounters | undefined): void;
export declare function patchPass(counters: TargetAdapterCounters | undefined): void;
export type InspectedJsonValue = {
    readonly kind: "scalar";
    readonly value: unknown;
    readonly canonical: string | undefined;
} | {
    readonly kind: "array";
    readonly value: readonly unknown[];
    readonly items: readonly InspectedJsonValue[];
    readonly allStrings: boolean;
    readonly canonical: string | undefined;
} | InspectedJsonRecord;
export interface InspectedJsonRecord {
    readonly kind: "record";
    readonly value: Record<string, unknown>;
    readonly fields: Map<string, InspectedJsonValue>;
    readonly allStringValues: boolean;
    readonly canonical: string | undefined;
}
export declare function inspectedJsonScalar(value: unknown, selected: boolean): InspectedJsonValue;
export declare function inspectedJsonArray(items: readonly InspectedJsonValue[], selected: boolean): InspectedJsonValue;
export declare function inspectedJsonRecord(fields: Map<string, InspectedJsonValue>, selected: boolean, mutable?: boolean): InspectedJsonRecord;
export declare function finalizeInspectedMcpDefinition(root: InspectedJsonRecord, options: {
    readonly stdioEnvironmentField?: string;
    readonly stdioEnvironmentKind?: "array" | "object";
    readonly httpHeadersField?: string;
    readonly httpBearerTokenField?: string;
    readonly httpUrlField?: string;
    readonly rawTransportPolicy: "reject" | "allow-openclaw-http";
    readonly stdioCommandKind?: "string" | "array";
    readonly toggleStrategy?: ToggleStrategy;
    readonly typePolicy?: "none" | "claude" | "opencode";
}): {
    readonly definition: Readonly<Record<string, unknown>>;
    readonly canonicals: TargetDefinitionCanonicals;
};
export declare function assertTargetInspectionConsistency(inspection: TargetConfigInspection): TargetDefinitionCanonicals | undefined;
export declare function assertPostImageDefinition(request: TargetPatchRequest, postInspection: TargetConfigInspection, toggleStrategy?: ToggleStrategy): void;
export declare function assertServerName(serverName: string): void;
export declare function normalizedCurrentDefinition(raw: unknown): Readonly<Record<string, unknown>>;
export declare function normalizedDetachedDefinition(raw: unknown): Readonly<Record<string, unknown>>;
export declare function normalizedMcpDefinition(raw: unknown, options: {
    readonly stdioEnvironmentField: string;
    readonly stdioEnvironmentKind: "array" | "object";
    readonly httpHeadersField: string;
    readonly rawTransportPolicy: "reject" | "allow-openclaw-http";
}): Readonly<Record<string, unknown>>;
export declare function freezeDefinition(definition: Record<string, unknown>): Readonly<Record<string, unknown>>;
export declare function freezeDetachedDefinition(definition: Record<string, unknown>): Readonly<Record<string, unknown>>;
export declare function readOwn(value: unknown, key: string): unknown;
export declare function requireRecord(value: unknown): Record<string, unknown>;
export declare function unsupportedDefinition(): never;
//# sourceMappingURL=target-adapter.d.ts.map