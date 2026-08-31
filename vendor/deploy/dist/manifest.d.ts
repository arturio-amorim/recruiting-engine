import { DeployError } from "./errors.js";
export declare const deployManifestFileName = "senda.deploy.json";
export declare const deployManifestLimits: Readonly<{
    readonly maxEncodedBytes: 65536;
    readonly maxEnvironmentNames: 64;
    readonly maxStringScalars: 1024;
}>;
export declare const deployManifestDefaults: Readonly<{
    readonly baseImage: "node:22-slim";
    readonly expect: "alive";
    readonly port: 3000;
}>;
export declare const environmentNamePattern: RegExp;
/**
 * A reason is a stable identifier; its message is fixed text. Neither ever
 * carries a rejected value, so a diagnostic can be logged in full.
 */
export declare const deployManifestIssueMessages: Readonly<{
    readonly DOCUMENT_TOO_LARGE: "The manifest exceeds the maximum encoded size.";
    readonly DOCUMENT_NOT_JSON: "The manifest is not valid JSON.";
    readonly DOCUMENT_UNREADABLE: "The manifest could not be read.";
    readonly OBJECT_REQUIRED: "A JSON object is required.";
    readonly UNKNOWN_KEY: "The key is not part of the manifest schema.";
    readonly KEY_REQUIRED: "The key is required.";
    readonly SCHEMA_VERSION_UNSUPPORTED: "The schema version must be the number 1.";
    readonly STRING_REQUIRED: "A string is required.";
    readonly STRING_EMPTY: "The value must not be empty.";
    readonly STRING_TOO_LONG: "The value exceeds the maximum string length.";
    readonly STRING_HAS_NUL: "The value must not contain a NUL character.";
    readonly STRING_HAS_WHITESPACE: "The value must not contain whitespace.";
    readonly ARRAY_REQUIRED: "An array is required.";
    readonly ENTRY_ABSOLUTE: "The entry path must be relative to the project root.";
    readonly ENTRY_ESCAPES_PROJECT: "The entry path must stay inside the project.";
    readonly ENTRY_SEGMENT_EMPTY: "The entry path must not contain an empty segment.";
    readonly ENTRY_EXTENSION_UNSUPPORTED: "The entry path must end in .js or .mjs.";
    readonly ENVIRONMENT_NAME_INVALID: "The environment variable name is not valid.";
    readonly ENVIRONMENT_NAME_DUPLICATE: "The environment variable name is already declared.";
    readonly ENVIRONMENT_NAMES_EXCEEDED: "The manifest declares too many environment variable names.";
    readonly INTEGER_REQUIRED: "An integer is required.";
    readonly PORT_OUT_OF_RANGE: "The port must be between 1 and 65535.";
    readonly EXPECTATION_UNSUPPORTED: 'The expectation must be "alive" or "ready".';
    readonly BEARER_ENV_NOT_ALLOWED: 'A bearer variable is allowed only when the expectation is "ready".';
}>;
export type DeployManifestIssueReason = keyof typeof deployManifestIssueMessages;
export interface DeployManifestIssue {
    /** RFC 6901 JSON pointer; the empty string addresses the whole document. */
    readonly pointer: string;
    readonly reason: DeployManifestIssueReason;
}
export interface DeployManifestEnvironment {
    readonly required: readonly string[];
    readonly optional: readonly string[];
}
export interface DeployManifestImage {
    readonly baseImage: string;
    readonly port: number;
}
export interface DeployManifestHealthcheck {
    readonly expect: "alive" | "ready";
    readonly bearerEnv?: string;
}
/** A validated manifest with every documented default already applied. */
export interface HttpDeployManifest {
    readonly schemaVersion: 1;
    readonly entry: string;
    readonly env: DeployManifestEnvironment;
    readonly image: DeployManifestImage;
    readonly healthcheck: DeployManifestHealthcheck;
}
export interface DeployManifestSuccess {
    readonly ok: true;
    readonly manifest: HttpDeployManifest;
}
export interface DeployManifestFailure {
    readonly ok: false;
    readonly code: "MANIFEST_NOT_FOUND" | "MANIFEST_INVALID";
    readonly issues: readonly DeployManifestIssue[];
}
export type DeployManifestResult = DeployManifestSuccess | DeployManifestFailure;
export interface LoadDeployManifestOptions {
    readonly cwd: string;
    /** Defaults to reading the manifest from disk as UTF-8. */
    readonly readFile?: (path: string) => Promise<string>;
}
/**
 * Validates one manifest document and reports every detectable issue in
 * deterministic JSON-pointer order. A rejected value is never echoed.
 */
export declare function parseDeployManifest(text: string): DeployManifestResult;
/**
 * Loads and validates the manifest at the project root. A read failure is
 * classified without echoing the underlying system message.
 */
export declare function loadDeployManifest(options: LoadDeployManifestOptions): Promise<DeployManifestResult>;
/**
 * Converts a rejected manifest into the toolkit error a command reports. The
 * pointer is emitted as a JSON string literal so a crafted key cannot forge an
 * additional diagnostic line.
 */
export declare function toDeployError(result: DeployManifestFailure): DeployError;
//# sourceMappingURL=manifest.d.ts.map