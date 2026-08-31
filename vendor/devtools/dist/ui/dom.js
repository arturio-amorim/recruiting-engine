/** Builds an element with attributes and children; text stays text. */
export function el(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }
    for (const child of children) {
        if (child === null || child === undefined)
            continue;
        element.append(child);
    }
    return element;
}
export function clear(element) {
    while (element.firstChild)
        element.firstChild.remove();
}
export function pretty(value) {
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return String(value);
    }
}
//# sourceMappingURL=dom.js.map