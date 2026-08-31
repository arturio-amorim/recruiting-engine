/**
 * Which composition root runs an emulated CLI or MCP stdio call, chartered by
 * ADR 0030. The devtools child is the default: it supplies the identity the
 * interface selected. The engine's own entry point supplies whatever its root
 * decides, including no principal at all, which is what the generated starter
 * does.
 */
/** The adapters whose composition root the developer can choose. */
export type EntryAdapter = "cli" | "mcp-stdio";
export declare const entryAdapters: readonly EntryAdapter[];
export type EntryPoint = {
    readonly kind: "devtools";
} | {
    readonly kind: "project";
    /** Project-relative path, as the developer named it. */
    readonly path: string;
    /** The absolute path the child is spawned with. */
    readonly resolvedPath: string;
};
export type EntryPointView = Readonly<Record<EntryAdapter, EntryPointSummary>>;
export interface EntryPointSummary {
    readonly kind: EntryPoint["kind"];
    readonly path?: string;
}
export declare class EntryTargetError extends Error {
    readonly code: "INVALID_ADAPTER" | "INVALID_ENTRY_POINT";
    constructor(code: "INVALID_ADAPTER" | "INVALID_ENTRY_POINT", message: string);
}
export interface EntryTargetStore {
    for(adapter: EntryAdapter): EntryPoint;
    view(): EntryPointView;
    set(adapter: EntryAdapter, entry: EntryPoint): void;
    reset(): void;
    subscribe(listener: () => void): () => void;
}
export declare function isEntryAdapter(value: unknown): value is EntryAdapter;
/**
 * Validates an entry point the interface named. The path is resolved against
 * the directory `serve` runs in and must stay inside it: the devtools executes
 * what the developer points at, and the project is the boundary of that. The
 * comparison uses canonical filesystem identity, so a symlink inside the
 * project cannot name a file outside it — and the canonical path is what the
 * child is later spawned with, so retargeting the link after selection does
 * not move what runs.
 */
export declare function parseEntryPoint(value: unknown, cwd: string): EntryPoint;
export declare function createEntryTargetStore(): EntryTargetStore;
//# sourceMappingURL=entry-target.d.ts.map