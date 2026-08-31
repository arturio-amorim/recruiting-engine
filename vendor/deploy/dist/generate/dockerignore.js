import { generatedFileMarkerLine } from "./marker.js";
/**
 * Keeps version-control data, installed dependencies, tests, coverage output,
 * and every environment file out of the build context. The `.env*` exclusions
 * are normative: a production image must never contain a local environment
 * file, and the running platform injects real values instead.
 */
export const dockerignoreEntries = Object.freeze([
    ".git",
    ".gitignore",
    "node_modules",
    "**/node_modules",
    "test",
    "coverage",
    ".env*",
    "**/.env*",
    "Dockerfile",
    ".dockerignore",
]);
export function renderDockerignore() {
    return `${[generatedFileMarkerLine("hash"), ...dockerignoreEntries].join("\n")}\n`;
}
//# sourceMappingURL=dockerignore.js.map