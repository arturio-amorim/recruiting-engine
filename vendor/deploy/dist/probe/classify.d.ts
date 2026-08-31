import type { DeployErrorCode } from "../errors.js";
import type { ProbeExpectation } from "./options.js";
import type { ProbeExchange } from "./request.js";
/**
 * Fixed diagnostic text. A reason names a class of failure and never carries a
 * header value, a response body, or a transport message.
 */
export declare const probeReasons: Readonly<{
    readonly TIMEOUT: "the request exceeded the timeout";
    readonly CONNECTION: "the connection failed";
    readonly STATUS: "the endpoint answered with an unexpected status";
    readonly CHALLENGE: "the challenge did not offer Bearer authentication";
    readonly CREDENTIAL: "the endpoint rejected the credential";
    readonly MALFORMED: "the initialize response was malformed";
}>;
export type ProbeVerdict = {
    readonly healthy: true;
} | {
    readonly healthy: false;
    readonly code: Extract<DeployErrorCode, "PROBE_UNREACHABLE" | "PROBE_UNHEALTHY">;
    readonly status: number | undefined;
    readonly reason: string;
};
/**
 * Decides whether the observed exchange satisfies the expectation.
 *
 * `alive` accepts the authentication challenge deliberately: it proves the
 * adapter's boundary is serving without requiring the probe to hold a
 * credential. A 403 is never healthy, because a Host or Origin rejection would
 * reject real clients too.
 */
export declare function classifyProbeExchange(expect: ProbeExpectation, exchange: ProbeExchange): ProbeVerdict;
//# sourceMappingURL=classify.d.ts.map