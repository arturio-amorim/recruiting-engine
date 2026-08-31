import { runCli } from "@senda/cli";

import { engine, localPrincipal } from "./engine.js";

process.exitCode = await runCli(engine, { principal: localPrincipal });
