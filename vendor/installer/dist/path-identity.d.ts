import { type InstallerFileStat, type InstallerTransactionFileSystem } from "./file-system.js";
import { type InstallerOwnershipIdentity } from "./ownership-identity.js";
export type InstallerPathIdentityErrorCode = "INVALID_PATH" | "OUTSIDE_ROOT" | "ROOT_UNSAFE" | "COMPONENT_UNSAFE" | "IDENTITY_CHANGED" | "FILESYSTEM_FAILURE";
export declare class InstallerPathIdentityError extends Error {
    readonly code: InstallerPathIdentityErrorCode;
    constructor(code: InstallerPathIdentityErrorCode, cause?: unknown);
}
export type InstallerPathRootKind = "engine" | "home" | "state";
export type InstallerPathTargetKind = "directory" | "regular-file";
export interface InstallerPathNodeIdentity extends InstallerFileStat {
    readonly kind: InstallerPathTargetKind;
    readonly path: string;
}
export interface InstallerPathRootIdentity extends InstallerPathNodeIdentity {
    readonly kind: "directory";
    readonly rootKind: InstallerPathRootKind;
    readonly ownership: InstallerOwnershipIdentity;
}
export interface InstallerPathIdentity {
    readonly root: InstallerPathRootIdentity;
    readonly targetPath: string;
    readonly targetKind: InstallerPathTargetKind;
    readonly components: readonly InstallerPathNodeIdentity[];
    readonly missingPaths: readonly string[];
}
export interface CapturePathRootOptions {
    readonly rootKind: InstallerPathRootKind;
    readonly rootPath: string;
    readonly ownership: InstallerOwnershipIdentity | undefined;
}
export interface CapturePathIdentityOptions {
    readonly root: InstallerPathRootIdentity;
    readonly targetPath: string;
    readonly targetKind: InstallerPathTargetKind;
}
export interface BootstrapPrivateDirectoryOptions {
    readonly expected: InstallerPathIdentity;
}
export declare function capturePathRoot(fileSystem: InstallerTransactionFileSystem, options: CapturePathRootOptions): Promise<InstallerPathRootIdentity>;
export declare function capturePathIdentity(fileSystem: InstallerTransactionFileSystem, options: CapturePathIdentityOptions): Promise<InstallerPathIdentity>;
export declare function revalidatePathIdentity(fileSystem: InstallerTransactionFileSystem, expected: InstallerPathIdentity): Promise<InstallerPathIdentity>;
export declare function bootstrapPrivateDirectory(fileSystem: InstallerTransactionFileSystem, options: BootstrapPrivateDirectoryOptions): Promise<InstallerPathIdentity>;
//# sourceMappingURL=path-identity.d.ts.map