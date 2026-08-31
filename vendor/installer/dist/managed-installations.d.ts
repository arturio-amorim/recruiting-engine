import type { HarnessDetectionSnapshot } from "./harness-detection.js";
import { type InstallerErrorCode } from "./installer-error.js";
import { type ManagedInstallation } from "./installer-state.js";
import { type MutationCoordinatorDependencies } from "./mutation-coordinator.js";
import { type OwnershipPlan } from "./ownership-planner.js";
import type { CapabilityInstallDescriptor, ValidatedRegistry } from "./registry.js";
export interface ManagedInstallationView {
    readonly key: string;
    readonly installation: ManagedInstallation;
    readonly descriptor?: CapabilityInstallDescriptor;
    readonly displayName: string;
    readonly status: OwnershipPlan["status"] | "unavailable";
    readonly actions: OwnershipPlan["actions"];
    readonly unavailableCode?: InstallerErrorCode;
}
export interface InspectManagedInstallationsOptions {
    readonly dependencies: MutationCoordinatorDependencies;
    readonly registry: ValidatedRegistry;
    readonly snapshot: HarnessDetectionSnapshot;
}
export interface InspectEngineManagedInstallationsOptions {
    readonly dependencies: MutationCoordinatorDependencies;
    readonly engineId: string;
    readonly manifestServerName: string;
    readonly snapshot: HarnessDetectionSnapshot;
}
export declare function inspectManagedInstallations(options: InspectManagedInstallationsOptions): Promise<readonly ManagedInstallationView[]>;
export declare function inspectEngineManagedInstallations(options: InspectEngineManagedInstallationsOptions): Promise<readonly ManagedInstallationView[]>;
//# sourceMappingURL=managed-installations.d.ts.map