import { type TargetAdapter } from "./target-adapter.js";
export declare function createYamlTargetAdapter(options: {
    readonly compatibility: TargetAdapter["compatibility"];
    readonly descriptorToDefinition: TargetAdapter["descriptorToDefinition"];
    readonly definitionToSuspendedDescriptor: TargetAdapter["definitionToSuspendedDescriptor"];
}): TargetAdapter;
export declare function yamlDefinition(definition: Record<string, unknown>): Readonly<Record<string, unknown>>;
//# sourceMappingURL=yaml-target-adapter.d.ts.map