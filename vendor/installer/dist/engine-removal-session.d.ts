import type { EngineRemovalSource } from "./engine-manifest.js";
import type { HarnessDetectionSnapshot } from "./harness-detection.js";
import type { InteractivePrompter } from "./interactive-prompter.js";
import { type MutationCoordinatorDependencies } from "./mutation-coordinator.js";
import type { InstallerExitCode } from "./run-installer-cli.js";
export interface RunEngineRemovalSessionOptions {
    readonly dependencies: MutationCoordinatorDependencies;
    readonly prompter: InteractivePrompter;
    readonly snapshot: HarnessDetectionSnapshot;
    readonly source: EngineRemovalSource;
}
export declare function runEngineRemovalSession(options: RunEngineRemovalSessionOptions): Promise<InstallerExitCode>;
//# sourceMappingURL=engine-removal-session.d.ts.map