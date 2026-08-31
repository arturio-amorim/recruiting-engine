/**
 * Keeps version-control data, installed dependencies, tests, coverage output,
 * and every environment file out of the build context. The `.env*` exclusions
 * are normative: a production image must never contain a local environment
 * file, and the running platform injects real values instead.
 */
export declare const dockerignoreEntries: readonly string[];
export declare function renderDockerignore(): string;
//# sourceMappingURL=dockerignore.d.ts.map