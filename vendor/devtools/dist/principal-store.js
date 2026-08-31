import { randomBytes } from "node:crypto";
export const defaultPrincipalId = "local-dev";
/**
 * Reads the bearer token of an `Authorization` header value. The scheme is
 * matched case-insensitively per RFC 9110; anything else carries no token.
 */
function readBearerToken(header) {
    if (header === null)
        return null;
    const match = /^[ \t]*bearer[ \t]+(\S+)[ \t]*$/i.exec(header);
    return match?.[1] ?? null;
}
/**
 * An in-memory map from minted opaque bearer tokens to development
 * principals. Tokens exist only in process memory; the store performs no
 * persistence and no network activity. The store always starts with one
 * default principal so a fresh dev server is immediately invocable.
 */
export function createPrincipalStore() {
    const records = new Map();
    const listeners = new Set();
    const mintToken = () => randomBytes(24).toString("base64url");
    const mintKey = () => {
        let key;
        do {
            key = `p_${randomBytes(9).toString("base64url")}`;
        } while (records.has(key));
        return key;
    };
    const notify = () => {
        for (const listener of listeners) {
            try {
                listener();
            }
            catch {
                // A mirror consumer failure must not affect the store.
            }
        }
    };
    const issue = (principal) => {
        const snapshot = structuredClone(principal);
        const key = mintKey();
        const token = mintToken();
        records.set(key, { token, principal: snapshot });
        notify();
        return { key, token, principal: snapshot };
    };
    issue({ id: defaultPrincipalId });
    return {
        issue,
        update: (key, principal) => {
            const record = records.get(key);
            if (record === undefined)
                return null;
            record.principal = structuredClone(principal);
            notify();
            return { key, token: record.token, principal: record.principal };
        },
        rotate: (key) => {
            const record = records.get(key);
            if (record === undefined)
                return null;
            record.token = mintToken();
            notify();
            return { key, token: record.token, principal: record.principal };
        },
        remove: (key) => {
            const removed = records.delete(key);
            if (removed)
                notify();
            return removed;
        },
        list: () => [...records.entries()].map(([key, record]) => ({
            key,
            token: record.token,
            principal: record.principal,
        })),
        resolve: (token) => {
            for (const record of records.values()) {
                if (record.token === token)
                    return record.principal;
            }
            return null;
        },
        authenticate: (request) => {
            const token = readBearerToken(request.headers.get("authorization"));
            if (token === null)
                return null;
            for (const record of records.values()) {
                if (record.token === token)
                    return record.principal;
            }
            return null;
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
//# sourceMappingURL=principal-store.js.map