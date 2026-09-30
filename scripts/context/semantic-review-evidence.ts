import type { ActivePullRequestEvidence, NativeReviewEvidence, NormalizedContextEvidence } from './model.ts'
import { parseProductionMergeReviewVerdict } from './merge-review-verdict.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function reviewDatabaseId(value: unknown): number | null {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[1-9]\d*$/.test(value)
      ? Number(value)
      : null
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate > 0 ? candidate : null
}

function reviewEvidence(value: unknown): NativeReviewEvidence {
  const record = isRecord(value) ? value : {}
  const ids = [record.databaseId, record.database_id, record.id]
    .map(reviewDatabaseId)
    .filter((id): id is number => id !== null)
  const uniqueIds = [...new Set(ids)]
  const id = uniqueIds.length === 1 ? uniqueIds[0] ?? null : null
  const url = typeof record.html_url === 'string' ? record.html_url : typeof record.url === 'string' ? record.url : null
  const state = typeof record.state === 'string' ? record.state : ''
  const body = typeof record.body === 'string' ? record.body : ''
  const rawCommitId = record.commitId ?? record.commit_id ?? (isRecord(record.commit) ? record.commit.oid : null)
  return { id, url, state, body, commitId: typeof rawCommitId === 'string' && rawCommitId.trim() ? rawCommitId : null }
}

export function nativeReviewRows(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null
  const rows: unknown[] = value.every(Array.isArray) ? value.flat() : value
  const records: Record<string, unknown>[] = []
  for (const row of rows) {
    if (!isRecord(row)) return null
    records.push(row)
  }
  return records
}

export function hasUniqueCanonicalReviewIdentity(reviews: Record<string, unknown>[], repo: string, prNumber: string): boolean {
  const ids = new Set<number>()
  for (const value of reviews) {
    const review = reviewEvidence(value)
    if (review.id === null || review.url !== `https://github.com/${repo}/pull/${prNumber}#pullrequestreview-${review.id}` || ids.has(review.id)) {
      return false
    }
    ids.add(review.id)
  }
  return true
}

export function reviewCounts(reviews: unknown[], headSha: string): { approvedCount: number; exactHeadApprovedCount: number; nativeReviews: NativeReviewEvidence[] } {
  const latest = new Map<string, { approved: boolean; exactHead: boolean }>()
  reviews.forEach((value, index) => {
    if (!isRecord(value)) return
    const identity = asString(isRecord(value.user) ? value.user.login : null) ??
      asString(isRecord(value.author) ? value.author.login : null) ??
      asString(value.authorLogin) ?? `review-${index}`
    const state = String(value.state ?? '').toUpperCase()
    const commitId = String(value.commitId ?? value.commit_id ?? (isRecord(value.commit) ? value.commit.oid : ''))
    latest.set(identity, { approved: state === 'APPROVED', exactHead: state === 'APPROVED' && commitId === headSha })
  })
  const current = [...latest.values()].filter((review) => review.approved)
  return {
    approvedCount: current.length,
    exactHeadApprovedCount: current.filter((review) => review.exactHead).length,
    nativeReviews: reviews.map((value) => reviewEvidence(value)),
  }
}

// Native reviews are durable evidence; HANDOFF remains the append-only transport.
export function hasNativeReviewLineage(
  url: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  requiredVerdict: 'CORRECTION REQUIRED' | 'ELIGIBLE FOR FOUNDER REVIEW',
): boolean {
  const reviewUrlPrefix = `https://github.com/${evidence.repository.nameWithOwner}/pull/${activePr.number}#pullrequestreview-`
  if (!url.startsWith(reviewUrlPrefix)) return false
  const idText = url.slice(reviewUrlPrefix.length)
  if (!/^[1-9]\d*$/.test(idText)) return false
  const reviewId = Number(idText)
  if (!Number.isSafeInteger(reviewId)) return false

  const reviews = (evidence.currentHeadVerification?.reviews.nativeReviews ?? [])
    .filter((review) => review.id === reviewId)
  if (reviews.length !== 1) return false
  const review = reviews[0]!
  if (review.url !== url || !review.commitId || !/^[0-9a-f]{40}$/i.test(review.commitId) ||
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
