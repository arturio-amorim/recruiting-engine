import { serveMcpStdio } from "@senda/mcp";

import { engine, localPrincipal } from "./engine.js";

await serveMcpStdio(engine, { principal: localPrincipal });
