import { runEngineInstallerCliWithDependencies } from "./engine-cli-internal.js";
export function runEngineInstallerCli(options) {
    return runEngineInstallerCliWithDependencies({
        binaryName: options.binaryName,
        packageRoot: options.packageRoot,
        ...(options.argv === undefined ? {} : { argv: options.argv }),
    });
}
//# sourceMappingURL=engine-cli.js.map