export declare const installerErrorMessages: Readonly<{
    readonly REGISTRY_INVALID: "The local capability registry is invalid.";
    readonly ENGINE_MANIFEST_INVALID: "The Action Engine manifest is invalid.";
    readonly ENGINE_PATH_UNSAFE: "The Action Engine path is unsafe.";
    readonly ENGINE_ENTRYPOINT_MISSING: "The Action Engine entry point was not found.";
    readonly ENGINE_IDENTITY_MISMATCH: "The manifest does not match the managed Action Engine identity.";
    readonly REMOTE_INVALID: "The remote MCP server definition is invalid.";
    readonly INSTALLATION_UNAVAILABLE: "The managed installation is unavailable.";
    readonly INSTALLER_INITIALIZATION_FAILED: "The installer could not be initialized.";
    readonly NO_TTY: "The installer requires an interactive terminal.";
    readonly NO_SUPPORTED_HARNESS: "No supported AI harness was detected.";
    readonly HARNESS_CONFIG_INVALID: "The harness configuration is invalid.";
    readonly HARNESS_CONFIG_AMBIGUOUS: "More than one harness configuration could be selected.";
    readonly HARNESS_CONFIG_UNSAFE: "The harness configuration path is unsafe.";
    readonly HARNESS_CONFIG_READ_FAILED: "The harness configuration could not be read.";
    readonly TARGET_UNSUPPORTED: "This capability cannot be configured for the selected harness.";
    readonly COMMAND_NOT_FOUND: "The MCP server command was not found.";
    readonly REQUIRED_ENV_MISSING: "A required environment variable is missing.";
    readonly CONFIG_CONFLICT: "A different MCP server already uses this name.";
    readonly CONFIG_DRIFT: "The managed MCP server was changed outside the installer.";
    readonly CONFIG_LOCKED: "The harness configuration is locked.";
    readonly CONFIG_CHANGED: "The harness configuration changed during installation.";
    readonly CONFIG_WRITE_FAILED: "The harness configuration could not be updated.";
    readonly STATE_INVALID: "The installer state is invalid.";
    readonly STATE_READ_FAILED: "The installer state could not be read.";
    readonly STATE_LOCKED: "The installer state is locked.";
    readonly STATE_CHANGED: "The installer state changed during installation.";
    readonly STATE_WRITE_FAILED: "The installer state could not be updated.";
    readonly CONFIG_ROLLBACK_FAILED: "The harness configuration could not be restored.";
    readonly CANCELLED: "Installation was cancelled.";
}>;
export type InstallerErrorCode = keyof typeof installerErrorMessages;
export declare class InstallerError extends Error {
    readonly code: InstallerErrorCode;
    constructor(code: InstallerErrorCode, cause?: unknown);
}
export declare function renderInstallerDiagnostic(error: InstallerError): string;
//# sourceMappingURL=installer-error.d.ts.map