import { type CapabilityInfo } from "./api.js";
/**
 * Light client-side check of the top-level fields so obvious mistakes are
 * caught before the round trip. Only required properties, primitive types,
 * and enum membership are checked; engine validation stays authoritative.
 */
export declare function validateArguments(args: unknown, schema: unknown): string | undefined;
/**
 * The invocation playground for one capability: a schema-seeded JSON editor,
 * the adapter switch, the invoke action, and the record of what the selected
 * adapter exchanged with the engine.
 */
export declare function renderInvokePanel(capability: CapabilityInfo): HTMLElement;
//# sourceMappingURL=invoke-panel.d.ts.map