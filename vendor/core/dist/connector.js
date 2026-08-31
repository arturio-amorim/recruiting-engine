import { types as nodeUtilTypes } from "node:util";
import { snapshotLosslessJson } from "./schema.js";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readDataProperty(value, key) {
    let current = value;
    while (current !== null) {
        if (nodeUtilTypes.isProxy(current)) {
            throw new TypeError("Connector contracts must not contain proxies.");
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (descriptor !== undefined) {
            if (!("value" in descriptor)) {
                throw new TypeError("Connector contracts must use data properties.");
            }
            return descriptor.value;
        }
        current = Object.getPrototypeOf(current);
    }
    return undefined;
}
function invalidConfiguration() {
    return new TypeError("Connector configuration is invalid.");
}
function validateConfiguration(standard, validate, value) {
    let result;
    try {
        result = Reflect.apply(validate, standard, [value]);
    }
    catch {
        throw invalidConfiguration();
    }
    if (nodeUtilTypes.isPromise(result)) {
        void result.catch(() => undefined);
        throw new TypeError("Connector configuration validation must be synchronous.");
    }
    try {
        if (!isRecord(result) || nodeUtilTypes.isProxy(result)) {
            throw invalidConfiguration();
        }
        const issues = readDataProperty(result, "issues");
        if (issues !== undefined)
            throw invalidConfiguration();
        const validated = readDataProperty(result, "value");
        if (!isRecord(validated) || nodeUtilTypes.isProxy(validated)) {
            throw invalidConfiguration();
        }
        return snapshotLosslessJson(validated);
    }
    catch {
        throw invalidConfiguration();
    }
}
function snapshotPorts(instance) {
    if (!isRecord(instance) || nodeUtilTypes.isProxy(instance)) {
        throw new TypeError("Connector factory must return an object with a ports record.");
    }
    let ports;
    try {
        ports = readDataProperty(instance, "ports");
    }
    catch {
        throw new TypeError("Connector factory must return an object with a ports record.");
    }
    if (!isRecord(ports) || nodeUtilTypes.isProxy(ports)) {
        throw new TypeError("Connector factory must return an object with a ports record.");
    }
    const names = Object.keys(ports);
    if (names.length === 0) {
        throw new TypeError("Connector factory must provide at least one port.");
    }
    const snapshot = {};
    for (const name of names) {
        const descriptor = Object.getOwnPropertyDescriptor(ports, name);
        if (descriptor === undefined || !("value" in descriptor)) {
            throw new TypeError("Connector ports must use data properties.");
        }
        Object.defineProperty(snapshot, name, {
            value: descriptor.value,
            enumerable: true,
            writable: false,
            configurable: false,
        });
    }
    return Object.freeze({
        ports: Object.freeze(snapshot),
    });
}
export function defineConnector(definition) {
    if (!isRecord(definition) || nodeUtilTypes.isProxy(definition)) {
        throw new TypeError("A connector definition must be an object.");
    }
    const name = definition.name;
    const config = definition.config;
    const create = definition.create;
    if (typeof name !== "string" || name.length === 0) {
        throw new TypeError("Connector name must be a non-empty string.");
    }
    if (!isRecord(config) || nodeUtilTypes.isProxy(config)) {
        throw new TypeError("Connector configuration schema is malformed.");
    }
    let standard;
    let version;
    let vendor;
    let validate;
    try {
        standard = config["~standard"];
        if (!isRecord(standard) || nodeUtilTypes.isProxy(standard)) {
            throw new TypeError();
        }
        version = readDataProperty(standard, "version");
        vendor = readDataProperty(standard, "vendor");
        validate = readDataProperty(standard, "validate");
    }
    catch {
        throw new TypeError("Connector configuration schema is malformed.");
    }
    if (version !== 1 ||
        typeof vendor !== "string" ||
        typeof validate !== "function") {
        throw new TypeError("Connector configuration schema is malformed.");
    }
    if (typeof create !== "function") {
        throw new TypeError("Connector factory must be a function.");
    }
    const factory = {
        name,
        create(rawConfig, dependencies) {
            const validated = validateConfiguration(standard, validate, rawConfig);
            return snapshotPorts(Reflect.apply(create, undefined, [
                validated,
                dependencies,
            ]));
        },
    };
    return Object.freeze(factory);
}
//# sourceMappingURL=connector.js.map