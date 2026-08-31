import { join } from "node:path";
const separator = /[\\/]/u;
/**
 * The manifest accepts either separator; container paths and generated text
 * always use `/`. Validation has already rejected absolute paths, empty
 * segments, and `..`, so splitting is safe here.
 */
export function entrySegments(entry) {
    return entry.split(separator);
}
export function entryPosixPath(entry) {
    return entrySegments(entry).join("/");
}
/**
 * The smallest thing the runtime stage has to copy: the top directory the
 * build emits, or the entry file itself when the build writes to the root.
 */
export function entryOutputPath(entry) {
    return entrySegments(entry)[0];
}
export function entryFileSystemPath(cwd, entry) {
    return join(cwd, ...entrySegments(entry));
}
//# sourceMappingURL=entry.js.map