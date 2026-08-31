import { types as nodeTypes } from "node:util";
import { attachedCliError, } from "./cli-attached-contract.js";
const unixDefaultEnvNames = [
    "HOME",
    "LOGNAME",
    "PATH",
    "SHELL",
    "TERM",
    "USER",
];
const windowsDefaultEnvNames = [
    "APPDATA",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "PATH",
    "PROCESSOR_ARCHITECTURE",
    "SYSTEMDRIVE",
    "SYSTEMROOT",
    "TEMP",
    "USERNAME",
    "USERPROFILE",
    "PROGRAMFILES",
];
const environmentNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
function ownDataProperty(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor))
        return undefined;
    return descriptor.value;
}
function isPlainRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function defaultEnvironment(platform, readHostEnv) {
    const names = platform === "win32" ? windowsDefaultEnvNames : unixDefaultEnvNames;
    const env = Object.create(null);
    for (const name of names) {
        const value = readHostEnv(name);
        if (typeof value !== "string" || value.startsWith("()"))
            continue;
        Object.defineProperty(env, name, {
            configurable: true,
            enumerable: true,
            value,
            writable: true,
        });
    }
    return env;
}
export function composeAttachedCliEnvironment(overlay, platform, readHostEnv) {
    const env = defaultEnvironment(platform, readHostEnv);
    for (const name of Object.keys(overlay)) {
        Object.defineProperty(env, name, {
            configurable: true,
            enumerable: true,
            value: overlay[name],
            writable: true,
        });
    }
    return env;
}
export function parseAttachedCliTarget(value) {
    if (typeof value !== "object" ||
        value === null ||
        nodeTypes.isProxy(value) ||
        Array.isArray(value)) {
        throw attachedCliError("INVALID_TARGET");
    }
    const command = ownDataProperty(value, "command");
    if (typeof command !== "string" || command.trim() === "") {
        throw attachedCliError("INVALID_TARGET");
    }
    const rawArgs = ownDataProperty(value, "args");
    let args = [];
    if (rawArgs !== undefined) {
        if (!Array.isArray(rawArgs) ||
            rawArgs.some((entry) => typeof entry !== "string")) {
            throw attachedCliError("INVALID_TARGET");
        }
        args = rawArgs;
    }
    const cwd = ownDataProperty(value, "cwd");
    if (cwd !== undefined && (typeof cwd !== "string" || cwd.trim() === "")) {
        throw attachedCliError("INVALID_TARGET");
    }
    const rawEnv = ownDataProperty(value, "env");
    const overlay = Object.create(null);
    if (rawEnv !== undefined) {
        if (!isPlainRecord(rawEnv) || nodeTypes.isProxy(rawEnv)) {
            throw attachedCliError("INVALID_TARGET");
        }
        for (const name of Object.keys(rawEnv)) {
            if (!environmentNamePattern.test(name)) {
                throw attachedCliError("INVALID_TARGET");
            }
            const entry = ownDataProperty(rawEnv, name);
            if (typeof entry !== "string")
                throw attachedCliError("INVALID_TARGET");
            if (entry === "")
                throw attachedCliError("ENVIRONMENT_VALUE_MISSING");
            Object.defineProperty(overlay, name, {
                configurable: true,
                enumerable: true,
                value: entry,
                writable: true,
            });
        }
    }
    return {
        command,
        args,
        ...(typeof cwd === "string" ? { cwd } : {}),
        overlay,
    };
}
//# sourceMappingURL=cli-attached-target.js.map