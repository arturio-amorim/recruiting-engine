import type { Candidate, Job, ReviewStatus, ScreeningResult } from "./types.js";

export const hiringPolicy = Object.freeze({
  team: "Norte Talentos",
  reviewThreshold: 0.7,
  slackChannel: "#hiring-backend",
});

const keywordScores: Readonly<Record<string, readonly string[]>> = {
  "role-fit": ["typescript", "node", "api", "backend"],
  "craft-evidence": ["test", "review", "production", "incident"],
  collaboration: ["pair", "rfc", "handoff", "team"],
};

export function screenCandidate(job: Job, candidate: Candidate): ScreeningResult {
  const scores = (Object.keys(job.rubric) as Array<keyof typeof job.rubric>).map(
    (criterion) => {
      const answer = candidate.answers[criterion].toLowerCase();
      const hits = (keywordScores[criterion] ?? []).filter((token) =>
        answer.includes(token),
      ).length;
      const score = Math.min(1, hits / 2);
      return {
        criterion,
        score,
        evidence: candidate.answers[criterion],
      };
    },
  );
  const overall =
    scores.reduce((sum, item) => sum + item.score, 0) / Math.max(scores.length, 1);
  const status: ReviewStatus =
    overall >= hiringPolicy.reviewThreshold
      ? "recommend-review"
      : overall >= 0.4
        ? "needs-more-evidence"
        : "do-not-advance";

  return {
    candidateId: candidate.id,
    jobId: job.id,
    scores,
    overall: Math.round(overall * 100) / 100,
    status,
    strengths: scores.filter((item) => item.score >= 0.5).map((item) => item.criterion),
    gaps: scores.filter((item) => item.score < 0.5).map((item) => item.criterion),
  };
}

export function shouldNotify(result: ScreeningResult): boolean {
  return result.status === "recommend-review";
}
