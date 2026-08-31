import { type InstallerTransactionFileSystem } from "./file-system.js";
import { type InstallerOwnershipIdentity } from "./ownership-identity.js";
import type { CapabilityInstallDescriptor } from "./registry.js";
interface ValidatedEngineManifest {
    readonly schemaVersion: 1;
    readonly id: string;
    readonly version: string;
    readonly title: string;
    readonly description: string;
    readonly capabilityIds: readonly string[];
    readonly server: {
        readonly name: string;
        readonly entrypoint: string;
        readonly forwardEnv: readonly string[];
    };
}
export interface LoadEngineInstallManifestOptions {
    readonly ownership: InstallerOwnershipIdentity | undefined;
    readonly fileSystem: InstallerTransactionFileSystem;
    readonly nodeExecutable: string;
    readonly projectDirectory: string;
}
export interface LoadEngineRemovalManifestOptions {
    readonly ownership: InstallerOwnershipIdentity | undefined;
    readonly fileSystem: InstallerTransactionFileSystem;
    readonly projectDirectory: string;
}
export interface EngineInstallSource {
    readonly manifestPath: string;
    readonly entrypointPath: string;
    readonly descriptor: CapabilityInstallDescriptor;
}
export interface EngineRemovalSource {
    readonly manifestPath: string;
    readonly id: string;
    readonly title: string;
    readonly serverName: string;
}
export declare function validateEngineInstallManifestBytes(bytes: Uint8Array): ValidatedEngineManifest;
export declare function loadEngineRemovalManifest(options: LoadEngineRemovalManifestOptions): Promise<EngineRemovalSource>;
export declare function loadEngineInstallManifest(options: LoadEngineInstallManifestOptions): Promise<EngineInstallSource>;
export {};
//# sourceMappingURL=engine-manifest.d.ts.map