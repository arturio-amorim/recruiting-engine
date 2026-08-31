import type { InstallerFileSystem } from "./file-system.js";
import type { ToggleStrategy } from "./jcs-fingerprint.js";
import { type InstallerOwnershipIdentity } from "./ownership-identity.js";
import { type ConfigurationTargetId, type StdioTransport, type StreamableHttpTransport } from "./registry.js";
import type { InstallerEnvironment } from "./target-config-evidence.js";
export interface StateTargetContract {
    readonly configPath: string;
    readonly targetContractVersion: 1;
    readonly toggleStrategy: ToggleStrategy;
}
export type StateTargetContracts = Readonly<Record<ConfigurationTargetId, StateTargetContract>>;
export interface SuspendedDescriptor {
    readonly name: string;
    readonly transport: StdioTransport | StreamableHttpTransport;
}
export interface ManagedInstallation {
    readonly entryId: string;
    readonly registryVersion: string;
    readonly targetId: ConfigurationTargetId;
    readonly configPath: string;
    readonly serverName: string;
    readonly definitionSha256: string;
    readonly targetContractVersion: 1;
    readonly toggleStrategy: ToggleStrategy;
    readonly launchDescriptor?: SuspendedDescriptor;
    readonly suspendedDescriptor?: SuspendedDescriptor;
    readonly adopted: boolean;
    readonly installedAt: string;
    readonly updatedAt: string;
}
export interface InstallerState {
    readonly schemaVersion: 1;
    readonly installations: Readonly<Record<string, ManagedInstallation>>;
}
export type StateIssueCode = "BOM_FORBIDDEN" | "CONFIG_PATH_RELOCATED" | "DUPLICATE_INSTALLATION" | "DUPLICATE_KEY" | "DUPLICATE_VALUE" | "EMPTY_STRING" | "INSTALLATIONS_TOO_LARGE" | "INVALID_DIGEST" | "INVALID_ENV_NAME" | "INVALID_HEADER_NAME" | "INVALID_ID" | "INVALID_JSON" | "INVALID_SCHEMA_VERSION" | "INVALID_SERVER_NAME" | "INVALID_STRING" | "INVALID_TARGET_CONTRACT_VERSION" | "INVALID_TIMESTAMP" | "INVALID_TOGGLE_STRATEGY" | "INVALID_TRANSPORT" | "INVALID_TYPE" | "INVALID_URL" | "INVALID_UTF8" | "KEY_MISMATCH" | "MISSING_KEY" | "RESERVED_HEADER" | "STATE_TOO_LARGE" | "SUSPENDED_DESCRIPTOR_FORBIDDEN" | "SUSPENDED_DESCRIPTOR_MISMATCH" | "TIMESTAMP_ORDER" | "TOGGLE_STRATEGY_MISMATCH" | "UNKNOWN_KEY";
export interface StateIssue {
    readonly pointer: string;
    readonly code: StateIssueCode;
}
export type InstallerStateValidationResult = {
    readonly ok: true;
    readonly state: InstallerState;
} | {
    readonly ok: false;
    readonly issues: readonly StateIssue[];
};
export interface LoadInstallerStateOptions {
    readonly allowUnavailableTargetContracts?: boolean;
    readonly ownership: InstallerOwnershipIdentity | undefined;
    readonly environment: InstallerEnvironment;
    readonly fileSystem: InstallerFileSystem;
    readonly homeDirectory: string;
    readonly targetContracts: StateTargetContracts;
}
export interface LoadedInstallerState {
    readonly path: string;
    readonly state: InstallerState;
}
export declare function isInstallerTimestampAfter(candidate: string, previous: string): boolean;
export declare function installationKey(entryId: string, targetId: ConfigurationTargetId, configPath: string): string;
export declare function createEmptyInstallerState(): InstallerState;
export declare function validateInstallerStateBytes(bytes: Uint8Array, targetContracts: StateTargetContracts, options?: {
    readonly allowUnavailableTargetContracts?: boolean;
}): InstallerStateValidationResult;
export declare function loadInstallerState(options: LoadInstallerStateOptions): Promise<LoadedInstallerState>;
//# sourceMappingURL=installer-state.d.ts.map