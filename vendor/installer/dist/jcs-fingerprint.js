import { createHash } from "node:crypto";
import { InstallerError } from "./installer-error.js";
class JcsCanonicalizationError extends Error {
    constructor() {
        super("The normalized definition is not valid RFC 8785 JSON data.");
        this.name = "JcsCanonicalizationError";
    }
}
function failJcs() {
    throw new JcsCanonicalizationError();
}
function assertUnicodeScalars(value) {
    for (let index = 0; index < value.length; index += 1) {
        const unit = value.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const following = value.charCodeAt(index + 1);
            if (!(following >= 0xdc00 && following <= 0xdfff))
                failJcs();
            index += 1;
        }
        else if (unit >= 0xdc00 && unit <= 0xdfff) {
            failJcs();
        }
    }
}
function serializeString(value) {
    assertUnicodeScalars(value);
    return JSON.stringify(value);
}
function isCanonicalObject(value) {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function serializeJcs(value, ancestors, omittedRootKey, isRoot) {
    if (value === null)
        return "null";
    if (typeof value === "boolean")
        return value ? "true" : "false";
    if (typeof value === "string")
        return serializeString(value);
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            failJcs();
        return JSON.stringify(value);
    }
    if (typeof value !== "object")
        return failJcs();
    if (ancestors.has(value))
        return failJcs();
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            const keys = Reflect.ownKeys(value);
            for (const key of keys) {
                if (key === "length")
                    continue;
                if (typeof key !== "string" ||
                    !/^(?:0|[1-9][0-9]*)$/u.test(key) ||
                    Number(key) >= value.length) {
                    return failJcs();
                }
            }
            const serialized = [];
            for (let index = 0; index < value.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (descriptor === undefined ||
                    descriptor.enumerable !== true ||
                    !("value" in descriptor)) {
                    return failJcs();
                }
                serialized.push(serializeJcs(descriptor.value, ancestors, undefined, false));
            }
            return `[${serialized.join(",")}]`;
        }
        if (!isCanonicalObject(value))
            return failJcs();
        if (Object.getOwnPropertySymbols(value).length !== 0)
            return failJcs();
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const keys = Object.keys(descriptors)
            .filter((key) => !(isRoot && key === omittedRootKey))
            .sort();
        const serialized = [];
        for (const key of keys) {
            assertUnicodeScalars(key);
            const descriptor = descriptors[key];
            if (descriptor === undefined ||
                descriptor.enumerable !== true ||
                !("value" in descriptor)) {
                return failJcs();
            }
            serialized.push(`${serializeString(key)}:${serializeJcs(descriptor.value, ancestors, undefined, false)}`);
        }
        return `{${serialized.join(",")}}`;
    }
    finally {
        ancestors.delete(value);
    }
}
function canonicalize(value, omittedRootKey) {
    try {
        return serializeJcs(value, new Set(), omittedRootKey, true);
    }
    catch (cause) {
        if (cause instanceof JcsCanonicalizationError)
            throw cause;
        throw new JcsCanonicalizationError();
    }
}
const registeredCanonicalJcs = new WeakMap();
export function registerCanonicalJcs(value, canonical) {
    registeredCanonicalJcs.set(value, Object.freeze({ ...canonical }));
}
function requireNativeToggle(definition, field) {
    if (typeof definition !== "object" ||
        definition === null ||
        Array.isArray(definition)) {
        failJcs();
    }
    const descriptor = Object.getOwnPropertyDescriptor(definition, field);
    if (descriptor === undefined ||
        descriptor.enumerable !== true ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "boolean") {
        failJcs();
    }
}
export function canonicalizeJcs(value) {
    if (typeof value === "object" && value !== null) {
        const registered = registeredCanonicalJcs.get(value);
        if (registered !== undefined)
            return registered.full;
    }
    return canonicalize(value);
}
export function fingerprintNormalizedDefinition(definition, toggleStrategy) {
    const omittedRootKey = toggleStrategy === "native-enabled"
        ? "enabled"
        : toggleStrategy === "native-disabled"
            ? "disabled"
            : undefined;
    try {
        if (omittedRootKey !== undefined) {
            requireNativeToggle(definition, omittedRootKey);
        }
        const registered = typeof definition === "object" && definition !== null
            ? registeredCanonicalJcs.get(definition)
            : undefined;
        const canonicalDefinition = omittedRootKey === "enabled"
            ? registered?.withoutEnabled
            : omittedRootKey === "disabled"
                ? registered?.withoutDisabled
                : registered?.full;
        return createHash("sha256")
            .update(canonicalDefinition ?? canonicalize(definition, omittedRootKey), "utf8")
            .digest("hex");
    }
    catch (cause) {
        throw new InstallerError("HARNESS_CONFIG_INVALID", cause);
    }
}
//# sourceMappingURL=jcs-fingerprint.js.map