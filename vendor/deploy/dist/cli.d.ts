import { type DeployCommandRun, type DeployExitCode, type DeployIo } from "./io.js";
export type DeployCommandName = "init" | "package" | "probe" | "inspect-oauth";
export interface RunDeployCliOptions {
    readonly argv?: readonly string[];
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly io?: Partial<DeployIo>;
    /** Replaces a command implementation; the default loads it on demand. */
    readonly commands?: Partial<Record<DeployCommandName, DeployCommandRun>>;
    readonly loadPackageVersion?: () => Promise<string>;
}
/**
 * Dispatches one `senda-deploy` invocation and resolves with its exit
 * code. Nothing is written to `stdout` except the usage and version output,
 * and the process status is never set here.
 */
export declare function runDeployCli(options?: RunDeployCliOptions): Promise<DeployExitCode>;
//# sourceMappingURL=cli.d.ts.map