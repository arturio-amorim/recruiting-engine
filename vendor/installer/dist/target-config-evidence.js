import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { captureProcessOwnershipIdentity, validOwnershipIdentity, } from "./ownership-identity.js";
function blocked(code) {
    return Object.freeze({ kind: "blocked", code });
}
function safeEvidence(kind, path) {
    return Object.freeze({ kind, path: resolve(path) });
}
function isInsideHome(homeDirectory, candidate, allowHome = false) {
    if (!isAbsolute(homeDirectory) || !isAbsolute(candidate))
        return false;
    if (homeDirectory.includes("\0") || candidate.includes("\0"))
        return false;
    const normalizedHome = resolve(homeDirectory);
    const normalizedCandidate = resolve(candidate);
    const difference = relative(normalizedHome, normalizedCandidate);
    if (difference === "")
        return allowHome;
    return (difference !== ".." &&
        !difference.startsWith(`..${sep}`) &&
        !isAbsolute(difference));
}
function absoluteOverride(environment, name, homeDirectory) {
    let value;
    try {
        value = environment.get(name);
    }
    catch {
        return { kind: "invalid" };
    }
    if (value === undefined)
        return { kind: "unset" };
    if (typeof value !== "string" ||
        value.trim() === "" ||
        value.includes("\0") ||
        !isAbsolute(value)) {
        return { kind: "invalid" };
    }
    const path = resolve(value);
    return isInsideHome(homeDirectory, path, true)
        ? { kind: "valid", path }
        : { kind: "invalid" };
}
function openClawOverride(environment, name, operatingSystemHome, tildeHome) {
    let value;
    try {
        value = environment.get(name);
    }
    catch {
        return { kind: "invalid" };
    }
    if (value === undefined)
        return { kind: "unset" };
    if (typeof value !== "string" ||
        value.trim() === "" ||
        value.includes("\0")) {
        return { kind: "invalid" };
    }
    const path = value === "~"
        ? tildeHome
        : value.startsWith(`~${sep}`)
            ? join(tildeHome, value.slice(2))
            : value;
    if (!isAbsolute(path))
        return { kind: "invalid" };
    const normalizedPath = resolve(path);
    return isInsideHome(operatingSystemHome, normalizedPath, true)
        ? { kind: "valid", path: normalizedPath }
        : { kind: "invalid" };
}
async function inspectSingleConfig(options, homeDirectory, path) {
    if (!isInsideHome(homeDirectory, path)) {
        return blocked("HARNESS_CONFIG_UNSAFE");
    }
    const inspection = await inspectOwnedPath(options, homeDirectory, path, "regular-file");
    if (inspection === "read-failed") {
        return blocked("HARNESS_CONFIG_READ_FAILED");
    }
    if (inspection === "unsafe")
        return blocked("HARNESS_CONFIG_UNSAFE");
    return safeEvidence(inspection === "missing" ? "absent" : "present", path);
}
async function inspectOwnedPath(options, homeDirectory, targetPath, expectedTargetKind) {
    const ownership = options.ownership;
    if (ownership === undefined || !validOwnershipIdentity(ownership)) {
        return "unsafe";
    }
    const normalizedHome = resolve(homeDirectory);
    const normalizedTarget = resolve(targetPath);
    if (!isInsideHome(normalizedHome, normalizedTarget, expectedTargetKind === "directory")) {
        return "unsafe";
    }
    const difference = relative(normalizedHome, normalizedTarget);
    const componentPaths = [normalizedHome];
    if (difference !== "") {
        let componentPath = normalizedHome;
        for (const component of difference.split(sep)) {
            componentPath = join(componentPath, component);
            componentPaths.push(componentPath);
        }
    }
    let realHome;
    let previousRealPath;
    try {
        for (const [index, componentPath] of componentPaths.entries()) {
            const inspection = await options.fileSystem.inspectPath(componentPath);
            if (inspection.kind === "missing")
                return "missing";
            if (inspection.ownerId !== ownership.reportedOwnerId)
                return "unsafe";
            if (inspection.kind === "symbolic-link" || inspection.kind === "other") {
                return "unsafe";
            }
            const isTarget = index === componentPaths.length - 1;
            const expectedKind = isTarget ? expectedTargetKind : "directory";
            if (inspection.kind !== expectedKind)
                return "unsafe";
            if (!isAbsolute(inspection.realPath) ||
                inspection.realPath.includes("\0")) {
                return "unsafe";
            }
            const normalizedRealPath = resolve(inspection.realPath);
            if (index === 0) {
                realHome = normalizedRealPath;
            }
            else if (realHome === undefined ||
                !isInsideHome(realHome, normalizedRealPath) ||
                previousRealPath === undefined ||
                dirname(normalizedRealPath) !== previousRealPath) {
                return "unsafe";
            }
            previousRealPath = normalizedRealPath;
        }
        return "present";
    }
    catch {
        return "read-failed";
    }
}
async function inspectOwnedRegularFile(options, homeDirectory, targetPath) {
    const kind = await inspectOwnedPath(options, homeDirectory, targetPath, "regular-file");
    if (kind !== "present")
        return { kind };
    try {
        const inspection = await options.fileSystem.inspectPath(targetPath);
        if (inspection.kind !== "regular-file")
            return { kind: "unsafe" };
        if (inspection.byteLength !== undefined &&
            (!Number.isSafeInteger(inspection.byteLength) ||
                inspection.byteLength < 0)) {
            return { kind: "unsafe" };
        }
        return {
            kind: "present",
            ...(inspection.byteLength === 0 ? { empty: true } : {}),
        };
    }
    catch {
        return { kind: "read-failed" };
    }
}
function antigravityProbe(options) {
    return async ({ homeDirectory }) => {
        if (!isAbsolute(homeDirectory) || homeDirectory.includes("\0")) {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        const preferredPath = join(homeDirectory, ".gemini/config/mcp_config.json");
        const establishedPath = join(homeDirectory, ".gemini/antigravity/mcp_config.json");
        const candidates = [preferredPath, establishedPath];
        const inspections = await Promise.all(candidates.map((path) => inspectOwnedRegularFile(options, homeDirectory, path)));
        if (inspections.some(({ kind }) => kind === "read-failed")) {
            return blocked("HARNESS_CONFIG_READ_FAILED");
        }
        if (inspections.some(({ kind }) => kind === "unsafe")) {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        const populated = candidates.filter((_, index) => inspections[index]?.kind === "present" &&
            inspections[index]?.empty !== true);
        if (populated.length > 1)
            return blocked("HARNESS_CONFIG_AMBIGUOUS");
        const selected = populated[0];
        if (selected !== undefined)
            return safeEvidence("present", selected);
        const empty = candidates.find((_, index) => inspections[index]?.kind === "present" &&
            inspections[index]?.empty === true);
        return empty === undefined
            ? safeEvidence("absent", preferredPath)
            : safeEvidence("present", empty);
    };
}
function vscodeRemoteConfigPath(homeDirectory, executables) {
    const roots = new Set();
    for (const executable of executables) {
        if (executable.candidate !== "code")
            continue;
        const executablePath = resolve(executable.identity.realPath);
        if (!isInsideHome(homeDirectory, executablePath))
            continue;
        const segments = relative(resolve(homeDirectory), executablePath).split(sep);
        if (segments.length !== 6 ||
            (segments[0] !== ".vscode-server" &&
                segments[0] !== ".vscode-server-insiders") ||
            segments[1] !== "bin" ||
            segments[2]?.trim() === "" ||
            segments[3] !== "bin" ||
            segments[4] !== "remote-cli" ||
            segments[5] !== "code") {
            continue;
        }
        roots.add(segments[0]);
    }
    if (roots.size !== 1)
        return undefined;
    return join(homeDirectory, roots.values().next().value, "data/User/mcp.json");
}
function vscodeProbe(options) {
    if (options.platform === "win32") {
        return async () => blocked("TARGET_UNSUPPORTED");
    }
    return async ({ executables = [], homeDirectory }) => {
        const remotePath = vscodeRemoteConfigPath(homeDirectory, executables);
        const path = remotePath ??
            join(homeDirectory, options.platform === "darwin"
                ? "Library/Application Support/Code/User/mcp.json"
                : ".config/Code/User/mcp.json");
        return inspectSingleConfig(options, homeDirectory, path);
    };
}
function singleConfigProbe(options, relativeDefault, override) {
    return async ({ homeDirectory }) => {
        if (!isAbsolute(homeDirectory) || homeDirectory.includes("\0")) {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        let path = join(resolve(homeDirectory), relativeDefault);
        if (override !== undefined) {
            const selection = absoluteOverride(options.environment, override.name, homeDirectory);
            if (selection.kind === "invalid") {
                return blocked("HARNESS_CONFIG_UNSAFE");
            }
            if (selection.kind === "valid") {
                path = join(selection.path, override.fileName);
            }
        }
        return inspectSingleConfig(options, homeDirectory, path);
    };
}
function openCodeProbe(options) {
    return async ({ homeDirectory }) => {
        if (!isAbsolute(homeDirectory) || homeDirectory.includes("\0")) {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        const direct = absoluteOverride(options.environment, "OPENCODE_CONFIG_DIR", homeDirectory);
        if (direct.kind === "invalid")
            return blocked("HARNESS_CONFIG_UNSAFE");
        let directory;
        if (direct.kind === "valid") {
            directory = direct.path;
        }
        else {
            const xdg = absoluteOverride(options.environment, "XDG_CONFIG_HOME", homeDirectory);
            if (xdg.kind === "invalid")
                return blocked("HARNESS_CONFIG_UNSAFE");
            directory = join(xdg.kind === "valid" ? xdg.path : join(homeDirectory, ".config"), "opencode");
        }
        const jsonPath = join(directory, "opencode.json");
        const jsoncPath = join(directory, "opencode.jsonc");
        const candidates = [jsonPath, jsoncPath];
        if (candidates.some((path) => !isInsideHome(homeDirectory, path))) {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        const inspections = await Promise.all(candidates.map(async (path) => inspectOwnedPath(options, homeDirectory, path, "regular-file")));
        if (inspections.includes("read-failed")) {
            return blocked("HARNESS_CONFIG_READ_FAILED");
        }
        if (inspections.includes("unsafe")) {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        const existing = candidates.filter((_, index) => inspections[index] === "present");
        if (existing.length > 1)
            return blocked("HARNESS_CONFIG_AMBIGUOUS");
        const path = existing[0];
        return path === undefined
            ? safeEvidence("absent", jsonPath)
            : safeEvidence("present", path);
    };
}
function openClawProbe(options) {
    return async ({ homeDirectory }) => {
        if (!isAbsolute(homeDirectory) || homeDirectory.includes("\0")) {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        let profile;
        try {
            profile = options.environment.get("OPENCLAW_PROFILE");
        }
        catch {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        if (profile !== undefined) {
            if (typeof profile !== "string")
                return blocked("HARNESS_CONFIG_UNSAFE");
            const normalizedProfile = profile.trim();
            if (normalizedProfile !== "" &&
                normalizedProfile.toLowerCase() !== "default") {
                return blocked("TARGET_UNSUPPORTED");
            }
        }
        const operatingSystemHome = resolve(homeDirectory);
        const effectiveHomeOverride = openClawOverride(options.environment, "OPENCLAW_HOME", operatingSystemHome, operatingSystemHome);
        if (effectiveHomeOverride.kind === "invalid") {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        const effectiveHome = effectiveHomeOverride.kind === "valid"
            ? effectiveHomeOverride.path
            : operatingSystemHome;
        const effectiveHomeInspection = await inspectOwnedPath(options, operatingSystemHome, effectiveHome, "directory");
        if (effectiveHomeInspection === "read-failed") {
            return blocked("HARNESS_CONFIG_READ_FAILED");
        }
        if (effectiveHomeInspection === "unsafe") {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        const direct = openClawOverride(options.environment, "OPENCLAW_CONFIG_PATH", operatingSystemHome, effectiveHome);
        if (direct.kind === "invalid")
            return blocked("HARNESS_CONFIG_UNSAFE");
        if (direct.kind === "valid") {
            return inspectSingleConfig(options, operatingSystemHome, direct.path);
        }
        const state = openClawOverride(options.environment, "OPENCLAW_STATE_DIR", operatingSystemHome, effectiveHome);
        if (state.kind === "invalid")
            return blocked("HARNESS_CONFIG_UNSAFE");
        const openClawDirectory = join(effectiveHome, ".openclaw");
        const clawdbotDirectory = join(effectiveHome, ".clawdbot");
        const standardDirectories = [openClawDirectory, clawdbotDirectory];
        const candidates = [
            ...(state.kind === "valid"
                ? [join(state.path, "openclaw.json"), join(state.path, "clawdbot.json")]
                : []),
            ...standardDirectories.flatMap((directory) => [
                join(directory, "openclaw.json"),
                join(directory, "clawdbot.json"),
            ]),
        ];
        if (candidates.some((path) => !isInsideHome(operatingSystemHome, path))) {
            return blocked("HARNESS_CONFIG_UNSAFE");
        }
        for (const path of candidates) {
            const inspection = await inspectOwnedPath(options, operatingSystemHome, path, "regular-file");
            if (inspection === "present") {
                return safeEvidence("present", path);
            }
            if (inspection === "unsafe")
                return blocked("HARNESS_CONFIG_UNSAFE");
            if (inspection === "read-failed") {
                return blocked("HARNESS_CONFIG_READ_FAILED");
            }
        }
        if (state.kind === "valid") {
            return safeEvidence("absent", join(state.path, "openclaw.json"));
        }
        for (const directory of standardDirectories) {
            const inspection = await inspectOwnedPath(options, operatingSystemHome, directory, "directory");
            if (inspection === "present") {
                return safeEvidence("absent", join(directory, "openclaw.json"));
            }
            if (inspection === "unsafe")
                return blocked("HARNESS_CONFIG_UNSAFE");
            if (inspection === "read-failed") {
                return blocked("HARNESS_CONFIG_READ_FAILED");
            }
        }
        return safeEvidence("absent", join(openClawDirectory, "openclaw.json"));
    };
}
export function createProcessInstallerEnvironment() {
    return Object.freeze({ get: (name) => process.env[name] });
}
export function createNodeTargetConfigEvidenceProbes(options) {
    const resolvedOptions = {
        ...options,
        ownership: options.ownership ?? captureProcessOwnershipIdentity(),
        platform: options.platform ?? process.platform,
    };
    const unsupportedProbe = async () => blocked("TARGET_UNSUPPORTED");
    const claudeDesktop = resolvedOptions.platform === "darwin"
        ? singleConfigProbe(resolvedOptions, "Library/Application Support/Claude/claude_desktop_config.json")
        : unsupportedProbe;
    const vscode = vscodeProbe(resolvedOptions);
    return Object.freeze({
        antigravity: antigravityProbe(resolvedOptions),
        "claude-code": singleConfigProbe(resolvedOptions, ".claude.json", {
            name: "CLAUDE_CONFIG_DIR",
            fileName: ".claude.json",
        }),
        "claude-desktop": claudeDesktop,
        codex: singleConfigProbe(resolvedOptions, ".codex/config.toml", {
            name: "CODEX_HOME",
            fileName: "config.toml",
        }),
        cursor: singleConfigProbe(resolvedOptions, ".cursor/mcp.json"),
        "grok-build": singleConfigProbe(resolvedOptions, ".grok/config.toml", {
            name: "GROK_HOME",
            fileName: "config.toml",
        }),
        hermes: singleConfigProbe(resolvedOptions, ".hermes/config.yaml", {
            name: "HERMES_HOME",
            fileName: "config.yaml",
        }),
        "kimi-code": singleConfigProbe(resolvedOptions, ".kimi-code/mcp.json", {
            name: "KIMI_CODE_HOME",
            fileName: "mcp.json",
        }),
        openclaw: openClawProbe(resolvedOptions),
        "opencode-v2": openCodeProbe(resolvedOptions),
        vscode,
    });
}
//# sourceMappingURL=target-config-evidence.js.map