import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import { type EngineErrorCode } from "./error.js";
export interface EngineSchema<Input = unknown, Output = Input> {
    readonly "~standard": StandardSchemaV1.Props<Input, Output> & StandardJSONSchemaV1.Props<Input, Output>;
}
export type InferSchemaInput<Schema extends EngineSchema> = StandardSchemaV1.InferInput<Schema>;
export type InferSchemaOutput<Schema extends EngineSchema> = StandardSchemaV1.InferOutput<Schema>;
export type EngineJsonSchema = Readonly<Record<string, unknown>>;
export declare function snapshotLosslessJson<Value>(value: Value): Value;
export declare function validateSchema<Schema extends EngineSchema>(schema: Schema, value: unknown, options: {
    code: Extract<EngineErrorCode, "INPUT_INVALID" | "OUTPUT_INVALID">;
    message: string;
}): Promise<InferSchemaOutput<Schema>>;
export declare function readJsonSchema(schema: EngineSchema, side: "input" | "output"): EngineJsonSchema;
//# sourceMappingURL=schema.d.ts.map