export const rubricCriteria = [
  "role-fit",
  "craft-evidence",
  "collaboration",
] as const;

export type RubricCriterion = (typeof rubricCriteria)[number];

export const reviewStatuses = [
  "recommend-review",
  "needs-more-evidence",
  "do-not-advance",
] as const;

export type ReviewStatus = (typeof reviewStatuses)[number];

export interface Job {
  readonly id: string;
  readonly title: string;
  readonly rubric: Readonly<Record<RubricCriterion, string>>;
}

export interface Candidate {
  readonly id: string;
  readonly jobId: string;
  readonly summary: string;
  readonly answers: Readonly<Record<RubricCriterion, string>>;
}

export interface CriterionScore {
  readonly criterion: RubricCriterion;
  readonly score: number;
  readonly evidence: string;
}

export interface ScreeningResult {
  readonly candidateId: string;
  readonly jobId: string;
  readonly scores: readonly CriterionScore[];
  readonly overall: number;
  readonly status: ReviewStatus;
  readonly strengths: readonly string[];
  readonly gaps: readonly string[];
}

export interface SlackReceipt {
  readonly channel: string;
  readonly sent: boolean;
  readonly reason?: string;
}
