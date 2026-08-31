import { InstallerError, installerErrorMessages, } from "./installer-error.js";
import { inspectEngineManagedInstallations, } from "./managed-installations.js";
import { removeEngineDescriptorFromTarget, } from "./mutation-coordinator.js";
function blockedCode(view) {
    if (view.status === "enabled" ||
        view.status === "disabled" ||
        view.status === "outdated") {
        return undefined;
    }
    if (view.status === "drifted")
        return "CONFIG_DRIFT";
    if (view.status === "conflict")
        return "CONFIG_CONFLICT";
    return view.unavailableCode ?? "INSTALLATION_UNAVAILABLE";
}
function logFailure(prompter, view, code) {
    prompter.log("error", `${view.displayName}: ${code}: ${installerErrorMessages[code]}`);
}
function cancelled(prompter) {
    prompter.cancel(installerErrorMessages.CANCELLED);
    return 130;
}
export async function runEngineRemovalSession(options) {
    const views = await inspectEngineManagedInstallations({
        dependencies: options.dependencies,
        engineId: options.source.id,
        manifestServerName: options.source.serverName,
        snapshot: options.snapshot,
    });
    if (views.length === 0) {
        options.prompter.outro(`${options.source.title} is already uninstalled.`);
        return 0;
    }
    const classified = views.map((view) => {
        const code = blockedCode(view);
        return code === undefined ? { view } : { view, code };
    });
    options.prompter.note(classified
        .map(({ view, code }) => `${view.installation.serverName} · ${view.displayName}: ${code === undefined ? "removable" : `blocked (${code})`}`)
        .join("\n"), "Engine uninstall preflight");
    const removable = classified.filter((item) => item.code === undefined && item.view.descriptor !== undefined);
    const blocked = classified.filter((item) => item.code !== undefined);
    if (removable.length === 0) {
        for (const { view, code } of blocked) {
            logFailure(options.prompter, view, code);
        }
        options.prompter.outro("Engine uninstall could not remove any target.");
        return 1;
    }
    const confirmation = await options.prompter.confirm(`Remove ${options.source.title} from ${String(removable.length)} MCP client configuration${removable.length === 1 ? "" : "s"}?`);
    if (confirmation.kind === "cancelled")
        return cancelled(options.prompter);
    if (!confirmation.value) {
        options.prompter.outro("No changes were made.");
        return 0;
    }
    let failed = blocked.length > 0;
    for (const { view, code } of blocked) {
        logFailure(options.prompter, view, code);
    }
    for (const { view } of removable) {
        const descriptor = view.descriptor;
        if (descriptor === undefined)
            throw new InstallerError("STATE_INVALID");
        const result = await removeEngineDescriptorFromTarget({
            dependencies: options.dependencies,
            descriptor,
            manifestServerName: options.source.serverName,
            snapshot: options.snapshot,
            targetId: view.installation.targetId,
        });
        if (result.outcome === "failed") {
            failed = true;
            logFailure(options.prompter, view, result.code);
            continue;
        }
        options.prompter.log("success", `${view.displayName}: ${result.outcome === "unchanged" ? "already absent" : "removed"}.`);
    }
    options.prompter.outro(failed
        ? "Engine uninstall completed with errors."
        : `${options.source.title} was removed from managed MCP clients.`);
    return failed ? 1 : 0;
}
//# sourceMappingURL=engine-removal-session.js.map