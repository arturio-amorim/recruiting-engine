import { engine, localPrincipal } from "./engine.js";

const result = await engine.invoke(
  "recruiting.screen-candidate",
  { candidateId: "CAND-91" },
  { source: "direct", principal: localPrincipal },
);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
