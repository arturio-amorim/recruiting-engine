import type { AdapterId, AdapterOutcome } from "./adapter-runner.js";
import type { InvocationRecord } from "./engine-host.js";
/**
 * One emulated capability call, whichever adapter carried it. The request and
 * response are already rendered for reading, because the shape of an exchange
 * differs per adapter: a JSON-RPC body, a `tools/call` frame, or a command and
 * its standard output.
 */
export interface AdapterCallCapture {
    readonly adapter: AdapterId;
    readonly capabilityId: string;
    readonly outcome: AdapterOutcome;
    readonly durationMs: number;
    readonly errorCode?: string;
    readonly request: string;
    readonly response: string;
    /** The invocation arguments as JSON, so the call can be reproduced. */
    readonly input?: string;
    /** The identity the call acted as; `null` when it ran anonymously. */
    readonly principalId?: string | null;
    /** The HTTP status, when the MCP HTTP adapter carried the call. */
    readonly status?: number;
    /** The exit code, when a child process carried the call. */
    readonly exitCode?: number | null;
    /** The command that ran, when a child process carried the call. */
    readonly command?: string;
}
export interface ExchangeCapture {
    readonly status: number;
    readonly durationMs: number;
    readonly mcpMethod?: string;
    readonly capabilityId?: string;
    readonly requestBody: string;
    readonly responseBody: string;
}
export type TraceEntry = {
    readonly kind: "invocation";
    readonly id: number;
    readonly at: string;
    readonly invocation: InvocationRecord;
} | {
    readonly kind: "exchange";
    readonly id: number;
    readonly at: string;
    readonly exchange: ExchangeCapture;
    readonly requestTruncated: boolean;
    readonly responseTruncated: boolean;
    /** Request body length in characters before truncation, when truncated. */
    readonly requestOriginalSize?: number;
    /** Response body length in characters before truncation, when truncated. */
    readonly responseOriginalSize?: number;
} | {
    readonly kind: "adapter";
    readonly id: number;
    readonly at: string;
    readonly call: AdapterCallCapture;
    readonly requestTruncated: boolean;
    readonly responseTruncated: boolean;
    /** Request length in characters before truncation, when truncated. */
    readonly requestOriginalSize?: number;
    /** Response length in characters before truncation, when truncated. */
    readonly responseOriginalSize?: number;
} | {
    readonly kind: "notice";
    readonly id: number;
    readonly at: string;
    readonly notice: string;
    /** Extra lifecycle context, such as build output or restart timing. */
    readonly detail?: string;
};
export interface TraceStore {
    appendInvocation(record: InvocationRecord): TraceEntry;
    appendExchange(capture: ExchangeCapture): TraceEntry;
    appendAdapterCall(capture: AdapterCallCapture): TraceEntry;
    appendNotice(notice: string, detail?: string): TraceEntry;
    entries(): ReadonlyArray<TraceEntry>;
    /** Drops every buffered entry; later appends keep their monotonic ids. */
    clear(): void;
    subscribe(listener: (entry: TraceEntry) => void): () => void;
}
export interface CreateTraceStoreOptions {
    /** Oldest entries are dropped beyond this bound. Defaults to 500. */
    readonly capacity?: number;
    /** Captured bodies are truncated to this many characters. Defaults to 65536. */
    readonly maxCapturedBodyLength?: number;
}
/**
 * A bounded in-memory ring buffer of trace entries scoped to one dev-server
 * process. Nothing is persisted, aggregated, or exported; the only consumers
 * are the local interface event stream and in-process readers. Listener
 * failures never affect the writer.
 */
export declare function createTraceStore(options?: CreateTraceStoreOptions): TraceStore;
//# sourceMappingURL=trace-store.d.ts.map