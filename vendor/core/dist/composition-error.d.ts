export type CapabilityDeclarationProvenance = {
    readonly kind: "local";
    readonly localId: string;
} | {
    readonly kind: "atomic";
    readonly sourceName: string;
    readonly sourceVersion?: string;
    readonly defaultId: string;
} | {
    readonly kind: "library";
    readonly libraryName: string;
    readonly libraryVersion: string;
    readonly defaultId: string;
};
export type CapabilityCompositionIssue = {
    readonly code: "CAPABILITY_ID_COLLISION";
    readonly effectiveId: string;
    readonly declarations: readonly CapabilityDeclarationProvenance[];
} | {
    readonly code: "CAPABILITY_IMPORT_INVALID";
    readonly importKind: "atomic";
    readonly reason: "EXPORTED_CAPABILITY_REQUIRED";
} | {
    readonly code: "CAPABILITY_IMPORT_ID_NOT_FOUND";
    readonly libraryName: string;
    readonly defaultId: string;
} | {
    readonly code: "CAPABILITY_REMAP_NOT_SELECTED";
    readonly libraryName: string;
    readonly defaultId: string;
};
export declare class CapabilityCompositionError extends TypeError {
    readonly code: "CAPABILITY_COMPOSITION_INVALID";
    readonly issues: readonly CapabilityCompositionIssue[];
    constructor(issues: readonly CapabilityCompositionIssue[]);
}
export declare function isCapabilityCompositionError(value: unknown): value is CapabilityCompositionError;
//# sourceMappingURL=composition-error.d.ts.map