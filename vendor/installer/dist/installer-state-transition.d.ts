import { type InstallerState, type ManagedInstallation, type StateTargetContracts } from "./installer-state.js";
import { type InstallerActionPlan, type OwnershipPlanningInput } from "./ownership-planner.js";
import type { TargetAdapter } from "./target-adapter.js";
export interface ApplyInstallerStatePlanInput {
    readonly adapter: TargetAdapter;
    readonly allowUnavailableTargetContracts?: boolean;
    readonly occurredAt: string;
    readonly plan: InstallerActionPlan;
    readonly planning: OwnershipPlanningInput;
    readonly targetContracts: StateTargetContracts;
}
export interface InstallerStateWriteTransition {
    readonly state: InstallerState;
    readonly bytes: Uint8Array;
    readonly installation: ManagedInstallation;
    readonly restoreDefinition?: Readonly<Record<string, unknown>>;
}
export declare function serializeInstallerState(state: InstallerState, targetContracts: StateTargetContracts, options?: {
    readonly allowUnavailableTargetContracts?: boolean;
}): Uint8Array;
export declare function applyInstallerStatePlan(input: ApplyInstallerStatePlanInput): InstallerStateWriteTransition | undefined;
//# sourceMappingURL=installer-state-transition.d.ts.map