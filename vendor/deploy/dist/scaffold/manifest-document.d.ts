import { type HttpDeployManifest } from "../manifest.js";
/**
 * The manifest `init` writes when a project has none. Every documented default
 * is spelled out rather than omitted, because the schema is closed and the
 * file is meant to be edited by hand.
 */
export declare const starterDeployManifest: HttpDeployManifest;
/**
 * Renders one manifest as the JSON document on disk. The key order is the
 * schema's own, so the same manifest always renders the same bytes.
 */
export declare function renderDeployManifestDocument(manifest: HttpDeployManifest): string;
//# sourceMappingURL=manifest-document.d.ts.map