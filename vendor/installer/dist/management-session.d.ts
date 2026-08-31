import type { ExecutableResolver, HarnessDetectionSnapshot } from "./harness-detection.js";
import type { InteractivePrompter } from "./interactive-prompter.js";
import { type MutationCoordinatorDependencies } from "./mutation-coordinator.js";
import type { ValidatedRegistry } from "./registry.js";
import type { InstallerCommand, InstallerExitCode } from "./run-installer-cli.js";
type ManagementAction = Extract<InstallerCommand["kind"], "disable" | "enable" | "remove" | "status">;
export interface RunManagementSessionOptions {
    readonly action: ManagementAction;
    readonly dependencies: MutationCoordinatorDependencies;
    readonly prompter: InteractivePrompter;
    readonly registry: ValidatedRegistry;
    readonly resolveExecutable: ExecutableResolver;
    readonly snapshot: HarnessDetectionSnapshot;
}
export declare function runManagementSession(options: RunManagementSessionOptions): Promise<InstallerExitCode>;
export {};
//# sourceMappingURL=management-session.d.ts.map