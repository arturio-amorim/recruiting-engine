import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
export const entryAdapters = Object.freeze([
    "cli",
    "mcp-stdio",
]);
export class EntryTargetError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "EntryTargetError";
    }
}
const devtoolsEntry = Object.freeze({ kind: "devtools" });
export function isEntryAdapter(value) {
    return (typeof value === "string" && entryAdapters.includes(value));
}
function isInside(root, candidate) {
    const inside = relative(root, candidate);
    return (inside !== "" &&
        inside !== ".." &&
        !inside.startsWith(`..${sep}`) &&
        !isAbsolute(inside));
}
/**
 * Validates an entry point the interface named. The path is resolved against
 * the directory `serve` runs in and must stay inside it: the devtools executes
 * what the developer points at, and the project is the boundary of that. The
 * comparison uses canonical filesystem identity, so a symlink inside the
 * project cannot name a file outside it — and the canonical path is what the
 * child is later spawned with, so retargeting the link after selection does
 * not move what runs.
 */
export function parseEntryPoint(value, cwd) {
    if (typeof value !== "object" || value === null) {
        throw new EntryTargetError("INVALID_ENTRY_POINT", "The entry point is invalid.");
    }
    const record = value;
    if (record.kind === "devtools")
        return devtoolsEntry;
    if (record.kind !== "project") {
        throw new EntryTargetError("INVALID_ENTRY_POINT", "The entry point kind is unknown.");
    }
    if (typeof record.path !== "string" ||
        record.path.trim() === "" ||
        record.path.includes("\0")) {
        throw new EntryTargetError("INVALID_ENTRY_POINT", "A project entry point requires a path inside the project.");
    }
    const path = record.path.trim();
    const lexicalPath = resolve(cwd, path);
    if (!isInside(cwd, lexicalPath)) {
        throw new EntryTargetError("INVALID_ENTRY_POINT", "The entry point must be inside the directory the dev server runs in.");
    }
    let realCwd;
    let resolvedPath;
    try {
        realCwd = realpathSync(cwd);
        resolvedPath = realpathSync(lexicalPath);
    }
    catch {
        throw new EntryTargetError("INVALID_ENTRY_POINT", "The entry point does not exist inside the project.");
    }
    if (!isInside(realCwd, resolvedPath)) {
        throw new EntryTargetError("INVALID_ENTRY_POINT", "The entry point must be inside the directory the dev server runs in.");
    }
    return { kind: "project", path, resolvedPath };
}
export function createEntryTargetStore() {
    const entries = new Map();
    const listeners = new Set();
    const notify = () => {
        for (const listener of listeners) {
            try {
                listener();
            }
            catch {
                // A consumer failure must not affect the stored selection.
            }
        }
    };
    const summary = (adapter) => {
        const entry = entries.get(adapter) ?? devtoolsEntry;
        return entry.kind === "devtools"
            ? { kind: "devtools" }
            : { kind: "project", path: entry.path };
    };
    return {
        for: (adapter) => entries.get(adapter) ?? devtoolsEntry,
        view: () => ({ cli: summary("cli"), "mcp-stdio": summary("mcp-stdio") }),
        set: (adapter, entry) => {
            entries.set(adapter, entry);
            notify();
        },
        reset: () => {
            entries.clear();
            notify();
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
//# sourceMappingURL=entry-target.js.map