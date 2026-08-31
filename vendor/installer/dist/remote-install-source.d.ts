import type { CapabilityInstallDescriptor } from "./registry.js";
export interface CreateRemoteInstallDescriptorOptions {
    readonly serverName: string;
    readonly url: string;
    readonly bearerTokenEnvironment?: string;
    readonly headerEnvironment?: readonly string[];
}
export declare function createRemoteInstallDescriptor(options: CreateRemoteInstallDescriptorOptions): CapabilityInstallDescriptor;
//# sourceMappingURL=remote-install-source.d.ts.map