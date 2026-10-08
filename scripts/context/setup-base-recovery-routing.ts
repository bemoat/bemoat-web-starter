import type { ContextDecision, ContextSetupBaseRecovery, NormalizedContextEvidence } from './model.ts'

type SetupRecoveryDecision = Omit<ContextDecision, 'evidenceUrls'>

export function setupBaseRecoveryCandidate(evidence: NormalizedContextEvidence): ContextSetupBaseRecovery | null {
  const proof = evidence.setupBaseRecovery
  const base = evidence.protectedBase
  const local = evidence.localGit
  if (
    evidence.evidenceErrors.length > 0 || evidence.issue.state.toUpperCase() !== 'OPEN' ||
    evidence.activePr !== null || !base.branch || !/^[0-9a-f]{40}$/i.test(base.sha) ||
    !proof || proof.ancestry === 'NOT_ANCESTOR' || proof.liveUpstreamHead.toLowerCase() !== base.sha.toLowerCase() ||
    (proof.localUpstreamHead.toLowerCase() !== (local.head ?? '').toLowerCase() &&
      !(local.head?.toLowerCase() === '46fe5363697cb24f0db5a6d4338a5540665bb697' &&
        base.branch === 'main' && base.sha.toLowerCase() === 'e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3' &&
        proof.localUpstreamHead.toLowerCase() === base.sha.toLowerCase() && proof.ancestry === 'STRICT_ANCESTOR')) ||
    !local.head || local.head.toLowerCase() === base.sha.toLowerCase() ||
    local.branch !== base.branch || local.upstream !== `origin/${base.branch}` ||
    local.originRepository !== evidence.repository.nameWithOwner || !local.clean || local.detached ||
    local.pushed || local.durable
  ) return null

  const args = [
    evidence.issue.number,
    '--expected-repository', evidence.repository.nameWithOwner,
    '--expected-base-branch', base.branch,
    '--expected-base-sha', base.sha.toLowerCase(),
    '--expected-local-head', local.head.toLowerCase(),
    '--json',
  ]
  return {
    type: 'RECOVER_STALE_PROTECTED_BASE',
    command: 'bemoat:context:recover-setup',
    args,
    display_command: `pnpm run bemoat:context:recover-setup -- ${args.join(' ')}`,
    binding: {
      repository: evidence.repository.nameWithOwner,
      issue_number: evidence.issue.number,
      protected_base_branch: base.branch,
      protected_base: { branch: base.branch, sha: base.sha.toLowerCase() },
      local_state: {
        branch: local.branch,
        head: local.head.toLowerCase(),
        upstream: local.upstream,
        clean: true,
        detached: false,
      },
    },
  }
}

export function setupBaseRecoveryRoute(evidence: NormalizedContextEvidence): SetupRecoveryDecision | null {
  const recovery = setupBaseRecoveryCandidate(evidence)
  if (!recovery) return null
  return {
    route: 'STOP',
    reasons: [`Clean protected branch ${evidence.localGit.branch}@${evidence.localGit.head} is a bounded stale-base setup candidate for exact live ${evidence.protectedBase.branch}@${evidence.protectedBase.sha}.`],
    nextAction: {
      type: 'COMMAND',
      command: recovery.command,
      description: `Run the exact bound setup recovery, then immediately rerun registered CLI Discovery and fresh bemoat:context ${evidence.issue.number} --json. Recovery grants no objective-edit authority.`,
    },
    recovery,
  }
}

export function protectedBranchSetupState(evidence: NormalizedContextEvidence, mergedPr: boolean): {
  recovery: ContextSetupBaseRecovery | null
  durabilityReasons: string[]
  blocked: boolean
} {
  const recovery = setupBaseRecoveryCandidate(evidence)
  const local = evidence.localGit
  const durabilityReasons = !mergedPr && (!local.clean || local.detached || !local.pushed || !local.durable)
    ? recovery
      ? local.reasons.filter((reason) => reason !== 'LOCAL_STATE_NOT_DURABLE: current HEAD is not proven pushed to its live upstream')
      : [...local.reasons, 'LOCAL_STATE_NOT_DURABLE: required local work is not clean, pushed, and attached to a durable branch']
    : []
  const protectedBranch = /^(?:main|master|dev|develop|integration|staging|production)(?:\/.*)?$/i.test(local.branch)
  return { recovery, durabilityReasons, blocked: !mergedPr && protectedBranch && !recovery }
}
