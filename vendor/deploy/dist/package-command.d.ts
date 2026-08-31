import type { DeployContext, DeployExitCode } from "./io.js";
/**
 * Generates the deterministic deployment package for the project in the
 * context's working directory. Validation runs before any write, every write
 * is atomic and governed by the generated-file marker, and nothing is ever
 * written to `stdout`.
 */
export declare function runPackage(args: readonly string[], context: DeployContext): Promise<DeployExitCode>;
//# sourceMappingURL=package-command.d.ts.map