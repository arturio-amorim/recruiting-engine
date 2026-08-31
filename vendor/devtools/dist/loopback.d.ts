import type { Server } from "node:net";
/**
 * The host every devtools URL is printed and opened with. The servers bind
 * the literal IPv4 loopback address because that is the one address every
 * platform resolves `localhost` to, but a developer never has to read or type
 * a numeric address.
 */
export declare const devtoolsHost = "localhost";
/**
 * The bind address, and the only host an OAuth redirect URL may use: RFC 8252
 * prefers the literal loopback address over `localhost`, and the MCP client
 * accepts nothing else.
 */
export declare const literalLoopbackHost = "127.0.0.1";
export declare const defaultDevtoolsPort = 4100;
export declare function devtoolsOrigin(port: number): string;
export declare function literalLoopbackOrigin(port: number): string;
/**
 * Every authority a browser can reach the bound port through. A request host
 * outside this set is refused, which keeps the DNS-rebinding guard while
 * letting `localhost`, the literal address, and an OAuth redirect all work
 * against one server.
 */
export declare function loopbackAuthorities(port: number): ReadonlySet<string>;
export declare function loopbackOrigins(port: number): readonly string[];
export interface ListenOnLoopbackOptions {
    /** Defaults to 4100. Zero binds an ephemeral port without walking. */
    readonly port?: number;
    /** How many consecutive ports may be tried. Defaults to 20. */
    readonly maxPortAttempts?: number;
    /** Called with each taken port before the next one is tried. */
    readonly onPortInUse?: (port: number) => void;
}
/**
 * Binds the server to loopback, walking to the next port when the requested
 * one is taken, the way a dev server is expected to behave. The bound port is
 * returned; an explicit ephemeral request (port zero) never walks.
 */
export declare function listenOnLoopback(server: Server, options?: ListenOnLoopbackOptions): Promise<number>;
//# sourceMappingURL=loopback.d.ts.map