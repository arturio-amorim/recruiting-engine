import { configurationTargetCatalog, harnessSurfaceCatalog, } from "./harness-catalog.js";
function executableIdentityKey(identity) {
    return `${String(identity.device)}:${String(identity.inode)}`;
}
function freezeExecutable(candidate, evidence) {
    return Object.freeze({
        candidate,
        path: evidence.path,
        identity: Object.freeze({ ...evidence.identity }),
        ...(evidence.legacyAliasFor === undefined
            ? {}
            : { legacyAliasFor: evidence.legacyAliasFor }),
    });
}
function uniqueExecutables(executables) {
    const found = [];
    const identities = new Set();
    for (const executable of executables) {
        const key = executableIdentityKey(executable.identity);
        if (identities.has(key))
            continue;
        identities.add(key);
        found.push(executable);
    }
    return Object.freeze(found);
}
async function detectSurfaceExecutables(candidates, resolveExecutable) {
    const found = [];
    const identities = new Set();
    for (const candidate of candidates) {
        const evidence = await resolveExecutable(candidate);
        if (evidence === undefined)
            continue;
        const key = executableIdentityKey(evidence.identity);
        if (identities.has(key))
            continue;
        identities.add(key);
        found.push(freezeExecutable(candidate, evidence));
    }
    return Object.freeze(found);
}
function displayNameForTarget(targetDisplayName, surfaces) {
    if (surfaces.length === 0)
        return targetDisplayName;
    if (surfaces.length === 2 &&
        surfaces[0]?.id === "antigravity-cli" &&
        surfaces[1]?.id === "antigravity-ide") {
        return "Antigravity (AGY CLI + IDE)";
    }
    if (surfaces.length === 1)
        return surfaces[0]?.displayName ?? targetDisplayName;
    return surfaces.map(({ displayName }) => displayName).join(" + ");
}
function uniqueTargetExecutables(surfaces) {
    return uniqueExecutables(surfaces.flatMap(({ executables }) => executables));
}
export async function detectHarnesses(options) {
    const homeDirectory = options.resolveHomeDirectory();
    const surfaces = [];
    let agyIdentities = new Set();
    for (const definition of harnessSurfaceCatalog) {
        let executables = await detectSurfaceExecutables(definition.executableCandidates, options.resolveExecutable);
        if (definition.id === "antigravity-cli") {
            agyIdentities = new Set(executables.map(({ identity }) => executableIdentityKey(identity)));
        }
        else if (definition.id === "antigravity-ide") {
            const legacyAliases = executables.filter(({ legacyAliasFor }) => legacyAliasFor === "agy");
            executables = Object.freeze(executables.filter(({ identity, legacyAliasFor }) => legacyAliasFor !== "agy" &&
                !agyIdentities.has(executableIdentityKey(identity))));
            if (legacyAliases.length > 0) {
                const cliIndex = surfaces.findIndex(({ id }) => id === "antigravity-cli");
                const cli = surfaces[cliIndex];
                if (cli !== undefined) {
                    const cliExecutables = uniqueExecutables([
                        ...cli.executables,
                        ...legacyAliases,
                    ]);
                    surfaces[cliIndex] = Object.freeze({
                        ...cli,
                        evidence: "installed",
                        executables: cliExecutables,
                    });
                    agyIdentities = new Set(cliExecutables.map(({ identity }) => executableIdentityKey(identity)));
                }
            }
        }
        surfaces.push(Object.freeze({
            id: definition.id,
            displayName: definition.displayName,
            targetId: definition.targetId,
            evidence: executables.length === 0 ? "absent" : "installed",
            executables,
        }));
    }
    const targets = [];
    for (const definition of configurationTargetCatalog) {
        const installedSurfaces = surfaces.filter(({ evidence, targetId }) => targetId === definition.id && evidence === "installed");
        const targetExecutables = uniqueTargetExecutables(installedSurfaces);
        const configuration = await options.configEvidenceProbes[definition.id]({
            homeDirectory,
            targetId: definition.id,
            executables: targetExecutables,
        });
        const evidence = configuration.kind === "blocked"
            ? "blocked"
            : installedSurfaces.length > 0
                ? "installed"
                : configuration.kind === "present"
                    ? "configuration-only"
                    : "absent";
        targets.push(Object.freeze({
            id: definition.id,
            displayName: displayNameForTarget(definition.displayName, installedSurfaces),
            surfaceIds: Object.freeze(installedSurfaces.map(({ id }) => id)),
            evidence,
            executables: targetExecutables,
            configuration: Object.freeze({ ...configuration }),
            eligible: evidence === "installed" || evidence === "configuration-only",
            mayCreateConfiguration: evidence === "installed",
            reloadHint: definition.reloadHint,
        }));
    }
    return Object.freeze({
        homeDirectory,
        surfaces: Object.freeze(surfaces),
        targets: Object.freeze(targets),
    });
}
//# sourceMappingURL=harness-detection.js.map