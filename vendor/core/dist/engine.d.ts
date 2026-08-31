import { type InferSchemaInput, type InferSchemaOutput } from "./schema.js";
import type { AnyCapability, CapabilityDescription, CapabilityMap, CapabilitySummary, EngineEvent, EngineLogger, InvokeOptions } from "./types.js";
type CapabilityInput<Capability extends AnyCapability> = InferSchemaInput<Capability["input"]>;
type CapabilityOutput<Capability extends AnyCapability> = InferSchemaOutput<Capability["output"]>;
export interface EngineDefinition<Capabilities extends CapabilityMap> {
    readonly name: string;
    readonly version: string;
    readonly capabilities: Capabilities;
    readonly logger?: EngineLogger;
    readonly onEvent?: (event: EngineEvent) => void | Promise<void>;
}
export interface Engine<Capabilities extends CapabilityMap = CapabilityMap> {
    readonly name: string;
    readonly version: string;
    invoke<CapabilityId extends Extract<keyof Capabilities, string>>(capabilityId: CapabilityId, input: CapabilityInput<Capabilities[CapabilityId]>, options?: InvokeOptions): Promise<CapabilityOutput<Capabilities[CapabilityId]>>;
    list(): ReadonlyArray<CapabilitySummary>;
    describe(capabilityId: Extract<keyof Capabilities, string>): CapabilityDescription;
}
export declare function createEngine<const Capabilities extends CapabilityMap>(definition: EngineDefinition<Capabilities>): Engine<Capabilities>;
export {};
//# sourceMappingURL=engine.d.ts.map