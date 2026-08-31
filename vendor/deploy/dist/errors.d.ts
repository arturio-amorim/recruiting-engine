import type { DeployExitCode } from "./io.js";
/**
 * The stable code and message are the public contract of a toolkit failure.
 * These are toolkit errors, not `EngineError` values: they occur before any
 * engine exists and have no request, event, or transport mapping.
 */
export declare const deployErrorMessages: Readonly<{
    readonly MANIFEST_NOT_FOUND: "The deployment manifest was not found.";
    readonly MANIFEST_INVALID: "The deployment manifest is invalid.";
    readonly PACKAGE_JSON_INVALID: "The project package.json is missing required fields.";
    readonly LOCKFILE_MISSING: "No supported lockfile was found.";
    readonly LOCKFILE_AMBIGUOUS: "More than one lockfile was found.";
    readonly ENTRY_NOT_BUILT: "The HTTP entry module has not been built.";
    readonly GENERATED_FILE_CONFLICT: "An existing file is not managed by the toolkit.";
    readonly WRITE_FAILED: "A deployment file could not be written.";
    readonly PROBE_UNREACHABLE: "The MCP endpoint could not be reached.";
    readonly PROBE_UNHEALTHY: "The MCP endpoint is not healthy.";
    readonly OAUTH_INSPECTION_FAILED: "OAuth discovery is not ready.";
}>;
export type DeployErrorCode = keyof typeof deployErrorMessages;
export declare const deployErrorExitCodes: Readonly<{
    readonly MANIFEST_NOT_FOUND: 2;
    readonly MANIFEST_INVALID: 2;
    readonly PACKAGE_JSON_INVALID: 1;
    readonly LOCKFILE_MISSING: 1;
    readonly LOCKFILE_AMBIGUOUS: 1;
    readonly ENTRY_NOT_BUILT: 1;
    readonly GENERATED_FILE_CONFLICT: 1;
    readonly WRITE_FAILED: 1;
    readonly PROBE_UNREACHABLE: 1;
    readonly PROBE_UNHEALTHY: 1;
    readonly OAUTH_INSPECTION_FAILED: 1;
}>;
export interface DeployErrorOptions {
    /**
     * Sanitized diagnostic lines such as a file path, a JSON pointer, or an HTTP
     * status. A detail MUST NOT carry an environment value, a header value, a
     * response body, or a rejected manifest value.
     */
    readonly details?: readonly string[];
}
export declare class DeployError extends Error {
    readonly code: DeployErrorCode;
    readonly exitCode: DeployExitCode;
    readonly details: readonly string[];
    constructor(code: DeployErrorCode, options?: DeployErrorOptions);
}
/**
 * Renders the stable code line followed by one indented line per detail. The
 * result is terminated with a line feed and is the only text a command writes
 * for a toolkit failure.
 */
export declare function renderDeployDiagnostic(error: DeployError): string;
//# sourceMappingURL=errors.d.ts.map