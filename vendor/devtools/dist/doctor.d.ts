import type { LoadedEngine } from "./load-engine.js";
/** A one-line remediation shown next to a finding or note when present. */
interface WithHint {
    readonly hint?: string;
}
export type DoctorFinding = ({
    readonly code: "LIST_UNREADABLE";
    readonly error?: unknown;
} & WithHint) | ({
    readonly code: "DESCRIBE_FAILED";
    readonly capabilityId: string;
    readonly error?: unknown;
} & WithHint) | ({
    readonly code: "SCHEMA_UNREADABLE";
    readonly capabilityId: string;
    readonly schema: "input" | "output";
} & WithHint);
export type DoctorNote = ({
    readonly code: "TITLE_MISSING";
    readonly capabilityId: string;
} & WithHint) | ({
    readonly code: "ANNOTATIONS_MISSING";
    readonly capabilityId: string;
} & WithHint) | ({
    readonly code: "DESCRIPTION_MISSING";
    readonly capabilityId: string;
} & WithHint) | ({
    readonly code: "SCHEMA_WITHOUT_TYPE";
    readonly capabilityId: string;
    readonly schema: "input" | "output";
} & WithHint) | ({
    readonly code: "DUPLICATE_CAPABILITY_ID";
    readonly capabilityId: string;
} & WithHint) | ({
    readonly code: "MCP_MANIFEST_PRESENT";
} & WithHint) | ({
    readonly code: "MCP_MANIFEST_MISSING";
} & WithHint) | ({
    readonly code: "COMPOSITION_CHECK_AVAILABLE";
} & WithHint);
export interface DoctorReport {
    readonly engineName: string;
    readonly engineVersion: string;
    /** Absent when the capability list itself could not be read. */
    readonly capabilityCount?: number;
    readonly findings: readonly DoctorFinding[];
    readonly notes: readonly DoctorNote[];
}
/**
 * Converts a report into its JSON-safe body: thrown values are reduced to
 * their name, code, and message so no stack, cause, or payload can travel.
 */
export declare function doctorReportToJson(report: DoctorReport): unknown;
export interface InspectEngineOptions {
    /** Presence of `senda.mcp.json` next to the inspected project, when known. */
    readonly mcpManifestPresent?: boolean;
    /** Whether the module also exposes a tracked composed `capabilities` export. */
    readonly composedCapabilitiesExport?: boolean;
}
/**
 * Runs the read-only doctor checks against a loaded engine. The inspection
 * reads `list` and `describe` only; it never invokes a capability, starts a
 * transport, or touches the filesystem. Filesystem-derived facts arrive
 * through the options so the inspection stays pure and reusable.
 */
export declare function inspectEngine(engine: LoadedEngine, options?: InspectEngineOptions): DoctorReport;
export {};
//# sourceMappingURL=doctor.d.ts.map