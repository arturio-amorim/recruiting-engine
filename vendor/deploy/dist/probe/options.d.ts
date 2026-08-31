import { probeTimeoutDefaultMs } from "../probe-contract.js";
export { probeTimeoutDefaultMs };
export type ProbeExpectation = "alive" | "ready";
export interface ProbeOptions {
    readonly url: URL;
    readonly expect: ProbeExpectation;
    /** The exact `Host` header the request carries. */
    readonly hostHeader: string;
    /** Present only for a readiness probe that names a bearer variable. */
    readonly bearerToken: string | undefined;
    readonly timeoutMs: number;
}
export type ProbeOptionsResult = {
    readonly ok: true;
    readonly options: ProbeOptions;
} | {
    readonly ok: false;
};
export declare const probePath = "/mcp";
export declare const probeTimeoutMinMs = 1;
export declare const probeTimeoutMaxMs = 60000;
/**
 * Validates one `probe` invocation. The bearer token is read from the
 * environment by name and never from `args`, and the returned options are the
 * only place its value exists.
 */
export declare function parseProbeOptions(args: readonly string[], env: Readonly<Record<string, string | undefined>>): ProbeOptionsResult;
//# sourceMappingURL=options.d.ts.map