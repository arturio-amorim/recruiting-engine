import type { ConfigurationTargetId } from "./registry.js";
import { type TargetAdapter } from "./target-adapter.js";
type TomlDialect = "codex" | "grok";
interface TomlTargetOptions {
    readonly targetId: Extract<ConfigurationTargetId, "codex" | "grok-build">;
    readonly dialect: TomlDialect;
    readonly compatibility: TargetAdapter["compatibility"];
    readonly descriptorToDefinition: TargetAdapter["descriptorToDefinition"];
    readonly definitionToSuspendedDescriptor: TargetAdapter["definitionToSuspendedDescriptor"];
}
export declare function createTomlTargetAdapter(options: TomlTargetOptions): TargetAdapter;
export declare function tomlDefinition(definition: Record<string, unknown>): Readonly<Record<string, unknown>>;
export {};
//# sourceMappingURL=toml-target-adapter.d.ts.map