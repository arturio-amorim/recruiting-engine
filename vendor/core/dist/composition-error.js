function freezeIssue(issue) {
    if (issue.code === "CAPABILITY_ID_COLLISION") {
        for (const declaration of issue.declarations)
            Object.freeze(declaration);
        Object.freeze(issue.declarations);
    }
    Object.freeze(issue);
}
export class CapabilityCompositionError extends TypeError {
    code;
    issues;
    constructor(issues) {
        super("Capability composition is invalid.");
        this.name = "CapabilityCompositionError";
        this.code = "CAPABILITY_COMPOSITION_INVALID";
        for (const issue of issues)
            freezeIssue(issue);
        this.issues = Object.freeze(issues);
        // The snapshot must survive any later mutation attempt by a caller that
        // caught this error, so the diagnostics can never rewrite a valid engine.
        Object.freeze(this);
    }
}
export function isCapabilityCompositionError(value) {
    if (typeof value !== "object" || value === null)
        return false;
    try {
        const code = value.code;
        const issues = value.issues;
        return code === "CAPABILITY_COMPOSITION_INVALID" && Array.isArray(issues);
    }
    catch {
        // A predicate over a caught value must never replace the original failure.
        return false;
    }
}
//# sourceMappingURL=composition-error.js.map