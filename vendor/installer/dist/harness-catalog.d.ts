import type { ConfigurationTargetId } from "./registry.js";
export interface HarnessSurfaceDefinition {
    readonly id: "antigravity-cli" | "antigravity-ide" | "claude-code" | "claude-desktop" | "codex" | "cursor" | "grok-build" | "hermes" | "kimi-code" | "openclaw" | "opencode-v2" | "vscode";
    readonly displayName: string;
    readonly executableCandidates: readonly string[];
    readonly targetId: ConfigurationTargetId;
}
export interface ConfigurationTargetDefinition {
    readonly id: ConfigurationTargetId;
    readonly displayName: string;
    readonly reloadHint: string;
}
export declare const harnessSurfaceCatalog: readonly [HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition, HarnessSurfaceDefinition];
export type HarnessSurfaceId = (typeof harnessSurfaceCatalog)[number]["id"];
export declare const configurationTargetCatalog: readonly [ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition, ConfigurationTargetDefinition];
//# sourceMappingURL=harness-catalog.d.ts.map