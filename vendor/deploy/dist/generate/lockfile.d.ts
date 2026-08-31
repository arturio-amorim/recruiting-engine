export type PackageManagerId = "npm" | "pnpm" | "yarn";
export interface PackageManagerStrategy {
    readonly id: PackageManagerId;
    readonly lockfile: string;
    /** Restores the exact dependency tree recorded in the lockfile. */
    readonly install: string;
    readonly build: string;
    /** Reduces the installed tree to production dependencies only. */
    readonly prune: string;
}
/**
 * Every command is text placed inside a generated `Dockerfile`. The toolkit
 * never executes a package manager, so these strings are data, not a plan.
 */
export declare const packageManagerStrategies: Readonly<{
    readonly npm: Readonly<{
        build: "npm run build";
        id: "npm";
        install: "npm ci";
        lockfile: "package-lock.json";
        prune: "npm ci --omit=dev";
    }>;
    readonly pnpm: Readonly<{
        build: "pnpm run build";
        id: "pnpm";
        install: "pnpm install --frozen-lockfile";
        lockfile: "pnpm-lock.yaml";
        prune: "pnpm install --prod --frozen-lockfile";
    }>;
    readonly yarn: Readonly<{
        build: "yarn run build";
        id: "yarn";
        install: "yarn install --frozen-lockfile";
        lockfile: "yarn.lock";
        prune: "yarn install --production --frozen-lockfile";
    }>;
}>;
/** Sorted, so detection and diagnostics are stable across filesystems. */
export declare const supportedLockfileNames: readonly string[];
/**
 * Selects the single package manager the project is committed to. Zero or
 * several lockfiles are ambiguous inputs the author must resolve; the toolkit
 * never guesses one.
 */
export declare function selectPackageManager(presentLockfiles: readonly string[]): PackageManagerStrategy;
//# sourceMappingURL=lockfile.d.ts.map