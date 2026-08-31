import type { DeployContext, DeployExitCode } from "./io.js";
/**
 * Performs one bounded MCP liveness or readiness check against a running
 * endpoint. Exactly one `initialize` request is sent within the deadline, with
 * no retry, redirect, or connection reuse, and nothing is ever written to
 * `stdout`. A healthy endpoint produces no output at all, which keeps the
 * command usable as a container health check.
 */
export declare function runProbe(args: readonly string[], context: DeployContext): Promise<DeployExitCode>;
//# sourceMappingURL=probe.d.ts.map