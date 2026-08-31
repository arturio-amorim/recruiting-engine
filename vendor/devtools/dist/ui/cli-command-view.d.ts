import { type CliApi, type CliCapabilityDescription, type CliCapabilitySummary, type CliJsonValue } from "./cli-contract.js";
export interface CliCurrentResult {
    readonly id: string;
    readonly value: CliJsonValue;
}
export interface CliCommandsPanelOptions {
    readonly root: HTMLElement;
    readonly api: CliApi;
    readonly commands: readonly CliCapabilitySummary[];
    readonly commandsLoaded: boolean;
    readonly commandsLoading: boolean;
    readonly commandsError: string;
    readonly selectedId: string | undefined;
    readonly described: CliCapabilityDescription | undefined;
    readonly describeError: string;
    readonly commandQuery: string;
    readonly argumentDrafts: Map<string, string>;
    readonly currentResult: CliCurrentResult | undefined;
    retryCatalog(): void;
    setSelectedId(id: string | undefined): void;
    selectCommand(id: string, focus: boolean): void;
    setCommandQuery(query: string): void;
    setCurrentResult(result: CliCurrentResult): void;
    markActivityStale(): void;
}
export declare function createCliCommandsPanel(options: CliCommandsPanelOptions): HTMLElement;
//# sourceMappingURL=cli-command-view.d.ts.map