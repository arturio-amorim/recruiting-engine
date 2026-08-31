#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { runEngineInstallerCli } from "@senda/installer/engine";

process.exitCode = await runEngineInstallerCli({
  argv: process.argv.slice(2),
  binaryName: "recruiting-engine",
  packageRoot: fileURLToPath(new URL("..", import.meta.url)),
});
