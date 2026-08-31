export interface CheckCapabilitiesIo {
    readonly writeStderr: (text: string) => void | Promise<void>;
}
export interface CheckCapabilitiesOptions {
    /** Defaults to `process.argv.slice(2)`. */
    readonly argv?: readonly string[];
    /** Directory the module path is resolved against. Defaults to `process.cwd()`. */
    readonly cwd?: string;
    readonly io?: Partial<CheckCapabilitiesIo>;
}
/**
 * Runs `senda check-capabilities` and resolves with its exit code.
 *
 * The command imports the requested module, which is what runs
 * `composeCapabilities`; validation is never re-implemented here. Nothing is
 * ever written to `stdout`.
 */
export declare function checkCapabilities(options?: CheckCapabilitiesOptions): Promise<number>;
//# sourceMappingURL=check-capabilities.d.ts.map