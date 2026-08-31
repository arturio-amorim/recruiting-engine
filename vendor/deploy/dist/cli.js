import { DeployError, renderDeployDiagnostic } from "./errors.js";
import { createDeployContext, writeDiagnostic, } from "./io.js";
const helpText = `Usage:
  senda-deploy init
  senda-deploy package
  senda-deploy probe --url <url> [--expect alive|ready] [--bearer-env NAME]
                         [--host-header HOST] [--timeout-ms N]
  senda-deploy inspect-oauth --url <url> [--timeout-ms N]
  senda-deploy --help
  senda-deploy --version
`;
// Nothing about a rejected argument is echoed, so a crafted argument can
// neither forge a diagnostic line nor reach a log.
const invalidUsageText = 'Invalid arguments. Run "senda-deploy --help".\n';
const unexpectedFailureText = "The command could not be completed.\n";
const commandNames = [
    "init",
    "package",
    "probe",
    "inspect-oauth",
];
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
        throw new Error("The package version is unreadable.");
    }
    return version;
}
// Each command is loaded only when it is selected, so usage output never pays
// for a module it will not run.
async function loadCommand(name) {
    if (name === "init")
        return (await import("./init.js")).runInit;
    if (name === "package") {
        return (await import("./package-command.js")).runPackage;
    }
    if (name === "probe")
        return (await import("./probe.js")).runProbe;
    return (await import("./inspect-oauth.js")).runInspectOAuth;
}
function selectCommand(argument) {
    return commandNames.find((name) => name === argument);
}
async function runSelectedCommand(name, args, context, options) {
    try {
        const run = options.commands?.[name] ?? (await loadCommand(name));
        return await run(args, context);
    }
    catch (error) {
        if (error instanceof DeployError) {
            await writeDiagnostic(context, renderDeployDiagnostic(error));
            return error.exitCode;
        }
        await writeDiagnostic(context, unexpectedFailureText);
        return 2;
    }
}
/**
 * Dispatches one `senda-deploy` invocation and resolves with its exit
 * code. Nothing is written to `stdout` except the usage and version output,
 * and the process status is never set here.
 */
export async function runDeployCli(options = {}) {
    const context = createDeployContext(options);
    const argv = options.argv ?? process.argv.slice(2);
    const [first, ...rest] = argv;
    if (first === "--help" || first === "--version") {
        if (rest.length > 0) {
            await writeDiagnostic(context, invalidUsageText);
            return 2;
        }
        try {
            const text = first === "--help"
                ? helpText
                : `${await (options.loadPackageVersion ?? loadDefaultPackageVersion)()}\n`;
            await context.io.writeStdout(text);
            return 0;
        }
        catch {
            await writeDiagnostic(context, unexpectedFailureText);
            return 2;
        }
    }
    const command = first === undefined ? undefined : selectCommand(first);
    if (command === undefined) {
        await writeDiagnostic(context, invalidUsageText);
        return 2;
    }
    return runSelectedCommand(command, rest, context, options);
}
//# sourceMappingURL=cli.js.map