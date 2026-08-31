import { pretty } from "./dom.js";
import { exampleFromSchema } from "./example-from-schema.js";
const environmentNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
export class TargetDraftValidationError extends Error {
    field;
    index;
    constructor(field, message, index) {
        super(message);
        this.name = "TargetDraftValidationError";
        this.field = field;
        this.index = index;
    }
}
export function nextRovingIndex(current, itemCount, key, orientation) {
    if (itemCount <= 0 || current < 0 || current >= itemCount)
        return undefined;
    let next = current;
    if ((orientation === "horizontal" || orientation === "both") &&
        key === "ArrowRight") {
        next += 1;
    }
    else if ((orientation === "horizontal" || orientation === "both") &&
        key === "ArrowLeft") {
        next -= 1;
    }
    else if ((orientation === "vertical" || orientation === "both") &&
        key === "ArrowDown") {
        next += 1;
    }
    else if ((orientation === "vertical" || orientation === "both") &&
        key === "ArrowUp") {
        next -= 1;
    }
    else if (key === "Home") {
        return 0;
    }
    else if (key === "End") {
        return itemCount - 1;
    }
    else {
        return undefined;
    }
    return (next + itemCount) % itemCount;
}
function nonEmpty(value, message) {
    const normalized = value.trim();
    if (normalized === "") {
        throw new TargetDraftValidationError("command", message);
    }
    return normalized;
}
export function buildCliTarget(draft) {
    const command = nonEmpty(draft.command, "Command is required.");
    const cwd = draft.cwd?.trim();
    const env = Object.create(null);
    for (const [index, entry] of draft.environment.entries()) {
        const name = entry.name.trim();
        if (!environmentNamePattern.test(name)) {
            throw new TargetDraftValidationError("environment-name", "Environment names must use letters, numbers, and underscores.", index);
        }
        if (Object.hasOwn(env, name)) {
            throw new TargetDraftValidationError("environment-name", "Environment names must be unique.", index);
        }
        if (entry.value === "") {
            throw new TargetDraftValidationError("environment-value", "Environment values cannot be empty.", index);
        }
        Object.defineProperty(env, name, {
            configurable: true,
            enumerable: true,
            value: entry.value,
            writable: true,
        });
    }
    return {
        command,
        args: [...draft.args],
        ...(cwd === undefined || cwd === "" ? {} : { cwd }),
        ...(Object.keys(env).length === 0 ? {} : { env }),
    };
}
export function clearCliSecrets(controls) {
    for (const control of controls) {
        control.value = "";
        control.placeholder = "Cleared after response";
    }
}
export async function completeConnectionAttempt(attempt, secretControls) {
    try {
        return await attempt;
    }
    finally {
        clearCliSecrets(secretControls);
    }
}
export function seedCliInput(schema) {
    const example = exampleFromSchema(schema);
    if (typeof example !== "object" ||
        example === null ||
        Array.isArray(example)) {
        return "{}";
    }
    return pretty(example);
}
export function parseRunInput(source) {
    let parsed;
    try {
        parsed = JSON.parse(source);
    }
    catch {
        throw new Error("Run input must be valid JSON.");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Run input must be a JSON object.");
    }
    return parsed;
}
export function retainedActivityOf(state) {
    if (state.state !== "idle")
        return [];
    return Array.isArray(state.activity) ? state.activity : [];
}
/** Refresh is another `list`. Any list failure except busy disconnects. */
export function refreshFailureIsDisconnect(code) {
    return code !== "TARGET_BUSY";
}
/**
 * Runs tasks one after another. The attached CLI accepts one verb at a time,
 * so overlapping requests would answer the newest one with TARGET_BUSY and
 * let an older answer land after it. A rejected task does not stall the rest.
 */
export function createVerbQueue() {
    let tail = Promise.resolve();
    return (task) => {
        const next = tail.then(task);
        tail = next.catch(() => undefined);
        return next;
    };
}
//# sourceMappingURL=cli-contract.js.map