import type { ExecutableResolver, HarnessDetectionSnapshot } from "./harness-detection.js";
import type { InteractivePrompter } from "./interactive-prompter.js";
import { type MutationCoordinatorDependencies } from "./mutation-coordinator.js";
import type { CapabilityInstallDescriptor } from "./registry.js";
import type { InstallerExitCode } from "./run-installer-cli.js";
export interface RunInstallSessionOptions {
    readonly dependencies: MutationCoordinatorDependencies;
    readonly descriptor: CapabilityInstallDescriptor;
    readonly prompter: InteractivePrompter;
    readonly resolveExecutable: ExecutableResolver;
    readonly snapshot: HarnessDetectionSnapshot;
}
export declare function runInstallSession(options: RunInstallSessionOptions): Promise<InstallerExitCode>;
//# sourceMappingURL=install-session.d.ts.map