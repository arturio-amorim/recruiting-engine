import { InstallerFileSystemError, isInstallerFileSystemError, } from "./file-system.js";
import { InstallerError } from "./installer-error.js";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const lockFileMode = 0o600;
const ownershipTokenBytes = 16;
const maximumLockMetadataBytes = 4_096;
const totalLockWaitMilliseconds = 2_000;
const initialLockWaitMilliseconds = 25;
const maximumLockWaitMilliseconds = 400;
export function stateLockPath(statePath) {
    return `${statePath}.lock`;
}
export function configLockPath(configPath) {
    return `${configPath}.senda-installer.lock`;
}
function throwIfCancelled(signal) {
    if (signal?.aborted === true)
        throw new InstallerError("CANCELLED");
}
function encodeOwnershipToken(bytes) {
    let token = "";
    for (const byte of bytes)
        token += byte.toString(16).padStart(2, "0");
    return token;
}
function mintOwnershipToken(randomBytes, writeFailedCode) {
    const bytes = randomBytes(ownershipTokenBytes);
    if (bytes.byteLength !== ownershipTokenBytes) {
        throw new InstallerError(writeFailedCode);
    }
    return encodeOwnershipToken(bytes);
}
function serializeLockMetadata(processId, createdAtMilliseconds, targetPath, ownershipToken) {
    return encoder.encode(`${JSON.stringify({
        pid: processId,
        createdAt: new Date(createdAtMilliseconds).toISOString(),
        targetPath,
        ownershipToken,
    })}\n`);
}
/** Closes a half-built lock and removes it only because this process created it. */
async function discardCreatedLock(fileSystem, close, lockPath) {
    try {
        await close();
    }
    catch {
        // The descriptor is already unusable; the lock file still needs removing.
    }
    try {
        await fileSystem.unlink(lockPath);
    }
    catch {
        // A leftover lock is reported through the caller's error and inspected manually.
    }
}
async function createLockFile(dependencies, targetPath, lockPath, lockedCode, ownershipToken) {
    const { clock, fileSystem, processId } = dependencies;
    const handle = await fileSystem.createExclusiveNoFollow(lockPath, lockFileMode);
    let identity;
    try {
        identity = await handle.stat();
        if (identity.kind !== "regular-file") {
            throw new InstallerFileSystemError("IO_FAILED");
        }
        await handle.writeAll(serializeLockMetadata(processId, clock.now(), targetPath, ownershipToken));
        await handle.sync();
        await handle.close();
    }
    catch (error) {
        await discardCreatedLock(fileSystem, () => handle.close(), lockPath);
        throw error;
    }
    return { identity, lockedCode, lockPath, ownershipToken, released: false };
}
/** Retries only on contention, spending at most the total budget across all waits. */
async function acquireLock(dependencies, targetPath, lockPath, lockedCode, writeFailedCode) {
    const { clock, randomBytes, signal } = dependencies;
    const ownershipToken = mintOwnershipToken(randomBytes, writeFailedCode);
    const startedAt = clock.monotonicNow();
    let waitMilliseconds = initialLockWaitMilliseconds;
    while (true) {
        throwIfCancelled(signal);
        try {
            return await createLockFile(dependencies, targetPath, lockPath, lockedCode, ownershipToken);
        }
        catch (error) {
            if (!isInstallerFileSystemError(error, "ALREADY_EXISTS")) {
                throw new InstallerError(writeFailedCode, error);
            }
        }
        const remaining = totalLockWaitMilliseconds - (clock.monotonicNow() - startedAt);
        if (remaining <= 0)
            throw new InstallerError(lockedCode);
        await clock.wait(Math.min(waitMilliseconds, remaining));
        waitMilliseconds = Math.min(waitMilliseconds * 2, maximumLockWaitMilliseconds);
    }
}
function ownsLock(lock, current, metadata) {
    if (current.kind !== "regular-file" ||
        current.dev !== lock.identity.dev ||
        current.ino !== lock.identity.ino) {
        return false;
    }
    let parsed;
    try {
        parsed = JSON.parse(decoder.decode(metadata));
    }
    catch {
        return false;
    }
    return (typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        parsed.ownershipToken === lock.ownershipToken);
}
/** Never throws: a lock this process cannot prove it owns is left for manual inspection. */
async function releaseLock(fileSystem, lock) {
    if (lock.released)
        return undefined;
    try {
        const handle = await fileSystem.openReadNoFollow(lock.lockPath);
        let current;
        let metadata;
        try {
            current = await handle.stat();
            metadata = await handle.readAll(maximumLockMetadataBytes);
        }
        finally {
            await handle.close();
        }
        if (!ownsLock(lock, current, metadata)) {
            return new InstallerError(lock.lockedCode);
        }
        await fileSystem.unlink(lock.lockPath);
        lock.released = true;
        return undefined;
    }
    catch (error) {
        return new InstallerError(lock.lockedCode, error);
    }
}
export async function acquireInstallerLocks(input) {
    const { configPath, dependencies, statePath } = input;
    const { fileSystem } = dependencies;
    const state = await acquireLock(dependencies, statePath, stateLockPath(statePath), "STATE_LOCKED", "STATE_WRITE_FAILED");
    let config;
    try {
        config = await acquireLock(dependencies, configPath, configLockPath(configPath), "CONFIG_LOCKED", "CONFIG_WRITE_FAILED");
    }
    catch (error) {
        await releaseLock(fileSystem, state);
        throw error;
    }
    return Object.freeze({
        paths: Object.freeze([state.lockPath, config.lockPath]),
        release: async (primaryError) => {
            const configFailure = await releaseLock(fileSystem, config);
            const stateFailure = await releaseLock(fileSystem, state);
            const failure = primaryError ?? stateFailure ?? configFailure;
            if (failure !== undefined)
                throw failure;
        },
    });
}
//# sourceMappingURL=installer-lock.js.map