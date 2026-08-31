export type ToggleStrategy = "native-enabled" | "native-disabled" | "detached";
interface RegisteredCanonicalJcs {
    readonly full: string;
    readonly withoutEnabled?: string;
    readonly withoutDisabled?: string;
}
export declare function registerCanonicalJcs(value: object, canonical: RegisteredCanonicalJcs): void;
export declare function canonicalizeJcs(value: unknown): string;
export declare function fingerprintNormalizedDefinition(definition: unknown, toggleStrategy: ToggleStrategy): string;
export {};
//# sourceMappingURL=jcs-fingerprint.d.ts.map