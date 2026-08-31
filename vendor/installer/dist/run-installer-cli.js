import { InstallerError, renderInstallerDiagnostic, } from "./installer-error.js";
const helpText = `Usage:
  senda-installer
  senda-installer install --engine <project-directory>
  senda-installer install --http <server-name> <url> [--bearer-token-env <NAME>] [--header-env <HEADER=NAME>]...
  senda-installer status
  senda-installer enable
  senda-installer disable
  senda-installer remove
  senda-installer remove --engine <project-directory>
  senda-installer --help
  senda-installer --version
`;
const invalidUsageText = 'Invalid arguments. Run "senda-installer --help".\n';
const defaultIo = {
    inputIsTTY: () => process.stdin.isTTY === true,
    outputIsTTY: () => process.stdout.isTTY === true,
    writeStdout: (text) => {
        process.stdout.write(text);
    },
    writeStderr: (text) => {
        process.stderr.write(text);
    },
};
export function resolveInstallerCliIo(overrides) {
    return {
        inputIsTTY: overrides?.inputIsTTY ?? defaultIo.inputIsTTY,
        outputIsTTY: overrides?.outputIsTTY ?? defaultIo.outputIsTTY,
        writeStdout: overrides?.writeStdout ?? defaultIo.writeStdout,
        writeStderr: overrides?.writeStderr ?? defaultIo.writeStderr,
    };
}
async function loadDefaultInteractiveSession(command) {
    const { runInteractiveSession } = await import("./interactive-session.js");
    return runInteractiveSession({ command });
}
function parseCommand(argv) {
    if (argv.length === 0)
        return Object.freeze({ kind: "inventory" });
    if (argv.length === 3 && argv[0] === "install" && argv[1] === "--engine") {
        return Object.freeze({
            kind: "install-engine",
            projectDirectory: argv[2],
        });
    }
    if (argv.length === 3 && argv[0] === "remove" && argv[1] === "--engine") {
        return Object.freeze({
            kind: "remove-engine",
            projectDirectory: argv[2],
        });
    }
    if (argv[0] === "install" && argv[1] === "--http") {
        const serverName = argv[2];
        const url = argv[3];
        if (serverName === undefined || url === undefined)
            return undefined;
        let bearerTokenEnvironment;
        const headerEnvironment = [];
        let headerOptionSeen = false;
        for (let index = 4; index < argv.length; index += 2) {
            const flag = argv[index];
            const value = argv[index + 1];
            if (value === undefined)
                return undefined;
            if (flag === "--bearer-token-env") {
                if (bearerTokenEnvironment !== undefined || headerOptionSeen) {
                    return undefined;
                }
                bearerTokenEnvironment = value;
            }
            else if (flag === "--header-env") {
                headerOptionSeen = true;
                headerEnvironment.push(value);
            }
            else {
                return undefined;
            }
        }
        return Object.freeze({
            kind: "install-http",
            serverName,
            url,
            ...(bearerTokenEnvironment === undefined
                ? {}
                : { bearerTokenEnvironment }),
            headerEnvironment: Object.freeze(headerEnvironment),
        });
    }
    if (argv.length === 1 &&
        (argv[0] === "status" ||
            argv[0] === "enable" ||
            argv[0] === "disable" ||
            argv[0] === "remove")) {
        return Object.freeze({ kind: argv[0] });
    }
    return undefined;
}
function asRecord(value) {
    if (typeof value !== "object" || value === null)
        return undefined;
    return value;
}
async function loadDefaultPackageVersion() {
    const manifestUrl = new URL("../package.json", import.meta.url);
    const namespace = (await import(manifestUrl.href, {
        with: { type: "json" },
    }));
    const version = asRecord(asRecord(namespace)?.default)?.version;
    if (typeof version !== "string" || version === "") {
        throw new InstallerError("INSTALLER_INITIALIZATION_FAILED");
    }
    return version;
}
async function writeStderr(io, text) {
    try {
        await io.writeStderr(text);
    }
    catch {
        // A broken diagnostic destination cannot change the selected exit code.
    }
}
export async function writeInitializationFailure(io, error) {
    const installerError = error instanceof InstallerError
        ? error
        : new InstallerError("INSTALLER_INITIALIZATION_FAILED", error);
    await writeStderr(io, renderInstallerDiagnostic(installerError));
    return 2;
}
export async function executeInteractiveCliCommand(options) {
    const { command, io } = options;
    try {
        if (!io.inputIsTTY() || !io.outputIsTTY()) {
            await writeStderr(io, renderInstallerDiagnostic(new InstallerError("NO_TTY")));
            return 2;
        }
        return await (options.loadInteractiveSession ?? loadDefaultInteractiveSession)(command);
    }
    catch (error) {
        if (error instanceof InstallerError) {
            if (error.code === "CANCELLED") {
                await writeStderr(io, renderInstallerDiagnostic(error));
                return 130;
            }
            if (error.code !== "INSTALLER_INITIALIZATION_FAILED" &&
                error.code !== "REGISTRY_INVALID") {
                await writeStderr(io, renderInstallerDiagnostic(error));
                return 1;
            }
        }
        return writeInitializationFailure(io, error);
    }
}
export async function runInstallerCli(options = {}) {
    const io = resolveInstallerCliIo(options.io);
    const argv = options.argv ?? process.argv.slice(2);
    if (argv.length === 1 && argv[0] === "--help") {
        try {
            await io.writeStdout(helpText);
            return 0;
        }
        catch (error) {
            return writeInitializationFailure(io, error);
        }
    }
    if (argv.length === 1 && argv[0] === "--version") {
        try {
            const version = await (options.loadPackageVersion ?? loadDefaultPackageVersion)();
            await io.writeStdout(`${version}\n`);
            return 0;
        }
        catch (error) {
            return writeInitializationFailure(io, error);
        }
    }
    const command = parseCommand(argv);
    if (command === undefined) {
        await writeStderr(io, invalidUsageText);
        return 2;
    }
    return executeInteractiveCliCommand({
        command,
        io,
        ...(options.loadInteractiveSession === undefined
            ? {}
            : { loadInteractiveSession: options.loadInteractiveSession }),
    });
}
//# sourceMappingURL=run-installer-cli.js.map