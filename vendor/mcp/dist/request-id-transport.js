import { randomUUID } from "node:crypto";
function rewriteRequestIds(message, rewrite, topLevelIdScope) {
    let rewritten = message;
    if ("id" in message &&
        (topLevelIdScope === "message" || "method" in message)) {
        const id = rewrite(message.id);
        if (id !== undefined) {
            rewritten = { ...message, id };
        }
    }
    if ("method" in rewritten && rewritten.method === "notifications/cancelled") {
        const params = rewritten.params;
        if (params !== undefined) {
            const requestId = rewrite(params.requestId);
            if (requestId !== undefined) {
                rewritten = {
                    ...rewritten,
                    params: { ...params, requestId },
                };
            }
        }
    }
    return rewritten;
}
class FalsyRequestIdTransport {
    transport;
    onclose;
    onerror;
    onmessage;
    numericZeroSentinel = `\u0000senda-request-id:${randomUUID()}:numeric-zero`;
    emptyStringSentinel = `\u0000senda-request-id:${randomUUID()}:empty-string`;
    constructor(transport) {
        this.transport = transport;
    }
    toInternalRequestId(value) {
        if (value === 0)
            return this.numericZeroSentinel;
        if (value === "")
            return this.emptyStringSentinel;
        return undefined;
    }
    toExternalRequestId(value) {
        if (value === this.numericZeroSentinel)
            return 0;
        if (value === this.emptyStringSentinel)
            return "";
        return undefined;
    }
    async start() {
        this.transport.onclose = () => {
            this.onclose?.();
        };
        this.transport.onerror = (error) => {
            this.onerror?.(error);
        };
        this.transport.onmessage = (message, extra) => {
            this.onmessage?.(rewriteRequestIds(message, (value) => this.toInternalRequestId(value), "request"), extra);
        };
        await this.transport.start();
    }
    send(message, options) {
        const relatedRequestId = this.toExternalRequestId(options?.relatedRequestId);
        return this.transport.send(rewriteRequestIds(message, (value) => this.toExternalRequestId(value), "message"), relatedRequestId === undefined
            ? options
            : { ...options, relatedRequestId });
    }
    close() {
        return this.transport.close();
    }
    setProtocolVersion(version) {
        this.transport.setProtocolVersion?.(version);
    }
}
export function preserveFalsyRequestIds(transport) {
    return new FalsyRequestIdTransport(transport);
}
//# sourceMappingURL=request-id-transport.js.map