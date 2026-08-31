import type { HttpDeployManifest } from "../manifest.js";
import type { PackageManagerStrategy } from "./lockfile.js";
export interface DockerfileInput {
    readonly manifest: HttpDeployManifest;
    readonly packageManager: PackageManagerStrategy;
}
export declare const healthcheckScriptPath = "deploy/healthcheck.mjs";
/**
 * Renders the container build. Both stages use the manifest base image: the
 * build stage restores the exact lockfile tree, runs the project build script,
 * and prunes to production dependencies; the runtime stage receives only the
 * built output and runs it as the unprivileged `node` user. Nothing here is
 * executed by the toolkit, and no credential or environment file is copied.
 */
export declare function renderDockerfile(input: DockerfileInput): string;
//# sourceMappingURL=dockerfile.d.ts.map