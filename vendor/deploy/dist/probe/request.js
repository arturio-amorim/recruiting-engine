import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { probeProtocolVersion } from "../probe-contract.js";
import { probePath } from "./options.js";
export { probeProtocolVersion };
/**
 * The single message the probe ever sends. It is a constant so the request is
 * identical on every invocation and carries nothing derived from the caller.
 */
export const probeInitializeBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
        protocolVersion: probeProtocolVersion,
        capabilities: {},
        clientInfo: { name: "senda-deploy-probe", version: "1" },
    },
});
/** Bounds memory for a response that the deadline alone would not contain. */
const maxResponseBytes = 1_024 * 1_024;
function firstHeaderValue(value) {
    if (value === undefined)
        return undefined;
    return Array.isArray(value) ? value.join(", ") : value;
}
function toResponse(response, body, truncated) {
    return {
        outcome: "response",
        status: response.statusCode ?? 0,
        challenge: firstHeaderValue(response.headers["www-authenticate"]),
        contentType: firstHeaderValue(response.headers["content-type"]),
        body,
        truncated,
    };
}
/**
 * Performs the one bounded request the probe is allowed. The deadline covers
 * connect through body, the socket is never reused, redirects are never
 * followed, and a failure is reported as a shape rather than as an error, so
 * no transport message or credential can reach a diagnostic.
 */
export function sendProbeRequest(options) {
    return new Promise((resolve) => {
        const body = Buffer.from(probeInitializeBody, "utf8");
        const secure = options.url.protocol === "https:";
        const send = secure ? httpsRequest : httpRequest;
        const hostname = options.url.hostname.startsWith("[")
            ? options.url.hostname.slice(1, -1)
            : options.url.hostname;
        const port = options.url.port === "" ? (secure ? 443 : 80) : Number(options.url.port);
        let settled = false;
        let timedOut = false;
        let request;
        const timer = setTimeout(() => {
            timedOut = true;
            finish({ outcome: "timeout" });
        }, options.timeoutMs);
        function finish(exchange) {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            request?.destroy();
            resolve(exchange);
        }
        function fail() {
            finish({ outcome: timedOut ? "timeout" : "connection-failure" });
        }
        try {
            request = send({
                protocol: options.url.protocol,
                hostname,
                port,
                path: probePath,
                method: "POST",
                // A fresh, agentless socket per invocation: no pooling, no reuse.
                agent: false,
                setHost: false,
                headers: {
                    host: options.hostHeader,
                    accept: "application/json, text/event-stream",
                    "content-type": "application/json",
                    "content-length": String(body.byteLength),
                    connection: "close",
                    ...(options.bearerToken === undefined
                        ? {}
                        : { authorization: `Bearer ${options.bearerToken}` }),
                },
            }, (response) => {
                const chunks = [];
                let total = 0;
                response.on("data", (chunk) => {
                    total += chunk.byteLength;
                    if (total > maxResponseBytes) {
                        finish(toResponse(response, "", true));
                        return;
                    }
                    chunks.push(chunk);
                });
                response.once("end", () => {
                    finish(toResponse(response, Buffer.concat(chunks).toString("utf8"), false));
                });
                response.once("aborted", fail);
                response.once("error", fail);
            });
            request.once("error", fail);
            request.end(body);
        }
        catch {
            // A request Node refuses to construct is a failed attempt to reach the
            // endpoint; its message is never inspected.
            finish({ outcome: "connection-failure" });
        }
    });
}
//# sourceMappingURL=request.js.map