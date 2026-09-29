import type { ActivePullRequestEvidence, NormalizedContextEvidence } from './model.ts'
import { parseProductionMergeReviewVerdict } from './merge-review-verdict.ts'

// Native reviews are durable evidence; HANDOFF remains the append-only transport.
export function hasNativeReviewLineage(
  url: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  requiredVerdict: 'CORRECTION REQUIRED' | 'ELIGIBLE FOR FOUNDER REVIEW',
): boolean {
  const reviews = (evidence.currentHeadVerification?.reviews.nativeReviews ?? []).filter((review) =>
    /^[1-9]\d*$/.test(String(review.id)) && url ===
      `https://github.com/${evidence.repository.nameWithOwner}/pull/${activePr.number}#pullrequestreview-${review.id}`)
  if (reviews.length !== 1) return false
  const review = reviews[0]!
  if (!review.commitId || !/^[0-9a-f]{40}$/i.test(review.commitId) ||
    review.commitId.toLowerCase() !== activePr.headSha.toLowerCase() ||
    !['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(review.state.toUpperCase()) ||
    !/^##\s+REVIEW_VERDICT\b/i.test(review.body)) return false
  try {
    const verdict = parseProductionMergeReviewVerdict(review.body, review.id)
    return verdict.verdict === requiredVerdict && verdict.non_superseded === true &&
      verdict.repository === evidence.repository.nameWithOwner.toLowerCase() &&
      String(verdict.issue) === evidence.issue.number && String(verdict.pr) === activePr.number &&
      verdict.base === activePr.baseBranch &&
      verdict.reviewed_head?.toLowerCase() === activePr.headSha.toLowerCase() &&
      (requiredVerdict !== 'CORRECTION REQUIRED' || hasBlockingFinding(review.body, activePr.headSha))
  } catch {
    return false
  }
}

export function hasBlockingFinding(body: string, expectedHead: string): boolean {
  const section = body.match(/###\s+Immutable finding disposition\s*\n([\s\S]*?)(?=\n###|\n##|$)/i)?.[1] ?? ''
  const fenced = [...section.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  if (fenced.length > 1) return false
  const serialized = fenced[0]?.[1]
    ?? section.match(/`(\{[\s\S]*\})`/)?.[1]
  if (!serialized) return false

  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    const record = parsed as { schema_version?: unknown; reviewed_head?: unknown; findings?: unknown }
    if (record.schema_version !== 1 || typeof record.reviewed_head !== 'string' ||
      record.reviewed_head.toLowerCase() !== expectedHead.toLowerCase()) return false
    const findings = record.findings
    if (!Array.isArray(findings) || findings.length === 0) return false
    const findingIds = new Set<string>()
    return findings.every((finding) => {
      if (!finding || typeof finding !== 'object' || Array.isArray(finding)) return false
      const findingRecord = finding as { id?: unknown; canonical_summary?: unknown; source_thread?: unknown; required_evidence?: unknown }
      const id = typeof findingRecord.id === 'string' ? findingRecord.id.trim() : ''
      if (!id || findingIds.has(id)) return false
      findingIds.add(id)
      return typeof findingRecord.canonical_summary === 'string' && findingRecord.canonical_summary.trim() !== '' &&
        typeof findingRecord.source_thread === 'string' && findingRecord.source_thread.trim() !== '' &&
        Array.isArray(findingRecord.required_evidence) && findingRecord.required_evidence.length > 0 &&
        findingRecord.required_evidence.every((item) => typeof item === 'string' && item.trim() !== '')
    })
  } catch {
    return false
  }
}
