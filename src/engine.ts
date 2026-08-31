import { createEngine, type Principal } from "@senda/core";

import type { RecruitingDependencies } from "./application/ports.js";
import { createNotifyReview } from "./capabilities/notify-review.js";
import { createRecordScreening } from "./capabilities/record-screening.js";
import { createScreenCandidate } from "./capabilities/screen-candidate.js";
import {
  createInMemorySlack,
  createInMemoryStore,
} from "./infrastructure/in-memory.js";

export const localPrincipal: Principal = Object.freeze({
  id: "local:hiring-desk",
});

export function createRecruitingEngine(dependencies: RecruitingDependencies) {
  return createEngine({
    name: "recruiting-engine",
    version: "0.1.0",
    capabilities: {
      "recruiting.screen-candidate": createScreenCandidate(dependencies),
      "recruiting.record-screening": createRecordScreening(dependencies),
      "recruiting.notify-review": createNotifyReview(dependencies),
    },
  });
}

export function createDefaultRecruitingEngine(
  overrides: Partial<RecruitingDependencies> = {},
) {
  return createRecruitingEngine({
    store: overrides.store ?? createInMemoryStore(),
    slack: overrides.slack ?? createInMemorySlack(),
  });
}

export const engine = createDefaultRecruitingEngine();
