import { defineCapability } from "@senda/core";
import { z } from "zod";

import type { RecruitingDependencies } from "../application/ports.js";
import { domainFailure, requirePrincipal } from "../domain/errors.js";
import { screenCandidate } from "../domain/policy.js";
import { reviewStatuses, rubricCriteria } from "../domain/types.js";

const input = z.object({
  candidateId: z.string().trim().min(1),
});

const output = z.object({
  candidateId: z.string(),
  jobId: z.string(),
  overall: z.number(),
  status: z.enum(reviewStatuses),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  scores: z.array(
    z.object({
      criterion: z.enum(rubricCriteria),
      score: z.number(),
      evidence: z.string(),
    }),
  ),
});

export function createScreenCandidate({ store }: RecruitingDependencies) {
  return defineCapability({
    title: "Screen candidate",
    description:
      "Aplica a rubrica explícita da vaga e devolve evidência por critério, sem usar características protegidas.",
    input,
    output,
    access: "authenticated",
    timeoutMs: 15_000,
    annotations: {
      readOnly: true,
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
      const result = screenCandidate(job, candidate);
      return {
        candidateId: result.candidateId,
        jobId: result.jobId,
        overall: result.overall,
        status: result.status,
        strengths: Array.from(result.strengths),
        gaps: Array.from(result.gaps),
        scores: result.scores.map((score) => ({
          criterion: score.criterion,
          score: score.score,
          evidence: score.evidence,
        })),
      };
    },
  });
}
