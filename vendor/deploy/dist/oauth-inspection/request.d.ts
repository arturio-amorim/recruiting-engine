export declare const oauthInspectionMaxResponseBytes: number;
export interface OAuthInspectionRequest {
    readonly url: URL;
    readonly method: "GET" | "POST";
    readonly body?: string;
    readonly deadline: number;
}
export interface OAuthInspectionHttpResponse {
    readonly outcome: "response";
    readonly status: number;
    readonly challenge: string | undefined;
    readonly contentType: string | undefined;
    readonly location: string | undefined;
    readonly body: string;
}
export type OAuthInspectionExchange = OAuthInspectionHttpResponse | {
    readonly outcome: "deadline";
} | {
    readonly outcome: "connection-failure";
} | {
    readonly outcome: "response-too-large";
} | {
    readonly outcome: "invalid-utf8";
};
/**
 * Sends one credential-free request within the inspection's shared deadline.
 * Redirects are surfaced to the classifier rather than followed, and every
 * response is bounded before it is decoded as strict UTF-8.
 */
export declare function sendOAuthInspectionRequest(input: OAuthInspectionRequest): Promise<OAuthInspectionExchange>;
//# sourceMappingURL=request.d.ts.map