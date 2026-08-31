export const programName = "senda-devtools";
export class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = "UsageError";
    }
}
/**
 * Every value in a diagnostic is emitted as a JSON string literal. Engine
 * names, capability IDs, and error messages are author-controlled, so quoting
 * keeps a crafted value from forging an additional diagnostic line and keeps
 * the output byte-stable for grepping.
 */
export function quote(value) {
    return JSON.stringify(value);
}
export function asRecord(value) {
    if (typeof value !== "object" || value === null)
        return undefined;
    return value;
}
export function token(value) {
    return typeof value === "string" ? quote(value) : '"<unreadable>"';
}
export function renderLines(lines) {
    return `${lines.join("\n")}\n`;
}
/**
 * Extracts the safe, serializable facts of a thrown value: name, code, and
 * message only — never a stack, cause, or payload.
 */
export function readThrownValueInfo(error) {
    try {
        if (typeof error === "string")
            return { message: error };
        const record = asRecord(error);
        if (record === undefined)
            return {};
        return {
            ...(typeof record.name === "string" ? { name: record.name } : {}),
            ...(typeof record.code === "string" ? { code: record.code } : {}),
            ...(typeof record.message === "string"
                ? { message: record.message }
                : {}),
        };
    }
    catch {
        return {};
    }
}
/**
 * Describes a thrown value without echoing a stack, cause, or payload. Only
 * the error name, code, and message are actionable at this boundary.
 */
export function describeThrownValue(error) {
    try {
        if (typeof error === "string") {
            return `error: message=${quote(error)}`;
        }
        const record = asRecord(error);
        if (record === undefined)
            return 'error: name="<unreadable>"';
        const name = record.name;
        const code = record.code;
        const message = record.message;
        const parts = [`error: name=${token(name)}`];
        if (typeof code === "string")
            parts.push(`code=${quote(code)}`);
        parts.push(`message=${token(message)}`);
        return parts.join(" ");
    }
    catch {
        return 'error: name="<unreadable>"';
    }
}
//# sourceMappingURL=diagnostics.js.map