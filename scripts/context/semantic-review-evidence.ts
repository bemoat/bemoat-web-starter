import type { ActivePullRequestEvidence, NativeReviewEvidence, NormalizedContextEvidence, RoleEvidence } from './model.ts'
import { parseProductionMergeReviewVerdict, resolveMergeReviewVerdictBinding } from './merge-review-verdict.ts'
import type { HandoffRecord } from '../handoff/schema.ts'

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

function isExactIssueCommentUrl(value: string, comment: RoleEvidence, evidence: NormalizedContextEvidence): boolean {
  if (value !== comment.url || !/^[1-9]\d*$/.test(String(comment.id))) return false
  try {
    const url = new URL(value)
    return url.origin === 'https://github.com' &&
      url.pathname === `/${evidence.repository.nameWithOwner}/issues/${evidence.issue.number}` &&
      url.search === '' && url.hash === `#issuecomment-${String(comment.id)}`
  } catch {
    return false
  }
}

export interface PublicationEraNativeReviewLineage {
  reviewId: number
  reviewUrl: string
  summaryCommentIds: Array<string | number>
}

function publicationIdentityMatches(
  body: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  try {
    const binding = resolveMergeReviewVerdictBinding(body)
    return (!binding.repository || binding.repository.toLowerCase() === evidence.repository.nameWithOwner.toLowerCase()) &&
      (!binding.issue || binding.issue === evidence.issue.number) &&
      (!binding.pr || binding.pr === activePr.number) &&
      (!binding.base || binding.base === activePr.baseBranch) &&
      (!binding.reviewed_head || binding.reviewed_head.toLowerCase() === activePr.headSha.toLowerCase()) &&
      binding.non_superseded && binding.supersedes_predecessor === null
  } catch {
    return false
  }
}

