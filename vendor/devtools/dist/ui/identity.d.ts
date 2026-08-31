/** Only for tests: drops every panel registration. */
export declare function resetIdentitySelects(): void;
export interface IdentitySelect {
    readonly element: HTMLElement;
    setDisabled(disabled: boolean): void;
}
export declare function createIdentitySelect(owner: string): IdentitySelect;
//# sourceMappingURL=identity.d.ts.map