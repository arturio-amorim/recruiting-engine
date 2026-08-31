export interface CheckMcpIo {
    readonly writeStderr: (text: string) => void | Promise<void>;
}
export interface CheckMcpOptions {
    /** Defaults to `process.argv.slice(2)`. */
    readonly argv?: readonly string[];
    /** Directory the module path is resolved against. Defaults to `process.cwd()`. */
    readonly cwd?: string;
    readonly io?: Partial<CheckMcpIo>;
}
/** Validates the built engine's actual MCP tool catalog without starting it. */
export declare function checkMcp(options?: CheckMcpOptions): Promise<number>;
//# sourceMappingURL=check-mcp.d.ts.map