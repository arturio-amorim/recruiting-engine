/**
 * The host every devtools URL is printed and opened with. The servers bind
 * the literal IPv4 loopback address because that is the one address every
 * platform resolves `localhost` to, but a developer never has to read or type
 * a numeric address.
 */
export const devtoolsHost = "localhost";
/**
 * The bind address, and the only host an OAuth redirect URL may use: RFC 8252
 * prefers the literal loopback address over `localhost`, and the MCP client
 * accepts nothing else.
 */
export const literalLoopbackHost = "127.0.0.1";
export const defaultDevtoolsPort = 4100;
const maximumPort = 65_535;
const defaultPortAttempts = 20;
export function devtoolsOrigin(port) {
    return `http://${devtoolsHost}:${String(port)}`;
}
export function literalLoopbackOrigin(port) {
    return `http://${literalLoopbackHost}:${String(port)}`;
}
/**
 * Every authority a browser can reach the bound port through. A request host
 * outside this set is refused, which keeps the DNS-rebinding guard while
 * letting `localhost`, the literal address, and an OAuth redirect all work
 * against one server.
 */
export function loopbackAuthorities(port) {
    const suffix = `:${String(port)}`;
    return new Set([
        `${devtoolsHost}${suffix}`,
        `${literalLoopbackHost}${suffix}`,
        `[::1]${suffix}`,
    ]);
}
export function loopbackOrigins(port) {
    return [...loopbackAuthorities(port)].map((authority) => `http://${authority}`);
}
function isAddressInUse(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "EADDRINUSE");
}
function listenOnce(server, port) {
    return new Promise((resolve, reject) => {
        const fail = (error) => {
            reject(error);
        };
        server.once("error", fail);
        server.listen(port, literalLoopbackHost, () => {
            server.removeListener("error", fail);
            resolve();
        });
    });
}
/**
 * Binds the server to loopback, walking to the next port when the requested
 * one is taken, the way a dev server is expected to behave. The bound port is
 * returned; an explicit ephemeral request (port zero) never walks.
 */
export async function listenOnLoopback(server, options = {}) {
    const requested = options.port ?? defaultDevtoolsPort;
    const attempts = requested === 0
        ? 1
        : Math.max(1, options.maxPortAttempts ?? defaultPortAttempts);
    if (requested < 0 || requested > maximumPort) {
        throw new RangeError(`A loopback port must be between 0 and ${String(maximumPort)}.`);
    }
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const candidate = requested === 0 ? 0 : requested + attempt;
        // The walk stops at the top of the range rather than wrapping around.
        if (candidate > maximumPort)
            break;
        try {
            await listenOnce(server, candidate);
            return server.address().port;
        }
        catch (error) {
            if (!isAddressInUse(error))
                throw error;
            lastError = error;
            if (attempt < attempts - 1)
                options.onPortInUse?.(candidate);
        }
    }
    if (lastError === undefined) {
        throw new RangeError(`No loopback port was free between ${String(requested)} and ${String(maximumPort)}.`);
    }
    throw lastError;
}
//# sourceMappingURL=loopback.js.map