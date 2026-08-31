export class EngineError extends Error {
    code;
    publicDetails;
    cause;
    constructor(options) {
        super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = "EngineError";
        this.code = options.code;
        if (options.publicDetails !== undefined) {
            this.publicDetails = options.publicDetails;
        }
        if (options.cause !== undefined) {
            this.cause = options.cause;
        }
    }
}
//# sourceMappingURL=error.js.map