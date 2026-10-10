import {
  COMMITTED_WIP_BINDING,
  COMMITTED_WIP_PATHS,
  recoverCommittedWip,
} from './committed-wip-recovery.ts'
import type { CommittedWipProof } from './model.ts'
import { runContextCommand, type ContextCommandRunner } from './runtime.ts'

export type CommittedWipProofCollection =
  | { proof: CommittedWipProof; error: null }
  | { proof: null; error: string }

function detailString(details: Record<string, unknown>, key: string): string | null {
  const value = details[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Derive one ephemeral Architecture A proof through the registered read-only verifier. */
export function collectCommittedWipContextProof({
  sourceCwd,
  targetWorktree,
  run = runContextCommand,
}: {
  sourceCwd: string
  targetWorktree: string
  run?: ContextCommandRunner
}): CommittedWipProofCollection {
  const binding = COMMITTED_WIP_BINDING
  const result = recoverCommittedWip({
    sourceCwd,
    run,
    binding: {
      issueNumber: binding.issueNumber,
      expectedRepository: binding.repository,
      expectedBranch: binding.branch,
      expectedBaseBranch: binding.baseBranch,
      expectedBaseSha: binding.baseSha,
      expectedHandoffCommentId: binding.handoffCommentId,
      expectedHandoffHead: binding.baseSha,
      expectedWipHead: binding.wipHead,
      expectedWipTree: binding.wipTree,
      targetWorktree,
    },
  })
  if (result.classification !== 'SUCCESS') {
    return { proof: null, error: `${result.classification}: ${result.reasons.join(' ')}` }
  }
  const sourceRoot = detailString(result.details, 'canonical_source_root')
  const targetRoot = detailString(result.details, 'canonical_target_root')
  const liveBase = detailString(result.details, 'live_protected_main_D')
  if (!sourceRoot || !targetRoot || !liveBase || sourceRoot === targetRoot) {
    return { proof: null, error: 'AMBIGUOUS_RESULT: committed-WIP proof roots or current protected base are unavailable.' }
  }
  return {
    error: null,
    proof: {
      status: 'PROVEN',
      repository: binding.repository,
      issue_number: binding.issueNumber,
      branch: binding.branch,
      protected_base: { branch: binding.baseBranch, historical_sha: binding.baseSha, live_sha: liveBase },
      historical_handoff: { comment_id: binding.handoffCommentId, exact_head: binding.baseSha },
      distinct_roots: true,
      source: { root: sourceRoot, head: liveBase, clean: true, accessible: true },
      target: { root: targetRoot, head: binding.wipHead, tree: binding.wipTree, upstream: `origin/${binding.branch}`, clean: true, accessible: true },
      ancestry: { historical_to_target: 'STRICT_ANCESTOR', target_to_historical: 'NOT_ANCESTOR' },
      provenance: { author: binding.wipAuthor, subject: binding.wipSubject, paths: [...COMMITTED_WIP_PATHS] },
    },
  }
}
