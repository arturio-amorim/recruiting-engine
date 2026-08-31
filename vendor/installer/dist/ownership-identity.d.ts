/** Node reports this constant owner id for every filesystem object on Windows. */
declare const windowsReportedOwnerId = 0;
/** POSIX ownership: every trusted path component must be owned by this uid. */
export interface PosixUserOwnershipIdentity {
    readonly kind: "posix-user";
    readonly reportedOwnerId: number;
}
/**
 * Windows ownership: Node cannot expose the invoking user's security
 * identifier, and `lstat` reports the same owner id for every path, so an
 * owner-id comparison proves nothing. Confinement instead relies on the
 * user-profile access-control lists together with the installer's unchanged
 * no-follow, path-identity, and containment checks.
 */
export interface WindowsPrincipalOwnershipIdentity {
    readonly kind: "windows-principal";
    readonly reportedOwnerId: typeof windowsReportedOwnerId;
}
export type InstallerOwnershipIdentity = PosixUserOwnershipIdentity | WindowsPrincipalOwnershipIdentity;
export interface OwnershipProcessLike {
    readonly platform: NodeJS.Platform;
    readonly getuid?: (() => number) | undefined;
}
export declare function validOwnershipIdentity(identity: InstallerOwnershipIdentity): boolean;
/** Only POSIX identities can promise exact private file modes such as `0o700`. */
export declare function enforcesPosixFileModes(identity: InstallerOwnershipIdentity): boolean;
/**
 * Captures the invoking user's ownership identity, or `undefined` when the
 * platform exposes neither a POSIX uid nor Windows principal semantics; every
 * consumer fails closed on `undefined`.
 */
export declare function captureProcessOwnershipIdentity(processLike?: OwnershipProcessLike): InstallerOwnershipIdentity | undefined;
export {};
//# sourceMappingURL=ownership-identity.d.ts.map