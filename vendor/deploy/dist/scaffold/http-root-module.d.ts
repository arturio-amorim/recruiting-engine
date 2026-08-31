import type { HttpDeployManifest } from "../manifest.js";
/**
 * Renders the generated `src/mcp-http.ts`. The environment file is loaded by
 * the first import, the manifest's required names are checked before anything
 * is constructed, and every documented variable is parsed fail-closed: an
 * invalid value aborts startup instead of falling back to a default.
 */
export declare function renderHttpRootModule(manifest: HttpDeployManifest): string;
//# sourceMappingURL=http-root-module.d.ts.map