import type { DeployContext, DeployExitCode } from "./io.js";
/**
 * Scaffolds the deployment manifest, the production-shaped HTTP composition
 * root, its fail-closed authentication hook, the environment-file loader, and
 * the secret-free example file. An existing file is never overwritten: it is
 * reported as skipped and the command still succeeds.
 */
export declare function runInit(args: readonly string[], context: DeployContext): Promise<DeployExitCode>;
//# sourceMappingURL=init.d.ts.map