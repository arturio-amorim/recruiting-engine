import { createAttachedSessionController } from "./attached-session.js";
/**
 * The interactive authorization of one external MCP endpoint for the
 * playground, chartered by ADR 0029. It reuses the attached-mode session
 * controller accepted by ADR 0022 and ADR 0023, so the Authorization Code with
 * PKCE flow and the in-memory lifetime of every token are exactly the ones
 * already accepted — including ADR 0031's amendment, which follows the
 * authorization servers the resource's own metadata advertises.
 *
 * OAuth is the one authentication type that cannot be per call: the
 * authorization is a session. Every other type connects and closes with the
 * invocation that used it.
 */
const owner = "playground";
export function createPlaygroundOAuth() {
    const controller = createAttachedSessionController();
    return {
        begin: async (url, options) => {
            const authorization = await controller.beginOAuth(owner, { transport: "http", url, authentication: { type: "oauth" } }, options);
            return { authorizationUrl: authorization.authorizationUrl };
        },
        complete: async (state, authorizationCode) => {
            await controller.completeOAuth(state, authorizationCode);
        },
        reject: async (state) => {
            await controller.rejectOAuth(state);
        },
        disconnect: async () => {
            await controller.disconnect(owner);
        },
        call: (toolName, input, signal) => {
            signal.throwIfAborted();
            return controller.call(owner, toolName, input);
        },
        close: () => controller.close(),
    };
}
//# sourceMappingURL=playground-oauth.js.map