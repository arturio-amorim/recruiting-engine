export interface OAuthInspectionOptions {
    readonly url: URL;
    readonly timeoutMs: number;
}
export type OAuthInspectionOptionsResult = {
    readonly ok: true;
    readonly options: OAuthInspectionOptions;
} | {
    readonly ok: false;
};
export declare const oauthInspectionTimeoutDefaultMs = 10000;
export declare const oauthInspectionTimeoutMinMs = 1;
export declare const oauthInspectionTimeoutMaxMs = 60000;
export declare function parseOAuthInspectionOptions(args: readonly string[]): OAuthInspectionOptionsResult;
//# sourceMappingURL=options.d.ts.map