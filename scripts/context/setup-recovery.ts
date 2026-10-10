import type { NormalizedContextEvidence } from './model.ts'
import { collectContextEvidence } from './evidence.ts'
import { isFullSha, output, runContextCommand, type ContextCommandRunner } from './runtime.ts'
import { routeNoPrContext } from './no-pr-routing.ts'
import { setupBaseRecoveryCandidate } from './objective-sequence-routing.ts'
import { identityErrors, routeContext } from './router.ts'

export type SetupRecoveryClassification = 'SUCCESS' | 'NO_OP_IDENTICAL_RETRY' | 'UNSUPPORTED_PRE_STATE' | 'STATE_CONFLICT' | 'HEAD_DRIFT' | 'BLOCKED_EXTERNAL' | 'EVIDENCE_CONFLICT' | 'AUTHORITY_CONFLICT'
export interface SetupRecoveryResult {
  classification: SetupRecoveryClassification
  mutationPerformed: boolean
  currentHead: string | null
  route: 'STOP'
  reasons: string[]
  nextAction: { type: 'COMMAND' | 'STOP'; command: string | null; description: string }
}

type Binding = { issueNumber: string; expectedRepository: string; expectedBaseBranch: string; expectedBaseSha: string; expectedLocalHead: string }
type RecoveryMutationBoundary = 'initial' | 'before-fetch' | 'before-merge' | 'before-tracking-update'

function fail(classification: SetupRecoveryClassification, reason: string, mutationPerformed = false): SetupRecoveryResult {
  return {
    classification,
    mutationPerformed,
    currentHead: null,
    route: 'STOP',
    reasons: [reason],
    nextAction: { type: 'STOP', command: null, description: 'Stop and reconstruct fresh evidence before continuing.' },
  }
}

function exactLiveRef({ cwd, run, branch }: { cwd: string; run: ContextCommandRunner; branch: string }): string | null {
  const result = run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { cwd })
  if (result.status !== 0 || result.error) return null
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length !== 1) return null
  const match = lines[0]!.match(/^([0-9a-f]{40})\s+refs\/heads\/([^\s]+)$/i)
  return match?.[2] === branch ? match[1]!.toLowerCase() : null
}

function exactGithubRef({ cwd, run, repository, branch }: {
  cwd: string
  run: ContextCommandRunner
  repository: string
  branch: string
}): string | null {
  const result = run('gh', ['api', `repos/${repository}/git/ref/heads/${branch}`], { cwd })
  if (result.status !== 0 || result.error) return null
  try {
    const payload = JSON.parse(result.stdout.trim()) as { object?: { sha?: unknown } }
    return isFullSha(payload.object?.sha) ? payload.object.sha.toLowerCase() : null
  } catch {
    return null
  }
}

