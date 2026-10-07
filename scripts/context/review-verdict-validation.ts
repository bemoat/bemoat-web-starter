import { parseProductionMergeReviewVerdict } from './merge-review-verdict.ts'

export type ReviewVerdictValidation =
  | { status: 'PASS' }
  | { status: 'FAIL' }

/** Syntax and shape only; a pass conveys no live, semantic, or authority evidence. */
export function validateReviewVerdictBody(body: string): ReviewVerdictValidation {
  try {
    parseProductionMergeReviewVerdict(body, 'candidate', 'strict_candidate')
    return { status: 'PASS' }
  } catch {
    return { status: 'FAIL' }
  }
}