function exactLegacyReviewBody(
  body: string,
  expectedHead: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  if (/^###\s+Immutable finding disposition\b/im.test(body)) return false

  const reviewedHeads = [...body.matchAll(/^[ \t]*Reviewed exact head:[ \t]*`?([0-9a-f]{40})`?[ \t]*$/gim)]
  if (reviewedHeads.length !== 1 || reviewedHeads[0]?.[1]?.toLowerCase() !== expectedHead.toLowerCase()) return false

  const verdicts = [...body.matchAll(/^[ \t]*(?:\*\*|__)?Verdict(?:\*\*|__)?[ \t]*:[ \t]*(.*?)[ \t]*(?:\*\*|__)?[ \t]*$/gim)]
  if (verdicts.length !== 1 || verdicts[0]?.[1]?.trim() !== 'CORRECTION REQUIRED') return false

  const findings = [...body.matchAll(/^[ \t]*Blocking finding:[ \t]*$/gim)]
  if (findings.length !== 1) return false
  const findingStart = (findings[0]?.index ?? -1) + (findings[0]?.[0].length ?? 0)
  const followingText = findingStart >= 0 ? body.slice(findingStart) : ''
  const reviewLines = followingText.split(/\r?\n/)
  const nextSection = reviewLines.findIndex((line) => {
    const plain = line.replace(/^[ \t]*(?:(?:>[ \t]*)+)?(?:(?:[-*+]|\d+[.)])[ \t]+)?/, '')
    const label = plain.replace(/(?:\*\*|__|[*_]|`)/g, '').trimStart()
    return /^#{1,6}[ \t]+\S/.test(plain) ||
      /^(?:non-blocking observations|required correction|recommendations?|next steps|summary|rationale|notes|evidence|resolution):/i.test(label) ||
      /^(?:\*\*|__|[*_]).+(?:\*\*|__|[*_]):/.test(plain)
  })
  const findingText = reviewLines.slice(0, nextSection < 0 ? reviewLines.length : nextSection).join('\n')
    .replace(/^[ \t]*(?:[-*+][ \t]+|\d+[.)][ \t]+|>[ \t]*)/gm, '')
    .trim()
  if (!/[\p{L}\p{N}]/u.test(findingText) || !publicationIdentityMatches(body, evidence, activePr)) return false

  return true
}

function exactIssueCommentUrl(comment: RoleEvidence, evidence: NormalizedContextEvidence): boolean {
  if (!/^[1-9]\d*$/.test(String(comment.id))) return false
  try {
    const url = new URL(comment.url)
    return url.origin === 'https://github.com' &&
      url.pathname === `/${evidence.repository.nameWithOwner}/issues/${evidence.issue.number}` &&
      url.search === '' &&
      url.hash === `#issuecomment-${String(comment.id)}`
  } catch {
    return false
  }
}

function sourceSemanticReviewValues(body: string): string[] {
  const lines = body.split(/\r?\n/)
  const values: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^[ \t]*(?:[-*][ \t]*)?Source semantic review:[ \t]*(.*)$/i)
    if (!match) continue
    let value = match[1]?.trim() ?? ''
    if (!value) value = lines[index + 1]?.trim() ?? ''
    values.push(value)
  }
  return values
}

function currentPublicationSummaryCandidate(
  comment: RoleEvidence,
  reviewUrl: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  if (!/^##\s+REVIEW_VERDICT\b/i.test(comment.body)) return false
  if (comment.body.includes(reviewUrl) || comment.body.toLowerCase().includes(activePr.headSha.toLowerCase())) return true

  try {
    const binding = resolveMergeReviewVerdictBinding(comment.body)
    return binding.pr === activePr.number && binding.base === activePr.baseBranch &&
      binding.repository?.toLowerCase() === evidence.repository.nameWithOwner.toLowerCase() &&
      binding.issue === evidence.issue.number
  } catch {
    return false
  }
}

function publicationSummaryAgrees(
  comment: RoleEvidence,
  reviewUrl: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  if (!exactIssueCommentUrl(comment, evidence) || !/^##\s+REVIEW_VERDICT\b/i.test(comment.body)) return false
  const sourceValues = sourceSemanticReviewValues(comment.body)
  if (sourceValues.length !== 1 || sourceValues[0] !== reviewUrl) return false

  try {
    const binding = parseProductionMergeReviewVerdict(comment.body, comment.id)
    return binding.verdict === 'CORRECTION REQUIRED' && binding.non_superseded === true &&
      binding.supersedes_predecessor === null &&
      binding.repository === evidence.repository.nameWithOwner.toLowerCase() &&
      binding.issue === evidence.issue.number && binding.pr === activePr.number &&
      binding.base === activePr.baseBranch &&
      binding.reviewed_head?.toLowerCase() === activePr.headSha.toLowerCase()
  } catch {
    return false
  }
}

// Compatibility for publication-era exact-head reviews is restricted to the
// stale-base synchronization continuation. This validates the native review
// itself; an Issue summary, when present, can only corroborate that lineage.
export function publicationEraNativeReviewLineage(
  reviewUrl: string,
  handoffValue: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): PublicationEraNativeReviewLineage | null {
  const outcomes = [...handoffValue.matchAll(/\b(CORRECTION REQUIRED|ELIGIBLE FOR FOUNDER REVIEW)\b/g)]
  if (outcomes.length !== 1 || outcomes[0]?.[1] !== 'CORRECTION REQUIRED') return null

  const prefix = `https://github.com/${evidence.repository.nameWithOwner}/pull/${activePr.number}#pullrequestreview-`
  if (!reviewUrl.startsWith(prefix)) return null
  const idText = reviewUrl.slice(prefix.length)
  if (!/^[1-9]\d*$/.test(idText)) return null
  const reviewId = Number(idText)
  if (!Number.isSafeInteger(reviewId)) return null

  const reviews = evidence.currentHeadVerification?.reviews.nativeReviews ?? []
  const reviewRows = reviews.map((review) => ({ id: review.id, url: review.url }))
  if (!hasUniqueCanonicalReviewIdentity(reviewRows, evidence.repository.nameWithOwner, activePr.number)) return null
  const exactHeadVerdicts = reviews.filter((review) =>
    review.commitId?.toLowerCase() === activePr.headSha.toLowerCase() && /^##\s+REVIEW_VERDICT\b/i.test(review.body),
  )
  if (exactHeadVerdicts.length !== 1 || exactHeadVerdicts[0]?.id !== reviewId) return null
  const matches = reviews.filter((review) => review.id === reviewId)
  if (matches.length !== 1) return null
  const review = matches[0]!
  if (review.url !== reviewUrl || !review.commitId || !/^[0-9a-f]{40}$/i.test(review.commitId) ||
    review.commitId.toLowerCase() !== activePr.headSha.toLowerCase() ||
    !['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(review.state.toUpperCase()) ||
    !exactLegacyReviewBody(review.body, activePr.headSha, evidence, activePr)) return null

  const summaries = evidence.durableContext.historicalResults.filter((comment) =>
    currentPublicationSummaryCandidate(comment, reviewUrl, evidence, activePr),
  )
  if (summaries.length > 1 || summaries.some((comment) => !publicationSummaryAgrees(comment, reviewUrl, evidence, activePr))) return null

  return {
    reviewId,
    reviewUrl,
    summaryCommentIds: summaries.map(({ id }) => id),
  }
}

export function publicationEraReviewLineageForHandoff(
  handoff: HandoffRecord | null,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): PublicationEraNativeReviewLineage | null {
  if (!handoff || handoff.route !== 'FIX' ||
    handoff.repository !== evidence.repository.nameWithOwner || handoff.issue_number !== evidence.issue.number ||
    handoff.branch !== activePr.headBranch || handoff.exact_head.toLowerCase() !== activePr.headSha.toLowerCase() ||
    handoff.protected_base.branch !== activePr.baseBranch ||
    handoff.protected_base.sha.toLowerCase() !== activePr.baseSha.toLowerCase() ||
    handoff.pr === null || handoff.pr.number !== activePr.number || handoff.pr.url !== activePr.url ||
    handoff.pr.base !== activePr.baseBranch || handoff.pr.head !== activePr.headBranch ||
    handoff.pr.head_sha.toLowerCase() !== activePr.headSha.toLowerCase() ||
    handoff.local_durability.durable !== true) return null

  const references = handoff.verified_evidence.filter(({ kind }) => kind === 'review-verdict')
  if (references.length !== 1) return null
  const reference = references[0]
  if (!reference?.url || typeof reference.value !== 'string' ||
    hasNativeReviewLineage(reference.url, evidence, activePr, 'CORRECTION REQUIRED')) return null

  return publicationEraNativeReviewLineage(reference.url, reference.value, evidence, activePr)
}

export function hasCurrentHandoffReviewVerdict(
  handoff: HandoffRecord,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  route: 'FIX' | 'FOUNDER_GATE',
  requiredVerdict: 'CORRECTION REQUIRED' | 'ELIGIBLE FOR FOUNDER REVIEW',
  allowPublicationEraReviewRecovery = false,
): boolean {
  if (
    handoff.route !== route || handoff.branch !== activePr.headBranch ||
    handoff.protected_base.branch !== activePr.baseBranch ||
    handoff.protected_base.sha.toLowerCase() !== activePr.baseSha.toLowerCase() ||
    handoff.pr === null || handoff.pr.base !== activePr.baseBranch ||
    handoff.pr.head !== activePr.headBranch || handoff.pr.head_sha.toLowerCase() !== activePr.headSha.toLowerCase()
  ) return false

  const references = handoff.verified_evidence.filter(({ kind }) => kind === 'review-verdict')
  if (references.length !== 1) return false
  const reference = references[0]
  if (!reference?.url) return false
  if (hasNativeReviewLineage(reference.url, evidence, activePr, requiredVerdict)) return true

  const comments = evidence.durableContext.historicalResults.filter((comment) =>
    comment.url === reference.url && isExactIssueCommentUrl(reference.url!, comment, evidence))
  const publicationEraRecovery = () => allowPublicationEraReviewRecovery && route === 'FIX' && requiredVerdict === 'CORRECTION REQUIRED' &&
    publicationEraReviewLineageForHandoff(handoff, evidence, activePr) !== null
  if (comments.length !== 1) return publicationEraRecovery()
  const comment = comments[0]
  if (!comment || !/^##\s+REVIEW_VERDICT\b/i.test(comment.body)) return publicationEraRecovery()

  try {
    const verdict = parseProductionMergeReviewVerdict(comment.body, comment.id)
    return (verdict.verdict === requiredVerdict && verdict.non_superseded === true &&
      verdict.repository === evidence.repository.nameWithOwner.toLowerCase() &&
      String(verdict.issue) === evidence.issue.number && String(verdict.pr) === activePr.number &&
      verdict.base === activePr.baseBranch &&
      verdict.reviewed_head?.toLowerCase() === activePr.headSha.toLowerCase()) || publicationEraRecovery()
  } catch {
    return publicationEraRecovery()
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
