export { workbenchChoices } from "./workbench-chrome.js";
export interface ChooserAppHandle {
    destroy(): void;
}
/**
 * The launcher landing page: which workbench to open. Neither one loads a
 * workspace, spawns a target, or opens an outbound connection until the
 * developer selects Connect inside it, so choosing here is free.
 */
export declare function mountChooserApp(root: HTMLElement): ChooserAppHandle;
//# sourceMappingURL=chooser-app.d.ts.map