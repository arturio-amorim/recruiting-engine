/**
 * The adapter surface of the Playground. An engine publishes one capability
 * through four execution paths, and the differences between them — how the
 * principal is established, how the arguments are carried, what the caller
 * finally sees — are what this selector makes observable.
 */
export type AdapterId = "direct" | "cli" | "mcp-stdio" | "mcp-http";
export interface AdapterPresentation {
    readonly id: AdapterId;
    readonly label: string;
    /** The chip shown beside the Invoke heading. */
    readonly route: string;
    /** One line describing what running through this adapter means. */
    readonly summary: string;
    /** How this adapter establishes the acting identity. */
    readonly identity: string;
}
export declare const adapterPresentations: readonly AdapterPresentation[];
export declare const defaultAdapter: AdapterId;
export declare function isAdapterId(value: unknown): value is AdapterId;
export declare function presentationFor(adapter: AdapterId): AdapterPresentation;
export declare function getSelectedAdapter(): AdapterId;
export declare function setSelectedAdapter(adapter: AdapterId): void;
/** Only for tests: drops the cached selection and every registration. */
export declare function resetAdapterSelection(): void;
/**
 * Builds the adapter switch: a radio group whose options are the execution
 * paths the engine publishes. Selecting one changes every panel, so the
 * caller's `onChange` is called for its own selection and for a selection made
 * on another capability.
 */
export interface AdapterSelector {
    readonly element: HTMLElement;
    /** Locks the switch while a call is in flight so the record stays honest. */
    setDisabled(disabled: boolean): void;
}
export declare function createAdapterSelector(owner: string, onChange: (adapter: AdapterId) => void): AdapterSelector;
//# sourceMappingURL=adapters.d.ts.map