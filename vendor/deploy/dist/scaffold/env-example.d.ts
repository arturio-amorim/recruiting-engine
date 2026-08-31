import type { DeployManifestEnvironment } from "../manifest.js";
/**
 * Renders `.env.example` from the manifest's declared names: the required
 * group first, then the optional one, each in declaration order and with an
 * empty value. The file is secret-free by construction and safe to commit.
 */
export declare function renderEnvironmentExample(environment: DeployManifestEnvironment): string;
//# sourceMappingURL=env-example.d.ts.map