import { isAbsolute } from "node:path";
const noRuntimeRequirements = Object.freeze({
    kind: "ready",
    requiredEnvironmentNames: Object.freeze([]),
});
function requiredEnvironmentNames(descriptor) {
    const transport = descriptor.transport;
    if (transport.type === "stdio") {
        return Object.freeze([...new Set(transport.forwardEnv)]);
    }
    const names = [
        ...(transport.authentication.type === "bearer-env"
            ? [transport.authentication.variable]
            : []),
        ...Object.values(transport.headersFromEnv),
    ];
    return Object.freeze([...new Set(names)]);
}
function resolvedExecutablePath(evidence) {
    if (evidence === undefined)
        return undefined;
    try {
        const lookupPath = evidence.path;
        const identity = evidence.identity;
        const realPath = identity.realPath;
        if (typeof lookupPath !== "string" ||
            !isAbsolute(lookupPath) ||
            lookupPath.includes("\0") ||
            typeof identity !== "object" ||
            identity === null ||
            typeof realPath !== "string" ||
            !isAbsolute(realPath) ||
            realPath.includes("\0")) {
            return undefined;
        }
        return realPath;
    }
    catch {
        return undefined;
    }
}
async function resolveCommand(command, resolveExecutable) {
    let evidence;
    try {
        evidence = await resolveExecutable(command);
    }
    catch {
        return undefined;
    }
    const resolved = resolvedExecutablePath(evidence);
    return resolved === undefined
        ? undefined
        : Object.freeze({ declared: command, resolved });
}
function environmentVariableIsPresent(environment, name) {
    try {
        const value = environment.get(name);
        return typeof value === "string" && value.length > 0;
    }
    catch {
        return false;
    }
}
export async function resolveRuntimeRequirements(options) {
    if (options.action === "disable" || options.action === "adopt") {
        return noRuntimeRequirements;
    }
    const requiredNames = requiredEnvironmentNames(options.descriptor);
    const transport = options.descriptor.transport;
    let command;
    if (transport.type === "stdio") {
        command = await resolveCommand(transport.command, options.resolveExecutable);
        if (command === undefined) {
            return Object.freeze({
                kind: "blocked",
                code: "COMMAND_NOT_FOUND",
                declaredCommand: transport.command,
                requiredEnvironmentNames: requiredNames,
            });
        }
    }
    const missingNames = Object.freeze(requiredNames.filter((name) => !environmentVariableIsPresent(options.environment, name)));
    if (missingNames.length > 0) {
        return Object.freeze({
            kind: "blocked",
            code: "REQUIRED_ENV_MISSING",
            ...(command === undefined ? {} : { command }),
            requiredEnvironmentNames: requiredNames,
            missingEnvironmentNames: missingNames,
        });
    }
    return Object.freeze({
        kind: "ready",
        ...(command === undefined ? {} : { command }),
        requiredEnvironmentNames: requiredNames,
    });
}
//# sourceMappingURL=runtime-requirements.js.map