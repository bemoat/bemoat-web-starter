import { realpathSync, statSync } from 'node:fs'

import {
  ContextSyncWorktreeError,
  resolveContextSyncRoots,
} from './sync-worktree.ts'
import { isFullSha, normalizeOriginRepository, output, runContextCommand, type ContextCommandRunner } from './runtime.ts'

export { ContextSyncWorktreeError }

export function resolveSetupRecoveryRoots({
  sourceCwd,
  targetWorktree,
  realpath = realpathSync,
  stat = statSync,
}: {
  sourceCwd: string
  targetWorktree?: string | null
  realpath?: (path: string) => string
  stat?: (path: string) => { isDirectory(): boolean }
}): { sourceCwd: string; targetCwd: string; separateTarget: boolean } {
  const roots = resolveContextSyncRoots({ sourceCwd, targetWorktree, realpath, stat })
  return { ...roots, separateTarget: roots.sourceCwd !== roots.targetCwd }
}

function liveBaseSha({ cwd, repository, branch, run }: {
  cwd: string
  repository: string
  branch: string
  run: ContextCommandRunner
}): string | null {
  const github = run('gh', ['api', `repos/${repository}/git/ref/heads/${branch}`], { cwd })
  if (github.status !== 0 || github.error) return null
  let githubSha: string | null = null
  try {
    const payload = JSON.parse(github.stdout.trim()) as { object?: { sha?: unknown } }
    githubSha = isFullSha(payload.object?.sha) ? payload.object.sha.toLowerCase() : null
  } catch {
    return null
  }
  const remote = run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { cwd })
  if (remote.status !== 0 || remote.error) return null
  const lines = remote.stdout.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length !== 1) return null
  const match = lines[0]!.match(/^([0-9a-f]{40})\s+refs\/heads\/([^\s]+)$/i)
  const remoteSha = match?.[2] === branch ? match[1]!.toLowerCase() : null
  return githubSha && githubSha === remoteSha ? githubSha : null
}

export function verifySetupRecoveryWorktrees({
  sourceCwd,
  targetCwd,
  expectedRepository,
  expectedBaseBranch,
  expectedBaseSha,
  expectedLocalHead,
  separateTarget,
  boundary,
  run = runContextCommand,
}: {
  sourceCwd: string
  targetCwd: string
  expectedRepository: string
  expectedBaseBranch: string
  expectedBaseSha: string
  expectedLocalHead: string
  separateTarget: boolean
  boundary: 'initial' | 'before-fetch' | 'before-merge' | 'before-tracking-update'
  run?: ContextCommandRunner
}): string | null {
  const targetRoot = output(run('git', ['rev-parse', '--show-toplevel'], { cwd: targetCwd }))
  if (targetRoot !== targetCwd) return 'Target Git root does not match the explicit canonical target path.'
  if (!separateTarget) return null

  const targetHead = output(run('git', ['rev-parse', 'HEAD'], { cwd: targetCwd }))
  const targetStatus = output(run('git', ['status', '--short'], { cwd: targetCwd }))
  const targetBranch = output(run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: targetCwd }))
  const targetOrigin = normalizeOriginRepository(output(run('git', ['remote', 'get-url', 'origin'], { cwd: targetCwd })))
  const targetUpstream = output(run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd: targetCwd }))
  const targetTracking = output(run('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${expectedBaseBranch}`], { cwd: targetCwd }))
  const normalizedTargetHead = targetHead?.toLowerCase()
  const normalizedTracking = targetTracking?.toLowerCase()
  const stalePair = normalizedTargetHead === expectedLocalHead.toLowerCase() && normalizedTracking === expectedLocalHead.toLowerCase()
  const completedPair = normalizedTargetHead === expectedBaseSha.toLowerCase() && normalizedTracking === expectedBaseSha.toLowerCase()
  const postMergePair = normalizedTargetHead === expectedBaseSha.toLowerCase() && normalizedTracking === expectedLocalHead.toLowerCase()
  const exactBindingPair = boundary === 'before-tracking-update'
    ? postMergePair
    : stalePair || (boundary === 'initial' && completedPair)
  if (!isFullSha(targetHead) || !exactBindingPair) return 'Target HEAD and tracking ref do not match one exact bound recovery state.'
  if (targetStatus !== '') return 'Target is not clean or its status is unavailable.'
  if (targetBranch !== expectedBaseBranch) return 'Target is not attached to the bound protected branch.'
  if (targetOrigin !== expectedRepository) return 'Target origin is not the canonical repository.'
  if (targetUpstream !== `origin/${expectedBaseBranch}`) return 'Target does not track the canonical origin protected branch.'
  if (liveBaseSha({ cwd: targetCwd, repository: expectedRepository, branch: expectedBaseBranch, run }) !== expectedBaseSha.toLowerCase()) {
    return 'Target live GitHub and origin protected-base identity drifted from the exact binding.'
  }

  const sourceRoot = output(run('git', ['rev-parse', '--show-toplevel'], { cwd: sourceCwd }))
  const sourceHead = output(run('git', ['rev-parse', 'HEAD'], { cwd: sourceCwd }))
  const sourceStatus = output(run('git', ['status', '--short'], { cwd: sourceCwd }))
  const sourceBranchResult = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: sourceCwd })
  const sourceBranch = output(sourceBranchResult)
  const sourceOrigin = normalizeOriginRepository(output(run('git', ['remote', 'get-url', 'origin'], { cwd: sourceCwd })))

  if (sourceRoot !== sourceCwd) return 'Protected-main command source Git root does not match its canonical invocation path.'
  if (!isFullSha(sourceHead) || sourceHead.toLowerCase() !== expectedBaseSha.toLowerCase()) return 'Protected-main command source HEAD is not the exact bound live protected-base SHA.'
  if (sourceStatus !== '') return 'Protected-main command source is not clean or its status is unavailable.'
  if (sourceBranchResult.error || (sourceBranchResult.status !== 0 && sourceBranchResult.status !== 1)) return 'Protected-main command source branch state is unavailable.'
  if (sourceBranch !== null && sourceBranch !== expectedBaseBranch) return 'Protected-main command source is attached to the wrong branch.'
  if (sourceOrigin !== expectedRepository) return 'Protected-main command source origin is not the canonical repository.'

  const sourceLiveBase = liveBaseSha({ cwd: sourceCwd, repository: expectedRepository, branch: expectedBaseBranch, run })
  if (sourceLiveBase !== expectedBaseSha.toLowerCase()) return 'Protected-main command source no longer matches the exact live GitHub and origin protected base.'
  return null
}
