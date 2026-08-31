import type { GeneratedFile } from "./plan.js";
export type GeneratedFileStatus = "conflict" | "created" | "unchanged" | "updated";
/**
 * Applies one generated file under the marker policy. A byte-identical target
 * is left untouched, an unmarked target is refused, and a changed target is
 * replaced through a temporary file so a reader never observes half a file.
 */
export declare function applyGeneratedFile(root: string, file: GeneratedFile): Promise<GeneratedFileStatus>;
//# sourceMappingURL=write.d.ts.map