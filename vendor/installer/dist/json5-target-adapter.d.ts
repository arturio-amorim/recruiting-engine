import { type TargetAdapter } from "./target-adapter.js";
export declare function createJson5TargetAdapter(options: {
    readonly compatibility: TargetAdapter["compatibility"];
    readonly descriptorToDefinition: TargetAdapter["descriptorToDefinition"];
    readonly definitionToSuspendedDescriptor: TargetAdapter["definitionToSuspendedDescriptor"];
}): TargetAdapter;
export declare function json5Definition(definition: Record<string, unknown>): Readonly<Record<string, unknown>>;
//# sourceMappingURL=json5-target-adapter.d.ts.map