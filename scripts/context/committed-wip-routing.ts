import { isAbsolute } from 'node:path'

import { COMMITTED_WIP_BINDING, COMMITTED_WIP_PATHS } from './committed-wip-recovery.ts'
import type { ContextDecision, NormalizedContextEvidence } from './model.ts'

type NoPrDecision = Omit<ContextDecision, 'evidenceUrls'>

function samePaths(actual: string[]): boolean {
  const expected = [...COMMITTED_WIP_PATHS].sort()
  const sorted = [...actual].sort()
  return sorted.length === expected.length && sorted.every((path, index) => path === expected[index])
}

function exactProof(evidence: NormalizedContextEvidence): boolean {
  const proof = evidence.committedWipProof
  if (!proof) return false
  const binding = COMMITTED_WIP_BINDING
  return proof.status === 'PROVEN' && proof.repository === binding.repository &&
    proof.repository === evidence.repository.nameWithOwner &&
    proof.issue_number === binding.issueNumber && proof.issue_number === evidence.issue.number &&
    proof.branch === binding.branch && proof.branch === evidence.localGit.branch &&
    proof.protected_base.branch === binding.baseBranch && proof.protected_base.branch === evidence.protectedBase.branch &&
    proof.protected_base.historical_sha.toLowerCase() === binding.baseSha &&
    proof.protected_base.live_sha.toLowerCase() === evidence.protectedBase.sha.toLowerCase() &&
    proof.historical_handoff.comment_id === binding.handoffCommentId &&
    proof.historical_handoff.exact_head.toLowerCase() === binding.baseSha &&
    proof.distinct_roots === true && isAbsolute(proof.source.root) && isAbsolute(proof.target.root) &&
    proof.source.root !== proof.target.root && proof.source.accessible === true && proof.target.accessible === true &&
    proof.source.clean && proof.source.head.toLowerCase() === proof.protected_base.live_sha.toLowerCase() &&
    proof.target.clean && proof.target.head.toLowerCase() === binding.wipHead &&
    proof.target.head.toLowerCase() === evidence.localGit.head?.toLowerCase() &&
    proof.target.tree.toLowerCase() === binding.wipTree &&
    proof.target.upstream === `origin/${binding.branch}` && proof.target.upstream === evidence.localGit.upstream &&
    evidence.localGit.clean && evidence.localGit.durable && !evidence.localGit.detached &&
    proof.ancestry.historical_to_target === 'STRICT_ANCESTOR' && proof.ancestry.target_to_historical === 'NOT_ANCESTOR' &&
    proof.provenance.author === binding.wipAuthor && proof.provenance.subject === binding.wipSubject &&
    samePaths(proof.provenance.paths)
}

function isCandidate(evidence: NormalizedContextEvidence): boolean {
  const binding = COMMITTED_WIP_BINDING
  return evidence.issue.number === binding.issueNumber && evidence.localGit.branch === binding.branch &&
    evidence.localGit.head?.toLowerCase() === binding.wipHead
}

/** Route only the exact preserved #627 RED-WIP target through its proof boundary. */
export function committedWipTargetBoundary(evidence: NormalizedContextEvidence): NoPrDecision | null {
  if (!isCandidate(evidence) && !evidence.committedWipProof) return null

  if (isCandidate(evidence) && exactProof(evidence)) return {
    route: 'IMPLEMENT',
    reasons: ['Exact per-run Architecture A proof authorizes reentry only into the current #627 RED/incomplete objective.'],
    nextAction: {
      type: 'COMMAND',
      command: null,
      description: 'Resume only the bounded Architecture A reentry for the current incomplete #627 RED-WIP objective; no later objective, PR, HANDOFF, or completion authority is granted.',
    },
  }

  return {
    route: 'STOP',
    reasons: [
      'EVIDENCE_CONFLICT: committed-WIP evidence is absent or differs from the exact per-run Architecture A source/target proof.',
    ],
    nextAction: {
      type: 'STOP',
      command: null,
      description: 'Preserve B unchanged. Run bemoat:context:recover-committed-wip only from current merged exact-live protected-main source with one explicit distinct target worktree; this target Context grants no authority to edit.',
    },
  }
}
