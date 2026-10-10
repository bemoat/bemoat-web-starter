import type {
  ActivePullRequestEvidence,
  IssueObjectiveSequence,
  NativeReviewAncestryProof,
  NativeReviewEvidence,
  NormalizedContextEvidence,
  ObjectiveCheckpointAncestryProof,
  RoleEvidence,
} from './model.ts'
import { parseProductionMergeReviewVerdict } from './merge-review-verdict.ts'
import { extractHandoffPayload, isFullSha, type ContextCommandRunner } from './runtime.ts'
import { hasUniqueCanonicalReviewIdentity } from './semantic-review-evidence.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'

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
export function readObjectiveCheckpointAncestryProofs({
  repo,
  issueNumber,
  branch,
  head,
  baseBranch,
  baseSha,
  localGit,
  objectiveSequence,
  handoffs,
  run,
  cwd,
  env,
}: {
  repo: string
  issueNumber: string
  branch: string
  head: string
  baseBranch: string
  baseSha: string
  localGit: {
    durable: boolean
    clean: boolean
    detached: boolean
    pushed: boolean
    originRepository: string | null
    branch: string
    head: string | null
    upstream: string | null
  }
  objectiveSequence: IssueObjectiveSequence | undefined
  handoffs: RoleEvidence[]
  run: ContextCommandRunner
  cwd: string
  env: NodeJS.ProcessEnv
}): ObjectiveCheckpointAncestryProof[] {
  if (objectiveSequence?.status !== 'valid' || objectiveSequence.objectives.length < 2 ||
      !localGit.durable || !localGit.clean || localGit.detached || !localGit.pushed ||
      localGit.originRepository !== repo || localGit.branch !== branch || localGit.head?.toLowerCase() !== head.toLowerCase() ||
      localGit.upstream !== `origin/${branch}` || !/^[0-9a-f]{40}$/i.test(baseSha)) return []

  const records = new Map<string, { source: RoleEvidence; record: HandoffRecord; ordinal: number }>()
  for (const source of handoffs) {
    try {
      const record = parseHandoffBody(JSON.stringify(extractHandoffPayload(source.body)))
      const match = record.objective.match(/^Objective ([1-9]\d*) — (.+)$/)
      const nativeId = String(source.id)
      if (record.schema_version !== 2 || record.route !== 'IMPLEMENT' || record.pr !== null ||
          record.repository !== repo || record.issue_number !== issueNumber || record.branch !== branch ||
          record.local_durability.required !== true || record.local_durability.durable !== true ||
          record.protected_base.branch !== baseBranch || record.protected_base.sha.toLowerCase() !== baseSha.toLowerCase() ||
          renderHandoffComment(record) !== source.body || !/^[1-9]\d*$/.test(nativeId) || !match ||
          Number(match[1]) > objectiveSequence.objectives.length ||
          (Number(match[1]) > 1 && objectiveSequence.objectives[Number(match[1]) - 1]?.title !== match[2]) ||
          source.url !== `https://github.com/${repo}/issues/${issueNumber}#issuecomment-${nativeId}`) continue
      records.set(nativeId, { source, record, ordinal: Number(match[1]) })
    } catch {
      // A malformed checkpoint cannot supply ancestry proof.
    }
  }

  const proofs: ObjectiveCheckpointAncestryProof[] = []
  for (const { source, record, ordinal } of records.values()) {
    if (ordinal < 2 || record.objective_mode !== 'implementation') continue
    const entries = record.verified_evidence.filter((entry) => entry.kind === 'objective-checkpoint')
    if (entries.length !== 1) continue
    let binding: Record<string, unknown>
    try { binding = JSON.parse(entries[0]!.value) as Record<string, unknown> } catch { continue }
    if (!binding || typeof binding !== 'object' || Array.isArray(binding) ||
        Object.keys(binding).sort().join('\u0000') !== ['objective_id', 'sequence', 'predecessor_comment_id', 'predecessor_head'].sort().join('\u0000') ||
        binding.objective_id !== String(ordinal) || binding.sequence !== ordinal ||
        typeof binding.predecessor_comment_id !== 'string' || !/^[1-9]\d*$/.test(binding.predecessor_comment_id) ||
        typeof binding.predecessor_head !== 'string' || !/^[0-9a-f]{40}$/i.test(binding.predecessor_head)) continue

    const predecessor = records.get(binding.predecessor_comment_id)
    if (!predecessor || predecessor.ordinal !== ordinal - 1 ||
        predecessor.record.exact_head.toLowerCase() !== binding.predecessor_head.toLowerCase()) continue

    const predecessorHead = predecessor.record.exact_head.toLowerCase()
    const checkpointHead = record.exact_head.toLowerCase()
    const comparison = run('gh', ['api', `repos/${repo}/compare/${predecessorHead}...${checkpointHead}`], { cwd, env })
    if (comparison.status !== 0 || comparison.error || !comparison.stdout.trim()) continue
    let facts: {
      status?: unknown
      ahead_by?: unknown
      behind_by?: unknown
      base_commit?: { sha?: unknown }
      merge_base_commit?: { sha?: unknown }
    }
    try { facts = JSON.parse(comparison.stdout) as typeof facts } catch { continue }
    if (facts.status !== 'ahead' || !Number.isSafeInteger(facts.ahead_by) || (facts.ahead_by as number) <= 0 ||
        facts.behind_by !== 0 || typeof facts.base_commit?.sha !== 'string' ||
        facts.base_commit.sha.toLowerCase() !== predecessorHead || typeof facts.merge_base_commit?.sha !== 'string' ||
        facts.merge_base_commit.sha.toLowerCase() !== predecessorHead) continue

    proofs.push({
      handoffCommentId: String(source.id),
      predecessorCommentId: binding.predecessor_comment_id,
      predecessorHead,
      checkpointHead,
      mergeBaseSha: predecessorHead,
      aheadBy: facts.ahead_by as number,
      behindBy: 0,
    })
  }
  return proofs
}
