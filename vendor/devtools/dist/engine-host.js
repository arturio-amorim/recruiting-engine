import { EngineError } from "@senda/core";
import { serveMcpHttp } from "@senda/mcp";
function readErrorCode(error) {
    return error instanceof EngineError && typeof error.code === "string"
        ? error.code
        : undefined;
}
/**
 * Wraps the loaded engine in an observing delegate. The delegate forwards
 * every call unchanged — it never reads capability definitions, never
 * constructs a context, and never alters arguments, results, or errors — and
 * records timing and outcome after each invocation settles. A record consumer
 * failure cannot change the invocation result.
 */
function createObservingDelegate(engine, emit) {
    let sequence = 0;
    const safeEmit = (record) => {
        try {
            emit(record);
        }
        catch {
            // Observation is best-effort and must not change invocation behavior.
        }
    };
    return {
        name: engine.name,
        version: engine.version,
        list: () => engine.list(),
        describe: (capabilityId) => engine.describe(capabilityId),
        async invoke(capabilityId, input, options) {
            sequence += 1;
            const invocationSequence = sequence;
            const startedAt = new Date().toISOString();
            const startedAtMs = performance.now();
            const durationMs = () => Math.max(0, performance.now() - startedAtMs);
            try {
                const result = await engine.invoke(capabilityId, input, options);
                safeEmit({
                    sequence: invocationSequence,
                    capabilityId,
                    startedAt,
                    durationMs: durationMs(),
                    outcome: "completed",
                });
                return result;
            }
            catch (error) {
                const errorCode = readErrorCode(error);
                safeEmit({
                    sequence: invocationSequence,
                    capabilityId,
                    startedAt,
                    durationMs: durationMs(),
                    outcome: "failed",
                    ...(errorCode === undefined ? {} : { errorCode }),
                });
                throw error;
            }
        },
    };
}
/**
 * Starts the engine host: the unmodified `serveMcpHttp` adapter bound to
 * loopback, serving the observing delegate with required bearer
 * authentication. Every capability execution reaches the engine through
 * `engine.invoke` with source `mcp-http`.
 */
export async function startEngineHost(options) {
    const delegate = createObservingDelegate(options.engine, options.onRecord ?? (() => undefined));
    return serveMcpHttp(delegate, {
        host: "127.0.0.1",
        port: options.port ?? 0,
        allowedOrigins: options.allowedOrigins,
        auth: { mode: "required", authenticate: options.authenticate },
    });
}
//# sourceMappingURL=engine-host.js.map