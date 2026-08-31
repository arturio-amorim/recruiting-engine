---
name: develop-invokta-project
description: Develop this generated Invokta Action Engine when changing capabilities, dependencies, tests, or its direct invocation, CLI, MCP stdio, and MCP HTTP channels. Use for implementation, refactoring, debugging, and contract review in this project.
---

# Develop This Action Engine

## Establish the contract

1. Read `AGENTS.md`, `README.md`, and the existing capability and engine tests.
2. Identify the domain action, public capability ID, input, output, access rule, annotations, timeout, and observable errors affected by the change.
3. Identify any engine-owned port and decide whether its implementation crosses an external provider, technology, or data-source boundary.
4. Treat capability IDs, schemas, access behavior, and adapter-visible results as compatibility surfaces. Request an explicit decision before breaking one.

## Keep one architecture

- Define domain actions with `defineCapability` and explicit input, output, access, and execution contracts.
- Inject models, providers, repositories, tools, and policy checks through engine-owned factories or closures.
- Use `defineConnector` for provider- or technology-specific implementations of outbound ports. In-memory implementations, domain policies, and inbound authentication adapters are not connectors.
- Keep connector configuration under a Standard Schema contract and pass transports, SDK clients, pools, and clocks as explicit opaque dependencies at the composition root.
- Connector construction must validate configuration synchronously and perform no external I/O. Capabilities receive only the ports they use, never connector instances, credentials, or provider clients.
- Propagate each invocation's `AbortSignal`, bound provider work and response sizes, translate provider payloads to port-owned values, and sanitize failures. A capability that performs connector work in `run` must have a finite `timeoutMs`.
- Register capabilities under literal domain-oriented IDs in `src/engine.ts`.
- Keep every execution channel on `engine.invoke`; never call a capability's `run` directly.
- Keep business logic out of `src/direct.ts`, `src/cli.ts`, `src/mcp-stdio.ts`, `src/mcp-http.ts`.
- Do not add a service locator, runtime registry, plugin discovery, workflow engine, or adapter-specific capability implementation.
- Preserve fail-closed authentication in `src/http-auth.ts`; never add a development bypass.

## Deliver the change

1. Add or update an engine-level test that invokes the capability and fails for the missing behavior.
2. Implement the smallest capability, port, connector, composition-root, or adapter wiring change that makes the test pass.
3. Cover invalid input, denied access, output validation, cancellation, or dependency failure when relevant to the contract.
4. Keep direct invocation, CLI, MCP stdio, and MCP HTTP behavior consistent by testing the shared engine boundary rather than duplicating handlers.
5. Update project documentation when commands, configuration, capability IDs, or public behavior change.
6. Run `npm run check` and resolve every type, test, and build failure before completion.
