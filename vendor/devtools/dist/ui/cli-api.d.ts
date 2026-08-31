import type { CliApi } from "./cli-contract.js";
type Fetcher = typeof fetch;
export declare class CliApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function createRouteCliApi(fetcher?: Fetcher, apiBase?: string): CliApi;
export {};
//# sourceMappingURL=cli-api.d.ts.map