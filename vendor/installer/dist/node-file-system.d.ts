import { type InstallerTransactionFileSystem } from "./file-system.js";
import { type InstallerOwnershipIdentity } from "./ownership-identity.js";
export interface CreateNodeFileSystemOptions {
    readonly ownership?: InstallerOwnershipIdentity;
}
export declare function createNodeFileSystem(options?: CreateNodeFileSystemOptions): InstallerTransactionFileSystem;
//# sourceMappingURL=node-file-system.d.ts.map