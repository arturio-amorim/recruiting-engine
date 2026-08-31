import { defineCapability } from "@senda/core";
import { z } from "zod";

import type { RecruitingDependencies } from "../application/ports.js";
import { domainFailure, requirePrincipal } from "../domain/errors.js";
import { screenCandidate } from "../domain/policy.js";

const input = z.object({
  candidateId: z.string().trim().min(1),
});

const output = z.object({
  candidateId: z.string(),
  channel: z.string(),
  sent: z.boolean(),
  reason: z.string().optional(),
});

export function createNotifyReview({ store, slack }: RecruitingDependencies) {
  return defineCapability({
    title: "Notify hiring review",
    description:
      "Avisa o time de contratação no Slack só quando a rubrica pede revisão humana.",
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
      const receipt = await slack.notifyReview(screenCandidate(job, candidate), {
        signal: context.signal,
      });
      return {
        candidateId: candidate.id,
        channel: receipt.channel,
        sent: receipt.sent,
        ...(receipt.reason === undefined ? {} : { reason: receipt.reason }),
      };
    },
  });
}
