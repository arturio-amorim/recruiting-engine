import { type InstallerTransactionFileSystem } from "./file-system.js";
/** Injected time source so the bounded lock wait stays testable on a fake clock. */
export interface InstallerLockClock {
    readonly monotonicNow: () => number;
    readonly now: () => number;
    readonly wait: (milliseconds: number) => Promise<void>;
}
export interface InstallerLockDependencies {
    readonly clock: InstallerLockClock;
    readonly fileSystem: InstallerTransactionFileSystem;
    readonly processId: number;
    readonly randomBytes: (length: number) => Uint8Array;
    readonly signal?: AbortSignal;
}
export interface AcquireInstallerLocksInput {
    readonly configPath: string;
    readonly dependencies: InstallerLockDependencies;
    readonly statePath: string;
}
export interface OwnedInstallerLocks {
    /** The state lock followed by the config lock, in acquisition order. */
    readonly paths: readonly string[];
    readonly release: (primaryError?: unknown) => Promise<void>;
}
export declare function stateLockPath(statePath: string): string;
export declare function configLockPath(configPath: string): string;
export declare function acquireInstallerLocks(input: AcquireInstallerLocksInput): Promise<OwnedInstallerLocks>;
//# sourceMappingURL=installer-lock.d.ts.map