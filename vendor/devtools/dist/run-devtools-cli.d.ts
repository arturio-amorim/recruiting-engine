import type { WorkbenchName } from "./workbench-server.js";
export interface DevtoolsIo {
    readonly writeStdout: (text: string) => void | Promise<void>;
    readonly writeStderr: (text: string) => void | Promise<void>;
}
export interface RunDevtoolsCliOptions {
    /** Defaults to `process.argv.slice(2)`. */
    readonly argv?: readonly string[];
    /** Directory the module path is resolved against. Defaults to `process.cwd()`. */
    readonly cwd?: string;
    readonly io?: Partial<DevtoolsIo>;
}
export interface DoctorCommand {
    readonly command: "doctor";
    readonly moduleSpecifier: string;
    readonly exportName: string;
    readonly json?: boolean;
}
export interface ServeCommand {
    readonly command: "serve";
    readonly moduleSpecifier: string;
    readonly exportName: string;
    readonly port?: number;
    readonly enginePort?: number;
    readonly buildCommand?: string;
    readonly watchInclude?: readonly string[];
    readonly watchIgnore?: readonly string[];
    readonly traceCapacity?: number;
}
export interface OpenCommand {
    readonly command: "open";
    readonly port?: number;
    /** Which workbench to open on. Without one, `open` lands on the chooser. */
    readonly workbench?: WorkbenchName;
}
export interface HelpCommand {
    readonly command: "help";
}
export interface VersionCommand {
    readonly command: "version";
}
export interface VerifyEnvironmentReference {
    readonly childName: string;
    readonly sourceName: string;
}
export interface VerifyHeaderEnvironmentReference {
    readonly headerName: string;
    readonly sourceName: string;
}
export interface VerifyStdioCommand {
    readonly command: "verify";
    readonly timeoutMs?: number;
    readonly maxTools?: number;
    readonly json?: boolean;
    readonly target: {
        readonly transport: "stdio";
        readonly command: string;
        readonly args: readonly string[];
        readonly cwd?: string;
        readonly environment: readonly VerifyEnvironmentReference[];
    };
}
export interface VerifyHttpCommand {
    readonly command: "verify";
    readonly timeoutMs?: number;
    readonly maxTools?: number;
    readonly json?: boolean;
    readonly target: {
        readonly transport: "http";
        readonly url: string;
        readonly authentication: {
            readonly type: "none";
        } | {
            readonly type: "bearer";
            readonly sourceName: string;
        } | {
            readonly type: "headers";
            readonly headers: readonly VerifyHeaderEnvironmentReference[];
        };
    };
}
export type VerifyCommand = VerifyStdioCommand | VerifyHttpCommand;
export type ParsedDevtoolsCommand = DoctorCommand | ServeCommand | OpenCommand | VerifyCommand | HelpCommand | VersionCommand;
export type ResolvedVerifyTarget = {
    readonly transport: "stdio";
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
} | {
    readonly transport: "http";
    readonly url: string;
    readonly authentication: {
        readonly type: "none";
    } | {
        readonly type: "bearer";
        readonly token: string;
    } | {
        readonly type: "headers";
        readonly headers: Readonly<Record<string, string>>;
    };
};
export declare class VerifyEnvironmentError extends Error {
    readonly code: "ENVIRONMENT_VALUE_MISSING" | "INVALID_TARGET";
    constructor(code: "ENVIRONMENT_VALUE_MISSING" | "INVALID_TARGET", message: string);
}
/**
 * Parses the complete command line without reading the process environment or
 * performing module, filesystem, process, or network work.
 */
export declare function parseDevtoolsCommand(argv: readonly string[]): ParsedDevtoolsCommand;
/**
 * Resolves already-validated environment references into a plain MCP target.
 * Callers must parse the entire argv first; this function never receives argv
 * and cannot make an invalid option combination trigger a credential lookup.
 */
export declare function resolveVerifyTargetEnvironment(command: ParsedDevtoolsCommand, readEnvironmentValue: (name: string) => string | undefined): ResolvedVerifyTarget;
/**
 * Runs `senda-devtools` and resolves with its exit code. Diagnostics are
 * written only to `stderr`; `open` and `serve` write their ready output,
 * `doctor --json` and verify results write JSON, and `--help`/`--version`
 * write the usage and the version to `stdout`.
 */
export declare function runDevtoolsCli(options?: RunDevtoolsCliOptions): Promise<number>;
//# sourceMappingURL=run-devtools-cli.d.ts.map