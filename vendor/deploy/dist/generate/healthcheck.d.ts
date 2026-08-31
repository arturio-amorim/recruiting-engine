import type { HttpDeployManifest } from "../manifest.js";
export interface HealthcheckInput {
    readonly manifest: HttpDeployManifest;
}
export declare const healthcheckProtocolVersion = "2025-11-25";
export declare const healthcheckTimeoutMs = 3000;
export declare const healthcheckTimeoutText = "3,000 ms";
/**
 * Renders the container health check. The script is self-contained: it imports
 * Node built-ins only, so it runs inside the runtime image without the
 * toolkit, the framework, or any dependency being installed.
 */
export declare function renderHealthcheck(input: HealthcheckInput): string;
//# sourceMappingURL=healthcheck.d.ts.map