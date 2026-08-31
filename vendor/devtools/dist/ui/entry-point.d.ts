import { type EntryPointView } from "./api.js";
/**
 * Which composition root runs an emulated CLI or MCP stdio call, chartered by
 * ADR 0030. The devtools child supplies the identity selected here; the
 * engine's own entry point supplies whatever its root decides, including no
 * principal at all — which is what the generated starter does.
 *
 * A direct call has no project entry point, so this control is not shown for
 * it: a generated `src/direct.ts` is a demonstration script, not an adapter.
 */
export type EntryAdapter = "cli" | "mcp-stdio";
export declare function rememberServedModule(specifier: string | undefined): void;
export declare function getEntryPoints(): EntryPointView;
/** Only for tests: forgets the cached selection and every registration. */
export declare function resetEntryPoints(): void;
export declare function loadEntryPoints(): Promise<void>;
/**
 * Proposes the conventional sibling of the served module — `dist/engine.js`
 * beside `dist/cli.js` — as a placeholder only. Nothing is read from disk and
 * nothing is selected until the developer confirms it.
 */
export declare function suggestEntryPath(moduleSpecifier: string | undefined, adapter: EntryAdapter): string;
export interface EntryPointControl {
    readonly element: HTMLElement;
    /** Shows the control for the adapter that has an entry point, or hides it. */
    show(adapter: EntryAdapter | undefined): void;
    setDisabled(disabled: boolean): void;
    /** Whether the current selection lets the interface choose the identity. */
    identityApplies(): boolean;
}
export declare function createEntryPointControl(owner: string, onChange: () => void): EntryPointControl;
//# sourceMappingURL=entry-point.d.ts.map