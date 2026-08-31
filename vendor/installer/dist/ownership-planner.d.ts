import { type InstallerState, type StateTargetContract } from "./installer-state.js";
import type { CapabilityInstallDescriptor, ConfigurationTargetId } from "./registry.js";
export type InstallerAction = "install" | "enable" | "disable" | "adopt";
export interface OwnershipPlanningInput {
    readonly descriptor: CapabilityInstallDescriptor;
    readonly targetId: ConfigurationTargetId;
    readonly target: StateTargetContract;
    readonly state: InstallerState;
    readonly registryDefinition: Readonly<Record<string, unknown>>;
    readonly normalizedSuspendedDefinition?: Readonly<Record<string, unknown>>;
    readonly currentServer: {
        readonly kind: "absent";
    } | {
        readonly kind: "present";
        readonly definition: Readonly<Record<string, unknown>>;
    };
}
export type OwnershipPlan = {
    readonly status: "available";
    readonly actions: readonly ["install"];
} | {
    readonly status: "external";
    readonly actions: readonly ["adopt"];
} | {
    readonly status: "conflict";
    readonly actions: readonly [];
} | {
    readonly status: "drifted";
    readonly actions: readonly [];
} | {
    readonly status: "enabled";
    readonly actions: readonly ["disable"];
} | {
    readonly status: "disabled";
    readonly actions: readonly ["enable"];
} | {
    readonly status: "outdated";
    readonly enablement: "enabled";
    readonly actions: readonly ["disable"];
} | {
    readonly status: "outdated";
    readonly enablement: "disabled";
    readonly actions: readonly ["enable"];
};
export type InstallerActionPlan = {
    readonly outcome: "unchanged";
    readonly action: InstallerAction;
    readonly configEffect: "none";
    readonly stateEffect: "none";
} | {
    readonly outcome: "blocked";
    readonly action: InstallerAction;
    readonly code: "CONFIG_CONFLICT" | "CONFIG_DRIFT";
    readonly configEffect: "none";
    readonly stateEffect: "none";
} | {
    readonly outcome: "write";
    readonly action: InstallerAction;
    readonly configEffect: "none" | "install" | "replace" | "replace-disabled" | "set-enabled" | "set-disabled" | "detach" | "restore";
    readonly stateEffect: "create" | "update";
    readonly definitionSource: "registry" | "current" | "managed" | "suspended";
};
export declare function planOwnership(input: OwnershipPlanningInput): OwnershipPlan;
export declare function planInstallerAction(input: OwnershipPlanningInput, action: InstallerAction): InstallerActionPlan;
//# sourceMappingURL=ownership-planner.d.ts.map