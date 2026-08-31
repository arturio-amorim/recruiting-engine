import { type ToggleStrategy } from "./jcs-fingerprint.js";
import type { ConfigurationTargetId } from "./registry.js";
import { type TargetAdapter } from "./target-adapter.js";
type JsonDialect = "antigravity" | "claude" | "cursor" | "kimi" | "opencode" | "vscode";
interface JsonTargetOptions {
    readonly targetId: Extract<ConfigurationTargetId, "antigravity" | "claude-code" | "claude-desktop" | "cursor" | "kimi-code" | "opencode-v2" | "vscode">;
    readonly dialect: JsonDialect;
    readonly toggleStrategy: ToggleStrategy;
    readonly compatibility: TargetAdapter["compatibility"];
    readonly descriptorToDefinition: TargetAdapter["descriptorToDefinition"];
    readonly definitionToSuspendedDescriptor: TargetAdapter["definitionToSuspendedDescriptor"];
}
export declare function createJsonTargetAdapter(options: JsonTargetOptions): TargetAdapter;
export declare function jsonDefinition(definition: Record<string, unknown>, toggleStrategy: ToggleStrategy): Readonly<Record<string, unknown>>;
export {};
//# sourceMappingURL=json-target-adapter.d.ts.map