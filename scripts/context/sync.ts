import type { ActivePullRequestEvidence, ContextDecision, NormalizedContextEvidence } from './model.ts'
import { isFullSha } from './runtime.ts'
import { routeContextForStaleBaseSync } from './router.ts'
import { staleBaseError } from './stale-base.ts'
import { runContextCommand, type ContextCommandResult, type ContextCommandRunner } from './runtime.ts'
import { verifyContextSyncSource } from './sync-worktree.ts'
import { parseHandoffBody, renderHandoffComment } from '../handoff/schema.ts'
import { pullRequestUrlMatchesRepositoryClaim, repositoryClaimMatches } from './historical-repository-identity.ts'

export type ContextSyncClassification = 'SUCCESS' | 'EVIDENCE_CONFLICT' | 'HEAD_DRIFT' | 'BLOCKED_EXTERNAL' | 'AMBIGUOUS_RESULT'

export interface ContextSyncResult {
  classification: ContextSyncClassification
  mutationPerformed: boolean
  route: ContextDecision['route']
  reasons: string[]
  nextAction: ContextDecision['nextAction']
  currentHead: string | null
}

interface Authorization {
  allowed: boolean
  route: ContextDecision['route']
  reasons: string[]
  recovery?: ContextSyncRecovery
}

export interface ContextSyncRecovery {
  type: 'SYNC_BASE'
  command: 'bemoat:context:sync-base'
  args: [string, '--json']
  binding: {
    repository: string
    issue: { number: string; scope: string | null }
    pr: {
      number: string
      url: string
      branch: string
      head: string
      base: { branch: string; sha: string }
    }
    protected_base: { branch: string; sha: string }
    origin: { repository: string | null; upstream: string | null }
    local_state: {
      branch: string
      head: string | null
      clean: boolean
      detached: boolean
      pushed: boolean
      durable: boolean
    }
    scope_handoff_id?: string
  }
}

function stop(classification: Exclude<ContextSyncClassification, 'SUCCESS'>, reasons: string[], description = 'Resolve the stale-base synchronization blockers before continuing.'): ContextSyncResult {
  return {
    classification,
    mutationPerformed: false,
    route: 'STOP',
    reasons: [...new Set(reasons)],
    nextAction: { type: 'STOP', command: null, description },
    currentHead: null,
  }
}

function ambiguous(reasons: string[], currentHead: string | null): ContextSyncResult {
  return {
    ...stop('AMBIGUOUS_RESULT', reasons),
    classification: 'AMBIGUOUS_RESULT',
    mutationPerformed: true,
    currentHead,
  }
}

function commandResult(result: ContextCommandResult): string | null {
  if (result.status !== 0 || result.error) return null
  return result.stdout.trim()
}

function remoteSha(output: string | null): string | null {
  const match = output?.match(/^([0-9a-f]{40})\s+refs\/heads\/[^\s]+$/im)
  return match?.[1] ?? null
}

