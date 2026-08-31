export type InstallerPathInspection = {
    readonly kind: "missing";
} | {
    readonly kind: "regular-file";
    readonly byteLength?: number;
    readonly ownerId: number;
    readonly realPath: string;
} | {
    readonly kind: "directory";
    readonly ownerId: number;
    readonly realPath: string;
} | {
    readonly kind: "symbolic-link" | "other";
    readonly ownerId: number;
};
export declare const maximumInstallerFileBytes = 16777216;
export type InstallerFileKind = "regular-file" | "directory" | "symbolic-link" | "other";
export interface InstallerFileStat {
    readonly kind: InstallerFileKind;
    readonly dev: bigint;
    readonly ino: bigint;
    readonly uid: number;
    readonly gid: number;
    readonly mode: number;
}
export type InstallerNoFollowPathInspection = {
    readonly kind: "missing";
} | InstallerFileStat;
export type InstallerFileSystemErrorCode = "ALREADY_EXISTS" | "NOT_FOUND" | "SYMBOLIC_LINK" | "LIMIT_EXCEEDED" | "INVALID_ARGUMENT" | "IO_FAILED";
export declare class InstallerFileSystemError extends Error {
    readonly code: InstallerFileSystemErrorCode;
    constructor(code: InstallerFileSystemErrorCode, cause?: unknown);
}
export declare function isInstallerFileSystemError(error: unknown, code?: InstallerFileSystemErrorCode): error is InstallerFileSystemError;
export interface InstallerReadHandle {
    readonly readAll: (maxBytes: number) => Promise<Uint8Array>;
    readonly stat: () => Promise<InstallerFileStat>;
    readonly close: () => Promise<void>;
}
export interface InstallerWriteHandle {
    readonly writeAll: (bytes: Uint8Array) => Promise<void>;
    readonly chmod: (mode: number) => Promise<void>;
    readonly chown: (uid: number, gid: number) => Promise<void>;
    readonly sync: () => Promise<void>;
    readonly stat: () => Promise<InstallerFileStat>;
    readonly close: () => Promise<void>;
}
/** Internal filesystem boundary. It grows only when a delivery slice needs I/O. */
export interface InstallerFileSystem {
    readonly readFile: (path: URL) => Promise<Uint8Array>;
    readonly inspectPath: (path: string) => Promise<InstallerPathInspection>;
}
/** Internal POSIX transaction boundary. Read-only fakes need not implement it. */
export interface InstallerTransactionFileSystem extends InstallerFileSystem {
    readonly inspectPathNoFollow: (path: string) => Promise<InstallerNoFollowPathInspection>;
    readonly openReadNoFollow: (path: string) => Promise<InstallerReadHandle>;
    readonly createExclusiveNoFollow: (path: string, mode: number) => Promise<InstallerWriteHandle>;
    readonly mkdir: (path: string, mode: number) => Promise<void>;
    readonly rename: (from: string, to: string) => Promise<void>;
    readonly unlink: (path: string) => Promise<void>;
}
//# sourceMappingURL=file-system.d.ts.map