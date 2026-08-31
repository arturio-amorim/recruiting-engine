import type { ExecutableResolver, OperatingSystemHomeResolver } from "./harness-detection.js";
export interface NodeExecutableResolverOptions {
    readonly pathValue?: string;
}
export declare const resolveNodeOperatingSystemHome: OperatingSystemHomeResolver;
export declare function createNodeExecutableResolver(options?: NodeExecutableResolverOptions): ExecutableResolver;
//# sourceMappingURL=node-harness-environment.d.ts.map