function latestHandoffBindsScope(evidence: NormalizedContextEvidence, activePr: ActivePullRequestEvidence): boolean {
  const source = evidence.durableContext.latestHandoff
  const body = source?.body
  const match = body?.match(/^## HANDOFF\n\n```json\n([\s\S]+)\n```\n$/)
  if (!match) return false

  try {
    const handoff = parseHandoffBody(match[1])
    if (handoff.repository !== evidence.repository.nameWithOwner && evidence.policy.trustedFounderLogin !== 'bemoat') return false
    return renderHandoffComment(handoff) === body &&
      repositoryClaimMatches(handoff.repository, evidence.repository.nameWithOwner, source?.repositoryIdentityProof, { id: source?.id ?? '', url: source?.url ?? '', body: source?.body ?? '' }) &&
      handoff.issue_number === evidence.issue.number &&
      handoff.branch === activePr.headBranch &&
      handoff.exact_head === activePr.headSha &&
      handoff.local_durability.durable === true &&
      handoff.protected_base.branch === activePr.baseBranch &&
      handoff.protected_base.sha === activePr.baseSha &&
      handoff.pr?.number === activePr.number &&
      (handoff.pr.url === activePr.url || pullRequestUrlMatchesRepositoryClaim(
        handoff.repository, evidence.repository.nameWithOwner, handoff.pr.url, activePr.number,
        source?.repositoryIdentityProof, { id: source?.id ?? '', url: source?.url ?? '', body: source?.body ?? '' },
      )) &&
      handoff.pr.base === activePr.baseBranch &&
      handoff.pr.head === activePr.headBranch &&
      handoff.pr.head_sha === activePr.headSha
  } catch {
    return false
  }
}

export function authorizeContextSync(evidence: NormalizedContextEvidence): Authorization {
  const activePr = evidence.activePr
  if (Array.isArray(activePr)) return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: competing active PRs cannot be uniquely resolved'] }
  if (!activePr) return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: no active PR is available for stale-base synchronization'] }

  const expectedStaleError = staleBaseError(evidence, activePr.number)
  if (evidence.evidenceErrors.length !== 1 || evidence.evidenceErrors[0] !== expectedStaleError) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: stale-base synchronization requires staleness to be the sole evidence error'] }
  }
  if (evidence.issue.state.toUpperCase() !== 'OPEN' || activePr.state.toUpperCase() !== 'OPEN' || activePr.merged) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: Issue and PR must both remain open'] }
  }
  if (!isFullSha(evidence.protectedBase.sha) || !isFullSha(activePr.baseSha) || activePr.baseSha.toLowerCase() === evidence.protectedBase.sha.toLowerCase()) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: protected-base movement is missing or not stale'] }
  }
  if (activePr.baseBranch !== evidence.protectedBase.branch) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: active PR base branch differs from the protected base'] }
  }
  if (activePr.headBranch !== evidence.localGit.branch || activePr.headSha.toLowerCase() !== (evidence.localGit.head ?? '').toLowerCase()) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: local branch and HEAD do not match the active PR'] }
  }
  if (evidence.localGit.upstream !== `origin/${activePr.headBranch}`) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: active PR branch must track the canonical origin remote'] }
  }
  if (evidence.localGit.detached || !evidence.localGit.clean || !evidence.localGit.pushed || !evidence.localGit.durable) {
    return { allowed: false, route: 'STOP', reasons: ['LOCAL_STATE_NOT_DURABLE: synchronization requires clean, attached, pushed, durable local state'] }
  }
  if (evidence.localGit.originRepository !== evidence.repository.nameWithOwner) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: local origin is not the active repository'] }
  }
  const scopeBound = Boolean(evidence.issue.scope?.trim()) || latestHandoffBindsScope(evidence, activePr)
  if (!evidence.issue.objective?.trim() || !scopeBound) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: Issue objective and scope are required to bind the synchronization'] }
  }
  const before = routeContextForStaleBaseSync(evidence)
  if (!['VERIFY', 'FIX', 'REVIEW', 'FOUNDER_GATE'].includes(before.route)) {
    return { allowed: false, route: 'STOP', reasons: ['EVIDENCE_CONFLICT: pre-movement context is not otherwise valid for continuation'] }
  }
  return {
    allowed: true,
    route: before.route,
    reasons: [`Protected ${evidence.protectedBase.branch} advanced from ${activePr.baseSha} to ${evidence.protectedBase.sha}; one bounded synchronization is authorized.`],
    recovery: {
      type: 'SYNC_BASE',
      command: 'bemoat:context:sync-base',
      args: [evidence.issue.number, '--json'],
      binding: {
        repository: evidence.repository.nameWithOwner,
        issue: {
          number: evidence.issue.number,
          scope: evidence.issue.scope,
        },
        pr: {
          number: activePr.number,
          url: activePr.url,
          branch: activePr.headBranch,
          head: activePr.headSha,
          base: { branch: activePr.baseBranch, sha: activePr.baseSha },
        },
        protected_base: { branch: evidence.protectedBase.branch, sha: evidence.protectedBase.sha },
        origin: { repository: evidence.localGit.originRepository, upstream: evidence.localGit.upstream },
        local_state: {
          branch: evidence.localGit.branch,
          head: evidence.localGit.head,
          clean: evidence.localGit.clean,
          detached: evidence.localGit.detached,
          pushed: evidence.localGit.pushed,
          durable: evidence.localGit.durable,
        },
        ...(!evidence.issue.scope?.trim() && evidence.durableContext.latestHandoff
          ? { scope_handoff_id: String(evidence.durableContext.latestHandoff.id) }
          : {}),
      },
    },
  }
}

