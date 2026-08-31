import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DeployError } from "../errors.js";
export const projectPackageFileName = "package.json";
const invalidText = "A non-empty single-line string is required.";
function reject(pointers) {
    throw new DeployError("PACKAGE_JSON_INVALID", {
        details: pointers.map((path) => `${JSON.stringify(path)}: ${invalidText}`),
    });
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Accepts a value only when it can be embedded in generated text unchanged. A
 * rejected value is never echoed, so only its location is reported.
 */
function readText(value) {
    if (typeof value !== "string" || value === "")
        return undefined;
    for (const character of value) {
        const code = character.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f)
            return undefined;
    }
    return value;
}
export function parseProjectPackage(text) {
    let document;
    try {
        document = JSON.parse(text);
    }
    catch {
        reject([""]);
    }
    if (!isRecord(document))
        reject([""]);
    const name = readText(document.name);
    const version = readText(document.version);
    const scripts = isRecord(document.scripts) ? document.scripts : undefined;
    const buildScript = scripts === undefined ? undefined : readText(scripts.build);
    if (name === undefined ||
        version === undefined ||
        buildScript === undefined) {
        reject([
            ...(name === undefined ? ["/name"] : []),
            ...(version === undefined ? ["/version"] : []),
            ...(buildScript === undefined ? ["/scripts/build"] : []),
        ]);
    }
    return { buildScript, name, version };
}
/**
 * Reads the project manifest of the engine being packaged. An unreadable file
 * is reported exactly like an incomplete one: either way the required fields
 * are unavailable.
 */
export async function readProjectPackage(cwd) {
    let text;
    try {
        text = await readFile(join(cwd, projectPackageFileName), "utf8");
    }
    catch {
        throw new DeployError("PACKAGE_JSON_INVALID", {
            details: [projectPackageFileName],
        });
    }
    return parseProjectPackage(text);
}
//# sourceMappingURL=project-package.js.map