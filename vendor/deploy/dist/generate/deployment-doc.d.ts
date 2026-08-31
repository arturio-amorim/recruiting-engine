import type { HttpDeployManifest } from "../manifest.js";
import type { PackageManagerStrategy } from "./lockfile.js";
import type { ProjectPackage } from "./project-package.js";
export interface DeploymentDocInput {
    readonly manifest: HttpDeployManifest;
    readonly packageManager: PackageManagerStrategy;
    readonly project: ProjectPackage;
}
/**
 * Renders the operator documentation from the manifest, so the deployed
 * contract, the generated container, and the health check cannot disagree.
 */
export declare function renderDeploymentDoc(input: DeploymentDocInput): string;
//# sourceMappingURL=deployment-doc.d.ts.map