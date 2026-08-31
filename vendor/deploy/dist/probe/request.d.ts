import { probeProtocolVersion } from "../probe-contract.js";
import { type ProbeOptions } from "./options.js";
export { probeProtocolVersion };
/**
 * The single message the probe ever sends. It is a constant so the request is
 * identical on every invocation and carries nothing derived from the caller.
 */
export declare const probeInitializeBody: string;
export interface ProbeHttpResponse {
    readonly outcome: "response";
    readonly status: number;
    readonly challenge: string | undefined;
    readonly contentType: string | undefined;
    readonly body: string;
    readonly truncated: boolean;
}
export type ProbeExchange = ProbeHttpResponse | {
    readonly outcome: "timeout";
} | {
    readonly outcome: "connection-failure";
};
/**
 * Performs the one bounded request the probe is allowed. The deadline covers
 * connect through body, the socket is never reused, redirects are never
 * followed, and a failure is reported as a shape rather than as an error, so
 * no transport message or credential can reach a diagnostic.
 */
export declare function sendProbeRequest(options: ProbeOptions): Promise<ProbeExchange>;
//# sourceMappingURL=request.d.ts.map