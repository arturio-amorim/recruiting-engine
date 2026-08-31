import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isInstallerFileSystemError, } from "./file-system.js";
import { enforcesPosixFileModes, validOwnershipIdentity, } from "./ownership-identity.js";
const pathIdentityErrorMessages = Object.freeze({
    INVALID_PATH: "The filesystem path is invalid.",
    OUTSIDE_ROOT: "The filesystem path is outside its authorized root.",
    ROOT_UNSAFE: "The authorized filesystem root is unsafe.",
    COMPONENT_UNSAFE: "A filesystem path component is unsafe.",
    IDENTITY_CHANGED: "The filesystem path identity changed.",
    FILESYSTEM_FAILURE: "The filesystem path could not be inspected.",
});
export class InstallerPathIdentityError extends Error {
    code;
    constructor(code, cause) {
        super(pathIdentityErrorMessages[code], cause === undefined ? undefined : { cause });
        this.name = "InstallerPathIdentityError";
        this.code = code;
    }
}
function freezeNode(path, stat) {
    return Object.freeze({ path, ...stat });
}
function freezeIdentity(root, targetPath, targetKind, components, missingPaths) {
    return Object.freeze({
        root,
        targetPath,
        targetKind,
        components: Object.freeze([...components]),
        missingPaths: Object.freeze([...missingPaths]),
    });
}
function validAbsolutePath(path) {
    return isAbsolute(path) && !path.includes("\0");
}
function validUserId(uid) {
    return Number.isSafeInteger(uid) && uid >= 0;
}
function isInsideRoot(rootPath, targetPath) {
    const difference = relative(rootPath, targetPath);
    return (difference === "" ||
        (difference !== ".." &&
            !difference.startsWith(`..${sep}`) &&
            !isAbsolute(difference)));
}
function sameNode(left, right) {
    return (left.path === right.path &&
        left.kind === right.kind &&
        left.dev === right.dev &&
        left.ino === right.ino &&
        left.uid === right.uid &&
        left.gid === right.gid &&
        left.mode === right.mode);
}
function sameIdentity(left, right) {
    if (left.root.rootKind !== right.root.rootKind ||
        left.targetPath !== right.targetPath ||
        left.targetKind !== right.targetKind ||
        left.components.length !== right.components.length ||
        left.missingPaths.length !== right.missingPaths.length) {
        return false;
    }
    return (left.components.every((component, index) => {
        const other = right.components[index];
        return other !== undefined && sameNode(component, other);
    }) &&
        left.missingPaths.every((path, index) => path === right.missingPaths[index]));
}
async function inspect(fileSystem, path) {
    try {
        return await fileSystem.inspectPathNoFollow(path);
    }
    catch (cause) {
        throw new InstallerPathIdentityError("FILESYSTEM_FAILURE", cause);
    }
}
export async function capturePathRoot(fileSystem, options) {
    if (!validAbsolutePath(options.rootPath) ||
        options.ownership === undefined ||
        !validOwnershipIdentity(options.ownership)) {
        throw new InstallerPathIdentityError("INVALID_PATH");
    }
    const rootPath = resolve(options.rootPath);
    const stat = await inspect(fileSystem, rootPath);
    if (stat.kind !== "directory" ||
        stat.uid !== options.ownership.reportedOwnerId) {
        throw new InstallerPathIdentityError("ROOT_UNSAFE");
    }
    return Object.freeze({
        rootKind: options.rootKind,
        ownership: options.ownership,
        path: rootPath,
        kind: "directory",
        dev: stat.dev,
        ino: stat.ino,
        uid: stat.uid,
        gid: stat.gid,
        mode: stat.mode,
    });
}
async function assertRootIdentity(fileSystem, expected) {
    const current = await inspect(fileSystem, expected.path);
    if (current.kind !== "directory" || current.uid !== expected.uid) {
        throw new InstallerPathIdentityError("ROOT_UNSAFE");
    }
    if (!sameNode(expected, freezeNode(expected.path, { ...current, kind: "directory" }))) {
        throw new InstallerPathIdentityError("IDENTITY_CHANGED");
    }
}
export async function capturePathIdentity(fileSystem, options) {
    const rootPath = resolve(options.root.path);
    if (!validAbsolutePath(options.root.path) ||
        !validAbsolutePath(options.targetPath) ||
        !validUserId(options.root.uid)) {
        throw new InstallerPathIdentityError("INVALID_PATH");
    }
    const targetPath = resolve(options.targetPath);
    if (!isInsideRoot(rootPath, targetPath)) {
        throw new InstallerPathIdentityError("OUTSIDE_ROOT");
    }
    if (targetPath === rootPath && options.targetKind !== "directory") {
        throw new InstallerPathIdentityError("COMPONENT_UNSAFE");
    }
    await assertRootIdentity(fileSystem, options.root);
    const components = [options.root];
    const difference = relative(rootPath, targetPath);
    if (difference === "") {
        return freezeIdentity(options.root, targetPath, options.targetKind, components, []);
    }
    const names = difference.split(sep);
    let componentPath = rootPath;
    for (const [index, name] of names.entries()) {
        componentPath = join(componentPath, name);
        const stat = await inspect(fileSystem, componentPath);
        if (stat.kind === "missing") {
            const missingPaths = [componentPath];
            for (const missingName of names.slice(index + 1)) {
                componentPath = join(componentPath, missingName);
                missingPaths.push(componentPath);
            }
            return freezeIdentity(options.root, targetPath, options.targetKind, components, missingPaths);
        }
        const isTarget = index === names.length - 1;
        const expectedKind = isTarget ? options.targetKind : "directory";
        if (stat.kind !== expectedKind || stat.uid !== options.root.uid) {
            throw new InstallerPathIdentityError("COMPONENT_UNSAFE");
        }
        components.push(freezeNode(componentPath, { ...stat, kind: expectedKind }));
    }
    return freezeIdentity(options.root, targetPath, options.targetKind, components, []);
}
export async function revalidatePathIdentity(fileSystem, expected) {
    const current = await capturePathIdentity(fileSystem, {
        root: expected.root,
        targetPath: expected.targetPath,
        targetKind: expected.targetKind,
    });
    if (!sameIdentity(expected, current)) {
        throw new InstallerPathIdentityError("IDENTITY_CHANGED");
    }
    return current;
}
function identityAfterCreatedComponent(expected, component) {
    return freezeIdentity(expected.root, expected.targetPath, expected.targetKind, [...expected.components, component], expected.missingPaths.slice(1));
}
export async function bootstrapPrivateDirectory(fileSystem, options) {
    if (options.expected.targetKind !== "directory") {
        throw new InstallerPathIdentityError("INVALID_PATH");
    }
    let current = await revalidatePathIdentity(fileSystem, options.expected);
    while (current.missingPaths.length > 0) {
        await revalidatePathIdentity(fileSystem, current);
        const path = current.missingPaths[0];
        if (path === undefined ||
            dirname(path) !== current.components.at(-1)?.path) {
            throw new InstallerPathIdentityError("INVALID_PATH");
        }
        let created = false;
        try {
            await fileSystem.mkdir(path, 0o700);
            created = true;
        }
        catch (cause) {
            if (!isInstallerFileSystemError(cause, "ALREADY_EXISTS")) {
                throw new InstallerPathIdentityError("FILESYSTEM_FAILURE", cause);
            }
        }
        const stat = await inspect(fileSystem, path);
        if (stat.kind !== "directory" ||
            stat.uid !== current.root.uid ||
            (created &&
                enforcesPosixFileModes(current.root.ownership) &&
                (stat.mode & 0o7777) !== 0o700)) {
            throw new InstallerPathIdentityError("COMPONENT_UNSAFE");
        }
        current = identityAfterCreatedComponent(current, freezeNode(path, { ...stat, kind: "directory" }));
    }
    return revalidatePathIdentity(fileSystem, current);
}
//# sourceMappingURL=path-identity.js.map