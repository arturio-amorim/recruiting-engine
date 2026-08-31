/** Carries the server-reported error code alongside a readable message. */
export class ApiError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = "ApiError";
        this.code = code;
    }
}
const requestTimeoutMs = 10_000;
function timeoutSignal() {
    return typeof AbortSignal !== "undefined" &&
        typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(requestTimeoutMs)
        : undefined;
}
async function getJson(path) {
    const signal = timeoutSignal();
    const response = await fetch(path, signal === undefined ? {} : { signal });
    if (!response.ok)
        throw new Error(`${path} answered ${String(response.status)}`);
    return (await response.json());
}
async function readErrorDetail(response) {
    let body;
    try {
        body = await response.json();
    }
    catch {
        return { code: undefined, message: undefined };
    }
    if (typeof body !== "object" || body === null) {
        return { code: undefined, message: undefined };
    }
    const detail = body;
    return {
        code: typeof detail.error === "string" ? detail.error : undefined,
        message: typeof detail.message === "string" ? detail.message : undefined,
    };
}
/** Rejects with the server's code/message when the body carries them. */
async function failWithDetail(response, fallback) {
    const detail = await readErrorDetail(response);
    const message = detail.message ??
        (detail.code === undefined ? fallback : `${fallback} (${detail.code})`);
    throw new ApiError(message, detail.code);
}
export const api = {
    engine: () => getJson("/api/engine"),
    httpTarget: () => getJson("/api/http-target"),
    /**
     * Runs the read-only OAuth discovery check against the exact endpoint the
     * form is drafting. Nothing is authorized and no credential is sent.
     */
    checkHttpTarget: async (url) => {
        const response = await fetch("/api/http-target/check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url }),
        });
        if (!response.ok)
            await failWithDetail(response, "The endpoint could not be checked.");
        return (await response.json());
    },
    entryPoints: () => getJson("/api/entry-target"),
    /** Replaces which composition root runs one adapter's emulation. */
    setEntryPoint: async (selection) => {
        const response = await fetch("/api/entry-target", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(selection),
        });
        if (!response.ok)
            await failWithDetail(response, "The entry point could not be selected.");
        return (await response.json());
    },
    /**
     * Replaces where MCP HTTP sends a call. An OAuth target answers with the
     * authorization URL to continue in; every other target is ready at once.
     */
    setHttpTarget: async (target) => {
        const response = await fetch("/api/http-target", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(target),
        });
        if (!response.ok)
            await failWithDetail(response, "The endpoint could not be selected.");
        const body = (await response.json());
        const { authorizationUrl, ...view } = body;
        return {
            target: view,
            ...(authorizationUrl === undefined ? {} : { authorizationUrl }),
        };
    },
    capabilities: () => getJson("/api/capabilities"),
    doctor: () => getJson("/api/doctor"),
    principals: () => getJson("/api/principals"),
    createPrincipal: async (principal) => {
        const response = await fetch("/api/principals", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ principal }),
        });
        if (!response.ok)
            await failWithDetail(response, "The test identity could not be added.");
        return (await response.json());
    },
    /** Replaces a test identity in place; its key and its token are kept. */
    updatePrincipal: async (key, principal) => {
        const response = await fetch("/api/principals", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key, principal }),
        });
        if (!response.ok)
            await failWithDetail(response, "The test identity could not be updated.");
        return (await response.json());
    },
    rotatePrincipal: async (key) => {
        const response = await fetch("/api/principals", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key }),
        });
        if (!response.ok)
            await failWithDetail(response, "The token could not be minted.");
        return (await response.json());
    },
    removePrincipal: async (key) => {
        const response = await fetch("/api/principals", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key }),
        });
        if (!response.ok)
            await failWithDetail(response, "The test identity could not be deleted.");
    },
};
/**
 * Builds the exact request `callTool` sends so other surfaces (for example a
 * "Copy as curl" action) replay the same exchange byte for byte.
 */
export function toolCallRequest(toolName, args, token) {
    return {
        path: "/mcp",
        method: "POST",
        headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            ...(token === null ? {} : { authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: toolName, arguments: args },
        }, null, 2),
    };
}
/**
 * Runs one capability call through the selected adapter. The dev server owns
 * the adapter, so the browser sends the same request whichever path carries
 * it and reads back one normalized outcome.
 */
export async function invokeCapability(request, signal) {
    const response = await fetch("/api/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            adapter: request.adapter,
            capabilityId: request.capabilityId,
            arguments: request.arguments,
            ...(request.principalKey === null
                ? {}
                : { principalKey: request.principalKey }),
        }),
        ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) {
        await failWithDetail(response, "The capability could not be invoked.");
    }
    return (await response.json());
}
/** Sends one raw MCP `tools/call` through the same-origin proxy. */
export async function callTool(toolName, args, token, signal) {
    const request = toolCallRequest(toolName, args, token);
    const response = await fetch(request.path, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        ...(signal === undefined ? {} : { signal }),
    });
    return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        requestBody: request.body,
        responseBody: await response.text(),
    };
}
//# sourceMappingURL=api.js.map