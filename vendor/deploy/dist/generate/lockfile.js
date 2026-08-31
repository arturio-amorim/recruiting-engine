import { DeployError } from "../errors.js";
/**
 * Every command is text placed inside a generated `Dockerfile`. The toolkit
 * never executes a package manager, so these strings are data, not a plan.
 */
export const packageManagerStrategies = Object.freeze({
    npm: Object.freeze({
        build: "npm run build",
        id: "npm",
        install: "npm ci",
        lockfile: "package-lock.json",
        prune: "npm ci --omit=dev",
    }),
    pnpm: Object.freeze({
        build: "pnpm run build",
        id: "pnpm",
        install: "pnpm install --frozen-lockfile",
        lockfile: "pnpm-lock.yaml",
        prune: "pnpm install --prod --frozen-lockfile",
    }),
    yarn: Object.freeze({
        build: "yarn run build",
        id: "yarn",
        install: "yarn install --frozen-lockfile",
        lockfile: "yarn.lock",
        prune: "yarn install --production --frozen-lockfile",
    }),
});
const strategies = Object.freeze([
    packageManagerStrategies.npm,
    packageManagerStrategies.pnpm,
    packageManagerStrategies.yarn,
]);
/** Sorted, so detection and diagnostics are stable across filesystems. */
export const supportedLockfileNames = Object.freeze(strategies.map((strategy) => strategy.lockfile));
/**
 * Selects the single package manager the project is committed to. Zero or
 * several lockfiles are ambiguous inputs the author must resolve; the toolkit
 * never guesses one.
 */
export function selectPackageManager(presentLockfiles) {
    const present = strategies.filter((strategy) => presentLockfiles.includes(strategy.lockfile));
    if (present.length === 0) {
        throw new DeployError("LOCKFILE_MISSING", {
            details: [...supportedLockfileNames],
        });
    }
    if (present.length > 1) {
        throw new DeployError("LOCKFILE_AMBIGUOUS", {
            details: present.map((strategy) => strategy.lockfile),
        });
    }
    return present[0];
}
//# sourceMappingURL=lockfile.js.map