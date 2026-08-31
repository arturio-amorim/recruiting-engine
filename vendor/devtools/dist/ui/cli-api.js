import { workbenchApiBase } from "./workbench-chrome.js";
export class CliApiError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "CliApiError";
        this.code = code;
    }
}
async function responseJson(response) {
    let value;
    try {
        value = await response.json();
    }
    catch {
        throw new CliApiError("PROTOCOL_ERROR", "The local interface returned an invalid response.");
    }
    if (!response.ok) {
        const error = value;
        throw new CliApiError(typeof error.code === "string" ? error.code : "CONNECTION_FAILED", typeof error.message === "string"
            ? error.message
            : "The local request could not be completed.");
    }
    return value;
}
export function createRouteCliApi(fetcher = fetch, apiBase = workbenchApiBase()) {
    let csrfToken = "";
    const get = async (path) => {
        const response = await fetcher(path, { credentials: "same-origin" });
        return responseJson(response);
    };
    const mutate = async (path, method, body) => {
        const response = await fetcher(path, {
            method,
            credentials: "same-origin",
            headers: {
                ...(body === undefined ? {} : { "content-type": "application/json" }),
                "X-Senda-CSRF": csrfToken,
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const value = await responseJson(response);
        const replacement = response.headers.get("X-Senda-CSRF");
        if (replacement !== null && replacement !== "")
            csrfToken = replacement;
        return value;
    };
    return {
        async session() {
            const response = await get(`${apiBase}/session`);
            csrfToken = response.csrfToken;
            return response;
        },
        connect: (target) => mutate(`${apiBase}/connection`, "POST", target),
        disconnect: () => mutate(`${apiBase}/connection`, "DELETE"),
        refresh: () => mutate(`${apiBase}/refresh`, "POST"),
        async catalog() {
            const response = await get(`${apiBase}/catalog`);
            return response.capabilities;
        },
        describe: (id) => mutate(`${apiBase}/describe`, "POST", { id }),
        async run(id, input) {
            const response = await mutate(`${apiBase}/run`, "POST", { id, input });
            return response.result;
        },
        async activity() {
            const response = await get(`${apiBase}/activity`);
            return response.records;
        },
    };
}
//# sourceMappingURL=cli-api.js.map