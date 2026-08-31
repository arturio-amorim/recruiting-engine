import { type CliApi } from "./cli-contract.js";
export type { CliActivityRecord, CliApi, CliCapabilityDescription, CliCapabilitySummary, CliConnectionState, CliConnectionSummary, CliJsonValue, CliSession, CliTarget, CliTargetDraft, SecretControl, } from "./cli-contract.js";
export { buildCliTarget, completeConnectionAttempt, createVerbQueue, nextRovingIndex, parseRunInput, refreshFailureIsDisconnect, retainedActivityOf, seedCliInput, } from "./cli-contract.js";
export { CliApiError, createRouteCliApi } from "./cli-api.js";
export declare const cliPrimaryTabs: readonly ["Commands", "Activity", "Connection"];
export interface CliAppHandle {
    destroy(): void;
}
export declare function mountCliApp(root: HTMLElement, api?: CliApi): CliAppHandle;
//# sourceMappingURL=cli-app.d.ts.map