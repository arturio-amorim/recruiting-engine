import { type AttachedCliCapabilityDescription, type AttachedCliCapabilitySummary } from "./cli-attached-contract.js";
export declare function parseAttachedCliJson(buffer: Buffer): unknown;
export declare function parseAttachedCliCatalog(buffer: Buffer): readonly AttachedCliCapabilitySummary[];
export declare function parseAttachedCliDescription(buffer: Buffer): AttachedCliCapabilityDescription;
export declare function encodeAttachedCliRunInput(input: unknown): string;
//# sourceMappingURL=cli-attached-protocol.d.ts.map