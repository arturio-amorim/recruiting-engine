import { defineCapability } from "@invokta/core";
import { z } from "zod";

import type { RecruitingDependencies } from "../application/ports.js";
import { domainFailure, requirePrincipal } from "../domain/errors.js";
import { screenCandidate } from "../domain/policy.js";
import { reviewStatuses } from "../domain/types.js";

const input = z.object({
  candidateId: z.string().trim().min(1),
});

const output = z.object({
  candidateId: z.string(),
  jobId: z.string(),
  status: z.enum(reviewStatuses),
  persisted: z.literal(true),
});

export function createRecordScreening({ store }: RecruitingDependencies) {
  return defineCapability({
    title: "Record screening",
    description:
      "Persiste o resultado normalizado da triagem no sistema de recrutamento.",
    input,
    output,
    access: "authenticated",
    timeoutMs: 15_000,
    annotations: {
      readOnly: false,
      destructive: false,
      idempotent: true,
      openWorld: false,
    },
    async run({ input: request, context }) {
      requirePrincipal(context.principal);
      const candidate = await store.getCandidate(request.candidateId, {
        signal: context.signal,
      });
      if (candidate === null) {
        throw domainFailure("Candidate not found.", {
          candidateId: request.candidateId,
        });
      }
      const job = await store.getJob(candidate.jobId, { signal: context.signal });
      if (job === null) {
        throw domainFailure("Job not found.", { jobId: candidate.jobId });
      }
      const saved = await store.saveScreening(screenCandidate(job, candidate), {
        signal: context.signal,
      });
      return {
        candidateId: saved.candidateId,
        jobId: saved.jobId,
        status: saved.status,
        persisted: true as const,
      };
    },
  });
}
