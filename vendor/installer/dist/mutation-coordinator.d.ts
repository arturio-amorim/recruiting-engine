import type { InstallerTransactionFileSystem } from "./file-system.js";
import type { HarnessDetectionSnapshot } from "./harness-detection.js";
import { InstallerError } from "./installer-error.js";
import { type InstallerLockDependencies } from "./installer-lock.js";
import { type StateTargetContracts } from "./installer-state.js";
import type { InstallerOwnershipIdentity } from "./ownership-identity.js";
import { type InstallerAction } from "./ownership-planner.js";
import type { CapabilityInstallDescriptor, ConfigurationTargetId } from "./registry.js";
import { type TargetAdapter } from "./target-adapter.js";
import type { InstallerEnvironment } from "./target-config-evidence.js";
export interface MutationCoordinatorDependencies {
    readonly adapters: Readonly<Record<ConfigurationTargetId, TargetAdapter>>;
    readonly ownership: InstallerOwnershipIdentity | undefined;
    readonly environment: InstallerEnvironment;
    readonly fileSystem: InstallerTransactionFileSystem;
    readonly lock: Omit<InstallerLockDependencies, "fileSystem">;
    readonly now: () => string;
}
export type TargetMutationResult = {
    readonly targetId: ConfigurationTargetId;
    readonly outcome: "disabled" | "enabled" | "installed" | "removed" | "unchanged";
} | {
    readonly targetId: ConfigurationTargetId;
    readonly outcome: "failed";
    readonly code: InstallerError["code"];
};
export interface InstallDescriptorAcrossTargetsInput {
    readonly dependencies: MutationCoordinatorDependencies;
    readonly descriptor: CapabilityInstallDescriptor;
    readonly snapshot: HarnessDetectionSnapshot;
    readonly targetIds: readonly ConfigurationTargetId[];
}
export interface MutateDescriptorAcrossTargetsInput extends InstallDescriptorAcrossTargetsInput {
    readonly action: Extract<InstallerAction, "disable" | "enable" | "install"> | "remove";
}
export interface RemoveEngineDescriptorFromTargetInput {
    readonly dependencies: MutationCoordinatorDependencies;
    readonly descriptor: CapabilityInstallDescriptor;
    readonly manifestServerName: string;
    readonly snapshot: HarnessDetectionSnapshot;
    readonly targetId: ConfigurationTargetId;
}
export declare function buildStateTargetContracts(snapshot: HarnessDetectionSnapshot, adapters: MutationCoordinatorDependencies["adapters"]): StateTargetContracts;
export declare function installDescriptorAcrossTargets(input: InstallDescriptorAcrossTargetsInput): Promise<readonly TargetMutationResult[]>;
export declare function removeEngineDescriptorFromTarget(input: RemoveEngineDescriptorFromTargetInput): Promise<TargetMutationResult>;
export declare function mutateDescriptorAcrossTargets(input: MutateDescriptorAcrossTargetsInput): Promise<readonly TargetMutationResult[]>;
//# sourceMappingURL=mutation-coordinator.d.ts.map