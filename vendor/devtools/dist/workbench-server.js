import { createServer } from "node:http";
import { createAttachedRouter } from "./attached-router.js";
import { createAttachedSessionController } from "./attached-session.js";
// The asset surface is shared by both workbenches: one bundle directory, one
// stylesheet, one favicon.
import { createAttachedCliAssetServer as createSharedAssetServer, defaultAttachedCliUiRoot, } from "./cli-attached-assets.js";
import { attachedCliSecurityHeaders, oneAttachedCliRawHeader, sendAttachedCliError, sendAttachedCliErrorBeforeBodyConsumption, } from "./cli-attached-http.js";
import { createAttachedCliRouter } from "./cli-attached-router.js";
import { createAttachedCliSessionController } from "./cli-attached-session.js";
import { faviconLink } from "./favicon.js";
import { devtoolsHost, devtoolsOrigin, listenOnLoopback, literalLoopbackOrigin, loopbackAuthorities, } from "./loopback.js";
/** The workbenches the launcher mounts, and the path each answers on. */
export const workbenchPaths = Object.freeze({
    mcp: "/mcp",
    cli: "/cli",
});
export function isWorkbenchName(value) {
    return value === "mcp" || value === "cli";
}
const apiPrefixes = {
    mcp: "/api/mcp",
    cli: "/api/cli",
};
const chooserPage = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Senda DevTools</title>
${faviconLink}
<link rel="stylesheet" href="/assets/attached.css">
</head>
<body>
<noscript>The Senda DevTools interface requires JavaScript.</noscript>
<script type="module" src="/assets/chooser-app.js"></script>
</body>
</html>
`;
/**
 * The launcher: one loopback origin that opens on the workbench chooser and
 * mounts both idle workbenches next to each other. Neither workbench loads a
 * workspace, spawns a target, or opens an outbound connection until the
 * developer selects Connect inside it.
 */
export async function startWorkbenchDevtoolsServer(options = {}) {
    const mcpController = options.mcpController ?? createAttachedSessionController();
    const cliController = options.cliController ?? createAttachedCliSessionController();
    const uiRoot = options.uiRoot ?? defaultAttachedCliUiRoot();
    let authorities = new Set();
    let ownOrigin = "";
    let oauthRedirectUrl = "";
    let closed = false;
    const assets = createSharedAssetServer(uiRoot);
    const mcpRouter = createAttachedRouter({
        controller: mcpController,
        uiRoot,
        apiPrefix: apiPrefixes.mcp,
        allowedAuthorities: () => authorities,
        origin: () => ownOrigin,
        oauthRedirectUrl: () => oauthRedirectUrl,
    });
    const cliRouter = createAttachedCliRouter({
        controller: cliController,
        uiRoot,
        apiPrefix: apiPrefixes.cli,
        allowedAuthorities: () => authorities,
        origin: () => ownOrigin,
    });
    const sendPage = (response, page) => {
        response.writeHead(200, {
            ...attachedCliSecurityHeaders(),
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
        });
        response.end(page);
    };
    const handle = async (request, response) => {
        const requestHost = oneAttachedCliRawHeader(request, "host");
        if (requestHost === undefined || !authorities.has(requestHost)) {
            sendAttachedCliErrorBeforeBodyConsumption(request, response, 403, "FORBIDDEN", "The request host is not allowed.");
            return;
        }
        const rawTarget = request.url ?? "/";
        // Only the CLI mount is claimed here; every other target belongs to the
        // MCP router, which owns the OAuth callback and the not-found answer.
        if (rawTarget === apiPrefixes.cli ||
            rawTarget.startsWith(`${apiPrefixes.cli}/`)) {
            await cliRouter.handle(request, response);
            return;
        }
        const method = request.method ?? "GET";
        if (method === "GET") {
            if (rawTarget === "/") {
                sendPage(response, chooserPage);
                return;
            }
            if (rawTarget === workbenchPaths.mcp) {
                mcpRouter.shell(response, apiPrefixes.mcp, true);
                return;
            }
            if (rawTarget === workbenchPaths.cli) {
                cliRouter.shell(response, apiPrefixes.cli, true);
                return;
            }
            if (rawTarget === "/assets/favicon.svg") {
                assets.favicon(response);
                return;
            }
            if (rawTarget.startsWith("/assets/")) {
                await assets.serve(response, rawTarget.slice("/assets/".length).split("/"));
                return;
            }
        }
        await mcpRouter.handle(request, response);
    };
    const server = createServer((request, response) => {
        void handle(request, response).catch(() => {
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
    oauthRedirectUrl = `${literalLoopbackOrigin(boundPort)}/oauth/callback`;
    let closing;
    return {
        address: () => ({ host: devtoolsHost, port: boundPort }),
        path: (workbench) => workbench === undefined ? "/" : workbenchPaths[workbench],
        close: async () => {
            closing ??= (async () => {
                if (closed)
                    return;
                closed = true;
                mcpRouter.clearBrowserSessions();
                cliRouter.clearBrowserSessions();
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
                    mcpController.close(),
                    cliController.close(),
                ]);
                const failure = results.find((result) => result.status === "rejected");
                if (failure !== undefined)
                    throw failure.reason;
            })();
            return closing;
        },
    };
}
//# sourceMappingURL=workbench-server.js.map