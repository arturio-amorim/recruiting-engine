const defaultCapacity = 500;
const defaultMaxCapturedBodyLength = 65_536;
/**
 * A bounded in-memory ring buffer of trace entries scoped to one dev-server
 * process. Nothing is persisted, aggregated, or exported; the only consumers
 * are the local interface event stream and in-process readers. Listener
 * failures never affect the writer.
 */
export function createTraceStore(options = {}) {
    const capacity = options.capacity ?? defaultCapacity;
    const maxBodyLength = options.maxCapturedBodyLength ?? defaultMaxCapturedBodyLength;
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
        throw new TypeError("capacity must be a positive safe integer.");
    }
    if (!Number.isSafeInteger(maxBodyLength) || maxBodyLength <= 0) {
        throw new TypeError("maxCapturedBodyLength must be a positive safe integer.");
    }
    const buffered = [];
    const listeners = new Set();
    let nextId = 0;
    const append = (entry) => {
        buffered.push(entry);
        if (buffered.length > capacity)
            buffered.shift();
        for (const listener of listeners) {
            try {
                listener(entry);
            }
            catch {
                // A listener failure must not affect tracing or the invocation path.
            }
        }
        return entry;
    };
    const stamp = () => {
        nextId += 1;
        return { id: nextId, at: new Date().toISOString() };
    };
    return {
        appendInvocation: (record) => append({ kind: "invocation", ...stamp(), invocation: record }),
        appendExchange: (capture) => {
            const requestTruncated = capture.requestBody.length > maxBodyLength;
            const responseTruncated = capture.responseBody.length > maxBodyLength;
            return append({
                kind: "exchange",
                ...stamp(),
                exchange: {
                    ...capture,
                    requestBody: requestTruncated
                        ? capture.requestBody.slice(0, maxBodyLength)
                        : capture.requestBody,
                    responseBody: responseTruncated
                        ? capture.responseBody.slice(0, maxBodyLength)
                        : capture.responseBody,
                },
                requestTruncated,
                responseTruncated,
                ...(requestTruncated
                    ? { requestOriginalSize: capture.requestBody.length }
                    : {}),
                ...(responseTruncated
                    ? { responseOriginalSize: capture.responseBody.length }
                    : {}),
            });
        },
        appendAdapterCall: (capture) => {
            const { input, ...withoutInput } = capture;
            const requestTruncated = capture.request.length > maxBodyLength;
            const responseTruncated = capture.response.length > maxBodyLength;
            return append({
                kind: "adapter",
                ...stamp(),
                call: {
                    ...withoutInput,
                    // A truncated input would no longer parse, so it is dropped rather
                    // than offered as a reproduction that silently rewrites the call.
                    ...(input !== undefined && input.length <= maxBodyLength
                        ? { input }
                        : {}),
                    request: requestTruncated
                        ? capture.request.slice(0, maxBodyLength)
                        : capture.request,
                    response: responseTruncated
                        ? capture.response.slice(0, maxBodyLength)
                        : capture.response,
                },
                requestTruncated,
                responseTruncated,
                ...(requestTruncated
                    ? { requestOriginalSize: capture.request.length }
                    : {}),
                ...(responseTruncated
                    ? { responseOriginalSize: capture.response.length }
                    : {}),
            });
        },
        appendNotice: (notice, detail) => append({
            kind: "notice",
            ...stamp(),
            notice,
            ...(detail === undefined || detail === "" ? {} : { detail }),
        }),
        entries: () => [...buffered],
        clear: () => {
            buffered.length = 0;
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
//# sourceMappingURL=trace-store.js.map