function readback(run: ContextCommandRunner, command: string, args: string[], cwd: string): string | null {
  return commandResult(run(command, args, { cwd }))
}

export function synchronizeContext({
  evidence,
  cwd = process.cwd(),
  sourceCwd = null,
  run = runContextCommand,
}: {
  evidence: NormalizedContextEvidence
  cwd?: string
  sourceCwd?: string | null
  run?: ContextCommandRunner
}): ContextSyncResult {
  const sourceErrors = sourceCwd
    ? verifyContextSyncSource({ sourceCwd, evidence, run })
    : []
  if (sourceErrors.length > 0) return stop('EVIDENCE_CONFLICT', sourceErrors)

  const authorization = authorizeContextSync(evidence)
  if (!authorization.allowed) return stop('EVIDENCE_CONFLICT', authorization.reasons)

  const activePr = evidence.activePr as ActivePullRequestEvidence
  const remote = 'origin'
  const checks: Array<[string, string[], string]> = [
    ['git status --short', ['status', '--short'], ''],
    ['git branch --show-current', ['branch', '--show-current'], evidence.localGit.branch],
    ['git rev-parse HEAD', ['rev-parse', 'HEAD'], evidence.localGit.head ?? ''],
  ]
  for (const [label, args, expected] of checks) {
    const value = readback(run, 'git', args, cwd)
    if (value !== expected) return stop('HEAD_DRIFT', [`HEAD_DRIFT: ${label} changed before synchronization`])
  }

  const protectedRemote = readback(run, 'git', ['ls-remote', '--heads', remote, evidence.protectedBase.branch], cwd)
  if (remoteSha(protectedRemote) !== evidence.protectedBase.sha) {
    return stop('HEAD_DRIFT', ['HEAD_DRIFT: protected base changed or is not durably readable before synchronization'])
  }
  const branchRemote = readback(run, 'git', ['ls-remote', '--heads', remote, activePr.headBranch], cwd)
  if (remoteSha(branchRemote) !== activePr.headSha) {
    return stop('HEAD_DRIFT', ['HEAD_DRIFT: active PR branch changed before synchronization'])
  }

  const fetch = run('git', ['fetch', '--no-tags', remote, evidence.protectedBase.branch], { cwd })
  if (fetch.status !== 0 || fetch.error) return stop('BLOCKED_EXTERNAL', ['BLOCKED_EXTERNAL: protected base fetch failed'])
  const fetchedSha = readback(run, 'git', ['rev-parse', 'FETCH_HEAD'], cwd)
  if (!isFullSha(fetchedSha) || fetchedSha.toLowerCase() !== evidence.protectedBase.sha.toLowerCase()) {
    return stop('HEAD_DRIFT', ['HEAD_DRIFT: fetched protected base does not match the authoritative protected SHA'])
  }
  const oldBaseInProtected = run('git', ['merge-base', '--is-ancestor', activePr.baseSha, 'FETCH_HEAD'], { cwd })
  if (oldBaseInProtected.status !== 0 || oldBaseInProtected.error) return stop('EVIDENCE_CONFLICT', ['EVIDENCE_CONFLICT: protected main is not proven to advance from the active PR base'])
  const oldBaseInHead = run('git', ['merge-base', '--is-ancestor', activePr.baseSha, 'HEAD'], { cwd })
  if (oldBaseInHead.status !== 0 || oldBaseInHead.error) return stop('EVIDENCE_CONFLICT', ['EVIDENCE_CONFLICT: active PR head does not contain its recorded base'])
  const mergeTree = run('git', ['merge-tree', '--write-tree', 'HEAD', 'FETCH_HEAD'], { cwd })
  if (mergeTree.status !== 0 || mergeTree.error) return stop('EVIDENCE_CONFLICT', ['EVIDENCE_CONFLICT: protected-base synchronization has a merge conflict'])

  const sourceDrift = sourceCwd
    ? verifyContextSyncSource({ sourceCwd, evidence, run })
    : []
  if (sourceDrift.length > 0) {
    return stop('HEAD_DRIFT', sourceDrift.map((reason) => reason.replace(/^EVIDENCE_CONFLICT:/, 'HEAD_DRIFT:')))
  }
  for (const [label, args, expected] of checks) {
    const value = readback(run, 'git', args, cwd)
    if (value !== expected) return stop('HEAD_DRIFT', [`HEAD_DRIFT: ${label} changed immediately before synchronization`])
  }

  const protectedBeforeMerge = remoteSha(readback(run, 'git', ['ls-remote', '--heads', remote, evidence.protectedBase.branch], cwd))
  const branchBeforeMerge = remoteSha(readback(run, 'git', ['ls-remote', '--heads', remote, activePr.headBranch], cwd))
  if (protectedBeforeMerge !== evidence.protectedBase.sha || branchBeforeMerge !== activePr.headSha) {
    return stop('HEAD_DRIFT', ['HEAD_DRIFT: protected base or active PR head changed immediately before synchronization'])
  }

  const merge = run('git', ['merge', '--no-edit', 'FETCH_HEAD'], { cwd })
  if (merge.status !== 0 || merge.error) {
    const failedHead = readback(run, 'git', ['rev-parse', 'HEAD'], cwd)
    const failedStatus = readback(run, 'git', ['status', '--short'], cwd)
    if (failedHead === activePr.headSha && failedStatus === '') return stop('EVIDENCE_CONFLICT', ['EVIDENCE_CONFLICT: protected-base synchronization failed before changing the branch'])
    return ambiguous(['AMBIGUOUS_RESULT: protected-base synchronization outcome is unavailable'], failedHead)
  }
  const nextHead = readback(run, 'git', ['rev-parse', 'HEAD'], cwd)
  if (!isFullSha(nextHead) || nextHead.toLowerCase() === activePr.headSha.toLowerCase()) {
    return ambiguous(['AMBIGUOUS_RESULT: synchronization did not produce a new exact head'], nextHead)
  }
  const postMergeStatus = readback(run, 'git', ['status', '--short'], cwd)
  if (postMergeStatus !== '') return ambiguous(['AMBIGUOUS_RESULT: synchronized branch is not clean'], nextHead)

  const push = run('git', ['push', remote, `HEAD:${activePr.headBranch}`], { cwd })
  if (push.status !== 0 || push.error) {
    return ambiguous(['AMBIGUOUS_RESULT: branch push outcome is unavailable after synchronization'], nextHead)
  }
  const pushedHead = remoteSha(readback(run, 'git', ['ls-remote', '--heads', remote, activePr.headBranch], cwd))
  if (pushedHead?.toLowerCase() !== nextHead.toLowerCase()) {
    return ambiguous(['AMBIGUOUS_RESULT: synchronized branch readback does not match the new exact head'], nextHead)
  }
  return {
    classification: 'SUCCESS',
    mutationPerformed: true,
    route: 'VERIFY',
    reasons: [...authorization.reasons, `Synchronized protected ${evidence.protectedBase.branch} into PR #${activePr.number} at ${nextHead}; exact-head CI and semantic review must rerun.`],
    nextAction: { type: 'COMMAND', command: 'bemoat:context', description: 'Reconstruct the synchronized exact-head context; CI and semantic review are now stale until rerun.' },
    currentHead: nextHead,
  }
}
