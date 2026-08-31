import { describe, expect, it } from "vitest";

import {
  createDefaultRecruitingEngine,
  localPrincipal,
} from "../src/engine.js";

describe("recruiting engine", () => {
  it("screens a strong candidate against the published rubric", async () => {
    const engine = createDefaultRecruitingEngine();
    await expect(
      engine.invoke(
        "recruiting.screen-candidate",
        { candidateId: "CAND-91" },
        { principal: localPrincipal },
      ),
    ).resolves.toMatchObject({
      status: "recommend-review",
      candidateId: "CAND-91",
    });
  });

  it("persists the screening record", async () => {
    const engine = createDefaultRecruitingEngine();
    await expect(
      engine.invoke(
        "recruiting.record-screening",
        { candidateId: "CAND-91" },
        { principal: localPrincipal },
      ),
    ).resolves.toMatchObject({ persisted: true, status: "recommend-review" });
  });

  it("notifies Slack only when human review is warranted", async () => {
    const engine = createDefaultRecruitingEngine();
    await expect(
      engine.invoke(
        "recruiting.notify-review",
        { candidateId: "CAND-91" },
        { principal: localPrincipal },
      ),
    ).resolves.toMatchObject({ sent: true, channel: "#hiring-backend" });

    await expect(
      engine.invoke(
        "recruiting.notify-review",
        { candidateId: "CAND-08" },
        { principal: localPrincipal },
      ),
    ).resolves.toMatchObject({ sent: false });
  });
});
