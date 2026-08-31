import type { ExecutableResolver } from "./harness-detection.js";
import type { SuspendedDescriptor } from "./installer-state.js";
import type { InstallerAction } from "./ownership-planner.js";
import type { InstallerEnvironment } from "./target-config-evidence.js";
export interface RuntimeCommandEvidence {
    readonly declared: string;
    readonly resolved: string;
}
export type RuntimeRequirementsResult = {
    readonly kind: "ready";
    readonly command?: RuntimeCommandEvidence;
    readonly requiredEnvironmentNames: readonly string[];
} | {
    readonly kind: "blocked";
    readonly code: "COMMAND_NOT_FOUND";
    readonly declaredCommand: string;
    readonly requiredEnvironmentNames: readonly string[];
} | {
    readonly kind: "blocked";
    readonly code: "REQUIRED_ENV_MISSING";
    readonly command?: RuntimeCommandEvidence;
    readonly requiredEnvironmentNames: readonly string[];
    readonly missingEnvironmentNames: readonly string[];
};
export interface ResolveRuntimeRequirementsOptions {
    readonly action: InstallerAction;
    readonly descriptor: SuspendedDescriptor;
    readonly resolveExecutable: ExecutableResolver;
    readonly environment: InstallerEnvironment;
}
export declare function resolveRuntimeRequirements(options: ResolveRuntimeRequirementsOptions): Promise<RuntimeRequirementsResult>;
//# sourceMappingURL=runtime-requirements.d.ts.map