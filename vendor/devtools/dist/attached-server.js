import { createServer } from "node:http";
import { createAttachedRouter, defaultAttachedUiRoot, } from "./attached-router.js";
import { sendAttachedError } from "./attached-router.js";
import { createAttachedSessionController } from "./attached-session.js";
import { devtoolsHost, devtoolsOrigin, listenOnLoopback, literalLoopbackOrigin, loopbackAuthorities, } from "./loopback.js";
/**
 * The single-workbench MCP server: one loopback origin serving the workbench
 * shell, its JSON API under `/api`, and the OAuth callback. The launcher
 * mounts the same router next to the CLI one instead.
 */
export async function startAttachedDevtoolsServer(options) {
    const controller = options.controller ?? createAttachedSessionController();
    let authorities = new Set();
    let ownOrigin = "";
    let oauthRedirectUrl = "";
    let closed = false;
    const router = createAttachedRouter({
        controller,
        uiRoot: options.uiRoot ?? defaultAttachedUiRoot(),
        allowedAuthorities: () => authorities,
        origin: () => ownOrigin,
        oauthRedirectUrl: () => oauthRedirectUrl,
    });
    const server = createServer((request, response) => {
        void router.handle(request, response).catch(() => {
            if (!response.headersSent) {
                sendAttachedError(response, 500, "INTERNAL_ERROR", "The local devtools request failed.");
            }
            else {
                response.end();
            }
        });
    });
    const boundPort = await listenOnLoopback(server, {
        ...(options.port === undefined ? {} : { port: options.port }),
        ...(options.onPortInUse === undefined
            ? {}
            : { onPortInUse: options.onPortInUse }),
    });
    authorities = loopbackAuthorities(boundPort);
    ownOrigin = devtoolsOrigin(boundPort);
    oauthRedirectUrl = `${literalLoopbackOrigin(boundPort)}/oauth/callback`;
    let closing;
    return {
        address: () => ({ host: devtoolsHost, port: boundPort }),
        close: async () => {
            closing ??= (async () => {
                if (closed)
                    return;
                closed = true;
                router.clearBrowserSessions();
                const stopServer = new Promise((resolve, reject) => {
                    server.close((error) => {
                        if (error)
                            reject(error);
                        else
                            resolve();
                    });
                    server.closeAllConnections();
                });
                const results = await Promise.allSettled([
                    stopServer,
                    controller.close(),
                ]);
                const failure = results.find((result) => result.status === "rejected");
                if (failure !== undefined)
                    throw failure.reason;
            })();
            return closing;
        },
    };
}
//# sourceMappingURL=attached-server.js.map