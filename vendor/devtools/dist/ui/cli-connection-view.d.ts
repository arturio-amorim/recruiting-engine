import { type CliConnectionState, type CliTarget, type SecretControl } from "./cli-contract.js";
export type EditableCliEnvironmentPair = SecretControl & {
    name: string;
};
export interface EditableCliTargetDraft {
    command: string;
    args: string[];
    cwd: string;
    environment: EditableCliEnvironmentPair[];
}
export interface CliIdleViewOptions {
    readonly state: CliConnectionState;
    readonly draft: EditableCliTargetDraft;
    readonly connectionError: string;
    connect(target: CliTarget): Promise<CliConnectionState>;
    connected(state: CliConnectionState, carriesSecrets: boolean): void;
}
export declare function createCliIdleView(options: CliIdleViewOptions): HTMLElement;
export declare function createCliUnavailableView(state: CliConnectionState): HTMLElement;
//# sourceMappingURL=cli-connection-view.d.ts.map