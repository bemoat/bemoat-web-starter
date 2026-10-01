import type {
  ActivePullRequestEvidence,
  ContextDecision,
  NormalizedContextEvidence,
} from './model.ts'
import { hasBlockingHandoffReview, isCurrentHandoffReviewVerdict, isFullSha, isPositiveInteger, isRepositoryObjectUrl, resolveCurrentHandoff } from './runtime.ts'
import { parseProductionMergeReviewVerdict, classifyMergeReviewVerdict, resolveMergeReviewVerdictBinding } from './merge-review-verdict.ts'
import { hasBlockingFinding, publicationEraReviewLineageForHandoff } from './semantic-review-evidence.ts'
import { resolveStopBlockers } from './blocker-resolution.ts'
import { prBaseIdentityErrors, staleBaseSyncDiagnostic } from './stale-base.ts'
import type { ProductionMergeReviewVerdict } from './merge-review-verdict.ts'

function evidenceUrls(evidence: NormalizedContextEvidence): string[] {
  const urls = [
    evidence.repository.url,
    evidence.protectedBase.url,
    evidence.policy.url,
    evidence.issue.url,
  ]
  const activePr = evidence.activePr
  if (activePr && !Array.isArray(activePr)) urls.push(activePr.url)
  return [...new Set(urls)]
}

function decision(
  evidence: NormalizedContextEvidence,
  route: ContextDecision['route'],
  reasons: string[],
  nextAction: ContextDecision['nextAction'],
): ContextDecision {
  return {
    route,
    reasons: [...new Set(reasons)],
    nextAction,
    evidenceUrls: evidenceUrls(evidence),
  }
}

function commandAction(description: string): ContextDecision['nextAction'] {
  return { type: 'COMMAND', command: null, description }
}

function identityErrors(evidence: NormalizedContextEvidence, allowWellFormedStaleBase = false): string[] {
  const errors: string[] = []
  const repo = evidence.repository?.nameWithOwner ?? ''
  if (!evidence.issue || typeof evidence.issue.number !== 'string' || !isPositiveInteger(evidence.issue.number)) {
    errors.push('EVIDENCE_CONFLICT: Issue identity is missing or malformed')
  }
  if (!evidence.issue || typeof evidence.issue.title !== 'string' || typeof evidence.issue.state !== 'string' || !evidence.issue.title.trim() || !evidence.issue.state.trim() || !isRepositoryObjectUrl(evidence.issue.url, repo, 'issues', evidence.issue.number)) {
    errors.push('EVIDENCE_CONFLICT: Issue identity fields are missing or empty')
  }
  if (evidence.issue && !evidence.issue.workflowProfile) {
    errors.push('EVIDENCE_CONFLICT: Issue workflow profile cannot be derived from task size and Mission Control mode')
  }

  if (!evidence.protectedBase || !evidence.protectedBase.branch.trim() || !isFullSha(evidence.protectedBase.sha)) {
    errors.push('EVIDENCE_CONFLICT: protected base identity is missing or malformed')
  }

  const active = Array.isArray(evidence.activePr) ? evidence.activePr : evidence.activePr ? [evidence.activePr] : []
  for (const pr of active) {
    const number = pr && typeof pr.number === 'string' ? pr.number : '<unknown>'
    if (!pr || typeof pr.number !== 'string' || !isPositiveInteger(pr.number) || !isRepositoryObjectUrl(pr.url, repo, 'pull', pr.number) || typeof pr.headBranch !== 'string' || !pr.headBranch.trim() || !isFullSha(pr.headSha) || typeof pr.state !== 'string' || !pr.state.trim()) {
      errors.push(`EVIDENCE_CONFLICT: PR identity for #${number} is missing or malformed`)
    }
    const stateMerged = pr?.state?.toUpperCase() === 'MERGED'
    const mergeCommitPresent = pr?.mergeCommitSha !== null && pr?.mergeCommitSha !== undefined
    const validMergeCommit = typeof pr?.mergeCommitSha === 'string' && isFullSha(pr.mergeCommitSha)
    if (!pr || Boolean(pr.merged) !== stateMerged || (stateMerged ? !validMergeCommit : mergeCommitPresent)) {
      errors.push(`EVIDENCE_CONFLICT: PR #${number} state and merge commit evidence disagree`)
    }
    const merged = stateMerged && Boolean(pr?.merged) && validMergeCommit
    errors.push(...prBaseIdentityErrors(evidence, pr, number, merged, allowWellFormedStaleBase))
    if (merged && (!pr || typeof pr.mergeCommitSha !== 'string' || !isFullSha(pr.mergeCommitSha))) {
      errors.push(`EVIDENCE_CONFLICT: PR #${number} merge commit identity is missing or malformed`)
    }
  }
  return errors
}

