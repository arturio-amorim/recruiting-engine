export interface RunEngineInstallerCliOptions {
    /** Absolute directory holding the embedding engine's `senda.mcp.json`. */
    readonly packageRoot: string;
    /** Executable name rendered in help and usage diagnostics. */
    readonly binaryName: string;
    readonly argv?: readonly string[];
}
export declare function runEngineInstallerCli(options: RunEngineInstallerCliOptions): Promise<0 | 1 | 2 | 130>;
//# sourceMappingURL=engine-cli.d.ts.map