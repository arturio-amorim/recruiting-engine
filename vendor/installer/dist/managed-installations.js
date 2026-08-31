import { InstallerError } from "./installer-error.js";
import { loadInstallerState, } from "./installer-state.js";
import { buildStateTargetContracts, } from "./mutation-coordinator.js";
import { planOwnership } from "./ownership-planner.js";
import { capturePathIdentity, capturePathRoot, } from "./path-identity.js";
import { targetConfigByteLimit } from "./target-adapter.js";
function sameStat(expected, actual) {
    return (expected !== undefined &&
        expected.kind === actual.kind &&
        expected.dev === actual.dev &&
        expected.ino === actual.ino &&
        expected.uid === actual.uid &&
        expected.gid === actual.gid);
}
async function readConfig(dependencies, identity) {
    if (identity.missingPaths.length > 0)
        return undefined;
    let handle;
    try {
        handle = await dependencies.fileSystem.openReadNoFollow(identity.targetPath);
        if (!sameStat(identity.components.at(-1), await handle.stat())) {
            throw new InstallerError("CONFIG_CHANGED");
        }
        return await handle.readAll(targetConfigByteLimit);
    }
    catch (cause) {
        if (cause instanceof InstallerError)
            throw cause;
        throw new InstallerError("HARNESS_CONFIG_READ_FAILED", cause);
    }
    finally {
        await handle?.close().catch(() => undefined);
    }
}
function persistedDescriptorFor(installation) {
    if (installation.launchDescriptor === undefined)
        return undefined;
    return Object.freeze({
        id: installation.entryId,
        version: installation.registryVersion,
        title: installation.serverName,
        description: `Managed ${installation.serverName} MCP server.`,
        capabilityIds: Object.freeze([installation.entryId]),
        server: installation.launchDescriptor,
    });
}
function descriptorFor(installation, registry) {
    const registered = registry.entries.find(({ descriptor }) => descriptor.id === installation.entryId)?.descriptor;
    return persistedDescriptorFor(installation) ?? registered;
}
function unavailable(key, installation, descriptor, displayName, code) {
    return Object.freeze({
        key,
        installation,
        ...(descriptor === undefined ? {} : { descriptor }),
        displayName,
        status: "unavailable",
        actions: Object.freeze([]),
        ...(code === undefined ? {} : { unavailableCode: code }),
    });
}
export async function inspectManagedInstallations(options) {
    const contracts = buildStateTargetContracts(options.snapshot, options.dependencies.adapters);
    const loaded = await loadInstallerState({
        ownership: options.dependencies.ownership,
        environment: options.dependencies.environment,
        fileSystem: options.dependencies.fileSystem,
        homeDirectory: options.snapshot.homeDirectory,
        targetContracts: contracts,
        allowUnavailableTargetContracts: true,
    });
    const homeRoot = await capturePathRoot(options.dependencies.fileSystem, {
        rootKind: "home",
        rootPath: options.snapshot.homeDirectory,
        ownership: options.dependencies.ownership,
    }).catch((cause) => {
        throw new InstallerError("HARNESS_CONFIG_UNSAFE", cause);
    });
    const views = [];
    const entries = Object.entries(loaded.state.installations).sort(([left], [right]) => left.localeCompare(right));
    for (const [key, installation] of entries) {
        const descriptor = descriptorFor(installation, options.registry);
        const target = options.snapshot.targets.find(({ id }) => id === installation.targetId);
        const adapter = options.dependencies.adapters[installation.targetId];
        const displayName = target?.displayName ?? installation.targetId;
        if (descriptor === undefined ||
            !adapter.compatibility(descriptor).supported ||
            target === undefined ||
            target.configuration.kind === "blocked" ||
            target.configuration.path !== installation.configPath ||
            contracts[installation.targetId] === undefined) {
            views.push(unavailable(key, installation, descriptor, displayName));
            continue;
        }
        const identity = await capturePathIdentity(options.dependencies.fileSystem, {
            root: homeRoot,
            targetPath: installation.configPath,
            targetKind: "regular-file",
        }).catch((cause) => {
            throw new InstallerError("HARNESS_CONFIG_UNSAFE", cause);
        });
        const inspection = adapter.inspect({
            source: await readConfig(options.dependencies, identity),
            serverName: installation.serverName,
        });
        const ownership = planOwnership({
            descriptor,
            targetId: installation.targetId,
            target: contracts[installation.targetId],
            state: loaded.state,
            registryDefinition: adapter.descriptorToDefinition(descriptor),
            ...(installation.suspendedDescriptor === undefined
                ? {}
                : {
                    normalizedSuspendedDefinition: adapter.suspendedDescriptorToDefinition(installation.suspendedDescriptor),
                }),
            currentServer: inspection.currentServer,
        });
        views.push(Object.freeze({
            key,
            installation,
            descriptor,
            displayName,
            status: ownership.status,
            actions: ownership.actions,
        }));
    }
    return Object.freeze(views);
}
function unavailableCode(cause, fallback) {
    return cause instanceof InstallerError ? cause.code : fallback;
}
export async function inspectEngineManagedInstallations(options) {
    const contracts = buildStateTargetContracts(options.snapshot, options.dependencies.adapters);
    const loaded = await loadInstallerState({
        ownership: options.dependencies.ownership,
        environment: options.dependencies.environment,
        fileSystem: options.dependencies.fileSystem,
        homeDirectory: options.snapshot.homeDirectory,
        targetContracts: Object.freeze({}),
        allowUnavailableTargetContracts: true,
    });
    const allEntries = Object.entries(loaded.state.installations);
    if (allEntries.some(([, installation]) => installation.entryId !== options.engineId &&
        installation.serverName === options.manifestServerName)) {
        throw new InstallerError("ENGINE_IDENTITY_MISMATCH");
    }
    const targetOrder = new Map(options.snapshot.targets.map(({ id }, index) => [id, index]));
    const entries = allEntries
        .filter(([, installation]) => installation.entryId === options.engineId)
        .sort(([, left], [, right]) => (targetOrder.get(left.targetId) ?? Number.MAX_SAFE_INTEGER) -
        (targetOrder.get(right.targetId) ?? Number.MAX_SAFE_INTEGER));
    if (entries.length === 0)
        return Object.freeze([]);
    const homeRoot = await capturePathRoot(options.dependencies.fileSystem, {
        rootKind: "home",
        rootPath: options.snapshot.homeDirectory,
        ownership: options.dependencies.ownership,
    }).catch((cause) => {
        throw new InstallerError("HARNESS_CONFIG_UNSAFE", cause);
    });
    const views = [];
    for (const [key, installation] of entries) {
        const descriptor = persistedDescriptorFor(installation);
        const target = options.snapshot.targets.find(({ id }) => id === installation.targetId);
        const displayName = target?.displayName ?? installation.targetId;
        if (descriptor === undefined) {
            views.push(unavailable(key, installation, descriptor, displayName, "INSTALLATION_UNAVAILABLE"));
            continue;
        }
        if (target === undefined) {
            views.push(unavailable(key, installation, descriptor, displayName, "TARGET_UNSUPPORTED"));
            continue;
        }
        if (target.configuration.kind === "blocked") {
            views.push(unavailable(key, installation, descriptor, displayName, target.configuration.code));
            continue;
        }
        const contract = contracts[installation.targetId];
        const adapter = options.dependencies.adapters[installation.targetId];
        if (contract === undefined ||
            target.configuration.path !== installation.configPath ||
            contract.targetContractVersion !== installation.targetContractVersion ||
            contract.toggleStrategy !== installation.toggleStrategy) {
            views.push(unavailable(key, installation, descriptor, displayName, "HARNESS_CONFIG_UNSAFE"));
            continue;
        }
        if (!adapter.compatibility(descriptor).supported) {
            views.push(unavailable(key, installation, descriptor, displayName, "TARGET_UNSUPPORTED"));
            continue;
        }
        try {
            const identity = await capturePathIdentity(options.dependencies.fileSystem, {
                root: homeRoot,
                targetPath: installation.configPath,
                targetKind: "regular-file",
            });
            const inspection = adapter.inspect({
                source: await readConfig(options.dependencies, identity),
                serverName: installation.serverName,
            });
            const ownership = planOwnership({
                descriptor,
                targetId: installation.targetId,
                target: contract,
                state: loaded.state,
                registryDefinition: adapter.descriptorToDefinition(descriptor),
                ...(installation.suspendedDescriptor === undefined
                    ? {}
                    : {
                        normalizedSuspendedDefinition: adapter.suspendedDescriptorToDefinition(installation.suspendedDescriptor),
                    }),
                currentServer: inspection.currentServer,
            });
            views.push(Object.freeze({
                key,
                installation,
                descriptor,
                displayName,
                status: ownership.status,
                actions: ownership.actions,
            }));
        }
        catch (cause) {
            views.push(unavailable(key, installation, descriptor, displayName, unavailableCode(cause, "HARNESS_CONFIG_UNSAFE")));
        }
    }
    return Object.freeze(views);
}
//# sourceMappingURL=managed-installations.js.map