import { type InstallerCliIo, type InstallerCommand, type InstallerExitCode } from "./run-installer-cli.js";
import type { RunEngineInstallerCliOptions } from "./engine-cli.js";
interface RunEngineInstallerCliDependencies {
    readonly io?: Partial<InstallerCliIo>;
    readonly loadInteractiveSession?: (command: InstallerCommand) => Promise<InstallerExitCode>;
}
export declare function runEngineInstallerCliWithDependencies(options: RunEngineInstallerCliOptions & RunEngineInstallerCliDependencies): Promise<InstallerExitCode>;
export {};
//# sourceMappingURL=engine-cli-internal.d.ts.map