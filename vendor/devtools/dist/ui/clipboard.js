import { el } from "./dom.js";
const restoreDelayMs = 1_600;
function clipboardWriter() {
    return globalThis.navigator?.clipboard;
}
let manualCopyArea;
/**
 * Non-secure contexts lack `navigator.clipboard`; fall back to a hidden
 * textarea plus `document.execCommand("copy")`, or at least leave the text
 * selected so a manual copy still works.
 */
function legacyCopy(text) {
    const doc = globalThis.document;
    if (doc?.createElement === undefined)
        return "unavailable";
    if (manualCopyArea === undefined) {
        manualCopyArea = doc.createElement("textarea");
        manualCopyArea.setAttribute("readonly", "");
        manualCopyArea.setAttribute("style", "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;");
    }
    const area = manualCopyArea;
    if (doc.body === undefined || typeof area.select !== "function") {
        return "unavailable";
    }
    area.value = text;
    doc.body.append(area);
    area.select();
    let copied = false;
    if (typeof doc.execCommand === "function") {
        try {
            copied = doc.execCommand("copy");
        }
        catch {
            copied = false;
        }
    }
    if (copied) {
        area.value = "";
        area.remove();
        return "copied";
    }
    // The node stays attached only while the selection it holds is the user's
    // only way to copy; the value is cleared on the next attempt.
    return "selected";
}
/**
 * A compact copy control for one dense surface. Lifting a payload out of the
 * workbench is the most repeated gesture in this interface, so every code
 * window, schema, and traced body carries its own button that reports the
 * outcome in place instead of relying on manual selection.
 */
export function createCopyButton(label, read, className = "copy-button") {
    const button = el("button", {
        type: "button",
        class: className,
        "data-state": "idle",
        "aria-label": `Copy ${label}`,
        "aria-live": "polite",
        title: `Copy ${label}`,
    }, ["Copy"]);
    let restore;
    const report = (text, failed) => {
        button.textContent = text;
        button.setAttribute("data-state", failed ? "failed" : "copied");
        if (restore !== undefined)
            clearTimeout(restore);
        restore = setTimeout(() => {
            restore = undefined;
            button.textContent = "Copy";
            button.setAttribute("data-state", "idle");
        }, restoreDelayMs);
    };
    button.addEventListener("click", () => {
        const text = read();
        if (text === "") {
            report("Nothing yet", true);
            return;
        }
        const clipboard = clipboardWriter();
        if (clipboard === undefined) {
            const outcome = legacyCopy(text);
            if (outcome === "copied")
                report("Copied", false);
            else if (outcome === "selected")
                report("Selected", false);
            else
                report("Unavailable", true);
            return;
        }
        void clipboard.writeText(text).then(() => {
            report("Copied", false);
        }, () => {
            report("Failed", true);
        });
    });
    return button;
}
/** Formats an elapsed measurement for a status line at readable precision. */
export function formatDuration(durationMs) {
    if (durationMs >= 1_000)
        return `${(durationMs / 1_000).toFixed(2)} s`;
    return `${durationMs.toFixed(1)} ms`;
}
//# sourceMappingURL=clipboard.js.map