/**
 * The manifest accepts either separator; container paths and generated text
 * always use `/`. Validation has already rejected absolute paths, empty
 * segments, and `..`, so splitting is safe here.
 */
export declare function entrySegments(entry: string): readonly string[];
export declare function entryPosixPath(entry: string): string;
/**
 * The smallest thing the runtime stage has to copy: the top directory the
 * build emits, or the entry file itself when the build writes to the root.
 */
export declare function entryOutputPath(entry: string): string;
export declare function entryFileSystemPath(cwd: string, entry: string): string;
//# sourceMappingURL=entry.d.ts.map