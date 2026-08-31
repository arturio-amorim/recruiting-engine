import type { OAuthInspectionOptions } from "./options.js";
export type OAuthInspectionStage = "CHALLENGE" | "RESOURCE_METADATA" | "AUTHORIZATION_SERVER_METADATA" | "AUTHORIZATION_SERVER_CAPABILITIES" | "JWKS";
export type OAuthInspectionReason = "DEADLINE_EXCEEDED" | "CONNECTION_FAILED" | "RESPONSE_TOO_LARGE" | "INVALID_UTF8" | "UNEXPECTED_STATUS" | "REDIRECT_NOT_ALLOWED" | "INVALID_CONTENT_TYPE" | "INVALID_JSON" | "INVALID_BEARER_CHALLENGE" | "RESOURCE_METADATA_NOT_ADVERTISED" | "UNSAFE_URL" | "RESOURCE_MISMATCH" | "AUTHORIZATION_SERVER_NOT_ADVERTISED" | "METADATA_NOT_FOUND" | "ISSUER_MISMATCH" | "INVALID_ENDPOINT" | "AUTHORIZATION_CODE_NOT_ADVERTISED" | "S256_NOT_ADVERTISED" | "INVALID_JWKS";
export type OAuthRegistrationReadiness = "cimd" | "dcr" | "cimd,dcr" | "pre-registration-required";
export interface OAuthInspectionSuccess {
    readonly ok: true;
    readonly resource: string;
    readonly issuer: string;
    readonly challengeScopes: string;
    readonly registration: OAuthRegistrationReadiness;
    readonly jwks: "valid" | "not-advertised";
}
export interface OAuthInspectionFailure {
    readonly ok: false;
    readonly stage: OAuthInspectionStage;
    readonly reason: OAuthInspectionReason;
}
export type OAuthInspectionResult = OAuthInspectionSuccess | OAuthInspectionFailure;
export declare function inspectOAuthDiscovery(options: OAuthInspectionOptions): Promise<OAuthInspectionResult>;
//# sourceMappingURL=inspect.d.ts.map