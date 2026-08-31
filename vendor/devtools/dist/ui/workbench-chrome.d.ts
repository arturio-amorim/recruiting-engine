export type WorkbenchName = "mcp" | "cli";
export declare const workbenchLabels: Readonly<Record<WorkbenchName, string>>;
export declare const workbenchPaths: Readonly<Record<WorkbenchName, string>>;
/** The chooser: where a workbench is selected. */
export declare const chooserPath = "/";
export declare const chooserLabel = "All workbenches";
export interface WorkbenchChoice {
    readonly workbench: WorkbenchName;
    readonly title: string;
    /** One line, for a card that sits next to another one. */
    readonly short: string;
    readonly summary: string;
    readonly connects: string;
    readonly flag: string;
}
export declare const workbenchChoices: readonly WorkbenchChoice[];
export declare function workbenchChoice(workbench: WorkbenchName): WorkbenchChoice;
/**
 * The Senda mark: a prompt chevron and a cursor rule, drawn from the
 * workbench palette so it follows the theme.
 */
export declare function createBrandMark(): SVGSVGElement;
/**
 * Where this page's JSON API is mounted. The launcher serves both workbenches
 * from one origin and says so on the document; a single-workbench server
 * leaves the default.
 */
export declare function workbenchApiBase(ownerDocument?: Document): string;
/**
 * Which workbench this page is, when the launcher served it. It is absent on a
 * single-workbench server, where there is nothing to switch to.
 */
export declare function mountedWorkbench(ownerDocument?: Document): WorkbenchName | undefined;
/**
 * The brand lockup. Under the launcher it returns to the chooser, so the
 * chooser stays one click away from either workbench.
 */
export declare function createBrandLockup(current?: WorkbenchName): HTMLElement;
/**
 * The workbench switch. Each workbench is its own page on the same origin, so
 * the control is a set of links and the current one is marked, not disabled.
 * It leads with the way back to the chooser, because selecting a workbench
 * again has to stay reachable from inside one.
 */
export declare function createWorkbenchSwitch(current: WorkbenchName): HTMLElement;
/**
 * The way out of an idle workbench: back to the chooser, or straight into the
 * other workbench. Both are same-origin pages, so this is navigation rather
 * than a command to retype in a terminal. Absent on a single-workbench server,
 * where neither destination exists.
 */
export declare function createWorkbenchOrientation(current: WorkbenchName | undefined): HTMLElement | undefined;
//# sourceMappingURL=workbench-chrome.d.ts.map