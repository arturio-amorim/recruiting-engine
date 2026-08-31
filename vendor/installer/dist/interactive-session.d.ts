import type { InstallerFileSystem, InstallerTransactionFileSystem } from "./file-system.js";
import { type ExecutableResolver, type OperatingSystemHomeResolver, type TargetConfigEvidenceProbes } from "./harness-detection.js";
import type { InteractivePrompter } from "./interactive-prompter.js";
import { type InstallerOwnershipIdentity } from "./ownership-identity.js";
import { type RegistryCompatibilityAdapters } from "./registry.js";
import type { InstallerCommand, InstallerExitCode } from "./run-installer-cli.js";
import { type InstallerEnvironment } from "./target-config-evidence.js";
export interface RunInteractiveSessionOptions {
    readonly command?: InstallerCommand;
    readonly prompter?: InteractivePrompter;
    readonly fileSystem?: InstallerFileSystem;
    readonly transactionFileSystem?: InstallerTransactionFileSystem;
    readonly compatibilityAdapters?: RegistryCompatibilityAdapters;
    readonly resolveHomeDirectory?: OperatingSystemHomeResolver;
    readonly resolveExecutable?: ExecutableResolver;
    readonly configEvidenceProbes?: TargetConfigEvidenceProbes;
    readonly environment?: InstallerEnvironment;
    readonly ownership?: InstallerOwnershipIdentity;
    readonly platform?: NodeJS.Platform;
}
export declare function runInteractiveSession(options?: RunInteractiveSessionOptions): Promise<InstallerExitCode>;
//# sourceMappingURL=interactive-session.d.ts.map