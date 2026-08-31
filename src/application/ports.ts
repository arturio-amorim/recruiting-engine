import type {
  Candidate,
  Job,
  ScreeningResult,
  SlackReceipt,
} from "../domain/types.js";

export interface RecruitingStore {
  getJob(
    jobId: string,
    options: { readonly signal: AbortSignal },
  ): Promise<Job | null>;
  getCandidate(
    candidateId: string,
    options: { readonly signal: AbortSignal },
  ): Promise<Candidate | null>;
  saveScreening(
    result: ScreeningResult,
    options: { readonly signal: AbortSignal },
  ): Promise<ScreeningResult>;
}

export interface SlackPort {
  notifyReview(
    result: ScreeningResult,
    options: { readonly signal: AbortSignal },
  ): Promise<SlackReceipt>;
}

export interface RecruitingDependencies {
  readonly store: RecruitingStore;
  readonly slack: SlackPort;
}
