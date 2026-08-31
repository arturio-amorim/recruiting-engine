import type { CliActivityRecord, CliConnectionState, CliJsonValue } from "./cli-contract.js";
export declare function cliControlId(name: string): string;
export declare function cliLabelFor(text: string, id: string, className?: string): HTMLLabelElement;
export declare function cliTextInput(options: {
    readonly label: string;
    readonly name: string;
    readonly value?: string;
    readonly placeholder?: string;
    readonly type?: "text" | "search" | "password";
    readonly autocomplete?: string;
}): {
    readonly field: HTMLDivElement;
    readonly input: HTMLInputElement;
};
export declare function cliErrorMessage(error: unknown): string;
export declare function cliAnnotationTags(annotations: Readonly<Record<string, CliJsonValue>> | undefined): readonly HTMLElement[];
export declare function cliActivityTable(records: readonly CliActivityRecord[]): HTMLElement;
export declare function cliStatusPill(state: CliConnectionState): HTMLElement;
//# sourceMappingURL=cli-components.d.ts.map