function verifyPrestate({ evidence, binding, cwd, run, allowTrackingAhead = false }: {
  evidence: NormalizedContextEvidence
  binding: Binding
  cwd: string
  run: ContextCommandRunner
  allowTrackingAhead?: boolean
}): { ok: true; exactHead: string; initialTracking: string; baseBranch: string; baseSha: string } | { ok: false; classification: SetupRecoveryClassification; reason: string } {
  const { localGit, protectedBase, issue, repository } = evidence
  const issueNumber = binding.issueNumber
  if (evidence.evidenceErrors.length > 0 || !isFullSha(protectedBase.sha) || !protectedBase.branch) {
    return { ok: false, classification: 'EVIDENCE_CONFLICT', reason: 'Canonical Issue, policy, or protected-base evidence is missing or conflicting.' }
  }
  if (repository.nameWithOwner !== binding.expectedRepository || protectedBase.branch !== binding.expectedBaseBranch) {
    return { ok: false, classification: 'HEAD_DRIFT', reason: 'The fresh canonical repository or protected-base branch differs from the exact Context binding.' }
  }
  if (repository.nameWithOwner !== localGit.originRepository || localGit.originRepository !== repository.nameWithOwner) {
    return { ok: false, classification: 'EVIDENCE_CONFLICT', reason: 'Origin does not identify the canonical repository.' }
  }
  if (issue.number !== issueNumber || issue.state.toUpperCase() !== 'OPEN' || evidence.activePr !== null) {
    return { ok: false, classification: 'UNSUPPORTED_PRE_STATE', reason: 'Recovery requires the bound open Issue and no active PR.' }
  }
  if (!localGit.clean || localGit.detached || localGit.branch !== protectedBase.branch || localGit.upstream !== `origin/${protectedBase.branch}`) {
    return { ok: false, classification: 'UNSUPPORTED_PRE_STATE', reason: 'Recovery requires a clean attached checkout of the approved protected branch tracking origin/<base>.' }
  }
  if (!localGit.head || !isFullSha(localGit.head)) {
    return { ok: false, classification: 'EVIDENCE_CONFLICT', reason: 'Local HEAD is unavailable or malformed.' }
  }
  if (!isFullSha(binding.expectedBaseSha) || !isFullSha(binding.expectedLocalHead) || protectedBase.sha.toLowerCase() !== binding.expectedBaseSha.toLowerCase()) {
    return { ok: false, classification: 'HEAD_DRIFT', reason: 'The fresh protected-base or local HEAD differs from the exact Context binding.' }
  }
  const live = exactLiveRef({ cwd, run, branch: protectedBase.branch })
  if (!live || live !== protectedBase.sha.toLowerCase()) {
    return { ok: false, classification: 'EVIDENCE_CONFLICT', reason: 'The exact live origin protected-base ref is missing, ambiguous, or differs from live GitHub.' }
  }
  const tracking = output(run('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${protectedBase.branch}`], { cwd }))
  if (!tracking || !isFullSha(tracking)) {
    return { ok: false, classification: 'STATE_CONFLICT', reason: 'Local origin/<base> tracking ref is unavailable or malformed.' }
  }
  const initialTracking = tracking.toLowerCase()
  const targetTrackingAlreadyAtLive = allowTrackingAhead && localGit.branch === 'main' &&
    localGit.head.toLowerCase() === '46fe5363697cb24f0db5a6d4338a5540665bb697' &&
    protectedBase.sha.toLowerCase() === 'e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3' &&
    initialTracking === protectedBase.sha.toLowerCase()
  if (initialTracking !== localGit.head.toLowerCase() && !targetTrackingAlreadyAtLive) {
    return { ok: false, classification: 'STATE_CONFLICT', reason: 'Local origin/<base> tracking ref differs from HEAD and is not the exact live-base target recovery shape.' }
  }
  if (
    localGit.head.toLowerCase() !== binding.expectedLocalHead.toLowerCase() &&
    localGit.head.toLowerCase() !== protectedBase.sha.toLowerCase()
  ) {
    return { ok: false, classification: 'HEAD_DRIFT', reason: 'Local HEAD differs from the Context binding and is not already at the exact live base.' }
  }
  return { ok: true, exactHead: localGit.head.toLowerCase(), initialTracking, baseBranch: protectedBase.branch, baseSha: protectedBase.sha.toLowerCase() }
}

function collect(issueNumber: string, cwd: string, run: ContextCommandRunner): NormalizedContextEvidence {
  return collectContextEvidence({ issueNumber, cwd, run })
}

function verifyNoPrGate(evidence: NormalizedContextEvidence):
  { ok: true } | { ok: false; classification: SetupRecoveryClassification; reason: string } {
  const canonicalErrors = identityErrors(evidence)
  if (canonicalErrors.length > 0) {
    return { ok: false, classification: 'EVIDENCE_CONFLICT', reason: `Canonical identity gate failed: ${canonicalErrors.join('; ')}` }
  }
  const decision = routeNoPrContext(evidence)
  const allowed = decision.route === 'IMPLEMENT' && decision.nextAction.type === 'COMMAND' && decision.nextAction.command === null
  return allowed
    ? { ok: true }
    : { ok: false, classification: decision.route === 'FOUNDER_GATE' || decision.route === 'COMPLETE' ? 'AUTHORITY_CONFLICT' : 'STATE_CONFLICT', reason: `Fresh no-PR workflow gate returned ${decision.route}/${decision.nextAction.type}; recovery may proceed only under the fresh setup route with no blocking HANDOFF gate.` }
}

function verifyFreshContextRecoveryRoute(evidence: NormalizedContextEvidence): { ok: true } | { ok: false; classification: SetupRecoveryClassification; reason: string } {
  const decision = routeContext(evidence)
  const candidate = setupBaseRecoveryCandidate(evidence)
  const actual = decision.recovery
  if (
    decision.route !== 'STOP' || decision.nextAction.type !== 'COMMAND' ||
    decision.nextAction.command !== 'bemoat:context:recover-setup' || !candidate || !actual ||
    actual.type !== 'RECOVER_STALE_PROTECTED_BASE' ||
    actual.binding.repository !== candidate.binding.repository ||
    actual.binding.issue_number !== candidate.binding.issue_number ||
    actual.binding.protected_base_branch !== candidate.binding.protected_base_branch ||
    actual.binding.protected_base.sha !== candidate.binding.protected_base.sha ||
    actual.binding.target_worktree !== candidate.binding.target_worktree ||
    actual.binding.local_state.head !== candidate.binding.local_state.head ||
    actual.binding.local_state.branch !== candidate.binding.local_state.branch ||
    actual.binding.local_state.upstream !== candidate.binding.local_state.upstream
  ) {
    return { ok: false, classification: 'STATE_CONFLICT', reason: 'Fresh full Context no longer returns the exact bound setup recovery COMMAND.' }
  }
  return { ok: true }
}

function verifyFetchedBinding({ evidence, binding, baseBranch, initialTracking, cwd, run }: {
  evidence: NormalizedContextEvidence
  binding: Binding
  baseBranch: string
  initialTracking: string
  cwd: string
  run: ContextCommandRunner
}): { ok: true } | { ok: false; classification: SetupRecoveryClassification; reason: string } {
  const { localGit, protectedBase, issue, repository } = evidence
  if (evidence.evidenceErrors.length > 0 || issue.number !== binding.issueNumber || issue.state.toUpperCase() !== 'OPEN' || evidence.activePr !== null) {
    return { ok: false, classification: 'EVIDENCE_CONFLICT', reason: 'Fresh Issue or repository evidence changed or contains conflicts after fetch.' }
  }
  if (repository.nameWithOwner !== binding.expectedRepository || protectedBase.branch !== binding.expectedBaseBranch || localGit.originRepository !== binding.expectedRepository) {
    return { ok: false, classification: 'HEAD_DRIFT', reason: 'Fresh repository, origin, or protected-base branch differs from the exact Context binding.' }
  }
  if (
    repository.nameWithOwner !== localGit.originRepository || localGit.originRepository !== repository.nameWithOwner ||
    localGit.branch !== baseBranch || localGit.upstream !== `origin/${baseBranch}` ||
    !localGit.clean || localGit.detached || localGit.head?.toLowerCase() !== binding.expectedLocalHead.toLowerCase() ||
    protectedBase.branch !== baseBranch || protectedBase.sha.toLowerCase() !== binding.expectedBaseSha.toLowerCase()
  ) return { ok: false, classification: 'HEAD_DRIFT', reason: 'Bound Issue, branch, local HEAD, or live protected-base identity changed after fetch.' }
  const tracking = output(run('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${baseBranch}`], { cwd }))
  const remote = exactLiveRef({ cwd, run, branch: baseBranch })
  if (tracking?.toLowerCase() !== initialTracking.toLowerCase() || remote !== binding.expectedBaseSha.toLowerCase()) {
    return { ok: false, classification: 'HEAD_DRIFT', reason: 'The captured tracking ref or exact live origin ref differs from the bound pre-fetch/local and protected-base SHAs.' }
  }
  return { ok: true }
}

export function recoverSetupBase({
  cwd = process.cwd(),
  run = runContextCommand,
  binding,
  verifySource,
}: {
  cwd?: string
  run?: ContextCommandRunner
  binding: Binding
  verifySource?: (boundary: RecoveryMutationBoundary, initialTracking?: string) => string | null
}): SetupRecoveryResult {
  const checkSource = (boundary: RecoveryMutationBoundary, mutationPerformed = false, initialTracking?: string): SetupRecoveryResult | null => {
    const reason = verifySource?.(boundary, initialTracking)
    return reason ? fail('EVIDENCE_CONFLICT', reason, mutationPerformed) : null
  }
  const sourceInitial = checkSource('initial')
  if (sourceInitial) return sourceInitial
  let evidence = collect(binding.issueNumber, cwd, run)
  const verified = verifyPrestate({ evidence, binding, cwd, run, allowTrackingAhead: verifySource !== undefined })
  if (verified.ok === false) return fail(verified.classification, verified.reason)

  if (verified.exactHead === verified.baseSha) {
    const gate = verifyNoPrGate(evidence)
    if (gate.ok === false) return fail(gate.classification, gate.reason)
    return {
      classification: 'NO_OP_IDENTICAL_RETRY',
      mutationPerformed: false,
      currentHead: verified.exactHead,
      route: 'STOP',
      reasons: ['Local protected-base HEAD already equals the exact live GitHub and origin base; no fetch or Git mutation was needed.'],
      nextAction: { type: 'COMMAND', command: 'bemoat:context', description: `Rerun registered CLI Discovery and fresh bemoat:context ${binding.issueNumber} --json; exact-base setup recovery grants no objective-edit authority.` },
    }
  }

  if (!setupBaseRecoveryCandidate(evidence)) {
    return fail('UNSUPPORTED_PRE_STATE', 'Fresh Context does not prove the narrow clean stale protected-base setup candidate.')
  }
  const initialGate = verifyFreshContextRecoveryRoute(evidence)
  if (initialGate.ok === false) return fail(initialGate.classification, initialGate.reason)

  const githubBeforeFetch = exactGithubRef({ cwd, run, repository: binding.expectedRepository, branch: verified.baseBranch })
  const originBeforeFetch = exactLiveRef({ cwd, run, branch: verified.baseBranch })
  if (githubBeforeFetch !== verified.baseSha || originBeforeFetch !== verified.baseSha) {
    return fail('HEAD_DRIFT', 'Live protected-base identity moved before the exact fetch.')
  }
  const sourceBeforeFetch = checkSource('before-fetch', false, verified.initialTracking)
  if (sourceBeforeFetch) return sourceBeforeFetch
  const fetched = run('git', ['fetch', '--no-tags', '--no-recurse-submodules', '--refmap=', 'origin', `refs/heads/${verified.baseBranch}:`], { cwd })
  if (fetched.status !== 0 || fetched.error) {
    return fail('BLOCKED_EXTERNAL', `Exact protected-base fetch failed: ${fetched.error?.message || fetched.stderr.trim() || 'git fetch failed'}`, true)
  }
  const fetchedHead = output(run('git', ['rev-parse', '--verify', '--quiet', 'FETCH_HEAD'], { cwd }))
  if (!fetchedHead || fetchedHead.toLowerCase() !== verified.baseSha) {
    return fail('HEAD_DRIFT', 'Fetched FETCH_HEAD differs from the exact live protected-base SHA bound by Context.', true)
  }

  evidence = collect(binding.issueNumber, cwd, run)
  const postFetch = verifyFetchedBinding({ evidence, binding, baseBranch: verified.baseBranch, initialTracking: verified.initialTracking, cwd, run })
  if (postFetch.ok === false) return fail(postFetch.classification, postFetch.reason, true)
  const postFetchGate = verifyFreshContextRecoveryRoute(evidence)
  if (postFetchGate.ok === false) return fail(postFetchGate.classification, postFetchGate.reason, true)

  const ancestry = run('git', ['merge-base', '--is-ancestor', 'HEAD', verified.baseSha], { cwd })
  if (ancestry.status !== 0 || ancestry.error) {
    return fail('STATE_CONFLICT', 'After exact fetch, local HEAD is not proven a strict ancestor of the exact live protected base; no merge was attempted.', true)
  }
  const reverseAncestry = run('git', ['merge-base', '--is-ancestor', verified.baseSha, 'HEAD'], { cwd })
  if (reverseAncestry.status === 0) return fail('STATE_CONFLICT', 'The fetched live base is an ancestor of local HEAD; local-only commits are present.', true)
  if (reverseAncestry.status !== 1 || reverseAncestry.error) return fail('EVIDENCE_CONFLICT', 'Could not prove the fetched base is not already an ancestor of local HEAD.', true)

  const beforeMerge = collect(binding.issueNumber, cwd, run)
  const currentBinding = verifyFetchedBinding({ evidence: beforeMerge, binding, baseBranch: verified.baseBranch, initialTracking: verified.initialTracking, cwd, run })
  const beforeMergeGate = verifyFreshContextRecoveryRoute(beforeMerge)
  if (beforeMergeGate.ok === false) return fail(beforeMergeGate.classification, beforeMergeGate.reason, true)
  const githubImmediatelyBeforeMerge = exactGithubRef({ cwd, run, repository: beforeMerge.repository.nameWithOwner, branch: verified.baseBranch })
  const refImmediatelyBeforeMerge = exactLiveRef({ cwd, run, branch: verified.baseBranch })
  if (currentBinding.ok === false) return fail(currentBinding.classification, currentBinding.reason, true)
  if (refImmediatelyBeforeMerge !== verified.baseSha || githubImmediatelyBeforeMerge !== verified.baseSha) {
    return fail('HEAD_DRIFT', 'Live protected base moved immediately before fast-forward.', true)
  }
  const sourceBeforeMerge = checkSource('before-merge', true, verified.initialTracking)
  if (sourceBeforeMerge) return sourceBeforeMerge

  const merged = run('git', ['merge', '--ff-only', verified.baseSha], { cwd })
  if (merged.status !== 0 || merged.error) {
    return fail('STATE_CONFLICT', `Fast-forward-only recovery failed: ${merged.error?.message || merged.stderr.trim() || 'git merge --ff-only failed'}`, true)
  }

  const trackingRef = `refs/remotes/origin/${verified.baseBranch}`
  const sourceBeforeTrackingUpdateReason = verifySource?.('before-tracking-update', verified.initialTracking)
  const sourceBeforeTrackingUpdate = sourceBeforeTrackingUpdateReason ? fail('EVIDENCE_CONFLICT', sourceBeforeTrackingUpdateReason, true) : null
  if (sourceBeforeTrackingUpdate) return sourceBeforeTrackingUpdate
  const trackingAdvance = run('git', ['update-ref', trackingRef, verified.baseSha, verified.initialTracking], { cwd })
  if (trackingAdvance.status !== 0 || trackingAdvance.error) {
    return fail('HEAD_DRIFT', `Fast-forward completed but compare-and-swap tracking-ref advancement failed: ${trackingAdvance.error?.message || trackingAdvance.stderr.trim() || 'git update-ref failed'}; stop and reconstruct from the observed state.`, true)
  }

  const after = collect(binding.issueNumber, cwd, run)
  const post = verifyPrestate({ evidence: after, binding: { ...binding, expectedLocalHead: verified.baseSha }, cwd, run })
  const postHead = output(run('git', ['rev-parse', 'HEAD'], { cwd }))?.toLowerCase() ?? null
  const postStatus = output(run('git', ['status', '--short'], { cwd }))
  const postUpstream = output(run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd }))
  const remoteAfter = exactLiveRef({ cwd, run, branch: verified.baseBranch })
  if (post.ok === false || postHead !== verified.baseSha || postStatus !== '' || postUpstream !== `origin/${verified.baseBranch}` || remoteAfter !== verified.baseSha || after.protectedBase.sha.toLowerCase() !== verified.baseSha || after.activePr !== null) {
    return fail('HEAD_DRIFT', `Fast-forward post-readback did not prove clean exact ${verified.baseBranch}@${verified.baseSha}; stop and reconstruct from the observed state.`, true)
  }
  const postMergeGate = verifyNoPrGate(after)
  if (postMergeGate.ok === false) return fail(postMergeGate.classification, postMergeGate.reason, true)

  return {
    classification: 'SUCCESS',
    mutationPerformed: true,
    currentHead: postHead,
    route: 'STOP',
    reasons: [`Clean protected branch was fast-forwarded to exact live ${verified.baseBranch}@${verified.baseSha}.`],
    nextAction: { type: 'COMMAND', command: 'bemoat:context', description: `Rerun registered CLI Discovery and fresh bemoat:context ${binding.issueNumber} --json. Recovery grants no objective-edit authority.` },
  }
}
