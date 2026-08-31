export const maximumInstallerFileBytes = 16_777_216;
const fileSystemErrorMessages = Object.freeze({
    ALREADY_EXISTS: "The filesystem object already exists.",
    NOT_FOUND: "The filesystem object does not exist.",
    SYMBOLIC_LINK: "The filesystem object is a symbolic link.",
    LIMIT_EXCEEDED: "The filesystem byte limit was exceeded.",
    INVALID_ARGUMENT: "The filesystem operation argument is invalid.",
    IO_FAILED: "The filesystem operation failed.",
});
export class InstallerFileSystemError extends Error {
    code;
    constructor(code, cause) {
        super(fileSystemErrorMessages[code], cause === undefined ? undefined : { cause });
        this.name = "InstallerFileSystemError";
        this.code = code;
    }
}
export function isInstallerFileSystemError(error, code) {
    return (error instanceof InstallerFileSystemError &&
        (code === undefined || error.code === code));
}
//# sourceMappingURL=file-system.js.map