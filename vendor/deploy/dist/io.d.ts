/**
 * `0` succeeded, `1` completed with reported failures, `2` invalid usage or an
 * initialization failure. Orchestrating functions return one of these values
 * and never call `process.exit`; only the binary composition root owns the
 * final process status.
 */
export type DeployExitCode = 0 | 1 | 2;
export interface DeployIo {
    /** Written to only by `--help` and `--version`. */
    readonly writeStdout: (text: string) => void | Promise<void>;
    readonly writeStderr: (text: string) => void | Promise<void>;
}
/**
 * Everything a command may observe about its process. Commands read the
 * working directory and the environment from here rather than from globals, so
 * a test never spawns a process to exercise one.
 */
export interface DeployContext {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly io: DeployIo;
}
export interface DeployContextOverrides {
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly io?: Partial<DeployIo>;
}
export type DeployCommandRun = (args: readonly string[], context: DeployContext) => Promise<DeployExitCode>;
export declare function createDeployContext(overrides?: DeployContextOverrides): DeployContext;
/**
 * Writes one diagnostic to `stderr`. A broken diagnostic destination cannot
 * change the numeric result of a command, so a failing sink is swallowed.
 */
export declare function writeDiagnostic(context: DeployContext, text: string): Promise<void>;
//# sourceMappingURL=io.d.ts.map