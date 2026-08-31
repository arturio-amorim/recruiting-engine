import { type CapabilityMap, type Engine, type Principal } from "@senda/core";
export interface CliIo {
    readonly readStdin: () => Promise<string>;
    readonly writeStdout: (text: string) => void | Promise<void>;
    readonly writeStderr: (text: string) => void | Promise<void>;
}
export interface RunCliOptions {
    readonly argv?: readonly string[];
    readonly principal: Principal | null;
    readonly signal?: AbortSignal;
    readonly format?: "json" | "human";
    readonly io?: Partial<CliIo>;
}
export declare function runCli<Capabilities extends CapabilityMap>(engine: Engine<Capabilities>, options: RunCliOptions): Promise<number>;
//# sourceMappingURL=index.d.ts.map