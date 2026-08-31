export type InstallerExitCode = 0 | 1 | 2 | 130;
export type InstallerCommand = {
    readonly kind: "inventory";
} | {
    readonly kind: "install-engine";
    readonly projectDirectory: string;
} | {
    readonly kind: "remove-engine";
    readonly projectDirectory: string;
} | {
    readonly kind: "install-http";
    readonly serverName: string;
    readonly url: string;
    readonly bearerTokenEnvironment?: string;
    readonly headerEnvironment: readonly string[];
} | {
    readonly kind: "disable" | "enable" | "remove" | "status";
};
export interface InstallerCliIo {
    readonly inputIsTTY: () => boolean;
    readonly outputIsTTY: () => boolean;
    readonly writeStdout: (text: string) => void | Promise<void>;
    readonly writeStderr: (text: string) => void | Promise<void>;
}
export interface RunInstallerCliOptions {
    readonly argv?: readonly string[];
    readonly io?: Partial<InstallerCliIo>;
    readonly loadInteractiveSession?: (command: InstallerCommand) => Promise<InstallerExitCode>;
    readonly loadPackageVersion?: () => Promise<string>;
}
export declare function resolveInstallerCliIo(overrides: Partial<InstallerCliIo> | undefined): InstallerCliIo;
export declare function writeInitializationFailure(io: InstallerCliIo, error: unknown): Promise<2>;
export interface ExecuteInteractiveCliCommandOptions {
    readonly command: InstallerCommand;
    readonly io: InstallerCliIo;
    readonly loadInteractiveSession?: (command: InstallerCommand) => Promise<InstallerExitCode>;
}
export declare function executeInteractiveCliCommand(options: ExecuteInteractiveCliCommandOptions): Promise<InstallerExitCode>;
export declare function runInstallerCli(options?: RunInstallerCliOptions): Promise<InstallerExitCode>;
//# sourceMappingURL=run-installer-cli.d.ts.map