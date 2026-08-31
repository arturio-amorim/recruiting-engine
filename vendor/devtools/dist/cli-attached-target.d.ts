import { type ParsedCliTarget } from "./cli-attached-contract.js";
export declare function composeAttachedCliEnvironment(overlay: Readonly<Record<string, string>>, platform: NodeJS.Platform, readHostEnv: (name: string) => string | undefined): Record<string, string>;
export declare function parseAttachedCliTarget(value: unknown): ParsedCliTarget;
//# sourceMappingURL=cli-attached-target.d.ts.map