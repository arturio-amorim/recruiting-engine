import { type HttpDeployManifest } from "../manifest.js";
export { httpAuthModuleTemplate } from "./auth-module.js";
export { renderEnvironmentExample } from "./env-example.js";
export { environmentModuleTemplate } from "./env-module.js";
export { renderHttpRootModule } from "./http-root-module.js";
export { renderDeployManifestDocument, starterDeployManifest, } from "./manifest-document.js";
export interface McpHttpScaffoldFile {
    /** Project-relative POSIX path. */
    readonly path: string;
    readonly contents: string;
}
/**
 * Builds the file set `init` writes, in lexicographic path order. The manifest
 * parameterizes the example file and the required-name check, so the manifest,
 * `.env.example`, and the startup check cannot disagree.
 */
export declare function createMcpHttpScaffoldFiles(manifest: HttpDeployManifest): readonly McpHttpScaffoldFile[];
//# sourceMappingURL=index.d.ts.map