type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
/**
 * Builds a starter example value from a JSON Schema document so a developer
 * edits real field names instead of typing JSON from scratch. The result is a
 * seed for the invocation editor, not a schema-valid value; validation stays
 * with the engine.
 */
export declare function exampleFromSchema(schema: unknown): JsonValue;
export {};
//# sourceMappingURL=example-from-schema.d.ts.map