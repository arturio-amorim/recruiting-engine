/** Session-storage key the invoke panel reads a staged prefill from. */
export declare function prefillKeyFor(capabilityId: string): string;
/**
 * Hands a capability over to the Playground. An optional prefill is staged in
 * session storage for the invoke panel, the hash routes to the capability so
 * the link stays shareable, and both panels are notified so the catalog
 * selects the row and the editor applies the staged arguments.
 */
export declare function openCapabilityInPlayground(capabilityId: string, prefill?: string): void;
//# sourceMappingURL=playground-handoff.d.ts.map