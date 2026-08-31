export type Child = Node | string | null | undefined;
/** Builds an element with attributes and children; text stays text. */
export declare function el<K extends keyof HTMLElementTagNameMap>(tag: K, attributes?: Readonly<Record<string, string>>, children?: readonly Child[]): HTMLElementTagNameMap[K];
export declare function clear(element: HTMLElement): void;
export declare function pretty(value: unknown): string;
//# sourceMappingURL=dom.d.ts.map