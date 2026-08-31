import { api } from "./api.js";
import { el } from "./dom.js";
const defaultView = {
    cli: { kind: "devtools" },
    "mcp-stdio": { kind: "devtools" },
};
let current = defaultView;
let loaded = false;
/** The served module, used only to propose a conventional sibling path. */
let servedModule;
export function rememberServedModule(specifier) {
    servedModule = specifier;
}
/** Keyed by owner so a rebuilt panel replaces its registration. */
const listeners = new Map();
function publish() {
    for (const listener of listeners.values()) {
        try {
            listener(current);
        }
        catch {
            // One panel failing to follow must not stop the others.
        }
    }
}
function isEntryPointView(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const record = value;
    return (typeof record.cli === "object" &&
        record.cli !== null &&
        typeof record["mcp-stdio"] === "object" &&
        record["mcp-stdio"] !== null);
}
export function getEntryPoints() {
    return current;
}
/** Only for tests: forgets the cached selection and every registration. */
export function resetEntryPoints() {
    current = defaultView;
    loaded = false;
    servedModule = undefined;
    listeners.clear();
}
export async function loadEntryPoints() {
    if (loaded)
        return;
    loaded = true;
    try {
        const view = await api.entryPoints();
        if (!isEntryPointView(view))
            return;
        current = view;
        publish();
    }
    catch {
        // The default selection stays; invoking will report the real failure.
    }
}
/**
 * Proposes the conventional sibling of the served module — `dist/engine.js`
 * beside `dist/cli.js` — as a placeholder only. Nothing is read from disk and
 * nothing is selected until the developer confirms it.
 */
export function suggestEntryPath(moduleSpecifier, adapter) {
    const file = adapter === "cli" ? "cli.js" : "mcp-stdio.js";
    if (moduleSpecifier === undefined || moduleSpecifier === "") {
        return `dist/${file}`;
    }
    const separator = moduleSpecifier.lastIndexOf("/");
    return separator === -1
        ? file
        : `${moduleSpecifier.slice(0, separator + 1)}${file}`;
}
export function createEntryPointControl(owner, onChange) {
    let adapter;
    const choice = el("select", { class: "entry-choice", "aria-label": "Entry point" }, [
        el("option", { value: "devtools" }, ["Devtools entry point"]),
        el("option", { value: "project" }, ["Project entry point…"]),
    ]);
    const path = el("input", {
        type: "text",
        class: "entry-path",
        "aria-label": "Project entry point path",
        spellcheck: "false",
    });
    const apply = el("button", { type: "button", class: "entry-apply" }, ["Use"]);
    const cancel = el("button", { type: "button", class: "entry-cancel" }, [
        "Cancel",
    ]);
    const form = el("div", { class: "entry-form" }, [path, apply, cancel]);
    form.hidden = true;
    const feedback = el("p", { class: "entry-feedback", "aria-live": "polite" }, [
        "",
    ]);
    const selection = () => adapter === undefined ? { kind: "devtools" } : current[adapter];
    const paint = () => {
        const entry = selection();
        choice.value = entry.kind === "project" ? "project" : "devtools";
        if (entry.kind === "project" && entry.path !== undefined) {
            path.value = entry.path;
        }
        onChange();
    };
    const send = async (body) => {
        feedback.textContent = "";
        try {
            const view = await api.setEntryPoint(body);
            current = view;
            form.hidden = true;
            publish();
        }
        catch (error) {
            feedback.textContent =
                error instanceof Error
                    ? error.message
                    : "The entry point could not be selected.";
            paint();
        }
    };
    choice.addEventListener("change", () => {
        if (adapter === undefined)
            return;
        if (choice.value === "project") {
            if (path.value.trim() === "") {
                path.value = suggestEntryPath(servedModule, adapter);
            }
            form.hidden = false;
            path.focus();
            return;
        }
        form.hidden = true;
        void send({ adapter, entryPoint: { kind: "devtools" } });
    });
    apply.addEventListener("click", () => {
        if (adapter === undefined)
            return;
        void send({
            adapter,
            entryPoint: { kind: "project", path: path.value.trim() },
        });
    });
    cancel.addEventListener("click", () => {
        form.hidden = true;
        feedback.textContent = "";
        paint();
    });
    listeners.set(owner, paint);
    const element = el("div", { class: "entry-control" }, [
        el("span", { class: "field-label" }, ["Entry"]),
        choice,
        form,
        feedback,
    ]);
    element.hidden = true;
    return {
        element,
        show: (next) => {
            adapter = next;
            element.hidden = next === undefined;
            if (next !== undefined) {
                form.hidden = true;
                paint();
            }
        },
        setDisabled: (disabled) => {
            choice.disabled = disabled;
            apply.disabled = disabled;
        },
        identityApplies: () => selection().kind !== "project",
    };
}
//# sourceMappingURL=entry-point.js.map