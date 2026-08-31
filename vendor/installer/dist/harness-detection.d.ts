import { type HarnessSurfaceId } from "./harness-catalog.js";
import type { InstallerErrorCode } from "./installer-error.js";
import type { ConfigurationTargetId } from "./registry.js";
export interface ExecutableIdentity {
    readonly device: number;
    readonly inode: number;
    readonly realPath: string;
}
export interface ExecutableEvidence {
    readonly path: string;
    readonly identity: ExecutableIdentity;
    readonly legacyAliasFor?: "agy";
}
export type ExecutableResolver = (candidate: string) => Promise<ExecutableEvidence | undefined>;
export type OperatingSystemHomeResolver = () => string;
export type TargetConfigEvidenceCode = Extract<InstallerErrorCode, "HARNESS_CONFIG_UNSAFE" | "HARNESS_CONFIG_AMBIGUOUS" | "HARNESS_CONFIG_READ_FAILED" | "TARGET_UNSUPPORTED">;
export type TargetConfigEvidence = {
    readonly kind: "present";
    readonly path: string;
} | {
    readonly kind: "absent";
    readonly path: string;
} | {
    readonly kind: "blocked";
    readonly code: TargetConfigEvidenceCode;
};
export interface TargetConfigEvidenceContext {
    readonly homeDirectory: string;
    readonly targetId: ConfigurationTargetId;
    readonly executables?: readonly DetectedExecutable[];
}
export type TargetConfigEvidenceProbe = (context: TargetConfigEvidenceContext) => Promise<TargetConfigEvidence>;
export type TargetConfigEvidenceProbes = Readonly<Record<ConfigurationTargetId, TargetConfigEvidenceProbe>>;
export interface DetectedExecutable extends ExecutableEvidence {
    readonly candidate: string;
}
export interface HarnessSurfaceSnapshot {
    readonly id: HarnessSurfaceId;
    readonly displayName: string;
    readonly targetId: ConfigurationTargetId;
    readonly evidence: "installed" | "absent";
    readonly executables: readonly DetectedExecutable[];
}
export interface ConfigurationTargetSnapshot {
    readonly id: ConfigurationTargetId;
    readonly displayName: string;
    readonly surfaceIds: readonly HarnessSurfaceId[];
    readonly evidence: "installed" | "configuration-only" | "blocked" | "absent";
    readonly executables: readonly DetectedExecutable[];
    readonly configuration: TargetConfigEvidence;
    readonly eligible: boolean;
    readonly mayCreateConfiguration: boolean;
    readonly reloadHint: string;
}
export interface HarnessDetectionSnapshot {
    readonly homeDirectory: string;
    readonly surfaces: readonly HarnessSurfaceSnapshot[];
    readonly targets: readonly ConfigurationTargetSnapshot[];
}
export interface DetectHarnessesOptions {
    readonly resolveHomeDirectory: OperatingSystemHomeResolver;
    readonly resolveExecutable: ExecutableResolver;
    readonly configEvidenceProbes: TargetConfigEvidenceProbes;
}
export declare function detectHarnesses(options: DetectHarnessesOptions): Promise<HarnessDetectionSnapshot>;
//# sourceMappingURL=harness-detection.d.ts.map