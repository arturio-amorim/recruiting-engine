/** The only `package.json` fields the generators depend on. */
export interface ProjectPackage {
    readonly name: string;
    readonly version: string;
    readonly buildScript: string;
}
export declare const projectPackageFileName = "package.json";
export declare function parseProjectPackage(text: string): ProjectPackage;
/**
 * Reads the project manifest of the engine being packaged. An unreadable file
 * is reported exactly like an incomplete one: either way the required fields
 * are unavailable.
 */
export declare function readProjectPackage(cwd: string): Promise<ProjectPackage>;
//# sourceMappingURL=project-package.d.ts.map