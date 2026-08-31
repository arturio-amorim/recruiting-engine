import type { InstallerFileSystem } from "./file-system.js";
export declare const configurationTargetIds: readonly ["antigravity", "claude-code", "claude-desktop", "codex", "cursor", "grok-build", "hermes", "kimi-code", "openclaw", "opencode-v2", "vscode"];
export type ConfigurationTargetId = (typeof configurationTargetIds)[number];
export interface StdioTransport {
    readonly type: "stdio";
    readonly command: string;
    readonly args: readonly string[];
    readonly forwardEnv: readonly string[];
}
export interface StreamableHttpTransport {
    readonly type: "streamable-http";
    readonly url: string;
    readonly authentication: {
        readonly type: "none";
    } | {
        readonly type: "bearer-env";
        readonly variable: string;
    };
    readonly headersFromEnv: Readonly<Record<string, string>>;
}
export interface CapabilityInstallDescriptor {
    readonly id: string;
    readonly version: string;
    readonly title: string;
    readonly description: string;
    readonly capabilityIds: readonly string[];
    readonly server: {
        readonly name: string;
        readonly transport: StdioTransport | StreamableHttpTransport;
    };
}
export type RegistryCompatibility = {
    readonly supported: true;
} | {
    readonly supported: false;
    readonly reason: string;
};
export type RegistryCompatibilityAdapter = (descriptor: CapabilityInstallDescriptor) => RegistryCompatibility;
export type RegistryCompatibilityAdapters = Readonly<Record<ConfigurationTargetId, RegistryCompatibilityAdapter>>;
export interface ValidatedRegistryEntry {
    readonly descriptor: CapabilityInstallDescriptor;
    readonly compatibility: Readonly<Record<ConfigurationTargetId, RegistryCompatibility>>;
}
export interface ValidatedRegistry {
    readonly schemaVersion: 1;
    readonly entries: readonly ValidatedRegistryEntry[];
}
export type RegistryIssueCode = "ARRAY_TOO_LONG" | "ARRAY_TOO_SHORT" | "BOM_FORBIDDEN" | "CREDENTIAL_URL" | "DUPLICATE_HEADER" | "DUPLICATE_ID" | "DUPLICATE_KEY" | "DUPLICATE_SERVER_NAME" | "DUPLICATE_VALUE" | "EMPTY_STRING" | "INSECURE_URL" | "INVALID_ENV_NAME" | "INVALID_HEADER_NAME" | "INVALID_ID" | "INVALID_JSON" | "INVALID_SCHEMA_VERSION" | "INVALID_SERVER_NAME" | "INVALID_TRANSPORT" | "INVALID_TYPE" | "INVALID_UNICODE" | "INVALID_URL" | "INVALID_UTF8" | "NUL_FORBIDDEN" | "OBJECT_TOO_LARGE" | "REGISTRY_TOO_LARGE" | "REQUIRED" | "RESERVED_HEADER" | "STRING_TOO_LONG" | "UNKNOWN_KEY" | "UNSUPPORTED_BY_ALL_TARGETS";
export interface RegistryIssue {
    readonly pointer: string;
    readonly code: RegistryIssueCode;
}
export interface RegistryValidationCounters {
    pathLinksCreated: number;
    pathSegmentsRendered: number;
    entryValidationPasses: number;
    compatibilityCalls: number;
}
export type RegistryValidationResult = {
    readonly ok: true;
    readonly registry: ValidatedRegistry;
} | {
    readonly ok: false;
    readonly issues: readonly RegistryIssue[];
};
export declare const bundledRegistryUrl: import("node:url").URL;
export declare function validateRegistryBytes(bytes: Uint8Array, adapters: RegistryCompatibilityAdapters, counters?: RegistryValidationCounters): RegistryValidationResult;
export declare function loadBundledRegistry(fileSystem: InstallerFileSystem, adapters: RegistryCompatibilityAdapters): Promise<ValidatedRegistry>;
//# sourceMappingURL=registry.d.ts.map