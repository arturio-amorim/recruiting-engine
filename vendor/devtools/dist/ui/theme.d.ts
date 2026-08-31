export type ThemeChoice = "dark" | "light" | "auto";
export declare function createCompactThemeToggle(): HTMLButtonElement;
/**
 * Mirrors the Senda site theme choices and storage key. The preference is
 * reused on repeat visits to this origin; localStorage does not cross origins.
 */
export declare function createThemeToggle(): HTMLElement;
//# sourceMappingURL=theme.d.ts.map