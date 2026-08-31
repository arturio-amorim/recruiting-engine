import { el } from "./dom.js";
export const adapterPresentations = Object.freeze([
    Object.freeze({
        id: "direct",
        label: "Direct",
        route: "engine.invoke",
        summary: "Calls the engine directly, the way an embedding application does.",
        identity: "Runs as the selected identity, supplied at the call.",
    }),
    Object.freeze({
        id: "cli",
        label: "CLI",
        route: "engine run → engine.invoke",
        summary: "Runs the CLI adapter as a process and reports its exit code and streams.",
        identity: "Runs as the selected identity, fixed when the process starts.",
    }),
    Object.freeze({
        id: "mcp-stdio",
        label: "MCP stdio",
        route: "stdio tools/call → engine.invoke",
        summary: "Launches the stdio MCP server and calls it the way an MCP client does.",
        identity: "Runs as the selected identity, fixed when the process starts.",
    }),
    Object.freeze({
        id: "mcp-http",
        label: "MCP HTTP",
        route: "tools/call → engine.invoke",
        summary: "Sends one Streamable HTTP request to the running engine host.",
        identity: "Authenticates each request with the identity's session token.",
    }),
]);
export const defaultAdapter = "mcp-http";
const selectionKey = "senda-devtools:adapter";
export function isAdapterId(value) {
    return adapterPresentations.some((entry) => entry.id === value);
}
export function presentationFor(adapter) {
    return (adapterPresentations.find((entry) => entry.id === adapter) ??
        adapterPresentations[adapterPresentations.length - 1]);
}
/**
 * The selected adapter is shared by every capability panel and survives a
 * reload, because comparing one capability across adapters and comparing one
 * adapter across capabilities are both normal moves here.
 */
let selected;
export function getSelectedAdapter() {
    if (selected !== undefined)
        return selected;
    try {
        const stored = sessionStorage.getItem(selectionKey);
        selected = isAdapterId(stored) ? stored : defaultAdapter;
    }
    catch {
        selected = defaultAdapter;
    }
    return selected;
}
/**
 * Followers are keyed by their owner, so rebuilding a panel replaces its
 * registration instead of stacking one. The number of registrations is
 * therefore bounded by the catalog size, not by how often a panel is rebuilt.
 */
const listeners = new Map();
export function setSelectedAdapter(adapter) {
    if (getSelectedAdapter() === adapter)
        return;
    selected = adapter;
    try {
        sessionStorage.setItem(selectionKey, adapter);
    }
    catch {
        // The selection is a convenience; the session still works in memory.
    }
    for (const listener of listeners.values()) {
        try {
            listener(adapter);
        }
        catch {
            // One panel failing to follow must not stop the others.
        }
    }
}
/** Only for tests: drops the cached selection and every registration. */
export function resetAdapterSelection() {
    selected = undefined;
    listeners.clear();
}
export function createAdapterSelector(owner, onChange) {
    const buttons = new Map();
    const paint = (adapter) => {
        for (const [id, button] of buttons) {
            const active = id === adapter;
            button.classList.toggle("selected", active);
            button.setAttribute("aria-checked", String(active));
            button.setAttribute("tabindex", active ? "0" : "-1");
        }
    };
    const group = el("div", {
        class: "adapter-switch",
        role: "radiogroup",
        "aria-label": "Execution path",
    }, adapterPresentations.map((presentation) => {
        const button = el("button", {
            type: "button",
            class: "adapter-choice",
            role: "radio",
            "aria-checked": "false",
            tabindex: "-1",
            title: `${presentation.summary} ${presentation.identity}`,
        }, [presentation.label]);
        button.addEventListener("click", () => {
            setSelectedAdapter(presentation.id);
        });
        buttons.set(presentation.id, button);
        return button;
    }));
    group.addEventListener("keydown", (event) => {
        const keyboardEvent = event;
        const order = adapterPresentations.map((entry) => entry.id);
        const current = order.findIndex((id) => buttons.get(id) === keyboardEvent.target);
        if (current < 0)
            return;
        let next = current;
        if (keyboardEvent.key === "ArrowRight" || keyboardEvent.key === "ArrowDown")
            next = current + 1;
        else if (keyboardEvent.key === "ArrowLeft" ||
            keyboardEvent.key === "ArrowUp")
            next = current - 1;
        else if (keyboardEvent.key === "Home")
            next = 0;
        else if (keyboardEvent.key === "End")
            next = order.length - 1;
        else
            return;
        keyboardEvent.preventDefault();
        const adapter = order.at((next + order.length) % order.length);
        if (adapter === undefined)
            return;
        setSelectedAdapter(adapter);
        buttons.get(adapter)?.focus();
    });
    listeners.set(owner, (adapter) => {
        paint(adapter);
        onChange(adapter);
    });
    paint(getSelectedAdapter());
    return {
        element: group,
        setDisabled: (disabled) => {
            for (const button of buttons.values())
                button.disabled = disabled;
        },
    };
}
//# sourceMappingURL=adapters.js.map