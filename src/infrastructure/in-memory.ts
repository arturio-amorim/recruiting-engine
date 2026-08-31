import type { Candidate, Job, ScreeningResult, SlackReceipt } from "../domain/types.js";
import type { RecruitingStore, SlackPort } from "../application/ports.js";
import { hiringPolicy, shouldNotify } from "../domain/policy.js";

export const seededJobs: readonly Job[] = [
  {
    id: "JOB-BACKEND",
    title: "Backend engineer",
    rubric: {
      "role-fit": "TypeScript/Node APIs in production",
      "craft-evidence": "Tests, reviews, and incident follow-through",
      collaboration: "Written RFCs and pairing with product",
    },
  },
];

export const seededCandidates: readonly Candidate[] = [
  {
    id: "CAND-91",
    jobId: "JOB-BACKEND",
    summary: "Five years building APIs",
    answers: {
      "role-fit": "Shipped TypeScript Node APIs for checkout",
      "craft-evidence": "Added production tests after an incident review",
      collaboration: "Wrote an RFC and paired on the handoff",
    },
  },
  {
    id: "CAND-08",
    jobId: "JOB-BACKEND",
    summary: "Career switcher",
    answers: {
      "role-fit": "Completed a frontend course",
      "craft-evidence": "Personal tutorials",
      collaboration: "Worked alone",
    },
  },
];

export function createInMemoryStore(): RecruitingStore {
  const jobs = new Map(seededJobs.map((item) => [item.id, item]));
  const candidates = new Map(seededCandidates.map((item) => [item.id, item]));
  const screenings = new Map<string, ScreeningResult>();
  return {
    async getJob(id, { signal }) {
      signal.throwIfAborted();
      return jobs.get(id) ?? null;
    },
    async getCandidate(id, { signal }) {
      signal.throwIfAborted();
      return candidates.get(id) ?? null;
    },
    async saveScreening(result, { signal }) {
      signal.throwIfAborted();
      screenings.set(result.candidateId, result);
      return result;
    },
  };
}

export function createInMemorySlack(): SlackPort {
  return {
    async notifyReview(result, { signal }) {
      signal.throwIfAborted();
      if (!shouldNotify(result)) {
        const receipt: SlackReceipt = {
          channel: hiringPolicy.slackChannel,
          sent: false,
          reason: "Status is below the human-review threshold.",
        };
        return receipt;
      }
      return { channel: hiringPolicy.slackChannel, sent: true };
    },
  };
}
