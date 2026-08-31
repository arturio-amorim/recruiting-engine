import { asRecord, readThrownValueInfo } from "./diagnostics.js";
/**
 * Converts a report into its JSON-safe body: thrown values are reduced to
 * their name, code, and message so no stack, cause, or payload can travel.
 */
export function doctorReportToJson(report) {
    return {
        engineName: report.engineName,
        engineVersion: report.engineVersion,
        ...(report.capabilityCount === undefined
            ? {}
            : { capabilityCount: report.capabilityCount }),
        findings: report.findings.map((finding) => ({
            ...finding,
            ...("error" in finding && finding.error !== undefined
                ? { error: readThrownValueInfo(finding.error) }
                : {}),
        })),
        notes: report.notes,
    };
}
function isObjectSchema(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkSchema(findings, notes, capabilityId, schema, value) {
    if (!isObjectSchema(value)) {
        findings.push({
            code: "SCHEMA_UNREADABLE",
            capabilityId,
            schema,
            hint: "Export inputSchema and outputSchema as JSON Schema objects from describe().",
        });
        return;
    }
    if (!("type" in value)) {
        notes.push({
            code: "SCHEMA_WITHOUT_TYPE",
            capabilityId,
            schema,
            hint: 'Declare the schema root "type" (for example "object") so clients can render a form.',
        });
    }
}
/**
 * Runs the read-only doctor checks against a loaded engine. The inspection
 * reads `list` and `describe` only; it never invokes a capability, starts a
 * transport, or touches the filesystem. Filesystem-derived facts arrive
 * through the options so the inspection stays pure and reusable.
 */
export function inspectEngine(engine, options = {}) {
    const findings = [];
    const notes = [];
    let summaries;
    try {
        const listed = engine.list();
        if (Array.isArray(listed)) {
            summaries = listed;
        }
        else {
            findings.push({
                code: "LIST_UNREADABLE",
                hint: "Return an array of capability summaries with string id fields from list().",
            });
        }
    }
    catch (error) {
        findings.push({
            code: "LIST_UNREADABLE",
            error,
            hint: "Return an array of capability summaries with string id fields from list().",
        });
    }
    const seenIds = new Set();
    for (const summary of summaries ?? []) {
        const capabilityId = asRecord(summary)?.id;
        if (typeof capabilityId !== "string") {
            findings.push({
                code: "DESCRIBE_FAILED",
                capabilityId: "<unreadable>",
                hint: "Give every capability summary a string id field in list().",
            });
            continue;
        }
        if (seenIds.has(capabilityId)) {
            notes.push({
                code: "DUPLICATE_CAPABILITY_ID",
                capabilityId,
                hint: "Give every capability a unique id; a duplicate id makes describe() ambiguous.",
            });
        }
        seenIds.add(capabilityId);
        let description;
        try {
            description = engine.describe(capabilityId);
        }
        catch (error) {
            findings.push({
                code: "DESCRIBE_FAILED",
                capabilityId,
                error,
                hint: "Return the capability description from describe() without throwing.",
            });
            continue;
        }
        const record = asRecord(description);
        checkSchema(findings, notes, capabilityId, "input", record?.inputSchema);
        checkSchema(findings, notes, capabilityId, "output", record?.outputSchema);
        if (typeof record?.description !== "string" ||
            record.description.trim() === "") {
            notes.push({
                code: "DESCRIPTION_MISSING",
                capabilityId,
                hint: "Add a non-empty description to the capability definition.",
            });
        }
        if (record?.title === undefined) {
            notes.push({
                code: "TITLE_MISSING",
                capabilityId,
                hint: "Add a title to the capability definition.",
            });
        }
        if (record?.annotations === undefined) {
            notes.push({
                code: "ANNOTATIONS_MISSING",
                capabilityId,
                hint: "Add annotations such as { readOnly: true } to the capability definition.",
            });
        }
    }
    if (options.mcpManifestPresent !== undefined) {
        notes.push(options.mcpManifestPresent
            ? { code: "MCP_MANIFEST_PRESENT" }
            : {
                code: "MCP_MANIFEST_MISSING",
                hint: "Add an senda.mcp.json manifest next to the project to make the engine installable as an MCP server (scaffolded by create-senda-engine).",
            });
    }
    if (options.composedCapabilitiesExport === true) {
        notes.push({ code: "COMPOSITION_CHECK_AVAILABLE" });
    }
    return {
        engineName: engine.name,
        engineVersion: engine.version,
        ...(summaries === undefined ? {} : { capabilityCount: summaries.length }),
        findings,
        notes,
    };
}
//# sourceMappingURL=doctor.js.map