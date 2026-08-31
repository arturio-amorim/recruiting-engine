export const ATTACHED_CLI_SESSION_LIMITS = Object.freeze({
    listTimeoutMs: 15_000,
    describeTimeoutMs: 15_000,
    runTimeoutMs: 60_000,
    streamBytes: 10 * 1024 * 1024,
    catalogSummaries: 2_000,
    inputArgumentBytes: 98_304,
    activityRecords: 500,
    retainedActivityRecords: 50,
    displayedNameCodePoints: 256,
});
const errorMessages = {
    INVALID_TARGET: "The CLI target descriptor is invalid.",
    SPAWN_FAILED: "The CLI process could not be started.",
    CONNECTION_FAILED: "The CLI connection failed.",
    PROTOCOL_ERROR: "The CLI returned an invalid document.",
    TIMEOUT: "The CLI operation timed out.",
    LIMIT_EXCEEDED: "The CLI operation exceeded a configured limit.",
    TARGET_BUSY: "Another target or CLI verb is already active.",
    NOT_CONNECTED: "No CLI target is connected.",
    ENVIRONMENT_VALUE_MISSING: "A required environment value is missing.",
};
export class AttachedCliSessionError extends Error {
    constructor(code, options) {
        super();
        Object.defineProperties(this, {
            code: {
                configurable: false,
                enumerable: true,
                value: code,
                writable: false,
            },
            message: {
                configurable: false,
                enumerable: true,
                value: errorMessages[code],
                writable: false,
            },
            ...(options?.cause === undefined
                ? {}
                : {
                    cause: {
                        configurable: false,
                        enumerable: false,
                        value: options.cause,
                        writable: false,
                    },
                }),
        });
    }
}
export function attachedCliError(code, cause) {
    return new AttachedCliSessionError(code, cause === undefined ? undefined : { cause });
}
//# sourceMappingURL=cli-attached-contract.js.map