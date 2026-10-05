import type { ActivePullRequestEvidence, NativeReviewAncestryProof, NativeReviewEvidence, NormalizedContextEvidence } from './model.ts'
import { parseProductionMergeReviewVerdict } from './merge-review-verdict.ts'
import { isFullSha, type ContextCommandRunner } from './runtime.ts'
import { hasUniqueCanonicalReviewIdentity } from './semantic-review-evidence.ts'

function submitted(review: NativeReviewEvidence): boolean {
  return ['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(review.state.toUpperCase())
}

function parseJsonResult<T>(result: ReturnType<ContextCommandRunner>): T | null {
  if (result.status !== 0 || result.error || !result.stdout.trim()) return null
  try {
    return JSON.parse(result.stdout) as T
  } catch {
    return null
  }
}

/** Validate a named older native review against its identity and strict-ancestry proof. */
export function hasStrictCrossHeadNativeReviewPredecessor(
  currentReviewId: string | number,
  predecessorId: string,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  const reviews = evidence.currentHeadVerification?.reviews.nativeReviews ?? []
  const matching = reviews.filter((review) => String(review.id) === predecessorId)
  if (matching.length !== 1) return false
  const predecessor = matching[0]!
  if (String(predecessor.id) === String(currentReviewId) || !Number.isSafeInteger(predecessor.id) ||
    predecessor.id! <= 0 || predecessor.url !== `https://github.com/${evidence.repository.nameWithOwner}/pull/${activePr.number}#pullrequestreview-${predecessor.id}` ||
    !predecessor.commitId || !/^[0-9a-f]{40}$/i.test(predecessor.commitId) ||
    predecessor.commitId.toLowerCase() === activePr.headSha.toLowerCase() ||
    !submitted(predecessor) || !/^##\s+REVIEW_VERDICT\b/i.test(predecessor.body)) return false

  try {
    const prior = parseProductionMergeReviewVerdict(predecessor.body, predecessor.id)
    if (prior.repository !== evidence.repository.nameWithOwner.toLowerCase() ||
      String(prior.issue) !== evidence.issue.number || String(prior.pr) !== activePr.number ||
      prior.base !== activePr.baseBranch || prior.reviewed_head?.toLowerCase() !== predecessor.commitId.toLowerCase()) return false
  } catch {
    return false
  }

  const proofs = evidence.currentHeadVerification?.reviews.nativeReviewAncestryProofs ?? []
  const matchingProofs = proofs.filter((proof) => Boolean(proof) && proof.predecessorReviewId === Number(predecessorId))
  if (matchingProofs.length !== 1) return false
  const proof = matchingProofs[0]!
  return typeof proof.predecessorHeadSha === 'string' && /^[0-9a-f]{40}$/i.test(proof.predecessorHeadSha) &&
    typeof proof.currentHeadSha === 'string' && /^[0-9a-f]{40}$/i.test(proof.currentHeadSha) &&
    typeof proof.mergeBaseSha === 'string' && /^[0-9a-f]{40}$/i.test(proof.mergeBaseSha) &&
    proof.predecessorHeadSha.toLowerCase() === predecessor.commitId.toLowerCase() &&
    proof.currentHeadSha.toLowerCase() === activePr.headSha.toLowerCase() &&
    proof.mergeBaseSha.toLowerCase() === predecessor.commitId.toLowerCase() &&
    proof.status === 'ahead' && Number.isSafeInteger(proof.aheadBy) && proof.aheadBy > 0 &&
    Number.isSafeInteger(proof.behindBy) && proof.behindBy === 0
}

/** Read strict pairwise ancestry only for explicitly named native-review predecessors. */
export function readNativeReviewAncestryProofs({
  reviews,
  repository,
  issue,
  pr,
  base,
  currentHead,
  run,
  cwd,
  env,
}: {
  reviews: NativeReviewEvidence[]
  repository: string
  issue: string
  pr: string
  base: string
  currentHead: string
  run: ContextCommandRunner
  cwd: string
  env: NodeJS.ProcessEnv
}): NativeReviewAncestryProof[] {
  const proofs: NativeReviewAncestryProof[] = []
  if (!hasUniqueCanonicalReviewIdentity(reviews.map((review) => ({ id: review.id, url: review.url })), repository, pr)) return proofs

  for (const current of reviews) {
    if (current.commitId?.toLowerCase() !== currentHead.toLowerCase() || !submitted(current) ||
      current.id === null || !/^##\s+REVIEW_VERDICT\b/i.test(current.body)) continue

    let verdict: ReturnType<typeof parseProductionMergeReviewVerdict>
    try {
      verdict = parseProductionMergeReviewVerdict(current.body, current.id)
    } catch {
      continue
    }
    if (!verdict.supersedes_predecessor || verdict.repository !== repository.toLowerCase() ||
      verdict.issue !== issue || verdict.pr !== pr || verdict.base !== base ||
      verdict.reviewed_head?.toLowerCase() !== currentHead.toLowerCase()) continue

    const predecessorId = Number(verdict.supersedes_predecessor)
    if (!Number.isSafeInteger(predecessorId) || predecessorId <= 0) continue
    const matches = reviews.filter((review) => review.id === predecessorId)
    if (matches.length !== 1) continue
    const predecessor = matches[0]!
    if (!submitted(predecessor) || !predecessor.commitId || !isFullSha(predecessor.commitId) ||
      predecessor.commitId.toLowerCase() === currentHead.toLowerCase()) continue

    let previousVerdict: ReturnType<typeof parseProductionMergeReviewVerdict>
    try {
      previousVerdict = parseProductionMergeReviewVerdict(predecessor.body, predecessor.id)
    } catch {
      continue
    }
    if (previousVerdict.repository !== repository.toLowerCase() || previousVerdict.issue !== issue ||
      previousVerdict.pr !== pr || previousVerdict.base !== base ||
      previousVerdict.reviewed_head?.toLowerCase() !== predecessor.commitId.toLowerCase()) continue

    const result = parseJsonResult<{
      status?: unknown
      ahead_by?: unknown
      behind_by?: unknown
      base_commit?: { sha?: unknown }
      head_commit?: { sha?: unknown }
      merge_base_commit?: { sha?: unknown }
      commits?: unknown
    }>(run('gh', ['api', `repos/${repository}/compare/${predecessor.commitId}...${currentHead}`], { cwd, env }))
    if (!result || typeof result.status !== 'string' || !Number.isSafeInteger(result.ahead_by) ||
      !Number.isSafeInteger(result.behind_by) || !isFullSha(result.base_commit?.sha) ||
      !isFullSha(result.merge_base_commit?.sha)) continue
    if (result.base_commit!.sha!.toLowerCase() !== predecessor.commitId.toLowerCase()) continue

    let currentHeadBinds = isFullSha(result.head_commit?.sha) &&
      result.head_commit!.sha!.toLowerCase() === currentHead.toLowerCase()
    if (result.head_commit === null || result.head_commit === undefined) {
      const commits = Array.isArray(result.commits) ? result.commits : []
      const commitShas = commits.map((commit) =>
        commit && typeof commit === 'object' && !Array.isArray(commit)
          ? (commit as { sha?: unknown }).sha
          : null,
      )
      const uniqueCommitShas = new Set(commitShas)
      currentHeadBinds = Number.isSafeInteger(result.ahead_by) && (result.ahead_by as number) > 0 &&
        commits.length === result.ahead_by && commitShas.every(isFullSha) &&
        uniqueCommitShas.size === commits.length &&
        commitShas.at(-1)?.toLowerCase() === currentHead.toLowerCase()
    }
    if (!currentHeadBinds) continue

    proofs.push({
      predecessorReviewId: predecessorId,
      predecessorHeadSha: predecessor.commitId.toLowerCase(),
      currentHeadSha: currentHead.toLowerCase(),
      status: result.status,
      mergeBaseSha: result.merge_base_commit!.sha!.toLowerCase(),
      aheadBy: result.ahead_by as number,
      behindBy: result.behind_by as number,
    })
  }

  return proofs
}
