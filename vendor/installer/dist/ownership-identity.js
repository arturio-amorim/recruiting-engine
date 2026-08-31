/** Node reports this constant owner id for every filesystem object on Windows. */
const windowsReportedOwnerId = 0;
export function validOwnershipIdentity(identity) {
    if (identity.kind === "posix-user") {
        return (Number.isSafeInteger(identity.reportedOwnerId) &&
            identity.reportedOwnerId >= 0);
    }
    return (identity.kind === "windows-principal" &&
        identity.reportedOwnerId === windowsReportedOwnerId);
}
/** Only POSIX identities can promise exact private file modes such as `0o700`. */
export function enforcesPosixFileModes(identity) {
    return identity.kind === "posix-user";
}
/**
 * Captures the invoking user's ownership identity, or `undefined` when the
 * platform exposes neither a POSIX uid nor Windows principal semantics; every
 * consumer fails closed on `undefined`.
 */
export function captureProcessOwnershipIdentity(processLike = process) {
    const uid = processLike.getuid?.();
    if (uid !== undefined) {
        if (!Number.isSafeInteger(uid) || uid < 0)
            return undefined;
        return Object.freeze({ kind: "posix-user", reportedOwnerId: uid });
    }
    if (processLike.platform !== "win32")
        return undefined;
    return Object.freeze({
        kind: "windows-principal",
        reportedOwnerId: windowsReportedOwnerId,
    });
}
//# sourceMappingURL=ownership-identity.js.map