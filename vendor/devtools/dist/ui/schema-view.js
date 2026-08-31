import { createCopyButton } from "./clipboard.js";
import { el, pretty } from "./dom.js";
const maxFieldDepth = 6;
function asSchema(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return undefined;
    }
    return value;
}
function schemaType(schema) {
    if (typeof schema.type === "string")
        return schema.type;
    if (Array.isArray(schema.type)) {
        const types = schema.type.filter((value) => typeof value === "string");
        if (types.length > 0)
            return types.join(" | ");
    }
    if (typeof schema.$ref === "string") {
        return schema.$ref.split("/").at(-1) ?? "reference";
    }
    if (Array.isArray(schema.oneOf))
        return "one of";
    if (Array.isArray(schema.anyOf))
        return "any of";
    if (Array.isArray(schema.allOf))
        return "all of";
    if (asSchema(schema.properties) !== undefined)
        return "object";
    if (schema.items !== undefined)
        return "array";
    return "unspecified";
}
function propertyEntries(schema) {
    const properties = asSchema(schema.properties);
    if (properties === undefined)
        return [];
    return Object.entries(properties).flatMap(([name, value]) => {
        const property = asSchema(value);
        return property === undefined ? [] : [[name, property]];
    });
}
function requiredFields(schema) {
    if (!Array.isArray(schema.required))
        return new Set();
    return new Set(schema.required.filter((value) => typeof value === "string"));
}
function inlineValue(value) {
    const formatted = pretty(value).replaceAll("\n", " ");
    return formatted.length > 72 ? `${formatted.slice(0, 69)}…` : formatted;
}
function constraintItems(schema) {
    const items = [];
    if (typeof schema.format === "string") {
        items.push(el("span", {}, ["Format ", el("code", {}, [schema.format])]));
    }
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        items.push(el("span", {}, [
            "Allowed ",
            ...schema.enum.flatMap((value, index) => [
                index === 0 ? null : ", ",
                el("code", {}, [inlineValue(value)]),
            ]),
        ]));
    }
    if (schema.default !== undefined) {
        items.push(el("span", {}, [
            "Default ",
            el("code", {}, [inlineValue(schema.default)]),
        ]));
    }
    return items;
}
function renderField(name, schema, required, depth = 0) {
    const constraints = constraintItems(schema);
    return el("article", { class: "schema-field", role: "listitem" }, [
        el("div", { class: "schema-field-heading" }, [
            el("code", { class: "schema-field-name" }, [name]),
            el("span", { class: "schema-type" }, [schemaType(schema)]),
            el("span", { class: required ? "schema-required" : "schema-optional" }, [
                required ? "required" : "optional",
            ]),
        ]),
        typeof schema.description === "string" && schema.description.trim() !== ""
            ? el("p", { class: "schema-field-description" }, [schema.description])
            : null,
        constraints.length === 0
            ? null
            : el("div", { class: "schema-constraints" }, constraints),
        renderNested(schema, depth),
    ]);
}
/**
 * Renders what a field hides below its own row: nested object properties,
 * array item shapes, and oneOf/anyOf branches — each one level deeper.
 */
function renderNested(schema, depth, includeProperties = true) {
    if (depth >= maxFieldDepth)
        return null;
    const sections = [];
    if (includeProperties) {
        const fields = propertyEntries(schema);
        if (fields.length > 0) {
            const required = requiredFields(schema);
            sections.push(el("div", { class: "schema-nested", role: "list" }, fields.map(([name, field]) => renderField(name, field, required.has(name), depth + 1))));
        }
    }
    const items = asSchema(schema.items);
    if (items !== undefined) {
        const itemView = renderNested(items, depth + 1);
        if (itemView !== null) {
            sections.push(el("div", { class: "schema-nested-items" }, [
                el("p", { class: "schema-nested-label" }, ["Each item"]),
                itemView,
            ]));
        }
    }
    for (const combinator of ["oneOf", "anyOf"]) {
        const branches = schema[combinator];
        if (!Array.isArray(branches))
            continue;
        const rendered = branches.flatMap((branch, index) => {
            const branchSchema = asSchema(branch);
            if (branchSchema === undefined)
                return [];
            const title = branchSchema.title;
            const label = typeof title === "string" && title.trim() !== ""
                ? title
                : `Option ${String(index + 1)}`;
            return [renderField(label, branchSchema, false, depth + 1)];
        });
        if (rendered.length > 0) {
            sections.push(el("div", { class: "schema-branches" }, [
                el("p", { class: "schema-nested-label" }, [
                    combinator === "oneOf" ? "One of" : "Any of",
                ]),
                el("div", { class: "schema-nested", role: "list" }, rendered),
            ]));
        }
    }
    if (sections.length === 0)
        return null;
    return el("div", { class: "schema-nested-sections" }, sections);
}
/** Renders a compact field-oriented view while keeping the source schema available. */
export function renderSchemaView(label, schema) {
    const fields = propertyEntries(schema);
    const required = requiredFields(schema);
    const raw = pretty(schema);
    const requiredCount = fields.filter(([name]) => required.has(name)).length;
    const fieldCount = `${String(fields.length)} ${fields.length === 1 ? "field" : "fields"}`;
    return el("section", { class: "schema-card", "aria-label": `${label} schema` }, [
        el("header", { class: "schema-card-header" }, [
            el("h3", {}, [`${label} schema`]),
            el("div", { class: "schema-card-meta" }, [
                el("span", { class: "schema-type" }, [schemaType(schema)]),
                el("span", { class: "schema-field-count" }, [fieldCount]),
                requiredCount === 0
                    ? null
                    : el("span", { class: "schema-required" }, [
                        `${String(requiredCount)} required`,
                    ]),
                createCopyButton(`${label.toLowerCase()} schema`, () => raw),
            ]),
        ]),
        typeof schema.description === "string" && schema.description.trim() !== ""
            ? el("p", { class: "schema-description" }, [schema.description])
            : null,
        fields.length === 0
            ? el("p", { class: "schema-empty" }, [
                "No top-level fields are declared.",
            ])
            : el("div", {
                class: "schema-fields",
                role: "list",
                "aria-label": `${label} schema fields`,
            }, fields.map(([name, field]) => renderField(name, field, required.has(name)))),
        renderNested(schema, 0, false),
        el("details", { class: "schema-raw" }, [
            el("summary", {}, ["Raw JSON Schema"]),
            el("pre", { class: "raw" }, [raw]),
        ]),
    ]);
}
//# sourceMappingURL=schema-view.js.map