import type { InstallerFileSystem } from "./file-system.js";
import type { TargetConfigEvidenceProbes } from "./harness-detection.js";
import { type InstallerOwnershipIdentity } from "./ownership-identity.js";
export interface InstallerEnvironment {
    readonly get: (name: string) => unknown;
}
export interface CreateNodeTargetConfigEvidenceProbesOptions {
    readonly environment: InstallerEnvironment;
    readonly fileSystem: InstallerFileSystem;
    readonly ownership?: InstallerOwnershipIdentity;
    readonly platform?: NodeJS.Platform;
}
export declare function createProcessInstallerEnvironment(): InstallerEnvironment;
export declare function createNodeTargetConfigEvidenceProbes(options: CreateNodeTargetConfigEvidenceProbesOptions): TargetConfigEvidenceProbes;
//# sourceMappingURL=target-config-evidence.d.ts.map