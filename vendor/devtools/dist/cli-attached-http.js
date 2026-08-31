import { timingSafeEqual } from "node:crypto";
export const attachedCliConnectionBodyLimitBytes = 1024 * 1024;
export const attachedCliRunBodyLimitBytes = 10 * 1024 * 1024;
// One origin serves both workbenches, and a browser keeps one cookie per
// name: each workbench needs its own, or switching between them silently
// replaces the other's session.
export const attachedCliSessionCookieName = "senda_devtools_cli_session";
export const attachedCliCsrfHeaderName = "x-senda-csrf";
const contentSecurityPolicy = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
].join("; ");
export function attachedCliSecurityHeaders() {
    return {
        "content-security-policy": contentSecurityPolicy,
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY",
    };
}
export function sendAttachedCliJson(response, status, body, headers = {}) {
    response.writeHead(status, {
        ...attachedCliSecurityHeaders(),
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        ...headers,
    });
    response.end(JSON.stringify(body));
}
export function sendAttachedCliError(response, status, code, message) {
    sendAttachedCliJson(response, status, { code, message });
}
export function sendAttachedCliErrorBeforeBodyConsumption(request, response, status, code, message) {
    response.shouldKeepAlive = false;
    request.once("error", () => undefined);
    request.resume();
    response.once("finish", () => {
        if (!request.complete && !request.destroyed)
            request.destroy();
    });
    sendAttachedCliJson(response, status, { code, message }, { connection: "close" });
}
function rawHeaderValues(request, expectedName) {
    const values = [];
    const lower = expectedName.toLowerCase();
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
        const name = request.rawHeaders[index];
        const value = request.rawHeaders[index + 1];
        if (name?.toLowerCase() === lower && value !== undefined) {
            values.push(value);
        }
    }
    return values;
}
export function oneAttachedCliRawHeader(request, name) {
    const values = rawHeaderValues(request, name);
    return values.length === 1 ? values[0] : undefined;
}
export function equalAttachedCliOpaqueToken(actual, expected) {
    if (actual === undefined)
        return false;
    const actualBytes = Buffer.from(actual, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");
    return (actualBytes.length === expectedBytes.length &&
        timingSafeEqual(actualBytes, expectedBytes));
}
export function parseAttachedCliSessionCookie(value) {
    let selected;
    for (const pair of value.split(";")) {
        const separator = pair.indexOf("=");
        if (separator === -1)
            continue;
        const name = pair.slice(0, separator).trim();
        if (name !== attachedCliSessionCookieName)
            continue;
        if (selected !== undefined)
            return undefined;
        const candidate = pair.slice(separator + 1).trim();
        if (!/^[A-Za-z0-9_-]{32,}$/.test(candidate))
            return undefined;
        selected = candidate;
    }
    return selected;
}
async function readBody(request, limitBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        let settled = false;
        const cleanup = () => {
            request.off("data", onData);
            request.off("end", onEnd);
            request.off("error", onError);
            request.off("aborted", onAborted);
        };
        const onData = (value) => {
            const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
            total += chunk.length;
            if (total > limitBytes) {
                settled = true;
                cleanup();
                request.once("error", () => undefined);
                request.resume();
                resolve({ ok: false, body: Buffer.alloc(0) });
                return;
            }
            chunks.push(chunk);
        };
        const onEnd = () => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve({ ok: true, body: Buffer.concat(chunks) });
        };
        const onError = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        };
        const onAborted = () => onError(new Error("Request aborted."));
        if (request.aborted || request.destroyed) {
            onAborted();
            return;
        }
        request.on("data", onData);
        request.once("end", onEnd);
        request.once("error", onError);
        request.once("aborted", onAborted);
        if (request.aborted || request.destroyed)
            onAborted();
        else if (request.readableEnded)
            onEnd();
    });
}
function declaredBodyExceedsLimit(request, limitBytes) {
    const value = request.headers["content-length"];
    return (typeof value === "string" &&
        /^\d+$/u.test(value) &&
        BigInt(value) > BigInt(limitBytes));
}
function parseStrictJson(body) {
    try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
export function isAttachedCliRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function readAttachedCliJsonMutation(request, response, limitBytes, tooLargeMessage) {
    if (oneAttachedCliRawHeader(request, "content-type") !== "application/json") {
        sendAttachedCliErrorBeforeBodyConsumption(request, response, 400, "INVALID_REQUEST", "The request must contain exact JSON content.");
        return undefined;
    }
    if (declaredBodyExceedsLimit(request, limitBytes)) {
        sendAttachedCliErrorBeforeBodyConsumption(request, response, 413, "LIMIT_EXCEEDED", tooLargeMessage);
        return undefined;
    }
    const read = await readBody(request, limitBytes);
    if (!read.ok) {
        sendAttachedCliErrorBeforeBodyConsumption(request, response, 413, "LIMIT_EXCEEDED", tooLargeMessage);
        return undefined;
    }
    return parseStrictJson(read.body);
}
export function sendAttachedCliControllerError(response, error) {
    const code = isAttachedCliRecord(error) && typeof error.code === "string"
        ? error.code
        : undefined;
    switch (code) {
        case "INVALID_TARGET":
        case "ENVIRONMENT_VALUE_MISSING":
            sendAttachedCliError(response, 400, code, code === "INVALID_TARGET"
                ? "The CLI target descriptor is invalid."
                : "A required environment value is missing.");
            return;
        case "TARGET_BUSY":
        case "NOT_CONNECTED":
            sendAttachedCliError(response, 409, code, code === "TARGET_BUSY"
                ? "Another target or CLI verb is already active."
                : "No CLI target is connected for this browser session.");
            return;
        case "LIMIT_EXCEEDED":
            sendAttachedCliError(response, 413, code, "The configured CLI limit was exceeded.");
            return;
        case "TIMEOUT":
            sendAttachedCliError(response, 504, code, "The CLI operation timed out.");
            return;
        case "SPAWN_FAILED":
        case "CONNECTION_FAILED":
        case "PROTOCOL_ERROR":
            sendAttachedCliError(response, 502, code, "The CLI target operation failed.");
            return;
        default:
            sendAttachedCliError(response, 409, "NOT_CONNECTED", "No CLI target is connected for this browser session.");
    }
}
//# sourceMappingURL=cli-attached-http.js.map