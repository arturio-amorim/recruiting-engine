import type { StandardSchemaV1 } from "@standard-schema/spec";
type ConnectorConfiguration = Readonly<Record<string, unknown>>;
export interface ConnectorConfigSchema<Input = unknown, Output extends ConnectorConfiguration = ConnectorConfiguration> {
    readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
export type InferConnectorConfigInput<Schema extends ConnectorConfigSchema> = StandardSchemaV1.InferInput<Schema>;
export type InferConnectorConfigOutput<Schema extends ConnectorConfigSchema> = StandardSchemaV1.InferOutput<Schema>;
export type ConnectorPorts = Readonly<Record<string, unknown>>;
export interface ConnectorInstance<Ports extends ConnectorPorts> {
    readonly ports: Ports;
}
export interface ConnectorDefinition<Name extends string, ConfigSchema extends ConnectorConfigSchema, Dependencies, Ports extends ConnectorPorts> {
    readonly name: Name;
    readonly config: ConfigSchema;
    readonly create: (config: InferConnectorConfigOutput<ConfigSchema>, dependencies: Dependencies) => ConnectorInstance<Ports>;
}
export interface ConnectorFactory<Name extends string, ConfigSchema extends ConnectorConfigSchema, Dependencies, Ports extends ConnectorPorts> {
    readonly name: Name;
    readonly create: (config: InferConnectorConfigInput<ConfigSchema>, dependencies: Dependencies) => ConnectorInstance<Ports>;
}
export declare function defineConnector<const Name extends string, const ConfigSchema extends ConnectorConfigSchema, Dependencies, const Ports extends ConnectorPorts>(definition: ConnectorDefinition<Name, ConfigSchema, Dependencies, Ports>): ConnectorFactory<Name, ConfigSchema, Dependencies, Ports>;
export {};
//# sourceMappingURL=connector.d.ts.map