function reviewedHeadForApplicability(body: string): string | null {
  // A parse failure is ignorable only when the recognized head proves that the
  // malformed record belongs to an older PR head. Unknown or ambiguous heads
  // remain fail-closed below.
  const candidates: string[] = []
  const canonicalLines = [...body.matchAll(/^\*\*PR \/ base \/ head:\*\*[ \t]*(.*)$/gm)]
  for (const line of canonicalLines) {
    const target = line[1]?.match(/^[^\r\n]*?\s*·\s*`[^`\r\n@]+`\s*·\s*`([^`\r\n]+)`[ \t]*$/)?.[1]
    if (!target || !isFullSha(target)) return null
    candidates.push(target.toLowerCase())
  }

  const exactHeadLines = [...body.matchAll(/^\*\*(?:Exact head reviewed|Exact reviewed head):\*\*[ \t]*(.*)$/gim)]
  for (const line of exactHeadLines) {
    const match = line[1]?.match(/^[ \t]*(?:`([0-9a-f]{40})`|([0-9a-f]{40}))[ \t]*$/i)
    const target = match?.[1] ?? match?.[2]
    if (!target) return null
    candidates.push(target.toLowerCase())
  }

  const unique = [...new Set(candidates)]
  return unique.length === 1 ? unique[0] ?? null : null
}

function isProtectedOrIntegrationBranch(branch: string): boolean {
  return /^(?:main|master|dev|develop|integration|staging|production)(?:\/.*)?$/i.test(branch)
}

function routeContextInternal(evidence: NormalizedContextEvidence, ignoredStaleBaseError: string | null = null): ContextDecision {
  const allowPublicationEraReviewRecovery = ignoredStaleBaseError !== null
  const baseReasons = [
    ...evidence.evidenceErrors.filter((error) => error !== ignoredStaleBaseError),
    ...identityErrors(evidence, ignoredStaleBaseError !== null),
  ]
  const activeEvidence = evidence.activePr as ActivePullRequestEvidence | ActivePullRequestEvidence[] | null
  const mergedPr = activeEvidence && !Array.isArray(activeEvidence) && (activeEvidence.merged || activeEvidence.state.toUpperCase() === 'MERGED')
  if (!mergedPr && (!evidence.localGit.clean || evidence.localGit.detached || !evidence.localGit.pushed || !evidence.localGit.durable)) {
    baseReasons.push(
      ...evidence.localGit.reasons,
      'LOCAL_STATE_NOT_DURABLE: required local work is not clean, pushed, and attached to a durable branch',
    )
  }
  if (Array.isArray(evidence.activePr)) baseReasons.push('EVIDENCE_CONFLICT: competing active PRs cannot be uniquely resolved')

  if (baseReasons.length > 0) {
    return decision(evidence, 'STOP', baseReasons, {
      type: 'STOP',
      command: null,
      description: Array.isArray(evidence.activePr)
        ? 'Resolve competing active PR evidence before continuing.'
        : 'Resolve the evidence and local durability blockers before continuing.',
    })
  }

  if (!mergedPr && isProtectedOrIntegrationBranch(evidence.localGit.branch)) {
    return decision(evidence, 'STOP', [
      'EVIDENCE_CONFLICT: protected or integration branch cannot route IMPLEMENT',
    ], {
      type: 'STOP',
      command: null,
      description: 'Switch to a durable topic branch before continuing.',
    })
  }

  const activePr = evidence.activePr as ActivePullRequestEvidence | null
  if (!activePr) {
    if (evidence.issue.state.toUpperCase() === 'CLOSED') {
      return decision(evidence, 'STOP', [
        'EVIDENCE_CONFLICT: Issue is closed without a uniquely resolved merged PR',
      ], {
        type: 'STOP',
        command: null,
        description: 'Resolve the closed Issue and PR evidence before continuing.',
      })
    }
    return decision(evidence, 'IMPLEMENT', [
      'No active PR is present and the local topic branch is durable.',
    ], commandAction('Implement the bounded Issue objective on the durable topic branch.'))
  }

  if (activePr.merged || activePr.state === 'MERGED') {
    return decision(evidence, 'COMPLETE', [
      'The active PR is merged and the bounded objective is terminal under native evidence.',
    ], {
      type: 'COMPLETE',
      command: null,
      description: 'No further implementation action is permitted for this bounded objective.',
    })
  }

  const verification = evidence.currentHeadVerification
  if (!verification || verification.exactHead !== activePr.headSha) {
    return decision(evidence, 'STOP', [
      'EVIDENCE_CONFLICT: exact-head verification is missing or bound to a different PR head',
    ], {
      type: 'STOP',
      command: null,
      description: 'Re-establish exact-head evidence before continuing.',
    })
  }

  const handoffResolution = resolveCurrentHandoff(evidence, activePr, allowPublicationEraReviewRecovery)
  if (handoffResolution.conflict) {
    return decision(evidence, 'STOP', [handoffResolution.conflict.reason], handoffResolution.conflict.nextAction)
  }
  const applicableHandoff = handoffResolution.record
  const publicationEraLineage = allowPublicationEraReviewRecovery && applicableHandoff !== null ? publicationEraReviewLineageForHandoff(applicableHandoff, evidence, activePr) : null
  const handoffBlockingReview = applicableHandoff !== null && hasBlockingHandoffReview(applicableHandoff, evidence, activePr, allowPublicationEraReviewRecovery)
  if (applicableHandoff?.route === 'STOP') {
    const source = handoffResolution.evidence
    const blockerResolution = source
      ? resolveStopBlockers({ record: applicableHandoff, source, evidence, activePr })
      : 'conflict'
    if (blockerResolution !== 'resolved') {
      return decision(evidence, 'STOP', [
        blockerResolution === 'conflict'
          ? `EVIDENCE_CONFLICT: exact-head HANDOFF STOP has ambiguous blocker-resolution evidence at ${activePr.headSha}.`
          : `Exact-head HANDOFF STOP remains unresolved at ${activePr.headSha}.`,
      ], {
        type: 'STOP',
        command: null,
        description: 'Resolve the exact-head HANDOFF STOP before continuing.',
      })
    }
  }
  if (verification.checks.failed) {
    return decision(evidence, 'FIX', [
      `Exact-head required checks failed at ${activePr.headSha}.`,
    ], commandAction('Fix the bounded defect identified by the failed exact-head checks.'))
  }

  if (!verification.checks.complete || verification.checks.pending) {
    return decision(evidence, 'VERIFY', [
      `Exact-head required checks are incomplete at ${activePr.headSha}.`,
    ], commandAction('Wait for or verify the exact-head checks bound to the active PR.'))
  }

  const semanticReviewRequired =
    evidence.issue.workflowProfile === 'STANDARD' ||
    evidence.issue.workflowProfile === 'MANAGED'

  let semanticReviewSatisfied = false
  let blockingSemanticReview = false
  if (semanticReviewRequired) {
    const verdicts = evidence.durableContext.historicalResults.filter((r) =>
      /^##\s+REVIEW_VERDICT\b/i.test(r.body) && !publicationEraLineage?.summaryCommentIds.some((id) => String(id) === String(r.id)),
    )
    const currentHeadVerdicts: Array<{ id: string | number; body: string; parsed: ProductionMergeReviewVerdict | null; valid: boolean; acceptedVerdict: string | null }> = []

    const inspectVerdict = (id: string | number, body: string, commentUrl: string | null = null, nativeCurrent = false): void => {
      try {
        const parsed = parseProductionMergeReviewVerdict(body, id)
        const classification = classifyMergeReviewVerdict({
          // The existing classifier intentionally recognizes only the
          // non-blocking founder-review verdict. Reuse its complete identity
          // binding for both current-protocol semantic outcomes below.
          reviewVerdict: { ...parsed, verdict: 'ELIGIBLE FOR FOUNDER REVIEW' },
          expected: {
            commentId: id,
            exactHead: activePr.headSha,
            pr: activePr.number,
            base: evidence.protectedBase.branch,
            repository: evidence.repository.nameWithOwner,
            issue: evidence.issue.number,
          },
        })
        const acceptedVerdict = parsed.verdict === 'ELIGIBLE FOR FOUNDER REVIEW' || parsed.verdict === 'CORRECTION REQUIRED'
          ? parsed.verdict
          : null
        const validCorrection = acceptedVerdict === 'CORRECTION REQUIRED' &&
          (hasBlockingFinding(body, activePr.headSha) ||
            isCurrentHandoffReviewVerdict(applicableHandoff, evidence, activePr, commentUrl, allowPublicationEraReviewRecovery))
        if (classification.valid && (acceptedVerdict === 'ELIGIBLE FOR FOUNDER REVIEW' || validCorrection)) {
          currentHeadVerdicts.push({ id, body, parsed, valid: true, acceptedVerdict })
        }
        else if (nativeCurrent || parsed.reviewed_head?.toLowerCase() === activePr.headSha.toLowerCase()) {
          currentHeadVerdicts.push({ id, body, parsed, valid: false, acceptedVerdict })
        }
      } catch {
        const reviewedHead = reviewedHeadForApplicability(body)
        if (nativeCurrent || !reviewedHead || reviewedHead === activePr.headSha.toLowerCase()) {
          currentHeadVerdicts.push({ id, body, parsed: null, valid: false, acceptedVerdict: null })
        }
      }
    }

    for (const verdict of verdicts) {
      if (/evidence reconciliation\s*\(no semantic re-review\)/i.test(verdict.body)) continue
      inspectVerdict(verdict.id, verdict.body, verdict.url)
    }

    for (const review of verification.reviews.nativeReviews ?? []) {
      if (publicationEraLineage?.reviewId === review.id) continue
      if (!/^##\s+REVIEW_VERDICT\b/i.test(review.body)) continue
      if (!review.commitId || !isFullSha(review.commitId)) {
        currentHeadVerdicts.push({ id: review.id ?? '<unknown>', body: review.body, parsed: null, valid: false, acceptedVerdict: null })
        continue
      }
      if (review.commitId.toLowerCase() !== activePr.headSha.toLowerCase()) continue
      if (!isPositiveInteger(review.id) || !['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(review.state.toUpperCase())) {
        currentHeadVerdicts.push({ id: review.id ?? '<unknown>', body: review.body, parsed: null, valid: false, acceptedVerdict: null })
        continue
      }
      inspectVerdict(review.id!, review.body, null, true)
    }

    let malformedEvidence = false
    let conflictingLiveHeadEvidence = false

    const validVerdicts = currentHeadVerdicts.filter(v => v.valid)
    const malformedVerdicts = currentHeadVerdicts.filter(v => !v.valid)
    const supersededIds = new Set<string>()

    for (const validVerdict of validVerdicts) {
      const supersedes = validVerdict.parsed?.supersedes_predecessor
      if (supersedes) {
        const matchingMalformed = malformedVerdicts.filter(m => {
          if (String(m.id) !== supersedes) return false

          let predecessorBinding: { pr: string | null; base: string | null; reviewed_head: string | null; repository: string | null; issue: string | null } | null = m.parsed
          if (!predecessorBinding) {
            try {
              predecessorBinding = resolveMergeReviewVerdictBinding(m.body)
            } catch {
              return false
            }
          }

          return predecessorBinding.repository === validVerdict.parsed?.repository &&
                 String(predecessorBinding.issue) === String(validVerdict.parsed?.issue) &&
                 String(predecessorBinding.pr) === String(validVerdict.parsed?.pr) &&
                 predecessorBinding.base === validVerdict.parsed?.base &&
                 predecessorBinding.reviewed_head === validVerdict.parsed?.reviewed_head
        })
        if (matchingMalformed.length === 1) {
          supersededIds.add(String(matchingMalformed[0]!.id))
        } else {
          conflictingLiveHeadEvidence = true
        }
      }
    }

    const activeMalformedVerdicts = malformedVerdicts.filter(m => !supersededIds.has(String(m.id)))
    if (activeMalformedVerdicts.length > 0) {
      malformedEvidence = true
    }

    const uniqueValidVerdicts = [...new Set(validVerdicts.map((v) => v.acceptedVerdict))]
    if (uniqueValidVerdicts.length > 1) {
      conflictingLiveHeadEvidence = true
    }

    const handoffConflictsWithReview = handoffBlockingReview && (
      malformedEvidence ||
      conflictingLiveHeadEvidence ||
      validVerdicts.some(({ acceptedVerdict }) => acceptedVerdict !== 'CORRECTION REQUIRED')
    )
    if (handoffConflictsWithReview) {
      return decision(evidence, 'STOP', [
        `EVIDENCE_CONFLICT: current-head HANDOFF FIX conflicts with competing or malformed semantic review evidence at ${activePr.headSha}.`,
      ], {
        type: 'STOP',
        command: null,
        description: 'Resolve the conflicting current-head review evidence before continuing.',
      })
    }

    if (malformedEvidence || conflictingLiveHeadEvidence) {
      return decision(evidence, 'STOP', [
        `EVIDENCE_CONFLICT: malformed or conflicting exact-head semantic review evidence at ${activePr.headSha}.`,
      ], {
        type: 'STOP', command: null,
        description: 'Resolve the exact-head semantic review evidence conflict before continuing.',
      })
    }

    semanticReviewSatisfied = handoffBlockingReview || (
      !malformedEvidence && !conflictingLiveHeadEvidence && validVerdicts.length >= 1
    )
    blockingSemanticReview = semanticReviewSatisfied && (
      handoffBlockingReview || uniqueValidVerdicts[0] === 'CORRECTION REQUIRED'
    )
  }

  if (blockingSemanticReview) {
    return decision(evidence, 'FIX', [
      `Exact-head STANDARD semantic review identified a blocking finding at ${activePr.headSha}.`,
    ], commandAction('Apply the bounded correction identified by the exact-head semantic review.'))
  }

  if (
    (verification.reviews.required && !(verification.reviews.approved && verification.reviews.exactHead)) ||
    (semanticReviewRequired && !semanticReviewSatisfied)
  ) {
    const reason = (verification.reviews.required && !(verification.reviews.approved && verification.reviews.exactHead))
      ? `Exact-head checks pass, but required review evidence is not approved at ${activePr.headSha}.`
      : `Exact-head checks pass, but STANDARD semantic review is missing at ${activePr.headSha}.`

    return decision(evidence, 'REVIEW', [
      reason,
    ], commandAction('Review the durable implementation at the exact active PR head.'))
  }

  return decision(evidence, 'FOUNDER_GATE', [
    `Exact-head checks and required review evidence pass at ${activePr.headSha}.`,
  ], {
    type: 'FOUNDER_GATE',
    command: null,
    description: 'Founder authorization is required before the next merge or scope mutation.',
  })
}

export function routeContext(evidence: NormalizedContextEvidence): ContextDecision {
  return routeContextInternal(evidence)
}

// Sync authorization uses this continuation evaluation; ordinary Context does not.
export function routeContextForStaleBaseSync(evidence: NormalizedContextEvidence): ContextDecision {
  return routeContextInternal(evidence, staleBaseSyncDiagnostic(evidence))
}
