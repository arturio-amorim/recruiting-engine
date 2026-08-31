import { createServer } from "node:http";
import { defaultAttachedCliUiRoot } from "./cli-attached-assets.js";
import { sendAttachedCliError } from "./cli-attached-http.js";
import { createAttachedCliRouter } from "./cli-attached-router.js";
import { devtoolsHost, devtoolsOrigin, listenOnLoopback, loopbackAuthorities, } from "./loopback.js";
import { createAttachedCliSessionController, } from "./cli-attached-session.js";
export async function startAttachedCliDevtoolsServer(options = {}) {
    const controller = options.controller ?? createAttachedCliSessionController();
    let authorities = new Set();
    let ownOrigin = "";
    let closed = false;
    const router = createAttachedCliRouter({
        controller,
        uiRoot: options.uiRoot ?? defaultAttachedCliUiRoot(),
        allowedAuthorities: () => authorities,
        origin: () => ownOrigin,
    });
    const server = createServer((request, response) => {
        void router.handle(request, response).catch(() => {
            if (!response.headersSent) {
                sendAttachedCliError(response, 500, "INTERNAL_ERROR", "The local devtools request failed.");
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
//# sourceMappingURL=cli-attached-server.js.map